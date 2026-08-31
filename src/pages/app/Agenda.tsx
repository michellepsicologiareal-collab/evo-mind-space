import { RefreshButton } from "@/components/app/RefreshButton";
import { HelpCard } from "@/components/app/HelpCard";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus, ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon,
  Check, X, RotateCcw, Trash2, Link2, CheckCircle2, GraduationCap,
  MessageCircle, Pencil, Filter, Users, ArrowUpDown, User, DollarSign, FileText, Rows3,
  Video, MapPin, CalendarDays, CalendarRange, CalendarCheck, RefreshCw, ChevronDown, Bell,
  ClipboardList, HeartPulse, Target, AlertCircle, Wallet, NotebookPen, Save, Minimize2, Maximize2, Eye,
} from "lucide-react";
import { SessionReadView } from "@/components/app/SessionReadView";
import { HomeworkPlanForm, type HomeworkPlanFormTask } from "@/components/app/HomeworkPlanForm";
import { PatientSessionsQuickView } from "@/components/app/PatientSessionsQuickView";
import {
  PersonalEventDialog, PersonalEventCard, usePersonalEvents, eventsForDay,
  type PersonalEvent,
} from "@/components/app/PersonalEvents";

import { SessionPlanningForm, type SessionPlanningValue, planningValueFromDb } from "@/components/app/SessionPlanningForm";
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
import { TherapistActivation } from "@/components/app/TherapistActivation";
import { ClinicalV2Block, EMOTIONS_V2 } from "@/components/app/ClinicalV2Block";
import { useIsMobile } from "@/hooks/use-mobile";
import { preserveScroll, keepScroll } from "@/lib/preserveScroll";
import { PageIntro } from "@/components/app/PageIntro";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { normalizePhoneForWhatsApp } from "@/utils/phoneNormalize";
import { computeAgendaSummary } from "@/utils/agendaSummary";

// Retorno exato para a Agenda (data/visão/filtros atuais) ao fechar o Registro de Sessão.
const agendaReturnParam = () =>
  `&from=${encodeURIComponent(window.location.pathname + window.location.search)}`;


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
  homework_token?: string | null;
  clinic_address?: string | null;
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
    // v2 clinical fields
    wellbeing_score: z.string().optional(),
    wellbeing_source: z.enum(["", "patient_self_report", "professional_estimate"]).default(""),
    patient_context: z.string().max(4000).optional(),
    clinical_observation: z.string().max(4000).optional(),
    emotions: z.array(z.string()).default([]),
    attention_flag: z.enum(["not_assessed", "none", "watch", "urgent"]).default("not_assessed"),
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
  )
  .refine(
    (d) => !d.wellbeing_score || !!d.wellbeing_source,
    { path: ["wellbeing_source"], message: "Indique se é autorrelato do paciente ou estimativa profissional." }
  );

const statusLabel: Record<Status, string> = {
  scheduled: "Agendada", confirmed: "Confirmada", completed: "Realizada",
  no_show: "Falta", rescheduled: "Remarcada", cancelled: "Cancelada",
};
const statusClass: Record<Status, string> = {
  scheduled:   "bg-sky-50 text-sky-700 border-sky-200",
  confirmed:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed:   "bg-teal-50 text-teal-700 border-teal-200",
  no_show:     "bg-destructive/15 text-destructive border-destructive/30",
  rescheduled: "bg-amber-100 text-amber-800 border-amber-200",
  cancelled:   "bg-muted text-muted-foreground border-muted line-through",
};
const statusTextClass: Record<Status, string> = {
  scheduled:   "text-sky-700",
  confirmed:   "text-emerald-700",
  completed:   "text-teal-700",
  no_show:     "text-destructive",
  rescheduled: "text-amber-700",
  cancelled:   "text-muted-foreground line-through",
};
const statusIcon: Record<Status, typeof Check> = {
  scheduled:   CalendarDays,
  confirmed:   CheckCircle2,
  completed:   Check,
  no_show:     AlertCircle,
  rescheduled: RotateCcw,
  cancelled:   X,
};

const paymentStatusLabel: Record<PaymentStatus, string> = { pending: "Pendente", paid: "Pago" };
const paymentStatusClass: Record<PaymentStatus, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  paid:    "bg-green-100 text-green-800 border-green-200",
};
const paymentStatusIcon: Record<PaymentStatus, typeof Check> = {
  pending: Wallet,
  paid:    CheckCircle2,
};
const PILL_BASE = "inline-flex items-center text-[11px] font-display font-semibold px-2.5 py-0.5 rounded-[40px] border";
const PILL_COMPACT = "inline-flex items-center text-[10px] font-display font-semibold px-1.5 py-0.5 rounded-[40px] border whitespace-nowrap";
const ICON_TAG = "inline-flex items-center justify-center h-5 w-5 rounded-full shrink-0";

type ClinicalRecordPresence = {
  hasContent: boolean;
  summary: string;
  plan: string;
  updatedAt: number;
};

const trimmedText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const recordTime = (value: unknown) => {
  if (typeof value !== "string" || !value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

const latestRecordTime = (row: any) => Math.max(
  recordTime(row?.updated_at),
  recordTime(row?.created_at),
  recordTime(row?.recorded_at),
  recordTime(row?.session_date),
);

const sessionRecordPresence = (row: any): ClinicalRecordPresence => {
  const complaint = trimmedText(row?.chief_complaint);
  const plan = trimmedText(row?.next_session_plan);
  const observation = trimmedText(row?.clinical_observations);
  return {
    hasContent: Boolean(complaint || plan || observation),
    summary: observation || complaint,
    plan,
    updatedAt: latestRecordTime(row),
  };
};

const progressRecordPresence = (row: any): ClinicalRecordPresence => {
  const complaint = trimmedText(row?.patient_context);
  const observation = trimmedText(row?.clinical_observation);
  return {
    hasContent: Boolean(complaint || observation),
    summary: observation || complaint,
    plan: "",
    updatedAt: latestRecordTime(row),
  };
};

const setLatestPresence = (map: Map<string, ClinicalRecordPresence>, key: string, presence: ClinicalRecordPresence) => {
  const current = map.get(key);
  if (!current || presence.updatedAt >= current.updatedAt) map.set(key, presence);
};

const WEEKDAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const Agenda = () => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [sessions, setSessions] = useState<Session[]>([]);
  const navigate = useNavigate();
  const [planBySession, setPlanBySession] = useState<Map<string, string>>(new Map());
  const [homeworkSentBySession, setHomeworkSentBySession] = useState<Map<string, string>>(new Map());
  const [recordPlanBySession, setRecordPlanBySession] = useState<Map<string, string>>(new Map());
  const [progressPlanBySession, setProgressPlanBySession] = useState<Map<string, string>>(new Map());
  const [summaryBySession, setSummaryBySession] = useState<Map<string, string>>(new Map());
  const [sessionRecordIds, setSessionRecordIds] = useState<Set<string>>(new Set());
  // Chaves compostas "patient_id|yyyy-MM-dd" para registros salvos sem session_id
  const [sessionRecordKeys, setSessionRecordKeys] = useState<Set<string>>(new Set());
  const [moodTodayPatients, setMoodTodayPatients] = useState<Set<string>>(new Set());
  // Humor do paciente por sessão (preenchido no registro/progresso)
  type SessionMood = { score: number; source: string | null; recordedAt: string };
  const [moodBySession, setMoodBySession] = useState<Map<string, SessionMood>>(new Map());
  const [patients, setPatients] = useState<Patient[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  // Compromissos pessoais (não vinculados a pacientes)
  const { events: personalEvents, reload: reloadPersonalEvents } = usePersonalEvents(user?.id);
  const [personalEventOpen, setPersonalEventOpen] = useState(false);
  const [editingPersonalEvent, setEditingPersonalEvent] = useState<PersonalEvent | null>(null);
  const openPersonalEvent = (ev: PersonalEvent | null) => { setEditingPersonalEvent(ev); setPersonalEventOpen(true); };

  const [pixKey, setPixKey] = useState("");
  const [psiName, setPsiName] = useState("");
  const [psiCrp, setPsiCrp] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [presencialMessage, setPresencialMessage] = useState("");
  const [confirmPreview, setConfirmPreview] = useState<{
    sessionId: string;
    patientId: string | null;
    patientName: string;
    contentType: "meeting_link" | "clinic_address" | "none";
    contentValue: string;
    modality: "online" | "presencial";
    phone: string;
    message: string;
    original: string;
  } | null>(null);
  const [confirmHistory, setConfirmHistory] = useState<
    { id: string; modality: string; content_type: string; channel: string; created_at: string }[]
  >([]);
  const [viewTab, setViewTab] = useState<string>("day");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [patientFilter, setPatientFilter] = useState<string>("all");
  const [reminderFilter, setReminderFilter] = useState<boolean>(false);
  const [billingFilter, setBillingFilter] = useState<boolean>(false);
  const [searchParams] = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const skipDateMonthSyncRef = useRef(false);
  const skipWeekSyncRef = useRef(false);
  const skipUrlWriteRef = useRef(false);


  const goToMonth = useCallback((date: Date) => {
    const month = startOfMonth(date);
    skipDateMonthSyncRef.current = true;
    skipWeekSyncRef.current = true;
    setIsNavigating(true);
    setCurrentMonth(month);
    setSelectedDate(month);
    setWeekStart(startOfWeek(month, { weekStartsOn: 1 }));
  }, []);

  const goToDate = useCallback((date: Date) => {
    skipDateMonthSyncRef.current = true;
    skipWeekSyncRef.current = true;
    setIsNavigating(true);
    setSelectedDate(date);
    setCurrentMonth(startOfMonth(date));
    setWeekStart(startOfWeek(date, { weekStartsOn: 1 }));
  }, []);

  const goToWeek = useCallback((date: Date) => {
    const nextWeekStart = startOfWeek(date, { weekStartsOn: 1 });
    skipDateMonthSyncRef.current = true;
    skipWeekSyncRef.current = true;
    setIsNavigating(true);
    setWeekStart(nextWeekStart);
    setSelectedDate(nextWeekStart);
    setCurrentMonth(startOfMonth(addDays(nextWeekStart, 3)));
  }, []);

  const resetToToday = useCallback(() => {
    // Limpa o filtro salvo e os parâmetros de data na URL,
    // voltando imediatamente para o dia de hoje.
    try { localStorage.removeItem("psireal_agenda_date"); } catch { /* ignore */ }
    const params = new URLSearchParams(window.location.search);
    params.delete("month");
    params.delete("date");
    const qs = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash
    );
    skipUrlWriteRef.current = true;
    goToDate(new Date());
  }, [goToDate]);


  // Debounce: clear navigation lock after transitions settle
  useEffect(() => {
    if (!isNavigating) return;
    const t = setTimeout(() => setIsNavigating(false), 500);
    return () => clearTimeout(t);
  }, [isNavigating]);

  // Seed patient/month/date/view from URL ONCE on mount. Subsequent URL writes are one-way
  // (state → URL) to avoid ping-pong loops between effects that watch searchParams.
  // Fallback: quando a URL não traz data/mês, restaura o último filtro salvo em localStorage,
  // para o psicólogo não perder o contexto ao recarregar ou voltar à Agenda.
  const urlSeededRef = useRef(false);
  useEffect(() => {
    if (urlSeededRef.current) return;
    urlSeededRef.current = true;
    const qp = searchParams.get("patient");
    if (qp) setPatientFilter(qp);
    const v = searchParams.get("view");
    if (v === "day" || v === "week" || v === "month") setViewTab(v);
    const d = searchParams.get("date");
    if (d) {
      const parsedDate = parse(d, "yyyy-MM-dd", new Date());
      if (!isNaN(parsedDate.getTime())) {
        goToDate(parsedDate);
        return;
      }
    }
    const m = searchParams.get("month");
    if (m) {
      const parsed = parse(m, "yyyy-MM", new Date());
      if (!isNaN(parsed.getTime()) && !isSameMonth(parsed, currentMonth)) {
        goToMonth(parsed);
      }
      return;
    }
    // Sem parâmetros na URL → tenta localStorage
    try {
      const saved = localStorage.getItem("psireal_agenda_date");
      if (saved) {
        const parsedSaved = parse(saved, "yyyy-MM-dd", new Date());
        if (!isNaN(parsedSaved.getTime())) goToDate(parsedSaved);
      }
    } catch { /* localStorage indisponível */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep ?patient=, ?month=, ?date= e ?view= em sincronia com o estado (escrita one-way).
  // Uses window.history directly to avoid re-triggering useSearchParams subscribers
  // and to keep this effect free of `searchParams` in its dependency array.
  useEffect(() => {
    if (!urlSeededRef.current) return;
    if (skipUrlWriteRef.current) {
      skipUrlWriteRef.current = false;
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const monthStr = format(currentMonth, "yyyy-MM");
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    let changed = false;
    if ((params.get("patient") ?? "all") !== patientFilter) {
      if (patientFilter === "all") params.delete("patient");
      else params.set("patient", patientFilter);
      changed = true;
    }
    if (params.get("month") !== monthStr) {
      params.set("month", monthStr);
      changed = true;
    }
    if (params.get("date") !== dateStr) {
      params.set("date", dateStr);
      changed = true;
    }
    // Persiste a data selecionada para restaurar ao recarregar/voltar à Agenda
    try { localStorage.setItem("psireal_agenda_date", dateStr); } catch { /* ignore */ }
    if (params.get("view") !== viewTab) {
      params.set("view", viewTab);
      changed = true;
    }
    if (changed) {
      const qs = params.toString();
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash
      );
    }
  }, [patientFilter, currentMonth, selectedDate, viewTab]);


  // Pending
  const [pendingRecordsOpen, setPendingRecordsOpen] = useState(false);
  const [pendingPaymentsOpen, setPendingPaymentsOpen] = useState(false);
  // Modo compacto (mais atendimentos por tela)
  const [dense, setDense] = useState<boolean>(() => {
    try { return localStorage.getItem("psireal_agenda_dense") === "1"; } catch { return false; }
  });
  const toggleDense = () => setDense((v) => {
    const next = !v;
    try { localStorage.setItem("psireal_agenda_dense", next ? "1" : "0"); } catch { /* noop */ }
    return next;
  });
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
    payment_reference: "",
    // v2 clinical fields
    wellbeing_score: "" as string,
    wellbeing_source: "" as "" | "patient_self_report" | "professional_estimate",
    patient_context: "" as string,
    clinical_observation: "" as string,
    emotions: [] as string[],
    attention_flag: "not_assessed" as "not_assessed" | "none" | "watch" | "urgent",
    themes: [] as string[],
    engagement: null as number | null,
    private_notes: "" as string,
    recurrence: "single" as "single" | "recurring",
    recurrence_count: 4, recurrence_interval: "weekly" as "weekly" | "biweekly",
    payment_plan: "per_session" as "per_session" | "single_payment",
    payment_due_date: "" as string,
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
  const [editReadOpen, setEditReadOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const editGuard = useUnsavedGuard();
  const [editForm, setEditFormRaw] = useState({
    status: "scheduled" as Status,
    payment_status: "pending" as PaymentStatus,
    payment_method: "none" as "none" | "pix" | "card" | "cash",
    payment_reference: "", price: "", notes: "",
    duration_minutes: 50,
    // v2 clinical fields
    wellbeing_score: "" as string,
    wellbeing_source: "" as "" | "patient_self_report" | "professional_estimate",
    patient_context: "" as string,
    clinical_observation: "" as string,
    emotions: [] as string[],
    attention_flag: "not_assessed" as "not_assessed" | "none" | "watch" | "urgent",
    themes: [] as string[],
    engagement: null as number | null,
    private_notes: "" as string,
    // legacy read-only display
    legacy_mood: null as number | null,
    legacy_note: "" as string,
    data_model: "v2_structured" as "legacy_unclassified" | "v2_structured",
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
  const [loadingEditProgress, setLoadingEditProgress] = useState(false);

  // Homework plan (Plano entre Sessões) linked to the current edited session
  const [homeworkOpen, setHomeworkOpen] = useState(false);
  const [homeworkFullscreen, setHomeworkFullscreen] = useState(true);
  const [homeworkLoading, setHomeworkLoading] = useState(false);
  const [homeworkTask, setHomeworkTask] = useState<HomeworkPlanFormTask | null>(null);
  const [homeworkExists, setHomeworkExists] = useState(false);

  // Preload homework task + planning state whenever the edit dialog opens.
  // This powers the INLINE HomeworkPlanForm and SessionPlanningForm inside the modal.
  useEffect(() => {
    let cancelled = false;
    if (!editOpen || !editSessionId) {
      setHomeworkExists(false);
      setHomeworkTask(null);
      setHomeworkPatientId(null);
      setHomeworkSessionId(null);
      setPlanningPatientId(null);
      setPlanningTargetSessionId(null);
      setPlanningExistingPlanId(null);
      setPlanningPlanGoals([]);
      setPlanningPlanTechniques([]);
      setPlanningValue({ next_scheduled_at: "", next_objetivo: "", next_retomar: "", next_meta_id: null, next_tecnicas: [], next_observacoes: "" });
      return;
    }
    const session = sessions.find((s) => s.id === editSessionId);
    if (!session?.patient_id) { setHomeworkExists(false); return; }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const pid = session.patient_id!;
      // Homework linked to THIS session
      const { data: hw } = await supabase
        .from("homework_tasks")
        .select("*")
        .eq("user_id", user.id)
        .eq("patient_id", pid)
        .eq("session_id", session.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setHomeworkTask((hw as HomeworkPlanFormTask) ?? null);
      setHomeworkExists(Boolean(hw));
      setHomeworkPatientId(pid);
      setHomeworkSessionId(session.id);

      // Planning for the patient's NEXT future session (excluding the current one)
      const nowIso = new Date().toISOString();
      const { data: nextSess } = await supabase
        .from("sessions")
        .select("id, scheduled_at")
        .eq("user_id", user.id)
        .eq("patient_id", pid)
        .neq("id", session.id)
        .gte("scheduled_at", nowIso)
        .not("status", "in", "(cancelled,no_show)")
        .order("scheduled_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      const targetSessionId = nextSess?.id ?? null;
      const [goalsRes, techsRes, planRes] = await Promise.all([
        supabase.from("treatment_goals").select("id, descricao").eq("patient_id", pid).eq("user_id", user.id).order("ordem"),
        supabase.from("treatment_techniques").select("id, nome").eq("patient_id", pid).eq("user_id", user.id).order("created_at"),
        targetSessionId
          ? supabase.from("session_plans").select("*").eq("session_id", targetSessionId).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      if (cancelled) return;
      setPlanningPatientId(pid);
      setPlanningTargetSessionId(targetSessionId);
      setPlanningExistingPlanId((planRes as any)?.data?.id ?? null);
      setPlanningPlanGoals((goalsRes.data || []) as any);
      setPlanningPlanTechniques((techsRes.data || []) as any);
      const existing = (planRes as any)?.data;
      setPlanningValue(planningValueFromDb({
        scheduled_at: nextSess?.scheduled_at ?? null,
        objetivo: existing?.objetivo ?? "",
        retomar: existing?.retomar ?? "",
        meta_id: existing?.meta_id ?? null,
        tecnicas: existing?.tecnicas ?? [],
        observacoes: existing?.observacoes ?? "",
      }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOpen, editSessionId]);

  const openHomeworkForSession = async (overrideSession?: Session) => {
    const session = overrideSession ?? sessions.find((s) => s.id === editSessionId);
    if (!session?.id || !session.patient_id) {
      toast.error("Selecione uma sessão com paciente para criar o plano.");
      return;
    }
    setHomeworkLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setHomeworkLoading(false); return; }
    const { data, error } = await supabase
      .from("homework_tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("patient_id", session.patient_id)
      .eq("session_id", session.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setHomeworkLoading(false);
    if (error) { toast.error("Erro ao carregar plano existente"); return; }
    setHomeworkTask((data as HomeworkPlanFormTask) ?? null);
    setHomeworkPatientId(session.patient_id);
    setHomeworkSessionId(session.id);
    setHomeworkOpen(true);
  };

  // Homework opener state (for card-triggered flows independent of edit modal)
  const [homeworkPatientId, setHomeworkPatientId] = useState<string | null>(null);
  const [homeworkSessionId, setHomeworkSessionId] = useState<string | null>(null);

  // ── Planejar próxima sessão — Sheet reutilizando SessionPlanningForm ──
  const [planningOpen, setPlanningOpen] = useState(false);
  const [planningSaving, setPlanningSaving] = useState(false);
  const [planningPatientId, setPlanningPatientId] = useState<string | null>(null);
  const [planningTargetSessionId, setPlanningTargetSessionId] = useState<string | null>(null);
  const [planningExistingPlanId, setPlanningExistingPlanId] = useState<string | null>(null);
  const [planningSavedAt, setPlanningSavedAt] = useState<Date | null>(null);
  const [planningPlanGoals, setPlanningPlanGoals] = useState<{ id: string; descricao: string }[]>([]);
  const [planningPlanTechniques, setPlanningPlanTechniques] = useState<{ id: string; nome: string }[]>([]);
  const [planningValue, setPlanningValue] = useState<SessionPlanningValue>({
    next_scheduled_at: "", next_objetivo: "", next_retomar: "", next_meta_id: null, next_tecnicas: [], next_observacoes: "",
  });

  const openPlanningForSession = async (session: Session) => {
    if (!session.patient_id) { toast.error("Sessão sem paciente vinculado"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const pid = session.patient_id;
    // Descobrir a próxima sessão FUTURA do paciente (ou usa a própria se ainda for futura)
    const nowIso = new Date().toISOString();
    const { data: nextSess } = await supabase
      .from("sessions")
      .select("id, scheduled_at")
      .eq("user_id", user.id)
      .eq("patient_id", pid)
      .gte("scheduled_at", nowIso)
      .not("status", "in", "(cancelled,no_show)")
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const targetSessionId = nextSess?.id ?? null;
    // Buscar plan goals/tecnicas + session_plan existente
    const [goalsRes, techsRes, planRes] = await Promise.all([
      supabase.from("treatment_goals").select("id, descricao").eq("patient_id", pid).eq("user_id", user.id).order("ordem"),
      supabase.from("treatment_techniques").select("id, nome").eq("patient_id", pid).eq("user_id", user.id).order("created_at"),
      targetSessionId
        ? supabase.from("session_plans").select("*").eq("session_id", targetSessionId).maybeSingle()
        // Sem próxima sessão agendada: recupera o último planejamento solto do paciente
        : supabase
            .from("session_plans")
            .select("*")
            .eq("user_id", user.id)
            .eq("patient_id", pid)
            .is("session_id", null)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
    ]);
    setPlanningPatientId(pid);
    setPlanningTargetSessionId(targetSessionId);
    setPlanningExistingPlanId((planRes as any)?.data?.id ?? null);
    setPlanningPlanGoals((goalsRes.data || []) as any);
    setPlanningPlanTechniques((techsRes.data || []) as any);
    const existing = (planRes as any)?.data;
    setPlanningValue(planningValueFromDb({
      scheduled_at: nextSess?.scheduled_at ?? null,
      objetivo: existing?.objetivo ?? "",
      retomar: existing?.retomar ?? "",
      meta_id: existing?.meta_id ?? null,
      tecnicas: existing?.tecnicas ?? [],
      observacoes: existing?.observacoes ?? "",
    }));

    setPlanningOpen(true);
  };

  const savePlanningFromSheet = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!planningPatientId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setPlanningSaving(true);
    try {
      let targetSessionId = planningTargetSessionId;
      // Só cria/atualiza agendamento no salvamento explícito (nunca no autosave),
      // evitando criar um evento novo a cada digitação.
      if (planningValue.next_scheduled_at && !silent) {
        const iso = new Date(planningValue.next_scheduled_at).toISOString();
        if (targetSessionId) {
          await supabase.from("sessions").update({ scheduled_at: iso, status: "scheduled" })
            .eq("id", targetSessionId).eq("user_id", user.id);
        } else {
          const { data: created } = await supabase.from("sessions").insert({
            user_id: user.id, patient_id: planningPatientId, scheduled_at: iso,
            duration_minutes: 50, modality: "presencial", status: "scheduled", session_type: "clinical",
          }).select("id").single();
          if (created?.id) {
            targetSessionId = created.id;
            setPlanningTargetSessionId(created.id);
          }
        }
      }
      const payload = {
        user_id: user.id,
        patient_id: planningPatientId,
        session_id: targetSessionId,
        objetivo: planningValue.next_objetivo,
        retomar: planningValue.next_retomar,
        tecnicas: planningValue.next_tecnicas,
        observacoes: planningValue.next_observacoes,
        meta_id: planningValue.next_meta_id,
      };
      let planId = planningExistingPlanId;
      if (!planId) {
        // Reaproveita um planejamento já existente (com ou sem sessão vinculada)
        const q = supabase.from("session_plans").select("id").eq("user_id", user.id).eq("patient_id", planningPatientId);
        const { data: found } = targetSessionId
          ? await q.eq("session_id", targetSessionId).maybeSingle()
          : await q.is("session_id", null).order("updated_at", { ascending: false }).limit(1).maybeSingle();
        planId = found?.id ?? null;
      }
      if (planId) {
        const { error } = await supabase.from("session_plans").update(payload).eq("id", planId);
        if (error) throw error;
        setPlanningExistingPlanId(planId);
      } else {
        const { data: inserted, error } = await supabase.from("session_plans").insert(payload).select("id").single();
        if (error) throw error;
        if (inserted?.id) setPlanningExistingPlanId(inserted.id);
      }
      setPlanningSavedAt(new Date());
      if (!silent) {
        toast.success("Planejamento salvo");
        setPlanningOpen(false);
      }
    } catch (e) {
      console.error(e);
      if (!silent) toast.error("Erro ao salvar planejamento");
    } finally {
      setPlanningSaving(false);
    }
  };


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
    supabase.from("profiles").select("pix_key, full_name, crp, clinic_name, clinic_address, presencial_message").eq("id", user.id).single().then(({ data }) => {
      setPixKey(data?.pix_key || "");
      setPsiName(data?.full_name || "");
      setPsiCrp(data?.crp || "");
      setClinicName((data as any)?.clinic_name || "");
      setPresencialMessage((data as any)?.presencial_message || "");
      const addr = (data as any)?.clinic_address || "";
      if (addr) setClinicAddress(addr);
      else {
        supabase.from("contract_templates").select("professional_address").eq("user_id", user.id).limit(1).maybeSingle().then(({ data: ct }) => {
          setClinicAddress((ct as any)?.professional_address || "");
        });
      }
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
      supabase.from("patients").select("id, full_name, session_price, phone, has_financial_responsible, financial_responsible_name, financial_responsible_phone, homework_token, clinic_address").eq("user_id", user.id).eq("is_active", true).order("full_name"),
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

  // Enriquece a agenda com dados existentes: registros feitos, combinado da sessão anterior e humor de hoje.
  useEffect(() => {
    if (!user) return;
    const now = new Date();
    const from = new Date(now); from.setDate(from.getDate() - 90);
    const to = new Date(now); to.setDate(to.getDate() + 45);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    (async () => {
      const sessionIds = sessions.map((s) => s.id).filter(Boolean);
      const [recs, moods, homework, progressPlans] = await Promise.all([
        supabase.from("session_records")
          .select("session_id, patient_id, session_date, next_session_plan, clinical_observations, chief_complaint, updated_at, created_at")
          .eq("user_id", user.id)
          .gte("session_date", from.toISOString().slice(0, 10))
          .lte("session_date", to.toISOString().slice(0, 10))
          .order("session_date", { ascending: false }),
        supabase.from("patient_progress")
          .select("patient_id, recorded_at")
          .eq("user_id", user.id)
          .gte("recorded_at", todayStart.toISOString())
          .lte("recorded_at", todayEnd.toISOString()),
        sessionIds.length
          ? supabase.from("homework_tasks")
              .select("session_id, weekly_goal, actions, sent_at")
              .eq("user_id", user.id)
              .in("session_id", sessionIds)
          : Promise.resolve({ data: [] as any[] }),
        sessionIds.length
          ? supabase.from("patient_progress")
              .select("session_id, clinical_observation, patient_context, wellbeing_score, mood_score, wellbeing_source, recorded_at, updated_at, created_at")
              .eq("user_id", user.id)
              .in("session_id", sessionIds)
              .order("recorded_at", { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const recPlan = new Map<string, string>();
      const recIds = new Set<string>();
      const recKeys = new Set<string>();
      const summary = new Map<string, string>();
      const latestSessionRecords = new Map<string, ClinicalRecordPresence>();
      const latestSessionRecordKeys = new Map<string, ClinicalRecordPresence>();
      const latestProgressRecords = new Map<string, ClinicalRecordPresence>();
      (recs.data ?? []).forEach((r: any) => {
        const presence = sessionRecordPresence(r);
        if (r.session_id) setLatestPresence(latestSessionRecords, r.session_id, presence);
        if (r.patient_id && r.session_date) setLatestPresence(latestSessionRecordKeys, `${r.patient_id}|${r.session_date}`, presence);
      });
      const hwPlan = new Map<string, string>();
      const hwSent = new Map<string, string>();
      (homework.data ?? []).forEach((h: any) => {
        if (!h.session_id) return;
        if (h.sent_at && !hwSent.has(h.session_id)) hwSent.set(h.session_id, h.sent_at);
        const goal = typeof h.weekly_goal === "string" ? h.weekly_goal.trim() : "";
        if (goal) { if (!hwPlan.has(h.session_id)) hwPlan.set(h.session_id, goal); return; }
        const acts = Array.isArray(h.actions) ? h.actions : [];
        for (const a of acts) {
          const t = (a && (a.text ?? a.description ?? a.title ?? "")).toString().trim();
          if (t) { if (!hwPlan.has(h.session_id)) hwPlan.set(h.session_id, t); break; }
        }
      });
      const progPlan = new Map<string, string>();
      const moodMap = new Map<string, SessionMood>();
      (progressPlans.data ?? []).forEach((p: any) => {
        if (!p.session_id) return;
        setLatestPresence(latestProgressRecords, p.session_id, progressRecordPresence(p));
        const raw = p.wellbeing_score != null
          ? Number(p.wellbeing_score)
          : (p.mood_score != null ? Number(p.mood_score) * 2 : null);
        if (raw != null && !Number.isNaN(raw) && !moodMap.has(p.session_id)) {
          moodMap.set(p.session_id, {
            score: raw,
            source: p.wellbeing_score != null ? (p.wellbeing_source ?? null) : "legacy",
            recordedAt: p.recorded_at,
          });
        }
      });
      setMoodBySession(moodMap);
      latestSessionRecords.forEach((presence, sessionId) => {
        if (!presence.hasContent) return;
        recIds.add(sessionId);
        if (presence.plan) recPlan.set(sessionId, presence.plan);
        if (presence.summary) summary.set(sessionId, presence.summary);
      });
      latestProgressRecords.forEach((presence, sessionId) => {
        if (!presence.hasContent) return;
        recIds.add(sessionId);
        if (presence.summary && !summary.has(sessionId)) summary.set(sessionId, presence.summary);
      });
      latestSessionRecordKeys.forEach((presence, key) => {
        if (presence.hasContent) recKeys.add(key);
      });
      setPlanBySession(hwPlan);
      setHomeworkSentBySession(hwSent);
      setRecordPlanBySession(recPlan);
      setProgressPlanBySession(progPlan);
      setSummaryBySession(summary);
      setSessionRecordIds(recIds);
      setSessionRecordKeys(recKeys);


      setMoodTodayPatients(new Set((moods.data ?? []).map((m: any) => m.patient_id)));
    })();
  }, [user, sessions, currentMonth]);

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
        payment_due_date: isRecurring
          ? (form.payment_due_date || format(scheduledAt, "yyyy-MM-dd"))
          : format(scheduledAt, "yyyy-MM-dd"),
      } as any);
    }

    const { data: created, error } = await supabase.from("sessions").insert(sessionsToInsert).select("id");
    if (error) { setSaving(false); toast.error("Erro ao agendar sessão"); return; }
    if (gcalConnected && created) {
      Promise.all(created.map((row: any) => syncSessionToGcal(row.id))).catch(() => {});
    }
    // O Plano entre Sessões NÃO é copiado: cada nova sessão começa em branco.



    // v2 clinical registration — only when patient session and something was filled
    const wbScore = parsed.data.wellbeing_score ? Number(parsed.data.wellbeing_score) : null;
    const wbValid = wbScore != null && wbScore >= 0 && wbScore <= 10 && !!parsed.data.wellbeing_source;
    const pCtx = parsed.data.patient_context?.trim() || null;
    const cObs = parsed.data.clinical_observation?.trim() || null;
    const emos = parsed.data.emotions ?? [];
    const attFlag = parsed.data.attention_flag ?? "not_assessed";
    const hasV2Content = wbValid || pCtx || cObs || emos.length > 0 || attFlag !== "not_assessed";
    if (!isSupervision && parsed.data.patient_id && hasV2Content) {
      const emotionsPayload = emos.length > 0
        ? emos.map((label) => ({ label, source: "clinician" }))
        : null;
      const attentionAssigned = attFlag !== "not_assessed";
      await supabase.from("patient_progress").insert({
        user_id: user.id,
        patient_id: parsed.data.patient_id,
        session_id: created?.[0]?.id ?? null,
        recorded_at: baseDate.toISOString(),
        wellbeing_score: wbValid ? wbScore : null,
        wellbeing_source: wbValid ? parsed.data.wellbeing_source : null,
        patient_context: pCtx,
        clinical_observation: cObs,
        emotions: emotionsPayload,
        attention_flag: attFlag,
        attention_set_by: attentionAssigned ? user.id : null,
        attention_set_at: attentionAssigned ? new Date().toISOString() : null,
        data_model: "v2_structured",
      } as any);
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

  // Exclui a sessão atual + todas as outras do MESMO pacote (passadas e futuras).
  // Usa groupId quando disponível; cai para "chunking" por data nos pacotes legados.
  const executeDeleteSeries = async (includeFinancial: boolean) => {
    if (!deleteSessionId || !user) return;
    const current = sessions.find((s) => s.id === deleteSessionId)
      || pendingSessions.find((s) => s.id === deleteSessionId)
      || pendingPackageSessions.find((s) => s.id === deleteSessionId);
    if (!current || !current.patient_id) return;
    const pkgInfo = getPackageInfo(current.notes);
    if (!pkgInfo) return;

    setDeleting(true);
    const { data: siblings } = await supabase.from("sessions")
      .select("id, notes, scheduled_at")
      .eq("user_id", user.id)
      .eq("patient_id", current.patient_id)
      .order("scheduled_at", { ascending: true });

    const currentGroupId = getGroupId(current.notes);
    let ids: string[] = [];

    if (currentGroupId) {
      // Novo formato: usa o groupId para isolar APENAS este pacote
      ids = (siblings ?? [])
        .filter((s: any) => getGroupId(s.notes) === currentGroupId)
        .map((s: any) => s.id);
    } else {
      // Legado: agrupa por total + sem groupId, dividindo em "chunks" de tamanho `total`
      const legacy = (siblings ?? []).filter((s: any) => {
        const info = getPackageInfo(s.notes);
        return info?.total === pkgInfo.total && !getGroupId(s.notes);
      });
      const idx = legacy.findIndex((s: any) => s.id === deleteSessionId);
      if (idx >= 0) {
        const chunkStart = Math.floor(idx / pkgInfo.total) * pkgInfo.total;
        ids = legacy.slice(chunkStart, chunkStart + pkgInfo.total).map((s: any) => s.id);
      }
    }

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


  // Abre o modo de revisão da mensagem antes do envio
  const copyConfirmationLink = async (s: Session) => {
    let token = s.confirmation_token;
    if (!token) {
      token = crypto.randomUUID();
      const { error } = await supabase.from("sessions").update({ confirmation_token: token }).eq("id", s.id);
      if (error) { toast.error("Erro ao gerar link"); return; }
    }
    const url = `${window.location.origin}/confirmar-sessao/${token}`;
    const isOnline = ((s as any).modality || "").toLowerCase() === "online";
    const patient = patients.find((p) => p.id === s.patient_id);
    let extra = "";
    let contentType: "meeting_link" | "clinic_address" | "none" = "none";
    let contentValue = "";
    if (isOnline) {
      const link = (s as any).meeting_link?.trim();
      extra = link
        ? `\n\n💻 Sessão online. Link da chamada:\n${link}`
        : "\n\n💻 Sessão online. O link da chamada será enviado em breve.";
      if (link) { contentType = "meeting_link"; contentValue = link; }
    } else {
      // Endereço específico do paciente tem prioridade sobre o endereço padrão da clínica
      const patientAddress = (patient?.clinic_address || "").trim();
      const local = patientAddress || [clinicName, clinicAddress].filter(Boolean).join(" — ");
      const note = presencialMessage.trim();
      extra = local
        ? `\n\n📍 Sessão presencial. Endereço:\n${local}`
        : "\n\n📍 Sessão presencial.";
      if (note) extra += `\n\n${note}`;
      if (local) { contentType = "clinic_address"; contentValue = local; }
    }
    const message = `Olá, por favor, entre para confirmar sua sessão de terapia🤎\n\n${url}${extra}`;

    let phoneNumber = "";
    if (patient?.has_financial_responsible && patient.financial_responsible_phone) {
      phoneNumber = normalizePhoneForWhatsApp(patient.financial_responsible_phone) ?? "";
    } else if (patient?.phone) {
      phoneNumber = normalizePhoneForWhatsApp(patient.phone) ?? "";
    }


    setConfirmPreview({
      sessionId: s.id,
      patientId: s.patient_id || null,
      patientName: patient?.full_name || "Paciente",
      modality: isOnline ? "online" : "presencial",
      contentType,
      contentValue,
      phone: phoneNumber,
      message,
      original: message,
    });

    // Histórico de envios anteriores deste paciente
    setConfirmHistory([]);
    if (s.patient_id) {
      const { data } = await supabase
        .from("session_confirmation_events")
        .select("id, modality, content_type, channel, created_at")
        .eq("patient_id", s.patient_id)
        .order("created_at", { ascending: false })
        .limit(5);
      setConfirmHistory(data || []);
    }
  };

  const markConfirmationSent = async (sessionId: string) => {
    await supabase.from("sessions").update({ confirmation_sent_at: new Date().toISOString() }).eq("id", sessionId);
    load(true);
  };

  // Registra no histórico do paciente o que foi enviado
  const logConfirmationEvent = async (channel: "whatsapp" | "clipboard") => {
    if (!confirmPreview) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await supabase.from("session_confirmation_events").insert({
      user_id: auth.user.id,
      patient_id: confirmPreview.patientId,
      session_id: confirmPreview.sessionId,
      modality: confirmPreview.modality,
      content_type: confirmPreview.contentType,
      content: confirmPreview.contentValue || null,
      channel,
    });
  };

  const sendConfirmationPreview = async () => {
    if (!confirmPreview) return;
    const { message, phone, sessionId } = confirmPreview;
    if (!message.trim()) { toast.error("A mensagem está vazia"); return; }
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
      toast.success("Lembrete enviado pelo WhatsApp ✨");
    } else {
      await navigator.clipboard.writeText(message);
      toast.success("Lembrete copiado (paciente sem telefone cadastrado)");
    }
    await logConfirmationEvent(phone ? "whatsapp" : "clipboard");
    setConfirmPreview(null);
    await markConfirmationSent(sessionId);
  };

  const copyConfirmationPreview = async () => {
    if (!confirmPreview) return;
    const sessionId = confirmPreview.sessionId;
    await navigator.clipboard.writeText(confirmPreview.message);
    toast.success("Mensagem copiada");
    await logConfirmationEvent("clipboard");
    setConfirmPreview(null);
    await markConfirmationSent(sessionId);
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
      phoneNumber = normalizePhoneForWhatsApp(patient.financial_responsible_phone) ?? "";
    } else if (patient?.phone) {
      phoneNumber = normalizePhoneForWhatsApp(patient.phone) ?? "";
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
      wellbeing_score: "",
      wellbeing_source: "",
      patient_context: "",
      clinical_observation: "",
      emotions: [],
      attention_flag: "not_assessed",
      themes: [],
      engagement: null,
      private_notes: "",
      legacy_mood: null,
      legacy_note: "",
      data_model: "v2_structured",
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
      setLoadingEditProgress(true);
      try {
        const { data } = await (supabase as any).from("patient_progress")
          .select("id, mood_score, note, wellbeing_score, wellbeing_source, patient_context, clinical_observation, emotions, attention_flag, data_model, themes, engagement, private_notes")
          .eq("session_id", s.id).eq("user_id", user.id).maybeSingle();
        if (data) {
          setEditProgressId(data.id);
          const emoList: string[] = Array.isArray(data.emotions)
            ? data.emotions.map((e: any) => (typeof e === "string" ? e : e?.label)).filter(Boolean)
            : [];
          setEditFormRaw((prev) => ({
            ...prev,
            wellbeing_score: data.wellbeing_score != null ? String(data.wellbeing_score) : "",
            wellbeing_source: (data.wellbeing_source ?? "") as any,
            patient_context: data.patient_context ?? "",
            clinical_observation: data.clinical_observation ?? "",
            emotions: emoList,
            attention_flag: (data.attention_flag ?? "not_assessed") as any,
            themes: Array.isArray(data.themes) ? data.themes.filter((t: any) => typeof t === "string") : [],
            engagement: typeof data.engagement === "number" ? data.engagement : null,
            private_notes: data.private_notes ?? "",
            legacy_mood: data.mood_score,
            legacy_note: data.note ?? "",
            data_model: (data.data_model ?? "legacy_unclassified") as any,
          }));
        }
      } finally {
        setLoadingEditProgress(false);
      }
    }
  };

  // Abrir automaticamente a ficha de edição (?edit=<sessionId>) ou nova sessão (?novo=1)
  const autoOpenRef = useRef(false);
  useEffect(() => {
    if (autoOpenRef.current) return;
    const editId = searchParams.get("edit");
    const novo = searchParams.get("novo");
    if (editId) {
      const s = sessions.find((x) => x.id === editId);
      if (!s) return;
      autoOpenRef.current = true;
      goToDate(new Date(s.scheduled_at));
      void openEdit(s);
    } else if (novo === "1") {
      autoOpenRef.current = true;
      openNew();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, searchParams]);

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

    // v2 clinical record update — write only the new model
    if (session?.patient_id) {
      const wbNum = editForm.wellbeing_score ? Number(editForm.wellbeing_score) : null;
      const wbValid = wbNum != null && wbNum >= 0 && wbNum <= 10 && !!editForm.wellbeing_source;
      const pCtx = editForm.patient_context?.trim() || null;
      const cObs = editForm.clinical_observation?.trim() || null;
      const emos = editForm.emotions ?? [];
      const attFlag = editForm.attention_flag ?? "not_assessed";
      const emotionsPayload = emos.length > 0
        ? emos.map((label) => ({ label, source: "clinician" }))
        : null;
      const attentionAssigned = attFlag !== "not_assessed";
      const themesPayload = Array.isArray(editForm.themes) ? editForm.themes.filter((t) => typeof t === "string" && t.trim().length > 0) : [];
      const engagementPayload = typeof editForm.engagement === "number" ? editForm.engagement : null;
      const privateNotesPayload = editForm.private_notes?.trim() || null;
      const payload: any = {
        wellbeing_score: wbValid ? wbNum : null,
        wellbeing_source: wbValid ? editForm.wellbeing_source : null,
        patient_context: pCtx,
        clinical_observation: cObs,
        emotions: emotionsPayload,
        attention_flag: attFlag,
        attention_set_by: attentionAssigned ? user.id : null,
        attention_set_at: attentionAssigned ? new Date().toISOString() : null,
        data_model: "v2_structured",
        themes: themesPayload,
        engagement: engagementPayload,
        private_notes: privateNotesPayload,
      };
      const hasV2Content = wbValid || pCtx || cObs || emos.length > 0 || attentionAssigned || themesPayload.length > 0 || engagementPayload != null || !!privateNotesPayload;
      if (editProgressId) {
        await (supabase as any).from("patient_progress").update(payload).eq("id", editProgressId);
      } else if (hasV2Content) {
        await (supabase as any).from("patient_progress").insert({
          ...payload,
          user_id: user.id,
          patient_id: session.patient_id,
          session_id: editSessionId,
          recorded_at: session.scheduled_at,
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
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return sessions.filter((s) => {
      if (serviceFilter !== "all" && s.service_id !== serviceFilter) return false;
      if (patientFilter !== "all" && s.patient_id !== patientFilter) return false;
      if (reminderFilter && !s.confirmation_sent_at) return false;
      if (billingFilter && !s.billing_sent_at) return false;
      const d = new Date(s.scheduled_at);
      if (d < monthStart || d > monthEnd) return false;
      return true;
    });
  }, [sessions, serviceFilter, patientFilter, reminderFilter, billingFilter, currentMonth]);

  const selectedPatientName = useMemo(() => {
    if (patientFilter === "all") return null;
    return patients.find((p) => p.id === patientFilter)?.full_name || null;
  }, [patients, patientFilter]);

  const sessionsByDay = (date: Date) => filteredSessions.filter((s) => isSameDay(new Date(s.scheduled_at), date));

  const daysWithSessions = useMemo(() => {
    const set = new Set<string>();
    filteredSessions.forEach((s) => set.add(format(new Date(s.scheduled_at), "yyyy-MM-dd")));
    return set;
  }, [filteredSessions]);

  const selectedDaySessions = useMemo(() => sessionsByDay(selectedDate), [filteredSessions, selectedDate]);

  /**
   * Linha do tempo do dia: sessões e compromissos pessoais juntos,
   * ordenados pelo horário real (itens "dia todo" primeiro).
   */
  const dayTimeline = (date: Date) => {
    const sess = sessionsByDay(date).map((s) => ({
      kind: "session" as const,
      at: new Date(s.scheduled_at).getTime(),
      allDay: false,
      session: s,
      event: null as PersonalEvent | null,
    }));
    const evs = eventsForDay(personalEvents, date).map((e) => ({
      kind: "event" as const,
      at: new Date(e.starts_at).getTime(),
      allDay: e.all_day,
      session: null as (typeof sess)[number]["session"] | null,
      event: e,
    }));
    return [...sess, ...evs].sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.at - b.at;
    });
  };

  // All filtered sessions in current visible month, sorted by date (used when a patient filter is active)
  const monthFilteredSessions = useMemo(
    () => [...filteredSessions].sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    ),
    [filteredSessions]
  );

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
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  // Keep currentMonth in sync when selectedDate crosses month boundary
  useEffect(() => {
    if (skipDateMonthSyncRef.current) {
      skipDateMonthSyncRef.current = false;
      return;
    }
    const m = startOfMonth(selectedDate);
    if (!isSameMonth(m, currentMonth)) {
      setCurrentMonth(m);
    }
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep currentMonth in sync when weekStart crosses month boundary.
  // Skipped when weekStart was updated programmatically by the month/year selector,
  // because the week of day 1 often starts in the previous month and would
  // cause an infinite loop reverting currentMonth.
  useEffect(() => {
    if (skipWeekSyncRef.current) {
      skipWeekSyncRef.current = false;
      return;
    }
    const m = startOfMonth(addDays(weekStart, 3));
    if (!isSameMonth(m, currentMonth)) {
      setCurrentMonth(m);
    }
  }, [weekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const SessionCard = ({ s, compact = false }: { s: Session; compact?: boolean }) => {
    const isSupervisionCard = s.session_type === "supervision";
    const [sheetOpen, setSheetOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [readOpen, setReadOpen] = useState(false);
    const nowMs = Date.now();
    const scheduledMs = new Date(s.scheduled_at).getTime();
    const isPast = scheduledMs < nowMs;
    const isActiveStatus = !["cancelled", "no_show", "rescheduled"].includes(s.status);
    const sessionDateKey = s.patient_id ? `${s.patient_id}|${new Date(s.scheduled_at).toISOString().slice(0, 10)}` : "";
    const hasRecord = sessionRecordIds.has(s.id) || (sessionDateKey && sessionRecordKeys.has(sessionDateKey));
    const registroPendente = !isSupervisionCard && isPast && isActiveStatus && !hasRecord && !!s.patient_id;
    const prevPlan = !isSupervisionCard
      ? (planBySession.get(s.id) || recordPlanBySession.get(s.id) || progressPlanBySession.get(s.id))
      : undefined;
    const sessionSummary = !isSupervisionCard ? summaryBySession.get(s.id) : undefined;
    const registroFeito = !isSupervisionCard && isPast && isActiveStatus && hasRecord && !!s.patient_id;
    const homeworkSentAt = !isSupervisionCard ? homeworkSentBySession.get(s.id) : undefined;
    const sessionMood = !isSupervisionCard ? moodBySession.get(s.id) : undefined;
    const moodEmoji = sessionMood
      ? (sessionMood.score >= 8 ? "😄" : sessionMood.score >= 6 ? "🙂" : sessionMood.score >= 4 ? "😐" : sessionMood.score >= 2 ? "🙁" : "😔")
      : null;
    const moodTone = sessionMood
      ? (sessionMood.score >= 7 ? "text-emerald-700 bg-emerald-50 border-emerald-200"
        : sessionMood.score >= 4 ? "text-amber-700 bg-amber-50 border-amber-200"
          : "text-rose-700 bg-rose-50 border-rose-200")
      : "";
    const moodTitle = sessionMood
      ? `Humor do paciente: ${sessionMood.score.toFixed(0)}/10${sessionMood.source === "patient_self_report" ? " (autorrelato)" : sessionMood.source === "professional_estimate" ? " (estimativa profissional)" : ""}`
      : "";



    const actions = (
      <>
        {!isSupervisionCard && s.patient_id && (
          <button onClick={() => { setSheetOpen(false); setReadOpen(true); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-muted text-left text-sm">
            <Eye className="h-4 w-4 text-primary" /> Visualizar sessão
          </button>
        )}
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

    const accentClass = isSupervisionCard
      ? "before:bg-serene"
      : s.status === "cancelled" ? "before:bg-destructive/70"
        : s.status === "no_show" ? "before:bg-amber-500"
          : s.status === "rescheduled" ? "before:bg-orange-500"
            : s.status === "completed" ? "before:bg-teal-500"
              : s.status === "confirmed" ? "before:bg-emerald-500"
                : s.status === "scheduled" ? "before:bg-sky-500"
                  : "before:bg-border";


    const modalityOnline = (s as any).modality === "online";

    return (
      <div
        onClick={() => openEdit(s)}
        title={isSupervisionCard ? "Supervisão" : statusLabel[s.status]}
        className={cn(
          "relative min-w-0 overflow-hidden rounded-xl border border-border bg-card group transition-colors cursor-pointer hover:ring-2 hover:ring-primary/15",
          compact ? "py-1.5 pr-2 pl-3" : "p-3 pl-4",
          "before:absolute before:left-0 before:top-0 before:h-full before:w-1.5 before:content-['']",
          accentClass
        )}
      >
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex flex-1 items-center gap-x-2 gap-y-1 min-w-0 flex-wrap pr-1">
            <p className="shrink-0 font-display text-sm font-semibold text-foreground">{format(new Date(s.scheduled_at), "HH:mm")}</p>
            {(() => {
              const StatusIcon = isSupervisionCard ? GraduationCap : statusIcon[s.status];
              const label = isSupervisionCard ? "Supervisão" : statusLabel[s.status];
              return (
                <span
                  role="status"
                  aria-label={`Status: ${label}`}
                  className={cn("inline-flex items-center gap-1 text-[11px] font-semibold", isSupervisionCard ? "text-foreground/70" : statusTextClass[s.status])}
                >
                  <StatusIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {label}
                </span>
              );
            })()}

            <span className="text-border">·</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-foreground/70" title={modalityOnline ? "Atendimento online" : "Atendimento presencial"}>
              {modalityOnline ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
              {modalityOnline ? "Online" : "Presencial"}
            </span>
            {!isSupervisionCard && s.price != null && (
              <>
                <span className="text-border">·</span>
                <span
                  className={cn(
                    "inline-flex min-w-0 items-center gap-1 text-[11px] font-medium break-words",
                    s.payment_status === "paid" ? "text-emerald-700" : "text-amber-700"
                  )}
                  title={`Pagamento ${paymentStatusLabel[s.payment_status].toLowerCase()} · R$ ${Number(s.price).toFixed(2)}`}
                >
                  <Bell className="h-3 w-3 text-current" />
                  <span className={cn("h-1.5 w-1.5 rounded-full", s.payment_status === "paid" ? "bg-emerald-500" : "bg-amber-500")} />
                  {paymentStatusLabel[s.payment_status]}
                  <span className="text-border">·</span>
                  <DollarSign className="h-3 w-3 text-current" />
                  R$ {Number(s.price).toFixed(2)}
                </span>
              </>
            )}
          </div>
          {isMobile ? (
            <>
              <Button variant="outline" size="sm" className="h-8 w-8 shrink-0 p-0" aria-label="Ações da sessão" onClick={(e) => { e.stopPropagation(); setSheetOpen(true); }}>
                <ChevronDown className="h-4 w-4" />
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
                <Button variant="outline" size="sm" className={cn("gap-1 text-xs font-medium shrink-0", compact ? "h-7 w-7 p-0" : "h-8 px-2.5")} aria-label="Ações da sessão" onClick={(e) => e.stopPropagation()}>
                  <ChevronDown className="h-4 w-4" /> {!compact && "Ações"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                {!isSupervisionCard && s.patient_id && (
                  <DropdownMenuItem onClick={() => setReadOpen(true)}><Eye className="h-4 w-4" /> Visualizar sessão</DropdownMenuItem>
                )}
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
        <div className={cn("min-w-0", compact ? "mt-0.5 flex items-center gap-2" : "mt-1.5")}>
          {isSupervisionCard ? (
            <p className={cn("text-foreground", compact ? "text-xs" : "text-sm font-medium")}>
              Supervisão
              {s.discussed_patient_name && <span className="text-muted-foreground"> · {s.discussed_patient_name}</span>}
            </p>
          ) : s.patient_id && s.patient_name ? (
            <>
              <p className={cn("text-left font-display font-semibold text-foreground hover:text-primary hover:underline transition-colors cursor-pointer min-w-0 break-words", compact ? "text-xs leading-snug truncate" : "text-sm leading-snug sm:text-base sm:truncate")}
                 onClick={(e) => { e.stopPropagation(); openPatientDrawer(s.patient_id!); }}>
                {s.patient_name}
              </p>
              {(() => {
                if (compact) return null;
                const svcName = s.service_id
                  ? services.find(sv => sv.id === s.service_id)?.name
                  : "Atendimento clínico";
                return svcName ? (
                  <p className="text-xs text-foreground/60">{svcName}</p>
                ) : null;
              })()}
            </>
          ) : (
            <p className={cn("text-foreground", compact ? "text-xs" : "text-sm font-medium")}>Paciente</p>
          )}
          {compact && (
            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              {sessionMood && (
                <span className={cn("inline-flex items-center gap-0.5 rounded-full border px-1.5 text-[10px] font-semibold", moodTone)} title={moodTitle} aria-label={moodTitle}>
                  <span aria-hidden="true">{moodEmoji}</span>{sessionMood.score.toFixed(0)}
                </span>
              )}
              {registroPendente && (
                <span className="text-amber-600" title="Sessão realizada sem registro clínico" aria-label="Registro pendente">
                  <AlertCircle className="h-3.5 w-3.5" />
                </span>
              )}
              {registroFeito && (
                <span className="text-foreground/45" title="Registro clínico concluído" aria-label="Registro feito">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
              {modalityOnline && (s as any).meeting_link && (
                <a href={(s as any).meeting_link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary" title="Entrar na sala online" aria-label="Entrar na sala online">
                  <Link2 className="h-3.5 w-3.5" />
                </a>
              )}
              {homeworkSentAt && (
                <span className="text-emerald-600" title="Plano entre sessões enviado" aria-label="Plano entre sessões enviado">
                  <ClipboardList className="h-3.5 w-3.5" />
                </span>
              )}
              {!isSupervisionCard && s.patient_id && (
                <>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setReadOpen(true); }}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card text-foreground/70 hover:bg-muted transition-colors"
                    title="Visualizar sessão"
                    aria-label="Visualizar sessão"
                  >
                    <Eye className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void openEdit(s); }}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card text-foreground/70 hover:bg-muted transition-colors"
                    title="Registro da sessão"
                    aria-label="Registro da sessão"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {!compact && sessionSummary && (
          <p className="mt-1.5 text-xs text-foreground/75 line-clamp-2 break-words" title={sessionSummary}>
            {sessionSummary}
          </p>
        )}
        {/* Sinalizadores discretos (ícones com tooltip) */}
        {!compact && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {sessionMood && (
              <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", moodTone)} title={moodTitle}>
                <span aria-hidden="true">{moodEmoji}</span> Humor {sessionMood.score.toFixed(0)}/10
              </span>
            )}
            {registroPendente && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700" title="Sessão realizada sem registro clínico">
                <AlertCircle className="h-3.5 w-3.5" /> Registro pendente
              </span>
            )}
            {registroFeito && (
              <span className="inline-flex items-center gap-1 text-[11px] text-foreground/60" title="Registro clínico concluído">
                <Check className="h-3.5 w-3.5" /> Registro feito
              </span>
            )}
            {modalityOnline && (s as any).meeting_link && (
              <a href={(s as any).meeting_link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline" title="Entrar na sala online">
                <Link2 className="h-3.5 w-3.5" /> Entrar
              </a>
            )}
            {s.confirmation_sent_at && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5"
                title={`Lembrete enviado em ${format(new Date(s.confirmation_sent_at), "dd/MM 'às' HH:mm")}`}
              >
                <Bell className="h-3 w-3" /> Lembrete enviado
              </span>
            )}
            {s.billing_sent_at && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5"
                title={`Cobrança enviada em ${format(new Date(s.billing_sent_at), "dd/MM 'às' HH:mm")}`}
              >
                <DollarSign className="h-3 w-3" /> Cobrança enviada
              </span>
            )}
            {homeworkSentAt && (
              <span className="text-emerald-600" title={`Plano entre sessões enviado em ${format(new Date(homeworkSentAt), "dd/MM 'às' HH:mm")}`} aria-label="Plano entre sessões enviado">
                <ClipboardList className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        )}

        {/* Contexto clínico rápido: combinado / próximo passo da sessão anterior */}
        {!compact && prevPlan && (
          <div className="mt-2 rounded-lg border border-primary/15 bg-primary/[0.04] px-2.5 py-1.5">
            <p className="text-[10px] uppercase tracking-wider text-primary/80 font-semibold flex items-center gap-1">
              <Target className="h-3 w-3" /> Combinado / próximo passo
            </p>
            <p className="text-xs text-foreground/85 line-clamp-2 mt-0.5 break-words">{prevPlan}</p>
          </div>
        )}

        {/* Ação principal + grupo de ações secundárias */}
        {!compact && !isSupervisionCard && s.patient_id && (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Button
              size="sm"
              className="h-8 w-full rounded-lg px-3 text-xs font-semibold gap-1.5 sm:w-auto"
              onClick={(e) => { e.stopPropagation(); void openEdit(s); }}
            >
              <Pencil className="h-3.5 w-3.5" /> Registro da sessão
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-8 w-full rounded-lg px-3 text-xs font-semibold gap-1.5 sm:w-auto"
              onClick={(e) => { e.stopPropagation(); setReadOpen(true); }}
              aria-label="Visualizar sessão"
            >
              <Eye className="h-3.5 w-3.5" /> Visualizar
            </Button>

            <div className="grid w-full min-w-0 grid-cols-2 overflow-hidden rounded-lg border border-border divide-x divide-y divide-border sm:inline-flex sm:w-auto sm:divide-y-0">
              <button
                onClick={(e) => { e.stopPropagation(); setHistoryOpen(true); }}
                className="inline-flex min-w-0 items-center justify-center gap-1.5 px-2 h-9 text-[11px] font-medium text-foreground/75 bg-card hover:bg-muted transition-colors sm:h-8 sm:justify-start sm:px-2.5"
              >
                <ClipboardList className="h-3.5 w-3.5" /> Sessões
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); openPatientDrawer(s.patient_id!); }}
                className="inline-flex min-w-0 items-center justify-center gap-1.5 px-2 h-9 text-[11px] font-medium text-foreground/75 bg-card hover:bg-muted transition-colors sm:h-8 sm:justify-start sm:px-2.5"
              >
                <DollarSign className="h-3.5 w-3.5" /> Financeiro
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); void openHomeworkForSession(s); }}
                className="inline-flex min-w-0 items-center justify-center gap-1.5 px-2 h-9 text-center text-[11px] leading-tight font-medium text-foreground/75 bg-card hover:bg-muted transition-colors sm:h-8 sm:justify-start sm:px-2.5 sm:text-left"
              >
                <ClipboardList className="h-3.5 w-3.5" /> Plano entre sessões
              </button>
              <Link
                to={`/app/plano-tratamento?patient=${s.patient_id}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex min-w-0 items-center justify-center gap-1.5 px-2 h-9 text-center text-[11px] leading-tight font-medium text-foreground/75 bg-card hover:bg-muted transition-colors sm:h-8 sm:justify-start sm:px-2.5 sm:text-left"
                aria-label={`Abrir plano de tratamento de ${s.patient_name || "paciente"}`}
              >
                <Target className="h-3.5 w-3.5" /> Plano de tratamento
              </Link>
            </div>
          </div>
        )}

        {!isSupervisionCard && s.patient_id && (
          <div onClick={(e) => e.stopPropagation()}>
            <SessionReadView
              open={readOpen}
              onOpenChange={setReadOpen}
              sessionId={s.id}
              patientId={s.patient_id}
              patientName={s.patient_name}
              scheduledAt={s.scheduled_at}
              durationMinutes={s.duration_minutes}
              status={s.status}
              modality={(s as any).modality}
              price={s.price}
              paymentStatus={s.payment_status}
              notes={s.notes}
              serviceName={s.service_id ? services.find((sv) => sv.id === s.service_id)?.name : "Atendimento clínico"}
            />
          </div>
        )}

        {!isSupervisionCard && s.patient_id && (
          <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>

            <SheetContent side="right" className="w-screen max-w-none sm:max-w-none h-[100dvh] border-0 rounded-none overflow-y-auto overflow-x-hidden p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-8" onClick={(e) => e.stopPropagation()}>
              <SheetHeader className="mb-4">
                <SheetTitle className="font-display text-xl">Sessões</SheetTitle>
                <SheetDescription>{s.patient_name}</SheetDescription>
              </SheetHeader>
              {(() => {
                const patientSessions = sessions.filter((x) => x.patient_id === s.patient_id && x.session_type !== "supervision");
                const now = new Date();
                const past = patientSessions.filter((x) => new Date(x.scheduled_at) <= now).sort((a, b) => +new Date(b.scheduled_at) - +new Date(a.scheduled_at));
                const future = patientSessions.filter((x) => new Date(x.scheduled_at) > now).sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));
                const lastDate = past[0]?.scheduled_at ?? null;
                const nextDate = future[0]?.scheduled_at ?? null;
                const totalRecords = patientSessions.filter((x) => sessionRecordIds.has(x.id)).length;
                return (
                  <PatientSessionsQuickView
                    patientId={s.patient_id!}
                    nextDate={nextDate}
                    lastDate={lastDate}
                    totalRecords={totalRecords}
                    onOpenFullHistory={() => setHistoryOpen(false)}
                    onNavigateAway={() => setHistoryOpen(false)}
                  />
                );
              })()}
            </SheetContent>
          </Sheet>
        )}
      </div>
    );
  };

  return (
    <div className="min-w-0 space-y-6 overflow-x-clip animate-fade-up">
      <HelpCard
        id="agenda"
        title="Agenda"
        description="A Agenda organiza seus atendimentos e permite acompanhar sessões, confirmações, pagamentos e acessar rapidamente a ficha do paciente."
        sections={[
          { label: "Quando usar", content: "No início do dia para conferir a rotina e ao longo da semana para agendar, confirmar ou reagendar sessões." },
          { label: "Conexões", content: "Sessões geram lembretes ao paciente, entradas no Google Calendar e linhas no Financeiro. Ao editar uma sessão, o Registro Clínico da sessão pode ser preenchido no mesmo modal." },
        ]}
      />
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

      <header className="flex min-w-0 max-w-full flex-wrap items-end justify-between gap-3 sticky top-16 md:static z-30 -mx-4 px-4 sm:-mx-6 sm:px-6 -mt-4 pt-4 sm:-mt-6 sm:pt-6 md:m-0 md:p-0 bg-background/95 backdrop-blur md:bg-transparent md:backdrop-blur-none pb-3 md:pb-0">
        <div className="flex items-start gap-3 sm:gap-4 min-w-0">
          <span className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <CalendarIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Clínica</p>
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-foreground">Agenda</h1>
            <p className="mt-1.5 hidden sm:block text-sm md:text-base text-muted-foreground max-w-2xl">Visualize e organize seus atendimentos. Sessões marcadas aqui viram lembretes para o paciente, entradas no Google Calendar e linhas no Financeiro.</p>
          </div>
        </div>
        <div className="flex w-full min-w-0 items-center gap-2 overflow-x-auto no-scrollbar sm:w-auto sm:flex-wrap sm:overflow-visible">

          <RefreshButton />
          <Button
            type="button"
            variant={gcalConnected ? "outline" : "secondary"}
            size="sm"
            onClick={gcalConnected ? disconnectGcal : connectGcal}
            disabled={gcalLoading}
             className="shrink-0 min-w-0 rounded-[40px] font-display font-semibold sm:flex-none"

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
              className="shrink-0 min-w-0 rounded-[40px] font-display font-semibold sm:flex-none"
              title="Cria eventos no Google Calendar para todas as sessões futuras ainda não sincronizadas"
            >
              {bulkSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="hidden sm:inline">
                {bulkSyncing && bulkProgress ? `Sincronizando ${bulkProgress.done}/${bulkProgress.total}` : "Sincronizar existentes"}
              </span>
              <span className="sm:hidden">{bulkSyncing ? "..." : "Sincronizar"}</span>
            </Button>
          )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setEditingPersonalEvent(null); setPersonalEventOpen(true); }}
          className="hidden rounded-[40px] font-display font-semibold border-amber-300 text-amber-800 hover:bg-amber-50 hover:text-amber-900 sm:inline-flex"
        >
          <Plus className="h-4 w-4" /> Compromisso pessoal
        </Button>
        <Dialog open={open} onOpenChange={(v) => { if (!v) { newGuard.guardClose(() => { clearSessionDraft(); setOpen(false); }, () => setOpen(false)); } else { setOpen(true); } }}>

          <DialogTrigger asChild>
            <Button variant="accent" size="sm" onClick={() => openNew()} className="hidden rounded-[40px] font-display font-semibold w-full sm:inline-flex sm:w-auto sm:size-default">
              <Plus className="h-4 w-4" /> Nova sessão
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-md max-h-[90dvh] overflow-x-hidden overflow-y-auto p-4 sm:p-6" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
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
                {form.recurrence === "single" ? (
                  <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5">
                    <p className="text-xs font-medium text-foreground">Data prevista de pagamento</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      No dia da sessão{form.date ? ` — ${format(parse(form.date, "yyyy-MM-dd", new Date()), "dd/MM/yyyy")}` : ""}
                    </p>
                  </div>
                ) : null}
                {form.recurrence === "recurring" && (
                  <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="payment_due_date">Data prevista de pagamento</Label>
                      <Input
                        id="payment_due_date"
                        type="date"
                        value={form.payment_due_date}
                        onChange={(e) => setForm({ ...form, payment_due_date: e.target.value })}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Se deixar em branco, cada sessão usa a própria data.
                      </p>
                    </div>
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
                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea id="notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                {form.session_type === "clinical" && (
                  <ClinicalV2Block
                    value={{
                      wellbeing_score: form.wellbeing_score,
                      wellbeing_source: form.wellbeing_source,
                      patient_context: form.patient_context,
                      clinical_observation: form.clinical_observation,
                      emotions: form.emotions,
                      attention_flag: form.attention_flag,
                      themes: form.themes,
                      engagement: form.engagement,
                      private_notes: form.private_notes,
                    }}
                    onChange={(patch) => setForm({ ...form, ...patch })}
                  />
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

          {/* Patient banner */}
          {selectedPatientName && (
            <div className="flex items-center gap-2.5 rounded-2xl bg-primary/8 border border-primary/20 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Paciente selecionado</p>
                <p className="font-display text-base font-semibold text-foreground truncate">{selectedPatientName}</p>
              </div>
              <button
                onClick={() => setPatientFilter("all")}
                className="ml-auto shrink-0 inline-flex items-center gap-1 text-xs font-display font-semibold text-primary hover:underline"
              >
                <X className="h-3.5 w-3.5" /> Limpar filtro
              </button>
            </div>
          )}

          {/* Toggle de filtros — apenas mobile */}
          {isMobile && (
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-full border border-border bg-card px-4 py-2 text-xs font-display font-semibold text-muted-foreground"
            >
              <span className="inline-flex items-center gap-2">
                <Filter className="h-3.5 w-3.5" />
                Filtros
                {(serviceFilter !== "all" || patientFilter !== "all" || reminderFilter || billingFilter) && (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">
                    {(serviceFilter !== "all" ? 1 : 0) + (patientFilter !== "all" ? 1 : 0) + (reminderFilter ? 1 : 0) + (billingFilter ? 1 : 0)}
                  </span>
                )}
              </span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", filtersOpen && "rotate-180")} />
            </button>
          )}

          <div className={cn("space-y-4", isMobile && !filtersOpen && "hidden")}>
          {/* Service filter — rolagem horizontal em uma linha */}
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => setServiceFilter("all")}
                className={cn(
                  "shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-display font-semibold transition-colors border",
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
                    "shrink-0 max-w-[60vw] truncate whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-display font-semibold transition-colors border sm:max-w-none",
                    serviceFilter === svc.id
                      ? "bg-accent text-accent-foreground border-accent"
                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                  )}
                >
                  {svc.name}
                </button>
              ))}
            </div>
          </div>

          {/* Filtros de comunicação: lembrete / cobrança */}
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => setReminderFilter((v) => !v)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-display font-semibold transition-colors border",
                  reminderFilter
                    ? "bg-sky-100 text-sky-800 border-sky-300"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                )}
              >
                <Bell className="h-3.5 w-3.5" />
                Lembrete enviado
              </button>
              <button
                onClick={() => setBillingFilter((v) => !v)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-display font-semibold transition-colors border",
                  billingFilter
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                )}
              >
                <DollarSign className="h-3.5 w-3.5" />
                Cobrança enviada
              </button>
              {(reminderFilter || billingFilter) && (
                <button
                  onClick={() => { setReminderFilter(false); setBillingFilter(false); }}
                  className="shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-display font-semibold border border-border text-muted-foreground hover:bg-muted"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Filtros: paciente + mês/ano */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            {patients.length > 0 && (
              <div className="col-span-2 flex min-w-0 items-center gap-2">
                <Select value={patientFilter} onValueChange={setPatientFilter}>
                  <SelectTrigger className="h-9 min-w-0 flex-1 rounded-full text-xs font-display font-semibold sm:w-72 sm:flex-none">
                    <SelectValue placeholder="Filtrar por paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os pacientes</SelectItem>
                    {patients.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {patientFilter !== "all" && (
                  <button
                    onClick={() => setPatientFilter("all")}
                    className="shrink-0 px-3 py-1.5 rounded-full text-xs font-display font-semibold border border-border text-muted-foreground hover:bg-muted"
                  >
                    Limpar
                  </button>
                )}
              </div>
            )}
            <Select
              value={String(currentMonth.getMonth() + 1)}
              onValueChange={(v) => {
                const newMonth = new Date(currentMonth.getFullYear(), Number(v) - 1, 1);
                goToMonth(newMonth);
              }}
            >
              <SelectTrigger disabled={loading} className="h-9 w-full min-w-0 rounded-full text-xs font-display font-semibold sm:w-40">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {format(new Date(2024, i, 1), "MMMM", { locale: ptBR })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(currentMonth.getFullYear())}
              onValueChange={(v) => {
                const newMonth = new Date(Number(v), currentMonth.getMonth(), 1);
                goToMonth(newMonth);
              }}
            >
              <SelectTrigger disabled={loading} className="h-9 w-full min-w-0 rounded-full text-xs font-display font-semibold sm:w-24">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 11 }, (_, i) => {
                  const year = new Date().getFullYear() - 5 + i;
                  return <SelectItem key={year} value={String(year)}>{year}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          </div>



          {/* ── Resumo do período (segue o dia/mês selecionado) ── */}
          {(() => {
            const summary = computeAgendaSummary({
              sessions,
              selectedDate,
              currentMonth,
              sessionRecordIds,
              sessionRecordKeys,
              moodBySession,
              moodTodayPatients,
            });
            const cutoffLabel = format(summary.cutoff, "dd/MM");
            const periodLabel = `até ${cutoffLabel}`;

            const Item = ({ icon: Icon, label, value, tone, onClick }: { icon: any; label: string; value: number; tone: string; onClick?: () => void }) => {
              const Tag: any = onClick ? "button" : "div";
              return (
                <Tag
                  onClick={onClick}
                  type={onClick ? "button" : undefined}
                  className={cn(
                    "flex min-h-16 min-w-0 w-full items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-2.5 text-left sm:gap-3 sm:px-3",
                    onClick && "transition-colors hover:bg-muted/60 hover:border-primary/30 cursor-pointer"
                  )}
                >
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tone)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium leading-tight text-foreground/70 break-words">{label}</p>
                    <p className="mt-1 font-display text-lg font-semibold text-foreground leading-none">{value}</p>
                  </div>
                </Tag>
              );
            };

            const allZero = summary.todayCount === 0 && summary.pendingRecords === 0 && summary.pendingPayments === 0 && summary.moodCount === 0;

            return (
              <>
                <div className="grid min-w-0 grid-cols-2 gap-2 mb-2 lg:grid-cols-4">
                  <Item icon={CalendarCheck} label={summary.labels.sessions} value={summary.todayCount} tone="bg-primary/10 text-primary" onClick={() => { goToDate(selectedDate); setViewTab("day"); }} />
                  <Item icon={AlertCircle} label={`${summary.labels.pendingRecords} (${periodLabel})`} value={summary.pendingRecords} tone="bg-amber-100 text-amber-700" onClick={() => setPendingRecordsOpen(true)} />
                  <Item icon={Wallet} label={`${summary.labels.pendingPayments} (${periodLabel})`} value={summary.pendingPayments} tone="bg-emerald-100 text-emerald-700" onClick={() => setPendingPaymentsOpen(true)} />
                  <Item icon={HeartPulse} label={summary.labels.mood} value={summary.moodCount} tone="bg-lilac/40 text-foreground" />
                </div>
                {allZero && (
                  <div className="mb-4 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-center text-sm text-muted-foreground">
                    Nenhuma sessão ou pendência para este período.
                    <button
                      type="button"
                      onClick={() => openNew(selectedDate)}
                      className="ml-1 inline font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Agendar uma sessão
                    </button>
                  </div>
                )}
                <Sheet open={pendingRecordsOpen} onOpenChange={setPendingRecordsOpen}>
                  <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
                    <SheetHeader className="mb-4">
                      <SheetTitle className="font-display text-xl">Registros pendentes</SheetTitle>
                      <SheetDescription>
                        Sessões realizadas que ainda não têm registro clínico ({periodLabel})
                      </SheetDescription>
                    </SheetHeader>
                    {summary.pendingRecordList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
                        <ClipboardList className="h-8 w-8 text-muted-foreground/60" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Tudo em dia por aqui ✨</p>
                          <p className="text-xs text-muted-foreground mt-1">Nenhum registro pendente {periodLabel}.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {summary.pendingRecordList.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => { setPendingRecordsOpen(false); navigate(`/app/registro-sessao?patient=${s.patient_id}&session=${s.id}${agendaReturnParam()}`); }}
                            className="w-full text-left rounded-xl border border-border bg-card px-3 py-2.5 hover:bg-muted/60 hover:border-primary/30 transition-colors"
                          >
                            <p className="font-display text-sm font-semibold text-foreground">{s.patient_name || "Paciente"}</p>
                            <p className="text-xs text-foreground/70">{format(new Date(s.scheduled_at), "dd/MM/yyyy 'às' HH:mm")}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </SheetContent>
                </Sheet>
                <Sheet open={pendingPaymentsOpen} onOpenChange={setPendingPaymentsOpen}>
                  <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
                    <SheetHeader className="mb-4">
                      <SheetTitle className="font-display text-xl">Pagamentos pendentes</SheetTitle>
                      <SheetDescription>
                        Sessões já realizadas com pagamento em aberto ({periodLabel})
                      </SheetDescription>
                    </SheetHeader>
                    {summary.pendingPaymentList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
                        <Wallet className="h-8 w-8 text-muted-foreground/60" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Nenhum pagamento pendente ✨</p>
                          <p className="text-xs text-muted-foreground mt-1">Todas as sessões {periodLabel} estão quitadas.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {summary.pendingPaymentList.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => { setPendingPaymentsOpen(false); navigate(`/app/financeiro?filter=atrasados`); }}
                            className="w-full text-left rounded-xl border border-border bg-card px-3 py-2.5 hover:bg-muted/60 hover:border-primary/30 transition-colors flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="font-display text-sm font-semibold text-foreground truncate">{s.patient_name || "Paciente"}</p>
                              <p className="text-xs text-foreground/70">{format(new Date(s.scheduled_at), "dd/MM/yyyy 'às' HH:mm")}</p>
                            </div>
                            {s.price != null && (
                              <span className="font-display text-sm font-semibold text-foreground shrink-0">R$ {Number(s.price).toFixed(2)}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </SheetContent>
                </Sheet>
              </>
            );

          })()}

          <Tabs value={viewTab} onValueChange={setViewTab}>
            {/* Cabeçalho unificado: visão + navegação de data + nova sessão */}
            {(() => {
              const goPrev = () => {
                if (viewTab === "month") goToMonth(subMonths(currentMonth, 1));
                else if (viewTab === "week") goToWeek(addWeeks(weekStart, -1));
                else goToDate(addDays(selectedDate, -1));
              };
              const goNext = () => {
                if (viewTab === "month") goToMonth(addMonths(currentMonth, 1));
                else if (viewTab === "week") goToWeek(addWeeks(weekStart, 1));
                else goToDate(addDays(selectedDate, 1));
              };
              const label = viewTab === "month"
                ? format(currentMonth, "MMMM yyyy", { locale: ptBR })
                : viewTab === "week"
                  ? `${format(weekStart, "dd/MM")} — ${format(addDays(weekStart, 6), "dd/MM")}`
                  : format(selectedDate, "EEE, dd 'de' MMM 'de' yyyy", { locale: ptBR });

              return (
                <div className="mb-3 grid min-w-0 grid-cols-1 gap-2 overflow-hidden rounded-2xl bg-card border border-border shadow-card px-2.5 py-2 sm:flex sm:flex-wrap sm:items-center">
                  <TabsList className="grid w-full grid-cols-3 bg-muted/60 gap-0.5 p-0.5 h-8 rounded-[40px] sm:flex sm:w-auto sm:shrink-0">
                    <TabsTrigger value="day" className="h-7 min-w-0 px-1.5 rounded-[40px] text-xs font-display font-semibold text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none sm:px-2.5"><CalendarCheck className="h-3.5 w-3.5 mr-1 inline shrink-0" /> Dia</TabsTrigger>
                    <TabsTrigger value="week" className="h-7 min-w-0 px-1.5 rounded-[40px] text-xs font-display font-semibold text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none sm:px-2.5"><CalendarRange className="h-3.5 w-3.5 mr-1 inline shrink-0" /> Semana</TabsTrigger>
                    <TabsTrigger value="month" className="h-7 min-w-0 px-1.5 rounded-[40px] text-xs font-display font-semibold text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none sm:px-2.5"><CalendarDays className="h-3.5 w-3.5 mr-1 inline shrink-0" /> Mês</TabsTrigger>
                  </TabsList>

                  <div className="flex w-full items-center gap-1 min-w-0 sm:flex-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Anterior" onClick={goPrev}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <p className="min-w-0 flex-1 truncate text-center font-display text-[11px] font-semibold capitalize sm:text-left sm:text-sm">{label}</p>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Próximo" onClick={goNext}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs rounded-[40px] font-display font-semibold bg-primary/5 border-primary/25 text-primary hover:bg-primary/10 hover:text-primary shrink-0" onClick={() => goToDate(new Date())}>
                      Hoje
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    aria-pressed={dense}
                    title={dense ? "Modo compacto ativo — mostrar cards completos" : "Modo compacto — ver mais atendimentos por tela"}
                    className={cn(
                      "hidden h-8 px-2.5 text-xs rounded-[40px] font-display font-semibold shrink-0 gap-1.5 sm:inline-flex",
                      dense && "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15 hover:text-primary"
                    )}
                    onClick={toggleDense}
                  >
                    <Rows3 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Compacto</span>
                  </Button>

                  <Button variant="accent" size="sm" className="hidden h-8 rounded-[40px] font-display font-semibold shrink-0 sm:inline-flex" onClick={() => openNew(selectedDate)}>
                    <Plus className="h-3.5 w-3.5" /> Nova sessão
                  </Button>
                </div>
              );
            })()}


            {/* ── MONTH VIEW ── */}
            <TabsContent value="month">
              <div className="space-y-4">

                {loading ? (
                  <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
                ) : (
                  <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr] [&>*]:min-w-0">
                    {/* Calendar grid */}
                     <div className="min-w-0 rounded-2xl bg-card border border-border shadow-card p-2.5 sm:p-4">
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
                          const hasPersonal = eventsForDay(personalEvents, cell).length > 0;
                          return (
                             <button
                              key={dateKey}
                              onClick={() => goToDate(cell)}
                              className={cn(
                                 "aspect-square min-w-0 rounded-lg sm:rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all text-xs sm:text-sm leading-none",
                                isSelected ? "bg-accent text-accent-foreground ring-2 ring-accent/40 font-bold"
                                  : isToday ? "bg-primary/10 text-primary font-semibold"
                                    : "hover:bg-muted/50 text-foreground"
                              )}
                            >
                              <span>{format(cell, "d")}</span>
                              {hasSessions || hasPersonal ? (
                                <span className="flex items-center gap-0.5 h-3">
                                  {hasSessions && (
                                    <span className={cn(
                                      "w-1.5 h-1.5 rounded-full shrink-0",
                                      isSelected ? "bg-accent-foreground" : "bg-primary"
                                    )} />
                                  )}
                                  {hasPersonal && <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-amber-500" />}
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
                     <div className="min-w-0 rounded-2xl bg-card border border-border shadow-card p-3 sm:p-4">
                       <div className="flex min-w-0 items-center justify-between gap-2 mb-4">
                         <div className="min-w-0">
                           <p className="truncate font-display text-lg font-semibold capitalize">
                            {format(selectedDate, "EEEE", { locale: ptBR })}
                          </p>
                          <p className="text-sm text-muted-foreground">{format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</p>
                        </div>
                        <Button variant="accent" size="sm" className="rounded-[40px] font-display font-semibold" onClick={() => openNew(selectedDate)}>
                          <Plus className="h-3.5 w-3.5" /> Nova
                        </Button>
                      </div>
                      {dayTimeline(selectedDate).length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground">
                          <CalendarIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">
                            {selectedPatientName
                              ? `${selectedPatientName} não tem sessões neste dia`
                              : "Nenhuma sessão neste dia"}
                          </p>
                          <Button variant="ghost" size="sm" className="mt-2" onClick={() => openNew(selectedDate)}>
                            + Agendar sessão
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                          {dayTimeline(selectedDate).map((item) =>
                            item.kind === "session"
                              ? <SessionCard key={item.session!.id} s={item.session!} compact={dense} />
                              : <PersonalEventCard key={`pe-${item.event!.id}-${item.at}`} event={item.event!} compact onClick={() => openPersonalEvent(item.event!)} />
                          )}
                        </div>
                      )}
                      <div className="mt-3 border-t border-border pt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs text-amber-800 hover:bg-amber-50"
                          onClick={() => openPersonalEvent(null)}
                        >
                          <Plus className="h-3.5 w-3.5" /> Compromisso pessoal
                        </Button>
                      </div>
                    </div>


                    {/* Lista do mês para o paciente filtrado */}
                    {selectedPatientName && (
                      <div className="xl:col-span-2 rounded-2xl bg-card border border-border shadow-card p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-display text-sm font-semibold text-foreground">
                            Sessões de {selectedPatientName} em {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {monthFilteredSessions.length} sessão{monthFilteredSessions.length === 1 ? "" : "es"}
                          </span>
                        </div>
                        {monthFilteredSessions.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 text-center">
                            Nenhuma sessão deste paciente neste mês.
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                            {monthFilteredSessions.map((s) => <SessionCard key={s.id} s={s} compact={dense} />)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── WEEK VIEW ── */}
            <TabsContent value="week">
              <div className="space-y-4">

                {loading ? (
                  <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
                ) : isMobile ? (
                  /* ── COMPACT MOBILE WEEK ── */
                  <div className="space-y-3">
                    {/* Weekday strip */}
                    <div className="grid w-full min-w-0 grid-cols-7 gap-0.5 rounded-2xl bg-card border border-border shadow-card p-1.5 sm:gap-1 sm:p-2">
                      {weekDays.map((day) => {
                        const items = sessionsByDay(day);
                        const isToday = isSameDay(day, new Date());
                        const isSelected = isSameDay(day, selectedDate);
                        return (
                          <button
                            key={day.toISOString()}
                            onClick={() => goToDate(day)}
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

                    {/* Linha do tempo do dia (sessões + compromissos pessoais) */}
                    {dayTimeline(selectedDate).length === 0 ? (
                      <button
                        onClick={() => openNew(selectedDate)}
                        className="w-full rounded-2xl border border-dashed border-border bg-card/50 py-8 text-sm text-muted-foreground hover:text-accent hover:border-accent/40 transition-colors text-center"
                      >
                        Dia livre — toque para agendar
                      </button>
                    ) : (
                      <div className="space-y-2">
                        {dayTimeline(selectedDate).map((item) =>
                          item.kind === "session"
                            ? <SessionCard key={item.session!.id} s={item.session!} compact={dense} />
                            : <PersonalEventCard key={`pe-${item.event!.id}-${item.at}`} event={item.event!} compact onClick={() => openPersonalEvent(item.event!)} />
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full rounded-[40px] border-amber-300 text-amber-800 hover:bg-amber-50 text-xs"
                        onClick={() => openPersonalEvent(null)}
                      >
                        <Plus className="h-3.5 w-3.5" /> Compromisso pessoal
                      </Button>
                    </div>
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
                                    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
                                      {(() => {
                                        const StatusIcon = isSupervisionRow ? GraduationCap : statusIcon[s.status];
                                        const label = isSupervisionRow ? "Supervisão" : statusLabel[s.status];
                                        return (
                                          <span
                                            role="status"
                                            aria-label={`Status: ${label}`}
                                            className={cn(PILL_COMPACT, "gap-1", isSupervisionRow ? "bg-serene/20 text-serene border-serene/30" : statusClass[s.status])}
                                          >
                                            <StatusIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                                            {label}
                                          </span>
                                        );
                                      })()}
                                      {!isSupervisionRow && s.price != null && (() => {
                                        const PayIcon = paymentStatusIcon[s.payment_status];
                                        return (
                                          <span
                                            aria-label={`Pagamento: ${paymentStatusLabel[s.payment_status]}`}
                                            className={cn(PILL_COMPACT, "gap-1", paymentStatusClass[s.payment_status])}
                                          >
                                            <PayIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                                            {paymentStatusLabel[s.payment_status]}
                                          </span>
                                        );
                                      })()}
                                      {s.confirmation_sent_at && (
                                        <span
                                          className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-1.5 py-0.5"
                                          title={`Lembrete enviado em ${format(new Date(s.confirmation_sent_at), "dd/MM 'às' HH:mm")}`}
                                        >
                                          <Bell className="h-3 w-3" /> Lembrete
                                        </span>
                                      )}
                                      {s.billing_sent_at && (
                                        <span
                                          className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5"
                                          title={`Cobrança enviada em ${format(new Date(s.billing_sent_at), "dd/MM")}`}
                                        >
                                          <DollarSign className="h-3 w-3" /> Cobrança
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {/* Compromissos pessoais do dia */}
                          {eventsForDay(personalEvents, day).length > 0 && (
                            <div className="space-y-1.5 border-t border-amber-200/60 bg-amber-50/20 p-2">
                              {eventsForDay(personalEvents, day).map((ev) => (
                                <PersonalEventCard key={ev.id} event={ev} compact onClick={() => openPersonalEvent(ev)} />
                              ))}
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

                {loading ? (
                  <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
                ) : dayTimeline(selectedDate).length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-4 py-10 text-center sm:p-14">
                    <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground/40" />
                    <p className="mt-4 font-display text-lg font-medium text-foreground/70">
                      {selectedPatientName ? "Sem sessões" : "Dia livre"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedPatientName
                        ? `${selectedPatientName} não tem sessões agendadas para este dia.`
                        : "Nenhuma sessão agendada para este dia."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dayTimeline(selectedDate).map((item) =>
                      item.kind === "session"
                        ? <SessionCard key={item.session!.id} s={item.session!} compact={dense} />
                        : <PersonalEventCard key={`pe-${item.event!.id}-${item.at}`} event={item.event!} onClick={() => openPersonalEvent(item.event!)} />
                    )}
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-[40px] border-amber-300 text-amber-800 hover:bg-amber-50 text-xs"
                  onClick={() => openPersonalEvent(null)}
                >
                  <Plus className="h-3.5 w-3.5" /> Compromisso pessoal
                </Button>
              </div>
            </TabsContent>

          </Tabs>
        </div>
      </div>

      {/* ── ZONA INFERIOR: Sessões do Mês (largura total) ── */}
      <div className="min-w-0 overflow-x-clip -mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 py-5 sm:py-6" style={{ background: "hsl(var(--muted))" }}>
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

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-3" style={{ borderBottom: "0.5px solid hsl(var(--border))" }}>
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

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 mb-4">
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
          <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
            {groupedPending.map((group) => {
              const s = group.session;
              return (
                <div
                  key={group.key}
                  className="relative overflow-hidden transition-shadow"
                  style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 16, padding: "16px", boxShadow: "var(--shadow-card)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 14px rgba(150,117,206,0.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
                >
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
        <DialogContent className="inset-0 w-auto max-w-none h-[100dvh] max-h-[100dvh] rounded-none border-0 translate-x-0 translate-y-0 p-0 gap-0 grid grid-rows-[auto_minmax(0,1fr)] overflow-hidden" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader className="px-4 sm:px-8 pt-4 pb-3 pr-12 border-b border-border bg-background text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle className="font-display text-lg sm:text-2xl leading-tight">Editar sessão</DialogTitle>
                {(() => {
                  const session = sessions.find((s) => s.id === editSessionId);
                  if (!session?.patient_name) return null;
                  return <p className="text-sm text-muted-foreground truncate">{session.patient_name}</p>;
                })()}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Visualizar registro da sessão"
                className="shrink-0 gap-1.5 mr-8 h-9 w-9 p-0 sm:h-9 sm:w-auto sm:px-3"
                title="Visualizar registro da sessão (formato documento)"
                onClick={() => setEditReadOpen(true)}
                disabled={!editSessionId}
              >
                <Eye className="h-4 w-4" />
                <span className="hidden sm:inline">Visualizar</span>
              </Button>
            </div>
          </DialogHeader>
          {(() => {
            const session = sessions.find((s) => s.id === editSessionId);
            return (
              <SessionReadView
                open={editReadOpen}
                onOpenChange={setEditReadOpen}
                sessionId={editSessionId}
                patientId={session?.patient_id ?? null}
                patientName={session?.patient_name ?? null}
                scheduledAt={session?.scheduled_at ?? null}
                durationMinutes={session?.duration_minutes ?? null}
                status={session?.status ?? null}
                modality={session?.modality ?? null}
                price={session?.price ?? null}
                paymentStatus={session?.payment_status ?? null}
                notes={session?.notes ?? null}
              />
            );
          })()}

          <form onSubmit={handleEditSave} className="flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch] [&>*]:w-full [&>*]:max-w-[1100px] [&>*]:mx-auto px-4 sm:px-8 pt-4 pb-6 space-y-4">
            <div className="flex sm:hidden gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => document.getElementById("edit-plano-entre-sessoes")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-foreground/75"
              >
                Ir para Plano entre Sessões
              </button>
            </div>

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
            <div className="grid grid-cols-2 gap-3">
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
                <div className="grid grid-cols-2 gap-3">
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
                <div className="space-y-2 col-span-2 sm:col-span-1">
                  <Label>Link da sessão</Label>
                  <Input type="url" placeholder="https://meet.google.com/..." value={editForm.meeting_link} onChange={(e) => setEditForm({ ...editForm, meeting_link: e.target.value })} />
                </div>
              )}
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
            {(() => {
              const session = sessions.find((s) => s.id === editSessionId);
              if (session?.session_type === "supervision") return null;
              return (
                <div className="space-y-3">
                  {editProgressId && (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive text-xs h-7 px-2"
                        onClick={async () => {
                          await supabase.from("patient_progress").delete().eq("id", editProgressId);
                          setEditProgressId(null);
                          setEditFormRaw((prev) => ({
                            ...prev,
                            wellbeing_score: "", wellbeing_source: "",
                            patient_context: "", clinical_observation: "",
                            emotions: [], attention_flag: "not_assessed",
                            legacy_mood: null, legacy_note: "",
                          }));
                          toast.success("Registro clínico excluído");
                        }}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Excluir registro
                      </Button>
                    </div>
                  )}
                  <ClinicalV2Block
                    value={{
                      wellbeing_score: editForm.wellbeing_score,
                      wellbeing_source: editForm.wellbeing_source,
                      patient_context: editForm.patient_context,
                      clinical_observation: editForm.clinical_observation,
                      emotions: editForm.emotions,
                      attention_flag: editForm.attention_flag,
                      themes: editForm.themes,
                      engagement: editForm.engagement,
                      private_notes: editForm.private_notes,
                    }}
                    onChange={(patch) => setEditForm({ ...editForm, ...patch })}
                    legacyMood={editForm.legacy_mood}
                    legacyNote={editForm.legacy_note}
                    legacyDate={session?.scheduled_at ?? null}
                    dataModel={editForm.data_model}
                  />
                  <TherapistActivation
                    patientId={session?.patient_id ?? null}
                    sessionDate={editForm.date || format(new Date(), "yyyy-MM-dd")}
                  />
                </div>
              );
            })()}
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea rows={3} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>

            {(() => {
              const session = sessions.find((s) => s.id === editSessionId);
              if (!session?.patient_id || session.session_type === "supervision") return null;
              return (
                <>
                  {/* ── Planejamento da Próxima Sessão (inline) ── */}
                  <section
                    className="rounded-xl border p-4 space-y-3"
                    style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))", borderLeft: "3px solid hsl(var(--gold))" }}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4" style={{ color: "hsl(var(--gold))" }} />
                        <div>
                          <h3 className="font-display text-sm font-semibold text-foreground">Planejamento da Próxima Sessão</h3>
                          <p className="text-xs text-muted-foreground">
                            {planningTargetSessionId
                              ? "Vinculado à próxima sessão futura já agendada deste paciente."
                              : "Sem próxima sessão agendada. Ao preencher a data, uma nova será criada ao salvar."}
                          </p>
                        </div>
                      </div>
                    </div>
                    <SessionPlanningForm
                      value={planningValue}
                      onChange={(patch) => setPlanningValue((prev) => ({ ...prev, ...patch }))}
                      planGoals={planningPlanGoals}
                      planTechniques={planningPlanTechniques}
                      scheduledAtLocked={!!planningTargetSessionId}
                      linkedToSession={!!planningTargetSessionId}
                      onSave={planningPatientId ? () => savePlanningFromSheet({ silent: true }) : undefined}
                      onAutoSave={() => savePlanningFromSheet({ silent: true })}
                      savedAt={planningSavedAt}
                      saving={planningSaving}
                      autoSave
                      helperText={
                        planningTargetSessionId
                          ? "Este planejamento fica vinculado à próxima sessão já agendada e aparece automaticamente quando ela for aberta."
                          : "Sem próxima sessão agendada. O planejamento fica salvo como pendente e será vinculado quando você agendar."
                      }
                    />

                  </section>

                  {/* ── Plano entre Sessões (inline, atrelado à sessão atual) ── */}
                  <section
                    id="edit-plano-entre-sessoes"
                    className="rounded-xl border p-3 sm:p-4 space-y-3 min-w-0 overflow-hidden scroll-mt-4"
                    style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))", borderLeft: "3px solid hsl(var(--moss))" }}
                  >

                    <div className="flex items-start gap-2 min-w-0">
                      <NotebookPen className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "hsl(var(--moss))" }} />
                      <div className="min-w-0">
                        <h3 className="font-display text-sm font-semibold text-foreground">Plano entre Sessões</h3>
                        <p className="text-xs text-muted-foreground">Combinados e ações do paciente até a próxima sessão. Salva automaticamente.</p>
                      </div>
                    </div>
                    {(() => {
                      const p = patients.find((pp) => pp.id === session.patient_id);
                      return (
                        <HomeworkPlanForm
                          patientId={session.patient_id}
                          sessionId={session.id}
                          initialTask={homeworkTask}
                          hideFooter
                          showRecordPicker={false}
                          patientName={p?.full_name ?? session.patient_name ?? null}
                          patientPhone={p?.phone ?? null}
                          homeworkToken={p?.homework_token ?? null}
                          onSaved={(t) => { setHomeworkTask(t); setHomeworkExists(true); }}
                        />
                      );
                    })()}
                  </section>
                </>
              );
            })()}
            </div>
            <DialogFooter className="flex-row items-center gap-2 shrink-0 z-20 px-4 sm:px-8 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-background border-t border-border !max-w-none">

              <Button
                type="button" variant="ghost" size="icon"
                className="text-destructive shrink-0 h-10 w-10 sm:mr-auto sm:w-auto sm:px-3"
                aria-label="Excluir sessão"
                onClick={() => { if (editSessionId) { promptDelete(editSessionId); } }}
              >
                <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Excluir sessão</span>
              </Button>
              <Button type="button" variant="outline" className="flex-1 sm:flex-none h-10" onClick={() => editGuard.guardClose(() => setEditOpen(false))}>Cancelar</Button>
              <Button type="submit" variant="accent" className="flex-1 sm:flex-none h-10" disabled={editSaving || loadingEditProgress}>
                {(editSaving || loadingEditProgress) && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
              </Button>
            </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      {/* ── Plano entre Sessões (vinculado à sessão atual) ── */}
      <Dialog open={homeworkOpen} onOpenChange={setHomeworkOpen}>
        <DialogContent
          className={
            homeworkFullscreen
              ? "w-screen max-w-none h-[100dvh] max-h-[100dvh] rounded-none border-0 translate-x-0 translate-y-0 left-0 top-0 overflow-y-auto overflow-x-hidden p-4 sm:p-8"
              : "w-[95vw] max-w-[900px] max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6"
          }
        >
          <DialogHeader>
            <DialogTitle className="font-display text-xl sm:text-2xl flex items-center gap-2 pr-20">
              <NotebookPen className="h-5 w-5 shrink-0 text-primary" />
              <span className="min-w-0">{homeworkTask ? "Editar Plano entre Sessões" : "Novo Plano entre Sessões"}</span>
            </DialogTitle>
          </DialogHeader>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setHomeworkFullscreen((v) => !v)}
            className="absolute right-12 top-3 h-9 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
            aria-label={homeworkFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          >
            {homeworkFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="hidden sm:inline text-xs">{homeworkFullscreen ? "Sair da tela cheia" : "Tela cheia"}</span>
          </Button>
          {(() => {
            const fromEdit = sessions.find((s) => s.id === editSessionId);
            const patientId = homeworkPatientId ?? fromEdit?.patient_id ?? null;
            const sessionId = homeworkSessionId ?? fromEdit?.id ?? null;
            if (!patientId) return null;
            const p = patients.find((pp) => pp.id === patientId);
            return (
              <HomeworkPlanForm
                patientId={patientId}
                sessionId={sessionId}
                initialTask={homeworkTask}
                showRecordPicker={false}
                submitLabel="Salvar e fechar"
                patientName={p?.full_name ?? null}
                patientPhone={p?.phone ?? null}
                homeworkToken={p?.homework_token ?? null}
                onSaved={(saved) => { setHomeworkTask(saved); setHomeworkExists(true); }}
                onClose={() => setHomeworkOpen(false)}
              />
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Planejar próxima sessão (Sheet reutilizando SessionPlanningForm) ── */}
      <Sheet open={planningOpen} onOpenChange={setPlanningOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Planejar próxima sessão</SheetTitle>
            <SheetDescription>
              O planejamento salvo aparece no Plano Terapêutico e no Registro de Sessão.
            </SheetDescription>
          </SheetHeader>
          <div className="py-4">
            <SessionPlanningForm
              value={planningValue}
              onChange={(patch) => setPlanningValue((v) => ({ ...v, ...patch }))}
              planGoals={planningPlanGoals}
              planTechniques={planningPlanTechniques}
              linkedToSession={!!planningTargetSessionId}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPlanningOpen(false)}>Cancelar</Button>
            <Button variant="accent" onClick={() => void savePlanningFromSheet()} disabled={planningSaving}>
              {planningSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar planejamento
            </Button>
          </div>
        </SheetContent>
      </Sheet>


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
            const currentGid = current ? getGroupId(current.notes) : null;
            const allKnown = [...sessions, ...pendingSessions, ...pendingPackageSessions]
              .filter((it, i, l) => l.findIndex((c) => c.id === it.id) === i);
            const seriesSessions = (current && pkg)
              ? (currentGid
                  ? allKnown.filter((s) => s.patient_id === current.patient_id && getGroupId(s.notes) === currentGid)
                  : allKnown.filter((s) => {
                      const info = getPackageInfo(s.notes);
                      return s.patient_id === current.patient_id && info?.total === pkg.total && !getGroupId(s.notes);
                    }))
              : [];
            const seriesCount = seriesSessions.length || (pkg?.total ?? 0);
            const sorted = [...seriesSessions].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
            const firstDate = sorted[0] ? new Date(sorted[0].scheduled_at).toLocaleDateString("pt-BR") : null;
            const lastDate = sorted[sorted.length - 1] ? new Date(sorted[sorted.length - 1].scheduled_at).toLocaleDateString("pt-BR") : null;
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
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        Sequência (pacote de {pkg.total} sessões)
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Esta ação afeta apenas <strong>{seriesCount}</strong> sessão(ões) deste pacote
                        {firstDate && lastDate ? <> ({firstDate} → {lastDate})</> : null}.
                        {currentGid
                          ? " Outros pacotes e o histórico de meses anteriores deste paciente serão preservados."
                          : " Pacote legado: agrupamento por ordem cronológica."}
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

            {/* Sessions tab — mesmo formato da tela de Pacientes */}
            <TabsContent value="sessions" className="mt-4">
              {!drawerPatientId ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma sessão encontrada.</p>
              ) : (() => {
                const patientSessions = drawerSessions.filter((x) => x.session_type !== "supervision");
                const now = new Date();
                const past = patientSessions
                  .filter((x) => new Date(x.scheduled_at) <= now)
                  .sort((a, b) => +new Date(b.scheduled_at) - +new Date(a.scheduled_at));
                const future = patientSessions
                  .filter((x) => new Date(x.scheduled_at) > now)
                  .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));
                return (
                  <PatientSessionsQuickView
                    patientId={drawerPatientId}
                    nextDate={future[0]?.scheduled_at ?? null}
                    lastDate={past[0]?.scheduled_at ?? null}
                    totalRecords={patientSessions.filter((x) => sessionRecordIds.has(x.id)).length}
                    onOpenFullHistory={() => setDrawerOpen(false)}
                    onNavigateAway={() => setDrawerOpen(false)}
                  />
                );
              })()}
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
                <div className="space-y-4 max-h-[50vh] overflow-y-auto">
                  {(() => {
                    const paid = drawerSessions.filter((s) => s.price != null);
                    const groups = new Map<string, any[]>();
                    for (const s of paid) {
                      const notes: string = s.notes ?? "";
                      const m = notes.match(/Plano\s+(\d+)\s+sess[õo]es/i);
                      const idm = notes.match(/\[([a-z0-9]{6,8})\]/i);
                      const key = m ? `plan:${m[1]}:${idm?.[1] ?? ""}` : "avulsas";
                      if (!groups.has(key)) groups.set(key, []);
                      groups.get(key)!.push(s);
                    }
                    const entries = [...groups.entries()].map(([key, list]) => ({
                      key,
                      list: [...list].sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at)),
                    }));
                    const plans = entries
                      .filter((e) => e.key !== "avulsas")
                      .sort((a, b) => +new Date(a.list[0].scheduled_at) - +new Date(b.list[0].scheduled_at));
                    const avulsas = entries.find((e) => e.key === "avulsas");
                    const blocks = [
                      ...plans.map((p, i) => ({ title: `Plano de Atendimento ${i + 1}`, list: p.list })),
                      ...(avulsas ? [{ title: "Sessões avulsas", list: avulsas.list }] : []),
                    ];
                    if (blocks.length === 0) {
                      return <p className="text-sm text-muted-foreground text-center py-6">Nenhum lançamento financeiro.</p>;
                    }
                    return blocks.map((b) => {
                      const total = b.list.reduce((sum, s) => sum + Number(s.price ?? 0), 0);
                      const pending = b.list.filter((s) => s.payment_status === "pending").length;
                      return (
                        <div key={b.title} className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-foreground">{b.title}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {b.list.length} sessõe{b.list.length === 1 ? "" : "s"}
                                {pending > 0 ? ` · ${pending} pendente${pending === 1 ? "" : "s"}` : " · quitado"}
                              </p>
                            </div>
                            <p className="font-display font-bold text-sm">R$ {total.toFixed(2)}</p>
                          </div>
                          <div className="space-y-2">
                            {b.list.map((s) => (
                              <div key={s.id} className="rounded-lg border border-border bg-background p-3 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm">{format(new Date(s.scheduled_at), "dd/MM/yyyy")}</p>
                                  {s.payment_due_date && (
                                    <p className="text-[11px] text-muted-foreground">
                                      Pgto previsto: {format(parse(s.payment_due_date, "yyyy-MM-dd", new Date()), "dd/MM/yyyy")}
                                    </p>
                                  )}
                                  <span className={cn(PILL_BASE, "mt-1", paymentStatusClass[s.payment_status as PaymentStatus])}>
                                    {paymentStatusLabel[s.payment_status as PaymentStatus]}
                                  </span>
                                </div>
                                <p className="font-display font-bold text-sm">R$ {Number(s.price).toFixed(2)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
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

      <PersonalEventDialog
        open={personalEventOpen}
        onOpenChange={setPersonalEventOpen}
        userId={user?.id}
        defaultDate={selectedDate}
        event={editingPersonalEvent}
        onSaved={reloadPersonalEvents}
      />


      {/* Revisão da mensagem antes de enviar no WhatsApp */}
      <Dialog open={!!confirmPreview} onOpenChange={(o) => !o && setConfirmPreview(null)}>
        <DialogContent className="w-[95vw] max-w-5xl min-h-[90vh] flex flex-col p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Revisar mensagem</DialogTitle>
            <DialogDescription>
              {confirmPreview
                ? `${confirmPreview.patientName} · sessão ${confirmPreview.modality}${confirmPreview.phone ? "" : " · sem telefone cadastrado"}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <Textarea
              value={confirmPreview?.message ?? ""}
              onChange={(e) => setConfirmPreview((p) => (p ? { ...p, message: e.target.value } : p))}
              className="flex-1 min-h-[12rem] text-sm font-sans resize-y"
            />
            <p className="text-xs text-muted-foreground">
              {confirmPreview?.modality === "online"
                ? "O link da chamada está incluído na mensagem."
                : "O endereço de atendimento está incluído na mensagem."}
            </p>
            {confirmHistory.length > 0 && (
              <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-1.5 max-h-48 overflow-y-auto">
                <p className="text-xs font-medium text-foreground">Envios anteriores</p>
                {confirmHistory.map((ev) => (
                  <p key={ev.id} className="text-xs text-muted-foreground">
                    {new Date(ev.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    {ev.modality === "online" ? "Online" : "Presencial"}
                    {" · "}
                    {ev.content_type === "meeting_link"
                      ? "link da chamada"
                      : ev.content_type === "clinic_address"
                        ? "endereço da clínica"
                        : "sem local"}
                    {" · "}
                    {ev.channel === "whatsapp" ? "WhatsApp" : "copiado"}
                  </p>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2 mt-4">
            <Button
              variant="ghost"
              onClick={() => setConfirmPreview((p) => (p ? { ...p, message: p.original } : p))}
            >
              Restaurar original
            </Button>
            <Button variant="outline" onClick={copyConfirmationPreview}>Copiar</Button>
            <Button onClick={sendConfirmationPreview} className="bg-[#25D366] hover:bg-[#1fb857] text-white">
              Enviar no WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Agenda;
