import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, subDays, startOfWeek, differenceInDays, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip as RechartsTooltip, XAxis, YAxis, Legend,
} from "recharts";
import {
  AlertTriangle, ArrowDown, ArrowUp, Minus, Search, SlidersHorizontal,
  Info, ChevronRight, ShieldAlert, Users, Activity, Clock, RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { PatientMoodChart } from "@/components/app/PatientMoodChart";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";

/* =========================================================================
 * Types
 * ======================================================================== */
type AttentionFlag = "not_assessed" | "none" | "watch" | "urgent" | null;

interface ProgressRow {
  id: string;
  patient_id: string;
  recorded_at: string;
  mood_score: number | null;
  wellbeing_score: number | null;
  note: string | null;
  patient_context: string | null;
  clinical_observation: string | null;
  attention_flag: AttentionFlag;
  data_model: "legacy_unclassified" | "v2_structured" | null;
}
interface PatientRow { id: string; full_name: string; is_active: boolean | null; }
interface SessionRow { patient_id: string; scheduled_at: string; }

type Band = "well" | "watch" | "critical";
type Period = 7 | 30 | 90;

interface PatientAggregate {
  patient: PatientRow;
  score: number | null;
  band: Band | "no_record";
  flag: AttentionFlag;
  lastAt: string | null;
  daysSince: number | null;
  previous: number | null;
  delta: number | null;
  preview: string;
  nextSession: string | null;
}

/* =========================================================================
 * Configurable thresholds
 * ======================================================================== */
const DEFAULT_THRESHOLDS = { well: 7, critical: 3 };
const STORAGE_KEY = "psireal.humor.thresholds";

const loadThresholds = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THRESHOLDS;
    const parsed = JSON.parse(raw);
    return { well: Number(parsed.well) || 7, critical: Number(parsed.critical) || 3 };
  } catch { return DEFAULT_THRESHOLDS; }
};

const classify = (score: number | null, t: { well: number; critical: number }): Band | "no_record" => {
  if (score == null) return "no_record";
  if (score >= t.well) return "well";
  if (score <= t.critical) return "critical";
  return "watch";
};

const bandMeta: Record<Band, { label: string; bar: string; text: string; soft: string; ring: string }> = {
  well:     { label: "Bem",     bar: "bg-emerald-500", text: "text-emerald-700", soft: "bg-emerald-50",  ring: "ring-emerald-200" },
  watch:    { label: "Atenção", bar: "bg-amber-500",   text: "text-amber-700",   soft: "bg-amber-50",    ring: "ring-amber-200" },
  critical: { label: "Crítico", bar: "bg-rose-500",    text: "text-rose-700",    soft: "bg-rose-50",     ring: "ring-rose-200" },
};

const flagLabel: Record<Exclude<AttentionFlag, null>, string> = {
  not_assessed: "Não avaliado",
  none: "Sem atenção",
  watch: "Observar",
  urgent: "Urgente",
};

const flagStyle: Record<Exclude<AttentionFlag, null>, string> = {
  not_assessed: "bg-muted text-muted-foreground",
  none: "bg-emerald-50 text-emerald-700",
  watch: "bg-amber-50 text-amber-700",
  urgent: "bg-rose-50 text-rose-700",
};

/* =========================================================================
 * Component
 * ======================================================================== */
export default function Humor() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>(30);
  const [search, setSearch] = useState("");
  const [thresholds, setThresholds] = useState(loadThresholds);
  const [thresholdsDraft, setThresholdsDraft] = useState(thresholds);
  const [tab, setTab] = useState<"current" | "weekly">("current");
  const [filter, setFilter] = useState<"all" | Band | "no_flag" | "stale" | "pending_review">("all");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const since = subDays(new Date(), Math.max(period, 90)).toISOString();
        const [ptsRes, prgRes, sessRes] = await Promise.all([
          supabase.from("patients").select("id, full_name, is_active").eq("is_active", true),
          (supabase as any)
            .from("patient_progress")
            .select("id, patient_id, recorded_at, mood_score, wellbeing_score, note, patient_context, clinical_observation, attention_flag, data_model")
            .gte("recorded_at", since)
            .order("recorded_at", { ascending: false }),
          supabase.from("sessions")
            .select("patient_id, scheduled_at")
            .gte("scheduled_at", new Date().toISOString())
            .order("scheduled_at", { ascending: true }),
        ]);
        if (cancelled) return;
        const firstError = ptsRes.error || prgRes.error || sessRes.error;
        if (firstError) throw firstError;
        setPatients((ptsRes.data as PatientRow[]) ?? []);
        setProgress((prgRes.data as ProgressRow[]) ?? []);
        setSessions((sessRes.data as SessionRow[]) ?? []);
      } catch (err: any) {
        if (cancelled) return;
        const msg = err?.message || "Não foi possível carregar os dados de humor.";
        console.error("[Humor] load failed:", err);
        setLoadError(msg);
        toast.error("Falha ao carregar humor", { description: msg });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [period, reloadKey]);


  /* Aggregate per patient (latest within period) */
  const aggregates = useMemo<PatientAggregate[]>(() => {
    const since = subDays(new Date(), period);
    const byPatient = new Map<string, ProgressRow[]>();
    for (const r of progress) {
      if (!isAfter(new Date(r.recorded_at), since)) continue;
      const list = byPatient.get(r.patient_id) ?? [];
      list.push(r);
      byPatient.set(r.patient_id, list);
    }
    const nextByPatient = new Map<string, string>();
    for (const s of sessions) {
      if (!nextByPatient.has(s.patient_id)) nextByPatient.set(s.patient_id, s.scheduled_at);
    }
    return patients.map((p) => {
      const rows = (byPatient.get(p.id) ?? []).sort(
        (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
      );
      const latest = rows[0];
      const prev = rows[1];
      const scoreOf = (r?: ProgressRow) =>
        r ? (r.wellbeing_score ?? r.mood_score ?? null) : null;
      const score = scoreOf(latest);
      const previous = scoreOf(prev);
      const delta = score != null && previous != null ? Number(score) - Number(previous) : null;
      const preview =
        (latest?.patient_context || latest?.clinical_observation || latest?.note || "").slice(0, 90);
      return {
        patient: p,
        score: score != null ? Number(score) : null,
        band: classify(score != null ? Number(score) : null, thresholds),
        flag: latest?.attention_flag ?? null,
        lastAt: latest?.recorded_at ?? null,
        daysSince: latest ? differenceInDays(new Date(), new Date(latest.recorded_at)) : null,
        previous: previous != null ? Number(previous) : null,
        delta,
        preview,
        nextSession: nextByPatient.get(p.id) ?? null,
      };
    });
  }, [patients, progress, sessions, period, thresholds]);

  /* KPIs */
  const kpis = useMemo(() => {
    const withScore = aggregates.filter((a) => a.score != null);
    const critical = aggregates.filter((a) => a.band === "critical").length;
    const watch = aggregates.filter((a) => a.band === "watch").length;
    const well = aggregates.filter((a) => a.band === "well").length;
    const total = withScore.length;
    const urgent = aggregates.filter((a) => a.flag === "urgent").length;
    const recentDrop = aggregates.filter((a) => a.delta != null && a.delta <= -2).length;
    const avg = total ? withScore.reduce((s, a) => s + (a.score ?? 0), 0) / total : 0;
    const wellPct = total ? (well / total) * 100 : 0;
    return { critical, watch, well, total, urgent, recentDrop, avg, wellPct };
  }, [aggregates]);

  /* Weekly distribution: last 4 weeks */
  const weekly = useMemo(() => {
    const weeks: { key: string; label: string; start: Date }[] = [];
    for (let i = 3; i >= 0; i--) {
      const start = startOfWeek(subDays(new Date(), i * 7), { weekStartsOn: 1 });
      weeks.push({ key: start.toISOString(), label: `Sem ${format(start, "dd/MM")}`, start });
    }
    return weeks.map((w) => {
      // latest per patient up to the end of that week (7d window from start)
      const end = new Date(w.start.getTime() + 7 * 86400000);
      const latest = new Map<string, number>();
      for (const r of progress) {
        const d = new Date(r.recorded_at);
        if (d >= w.start && d < end) {
          if (!latest.has(r.patient_id)) {
            const s = r.wellbeing_score ?? r.mood_score;
            if (s != null) latest.set(r.patient_id, Number(s));
          }
        }
      }
      const arr = Array.from(latest.values());
      const total = arr.length;
      const well = arr.filter((s) => classify(s, thresholds) === "well").length;
      const wCount = arr.filter((s) => classify(s, thresholds) === "watch").length;
      const crit = arr.filter((s) => classify(s, thresholds) === "critical").length;
      return {
        name: w.label,
        total,
        Bem: total ? Math.round((well / total) * 100) : 0,
        Atenção: total ? Math.round((wCount / total) * 100) : 0,
        Crítico: total ? Math.round((crit / total) * 100) : 0,
      };
    });
  }, [progress, thresholds]);

  const weeklyHasData = weekly.some((w) => w.total > 0);

  /* Attention immediate list */
  const urgentList = useMemo(() => {
    return aggregates
      .filter((a) =>
        a.flag === "urgent" ||
        a.band === "critical" ||
        (a.delta != null && a.delta <= -3) ||
        a.flag === "watch"
      )
      .sort((a, b) => {
        const rank = (x: PatientAggregate) =>
          (x.flag === "urgent" ? 0 : x.band === "critical" ? 1 : x.flag === "watch" ? 2 : 3);
        const r = rank(a) - rank(b);
        if (r !== 0) return r;
        const sa = a.score ?? 99;
        const sb = b.score ?? 99;
        if (sa !== sb) return sa - sb;
        return (a.delta ?? 0) - (b.delta ?? 0);
      })
      .slice(0, 8);
  }, [aggregates]);

  /* General list */
  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return aggregates
      .filter((a) => {
        if (q && !a.patient.full_name.toLowerCase().includes(q)) return false;
        if (filter === "all") return true;
        if (filter === "no_flag") return !a.flag || a.flag === "not_assessed";
        if (filter === "stale") return !a.daysSince || a.daysSince > 14;
        if (filter === "pending_review") return a.flag === "watch" || a.flag === "urgent";
        return a.band === filter;
      })
      .sort((a, b) => {
        const bandOrder: Record<string, number> = { critical: 0, watch: 1, well: 3, no_record: 2 };
        return bandOrder[a.band] - bandOrder[b.band];
      });
  }, [aggregates, search, filter]);

  const [openPatientId, setOpenPatientId] = useState<string | null>(null);
  const openPatient = (id: string) => setOpenPatientId(id);
  const goToPatientFullView = (id: string) => navigate(`/app/pacientes?patient=${id}&tab=overview`);
  const openPatientData = useMemo(
    () => aggregates.find((a) => a.patient.id === openPatientId) ?? null,
    [aggregates, openPatientId]
  );
  const openPatientRecords = useMemo(
    () =>
      openPatientId
        ? progress
            .filter((r) => r.patient_id === openPatientId)
            .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
        : [],
    [progress, openPatientId]
  );

  const saveThresholds = () => {
    if (thresholdsDraft.critical >= thresholdsDraft.well - 1) {
      toast.error("A faixa Crítico deve terminar antes da faixa Bem.");
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(thresholdsDraft));
    setThresholds(thresholdsDraft);
    toast.success("Faixas atualizadas.");
  };

  const markReviewed = async (a: PatientAggregate) => {
    if (!a.lastAt) return;
    if (!window.confirm(`Marcar sinalização de ${a.patient.full_name} como revisada?`)) return;
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    const row = progress.find((r) => r.patient_id === a.patient.id && r.recorded_at === a.lastAt);
    if (!row) return;
    const { error } = await (supabase as any)
      .from("patient_progress")
      .update({ attention_flag: "none", attention_set_by: uid, attention_set_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) return toast.error("Não foi possível atualizar.");
    setProgress((prev) => prev.map((r) => (r.id === row.id ? { ...r, attention_flag: "none" } : r)));
    toast.success("Sinalização revisada.");
  };

  /* ======================================================================
   * Render
   * ==================================================================== */
  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
            Acompanhamento do humor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão clínica dos registros mais recentes dos pacientes
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-56"
              aria-label="Buscar paciente"
            />
          </div>
          <div className="flex flex-col text-xs">
            <label htmlFor="period" className="sr-only">Período</label>
            <Select value={String(period)} onValueChange={(v) => setPeriod(Number(v) as Period)}>
              <SelectTrigger id="period" className="w-36" aria-label="Período">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <SlidersHorizontal className="h-4 w-4" /> Configurar faixas
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Faixas de humor</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <p className="text-xs text-muted-foreground">
                  Ajuste os cortes de classificação automática. As alterações são salvas neste navegador.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="th-well">Bem a partir de</Label>
                    <Input id="th-well" type="number" min={1} max={10}
                      value={thresholdsDraft.well}
                      onChange={(e) => setThresholdsDraft({ ...thresholdsDraft, well: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="th-crit">Crítico até</Label>
                    <Input id="th-crit" type="number" min={0} max={9}
                      value={thresholdsDraft.critical}
                      onChange={(e) => setThresholdsDraft({ ...thresholdsDraft, critical: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Atenção fica entre {thresholdsDraft.critical + 1} e {thresholdsDraft.well - 1}.
                </p>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setThresholdsDraft(DEFAULT_THRESHOLDS)}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Restaurar padrão
                </Button>
                <Button onClick={saveThresholds}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          tone="critical"
          icon={<ShieldAlert className="h-5 w-5" />}
          label="Crítico"
          value={kpis.critical}
          context={kpis.urgent ? `${kpis.urgent} sinalizado(s) como urgente` : "Requer revisão imediata"}
          emphasized
        />
        <Kpi
          tone="watch"
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Em atenção"
          value={kpis.watch}
          context={kpis.recentDrop ? `${kpis.recentDrop} com queda recente` : "Monitoramento próximo"}
          emphasized
        />
        <Kpi
          tone="well"
          icon={<Users className="h-5 w-5" />}
          label="Estáveis"
          value={kpis.well}
          context={kpis.total ? `${kpis.wellPct.toFixed(1)}% da carteira` : "Sem registros no período"}
        />
        <Kpi
          tone="neutral"
          icon={<Activity className="h-5 w-5" />}
          label="Média geral"
          value={kpis.avg ? `${kpis.avg.toFixed(1)}/10` : "—"}
          context={`Baseada em ${kpis.total} paciente(s) com registro`}
        />
      </section>

      {/* Attention immediate */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Atenção imediata</h2>
            <p className="text-xs text-muted-foreground">
              Pacientes que exigem revisão do profissional
            </p>
          </div>
          <span className="text-xs rounded-full px-2.5 py-1 bg-primary/10 text-primary font-medium">
            {urgentList.length} {urgentList.length === 1 ? "paciente" : "pacientes"}
          </span>
        </div>
        {loading ? (
          <SkeletonList />
        ) : urgentList.length === 0 ? (
          <EmptyBox title="Nenhum paciente exige atenção imediata" description="Todos os registros recentes estão dentro das faixas esperadas." />
        ) : (
          <ul className="divide-y divide-border">
            {urgentList.map((a) => (
              <UrgentItem
                key={a.patient.id}
                a={a}
                revealed={!!revealed[a.patient.id]}
                onReveal={() => setRevealed((s) => ({ ...s, [a.patient.id]: true }))}
                onOpen={() => openPatient(a.patient.id)}
                onReviewed={() => markReviewed(a)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Distribution / Weekly */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display text-lg font-semibold">
              {tab === "current" ? "Distribuição atual" : "Evolução por semana"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {tab === "current"
                ? `${kpis.total} paciente(s) com registro no período`
                : "Percentual de pacientes em cada faixa (agregado por semana)"}
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40" role="tablist">
            <TabBtn active={tab === "current"} onClick={() => setTab("current")}>Distribuição atual</TabBtn>
            <TabBtn active={tab === "weekly"} onClick={() => setTab("weekly")}>Evolução por semana</TabBtn>
          </div>
        </div>

        {tab === "current" ? (
          <DistributionBars
            total={kpis.total}
            well={kpis.well}
            watch={kpis.watch}
            critical={kpis.critical}
          />
        ) : weeklyHasData ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} domain={[0, 100]} />
                <RechartsTooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, k) => [`${v}%`, k as string]}
                  labelFormatter={(l, payload) => {
                    const total = payload?.[0]?.payload?.total ?? 0;
                    return `${l} · ${total} paciente(s)`;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Bem" stackId="a" fill="#10b981" />
                <Bar dataKey="Atenção" stackId="a" fill="#f59e0b" />
                <Bar dataKey="Crítico" stackId="a" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyBox title="Dados insuficientes" description="São necessários mais registros de humor ao longo das semanas para calcular a evolução agregada." />
        )}
      </section>

      {/* General list */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-display text-lg font-semibold">Lista geral</h2>
          <div className="flex flex-wrap gap-2">
            {[
              ["all", "Todos"], ["well", "Bem"], ["watch", "Atenção"], ["critical", "Crítico"],
              ["no_flag", "Não avaliados"], ["stale", "Desatualizados"], ["pending_review", "Revisão pendente"],
            ].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setFilter(k as typeof filter)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  filter === k
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <SkeletonList />
        ) : filteredList.length === 0 ? (
          <EmptyBox title="Nenhum paciente encontrado" description="Ajuste os filtros ou a busca para ver outros pacientes." />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground uppercase">
                  <tr>
                    <Th>Paciente</Th>
                    <Th>Último humor</Th>
                    <Th>Tendência</Th>
                    <Th>Avaliação profissional</Th>
                    <Th>Último registro</Th>
                    <Th>Próxima sessão</Th>
                    <Th className="text-right">Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredList.map((a) => (
                    <tr key={a.patient.id} className="border-t border-border hover:bg-muted/30">
                      <Td>
                        <button
                          onClick={() => openPatient(a.patient.id)}
                          className="font-medium text-foreground hover:text-primary text-left"
                        >
                          {a.patient.full_name}
                        </button>
                      </Td>
                      <Td><BandBadge score={a.score} band={a.band} /></Td>
                      <Td><TrendPill delta={a.delta} /></Td>
                      <Td><FlagBadge flag={a.flag} /></Td>
                      <Td>{a.lastAt ? `há ${a.daysSince} dia(s)` : <span className="text-muted-foreground">sem registro</span>}</Td>
                      <Td>{a.nextSession ? format(new Date(a.nextSession), "dd/MM", { locale: ptBR }) : <span className="text-muted-foreground">—</span>}</Td>
                      <Td className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openPatient(a.patient.id)}>
                          Abrir <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="md:hidden space-y-2">
              {filteredList.map((a) => (
                <li key={a.patient.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => openPatient(a.patient.id)} className="font-medium text-foreground text-left">
                      {a.patient.full_name}
                    </button>
                    <BandBadge score={a.score} band={a.band} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <TrendPill delta={a.delta} />
                    <FlagBadge flag={a.flag} />
                    <span className="text-muted-foreground inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {a.lastAt ? `há ${a.daysSince}d` : "sem registro"}
                    </span>
                    {a.nextSession && (
                      <span className="text-muted-foreground">Próx. {format(new Date(a.nextSession), "dd/MM")}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Clinical safety note */}
      <p className="text-xs text-muted-foreground inline-flex items-start gap-2 px-1">
        <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        As informações de humor servem como apoio ao acompanhamento e não substituem a avaliação profissional.
      </p>

      {/* Patient side panel */}
      <Sheet open={!!openPatientId} onOpenChange={(o) => !o && setOpenPatientId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {openPatientData && openPatientId && (
            <>
              <SheetHeader className="pb-4 border-b border-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <SheetTitle className="font-display text-xl">
                      {openPatientData.patient.full_name}
                    </SheetTitle>
                    <SheetDescription className="mt-1 flex flex-wrap items-center gap-2">
                      <BandBadge score={openPatientData.score} band={openPatientData.band} />
                      <FlagBadge flag={openPatientData.flag} />
                      <TrendPill delta={openPatientData.delta} />
                    </SheetDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPatientFullView(openPatientId)}
                    className="gap-1.5 flex-shrink-0"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Ficha completa
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground pt-2">
                  {openPatientData.lastAt
                    ? `Último registro há ${openPatientData.daysSince} dia(s)`
                    : "Sem registro no período"}
                  {openPatientData.nextSession
                    ? ` · Próxima sessão em ${format(new Date(openPatientData.nextSession), "dd/MM", { locale: ptBR })}`
                    : ""}
                </div>
              </SheetHeader>

              <div className="py-4 space-y-6">
                <section>
                  <h3 className="font-display text-sm font-semibold uppercase text-muted-foreground mb-3">
                    Evolução do humor
                  </h3>
                  <PatientMoodChart
                    patientId={openPatientId}
                    patientName={openPatientData.patient.full_name}
                  />
                </section>

                <section>
                  <h3 className="font-display text-sm font-semibold uppercase text-muted-foreground mb-3">
                    Registros ({openPatientRecords.length})
                  </h3>
                  {openPatientRecords.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                      Nenhum registro no período selecionado.
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {openPatientRecords.map((r) => {
                        const isV2 = r.data_model === "v2_structured";
                        const score = isV2 ? r.wellbeing_score : r.mood_score;
                        const origin = isV2
                          ? "Bem-estar (v2)"
                          : "Humor legado";
                        return (
                          <li
                            key={r.id}
                            className={`rounded-xl border p-3 text-xs ${
                              isV2 ? "border-border bg-muted/20" : "border-amber-200/60 bg-amber-50/40"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">
                                  {score != null ? `${score}/10` : "sem nota"}
                                </span>
                                <span className="rounded-full px-2 py-0.5 bg-background border border-border text-muted-foreground">
                                  {origin}
                                </span>
                                {r.attention_flag && r.attention_flag !== "not_assessed" && (
                                  <FlagBadge flag={r.attention_flag} />
                                )}
                              </div>
                              <span className="text-muted-foreground">
                                {format(new Date(r.recorded_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                            {(r.patient_context || r.clinical_observation || r.note) && (
                              <p className="text-foreground/80 mt-2 whitespace-pre-line">
                                {[r.patient_context, r.clinical_observation, r.note].filter(Boolean).join("\n")}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* =========================================================================
 * Presentational components
 * ======================================================================== */
const Kpi = ({
  tone, icon, label, value, context, emphasized,
}: {
  tone: "critical" | "watch" | "well" | "neutral";
  icon: React.ReactNode;
  label: string; value: string | number;
  context: string;
  emphasized?: boolean;
}) => {
  const styles = {
    critical: "border-rose-200 bg-rose-50/50",
    watch: "border-amber-200 bg-amber-50/50",
    well: "border-emerald-200 bg-emerald-50/40",
    neutral: "border-border bg-card",
  }[tone];
  const iconColor = {
    critical: "text-rose-600",
    watch: "text-amber-600",
    well: "text-emerald-600",
    neutral: "text-muted-foreground",
  }[tone];
  return (
    <div className={`rounded-2xl border p-4 ${styles} ${emphasized ? "shadow-sm" : ""}`}>
      <div className={`flex items-center gap-2 text-sm ${iconColor}`}>
        {icon}<span className="font-medium">{label}</span>
      </div>
      <p className="mt-2 font-display text-3xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{context}</p>
    </div>
  );
};

const TabBtn = ({ active, onClick, children }: any) => (
  <button
    role="tab"
    aria-selected={active}
    onClick={onClick}
    className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
      active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
    }`}
  >
    {children}
  </button>
);

const DistributionBars = ({ total, well, watch, critical }: { total: number; well: number; watch: number; critical: number; }) => {
  const rows: { band: Band; count: number; range: string }[] = [
    { band: "well", count: well, range: "7 a 10" },
    { band: "watch", count: watch, range: "4 a 6" },
    { band: "critical", count: critical, range: "0 a 3" },
  ];
  if (total === 0) {
    return <EmptyBox title="Sem registros no período" description="Nenhum paciente registrou humor no intervalo selecionado." />;
  }
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const pct = total ? (r.count / total) * 100 : 0;
        const m = bandMeta[r.band];
        return (
          <div key={r.band}>
            <div className="flex items-center justify-between text-sm mb-1">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${m.bar}`} />
                <span className={`font-medium ${m.text}`}>{m.label}</span>
                <span className="text-xs text-muted-foreground">· notas {r.range}</span>
              </div>
              <span className="text-xs font-medium text-foreground">
                {r.count} paciente(s) · {pct.toFixed(1)}%
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
              <div className={`h-full ${m.bar}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const BandBadge = ({ score, band }: { score: number | null; band: Band | "no_record" }) => {
  if (band === "no_record" || score == null) {
    return <span className="text-xs rounded-full px-2 py-0.5 bg-muted text-muted-foreground">Sem registro</span>;
  }
  const m = bandMeta[band];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs rounded-full px-2 py-0.5 ${m.soft} ${m.text} font-medium`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.bar}`} />
      {score}/10 · {m.label}
    </span>
  );
};

const FlagBadge = ({ flag }: { flag: AttentionFlag }) => {
  const f = flag ?? "not_assessed";
  return (
    <span className={`text-xs rounded-full px-2 py-0.5 ${flagStyle[f]}`}>
      {flagLabel[f]}
    </span>
  );
};

const TrendPill = ({ delta }: { delta: number | null }) => {
  if (delta == null) return <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Minus className="h-3 w-3" /> sem base</span>;
  if (delta > 0) return <span className="text-xs text-emerald-700 inline-flex items-center gap-1"><ArrowUp className="h-3 w-3" /> +{delta} ponto(s)</span>;
  if (delta < 0) return <span className="text-xs text-rose-700 inline-flex items-center gap-1"><ArrowDown className="h-3 w-3" /> {delta} ponto(s)</span>;
  return <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Minus className="h-3 w-3" /> estável</span>;
};

const UrgentItem = ({
  a, revealed, onReveal, onOpen, onReviewed,
}: { a: PatientAggregate; revealed: boolean; onReveal: () => void; onOpen: () => void; onReviewed: () => void; }) => {
  const initials = a.patient.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  return (
    <li className="py-3 flex flex-col sm:flex-row sm:items-start gap-3">
      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="font-medium text-foreground">{a.patient.full_name}</p>
          <BandBadge score={a.score} band={a.band} />
          <TrendPill delta={a.delta} />
          <FlagBadge flag={a.flag} />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {a.lastAt ? `Último registro há ${a.daysSince} dia(s)` : "Sem registro no período"}
          {a.nextSession ? ` · Próxima sessão em ${format(new Date(a.nextSession), "dd/MM")}` : ""}
        </p>
        {a.preview ? (
          revealed ? (
            <p className="text-xs text-foreground/80 mt-2 italic">"{a.preview}..."</p>
          ) : (
            <button
              onClick={onReveal}
              className="text-xs text-primary hover:underline mt-2"
            >
              Ver prévia do comentário
            </button>
          )
        ) : null}
      </div>
      <div className="flex gap-2 flex-wrap sm:flex-nowrap">
        <Button size="sm" onClick={onOpen}>Abrir paciente</Button>
        {(a.flag === "watch" || a.flag === "urgent") && (
          <Button size="sm" variant="outline" onClick={onReviewed}>Marcar revisado</Button>
        )}
      </div>
    </li>
  );
};

const Th = ({ children, className = "" }: any) => (
  <th className={`text-left font-medium px-3 py-2 ${className}`}>{children}</th>
);
const Td = ({ children, className = "" }: any) => (
  <td className={`px-3 py-2 ${className}`}>{children}</td>
);

const SkeletonList = () => (
  <ul className="space-y-2">
    {Array.from({ length: 4 }).map((_, i) => (
      <li key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
    ))}
  </ul>
);

const EmptyBox = ({ title, description }: { title: string; description: string }) => (
  <div className="rounded-xl border border-dashed border-border p-8 text-center">
    <p className="font-medium text-foreground">{title}</p>
    <p className="text-xs text-muted-foreground mt-1">{description}</p>
  </div>
);
