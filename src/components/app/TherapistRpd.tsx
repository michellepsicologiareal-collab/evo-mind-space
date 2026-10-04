import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, ClipboardList, Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { RpdForm } from "@/components/app/RpdForm";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { aggregateDistortions, emptyRpdForm, fromRpdRecord, hasRpdContent, toRpdPayload, type RpdFormState } from "@/lib/rpd";
import { toast } from "sonner";

type RecordRow = Database["public"]["Tables"]["therapist_rpd_records"]["Row"];

const average = (values: (number | null)[]) => {
  const valid = values.filter((v): v is number => typeof v === "number");
  return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
};

export function TherapistRpd() {
  const { user } = useAuth();
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RpdFormState>(emptyRpdForm());

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.from("therapist_rpd_records")
      .select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500);
    if (error) toast.error("Não foi possível carregar seus registros de pensamentos.");
    else setRecords(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const series = useMemo(() => [...records].reverse().map((row, index) => {
    const parsed = fromRpdRecord(row);
    return {
      index: index + 1,
      date: format(new Date(row.created_at), "dd/MM/yyyy HH:mm"),
      before: row.crenca_pensamento_inicial,
      after: row.crenca_pensamento_final,
      emotionBefore: average(parsed.emotions.map((e) => e.before)),
      emotionAfter: average(parsed.emotions.map((e) => e.after)),
    };
  }), [records]);
  const distortions = useMemo(() => aggregateDistortions(records).slice(0, 6), [records]);
  const hasBeliefScores = series.some((point) => point.before != null || point.after != null);
  const hasEmotionScores = series.some((point) => point.emotionBefore != null || point.emotionAfter != null);

  const startNew = () => { setEditingId(null); setForm(emptyRpdForm()); setOpen(true); };
  const startEdit = (row: RecordRow) => { setEditingId(row.id); setForm(fromRpdRecord(row)); setOpen(true); };

  const save = async () => {
    if (!user || saving) return;
    if (!hasRpdContent(form)) { toast.error("Preencha ao menos uma etapa."); return; }
    setSaving(true);
    const payload = toRpdPayload(form);
    const values = {
      situation: payload.situation || null,
      automatic_thought: payload.automatic_thought || null,
      emotion: payload.emotion || null,
      behavior: payload.behavior || null,
      cognitive_distortion: payload.cognitive_distortion || null,
      rational_response: payload.rational_response || null,
      crenca_pensamento_inicial: payload.crenca_pensamento_inicial,
      crenca_pensamento_final: payload.crenca_pensamento_final,
      intensidade_emocao_inicial: payload.intensidade_emocao_inicial,
      intensidade_emocao_final: payload.intensidade_emocao_final,
    };
    const { error } = editingId
      ? await supabase.from("therapist_rpd_records").update(values).eq("id", editingId).eq("user_id", user.id)
      : await supabase.from("therapist_rpd_records").insert({ ...values, user_id: user.id });
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar seu RPD."); return; }
    toast.success(editingId ? "RPD atualizado." : "RPD salvo no seu Autocuidado.");
    setOpen(false);
    setEditingId(null);
    setForm(emptyRpdForm());
    void load();
  };

  const remove = async () => {
    if (!deleteId || !user) return;
    const { error } = await supabase.from("therapist_rpd_records").delete().eq("id", deleteId).eq("user_id", user.id);
    setDeleteId(null);
    if (error) { toast.error("Não foi possível excluir o RPD."); return; }
    toast.success("RPD excluído.");
    void load();
  };

  const chartTooltip = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" };
  const axisColor = "hsl(var(--muted-foreground))";

  return (
    <section aria-labelledby="therapist-rpd-title" className="space-y-6 border-y border-border py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="therapist-rpd-title" className="flex items-center gap-2 font-display text-xl font-bold text-foreground">
            <ClipboardList className="h-5 w-5 text-moss" /> Meu RPD
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Registro de pensamentos para você, separado dos prontuários dos pacientes.</p>
        </div>
        <Button variant="accent" onClick={startNew}><Plus className="h-4 w-4" /> Novo RPD</Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando registros...</div>
      ) : records.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-5 py-8 text-center text-muted-foreground">
          <BarChart3 className="mx-auto mb-2 h-6 w-6 text-moss" />
          Seus registros e gráficos aparecerão aqui após o primeiro RPD.
        </div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <h3 className="font-display font-semibold text-foreground">Crença no pensamento</h3>
              <p className="text-xs text-muted-foreground">Antes e depois de cada registro · 0 a 100%</p>
              {hasBeliefScores ? <div className="h-52 w-full" role="img" aria-label="Gráfico de crença no pensamento antes e depois">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="index" tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} />
                    <Tooltip contentStyle={chartTooltip} labelFormatter={(index) => series[Number(index) - 1]?.date ?? "Registro"} />
                    <Line name="Antes" type="monotone" dataKey="before" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                    <Line name="Depois" type="monotone" dataKey="after" stroke="hsl(var(--moss))" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div> : <p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">Marque a crença antes ou depois no RPD para acompanhar aqui.</p>}
              {hasBeliefScores && <p className="text-xs text-muted-foreground"><span className="text-accent">●</span> Antes <span className="ml-3 text-moss">●</span> Depois</p>}
            </div>
            <div className="min-w-0 space-y-2">
              <h3 className="font-display font-semibold text-foreground">Intensidade das emoções</h3>
              <p className="text-xs text-muted-foreground">Média das emoções marcadas em cada RPD · 0 a 100%</p>
              {hasEmotionScores ? <div className="h-52 w-full" role="img" aria-label="Gráfico de intensidade das emoções antes e depois">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="index" tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} />
                    <Tooltip contentStyle={chartTooltip} labelFormatter={(index) => series[Number(index) - 1]?.date ?? "Registro"} />
                    <Line name="Antes" type="monotone" dataKey="emotionBefore" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                    <Line name="Depois" type="monotone" dataKey="emotionAfter" stroke="hsl(var(--moss))" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div> : <p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">Marque a intensidade de uma emoção no RPD para acompanhar aqui.</p>}
              {hasEmotionScores && <p className="text-xs text-muted-foreground"><span className="text-accent">●</span> Antes <span className="ml-3 text-moss">●</span> Depois</p>}
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="font-display font-semibold text-foreground">Armadilhas do pensamento mais frequentes</h3>
            {distortions.length ? (
              <div className="h-56 w-full" role="img" aria-label="Gráfico das armadilhas do pensamento mais frequentes">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distortions} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: axisColor, fontSize: 11 }} />
                    <YAxis type="category" dataKey="simple" width={135} tick={{ fill: axisColor, fontSize: 10 }} tickLine={false} />
                    <Tooltip contentStyle={chartTooltip} formatter={(value: number) => [value, "Registros"]} />
                    <Bar dataKey="count" name="Registros" fill="hsl(var(--moss))" radius={[0, 4, 4, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-sm text-muted-foreground">Nenhuma armadilha marcada ainda.</p>}
          </div>
          <div className="space-y-3">
            <h3 className="font-display font-semibold text-foreground">Meus registros ({records.length})</h3>
            <ul className="space-y-2">
              {records.map((row) => (
                <li key={row.id} className="min-w-0 rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">{format(new Date(row.created_at), "dd 'de' MMMM 'de' yyyy · HH:mm", { locale: ptBR })}</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium text-foreground">{row.situation || row.automatic_thought || "Registro de pensamentos"}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon" aria-label="Editar RPD" title="Editar RPD" onClick={() => startEdit(row)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label="Excluir RPD" title="Excluir RPD" onClick={() => setDeleteId(row.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  {row.automatic_thought && row.situation && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">Pensamento: {row.automatic_thought}</p>}
                  {row.rational_response && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">Outra perspectiva: {row.rational_response}</p>}
                  {(row.crenca_pensamento_inicial != null || row.crenca_pensamento_final != null) && <p className="mt-2 text-xs text-muted-foreground">Crença: {row.crenca_pensamento_inicial ?? "—"}% → {row.crenca_pensamento_final ?? "—"}%</p>}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={(next) => { if (!saving) setOpen(next); }}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto px-4 pb-28 pt-5 sm:px-6">
            <DialogHeader className="mb-5 pr-6">
              <DialogTitle className="font-display">{editingId ? "Editar meu RPD" : "Novo RPD"}</DialogTitle>
              <DialogDescription>Este registro é seu e não aparece no prontuário de nenhum paciente.</DialogDescription>
            </DialogHeader>
            <RpdForm value={form} onChange={setForm} accent="hsl(var(--moss))" />
          </div>
          <DialogFooter className="absolute bottom-0 inset-x-0 flex-row justify-end gap-2 border-t border-border bg-background p-4">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button variant="accent" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar RPD
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(next) => { if (!next) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este RPD?</AlertDialogTitle>
            <AlertDialogDescription>O registro será removido dos seus gráficos e não poderá ser recuperado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}