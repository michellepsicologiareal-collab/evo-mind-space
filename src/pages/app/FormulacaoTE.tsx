import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, Sparkles, ArrowLeft, FileDown, Check, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { AbordagemBadge } from "@/components/app/AbordagemBadge";

const G = "#B8860B";
const G_BG = "#FDF6E3";
const G_BORDER = "#E8C97A";
const PURPLE = "#534AB7";
const PURPLE_BG = "#EEEDFE";
const INK = "#1A1A2E";
const MUTED = "#6B7280";
const BG = "#F7F6F3";

const NECESSIDADES = [
  "Segurança e estabilidade",
  "Vínculos seguros e afeto",
  "Autonomia e competência",
  "Liberdade de expressão emocional",
  "Limites realistas e autocontrole",
  "Espontaneidade e prazer",
  "Validação e reconhecimento",
  "Proteção e cuidado",
];

const DOMINIOS: { titulo: string; eids: string[] }[] = [
  { titulo: "1. Desconexão e Rejeição", eids: ["Abandono/Instabilidade", "Desconfiança/Abuso", "Privação Emocional", "Defectividade/Vergonha", "Isolamento Social"] },
  { titulo: "2. Autonomia e Desempenho Prejudicados", eids: ["Dependência/Incompetência", "Vulnerabilidade a Danos", "Emaranhamento/Eu Subdesenvolvido", "Fracasso"] },
  { titulo: "3. Limites Prejudicados", eids: ["Arrogo/Grandiosidade", "Autocontrole/Autodisciplina Insuficientes"] },
  { titulo: "4. Orientação para o Outro", eids: ["Subjugação", "Autossacrifício", "Busca de Aprovação"] },
  { titulo: "5. Supervigilância e Inibição", eids: ["Negativismo/Pessimismo", "Inibição Emocional", "Padrões Inflexíveis/Hipercriticismo", "Punitividade"] },
];

const MODOS_GRUPOS: { titulo: string; modos: string[] }[] = [
  { titulo: "Modos de Criança", modos: ["Criança Vulnerável", "Criança Raivosa", "Criança Impulsiva/Indisciplinada", "Criança Feliz (recurso)"] },
  { titulo: "Modos de Enfrentamento", modos: ["Capitulador Complacente", "Protetor Evitador", "Supercompensador"] },
  { titulo: "Modos Parentais Internalizados", modos: ["Pai/Mãe Punitivo(a)", "Pai/Mãe Exigente"] },
];

type EsquemaSel = { nome: string; intensidade: "Leve" | "Moderado" | "Intenso"; manifestacao: string };
type ModoSel = { ativo: boolean; frequencia: "Raro" | "Frequente" | "Dominante" | ""; manifestacao: string };

type FormState = {
  ambiente_familiar: string;
  figuras_vinculacao: string;
  eventos_marcantes: string;
  padrao_identificado: string;
  historia_origem: string;
  necessidades: string[];
  outras_necessidades: string;
  esquemas: EsquemaSel[];
  modos: Record<string, ModoSel>;
  adulto_saudavel_forca: number | null;
  conexao_gerada: string;
  foco_terapeutico: string;
  observacoes_terapeuta: string;
};

const EMPTY: FormState = {
  ambiente_familiar: "", figuras_vinculacao: "", eventos_marcantes: "", padrao_identificado: "",
  historia_origem: "", necessidades: [], outras_necessidades: "",
  esquemas: [], modos: {}, adulto_saudavel_forca: null,
  conexao_gerada: "", foco_terapeutico: "", observacoes_terapeuta: "",
};

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <section
    className={`bg-white rounded-[10px] p-5 sm:p-6 space-y-4 ${className}`}
    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderLeft: `3px solid ${G}` }}
  >
    {children}
  </section>
);

const BlockHeader = ({ kicker, title, subtitle }: { kicker: string; title: string; subtitle?: string }) => (
  <header className="space-y-1">
    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: G, textTransform: "uppercase" }}>{kicker}</p>
    <h2 className="font-display" style={{ fontSize: 15, fontWeight: 700, color: INK }}>{title}</h2>
    {subtitle && <p style={{ fontSize: 12, color: MUTED }}>{subtitle}</p>}
  </header>
);

export default function FormulacaoTE() {
  const { id: patientId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [genConexao, setGenConexao] = useState(false);
  const [genFoco, setGenFoco] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [therapistName, setTherapistName] = useState("");
  const [crp, setCrp] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const lastSavedSnapshot = useRef<string>("");

  // Load patient + existing formulation + therapist profile
  useEffect(() => {
    if (!user || !patientId) return;
    (async () => {
      setLoading(true);
      const [{ data: p }, { data: prof }, { data: existing }] = await Promise.all([
        supabase.from("patients").select("full_name").eq("id", patientId).maybeSingle(),
        supabase.from("profiles").select("full_name, crp").eq("id", user.id).maybeSingle(),
        (supabase as any).from("schema_formulations").select("*").eq("patient_id", patientId).eq("therapist_id", user.id).maybeSingle(),
      ]);
      if (p) setPatientName(p.full_name);
      if (prof) { setTherapistName(prof.full_name || ""); setCrp(prof.crp || ""); }
      if (existing) {
        setRecordId(existing.id);
        const loaded: FormState = {
          ambiente_familiar: existing.ambiente_familiar ?? "",
          figuras_vinculacao: existing.figuras_vinculacao ?? "",
          eventos_marcantes: existing.eventos_marcantes ?? "",
          padrao_identificado: existing.padrao_identificado ?? "",
          historia_origem: existing.historia_origem ?? "",
          necessidades: Array.isArray(existing.necessidades) ? existing.necessidades : [],
          outras_necessidades: existing.outras_necessidades ?? "",
          esquemas: Array.isArray(existing.esquemas) ? existing.esquemas : [],
          modos: existing.modos && typeof existing.modos === "object" ? existing.modos : {},
          adulto_saudavel_forca: existing.adulto_saudavel_forca ?? null,
          conexao_gerada: existing.conexao_gerada ?? "",
          foco_terapeutico: existing.foco_terapeutico ?? "",
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

  const toggleNecessidade = (n: string) => {
    update("necessidades", form.necessidades.includes(n) ? form.necessidades.filter((x) => x !== n) : [...form.necessidades, n]);
  };

  const toggleEsquema = (nome: string) => {
    const existing = form.esquemas.find((e) => e.nome === nome);
    if (existing) update("esquemas", form.esquemas.filter((e) => e.nome !== nome));
    else update("esquemas", [...form.esquemas, { nome, intensidade: "Moderado", manifestacao: "" }]);
  };
  const updateEsquema = (nome: string, patch: Partial<EsquemaSel>) => {
    update("esquemas", form.esquemas.map((e) => e.nome === nome ? { ...e, ...patch } : e));
  };

  const toggleModo = (m: string) => {
    const cur = form.modos[m];
    const next = { ...form.modos };
    if (cur?.ativo) delete next[m];
    else next[m] = { ativo: true, frequencia: "", manifestacao: "" };
    update("modos", next);
  };
  const updateModo = (m: string, patch: Partial<ModoSel>) => {
    update("modos", { ...form.modos, [m]: { ...(form.modos[m] ?? { ativo: true, frequencia: "", manifestacao: "" }), ...patch } });
  };

  const save = useCallback(async (silent = false) => {
    if (!user || !patientId) return;
    const snapshot = JSON.stringify(form);
    if (snapshot === lastSavedSnapshot.current) return;
    setSaving(true);
    try {
      const payload: any = { patient_id: patientId, therapist_id: user.id, ...form };
      const { data, error } = await (supabase as any).from("schema_formulations")
        .upsert(payload, { onConflict: "patient_id,therapist_id" })
        .select("id, updated_at")
        .maybeSingle();
      if (error) throw error;
      if (data?.id) setRecordId(data.id);
      if (data?.updated_at) setSavedAt(new Date(data.updated_at));
      lastSavedSnapshot.current = snapshot;
      if (!silent) toast.success("Formulação salva.");
    } catch (e: any) {
      console.error(e);
      if (!silent) toast.error("Erro ao salvar formulação.");
    } finally { setSaving(false); }
  }, [form, user, patientId]);

  // Autosave a cada 30s
  useEffect(() => {
    const t = setInterval(() => { save(true); }, 30000);
    return () => clearInterval(t);
  }, [save]);

  const podeGerarConexao = useMemo(() => {
    const bloco1 = !!(form.ambiente_familiar || form.figuras_vinculacao || form.eventos_marcantes || form.padrao_identificado);
    return bloco1 && form.necessidades.length > 0 && form.esquemas.length > 0;
  }, [form]);

  const gerarConexao = async () => {
    if (!podeGerarConexao || !patientId) return;
    setGenConexao(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-te-formulation", {
        body: {
          patient_id: patientId,
          mode: "conexao",
          ...form,
        },
      });
      if (error) throw error;
      const txt = (data as any)?.result ?? "";
      if (!txt) { toast.error((data as any)?.error || "Falha ao gerar."); return; }
      update("conexao_gerada", txt);
      await save(true);
      toast.success("Padrão central gerado.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar com IA.");
    } finally { setGenConexao(false); }
  };

  const gerarFoco = async () => {
    if (!form.conexao_gerada || !patientId) return;
    setGenFoco(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-te-formulation", {
        body: {
          patient_id: patientId,
          mode: "foco",
          ...form,
          conexao_existente: form.conexao_gerada,
        },
      });
      if (error) throw error;
      const txt = (data as any)?.result ?? "";
      if (!txt) { toast.error((data as any)?.error || "Falha ao gerar."); return; }
      update("foco_terapeutico", txt);
      await save(true);
      toast.success("Foco terapêutico gerado.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar com IA.");
    } finally { setGenFoco(false); }
  };

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
    const section = (title: string) => {
      y += 6;
      line(title, 12, true, [184, 134, 11]);
      y += 2;
    };

    line("Formulação de Esquema — Terapia do Esquema (Young)", 16, true, [184, 134, 11]);
    line(`Paciente: ${patientName}`, 11, true);
    line(`Data: ${new Date().toLocaleDateString("pt-BR")}`, 10, false, [107, 114, 128]);
    y += 4;

    section("História de Origem");
    if (form.ambiente_familiar) { line("Ambiente familiar:", 10, true); line(form.ambiente_familiar); }
    if (form.figuras_vinculacao) { line("Figuras de vinculação:", 10, true); line(form.figuras_vinculacao); }
    if (form.eventos_marcantes) { line("Eventos marcantes:", 10, true); line(form.eventos_marcantes); }
    if (form.padrao_identificado) { line("Padrão identificado:", 10, true); line(form.padrao_identificado); }

    section("Necessidades Emocionais Não Atendidas");
    line(form.necessidades.length ? form.necessidades.map((n) => `• ${n}`).join("\n") : "(nenhuma marcada)");
    if (form.outras_necessidades) line(`Outras: ${form.outras_necessidades}`);

    section("Esquemas Iniciais Desadaptativos");
    if (!form.esquemas.length) line("(nenhum selecionado)");
    form.esquemas.forEach((e) => {
      line(`• ${e.nome} — ${e.intensidade}`, 10, true);
      if (e.manifestacao) line(e.manifestacao);
    });

    section("Modos Esquemáticos");
    const ativos = Object.entries(form.modos).filter(([_, v]) => v?.ativo);
    if (!ativos.length) line("(nenhum modo ativo)");
    ativos.forEach(([k, v]) => {
      line(`• ${k} — ${v.frequencia || "frequência não informada"}`, 10, true);
      if (v.manifestacao) line(v.manifestacao);
    });
    if (form.adulto_saudavel_forca) line(`Adulto Saudável (força atual): ${form.adulto_saudavel_forca}/5`, 10, true);

    if (form.conexao_gerada) {
      section("Padrão Central — gerado por IA");
      line("⚠ Gerado por IA — revisar antes de usar clinicamente.", 9, false, [184, 134, 11]);
      line(form.conexao_gerada);
    }
    if (form.foco_terapeutico) {
      section("Foco Terapêutico — gerado por IA");
      line("⚠ Gerado por IA — revisar antes de usar clinicamente.", 9, false, [184, 134, 11]);
      line(form.foco_terapeutico);
    }
    if (form.observacoes_terapeuta) {
      section("Observações do terapeuta");
      line(form.observacoes_terapeuta);
    }

    y += 16;
    line(`${therapistName || "Terapeuta"}${crp ? ` — CRP ${crp}` : ""}`, 10, true);
    doc.save(`formulacao-te-${patientName.replace(/\s+/g, "-")}.pdf`);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}><Loader2 className="h-6 w-6 animate-spin" style={{ color: G }} /></div>;
  }

  return (
    <div className="min-h-screen" style={{ background: BG }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Header */}
        <header className="bg-white rounded-[10px] p-5 sm:p-6 flex flex-col gap-3" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderLeft: `3px solid ${G}` }}>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="h-8 -ml-2">
              <Link to="/app/pacientes"><ArrowLeft className="h-4 w-4" /> Pacientes</Link>
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px", color: INK }}>Formulação de Esquema</h1>
              <p style={{ fontSize: 13, color: MUTED }}>Terapia do Esquema — Jeffrey Young {patientName ? `· ${patientName}` : ""}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ background: G_BG, color: G, border: `1px solid ${G_BORDER}`, fontSize: 11, fontWeight: 600 }}>
                  TE · Terapia do Esquema
                </span>
                {savedAt && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ background: "#EAF3DE", color: "#3D5C35", fontSize: 11, fontWeight: 500 }}>
                    <Check className="h-3 w-3" /> Salvo {savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportPDF}><FileDown className="h-4 w-4" /> Exportar PDF</Button>
              <Button size="sm" onClick={() => save(false)} disabled={saving} style={{ background: G, color: "#fff", fontWeight: 600 }}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar formulação
              </Button>
            </div>
          </div>
        </header>

        {/* BLOCO 1 */}
        <Card>
          <BlockHeader kicker="Bloco 1" title="História de Origem" subtitle="Experiências formativas e contexto familiar" />
          <div className="grid gap-3">
            <Field label="Ambiente emocional familiar" value={form.ambiente_familiar} onChange={(v) => update("ambiente_familiar", v)} placeholder="Descreva o clima emocional predominante na família de origem..." />
            <Field label="Figuras de vinculação" value={form.figuras_vinculacao} onChange={(v) => update("figuras_vinculacao", v)} placeholder="Como eram as figuras parentais? Presentes, ausentes, críticos, protetores..." />
            <Field label="Eventos marcantes" value={form.eventos_marcantes} onChange={(v) => update("eventos_marcantes", v)} placeholder="Situações significativas na infância ou adolescência que moldaram padrões..." />
            <Field label="Padrão identificado" value={form.padrao_identificado} onChange={(v) => update("padrao_identificado", v)} placeholder="Qual padrão relacional emerge dessa história?" />
          </div>
        </Card>

        {/* BLOCO 2 */}
        <Card>
          <BlockHeader kicker="Bloco 2" title="Necessidades Emocionais Não Atendidas" subtitle="Marque as necessidades centrais não satisfeitas no desenvolvimento" />
          <div className="grid sm:grid-cols-2 gap-2">
            {NECESSIDADES.map((n) => {
              const on = form.necessidades.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleNecessidade(n)}
                  className="text-left transition-colors"
                  style={{
                    background: on ? G_BG : "#F9FAFB",
                    border: `1px solid ${on ? G_BORDER : "#E5E7EB"}`,
                    color: on ? G : MUTED,
                    fontWeight: on ? 600 : 400,
                    fontSize: 13,
                    borderRadius: 8,
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${on ? G : "#D1D5DB"}`, display: "inline-flex", alignItems: "center", justifyContent: "center", background: on ? G : "#fff" }}>
                    {on && <Check className="h-3 w-3" style={{ color: "#fff" }} />}
                  </span>
                  {n}
                </button>
              );
            })}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>Outras necessidades identificadas (opcional)</Label>
            <Textarea value={form.outras_necessidades} onChange={(e) => update("outras_necessidades", e.target.value)} className="min-h-[70px]" />
          </div>
        </Card>

        {/* BLOCO 3 */}
        <Card>
          <BlockHeader kicker="Bloco 3" title="Esquemas Iniciais Desadaptativos" subtitle="Selecione os EIDs presentes — organize por intensidade" />
          <Accordion type="multiple" defaultValue={["dom-0"]} className="w-full">
            {DOMINIOS.map((d, idx) => (
              <AccordionItem key={d.titulo} value={`dom-${idx}`} className="border rounded-md mb-2" style={{ borderColor: "#E5E7EB" }}>
                <AccordionTrigger className="px-3 py-2.5 hover:no-underline" style={{ fontSize: 13, fontWeight: 600, color: INK }}>{d.titulo}</AccordionTrigger>
                <AccordionContent className="px-3 pb-3 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {d.eids.map((nome) => {
                      const sel = form.esquemas.find((e) => e.nome === nome);
                      return (
                        <button key={nome} type="button" onClick={() => toggleEsquema(nome)}
                          style={{
                            background: sel ? G_BG : "#F3F4F6",
                            border: `1px solid ${sel ? G_BORDER : "#E5E7EB"}`,
                            color: sel ? G : MUTED,
                            fontWeight: sel ? 600 : 400,
                            fontSize: 12, borderRadius: 6, padding: "5px 10px",
                          }}
                        >{nome}</button>
                      );
                    })}
                  </div>
                  {form.esquemas.filter((e) => d.eids.includes(e.nome)).map((e) => (
                    <div key={e.nome} className="rounded-md p-3 space-y-2" style={{ background: "#FBFAF6", border: `1px solid ${G_BORDER}` }}>
                      <div className="flex items-center justify-between gap-2">
                        <span style={{ fontSize: 12, fontWeight: 600, color: G }}>{e.nome}</span>
                        <Select value={e.intensidade} onValueChange={(v: any) => updateEsquema(e.nome, { intensidade: v })}>
                          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Leve">Leve</SelectItem>
                            <SelectItem value="Moderado">Moderado</SelectItem>
                            <SelectItem value="Intenso">Intenso</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Textarea
                        value={e.manifestacao}
                        onChange={(ev) => updateEsquema(e.nome, { manifestacao: ev.target.value })}
                        placeholder="Manifestação clínica — como esse esquema aparece neste paciente"
                        className="min-h-[60px] text-sm"
                      />
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>

        {/* BLOCO 4 */}
        <Card>
          <BlockHeader kicker="Bloco 4" title="Modos Esquemáticos" subtitle="Identifique os modos ativos e sua frequência" />
          {MODOS_GRUPOS.map((g) => (
            <div key={g.titulo} className="space-y-2">
              <p style={{ fontSize: 11, fontWeight: 700, color: G, textTransform: "uppercase", letterSpacing: "0.06em" }}>{g.titulo}</p>
              <div className="space-y-2">
                {g.modos.map((m) => {
                  const v = form.modos[m];
                  const on = !!v?.ativo;
                  return (
                    <div key={m} className="rounded-md p-3 space-y-2" style={{ background: on ? G_BG : "#F9FAFB", border: `1px solid ${on ? G_BORDER : "#E5E7EB"}` }}>
                      <label className="flex items-center justify-between gap-2 cursor-pointer">
                        <span style={{ fontSize: 13, fontWeight: on ? 600 : 500, color: on ? G : INK }}>{m}</span>
                        <input type="checkbox" checked={on} onChange={() => toggleModo(m)} className="h-4 w-4" style={{ accentColor: G }} />
                      </label>
                      {on && (
                        <div className="space-y-2">
                          <Select value={v.frequencia || ""} onValueChange={(val: any) => updateModo(m, { frequencia: val })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Frequência" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Raro">Raro</SelectItem>
                              <SelectItem value="Frequente">Frequente</SelectItem>
                              <SelectItem value="Dominante">Dominante</SelectItem>
                            </SelectContent>
                          </Select>
                          <Textarea
                            value={v.manifestacao}
                            onChange={(ev) => updateModo(m, { manifestacao: ev.target.value })}
                            placeholder="Como se manifesta neste paciente?"
                            className="min-h-[60px] text-sm"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="space-y-2 rounded-md p-3" style={{ background: PURPLE_BG, border: `1px solid #AFA9EC` }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.06em" }}>Modo Adulto Saudável</p>
            <p style={{ fontSize: 12, color: MUTED }}>Quão presente está o Adulto Saudável neste paciente?</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => {
                const on = form.adulto_saudavel_forca === n;
                return (
                  <button key={n} type="button" onClick={() => update("adulto_saudavel_forca", n)}
                    className="flex-1 h-10 rounded-md text-sm font-bold transition-colors"
                    style={{ background: on ? PURPLE : "#fff", color: on ? "#fff" : PURPLE, border: `1px solid ${on ? PURPLE : "#E5E7EB"}` }}>
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        {/* BLOCO 5 */}
        <Card>
          <BlockHeader kicker="Bloco 5" title="Padrão Central" subtitle="Gerado pela IA com base nos blocos anteriores" />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={gerarConexao} disabled={!podeGerarConexao || genConexao} style={{ background: PURPLE, color: "#fff" }}>
              {genConexao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {form.conexao_gerada ? "Atualizar" : "Gerar conexão com IA"}
            </Button>
            {form.conexao_gerada && (
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(form.conexao_gerada); toast.success("Copiado"); }}>
                <Copy className="h-3.5 w-3.5" /> Copiar
              </Button>
            )}
            {!podeGerarConexao && <span style={{ fontSize: 11, color: MUTED }}>Preencha blocos 1, 2 e 3 para liberar.</span>}
          </div>
          {form.conexao_gerada && (
            <div className="rounded-md p-4 space-y-2" style={{ background: PURPLE_BG, borderLeft: `3px solid ${PURPLE}` }}>
              <div className="flex items-center justify-between gap-2">
                <span style={{ fontSize: 11, fontWeight: 700, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.08em" }}>Padrão central</span>
                <AbordagemBadge abordagem="TE" label="Terapia do Esquema (Young)" />
              </div>
              <p style={{ fontSize: 13.5, color: INK, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{form.conexao_gerada}</p>
            </div>
          )}
        </Card>

        {/* BLOCO 6 */}
        <Card>
          <BlockHeader kicker="Bloco 6" title="Foco Terapêutico" subtitle="Direcionamento sugerido pela IA" />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={gerarFoco} disabled={!form.conexao_gerada || genFoco} style={{ background: PURPLE, color: "#fff" }}>
              {genFoco ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {form.foco_terapeutico ? "Atualizar foco" : "Gerar foco com IA"}
            </Button>
            {form.foco_terapeutico && (
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(form.foco_terapeutico); toast.success("Copiado"); }}>
                <Copy className="h-3.5 w-3.5" /> Copiar
              </Button>
            )}
            {!form.conexao_gerada && <span style={{ fontSize: 11, color: MUTED }}>Gere o Padrão Central antes.</span>}
          </div>
          {form.foco_terapeutico && (
            <div className="rounded-md p-4 space-y-2" style={{ background: G_BG, borderLeft: `3px solid ${G}` }}>
              <div className="flex items-center justify-between gap-2">
                <span style={{ fontSize: 11, fontWeight: 700, color: G, textTransform: "uppercase", letterSpacing: "0.08em" }}>Foco terapêutico</span>
                <AbordagemBadge abordagem="TE" label="Terapia do Esquema (Young)" />
              </div>
              <div
                className="prose prose-sm max-w-none [&_h2]:text-sm [&_h2]:font-display [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1"
                style={{ fontSize: 13, color: INK, lineHeight: 1.6, whiteSpace: "pre-wrap" }}
                dangerouslySetInnerHTML={{ __html: form.foco_terapeutico.replace(/^## (.+)$/gm, '<h2 style="color:#B8860B;margin-top:8px;margin-bottom:2px;">$1</h2>') }}
              />
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

        <div className="flex justify-end pb-6">
          <Button size="sm" onClick={() => save(false)} disabled={saving} style={{ background: G, color: "#fff", fontWeight: 600 }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar formulação
          </Button>
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>{label}</Label>
    <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="min-h-[80px]" />
  </div>
);
