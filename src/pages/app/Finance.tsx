import { RefreshButton } from "@/components/app/RefreshButton";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const [fortnightFilter, setFortnightFilter] = useState<FortnightFilter>("all");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderWindow, setReminderWindow] = useState(24);
  const [groupByPatient, setGroupByPatient] = useState(false);
  const [groupSort, setGroupSort] = useState<"recent" | "oldest" | "value" | "count" | "name">("recent");
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());
  const [quickAlert, setQuickAlert] = useState<QuickAlert>("none");
  const [receitaSaudeFilter, setReceitaSaudeFilter] = useState<ReceitaSaudeFilter>("all");
  const notifiedIdsRef = useRef<Set<string>>(new Set());
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
    const selectCols = "id, scheduled_at, status, payment_status, payment_method, payment_reference, receita_saude_status, price, paid_at, is_expense, session_type, notes, patient:patients!sessions_patient_id_fkey(id, full_name), service:services(name)";

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

  // Load reminder preferences from profile
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("reminder_enabled, reminder_window_hours, reminder_group_by_patient, reminder_group_sort")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setReminderEnabled(data.reminder_enabled ?? true);
        setReminderWindow(data.reminder_window_hours ?? 24);
        setGroupByPatient(data.reminder_group_by_patient ?? false);
        const sort = data.reminder_group_sort as typeof groupSort | null;
        if (sort) setGroupSort(sort);
      }
      setPrefsLoaded(true);
    })();
  }, [user]);

  const savePrefs = async (next: { enabled?: boolean; window?: number; group?: boolean; sort?: typeof groupSort }) => {
    if (!user) return;
    const enabled = next.enabled ?? reminderEnabled;
    const windowH = next.window ?? reminderWindow;
    const group = next.group ?? groupByPatient;
    const sort = next.sort ?? groupSort;
    setSavingPrefs(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        reminder_enabled: enabled,
        reminder_window_hours: windowH,
        reminder_group_by_patient: group,
        reminder_group_sort: sort,
      })
      .eq("id", user.id);
    setSavingPrefs(false);
    if (error) {
      toast.error("Não foi possível salvar a preferência.");
      return;
    }
    // Reset notified set so toggling/changing window can re-notify
    notifiedIdsRef.current.clear();
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

  // 4) A receber: somente pagamento pendente (não inclui sessão futura já paga).
  const pendingRows = fortnightAllValid.filter((r) => r.payment_status === "pending");
  const totalAReceber = pendingRows.reduce((s, r) => s + Number(r.price ?? 0), 0);
  const sessoesPendentes = pendingRows.length;

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
          <Button
            variant="accent"
            onClick={() => sessionsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar pagamento
          </Button>

          <div className="flex items-center gap-2 bg-card border border-border rounded-full p-1">
            <Button variant="ghost" size="icon" onClick={() => setMonthCursor(subMonths(monthCursor, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs sm:text-sm font-medium px-1 sm:px-3 capitalize min-w-[100px] sm:min-w-[140px] text-center">
              {format(monthCursor, "MMMM 'de' yyyy", { locale: ptBR })}
            </span>
            <Button variant="ghost" size="icon" onClick={() => setMonthCursor(addMonths(monthCursor, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

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
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      {/* KPI Cards — 5 cards */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard icon={Wallet} label="Recebido no período" value={formatBRL(totalRecebido)} hint={`Pagamentos confirmados no período · ${sessoesPagas} sessões`} accent />
        <KpiCard icon={Receipt} label="Receita realizada" value={formatBRL(totalReceitaRealizada)} hint={`${sessoesRealizadas} sessões realizadas`} />
        <KpiCard icon={CalendarClock} label="Saldo pago a realizar" value={formatBRL(totalSaldoPagoARealizar)} hint={`${sessoesFuturasPagas} sessões futuras já pagas`} />
        <KpiCard icon={Clock} label="A receber" value={formatBRL(totalAReceber)} hint={`${sessoesPendentes} pagamentos pendentes`} />
        <KpiCard icon={CalendarClock} label="Receita prevista do mês" value={formatBRL(totalPrevisto)} hint={`${sessoesAgendadas} sessões agendadas`} />
      </section>

      {/* Alerts row — filtros clicáveis que refinam a lista de sessões */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {([
          { key: "receita_saude" as QuickAlert, label: "Receita Saúde pendente", hint: `${receitaSaudeToIssue.length} a emitir`, icon: Receipt, count: receitaSaudeToIssue.length, tone: "text-amber-600 bg-amber-50 border-amber-200", clickable: true },
          { key: "sem_pagamento" as QuickAlert, label: "Sessões realizadas sem pagamento", hint: `${sessoesPendentes} pendentes`, icon: FileWarning, count: sessoesPendentes, tone: "text-destructive bg-destructive/10 border-destructive/30", clickable: true },
          { key: "none" as QuickAlert, label: "Planos de Atendimento no mês", hint: `${packagesStats.sessions} ${packagesStats.sessions === 1 ? "sessão vinculada" : "sessões vinculadas"} a Planos de Atendimento`, icon: PackageOpen, count: packagesStats.count, tone: "text-primary bg-secondary/60 border-border", clickable: false },
          { key: "none" as QuickAlert, label: "Sessões únicas no mês", hint: `${avulsasStats.patients} ${avulsasStats.patients === 1 ? "paciente" : "pacientes"} com sessões únicas`, icon: CalendarClock, count: avulsasStats.count, tone: "text-foreground bg-card border-border", clickable: false },
        ]).map((a, idx) => {
          const active = a.clickable && quickAlert === a.key;
          const Icon = a.icon;
          const commonClass = `text-left rounded-2xl border p-4 transition-all ${a.tone} ${a.clickable ? "hover:-translate-y-0.5 hover:shadow-soft" : "cursor-default"} ${active ? "ring-2 ring-offset-2 ring-primary/60" : ""}`;
          const content = (
            <>
              <div className="flex items-center justify-between gap-3">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="font-display text-2xl font-semibold">{a.count}</span>
              </div>
              <p className="mt-2 text-xs font-medium leading-snug">{a.label}</p>
              {a.hint && <p className="mt-0.5 text-[11px] opacity-80 leading-snug">{a.hint}</p>}
            </>
          );
          if (!a.clickable) {
            return (
              <div key={`${a.label}-${idx}`} className={commonClass}>
                {content}
              </div>
            );
          }
          return (
            <button
              key={`${a.label}-${idx}`}
              type="button"
              onClick={() => {
                setQuickAlert((cur) => (cur === a.key ? "none" : a.key));
                sessionsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={commonClass}
            >
              {content}
            </button>
          );
        })}

        {/* Distribuição dos Honorários — carteira ativa (independe de mês/quinzena/filtros) */}
        <div className="rounded-2xl border border-border bg-card p-4 text-foreground">
          <div className="flex items-center justify-between gap-3">
            <Wallet className="h-4 w-4 shrink-0 text-primary" />
            <span className="font-display text-2xl font-semibold">{feeBands.total - feeBands.invalid}</span>
          </div>
          <p className="mt-2 text-xs font-medium leading-snug">Distribuição dos Honorários</p>
          <div className="mt-2 space-y-1 text-[11px] leading-snug">
            <button
              type="button"
              onClick={() => feeBands.low.length && setFeeBandOpen("low")}
              disabled={!feeBands.low.length}
              className="flex w-full items-center justify-between rounded-md px-1 py-0.5 -mx-1 hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70 disabled:hover:bg-transparent disabled:cursor-default text-left"
            >
              <span className="text-muted-foreground">Até R$ 100</span>
              <span className="tabular-nums font-medium">{feeBands.low.length}</span>
            </button>
            <button
              type="button"
              onClick={() => feeBands.mid.length && setFeeBandOpen("mid")}
              disabled={!feeBands.mid.length}
              className="flex w-full items-center justify-between rounded-md px-1 py-0.5 -mx-1 hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70 disabled:hover:bg-transparent disabled:cursor-default text-left"
            >
              <span className="text-muted-foreground">R$ 100,01–180</span>
              <span className="tabular-nums font-medium">{feeBands.mid.length}</span>
            </button>
            <button
              type="button"
              onClick={() => feeBands.high.length && setFeeBandOpen("high")}
              disabled={!feeBands.high.length}
              className="flex w-full items-center justify-between rounded-md px-1 py-0.5 -mx-1 hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70 disabled:hover:bg-transparent disabled:cursor-default text-left"
            >
              <span className="text-muted-foreground">Acima de R$ 180</span>
              <span className="tabular-nums font-medium">{feeBands.high.length}</span>
            </button>
          </div>
        </div>
      </section>

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



      {/* Fortnight filter */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
        <Tabs value={fortnightFilter} onValueChange={(v) => setFortnightFilter(v as FortnightFilter)} className="w-full sm:w-auto">
          <TabsList className="w-full sm:w-auto overflow-x-auto no-scrollbar">
            <TabsTrigger value="all">Mês todo</TabsTrigger>
            <TabsTrigger value="first">1ª Quinzena</TabsTrigger>
            <TabsTrigger value="second">2ª Quinzena</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Label htmlFor="receita-saude-filter" className="text-xs text-muted-foreground whitespace-nowrap">Receita Saúde</Label>
          <Select value={receitaSaudeFilter} onValueChange={(v) => setReceitaSaudeFilter(v as ReceitaSaudeFilter)}>
            <SelectTrigger id="receita-saude-filter" className="h-9 flex-1 sm:w-[160px] sm:flex-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="to_issue">A emitir</SelectItem>
              <SelectItem value="issued">Emitido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Label htmlFor="patient-filter" className="text-xs text-muted-foreground whitespace-nowrap">Paciente</Label>
          <Select value={patientFilter} onValueChange={setPatientFilter}>
            <SelectTrigger id="patient-filter" className="h-9 flex-1 sm:w-[220px] sm:flex-none">
              <SelectValue placeholder="Todos os pacientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os pacientes</SelectItem>
              {patientOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {patientFilter !== "all" && (
            <button
              type="button"
              onClick={() => setPatientFilter("all")}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              limpar
            </button>
          )}
        </div>
      </div>




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

      {/* Operational patient table */}
      <section ref={sessionsSectionRef} className="rounded-3xl bg-card border border-border shadow-card p-4 lg:p-6">
        {(() => {
          type Aggregate = {
            key: string;
            name: string;
            patientId: string | null;
            totalSessions: number;
            realizadas: number;
            faltas: number;
            aRealizar: number;
            avulsasCount: number;
            packageCounts: Map<string, number>;
            totalValue: number;
            nextSession: Date | null;
            allBillable: Row[];
            allInGroup: Row[];
            latestBillable: Row | null;
            paidCount: number;
            pendingCount: number;
            hasPending: boolean;
            oldestPendingDays: number;
            receitaToIssueCount: number;
            receitaIssuedCount: number;
            receitaNoneCount: number;
          };
          const now = Date.now();
          // Base: fortnight + non-cancelled (includes no_show for Faltas)
          const baseRows = fortnightFilter_(rows.filter((r) => r.status !== "cancelled"));
          const map = new Map<string, Aggregate>();
          for (const r of baseRows) {
            const name = r.patient?.full_name ?? "—";
            const patientId = r.patient?.id ?? null;
            const groupKey = patientId ?? `name::${name}`;
            let e = map.get(groupKey);
            if (!e) {
              e = {
                key: groupKey,
                name,
                patientId,
                totalSessions: 0,
                realizadas: 0,
                faltas: 0,
                aRealizar: 0,
                avulsasCount: 0,
                packageCounts: new Map(),
                totalValue: 0,
                nextSession: null,
                allBillable: [],
                allInGroup: [],
                latestBillable: null,
                paidCount: 0,
                pendingCount: 0,
                hasPending: false,
                oldestPendingDays: 0,
                receitaToIssueCount: 0,
                receitaIssuedCount: 0,
                receitaNoneCount: 0,
              };
              map.set(groupKey, e);
            }
            if (!e.patientId && patientId) e.patientId = patientId;
            e.allInGroup.push(r);
            e.totalSessions++;
            e.totalValue += Number(r.price ?? 0);

            if (isRecurringSession(r.notes)) {
              const k = getSeriesKey(r) ?? `unknown::${r.id}`;
              e.packageCounts.set(k, (e.packageCounts.get(k) ?? 0) + 1);
            } else {
              e.avulsasCount++;
            }

            if (r.receita_saude_status === "to_issue") e.receitaToIssueCount++;
            else if (r.receita_saude_status === "issued") e.receitaIssuedCount++;
            else e.receitaNoneCount++;

            if (r.status === "completed") {
              e.realizadas++;
              e.allBillable.push(r);
              if (r.payment_status === "paid") e.paidCount++;
              else {
                e.pendingCount++;
                e.hasPending = true;
                const days = Math.floor((now - new Date(r.scheduled_at).getTime()) / 86400000);
                if (days > e.oldestPendingDays) e.oldestPendingDays = days;
              }
              if (!e.latestBillable || new Date(r.scheduled_at) > new Date(e.latestBillable.scheduled_at)) {
                e.latestBillable = r;
              }
            } else if (r.status === "no_show") {
              e.faltas++;
            } else if (r.status === "scheduled" || r.status === "confirmed") {
              e.aRealizar++;
              const d = new Date(r.scheduled_at);
              if (d.getTime() >= now && (!e.nextSession || d < e.nextSession)) {
                e.nextSession = d;
              }
            }
          }
          const allAggregates = Array.from(map.values()).sort((a, b) =>
            a.name.localeCompare(b.name, "pt-BR")
          );
          const patients = allAggregates.filter((p) => {
            if (receitaSaudeFilter === "to_issue") return p.receitaToIssueCount > 0;
            if (receitaSaudeFilter === "issued") return p.receitaIssuedCount > 0 && p.receitaToIssueCount === 0;
            return true;
          });


          if (loading) {
            return <p className="text-center py-12 text-muted-foreground">Carregando…</p>;
          }
          if (patients.length === 0) {
            const hasActiveFilters =
              patientFilter !== "all" || receitaSaudeFilter !== "all" || fortnightFilter !== "all";
            const clearFilters = () => {
              setPatientFilter("all");
              setReceitaSaudeFilter("all");
              setFortnightFilter("all");
            };
            return (
              <div className="rounded-2xl border border-dashed border-border bg-card p-10 md:p-14 text-center">
                <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" aria-hidden="true" />
                <p className="font-display text-lg font-medium text-foreground/80">
                  Nenhum paciente encontrado neste período.
                </p>
                <p className="text-sm mt-1 text-muted-foreground max-w-md mx-auto">
                  Ajuste os filtros ou selecione outro período para visualizar os dados financeiros.
                </p>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-5 h-10 min-h-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    onClick={clearFilters}
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
            );
          }


          const modalidadeFor = (p: Aggregate): string => {
            const pkgCount = p.packageCounts.size;
            const pkgSessions = Array.from(p.packageCounts.values()).reduce((s, n) => s + n, 0);
            const av = p.avulsasCount;
            const avLabel = av > 0 ? `${av} ${av === 1 ? "sessão única" : "sessões únicas"}` : "";
            let pkgLabel = "";
            if (pkgCount === 1) {
              pkgLabel = `Plano de Atendimento • ${pkgSessions} ${pkgSessions === 1 ? "sessão" : "sessões"}`;
            } else if (pkgCount > 1) {
              pkgLabel = `${pkgCount} Planos de Atendimento, total de ${pkgSessions} ${pkgSessions === 1 ? "sessão" : "sessões"}`;
            }
            if (avLabel && pkgLabel) return `${avLabel} + ${pkgLabel.toLowerCase()}`;
            return avLabel || pkgLabel || "—";
          };

          const receitaSaudeFor = (p: Aggregate): { label: string; tone: string } => {
            const hasIssue = p.receitaToIssueCount > 0;
            const hasIssued = p.receitaIssuedCount > 0;
            if (hasIssue && hasIssued) return { label: "Misto", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-500" };
            if (hasIssue) return { label: "Emitir Receita Saúde", tone: "bg-primary/10 text-primary" };
            if (hasIssued) return { label: "Receita Saúde emitida", tone: "bg-moss/10 text-moss" };
            return { label: "Não se aplica", tone: "bg-secondary text-muted-foreground" };
          };

          const pagamentoFor = (p: Aggregate) => {
            if (p.realizadas === 0) return { label: "—", tone: "text-muted-foreground" };
            if (p.paidCount > 0 && p.pendingCount === 0) return { label: "Pago", tone: "text-moss" };
            if (p.paidCount === 0 && p.pendingCount > 0) return { label: "Pendente", tone: "text-destructive" };
            return { label: "Parcial", tone: "text-amber-600" };
          };

          return (
            <>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-display text-lg font-semibold">Pacientes do período</h2>
                  <p className="text-xs text-muted-foreground">
                    {patients.length} {patients.length === 1 ? "paciente" : "pacientes"} · uma linha por paciente no período selecionado
                  </p>
                </div>
                {quickAlert !== "none" && (
                  <button
                    type="button"
                    onClick={() => setQuickAlert("none")}
                    className="text-xs px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                  >
                    Limpar alerta
                  </button>
                )}
              </div>

              {/* Desktop / tablet amplo: tabela original */}
              <div className="hidden md:block overflow-x-auto -mx-4 lg:mx-0">
                <table className="w-full min-w-[1180px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="py-2.5 px-3 font-medium">Paciente</th>
                      <th className="py-2.5 px-3 font-medium text-center">Sessões no mês</th>
                      <th className="py-2.5 px-3 font-medium text-center">Realizadas</th>
                      <th className="py-2.5 px-3 font-medium text-center">Faltas</th>
                      <th className="py-2.5 px-3 font-medium text-center">A realizar</th>
                      <th className="py-2.5 px-3 font-medium">Modalidade de cobrança</th>
                      <th className="py-2.5 px-3 font-medium">Receita Saúde</th>
                      <th className="py-2.5 px-3 font-medium">Valor total</th>
                      <th className="py-2.5 px-3 font-medium">Pagamento</th>
                      <th className="py-2.5 px-3 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patients.map((p) => {
                      const pay = pagamentoFor(p);
                      const rs = receitaSaudeFor(p);
                      const modalidade = modalidadeFor(p);
                      const editTarget = p.latestBillable ?? p.allInGroup[0] ?? null;
                      const openPatient = (tab: "finance" | "sessions", focus?: string) => {
                        if (!p.patientId) return;
                        const focusParam = focus ? `&focus=${focus}` : "";
                        navigate(`/app/pacientes?patient=${p.patientId}&tab=${tab}${focusParam}`);
                      };
                      const rowClickable = !!p.patientId;
                      const openFinanceHistory = () => {
                        if (!p.patientId) return;
                        setFinanceHistory({ id: p.patientId, name: p.name });
                      };
                      return (
                        <tr
                          key={p.key}
                          role={rowClickable ? "button" : undefined}
                          tabIndex={rowClickable ? 0 : undefined}
                          aria-label={rowClickable ? `Abrir histórico financeiro de ${p.name}` : undefined}
                          onClick={rowClickable ? openFinanceHistory : undefined}
                          onKeyDown={rowClickable ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openFinanceHistory();
                            }
                          } : undefined}
                          className={`border-b border-border/60 hover:bg-secondary/30 transition-colors ${rowClickable ? "cursor-pointer" : ""}`}
                        >
                          <td className="py-3 px-3">
                            <p className="font-medium text-foreground truncate max-w-[220px]">{p.name}</p>
                          </td>
                          <td className="py-3 px-3 text-center tabular-nums">{p.totalSessions}</td>
                          <td className="py-3 px-3 text-center tabular-nums text-moss">{p.realizadas}</td>
                          <td className={`py-3 px-3 text-center tabular-nums ${p.faltas > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                            {p.faltas}
                          </td>
                          <td className="py-3 px-3 text-center tabular-nums text-muted-foreground">{p.aRealizar}</td>
                          <td className="py-3 px-3">
                            <span className="text-sm text-foreground">{modalidade}</span>
                          </td>
                          <td
                            className={`py-3 px-3 ${rowClickable ? "cursor-pointer" : ""}`}
                            onClick={rowClickable ? (e) => { e.stopPropagation(); openPatient("finance", "receita-saude"); } : undefined}
                          >
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${rs.tone}`}>
                              {rs.label}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-medium tabular-nums">
                            {p.totalValue > 0 ? formatBRL(p.totalValue) : <span className="text-muted-foreground italic">—</span>}
                          </td>
                          <td className={`py-3 px-3 font-medium ${pay.tone}`}>{pay.label}</td>
                          <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center gap-1">
                              {p.latestBillable && p.hasPending && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const pending = p.allBillable.find((r) => r.payment_status === "pending");
                                    if (pending) updatePayment(pending.id, "paid");
                                  }}
                                >
                                  Marcar pago
                                </Button>
                              )}
                              {rowClickable && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8"
                                  onClick={(e) => { e.stopPropagation(); openFinanceHistory(); }}
                                  title="Ver histórico financeiro"
                                >
                                  Detalhes
                                </Button>
                              )}
                              {editTarget && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => { e.stopPropagation(); setEditing(editTarget); }}
                                  title="Editar pagamento"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                </table>
              </div>

              {/* Mobile: cards */}
              <ul className="md:hidden space-y-3 pb-24">
                {patients.map((p) => {
                  const pay = pagamentoFor(p);
                  const rs = receitaSaudeFor(p);
                  const modalidade = modalidadeFor(p);
                  const editTarget = p.latestBillable ?? p.allInGroup[0] ?? null;
                  const openPatient = (tab: "finance" | "sessions", focus?: string) => {
                    if (!p.patientId) return;
                    const focusParam = focus ? `&focus=${focus}` : "";
                    navigate(`/app/pacientes?patient=${p.patientId}&tab=${tab}${focusParam}`);
                  };
                  const rowClickable = !!p.patientId;
                  const openFinanceHistory = () => {
                    if (!p.patientId) return;
                    setFinanceHistory({ id: p.patientId, name: p.name });
                  };
                  const payBadgeTone =
                    pay.label === "Pago" ? "bg-moss/10 text-moss border-moss/20" :
                    pay.label === "Pendente" ? "bg-destructive/10 text-destructive border-destructive/20" :
                    pay.label === "Parcial" ? "bg-amber-50 text-amber-700 border-amber-200" :
                    "bg-secondary text-muted-foreground border-border";
                  return (
                    <li
                      key={p.key}
                      className="rounded-xl border border-border bg-card shadow-sm p-4"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <p className="font-medium text-foreground text-[15px] leading-snug line-clamp-2 flex-1">
                          {p.name}
                        </p>
                        <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${payBadgeTone}`}>
                          {pay.label}
                        </span>
                        {editTarget && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 min-h-11 min-w-11 shrink-0 -mr-1 -mt-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            onClick={(e) => { e.stopPropagation(); setEditing(editTarget); }}
                            aria-label={`Editar pagamento de ${p.name}`}
                            title="Editar pagamento"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}

                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="rounded-lg bg-secondary/40 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sessões no mês</p>
                          <p className="text-base font-semibold tabular-nums">{p.totalSessions}</p>
                        </div>
                        <div className="rounded-lg bg-secondary/40 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Realizadas</p>
                          <p className="text-base font-semibold tabular-nums text-moss">{p.realizadas}</p>
                        </div>
                        <div className="rounded-lg bg-secondary/40 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Faltas</p>
                          <p className={`text-base font-semibold tabular-nums ${p.faltas > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                            {p.faltas}
                          </p>
                        </div>
                        <div className="rounded-lg bg-secondary/40 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">A realizar</p>
                          <p className="text-base font-semibold tabular-nums text-muted-foreground">{p.aRealizar}</p>
                        </div>
                      </div>

                      <dl className="space-y-1.5 text-sm mb-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <dt className="text-muted-foreground text-xs">Modalidade</dt>
                          <dd className="text-foreground text-right">{modalidade}</dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-3">
                          <dt className="text-muted-foreground text-xs">Receita Saúde</dt>
                          <dd>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${rs.tone}`}>
                              {rs.label}
                            </span>
                          </dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-3">
                          <dt className="text-muted-foreground text-xs">Valor total</dt>
                          <dd className="font-semibold tabular-nums whitespace-nowrap">
                            {p.totalValue > 0 ? formatBRL(p.totalValue) : <span className="text-muted-foreground italic font-normal">—</span>}
                          </dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-3">
                          <dt className="text-muted-foreground text-xs">Pagamento</dt>
                          <dd className={`font-medium ${pay.tone}`}>{pay.label}</dd>
                        </div>
                      </dl>

                      <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                        {rowClickable && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-11 min-h-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            onClick={openFinanceHistory}
                            aria-label={`Ver histórico financeiro de ${p.name}`}
                          >
                            Ver detalhes
                          </Button>
                        )}
                        {p.latestBillable && p.hasPending && (
                          <Button
                            variant="accent"
                            size="sm"
                            className="flex-1 h-11 min-h-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            onClick={() => {
                              const pending = p.allBillable.find((r) => r.payment_status === "pending");
                              if (pending) updatePayment(pending.id, "paid");
                            }}
                            aria-label={`Marcar sessão de ${p.name} como paga`}
                          >
                            Marcar pago
                          </Button>
                        )}
                      </div>

                    </li>
                  );
                })}
              </ul>
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
  const [method, setMethod] = useState<PaymentMethod | "none">("none");
  const [reference, setReference] = useState("");
  const [receitaSaude, setReceitaSaude] = useState<ReceitaSaudeStatus | "none">("none");
  const [saving, setSaving] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);

  useEffect(() => {
    if (row) {
      setMethod((row.payment_method as PaymentMethod | null) ?? "none");
      setReference(row.payment_reference ?? "");
      setReceitaSaude((row.receita_saude_status as ReceitaSaudeStatus | null) ?? "none");
      setRefError(null);
    }
  }, [row]);

  if (!row) return null;

  const requiresReference = method === "pix" || method === "card";
  const trimmedRef = reference.trim();

  const save = async () => {
    if (requiresReference && trimmedRef.length === 0) {
      setRefError(
        method === "pix"
          ? "Informe a referência do PIX (ex.: comprovante, ID da transação)."
          : "Informe a referência do cartão (ex.: últimos 4 dígitos, NSU)."
      );
      return;
    }
    setRefError(null);
    setSaving(true);
    const ref = trimmedRef.slice(0, 500);
    const { error } = await supabase
      .from("sessions")
      .update({
        payment_method: method === "none" ? null : method,
        payment_reference: ref.length > 0 ? ref : null,
        receita_saude_status: receitaSaude === "none" ? null : receitaSaude,
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

          <div className="space-y-2">
            <Label>Método de pagamento</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod | "none")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não informado</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="card">Cartão</SelectItem>
                <SelectItem value="cash">Dinheiro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">
              Referência / nota
              {requiresReference && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id="reference"
              maxLength={500}
              placeholder="Ex.: comprovante #1234, pago via Nubank"
              value={reference}
              onChange={(e) => {
                setReference(e.target.value);
                if (refError) setRefError(null);
              }}
              aria-invalid={!!refError}
              className={refError ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {refError ? (
              <p className="text-xs text-destructive">{refError}</p>
            ) : requiresReference ? (
              <p className="text-xs text-muted-foreground">
                Obrigatório para {method === "pix" ? "PIX" : "cartão"}.
              </p>
            ) : null}
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
    className={`rounded-2xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-soft ${
      accent ? "bg-gradient-hero text-primary-foreground border-transparent" : "bg-card border-border"
    }`}
  >
    <div
      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
        accent ? "bg-primary-foreground/15" : "bg-secondary text-primary"
      }`}
    >
      <Icon className="h-4 w-4" />
    </div>
    <p className={`mt-4 text-xs uppercase tracking-wider ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
      {label}
    </p>
    <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
    {hint && (
      <p className={`mt-1 text-xs ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{hint}</p>
    )}
  </div>
);

export default Finance;
