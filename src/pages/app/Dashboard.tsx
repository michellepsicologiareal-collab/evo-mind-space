import { useEffect, useMemo, useRef, useState, KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameDay,
  isToday,
  startOfMonth,
  endOfMonth,
  subDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  Plus,
  Bell,
  ArrowRight,
  Video,
  MapPin,
  FileText,
  CalendarX,
  CircleDollarSign,
  UserMinus,
  MoreHorizontal,
  CheckCircle2,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fetchWeekSessions } from "@/lib/sessions/weekSessions";

/* ─── Real data types ─── */
interface WeekSession {
  id: string;
  scheduled_at: string;
  status: string;
  modality: string | null;
  patient_name: string;
}

type TodayItem = {
  id: string;
  time: string;
  name: string;
  mode: "Online" | "Presencial";
  status: "scheduled" | "to-confirm" | "confirmed" | "completed" | "no_show";
};

const WEEK_DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/* ─── UI helpers ─── */
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtBRL2(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Detecta sessão de Plano de Atendimento (série recorrente) pelo marcador na notes
const PLAN_MARKER_RE = /Plano\s+\d+\s+sess/i;
const GROUP_ID_RE = /\[([^\]]+)\]/;
function isRecurringSession(notes: string | null | undefined) {
  return !!notes && PLAN_MARKER_RE.test(notes);
}
function getSeriesKey(s: { patient_id: string; notes: string | null | undefined }) {
  if (!s.notes) return null;
  const g = s.notes.match(GROUP_ID_RE);
  if (g) return `g:${g[1]}`;
  const m = s.notes.match(/Plano\s+(\d+)\s+sess/i);
  if (m) return `p:${s.patient_id}:${m[1]}`;
  return null;
}

/* ─── Page ─── */
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const displayName = useMemo(() => {
    const meta: any = user?.user_metadata;
    return (meta?.name || meta?.full_name || user?.email?.split("@")[0] || "") as string;
  }, [user]);

  const today = useMemo(() => new Date(), []);
  const dateStr = format(today, "EEEE, d 'de' MMMM", { locale: ptBR });
  const capDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  /* ── Sessões reais da semana ── */
  const weekStart = useMemo(() => startOfWeek(today, { weekStartsOn: 1 }), [today]);
  const weekEnd = useMemo(() => endOfWeek(today, { weekStartsOn: 1 }), [today]);
  const weekDays = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const [weekSessions, setWeekSessions] = useState<WeekSession[]>([]);
  const [loadingWeek, setLoadingWeek] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const t = new Date();
    const day = t.getDay();
    if (day === 0 || day === 6) return addDays(weekStart, 0);
    return t;
  });

  // KPIs & cards reais
  const [activePatients, setActivePatients] = useState(0);
  const [newPatientsMonth, setNewPatientsMonth] = useState(0);
  const [attendancePct, setAttendancePct] = useState<number | null>(null);
  const [attendanceDelta, setAttendanceDelta] = useState<number | null>(null);
  const [pendingFormulations, setPendingFormulations] = useState(0);
  const [modalityBreakdown, setModalityBreakdown] = useState<{ online: number; presencial: number; hibrido: number; sem: number }>({ online: 0, presencial: 0, hibrido: 0, sem: 0 });
  const [avgSessionPrice, setAvgSessionPrice] = useState<number | null>(null);
  const [avgPlanValue, setAvgPlanValue] = useState<number | null>(null);
  const [semProxima, setSemProxima] = useState(0);
  const [pagamentosAtrasados, setPagamentosAtrasados] = useState(0);
  const [baixaAdesao, setBaixaAdesao] = useState(0);
  const [finRecebido, setFinRecebido] = useState(0);
  const [finAReceber, setFinAReceber] = useState(0);
  const [finAtrasoCount, setFinAtrasoCount] = useState(0);
  const [todayItems, setTodayItems] = useState<TodayItem[]>([]);

  // Weekly sessions (real) — fonte única compartilhada com a Agenda semanal
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      setLoadingWeek(true);
      const { data, error } = await fetchWeekSessions({ userId: user.id, reference: today });
      if (cancelled) return;
      if (error) {
        toast.error("Não foi possível carregar a agenda da semana");
        setWeekSessions([]);
      } else {
        setWeekSessions(data);
      }
      setLoadingWeek(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, today]);

  // KPIs, pendings, finance
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const attendanceFrom = subDays(now, 60);
      const attendancePrevFrom = subDays(now, 120);
      const adesaoCutoff = subDays(now, 30);

      const [patientsRes, attendanceRes, atrasoRes, futureRes, monthPayRes, recordsSrcRes] = await Promise.all([
        supabase
          .from("patients")
          .select("id, is_active, created_at, modality")
          .eq("user_id", user.id),
        supabase
          .from("sessions")
          .select("id, status, scheduled_at")
          .eq("user_id", user.id)
          .in("status", ["completed", "no_show"])
          .gte("scheduled_at", attendancePrevFrom.toISOString()),
        supabase
          .from("sessions")
          .select("id, price, scheduled_at")
          .eq("user_id", user.id)
          .eq("payment_status", "pending")
          .neq("status", "cancelled")
          .lt("scheduled_at", now.toISOString()),
        supabase
          .from("sessions")
          .select("patient_id, scheduled_at, status")
          .eq("user_id", user.id)
          .neq("status", "cancelled")
          .gte("scheduled_at", now.toISOString()),
        supabase
          .from("sessions")
          .select("id, patient_id, price, status, payment_status, scheduled_at, notes")
          .eq("user_id", user.id)
          .neq("status", "cancelled")
          .gte("scheduled_at", monthStart.toISOString())
          .lte("scheduled_at", monthEnd.toISOString()),
        supabase
          .from("sessions")
          .select("id, patient_id")
          .eq("user_id", user.id)
          .eq("status", "completed"),
      ]);
      if (cancelled) return;

      // Pacientes ativos
      const patientsAll = (patientsRes.data ?? []) as any[];
      const activeList = patientsAll.filter((p) => p.is_active);
      setActivePatients(activeList.length);
      setNewPatientsMonth(
        patientsAll.filter(
          (p) => p.created_at && new Date(p.created_at) >= monthStart && p.is_active,
        ).length,
      );

      // Comparecimento (últimos 60 dias vs 60 anteriores)
      const attSessions = (attendanceRes.data ?? []) as any[];
      const inWindow = (from: Date, to: Date) =>
        attSessions.filter((s) => {
          const d = new Date(s.scheduled_at);
          return d >= from && d < to;
        });
      const cur = inWindow(attendanceFrom, now);
      const prev = inWindow(attendancePrevFrom, attendanceFrom);
      const pct = (arr: any[]) => {
        const total = arr.length;
        if (!total) return null;
        const done = arr.filter((s) => s.status === "completed").length;
        return Math.round((done / total) * 100);
      };
      const curPct = pct(cur);
      const prevPct = pct(prev);
      setAttendancePct(curPct);
      setAttendanceDelta(curPct != null && prevPct != null ? curPct - prevPct : null);

      // Pagamentos atrasados
      const atrasoRows = (atrasoRes.data ?? []) as any[];
      setPagamentosAtrasados(atrasoRows.length);

      // Modalidade dos pacientes ativos (usa apenas patients.modality — sem inferência)
      const mb = { online: 0, presencial: 0, hibrido: 0, sem: 0 };
      activeList.forEach((p) => {
        const m = (p.modality ?? "").toString().toLowerCase();
        if (m === "online") mb.online += 1;
        else if (m === "presencial") mb.presencial += 1;
        else if (m === "hibrido" || m === "híbrido") mb.hibrido += 1;
        else mb.sem += 1;
      });
      setModalityBreakdown(mb);

      // Formulações de Caso pendentes = pacientes ativos com >=1 sessão completed sem case_formulations
      const completedRows = (recordsSrcRes.data ?? []) as any[];
      const activeIds = new Set(activeList.map((p) => p.id));
      const patientsWithCompleted = new Set(
        completedRows.map((s) => s.patient_id).filter((pid) => pid && activeIds.has(pid)),
      );
      let pendingFormCount = 0;
      if (patientsWithCompleted.size > 0) {
        const { data: forms } = await supabase
          .from("case_formulations")
          .select("patient_id")
          .in("patient_id", Array.from(patientsWithCompleted));
        const withForm = new Set((forms ?? []).map((r: any) => r.patient_id));
        pendingFormCount = Array.from(patientsWithCompleted).filter((pid) => !withForm.has(pid)).length;
      }
      if (!cancelled) setPendingFormulations(pendingFormCount);

      // Sem próxima sessão + baixa adesão
      const future = (futureRes.data ?? []) as any[];
      const patientsWithFuture = new Set(future.map((s) => s.patient_id));
      setSemProxima(activeList.filter((p) => !patientsWithFuture.has(p.id)).length);

      // Baixa adesão: ativos cujo último atendimento (completed) foi há >30 dias
      const { data: lastCompleted } = await supabase
        .from("sessions")
        .select("patient_id, scheduled_at")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("scheduled_at", { ascending: false });
      const lastByPatient = new Map<string, string>();
      ((lastCompleted ?? []) as any[]).forEach((s) => {
        if (!lastByPatient.has(s.patient_id)) lastByPatient.set(s.patient_id, s.scheduled_at);
      });
      const baixa = activeList.filter((p) => {
        const last = lastByPatient.get(p.id);
        if (!last) return false;
        return new Date(last) < adesaoCutoff && patientsWithFuture.has(p.id) === false;
      }).length;
      if (!cancelled) setBaixaAdesao(baixa);

      // Financeiro do mês corrente
      const monthRows = (monthPayRes.data ?? []) as any[];
      let recebido = 0, aReceber = 0, atrasoQtd = 0;
      monthRows.forEach((s) => {
        const price = Number(s.price ?? 0);
        if (s.payment_status === "paid") recebido += price;
        else if (s.status === "completed") aReceber += price;
      });
      atrasoQtd = atrasoRows.length;
      setFinRecebido(recebido);
      setFinAReceber(aReceber);
      setFinAtrasoCount(atrasoQtd);

      // Valor médio por sessão (mês) — sessões com price > 0, não canceladas
      const validPriced = monthRows.filter((s) => Number(s.price ?? 0) > 0);
      const avgS = validPriced.length
        ? validPriced.reduce((acc, s) => acc + Number(s.price), 0) / validPriced.length
        : null;
      setAvgSessionPrice(avgS);

      // Valor médio do Plano de Atendimento (mês) — série recorrente identificada via notes
      const seriesTotals = new Map<string, number>();
      monthRows.forEach((s) => {
        if (!isRecurringSession(s.notes)) return;
        const key = getSeriesKey(s);
        if (!key) return;
        const price = Number(s.price ?? 0);
        if (!(price > 0)) return;
        seriesTotals.set(key, (seriesTotals.get(key) ?? 0) + price);
      });
      const planCount = seriesTotals.size;
      const avgP = planCount
        ? Array.from(seriesTotals.values()).reduce((a, b) => a + b, 0) / planCount
        : null;
      setAvgPlanValue(avgP);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // TODAY list derived from weekSessions
  useEffect(() => {
    const list = weekSessions
      .filter((s) => isSameDay(new Date(s.scheduled_at), new Date()))
      .map<TodayItem>((s) => ({
        id: s.id,
        time: format(new Date(s.scheduled_at), "HH:mm"),
        name: s.patient_name,
        mode: (s.modality?.toLowerCase() === "presencial" ? "Presencial" : "Online"),
        status:
          s.status === "confirmed" ? "confirmed"
          : s.status === "completed" ? "completed"
          : s.status === "no_show" ? "no_show"
          : s.status === "scheduled" ? "scheduled"
          : "to-confirm",
      }));
    setTodayItems(list);
  }, [weekSessions]);

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, WeekSession[]>();
    weekDays.forEach((d) => map.set(d.toDateString(), []));
    weekSessions.forEach((s) => {
      const key = new Date(s.scheduled_at).toDateString();
      if (map.has(key)) map.get(key)!.push(s);
    });
    return map;
  }, [weekDays, weekSessions]);

  const counts = weekDays.map((d) => sessionsByDay.get(d.toDateString())?.length ?? 0);
  const maxWeek = Math.max(1, ...counts);
  const totalWeek = weekSessions.length;
  const weekRemaining = weekSessions.filter(
    (s) => s.status !== "completed" && s.status !== "no_show",
  ).length;
  const selectedSessions = sessionsByDay.get(selectedDate.toDateString()) ?? [];
  const selectedLabel = format(selectedDate, "EEEE", { locale: ptBR });

  const nextTime = useMemo(() => {
    const now = new Date();
    const upcoming = weekSessions
      .filter((s) => new Date(s.scheduled_at) >= now && s.status !== "completed" && s.status !== "no_show")
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0];
    return upcoming ? format(new Date(upcoming.scheduled_at), "HH:mm") : "—";
  }, [weekSessions]);

  const KPI = useMemo(
    () => [
      {
        label: "Pacientes ativos",
        value: String(activePatients),
        hint: newPatientsMonth > 0 ? `+${newPatientsMonth} neste mês` : "Nenhum novo neste mês",
        to: "/app/pacientes",
      },
      {
        label: "Sessões na semana",
        value: String(totalWeek),
        hint: `${weekRemaining} ainda por realizar`,
        to: "/app/agenda",
      },
      {
        label: "Comparecimento",
        value: attendancePct == null ? "—" : `${attendancePct}%`,
        hint:
          attendancePct == null
            ? "Sem sessões suficientes"
            : attendanceDelta == null
              ? "Últimos 60 dias"
              : `${attendanceDelta >= 0 ? "+" : ""}${attendanceDelta}% sobre período anterior`,
        to: "/app/agenda",
      },
    ],
    [activePatients, newPatientsMonth, totalWeek, weekRemaining, attendancePct, attendanceDelta],
  );

  const PENDINGS = [
    { icon: ClipboardList, label: "Registros pendentes", count: pendingRecords, to: "/app/registro-sessao" },
    { icon: CalendarX, label: "Sem próxima sessão", count: semProxima, to: "/app/pacientes?filter=sem-proxima" },
    { icon: CircleDollarSign, label: "Pagamentos atrasados", count: pagamentosAtrasados, to: "/app/financeiro?filter=atrasados" },
    { icon: UserMinus, label: "Baixa adesão", count: baixaAdesao, to: "/app/pacientes?filter=baixa-adesao" },
  ];

  const tabsRef = useRef<HTMLDivElement>(null);
  const onTabsKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = weekDays.findIndex((d) => isSameDay(d, selectedDate));
    let next = idx;
    if (e.key === "ArrowRight") next = Math.min(weekDays.length - 1, idx + 1);
    else if (e.key === "ArrowLeft") next = Math.max(0, idx - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = weekDays.length - 1;
    else return;
    e.preventDefault();
    setSelectedDate(weekDays[next]);
    const btn = tabsRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next];
    btn?.focus();
  };

  const handleAction = (label: string) =>
    toast.success(label, { description: "Ação simulada nesta versão." });

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto w-full max-w-[1200px] px-4 md:px-6 py-6 md:py-8 space-y-8">
        {/* ─ Cabeçalho ─ */}
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-2xl md:text-[28px] leading-tight font-semibold tracking-tight text-foreground">
              {greeting()}{displayName ? `, ${displayName}` : ""}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {capDate} · Próxima sessão às{" "}
              <span className="text-foreground font-medium">{nextTime}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-full gap-2"
              onClick={() => navigate("/app/pacientes")}
            >
              <Search className="h-4 w-4" />
              Buscar paciente
            </Button>
            <Button
              size="sm"
              className="h-10 rounded-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => navigate("/app/agenda")}
            >
              <Plus className="h-4 w-4" />
              Nova sessão
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Notificações"
                  className="h-10 w-10 rounded-full"
                >
                  <Bell className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Notificações</TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* ─ KPIs ─ */}
        <section
          aria-label="Indicadores principais"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {KPI.map((k) => (
            <Link
              key={k.label}
              to={k.to}
              className="group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
            >
              <Card className="rounded-2xl border-border/60 bg-card p-5 shadow-none transition-colors hover:border-border">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {k.label}
                </p>
                <p className="mt-3 font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
                  {k.value}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{k.hint}</p>
              </Card>
            </Link>
          ))}
        </section>

        {/* ─ Hoje ─ */}
        <section aria-labelledby="today-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="today-heading" className="font-display text-xl font-semibold tracking-tight">
              Hoje
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/app/agenda")}
              className="text-primary hover:text-primary hover:bg-primary/5 gap-1"
            >
              Ver agenda <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Card className="rounded-2xl border-border/60 divide-y divide-border/60 overflow-hidden">
            {todayItems.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                Nenhuma sessão agendada para hoje.
              </div>
            ) : (
              todayItems.map((s) => (
                <TodayRow
                  key={s.id}
                  item={s}
                  onOpen={() => navigate("/app/agenda")}
                  onConfirm={() => handleAction(`Sessão de ${s.name} confirmada`)}
                />
              ))
            )}
          </Card>
        </section>

        {/* ─ 2 colunas: Atenção + Agenda semana ─ */}
        <section className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
          {/* Atenção */}
          <div className="space-y-3">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Atenção necessária
            </h2>
            <Card className="rounded-2xl border-border/60 divide-y divide-border/60">
              {PENDINGS.map((p) => (
                <Link
                  key={p.label}
                  to={p.to}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors focus:outline-none focus-visible:bg-muted/40"
                >
                  <span className="flex items-center gap-3 text-sm text-foreground">
                    <p.icon className="h-4 w-4 text-muted-foreground" />
                    {p.label}
                  </span>
                  <span
                    className={cn(
                      "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-medium",
                      p.count > 0
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {p.count}
                  </span>
                </Link>
              ))}
            </Card>
          </div>

          {/* Semana */}
          <div className="space-y-3">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight">
                Agenda da semana
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {totalWeek} {totalWeek === 1 ? "sessão" : "sessões"} de segunda a sexta · <span className="capitalize">{selectedLabel}</span> selecionada
              </p>
            </div>
            <Card className="rounded-2xl border-border/60 p-5 space-y-5">
              <div
                ref={tabsRef}
                role="tablist"
                aria-label="Dias da semana"
                onKeyDown={onTabsKeyDown}
                className="flex items-end justify-between gap-3 h-44"
              >
                {weekDays.map((d, i) => {
                  const active = isSameDay(d, selectedDate);
                  const value = counts[i];
                  const pct = (value / maxWeek) * 100;
                  const label = WEEK_DAY_LABELS[i];
                  const tabId = `weekday-${i}`;
                  return (
                    <button
                      key={tabId}
                      id={tabId}
                      role="tab"
                      aria-selected={active}
                      aria-controls="weekday-panel"
                      tabIndex={active ? 0 : -1}
                      onClick={() => setSelectedDate(d)}
                      className="group flex flex-1 flex-col items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
                      aria-label={`${label}, ${format(d, "d 'de' MMMM", { locale: ptBR })}: ${value} ${value === 1 ? "sessão" : "sessões"}`}
                    >
                      <span
                        className={cn(
                          "text-xs font-medium tabular-nums",
                          active ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {value}
                      </span>
                      <div className="flex h-32 w-full items-end justify-center">
                        <div
                          style={{ height: value === 0 ? "4px" : `${pct}%` }}
                          className={cn(
                            "w-6 md:w-8 rounded-t-md transition-colors",
                            active
                              ? "bg-primary"
                              : value === 0
                                ? "bg-muted"
                                : "bg-primary/25 group-hover:bg-primary/40",
                          )}
                        />
                      </div>
                      <span
                        className={cn(
                          "text-xs flex flex-col items-center leading-tight",
                          active ? "text-foreground font-medium" : "text-muted-foreground",
                        )}
                      >
                        {label}
                        {isToday(d) && <span className="text-[10px] text-primary">hoje</span>}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div
                id="weekday-panel"
                role="tabpanel"
                aria-labelledby={`weekday-${weekDays.findIndex((d) => isSameDay(d, selectedDate))}`}
                className="border-t border-border/60 pt-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-foreground capitalize">
                    {selectedLabel} · {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {selectedSessions.length} {selectedSessions.length === 1 ? "sessão" : "sessões"}
                  </span>
                </div>

                {loadingWeek ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-10 rounded-lg bg-muted/50 animate-pulse" />
                    ))}
                  </div>
                ) : selectedSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <CalendarDays className="h-5 w-5 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma sessão agendada neste dia.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {selectedSessions.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/40 transition-colors"
                      >
                        <span className="text-xs font-medium tabular-nums text-muted-foreground w-12 shrink-0">
                          {format(new Date(s.scheduled_at), "HH:mm")}
                        </span>
                        <span className="text-sm text-foreground flex-1 truncate">
                          {s.patient_name}
                        </span>
                        {s.modality && (
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            {s.modality}
                          </span>
                        )}
                        <StatusDot status={s.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>
        </section>

        {/* ─ Financeiro compacto ─ */}
        <section aria-labelledby="finance-heading">
          <Card className="rounded-2xl border-border/60 bg-muted/30 p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="grid flex-1 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Recebido</p>
                  <p className="mt-1 font-display text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                    {fmtBRL(finRecebido)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">A receber</p>
                  <p className="mt-1 font-display text-lg font-semibold text-foreground">
                    {fmtBRL(finAReceber)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Em atraso</p>
                  <p className="mt-1 font-display text-lg font-semibold text-amber-700 dark:text-amber-400">
                    {finAtrasoCount} {finAtrasoCount === 1 ? "pagamento" : "pagamentos"}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/app/financeiro")}
                className="rounded-full gap-2 self-start md:self-auto"
              >
                Abrir financeiro <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <h2 id="finance-heading" className="sr-only">
              Resumo financeiro
            </h2>
          </Card>
        </section>
      </div>
    </TooltipProvider>
  );
}

/* ─── Sub-components ─── */
function TodayRow({
  item,
  onOpen,
  onConfirm,
}: {
  item: TodayItem;
  onOpen: () => void;
  onConfirm: () => void;
}) {
  const ModeIcon = item.mode === "Online" ? Video : MapPin;
  return (
    <div className="flex items-center gap-4 px-4 md:px-5 py-4 hover:bg-muted/30 transition-colors">
      <div className="w-14 shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
        {item.time}
      </div>
      <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
        {initials(item.name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">
          {item.name}
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
          <ModeIcon className="h-3 w-3" />
          {item.mode}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {item.status === "confirmed" ? (
          <Badge
            variant="secondary"
            className="rounded-full bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900 gap-1"
          >
            <CheckCircle2 className="h-3 w-3" />
            Confirmada
          </Badge>
        ) : item.status === "completed" ? (
          <Badge variant="secondary" className="rounded-full">Realizada</Badge>
        ) : item.status === "no_show" ? (
          <Badge variant="secondary" className="rounded-full bg-amber-50 text-amber-700 border-amber-100">Falta</Badge>
        ) : item.status === "scheduled" ? (
          <Button variant="outline" size="sm" onClick={onOpen} className="rounded-full h-8">
            Abrir sessão
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={onConfirm} className="rounded-full h-8">
            Confirmar
          </Button>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Mais ações para ${item.name}`}
              className="h-8 w-8 rounded-full hidden md:inline-flex"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Mais ações</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    confirmed: { color: "bg-emerald-500", label: "Confirmada" },
    scheduled: { color: "bg-primary/60", label: "Agendada" },
    completed: { color: "bg-muted-foreground/40", label: "Realizada" },
    cancelled: { color: "bg-destructive/60", label: "Cancelada" },
    no_show: { color: "bg-amber-500", label: "Falta" },
  };
  const s = map[status] ?? { color: "bg-muted-foreground/40", label: status };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={s.label}
          className={cn("inline-block h-2 w-2 rounded-full shrink-0", s.color)}
        />
      </TooltipTrigger>
      <TooltipContent>{s.label}</TooltipContent>
    </Tooltip>
  );
}
