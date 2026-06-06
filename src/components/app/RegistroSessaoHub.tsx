import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Search, FileText, Calendar, ChevronRight, Users, ClipboardList } from "lucide-react";
import { format, isToday, isThisWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface PatientRow {
  id: string;
  full_name: string;
  next_session: { scheduled_at: string } | null;
  last_record_date: string | null;
  records_count: number;
  plan_status: string | null;
  has_plan: boolean;
}

type FilterKey = "all" | "today" | "week" | "no_next" | "no_record" | "no_plan";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "today", label: "Próxima sessão hoje" },
  { key: "week", label: "Esta semana" },
  { key: "no_next", label: "Sem próxima sessão" },
  { key: "no_record", label: "Sem registros" },
  { key: "no_plan", label: "Sem plano" },
];

interface Props {
  onSelectPatient: (patientId: string) => void;
}

export const RegistroSessaoHub = ({ onSelectPatient }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const uid = user.id;
      const [pRes, plansRes, sessRes, recRes] = await Promise.all([
        supabase.from("patients").select("id, full_name").eq("user_id", uid).eq("is_active", true).order("full_name"),
        supabase.from("treatment_plans").select("patient_id, status").eq("user_id", uid),
        supabase.from("sessions").select("patient_id, scheduled_at").eq("user_id", uid)
          .gte("scheduled_at", new Date().toISOString())
          .not("status", "in", "(cancelled,no_show)")
          .order("scheduled_at"),
        supabase.from("session_records").select("patient_id, session_date").eq("user_id", uid)
          .order("session_date", { ascending: false }),
      ]);
      const patients = (pRes.data || []) as { id: string; full_name: string }[];
      const plans = (plansRes.data || []) as { patient_id: string; status: string }[];
      const sessions = (sessRes.data || []) as { patient_id: string; scheduled_at: string }[];
      const records = (recRes.data || []) as { patient_id: string; session_date: string }[];

      const planMap = new Map(plans.map(p => [p.patient_id, p]));
      const nextMap = new Map<string, string>();
      sessions.forEach(s => { if (!nextMap.has(s.patient_id)) nextMap.set(s.patient_id, s.scheduled_at); });
      const countMap = new Map<string, number>();
      const lastMap = new Map<string, string>();
      records.forEach(r => {
        countMap.set(r.patient_id, (countMap.get(r.patient_id) || 0) + 1);
        if (!lastMap.has(r.patient_id)) lastMap.set(r.patient_id, r.session_date);
      });

      const out: PatientRow[] = patients.map(p => {
        const plan = planMap.get(p.id);
        return {
          id: p.id,
          full_name: p.full_name,
          next_session: nextMap.get(p.id) ? { scheduled_at: nextMap.get(p.id)! } : null,
          last_record_date: lastMap.get(p.id) || null,
          records_count: countMap.get(p.id) || 0,
          plan_status: plan?.status ?? null,
          has_plan: !!plan,
        };
      });
      setRows(out);
      setLoading(false);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (search && !r.full_name.toLowerCase().includes(search.toLowerCase())) return false;
      switch (filter) {
        case "today": return r.next_session && isToday(new Date(r.next_session.scheduled_at));
        case "week": return r.next_session && isThisWeek(new Date(r.next_session.scheduled_at), { weekStartsOn: 1 });
        case "no_next": return !r.next_session;
        case "no_record": return r.records_count === 0;
        case "no_plan": return !r.has_plan;
        default: return true;
      }
    });
  }, [rows, filter, search]);

  const counts = useMemo(() => ({
    total: rows.length,
    today: rows.filter(r => r.next_session && isToday(new Date(r.next_session.scheduled_at))).length,
    week: rows.filter(r => r.next_session && isThisWeek(new Date(r.next_session.scheduled_at), { weekStartsOn: 1 })).length,
    no_record: rows.filter(r => r.records_count === 0).length,
    no_plan: rows.filter(r => !r.has_plan).length,
  }), [rows]);

  if (loading) {
    return <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;
  }

  if (rows.length === 0) {
    return <Card className="p-10 text-center text-muted-foreground">Cadastre um paciente para começar.</Card>;
  }

  const planLabel = (r: PatientRow) => {
    if (r.plan_status === "em_revisao") return { label: "Revisão Pendente", cls: "bg-[#fdf3e3] text-[#7a4a0a] border-[#e8c98a]" };
    if (r.has_plan) return { label: "Plano Ativo", cls: "bg-[#e3f7ee] text-[#1f5132] border-[#a7e1c1]" };
    return { label: "Sem Plano", cls: "bg-[#fdf3e3] text-[#7a4a0a] border-[#e8c98a]" };
  };

  return (
    <div className="space-y-5">
      {/* quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { label: "Total", value: counts.total, icon: Users },
          { label: "Hoje", value: counts.today, icon: Calendar },
          { label: "Esta semana", value: counts.week, icon: Calendar },
          { label: "Sem registros", value: counts.no_record, icon: FileText },
          { label: "Sem plano", value: counts.no_plan, icon: ClipboardList },
        ].map(s => (
          <Card key={s.label} className="p-3 rounded-xl">
            <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">{s.label}</p>
            <p className="text-lg font-display font-bold mt-1 text-primary">{s.value}</p>
          </Card>
        ))}
      </div>

      {/* search + filters */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar paciente..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border transition-colors",
              filter === f.key
                ? "bg-primary text-white border-primary"
                : "bg-white text-foreground border-border hover:bg-muted"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">Nenhum paciente neste filtro.</Card>
        ) : filtered.map(r => {
          const pl = planLabel(r);
          return (
            <Card
              key={r.id}
              onClick={() => onSelectPatient(r.id)}
              className="p-4 rounded-xl cursor-pointer hover:shadow-md transition-shadow flex items-center gap-3"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                {r.full_name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{r.full_name}</p>
                <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground items-center">
                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium", pl.cls)}>
                    {pl.label}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <FileText className="h-3 w-3" /> {r.records_count} {r.records_count === 1 ? "registro" : "registros"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {r.next_session
                      ? format(new Date(r.next_session.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })
                      : "Sem próxima"}
                  </span>
                  {r.last_record_date && (
                    <span className="text-[11px]">
                      Última: {format(new Date(r.last_record_date), "dd/MM/yyyy")}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            </Card>
          );
        })}
      </div>
    </div>
  );
};
