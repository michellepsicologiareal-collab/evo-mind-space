import { useEffect, useState, useMemo } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus, ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon,
  Check, X, RotateCcw, Trash2, Link2, CheckCircle2, GraduationCap,
  MessageCircle, Pencil, Filter, Users, ArrowUpDown, User, DollarSign, FileText
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
  session_type: SessionType;
  discussed_patient_id: string | null;
  is_expense: boolean;
  payment_status: PaymentStatus;
  payment_method?: string | null;
  payment_reference?: string | null;
  patient_name?: string | null;
  discussed_patient_name?: string | null;
  service_id?: string | null;
}

interface Patient {
  id: string;
  full_name: string;
  session_price: number | null;
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
  scheduled: "bg-secondary text-secondary-foreground",
  confirmed: "bg-emerald-100 text-emerald-700",
  completed: "bg-lilac text-lilac-foreground",
  no_show: "bg-destructive/15 text-destructive",
  rescheduled: "bg-sand text-sand-foreground",
  cancelled: "bg-muted text-muted-foreground line-through",
};
const paymentStatusLabel: Record<PaymentStatus, string> = { pending: "Pendente", paid: "Pago" };
const paymentStatusClass: Record<PaymentStatus, string> = {
  pending: "bg-accent/15 text-accent border-accent/30",
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const WEEKDAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const Agenda = () => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [sessions, setSessions] = useState<Session[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [pixKey, setPixKey] = useState("");
  const [viewTab, setViewTab] = useState<string>("month");

  // Pending
  const [pendingSessions, setPendingSessions] = useState<Session[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [pendingSort, setPendingSort] = useState<"date" | "patient">("date");

  // New session dialog
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [patientMonthCount, setPatientMonthCount] = useState<{ count: number; dates: string[] } | null>(null);
  const [form, setForm] = useState({
    session_type: "clinical" as SessionType,
    patient_id: "", discussed_patient_id: "",
    date: format(new Date(), "yyyy-MM-dd"), time: "09:00",
    duration_minutes: 50, price: "", notes: "",
    payment_method: "none" as "none" | "pix" | "card" | "cash",
    payment_reference: "", mood_score: "", progress_note: "",
    recurrence: "single" as "single" | "recurring",
    recurrence_count: 4, recurrence_interval: "weekly" as "weekly" | "biweekly",
    payment_plan: "per_session" as "per_session" | "single_payment",
  });

  // Edit session
  const [editOpen, setEditOpen] = useState(false);
  const [editSessionId, setEditSessionId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    status: "scheduled" as Status,
    payment_status: "pending" as PaymentStatus,
    payment_method: "none" as "none" | "pix" | "card" | "cash",
    payment_reference: "", price: "", notes: "",
    duration_minutes: 50, mood_score: "", progress_note: "",
  });
  const [editProgressId, setEditProgressId] = useState<string | null>(null);

  // Patient filter for pending list
  const [filterPatientId, setFilterPatientId] = useState<string>("all");

  // Delete confirmation modal
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Patient drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPatientId, setDrawerPatientId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState("sessions");
  const [drawerPatientData, setDrawerPatientData] = useState<any>(null);
  const [drawerSessions, setDrawerSessions] = useState<any[]>([]);
  const [drawerLoadingSessions, setDrawerLoadingSessions] = useState(false);

  // Fetch pix key
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("pix_key").eq("id", user.id).single().then(({ data }) => {
      setPixKey(data?.pix_key || "");
    });
  }, [user]);

  // Load all sessions for the current month
  const load = async () => {
    if (!user) return;
    setLoading(true);
    const mStart = startOfMonth(currentMonth);
    const mEnd = addDays(endOfMonth(currentMonth), 1);
    const [sRes, pRes] = await Promise.all([
      supabase
        .from("sessions")
        .select("id, patient_id, scheduled_at, duration_minutes, status, price, notes, confirmation_token, session_type, discussed_patient_id, is_expense, payment_status, payment_method, payment_reference, patient:patients!sessions_patient_id_fkey(full_name), discussed_patient:patients!sessions_discussed_patient_id_fkey(full_name)")
        .eq("user_id", user.id)
        .gte("scheduled_at", mStart.toISOString())
        .lt("scheduled_at", mEnd.toISOString())
        .order("scheduled_at"),
      supabase.from("patients").select("id, full_name, session_price").eq("user_id", user.id).eq("is_active", true).order("full_name"),
    ]);
    if (sRes.error) toast.error("Erro ao carregar sessões");
    const mapped = (sRes.data ?? []).map((s: any) => ({
      ...s,
      patient_name: s.patient?.full_name ?? null,
      discussed_patient_name: s.discussed_patient?.full_name ?? null,
    }));
    setSessions(mapped as Session[]);
    setPatients((pRes.data as Patient[]) ?? []);
    setLoading(false);
  };

  const loadPending = async () => {
    if (!user) return;
    setLoadingPending(true);
    const { data } = await supabase
      .from("sessions")
      .select("id, patient_id, scheduled_at, duration_minutes, status, price, notes, confirmation_token, session_type, discussed_patient_id, is_expense, payment_status, payment_method, payment_reference, patient:patients!sessions_patient_id_fkey(full_name)")
      .eq("user_id", user.id)
      .eq("payment_status", "pending")
      .eq("session_type", "clinical")
      .not("patient_id", "is", null)
      .order("scheduled_at", { ascending: false })
      .limit(50);
    const mapped = (data ?? []).map((s: any) => ({
      ...s, patient_name: s.patient?.full_name ?? null, discussed_patient_name: null,
    }));
    setPendingSessions(mapped as Session[]);
    setLoadingPending(false);
  };

  useEffect(() => { if (user) { load(); loadPending(); } }, [user, currentMonth]);

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
    setForm({
      session_type: "clinical", patient_id: "", discussed_patient_id: "",
      date: format(date ?? new Date(), "yyyy-MM-dd"), time: "09:00",
      duration_minutes: 50, price: "", notes: "",
      payment_method: "none", payment_reference: "", mood_score: "", progress_note: "",
      recurrence: "single", recurrence_count: 4, recurrence_interval: "weekly",
      payment_plan: "per_session",
    });
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

    const sessionsToInsert = [];
    for (let i = 0; i < totalSessions; i++) {
      const scheduledAt = addDays(baseDate, i * intervalDays);
      const planLabel = isRecurring
        ? `Plano ${totalSessions} sessões (${i + 1}/${totalSessions})${form.payment_plan === "single_payment" ? " — Pgto único" : " — Pgto por sessão"}`
        : null;
      const noteText = [parsed.data.notes, planLabel].filter(Boolean).join("\n");
      sessionsToInsert.push({
        user_id: user.id,
        patient_id: isSupervision ? null : (parsed.data.patient_id || null),
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: parsed.data.duration_minutes,
        price: unitPrice,
        notes: noteText || null,
        payment_method: parsed.data.payment_method === "none" ? null : parsed.data.payment_method,
        payment_reference: ref.length > 0 ? ref : null,
        session_type: parsed.data.session_type,
        discussed_patient_id: isSupervision && parsed.data.discussed_patient_id ? parsed.data.discussed_patient_id : null,
        is_expense: isSupervision,
      });
    }

    const { data: created, error } = await supabase.from("sessions").insert(sessionsToInsert).select("id");
    if (error) { setSaving(false); toast.error("Erro ao agendar sessão"); return; }

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
    setOpen(false);
    load(); loadPending();
  };

  const updateStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("sessions").update({ status }).eq("id", id);
    if (error) return toast.error("Erro ao atualizar");
    toast.success(`Marcada como ${statusLabel[status].toLowerCase()}`);
    load();
  };

  const updatePaymentStatus = async (id: string, paymentStatus: PaymentStatus) => {
    const { error } = await supabase.from("sessions").update({
      payment_status: paymentStatus,
      ...(paymentStatus === "paid" ? { paid_at: new Date().toISOString() } : {}),
    }).eq("id", id);
    if (error) return toast.error("Erro ao atualizar pagamento");
    toast.success(`Pagamento: ${paymentStatusLabel[paymentStatus]}`);
    load(); loadPending();
  };

  // ── Delete with confirmation modal ──
  const promptDelete = (id: string) => {
    setDeleteSessionId(id);
    setDeleteConfirmOpen(true);
  };

  const executeDelete = async (includeFinancial: boolean) => {
    if (!deleteSessionId) return;
    setDeleting(true);
    // Delete related progress
    await supabase.from("patient_progress").delete().eq("session_id", deleteSessionId);
    // Delete related gcal events
    await supabase.from("session_gcal_events").delete().eq("session_id", deleteSessionId);

    if (includeFinancial) {
      // Delete the session entirely (which IS the financial record)
      const { error } = await supabase.from("sessions").delete().eq("id", deleteSessionId);
      if (error) { setDeleting(false); toast.error("Erro ao excluir"); return; }
      toast.success("Sessão, progresso e lançamento financeiro excluídos");
    } else {
      // Keep the session row but mark as cancelled, clear payment
      const { error } = await supabase.from("sessions").delete().eq("id", deleteSessionId);
      if (error) { setDeleting(false); toast.error("Erro ao excluir"); return; }
      toast.success("Sessão e progresso excluídos");
    }

    setDeleting(false);
    setDeleteConfirmOpen(false);
    setDeleteSessionId(null);
    if (editOpen) setEditOpen(false);
    load(); loadPending();
  };

  const copyConfirmationLink = async (s: Session) => {
    let token = s.confirmation_token;
    if (!token) {
      token = crypto.randomUUID();
      const { error } = await supabase.from("sessions").update({ confirmation_token: token }).eq("id", s.id);
      if (error) { toast.error("Erro ao gerar link"); return; }
    }
    const url = `${window.location.origin}/confirmar-sessao/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link de confirmação copiado!");
    load();
  };

  const sendWhatsAppReminder = (s: Session) => {
    const name = s.patient_name || "Paciente";
    const dateStr = format(new Date(s.scheduled_at), "dd/MM/yyyy");
    const value = s.price ? `R$ ${Number(s.price).toFixed(2)}` : "a combinar";
    const pixInfo = pixKey ? `\nChave Pix: ${pixKey}` : "";
    const message = `Olá ${name}, segue o lembrete para o acerto da nossa sessão de ${dateStr}. Valor: ${value}.${pixInfo}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  };

  const openEdit = async (s: Session) => {
    setEditSessionId(s.id);
    setEditProgressId(null);
    setEditForm({
      status: s.status, payment_status: s.payment_status,
      payment_method: (s as any).payment_method ?? "none",
      payment_reference: (s as any).payment_reference ?? "",
      price: s.price != null ? String(s.price) : "",
      notes: s.notes ?? "", duration_minutes: s.duration_minutes,
      mood_score: "", progress_note: "",
    });
    setEditOpen(true);
    if (s.patient_id && user) {
      const { data } = await supabase.from("patient_progress")
        .select("id, mood_score, note").eq("session_id", s.id).eq("user_id", user.id).maybeSingle();
      if (data) {
        setEditProgressId(data.id);
        setEditForm((prev) => ({
          ...prev,
          mood_score: data.mood_score != null ? String(data.mood_score) : "",
          progress_note: data.note ?? "",
        }));
      }
    }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editSessionId) return;
    setEditSaving(true);
    const session = sessions.find((s) => s.id === editSessionId);
    const { error } = await supabase.from("sessions").update({
      status: editForm.status, payment_status: editForm.payment_status,
      payment_method: editForm.payment_method === "none" ? null : editForm.payment_method,
      payment_reference: editForm.payment_reference.trim() || null,
      price: editForm.price ? Number(editForm.price) : null,
      notes: editForm.notes || null, duration_minutes: editForm.duration_minutes,
      ...(editForm.payment_status === "paid" && session?.payment_status !== "paid"
        ? { paid_at: new Date().toISOString() } : {}),
    }).eq("id", editSessionId);

    if (error) { setEditSaving(false); toast.error("Erro ao salvar sessão"); return; }

    // Always update mood/progress if patient exists (even when clearing values)
    const moodNum = editForm.mood_score ? Number(editForm.mood_score) : null;
    const progressNote = editForm.progress_note?.trim() || null;
    if (session?.patient_id) {
      if (editProgressId) {
        // Always update existing progress record (including clearing)
        await supabase.from("patient_progress").update({ mood_score: moodNum, note: progressNote }).eq("id", editProgressId);
      } else if (moodNum || progressNote) {
        // Only create new record if there's data
        await supabase.from("patient_progress").insert({
          user_id: user.id, patient_id: session.patient_id,
          session_id: editSessionId, mood_score: moodNum,
          note: progressNote, recorded_at: session.scheduled_at,
        });
      }
    }

    setEditSaving(false);
    toast.success("Sessão atualizada");
    setEditOpen(false);
    load(); loadPending();
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
        .select("id, scheduled_at, status, price, payment_status, payment_method, duration_minutes, notes")
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
  const sessionsByDay = (date: Date) => sessions.filter((s) => isSameDay(new Date(s.scheduled_at), date));

  const daysWithSessions = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => set.add(format(new Date(s.scheduled_at), "yyyy-MM-dd")));
    return set;
  }, [sessions]);

  const selectedDaySessions = useMemo(() => sessionsByDay(selectedDate), [sessions, selectedDate]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekSessions = useMemo(() => {
    const wEnd = addDays(weekStart, 7);
    return sessions.filter((s) => {
      const d = new Date(s.scheduled_at);
      return d >= weekStart && d < wEnd;
    });
  }, [sessions, weekStart]);

  const pendingTotal = pendingSessions.reduce((sum, s) => sum + Number(s.price ?? 0), 0);

  const sortedPending = useMemo(() => {
    let list = [...pendingSessions];
    if (filterPatientId !== "all") list = list.filter((s) => s.patient_id === filterPatientId);
    if (pendingSort === "patient") {
      list.sort((a, b) => (a.patient_name ?? "").localeCompare(b.patient_name ?? ""));
    }
    return list;
  }, [pendingSessions, pendingSort, filterPatientId]);

  // Unique patients in pending
  const pendingPatients = useMemo(() => {
    const map = new Map<string, string>();
    pendingSessions.forEach((s) => { if (s.patient_id && s.patient_name) map.set(s.patient_id, s.patient_name); });
    return Array.from(map.entries());
  }, [pendingSessions]);

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
      className="text-left font-display text-sm font-medium text-primary hover:underline hover:text-accent transition-colors truncate"
      onClick={(e) => { e.stopPropagation(); openPatientDrawer(patientId); }}
    >
      {name}
    </button>
  );

  // ── Session card component ──
  const SessionCard = ({ s, compact = false }: { s: Session; compact?: boolean }) => {
    const isSupervisionCard = s.session_type === "supervision";
    return (
      <div
        onClick={() => openEdit(s)}
        className={cn(
          "rounded-xl border p-3 group transition-colors cursor-pointer hover:ring-2 hover:ring-primary/20",
          isSupervisionCard ? "bg-serene/10 border-serene/40"
            : s.status === "confirmed" ? "bg-emerald-50 border-emerald-200"
              : "bg-background border-border"
        )}
      >
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {s.status === "confirmed" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
            {isSupervisionCard && <GraduationCap className="h-3.5 w-3.5 text-serene shrink-0" />}
            <p className="font-display text-sm text-primary">{format(new Date(s.scheduled_at), "HH:mm")}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>⋯</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /> Editar sessão</DropdownMenuItem>
              {!isSupervisionCard && (
                <DropdownMenuItem onClick={() => copyConfirmationLink(s)}><Link2 className="h-4 w-4" /> Enviar link de confirmação</DropdownMenuItem>
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
        </div>
        <div className="mt-1">
          {isSupervisionCard ? (
            <p className={cn("text-foreground", compact ? "text-xs truncate" : "text-sm font-medium")}>
              Supervisão
              {s.discussed_patient_name && <span className="text-muted-foreground"> · {s.discussed_patient_name}</span>}
            </p>
          ) : s.patient_id && s.patient_name ? (
            <PatientNameLink patientId={s.patient_id} name={s.patient_name} />
          ) : (
            <p className={cn("text-foreground", compact ? "text-xs truncate" : "text-sm font-medium")}>Paciente</p>
          )}
        </div>
        {!compact && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className={cn("inline-block text-[10px] px-2 py-0.5 rounded-full", isSupervisionCard ? "bg-serene/20 text-serene" : statusClass[s.status])}>
              {isSupervisionCard ? "Supervisão" : statusLabel[s.status]}
            </span>
            {!isSupervisionCard && s.price != null && (
              <span className={cn("inline-block text-[10px] px-2 py-0.5 rounded-full border", paymentStatusClass[s.payment_status])}>
                {paymentStatusLabel[s.payment_status]}
              </span>
            )}
            {s.price != null && (
              <span className="text-[10px] text-muted-foreground">R$ {Number(s.price).toFixed(2)}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-medium">Agenda</h1>
          <p className="mt-2 text-muted-foreground">Visualize e organize seus atendimentos.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="accent" onClick={() => openNew()}>
              <Plus className="h-4 w-4" /> Nova sessão
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Nova sessão</DialogTitle>
            </DialogHeader>
            {patients.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6">Cadastre um paciente ativo antes de agendar.</p>
            ) : (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de compromisso</Label>
                  <Select value={form.session_type} onValueChange={(v) => setForm({ ...form, session_type: v as SessionType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clinical">Atendimento Clínico</SelectItem>
                      <SelectItem value="supervision">Supervisão Técnica</SelectItem>
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
                <div className="grid grid-cols-2 gap-3">
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
                    <div className="grid grid-cols-2 gap-3">
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
                          <p className="text-xs text-muted-foreground">📅 {dates.join(", ")}</p>
                        </div>
                      );
                    })()}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="dur">Duração (min)</Label>
                    <Input id="dur" type="number" min="10" max="480" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Valor (R$)</Label>
                    <Input id="price" type="number" step="0.01" min="0" placeholder="Auto" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
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
                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea id="notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                {form.session_type === "clinical" && (
                  <div className="rounded-xl border border-dashed border-border p-3 space-y-3">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Humor / Progresso (opcional)</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="mood">Humor (1-10)</Label>
                        <Input id="mood" type="number" min="1" max="10" placeholder="—" value={form.mood_score} onChange={(e) => setForm({ ...form, mood_score: e.target.value })} />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="prog">Nota de progresso</Label>
                        <Input id="prog" maxLength={2000} placeholder="Ex.: melhora no sono" value={form.progress_note} onChange={(e) => setForm({ ...form, progress_note: e.target.value })} />
                      </div>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" variant="accent" disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />} Agendar
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </header>

      {/* ── Split layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        {/* ── LEFT: Calendar views ── */}
        <div className="space-y-4">
          <Tabs value={viewTab} onValueChange={setViewTab}>
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="month" className="flex-1 sm:flex-none">📅 Mês</TabsTrigger>
              <TabsTrigger value="week" className="flex-1 sm:flex-none">📋 Semana</TabsTrigger>
              <TabsTrigger value="day" className="flex-1 sm:flex-none">📌 Dia</TabsTrigger>
            </TabsList>

            {/* ── MONTH VIEW ── */}
            <TabsContent value="month">
              <div className="space-y-4">
                {/* Month header */}
                <div className="flex items-center justify-between rounded-2xl bg-card border border-border shadow-card p-4">
                  <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <p className="font-display text-lg font-semibold capitalize">
                    {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setCurrentMonth(startOfMonth(new Date())); setSelectedDate(new Date()); }}>
                      Hoje
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
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
                                "aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all text-sm",
                                isSelected ? "bg-accent text-accent-foreground ring-2 ring-accent/40 font-bold"
                                  : isToday ? "bg-primary/10 text-primary font-semibold"
                                    : "hover:bg-muted/50 text-foreground"
                              )}
                            >
                              {format(cell, "d")}
                              {hasSessions && (
                                <div className="flex gap-0.5 mt-0.5">
                                  <span className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    isSelected ? "bg-accent-foreground" : "bg-accent"
                                  )} />
                                  {dayCount > 1 && <span className={cn("text-[8px] leading-none", isSelected ? "text-accent-foreground" : "text-accent")}>{dayCount}</span>}
                                </div>
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
                        <Button variant="accent" size="sm" onClick={() => openNew(selectedDate)}>
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
                <div className="flex items-center justify-between rounded-2xl bg-card border border-border shadow-card p-4">
                  <Button variant="ghost" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, -1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-center">
                    <p className="font-display text-lg font-semibold capitalize">{format(weekStart, "MMMM yyyy", { locale: ptBR })}</p>
                    <p className="text-xs text-muted-foreground">{format(weekStart, "dd/MM")} — {format(addDays(weekStart, 6), "dd/MM")}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Hoje</Button>
                    <Button variant="ghost" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {loading ? (
                  <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                    {weekDays.map((day) => {
                      const items = sessionsByDay(day);
                      const isToday = isSameDay(day, new Date());
                      return (
                        <div key={day.toISOString()} className={cn("rounded-2xl border p-3 min-h-[180px] flex flex-col", isToday ? "bg-card border-primary/40" : "bg-card border-border")}>
                          <div className="flex items-baseline justify-between mb-3 px-1">
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{format(day, "EEE", { locale: ptBR })}</p>
                            <p className={cn("font-display text-xl", isToday ? "text-accent" : "text-foreground")}>{format(day, "dd")}</p>
                          </div>
                          <div className="space-y-2 flex-1">
                            {items.length === 0 ? (
                              <button onClick={() => openNew(day)} className="w-full text-xs text-muted-foreground/60 hover:text-accent border border-dashed border-border rounded-xl py-3 transition-colors">+ adicionar</button>
                            ) : (
                              items.map((s) => <SessionCard key={s.id} s={s} compact />)
                            )}
                          </div>
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
                <div className="flex items-center justify-between rounded-2xl bg-card border border-border shadow-card p-4">
                  <Button variant="ghost" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-center">
                    <p className="font-display text-lg font-semibold capitalize">{format(selectedDate, "EEEE", { locale: ptBR })}</p>
                    <p className="text-sm text-muted-foreground">{format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>Hoje</Button>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="accent" size="sm" onClick={() => openNew(selectedDate)}>
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

        {/* ── RIGHT: Pending Payments ── */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-card border border-border shadow-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-display font-semibold text-lg">Sessões Pendentes</h2>
                <p className="text-xs text-muted-foreground">
                  {pendingSessions.length} pendência{pendingSessions.length !== 1 ? "s" : ""} • Total: <span className="font-semibold text-accent">R$ {pendingTotal.toFixed(2)}</span>
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 mb-3">
              <Select value={filterPatientId} onValueChange={setFilterPatientId}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <Filter className="h-3 w-3 mr-1" /><SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os pacientes</SelectItem>
                  {pendingPatients.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                variant={pendingSort === "date" ? "secondary" : "ghost"}
                size="sm" className="h-8 text-xs shrink-0"
                onClick={() => setPendingSort(pendingSort === "date" ? "patient" : "date")}
              >
                <ArrowUpDown className="h-3 w-3 mr-1" />
                {pendingSort === "date" ? "Data" : "Paciente"}
              </Button>
            </div>

            {loadingPending ? (
              <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>
            ) : sortedPending.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhum pagamento pendente 🎉</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {sortedPending.map((s) => (
                  <div key={s.id} className="rounded-xl border border-border bg-background p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {s.patient_id && s.patient_name ? (
                          <PatientNameLink patientId={s.patient_id} name={s.patient_name} />
                        ) : (
                          <p className="font-display text-sm font-medium truncate">{s.patient_name}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{format(new Date(s.scheduled_at), "dd/MM/yyyy")}</p>
                      </div>
                      <p className="font-display font-bold text-accent whitespace-nowrap">R$ {Number(s.price ?? 0).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={s.payment_status} onValueChange={(v) => updatePaymentStatus(s.id, v as PaymentStatus)}>
                        <SelectTrigger className={cn("h-8 text-xs flex-1 border", paymentStatusClass[s.payment_status])}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending"><span className="text-accent font-medium">● Pendente</span></SelectItem>
                          <SelectItem value="paid"><span className="text-emerald-600 font-medium">● Pago</span></SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 shrink-0" title="Cobrar via WhatsApp" onClick={() => sendWhatsAppReminder(s)}>
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0" title="Excluir sessão" onClick={() => promptDelete(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Edit Session Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
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
                    <p className="text-xs text-muted-foreground mt-1">{format(new Date(session.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                  </div>
                )}
              </>
            );
          })()}
          <form onSubmit={handleEditSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Duração (min)</Label>
                <Input type="number" min="10" max="480" value={editForm.duration_minutes} onChange={(e) => setEditForm({ ...editForm, duration_minutes: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" min="0" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea rows={3} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
            {(() => {
              const session = sessions.find((s) => s.id === editSessionId);
              if (session?.session_type === "supervision") return null;
              return (
                <div className="rounded-xl border border-dashed border-border p-3 space-y-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Humor / Progresso</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Humor (1-10)</Label>
                      <Input type="number" min="1" max="10" placeholder="—" value={editForm.mood_score} onChange={(e) => setEditForm({ ...editForm, mood_score: e.target.value })} />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Nota de progresso</Label>
                      <Input maxLength={2000} placeholder="Ex.: melhora no sono" value={editForm.progress_note} onChange={(e) => setEditForm({ ...editForm, progress_note: e.target.value })} />
                    </div>
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
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button type="submit" variant="accent" disabled={editSaving}>
                {editSaving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Modal ── */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Excluir sessão</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Escolha o que deseja excluir:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3 text-left"
              disabled={deleting}
              onClick={() => executeDelete(false)}
            >
              <Trash2 className="h-4 w-4 text-destructive shrink-0" />
              <div>
                <p className="font-medium text-sm">Excluir apenas a sessão</p>
                <p className="text-xs text-muted-foreground">Remove a sessão, progresso e eventos vinculados</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3 text-left border-destructive/30 hover:bg-destructive/5"
              disabled={deleting}
              onClick={() => executeDelete(true)}
            >
              <DollarSign className="h-4 w-4 text-destructive shrink-0" />
              <div>
                <p className="font-medium text-sm text-destructive">Excluir sessão + lançamento financeiro</p>
                <p className="text-xs text-muted-foreground">Remove tudo acima + o registro financeiro vinculado</p>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Patient Drawer ── */}
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
                          <span className={cn("inline-block text-[10px] px-2 py-0.5 rounded-full", statusClass[s.status as Status])}>
                            {statusLabel[s.status as Status]}
                          </span>
                          {s.price != null && (
                            <p className="text-xs text-muted-foreground mt-1">R$ {Number(s.price).toFixed(2)}</p>
                          )}
                        </div>
                      </div>
                      {s.price != null && (
                        <div className="mt-1.5">
                          <span className={cn("inline-block text-[10px] px-2 py-0.5 rounded-full border", paymentStatusClass[s.payment_status as PaymentStatus])}>
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
                <div className="grid grid-cols-2 gap-3">
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
                        <span className={cn("inline-block text-[10px] px-2 py-0.5 rounded-full border mt-1", paymentStatusClass[s.payment_status as PaymentStatus])}>
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
    </div>
  );
};

export default Agenda;
