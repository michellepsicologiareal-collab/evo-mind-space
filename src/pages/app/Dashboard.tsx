import { useEffect, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CardSkeleton } from "@/components/app/Skeletons";

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
}

interface UpcomingSession {
  id: string;
  scheduled_at: string;
  patient_name: string;
  patient_initials: string;
  status: string;
  session_number: number;
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

/* ── component ── */
const Dashboard = () => {
  const { user } = useAuth();
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
  });
  const [upcoming, setUpcoming] = useState<UpcomingSession[]>([]);
  const [profileName, setProfileName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [loading, setLoading] = useState(true);
  const [hideRevenue, setHideRevenue] = useState(false);
  const [nextSessionMin, setNextSessionMin] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const now = new Date();
      const monthStart = startOfMonth(now).toISOString();
      const monthEnd = endOfMonth(now).toISOString();
      const dayStart = startOfDay(now).toISOString();
      const dayEnd = endOfDay(now).toISOString();

      const [profileRes, patientsRes, todayRes, monthRes, upcomingRes, supervisionRes, recordsRes] =
        await Promise.all([
          supabase.from("profiles").select("full_name, clinic_name").eq("id", user.id).maybeSingle(),
          supabase.from("patients").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_active", true),
          supabase.from("sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("scheduled_at", dayStart).lte("scheduled_at", dayEnd),
          supabase.from("sessions").select("price, status").eq("user_id", user.id).gte("scheduled_at", monthStart).lte("scheduled_at", monthEnd),
          supabase
            .from("sessions")
            .select("id, scheduled_at, status, patient_id, session_type, patient:patients!sessions_patient_id_fkey(full_name)")
            .eq("user_id", user.id)
            .gte("scheduled_at", now.toISOString())
            .eq("status", "scheduled")
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
        ]);

      setProfileName(profileRes.data?.full_name ?? "");
      setClinicName((profileRes.data as any)?.clinic_name ?? "");

      const monthSessions = monthRes.data ?? [];
      const revenue = monthSessions.filter((s) => s.status === "completed").reduce((sum, s) => sum + Number(s.price ?? 0), 0);
      const completed = monthSessions.filter((s) => s.status === "completed").length;

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
      });

      // Count sessions per patient for numbering
      const sessionsData = (upcomingRes.data ?? []) as any[];
      const patientSessionCounts: Record<string, number> = {};
      
      // Get total sessions per patient for numbering
      for (const s of sessionsData) {
        if (!patientSessionCounts[s.patient_id]) {
          const { count } = await supabase
            .from("sessions")
            .select("id", { count: "exact", head: true })
            .eq("patient_id", s.patient_id)
            .eq("user_id", user.id)
            .lte("scheduled_at", s.scheduled_at);
          patientSessionCounts[s.patient_id] = count ?? 1;
        }
      }

      const mapped = sessionsData.map((s: any) => ({
        id: s.id,
        scheduled_at: s.scheduled_at,
        patient_name: s.patients?.full_name ?? "—",
        patient_initials: getInitials(s.patients?.full_name ?? "?"),
        status: s.status ?? "scheduled",
        session_number: patientSessionCounts[s.patient_id] ?? 1,
      }));

      setUpcoming(mapped);

      // Next session countdown
      if (mapped.length > 0) {
        const diff = differenceInMinutes(new Date(mapped[0].scheduled_at), now);
        setNextSessionMin(diff > 0 ? diff : null);
      }

      setLoading(false);
    };
    load();
  }, [user]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  })();

  const firstName = profileName?.split(" ")[0] ?? "";

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
    <div className="space-y-8 animate-fade-up">
      {/* ── Welcome Header ── */}
      <header className="rounded-2xl bg-card border border-border shadow-card p-8 relative overflow-hidden">
        {/* Decorative accent line */}
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

      {/* ── KPI Cards ── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Users} label="Pacientes Ativos" value={stats.activePatients.toString()} />
        <KPICard icon={Calendar} label="Sessões Hoje" value={stats.todaySessions.toString()} />
        <KPICard
          icon={TrendingUp}
          label="Faturamento Mensal"
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
        />
        <KPICard icon={Briefcase} label="Casos em Supervisão" value={stats.supervisionCases.toString()} />
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
                  {/* Avatar */}
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold text-sm ${getAvatarColor(s.patient_name)}`}
                  >
                    {s.patient_initials}
                  </div>

                  {/* Info */}
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

                  {/* Status badge */}
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
                {/* Progress bar */}
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
  );
};

/* ── KPI Card ── */
const KPICard = ({
  icon: Icon,
  label,
  value,
  highlight,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  highlight?: boolean;
  action?: React.ReactNode;
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
      {action}
    </div>
    <p className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-1 font-display text-2xl md:text-3xl font-bold text-foreground">{value}</p>
  </div>
);

export default Dashboard;
