import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, ClipboardList, Target, Calendar, ChevronRight, Users } from "lucide-react";
import { format, isToday, isThisWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface PatientRow {
  id: string;
  full_name: string;
  next_session: { id: string; scheduled_at: string } | null;
  plan_status: string | null;
  goals_count: number;
  has_conceptualization: boolean;
  has_plan: boolean;
  next_plan: { objetivo: string | null; retomar: string | null; tecnicas: string[] | null } | null;
}

type FilterKey = "all" | "today" | "week" | "no_next" | "no_plan" | "no_concept";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "today", label: "Próxima sessão hoje" },
  { key: "week", label: "Esta semana" },
  { key: "no_next", label: "Sem próxima sessão" },
  { key: "no_plan", label: "Sem plano" },
  { key: "no_concept", label: "Sem RPD" },
];

export const PlanoTratamentoHub = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const uid = user.id;
      const [pRes, plansRes, goalsRes, sessRes] = await Promise.all([
        supabase.from("patients").select("id, full_name").eq("user_id", uid).eq("is_active", true).order("full_name"),
        supabase.from("treatment_plans").select("patient_id, status, conceitualizacao").eq("user_id", uid),
        supabase.from("treatment_goals").select("patient_id").eq("user_id", uid),
        supabase.from("sessions").select("patient_id, scheduled_at").eq("user_id", uid)
          .gte("scheduled_at", new Date().toISOString())
          .not("status", "in", "(cancelled,no_show)")
          .order("scheduled_at"),
      ]);
      const patients = (pRes.data || []) as { id: string; full_name: string }[];
      const plans = (plansRes.data || []) as { patient_id: string; status: string; conceitualizacao: string | null }[];
      const goals = (goalsRes.data || []) as { patient_id: string }[];
      const sessions = (sessRes.data || []) as { patient_id: string; scheduled_at: string }[];

      const goalsMap = new Map<string, number>();
      goals.forEach(g => goalsMap.set(g.patient_id, (goalsMap.get(g.patient_id) || 0) + 1));
      const planMap = new Map(plans.map(p => [p.patient_id, p]));
      const nextMap = new Map<string, string>();
      sessions.forEach(s => { if (!nextMap.has(s.patient_id)) nextMap.set(s.patient_id, s.scheduled_at); });

      const out: PatientRow[] = patients.map(p => {
        const plan = planMap.get(p.id);
        const goalsCount = goalsMap.get(p.id) || 0;
        const hasConcept = !!plan?.conceitualizacao?.trim();
        return {
          id: p.id,
          full_name: p.full_name,
          next_session: nextMap.get(p.id) ? { scheduled_at: nextMap.get(p.id)! } : null,
          plan_status: plan?.status ?? null,
          goals_count: goalsCount,
          has_conceptualization: hasConcept,
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
        case "no_plan": return !r.has_plan;
        case "no_concept": return !r.has_conceptualization;
        default: return true;
      }
    });
  }, [rows, filter, search]);

  const counts = useMemo(() => ({
    total: rows.length,
    today: rows.filter(r => r.next_session && isToday(new Date(r.next_session.scheduled_at))).length,
    week: rows.filter(r => r.next_session && isThisWeek(new Date(r.next_session.scheduled_at), { weekStartsOn: 1 })).length,
    no_plan: rows.filter(r => !r.has_plan).length,
    no_concept: rows.filter(r => !r.has_conceptualization).length,
  }), [rows]);

  if (loading) {
    return <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;
  }

  if (rows.length === 0) {
    return <Card className="p-10 text-center text-muted-foreground">Cadastre um paciente para começar.</Card>;
  }

  const planLabel = (r: PatientRow) => {
    const s = (r.plan_status || "").toLowerCase();
    const isRevision = /revis|pending|revision/.test(s);
    const isActive = /ativ|active/.test(s);
    if (r.has_plan && isRevision) return { label: "Revisão Pendente", cls: "bg-[#fdf3e3] text-[#7a4a0a] border-[#e8c98a]" };
    if (r.has_plan && (isActive || !s)) return { label: "Plano Ativo", cls: "bg-[#e3f7ee] text-[#1f5132] border-[#a7e1c1]" };
    if (r.has_plan) return { label: "Plano Ativo", cls: "bg-[#e3f7ee] text-[#1f5132] border-[#a7e1c1]" };
    return { label: "Sem Plano", cls: "bg-muted text-muted-foreground border-border" };
  };

  return (
    <div className="space-y-5">
      {/* quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { label: "Total", value: counts.total, icon: Users },
          { label: "Hoje", value: counts.today, icon: Calendar },
          { label: "Esta semana", value: counts.week, icon: Calendar },
          { label: "Sem plano", value: counts.no_plan, icon: ClipboardList },
          { label: "Sem RPD", value: counts.no_concept, icon: Target },
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
              onClick={() => navigate(`/app/plano-tratamento?patient=${r.id}`)}
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
                    <Target className="h-3 w-3" /> {r.goals_count} metas
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {r.next_session
                      ? format(new Date(r.next_session.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })
                      : "Sem próxima"}
                  </span>
                  {!r.has_conceptualization && (
                    <span className="text-[11px] text-amber-700">Sem RPD</span>
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
