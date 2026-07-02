import { useEffect, useRef, useState } from "react";
import { Sparkles, RefreshCw, Loader2, AlertCircle, Check, Pencil, X, Trash2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface SummaryData {
  visao_geral: string;
  temas_recorrentes: string[];
  evolucao_percebida: string;
  intervencoes_estrategias: string[];
  pontos_acompanhamento: string[];
  pendencias_documentais: string[];
}

interface StoredSummary {
  id: string;
  summary_data: SummaryData;
  edited_content: SummaryData | null;
  status: "draft" | "approved" | "discarded";
  source_records: any;
  model_used: string | null;
  generated_at: string;
  approved_at: string | null;
}

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const AIClinicalSummary = ({ patientId }: { patientId: string }) => {
  const [summary, setSummary] = useState<StoredSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<SummaryData | null>(null);
  const triggered = useRef(false);

  const view: SummaryData | null = summary ? (summary.edited_content ?? summary.summary_data) : null;

  const invoke = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("generate-patient-summary", {
        body: { patient_id: patientId, force },
      });
      let bodyErr: string | null = null;
      let body: any = data;
      if (err) {
        try {
          const ctx: any = (err as any).context;
          if (ctx?.json) body = await ctx.json();
          else if (ctx?.text) body = JSON.parse(await ctx.text());
        } catch {}
        bodyErr = body?.error || err.message;
      } else if ((data as any)?.error) bodyErr = (data as any).error;

      if (bodyErr) {
        let friendly = bodyErr;
        if (/credit|402/i.test(bodyErr)) friendly = "Créditos de IA esgotados. Adicione créditos em Settings → Plans & credits.";
        else if (/429|limit/i.test(bodyErr)) friendly = "Limite de uso da IA atingido. Tente novamente em instantes.";
        setError(friendly);
        return;
      }
      setSummary(body.summary);
      setStale(!!body.stale);
      setNewCount(body.new_records ?? 0);
    } catch (e: any) {
      setError(e?.message || "Erro ao gerar resumo");
    } finally {
      setLoading(false);
    }
  };

  // 1) carrega cache imediatamente
  useEffect(() => {
    let cancel = false;
    (async () => {
      setInitialLoading(true);
      const { data } = await supabase
        .from("patient_ai_summaries")
        .select("*")
        .eq("patient_id", patientId)
        .maybeSingle();
      if (cancel) return;
      if (data) setSummary(data as any);
      setInitialLoading(false);

      // 2) em background, dispara função que só regenera se necessário
      if (!triggered.current) {
        triggered.current = true;
        invoke(false);
      }
    })();
    return () => { cancel = true; };
  }, [patientId]);

  const startEdit = () => { setDraft(view ? JSON.parse(JSON.stringify(view)) : null); setEditMode(true); };
  const cancelEdit = () => { setEditMode(false); setDraft(null); };

  const saveEdit = async () => {
    if (!summary || !draft) return;
    const { data, error: err } = await supabase
      .from("patient_ai_summaries")
      .update({ edited_content: draft as any })
      .eq("id", summary.id)
      .select()
      .single();
    if (err) { toast.error(err.message); return; }
    setSummary(data as any);
    setEditMode(false);
    toast.success("Edições salvas");
  };

  const approve = async () => {
    if (!summary) return;
    const { data: userData } = await supabase.auth.getUser();
    const { data, error: err } = await supabase
      .from("patient_ai_summaries")
      .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: userData.user?.id })
      .eq("id", summary.id)
      .select()
      .single();
    if (err) { toast.error(err.message); return; }
    setSummary(data as any);
    setStale(false);
    toast.success("Resumo aprovado");
  };

  const discard = async () => {
    if (!summary) return;
    if (!confirm("Descartar este resumo? Um novo poderá ser gerado.")) return;
    const { error: err } = await supabase.from("patient_ai_summaries").delete().eq("id", summary.id);
    if (err) { toast.error(err.message); return; }
    setSummary(null);
    setStale(false);
    toast.success("Resumo descartado");
  };

  const src = summary?.source_records ?? {};
  const nSess = Array.isArray(src.session_record_ids) ? src.session_record_ids.length : 0;
  const nProg = Array.isArray(src.progress_ids) ? src.progress_ids.length : 0;

  return (
    <div className="mt-6 rounded-2xl p-4" style={{ background: "hsl(var(--card))", border: "0.5px solid hsl(var(--border))" }}>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="h-4 w-4" style={{ color: "hsl(var(--primary))" }} />
          <p className="uppercase" style={{ fontFamily: "Syne, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em" }}>
            Resumo Clínico com IA
          </p>
          <span style={{ background: "rgba(192,57,43,0.1)", color: "#C0392B", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 40, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            ⚠ Gerado por IA — revise antes de usar
          </span>
          {summary?.status === "approved" && (
            <span style={{ background: "rgba(61,92,53,0.12)", color: "hsl(var(--moss))", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 40, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              ✓ Aprovado
            </span>
          )}
          {stale && (
            <span style={{ background: "rgba(184,134,11,0.14)", color: "#B8860B", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 40, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Desatualizado ({newCount} novos)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin" style={{ color: "hsl(var(--muted-foreground))" }} />}
          <Button size="sm" variant="outline" onClick={() => invoke(true)} disabled={loading} className="h-7 text-xs">
            <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
          </Button>
        </div>
      </div>

      {initialLoading && !summary && (
        <div className="flex items-center gap-2 text-xs" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "Instrument Sans, sans-serif" }}>
          <Loader2 className="h-3 w-3 animate-spin" /> Carregando resumo…
        </div>
      )}

      {!initialLoading && !summary && !loading && !error && (
        <p className="italic text-xs" style={{ fontFamily: "Instrument Sans, sans-serif", color: "hsl(var(--muted-foreground))" }}>
          Nenhum resumo gerado ainda. Clique em "Atualizar" para criar o primeiro.
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl p-3 mb-3" style={{ background: "rgba(192,57,43,0.08)", border: "0.5px solid rgba(192,57,43,0.25)" }}>
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#C0392B" }} />
          <p className="text-xs" style={{ fontFamily: "Instrument Sans, sans-serif", color: "#C0392B" }}>{error}</p>
        </div>
      )}

      {view && (
        <div className="space-y-3">
          <Section title="Visão Geral">
            {editMode ? (
              <Textarea value={draft?.visao_geral ?? ""} onChange={(e) => setDraft(d => d ? { ...d, visao_geral: e.target.value } : d)} className="text-sm min-h-20" />
            ) : <p>{view.visao_geral}</p>}
          </Section>

          <ListSection title="Temas Recorrentes" items={view.temas_recorrentes} editMode={editMode}
            onChange={(items) => setDraft(d => d ? { ...d, temas_recorrentes: items } : d)} />

          <Section title="Evolução Percebida">
            {editMode ? (
              <Textarea value={draft?.evolucao_percebida ?? ""} onChange={(e) => setDraft(d => d ? { ...d, evolucao_percebida: e.target.value } : d)} className="text-sm min-h-20" />
            ) : <p>{view.evolucao_percebida}</p>}
          </Section>

          <ListSection title="Intervenções e Estratégias Registradas" items={view.intervencoes_estrategias} editMode={editMode}
            onChange={(items) => setDraft(d => d ? { ...d, intervencoes_estrategias: items } : d)} />

          <ListSection title="Pontos para Acompanhamento" items={view.pontos_acompanhamento} editMode={editMode}
            onChange={(items) => setDraft(d => d ? { ...d, pontos_acompanhamento: items } : d)} />

          <ListSection title="Pendências Documentais" items={view.pendencias_documentais} editMode={editMode}
            onChange={(items) => setDraft(d => d ? { ...d, pendencias_documentais: items } : d)} />

          <div className="flex items-center justify-between gap-3 pt-3 mt-2 flex-wrap" style={{ borderTop: "0.5px solid hsl(var(--border))" }}>
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "Instrument Sans, sans-serif" }}>
              <Clock className="h-3 w-3" />
              Gerado em {fmt(summary!.generated_at)} • {nSess} sessão(ões), {nProg} registro(s) de progresso
            </div>
            <div className="flex items-center gap-2">
              {editMode ? (
                <>
                  <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-7 text-xs"><X className="h-3 w-3 mr-1" /> Cancelar</Button>
                  <Button size="sm" onClick={saveEdit} className="h-7 text-xs"><Check className="h-3 w-3 mr-1" /> Salvar edições</Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="ghost" onClick={discard} className="h-7 text-xs text-destructive"><Trash2 className="h-3 w-3 mr-1" /> Descartar</Button>
                  <Button size="sm" variant="outline" onClick={startEdit} className="h-7 text-xs"><Pencil className="h-3 w-3 mr-1" /> Editar</Button>
                  {summary?.status !== "approved" && (
                    <Button size="sm" onClick={approve} className="h-7 text-xs"><Check className="h-3 w-3 mr-1" /> Aprovar</Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <p className="mb-1" style={{ fontFamily: "Syne, sans-serif", fontSize: 12, fontWeight: 700, color: "hsl(var(--foreground))" }}>{title}</p>
    <div style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 12.5, color: "hsl(var(--brown))", lineHeight: 1.55 }}>{children}</div>
  </div>
);

const ListSection = ({ title, items, editMode, onChange }: { title: string; items: string[]; editMode: boolean; onChange: (items: string[]) => void }) => (
  <Section title={title}>
    {editMode ? (
      <Textarea
        value={items.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
        placeholder="Um item por linha"
        className="text-sm min-h-20"
      />
    ) : items.length ? (
      <ul className="list-disc pl-5 space-y-0.5">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    ) : (
      <p className="italic" style={{ color: "hsl(var(--muted-foreground))" }}>informação não disponível</p>
    )}
  </Section>
);
