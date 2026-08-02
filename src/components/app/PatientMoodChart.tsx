import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Smile, TrendingUp, TrendingDown, Minus, AlertTriangle, RotateCcw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

import { Area, AreaChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis, CartesianGrid, Line } from "recharts";
import { supabase } from "@/integrations/supabase/client";


interface Props {
  patientId: string;
  patientName?: string;
}

interface ProgressRow {
  id: string;
  recorded_at: string;
  mood_score: number | null;
  note: string | null;
  wellbeing_score: number | null;
  wellbeing_source: string | null;
  patient_context: string | null;
  clinical_observation: string | null;
  attention_flag: "not_assessed" | "none" | "watch" | "urgent" | null;
  data_model: "legacy_unclassified" | "v2_structured" | null;
}

const moodEmoji = (score: number) =>
  score >= 8 ? "🤩" : score >= 6 ? "🙂" : score >= 4 ? "😐" : score >= 2 ? "😔" : "😫";

const sourceLabel = (s: string | null) =>
  s === "patient_self_report" ? "Autorrelato do paciente"
    : s === "professional_estimate" ? "Estimativa profissional"
    : null;

export const PatientMoodChart = ({ patientId }: Props) => {
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Novo registro de humor
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fDate, setFDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [fScore, setFScore] = useState<number[]>([5]);
  const [fSource, setFSource] = useState<"patient_self_report" | "professional_estimate">("patient_self_report");
  const [fContext, setFContext] = useState("");
  const [fObs, setFObs] = useState("");

  const resetForm = () => {
    setFDate(format(new Date(), "yyyy-MM-dd"));
    setFScore([5]);
    setFSource("patient_self_report");
    setFContext("");
    setFObs("");
  };

  const saveMood = async () => {
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sessão expirada. Faça login novamente.");
      const now = new Date();
      const recordedAt = new Date(`${fDate}T${format(now, "HH:mm:ss")}`);
      const { error: err } = await (supabase as any).from("patient_progress").insert({
        user_id: uid,
        patient_id: patientId,
        recorded_at: recordedAt.toISOString(),
        wellbeing_score: fScore[0],
        wellbeing_source: fSource,
        patient_context: fContext.trim() || null,
        clinical_observation: fObs.trim() || null,
        data_model: "v2_structured",
      });
      if (err) throw err;
      toast.success("Registro de humor salvo");
      setAddOpen(false);
      resetForm();
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      console.error("[PatientMoodChart] save failed:", e);
      toast.error(e?.message || "Não foi possível salvar o registro.");
    } finally {
      setSaving(false);
    }
  };

  const AddButton = (
    <Button size="sm" variant="accent" className="rounded-full" onClick={() => setAddOpen(true)}>
      <Plus className="h-4 w-4 mr-1.5" /> Novo registro
    </Button>
  );

  const AddDialog = (
    <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetForm(); }}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Novo registro de humor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mood-date">Data</Label>
              <Input id="mood-date" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Select value={fSource} onValueChange={(v) => setFSource(v as typeof fSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="patient_self_report">Autorrelato do paciente</SelectItem>
                  <SelectItem value="professional_estimate">Estimativa profissional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Bem-estar: <span className="font-semibold">{fScore[0]}/10 {moodEmoji(fScore[0])}</span></Label>
            <Slider min={0} max={10} step={1} value={fScore} onValueChange={setFScore} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mood-ctx">Contexto do paciente</Label>
            <Textarea id="mood-ctx" rows={2} value={fContext} onChange={(e) => setFContext(e.target.value)} placeholder="O que o paciente relatou..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mood-obs">Observação clínica</Label>
            <Textarea id="mood-obs" rows={2} value={fObs} onChange={(e) => setFObs(e.target.value)} placeholder="Sua leitura clínica..." />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>Cancelar</Button>
          <Button variant="accent" onClick={saveMood} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );


  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await (supabase as any)
          .from("patient_progress")
          .select("id, recorded_at, mood_score, note, wellbeing_score, wellbeing_source, patient_context, clinical_observation, attention_flag, data_model")
          .eq("patient_id", patientId)
          .order("recorded_at", { ascending: true });
        if (cancelled) return;
        if (err) throw err;
        setRows((data as ProgressRow[]) ?? []);
      } catch (e: any) {
        if (cancelled) return;
        console.error("[PatientMoodChart] load failed:", e);
        setError(e?.message || "Não foi possível carregar o histórico de humor.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [patientId, reloadKey]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-destructive">Falha ao carregar histórico</p>
            <p className="text-muted-foreground mt-0.5">{error}</p>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
            <RotateCcw className="h-4 w-4 mr-2" /> Tentar novamente
          </Button>
        </div>
      </div>
    );
  }


  const v2Rows = rows.filter((r) => r.data_model === "v2_structured" && r.wellbeing_score != null);
  const legacyRows = rows.filter((r) => r.data_model !== "v2_structured" && r.mood_score != null);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <Smile className="h-8 w-8 mx-auto text-muted-foreground/40" />
        <p className="mt-2 text-sm text-muted-foreground">Nenhum registro clínico ainda.</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Registre bem-estar, contexto e observação clínica ao editar uma sessão.
        </p>
      </div>
    );
  }

  const chartData = v2Rows.map((r) => ({
    name: format(new Date(r.recorded_at), "dd/MM"),
    score: Number(r.wellbeing_score),
    source: r.wellbeing_source,
  }));

  const v2Scores = v2Rows.map((r) => Number(r.wellbeing_score));
  const avg = v2Scores.length ? v2Scores.reduce((a, b) => a + b, 0) / v2Scores.length : 0;
  const last = v2Scores[v2Scores.length - 1];
  const first = v2Scores[0];
  const trend = v2Scores.length >= 2 ? last - first : 0;
  const min = v2Scores.length ? Math.min(...v2Scores) : 0;
  const max = v2Scores.length ? Math.max(...v2Scores) : 0;

  const TrendIcon = trend > 0.5 ? TrendingUp : trend < -0.5 ? TrendingDown : Minus;
  const trendColor =
    trend > 0.5 ? "text-emerald-600" : trend < -0.5 ? "text-destructive" : "text-muted-foreground";

  const lastRecord = rows.length ? rows[rows.length - 1] : null;
  const lastIsV2 = lastRecord?.data_model === "v2_structured";
  const lastScore = lastIsV2 ? lastRecord?.wellbeing_score : lastRecord?.mood_score;
  const lastDisplayText = lastRecord
    ? lastIsV2
      ? [lastRecord.patient_context, lastRecord.clinical_observation].filter(Boolean).join(" · ")
      : (lastRecord.note ?? "")
    : "";

  return (
    <div className="space-y-4">
      {v2Rows.length === 0 && legacyRows.length > 0 && (
        <div className="rounded-xl border border-amber-300/40 bg-amber-50/60 p-3 text-sm">
          <p className="font-semibold text-amber-900">Sem série de bem-estar (v2) ainda.</p>
          <p className="text-amber-900/80 text-xs mt-1">
            {legacyRows.length} registro(s) legado(s) abaixo, mantidos apenas para consulta.
          </p>
        </div>
      )}

      {/* Último registro */}
      {lastRecord && (
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4 shadow-[var(--shadow-card)]">
          <div className="text-3xl shrink-0">{lastScore != null ? moodEmoji(Number(lastScore)) : "🗒️"}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase text-muted-foreground">Último registro</p>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              {lastScore != null && (
                <span className="text-lg font-display font-bold text-foreground">
                  {Number(lastScore)}/10 {lastIsV2 ? "· bem-estar" : "· humor legado"}
                </span>
              )}
              {lastIsV2 && sourceLabel(lastRecord.wellbeing_source) && (
                <span className="text-[10px] rounded-full px-2 py-0.5 bg-lilac/40 text-primary-dark font-semibold">
                  {sourceLabel(lastRecord.wellbeing_source)}
                </span>
              )}
              {!lastIsV2 && (
                <span className="text-[10px] rounded-full px-2 py-0.5 bg-amber-200/60 text-amber-900 font-semibold uppercase tracking-wider">
                  Legado
                </span>
              )}
            </div>
            {lastDisplayText && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{lastDisplayText}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-medium text-foreground">
              {format(new Date(lastRecord.recorded_at), "dd/MM/yyyy", { locale: ptBR })}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(lastRecord.recorded_at), "HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>
      )}

      {/* Summary — só quando existe série v2 */}
      {v2Rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-xl bg-muted/30 p-3 text-center">
            <p className="text-lg font-display font-bold text-foreground">{v2Rows.length}</p>
            <p className="text-[10px] uppercase text-muted-foreground">Registros v2</p>
          </div>
          <div className="rounded-xl bg-lilac/30 p-3 text-center">
            <p className="text-lg font-display font-bold text-foreground">
              {avg.toFixed(1)} <span className="text-sm">{moodEmoji(avg)}</span>
            </p>
            <p className="text-[10px] uppercase text-muted-foreground">Média bem-estar</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3 text-center">
            <p className="text-lg font-display font-bold text-emerald-700">
              {max} <span className="text-sm">{moodEmoji(max)}</span>
            </p>
            <p className="text-[10px] uppercase text-muted-foreground">Máximo</p>
          </div>
          <div className="rounded-xl bg-muted/30 p-3 text-center">
            <p className={`text-lg font-display font-bold flex items-center justify-center gap-1 ${trendColor}`}>
              <TrendIcon className="h-4 w-4" />
              {trend > 0 ? "+" : ""}{trend.toFixed(1)}
            </p>
            <p className="text-[10px] uppercase text-muted-foreground">Tendência</p>
          </div>
        </div>
      )}

      {v2Rows.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-xs uppercase text-muted-foreground mb-2">Evolução do bem-estar (0–10)</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="wbGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <RechartsTooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`${value}/10 ${moodEmoji(value)}`, "Bem-estar"]}
                />
                <Area type="monotone" dataKey="score" stroke="hsl(var(--accent))" strokeWidth={2} fill="url(#wbGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Lista */}
      <div>
        <p className="text-xs uppercase text-muted-foreground mb-2">Histórico</p>
        <div className="space-y-2">
          {[...rows].reverse().map((r) => {
            const isV2 = r.data_model === "v2_structured";
            const score = isV2 ? r.wellbeing_score : r.mood_score;
            const attention = r.attention_flag;
            const displayText = isV2
              ? [r.patient_context, r.clinical_observation].filter(Boolean).join("\n")
              : (r.note ?? "");
            return (
              <div
                key={r.id}
                className={`rounded-xl border p-3 flex items-start gap-3 ${
                  isV2 ? "border-border bg-muted/20" : "border-amber-300/40 bg-amber-50/40"
                }`}
              >
                <div className="text-2xl">{score != null ? moodEmoji(Number(score)) : "🗒️"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {score != null && (
                      <span className="text-sm font-medium text-foreground">
                        {Number(score)}/10 {isV2 ? "· bem-estar" : "· humor legado"}
                      </span>
                    )}
                    {!isV2 && (
                      <span className="text-[10px] rounded-full px-2 py-0.5 bg-amber-200/60 text-amber-900 font-semibold uppercase tracking-wider">
                        Legado
                      </span>
                    )}
                    {isV2 && sourceLabel(r.wellbeing_source) && (
                      <span className="text-[10px] rounded-full px-2 py-0.5 bg-lilac/40 text-primary-dark font-semibold">
                        {sourceLabel(r.wellbeing_source)}
                      </span>
                    )}
                    {attention === "watch" && (
                      <span className="text-[10px] rounded-full px-2 py-0.5 bg-amber-200/70 text-amber-900 font-semibold inline-flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Observar
                      </span>
                    )}
                    {attention === "urgent" && (
                      <span className="text-[10px] rounded-full px-2 py-0.5 bg-destructive/15 text-destructive font-semibold inline-flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Urgente
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(r.recorded_at), "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  {displayText && (
                    <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{displayText}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
