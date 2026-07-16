import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, FileDown, Check } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { CaseFormulation } from "@/components/app/CaseFormulation";
import { PageIntro } from "@/components/app/PageIntro";

// Paleta TCC (mesma estrutura visual da Formulação ACT, cor da abordagem TCC)
const G = "#534AB7";
const G_BG = "#EEEDFE";
const G_BORDER = "#C9C3F0";
const INK = "#1A1A2E";
const MUTED = "#6B7280";
const BG = "#F7F6F3";

const FIVE_SYSTEMS: { key: "environment" | "thoughts" | "emotions" | "behaviors" | "physical_reactions"; label: string }[] = [
  { key: "environment", label: "Ambiente" },
  { key: "thoughts", label: "Pensamentos" },
  { key: "emotions", label: "Emoções" },
  { key: "behaviors", label: "Comportamentos" },
  { key: "physical_reactions", label: "Reações Físicas" },
];

const STATUS_LABEL: Record<string, string> = {
  initial: "Inicial",
  in_progress: "Em andamento",
  consolidated: "Consolidado",
};

export default function FormulacaoTCC() {
  const { id: patientId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [patientName, setPatientName] = useState("");
  const [therapistName, setTherapistName] = useState("");
  const [crp, setCrp] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!patientId || !user) return;
    (async () => {
      const [{ data: p }, { data: prof }, { data: f }] = await Promise.all([
        supabase.from("patients").select("full_name").eq("id", patientId).maybeSingle(),
        supabase.from("profiles").select("full_name, crp").eq("id", user.id).maybeSingle(),
        supabase.from("case_formulations").select("updated_at").eq("patient_id", patientId).eq("user_id", user.id).maybeSingle(),
      ]);
      setPatientName(p?.full_name ?? "");
      setTherapistName(prof?.full_name ?? "");
      setCrp(prof?.crp ?? "");
      if (f?.updated_at) setSavedAt(new Date(f.updated_at));
      setLoading(false);
    })();
  }, [patientId, user]);

  const exportPDF = async () => {
    if (!patientId || !user) return;
    setExporting(true);
    try {
      const [{ data: form }, { data: evos }] = await Promise.all([
        supabase.from("case_formulations").select("*").eq("patient_id", patientId).eq("user_id", user.id).maybeSingle(),
        supabase.from("session_evolutions").select("*").eq("patient_id", patientId).eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      ]);

      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const M = 40;
      let y = M;

      const ensure = (h: number) => {
        if (y + h > H - 60) { doc.addPage(); y = M; }
      };
      const line = (s: string, size = 11, bold = false, color: [number, number, number] = [26, 26, 46]) => {
        if (!s) return;
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
        const wrapped = doc.splitTextToSize(s, W - 2 * M);
        wrapped.forEach((ln: string) => {
          ensure(size + 4);
          doc.text(ln, M, y);
          y += size + 4;
        });
      };
      const section = (title: string) => {
        y += 8;
        ensure(20);
        line(title, 13, true, [83, 74, 183]);
        doc.setDrawColor(201, 195, 240);
        doc.line(M, y - 2, W - M, y - 2);
        y += 4;
      };

      // Cabeçalho / identidade
      line("PsiReal — Psicologia Real", 10, true, [83, 74, 183]);
      line("Formulação TCC — 5 Aspectos de Padesky", 17, true, [26, 26, 46]);
      y += 2;
      line(`Paciente: ${patientName || "-"}`, 11, true);
      if (therapistName) line(`Terapeuta: ${therapistName}${crp ? ` — CRP ${crp}` : ""}`, 10, false, [107, 114, 128]);
      line(`Data: ${new Date().toLocaleDateString("pt-BR")}`, 10, false, [107, 114, 128]);

      // 5 Sistemas
      section("Formulação de Caso — 5 Aspectos");
      FIVE_SYSTEMS.forEach((s) => {
        const val = (form as any)?.[s.key] as string | undefined;
        line(s.label, 11, true);
        line(val && val.trim() ? val : "—");
      });

      // Crenças Nucleares
      section("Crenças Nucleares");
      line(form?.core_beliefs && form.core_beliefs.trim() ? form.core_beliefs : "—");

      // Plano Terapêutico
      const plans: any[] = Array.isArray(form?.treatment_goals) ? (form!.treatment_goals as any[]) : [];
      section("Plano Terapêutico");
      if (plans.length === 0) {
        line("Nenhum objetivo terapêutico registrado.", 10, false, [107, 114, 128]);
      } else {
        plans.forEach((p, i) => {
          line(`${i + 1}. ${p.objective || "Sem título"} — ${STATUS_LABEL[p.status] || p.status || "-"}`, 11, true);
          if (p.hypothesis) { line("Hipótese clínica:", 10, true); line(p.hypothesis); }
          if (Array.isArray(p.interventions) && p.interventions.length) { line("Intervenções:", 10, true); line("• " + p.interventions.join("  •  ")); }
          if (Array.isArray(p.homework) && p.homework.length) { line("Tarefas de casa:", 10, true); line("• " + p.homework.join("  •  ")); }
          if (Array.isArray(p.indicators) && p.indicators.length) { line("Indicadores:", 10, true); line("• " + p.indicators.join("  •  ")); }
          if (Array.isArray(p.progress) && p.progress.length) {
            const sorted = [...p.progress].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const first = sorted[0].score, last = sorted[sorted.length - 1].score;
            line(`Progresso: ${first} → ${last} (${sorted.length} registros)`, 10, false, [107, 114, 128]);
          }
          y += 4;
        });
      }

      // Evoluções
      section("Evoluções de Sessão");
      if (!evos || evos.length === 0) {
        line("Nenhuma evolução registrada.", 10, false, [107, 114, 128]);
      } else {
        evos.forEach((e: any) => {
          const d = new Date(e.created_at).toLocaleDateString("pt-BR");
          line(`— ${d} —`, 10, true, [83, 74, 183]);
          if (e.session_summary) { line("Resumo:", 10, true); line(e.session_summary); }
          if (e.homework) { line("Tarefa de casa:", 10, true); line(e.homework); }
          y += 2;
        });
      }

      // Rodapé em todas as páginas
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(107, 114, 128);
        doc.text(
          "Psicologia Real — Terapias e Autocuidado®  |  Uso Clínico Restrito",
          W / 2,
          H - 24,
          { align: "center" }
        );
        doc.text(`Página ${i} de ${pageCount}`, W - M, H - 24, { align: "right" });
      }

      const safeName = (patientName || "paciente").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase();
      const dateStr = new Date().toISOString().slice(0, 10);
      doc.save(`formulacao_tcc_${safeName}_${dateStr}.pdf`);
      toast.success("PDF exportado.");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao exportar PDF.");
    } finally {
      setExporting(false);
    }
  };

  if (loading || !patientId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: G }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: BG }}>
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-28 sm:pb-10 space-y-4 sm:space-y-5">
        {/* Header estilo ACT */}
        <header
          className="bg-white rounded-[10px] p-5 sm:p-6 flex flex-col gap-3"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderLeft: `3px solid ${G}` }}
        >
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="h-8 -ml-2">
              <Link to="/app/pacientes"><ArrowLeft className="h-4 w-4" /> Pacientes</Link>
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <h1
                className="font-display"
                style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px", color: INK }}
              >
                Formulação TCC
              </h1>
              <p style={{ fontSize: 13, color: MUTED }}>
                Terapia Cognitivo-Comportamental — 5 Aspectos de Padesky
                {patientName ? ` · ${patientName}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md"
                  style={{ background: G_BG, color: G, border: `1px solid ${G_BORDER}`, fontSize: 11, fontWeight: 600 }}
                >
                  TCC · 5 Aspectos de Padesky
                </span>
                {savedAt && (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md"
                    style={{ background: G_BG, color: G, fontSize: 11, fontWeight: 500 }}
                  >
                    <Check className="h-3 w-3" /> Salvo{" "}
                    {savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              <PageIntro
                className="mt-3"
                description="Modelo de 5 Aspectos de Padesky: conecta pensamento, emoção, comportamento, fisiologia e ambiente para entender o ciclo que mantém o sofrimento e planejar intervenções TCC."
              />
            </div>
            <div className="flex w-full sm:w-auto items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportPDF}
                disabled={exporting}
                className="flex-1 sm:flex-none"
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                <span className="hidden sm:inline">Exportar PDF</span>
                <span className="sm:hidden">PDF</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Conteúdo da formulação (componente original — sem alteração de lógica ou campos) */}
        <section
          className="bg-white rounded-[10px] p-4 sm:p-6"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderLeft: `3px solid ${G}` }}
        >
          <CaseFormulation patientId={patientId} />
        </section>
      </div>
    </div>
  );
}
