import { RefreshButton } from "@/components/app/RefreshButton";
import { HelpCard } from "@/components/app/HelpCard";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { BillingBadge } from "@/components/app/BillingBadge";
import {
  BILLING_LABEL,
  DUE_SOON_DAYS,
  computeBillingStatus,
  daysUntil,
  formatDue,
  type BillingInput,
  type BillingMode,
  type BillingStatus,
  isPendingCharge,
  isForecastCharge,
  isPlanNotes,
} from "@/lib/billing";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TrendingUp,
  Wallet,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Smartphone,
  CreditCard,
  Banknote,
  AlertTriangle,
  BellRing,
  Settings2,
  Users,
  ChevronDown,
  Sparkles,
  CalendarClock,
  BarChart3,
  Plus,
  FileWarning,
  PackageOpen,
  Receipt,
  MessageCircle,
  History as HistoryIcon,
} from "lucide-react";

import {
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  format,
  formatDistanceToNow,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { PageIntro } from "@/components/app/PageIntro";
import { PatientSessionHistory } from "@/components/app/PatientSessionHistory";
import { normalizePhoneForWhatsApp } from "@/utils/phoneNormalize";


type PaymentStatus = "pending" | "paid";
type PaymentMethod = "pix" | "card" | "cash";

type ReceitaSaudeStatus = "to_issue" | "issued";

interface Row {
  id: string;
  scheduled_at: string;
  status: string;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  payment_reference: string | null;
  receita_saude_status: ReceitaSaudeStatus | null;
  price: number | null;
  paid_at: string | null;
  session_type: string | null;
  notes: string | null;
  billing_sent_at: string | null;
  payment_due_date: string | null;
  patient: { id: string; full_name: string } | null;
  service: { name: string } | null;
}


// Recurrence detection (mirrors Agenda: recurring sessions are created with a
// "Plano N sessões (i/N)" marker in `notes`, and single-payment groups embed a
// short id as "[groupId]"). This is the only field that identifies a session
// created as recurring on the Agenda.
const isRecurringSession = (notes: string | null): boolean =>
  !!notes && /Plano \d+ sess/.test(notes);

const getSeriesKey = (row: { notes: string | null; patient?: { id: string } | null }): string | null => {
  const notes = row.notes;
  if (!notes) return null;
  const totalMatch = notes.match(/Plano (\d+) sess[õo]es/);
  if (!totalMatch) return null;
  const gidMatch = notes.match(/Pgto [úu]nico \[([^\]]+)\]/);
  if (gidMatch) return `gid::${gidMatch[1]}`;
  const pid = row.patient?.id ?? "—";
  return `pn::${pid}::${totalMatch[1]}`;
};

type ReceitaSaudeFilter = "all" | "to_issue" | "issued";

type FortnightFilter = "all" | "first" | "second";

const formatBRL = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

// ── Status da cobrança ────────────────────────────────────────────────
// Regras compartilhadas com a Agenda (src/lib/billing.ts).
const billingStatusOf = (
  list: Row[],
  soonDays: number = DUE_SOON_DAYS,
  mode: BillingMode = "per_session"
) => computeBillingStatus(list as unknown as BillingInput[], soonDays, mode);




const METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "PIX",
  card: "Cartão",
  cash: "Dinheiro",
};

const MethodIcon = ({ method, className }: { method: PaymentMethod; className?: string }) => {
  if (method === "pix") return <Smartphone className={className} />;
  if (method === "card") return <CreditCard className={className} />;
  return <Banknote className={className} />;
};

type QuickAlert = "none" | "receita_saude" | "sem_pagamento" | "pix_sem_conf" | "pacotes_vencendo";

const Finance = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [monthCursor, setMonthCursor] = useState<Date>(new Date());
  const [rawRows, setRawRows] = useState<Row[]>([]);
  const [patientFilter, setPatientFilter] = useState<string>("all");
  const rows = useMemo(
    () => (patientFilter === "all" ? rawRows : rawRows.filter((r) => r.patient?.id === patientFilter)),
    [rawRows, patientFilter]
  );
  const patientOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rawRows) {
      if (r.patient?.id && r.patient?.full_name) map.set(r.patient.id, r.patient.full_name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [rawRows]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [financeHistory, setFinanceHistory] = useState<{ id: string; name: string } | null>(null);
  // Drawer de baixa financeira (aberto ao clicar no card / "Ver detalhes")
  const [settle, setSettle] = useState<{
    key: string;
    name: string;
    patientId: string | null;
    isPlan: boolean;
    planValue: number;
    pago: number;
    emAberto: number;
    planSessions: number;
    unitPrice?: number;
    sessions: Row[];
  } | null>(null);
  const [settleSelected, setSettleSelected] = useState<Set<string>>(new Set());
  const [settling, setSettling] = useState(false);

  // Pagamentos atrasados (vindo do Painel via ?filter=atrasados): sessões passadas,
  // não canceladas, com pagamento pendente — mesma regra usada no indicador do Painel.
  const [overdueOpen, setOverdueOpen] = useState(false);
  const [overdueRows, setOverdueRows] = useState<
    { id: string; scheduled_at: string; price: number | null; patient: { id: string; full_name: string } | null }[]
  >([]);
  const [overdueLoading, setOverdueLoading] = useState(false);
  const [fortnightFilter, setFortnightFilter] = useState<FortnightFilter>("all");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderWindow, setReminderWindow] = useState(24);
  const [groupByPatient, setGroupByPatient] = useState(false);
  const [groupSort, setGroupSort] = useState<"recent" | "oldest" | "value" | "count" | "name">("recent");
  const [billingReminderEnabled, setBillingReminderEnabled] = useState(true);
  const [billingReminderDays, setBillingReminderDays] = useState(DUE_SOON_DAYS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const [savingPrefs, setSavingPrefs] = useState(false);
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());
  const [quickAlert, setQuickAlert] = useState<QuickAlert>("none");
  const [receitaSaudeFilter, setReceitaSaudeFilter] = useState<ReceitaSaudeFilter>("all");
  // Visualização principal em cards ("Sessões do Mês")
  const [billingFilter, setBillingFilter] = useState<"all" | "enviada" | "perto" | "vencida" | "a_enviar">("all");
  const [cardSort, setCardSort] = useState<"date" | "patient">("date");
  const notifiedIdsRef = useRef<Set<string>>(new Set());
  const billingNotifiedRef = useRef<Set<string>>(new Set());
  const billingSectionRef = useRef<HTMLElement | null>(null);

  // ── Histórico de lembretes de cobrança ───────────────────────────────
  type ReminderLog = {
    id: string;
    plan_key: string;
    plan_label: string | null;
    status: string;
    due_date: string | null;
    days_ahead: number | null;
    pending_value: number | string | null;
    channel: string;
    notified_at: string;
  };
  const [reminderLogs, setReminderLogs] = useState<ReminderLog[]>([]);
  const [reminderLogsVersion, setReminderLogsVersion] = useState(0);
  const [reminderHistoryPlan, setReminderHistoryPlan] = useState<{ key: string; name: string } | null>(null);

  // ── Dados para o envio de cobrança pelo WhatsApp (mesma lógica da Agenda) ──
  const [pixKey, setPixKey] = useState<string>("");
  const [psiName, setPsiName] = useState<string>("");
  const [psiCrp, setPsiCrp] = useState<string>("");
  type PatientContact = {
    phone: string | null;
    has_financial_responsible: boolean | null;
    financial_responsible_phone: string | null;
  };
  const [patientContacts, setPatientContacts] = useState<Record<string, PatientContact>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [prof, pats] = await Promise.all([
        supabase.from("profiles").select("full_name, crp, pix_key").eq("id", user.id).maybeSingle(),
        supabase
          .from("patients")
          .select("id, phone, has_financial_responsible, financial_responsible_phone")
          .eq("user_id", user.id),
      ]);
      if (prof.data) {
        setPsiName(prof.data.full_name ?? "");
        setPsiCrp(prof.data.crp ?? "");
        setPixKey(prof.data.pix_key ?? "");
      }
      if (pats.data) {
        const map: Record<string, PatientContact> = {};
        for (const p of pats.data as any[]) {
          map[p.id] = {
            phone: p.phone ?? null,
            has_financial_responsible: p.has_financial_responsible ?? null,
            financial_responsible_phone: p.financial_responsible_phone ?? null,
          };
        }
        setPatientContacts(map);
      }
    })();
  }, [user]);


  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("billing_reminder_logs")
        .select("id, plan_key, plan_label, status, due_date, days_ahead, pending_value, channel, notified_at")
        .eq("user_id", user.id)
        .order("notified_at", { ascending: false })
        .limit(500);
      if (!error && data) setReminderLogs(data as ReminderLog[]);
    })();
  }, [user, reminderLogsVersion]);

  const reminderLogsByPlan = useMemo(() => {
    const map = new Map<string, ReminderLog[]>();
    for (const l of reminderLogs) {
      const arr = map.get(l.plan_key) ?? [];
      arr.push(l);
      map.set(l.plan_key, arr);
    }
    return map;
  }, [reminderLogs]);



  const recentAlertRef = useRef<HTMLDivElement | null>(null);
  const sessionsSectionRef = useRef<HTMLElement | null>(null);

  // Distribuição de honorários (carteira ativa — independente do mês/filtros)
  type FeePatient = { id: string; name: string; price: number };
  const [feeBands, setFeeBands] = useState<{ low: FeePatient[]; mid: FeePatient[]; high: FeePatient[]; invalid: number; total: number }>({ low: [], mid: [], high: [], invalid: 0, total: 0 });
  const [feeBandOpen, setFeeBandOpen] = useState<null | "low" | "mid" | "high">(null);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, full_name, session_price")
        .eq("user_id", user.id)
        .eq("is_active", true);
      if (error || !data) return;
      const low: FeePatient[] = [], mid: FeePatient[] = [], high: FeePatient[] = [];
      let invalid = 0;
      const seen = new Set<string>();
      for (const p of data as Array<{ id: string; full_name: string | null; session_price: number | string | null }>) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        const v = p.session_price == null ? NaN : Number(p.session_price);
        if (!Number.isFinite(v) || v <= 0) { invalid++; continue; }
        const entry: FeePatient = { id: p.id, name: p.full_name || "Paciente", price: v };
        if (v <= 100) low.push(entry);
        else if (v <= 180) mid.push(entry);
        else high.push(entry);
      }
      const byName = (a: FeePatient, b: FeePatient) => a.name.localeCompare(b.name, "pt-BR");
      low.sort(byName); mid.sort(byName); high.sort(byName);
      setFeeBands({ low, mid, high, invalid, total: seen.size });
    })();
  }, [user]);


  const monthStart = useMemo(() => startOfMonth(monthCursor), [monthCursor]);
  const monthEnd = useMemo(() => endOfMonth(monthCursor), [monthCursor]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const selectCols = "id, scheduled_at, status, payment_status, payment_method, payment_reference, receita_saude_status, price, paid_at, is_expense, session_type, notes, billing_sent_at, payment_due_date, patient:patients!sessions_patient_id_fkey(id, full_name), service:services(name)";

    const { data, error } = await supabase
      .from("sessions")
      .select(selectCols)
      .eq("user_id", user.id)
      .gte("scheduled_at", monthStart.toISOString())
      .lte("scheduled_at", monthEnd.toISOString())
      .order("scheduled_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar dados financeiros.");
      setLoading(false);
      return;
    }
    setRawRows((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, monthCursor]);

  useAutoRefresh(() => { if (user) load(); }, { routePath: "/app/financeiro" });

  // ?filter=atrasados → abre a lista de pagamentos atrasados (todas as datas)
  useEffect(() => {
    if (searchParams.get("filter") === "atrasados") setOverdueOpen(true);
  }, [searchParams]);

  const loadOverdue = async () => {
    if (!user) return;
    setOverdueLoading(true);
    const { data } = await supabase
      .from("sessions")
      .select("id, scheduled_at, price, patient:patients!sessions_patient_id_fkey(id, full_name)")
      .eq("user_id", user.id)
      .eq("payment_status", "pending")
      .neq("status", "cancelled")
      .lt("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: false });
    setOverdueRows((data ?? []) as any);
    setOverdueLoading(false);
  };

  useEffect(() => {
    if (overdueOpen) loadOverdue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overdueOpen, user]);


  // Load reminder preferences from profile
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("reminder_enabled, reminder_window_hours, reminder_group_by_patient, reminder_group_sort, billing_reminder_enabled, billing_reminder_days")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setReminderEnabled(data.reminder_enabled ?? true);
        setReminderWindow(data.reminder_window_hours ?? 24);
        setGroupByPatient(data.reminder_group_by_patient ?? false);
        setBillingReminderEnabled((data as any).billing_reminder_enabled ?? true);
        setBillingReminderDays((data as any).billing_reminder_days ?? DUE_SOON_DAYS);
        const sort = data.reminder_group_sort as typeof groupSort | null;
        if (sort) setGroupSort(sort);
      }
      setPrefsLoaded(true);
    })();
  }, [user]);

  const savePrefs = async (next: {
    enabled?: boolean;
    window?: number;
    group?: boolean;
    sort?: typeof groupSort;
    billingEnabled?: boolean;
    billingDays?: number;
  }) => {
    if (!user) return;
    const enabled = next.enabled ?? reminderEnabled;
    const windowH = next.window ?? reminderWindow;
    const group = next.group ?? groupByPatient;
    const sort = next.sort ?? groupSort;
    const billingEnabled = next.billingEnabled ?? billingReminderEnabled;
    const billingDays = next.billingDays ?? billingReminderDays;
    setSavingPrefs(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        reminder_enabled: enabled,
        reminder_window_hours: windowH,
        reminder_group_by_patient: group,
        reminder_group_sort: sort,
        billing_reminder_enabled: billingEnabled,
        billing_reminder_days: billingDays,
      } as any)
      .eq("id", user.id);
    setSavingPrefs(false);
    if (error) {
      toast.error("Não foi possível salvar a preferência.");
      return;
    }
    // Reset notified set so toggling/changing window can re-notify
    notifiedIdsRef.current.clear();
    billingNotifiedRef.current.clear();
  };


  const billable = useMemo(() => rows.filter((r) => r.status === "completed"), [rows]);

  // ALL non-cancelled/no_show sessions = receita prevista (scheduled + confirmed + completed)
  const allValid = useMemo(
    () => rows.filter((r) => r.status !== "cancelled" && r.status !== "no_show"),
    [rows]
  );

  // Only scheduled/confirmed (not yet completed)
  const scheduled = useMemo(
    () => rows.filter((r) => r.status === "scheduled" || r.status === "confirmed"),
    [rows]
  );

  const fortnightFilter_ = (list: Row[]) => {
    if (fortnightFilter === "all") return list;
    return list.filter((r) => {
      const day = new Date(r.scheduled_at).getDate();
      return fortnightFilter === "first" ? day <= 15 : day > 15;
    });
  };

  const fortnightBillable = useMemo(() => fortnightFilter_(billable), [billable, fortnightFilter]);
  const fortnightScheduled = useMemo(() => fortnightFilter_(scheduled), [scheduled, fortnightFilter]);
  const fortnightAllValid = useMemo(() => fortnightFilter_(allValid), [allValid, fortnightFilter]);

  // Previsto = ALL non-cancelled sessions scheduled this month
  const totalPrevisto = fortnightAllValid.reduce((s, r) => s + Number(r.price ?? 0), 0);
  const totalFaturado = fortnightBillable.reduce((s, r) => s + Number(r.price ?? 0), 0);

  // 1) Recebido no período: pagamentos confirmados (payment_status='paid') cuja paid_at cai no período.
  //    Observação: usamos as linhas já carregadas (filtradas por scheduled_at no mês).
  //    Um pagamento antecipado feito em mês diferente do agendamento é contado no mês do agendamento.
  const monthStartMs = monthStart.getTime();
  const monthEndMs = monthEnd.getTime();
  const paidInPeriod = fortnightAllValid.filter(
    (r) => r.payment_status === "paid" && r.paid_at && (() => {
      const t = new Date(r.paid_at as string).getTime();
      return t >= monthStartMs && t <= monthEndMs;
    })()
  );
  const totalRecebido = paidInPeriod.reduce((s, r) => s + Number(r.price ?? 0), 0);
  const sessoesPagas = paidInPeriod.length;

  // 2) Receita realizada: sessões com status "completed" no período (independente de pagamento).
  const totalReceitaRealizada = fortnightBillable.reduce((s, r) => s + Number(r.price ?? 0), 0);
  const sessoesRealizadas = fortnightBillable.length;

  // 3) Saldo pago a realizar: pagamentos confirmados vinculados a sessões futuras ainda não realizadas.
  const futurePaidRows = fortnightAllValid.filter(
    (r) => r.payment_status === "paid" && (r.status === "scheduled" || r.status === "confirmed")
  );
  const totalSaldoPagoARealizar = futurePaidRows.reduce((s, r) => s + Number(r.price ?? 0), 0);
  const sessoesFuturasPagas = futurePaidRows.length;

  // 4) A receber = cobranças EM ABERTO (mesma regra dos cards "Sessões do Mês"):
  //    plano/pacote com cobrança pendente + sessão avulsa já realizada e não paga.
  //    Sessão avulsa futura não paga entra em "Previsto", nunca em "A receber".
  const chargeBase = useMemo(
    () => fortnightFilter_(rows.filter((r) => r.status !== "cancelled")),
    [rows, fortnightFilter]
  );
  const pendingRows = useMemo(() => chargeBase.filter((r) => isPendingCharge(r as any)), [chargeBase]);
  const totalAReceber = pendingRows.reduce((s, r) => s + Number(r.price ?? 0), 0);
  const sessoesPendentes = pendingRows.length;
  const forecastRows = useMemo(() => chargeBase.filter((r) => isForecastCharge(r as any)), [chargeBase]);
  const totalPrevistoAvulso = forecastRows.reduce((s, r) => s + Number(r.price ?? 0), 0);

  // 5) Receita prevista do mês
  const sessoesAgendadas = fortnightAllValid.length;

  // legado (mantido para compat de UI existente)
  const totalPendente = totalFaturado - fortnightBillable.filter((r) => r.payment_status === "paid").reduce((s, r) => s + Number(r.price ?? 0), 0);

  // Weekly chart data for the month
  const weeklyChartData = useMemo(() => {
    const weeks: { label: string; previsto: number; recebido: number; pendente: number }[] = [];
    const monthDays = monthEnd.getDate();
    const ranges = [
      { start: 1, end: 7, label: "Sem 1" },
      { start: 8, end: 14, label: "Sem 2" },
      { start: 15, end: 21, label: "Sem 3" },
      { start: 22, end: monthDays, label: "Sem 4" },
    ];
    for (const range of ranges) {
      const inRange = (r: Row) => {
        const d = new Date(r.scheduled_at).getDate();
        return d >= range.start && d <= range.end;
      };
      const weekAllValid = allValid.filter(inRange);
      const weekBillable = billable.filter(inRange);
      weeks.push({
        label: range.label,
        previsto: weekAllValid.reduce((s, r) => s + Number(r.price ?? 0), 0),
        recebido: weekBillable.filter((r) => r.payment_status === "paid").reduce((s, r) => s + Number(r.price ?? 0), 0),
        pendente: weekBillable.filter((r) => r.payment_status === "pending").reduce((s, r) => s + Number(r.price ?? 0), 0),
      });
    }
    return weeks;
  }, [rows, monthStart, monthEnd]);

  // Quinzenas — Recebido (pagamentos efetivos, pela DATA DO PAGAMENTO) x A receber
  // (sessões não canceladas e não pagas, pela DATA DA SESSÃO — independente de realizada ou não).
  // Respeita o filtro de paciente e o mês selecionado; independente do filtro de quinzena.
  const quinzenaChartData = useMemo(() => {
    const inPatient = (r: Row) => patientFilter === "all" || r.patient?.id === patientFilter;
    const sum = (arr: Row[]) => arr.reduce((s, r) => s + Number(r.price ?? 0), 0);

    const recebidoBase = allValid.filter(
      (r) =>
        r.payment_status === "paid" &&
        r.paid_at &&
        inPatient(r) &&
        (() => {
          const t = new Date(r.paid_at as string).getTime();
          return t >= monthStartMs && t <= monthEndMs;
        })()
    );
    const aReceberBase = allValid.filter(
      (r) =>
        r.payment_status !== "paid" &&
        r.status !== "cancelled" &&
        r.status !== "no_show" &&
        inPatient(r)
    );

    const isFirst = (d: Date) => d.getDate() <= 15;
    const lastDay = monthEnd.getDate();
    const rec1 = sum(recebidoBase.filter((r) => isFirst(new Date(r.paid_at as string))));
    const rec2 = sum(recebidoBase.filter((r) => !isFirst(new Date(r.paid_at as string))));
    const arec1 = sum(aReceberBase.filter((r) => isFirst(new Date(r.scheduled_at))));
    const arec2 = sum(aReceberBase.filter((r) => !isFirst(new Date(r.scheduled_at))));
    return {
      bars: [
        { name: "1ª quinzena", periodo: "01 a 15", recebido: rec1, aReceber: arec1 },
        { name: "2ª quinzena", periodo: `16 a ${lastDay}`, recebido: rec2, aReceber: arec2 },
      ],
      totalRecebido: rec1 + rec2,
      totalAReceber: arec1 + arec2,
    };
  }, [allValid, patientFilter, monthStartMs, monthEndMs, monthEnd]);

  // Service breakdown — agrupa por serviço/atendimento separando previsto x realizado.
  // Previsto = todas as sessões não canceladas/no_show. Realizado = sessões concluídas.
  const serviceBreakdown = useMemo(() => {
    const labelFor = (r: Row) => {
      const svcName = (r.service as any)?.name as string | undefined;
      if (svcName) return svcName;
      if (r.session_type === "supervision") return "Supervisão";
      if (r.session_type === "clinical") return "Atendimento Clínico";
      return "Outros";
    };
    const map = new Map<string, {
      name: string;
      previstoTotal: number; previstoCount: number;
      realizadoTotal: number; realizadoCount: number;
    }>();
    const ensure = (name: string) => {
      let e = map.get(name);
      if (!e) { e = { name, previstoTotal: 0, previstoCount: 0, realizadoTotal: 0, realizadoCount: 0 }; map.set(name, e); }
      return e;
    };
    fortnightAllValid.forEach((r) => {
      const e = ensure(labelFor(r));
      e.previstoTotal += Number(r.price ?? 0);
      e.previstoCount++;
    });
    fortnightBillable.forEach((r) => {
      const e = ensure(labelFor(r));
      e.realizadoTotal += Number(r.price ?? 0);
      e.realizadoCount++;
    });
    return Array.from(map.values()).sort((a, b) => b.previstoTotal - a.previstoTotal);
  }, [fortnightAllValid, fortnightBillable]);

  const missingReference = useMemo(
    () =>
      billable.filter(
        (r) =>
          r.payment_status === "paid" &&
          (r.payment_method === "pix" || r.payment_method === "card") &&
          (!r.payment_reference || r.payment_reference.trim().length === 0)
      ),
    [billable]
  );

  const receitaSaudeToIssue = useMemo(
    () => fortnightAllValid.filter((r) => r.receita_saude_status === "to_issue"),
    [fortnightAllValid]
  );

  // Volume de atendimentos — sessões não canceladas no período/quinzena
  const volumeRows = useMemo(
    () => fortnightFilter_(rows.filter((r) => r.status !== "cancelled")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, fortnightFilter]
  );

  // Planos de Atendimento no mês: séries recorrentes distintas com pelo
  // menos uma sessão no período (identificadas pelo marcador da Agenda em `notes`).
  const packagesStats = useMemo(() => {
    const seriesKeys = new Set<string>();
    let sessionsInPackages = 0;
    for (const r of volumeRows) {
      if (!isRecurringSession(r.notes)) continue;
      sessionsInPackages++;
      const key = getSeriesKey(r);
      if (key) seriesKeys.add(key);
    }
    return { count: seriesKeys.size, sessions: sessionsInPackages };
  }, [volumeRows]);

  // Sessões únicas no mês: agendamentos criados como sessão única na Agenda
  // (sem marcador de recorrência em `notes`).
  const avulsasStats = useMemo(() => {
    let count = 0;
    const patients = new Set<string>();
    for (const r of volumeRows) {
      if (isRecurringSession(r.notes)) continue;
      count++;
      const pid = r.patient?.id ?? r.patient?.full_name;
      if (pid) patients.add(pid);
    }
    return { count, patients: patients.size };
  }, [volumeRows]);



  const recentMissing = useMemo(() => {
    if (!reminderEnabled) return [];
    const cutoff = Date.now() - reminderWindow * 60 * 60 * 1000;
    return missingReference.filter((r) => {
      const ref = r.paid_at ?? r.scheduled_at;
      return ref ? new Date(ref).getTime() >= cutoff : false;
    });
  }, [missingReference, reminderEnabled, reminderWindow]);

  const olderMissing = useMemo(() => {
    const recentIds = new Set(recentMissing.map((r) => r.id));
    return missingReference.filter((r) => !recentIds.has(r.id));
  }, [missingReference, recentMissing]);

  // Group recent missing by patient + sort according to user preference
  const recentGrouped = useMemo(() => {
    const map = new Map<string, { name: string; rows: Row[] }>();
    for (const r of recentMissing) {
      const key = r.patient?.full_name ?? "—";
      const entry = map.get(key);
      if (entry) entry.rows.push(r);
      else map.set(key, { name: key, rows: [r] });
    }
    const enriched = Array.from(map.entries()).map(([key, v]) => {
      const totalValue = v.rows.reduce((s, r) => s + Number(r.price ?? 0), 0);
      const timestamps = v.rows.map((r) => new Date(r.paid_at ?? r.scheduled_at).getTime());
      return {
        key,
        name: v.name,
        rows: v.rows,
        totalValue,
        count: v.rows.length,
        latest: Math.max(...timestamps),
        earliest: Math.min(...timestamps),
      };
    });
    const sorted = [...enriched];
    switch (groupSort) {
      case "oldest":
        sorted.sort((a, b) => a.earliest - b.earliest);
        break;
      case "value":
        sorted.sort((a, b) => b.totalValue - a.totalValue || b.latest - a.latest);
        break;
      case "count":
        sorted.sort((a, b) => b.count - a.count || b.latest - a.latest);
        break;
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
        break;
      case "recent":
      default:
        sorted.sort((a, b) => b.latest - a.latest);
    }
    return sorted;
  }, [recentMissing, groupSort]);

  const togglePatientExpanded = (key: string) => {
    setExpandedPatients((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Auto-reminder toast for paid PIX/card sessions in the configured window missing reference
  useEffect(() => {
    if (loading || !prefsLoaded || !reminderEnabled) return;
    const newOnes = recentMissing.filter((r) => !notifiedIdsRef.current.has(r.id));
    if (newOnes.length === 0) return;

    newOnes.forEach((r) => notifiedIdsRef.current.add(r.id));

    const windowLabel =
      reminderWindow === 24
        ? "24h"
        : reminderWindow < 24
        ? `${reminderWindow}h`
        : `${Math.round(reminderWindow / 24)}d`;

    if (groupByPatient) {
      // Group new ones by patient for the toast description
      const byPatient = new Map<string, number>();
      for (const r of newOnes) {
        const name = r.patient?.full_name ?? "Paciente";
        byPatient.set(name, (byPatient.get(name) ?? 0) + 1);
      }
      const summary = Array.from(byPatient.entries())
        .slice(0, 3)
        .map(([n, c]) => (c > 1 ? `${n} (${c})` : n))
        .join(", ");
      const extra = byPatient.size > 3 ? ` e mais ${byPatient.size - 3} paciente(s)` : "";

      toast.warning(
        byPatient.size === 1
          ? `Pagamentos sem referência: ${Array.from(byPatient.keys())[0]}`
          : `${byPatient.size} pacientes com pagamentos sem referência`,
        {
          description: `${summary}${extra} · ${newOnes.length} sessão(ões) nas últimas ${windowLabel} via PIX/cartão.`,
          duration: 8000,
          action: {
            label: "Revisar",
            onClick: () =>
              recentAlertRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
          },
        }
      );
    } else {
      const names = newOnes
        .slice(0, 2)
        .map((r) => r.patient?.full_name ?? "Paciente")
        .join(", ");
      const extra = newOnes.length > 2 ? ` e mais ${newOnes.length - 2}` : "";

      toast.warning(
        newOnes.length === 1
          ? "Pagamento recente sem referência"
          : `${newOnes.length} pagamentos recentes sem referência`,
        {
          description: `${names}${extra} · marcado(s) como pago(s) nas últimas ${windowLabel} via PIX/cartão.`,
          duration: 8000,
          action: {
            label: "Revisar",
            onClick: () =>
              recentAlertRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
          },
        }
      );
    }
  }, [recentMissing, loading, prefsLoaded, reminderEnabled, reminderWindow, groupByPatient]);


  const updatePayment = async (id: string, value: PaymentStatus) => {
    const { error } = await supabase
      .from("sessions")
      .update({
        payment_status: value,
        paid_at: value === "paid" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) {
      toast.error("Não foi possível atualizar.");
      return;
    }
    toast.success(value === "paid" ? "Sessão marcada como paga." : "Sessão marcada como pendente.");
    load();
  };

  /** Dá baixa (ou reabre) o pagamento de todas as sessões da mesma cobrança. */
  const updatePaymentGroup = async (ids: string[], value: PaymentStatus) => {
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("sessions")
      .update({
        payment_status: value,
        paid_at: value === "paid" ? new Date().toISOString() : null,
      })
      .in("id", ids);
    if (error) {
      toast.error("Não foi possível atualizar o pagamento.");
      return;
    }
    toast.success(
      value === "paid"
        ? ids.length > 1 ? `${ids.length} sessões marcadas como pagas.` : "Sessão marcada como paga."
        : "Pagamento marcado como pendente."
    );
    load();
  };

  /** Atualiza a situação da Receita Saúde de todas as sessões da cobrança. */
  const updateReceitaSaudeGroup = async (ids: string[], value: ReceitaSaudeStatus | null) => {
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("sessions")
      .update({ receita_saude_status: value })
      .in("id", ids);
    if (error) {
      toast.error("Não foi possível atualizar a Receita Saúde.");
      return;
    }
    toast.success(
      value === "issued" ? "Receita Saúde marcada como emitida." :
      value === "to_issue" ? "Receita Saúde marcada como não emitida." :
      "Receita Saúde marcada como não se aplica."
    );
    load();
  };



  // ── Planos de Atendimento concluídos → cobrança ──────────────────────
  // Um plano é considerado concluído quando todas as sessões da série já
  // foram realizadas (e o total previsto no plano foi cumprido).
  type PlanBilling = {
    key: string;
    name: string;
    patientId: string | null;
    sessions: Row[];
    sessionsCount: number;
    totalDeclared: number;
    totalValue: number;
    pendingValue: number;
    status: BillingStatus;
    dueDate: string | null;
    sentAt: string | null;
    lastSessionAt: string;
  };

  const planBillings: PlanBilling[] = useMemo(() => {
    const base = fortnightFilter_(rows.filter((r) => r.status !== "cancelled" && isRecurringSession(r.notes)));
    const map = new Map<string, Row[]>();
    for (const r of base) {
      const k = getSeriesKey(r);
      if (!k) continue;
      const arr = map.get(k) ?? [];
      arr.push(r);
      map.set(k, arr);
    }
    const out: PlanBilling[] = [];
    for (const [key, list] of map) {
      const declared = Number(list[0].notes?.match(/Plano (\d+) sess/)?.[1] ?? list.length);
      const allDone = list.every((r) => r.status === "completed");
      if (!allDone || list.length < declared) continue;
      const { status, dueDate, sentAt } = billingStatusOf(list, billingReminderDays, "plan");
      out.push({
        key,
        name: list[0].patient?.full_name ?? "—",
        patientId: list[0].patient?.id ?? null,
        sessions: list,
        sessionsCount: list.length,
        totalDeclared: declared,
        totalValue: list.reduce((s, r) => s + Number(r.price ?? 0), 0),
        pendingValue: list.filter((r) => r.payment_status === "pending").reduce((s, r) => s + Number(r.price ?? 0), 0),
        status,
        dueDate,
        sentAt,
        lastSessionAt: list.map((r) => r.scheduled_at).sort().pop()!,
      });
    }
    const order: Record<BillingStatus, number> = { vencida: 0, perto: 1, a_enviar: 2, enviada: 3, pago: 4, na: 5 };
    return out.sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name, "pt-BR"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, fortnightFilter, billingReminderDays]);

  const planBillingStats = useMemo(() => {
    const count = (s: BillingStatus) => planBillings.filter((p) => p.status === s).length;
    return {
      enviadas: planBillings.filter((p) => p.status === "enviada" || p.status === "perto" || p.status === "vencida").length,
      perto: count("perto"),
      vencidas: count("vencida"),
      aEnviar: count("a_enviar"),
      pagos: count("pago"),
      emAberto: planBillings.reduce((s, p) => s + p.pendingValue, 0),
    };
  }, [planBillings]);

  // ── Lembrete automático de cobranças perto do vencimento ─────────────
  // Ao abrir o Financeiro, avisa (toast + notificação no sininho) sobre os
  // planos que vencem dentro da janela configurada ou já vencidos.
  // Cada plano é notificado uma vez por dia por vencimento.
  useEffect(() => {
    if (loading || !prefsLoaded || !billingReminderEnabled || !user) return;
    const alerts = planBillings.filter((p) => p.status === "perto" || p.status === "vencida");
    if (alerts.length === 0) return;

    const todayKey = new Date().toISOString().slice(0, 10);
    const storageKey = `psireal_billing_reminder_${user.id}`;
    let sent: Record<string, string> = {};
    try {
      sent = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
    } catch {
      sent = {};
    }

    const novos = alerts.filter((p) => {
      const memo = `${todayKey}::${p.dueDate ?? "sem-data"}::${p.status}`;
      if (billingNotifiedRef.current.has(p.key)) return false;
      return sent[p.key] !== memo;
    });
    if (novos.length === 0) return;

    novos.forEach((p) => {
      billingNotifiedRef.current.add(p.key);
      sent[p.key] = `${todayKey}::${p.dueDate ?? "sem-data"}::${p.status}`;
    });
    try {
      localStorage.setItem(storageKey, JSON.stringify(sent));
    } catch {
      /* storage indisponível — o aviso ainda aparece nesta sessão */
    }

    const vencidas = novos.filter((p) => p.status === "vencida");
    const titulo = vencidas.length === novos.length
      ? `${novos.length} ${novos.length === 1 ? "cobrança vencida" : "cobranças vencidas"}`
      : `${novos.length} ${novos.length === 1 ? "cobrança perto do vencimento" : "cobranças perto do vencimento"}`;
    const detalhe = novos
      .map((p) => `${p.name}${p.dueDate ? ` · vence ${formatDue(p.dueDate)}` : ""}`)
      .slice(0, 4)
      .join(" · ");

    toast.warning(titulo, {
      description: detalhe + (novos.length > 4 ? ` · +${novos.length - 4}` : ""),
      duration: 9000,
      action: {
        label: "Ver cobranças",
        onClick: () => billingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
      },
    });

    // Notificação persistente no sininho
    supabase
      .from("notifications")
      .insert(
        novos.map((p) => ({
          user_id: user.id,
          title: p.status === "vencida" ? "Cobrança vencida" : "Cobrança perto do vencimento",
          message: `${p.name} · Plano de ${p.totalDeclared} sessões · ${formatBRL(p.pendingValue)}${p.dueDate ? ` · vencimento ${formatDue(p.dueDate)}` : ""}`,
          type: "general" as const,
        }))
      )
      .then(({ error }) => {
        if (error) console.warn("Não foi possível registrar a notificação de cobrança:", error.message);
      });

    // Histórico de lembretes (quando avisou e com qual antecedência)
    logBillingReminders(novos, "auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planBillings, loading, prefsLoaded, billingReminderEnabled, billingReminderDays, user]);

  /** Grava no histórico cada aviso de cobrança disparado. */
  const logBillingReminders = async (plans: PlanBilling[], channel: "auto" | "manual") => {
    if (!user || plans.length === 0) return;
    const { error } = await supabase.from("billing_reminder_logs").insert(
      plans.map((p) => ({
        user_id: user.id,
        patient_id: p.patientId,
        plan_key: p.key,
        plan_label: `${p.name} · Plano de ${p.totalDeclared} sessões`,
        status: p.status,
        due_date: p.dueDate,
        days_ahead: p.dueDate ? daysUntil(p.dueDate) : null,
        pending_value: p.pendingValue,
        channel,
      }))
    );
    if (error) {
      console.warn("Não foi possível registrar o histórico do lembrete:", error.message);
      return;
    }
    setReminderLogsVersion((v) => v + 1);
  };

  const markBillingSent = async (plan: PlanBilling) => {
    const nowIso = new Date().toISOString();
    const pending = plan.sessions.filter((r) => r.payment_status === "pending");
    const ids = (pending.length ? pending : plan.sessions).map((r) => r.id);
    const due = new Date();
    due.setDate(due.getDate() + 7);
    const dueStr = plan.dueDate ?? due.toISOString().slice(0, 10);
    const { error } = await supabase
      .from("sessions")
      .update({ billing_sent_at: nowIso, payment_due_date: dueStr } as any)
      .in("id", ids);
    if (error) {
      toast.error("Não foi possível registrar o envio da cobrança.");
      return;
    }
    await logBillingReminders([{ ...plan, dueDate: dueStr }], "manual");
    toast.success(`Cobrança registrada como enviada · vence em ${formatDue(dueStr)}`);
    load();
  };

  /**
   * Envio (ou reenvio) de cobrança pelo WhatsApp.
   * Reutiliza o mesmo modelo de mensagem da Agenda e o mesmo registro
   * financeiro (sessions.billing_sent_at + billing_reminder_logs).
   */
  const sendBillingWhatsApp = async (args: {
    key: string;
    name: string;
    patientId: string | null;
    sessions: Row[];
    dueDate: string | null;
    status: BillingStatus;
    isResend: boolean;
    isPlan?: boolean;
  }) => {
    const { key, name, patientId, sessions: list, isResend, isPlan } = args;
    if (!user || list.length === 0) return;

    // Plano/pacote: cobra o valor do plano (inclui sessões futuras contratadas).
    // Sessão avulsa: cobra apenas sessões realizadas e ainda não pagas.
    const cobravel = isPlan
      ? list.filter((r) => r.status !== "cancelled")
      : list.filter((r) => r.status === "completed");
    const pending = cobravel.filter((r) => r.payment_status === "pending");
    const target = pending.length ? pending : cobravel;
    if (target.length === 0) {
      toast.info(
        isPlan
          ? "Nada a cobrar: este plano já está quitado."
          : "Nada a cobrar: não há sessões realizadas pendentes."
      );
      return;
    }
    const ids = target.map((r) => r.id);
    const valueNumber = target.reduce((s, r) => s + Number(r.price ?? 0), 0);
    const value = valueNumber > 0 ? formatBRL(valueNumber) : "a combinar";
    const dates = target
      .slice()
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
      .map((r) => format(new Date(r.scheduled_at), "dd/MM/yyyy"));

    // Vencimento: mantém o existente ou define 7 dias a partir de hoje
    let dueStr = args.dueDate;
    if (!dueStr) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      dueStr = d.toISOString().slice(0, 10);
    }

    const firstName = psiName ? psiName.split(" ")[0] : "";
    const sessionLine =
      target.length > 1
        ? `Passando para lembrar do acerto referente às nossas ${target.length} sessões de ${dates.join(", ")}.`
        : `Passando para lembrar do acerto referente à nossa sessão de ${dates[0]}.`;
    const message = [
      `Olá, ${name}! Aqui é a sua psi, ${firstName || "sua psicóloga"}.`,
      "",
      sessionLine,
      "",
      `Valor: ${value}`,
      `Vencimento: ${formatDue(dueStr)}`,
      pixKey ? `Chave Pix: ${pixKey}` : "",
      "",
      "Assim que realizar, pode me enviar o comprovante por aqui. Qualquer dúvida, fico à disposição!",
      "",
      psiName || "",
      psiCrp ? `Psicóloga | CRP ${psiCrp}` : "Psicóloga",
    ]
      .filter(Boolean)
      .join("\n");

    const contact = patientId ? patientContacts[patientId] : undefined;
    const phone =
      (contact?.has_financial_responsible && contact?.financial_responsible_phone
        ? normalizePhoneForWhatsApp(contact.financial_responsible_phone)
        : normalizePhoneForWhatsApp(contact?.phone ?? null)) ?? "";

    let channel: "whatsapp" | "clipboard" = "whatsapp";
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
    } else {
      channel = "clipboard";
      try {
        await navigator.clipboard.writeText(message);
        toast.info("Paciente sem telefone cadastrado — mensagem copiada.");
      } catch {
        toast.error("Paciente sem telefone cadastrado.");
      }
    }

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("sessions")
      .update({ billing_sent_at: nowIso, payment_due_date: dueStr } as any)
      .in("id", ids);
    if (error) {
      toast.error("Não foi possível registrar o envio da cobrança.");
      return;
    }

    const { error: logError } = await supabase.from("billing_reminder_logs").insert({
      user_id: user.id,
      patient_id: patientId,
      plan_key: key,
      plan_label: `${name} · ${target.length} ${target.length === 1 ? "sessão" : "sessões"}`,
      status: args.status,
      due_date: dueStr,
      days_ahead: daysUntil(dueStr),
      pending_value: valueNumber,
      channel,
    });
    if (logError) console.warn("Não foi possível registrar o histórico do envio:", logError.message);

    setReminderLogsVersion((v) => v + 1);
    toast.success(isResend ? "Cobrança reenviada e registrada" : "Cobrança enviada e registrada", {
      description: `Vencimento ${formatDue(dueStr)}`,
    });
    load();
  };



  const updatePlanDueDate = async (plan: PlanBilling, value: string) => {
    const ids = plan.sessions.filter((r) => r.payment_status === "pending").map((r) => r.id);
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("sessions")
      .update({ payment_due_date: value || null } as any)
      .in("id", ids);
    if (error) {
      toast.error("Não foi possível salvar o vencimento.");
      return;
    }
    load();
  };

  const markPlanPaid = async (plan: PlanBilling) => {
    const ids = plan.sessions.filter((r) => r.payment_status === "pending").map((r) => r.id);
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("sessions")
      .update({ payment_status: "paid", paid_at: new Date().toISOString() })
      .in("id", ids);
    if (error) {
      toast.error("Não foi possível atualizar o pagamento.");
      return;
    }
    toast.success("Plano de Atendimento marcado como pago.");
    load();
  };

  /** Sessões que podem receber baixa: qualquer sessão pendente não cancelada
   *  (inclui sessões agendadas — pagamento antecipado é permitido). */
  const settleableSessions = (g: { isPlan: boolean; sessions: Row[] }) =>
    g.sessions
      .filter((r) => r.payment_status === "pending" && r.status !== "cancelled")
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));


  const openSettle = (g: NonNullable<typeof settle>) => {
    setSettle(g);
    setSettleSelected(new Set(settleableSessions(g).map((r) => r.id)));
  };

  /** Registra pagamento das sessões informadas (sem duplicar: só pendentes). */
  const settlePayment = async (ids: string[], label: string) => {
    if (ids.length === 0) return;
    setSettling(true);
    const { error } = await supabase
      .from("sessions")
      .update({ payment_status: "paid", paid_at: new Date().toISOString() })
      .in("id", ids)
      .eq("payment_status", "pending");
    setSettling(false);
    if (error) {
      toast.error("Não foi possível registrar o pagamento.");
      return;
    }
    toast.success(label);
    setSettle(null);
    setSettleSelected(new Set());
    load();
  };




  return (
    <div className="space-y-8 animate-fade-up">
      <HelpCard
        id="financeiro"
        title="Financeiro"
        description="Acompanhe pagamentos, sessões faturadas, cobranças e indicadores financeiros da clínica."
        sections={[
          { label: "Quando usar", content: "Semanalmente para conferir recebimentos, marcar pagamentos e enviar cobranças; mensalmente para conciliar a Receita Saúde." },
          { label: "Conexões", content: "Alimentado pelas sessões da Agenda e pelos valores cadastrados em cada paciente. As alterações refletem no histórico financeiro de cada ficha." },
        ]}
      />
      <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex items-start gap-3 sm:gap-4 min-w-0">
          <span className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Wallet className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground">Financeiro</h1>
            <p className="mt-1.5 text-sm md:text-base text-muted-foreground max-w-2xl">
              Gestão de pagamentos, recebimentos e Receita Saúde.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <RefreshButton />

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Filtros
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Período do mês</Label>
                <Tabs value={fortnightFilter} onValueChange={(v) => setFortnightFilter(v as FortnightFilter)}>
                  <TabsList className="w-full">
                    <TabsTrigger className="flex-1" value="all">Mês todo</TabsTrigger>
                    <TabsTrigger className="flex-1" value="first">1ª quinz.</TabsTrigger>
                    <TabsTrigger className="flex-1" value="second">2ª quinz.</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="space-y-2">
                <Label htmlFor="receita-saude-filter" className="text-xs text-muted-foreground">Receita Saúde</Label>
                <Select value={receitaSaudeFilter} onValueChange={(v) => setReceitaSaudeFilter(v as ReceitaSaudeFilter)}>
                  <SelectTrigger id="receita-saude-filter" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="to_issue">A emitir</SelectItem>
                    <SelectItem value="issued">Emitido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="patient-filter" className="text-xs text-muted-foreground">Paciente</Label>
                <Select value={patientFilter} onValueChange={setPatientFilter}>
                  <SelectTrigger id="patient-filter" className="h-9">
                    <SelectValue placeholder="Todos os pacientes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os pacientes</SelectItem>
                    {patientOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(fortnightFilter !== "all" || receitaSaudeFilter !== "all" || patientFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => { setFortnightFilter("all"); setReceitaSaudeFilter("all"); setPatientFilter("all"); }}
                >
                  Limpar filtros
                </Button>
              )}
            </PopoverContent>
          </Popover>


          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" title="Preferências do lembrete">
                <Settings2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-sm">Lembrete automático</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Avisa sobre pagamentos PIX/cartão sem referência.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="reminder-enabled" className="text-sm">Ativar toast e banner</Label>
                    <p className="text-xs text-muted-foreground">
                      Mostra notificação ao abrir e destaca no topo.
                    </p>
                  </div>
                  <Switch
                    id="reminder-enabled"
                    checked={reminderEnabled}
                    disabled={!prefsLoaded || savingPrefs}
                    onCheckedChange={(v) => {
                      setReminderEnabled(v);
                      savePrefs({ enabled: v });
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reminder-window" className="text-sm">
                    Janela considerada recente
                  </Label>
                  <Select
                    value={String(reminderWindow)}
                    disabled={!prefsLoaded || !reminderEnabled || savingPrefs}
                    onValueChange={(v) => {
                      const n = Number(v);
                      setReminderWindow(n);
                      savePrefs({ window: n });
                    }}
                  >
                    <SelectTrigger id="reminder-window">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Última hora</SelectItem>
                      <SelectItem value="6">Últimas 6 horas</SelectItem>
                      <SelectItem value="12">Últimas 12 horas</SelectItem>
                      <SelectItem value="24">Últimas 24 horas</SelectItem>
                      <SelectItem value="48">Últimos 2 dias</SelectItem>
                      <SelectItem value="72">Últimos 3 dias</SelectItem>
                      <SelectItem value="168">Últimos 7 dias</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Pagamentos mais antigos continuam no alerta secundário.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1 border-t border-border">
                  <div className="space-y-0.5">
                    <Label htmlFor="reminder-group" className="text-sm">Agrupar por paciente</Label>
                    <p className="text-xs text-muted-foreground">
                      Junta sessões do mesmo paciente em uma linha.
                    </p>
                  </div>
                  <Switch
                    id="reminder-group"
                    checked={groupByPatient}
                    disabled={!prefsLoaded || !reminderEnabled || savingPrefs}
                    onCheckedChange={(v) => {
                      setGroupByPatient(v);
                      setExpandedPatients(new Set());
                      savePrefs({ group: v });
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reminder-group-sort" className="text-sm">
                    Ordenar pacientes por
                  </Label>
                  <Select
                    value={groupSort}
                    disabled={!prefsLoaded || !reminderEnabled || !groupByPatient || savingPrefs}
                    onValueChange={(v) => {
                      const next = v as typeof groupSort;
                      setGroupSort(next);
                      savePrefs({ sort: next });
                    }}
                  >
                    <SelectTrigger id="reminder-group-sort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Mais recente primeiro</SelectItem>
                      <SelectItem value="oldest">Mais antigo primeiro</SelectItem>
                      <SelectItem value="value">Maior valor total</SelectItem>
                      <SelectItem value="count">Mais sessões pendentes</SelectItem>
                      <SelectItem value="name">Nome (A–Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-3 border-t border-border space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="billing-reminder" className="text-sm">Lembrete de cobrança</Label>
                      <p className="text-xs text-muted-foreground">
                        Avisa quando um Plano de Atendimento concluído está perto do vencimento.
                      </p>
                    </div>
                    <Switch
                      id="billing-reminder"
                      checked={billingReminderEnabled}
                      disabled={!prefsLoaded || savingPrefs}
                      onCheckedChange={(v) => {
                        setBillingReminderEnabled(v);
                        savePrefs({ billingEnabled: v });
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="billing-reminder-days" className="text-sm">Avisar com antecedência de</Label>
                    <Select
                      value={String(billingReminderDays)}
                      disabled={!prefsLoaded || !billingReminderEnabled || savingPrefs}
                      onValueChange={(v) => {
                        const n = Number(v);
                        setBillingReminderDays(n);
                        billingNotifiedRef.current.clear();
                        savePrefs({ billingDays: n });
                      }}
                    >
                      <SelectTrigger id="billing-reminder-days">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 dia antes</SelectItem>
                        <SelectItem value="2">2 dias antes</SelectItem>
                        <SelectItem value="3">3 dias antes</SelectItem>
                        <SelectItem value="5">5 dias antes</SelectItem>
                        <SelectItem value="7">7 dias antes</SelectItem>
                        <SelectItem value="10">10 dias antes</SelectItem>
                        <SelectItem value="15">15 dias antes</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Cobranças vencidas continuam sendo avisadas todos os dias.
                    </p>
                  </div>
                </div>
              </div>

            </PopoverContent>
          </Popover>
        </div>
      </header>


      {/* Drawer lateral com pacientes por faixa de honorários */}
      <Sheet open={feeBandOpen !== null} onOpenChange={(o) => !o && setFeeBandOpen(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {feeBandOpen === "low" && "Honorários — Até R$ 100,00"}
              {feeBandOpen === "mid" && "Honorários — R$ 100,01 a R$ 180,00"}
              {feeBandOpen === "high" && "Honorários — Acima de R$ 180,00"}
            </SheetTitle>
            <SheetDescription>
              {feeBandOpen ? `${feeBands[feeBandOpen].length} paciente(s) ativo(s) nesta faixa` : ""}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
            <ul className="divide-y divide-border">
              {feeBandOpen && feeBands[feeBandOpen].map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => { setFeeBandOpen(null); navigate(`/app/pacientes?patient=${p.id}`); }}
                    className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-muted/60 rounded-md px-2 -mx-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="text-sm font-medium truncate">{p.name}</span>
                    <span className="text-sm tabular-nums text-muted-foreground shrink-0">
                      {p.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </SheetContent>
      </Sheet>







      {recentMissing.length > 0 && (
        <Alert
          ref={recentAlertRef}
          variant="destructive"
          className="border-destructive bg-destructive/10 shadow-soft"
        >
          <BellRing className="h-4 w-4 animate-pulse" />
          <AlertTitle>Lembrete: pagamentos recentes sem referência</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              {recentMissing.length === 1
                ? `1 sessão foi marcada como paga via PIX/cartão nas últimas ${reminderWindow}h sem referência. Adicione o comprovante enquanto a transação ainda está fresca:`
                : `${recentMissing.length} sessões foram marcadas como pagas via PIX/cartão nas últimas ${reminderWindow}h sem referência. Adicione os comprovantes enquanto as transações ainda estão frescas:`}
            </p>
            {groupByPatient ? (
              <ul className="text-sm space-y-1 mt-2">
                {recentGrouped.slice(0, 5).map((g, idx) => {
                  const expanded = expandedPatients.has(g.key);
                  const first = g.rows[0];
                  const totalValue = g.rows.reduce((s, r) => s + Number(r.price ?? 0), 0);
                  const isPriority = idx === 0 && recentGrouped.length > 1;
                  const priorityReason =
                    groupSort === "value"
                      ? "Maior valor"
                      : groupSort === "count"
                      ? "Mais sessões"
                      : groupSort === "oldest"
                      ? "Mais antigo"
                      : groupSort === "name"
                      ? "Próximo na lista"
                      : "Mais recente";
                  return (
                    <li
                      key={g.key}
                      className={
                        isPriority
                          ? "rounded-md border-2 border-destructive bg-destructive/15 ring-2 ring-destructive/30 shadow-sm animate-fade-up"
                          : "rounded-md border border-destructive/30 bg-background/40"
                      }
                    >
                      <div className="flex items-center justify-between gap-3 p-2">
                        <button
                          type="button"
                          onClick={() => g.rows.length > 1 && togglePatientExpanded(g.key)}
                          className={`flex items-center gap-2 min-w-0 text-left ${g.rows.length > 1 ? "cursor-pointer" : "cursor-default"}`}
                          aria-expanded={expanded}
                        >
                          {isPriority ? (
                            <Sparkles className="h-3.5 w-3.5 shrink-0 text-destructive animate-pulse" />
                          ) : (
                            <Users className="h-3.5 w-3.5 shrink-0 opacity-70" />
                          )}
                          <span className="truncate">
                            <span className={isPriority ? "font-semibold" : "font-medium"}>{g.name}</span>
                            {isPriority && (
                              <span className="ml-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold uppercase tracking-wide">
                                Prioridade
                              </span>
                            )}
                            <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full bg-destructive/15 text-[10px] font-semibold">
                              {g.rows.length}
                            </span>
                            <span className="ml-2 text-xs opacity-80">
                              {formatBRL(totalValue)} · há {formatDistanceToNow(new Date(first.paid_at ?? first.scheduled_at), { locale: ptBR })}
                            </span>
                            {isPriority && (
                              <span className="block text-[11px] text-destructive/90 mt-0.5">
                                {priorityReason} · comece por aqui
                              </span>
                            )}
                          </span>
                          {g.rows.length > 1 && (
                            <ChevronDown
                              className={`h-3.5 w-3.5 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                            />
                          )}
                        </button>
                        {g.rows.length === 1 ? (
                          <Button
                            variant={isPriority ? "hero" : "outline"}
                            size="sm"
                            className="shrink-0"
                            onClick={() => setEditing(first)}
                          >
                            Adicionar referência
                          </Button>
                        ) : (
                          <Button
                            variant={isPriority ? "hero" : "outline"}
                            size="sm"
                            className="shrink-0"
                            onClick={() => setEditing(first)}
                            title="Corrigir a primeira sessão deste paciente"
                          >
                            Corrigir 1ª
                          </Button>
                        )}
                      </div>
                      {expanded && g.rows.length > 1 && (
                        <ul className="border-t border-destructive/20 divide-y divide-destructive/10">
                          {g.rows.map((r) => {
                            const when = r.paid_at ?? r.scheduled_at;
                            return (
                              <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
                                <span className="truncate">
                                  {r.payment_method === "pix" ? "PIX" : "Cartão"}
                                  {" · "}
                                  {formatBRL(Number(r.price ?? 0))}
                                  {" · há "}
                                  {formatDistanceToNow(new Date(when), { locale: ptBR })}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="shrink-0 h-7"
                                  onClick={() => setEditing(r)}
                                >
                                  Corrigir
                                </Button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
                {recentGrouped.length > 5 && (
                  <li className="text-xs opacity-80">+ {recentGrouped.length - 5} paciente(s)…</li>
                )}
              </ul>
            ) : (
              <ul className="text-sm space-y-1 mt-2">
                {recentMissing.slice(0, 5).map((r) => {
                  const when = r.paid_at ?? r.scheduled_at;
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-3">
                      <span className="truncate">
                        <span className="font-medium">{r.patient?.full_name ?? "—"}</span>
                        {" · "}
                        {r.payment_method === "pix" ? "PIX" : "Cartão"}
                        {" · há "}
                        {formatDistanceToNow(new Date(when), { locale: ptBR })}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => setEditing(r)}
                      >
                        Adicionar referência
                      </Button>
                    </li>
                  );
                })}
                {recentMissing.length > 5 && (
                  <li className="text-xs opacity-80">+ {recentMissing.length - 5} outras…</li>
                )}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}

      {olderMissing.length > 0 && (
        <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {olderMissing.length === 1
              ? "1 sessão paga sem referência"
              : `${olderMissing.length} sessões pagas sem referência`}
          </AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Pagamentos via PIX ou cartão precisam ter a referência preenchida (ex.: comprovante, NSU). Edite cada sessão para regularizar:
            </p>
            <ul className="text-sm space-y-1 mt-2">
              {olderMissing.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3">
                  <span className="truncate">
                    <span className="font-medium">{r.patient?.full_name ?? "—"}</span>
                    {" · "}
                    {format(new Date(r.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    {" · "}
                    {r.payment_method === "pix" ? "PIX" : "Cartão"}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setEditing(r)}
                  >
                    Corrigir
                  </Button>
                </li>
              ))}
              {olderMissing.length > 5 && (
                <li className="text-xs opacity-80">+ {olderMissing.length - 5} outras…</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}


      {/* Histórico de lembretes de cobrança */}
      <Sheet open={!!reminderHistoryPlan} onOpenChange={(v) => !v && setReminderHistoryPlan(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">Histórico de cobrança</SheetTitle>
            <SheetDescription>{reminderHistoryPlan?.name}</SheetDescription>
          </SheetHeader>
          <ul className="mt-5 space-y-3">
            {(() => {
              const logs = reminderHistoryPlan ? reminderLogsByPlan.get(reminderHistoryPlan.key) ?? [] : [];
              const sends = logs.filter((l) => l.channel !== "auto");
              return logs.map((l) => {
                const isSend = l.channel !== "auto";
                // ordinal do envio (1º = mais antigo)
                const idx = isSend ? sends.length - sends.indexOf(l) : 0;
                const channelLabel =
                  l.channel === "whatsapp" ? "WhatsApp"
                    : l.channel === "clipboard" ? "Mensagem copiada"
                      : l.channel === "manual" ? "Registro manual"
                        : "Lembrete automático";
                return (
                  <li key={l.id} className="rounded-2xl border border-border bg-background/60 p-3 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {new Date(l.notified_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                      <BillingBadge status={(l.status as BillingStatus) ?? "na"} />
                    </div>
                    <p className="text-xs font-medium text-foreground/80">
                      {channelLabel}
                      {isSend ? ` · ${idx === 1 ? "Primeiro envio" : `${idx}º envio (reenvio)`}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {l.pending_value != null ? `${formatBRL(Number(l.pending_value))}` : "Valor não informado"}
                      {l.due_date ? ` · Vencimento: ${formatDue(l.due_date)}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {l.days_ahead === null
                        ? "Sem data de vencimento no momento do aviso"
                        : l.days_ahead >= 0
                          ? `Antecedência: ${l.days_ahead} ${l.days_ahead === 1 ? "dia" : "dias"}`
                          : `Enviado com ${Math.abs(l.days_ahead)} ${Math.abs(l.days_ahead) === 1 ? "dia" : "dias"} de atraso`}
                    </p>
                  </li>
                );
              });
            })()}
            {reminderHistoryPlan && (reminderLogsByPlan.get(reminderHistoryPlan.key) ?? []).length === 0 && (
              <li className="text-sm text-muted-foreground">Nenhuma cobrança registrada para este item ainda.</li>
            )}
          </ul>

        </SheetContent>
      </Sheet>



      {/* Financeiro · Sessões do Mês — visualização principal (1 card por paciente) */}
      <section ref={sessionsSectionRef} className="rounded-3xl bg-card border border-border shadow-card p-4 lg:p-6">
        {(() => {
          type PGroup = {
            key: string;
            name: string;
            patientId: string | null;
            sessions: Row[];
            isPlan: boolean;
            planSessions: number;
            unitPrice: number;
            total: number;
            realizadas: number;
            futuras: number;
            faltas: number;
            gerado: number;
            pago: number;
            emAberto: number;
            previsto: number;
            planValue: number;
            paidCount: number;
            pendingCount: number;
            receitaToIssue: number;
            receitaIssued: number;
            receitaNone: number;
            lastAt: string;
          };

          const map = new Map<string, PGroup>();
          for (const r of chargeBase) {
            const patientId = r.patient?.id ?? null;
            const key = patientId ?? `s::${r.id}`;
            let g = map.get(key);
            if (!g) {
              g = {
                key,
                name: r.patient?.full_name ?? "—",
                patientId,
                sessions: [],
                isPlan: false,
                planSessions: 0,
                unitPrice: 0,
                total: 0,
                realizadas: 0,
                futuras: 0,
                faltas: 0,
                gerado: 0,
                pago: 0,
                emAberto: 0,
                previsto: 0,
                planValue: 0,
                paidCount: 0,
                pendingCount: 0,
                receitaToIssue: 0,
                receitaIssued: 0,
                receitaNone: 0,
                lastAt: r.scheduled_at,
              };
              map.set(key, g);
            }
            const price = Number(r.price ?? 0);
            g.sessions.push(r);
            g.total++;
            if (r.scheduled_at > g.lastAt) g.lastAt = r.scheduled_at;
            if (isPlanNotes(r.notes)) {
              g.isPlan = true;
              g.planSessions++;
              g.planValue += price;
            } else if (price > 0 && !g.unitPrice) {
              g.unitPrice = price;
            }
            if (r.status === "completed") { g.realizadas++; g.gerado += price; }
            else if (r.status === "no_show") g.faltas++;
            else g.futuras++;
            if (r.payment_status === "paid") { g.paidCount++; g.pago += price; }
            else if (isPendingCharge(r as any)) { g.pendingCount++; g.emAberto += price; }
            if (isForecastCharge(r as any)) g.previsto += price;
            if (r.receita_saude_status === "to_issue") g.receitaToIssue++;
            else if (r.receita_saude_status === "issued") g.receitaIssued++;
            else g.receitaNone++;
          }

          const allGroups = Array.from(map.values()).map((g) => ({
            ...g,
            billing: billingStatusOf(g.sessions, billingReminderDays, g.isPlan ? "plan" : "per_session"),
          }));

          const totalPagoCards = allGroups.reduce((s, g) => s + g.pago, 0);
          const totalPendenteCards = allGroups.reduce((s, g) => s + g.emAberto, 0);

          const counts = {
            enviada: allGroups.filter((g) => g.billing.status === "enviada").length,
            perto: allGroups.filter((g) => g.billing.status === "perto").length,
            vencida: allGroups.filter((g) => g.billing.status === "vencida").length,
            a_enviar: allGroups.filter((g) => g.billing.status === "a_enviar").length,
          };

          const groups = allGroups
            .filter((g) => {
              if (billingFilter !== "all" && g.billing.status !== billingFilter) return false;
              if (receitaSaudeFilter === "to_issue") return g.receitaToIssue > 0;
              if (receitaSaudeFilter === "issued") return g.receitaIssued > 0 && g.receitaToIssue === 0;
              return true;
            })
            .sort((a, b) =>
              cardSort === "patient"
                ? a.name.localeCompare(b.name, "pt-BR")
                : b.lastAt.localeCompare(a.lastAt) || a.name.localeCompare(b.name, "pt-BR")
            );

          const payLabel = (g: (typeof allGroups)[number]) =>
            g.pendingCount === 0 ? (g.paidCount === 0 ? "—" : "Pago") : g.paidCount === 0 ? "Pendente" : "Parcial";

          const filterCards = [
            { key: "enviada" as const, label: "Enviar cobrança", hint: "Pacientes com cobrança já enviada", count: counts.enviada, icon: MessageCircle, tone: "border-orange-200 bg-orange-50/70 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/25" },
            { key: "perto" as const, label: "Perto do vencimento", hint: `Próximos ${billingReminderDays} dias do vencimento`, count: counts.perto, icon: Clock, tone: "border-amber-200 bg-amber-50/70 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/25" },
            { key: "vencida" as const, label: "Vencidas", hint: "Cobranças com prazo vencido", count: counts.vencida, icon: AlertTriangle, tone: "border-destructive/25 bg-destructive/10 text-destructive" },
            { key: "a_enviar" as const, label: "A enviar", hint: "Pacientes que ainda não receberam cobrança", count: counts.a_enviar, icon: BellRing, tone: "border-border bg-secondary/50 text-foreground/80" },
          ];

          const tabs = [
            { key: "all" as const, label: "Todos" },
            { key: "enviada" as const, label: "Cobranças enviadas" },
            { key: "perto" as const, label: "Perto do vencimento" },
            { key: "vencida" as const, label: "Vencidas" },
            { key: "a_enviar" as const, label: "A enviar" },
          ];

          return (
            <>
              {/* Topo */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <h2 className="font-display text-xl md:text-2xl font-semibold tracking-tight">
                  Financeiro · Sessões do Mês
                </h2>
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonthCursor(subMonths(monthCursor, 1))} aria-label="Mês anterior">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium text-primary capitalize min-w-[130px] text-center">
                    {format(monthCursor, "MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonthCursor(addMonths(monthCursor, 1))} aria-label="Próximo mês">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                <span className="text-muted-foreground">
                  Pago <strong className="text-moss tabular-nums">{formatBRL(totalPagoCards)}</strong>
                </span>
                <span className="text-muted-foreground">
                  Em aberto <strong className="text-destructive tabular-nums">{formatBRL(totalPendenteCards)}</strong>
                </span>
              </div>

              {/* Cards/filtros clicáveis */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {filterCards.map((c) => {
                  const Icon = c.icon;
                  const active = billingFilter === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setBillingFilter(active ? "all" : c.key)}
                      aria-pressed={active}
                      className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft ${c.tone} ${active ? "ring-2 ring-primary/50 ring-offset-2 ring-offset-background" : ""}`}
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background/70">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-display text-2xl font-semibold leading-none tabular-nums">{c.count}</span>
                        <span className="mt-1.5 block text-xs font-medium leading-snug">{c.label}</span>
                        <span className="mt-0.5 block text-[11px] leading-snug opacity-75">{c.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Recebido x A receber por quinzena */}
              <div className="mt-5 rounded-2xl border border-border bg-card p-4 md:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1">
                  <div>
                    <h3 className="font-display text-base md:text-lg font-semibold tracking-tight">Recebimentos do mês</h3>
                    <p className="text-xs text-muted-foreground">Recebido e a receber em cada quinzena</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                    <p className="text-muted-foreground">
                      Recebido no mês: <strong className="text-moss font-semibold tabular-nums">{formatBRL(quinzenaChartData.totalRecebido)}</strong>
                    </p>
                    <p className="text-muted-foreground">
                      A receber no mês: <strong className="font-semibold tabular-nums" style={{ color: "hsl(var(--accent))" }}>{formatBRL(quinzenaChartData.totalAReceber)}</strong>
                    </p>
                  </div>
                </div>
                <div className="mx-auto mt-3 h-52 w-full max-w-2xl">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={quinzenaChartData.bars} margin={{ top: 26, right: 8, left: 8, bottom: 0 }} barCategoryGap="28%" barGap={6}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tick={({ x, y, payload }: any) => {
                          const item = quinzenaChartData.bars.find((b) => b.name === payload.value);
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <text textAnchor="middle" dy={14} className="fill-foreground text-xs font-medium">{payload.value}</text>
                              <text textAnchor="middle" dy={28} className="fill-muted-foreground text-[10px]">{item?.periodo}</text>
                            </g>
                          );
                        }}
                        height={44}
                      />
                      <YAxis hide domain={[0, "dataMax"]} />
                      <RechartsTooltip
                        cursor={{ fill: "hsl(var(--secondary))", opacity: 0.5 }}
                        formatter={(value: any, name: any) => [formatBRL(Number(value)), name === "recebido" ? "Recebido" : "A receber"]}
                        labelFormatter={(_, payload: any) => {
                          const item = payload?.[0]?.payload;
                          return item ? `${item.name} (${item.periodo})` : "";
                        }}
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid hsl(var(--border))",
                          background: "hsl(var(--card))",
                          fontSize: 12,
                        }}
                      />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        iconType="circle"
                        iconSize={8}
                        formatter={(value: any) => (
                          <span className="text-xs text-muted-foreground">{value === "recebido" ? "Recebido" : "A receber"}</span>
                        )}
                      />
                      <Bar dataKey="recebido" name="recebido" fill="hsl(var(--moss))" radius={[6, 6, 0, 0]} maxBarSize={48}
                        label={{ position: "top", formatter: (v: any) => (Number(v) > 0 ? formatBRL(Number(v)) : ""), className: "fill-foreground text-[11px] font-semibold tabular-nums" } as any}
                      />
                      <Bar dataKey="aReceber" name="aReceber" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} maxBarSize={48}
                        label={{ position: "top", formatter: (v: any) => (Number(v) > 0 ? formatBRL(Number(v)) : ""), className: "fill-foreground text-[11px] font-semibold tabular-nums" } as any}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Abas + ordenação */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-border">
                <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
                  {tabs.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setBillingFilter(t.key)}
                      aria-pressed={billingFilter === t.key}
                      className={`whitespace-nowrap pb-2 -mb-px text-sm transition-colors border-b-2 ${
                        billingFilter === t.key
                          ? "border-primary text-primary font-semibold"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setCardSort(cardSort === "date" ? "patient" : "date")}
                  className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground/80 hover:bg-secondary"
                >
                  Ordenar: {cardSort === "date" ? "Data" : "Paciente"}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              {loading ? (
                <p className="text-center py-12 text-muted-foreground">Carregando…</p>
              ) : groups.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-10 md:p-14 text-center">
                  <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" aria-hidden="true" />
                  <p className="font-display text-lg font-medium text-foreground/80">
                    Nenhuma cobrança neste filtro 🌿
                  </p>
                  <p className="text-sm mt-1 text-muted-foreground max-w-md mx-auto">
                    Ajuste os filtros ou selecione outro período para visualizar as cobranças.
                  </p>
                  {(billingFilter !== "all" || patientFilter !== "all" || receitaSaudeFilter !== "all" || fortnightFilter !== "all") && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-5 h-10 min-h-11"
                      onClick={() => { setBillingFilter("all"); setPatientFilter("all"); setReceitaSaudeFilter("all"); setFortnightFilter("all"); }}
                    >
                      Limpar filtros
                    </Button>
                  )}
                </div>
              ) : (
                <ul className="mt-4 space-y-3 pb-24 md:pb-0">
                  {groups.map((g) => {
                    const ids = g.sessions.map((s) => s.id);
                    const billing = g.billing;
                    const pay = payLabel(g);
                    const groupLogs = reminderLogsByPlan.get(g.key) ?? [];
                    const sendCount = groupLogs.filter((l) => l.channel !== "auto").length;
                    const alreadySent = !!billing.sentAt || sendCount > 0;
                    const receitaAplica = !(g.receitaNone === g.total);
                    const payTone =
                      pay === "Pago"
                        ? "bg-moss/10 text-moss border-moss/25"
                        : pay === "Pendente"
                          ? "bg-destructive/10 text-destructive border-destructive/25"
                          : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400";
                    const initials = g.name
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((p) => p[0])
                      .join("")
                      .toUpperCase();

                    const money = (label: string, value: number, tone = "text-foreground") => (
                      <div>
                        <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
                        <p className={`text-sm font-semibold tabular-nums ${tone}`}>{formatBRL(value)}</p>
                      </div>
                    );

                    return (
                      <li
                        key={g.key}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest("button,input,a,[role='combobox']")) return;
                          openSettle(g);
                        }}
                        className="cursor-pointer rounded-2xl border border-border bg-card px-4 py-4 transition-shadow hover:shadow-md"
                      >

                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)] lg:items-center">
                          {/* Coluna 1 — paciente e modalidade */}
                          <div className="flex items-start gap-3 min-w-0">
                            <span className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground/70">
                              {initials || "?"}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground leading-snug truncate">{g.name}</p>
                              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span className="rounded-full border border-lilac/30 bg-lilac/10 px-2 py-0.5 font-medium text-foreground/80">
                                  {g.isPlan ? "Plano de Atendimento" : "Sessão avulsa"}
                                </span>
                                <span>
                                  ·{" "}
                                  {g.isPlan
                                    ? `${g.planSessions} ${g.planSessions === 1 ? "sessão" : "sessões"}`
                                    : g.unitPrice > 0
                                      ? `${formatBRL(g.unitPrice)} por sessão`
                                      : "valor por sessão"}
                                </span>
                              </p>
                              <p className="mt-1.5 text-xs text-muted-foreground">
                                {g.isPlan
                                  ? `${g.realizadas}/${g.total} sessões realizadas`
                                  : `${g.total} ${g.total === 1 ? "sessão" : "sessões"} no mês`}
                              </p>
                              {!g.isPlan && (
                                <p className="text-xs">
                                  <span className="text-moss">{g.realizadas} realizadas</span>
                                  {g.futuras > 0 && <span className="text-muted-foreground"> · {g.futuras} futuras</span>}
                                  {g.faltas > 0 && <span className="text-destructive"> · {g.faltas} faltas</span>}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Coluna 2 — valores */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {g.isPlan ? (
                              <>
                                {money("Valor do plano", g.planValue)}
                                {money("Em aberto", g.emAberto, g.emAberto > 0 ? "text-destructive" : "text-muted-foreground")}
                                {money("Pago", g.pago, "text-moss")}
                              </>
                            ) : (
                              <>
                                {money("Gerado no mês", g.gerado)}
                                {money("Em aberto", g.emAberto, g.emAberto > 0 ? "text-destructive" : "text-muted-foreground")}
                                {money("Pago", g.pago, "text-moss")}
                                {money("Previsto", g.previsto, "text-muted-foreground")}
                              </>
                            )}
                          </div>

                          {/* Coluna 3 — status e ações */}
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${payTone}`}>{pay}</span>
                              {billing.status !== "na" && (
                                <BillingBadge status={billing.status} dueDate={billing.dueDate} />
                              )}
                            </div>
                            {(billing.sentAt || billing.dueDate) && (
                              <p className="text-[11px] text-muted-foreground">
                                {billing.sentAt ? `Enviada em ${format(new Date(billing.sentAt), "dd/MM/yyyy")}` : "Sem envio registrado"}
                                {billing.dueDate ? ` · Vence ${formatDue(billing.dueDate)}` : ""}
                                {sendCount > 1 ? ` · ${sendCount} envios` : ""}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 text-xs"
                                disabled={pay === "Pago"}
                                onClick={() =>
                                  sendBillingWhatsApp({
                                    key: g.key,
                                    name: g.name,
                                    patientId: g.patientId,
                                    sessions: g.sessions,
                                    isPlan: g.isPlan,
                                    dueDate: billing.dueDate,
                                    status: billing.status,
                                    isResend: alreadySent,
                                  })
                                }
                                aria-label={`${alreadySent ? "Reenviar" : "Enviar"} cobrança de ${g.name} pelo WhatsApp`}
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                {alreadySent ? "Reenviar cobrança" : "Enviar cobrança"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 text-xs"
                                onClick={() => setReminderHistoryPlan({ key: g.key, name: g.name })}
                                aria-label={`Ver histórico de cobranças de ${g.name}`}
                              >
                                <HistoryIcon className="h-3.5 w-3.5" />
                                Histórico
                              </Button>
                            </div>
                          </div>

                          {/* Coluna 4 — Receita Saúde + detalhes */}
                          <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-end">
                            <div className="flex items-center gap-2">
                              <Label className="text-[11px] text-muted-foreground whitespace-nowrap">Receita Saúde:</Label>
                              <Select
                                value={receitaAplica ? "aplica" : "nao"}
                                onValueChange={(v) =>
                                  updateReceitaSaudeGroup(ids, v === "aplica" ? "to_issue" : null)
                                }
                              >
                                <SelectTrigger className="h-8 w-[130px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="aplica">Se aplica</SelectItem>
                                  <SelectItem value="nao">Não se aplica</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openSettle(g); }}
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                              aria-label={`Abrir ações financeiras de ${g.name}`}
                            >
                              Ver detalhes
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>

                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Legenda */}
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 rounded-2xl bg-secondary/40 p-4">
                {[
                  { icon: Wallet, label: "Gerado no mês", text: "Valor das sessões realizadas neste mês (para avulsas) ou valor do plano contratado." },
                  { icon: CheckCircle2, label: "Pago", text: "Total recebido do paciente referente às sessões ou ao plano." },
                  { icon: Clock, label: "Em aberto", text: "Valor que ainda não foi pago pelo paciente." },
                  { icon: CalendarClock, label: "Previsto", text: "Valor das sessões futuras já agendadas (somente para sessão avulsa)." },
                ].map((l) => {
                  const Icon = l.icon;
                  return (
                    <div key={l.label} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-primary">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div>
                        <p className="text-xs font-medium text-foreground">{l.label}</p>
                        <p className="text-[11px] leading-snug text-muted-foreground">{l.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}
      </section>




      <PaymentDetailsDialog
        row={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />

      {/* Baixa financeira — ações do paciente sem sair do Financeiro */}
      <Sheet
        open={!!settle}
        onOpenChange={(o) => {
          if (!o) { setSettle(null); setSettleSelected(new Set()); }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display">{settle?.name ?? ""}</SheetTitle>
            <SheetDescription>
              {settle?.isPlan
                ? "Plano de Atendimento · ações financeiras"
                : `Sessão avulsa · ações financeiras${settle?.unitPrice ? ` · ${formatBRL(settle.unitPrice)} por sessão` : ""}`}
            </SheetDescription>
          </SheetHeader>

          {settle && (() => {
            const pendentes = settleableSessions(settle);
            const selecionadas = pendentes.filter((r) => settleSelected.has(r.id));
            const totalSelecionado = selecionadas.reduce((s, r) => s + Number(r.price ?? 0), 0);
            const futuras = settle.sessions
              .filter((r) => r.payment_status === "pending" && r.status !== "cancelled" && r.status !== "completed" && r.status !== "no_show")
              .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));

            return (
              <div className="mt-5 space-y-5">
                <div className="grid grid-cols-3 gap-3 rounded-2xl border border-border bg-secondary/30 p-4">
                  <div>
                    <p className="text-[11px] text-muted-foreground">{settle.isPlan ? "Valor do plano" : "Total do mês"}</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatBRL(settle.isPlan ? settle.planValue : settle.pago + settle.emAberto)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Pago</p>
                    <p className="text-sm font-semibold tabular-nums text-moss">{formatBRL(settle.pago)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Em aberto</p>
                    <p className={`text-sm font-semibold tabular-nums ${settle.emAberto > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {formatBRL(settle.emAberto)}
                    </p>
                  </div>
                </div>

                {settle.isPlan ? (
                  pendentes.length === 0 ? (
                    <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                      Nada a dar baixa: não há valores pendentes neste plano.
                    </p>
                  ) : (
                    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                      <p className="text-sm font-medium text-foreground">Dar baixa no plano</p>
                      <p className="text-xs text-muted-foreground">
                        {settle.planSessions} {settle.planSessions === 1 ? "sessão" : "sessões"} contratadas · registrar o pagamento do valor em aberto.
                      </p>
                      <p className="font-display text-2xl font-semibold tabular-nums">{formatBRL(settle.emAberto)}</p>
                      <Button
                        variant="accent"
                        className="w-full"
                        disabled={settling}
                        onClick={() =>
                          settlePayment(pendentes.map((r) => r.id), `Plano de ${settle.name} quitado · ${formatBRL(settle.emAberto)}`)
                        }
                      >
                        Confirmar pagamento
                      </Button>
                    </div>
                  )
                ) : (
                  <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                    <p className="text-sm font-medium text-foreground">Sessões do período</p>
                    <ul className="space-y-2">
                      {settle.sessions
                        .filter((r) => r.status !== "cancelled")
                        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
                        .map((r) => {
                          const pago = r.payment_status === "paid";
                          const realizada = r.status === "completed" || r.status === "no_show";
                          const podeBaixar = !pago;
                          const badge = pago ? "Pago" : realizada ? "Pendente" : "Previsto";
                          const badgeTone = pago
                            ? "bg-moss/10 text-moss border-moss/20"
                            : realizada
                              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400"
                              : "bg-secondary text-muted-foreground border-border";
                          return (
                            <li
                              key={r.id}
                              className="rounded-xl border border-border px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
                            >
                              <span className="tabular-nums font-medium">
                                {format(new Date(r.scheduled_at), "dd/MM/yyyy")}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {r.status === "completed" ? "Realizada" : r.status === "no_show" ? "Falta" : "Agendada"}
                              </span>
                              <span className="tabular-nums font-medium">{formatBRL(Number(r.price ?? 0))}</span>
                              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${badgeTone}`}>{badge}</span>
                              <span className="ml-auto flex items-center gap-1">
                                {podeBaixar && (
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs bg-moss text-moss-foreground hover:bg-moss/90"
                                    disabled={settling}
                                    onClick={() =>
                                      settlePayment(
                                        [r.id],
                                        `Sessão de ${format(new Date(r.scheduled_at), "dd/MM/yyyy")} paga · ${formatBRL(Number(r.price ?? 0))}`
                                      )
                                    }
                                  >
                                    Dar baixa
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs"
                                  onClick={() => { setSettle(null); setEditing(r); }}
                                >
                                  Detalhes
                                </Button>
                              </span>
                            </li>
                          );
                        })}
                    </ul>
                    {pendentes.length > 1 && (
                      <Button
                        className="w-full bg-moss text-moss-foreground hover:bg-moss/90"
                        disabled={settling}
                        onClick={() =>
                          settlePayment(
                            pendentes.map((r) => r.id),
                            `${pendentes.length} sessões pagas · ${formatBRL(pendentes.reduce((s, r) => s + Number(r.price ?? 0), 0))}`
                          )
                        }
                      >
                        Dar baixa em todas as sessões pendentes
                      </Button>
                    )}
                    {futuras.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Sessões futuras aparecem como Previsto e não entram no valor devido, mas podem receber baixa em caso de pagamento antecipado.
                      </p>
                    )}
                  </div>
                )}



                {settle.patientId && (
                  <button
                    type="button"
                    onClick={() => {
                      const p = { id: settle.patientId!, name: settle.name };
                      setSettle(null);
                      setFinanceHistory(p);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Ver histórico financeiro completo
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Histórico financeiro do paciente — permanece dentro do contexto do Financeiro */}

      <Sheet open={!!financeHistory} onOpenChange={(open) => { if (!open) setFinanceHistory(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display">Histórico financeiro</SheetTitle>
            <SheetDescription>
              {financeHistory?.name ?? ""} · resumo, sessões, pagamentos e Receita Saúde
            </SheetDescription>
          </SheetHeader>

          {financeHistory && (
            <div className="mt-4 space-y-4">
              <PatientSessionHistory
                patientId={financeHistory.id}
                patientName={financeHistory.name}
              />

              <div className="pt-2 border-t border-border/60 flex flex-col sm:flex-row gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="sm:ml-auto focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={() => {
                    const id = financeHistory.id;
                    setFinanceHistory(null);
                    navigate(`/app/pacientes?patient=${id}`);
                  }}
                >
                  Abrir ficha do paciente
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Pagamentos atrasados — mesma regra do indicador do Painel */}
      <Sheet
        open={overdueOpen}
        onOpenChange={(open) => {
          setOverdueOpen(open);
          if (!open && searchParams.get("filter")) {
            const next = new URLSearchParams(searchParams);
            next.delete("filter");
            setSearchParams(next, { replace: true });
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display">Pagamentos atrasados</SheetTitle>
            <SheetDescription>
              Sessões já realizadas (ou passadas) que continuam com pagamento pendente.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-2">
            {overdueLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : overdueRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum pagamento atrasado por aqui. Tudo em dia! 🌿
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {overdueRows.length} {overdueRows.length === 1 ? "sessão" : "sessões"} ·{" "}
                  {formatBRL(overdueRows.reduce((s, r) => s + Number(r.price ?? 0), 0))} em aberto
                </p>
                {overdueRows.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      if (!r.patient) return;
                      setOverdueOpen(false);
                      setFinanceHistory({ id: r.patient.id, name: r.patient.full_name });
                    }}
                    className="w-full rounded-xl border border-border/60 bg-card px-4 py-3 text-left transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {r.patient?.full_name ?? "Paciente"}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {format(new Date(r.scheduled_at), "dd/MM/yyyy")}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-foreground">
                        {formatBRL(Number(r.price ?? 0))}
                      </span>
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
};

const SessionsTable = ({
  rows,
  loading,
  onChange,
  onEdit,
  allRows,
}: {
  rows: Row[];
  loading: boolean;
  onChange: (id: string, v: PaymentStatus) => void;
  onEdit: (r: Row) => void;
  allRows: Row[];
}) => {
  // Compute session number per patient in the month
  const sessionNumbers = useMemo(() => {
    const byPatient = new Map<string, string[]>();
    // allRows is already sorted by scheduled_at desc, we need asc for numbering
    const sorted = [...allRows].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    for (const r of sorted) {
      const name = r.patient?.full_name;
      if (!name) continue;
      if (!byPatient.has(name)) byPatient.set(name, []);
      byPatient.get(name)!.push(r.id);
    }
    const map = new Map<string, { num: number; total: number; dates: string[] }>();
    for (const [name, ids] of byPatient) {
      const dates = ids.map((id) => {
        const row = allRows.find((r) => r.id === id);
        return row ? format(new Date(row.scheduled_at), "dd/MM") : "";
      });
      ids.forEach((id, i) => {
        map.set(id, { num: i + 1, total: ids.length, dates });
      });
    }
    return map;
  }, [allRows]);

  if (loading) {
    return <p className="text-center py-12 text-muted-foreground">Carregando…</p>;
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-14 text-center">
        <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
        <p className="font-display text-lg font-medium text-foreground/70">Nenhum movimento ainda</p>
        <p className="text-sm mt-1 text-muted-foreground">Sessões marcadas como realizadas aparecerão aqui automaticamente.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {rows.map((s) => {
        const sn = sessionNumbers.get(s.id);
        return (
        <li key={s.id} className="py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground truncate">
              {s.patient?.full_name ?? "—"}
              {(s.service as any)?.name && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">· {(s.service as any).name}</span>
              )}
            </p>
            <p className="text-sm text-muted-foreground capitalize">
              {format(new Date(s.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
              {s.payment_status === "paid" && s.paid_at && (
                <span className="ml-2 text-xs">· pago em {format(new Date(s.paid_at), "dd/MM")}</span>
              )}
            </p>
            {sn && (
              <p className="text-xs text-primary mt-0.5">
                {sn.total === 1
                  ? `Sessão única — ref ${format(new Date(s.scheduled_at), "dd/MM")}`
                  : `Sessão ${sn.num}/${sn.total} do mês — dias ${sn.dates.join(", ")}`}
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              {s.payment_method ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  <MethodIcon method={s.payment_method} className="h-3 w-3" />
                  {METHOD_LABEL[s.payment_method]}
                </span>
              ) : (
                <span className="text-muted-foreground italic">Sem método</span>
              )}
              {s.payment_reference && (
                <span className="text-muted-foreground truncate max-w-[160px] sm:max-w-[280px]">· {s.payment_reference}</span>
              )}
              {s.payment_status === "paid" &&
                (s.payment_method === "pix" || s.payment_method === "card") &&
                (!s.payment_reference || s.payment_reference.trim().length === 0) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
                    <AlertTriangle className="h-3 w-3" />
                    Sem referência
                  </span>
                )}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="font-display text-lg font-semibold">{formatBRL(Number(s.price ?? 0))}</span>
            <Select value={s.payment_status} onValueChange={(v) => onChange(s.id, v as PaymentStatus)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => onEdit(s)} title="Editar pagamento">
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </li>
        );
      })}
    </ul>
  );
};

const PaymentDetailsDialog = ({
  row,
  onClose,
  onSaved,
}: {
  row: Row | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [receitaSaude, setReceitaSaude] = useState<ReceitaSaudeStatus | "none">("none");
  const [pago, setPago] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (row) {
      setReceitaSaude((row.receita_saude_status as ReceitaSaudeStatus | null) ?? "none");
      setPago(row.payment_status === "paid");
    }
  }, [row]);

  if (!row) return null;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("sessions")
      .update({
        receita_saude_status: receitaSaude === "none" ? null : receitaSaude,
        payment_status: pago ? "paid" : "pending",
        paid_at: pago ? (row.paid_at ?? new Date().toISOString()) : null,
      })
      .eq("id", row.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    toast.success("Pagamento atualizado.");
    onSaved();
  };

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detalhes do pagamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">{row.patient?.full_name ?? "—"}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(row.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} · {formatBRL(Number(row.price ?? 0))}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Pagamento</p>
              <p className="text-xs text-muted-foreground">
                {pago ? "Sessão registrada como paga." : "Sessão em aberto."}
              </p>
            </div>
            {pago ? (
              <Button size="sm" variant="outline" onClick={() => setPago(false)}>
                Desfazer baixa
              </Button>
            ) : (
              <Button
                size="sm"
                className="bg-moss text-moss-foreground hover:bg-moss/90"
                onClick={() => setPago(true)}
              >
                Marcar como paga
              </Button>
            )}
          </div>



          <div className="space-y-2">
            <Label htmlFor="receita-saude">Receita Saúde</Label>
            <Select value={receitaSaude} onValueChange={(v) => setReceitaSaude(v as ReceitaSaudeStatus | "none")}>
              <SelectTrigger id="receita-saude">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não selecionado</SelectItem>
                <SelectItem value="to_issue">Emitir Receita Saúde</SelectItem>
                <SelectItem value="issued">Emitido Receita Saúde</SelectItem>
              </SelectContent>
            </Select>
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="accent" onClick={save} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const KpiCard = ({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) => (
  <div
    className={`relative overflow-hidden rounded-2xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-soft ${
      accent ? "bg-gradient-hero text-primary-foreground border-transparent" : "bg-card border-border/60"
    }`}
  >
    {/* Bolha pastel decorativa (pegada do modelo) */}
    {!accent && (
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-10 -right-8 h-28 w-28 rounded-full bg-primary opacity-[0.12]"
      />
    )}
    <div
      className={`relative flex h-10 w-10 items-center justify-center rounded-xl ${
        accent ? "bg-primary-foreground/15" : "bg-secondary text-primary"
      }`}
    >
      <Icon className="h-4 w-4" />
    </div>
    <p
      className={`relative mt-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] ${
        accent ? "text-primary-foreground/80" : "text-primary"
      }`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${accent ? "bg-primary-foreground/70" : "bg-primary"}`} aria-hidden />
      {label}
    </p>
    <p className="relative mt-1 font-display text-3xl font-bold tracking-[-0.02em]">{value}</p>
    {hint && (
      <p className={`relative mt-1 text-xs ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{hint}</p>
    )}
  </div>
);


export default Finance;
