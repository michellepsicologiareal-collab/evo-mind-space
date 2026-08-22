import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  UserRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export interface PanelPatient {
  id: string;
  initials: string;
  is_active: boolean;
  user_id: string;
}

export interface PanelSupervisee {
  id: string;
  full_name: string | null;
  patients: PanelPatient[];
}

interface FeedbackRow {
  id: string;
  patient_id: string;
  supervisee_id: string;
  supervision_date: string;
  case_synthesis: string | null;
  therapeutic_direction: string | null;
  conceptualization: string | null;
  shared_with_supervisee: boolean;
  created_at: string;
}

interface Props {
  supervisees: PanelSupervisee[];
  onOpenPatient: (p: PanelPatient) => void;
}

export function SupervisionPanel({ supervisees, onOpenPatient }: Props) {
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientFilter, setPatientFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user) return;
      setLoading(true);
      const { data } = await (supabase as any)
        .from("supervision_feedbacks")
        .select(
          "id, patient_id, supervisee_id, supervision_date, case_synthesis, therapeutic_direction, conceptualization, shared_with_supervisee, created_at",
        )
        .order("supervision_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setFeedbacks((data ?? []) as FeedbackRow[]);
      setLoading(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const patients = useMemo(
    () =>
      supervisees.flatMap((s) =>
        s.patients.map((p) => ({ ...p, superviseeName: s.full_name || "Sem nome" })),
      ),
    [supervisees],
  );

  const patientById = useMemo(() => {
    const map: Record<string, (typeof patients)[number]> = {};
    patients.forEach((p) => (map[p.id] = p));
    return map;
  }, [patients]);

  const statsByPatient = useMemo(() => {
    const map: Record<string, { count: number; last: string | null; shared: number }> = {};
    feedbacks.forEach((f) => {
      const s = (map[f.patient_id] ??= { count: 0, last: null, shared: 0 });
      s.count += 1;
      if (f.shared_with_supervisee) s.shared += 1;
      if (!s.last || f.supervision_date > s.last) s.last = f.supervision_date;
    });
    return map;
  }, [feedbacks]);

  const visibleFeedbacks = useMemo(
    () =>
      feedbacks.filter(
        (f) => patientById[f.patient_id] && (patientFilter === "all" || f.patient_id === patientFilter),
      ),
    [feedbacks, patientFilter, patientById],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, FeedbackRow[]>();
    visibleFeedbacks.forEach((f) => {
      const list = map.get(f.supervision_date) ?? [];
      list.push(f);
      map.set(f.supervision_date, list);
    });
    return Array.from(map.entries());
  }, [visibleFeedbacks]);

  const totalShared = feedbacks.filter((f) => f.shared_with_supervisee).length;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:rounded-3xl sm:p-7 space-y-5 sm:space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lilac/15 text-lilac">
          <LayoutDashboard className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold sm:text-xl">Painel de supervisão</h2>
          <p className="text-xs text-muted-foreground">
            Pacientes compartilhados, devolutivas por data e acesso ao prontuário do supervisionando
            (somente leitura).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Pacientes compartilhados", value: patients.length },
          { label: "Devolutivas registradas", value: feedbacks.length },
          { label: "Compartilhadas", value: totalShared },
        ].map((k, i) => (
          <div
            key={k.label}
            className={`rounded-2xl border border-border bg-secondary/40 p-3 sm:p-4 ${
              i === 2 ? "col-span-2 sm:col-span-1" : ""
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-[11px]">
              {k.label}
            </p>
            <p className="font-display text-2xl font-bold leading-none mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">

        {/* Shared patients list */}
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <UserRound className="h-4 w-4 text-muted-foreground" /> Pacientes compartilhados
          </h3>
          {patients.length === 0 ? (
            <p className="rounded-xl bg-secondary/40 p-3 text-sm text-muted-foreground">
              Nenhum paciente compartilhado ainda.
            </p>
          ) : (
            <ul className="space-y-2 lg:max-h-[420px] lg:overflow-y-auto lg:pr-1">
              {patients.map((p) => {
                const st = statsByPatient[p.id];
                const selected = patientFilter === p.id;
                return (
                  <li key={p.id}>
                    <div
                      className={`rounded-xl border p-3 transition-colors ${
                        selected ? "border-primary bg-secondary/60" : "border-border bg-card"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setPatientFilter(selected ? "all" : p.id)}
                        className="flex w-full items-center gap-3 text-left"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary font-display font-bold text-primary">
                          {p.initials}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{p.initials}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {p.superviseeName} · {p.is_active ? "Ativo" : "Inativo"}
                          </span>
                        </span>
                      </button>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                        <span className="rounded-full bg-lilac/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-lilac">
                          {st?.count ?? 0} devolutiva{(st?.count ?? 0) !== 1 && "s"}
                        </span>
                        {st?.last && (
                          <span className="text-[11px] text-muted-foreground">
                            última {format(parseISO(st.last), "dd/MM/yyyy")}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto h-8 px-2 text-xs"
                          onClick={() => onOpenPatient(p)}
                        >
                          <FileText className="mr-1 h-3.5 w-3.5" /> Prontuário
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

          )}
        </div>

        {/* Feedback timeline */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4 text-muted-foreground" /> Devolutivas por data
            </h3>
            {patientFilter !== "all" && (
              <Button variant="ghost" size="sm" onClick={() => setPatientFilter("all")}>
                Limpar filtro
              </Button>
            )}
          </div>

          {loading ? (
            <div className="py-8 text-center">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
            </div>
          ) : grouped.length === 0 ? (
            <p className="rounded-xl bg-secondary/40 p-3 text-sm text-muted-foreground">
              Nenhuma devolutiva registrada{patientFilter !== "all" ? " para este paciente" : ""} ainda.
              Abra o prontuário do paciente para criar a primeira.
            </p>
          ) : (
            <ol className="space-y-4">
              {grouped.map(([date, list]) => (
                <li key={date} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {format(parseISO(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                  <ul className="space-y-2 border-l-2 border-lilac/30 pl-3">
                    {list.map((f) => {
                      const p = patientById[f.patient_id];
                      const resume =
                        (f.case_synthesis || f.conceptualization || f.therapeutic_direction || "").trim();
                      return (
                        <li key={f.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <GraduationCap className="h-3.5 w-3.5 text-lilac" />
                            <span className="text-sm font-medium">{p?.initials}</span>
                            <span className="text-xs text-muted-foreground">{p?.superviseeName}</span>
                            {f.shared_with_supervisee ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-moss/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-moss">
                                <Eye className="h-3 w-3" /> Compartilhada
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                <EyeOff className="h-3 w-3" /> Somente supervisor
                              </span>
                            )}
                          </div>
                          {resume && (
                            <p className="line-clamp-2 text-sm text-muted-foreground">{resume}</p>
                          )}
                          {p && (
                            <Button variant="secondary" size="sm" onClick={() => onOpenPatient(p)}>
                              <FileText className="mr-1 h-3.5 w-3.5" /> Abrir prontuário e devolutivas
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
