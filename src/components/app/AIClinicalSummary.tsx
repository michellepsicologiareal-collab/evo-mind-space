import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles, RefreshCw, Loader2, AlertCircle, Check, Pencil, X, Trash2, Clock,
  GitCompare, History, ChevronDown, ChevronUp, ArrowUpCircle, FileWarning, FileDown,
} from "lucide-react";
import jsPDF from "jspdf";
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
  approved_by: string | null;
  last_approved_data: SummaryData | null;
  last_approved_at: string | null;
  last_approved_by: string | null;
  pending_draft_data: SummaryData | null;
  pending_draft_generated_at: string | null;
  pending_draft_source_records: any;
  pending_draft_model: string | null;
  pending_draft_tokens: number | null;
}

interface AuditEvent {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor_id: string;
  actor_name?: string | null;
  note: string | null;
  reason: string | null;
  source_records: any;
  created_at: string;
}

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// --- diff helpers ---------------------------------------------------------
type LineDiff = { type: "same" | "add" | "del"; text: string };
function diffLines(oldStr: string, newStr: string): LineDiff[] {
  const a = (oldStr || "").split("\n");
  const b = (newStr || "").split("\n");
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: LineDiff[] = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { out.push({ type: "same", text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: "del", text: a[i] }); i++; }
    else { out.push({ type: "add", text: b[j] }); j++; }
  }
  while (i < m) { out.push({ type: "del", text: a[i++] }); }
  while (j < n) { out.push({ type: "add", text: b[j++] }); }
  return out;
}

const sectionsMeta: { key: keyof SummaryData; title: string; kind: "text" | "list" }[] = [
  { key: "visao_geral", title: "Visão Geral", kind: "text" },
  { key: "temas_recorrentes", title: "Temas Recorrentes", kind: "list" },
  { key: "evolucao_percebida", title: "Evolução Percebida", kind: "text" },
  { key: "intervencoes_estrategias", title: "Intervenções e Estratégias Registradas", kind: "list" },
  { key: "pontos_acompanhamento", title: "Pontos para Acompanhamento", kind: "list" },
  { key: "pendencias_documentais", title: "Pendências Documentais", kind: "list" },
];

const toText = (v: any) => Array.isArray(v) ? v.join("\n") : (v ?? "");

const EVENT_LABEL: Record<string, string> = {
  generated: "Resumo gerado",
  regenerated: "Resumo regenerado",
  edited: "Edições salvas",
  approved: "Aprovado",
  discarded: "Descartado",
  pending_created: "Novo rascunho gerado",
  pending_promoted: "Rascunho promovido a aprovado",
  pending_discarded: "Rascunho descartado",
};

const StatusPill = ({ status }: { status: StoredSummary["status"] }) => {
  const cfg = status === "approved"
    ? { bg: "rgba(61,92,53,0.14)", fg: "hsl(var(--moss))", label: "✓ Aprovado" }
    : status === "discarded"
      ? { bg: "rgba(120,120,120,0.15)", fg: "hsl(var(--muted-foreground))", label: "Descartado" }
      : { bg: "rgba(184,134,11,0.14)", fg: "#B8860B", label: "Rascunho" };
  return (
    <span style={{ background: cfg.bg, color: cfg.fg, fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 40, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {cfg.label}
    </span>
  );
};

// --------------------------------------------------------------------------

export const AIClinicalSummary = ({ patientId }: { patientId: string }) => {
  const [summary, setSummary] = useState<StoredSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [viewPending, setViewPending] = useState(false); // toggle to view pending draft content
  const [showAudit, setShowAudit] = useState(false);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [draft, setDraft] = useState<SummaryData | null>(null);
  const triggered = useRef(false);

  const approved: SummaryData | null = summary ? (summary.edited_content ?? summary.summary_data) : null;
  const pending: SummaryData | null = summary?.pending_draft_data ?? null;
  const hasPending = !!pending && summary?.status === "approved";

  // O que está sendo exibido/editado
  const view: SummaryData | null = hasPending && viewPending ? pending : approved;
  const current: SummaryData | null = editMode ? draft : view;

  // Base do diff: quando há pending mostramos aprovado vs pending; senão, snapshot vs current
  const diffBase: SummaryData | null = hasPending
    ? approved
    : (summary?.last_approved_data ?? null);
  const diffTarget: SummaryData | null = hasPending ? pending : current;
  const canDiff = !!diffBase && !!diffTarget;

  const diffChangedCount = useMemo(() => {
    if (!canDiff) return 0;
    return sectionsMeta.reduce((n, s) => {
      const oldT = toText((diffBase as any)[s.key]);
      const newT = toText((diffTarget as any)[s.key]);
      return n + (oldT === newT ? 0 : 1);
    }, 0);
  }, [canDiff, diffBase, diffTarget]);

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
      if (body.pending_created) {
        toast.success("Novo rascunho gerado. O conteúdo aprovado foi preservado.");
        setViewPending(true);
      }
    } catch (e: any) {
      setError(e?.message || "Erro ao gerar resumo");
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    const { data } = await (supabase as any)
      .from("patient_ai_summaries")
      .select("*")
      .eq("patient_id", patientId)
      .maybeSingle();
    if (data) setSummary(data as any);
    return data;
  };

  const loadAudit = async () => {
    if (!summary) return;
    setAuditLoading(true);
    const { data } = await (supabase as any)
      .from("patient_ai_summary_events")
      .select("id, event_type, from_status, to_status, actor_id, note, reason, source_records, created_at")
      .eq("summary_id", summary.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setAudit((data as any) || []);
    setAuditLoading(false);
  };

  const annotateReason = async (reason: string) => {
    if (!summary) return;
    const { error: rpcErr } = await (supabase as any).rpc("set_ai_summary_event_reason", { _summary_id: summary.id, _reason: reason });
    if (rpcErr) console.warn("annotate reason:", rpcErr.message);
  };

  useEffect(() => {
    let cancel = false;
    (async () => {
      setInitialLoading(true);
      await loadSummary();
      if (cancel) return;
      setInitialLoading(false);
      if (!triggered.current) {
        triggered.current = true;
        invoke(false);
      }
    })();
    return () => { cancel = true; };
  }, [patientId]);

  useEffect(() => { if (showAudit) loadAudit(); /* eslint-disable-next-line */ }, [showAudit, summary?.id]);

  const startEdit = () => { setDraft(view ? JSON.parse(JSON.stringify(view)) : null); setEditMode(true); };
  const cancelEdit = () => { setEditMode(false); setDraft(null); };

  const saveEdit = async () => {
    if (!summary || !draft) return;
    // Só edita o conteúdo aprovado; edições no rascunho pendente são feitas via "promover" depois.
    if (hasPending && viewPending) {
      // Salvar edições no rascunho pendente
      const { data, error: err } = await (supabase as any)
        .from("patient_ai_summaries")
        .update({ pending_draft_data: draft as any })
        .eq("id", summary.id)
        .select()
        .single();
      if (err) { toast.error(err.message); return; }
      setSummary(data as any);
      setEditMode(false);
      await annotateReason("Edições manuais no rascunho pendente");
      toast.success("Edições no rascunho salvas");
      return;
    }
    const { data, error: err } = await (supabase as any)
      .from("patient_ai_summaries")
      .update({ edited_content: draft as any })
      .eq("id", summary.id)
      .select()
      .single();
    if (err) { toast.error(err.message); return; }
    setSummary(data as any);
    setEditMode(false);
    await annotateReason("Edições manuais no conteúdo aprovado/rascunho");
    toast.success("Edições salvas");
  };

  const approve = async () => {
    if (!summary) return;
    const { data: userData } = await supabase.auth.getUser();
    const { data, error: err } = await (supabase as any)
      .from("patient_ai_summaries")
      .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: userData.user?.id })
      .eq("id", summary.id)
      .select()
      .single();
    if (err) { toast.error(err.message); return; }
    setSummary(data as any);
    setStale(false);
    await annotateReason("Aprovação manual pelo profissional");
    toast.success("Resumo aprovado");
  };

  const promotePending = async () => {
    if (!summary || !summary.pending_draft_data) return;
    if (!confirm("Promover o rascunho pendente? Ele substituirá o conteúdo aprovado atual (um snapshot da versão atual será mantido).")) return;
    const { data: userData } = await supabase.auth.getUser();
    const { data, error: err } = await (supabase as any)
      .from("patient_ai_summaries")
      .update({
        summary_data: summary.pending_draft_data as any,
        edited_content: null,
        source_records: summary.pending_draft_source_records,
        model_used: summary.pending_draft_model,
        tokens_used: summary.pending_draft_tokens,
        generated_at: summary.pending_draft_generated_at,
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: userData.user?.id,
        pending_draft_data: null,
        pending_draft_generated_at: null,
        pending_draft_source_records: null,
        pending_draft_model: null,
        pending_draft_tokens: null,
      })
      .eq("id", summary.id)
      .select()
      .single();
    if (err) { toast.error(err.message); return; }
    setSummary(data as any);
    setViewPending(false);
    setStale(false);
    await annotateReason("Rascunho pendente promovido a aprovado");
    toast.success("Rascunho promovido");
  };

  const discardPending = async () => {
    if (!summary) return;
    if (!confirm("Descartar o rascunho pendente? O conteúdo aprovado permanece intocado.")) return;
    const { data, error: err } = await (supabase as any)
      .from("patient_ai_summaries")
      .update({
        pending_draft_data: null,
        pending_draft_generated_at: null,
        pending_draft_source_records: null,
        pending_draft_model: null,
        pending_draft_tokens: null,
      })
      .eq("id", summary.id)
      .select()
      .single();
    if (err) { toast.error(err.message); return; }
    setSummary(data as any);
    setViewPending(false);
    await annotateReason("Rascunho pendente descartado");
    toast.success("Rascunho descartado");
  };

  const discard = async () => {
    if (!summary) return;
    if (!confirm("Descartar este resumo? O histórico permanece registrado; você poderá gerar um novo depois.")) return;
    const { data, error: err } = await (supabase as any)
      .from("patient_ai_summaries")
      .update({ status: "discarded" })
      .eq("id", summary.id)
      .select()
      .single();
    if (err) { toast.error(err.message); return; }
    setSummary(data as any);
    setStale(false);
    await annotateReason("Resumo descartado manualmente");
    toast.success("Resumo descartado");
  };

  const exportPdf = async () => {
    if (!summary) return;
    const data: SummaryData | null = summary.edited_content ?? summary.summary_data;
    if (!data) { toast.error("Nada para exportar"); return; }
    if (summary.status !== "approved") {
      if (!confirm("Este resumo ainda não foi aprovado. Deseja exportar mesmo assim?")) return;
    }
    // Busca nome do paciente para o cabeçalho do PDF
    const { data: pat } = await (supabase as any)
      .from("patients")
      .select("full_name, birth_date")
      .eq("id", patientId)
      .maybeSingle();
    const patientName = pat?.full_name || "Paciente";
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 48;
    const maxW = pageW - margin * 2;
    let y = margin;
    const ensure = (h: number) => { if (y + h > pageH - margin) { doc.addPage(); y = margin; } };
    const writeParagraph = (text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number } = {}) => {
      const size = opts.size ?? 11;
      doc.setFont("helvetica", opts.bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.setTextColor(...(opts.color ?? [30, 30, 30]));
      const lines = doc.splitTextToSize(text || "—", maxW);
      lines.forEach((ln: string) => {
        ensure(size + 4);
        doc.text(ln, margin, y);
        y += size + 4;
      });
      y += opts.gap ?? 4;
    };
    const writeSectionTitle = (t: string) => {
      ensure(22);
      y += 6;
      writeParagraph(t, { size: 12, bold: true, color: [80, 60, 130], gap: 2 });
      doc.setDrawColor(200, 200, 210);
      doc.line(margin, y - 4, pageW - margin, y - 4);
      y += 2;
    };
    const writeList = (items: string[]) => {
      if (!items || items.length === 0) { writeParagraph("informação não disponível", { color: [140, 140, 140] }); return; }
      items.forEach((it) => writeParagraph("• " + it, { size: 11 }));
    };

    // Cabeçalho
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(50, 40, 100);
    doc.text("Resumo Clínico com IA", margin, y); y += 20;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(90, 90, 90);
    doc.text(`Paciente: ${patientName}`, margin, y); y += 14;
    const status = summary.status === "approved" ? "Aprovado" : summary.status === "discarded" ? "Descartado" : "Rascunho";
    const genAt = new Date(summary.generated_at).toLocaleString("pt-BR");
    const apprAt = summary.approved_at ? new Date(summary.approved_at).toLocaleString("pt-BR") : "—";
    doc.text(`Status: ${status}  •  Gerado em: ${genAt}  •  Aprovado em: ${apprAt}`, margin, y); y += 12;
    doc.text(`Exportado em: ${new Date().toLocaleString("pt-BR")}`, margin, y); y += 8;
    doc.setDrawColor(180, 180, 190);
    doc.line(margin, y, pageW - margin, y); y += 10;
    doc.setFontSize(9);
    doc.setTextColor(160, 60, 50);
    const disc = doc.splitTextToSize("Conteúdo gerado por IA a partir de registros clínicos do prontuário. Revisado e aprovado pelo profissional responsável. Não substitui o julgamento clínico.", maxW);
    disc.forEach((ln: string) => { ensure(12); doc.text(ln, margin, y); y += 12; });
    y += 4;

    writeSectionTitle("Visão Geral"); writeParagraph(data.visao_geral);
    writeSectionTitle("Temas Recorrentes"); writeList(data.temas_recorrentes);
    writeSectionTitle("Evolução Percebida"); writeParagraph(data.evolucao_percebida);
    writeSectionTitle("Intervenções e Estratégias Registradas"); writeList(data.intervencoes_estrategias);
    writeSectionTitle("Pontos para Acompanhamento"); writeList(data.pontos_acompanhamento);
    writeSectionTitle("Pendências Documentais"); writeList(data.pendencias_documentais);

    // Rodapé com numeração
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${i} de ${total}`, pageW - margin, pageH - 20, { align: "right" });
      doc.text("Psi Real — Resumo Clínico com IA", margin, pageH - 20);
    }

    const safeName = patientName.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 40);
    doc.save(`resumo-clinico_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
    await annotateReason("Resumo aprovado exportado em PDF");
    toast.success("PDF exportado");
  };


  const src = (hasPending && viewPending ? summary?.pending_draft_source_records : summary?.source_records) ?? {};
  const nSess = Array.isArray(src.session_record_ids) ? src.session_record_ids.length : 0;
  const nProg = Array.isArray(src.progress_ids) ? src.progress_ids.length : 0;
  const shownGeneratedAt = hasPending && viewPending
    ? summary?.pending_draft_generated_at
    : summary?.generated_at;

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
          {summary && <StatusPill status={summary.status} />}
          {hasPending && (
            <span style={{ background: "rgba(150,117,206,0.14)", color: "hsl(var(--primary))", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 40, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Rascunho pendente
            </span>
          )}
          {stale && !hasPending && (
            <span style={{ background: "rgba(184,134,11,0.14)", color: "#B8860B", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 40, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Desatualizado ({newCount} novos)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin" style={{ color: "hsl(var(--muted-foreground))" }} />}
          {canDiff && (
            <Button size="sm" variant={showDiff ? "default" : "outline"} onClick={() => setShowDiff(v => !v)} className="h-7 text-xs">
              <GitCompare className="h-3 w-3 mr-1" />
              {showDiff ? "Ocultar diferenças" : `Comparar${diffChangedCount ? ` (${diffChangedCount})` : ""}`}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowAudit(v => !v)} className="h-7 text-xs">
            <History className="h-3 w-3 mr-1" /> Histórico
            {showAudit ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
          </Button>
          <Button size="sm" variant="outline" onClick={() => invoke(true)} disabled={loading} className="h-7 text-xs">
            <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
          </Button>
          {summary && summary.status === "approved" && (
            <Button size="sm" onClick={exportPdf} className="h-7 text-xs" title="Exportar resumo aprovado em PDF para anexar ao prontuário">
              <FileDown className="h-3 w-3 mr-1" /> Exportar PDF
            </Button>
          )}

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

      {/* Banner de rascunho pendente */}
      {hasPending && (
        <div className="mb-3 rounded-xl p-3 flex items-start gap-3 flex-wrap" style={{ background: "rgba(150,117,206,0.08)", border: "0.5px solid rgba(150,117,206,0.3)" }}>
          <FileWarning className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "hsl(var(--primary))" }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ fontFamily: "Syne, sans-serif", color: "hsl(var(--foreground))" }}>
              Existe um rascunho pendente gerado {summary?.pending_draft_generated_at ? `em ${fmt(summary.pending_draft_generated_at)}` : ""}
            </p>
            <p className="text-[11px] mt-0.5" style={{ fontFamily: "Instrument Sans, sans-serif", color: "hsl(var(--muted-foreground))" }}>
              O conteúdo aprovado permanece ativo. Compare, promova para substituir ou descarte.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setViewPending(v => !v)} className="h-7 text-xs">
              {viewPending ? "Ver aprovado" : "Ver rascunho"}
            </Button>
            <Button size="sm" variant="ghost" onClick={discardPending} className="h-7 text-xs text-destructive">
              <Trash2 className="h-3 w-3 mr-1" /> Descartar rascunho
            </Button>
            <Button size="sm" onClick={promotePending} className="h-7 text-xs">
              <ArrowUpCircle className="h-3 w-3 mr-1" /> Promover
            </Button>
          </div>
        </div>
      )}

      {/* Diff */}
      {showDiff && canDiff && (
        <div className="mb-4 rounded-xl p-3" style={{ background: "hsl(var(--muted) / 0.35)", border: "0.5px solid hsl(var(--border))" }}>
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <p className="uppercase" style={{ fontFamily: "Syne, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em" }}>
              {hasPending ? "Aprovado vs. rascunho pendente" : "Diferenças vs. última aprovação"}
            </p>
            {!hasPending && summary?.last_approved_at && (
              <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "Instrument Sans, sans-serif" }}>
                Aprovado em {fmt(summary.last_approved_at)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mb-3 text-[10px]" style={{ fontFamily: "Instrument Sans, sans-serif", color: "hsl(var(--muted-foreground))" }}>
            <span className="inline-flex items-center gap-1">
              <span style={{ width: 10, height: 10, background: "rgba(192,57,43,0.18)", border: "0.5px solid rgba(192,57,43,0.4)", borderRadius: 2 }} /> Removido
            </span>
            <span className="inline-flex items-center gap-1">
              <span style={{ width: 10, height: 10, background: "rgba(61,92,53,0.18)", border: "0.5px solid rgba(61,92,53,0.4)", borderRadius: 2 }} /> Adicionado
            </span>
          </div>
          <div className="space-y-3">
            {sectionsMeta.map(s => {
              const oldT = toText((diffBase as any)[s.key]);
              const newT = toText((diffTarget as any)[s.key]);
              const unchanged = oldT === newT;
              return (
                <div key={s.key}>
                  <p className="mb-1 flex items-center gap-2" style={{ fontFamily: "Syne, sans-serif", fontSize: 11, fontWeight: 700 }}>
                    {s.title}
                    {unchanged && <span className="text-[9px] uppercase" style={{ color: "hsl(var(--muted-foreground))", letterSpacing: "0.06em" }}>sem alterações</span>}
                  </p>
                  {!unchanged && (
                    <div className="rounded-md overflow-hidden" style={{ border: "0.5px solid hsl(var(--border))", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11.5 }}>
                      {diffLines(oldT, newT).map((ln, i) => (
                        <div key={i} className="px-2 py-0.5 whitespace-pre-wrap break-words"
                          style={{
                            background: ln.type === "add" ? "rgba(61,92,53,0.10)" : ln.type === "del" ? "rgba(192,57,43,0.10)" : "transparent",
                            color: ln.type === "add" ? "hsl(var(--moss))" : ln.type === "del" ? "#C0392B" : "hsl(var(--brown))",
                            textDecoration: ln.type === "del" ? "line-through" : "none",
                          }}>
                          <span style={{ opacity: 0.5, marginRight: 6 }}>{ln.type === "add" ? "+" : ln.type === "del" ? "−" : " "}</span>
                          {ln.text || "\u00A0"}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Audit log */}
      {showAudit && (
        <div className="mb-4 rounded-xl p-3" style={{ background: "hsl(var(--muted) / 0.35)", border: "0.5px solid hsl(var(--border))" }}>
          <p className="uppercase mb-2" style={{ fontFamily: "Syne, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em" }}>
            Trilha de auditoria
          </p>
          {auditLoading ? (
            <div className="flex items-center gap-2 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando…
            </div>
          ) : audit.length === 0 ? (
            <p className="italic text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>Nenhum evento registrado.</p>
          ) : (
            <ul className="space-y-2" style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 12 }}>
              {audit.map(ev => {
                const sr = ev.source_records || {};
                const nS = Array.isArray(sr.session_record_ids) ? sr.session_record_ids.length : 0;
                const nP = Array.isArray(sr.progress_ids) ? sr.progress_ids.length : 0;
                const hasSrc = ev.source_records != null;
                return (
                  <li key={ev.id} className="rounded-md px-2 py-1.5" style={{ background: "hsl(var(--card))", border: "0.5px solid hsl(var(--border))" }}>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[10px] shrink-0" style={{ color: "hsl(var(--muted-foreground))", fontFamily: "ui-monospace, monospace" }}>
                        {fmt(ev.created_at)}
                      </span>
                      <span style={{ color: "hsl(var(--foreground))", fontWeight: 600 }}>
                        {EVENT_LABEL[ev.event_type] ?? ev.event_type}
                      </span>
                      {ev.from_status && ev.to_status && ev.from_status !== ev.to_status && (
                        <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                          {ev.from_status} → {ev.to_status}
                        </span>
                      )}
                      <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                        por {ev.actor_id?.slice(0, 8)}
                      </span>
                    </div>
                    {ev.reason && (
                      <p className="text-[11px] mt-0.5" style={{ color: "hsl(var(--brown))" }}>
                        <span className="uppercase text-[9px] mr-1" style={{ color: "hsl(var(--muted-foreground))", letterSpacing: "0.06em" }}>Motivo:</span>
                        {ev.reason}
                      </p>
                    )}
                    {hasSrc && (
                      <p className="text-[10px] mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
                        Registros considerados: {nS} sessão(ões), {nP} progresso(s)
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {view && (
        <div className="space-y-3">
          {hasPending && viewPending && (
            <div className="rounded-md px-2 py-1.5 text-[11px]" style={{ background: "rgba(150,117,206,0.08)", color: "hsl(var(--primary))", fontFamily: "Instrument Sans, sans-serif" }}>
              Você está visualizando o <strong>rascunho pendente</strong>. Ele não substitui o aprovado até ser promovido.
            </div>
          )}

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
              Gerado em {shownGeneratedAt ? fmt(shownGeneratedAt) : "-"} • {nSess} sessão(ões), {nProg} registro(s) de progresso
            </div>
            <div className="flex items-center gap-2">
              {editMode ? (
                <>
                  <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-7 text-xs"><X className="h-3 w-3 mr-1" /> Cancelar</Button>
                  <Button size="sm" onClick={saveEdit} className="h-7 text-xs"><Check className="h-3 w-3 mr-1" /> Salvar edições</Button>
                </>
              ) : (
                <>
                  {summary?.status !== "discarded" && (
                    <Button size="sm" variant="ghost" onClick={discard} className="h-7 text-xs text-destructive"><Trash2 className="h-3 w-3 mr-1" /> Descartar</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={startEdit} className="h-7 text-xs"><Pencil className="h-3 w-3 mr-1" /> Editar</Button>
                  {summary?.status !== "approved" && !hasPending && (
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
