import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { CaseFormulation } from "@/components/app/CaseFormulation";

const G = "#534AB7";
const G_BG = "#EEEDFE";
const G_BORDER = "#C9C3F0";
const INK = "#1A1A2E";
const MUTED = "#6B7280";
const BG = "#F7F6F3";

export default function FormulacaoTCC() {
  const { id: patientId } = useParams<{ id: string }>();
  const [patientName, setPatientName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId) return;
    (async () => {
      const { data } = await supabase.from("patients").select("full_name").eq("id", patientId).maybeSingle();
      setPatientName(data?.full_name ?? "");
      setLoading(false);
    })();
  }, [patientId]);

  if (loading || !patientId) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}><Loader2 className="h-6 w-6 animate-spin" style={{ color: G }} /></div>;
  }

  return (
    <div className="min-h-screen" style={{ background: BG }}>
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-28 sm:pb-10 space-y-4 sm:space-y-5">
        {/* Header */}
        <header className="bg-white rounded-[10px] p-5 sm:p-6 flex flex-col gap-3" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderLeft: `3px solid ${G}` }}>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="h-8 -ml-2">
              <Link to="/app/pacientes"><ArrowLeft className="h-4 w-4" /> Pacientes</Link>
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px", color: INK }}>Formulação de Caso — 5 Aspectos</h1>
              <p style={{ fontSize: 13, color: MUTED }}>TCC — modelo de 5 sistemas (Padesky) com coach de IA {patientName ? `· ${patientName}` : ""}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ background: G_BG, color: G, border: `1px solid ${G_BORDER}`, fontSize: 11, fontWeight: 600 }}>
                  TCC · 5 Aspectos
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Conteúdo da formulação (mesmo componente do modal) */}
        <section className="bg-white rounded-[10px] p-5 sm:p-6" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderLeft: `3px solid ${G}` }}>
          <CaseFormulation patientId={patientId} />
        </section>
      </div>
    </div>
  );
}
