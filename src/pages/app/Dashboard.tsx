import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  Calendar,
  TrendingUp,
  ArrowRight,
  Eye,
  EyeOff,
  Clock,
  AlertTriangle,
  DollarSign,
  ChevronRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CardSkeleton } from "@/components/app/Skeletons";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

const PIE_COLORS = ["hsl(var(--accent))", "hsl(var(--lilac))", "hsl(var(--serene))"];

interface UpcomingSession {
  id: string;
  scheduled_at: string;
  patient_name: string;
  patient_initials: string;
  status: string;
  session_number: number;
}

interface FrequencyData {
  name: string;
  value: number;
}

interface MonthlyRevenue {
  name: string;
  value: number;
}

/* ── component ── */
const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState("");
  const [hideRevenue, setHideRevenue] = useState(false);

  // KPI
  const [activePatients, setActivePatients] = useState(0);
  const [monthRevenue, setMonthRevenue] = useState(0);
  const [prevMonthRevenue, setPrevMonthRevenue] = useState(0);
  const [prevActivePatients, setPrevActivePatients] = useState(0);
  const [faltas, setFaltas] = useState(0);

  // Charts
  const [frequencyData, setFrequencyData] = useState<FrequencyData[]>([]);
  const [monthlyRevData, setMonthlyRevData] = useState<MonthlyRevenue[]>([]);

  // Upcoming
  const [upcoming, setUpcoming] = useState<UpcomingSession[]>([]);

  // Resumo
  const [completedSessions, setCompletedSessions] = useState(0);
  const [totalPatients, setTotalPatients] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const now = new Date();
      const monthStart = startOfMonth(now).toISOString();
      const monthEnd = endOfMonth(now).toISOString();
      const dayStart = startOfDay(now).toISOString();
      const dayEnd = endOfDay(now).toISOString();

      const [profileRes, activePatientsRes, monthSessionsRes, upcomingRes, prevMonthRes] =
        await Promise.all([
          supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
          supabase.from("patients").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_active", true),
          supabase.from("sessions").select("price, status, scheduled_at").eq("user_id", user.id).gte("scheduled_at", monthStart).lte("scheduled_at", monthEnd),
          supabase
            .from("sessions")
            .select("id, scheduled_at, status, patient_id, session_type, patient:patients!sessions_patient_id_fkey(full_name)")
            .eq("user_id", user.id)
            .gte("scheduled_at", now.toISOString())
            .in("status", ["scheduled", "confirmed"])
            .order("scheduled_at")
            .limit(5),
          supabase
            .from("sessions")
            .select("price, status")
            .eq("user_id", user.id)
            .gte("scheduled_at", startOfMonth(subMonths(now, 1)).toISOString())
            .lte("scheduled_at", endOfMonth(subMonths(now, 1)).toISOString()),
        ]);

      setProfileName(profileRes.data?.full_name ?? "");
      setActivePatients(activePatientsRes.count ?? 0);

      const monthSessions = monthSessionsRes.data ?? [];
      const revenue = monthSessions.filter(s => s.status === "completed").reduce((sum, s) => sum + Number(s.price ?? 0), 0);
      const completed = monthSessions.filter(s => s.status === "completed").length;
      const faltasCount = monthSessions.filter(s => s.status === "no_show" || s.status === "cancelled").length;

      setMonthRevenue(revenue);
      setCompletedSessions(completed);
      setFaltas(faltasCount);

      const prevRev = (prevMonthRes.data ?? []).filter(s => s.status === "completed").reduce((sum, s) => sum + Number(s.price ?? 0), 0);
      setPrevMonthRevenue(prevRev);

      // Previous month active patients for comparison
      // We approximate with total patients
      const { count: totalP } = await supabase.from("patients").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      setTotalPatients(totalP ?? 0);

      // Upcoming sessions
      const sessionsData = (upcomingRes.data ?? []) as any[];
      const uniquePatientIds = [...new Set(sessionsData.map((s: any) => s.patient_id).filter(Boolean))];
      const countResults = await Promise.all(
        uniquePatientIds.map(pid =>
          supabase.from("sessions").select("id", { count: "exact", head: true }).eq("patient_id", pid).eq("user_id", user.id).then(({ count }) => [pid, count ?? 0] as const)
        )
      );
      const patientSessionCounts = Object.fromEntries(countResults);

      setUpcoming(
        sessionsData.map((s: any) => ({
          id: s.id,
          scheduled_at: s.scheduled_at,
          patient_name: s.session_type === "supervision" ? "Supervisão" : (s.patient?.full_name ?? "—"),
          patient_initials: s.session_type === "supervision" ? "SV" : getInitials(s.patient?.full_name ?? "?"),
          status: s.status ?? "scheduled",
          session_number: patientSessionCounts[s.patient_id] ?? 1,
        }))
      );

      // Frequency data (weekly vs biweekly)
      const { data: activePatientsList } = await supabase.from("patients").select("id, session_price").eq("user_id", user.id).eq("is_active", true);
      if (activePatientsList && activePatientsList.length > 0) {
        const activeIds = new Set(activePatientsList.map((p: any) => p.id));
        const { data: freqSessions } = await supabase
          .from("sessions")
          .select("patient_id, scheduled_at")
          .eq("user_id", user.id)
          .eq("is_expense", false)
          .in("status", ["scheduled", "completed", "confirmed"])
          .order("scheduled_at", { ascending: true });

        const byPatient: Record<string, Date[]> = {};
        (freqSessions ?? []).forEach((s: any) => {
          if (!activeIds.has(s.patient_id)) return;
          if (!byPatient[s.patient_id]) byPatient[s.patient_id] = [];
          byPatient[s.patient_id].push(new Date(s.scheduled_at));
        });

        const freqCounts: Record<string, number> = { Semanais: 0, Quinzenais: 0 };
        Object.entries(byPatient).forEach(([, dates]) => {
          if (dates.length < 2) return;
          let totalDays = 0;
          for (let i = 1; i < dates.length; i++) totalDays += (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
          const avgInterval = totalDays / (dates.length - 1);
          if (avgInterval <= 10) freqCounts["Semanais"]++;
          else freqCounts["Quinzenais"]++;
        });

        setFrequencyData(
          Object.entries(freqCounts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))
        );
      }

      // Monthly revenue chart (last 6 months)
      const monthlyData: MonthlyRevenue[] = [];
      const monthPromises = Array.from({ length: 6 }, (_, i) => {
        const m = subMonths(now, 5 - i);
        const mStart = startOfMonth(m).toISOString();
        const mEnd = endOfMonth(m).toISOString();
        return supabase
          .from("sessions")
          .select("price, status, is_expense")
          .eq("user_id", user.id)
          .gte("scheduled_at", mStart)
          .lte("scheduled_at", mEnd)
          .then(res => ({
            name: format(m, "MMM/yy", { locale: ptBR }),
            value: (res.data ?? []).filter((s: any) => s.status === "completed" && !s.is_expense).reduce((sum, s) => sum + Number(s.price ?? 0), 0),
          }));
      });
      const monthResults = await Promise.all(monthPromises);
      setMonthlyRevData(monthResults);

      // Revenue stats for chart
      const maxRev = Math.max(...monthResults.map(m => m.value), 1);
      const avgRev = monthResults.reduce((s, m) => s + m.value, 0) / monthResults.length;
    };

    load().catch(console.warn).finally(() => setLoading(false));
  }, [user]);

  const firstName = profileName?.split(" ")[0] ?? "";
  const revenueFormatted = `R$ ${monthRevenue.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  const revDiff = prevMonthRevenue > 0 ? ((monthRevenue - prevMonthRevenue) / prevMonthRevenue * 100) : 0;
  const totalFreq = frequencyData.reduce((s, d) => s + d.value, 0);

  // Monthly chart stats
  const avgMonthlyRev = monthlyRevData.length > 0 ? monthlyRevData.reduce((s, m) => s + m.value, 0) / monthlyRevData.length : 0;
  const maxMonthlyRev = monthlyRevData.length > 0 ? Math.max(...monthlyRevData.map(m => m.value)) : 0;
  const maxMonthName = monthlyRevData.find(m => m.value === maxMonthlyRev)?.name ?? "";

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-20 rounded-2xl bg-muted animate-pulse" />
        <div className="grid sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <div className="h-64 rounded-2xl bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6 animate-fade-up">
        {/* ── Header ── */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              Olá, {firstName ? `${firstName}` : "Dra."}!
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Bem-vindo ao seu painel de controle.</p>
          </div>
          <Button variant="accent" size="sm" asChild>
            <Link to="/app/agenda">
              Novo <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </header>

        {/* ── 3 KPI Cards ── */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Pacientes ativos */}
          <div className="rounded-2xl bg-card border border-border shadow-card p-5 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Users className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-3xl font-bold text-foreground">{activePatients}</p>
              <p className="text-xs text-muted-foreground mt-0.5">pacientes ativos</p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0 mt-1" />
              </TooltipTrigger>
              <TooltipContent><p>Total de pacientes com status ativo</p></TooltipContent>
            </Tooltip>
          </div>

          {/* Faturamento */}
          <div className="rounded-2xl bg-card border border-border shadow-card p-5 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <DollarSign className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-3xl font-bold text-foreground">
                {hideRevenue ? "•••••" : revenueFormatted}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                faturamento
                {prevMonthRevenue > 0 && !hideRevenue && (
                  <span className={`ml-1 font-medium ${revDiff >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {revDiff >= 0 ? "+" : ""}{revDiff.toFixed(0)}% vs mês anterior
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => setHideRevenue(!hideRevenue)}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-1"
            >
              {hideRevenue ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>

          {/* Faltas */}
          <div className={`rounded-2xl border shadow-card p-5 flex items-start gap-4 ${
            faltas > 0 ? "bg-amber-50 border-amber-200" : "bg-card border-border"
          }`}>
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
              faltas > 0 ? "bg-amber-100 text-amber-600" : "bg-secondary text-muted-foreground"
            }`}>
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-3xl font-bold text-foreground">{faltas}</p>
              <p className="text-xs text-muted-foreground mt-0.5">faltas este mês</p>
            </div>
          </div>
        </section>

        {/* ── Charts Row ── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Periodicidade dos pacientes */}
          <div className="rounded-2xl bg-card border border-border shadow-card p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-base font-semibold text-foreground">Periodicidade dos pacientes</h2>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  <p>Pacientes ativos classificados pelo intervalo médio entre sessões: Semanal (até 10 dias) ou Quinzenal (acima).</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Todos os pacientes</p>

            {frequencyData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Dados insuficientes para exibir</p>
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <div className="h-[180px] w-[180px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={frequencyData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {frequencyData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                        formatter={(v: number, name: string) => [`${v} paciente${v !== 1 ? "s" : ""} (${totalFreq > 0 ? Math.round(v / totalFreq * 100) : 0}%)`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3 flex-1">
                  <p className="text-xs text-muted-foreground">Total: {totalFreq} pacientes</p>
                  {frequencyData.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-sm font-medium text-foreground">{item.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {item.value} pacientes ({totalFreq > 0 ? Math.round(item.value / totalFreq * 100) : 0}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Faturamento mensal */}
          <div className="rounded-2xl bg-card border border-border shadow-card p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-base font-semibold text-foreground">Faturamento mensal</h2>
              <span className="text-xs text-muted-foreground">Últimos 6 meses</span>
            </div>

            {monthlyRevData.some(m => m.value > 0) ? (
              <>
                <div className="h-[200px] mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyRevData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="revGradDash" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                        width={55}
                      />
                      <RechartsTooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                        formatter={(v: number) => [`R$ ${v.toFixed(2).replace(".", ",")}`, "Faturamento"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="hsl(var(--accent))"
                        strokeWidth={2.5}
                        fill="url(#revGradDash)"
                        dot={{ r: 3, fill: "hsl(var(--accent))", strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: "hsl(var(--accent))" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span>Média mensal: <strong className="text-foreground">R$ {avgMonthlyRev.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}</strong></span>
                  <span className="text-border">•</span>
                  <span>Maior faturamento: <strong className="text-foreground">R$ {maxMonthlyRev.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} em {maxMonthName}</strong></span>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Complete sessões para ver seu faturamento 📊</p>
              </div>
            )}
          </div>
        </section>

        {/* ── Bottom Row: Próximos atendimentos + Resumo ── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Próximos atendimentos */}
          <div className="rounded-2xl bg-card border border-border shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-base font-semibold text-foreground">Próximos atendimentos</h2>
              <Button variant="ghost" size="sm" className="text-accent text-xs h-7 px-2" asChild>
                <Link to="/app/agenda">Ver agenda <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
              </Button>
            </div>

            {upcoming.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Sua agenda está tranquila 🌿</p>
                <Button variant="accent" size="sm" className="mt-3 min-h-[44px]" asChild>
                  <Link to="/app/agenda">Agendar sessão</Link>
                </Button>
              </div>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((s) => {
                  const st = statusConfig[s.status] ?? statusConfig.scheduled;
                  const sessionDate = new Date(s.scheduled_at);
                  const isToday = new Date().toDateString() === sessionDate.toDateString();
                  return (
                    <li key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-xs ${getAvatarColor(s.patient_name)}`}>
                        {s.patient_initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">{s.patient_name}</p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{isToday ? "Hoje" : format(sessionDate, "dd/MM", { locale: ptBR })}, {format(sessionDate, "HH:mm")}</span>
                        </div>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${st.className}`}>
                        {st.label}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Resumo do mês */}
          <div className="rounded-2xl bg-card border border-border shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-base font-semibold text-foreground">Resumo do mês</h2>
              <span className="text-xs text-muted-foreground">{format(new Date(), "MMM/yy", { locale: ptBR })}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <SummaryItem
                icon={Users}
                iconColor="text-accent bg-accent/10"
                label="Pacientes ativos"
                value={activePatients.toString()}
              />
              <SummaryItem
                icon={DollarSign}
                iconColor="text-accent bg-accent/10"
                label="Faturamento"
                value={hideRevenue ? "•••••" : revenueFormatted}
                highlight
              />
              <SummaryItem
                icon={Calendar}
                iconColor="text-lilac bg-lilac/10"
                label="Atendimentos realizados"
                value={completedSessions.toString()}
              />
              <SummaryItem
                icon={AlertTriangle}
                iconColor={faltas > 0 ? "text-amber-600 bg-amber-100" : "text-muted-foreground bg-secondary"}
                label="Faltas"
                value={faltas.toString()}
                alert={faltas > 0}
              />
            </div>
          </div>
        </section>
      </div>
    </TooltipProvider>
  );
};

/* ── Summary Item ── */
const SummaryItem = ({
  icon: Icon,
  iconColor,
  label,
  value,
  highlight,
  alert,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  label: string;
  value: string;
  highlight?: boolean;
  alert?: boolean;
}) => (
  <div className="flex items-start gap-3 p-3 rounded-xl bg-secondary/20">
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconColor}`}>
      <Icon className="h-4 w-4" />
    </div>
    <div>
      <p className={`font-display text-xl font-bold ${alert ? "text-amber-600" : "text-foreground"}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{label}</p>
    </div>
  </div>
);

export default Dashboard;
