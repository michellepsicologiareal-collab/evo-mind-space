import { useEffect, useState, useCallback } from "react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
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
  Pencil,
  AlertTriangle,
  TrendingDown,
  Minus,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, differenceInMinutes, subMonths, startOfWeek, endOfWeek, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CardSkeleton } from "@/components/app/Skeletons";
import { toast } from "sonner";
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
  previstoRevenue: number;
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

const PIE_COLORS = ["#6d4fc2", "#c9a84c"];

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
    previstoRevenue: 0,
  });
  const [upcoming, setUpcoming] = useState<UpcomingSession[]>([]);
  const [profileName, setProfileName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  useAutoRefresh(() => setRefreshKey(k => k + 1), { routePath: "/app" });
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
  const [moodPeriod, setMoodPeriod] = useState<"week" | "biweek" | "all">("all");
  const [moodChartPatient, setMoodChartPatient] = useState<string>("all");

  const [editGoalsOpen, setEditGoalsOpen] = useState(false);
  const [goalFormSessions, setGoalFormSessions] = useState(40);
  const [goalFormRevenue, setGoalFormRevenue] = useState(10000);
  const [goalFormRecords, setGoalFormRecords] = useState(20);
  const [savingGoals, setSavingGoals] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const now = new Date();
      const periodStart = dateFrom;
      const periodEnd = dateTo;
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
          supabase.from("profiles").select("full_name, clinic_name, goal_sessions, goal_revenue, goal_records").eq("id", user.id).maybeSingle(),
          supabase.from("patients").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_active", true),
          supabase.from("sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("scheduled_at", dayStart).lte("scheduled_at", dayEnd).in("status", ["scheduled", "confirmed", "completed"]),
          supabase.from("sessions").select("price, status, scheduled_at, paid_at, payment_status").eq("user_id", user.id).gte("scheduled_at", periodStartISO).lte("scheduled_at", periodEndISO),
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

      const pGoalSessions = (profileRes.data as any)?.goal_sessions ?? 40;
      const pGoalRevenue = Number((profileRes.data as any)?.goal_revenue ?? 10000);
      const pGoalRecords = (profileRes.data as any)?.goal_records ?? 20;
      setGoalFormSessions(pGoalSessions);
      setGoalFormRevenue(pGoalRevenue);
      setGoalFormRecords(pGoalRecords);

      const monthSessionsArr = monthRes.data ?? [];
      // Faturado (realizado) = completed + paid sessions in the period
      const revenue = monthSessionsArr
        .filter((s: any) => s.status === "completed" && s.payment_status === "paid")
        .reduce((sum: number, s: any) => sum + Number(s.price ?? 0), 0);
      const previstoRevenue = monthSessionsArr.filter((s: any) => s.status !== "cancelled" && s.status !== "no_show").reduce((sum: number, s: any) => sum + Number(s.price ?? 0), 0);
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
        revenueGoal: pGoalRevenue,
        sessionsGoal: pGoalSessions,
        recordsGoal: pGoalRecords,
        previstos: monthSessionsArr.filter((s) => s.status !== "cancelled" && s.status !== "no_show").length,
        realizados: completed,
        faltasCanceladas,
        aRealizar,
        previstoRevenue,
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

      // ── Frequency analysis: active patients only (weekly vs biweekly) ──
      // Fetch active patients with session_price
      const { data: activePatients } = await supabase
        .from("patients")
        .select("id, session_price")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (activePatients && activePatients.length > 0) {
        const activeIds = new Set(activePatients.map((p: any) => p.id));
        const priceMap: Record<string, number> = {};
        activePatients.forEach((p: any) => {
          priceMap[p.id] = Number(p.session_price ?? 0);
        });

        // Fetch scheduled (planned) sessions for active patients to calc interval
        const { data: freqSessions } = await supabase
          .from("sessions")
          .select("patient_id, scheduled_at")
          .eq("user_id", user.id)
          .eq("is_expense", false)
          .in("status", ["scheduled", "completed", "confirmed"])
          .order("scheduled_at", { ascending: true });

        const byPatient: Record<string, Date[]> = {};
        if (freqSessions) {
          freqSessions.forEach((s: any) => {
            if (!activeIds.has(s.patient_id)) return;
            if (!byPatient[s.patient_id]) byPatient[s.patient_id] = [];
            byPatient[s.patient_id].push(new Date(s.scheduled_at));
          });
        }

        const freqCounts: Record<string, { count: number; totalPrice: number }> = {
          Semanal: { count: 0, totalPrice: 0 },
          Quinzenal: { count: 0, totalPrice: 0 },
        };

        Object.entries(byPatient).forEach(([patientId, dates]) => {
          if (dates.length < 2) return;
          let totalDays = 0;
          for (let i = 1; i < dates.length; i++) {
            totalDays += (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
          }
          const avgInterval = totalDays / (dates.length - 1);
          const patientPrice = priceMap[patientId] ?? 0;

          if (avgInterval <= 10) {
            freqCounts["Semanal"].count++;
            freqCounts["Semanal"].totalPrice += patientPrice;
          } else {
            freqCounts["Quinzenal"].count++;
            freqCounts["Quinzenal"].totalPrice += patientPrice;
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
  }, [user, dateFrom, dateTo, refreshKey]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  })();

  const firstName = profileName?.split(" ")[0] ?? "";
  const periodLabel = `${format(dateFrom, "dd/MM/yyyy")} — ${format(dateTo, "dd/MM/yyyy")}`;

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
          <div className="absolute top-0 left-0 right-0" style={{ height: "3px", background: "linear-gradient(90deg, #c9a84c, #e8c97a, #c9a84c)" }} />
          <p
            className="uppercase"
            style={{ fontFamily: "Syne, sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.14em", color: "#c9a84c" }}
          >
            PSI REAL{clinicName ? ` · ${clinicName}` : ""}
          </p>
          <p className="mt-1 capitalize" style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: "12px", fontWeight: 300, color: "#8070a8" }}>
            {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
          <h1
            className="mt-2"
            style={{ fontFamily: "Syne, sans-serif", fontSize: "22px", fontWeight: 700, color: "#1a1030" }}
          >
            {greeting}{firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="mt-2" style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: "13px", fontWeight: 300, color: "#8070a8" }}>
            {summaryText}
          </p>
        </header>

        {/* ── Period Filter ── */}
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Período:</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2 text-sm">
                <CalendarDays className="h-3.5 w-3.5" />
                {format(dateFrom, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker
                mode="single"
                selected={dateFrom}
                onSelect={(d) => d && setDateFrom(startOfDay(d))}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <span className="text-sm text-muted-foreground">até</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2 text-sm">
                <CalendarDays className="h-3.5 w-3.5" />
                {format(dateTo, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker
                mode="single"
                selected={dateTo}
                onSelect={(d) => d && setDateTo(endOfDay(d))}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-accent"
            onClick={() => { setDateFrom(currentMonthStart()); setDateTo(currentMonthEnd()); }}
          >
            Mês atual
          </Button>
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
            icon={CalendarClock}
            label="Receita Prevista"
            value={hideRevenue ? "•••••" : `R$ ${stats.previstoRevenue.toFixed(2).replace(".", ",")}`}
            action={
              <button
                onClick={() => setHideRevenue(!hideRevenue)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label={hideRevenue ? "Mostrar valor" : "Ocultar valor"}
              >
                {hideRevenue ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            }
            tooltip={`Receita prevista — ${periodLabel}: soma de todas as ${stats.previstos} sessões não canceladas no período.`}
          />
          <KPICard
            icon={TrendingUp}
            label="Faturado (Realizado)"
            value={hideRevenue ? "•••••" : `R$ ${stats.monthRevenue.toFixed(2).replace(".", ",")}`}
            highlight
            tooltip="Soma dos valores de todas as sessões concluídas no período."
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
        <section className="grid grid-cols-1 gap-4">


          {/* Revenue Chart Card */}
          <div className="rounded-2xl bg-card border border-border shadow-card p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0" style={{ height: "3px", background: "linear-gradient(90deg, #c9a84c, #e8c97a, #c9a84c)" }} />
            <p className="mb-1 uppercase" style={{ fontFamily: "Syne, sans-serif", fontSize: "10px", fontWeight: 400, letterSpacing: "0.09em", color: "#a090c8" }}>
              Faturamento — {periodLabel}
            </p>
            <p style={{ fontFamily: "Syne, sans-serif", fontSize: "28px", fontWeight: 700, color: "#1a1030", lineHeight: 1.1 }}>
              {hideRevenue ? "•••••" : `R$ ${stats.monthRevenue.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`}
            </p>
            {prevMonthRevenue > 0 && !hideRevenue && (() => {
              const pctChange = ((stats.monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100;
              const isUp = pctChange >= 0;
              return (
                <p className="text-sm font-medium mt-1" style={{ color: isUp ? "#6d4fc2" : "hsl(var(--destructive))" }}>
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
                        <stop offset="0%" stopColor="#6d4fc2" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#6d4fc2" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#a090c8" }} axisLine={false} tickLine={false} />
                    <RechartsTooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                      formatter={(v: number) => [`R$ ${v.toFixed(0)}`, "Receita"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#6d4fc2"
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
          <div className="absolute top-0 left-0 right-0" style={{ height: "3px", background: "linear-gradient(90deg, #c9a84c, #e8c97a, #c9a84c)" }} />
          <div className="flex items-center gap-2 mb-4">
            <CalendarRange className="h-5 w-5 text-lilac" />
            <h2 className="font-display text-xl font-bold text-foreground">Tipo de Atendimento por Frequência</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Mostra apenas pacientes ativos, classificados pelo intervalo médio entre sessões previstas: Semanal (até 10 dias) ou Quinzenal (acima de 10 dias). A média de valor usa o valor de sessão cadastrado no paciente.</p>
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
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={frequencyData}
                      cx="50%"
                      cy="55%"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent, cx, cy, midAngle, outerRadius: or }) => {
                        const RADIAN = Math.PI / 180;
                        const radius = or + 20;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        return (
                          <text x={x} y={y} fill="hsl(var(--foreground))" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={12}>
                            {name} {(percent * 100).toFixed(0)}%
                          </text>
                        );
                      }}
                      labelLine={true}
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
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <div className="flex-1" style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: "12px", color: "#6a5880" }}>
                      <p className="font-semibold" style={{ color: "#6a5880" }}>{item.name}</p>
                      <p style={{ color: "#6a5880" }}>
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
        {(() => {
          // Helpers
          const CRISIS_RX = /(crise|término|termino|resist|não acei|nao acei|suic|abandon)/i;
          const ANX_RX = /ansios/i;
          const ENG_RX = /(engaj|rápido|rapido|vínculo|vinculo|evolu)/i;

          const isUrgentMood = (m: PatientMoodEntry) =>
            (m.mood_score ?? 10) <= 5 || (m.note ? CRISIS_RX.test(m.note) : false);

          const classifyChip = (m: PatientMoodEntry) => {
            const note = m.note ?? "";
            if (/crise/i.test(note)) return { label: "Em crise", bg: "rgba(133,79,11,0.12)", color: "#633806", border: "rgba(133,79,11,0.25)" };
            if (/(término|termino|resist|não acei|nao acei)/i.test(note)) return { label: "Resistente", bg: "rgba(201,168,76,0.12)", color: "#7a5e1a", border: "rgba(201,168,76,0.3)" };
            if (ANX_RX.test(note)) return { label: "Ansioso", bg: "rgba(201,168,76,0.08)", color: "#9a7a28", border: "rgba(201,168,76,0.2)" };
            if (ENG_RX.test(note)) return { label: "Engajado", bg: "rgba(109,79,194,0.12)", color: "#3d2b8a", border: "rgba(109,79,194,0.25)" };
            return { label: "Estável", bg: "rgba(109,79,194,0.08)", color: "#3d2b8a", border: "rgba(109,79,194,0.2)" };
          };

          // Period filter
          const now = new Date();
          const cutoff = moodPeriod === "week" ? 7 : moodPeriod === "biweek" ? 14 : null;
          const periodFiltered = cutoff
            ? patientMoods.filter(m => (now.getTime() - new Date(m.recorded_at).getTime()) / 86400000 <= cutoff)
            : patientMoods;

          // Latest entry per patient (within filter)
          const latestByPatient = new Map<string, PatientMoodEntry>();
          [...periodFiltered]
            .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
            .forEach(m => { if (!latestByPatient.has(m.patient_id)) latestByPatient.set(m.patient_id, m); });

          // Previous score per patient (from full dataset, immediately before latest)
          const prevScoreByPatient = new Map<string, number>();
          latestByPatient.forEach((latest, pid) => {
            const sorted = [...patientMoods]
              .filter(m => m.patient_id === pid)
              .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
            const idx = sorted.findIndex(m => m.id === latest.id);
            if (idx >= 0 && sorted[idx + 1]) prevScoreByPatient.set(pid, sorted[idx + 1].mood_score);
          });

          let listed = Array.from(latestByPatient.values());
          if (moodFilterPatient !== "all") listed = listed.filter(m => m.patient_id === moodFilterPatient);

          // Sort: urgent first, then score desc
          listed.sort((a, b) => {
            const ua = isUrgentMood(a) ? 0 : 1;
            const ub = isUrgentMood(b) ? 0 : 1;
            if (ua !== ub) return ua - ub;
            return b.mood_score - a.mood_score;
          });

          const urgent = listed.filter(isUrgentMood);
          const stable = listed.filter(m => !isUrgentMood(m));
          const urgentCount = urgent.length;

          const uniquePatients = Array.from(
            new Map(patientMoods.map(m => [m.patient_id, { id: m.patient_id, name: m.patient_name }])).values()
          ).sort((a, b) => a.name.localeCompare(b.name));

          const PERIOD_CHIPS: { key: "week" | "biweek" | "all"; label: string }[] = [
            { key: "week", label: "Esta semana" },
            { key: "biweek", label: "Quinzenal" },
            { key: "all", label: "Todos" },
          ];

          const Card = ({ m, urgentCard }: { m: PatientMoodEntry; urgentCard: boolean }) => {
            const chip = classifyChip(m);
            const prev = prevScoreByPatient.get(m.patient_id);
            const delta = prev !== undefined ? +(m.mood_score - prev).toFixed(1) : null;
            const fillColor = m.mood_score >= 7 ? "#6d4fc2" : m.mood_score >= 4 ? "#c9a84c" : "#854f0b";
            const valueColor = m.mood_score >= 7 ? "#3d2b8a" : m.mood_score >= 4 ? "#1a1030" : "#854f0b";
            const pct = Math.max(0, Math.min(100, (m.mood_score / 10) * 100));
            return (
              <li
                className="group relative flex items-center gap-3 px-3 transition-colors"
                style={{
                  height: "52px",
                  background: urgentCard ? "#fdf8f0" : "transparent",
                  borderLeft: urgentCard ? "2px solid #854f0b" : "2px solid transparent",
                }}
                onMouseEnter={(e) => { if (!urgentCard) e.currentTarget.style.background = "#f7f4ff"; }}
                onMouseLeave={(e) => { if (!urgentCard) e.currentTarget.style.background = "transparent"; }}
              >
                <div
                  className="flex shrink-0 items-center justify-center rounded-full"
                  style={{
                    width: 32,
                    height: 32,
                    background: urgentCard ? "rgba(201,168,76,0.12)" : "rgba(109,79,194,0.08)",
                    color: urgentCard ? "#7a5e1a" : "#6d4fc2",
                    fontFamily: "Syne, sans-serif",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {m.patient_initials}
                </div>

                <div className="flex items-center gap-2 min-w-0" style={{ flex: 2, minWidth: 200 }}>
                  <p
                    className="truncate"
                    style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 13, color: urgentCard ? "#633806" : "#1a1030" }}
                  >
                    {m.patient_name}
                  </p>
                  <span
                    className="uppercase shrink-0"
                    style={{
                      fontFamily: "Syne, sans-serif",
                      fontSize: "9px",
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: "40px",
                      background: chip.bg,
                      color: chip.color,
                      border: `0.5px solid ${chip.border}`,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {chip.label}
                  </span>
                </div>

                <div className="min-w-0 hidden md:block" style={{ flex: 2 }}>
                  {m.note && (
                    <p
                      className="truncate"
                      style={{ fontFamily: "Instrument Sans, sans-serif", fontStyle: "italic", fontSize: 12, color: "#6a5880" }}
                    >
                      {m.note}
                    </p>
                  )}
                </div>

                <div className="hidden lg:flex items-center gap-1.5 shrink-0" style={{ flex: 1, fontFamily: "Instrument Sans, sans-serif", fontSize: 11, color: "#a090c8" }}>
                  <Clock style={{ width: 12, height: 12, color: "#a090c8" }} />
                  <span className="truncate">{format(new Date(m.recorded_at), "dd/MM · HH:mm", { locale: ptBR })}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0 justify-end" style={{ width: 140 }}>
                  <div style={{ width: 48, height: 3, background: "#f0ebff", borderRadius: 40, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: fillColor, borderRadius: 40 }} />
                  </div>
                  <div className="flex items-baseline gap-0.5">
                    <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 14, color: valueColor }}>
                      {m.mood_score.toString().replace(".", ",")}
                    </span>
                    <span style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 10, color: "#c0b0e0" }}>/10</span>
                  </div>
                  {delta !== null && (
                    <span
                      className="flex items-center"
                      style={{ fontSize: "10.5px", color: delta > 0 ? "#6d4fc2" : delta < 0 ? "#854f0b" : "#a090c8" }}
                    >
                      {delta > 0 ? <TrendingUp className="h-3 w-3" /> : delta < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    </span>
                  )}
                </div>

                <button
                  title="Excluir registro"
                  onClick={async () => {
                    await supabase.from("patient_progress").delete().eq("id", m.id);
                    setPatientMoods(prev => prev.filter(x => x.id !== m.id));
                  }}
                  className="shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                  style={{ width: 26, height: 26, borderRadius: 6, color: "#c0b0e0", background: "transparent" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#6d4fc2"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#c0b0e0"; }}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </li>
            );
          };

          const SectionLabel = ({ text, count }: { text: string; count: number }) => (
            <div className="flex items-center gap-3 mt-2 mb-3">
              <span
                className="uppercase"
                style={{ fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: "9px", letterSpacing: "0.14em", color: "#a090c8" }}
              >
                {text}
              </span>
              <div className="flex-1" style={{ height: "0.5px", background: "#ede9f8" }} />
              <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: "9px", color: "#c0b0e0" }}>
                {count.toString().padStart(2, "0")}
              </span>
            </div>
          );

          return (
            <section
              className="rounded-2xl border shadow-card overflow-hidden relative"
              style={{ background: "#faf8ff", borderColor: "#ede9f8" }}
            >
              <div className="absolute top-0 left-0 right-0 z-10" style={{ height: "3px", background: "linear-gradient(90deg, #c9a84c, #e8c97a, #c9a84c)" }} />
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6">
                <div className="flex items-center gap-2">
                  <SmilePlus className="h-5 w-5" style={{ color: "#6d4fc2" }} />
                  <h2 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "18px", color: "#1a1030" }}>
                    Emoções dos Pacientes
                  </h2>
                </div>
              </div>

              {/* Alert banner */}
              {urgentCount > 0 && (
                <div
                  className="flex items-center gap-2 mt-4 flex-wrap"
                  style={{
                    background: "#fdf8f0",
                    borderTop: "0.5px solid rgba(201,168,76,0.25)",
                    borderBottom: "0.5px solid rgba(201,168,76,0.25)",
                    padding: "10px 24px",
                  }}
                >
                  <AlertTriangle style={{ width: "15px", height: "15px", color: "#854f0b" }} />
                  <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: "12px", color: "#854f0b" }}>
                    {urgentCount} {urgentCount === 1 ? "paciente requer" : "pacientes requerem"} atenção clínica.
                  </span>
                  <span style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: "12px", fontWeight: 400, color: "#a07030" }}>
                    Crise relatada ou resistência ao processo terapêutico.
                  </span>
                </div>
              )}

              {/* Filters */}
              <div className="px-6 pt-4 pb-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={moodFilterPatient} onValueChange={setMoodFilterPatient}>
                    <SelectTrigger
                      className="h-9 w-[200px]"
                      style={{
                        background: "#fff",
                        border: "0.5px solid #ede9f8",
                        borderRadius: "40px",
                        fontFamily: "Instrument Sans, sans-serif",
                        fontSize: "12px",
                        color: "#6a5880",
                      }}
                    >
                      <Filter className="h-3 w-3 mr-1" style={{ color: "#a090c8" }} />
                      <SelectValue placeholder="Todos os pacientes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os pacientes</SelectItem>
                      {uniquePatients.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {PERIOD_CHIPS.map(c => {
                    const active = moodPeriod === c.key;
                    return (
                      <button
                        key={c.key}
                        onClick={() => setMoodPeriod(c.key)}
                        style={{
                          background: active ? "rgba(109,79,194,0.06)" : "#ffffff",
                          border: active ? "0.5px solid rgba(109,79,194,0.25)" : "0.5px solid #ede9f8",
                          color: active ? "#3d2b8a" : "#8070a8",
                          borderRadius: "40px",
                          padding: "6px 14px",
                          fontFamily: "Syne, sans-serif",
                          fontWeight: 600,
                          fontSize: "12px",
                        }}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>

                <Link to="/app/agenda" style={{ fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: "12px", color: "#6d4fc2" }}>
                  Ver sessões →
                </Link>
              </div>

              {/* Content */}
              <div className="px-6 pb-6">
                {listed.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart className="h-12 w-12 mx-auto mb-4" style={{ color: "#c0b0e0" }} />
                    <p style={{ fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: "15px", color: "#3d2b8a" }}>
                      Nenhum registro de humor ainda
                    </p>
                    <p className="mt-1" style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: "13px", color: "#8070a8" }}>
                      Registre o humor dos pacientes nas sessões para acompanhar a evolução emocional aqui.
                    </p>
                  </div>
                ) : (
                  <>
                    {urgent.length > 0 && (
                      <>
                        <SectionLabel text="Atenção imediata" count={urgent.length} />
                        <ul className="[&>li]:border-b [&>li]:border-[#f0ebff]">

                          {urgent.map(m => <Card key={m.id} m={m} urgentCard />)}
                        </ul>
                      </>
                    )}
                    {stable.length > 0 && (
                      <>
                        <SectionLabel text="Estáveis" count={stable.length} />
                        <ul className="[&>li]:border-b [&>li]:border-[#f0ebff]">
                          {stable.map(m => <Card key={m.id} m={m} urgentCard={false} />)}
                        </ul>
                      </>
                    )}
                  </>
                )}
              </div>
            </section>
          );
        })()}

        {/* ── Upcoming Sessions ── */}
        <section className="rounded-2xl bg-card border border-border shadow-card p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0" style={{ height: "3px", background: "linear-gradient(90deg, #c9a84c, #e8c97a, #c9a84c)" }} />
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
        <section className="rounded-2xl bg-card border border-border shadow-card p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0" style={{ height: "3px", background: "linear-gradient(90deg, #c9a84c, #e8c97a, #c9a84c)" }} />
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl md:text-2xl font-bold text-foreground">Metas do Mês</h2>
            <Button variant="ghost" size="sm" onClick={() => setEditGoalsOpen(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Editar metas
            </Button>
          </div>
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

        {/* ── Edit Goals Dialog ── */}
        <Dialog open={editGoalsOpen} onOpenChange={setEditGoalsOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">Editar Metas</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Meta de Sessões Realizadas</Label>
                <Input type="number" min="1" value={goalFormSessions} onChange={(e) => setGoalFormSessions(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Meta de Faturamento (R$)</Label>
                <Input type="number" min="0" step="100" value={goalFormRevenue} onChange={(e) => setGoalFormRevenue(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Meta de Registros Clínicos</Label>
                <Input type="number" min="1" value={goalFormRecords} onChange={(e) => setGoalFormRecords(Number(e.target.value))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditGoalsOpen(false)}>Cancelar</Button>
              <Button variant="accent" disabled={savingGoals} onClick={async () => {
                if (!user) return;
                setSavingGoals(true);
                const { error } = await supabase.from("profiles").update({
                  goal_sessions: goalFormSessions,
                  goal_revenue: goalFormRevenue,
                  goal_records: goalFormRecords,
                } as any).eq("id", user.id);
                setSavingGoals(false);
                if (error) { toast.error("Erro ao salvar metas"); return; }
                setStats(prev => ({
                  ...prev,
                  sessionsGoal: goalFormSessions,
                  revenueGoal: goalFormRevenue,
                  recordsGoal: goalFormRecords,
                }));
                toast.success("Metas atualizadas!");
                setEditGoalsOpen(false);
              }}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
    className={`rounded-2xl border p-5 md:p-6 transition-all hover:-translate-y-0.5 hover:shadow-soft relative overflow-hidden ${
      highlight ? "bg-accent/5 border-accent/20" : "bg-card border-border"
    }`}
  >
    <div className="absolute top-0 left-0 right-0" style={{ height: "3px", background: "linear-gradient(90deg, #c9a84c, #e8c97a, #c9a84c)" }} />
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
    <p
      className="mt-4 font-sans uppercase"
      style={{ fontSize: "10px", fontWeight: 400, letterSpacing: "0.09em", color: "#a090c8" }}
    >
      {label}
    </p>
    <p
      className="mt-1 font-display"
      style={{
        fontFamily: "Syne, sans-serif",
        fontSize: value.trim().startsWith("R$") ? "18px" : "28px",
        fontWeight: 700,
        color: "#1a1030",
      }}
    >
      {value}
    </p>
  </div>
);

export default Dashboard;
