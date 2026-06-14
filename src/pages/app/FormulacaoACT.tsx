import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Loader2, Save, Sparkles, ArrowLeft, FileDown, Check, Copy, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import ReactMarkdown from "react-markdown";
import { PageIntro } from "@/components/app/PageIntro";

// Palette ACT
const GREEN = "#2D6A4F";
const GREEN_BG = "#EAF3DE";
const GREEN_BORDER = "#74C69D";
const RED_BG = "#FDECEA";
const YELLOW_BG = "#FDF6E3";
const PURPLE = "#534AB7";
const PURPLE_BG = "#EEEDFE";
const LILAC_BORDER = "#AFA9EC";
const INK = "#1A1A2E";
const MUTED = "#6B7280";
const BG = "#F7F6F3";

const PROCESSOS: { key: string; inflex: string; inflexDesc: string; flex: string; flexDesc: string }[] = [
  { key: "fusao_desfusao", inflex: "Fusão Cognitiva", inflexDesc: "Pensamentos tratados como fatos absolutos", flex: "Desfusão Cognitiva", flexDesc: "Observar pensamentos sem ser controlado por eles" },
  { key: "evitacao_aceitacao", inflex: "Evitação Experiencial", inflexDesc: "Fuga de emoções, sensações e memórias", flex: "Aceitação", flexDesc: "Abertura às experiências internas sem luta" },
  { key: "tempo_presente", inflex: "Dominância Passado/Futuro", inflexDesc: "Preso em ruminação ou preocupação", flex: "Momento Presente", flexDesc: "Contato flexível com o aqui e agora" },
  { key: "eu_conteudo_contexto", inflex: "Eu como Conteúdo", inflexDesc: "Identificação com narrativas e rótulos", flex: "Eu como Contexto", flexDesc: "Perspectiva do observador — eu que nota" },
  { key: "valores", inflex: "Falta de Clareza de Valores", inflexDesc: "Desconexão do que realmente importa", flex: "Valores Clarificados", flexDesc: "Direções de vida escolhidas livremente" },
  { key: "acao_comprometida", inflex: "Inação/Evitação Persistente", inflexDesc: "Comportamento dominado por regras e esquiva", flex: "Ação Comprometida", flexDesc: "Passos concretos na direção dos valores" },
];

const DOMINIOS_VALORES = [
  "Família e relacionamentos íntimos",
  "Amizades e vida social",
  "Trabalho e carreira",
  "Saúde e autocuidado",
  "Espiritualidade e crescimento pessoal",
  "Lazer e criatividade",
  "Cidadania e comunidade",
];

type HexaflexItem = { score: number | null; observacao: string; lado: "inflexibilidade" | "flexibilidade" };
type ValorItem = { dominio: string; valor_declarado: string; acoes_alinhadas: string; barreiras: string; alinhamento: "" | "baixo" | "medio" | "alto" };

type FormState = {
  apresentacao_problema: { queixa_act: string; o_que_evita: string; custo_controle: string };
  hexaflex: Record<string, HexaflexItem>;
  valores: ValorItem[];
  matriz_act: { q1_experiencia_interna: string; q2_comportamento_afastamento: string; q3_valores: string; q4_acao_comprometida: string };
  barreiras_geradas: string;
  direcionamento_gerado: string;
  observacoes_terapeuta: string;
};

const EMPTY: FormState = {
  apresentacao_problema: { queixa_act: "", o_que_evita: "", custo_controle: "" },
  hexaflex: Object.fromEntries(PROCESSOS.map((p) => [p.key, { score: null, observacao: "", lado: "flexibilidade" } as HexaflexItem])),
  valores: DOMINIOS_VALORES.map((d) => ({ dominio: d, valor_declarado: "", acoes_alinhadas: "", barreiras: "", alinhamento: "" })),
  matriz_act: { q1_experiencia_interna: "", q2_comportamento_afastamento: "", q3_valores: "", q4_acao_comprometida: "" },
  barreiras_geradas: "",
  direcionamento_gerado: "",
  observacoes_terapeuta: "",
};

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <section
    className={`bg-white rounded-[10px] p-5 sm:p-6 space-y-4 ${className}`}
    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderLeft: `3px solid ${GREEN}` }}
  >
    {children}
  </section>
);

const BlockHeader = ({ kicker, title, subtitle }: { kicker: string; title: string; subtitle?: string }) => (
  <header className="space-y-1">
    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: GREEN, textTransform: "uppercase" }}>{kicker}</p>
    <h2 className="font-display" style={{ fontSize: 15, fontWeight: 700, color: INK }}>{title}</h2>
    {subtitle && <p style={{ fontSize: 12, color: MUTED }}>{subtitle}</p>}
  </header>
);

const ScoreCircles = ({
  value, onChange, color,
}: { value: number | null; onChange: (n: number) => void; color: string }) => (
  <div className="flex items-center gap-1.5">
    {[1, 2, 3, 4, 5].map((n) => {
      const on = value === n;
      return (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`Score ${n}`}
          style={{
            width: 26, height: 26, borderRadius: "50%",
            border: `1.5px solid ${on ? color : "#D1D5DB"}`,
            background: on ? color : "#fff",
            color: on ? "#fff" : MUTED,
            fontSize: 11, fontWeight: 700,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          {n}
        </button>
      );
    })}
  </div>
);

export default function FormulacaoACT() {
  const { id: patientId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [genBarreiras, setGenBarreiras] = useState(false);
  const [genDirec, setGenDirec] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [therapistName, setTherapistName] = useState("");
  const [crp, setCrp] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const lastSavedSnapshot = useRef<string>("");

  useEffect(() => {
    if (!user || !patientId) return;
    (async () => {
      setLoading(true);
      const [{ data: p }, { data: prof }, { data: existing }] = await Promise.all([
        supabase.from("patients").select("full_name").eq("id", patientId).maybeSingle(),
        supabase.from("profiles").select("full_name, crp").eq("id", user.id).maybeSingle(),
        (supabase as any).from("act_formulations").select("*").eq("patient_id", patientId).eq("therapist_id", user.id).maybeSingle(),
      ]);
      if (p) setPatientName(p.full_name);
      if (prof) { setTherapistName(prof.full_name || ""); setCrp(prof.crp || ""); }
      if (existing) {
        setRecordId(existing.id);
        const loaded: FormState = {
          apresentacao_problema: { ...EMPTY.apresentacao_problema, ...(existing.apresentacao_problema || {}) },
          hexaflex: { ...EMPTY.hexaflex, ...(existing.hexaflex || {}) },
          valores: Array.isArray(existing.valores) && existing.valores.length
            ? DOMINIOS_VALORES.map((d) => existing.valores.find((v: any) => v.dominio === d) || { dominio: d, valor_declarado: "", acoes_alinhadas: "", barreiras: "", alinhamento: "" })
            : EMPTY.valores,
          matriz_act: { ...EMPTY.matriz_act, ...(existing.matriz_act || {}) },
          barreiras_geradas: existing.barreiras_geradas ?? "",
          direcionamento_gerado: existing.direcionamento_gerado ?? "",
          observacoes_terapeuta: existing.observacoes_terapeuta ?? "",
        };
        setForm(loaded);
        lastSavedSnapshot.current = JSON.stringify(loaded);
        if (existing.updated_at) setSavedAt(new Date(existing.updated_at));
      }
      setLoading(false);
    })();
  }, [user, patientId]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const updateHex = (key: string, patch: Partial<HexaflexItem>) =>
    update("hexaflex", { ...form.hexaflex, [key]: { ...form.hexaflex[key], ...patch } });

  const updateValor = (idx: number, patch: Partial<ValorItem>) =>
    update("valores", form.valores.map((v, i) => i === idx ? { ...v, ...patch } : v));

  const save = useCallback(async (silent = false) => {
    if (!user || !patientId) return;
    const snapshot = JSON.stringify(form);
    if (snapshot === lastSavedSnapshot.current) return;
    setSaving(true);
    try {
      const payload: any = { patient_id: patientId, therapist_id: user.id, ...form };
      const { data, error } = await (supabase as any).from("act_formulations")
        .upsert(payload, { onConflict: "patient_id,therapist_id" })
        .select("id, updated_at")
        .maybeSingle();
      if (error) throw error;
      if (data?.id) setRecordId(data.id);
      if (data?.updated_at) setSavedAt(new Date(data.updated_at));
      lastSavedSnapshot.current = snapshot;
      if (!silent) toast.success("Formulação ACT salva.");
    } catch (e: any) {
      console.error(e);
      if (!silent) toast.error("Erro ao salvar formulação.");
    } finally { setSaving(false); }
  }, [form, user, patientId]);

  // Autosave a cada 10s + ao ocultar a aba + ao desmontar
  useEffect(() => {
    const t = setInterval(() => { save(true); }, 10000);
    const onHide = () => { if (document.visibilityState === "hidden") save(true); };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onHide);
      save(true);
    };
  }, [save]);

  const podeBarreiras = useMemo(() => {
    const algumScore = Object.values(form.hexaflex).some((h) => typeof h.score === "number");
    const algumValor = form.valores.some((v) => v.valor_declarado.trim() || v.barreiras.trim());
    return algumScore && algumValor;
  }, [form]);

  const gerarBarreiras = async () => {
    if (!podeBarreiras || !patientId) return;
    setGenBarreiras(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-act-formulation", {
        body: { patient_id: patientId, modo: "barreiras", ...form },
      });
      if (error) throw error;
      const txt = (data as any)?.result ?? "";
      if (!txt) { toast.error((data as any)?.error || "Falha ao gerar."); return; }
      update("barreiras_geradas", txt);
      await save(true);
      toast.success("Barreiras geradas.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar com IA.");
    } finally { setGenBarreiras(false); }
  };

  const gerarDirecionamento = async () => {
    if (!form.barreiras_geradas || !patientId) return;
    setGenDirec(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-act-formulation", {
        body: { patient_id: patientId, modo: "direcionamento", ...form, barreiras_existentes: form.barreiras_geradas },
      });
      if (error) throw error;
      const txt = (data as any)?.result ?? "";
      if (!txt) { toast.error((data as any)?.error || "Falha ao gerar."); return; }
      update("direcionamento_gerado", txt);
      await save(true);
      toast.success("Direcionamento gerado.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar com IA.");
    } finally { setGenDirec(false); }
  };

  const copiar = (txt: string) => { navigator.clipboard.writeText(txt); toast.success("Copiado."); };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const M = 40;
    let y = M;
    const line = (s: string, size = 11, bold = false, color: [number, number, number] = [26, 26, 46]) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.setTextColor(color[0], color[1], color[2]);
      const wrapped = doc.splitTextToSize(s, W - 2 * M);
      wrapped.forEach((ln: string) => {
        if (y > 800) { doc.addPage(); y = M; }
        doc.text(ln, M, y);
        y += size + 4;
      });
    };
    const section = (title: string) => { y += 6; line(title, 12, true, [45, 106, 79]); y += 2; };

    line("Formulação ACT — Terapia de Aceitação e Compromisso", 16, true, [45, 106, 79]);
    line(`Paciente: ${patientName}`, 11, true);
    line(`Data: ${new Date().toLocaleDateString("pt-BR")}`, 10, false, [107, 114, 128]);
    y += 4;

    section("Apresentação do Problema");
    if (form.apresentacao_problema.queixa_act) { line("Queixa em linguagem ACT:", 10, true); line(form.apresentacao_problema.queixa_act); }
    if (form.apresentacao_problema.o_que_evita) { line("O que evita/controla:", 10, true); line(form.apresentacao_problema.o_que_evita); }
    if (form.apresentacao_problema.custo_controle) { line("Custo do controle:", 10, true); line(form.apresentacao_problema.custo_controle); }

    section("Hexaflex — 6 Processos");
    PROCESSOS.forEach((p) => {
      const h = form.hexaflex[p.key];
      const polo = h?.lado === "inflexibilidade" ? p.inflex : p.flex;
      line(`• ${polo} — score ${h?.score ?? "-"}/5`, 10, true);
      if (h?.observacao) line(h.observacao);
    });

    section("Valores por Domínio");
    form.valores.forEach((v) => {
      if (!v.valor_declarado && !v.acoes_alinhadas && !v.barreiras) return;
      line(`• ${v.dominio}${v.alinhamento ? ` — alinhamento ${v.alinhamento}` : ""}`, 10, true);
      if (v.valor_declarado) line(`Valor: ${v.valor_declarado}`);
      if (v.acoes_alinhadas) line(`Ações: ${v.acoes_alinhadas}`);
      if (v.barreiras) line(`Barreiras: ${v.barreiras}`);
    });

    section("Matriz ACT");
    line("Q1 · O que aparece dentro e dificulta:", 10, true); line(form.matriz_act.q1_experiencia_interna || "-");
    line("Q2 · O que faz para se afastar:", 10, true); line(form.matriz_act.q2_comportamento_afastamento || "-");
    line("Q3 · Quem/o que importa:", 10, true); line(form.matriz_act.q3_valores || "-");
    line("Q4 · O que faria se não estivesse preso:", 10, true); line(form.matriz_act.q4_acao_comprometida || "-");

    if (form.barreiras_geradas) {
      section("Barreiras de Flexibilidade — gerado por IA");
      line("⚠ Gerado por IA — revisar antes de usar clinicamente.", 9, false, [45, 106, 79]);
      line(form.barreiras_geradas);
    }
    if (form.direcionamento_gerado) {
      section("Direcionamento Terapêutico — gerado por IA");
      line("⚠ Gerado por IA — revisar antes de usar clinicamente.", 9, false, [45, 106, 79]);
      line(form.direcionamento_gerado);
    }
    if (form.observacoes_terapeuta) {
      section("Observações do terapeuta");
      line(form.observacoes_terapeuta);
    }

    y += 16;
    line(`${therapistName || "Terapeuta"}${crp ? ` — CRP ${crp}` : ""}`, 10, true);
    doc.save(`formulacao-act-${patientName.replace(/\s+/g, "-")}.pdf`);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}><Loader2 className="h-6 w-6 animate-spin" style={{ color: GREEN }} /></div>;
  }

  return (
    <div className="min-h-screen" style={{ background: BG }}>
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-28 sm:pb-10 space-y-4 sm:space-y-5">
        {/* Header */}
        <header className="bg-white rounded-[10px] p-5 sm:p-6 flex flex-col gap-3" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderLeft: `3px solid ${GREEN}` }}>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="h-8 -ml-2">
              <Link to="/app/pacientes"><ArrowLeft className="h-4 w-4" /> Pacientes</Link>
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px", color: INK }}>Formulação ACT</h1>
              <p style={{ fontSize: 13, color: MUTED }}>Terapia de Aceitação e Compromisso — Steven Hayes {patientName ? `· ${patientName}` : ""}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ background: GREEN_BG, color: GREEN, border: `1px solid ${GREEN_BORDER}`, fontSize: 11, fontWeight: 600 }}>
                  ACT · Hexaflex de Hayes
                </span>
                {savedAt && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ background: "#EAF3DE", color: "#3D5C35", fontSize: 11, fontWeight: 500 }}>
                    <Check className="h-3 w-3" /> Salvo {savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              <PageIntro className="mt-3" description="Hexaflex de Hayes: avalia flexibilidade psicológica em seis processos — desfusão, aceitação, eu como contexto, contato com o presente, valores e ação comprometida — para construir uma vida orientada por valores." />

            </div>
            <div className="flex w-full sm:w-auto items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportPDF} className="flex-1 sm:flex-none"><FileDown className="h-4 w-4" /> <span className="hidden sm:inline">Exportar PDF</span><span className="sm:hidden">PDF</span></Button>
              <Button size="sm" onClick={() => save(false)} disabled={saving} className="flex-1 sm:flex-none" style={{ background: GREEN, color: "#fff", fontWeight: 600 }}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} <span className="hidden sm:inline">Salvar formulação</span><span className="sm:hidden">Salvar</span>
              </Button>
            </div>
          </div>
        </header>

        {/* BLOCO 1 — Apresentação do Problema */}
        <Card>
          <BlockHeader kicker="Bloco 1" title="Apresentação do Problema" subtitle="Reescrita em termos de evitação experiencial e fusão cognitiva" />
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>Queixa reescrita em linguagem ACT</Label>
              <Textarea
                value={form.apresentacao_problema.queixa_act}
                onChange={(e) => update("apresentacao_problema", { ...form.apresentacao_problema, queixa_act: e.target.value })}
                placeholder="Como a queixa do paciente se expressa em termos de fusão, evitação e afastamento de valores..."
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>O que o paciente tenta controlar ou evitar</Label>
              <Textarea
                value={form.apresentacao_problema.o_que_evita}
                onChange={(e) => update("apresentacao_problema", { ...form.apresentacao_problema, o_que_evita: e.target.value })}
                placeholder="Pensamentos, emoções, sensações, memórias ou situações evitadas..."
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>Custo do controle na vida</Label>
              <Textarea
                value={form.apresentacao_problema.custo_controle}
                onChange={(e) => update("apresentacao_problema", { ...form.apresentacao_problema, custo_controle: e.target.value })}
                placeholder="Como a agenda de controle tem limitado a vida do paciente — trabalho, relacionamentos, saúde..."
                className="min-h-[80px]"
              />
            </div>
          </div>
        </Card>

        {/* BLOCO 2 — Hexaflex */}
        <Card>
          <BlockHeader kicker="Bloco 2" title="Hexaflex — 6 Processos de Flexibilidade" subtitle="Avalie cada processo em inflexibilidade (problema) e flexibilidade (objetivo)" />
          <div className="space-y-4">
            {PROCESSOS.map((p, idx) => {
              const h = form.hexaflex[p.key];
              const isInflex = h?.lado === "inflexibilidade";
              const color = isInflex ? "#C0392B" : GREEN;
              const bg = isInflex ? RED_BG : GREEN_BG;
              return (
                <div key={p.key} className="rounded-md border" style={{ borderColor: "#E5E7EB" }}>
                  <div className="px-3 py-2 flex items-center justify-between border-b" style={{ borderColor: "#E5E7EB", background: "#FAFAF7" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: MUTED }}>Par {idx + 1}</span>
                    <div className="flex items-center gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => updateHex(p.key, { lado: "inflexibilidade" })}
                        style={{
                          padding: "4px 10px", borderRadius: 6, fontWeight: isInflex ? 700 : 500,
                          background: isInflex ? "#C0392B" : "#fff",
                          color: isInflex ? "#fff" : MUTED,
                          border: `1px solid ${isInflex ? "#C0392B" : "#E5E7EB"}`,
                        }}
                      >Inflexibilidade</button>
                      <button
                        type="button"
                        onClick={() => updateHex(p.key, { lado: "flexibilidade" })}
                        style={{
                          padding: "4px 10px", borderRadius: 6, fontWeight: !isInflex ? 700 : 500,
                          background: !isInflex ? GREEN : "#fff",
                          color: !isInflex ? "#fff" : MUTED,
                          border: `1px solid ${!isInflex ? GREEN : "#E5E7EB"}`,
                        }}
                      >Flexibilidade</button>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-0">
                    <div className="p-3 sm:border-r" style={{ background: RED_BG, borderColor: "#F3D6D2" }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#C0392B" }}>{p.inflex}</p>
                      <p style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{p.inflexDesc}</p>
                    </div>
                    <div className="p-3" style={{ background: GREEN_BG }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>{p.flex}</p>
                      <p style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{p.flexDesc}</p>
                    </div>
                  </div>
                  <div className="p-3 space-y-2.5" style={{ background: bg }}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>
                        1 = muito comprometido · 5 = muito presente
                      </span>
                      <ScoreCircles value={h?.score ?? null} onChange={(n) => updateHex(p.key, { score: n })} color={color} />
                    </div>
                    <Textarea
                      value={h?.observacao ?? ""}
                      onChange={(e) => updateHex(p.key, { observacao: e.target.value })}
                      placeholder="Como esse processo aparece neste paciente..."
                      className="min-h-[56px] text-sm bg-white"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* BLOCO 3 — Valores */}
        <Card>
          <BlockHeader kicker="Bloco 3" title="Clarificação de Valores" subtitle="Por domínio de vida — o que importa e o que bloqueia" />
          <Accordion type="multiple" defaultValue={["v-0"]} className="w-full">
            {form.valores.map((v, idx) => (
              <AccordionItem key={v.dominio} value={`v-${idx}`} className="border rounded-md mb-2" style={{ borderColor: "#E5E7EB" }}>
                <AccordionTrigger className="px-3 py-2.5 hover:no-underline" style={{ fontSize: 13, fontWeight: 600, color: INK }}>
                  {v.dominio}
                  {v.alinhamento && (
                    <span className="ml-auto mr-3 text-[10px] uppercase font-bold" style={{
                      color: v.alinhamento === "alto" ? GREEN : v.alinhamento === "medio" ? "#B8860B" : "#C0392B",
                    }}>{v.alinhamento}</span>
                  )}
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold" style={{ color: MUTED }}>Valor declarado</Label>
                    <Input value={v.valor_declarado} onChange={(e) => updateValor(idx, { valor_declarado: e.target.value })} placeholder="O que realmente importa aqui..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold" style={{ color: MUTED }}>Ações atuais alinhadas</Label>
                    <Textarea value={v.acoes_alinhadas} onChange={(e) => updateValor(idx, { acoes_alinhadas: e.target.value })} placeholder="O que já faz em direção a esse valor..." className="min-h-[56px]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold" style={{ color: MUTED }}>Barreiras de flexibilidade</Label>
                    <Textarea value={v.barreiras} onChange={(e) => updateValor(idx, { barreiras: e.target.value })} placeholder="O que aparece internamente e bloqueia ação nesse domínio..." className="min-h-[56px]" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>Alinhamento valor/ação:</span>
                    {([
                      { k: "baixo", label: "Baixo", color: "#C0392B", bg: RED_BG },
                      { k: "medio", label: "Médio", color: "#B8860B", bg: YELLOW_BG },
                      { k: "alto", label: "Alto", color: GREEN, bg: GREEN_BG },
                    ] as const).map((opt) => {
                      const on = v.alinhamento === opt.k;
                      return (
                        <button
                          key={opt.k}
                          type="button"
                          onClick={() => updateValor(idx, { alinhamento: on ? "" : opt.k })}
                          style={{
                            padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: on ? 700 : 500,
                            background: on ? opt.color : opt.bg,
                            color: on ? "#fff" : opt.color,
                            border: `1px solid ${opt.color}`,
                          }}
                        >{opt.label}</button>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>

        {/* BLOCO 4 — Matriz ACT */}
        <Card>
          <BlockHeader kicker="Bloco 4" title="Matriz ACT" subtitle="Análise funcional dos padrões de aproximação e afastamento" />
          <div className="text-center text-[11px]" style={{ color: MUTED }}>
            Eixo horizontal: <strong>Afastamento ←——→ Aproximação</strong> &nbsp;·&nbsp; Eixo vertical: <strong>Experiência interna ↑ / Comportamento externo ↓</strong>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {/* Q1 */}
            <div className="rounded-md p-3 space-y-2" style={{ background: RED_BG, border: "1px solid #F3D6D2" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#C0392B", textTransform: "uppercase", letterSpacing: "0.05em" }}>Q1 · O que aparece dentro e dificulta</p>
              <p style={{ fontSize: 11, color: MUTED }}>Pensamentos, emoções, memórias, sensações que surgem e atrapalham</p>
              <Textarea
                value={form.matriz_act.q1_experiencia_interna}
                onChange={(e) => update("matriz_act", { ...form.matriz_act, q1_experiencia_interna: e.target.value })}
                placeholder="Ex: 'Não sou capaz', ansiedade no peito, memória de fracasso..."
                className="min-h-[90px] bg-white"
              />
            </div>
            {/* Q3 */}
            <div className="rounded-md p-3 space-y-2" style={{ background: GREEN_BG, border: `1px solid ${GREEN_BORDER}` }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: GREEN, textTransform: "uppercase", letterSpacing: "0.05em" }}>Q3 · Quem/o que importa</p>
              <p style={{ fontSize: 11, color: MUTED }}>Valores e pessoas que dão sentido</p>
              <Textarea
                value={form.matriz_act.q3_valores}
                onChange={(e) => update("matriz_act", { ...form.matriz_act, q3_valores: e.target.value })}
                placeholder="Ex: Ser presente para os filhos, crescer profissionalmente, ter saúde..."
                className="min-h-[90px] bg-white"
              />
            </div>
            {/* Q2 */}
            <div className="rounded-md p-3 space-y-2" style={{ background: YELLOW_BG, border: "1px solid #E8C97A" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#B8860B", textTransform: "uppercase", letterSpacing: "0.05em" }}>Q2 · O que faz para se afastar</p>
              <p style={{ fontSize: 11, color: MUTED }}>Comportamentos de esquiva e controle</p>
              <Textarea
                value={form.matriz_act.q2_comportamento_afastamento}
                onChange={(e) => update("matriz_act", { ...form.matriz_act, q2_comportamento_afastamento: e.target.value })}
                placeholder="Ex: Procrastina, evita situações sociais, usa álcool, fica no celular..."
                className="min-h-[90px] bg-white"
              />
            </div>
            {/* Q4 */}
            <div className="rounded-md p-3 space-y-2" style={{ background: PURPLE_BG, border: `1px solid ${LILAC_BORDER}` }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.05em" }}>Q4 · O que faria se não estivesse preso</p>
              <p style={{ fontSize: 11, color: MUTED }}>Ações comprometidas com os valores</p>
              <Textarea
                value={form.matriz_act.q4_acao_comprometida}
                onChange={(e) => update("matriz_act", { ...form.matriz_act, q4_acao_comprometida: e.target.value })}
                placeholder="Ex: Pediria aumento, passaria mais tempo com família, voltaria a treinar..."
                className="min-h-[90px] bg-white"
              />
            </div>
          </div>
        </Card>

        {/* BLOCO 5 — Barreiras IA */}
        <Card>
          <BlockHeader kicker="Bloco 5" title="Barreiras de Flexibilidade Psicológica" subtitle="Gerado pela IA com base no Hexaflex" />
          <Button
            onClick={gerarBarreiras}
            disabled={!podeBarreiras || genBarreiras}
            size="sm"
            style={{ background: PURPLE, color: "#fff", fontWeight: 600 }}
          >
            {genBarreiras ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Identificar barreiras com IA
          </Button>
          {!podeBarreiras && <p className="text-[11px]" style={{ color: MUTED }}>Preencha o Hexaflex (Bloco 2) e ao menos um Valor (Bloco 3) para habilitar.</p>}
          {form.barreiras_geradas && (
            <div className="rounded-md p-4 space-y-3" style={{ background: GREEN_BG, borderLeft: `3px solid ${GREEN}` }}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded" style={{ background: "#fff", color: GREEN, border: `1px solid ${GREEN_BORDER}`, fontSize: 10, fontWeight: 700 }}>
                  ACT · Hexaflex de Hayes
                </span>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={gerarBarreiras} disabled={genBarreiras}><RefreshCw className="h-3.5 w-3.5" /> Atualizar</Button>
                  <Button size="sm" variant="outline" onClick={() => copiar(form.barreiras_geradas)}><Copy className="h-3.5 w-3.5" /> Copiar</Button>
                </div>
              </div>
              <div className="prose prose-sm max-w-none" style={{ fontSize: 13, color: INK }}>
                <ReactMarkdown>{form.barreiras_geradas}</ReactMarkdown>
              </div>
            </div>
          )}
        </Card>

        {/* BLOCO 6 — Direcionamento */}
        <Card>
          <BlockHeader kicker="Bloco 6" title="Direcionamento Terapêutico" subtitle="Sugestão da IA para início do trabalho ACT" />
          <Button
            onClick={gerarDirecionamento}
            disabled={!form.barreiras_geradas || genDirec}
            size="sm"
            style={{ background: PURPLE, color: "#fff", fontWeight: 600 }}
          >
            {genDirec ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Gerar direcionamento com IA
          </Button>
          {!form.barreiras_geradas && <p className="text-[11px]" style={{ color: MUTED }}>Gere primeiro o Bloco 5 (barreiras) para habilitar.</p>}
          {form.direcionamento_gerado && (
            <div className="rounded-md p-4 space-y-3" style={{ background: GREEN_BG, borderLeft: `3px solid ${GREEN}` }}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded" style={{ background: "#fff", color: GREEN, border: `1px solid ${GREEN_BORDER}`, fontSize: 10, fontWeight: 700 }}>
                  ACT · Hexaflex de Hayes
                </span>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={gerarDirecionamento} disabled={genDirec}><RefreshCw className="h-3.5 w-3.5" /> Atualizar</Button>
                  <Button size="sm" variant="outline" onClick={() => copiar(form.direcionamento_gerado)}><Copy className="h-3.5 w-3.5" /> Copiar</Button>
                </div>
              </div>
              <div className="prose prose-sm max-w-none" style={{ fontSize: 13, color: INK }}>
                <ReactMarkdown>{form.direcionamento_gerado}</ReactMarkdown>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>Observações do terapeuta</Label>
            <Textarea
              value={form.observacoes_terapeuta}
              onChange={(e) => update("observacoes_terapeuta", e.target.value)}
              placeholder="Ajuste ou complemente o direcionamento gerado pela IA..."
              className="min-h-[90px]"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
