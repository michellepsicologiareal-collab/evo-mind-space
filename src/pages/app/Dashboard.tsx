import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  Calendar,
  TrendingUp,
  Briefcase,
  ArrowRight,
  Eye,
  EyeOff,
  Clock,
  FileText,
  Target,
  SmilePlus,
  Heart,
  CalendarDays,
  CalendarRange,
  Banknote,
  CheckCircle2,
  XCircle,
  CalendarClock,
  ClipboardList,
  Info,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, differenceInMinutes, subMonths, startOfWeek, endOfWeek, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CardSkeleton } from "@/components/app/Skeletons";
import { Area, AreaChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, PieChart, Pie, Cell, Legend } from "recharts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/* ── types ── */
interface Stats {
  activePatients: number;
  todaySessions: number;
  monthRevenue: number;
  supervisionCases: number;
  completedSessions: number;
  totalRecords: number;
  revenueGoal: number;
  sessionsGoal: number;
  recordsGoal: number;
  previstos: number;
  realizados: number;
  faltasCanceladas: number;
  aRealizar: number;
}

interface UpcomingSession {
  id: string;
  scheduled_at: string;
  patient_name: string;
  patient_initials: string;
  status: string;
  session_number: number;
}

interface PatientMoodEntry {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_initials: string;
  mood_score: number;
  note: string | null;
  recorded_at: string;
}

interface FrequencyData {
  name: string;
  value: number;
  avgPrice: number;
}

/* ── helpers ── */
const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
};

const avatarColors = [
  "bg-accent/20 text-accent",
  "bg-lilac/20 text-lilac",
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
];

const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
};

const statusConfig: Record<string, { label: string; className: string }> = {
  scheduled: { label: "Agendada", className: "bg-secondary text-secondary-foreground" },
  confirmed: { label: "Confirmada", className: "bg-emerald-100 text-emerald-700" },
  supervision: { label: "Supervisão", className: "bg-lilac/20 text-lilac" },
  pending: { label: "Pendente", className: "bg-amber-100 text-amber-700" },
};

const PIE_COLORS = ["hsl(var(--accent))", "hsl(var(--lilac))"];

/* ── date range helpers ── */
const currentMonthStart = () => startOfMonth(new Date());
const currentMonthEnd = () => endOfMonth(new Date());

/* ── component ── */
const Dashboard = () => {
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState<Date>(currentMonthStart());
  const [dateTo, setDateTo] = useState<Date>(currentMonthEnd());
  const [stats, setStats] = useState<Stats>({
    activePatients: 0,
    todaySessions: 0,
    monthRevenue: 0,
    supervisionCases: 0,
    completedSessions: 0,
    totalRecords: 0,
    revenueGoal: 10000,
    sessionsGoal: 40,
    recordsGoal: 20,
    previstos: 0,
    realizados: 0,
    faltasCanceladas: 0,
    aRealizar: 0,
  });
  const [upcoming, setUpcoming] = useState<UpcomingSession[]>([]);
  const [profileName, setProfileName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [loading, setLoading] = useState(true);
  const [hideRevenue, setHideRevenue] = useState(false);
  const [nextSessionMin, setNextSessionMin] = useState<number | null>(null);
  const [moodData, setMoodData] = useState<{ name: string; score: number }[]>([]);
  const [avgMood, setAvgMood] = useState<number | null>(null);
  const [topMoodPatient, setTopMoodPatient] = useState("");
  const [prevMonthRevenue, setPrevMonthRevenue] = useState(0);
  const [weeklyRevenue, setWeeklyRevenue] = useState<{ week: string; value: number }[]>([]);
  const [patientMoods, setPatientMoods] = useState<PatientMoodEntry[]>([]);
  const [weekSessions, setWeekSessions] = useState(0);
  const [monthSessions, setMonthSessions] = useState(0);
  const [yearRevenue, setYearRevenue] = useState(0);
  const [frequencyData, setFrequencyData] = useState<FrequencyData[]>([]);
  const [moodFilterPatient, setMoodFilterPatient] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const now = new Date();
      const { start: periodStart, end: periodEnd } = getPeriodRange(period);
      const periodStartISO = periodStart.toISOString();
      const periodEndISO = periodEnd.toISOString();
      const dayStart = startOfDay(now).toISOString();
      const dayEnd = endOfDay(now).toISOString();

      const weekStartDate = startOfWeek(now, { weekStartsOn: 1 });
      const weekEndDate = endOfWeek(now, { weekStartsOn: 1 });
      const yearStart = startOfYear(now).toISOString();
      const yearEnd = endOfYear(now).toISOString();

      const [profileRes, patientsRes, todayRes, monthRes, upcomingRes, supervisionRes, recordsRes, weekRes, monthAllRes, yearRes] =
        await Promise.all([
          supabase.from("profiles").select("full_name, clinic_name").eq("id", user.id).maybeSingle(),
          supabase.from("patients").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_active", true),
          supabase.from("sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("scheduled_at", dayStart).lte("scheduled_at", dayEnd).in("status", ["scheduled", "confirmed", "completed"]),
          supabase.from("sessions").select("price, status, scheduled_at").eq("user_id", user.id).gte("scheduled_at", periodStartISO).lte("scheduled_at", periodEndISO),
          supabase
            .from("sessions")
            .select("id, scheduled_at, status, patient_id, session_type, patient:patients!sessions_patient_id_fkey(full_name)")
            .eq("user_id", user.id)
            .gte("scheduled_at", now.toISOString())
            .in("status", ["scheduled", "confirmed"])
            .order("scheduled_at")
            .limit(3),
          supabase
            .from("patients")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("shared_with_supervisor", true),
          supabase
            .from("tcc_records")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),
          supabase.from("sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("scheduled_at", weekStartDate.toISOString()).lte("scheduled_at", weekEndDate.toISOString()).in("status", ["scheduled", "confirmed", "completed"]),
          supabase.from("sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("scheduled_at", periodStartISO).lte("scheduled_at", periodEndISO).in("status", ["scheduled", "confirmed", "completed"]),
          supabase.from("sessions").select("price, status, is_expense").eq("user_id", user.id).gte("scheduled_at", yearStart).lte("scheduled_at", yearEnd).eq("status", "completed"),
        ]);

      setProfileName(profileRes.data?.full_name ?? "");
      setClinicName((profileRes.data as any)?.clinic_name ?? "");

      const monthSessionsArr = monthRes.data ?? [];
      const revenue = monthSessionsArr.filter((s) => s.status === "completed").reduce((sum, s) => sum + Number(s.price ?? 0), 0);
      const completed = monthSessionsArr.filter((s) => s.status === "completed").length;
      const faltasCanceladas = monthSessionsArr.filter((s) => s.status === "no_show" || s.status === "cancelled").length;
      const now2 = new Date();
      const aRealizar = monthSessionsArr.filter((s) => {
        const d = new Date(s.scheduled_at);
        return d > now2 && s.status !== "completed" && s.status !== "cancelled" && s.status !== "no_show";
      }).length;

      setStats({
        activePatients: patientsRes.count ?? 0,
        todaySessions: todayRes.count ?? 0,
        monthRevenue: revenue,
        supervisionCases: supervisionRes.count ?? 0,
        completedSessions: completed,
        totalRecords: recordsRes.count ?? 0,
        revenueGoal: 10000,
        sessionsGoal: 40,
        recordsGoal: 20,
        previstos: monthSessionsArr.length,
        realizados: completed,
        faltasCanceladas,
        aRealizar,
      });

      setWeekSessions(weekRes.count ?? 0);
      setMonthSessions(monthAllRes.count ?? 0);
      // Exclude expenses from year revenue
      setYearRevenue(
        (yearRes.data ?? [])
          .filter((s: any) => !s.is_expense)
          .reduce((sum, s) => sum + Number(s.price ?? 0), 0)
      );

      const sessionsData = (upcomingRes.data ?? []) as any[];
      const uniquePatientIds = [...new Set(sessionsData.map((s: any) => s.patient_id).filter(Boolean))];
      const countResults = await Promise.all(
        uniquePatientIds.map((pid) =>
          supabase
            .from("sessions")
            .select("id", { count: "exact", head: true })
            .eq("patient_id", pid)
            .eq("user_id", user.id)
            .then(({ count }) => [pid, count ?? 0] as const)
        )
      );
      const patientSessionCounts = Object.fromEntries(countResults);

      const mapped = sessionsData.map((s: any) => ({
        id: s.id,
        scheduled_at: s.scheduled_at,
        patient_name: s.session_type === "supervision" ? "Supervisão" : (s.patient?.full_name ?? "—"),
        patient_initials: s.session_type === "supervision" ? "SV" : getInitials(s.patient?.full_name ?? "?"),
        status: s.status ?? "scheduled",
        session_number: patientSessionCounts[s.patient_id] ?? 1,
      }));

      setUpcoming(mapped);

      if (mapped.length > 0) {
        const diff = differenceInMinutes(new Date(mapped[0].scheduled_at), now);
        setNextSessionMin(diff > 0 ? diff : null);
      }

      // ── Frequency analysis (weekly vs biweekly) ──
      // Group completed sessions by patient, calc avg interval
      const { data: freqSessions } = await supabase
        .from("sessions")
        .select("patient_id, scheduled_at, price, status, is_expense")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .eq("is_expense", false)
        .order("scheduled_at", { ascending: true });

      if (freqSessions && freqSessions.length > 0) {
        const byPatient: Record<string, { dates: Date[]; prices: number[] }> = {};
        freqSessions.forEach((s: any) => {
          if (!byPatient[s.patient_id]) byPatient[s.patient_id] = { dates: [], prices: [] };
          byPatient[s.patient_id].dates.push(new Date(s.scheduled_at));
          byPatient[s.patient_id].prices.push(Number(s.price ?? 0));
        });

        const freqCounts: Record<string, { count: number; totalPrice: number }> = {
          Semanal: { count: 0, totalPrice: 0 },
          Quinzenal: { count: 0, totalPrice: 0 },
        };

        Object.values(byPatient).forEach(({ dates, prices }) => {
          if (dates.length < 2) {
            // With only 1 session, can't determine interval — skip
            return;
          }
          // calc avg interval in days
          let totalDays = 0;
          for (let i = 1; i < dates.length; i++) {
            totalDays += (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
          }
          const avgInterval = totalDays / (dates.length - 1);
          const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

          if (avgInterval <= 10) {
            freqCounts["Semanal"].count++;
            freqCounts["Semanal"].totalPrice += avgPrice;
          } else {
            freqCounts["Quinzenal"].count++;
            freqCounts["Quinzenal"].totalPrice += avgPrice;
          }
        });

        const pieData: FrequencyData[] = Object.entries(freqCounts)
          .filter(([, v]) => v.count > 0)
          .map(([name, v]) => ({
            name,
            value: v.count,
            avgPrice: v.count > 0 ? Math.round(v.totalPrice / v.count) : 0,
          }));

        setFrequencyData(pieData);
      }

      // ── Mood + Previous revenue in parallel ──
      const prevStart = startOfMonth(subMonths(now, 1)).toISOString();
      const prevEnd = endOfMonth(subMonths(now, 1)).toISOString();

      const [moodRes, prevRes] = await Promise.all([
        supabase
          .from("patient_progress")
          .select("mood_score, recorded_at, patient_id")
          .eq("user_id", user.id)
          .not("mood_score", "is", null)
          .order("recorded_at", { ascending: true })
          .limit(30),
        supabase
          .from("sessions")
          .select("price, status")
          .eq("user_id", user.id)
          .gte("scheduled_at", prevStart)
          .lte("scheduled_at", prevEnd),
      ]);

      const moodRows = moodRes.data;
      if (moodRows && moodRows.length > 0) {
        const moodChartData = moodRows.map((m: any) => ({
          name: format(new Date(m.recorded_at), "dd/MM"),
          score: Number(m.mood_score),
        }));
        setMoodData(moodChartData);
        const avg = moodChartData.reduce((s, d) => s + d.score, 0) / moodChartData.length;
        setAvgMood(Math.round(avg * 10) / 10);

        const patientCounts: Record<string, number> = {};
        moodRows.forEach((m: any) => { patientCounts[m.patient_id] = (patientCounts[m.patient_id] ?? 0) + 1; });
        const topPatientId = Object.entries(patientCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
        if (topPatientId) {
          const { data: pat } = await supabase.from("patients").select("full_name").eq("id", topPatientId).maybeSingle();
          if (pat) {
            const parts = pat.full_name.split(" ");
            setTopMoodPatient(parts[0] + (parts[1] ? ` ${parts[1][0]}.` : ""));
          }
        }
      }

      const prevRev = (prevRes.data ?? [])
        .filter((s) => s.status === "completed")
        .reduce((sum, s) => sum + Number(s.price ?? 0), 0);
      setPrevMonthRevenue(prevRev);

      const weekData: { week: string; value: number }[] = [];
      const monthSess = monthSessionsArr.filter((s) => s.status === "completed");
      for (let w = 0; w < 4; w++) {
        const wStart = w * 7 + 1;
        const wEnd = w === 3 ? 31 : (w + 1) * 7;
        const val = monthSess
          .filter((s: any) => {
            const day = new Date(s.scheduled_at ?? now).getDate();
            return day >= wStart && day <= wEnd;
          })
          .reduce((sum, s) => sum + Number(s.price ?? 0), 0);
        weekData.push({ week: `S${w + 1}`, value: val });
      }
      setWeeklyRevenue(weekData);

      const { data: recentMoods } = await supabase
        .from("patient_progress")
        .select("id, mood_score, note, recorded_at, patient_id")
        .eq("user_id", user.id)
        .not("mood_score", "is", null)
        .order("recorded_at", { ascending: false })
        .limit(100);

      if (recentMoods && recentMoods.length > 0) {
        const pIds = [...new Set(recentMoods.map((m: any) => m.patient_id))];
        const { data: pNames } = await supabase
          .from("patients")
          .select("id, full_name")
          .in("id", pIds);
        const nameMap: Record<string, string> = {};
        (pNames ?? []).forEach((p: any) => { nameMap[p.id] = p.full_name; });

        setPatientMoods(
          recentMoods.map((m: any) => ({
            id: m.id,
            patient_id: m.patient_id,
            patient_name: nameMap[m.patient_id] ?? "Paciente",
            patient_initials: getInitials(nameMap[m.patient_id] ?? "?"),
            mood_score: Number(m.mood_score),
            note: m.note,
            recorded_at: m.recorded_at,
          }))
        );
      }
    };
    load()
      .catch((error) => {
        console.warn("Não foi possível carregar o painel inicial:", error);
      })
      .finally(() => setLoading(false));
  }, [user, period]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  })();

  const firstName = profileName?.split(" ")[0] ?? "";
  const periodLabel = getPeriodRange(period).label;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 rounded-2xl bg-muted animate-pulse" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <div className="h-64 rounded-2xl bg-muted animate-pulse" />
      </div>
    );
  }

  const summaryParts: string[] = [];
  if (stats.todaySessions > 0)
    summaryParts.push(`Você tem ${stats.todaySessions} ${stats.todaySessions === 1 ? "sessão" : "sessões"} hoje`);
  if (nextSessionMin !== null && nextSessionMin > 0) {
    const hours = Math.floor(nextSessionMin / 60);
    const mins = nextSessionMin % 60;
    const timeStr = hours > 0 ? `${hours}h${mins > 0 ? `${mins}min` : ""}` : `${mins} min`;
    summaryParts.push(`A próxima começa em ${timeStr}`);
  }
  const summaryText =
    summaryParts.length > 0
      ? summaryParts.join(". ") + "."
      : "Sua agenda está tranquila hoje. Aproveite para organizar seus registros.";

  const progressItems = [
    {
      label: "Sessões Realizadas",
      icon: Calendar,
      current: stats.completedSessions,
      goal: stats.sessionsGoal,
    },
    {
      label: "Meta de Faturamento",
      icon: Target,
      current: stats.monthRevenue,
      goal: stats.revenueGoal,
      isCurrency: true,
    },
    {
      label: "Registros Clínicos",
      icon: FileText,
      current: stats.totalRecords,
      goal: stats.recordsGoal,
    },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-8 animate-fade-up">
        {/* ── Welcome Header ── */}
        <header className="rounded-2xl bg-card border border-border shadow-card p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent via-accent/60 to-transparent" />
          {clinicName && (
            <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold">{clinicName}</p>
          )}
          <p className={`text-sm text-muted-foreground capitalize ${clinicName ? "mt-1" : ""}`}>
            {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
          <h1 className="mt-2 font-display text-3xl md:text-4xl font-bold text-foreground">
            {greeting}{firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="mt-2 text-muted-foreground text-sm md:text-base">{summaryText}</p>
        </header>

        {/* ── Period Filter ── */}
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Período:</span>
          <Select value={period} onValueChange={(v) => setPeriod(v)}>
            <SelectTrigger className="w-[220px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── KPI Cards ── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard icon={Users} label="Pacientes Ativos" value={stats.activePatients.toString()} tooltip="Total de pacientes com status ativo no seu cadastro." />
          <KPICard icon={Calendar} label="Sessões Hoje" value={stats.todaySessions.toString()} tooltip="Quantidade de sessões agendadas, confirmadas ou concluídas para o dia de hoje." />
          <KPICard icon={CalendarDays} label="Sessões esta Semana" value={weekSessions.toString()} tooltip="Total de sessões (agendadas, confirmadas ou concluídas) na semana atual (segunda a domingo)." />
          <KPICard icon={CalendarRange} label="Sessões este Mês" value={monthSessions.toString()} tooltip="Total de sessões (agendadas, confirmadas ou concluídas) no mês corrente." />
        </section>

        {/* ── Métricas de Sessões do Mês ── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard icon={ClipboardList} label="Previstos" value={stats.previstos.toString()} tooltip="Total de sessões previstas no período selecionado (todos os status)." />
          <KPICard icon={CheckCircle2} label="Realizados" value={stats.realizados.toString()} tooltip="Sessões concluídas (status 'completed') no período." />
          <KPICard icon={XCircle} label="Faltas / Canceladas" value={stats.faltasCanceladas.toString()} highlight={stats.faltasCanceladas > 0} tooltip="Sessões canceladas ou marcadas como falta no período." />
          <KPICard icon={CalendarClock} label="A Realizar" value={stats.aRealizar.toString()} tooltip="Sessões futuras no período que ainda não foram concluídas." />
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            icon={TrendingUp}
            label={`Faturamento — ${periodLabel}`}
            value={hideRevenue ? "•••••" : `R$ ${stats.monthRevenue.toFixed(2).replace(".", ",")}`}
            action={
              <button
                onClick={() => setHideRevenue(!hideRevenue)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label={hideRevenue ? "Mostrar valor" : "Ocultar valor"}
              >
                {hideRevenue ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            }
            highlight
            tooltip="Soma dos valores de todas as sessões concluídas no mês atual (exceto despesas)."
          />
          <KPICard
            icon={Banknote}
            label={`Faturamento ${new Date().getFullYear()}`}
            value={hideRevenue ? "•••••" : `R$ ${yearRevenue.toFixed(2).replace(".", ",")}`}
            highlight
            tooltip={`Soma de todas as sessões concluídas em ${new Date().getFullYear()}, excluindo despesas.`}
          />
          <KPICard icon={Briefcase} label="Casos em Supervisão" value={stats.supervisionCases.toString()} tooltip="Pacientes com compartilhamento ativo para supervisão clínica." />
        </section>

        {/* ── Insight Charts ── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mood Chart Card */}
          <div className="rounded-2xl bg-card border border-border shadow-card p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-serene via-serene/60 to-transparent" />
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Humor médio{topMoodPatient ? ` · ${topMoodPatient}` : ""}
            </p>
            <p className="font-display text-3xl font-bold text-foreground">
              {avgMood !== null ? avgMood.toFixed(1).replace(".", ",") : "—"}
              <span className="text-lg text-muted-foreground font-normal"> / 10</span>
            </p>
            {moodData.length > 1 ? (
              <div className="mt-3 h-[80px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={moodData}>
                    <defs>
                      <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--serene))" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(var(--serene))" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <RechartsTooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                      formatter={(v: number) => [`${v}/10`, "Humor"]}
                      labelFormatter={(l) => `Dia ${l}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="hsl(var(--serene))"
                      strokeWidth={2.5}
                      fill="url(#moodGrad)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Registre o humor dos pacientes para ver o gráfico aqui ✨</p>
            )}
            {moodData.length > 1 && (
              <div className="flex gap-1 mt-2">
                {moodData.slice(-7).map((d, i) => (
                  <div
                    key={i}
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: d.score >= 7 ? "hsl(var(--serene))" : d.score >= 4 ? "hsl(var(--sand))" : "hsl(var(--destructive))",
                      opacity: 0.5 + (i / 10),
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Revenue Chart Card */}
          <div className="rounded-2xl bg-card border border-border shadow-card p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent via-accent/60 to-transparent" />
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Faturamento — {periodLabel}
            </p>
            <p className="font-display text-3xl font-bold text-foreground">
              {hideRevenue ? "•••••" : `R$ ${stats.monthRevenue.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`}
            </p>
            {prevMonthRevenue > 0 && !hideRevenue && (() => {
              const pctChange = ((stats.monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100;
              const isUp = pctChange >= 0;
              return (
                <p className={`text-sm font-medium mt-1 ${isUp ? "text-emerald-600" : "text-destructive"}`}>
                  {isUp ? "↑" : "↓"} {Math.abs(pctChange).toFixed(0)}% vs. {format(subMonths(new Date(), 1), "MMMM", { locale: ptBR })}
                </p>
              );
            })()}
            {weeklyRevenue.some((w) => w.value > 0) ? (
              <div className="mt-3 h-[80px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyRevenue}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                      formatter={(v: number) => [`R$ ${v.toFixed(0)}`, "Receita"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--accent))"
                      strokeWidth={2.5}
                      fill="url(#revGrad)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Complete sessões para ver seu faturamento semanal 📊</p>
            )}
          </div>
        </section>

        {/* ── Gráfico de Pizza: Frequência de Atendimentos ── */}
        <section className="rounded-2xl bg-card border border-border shadow-card p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-lilac via-accent/60 to-transparent" />
          <div className="flex items-center gap-2 mb-4">
            <CalendarRange className="h-5 w-5 text-lilac" />
            <h2 className="font-display text-xl font-bold text-foreground">Tipo de Atendimento por Frequência</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Classifica seus pacientes pelo intervalo médio entre sessões: Semanal (até 10 dias) ou Quinzenal (acima de 10 dias). Mostra a média de valor por tipo.</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {frequencyData.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <CalendarRange className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-display text-lg font-medium text-foreground/70">Dados insuficientes</p>
              <p className="mt-1 text-sm">Complete mais sessões para ver a distribuição de frequências dos seus atendimentos.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={frequencyData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {frequencyData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                      formatter={(value: number, name: string, props: any) => [
                        `${value} paciente${value !== 1 ? "s" : ""} · Média R$ ${props.payload.avgPrice}`,
                        name,
                      ]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {frequencyData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30">
                    <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <div className="flex-1">
                      <p className="font-semibold text-foreground text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.value} paciente{item.value !== 1 ? "s" : ""} · Média: R$ {item.avgPrice.toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Emoções dos Pacientes ── */}
        <section className="rounded-2xl bg-card border border-border shadow-card p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-lilac via-lilac/60 to-transparent" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <SmilePlus className="h-5 w-5 text-lilac" />
              <h2 className="font-display text-xl md:text-2xl font-bold text-foreground">Emoções dos Pacientes</h2>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/agenda" className="text-lilac hover:text-lilac/80">
                Ver sessões <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* Patient filter */}
          {patientMoods.length > 0 && (() => {
            const uniquePatients = Array.from(
              new Map(patientMoods.map(m => [m.patient_id, { id: m.patient_id, name: m.patient_name }])).values()
            ).sort((a, b) => a.name.localeCompare(b.name));
            return (
              <div className="mb-4">
                <Select value={moodFilterPatient} onValueChange={setMoodFilterPatient}>
                  <SelectTrigger className="w-[250px] h-9 text-sm">
                    <SelectValue placeholder="Todos os pacientes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os pacientes</SelectItem>
                    {uniquePatients.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })()}

          {(() => {
            const filtered = moodFilterPatient === "all"
              ? patientMoods.slice(0, 15)
              : patientMoods.filter(m => m.patient_id === moodFilterPatient);

            if (filtered.length === 0) {
              return (
                <div className="text-center py-10 text-muted-foreground">
                  <Heart className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="font-display text-lg font-medium text-foreground/70">Nenhum registro de humor ainda</p>
                  <p className="mt-1 text-sm">Registre o humor dos pacientes nas sessões para acompanhar a evolução emocional aqui ✨</p>
                </div>
              );
            }

            return (
              <ul className="space-y-3">
                {filtered.map((m) => {
                  const moodEmoji = m.mood_score >= 8 ? "🤩" : m.mood_score >= 6 ? "🙂" : m.mood_score >= 4 ? "😐" : m.mood_score >= 2 ? "😔" : "😫";
                  const moodColor = m.mood_score >= 7 ? "text-emerald-600 bg-emerald-100" : m.mood_score >= 4 ? "text-amber-600 bg-amber-100" : "text-rose-600 bg-rose-100";
                  return (
                    <li
                      key={m.id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                    >
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold text-sm ${getAvatarColor(m.patient_name)}`}>
                        {m.patient_initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{m.patient_name}</p>
                        {m.note && <p className="text-sm text-muted-foreground truncate">{m.note}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(m.recorded_at), "dd/MM/yyyy · HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xl">{moodEmoji}</span>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${moodColor}`}>
                          {m.mood_score}/10
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          title="Excluir registro"
                          onClick={async () => {
                            await supabase.from("patient_progress").delete().eq("id", m.id);
                            setPatientMoods(prev => prev.filter(x => x.id !== m.id));
                          }}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </section>

        {/* ── Upcoming Sessions ── */}
        <section className="rounded-2xl bg-card border border-border shadow-card p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl md:text-2xl font-bold text-foreground">Próximas Sessões</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/agenda" className="text-accent hover:text-accent/80">
                Ver agenda <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {upcoming.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-display text-lg font-medium text-foreground/70">Sua agenda está tranquila</p>
              <p className="mt-1 text-sm">Que tal agendar a próxima sessão?</p>
              <Button variant="accent" size="sm" className="mt-5 min-h-[44px]" asChild>
                <Link to="/app/agenda">Agendar uma sessão</Link>
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((s) => {
                const st = statusConfig[s.status] ?? statusConfig.scheduled;
                return (
                  <li
                    key={s.id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold text-sm ${getAvatarColor(s.patient_name)}`}
                    >
                      {s.patient_initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{s.patient_name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="capitalize">
                          {format(new Date(s.scheduled_at), "HH:mm", { locale: ptBR })}
                        </span>
                        <span className="text-border">•</span>
                        <span>Sessão #{s.session_number}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap ${st.className}`}>
                      {st.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── Goals / Gamification ── */}
        <section className="rounded-2xl bg-card border border-border shadow-card p-8">
          <h2 className="font-display text-xl md:text-2xl font-bold text-foreground mb-6">Metas do Mês</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {progressItems.map((item) => {
              const pct = item.goal > 0 ? Math.min((item.current / item.goal) * 100, 100) : 0;
              const displayCurrent = item.isCurrency
                ? `R$ ${item.current.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`
                : item.current.toString();
              const displayGoal = item.isCurrency
                ? `R$ ${item.goal.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`
                : item.goal.toString();

              return (
                <div key={item.label} className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <item.icon className="h-4 w-4 text-accent" />
                    {item.label}
                  </div>
                  <div className="h-3 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-700 ease-out"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{displayCurrent}</span>
                    <span className="font-medium">{Math.round(pct)}%</span>
                    <span>{displayGoal}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </TooltipProvider>
  );
};

/* ── KPI Card ── */
const KPICard = ({
  icon: Icon,
  label,
  value,
  highlight,
  action,
  tooltip,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  highlight?: boolean;
  action?: React.ReactNode;
  tooltip?: string;
}) => (
  <div
    className={`rounded-2xl border p-5 md:p-6 transition-all hover:-translate-y-0.5 hover:shadow-soft ${
      highlight ? "bg-accent/5 border-accent/20" : "bg-card border-border"
    }`}
  >
    <div className="flex items-center justify-between">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-accent">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex items-center gap-1">
        {action}
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
    <p className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-1 font-display text-2xl md:text-3xl font-bold text-foreground">{value}</p>
  </div>
);

export default Dashboard;
