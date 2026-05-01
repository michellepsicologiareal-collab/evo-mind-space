import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Users, Calendar, TrendingUp, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Stats {
  activePatients: number;
  todaySessions: number;
  monthRevenue: number;
  monthNoShows: number;
}

interface UpcomingSession {
  id: string;
  scheduled_at: string;
  patient_name: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ activePatients: 0, todaySessions: 0, monthRevenue: 0, monthNoShows: 0 });
  const [upcoming, setUpcoming] = useState<UpcomingSession[]>([]);
  const [profileName, setProfileName] = useState<string>("");
  const [clinicName, setClinicName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const monthStart = startOfMonth(new Date()).toISOString();
      const monthEnd = endOfMonth(new Date()).toISOString();
      const dayStart = startOfDay(new Date()).toISOString();
      const dayEnd = endOfDay(new Date()).toISOString();

      const [profileRes, patientsRes, todayRes, monthRes, upcomingRes] = await Promise.all([
        supabase.from("profiles").select("full_name, clinic_name").eq("id", user.id).maybeSingle(),
        supabase.from("patients").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_active", true),
        supabase.from("sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("scheduled_at", dayStart).lte("scheduled_at", dayEnd),
        supabase.from("sessions").select("price, status").eq("user_id", user.id).gte("scheduled_at", monthStart).lte("scheduled_at", monthEnd),
        supabase.from("sessions").select("id, scheduled_at, patient_id, patients(full_name)").eq("user_id", user.id).gte("scheduled_at", new Date().toISOString()).eq("status", "scheduled").order("scheduled_at").limit(5),
      ]);

      setProfileName(profileRes.data?.full_name ?? "");
      setClinicName((profileRes.data as any)?.clinic_name ?? "");

      const monthSessions = monthRes.data ?? [];
      const revenue = monthSessions.filter((s) => s.status === "completed").reduce((sum, s) => sum + Number(s.price ?? 0), 0);
      const noShows = monthSessions.filter((s) => s.status === "no_show").length;

      setStats({
        activePatients: patientsRes.count ?? 0,
        todaySessions: todayRes.count ?? 0,
        monthRevenue: revenue,
        monthNoShows: noShows,
      });

      setUpcoming(
        (upcomingRes.data ?? []).map((s: any) => ({
          id: s.id,
          scheduled_at: s.scheduled_at,
          patient_name: s.patients?.full_name ?? "—",
        }))
      );
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

  return (
    <div className="space-y-10 animate-fade-up">
      <header>
        {clinicName && (
          <p className="text-xs uppercase tracking-[0.2em] text-accent font-medium">{clinicName}</p>
        )}
        <p className={`text-sm text-muted-foreground capitalize ${clinicName ? "mt-2" : ""}`}>
          {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </p>
        <h1 className="mt-2 font-display text-4xl font-medium">
          {greeting}{firstName ? `, ${firstName}` : ""}.
        </h1>
        <p className="mt-2 text-muted-foreground">Veja como está o seu consultório hoje.</p>
      </header>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Pacientes ativos" value={stats.activePatients.toString()} loading={loading} />
        <StatCard icon={Calendar} label="Sessões hoje" value={stats.todaySessions.toString()} loading={loading} />
        <StatCard icon={TrendingUp} label="Faturamento do mês" value={`R$ ${stats.monthRevenue.toFixed(2).replace(".", ",")}`} accent loading={loading} />
        <StatCard icon={AlertCircle} label="Faltas no mês" value={stats.monthNoShows.toString()} loading={loading} />
      </section>

      <section className="rounded-2xl bg-card border border-border shadow-card p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-semibold">Próximas sessões</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/app/agenda">Ver agenda <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>

        {upcoming.length === 0 ? (
          <div className="text-center py-14 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-display text-lg font-medium text-foreground/70">Sua agenda está tranquila</p>
            <p className="mt-1 text-sm">Que tal agendar a próxima sessão?</p>
            <Button variant="accent" size="sm" className="mt-5" asChild>
              <Link to="/app/agenda">Agendar uma sessão</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {upcoming.map((s) => (
              <li key={s.id} className="py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{s.patient_name}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {format(new Date(s.scheduled_at), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-secondary text-secondary-foreground">Agendada</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  accent,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
  loading?: boolean;
}) => (
  <div className={`rounded-2xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-soft ${accent ? "bg-gradient-hero text-primary-foreground border-transparent" : "bg-card border-border"}`}>
    <div className="flex items-center justify-between">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent ? "bg-primary-foreground/15" : "bg-secondary text-primary"}`}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
    <p className={`mt-4 text-xs uppercase tracking-wider ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{label}</p>
    <p className={`mt-1 font-display text-3xl font-semibold ${loading ? "opacity-30" : ""}`}>{value}</p>
  </div>
);

export default Dashboard;
