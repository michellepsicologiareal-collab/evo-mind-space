import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus, ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon,
  Check, X, RotateCcw, Trash2, Link2, CheckCircle2, GraduationCap,
  MessageCircle, Pencil, Filter, Users, ArrowUpDown, User, DollarSign, FileText,
  Video, MapPin, CalendarDays, CalendarRange, CalendarCheck, RefreshCw, MoreHorizontal, Bell,
} from "lucide-react";
import {
  addDays, addWeeks, addMonths, format, isSameDay, isSameMonth,
  startOfWeek, startOfMonth, endOfMonth, parse, getDaysInMonth,
  getDay, subMonths
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { UnsavedGuardDialog } from "@/components/app/UnsavedGuardDialog";
import { EmotionChips } from "@/components/app/EmotionChips";
import { useIsMobile } from "@/hooks/use-mobile";
import { preserveScroll, keepScroll } from "@/lib/preserveScroll";
import { PageIntro } from "@/components/app/PageIntro";


type Status = "scheduled" | "completed" | "no_show" | "rescheduled" | "cancelled" | "confirmed";
type PaymentStatus = "pending" | "paid";
type SessionType = "clinical" | "supervision";

interface Session {
  id: string;
  patient_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: Status;
  price: number | null;
  notes: string | null;
  confirmation_token: string | null;
  confirmation_sent_at?: string | null;
  session_type: SessionType;
  discussed_patient_id: string | null;
  is_expense: boolean;
  payment_status: PaymentStatus;
  payment_method?: string | null;
  payment_reference?: string | null;
  patient_name?: string | null;
  discussed_patient_name?: string | null;
  service_id?: string | null;
  billing_sent_at?: string | null;
  modality?: string;
  meeting_link?: string | null;
}

interface Patient {
  id: string;
  full_name: string;
  session_price: number | null;
  phone: string | null;
  has_financial_responsible: boolean;
  financial_responsible_name: string | null;
  financial_responsible_phone: string | null;
}

interface Service {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
}

const sessionSchema = z
  .object({
    session_type: z.enum(["clinical", "supervision"]).default("clinical"),
    patient_id: z.string().optional(),
    discussed_patient_id: z.string().optional(),
    date: z.string().min(1, "Selecione a data"),
    time: z.string().min(1, "Selecione o horário"),
    duration_minutes: z.number().int().positive().max(480),
    price: z.string().optional(),
    notes: z.string().max(2000).optional(),
    payment_method: z.enum(["none", "pix", "card", "cash"]).default("none"),
    payment_reference: z.string().max(500).optional(),
    mood_score: z.string().optional(),
    progress_note: z.string().max(2000).optional(),
  })
  .refine(
    (d) => d.session_type === "supervision" || (d.patient_id && d.patient_id.length > 0),
    { path: ["patient_id"], message: "Selecione um paciente" }
  )
  .refine(
    (d) =>
      !(d.payment_method === "pix" || d.payment_method === "card") ||
      (d.payment_reference?.trim().length ?? 0) > 0,
    { path: ["payment_reference"], message: "Informe a referência do pagamento." }
  );

const statusLabel: Record<Status, string> = {
  scheduled: "Agendada", confirmed: "Confirmada", completed: "Realizada",
  no_show: "Falta", rescheduled: "Remarcada", cancelled: "Cancelada",
};
const statusClass: Record<Status, string> = {
  scheduled:   "bg-gray-100 text-gray-600 border-gray-200",
  confirmed:   "bg-green-100 text-green-800 border-green-200",
  completed:   "bg-gray-50 text-gray-400 border-gray-200",
  no_show:     "bg-destructive/15 text-destructive border-destructive/30",
  rescheduled: "bg-amber-100 text-amber-800 border-amber-200",
  cancelled:   "bg-muted text-muted-foreground border-muted line-through",
};
const paymentStatusLabel: Record<PaymentStatus, string> = { pending: "Pendente", paid: "Pago" };
const paymentStatusClass: Record<PaymentStatus, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  paid:    "bg-green-100 text-green-800 border-green-200",
};
const PILL_BASE = "inline-flex items-center text-[11px] font-display font-semibold px-2.5 py-0.5 rounded-[40px] border";

const WEEKDAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const Agenda = () => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [sessions, setSessions] = useState<Session[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [pixKey, setPixKey] = useState("");
  const [psiName, setPsiName] = useState("");
  const [psiCrp, setPsiCrp] = useState("");
  const [viewTab, setViewTab] = useState<string>("month");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [patientFilter, setPatientFilter] = useState<string>("all");

  // Pending
  const [pendingSessions, setPendingSessions] = useState<Session[]>([]);
  const [pendingPackageSessions, setPendingPackageSessions] = useState<Session[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [pendingSort, setPendingSort] = useState<"date" | "patient">("date");
  const [paymentFilter, setPaymentFilter] = useState<"pending" | "paid" | "all">("pending");

  // New session dialog
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [patientMonthCount, setPatientMonthCount] = useState<{ count: number; dates: string[] } | null>(null);
  const DRAFT_SESSION_KEY = "rascunho_nova_sessao";
  const newGuard = useUnsavedGuard();
  const [draftRestored, setDraftRestored] = useState(false);
  const emptySessionForm = {
    session_type: "clinical" as SessionType,
    patient_id: "", discussed_patient_id: "",
    date: format(new Date(), "yyyy-MM-dd"), time: "09:00",
    duration_minutes: 50, price: "", notes: "",
    payment_method: "none" as "none" | "pix" | "card" | "cash",
    payment_reference: "", mood_score: "", progress_note: "",
    recurrence: "single" as "single" | "recurring",
    recurrence_count: 4, recurrence_interval: "weekly" as "weekly" | "biweekly",
    payment_plan: "per_session" as "per_session" | "single_payment",
    service_id: "" as string,
    modality: "presencial" as "presencial" | "online",
    meeting_link: "",
  };
  const [form, setFormRaw] = useState(emptySessionForm);
  const setForm: typeof setFormRaw = useCallback((v) => { newGuard.markDirty(); setFormRaw(v); }, [newGuard.markDirty]);

  // Auto-save draft to localStorage (only for new session)
  const draftSaveRef = useRef(false);
  useEffect(() => { draftSaveRef.current = open; }, [open]);
  useEffect(() => {
    if (!draftSaveRef.current) return;
    if (form.patient_id || form.notes || form.price) {
      try { localStorage.setItem(DRAFT_SESSION_KEY, JSON.stringify(form)); } catch {}
    }
  }, [form]);

  const clearSessionDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_SESSION_KEY); } catch {}
    setDraftRestored(false);
  }, []);

  // Edit session
  const [editOpen, setEditOpen] = useState(false);
  const [editSessionId, setEditSessionId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const editGuard = useUnsavedGuard();
  const [editForm, setEditFormRaw] = useState({
    status: "scheduled" as Status,
    payment_status: "pending" as PaymentStatus,
    payment_method: "none" as "none" | "pix" | "card" | "cash",
    payment_reference: "", price: "", notes: "",
    duration_minutes: 50, mood_score: "", progress_note: "",
    session_type: "clinical" as SessionType,
    service_id: "" as string,
    recurrence: "single" as "single" | "recurring",
    recurrence_count: 4, recurrence_interval: "weekly" as "weekly" | "biweekly",
    payment_plan: "per_session" as "per_session" | "single_payment",
    date: "", time: "",
    modality: "presencial" as "presencial" | "online",
    meeting_link: "",
  });
  const setEditForm: typeof setEditFormRaw = useCallback((v) => { editGuard.markDirty(); setEditFormRaw(v); }, [editGuard.markDirty]);
  const [editProgressId, setEditProgressId] = useState<string | null>(null);

  // Patient filter for pending list
  const [filterPatientId, setFilterPatientId] = useState<string>("all");

  // Delete confirmation modal
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reschedule recurring modal
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [pendingEditEvent, setPendingEditEvent] = useState<React.FormEvent | null>(null);

  // Patient drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPatientId, setDrawerPatientId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState("sessions");
  const [drawerPatientData, setDrawerPatientData] = useState<any>(null);
  const [drawerSessions, setDrawerSessions] = useState<any[]>([]);
  const [drawerLoadingSessions, setDrawerLoadingSessions] = useState(false);

  // ── Google Calendar sync ──
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalLoading, setGcalLoading] = useState(false);

  const loadGcalStatus = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase.functions.invoke("google-calendar-sync", { body: { action: "status" } });
      setGcalConnected(!!(data as any)?.connected);
    } catch { /* ignore */ }
  }, [user]);

  const connectGcal = async () => {
    setGcalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-auth", { body: {} });
      if (error || !(data as any)?.url) { toast.error("Não foi possível iniciar a conexão com o Google"); return; }
      window.location.href = (data as any).url;
    } finally { setGcalLoading(false); }
  };

  const disconnectGcal = async () => {
    setGcalLoading(true);
    try {
      const { error } = await supabase.functions.invoke("google-calendar-sync", { body: { action: "disconnect" } });
      if (error) { toast.error("Erro ao desconectar"); return; }
      setGcalConnected(false);
      toast.success("Google Calendar desconectado");
    } finally { setGcalLoading(false); }
  };

  const syncSessionToGcal = useCallback(async (sessionId: string) => {
    if (!gcalConnected || !sessionId) return;
    try {
      const { data: s } = await supabase
        .from("sessions")
        .select("id, scheduled_at, duration_minutes, notes, patient:patients!sessions_patient_id_fkey(full_name)")
        .eq("id", sessionId)
        .maybeSingle();
      if (!s) return;
      await supabase.functions.invoke("google-calendar-sync", {
        body: {
          action: "sync",
          session: {
            id: (s as any).id,
            scheduled_at: (s as any).scheduled_at,
            duration_minutes: (s as any).duration_minutes,
            notes: (s as any).notes,
            patient_name: (s as any).patient?.full_name || "Sessão",
          },
        },
      });
    } catch (e) { console.error("gcal sync failed", e); }
  }, [gcalConnected]);

  const deleteSessionFromGcal = useCallback(async (sessionId: string) => {
    if (!gcalConnected || !sessionId) return;
    try {
      await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "delete", session: { id: sessionId } },
      });
    } catch (e) { console.error("gcal delete failed", e); }
  }, [gcalConnected]);

  // ── Bulk sync: envia todas as sessões futuras não canceladas que ainda não têm evento no Google ──
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const syncAllExistingToGcal = useCallback(async () => {
    if (!user) return;
    if (!gcalConnected) { toast.error("Conecte o Google Calendar primeiro."); return; }
    setBulkSyncing(true);
    setBulkProgress({ done: 0, total: 0 });
    const tId = toast.loading("Buscando sessões para sincronizar...");
    try {
      const nowIso = new Date().toISOString();
      const { data: futureSessions, error: sErr } = await supabase
        .from("sessions")
        .select("id, scheduled_at, duration_minutes, notes, status, patient:patients!sessions_patient_id_fkey(full_name)")
        .eq("user_id", user.id)
        .gte("scheduled_at", nowIso)
        .not("status", "in", "(cancelled)")
        .order("scheduled_at", { ascending: true });
      if (sErr) throw sErr;

      const sessions = (futureSessions || []) as any[];
      if (sessions.length === 0) {
        toast.dismiss(tId);
        toast.info("Nenhuma sessão futura para sincronizar.");
        return;
      }

      const { data: existing } = await supabase
        .from("session_gcal_events")
        .select("session_id")
        .in("session_id", sessions.map((s) => s.id));
      const alreadySynced = new Set((existing || []).map((e: any) => e.session_id));

      const toSync = sessions.filter((s) => !alreadySynced.has(s.id));
      if (toSync.length === 0) {
        toast.dismiss(tId);
        toast.success("Todas as sessões futuras já estão sincronizadas.");
        return;
      }

      setBulkProgress({ done: 0, total: toSync.length });
      let ok = 0, fail = 0;
      for (let i = 0; i < toSync.length; i++) {
        const s = toSync[i];
        try {
          const { error: invErr } = await supabase.functions.invoke("google-calendar-sync", {
            body: {
              action: "sync",
              session: {
                id: s.id,
                scheduled_at: s.scheduled_at,
                duration_minutes: s.duration_minutes,
                notes: s.notes,
                patient_name: s.patient?.full_name || "Sessão",
              },
            },
          });
          if (invErr) fail++; else ok++;
        } catch { fail++; }
        setBulkProgress({ done: i + 1, total: toSync.length });
        toast.loading(`Sincronizando ${i + 1}/${toSync.length}...`, { id: tId });
      }
      toast.dismiss(tId);
      toast.success(`${ok} ${ok === 1 ? "sessão sincronizada" : "sessões sincronizadas"} com sucesso. ${fail} não foram sincronizadas.`);
    } catch (e: any) {
      toast.dismiss(tId);
      toast.error("Falha ao sincronizar sessões: " + (e?.message || "erro desconhecido"));
    } finally {
      setBulkSyncing(false);
      setBulkProgress(null);
    }
  }, [user, gcalConnected]);

  // Fetch pix key + gcal status + handle OAuth callback
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("pix_key, full_name, crp").eq("id", user.id).single().then(({ data }) => {
      setPixKey(data?.pix_key || "");
      setPsiName(data?.full_name || "");
      setPsiCrp(data?.crp || "");
    });
    loadGcalStatus();

    const params = new URLSearchParams(window.location.search);
    const gcal = params.get("gcal");
    if (gcal === "connected") {
      toast.success("Google Calendar conectado! Suas sessões serão sincronizadas.");
      setGcalConnected(true);
      loadGcalStatus();
      params.delete("gcal");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    } else if (gcal === "error") {
      toast.error("Não foi possível conectar ao Google Calendar. Tente novamente.");
      params.delete("gcal");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, [user, loadGcalStatus]);

  // Load all sessions for the current month
  const load = async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    const mStart = startOfMonth(currentMonth);
    const mEnd = addDays(endOfMonth(currentMonth), 1);
    const [sRes, pRes, svRes] = await Promise.all([
      supabase
        .from("sessions")
        .select("id, patient_id, scheduled_at, duration_minutes, status, price, notes, confirmation_token, confirmation_sent_at, session_type, discussed_patient_id, is_expense, payment_status, payment_method, payment_reference, service_id, billing_sent_at, modality, meeting_link, patient:patients!sessions_patient_id_fkey(full_name), discussed_patient:patients!sessions_discussed_patient_id_fkey(full_name)")
        .eq("user_id", user.id)
        .neq("status", "cancelled")
        .gte("scheduled_at", mStart.toISOString())
        .lt("scheduled_at", mEnd.toISOString())
        .order("scheduled_at"),
      supabase.from("patients").select("id, full_name, session_price, phone, has_financial_responsible, financial_responsible_name, financial_responsible_phone").eq("user_id", user.id).eq("is_active", true).order("full_name"),
      (supabase as any).from("services").select("id, name, price, is_active").eq("user_id", user.id).eq("is_active", true).order("name"),
    ]);
    if (sRes.error) toast.error("Erro ao carregar sessões");
    const mapped = (sRes.data ?? []).map((s: any) => ({
      ...s,
      patient_name: s.patient?.full_name ?? null,
      discussed_patient_name: s.discussed_patient?.full_name ?? null,
    }));
    setSessions(mapped as Session[]);
    setPatients((pRes.data as Patient[]) ?? []);
    setServices((svRes.data as Service[]) ?? []);
    if (!silent) setLoading(false);
  };

  const loadPending = async (silent = false) => {
    if (!user) return;
    if (!silent) setLoadingPending(true);
    const mStart = startOfMonth(currentMonth).toISOString();
    const mEnd = endOfMonth(currentMonth).toISOString();
    const { data } = await supabase
      .from("sessions")
      .select("id, patient_id, scheduled_at, duration_minutes, status, price, notes, confirmation_token, confirmation_sent_at, session_type, discussed_patient_id, is_expense, payment_status, payment_method, payment_reference, billing_sent_at, modality, meeting_link, patient:patients!sessions_patient_id_fkey(full_name)")
      .eq("user_id", user.id)
      .eq("session_type", "clinical")
      .not("patient_id", "is", null)
      .not("status", "in", '("cancelled","no_show")')
      .gte("scheduled_at", mStart)
      .lte("scheduled_at", mEnd)
      .order("scheduled_at", { ascending: false })
      .limit(200);
    const mapped = (data ?? []).map((s: any) => ({
      ...s, patient_name: s.patient?.full_name ?? null, discussed_patient_name: null,
    }));
    const packagePatientIds = Array.from(new Set(mapped.filter((s: any) => /(?:Pgto|Pagamento) [úu]nico/i.test(s.notes || "") && s.patient_id).map((s: any) => s.patient_id)));
    if (packagePatientIds.length > 0) {
      const { data: packageData } = await supabase
        .from("sessions")
        .select("id, patient_id, scheduled_at, duration_minutes, status, price, notes, confirmation_token, confirmation_sent_at, session_type, discussed_patient_id, is_expense, payment_status, payment_method, payment_reference, billing_sent_at, modality, meeting_link, patient:patients!sessions_patient_id_fkey(full_name)")
        .eq("user_id", user.id)
        .eq("session_type", "clinical")
        .in("patient_id", packagePatientIds)
        .ilike("notes", "%Pgto%")
        .not("status", "in", '("cancelled","no_show")')
        .order("scheduled_at", { ascending: true })
        .limit(200);
      setPendingPackageSessions((packageData ?? []).map((s: any) => ({ ...s, patient_name: s.patient?.full_name ?? null, discussed_patient_name: null })) as Session[]);
    } else {
      setPendingPackageSessions([]);
    }
    setPendingSessions(mapped as Session[]);
    if (!silent) setLoadingPending(false);
  };

  useEffect(() => { if (user) { load(); loadPending(); } }, [user, currentMonth]);

  useAutoRefresh(() => { if (user) { load(true); loadPending(true); } }, { routePath: "/app/agenda" });

  // Patient month count for new session form
  useEffect(() => {
    if (!user || !form.patient_id || form.session_type !== "clinical" || !form.date) {
      setPatientMonthCount(null); return;
    }
    const selectedDate = new Date(form.date + "T12:00:00");
    const mStart = startOfMonth(selectedDate);
    const mEnd = endOfMonth(selectedDate);
    supabase
      .from("sessions").select("scheduled_at")
      .eq("user_id", user.id).eq("patient_id", form.patient_id).eq("session_type", "clinical")
      .gte("scheduled_at", mStart.toISOString()).lte("scheduled_at", mEnd.toISOString())
      .not("status", "eq", "cancelled").order("scheduled_at")
      .then(({ data }) => {
        const dates = (data ?? []).map((d: any) => format(new Date(d.scheduled_at), "dd/MM"));
        setPatientMonthCount({ count: dates.length, dates });
      });
  }, [user, form.patient_id, form.date, form.session_type]);

  const openNew = (date?: Date) => {
    setPatientMonthCount(null);
    let restored = false;
    try {
      const raw = localStorage.getItem(DRAFT_SESSION_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.patient_id || draft.notes || draft.price) {
          setFormRaw({ ...emptySessionForm, ...draft, date: format(date ?? new Date(), "yyyy-MM-dd") });
          restored = true;
          setDraftRestored(true);
        }
      }
    } catch {}
    if (!restored) {
      setFormRaw({
        ...emptySessionForm,
        date: format(date ?? new Date(), "yyyy-MM-dd"),
      });
      setDraftRestored(false);
    }
    newGuard.resetDirty();
    setOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = sessionSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSaving(true);
    const isSupervision = parsed.data.session_type === "supervision";
    const baseDate = parse(`${parsed.data.date} ${parsed.data.time}`, "yyyy-MM-dd HH:mm", new Date());
    const patient = patients.find((p) => p.id === parsed.data.patient_id);
    const unitPrice = parsed.data.price ? Number(parsed.data.price) : (isSupervision ? null : patient?.session_price ?? null);
    const ref = parsed.data.payment_reference?.trim() ?? "";
    const isRecurring = form.recurrence === "recurring" && form.recurrence_count > 1;
    const totalSessions = isRecurring ? form.recurrence_count : 1;
    const intervalDays = form.recurrence_interval === "biweekly" ? 14 : 7;

    const isSinglePayment = isRecurring && form.payment_plan === "single_payment";
    const groupId = isSinglePayment ? crypto.randomUUID().slice(0, 8) : null;

    const sessionsToInsert = [];
    for (let i = 0; i < totalSessions; i++) {
      const scheduledAt = addDays(baseDate, i * intervalDays);
      const planLabel = isRecurring
        ? `Plano ${totalSessions} sessões (${i + 1}/${totalSessions})${isSinglePayment ? ` — Pgto único [${groupId}]` : " — Pgto por sessão"}`
        : null;
      const noteText = [parsed.data.notes, planLabel].filter(Boolean).join("\n");

      // All sessions carry the unit price — the total is computed when displaying
      const sessionPrice = unitPrice;
      const sessionPaymentStatus = "pending";

      sessionsToInsert.push({
        user_id: user.id,
        patient_id: isSupervision ? null : (parsed.data.patient_id || null),
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: parsed.data.duration_minutes,
        price: sessionPrice,
        payment_status: sessionPaymentStatus,
        notes: noteText || null,
        payment_method: parsed.data.payment_method === "none" ? null : parsed.data.payment_method,
        payment_reference: ref.length > 0 ? ref : null,
        session_type: parsed.data.session_type,
        discussed_patient_id: isSupervision && parsed.data.discussed_patient_id ? parsed.data.discussed_patient_id : null,
        is_expense: isSupervision,
        service_id: form.service_id || null,
        modality: form.modality,
        meeting_link: form.modality === "online" && form.meeting_link.trim() ? form.meeting_link.trim() : null,
      } as any);
    }

    const { data: created, error } = await supabase.from("sessions").insert(sessionsToInsert).select("id");
    if (error) { setSaving(false); toast.error("Erro ao agendar sessão"); return; }
    if (gcalConnected && created) {
      Promise.all(created.map((row: any) => syncSessionToGcal(row.id))).catch(() => {});
    }

    const moodNum = parsed.data.mood_score ? Number(parsed.data.mood_score) : null;
    const progressNote = parsed.data.progress_note?.trim() || null;
    if (!isSupervision && parsed.data.patient_id && ((moodNum && moodNum >= 1 && moodNum <= 10) || progressNote)) {
      await supabase.from("patient_progress").insert({
        user_id: user.id, patient_id: parsed.data.patient_id,
        session_id: created?.[0]?.id ?? null, mood_score: moodNum,
        note: progressNote, recorded_at: baseDate.toISOString(),
      });
    }

    setSaving(false);
    const totalValue = unitPrice ? unitPrice * totalSessions : 0;
    if (isRecurring) {
      const payLabel = form.payment_plan === "single_payment"
        ? `Pagamento único: R$ ${totalValue.toFixed(2)}`
        : `${totalSessions}x R$ ${(unitPrice ?? 0).toFixed(2)} = R$ ${totalValue.toFixed(2)}`;
      toast.success(`${totalSessions} sessões agendadas! ${payLabel}`);
    } else {
      toast.success("Sessão agendada");
    }
    clearSessionDraft();
    newGuard.resetDirty();
    keepScroll();
    setOpen(false);
    await preserveScroll(async () => { load(true); loadPending(true); });
  };

  const updateStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("sessions").update({ status }).eq("id", id);
    if (error) return toast.error("Erro ao atualizar");
    if (status === "cancelled") { deleteSessionFromGcal(id); } else { syncSessionToGcal(id); }
    toast.success(`Marcada como ${statusLabel[status].toLowerCase()}`);
    await preserveScroll(async () => { load(true); loadPending(true); });
  };

  const updatePaymentStatus = async (id: string, paymentStatus: PaymentStatus) => {
    const { error } = await supabase.from("sessions").update({
      payment_status: paymentStatus,
      ...(paymentStatus === "paid" ? { paid_at: new Date().toISOString() } : {}),
    }).eq("id", id);
    if (error) return toast.error("Erro ao atualizar pagamento");
    toast.success(`Pagamento: ${paymentStatusLabel[paymentStatus]}`);
    load(true); loadPending(true);
  };

  const updatePaymentGroup = async (ids: string[], paymentStatus: PaymentStatus) => {
    const { error } = await supabase.from("sessions").update({
      payment_status: paymentStatus,
      ...(paymentStatus === "paid" ? { paid_at: new Date().toISOString() } : { paid_at: null }),
    }).in("id", ids);
    if (error) return toast.error("Erro ao atualizar pagamento");
    toast.success(`${ids.length} sessões marcadas como ${paymentStatusLabel[paymentStatus].toLowerCase()}`);
    load(true); loadPending(true);
  };

  // ── Delete with confirmation modal ──
  const promptDelete = (id: string) => {
    setDeleteSessionId(id);
    setDeleteConfirmOpen(true);
  };

  const executeDelete = async (includeFinancial: boolean) => {
    if (!deleteSessionId) return;
    setDeleting(true);

    // Remove from Google Calendar first (if connected) — needs mapping row to still exist
    await deleteSessionFromGcal(deleteSessionId);

    // Delete related progress & gcal events
    await Promise.all([
      supabase.from("patient_progress").delete().eq("session_id", deleteSessionId),
      supabase.from("session_gcal_events").delete().eq("session_id", deleteSessionId),
      supabase.from("session_records").delete().eq("session_id", deleteSessionId),
      supabase.from("session_evolutions").delete().eq("session_id", deleteSessionId),
    ]);

    if (includeFinancial) {
      // Delete the session row entirely (removes from agenda + finance)
      const { error } = await supabase.from("sessions").delete().eq("id", deleteSessionId);
      if (error) { setDeleting(false); toast.error("Erro ao excluir"); return; }
      toast.success("Sessão e lançamento financeiro excluídos");
    } else {
      // Cancel the session (removes from agenda but keeps financial record)
      const { error } = await supabase.from("sessions").update({ status: "cancelled" as any }).eq("id", deleteSessionId);
      if (error) { setDeleting(false); toast.error("Erro ao excluir"); return; }
      toast.success("Sessão excluída (lançamento financeiro mantido)");
    }

    setDeleting(false);
    setDeleteConfirmOpen(false);
    setDeleteSessionId(null);
    if (editOpen) { editGuard.resetDirty(); setEditOpen(false); }
    await load(true); loadPending(true);
  };

  // Exclui a sessão atual + todas as outras do mesmo pacote (passadas e futuras).
  const executeDeleteSeries = async (includeFinancial: boolean) => {
    if (!deleteSessionId || !user) return;
    const current = sessions.find((s) => s.id === deleteSessionId)
      || pendingSessions.find((s) => s.id === deleteSessionId)
      || pendingPackageSessions.find((s) => s.id === deleteSessionId);
    if (!current || !current.patient_id) return;
    const pkgInfo = getPackageInfo(current.notes);
    if (!pkgInfo) return;

    setDeleting(true);
    // Busca todas as irmãs do pacote (mesmo paciente + mesmo total no notes)
    const { data: siblings } = await supabase.from("sessions")
      .select("id, notes")
      .eq("user_id", user.id)
      .eq("patient_id", current.patient_id);
    const ids = (siblings ?? [])
      .filter((s: any) => s.notes && /Plano \d+ sess/.test(s.notes) && s.notes.includes(`/${pkgInfo.total})`))
      .map((s: any) => s.id);
    if (!ids.includes(deleteSessionId)) ids.push(deleteSessionId);

    // Limpa GCal e relações em paralelo
    await Promise.all(ids.map((id) => deleteSessionFromGcal(id)));
    await Promise.all([
      supabase.from("patient_progress").delete().in("session_id", ids),
      supabase.from("session_gcal_events").delete().in("session_id", ids),
      supabase.from("session_records").delete().in("session_id", ids),
      supabase.from("session_evolutions").delete().in("session_id", ids),
    ]);

    if (includeFinancial) {
      const { error } = await supabase.from("sessions").delete().in("id", ids);
      if (error) { setDeleting(false); toast.error("Erro ao excluir sequência"); return; }
      toast.success(`${ids.length} sessões do pacote excluídas (com financeiro)`);
    } else {
      const { error } = await supabase.from("sessions").update({ status: "cancelled" as any }).in("id", ids);
      if (error) { setDeleting(false); toast.error("Erro ao excluir sequência"); return; }
      toast.success(`${ids.length} sessões do pacote canceladas (financeiro mantido)`);
    }

    setDeleting(false);
    setDeleteConfirmOpen(false);
    setDeleteSessionId(null);
    if (editOpen) { editGuard.resetDirty(); setEditOpen(false); }
    await load(true); loadPending(true);
  };


  const copyConfirmationLink = async (s: Session) => {
    let token = s.confirmation_token;
    if (!token) {
      token = crypto.randomUUID();
      const { error } = await supabase.from("sessions").update({ confirmation_token: token }).eq("id", s.id);
      if (error) { toast.error("Erro ao gerar link"); return; }
    }
    const url = `${window.location.origin}/confirmar-sessao/${token}`;
    const message = `Olá, por favor, entre para confirmar sua sessão de terapia🤎\n\n${url}`;

    // Open WhatsApp directly when we have the patient's phone, fall back to clipboard
    const patient = patients.find((p) => p.id === s.patient_id);
    let phoneNumber = "";
    if (patient?.has_financial_responsible && patient.financial_responsible_phone) {
      phoneNumber = patient.financial_responsible_phone.replace(/\D/g, "");
    } else if (patient?.phone) {
      phoneNumber = patient.phone.replace(/\D/g, "");
    }

    if (phoneNumber) {
      window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, "_blank");
      toast.success("Lembrete enviado pelo WhatsApp ✨");
    } else {
      await navigator.clipboard.writeText(message);
      toast.success("Lembrete copiado (paciente sem telefone cadastrado)");
    }
    // Marca o envio do lembrete para destacar no card
    await supabase.from("sessions").update({ confirmation_sent_at: new Date().toISOString() }).eq("id", s.id);
    load(true);
  };

  const getGroupId = (notes: string | null): string | null => {
    if (!notes) return null;
    const match = notes.match(/Pgto [úu]nico \[([^\]]+)\]/);
    return match ? match[1] : null;
  };

  const getSinglePaymentGroup = (session: Session) => {
    const pkgInfo = getPackageInfo(session.notes);
    const isSinglePaymentNote = (notes: string | null) => /(?:Pgto|Pagamento) [úu]nico/i.test(notes || "");
    if (!pkgInfo || !session.patient_id || !isSinglePaymentNote(session.notes)) return null;

    const groupId = getGroupId(session.notes);

    const allKnownSessions = [...sessions, ...pendingSessions, ...pendingPackageSessions].filter(
      (item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index
    );

    let matchingSessions: Session[];
    if (groupId) {
      // New format: match by group ID
      matchingSessions = allKnownSessions
        .filter((item) => item.patient_id === session.patient_id && getGroupId(item.notes) === groupId)
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    } else {
      // Legacy format: match by chunking (old packages without group ID)
      matchingSessions = allKnownSessions
        .filter((item) => {
          const info = getPackageInfo(item.notes);
          return item.patient_id === session.patient_id && info?.total === pkgInfo.total && isSinglePaymentNote(item.notes) && !getGroupId(item.notes);
        })
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
      const sessionIndex = matchingSessions.findIndex((item) => item.id === session.id);
      const chunkStart = sessionIndex >= 0 ? Math.floor(sessionIndex / pkgInfo.total) * pkgInfo.total : 0;
      matchingSessions = matchingSessions.slice(chunkStart, chunkStart + pkgInfo.total);
    }

    if (matchingSessions.length <= 1) return null;

    return {
      sessions: matchingSessions,
      total: matchingSessions.reduce((sum, item) => sum + Number(item.price ?? 0), 0),
      dates: matchingSessions.map((item) => format(new Date(item.scheduled_at), "dd/MM/yyyy")),
    };
  };

  const sendWhatsAppReminder = async (s: Session) => {
    const name = s.patient_name || "Paciente";
    const singlePaymentGroup = getSinglePaymentGroup(s);
    const dateStr = singlePaymentGroup ? singlePaymentGroup.dates.join(", ") : format(new Date(s.scheduled_at), "dd/MM/yyyy");
    const valueNumber = singlePaymentGroup?.total ?? Number(s.price ?? 0);
    const value = valueNumber > 0 ? `R$ ${valueNumber.toFixed(2).replace(".", ",")}` : "a combinar";
    const firstName = psiName ? psiName.split(" ")[0] : "";
    const sessionLine = singlePaymentGroup
      ? `Passando para lembrar do acerto referente às nossas ${singlePaymentGroup.sessions.length} sessões de ${dateStr}.`
      : `Passando para lembrar do acerto referente à nossa sessão de ${dateStr}.`;
    const message = [
      `Olá, ${name}! Aqui é a sua psi, ${firstName || "sua psicóloga"}.`,
      "",
      sessionLine,
      "",
      `Valor: ${value}`,
      pixKey ? `Chave Pix: ${pixKey}` : "",
      "",
      `Assim que realizar, pode me enviar o comprovante por aqui. Qualquer dúvida, fico à disposição!`,
      "",
      psiName || "",
      psiCrp ? `Psicóloga | CRP ${psiCrp}` : "Psicóloga",
    ].filter(Boolean).join("\n");

    // Determine WhatsApp number: financial responsible or patient
    const patient = patients.find((p) => p.id === s.patient_id);
    let phoneNumber = "";
    if (patient?.has_financial_responsible && patient.financial_responsible_phone) {
      phoneNumber = patient.financial_responsible_phone.replace(/\D/g, "");
    } else if (patient?.phone) {
      phoneNumber = patient.phone.replace(/\D/g, "");
    }
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, "_blank");

    // Save billing sent timestamp
    const now = new Date().toISOString();
    await supabase.from("sessions").update({ billing_sent_at: now } as any).eq("id", s.id);
    setSessions(prev => prev.map(ss => ss.id === s.id ? { ...ss, billing_sent_at: now } : ss));
    setPendingSessions(prev => prev.map(ss => ss.id === s.id ? { ...ss, billing_sent_at: now } : ss));
    toast.success("Cobrança enviada registrada");
  };

  const openEdit = async (s: Session) => {
    setEditSessionId(s.id);
    setEditProgressId(null);
    const scheduledDate = new Date(s.scheduled_at);
    setEditFormRaw({
      status: s.status, payment_status: s.payment_status,
      payment_method: (s as any).payment_method ?? "none",
      payment_reference: (s as any).payment_reference ?? "",
      price: s.price != null ? String(s.price) : "",
      notes: s.notes ?? "", duration_minutes: s.duration_minutes,
      mood_score: "", progress_note: "",
      session_type: s.session_type,
      service_id: s.service_id ?? "",
      recurrence: "single",
      recurrence_count: 4, recurrence_interval: "weekly",
      payment_plan: "per_session",
      date: format(scheduledDate, "yyyy-MM-dd"),
      time: format(scheduledDate, "HH:mm"),
      modality: (s as any).modality ?? "presencial",
      meeting_link: (s as any).meeting_link ?? "",
    });
    editGuard.resetDirty();
    setEditOpen(true);
    if (s.patient_id && user) {
      const { data } = await supabase.from("patient_progress")
        .select("id, mood_score, note").eq("session_id", s.id).eq("user_id", user.id).maybeSingle();
      if (data) {
        setEditProgressId(data.id);
        setEditFormRaw((prev) => ({
          ...prev,
          mood_score: data.mood_score != null ? String(data.mood_score) : "",
          progress_note: data.note ?? "",
        }));
      }
    }
  };

  // Detect if session is part of a recurring package from notes
  const isPackageSession = (notes: string | null): boolean => {
    if (!notes) return false;
    return /Plano \d+ sess/.test(notes);
  };

  const getPackageInfo = (notes: string | null): { total: number; index: number } | null => {
    if (!notes) return null;
    const match = notes.match(/Plano (\d+) sess[õo]es \((\d+)\/(\d+)\)/);
    if (!match) return null;
    return { total: parseInt(match[1]), index: parseInt(match[2]) };
  };

  const didDateTimeChange = (session: Session | undefined): boolean => {
    if (!session) return false;
    const orig = new Date(session.scheduled_at);
    return editForm.date !== format(orig, "yyyy-MM-dd") || editForm.time !== format(orig, "HH:mm");
  };

  const handleEditSave = async (e: React.FormEvent, rescheduleAll?: boolean) => {
    e?.preventDefault?.();
    if (!user || !editSessionId) return;
    const session = sessions.find((s) => s.id === editSessionId);

    // Check if date/time changed on a package session — show modal
    if (rescheduleAll === undefined && session && isPackageSession(session.notes) && didDateTimeChange(session)) {
      setPendingEditEvent(e);
      setRescheduleModalOpen(true);
      return;
    }

    setEditSaving(true);
    const newScheduledAt = editForm.date && editForm.time
      ? parse(`${editForm.date} ${editForm.time}`, "yyyy-MM-dd HH:mm", new Date()).toISOString()
      : undefined;
    const { error } = await supabase.from("sessions").update({
      status: editForm.status, payment_status: editForm.payment_status,
      payment_method: editForm.payment_method === "none" ? null : editForm.payment_method,
      payment_reference: editForm.payment_reference.trim() || null,
      price: editForm.price ? Number(editForm.price) : null,
      notes: editForm.notes || null, duration_minutes: editForm.duration_minutes,
      session_type: editForm.session_type,
      service_id: editForm.service_id || null,
      modality: editForm.modality,
      meeting_link: editForm.modality === "online" && editForm.meeting_link.trim() ? editForm.meeting_link.trim() : null,
      ...(newScheduledAt ? { scheduled_at: newScheduledAt } : {}),
      ...(editForm.payment_status === "paid" && session?.payment_status !== "paid"
        ? { paid_at: new Date().toISOString() } : {}),
    } as any).eq("id", editSessionId);

    if (error) { setEditSaving(false); toast.error("Erro ao salvar sessão"); return; }

    // Reschedule all future sessions in the package
    if (rescheduleAll && session && newScheduledAt) {
      const origDate = new Date(session.scheduled_at);
      const newDate = new Date(newScheduledAt);
      const pkgInfo = getPackageInfo(session.notes);

      // Delta entre o dia da semana original e o novo (-3..+3), preservando
      // o intervalo semanal. Ex: terça→quinta = +2 dias em cada sessão futura.
      const origWeekday = origDate.getDay();
      const newWeekday = newDate.getDay();
      let weekdayDelta = newWeekday - origWeekday;
      if (weekdayDelta > 3) weekdayDelta -= 7;
      if (weekdayDelta < -3) weekdayDelta += 7;
      const newHours = newDate.getHours();
      const newMinutes = newDate.getMinutes();

      if (pkgInfo && session.patient_id) {
        // Find sibling sessions in the same package that are AFTER this one
        const { data: siblings } = await supabase.from("sessions")
          .select("id, scheduled_at, notes")
          .eq("user_id", user.id)
          .eq("patient_id", session.patient_id)
          .gt("scheduled_at", session.scheduled_at)
          .order("scheduled_at");

        const packageSiblings = (siblings ?? []).filter(s =>
          s.notes && /Plano \d+ sess/.test(s.notes) &&
          s.notes.includes(`/${pkgInfo.total})`)
        );

        for (const sib of packageSiblings) {
          const sibDate = new Date(sib.scheduled_at);
          const shifted = new Date(sibDate);
          shifted.setDate(sibDate.getDate() + weekdayDelta);
          shifted.setHours(newHours, newMinutes, 0, 0);
          await supabase.from("sessions").update({
            scheduled_at: shifted.toISOString(),
          } as any).eq("id", sib.id);
          syncSessionToGcal(sib.id);
        }

        if (packageSiblings.length > 0) {
          toast.success(`${packageSiblings.length + 1} sessões do pacote remarcadas`);
        }
      }
    }

    // Sync the edited session to Google Calendar
    if (editSessionId) syncSessionToGcal(editSessionId);

    // Always update mood/progress if patient exists (even when clearing values)
    const moodNum = editForm.mood_score ? Number(editForm.mood_score) : null;
    const progressNote = editForm.progress_note?.trim() || null;
    if (session?.patient_id) {
      if (editProgressId) {
        await supabase.from("patient_progress").update({ mood_score: moodNum, note: progressNote }).eq("id", editProgressId);
      } else if (moodNum || progressNote) {
        await supabase.from("patient_progress").insert({
          user_id: user.id, patient_id: session.patient_id,
          session_id: editSessionId, mood_score: moodNum,
          note: progressNote, recorded_at: session.scheduled_at,
        });
      }
    }

    setEditSaving(false);
    if (!rescheduleAll || !(session && isPackageSession(session.notes) && didDateTimeChange(session))) {
      toast.success("Sessão atualizada");
    }
    editGuard.resetDirty();
    setEditOpen(false);
    load(true); loadPending(true);
  };

  // ── Patient Drawer ──
  const openPatientDrawer = async (patientId: string) => {
    if (!user) return;
    setDrawerPatientId(patientId);
    setDrawerTab("sessions");
    setDrawerOpen(true);
    setDrawerLoadingSessions(true);

    const [patientRes, sessionsRes] = await Promise.all([
      supabase.from("patients").select("*").eq("id", patientId).single(),
      supabase.from("sessions")
        .select("id, scheduled_at, status, price, payment_status, payment_method, duration_minutes, notes, billing_sent_at")
        .eq("user_id", user.id).eq("patient_id", patientId).eq("session_type", "clinical")
        .order("scheduled_at", { ascending: false })
        .limit(100),
    ]);

    setDrawerPatientData(patientRes.data);
    setDrawerSessions(sessionsRes.data ?? []);
    setDrawerLoadingSessions(false);
  };

  const drawerFinancials = useMemo(() => {
    const totalPaid = drawerSessions.filter(s => s.payment_status === "paid").reduce((sum, s) => sum + Number(s.price ?? 0), 0);
    const totalPending = drawerSessions.filter(s => s.payment_status === "pending").reduce((sum, s) => sum + Number(s.price ?? 0), 0);
    return { totalPaid, totalPending };
  }, [drawerSessions]);

  // ── Derived data ──
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (serviceFilter !== "all" && s.service_id !== serviceFilter) return false;
      if (patientFilter !== "all" && s.patient_id !== patientFilter) return false;
      return true;
    });
  }, [sessions, serviceFilter, patientFilter]);

  const sessionsByDay = (date: Date) => filteredSessions.filter((s) => isSameDay(new Date(s.scheduled_at), date));

  const daysWithSessions = useMemo(() => {
    const set = new Set<string>();
    filteredSessions.forEach((s) => set.add(format(new Date(s.scheduled_at), "yyyy-MM-dd")));
    return set;
  }, [filteredSessions]);

  const selectedDaySessions = useMemo(() => sessionsByDay(selectedDate), [filteredSessions, selectedDate]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekSessions = useMemo(() => {
    const wEnd = addDays(weekStart, 7);
    return filteredSessions.filter((s) => {
      const d = new Date(s.scheduled_at);
      return d >= weekStart && d < wEnd;
    });
  }, [filteredSessions, weekStart]);

  const pendingTotal = pendingSessions.filter(s => s.payment_status === "pending").reduce((sum, s) => sum + Number(s.price ?? 0), 0);
  const paidTotal = pendingSessions.filter(s => s.payment_status === "paid").reduce((sum, s) => sum + Number(s.price ?? 0), 0);

  const filteredByPayment = useMemo(() => {
    if (paymentFilter === "all") return pendingSessions;
    return pendingSessions.filter(s => s.payment_status === paymentFilter);
  }, [pendingSessions, paymentFilter]);

  const sortedPending = useMemo(() => {
    let list = [...filteredByPayment];
    if (filterPatientId !== "all") list = list.filter((s) => s.patient_id === filterPatientId);
    if (pendingSort === "patient") {
      list.sort((a, b) => (a.patient_name ?? "").localeCompare(b.patient_name ?? ""));
    }
    return list;
  }, [filteredByPayment, pendingSort, filterPatientId]);

  const groupedPending = useMemo(() => {
    try {
      const used = new Set<string>();
      return sortedPending.flatMap((session) => {
        if (used.has(session.id)) return [];
        const group = getSinglePaymentGroup(session);
        if (!group) return [{ key: session.id, session, sessions: [session], total: Number(session.price ?? 0), dates: [format(new Date(session.scheduled_at), "dd/MM/yyyy")], isSinglePayment: false }];
        group.sessions.forEach((item) => used.add(item.id));
        return [{ key: `single-${session.patient_id}-${group.dates.join("-")}`, session, sessions: group.sessions, total: group.total, dates: group.dates, isSinglePayment: true }];
      });
    } catch (err) {
      console.error("Error grouping pending sessions:", err);
      return sortedPending.map((session) => ({ key: session.id, session, sessions: [session], total: Number(session.price ?? 0), dates: [format(new Date(session.scheduled_at), "dd/MM/yyyy")], isSinglePayment: false }));
    }
  }, [sortedPending, sessions, pendingSessions, pendingPackageSessions]);

  // Unique patients in pending
  const pendingPatients = useMemo(() => {
    const map = new Map<string, string>();
    filteredByPayment.forEach((s) => { if (s.patient_id && s.patient_name) map.set(s.patient_id, s.patient_name); });
    return Array.from(map.entries());
  }, [filteredByPayment]);

  // ── Month calendar grid ──
  const monthGrid = useMemo(() => {
    const firstDay = startOfMonth(currentMonth);
    const totalDays = getDaysInMonth(currentMonth);
    let startOffset = getDay(firstDay) - 1; // Monday=0
    if (startOffset < 0) startOffset = 6;
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [currentMonth]);

  // ── Clickable patient name ──
  const PatientNameLink = ({ patientId, name }: { patientId: string; name: string }) => (
    <button
      type="button"
      className="text-left font-display text-sm font-semibold text-foreground hover:text-primary hover:underline transition-colors truncate"
      onClick={(e) => { e.stopPropagation(); openPatientDrawer(patientId); }}
    >
      {name}
    </button>
  );

  // ── Session card component ──
  const isMobile = useIsMobile();

  // Default to compact "week" view the first time we detect mobile
  const mobileDefaultedRef = useRef(false);
  useEffect(() => {
    if (isMobile && !mobileDefaultedRef.current) {
      mobileDefaultedRef.current = true;
      setViewTab("week");
    }
  }, [isMobile]);

  // Keep selected day inside current week
  useEffect(() => {
    if (selectedDate < weekStart || selectedDate >= addDays(weekStart, 7)) {
      setSelectedDate(weekStart);
    }
  }, [weekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const SessionCard = ({ s, compact = false }: { s: Session; compact?: boolean }) => {
    const isSupervisionCard = s.session_type === "supervision";
    const [sheetOpen, setSheetOpen] = useState(false);

    const actions = (
      <>
        <button onClick={() => { setSheetOpen(false); openEdit(s); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-muted text-left text-sm">
          <Pencil className="h-4 w-4 text-primary" /> Editar sessão
        </button>
        {!isSupervisionCard && (
          <button onClick={() => { setSheetOpen(false); copyConfirmationLink(s); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-muted text-left text-sm">
            <Link2 className="h-4 w-4 text-primary" /> Enviar confirmação no WhatsApp
          </button>
        )}
        <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Status da sessão</div>
        <button onClick={() => { setSheetOpen(false); updateStatus(s.id, "completed"); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-muted text-left text-sm">
          <Check className="h-4 w-4 text-emerald-600" /> Realizada
        </button>
        <button onClick={() => { setSheetOpen(false); updateStatus(s.id, "no_show"); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-muted text-left text-sm">
          <X className="h-4 w-4 text-amber-600" /> Falta
        </button>
        <button onClick={() => { setSheetOpen(false); updateStatus(s.id, "rescheduled"); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-muted text-left text-sm">
          <RotateCcw className="h-4 w-4 text-sky-600" /> Remarcada
        </button>
        <button onClick={() => { setSheetOpen(false); updateStatus(s.id, "cancelled"); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-muted text-left text-sm">
          <X className="h-4 w-4 text-muted-foreground" /> Cancelada
        </button>
        {!isSupervisionCard && (
          <>
            <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Pagamento</div>
            <button onClick={() => { setSheetOpen(false); updatePaymentStatus(s.id, "paid"); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-muted text-left text-sm text-emerald-700">
              <Check className="h-4 w-4" /> Marcar como pago
            </button>
            <button onClick={() => { setSheetOpen(false); sendWhatsAppReminder(s); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-muted text-left text-sm text-green-700">
              <MessageCircle className="h-4 w-4" /> Cobrar via WhatsApp
            </button>
          </>
        )}
        <div className="h-px bg-border my-2" />
        <button onClick={() => { setSheetOpen(false); promptDelete(s.id); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-destructive/10 text-left text-sm text-destructive">
          <Trash2 className="h-4 w-4" /> Excluir
        </button>
      </>
    );

    return (
      <div
        onClick={() => openEdit(s)}
        className={cn(
          "rounded-xl border p-3 group transition-colors cursor-pointer hover:ring-2 hover:ring-primary/20",
          isSupervisionCard ? "bg-serene/10 border-serene/40"
            : s.status === "confirmed" ? "bg-background border-[rgba(150,117,206,0.15)]"
              : "bg-background border-border"
        )}
      >
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {s.status === "confirmed" && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
            {isSupervisionCard && <GraduationCap className="h-3.5 w-3.5 text-serene shrink-0" />}
            <p className="font-display text-sm text-primary">{format(new Date(s.scheduled_at), "HH:mm")}</p>
          </div>
          {isMobile ? (
            <>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" aria-label="Ações da sessão" onClick={(e) => { e.stopPropagation(); setSheetOpen(true); }}>
                <MoreHorizontal className="h-5 w-5" />
              </Button>
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto p-0" onClick={(e) => e.stopPropagation()}>
                  <SheetHeader className="px-5 pt-5 pb-2 text-left">
                    <SheetTitle className="font-display text-base">
                      {format(new Date(s.scheduled_at), "HH:mm")} · {s.patient_name || (isSupervisionCard ? "Supervisão" : "Sessão")}
                    </SheetTitle>
                    <SheetDescription className="text-xs">Escolha uma ação para esta sessão</SheetDescription>
                  </SheetHeader>
                  <div className="px-3 pb-6 pt-2">{actions}</div>
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Ações da sessão" onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /> Editar sessão</DropdownMenuItem>
                {!isSupervisionCard && (
                  <DropdownMenuItem onClick={() => copyConfirmationLink(s)}><Link2 className="h-4 w-4" /> Enviar confirmação no WhatsApp</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => updateStatus(s.id, "completed")}><Check className="h-4 w-4" /> Realizada</DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateStatus(s.id, "no_show")}><X className="h-4 w-4" /> Falta</DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateStatus(s.id, "rescheduled")}><RotateCcw className="h-4 w-4" /> Remarcada</DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateStatus(s.id, "cancelled")}>Cancelada</DropdownMenuItem>
                <DropdownMenuSeparator />
                {!isSupervisionCard && (
                  <>
                    <DropdownMenuItem onClick={() => updatePaymentStatus(s.id, "paid")} className="text-emerald-600">
                      <Check className="h-4 w-4" /> Marcar como pago
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => sendWhatsAppReminder(s)} className="text-green-600">
                      <MessageCircle className="h-4 w-4" /> Cobrar via WhatsApp
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => promptDelete(s.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="mt-1 min-w-0">
          {isSupervisionCard ? (
            <p className={cn("text-foreground", compact ? "text-xs" : "text-sm font-medium")}>
              Supervisão
              {s.discussed_patient_name && <span className="text-muted-foreground"> · {s.discussed_patient_name}</span>}
            </p>
          ) : s.patient_id && s.patient_name ? (
            <>
              <p className={cn("text-left font-display font-semibold text-foreground hover:text-primary hover:underline transition-colors cursor-pointer", compact ? "text-xs leading-snug break-words" : "text-sm truncate")}
                 onClick={(e) => { e.stopPropagation(); openPatientDrawer(s.patient_id!); }}>
                {s.patient_name}
              </p>
              {(() => {
                const svcName = s.service_id
                  ? services.find(sv => sv.id === s.service_id)?.name
                  : "Atendimento clínico";
                return svcName ? (
                  <p className={cn("text-muted-foreground", compact ? "text-[10px]" : "text-xs")}>{svcName}</p>
                ) : null;
              })()}
            </>
          ) : (
            <p className={cn("text-foreground", compact ? "text-xs" : "text-sm font-medium")}>Paciente</p>
          )}
        </div>
        {!compact && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className={cn(PILL_BASE, isSupervisionCard ? "bg-serene/20 text-serene border-serene/30" : statusClass[s.status])}>
              {isSupervisionCard ? "Supervisão" : statusLabel[s.status]}
            </span>
            {(s as any).modality === "online" ? (
              <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                <Video className="h-2.5 w-2.5" /> Online
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                <MapPin className="h-2.5 w-2.5" /> Presencial
              </span>
            )}
            {(s as any).modality === "online" && (s as any).meeting_link && (
              <a href={(s as any).meeting_link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                <Link2 className="h-2.5 w-2.5" /> Entrar
              </a>
            )}
            {!isSupervisionCard && s.price != null && (
              <span className={cn(PILL_BASE, paymentStatusClass[s.payment_status])}>
                {paymentStatusLabel[s.payment_status]}
              </span>
            )}
            {s.price != null && (
              <span className="text-[10px] text-muted-foreground">R$ {Number(s.price).toFixed(2)}</span>
            )}
            {s.billing_sent_at && (
              <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                💸 Cobrança enviada {format(new Date(s.billing_sent_at), "dd/MM")}
              </span>
            )}
            {s.confirmation_sent_at && (
              <span
                className="lilac-comm-badge inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border shadow-sm animate-fade-up"
                title={`Lembrete enviado em ${format(new Date(s.confirmation_sent_at), "dd/MM 'às' HH:mm")}`}
              >
                <Bell className="h-3 w-3" /> Lembrete enviado · {format(new Date(s.confirmation_sent_at), "dd/MM HH:mm")}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* FAB Nova sessão (mobile) — sempre visível acima da bottom nav */}
      <button
        type="button"
        onClick={() => openNew()}
        aria-label="Nova sessão"
        className="md:hidden fixed right-4 bottom-20 z-40 inline-flex items-center gap-2 h-14 px-5 rounded-full bg-accent text-accent-foreground shadow-elegant hover:shadow-glow active:scale-95 transition-all font-display font-semibold"
      >
        <Plus className="h-5 w-5" />
        <span className="text-sm">Nova</span>
      </button>

      <header className="flex flex-wrap items-end justify-between gap-3 sticky top-16 md:static z-30 -mx-6 px-6 -mt-6 pt-6 md:m-0 md:p-0 bg-background/95 backdrop-blur md:bg-transparent md:backdrop-blur-none pb-3 md:pb-0">
        <div className="flex items-start gap-3 sm:gap-4 min-w-0">
          <span className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <CalendarIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Clínica</p>
            <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground">Agenda</h1>
            <p className="mt-1.5 text-sm md:text-base text-muted-foreground max-w-2xl">Visualize e organize seus atendimentos. Sessões marcadas aqui viram lembretes para o paciente, entradas no Google Calendar e linhas no Financeiro.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant={gcalConnected ? "outline" : "secondary"}
            size="sm"
            onClick={gcalConnected ? disconnectGcal : connectGcal}
            disabled={gcalLoading}
            className="rounded-[40px] font-display font-semibold flex-1 sm:flex-none"
            title={gcalConnected ? "Google Calendar conectado — clique para desconectar" : "Conectar Google Calendar"}
          >
            {gcalLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : gcalConnected ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <CalendarIcon className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">{gcalConnected ? "Google Calendar" : "Conectar Google"}</span>
            <span className="sm:hidden">{gcalConnected ? "Conectado" : "Google"}</span>
          </Button>
          {gcalConnected && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={syncAllExistingToGcal}
              disabled={bulkSyncing}
              className="rounded-[40px] font-display font-semibold flex-1 sm:flex-none"
              title="Cria eventos no Google Calendar para todas as sessões futuras ainda não sincronizadas"
            >
              {bulkSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="hidden sm:inline">
                {bulkSyncing && bulkProgress ? `Sincronizando ${bulkProgress.done}/${bulkProgress.total}` : "Sincronizar existentes"}
              </span>
              <span className="sm:hidden">{bulkSyncing ? "..." : "Sincronizar"}</span>
            </Button>
          )}
        <Dialog open={open} onOpenChange={(v) => { if (!v) { newGuard.guardClose(() => { clearSessionDraft(); setOpen(false); }, () => setOpen(false)); } else { setOpen(true); } }}>
          <DialogTrigger asChild>
            <Button variant="accent" size="sm" onClick={() => openNew()} className="rounded-[40px] font-display font-semibold w-full sm:w-auto sm:size-default">
              <Plus className="h-4 w-4" /> Nova sessão
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Nova sessão</DialogTitle>
            </DialogHeader>
            {draftRestored && (
              <div className="rounded-lg bg-accent/20 border border-accent/30 px-3 py-2 text-sm text-muted-foreground flex items-center justify-between gap-2">
                <span>📝 Rascunho recuperado. Continue de onde parou.</span>
                <Button variant="ghost" size="sm" className="h-auto py-1 px-2 text-xs" onClick={() => { clearSessionDraft(); setFormRaw({ ...emptySessionForm, date: form.date }); }}>Descartar</Button>
              </div>
            )}
            {patients.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6">Cadastre um paciente ativo antes de agendar.</p>
            ) : (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de compromisso</Label>
                  <Select value={form.service_id || form.session_type} onValueChange={(v) => {
                    if (v === "clinical" || v === "supervision") {
                      setForm({ ...form, session_type: v as SessionType, service_id: "" });
                    } else {
                      const svc = services.find(s => s.id === v);
                      const svcPrice = svc ? Number(svc.price) : 0;
                      setForm({
                        ...form,
                        session_type: "clinical",
                        service_id: v,
                        // Só sobrescreve o valor se o serviço tiver preço cadastrado (> 0).
                        // Assim, mudar de serviço não zera o valor digitado manualmente.
                        price: svcPrice > 0 ? String(svcPrice) : form.price,
                      });
                    }
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clinical">Automático (Atendimento clínico)</SelectItem>
                      {services.length > 0 && services.map(svc => (
                        <SelectItem key={svc.id} value={svc.id}>
                          {svc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.session_type === "clinical" && (
                  <div className="space-y-2">
                    <Label>Paciente *</Label>
                    <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                    {patientMonthCount && (
                      <div className="rounded-xl bg-muted/50 border border-border p-3 text-sm space-y-1">
                        <p className="font-medium text-foreground">
                          {patientMonthCount.count === 0 ? "Nenhuma sessão neste mês — sessão única" : `${patientMonthCount.count} ${patientMonthCount.count === 1 ? "sessão" : "sessões"} neste mês`}
                          {patientMonthCount.count > 0 && <span className="text-muted-foreground font-normal"> (esta será a {patientMonthCount.count + 1}ª)</span>}
                        </p>
                        {patientMonthCount.dates.length > 0 && <p className="text-xs text-muted-foreground">Dias: {patientMonthCount.dates.join(", ")}</p>}
                      </div>
                    )}
                  </div>
                )}
                {form.session_type === "supervision" && (
                  <div className="space-y-2">
                    <Label>Paciente discutido (opcional)</Label>
                    <Select value={form.discussed_patient_id} onValueChange={(v) => setForm({ ...form, discussed_patient_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Nenhum</SelectItem>
                        {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="date">Data *</Label>
                    <Input id="date" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Horário *</Label>
                    <Input id="time" type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de agendamento</Label>
                  <Select value={form.recurrence} onValueChange={(v) => setForm({ ...form, recurrence: v as "single" | "recurring" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Sessão única</SelectItem>
                      <SelectItem value="recurring">Sessões recorrentes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.recurrence === "recurring" && (
                  <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="rec_count">Quantidade</Label>
                        <Input id="rec_count" type="number" min="2" max="52" value={form.recurrence_count} onChange={(e) => setForm({ ...form, recurrence_count: Math.max(2, Number(e.target.value)) })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Intervalo</Label>
                        <Select value={form.recurrence_interval} onValueChange={(v) => setForm({ ...form, recurrence_interval: v as "weekly" | "biweekly" })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weekly">Semanal</SelectItem>
                            <SelectItem value="biweekly">Quinzenal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Forma de pagamento do plano</Label>
                      <Select value={form.payment_plan} onValueChange={(v) => setForm({ ...form, payment_plan: v as "per_session" | "single_payment" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per_session">Por sessão</SelectItem>
                          <SelectItem value="single_payment">Pagamento único</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(() => {
                      const patient = patients.find((p) => p.id === form.patient_id);
                      const unitPrice = form.price ? Number(form.price) : (patient?.session_price ?? 0);
                      const total = unitPrice * form.recurrence_count;
                      const dates = Array.from({ length: form.recurrence_count }, (_, i) => {
                        const d = addDays(parse(`${form.date} ${form.time}`, "yyyy-MM-dd HH:mm", new Date()), i * (form.recurrence_interval === "biweekly" ? 14 : 7));
                        return format(d, "dd/MM");
                      });
                      return (
                        <div className="rounded-lg bg-card border border-border p-3 text-sm space-y-1.5">
                          <p className="font-medium text-foreground">📋 {form.recurrence_count} sessões — Total: <span className="text-accent font-bold">R$ {total.toFixed(2)}</span></p>
                          <p className="text-xs text-muted-foreground">
                            {form.payment_plan === "single_payment"
                              ? `💳 1 lançamento financeiro de R$ ${total.toFixed(2)}`
                              : `💳 ${form.recurrence_count}x R$ ${unitPrice.toFixed(2)}`}
                          </p>
                          <p className="text-xs text-muted-foreground">📅 {dates.join(", ")}</p>
                        </div>
                      );
                    })()}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Modalidade</Label>
                    <Select value={form.modality} onValueChange={(v) => setForm({ ...form, modality: v as "presencial" | "online" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="presencial"><span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Presencial</span></SelectItem>
                        <SelectItem value="online"><span className="flex items-center gap-1.5"><Video className="h-3.5 w-3.5" /> Online</span></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.modality === "online" && (
                    <div className="space-y-2">
                      <Label htmlFor="meeting_link">Link da sessão</Label>
                      <Input id="meeting_link" type="url" placeholder="https://meet.google.com/..." value={form.meeting_link} onChange={(e) => setForm({ ...form, meeting_link: e.target.value })} />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="dur">Duração (min)</Label>
                    <Input id="dur" type="number" min="10" max="480" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Valor (R$)</Label>
                    <Input id="price" type="number" step="0.01" min="0" placeholder="Auto" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                  </div>
                </div>
                <div className="rounded-xl border border-dashed border-border p-3 space-y-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Pagamento — preencher após sessão realizada</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Método pagamento</Label>
                      <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v as typeof form.payment_method })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Não informado</SelectItem>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="card">Cartão</SelectItem>
                          <SelectItem value="cash">Dinheiro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payref">Referência{(form.payment_method === "pix" || form.payment_method === "card") && <span className="text-destructive ml-1">*</span>}</Label>
                      <Input id="payref" maxLength={500} placeholder={form.payment_method === "pix" ? "Ex.: comprovante" : form.payment_method === "card" ? "Ex.: NSU" : "Opcional"} value={form.payment_reference} onChange={(e) => setForm({ ...form, payment_reference: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea id="notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                {form.session_type === "clinical" && (
                  <div className="rounded-xl border border-dashed border-border p-3 space-y-3">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Dados do humor — preencher após sessão</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-2 sm:col-span-1">
                        <Label htmlFor="mood">Humor (1-10)</Label>
                        <Input id="mood" type="number" min="1" max="10" placeholder="—" value={form.mood_score} onChange={(e) => setForm({ ...form, mood_score: e.target.value })} />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="prog">Observação</Label>
                        <Input id="prog" maxLength={2000} placeholder="Ex.: melhora no sono" value={form.progress_note} onChange={(e) => setForm({ ...form, progress_note: e.target.value })} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Emoções predominantes</Label>
                      <EmotionChips note={form.progress_note} onChange={(v) => setForm({ ...form, progress_note: v })} />
                    </div>
                  </div>
                )}

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => newGuard.guardClose(() => { clearSessionDraft(); setOpen(false); }, () => setOpen(false))}>Cancelar</Button>
                  <Button type="submit" variant="accent" disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />} Agendar
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
        </div>
      </header>

      {/* ── ZONA SUPERIOR: Calendar + day sessions ── */}
      <div className="space-y-4 pb-5" style={{ borderBottom: "0.5px solid hsl(var(--border))" }}>
        <div className="space-y-4">

          {/* Service filter */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => setServiceFilter("all")}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-display font-semibold transition-colors border",
                serviceFilter === "all"
                  ? "bg-accent text-accent-foreground border-accent"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              )}
            >
              Todos
            </button>
            {services.map((svc) => (
              <button
                key={svc.id}
                onClick={() => setServiceFilter(svc.id)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-xs font-display font-semibold transition-colors border",
                  serviceFilter === svc.id
                    ? "bg-accent text-accent-foreground border-accent"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                )}
              >
                {svc.name}
              </button>
            ))}
          </div>

          <Tabs value={viewTab} onValueChange={setViewTab}>
            <TabsList className="w-full sm:w-auto bg-background/95 backdrop-blur sm:bg-transparent sm:backdrop-blur-none gap-1 p-0 sticky top-[124px] md:static z-20 -mx-6 px-6 py-2 sm:m-0 sm:p-0">
              <TabsTrigger value="month" className="flex-1 sm:flex-none rounded-[40px] font-display font-semibold text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-none"><CalendarDays className="h-3.5 w-3.5 mr-1.5 inline" /> Mês</TabsTrigger>
              <TabsTrigger value="week" className="flex-1 sm:flex-none rounded-[40px] font-display font-semibold text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-none"><CalendarRange className="h-3.5 w-3.5 mr-1.5 inline" /> Semana</TabsTrigger>
              <TabsTrigger value="day" className="flex-1 sm:flex-none rounded-[40px] font-display font-semibold text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-none"><CalendarCheck className="h-3.5 w-3.5 mr-1.5 inline" /> Dia</TabsTrigger>
            </TabsList>

            {/* ── MONTH VIEW ── */}
            <TabsContent value="month">
              <div className="space-y-4">
                {/* Month header */}
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-card border border-border shadow-card p-3 sm:p-4">
                  <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10 shrink-0" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <p className="font-display text-sm sm:text-lg font-semibold capitalize text-center truncate">
                    {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                  </p>
                  <div className="flex gap-1 sm:gap-2 shrink-0">
                    <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm rounded-[40px] font-display font-semibold bg-[rgba(150,117,206,0.06)] border-[rgba(150,117,206,0.25)] text-primary hover:bg-[rgba(150,117,206,0.12)] hover:text-primary" onClick={() => { setCurrentMonth(startOfMonth(new Date())); setSelectedDate(new Date()); }}>
                      Hoje
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {loading ? (
                  <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
                    {/* Calendar grid */}
                    <div className="rounded-2xl bg-card border border-border shadow-card p-4">
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {WEEKDAY_NAMES.map((d) => (
                          <div key={d} className="text-center text-[11px] uppercase tracking-wider text-muted-foreground font-medium py-1">{d}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {monthGrid.map((cell, i) => {
                          if (!cell) return <div key={`empty-${i}`} className="aspect-square" />;
                          const dateKey = format(cell, "yyyy-MM-dd");
                          const hasSessions = daysWithSessions.has(dateKey);
                          const isSelected = isSameDay(cell, selectedDate);
                          const isToday = isSameDay(cell, new Date());
                          const dayCount = sessionsByDay(cell).length;
                          return (
                            <button
                              key={dateKey}
                              onClick={() => setSelectedDate(cell)}
                              className={cn(
                                "aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all text-sm leading-none",
                                isSelected ? "bg-accent text-accent-foreground ring-2 ring-accent/40 font-bold"
                                  : isToday ? "bg-primary/10 text-primary font-semibold"
                                    : "hover:bg-muted/50 text-foreground"
                              )}
                            >
                              <span>{format(cell, "d")}</span>
                              {hasSessions ? (
                                <span className="flex items-center gap-0.5 h-3">
                                  <span className={cn(
                                    "w-1.5 h-1.5 rounded-full shrink-0",
                                    isSelected ? "bg-accent-foreground" : "bg-primary"
                                  )} />
                                  {dayCount > 1 && <span className={cn("text-[8px] leading-none", isSelected ? "text-accent-foreground" : "text-primary")}>{dayCount}</span>}
                                </span>
                              ) : (
                                <span className="h-3" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Day detail */}
                    <div className="rounded-2xl bg-card border border-border shadow-card p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="font-display text-lg font-semibold capitalize">
                            {format(selectedDate, "EEEE", { locale: ptBR })}
                          </p>
                          <p className="text-sm text-muted-foreground">{format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</p>
                        </div>
                        <Button variant="accent" size="sm" className="rounded-[40px] font-display font-semibold" onClick={() => openNew(selectedDate)}>
                          <Plus className="h-3.5 w-3.5" /> Nova
                        </Button>
                      </div>
                      {selectedDaySessions.length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground">
                          <CalendarIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Nenhuma sessão neste dia</p>
                          <Button variant="ghost" size="sm" className="mt-2" onClick={() => openNew(selectedDate)}>
                            + Agendar sessão
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                          {selectedDaySessions.map((s) => <SessionCard key={s.id} s={s} />)}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── WEEK VIEW ── */}
            <TabsContent value="week">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-card border border-border shadow-card p-3 sm:p-4">
                  <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10 shrink-0" onClick={() => setWeekStart(addWeeks(weekStart, -1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-center min-w-0">
                    <p className="font-display text-sm sm:text-lg font-semibold capitalize truncate">{format(weekStart, "MMMM yyyy", { locale: ptBR })}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{format(weekStart, "dd/MM")} — {format(addDays(weekStart, 6), "dd/MM")}</p>
                  </div>
                  <div className="flex gap-1 sm:gap-2 shrink-0">
                    <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm rounded-[40px] font-display font-semibold bg-[rgba(150,117,206,0.06)] border-[rgba(150,117,206,0.25)] text-primary hover:bg-[rgba(150,117,206,0.12)] hover:text-primary" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Hoje</Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {loading ? (
                  <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
                ) : isMobile ? (
                  /* ── COMPACT MOBILE WEEK ── */
                  <div className="space-y-3">
                    {/* Weekday strip */}
                    <div className="grid grid-cols-7 gap-1 rounded-2xl bg-card border border-border shadow-card p-2">
                      {weekDays.map((day) => {
                        const items = sessionsByDay(day);
                        const isToday = isSameDay(day, new Date());
                        const isSelected = isSameDay(day, selectedDate);
                        return (
                          <button
                            key={day.toISOString()}
                            onClick={() => setSelectedDate(day)}
                            className={cn(
                              "flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-colors",
                              isSelected ? "bg-accent text-accent-foreground" :
                                isToday ? "bg-accent/15 text-accent" : "hover:bg-secondary/40 text-foreground"
                            )}
                            aria-label={format(day, "EEEE dd/MM", { locale: ptBR })}
                          >
                            <span className="text-[10px] font-display font-semibold uppercase tracking-wide opacity-80">
                              {format(day, "EEEEEE", { locale: ptBR })}
                            </span>
                            <span className="text-base font-display font-bold leading-none">
                              {format(day, "dd")}
                            </span>
                            <span className={cn(
                              "mt-0.5 h-1.5 w-1.5 rounded-full",
                              items.length === 0 ? "bg-transparent" :
                                isSelected ? "bg-accent-foreground" : "bg-accent"
                            )} />
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected day header + add */}
                    <div className="flex items-center justify-between gap-2 px-1">
                      <p className="font-display text-sm font-semibold capitalize text-foreground truncate">
                        {format(selectedDate, "EEEE, dd 'de' MMM", { locale: ptBR })}
                      </p>
                      <Button variant="accent" size="sm" className="h-8 px-3 rounded-[40px] font-display font-semibold text-xs" onClick={() => openNew(selectedDate)}>
                        <Plus className="h-3.5 w-3.5" /> Nova
                      </Button>
                    </div>

                    {/* Clickable time slots for selected day */}
                    {selectedDaySessions.length === 0 ? (
                      <button
                        onClick={() => openNew(selectedDate)}
                        className="w-full rounded-2xl border border-dashed border-border bg-card/50 py-8 text-sm text-muted-foreground hover:text-accent hover:border-accent/40 transition-colors text-center"
                      >
                        Dia livre — toque para agendar
                      </button>
                    ) : (
                      <div className="rounded-2xl bg-card border border-border shadow-card overflow-hidden divide-y divide-border">
                        {selectedDaySessions.map((s) => {
                          const isSupervisionRow = s.session_type === "supervision";
                          return (
                            <button
                              key={s.id}
                              onClick={() => openEdit(s)}
                              className="w-full flex items-center gap-3 px-3 py-3 hover:bg-secondary/30 active:bg-secondary/50 transition-colors text-left"
                              aria-label={`Abrir sessão de ${format(new Date(s.scheduled_at), "HH:mm")}`}
                            >
                              <div className={cn(
                                "flex flex-col items-center justify-center w-14 shrink-0 rounded-xl py-1.5 px-1",
                                isSupervisionRow ? "bg-serene/15 text-serene" :
                                  s.status === "confirmed" ? "bg-accent/15 text-accent" :
                                    "bg-primary/10 text-primary"
                              )}>
                                <span className="font-display text-sm font-bold leading-none">
                                  {format(new Date(s.scheduled_at), "HH:mm")}
                                </span>
                                <span className="text-[9px] font-medium opacity-70 mt-0.5">{s.duration_minutes}min</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-foreground truncate">
                                  {isSupervisionRow ? "Supervisão" : s.patient_name || "Paciente"}
                                  {isSupervisionRow && s.discussed_patient_name && (
                                    <span className="text-muted-foreground"> · {s.discussed_patient_name}</span>
                                  )}
                                </p>
                                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                  <span className={cn(PILL_BASE, isSupervisionRow ? "bg-serene/20 text-serene border-serene/30" : statusClass[s.status])}>
                                    {isSupervisionRow ? "Supervisão" : statusLabel[s.status]}
                                  </span>
                                  {!isSupervisionRow && s.price != null && (
                                    <span className={cn(PILL_BASE, paymentStatusClass[s.payment_status])}>
                                      {paymentStatusLabel[s.payment_status]}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {weekDays.map((day) => {
                      const items = sessionsByDay(day);
                      const isToday = isSameDay(day, new Date());
                      return (
                        <div key={day.toISOString()} className="rounded-2xl bg-card border border-border shadow-card overflow-hidden">
                          {/* Day header */}
                          <div className={cn(
                            "flex items-center justify-between gap-2 px-3 sm:px-5 py-2 sm:py-3 border-b",
                            isToday ? "bg-accent/10 border-accent/20" : "bg-secondary/30 border-border"
                          )}>
                            <p className={cn("font-display font-semibold capitalize text-sm sm:text-base truncate", isToday ? "text-accent" : "text-foreground")}>
                              {format(day, "EEEE", { locale: ptBR })}, {format(day, "dd/MM")}
                            </p>
                            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-accent shrink-0 px-2" onClick={() => openNew(day)}>
                              <Plus className="h-3.5 w-3.5 sm:mr-1" /> <span className="hidden sm:inline">adicionar</span>
                            </Button>
                          </div>
                          {/* Sessions rows */}
                          {items.length === 0 ? (
                            <button onClick={() => openNew(day)} className="w-full text-sm text-muted-foreground/50 hover:text-accent py-4 transition-colors text-center">
                              Nenhuma sessão — clique para agendar
                            </button>
                          ) : (
                            <div className="divide-y divide-border">
                              {items.map((s) => {
                                const isSupervisionRow = s.session_type === "supervision";
                                const svcName = s.service_id
                                  ? services.find(sv => sv.id === s.service_id)?.name
                                  : (isSupervisionRow ? null : "Atendimento clínico");
                                return (
                                  <div
                                    key={s.id}
                                    onClick={() => openEdit(s)}
                                    className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2.5 sm:py-3 hover:bg-secondary/30 cursor-pointer transition-colors group"
                                  >
                                    {/* Time */}
                                    <span className="font-display text-xs sm:text-sm font-semibold text-primary w-10 sm:w-12 shrink-0">
                                      {format(new Date(s.scheduled_at), "HH:mm")}
                                    </span>
                                    {/* Divider */}
                                    <div className="w-px h-8 bg-border shrink-0 hidden sm:block" />
                                    {/* Name + type */}
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-xs sm:text-sm text-foreground truncate">
                                        {isSupervisionRow ? "Supervisão" : s.patient_name || "Paciente"}
                                        {isSupervisionRow && s.discussed_patient_name && <span className="text-muted-foreground"> · {s.discussed_patient_name}</span>}
                                      </p>
                                      {svcName && !isSupervisionRow && (
                                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{svcName}</p>
                                      )}
                                    </div>
                                    {/* Status + Payment */}
                                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 flex-wrap justify-end max-w-[40%] sm:max-w-none">
                                      <span className={cn(PILL_BASE, isSupervisionRow ? "bg-serene/20 text-serene border-serene/30" : statusClass[s.status])}>
                                        {isSupervisionRow ? "Supervisão" : statusLabel[s.status]}
                                      </span>
                                      {!isSupervisionRow && s.price != null && (
                                        <span className={cn(PILL_BASE, paymentStatusClass[s.payment_status])}>
                                          {paymentStatusLabel[s.payment_status]}
                                        </span>
                                       )}
                                      {s.billing_sent_at && (
                                        <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                                          💸 {format(new Date(s.billing_sent_at), "dd/MM")}
                                        </span>
                                      )}
                                      {s.confirmation_sent_at && (
                                        <span
                                          className="lilac-comm-badge inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border shadow-sm"
                                          title={`Lembrete enviado em ${format(new Date(s.confirmation_sent_at), "dd/MM 'às' HH:mm")}`}
                                        >
                                          <Bell className="h-3 w-3" /> Lembrete enviado
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── DAY VIEW ── */}
            <TabsContent value="day">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-card border border-border shadow-card p-3 sm:p-4">
                  <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10 shrink-0" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-center min-w-0">
                    <p className="font-display text-sm sm:text-lg font-semibold capitalize truncate">{format(selectedDate, "EEEE", { locale: ptBR })}</p>
                    <p className="text-[10px] sm:text-sm text-muted-foreground truncate">{format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                  </div>
                  <div className="flex gap-1 sm:gap-2 shrink-0">
                    <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm rounded-[40px] font-display font-semibold bg-[rgba(150,117,206,0.06)] border-[rgba(150,117,206,0.25)] text-primary hover:bg-[rgba(150,117,206,0.12)] hover:text-primary" onClick={() => setSelectedDate(new Date())}>Hoje</Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="accent" size="sm" className="rounded-[40px] font-display font-semibold" onClick={() => openNew(selectedDate)}>
                    <Plus className="h-3.5 w-3.5" /> Nova sessão
                  </Button>
                </div>

                {loading ? (
                  <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
                ) : selectedDaySessions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-card/50 p-14 text-center">
                    <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground/40" />
                    <p className="mt-4 font-display text-lg font-medium text-foreground/70">Dia livre</p>
                    <p className="mt-1 text-sm text-muted-foreground">Nenhuma sessão agendada para este dia.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedDaySessions.map((s) => <SessionCard key={s.id} s={s} />)}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ── ZONA INFERIOR: Sessões do Mês (largura total) ── */}
      <div style={{ background: "hsl(var(--muted))", margin: "0 -1rem", padding: "20px 1rem 24px" }}>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h2 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 12, color: "hsl(var(--foreground))" }}>Sessões do Mês</h2>
          <span style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
            {format(currentMonth, "MMM yyyy", { locale: ptBR })}
          </span>
          <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: 11, color: "hsl(var(--brown))" }}>
            · Pendente R$ {pendingTotal.toFixed(2)}
          </span>
          <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: 11, color: "hsl(var(--primary))" }}>
            · Pago R$ {paidTotal.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center gap-5 mb-3" style={{ borderBottom: "0.5px solid hsl(var(--border))" }}>
          {([["pending", "Pendentes"], ["paid", "Pagos"], ["all", "Todos"]] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setPaymentFilter(val)}
              className="pb-2 -mb-px transition-colors"
              style={{
                fontFamily: "Syne, sans-serif",
                fontWeight: paymentFilter === val ? 700 : 600,
                fontSize: 11,
                color: paymentFilter === val ? "hsl(var(--primary-dark))" : "hsl(var(--muted-foreground))",
                borderBottom: paymentFilter === val ? "2px solid hsl(var(--primary))" : "2px solid transparent",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <Select value={filterPatientId} onValueChange={setFilterPatientId}>
            <SelectTrigger
              className="h-9 text-xs w-full sm:w-auto"
              style={{ background: "#fff", border: "0.5px solid hsl(var(--border))", borderRadius: 40, color: "hsl(var(--primary-dark))", fontFamily: "Instrument Sans, sans-serif", fontSize: 11 }}
            >
              <Filter className="h-3 w-3 mr-1" style={{ color: "hsl(var(--muted-foreground))" }} /><SelectValue placeholder="Todos os pacientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os pacientes</SelectItem>
              {pendingPatients.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          <button
            onClick={() => setPendingSort(pendingSort === "date" ? "patient" : "date")}
            className="inline-flex items-center gap-1.5 h-9 px-3"
            style={{ background: "#fff", border: "0.5px solid hsl(var(--border))", borderRadius: 40, color: "hsl(var(--primary-dark))", fontFamily: "Instrument Sans, sans-serif", fontSize: 11 }}
          >
            <ArrowUpDown className="h-3 w-3" style={{ color: "hsl(var(--muted-foreground))" }} />
            {pendingSort === "date" ? "Data" : "Paciente"}
          </button>
        </div>

        {loadingPending ? (
          <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>
        ) : sortedPending.length === 0 ? (
          <div className="py-10 text-center" style={{ color: "hsl(var(--muted-foreground))" }}>
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 13 }}>
              {paymentFilter === "paid" ? "Nenhuma sessão paga neste mês" : paymentFilter === "all" ? "Nenhuma sessão neste mês" : "Nenhum pagamento pendente 🎉"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {groupedPending.map((group) => {
              const s = group.session;
              return (
                <div
                  key={group.key}
                  className="relative overflow-hidden transition-shadow"
                  style={{ background: "hsl(var(--card))", border: "0.5px solid hsl(var(--border))", borderRadius: 12, padding: "14px 16px" }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 14px rgba(150,117,206,0.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
                >
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2.5, background: "linear-gradient(90deg, hsl(var(--gold)), hsl(var(--gold)), hsl(var(--gold)))" }} />
                  <div className="min-w-0" style={{ paddingTop: 4 }}>
                    {s.patient_id && s.patient_name ? (
                      <PatientNameLink patientId={s.patient_id} name={s.patient_name} />
                    ) : (
                      <p className="truncate" style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 12.5, color: "hsl(var(--foreground))" }}>{s.patient_name}</p>
                    )}
                    <p className="mt-1 flex items-center gap-1.5" style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 10.5, color: "hsl(var(--muted-foreground))" }}>
                      <CalendarIcon className="h-3 w-3" style={{ color: "hsl(var(--muted-foreground))" }} />
                      {group.isSinglePayment ? `${group.sessions.length} sessões` : format(new Date(s.scheduled_at), "dd/MM/yyyy")}
                    </p>
                    <p className="mt-2" style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 14, color: "hsl(var(--primary))" }}>
                      R$ {group.total.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-3">
                    <Select value={s.payment_status} onValueChange={(v) => group.isSinglePayment ? updatePaymentGroup(group.sessions.map((item) => item.id), v as PaymentStatus) : updatePaymentStatus(s.id, v as PaymentStatus)}>
                      <SelectTrigger
                        className="h-7 flex-1"
                        style={{
                          background: s.payment_status === "paid" ? "rgba(150,117,206,0.08)" : "rgba(201,168,76,0.08)",
                          border: s.payment_status === "paid" ? "0.5px solid rgba(150,117,206,0.25)" : "0.5px solid rgba(201,168,76,0.25)",
                          color: s.payment_status === "paid" ? "hsl(var(--primary-dark))" : "hsl(var(--brown))",
                          fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: 9.5, borderRadius: 40,
                        }}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending"><span className="font-medium" style={{ color: "hsl(var(--brown))" }}>● Pendente</span></SelectItem>
                        <SelectItem value="paid"><span className="font-medium" style={{ color: "hsl(var(--primary-dark))" }}>● Pago</span></SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      title="Cobrar via WhatsApp"
                      onClick={() => sendWhatsAppReminder(s)}
                      className="flex items-center justify-center transition-colors"
                      style={{ width: 24, height: 24, borderRadius: 6, color: "hsl(var(--muted-foreground))", background: "transparent" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "hsl(var(--secondary))"; e.currentTarget.style.color = "hsl(var(--primary))"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "hsl(var(--muted-foreground))"; }}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </button>
                    <button
                      title="Excluir sessão"
                      onClick={() => promptDelete(s.id)}
                      className="flex items-center justify-center transition-colors"
                      style={{ width: 24, height: 24, borderRadius: 6, color: "hsl(var(--muted-foreground))", background: "transparent" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "hsl(var(--brown))"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "hsl(var(--muted-foreground))"; }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Edit Session Dialog ── */}
      <Dialog open={editOpen} onOpenChange={(v) => { if (!v) { editGuard.guardClose(() => setEditOpen(false), () => setEditOpen(false)); } else { setEditOpen(true); } }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Editar sessão</DialogTitle>
          </DialogHeader>
          {(() => {
            const session = sessions.find((s) => s.id === editSessionId);
            return (
              <>
                {session?.patient_name && (
                  <div className="rounded-xl bg-muted/50 border border-border p-3 mb-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Paciente</p>
                    <p className="font-display font-semibold text-foreground">{session.patient_name}</p>
                  </div>
                )}
              </>
            );
          })()}
          <form onSubmit={handleEditSave} className="space-y-4">
            {/* Tipo de compromisso / Serviço */}
            <div className="space-y-2">
              <Label>Tipo de compromisso</Label>
              <Select value={editForm.service_id || editForm.session_type} onValueChange={(v) => {
                if (v === "clinical" || v === "supervision") {
                  setEditForm({ ...editForm, session_type: v as SessionType, service_id: "" });
                } else {
                  const svc = services.find(s => s.id === v);
                  const svcPrice = svc ? Number(svc.price) : 0;
                  setEditForm({
                    ...editForm,
                    session_type: "clinical",
                    service_id: v,
                    // Mantém o valor digitado quando o serviço não tem preço cadastrado.
                    price: svcPrice > 0 ? String(svcPrice) : editForm.price,
                  });
                }
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="clinical">Automático (Atendimento clínico)</SelectItem>
                  
                  
                  {services.length > 0 && services.map(svc => (
                    <SelectItem key={svc.id} value={svc.id}>
                      {svc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Data e horário */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <Input type="time" value={editForm.time} onChange={(e) => setEditForm({ ...editForm, time: e.target.value })} />
              </div>
            </div>
            {/* Tipo de agendamento */}
            <div className="space-y-2">
              <Label>Tipo de agendamento</Label>
              <Select value={editForm.recurrence} onValueChange={(v) => setEditForm({ ...editForm, recurrence: v as "single" | "recurring" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Sessão única</SelectItem>
                  <SelectItem value="recurring">Sessões recorrentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editForm.recurrence === "recurring" && (
              <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Quantidade</Label>
                    <Input type="number" min="2" max="52" value={editForm.recurrence_count} onChange={(e) => setEditForm({ ...editForm, recurrence_count: Math.max(2, Number(e.target.value)) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Intervalo</Label>
                    <Select value={editForm.recurrence_interval} onValueChange={(v) => setEditForm({ ...editForm, recurrence_interval: v as "weekly" | "biweekly" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="biweekly">Quinzenal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Forma de pagamento do plano</Label>
                  <Select value={editForm.payment_plan} onValueChange={(v) => setEditForm({ ...editForm, payment_plan: v as "per_session" | "single_payment" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_session">Por sessão</SelectItem>
                      <SelectItem value="single_payment">Pagamento único</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v as Status })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(statusLabel) as [Status, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pagamento</Label>
                <Select value={editForm.payment_status} onValueChange={(v) => setEditForm({ ...editForm, payment_status: v as PaymentStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Modalidade</Label>
                <Select value={editForm.modality} onValueChange={(v) => setEditForm({ ...editForm, modality: v as "presencial" | "online" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="presencial"><span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Presencial</span></SelectItem>
                    <SelectItem value="online"><span className="flex items-center gap-1.5"><Video className="h-3.5 w-3.5" /> Online</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editForm.modality === "online" && (
                <div className="space-y-2">
                  <Label>Link da sessão</Label>
                  <Input type="url" placeholder="https://meet.google.com/..." value={editForm.meeting_link} onChange={(e) => setEditForm({ ...editForm, meeting_link: e.target.value })} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Duração (min)</Label>
                <Input type="number" min="10" max="480" value={editForm.duration_minutes} onChange={(e) => setEditForm({ ...editForm, duration_minutes: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" min="0" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
              </div>
            </div>
            <div className="rounded-xl border border-dashed border-border p-3 space-y-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Pagamento — preencher após sessão realizada</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Método pagamento</Label>
                  <Select value={editForm.payment_method} onValueChange={(v) => setEditForm({ ...editForm, payment_method: v as typeof editForm.payment_method })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não informado</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="card">Cartão</SelectItem>
                      <SelectItem value="cash">Dinheiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Referência{(editForm.payment_method === "pix" || editForm.payment_method === "card") && <span className="text-destructive ml-1">*</span>}</Label>
                  <Input maxLength={500} placeholder={editForm.payment_method === "pix" ? "Ex.: comprovante" : editForm.payment_method === "card" ? "Ex.: NSU" : "Opcional"} value={editForm.payment_reference} onChange={(e) => setEditForm({ ...editForm, payment_reference: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea rows={3} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
            {(() => {
              const session = sessions.find((s) => s.id === editSessionId);
              if (session?.session_type === "supervision") return null;
              return (
                <div className="rounded-xl border border-dashed border-border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Dados do humor — preencher após sessão</p>
                    {editProgressId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive text-xs h-7 px-2"
                        onClick={async () => {
                          await supabase.from("patient_progress").delete().eq("id", editProgressId);
                          setEditProgressId(null);
                          setEditFormRaw((prev) => ({ ...prev, mood_score: "", progress_note: "" }));
                          toast.success("Registro de humor excluído");
                        }}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Excluir humor
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-2 sm:col-span-1">
                      <Label>Humor (1-10)</Label>
                      <Input type="number" min="1" max="10" placeholder="—" value={editForm.mood_score} onChange={(e) => setEditForm({ ...editForm, mood_score: e.target.value })} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Observação</Label>
                      <Input maxLength={2000} placeholder="Ex.: melhora no sono" value={editForm.progress_note} onChange={(e) => setEditForm({ ...editForm, progress_note: e.target.value })} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Emoções predominantes</Label>
                    <EmotionChips note={editForm.progress_note} onChange={(v) => setEditForm({ ...editForm, progress_note: v })} />
                  </div>

                </div>
              );
            })()}
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button" variant="destructive" size="sm"
                className="sm:mr-auto"
                onClick={() => { if (editSessionId) { promptDelete(editSessionId); } }}
              >
                <Trash2 className="h-4 w-4" /> Excluir sessão
              </Button>
              <Button type="button" variant="outline" onClick={() => editGuard.guardClose(() => setEditOpen(false))}>Cancelar</Button>
              <Button type="submit" variant="accent" disabled={editSaving}>
                {editSaving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Modal ── */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-sm sm:max-w-md mx-auto p-4 sm:p-6 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Excluir sessão</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Escolha o que deseja excluir:
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const current = deleteSessionId
              ? (sessions.find((s) => s.id === deleteSessionId)
                || pendingSessions.find((s) => s.id === deleteSessionId)
                || pendingPackageSessions.find((s) => s.id === deleteSessionId))
              : null;
            const pkg = current ? getPackageInfo(current.notes) : null;
            return (
              <div className="space-y-3 py-2">
                <Button
                  variant="outline"
                  className="w-full justify-start items-start gap-3 h-auto py-3 text-left whitespace-normal overflow-hidden"
                  disabled={deleting}
                  onClick={() => executeDelete(false)}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-foreground">Excluir apenas a sessão</p>
                    <p className="text-xs text-muted-foreground leading-snug break-words">Remove a sessão, progresso e eventos vinculados</p>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start items-start gap-3 h-auto py-3 text-left whitespace-normal overflow-hidden border-destructive/30 hover:bg-destructive/5"
                  disabled={deleting}
                  onClick={() => executeDelete(true)}
                >
                  <DollarSign className="h-4 w-4 text-destructive shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-destructive">Excluir sessão + lançamento financeiro</p>
                    <p className="text-xs text-muted-foreground leading-snug break-words">Remove a sessão, progresso, eventos vinculados e o lançamento financeiro</p>
                  </div>
                </Button>
                {pkg && (
                  <>
                    <div className="pt-2 border-t border-border">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Sequência (pacote de {pkg.total} sessões)
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full justify-start items-start gap-3 h-auto py-3 text-left whitespace-normal overflow-hidden"
                      disabled={deleting}
                      onClick={() => executeDeleteSeries(false)}
                    >
                      <Users className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-foreground">Excluir toda a sequência</p>
                        <p className="text-xs text-muted-foreground leading-snug break-words">Cancela todas as sessões do pacote (mantém o financeiro)</p>
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start items-start gap-3 h-auto py-3 text-left whitespace-normal overflow-hidden border-destructive/30 hover:bg-destructive/5"
                      disabled={deleting}
                      onClick={() => executeDeleteSeries(true)}
                    >
                      <DollarSign className="h-4 w-4 text-destructive shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-destructive">Excluir sequência + financeiro</p>
                        <p className="text-xs text-muted-foreground leading-snug break-words">Remove todas as sessões do pacote e seus lançamentos</p>
                      </div>
                    </Button>
                  </>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reschedule Recurring Modal ── */}
      <Dialog open={rescheduleModalOpen} onOpenChange={setRescheduleModalOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-sm mx-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Remarcar sessão de pacote</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Esta sessão faz parte de um pacote recorrente. Como deseja remarcar?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3 text-left"
              disabled={editSaving}
              onClick={() => {
                setRescheduleModalOpen(false);
                if (pendingEditEvent) handleEditSave(pendingEditEvent, false);
              }}
            >
              <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="font-medium text-sm">Alterar apenas esta sessão</p>
                <p className="text-xs text-muted-foreground">Só esta sessão será remarcada</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3 text-left border-primary/30 hover:bg-primary/5"
              disabled={editSaving}
              onClick={() => {
                setRescheduleModalOpen(false);
                if (pendingEditEvent) handleEditSave(pendingEditEvent, true);
              }}
            >
              <Users className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="font-medium text-sm">Alterar todas as próximas sessões</p>
                <p className="text-xs text-muted-foreground">Remarca esta e todas as futuras do pacote mantendo o intervalo</p>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRescheduleModalOpen(false)} disabled={editSaving}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="font-display text-xl flex items-center gap-2">
              <User className="h-5 w-5 text-accent" />
              {drawerPatientData?.full_name ?? "Paciente"}
            </SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              Informações do paciente
            </SheetDescription>
          </SheetHeader>

          <Tabs value={drawerTab} onValueChange={setDrawerTab}>
            <TabsList className="w-full">
              <TabsTrigger value="sessions" className="flex-1 text-xs gap-1">
                <CalendarIcon className="h-3.5 w-3.5" /> Sessões
              </TabsTrigger>
              <TabsTrigger value="financial" className="flex-1 text-xs gap-1">
                <DollarSign className="h-3.5 w-3.5" /> Financeiro
              </TabsTrigger>
              <TabsTrigger value="info" className="flex-1 text-xs gap-1">
                <FileText className="h-3.5 w-3.5" /> Cadastro
              </TabsTrigger>
            </TabsList>

            {/* Sessions tab */}
            <TabsContent value="sessions" className="mt-4">
              {drawerLoadingSessions ? (
                <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>
              ) : drawerSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma sessão encontrada.</p>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {drawerSessions.map((s) => (
                    <div key={s.id} className="rounded-xl border border-border bg-background p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{format(new Date(s.scheduled_at), "dd/MM/yyyy 'às' HH:mm")}</p>
                          <p className="text-xs text-muted-foreground">{s.duration_minutes} min</p>
                        </div>
                        <div className="text-right">
                          <span className={cn(PILL_BASE, statusClass[s.status as Status])}>
                            {statusLabel[s.status as Status]}
                          </span>
                          {s.price != null && (
                            <p className="text-xs text-muted-foreground mt-1">R$ {Number(s.price).toFixed(2)}</p>
                          )}
                        </div>
                      </div>
                      {s.price != null && (
                        <div className="mt-1.5">
                          <span className={cn(PILL_BASE, paymentStatusClass[s.payment_status as PaymentStatus])}>
                            {paymentStatusLabel[s.payment_status as PaymentStatus]}
                            {s.payment_method && ` · ${s.payment_method === "pix" ? "PIX" : s.payment_method === "card" ? "Cartão" : s.payment_method === "cash" ? "Dinheiro" : ""}`}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Financial tab */}
            <TabsContent value="financial" className="mt-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
                    <p className="text-xs uppercase tracking-wider text-emerald-600 mb-1">Total Pago</p>
                    <p className="font-display text-xl font-bold text-emerald-700">R$ {drawerFinancials.totalPaid.toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl bg-accent/10 border border-accent/30 p-4 text-center">
                    <p className="text-xs uppercase tracking-wider text-accent mb-1">Total Pendente</p>
                    <p className="font-display text-xl font-bold text-accent">R$ {drawerFinancials.totalPending.toFixed(2)}</p>
                  </div>
                </div>
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {drawerSessions.filter(s => s.price != null).map((s) => (
                    <div key={s.id} className="rounded-xl border border-border bg-background p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm">{format(new Date(s.scheduled_at), "dd/MM/yyyy")}</p>
                        <span className={cn(PILL_BASE, "mt-1", paymentStatusClass[s.payment_status as PaymentStatus])}>
                          {paymentStatusLabel[s.payment_status as PaymentStatus]}
                        </span>
                      </div>
                      <p className="font-display font-bold text-sm">R$ {Number(s.price).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Info tab */}
            <TabsContent value="info" className="mt-4">
              {drawerPatientData ? (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {[
                      { label: "Nome completo", value: drawerPatientData.full_name },
                      { label: "Telefone", value: drawerPatientData.phone },
                      { label: "Email", value: drawerPatientData.email },
                      { label: "Data de nascimento", value: drawerPatientData.birth_date ? format(new Date(drawerPatientData.birth_date + "T12:00:00"), "dd/MM/yyyy") : null },
                      { label: "Valor da sessão", value: drawerPatientData.session_price ? `R$ ${Number(drawerPatientData.session_price).toFixed(2)}` : null },
                      { label: "Categoria", value: drawerPatientData.category === "individual" ? "Individual" : drawerPatientData.category === "couple" ? "Casal" : drawerPatientData.category },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl bg-muted/50 border border-border p-3">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">{item.label}</p>
                        <p className="text-sm text-foreground">{item.value || "—"}</p>
                      </div>
                    ))}
                  </div>
                  {drawerPatientData.notes && (
                    <div className="rounded-xl bg-muted/50 border border-border p-3">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Observações</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{drawerPatientData.notes}</p>
                    </div>
                  )}
                  {drawerPatientData.chief_complaint && (
                    <div className="rounded-xl bg-muted/50 border border-border p-3">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Queixa principal</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{drawerPatientData.chief_complaint}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
      <UnsavedGuardDialog open={newGuard.confirmOpen} onConfirm={newGuard.confirmLeave} onCancel={newGuard.cancelLeave} onSaveDraft={newGuard.saveDraftAndLeave} />
      <UnsavedGuardDialog open={editGuard.confirmOpen} onConfirm={editGuard.confirmLeave} onCancel={editGuard.cancelLeave} onSaveDraft={editGuard.saveDraftAndLeave} />
    </div>
  );
};

export default Agenda;
