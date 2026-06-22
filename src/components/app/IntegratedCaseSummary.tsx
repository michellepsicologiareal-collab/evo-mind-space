import { useState } from "react";
import { Sparkles, RefreshCw, Loader2, AlertCircle, Eye, BookOpen, Target, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface IntegratedSummary {
  visao_geral: string;
  temas_principais: string[];
  direcionamento_terapeutico: string;
  plano_intervencao: string;
  sinais_alerta: string;
}

export const IntegratedCaseSummary = ({ patientId }: { patientId: string }) => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<IntegratedSummary | null>(null);
  const [abordagens, setAbordagens] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("integrate-case-summary", {
        body: { patient_id: patientId },
      });

      // Tenta extrair a mensagem real do corpo da resposta, mesmo em erros HTTP
      let bodyError: string | null = null;
      let bodyData: any = data;
      if (invokeError) {
        try {
          const ctx: any = (invokeError as any).context;
          if (ctx?.json) bodyData = await ctx.json();
          else if (ctx?.text) bodyData = JSON.parse(await ctx.text());
        } catch {}
        bodyError = bodyData?.error || invokeError.message || "Erro desconhecido";
      } else if ((data as any)?.error) {
        bodyError = (data as any).error;
      }

      if (bodyError) {
        // Mensagens mais amigáveis para erros comuns
        let friendly = bodyError;
        if (/credit|402|payment/i.test(bodyError)) {
          friendly = "Créditos de IA esgotados. Adicione créditos no Lovable (Settings → Plans & credits) para gerar o resumo integrado.";
        } else if (/429|limit/i.test(bodyError)) {
          friendly = "Limite de uso da IA atingido. Tente novamente em alguns instantes.";
        }
        setError(friendly);
        toast.error(friendly);
        return;
      }

      setSummary((bodyData as any).summary);
      setAbordagens((bodyData as any).abordagens || []);
      toast.success("Resumo integrado gerado");
    } catch (e: any) {
      const msg = e?.message || "Erro ao gerar resumo integrado";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="mt-6 rounded-2xl p-4"
      style={{ background: "hsl(var(--card))", border: "0.5px solid hsl(var(--border))" }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <p
            className="uppercase"
            style={{
              fontFamily: "Syne, sans-serif",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "hsl(var(--foreground))",
            }}
          >
            Resumo Integrado do Caso
          </p>
          <span
            style={{
              background: "rgba(150,117,206,0.12)",
              color: "hsl(var(--primary))",
              fontSize: 9,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 40,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            IA
          </span>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 transition-opacity disabled:opacity-60"
          style={{
            background: "hsl(var(--card))",
            border: "0.5px solid hsl(var(--primary))",
            color: "hsl(var(--primary))",
            padding: "6px 12px",
            borderRadius: 40,
            fontFamily: "Syne, sans-serif",
            fontWeight: 600,
            fontSize: 11,
          }}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {summary ? "Atualizar Resumo" : "Gerar Resumo"}
        </button>
      </div>

      {!summary && !error && !loading && (
        <p
          className="italic"
          style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 12, color: "hsl(var(--muted-foreground))" }}
        >
          Clique em "Gerar Resumo" para integrar as formulações preenchidas (TCC, TE e/ou ACT) em uma visão consolidada do caso.
        </p>
      )}

      {error && (
        <div
          className="flex items-start gap-2 rounded-xl p-3"
          style={{ background: "rgba(192,57,43,0.08)", border: "0.5px solid rgba(192,57,43,0.25)" }}
        >
          <AlertCircle className="h-4 w-4 mt-0.5" style={{ color: "#C0392B" }} />
          <p style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 12, color: "#C0392B" }}>{error}</p>
        </div>
      )}

      {summary && (
        <div className="space-y-4">
          <div
            className="rounded-xl p-3 flex items-start gap-2"
            style={{ background: "rgba(150,117,206,0.08)", border: "0.5px solid rgba(150,117,206,0.2)" }}
          >
            <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "hsl(var(--primary))" }} />
            <p style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 11, color: "hsl(var(--brown))", lineHeight: 1.5 }}>
              Este resumo é gerado pela IA com base nas formulações preenchidas e pode conter imprecisões. Sempre revise e valide as informações antes de utilizar em sessão.
            </p>
          </div>

          {abordagens.length > 0 && (
            <p style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
              Este resumo integra as principais informações das formulações preenchidas nas abordagens{" "}
              <strong style={{ color: "hsl(var(--foreground))" }}>{abordagens.join(", ")}</strong>.
            </p>
          )}

          <Section icon={<Eye className="h-4 w-4" />} title="Visão Geral do Caso" color="hsl(var(--primary))">
            <p>{summary.visao_geral}</p>
          </Section>

          <Section icon={<BookOpen className="h-4 w-4" />} title="Principais Temas" color="hsl(var(--brown))">
            <ul className="list-disc pl-5 space-y-1">
              {summary.temas_principais.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </Section>

          <Section icon={<Target className="h-4 w-4" />} title="Direcionamento Terapêutico Integrado" color="hsl(var(--moss))">
            <p>{summary.direcionamento_terapeutico}</p>
          </Section>

          <Section icon={<Activity className="h-4 w-4" />} title="Plano de Intervenção" color="#B8860B">
            <p>{summary.plano_intervencao}</p>
          </Section>

          {summary.sinais_alerta && !/sem sinais/i.test(summary.sinais_alerta) && (
            <div
              className="rounded-xl p-3 flex items-start gap-2"
              style={{ background: "rgba(192,57,43,0.08)", border: "0.5px solid rgba(192,57,43,0.25)" }}
            >
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#C0392B" }} />
              <p style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: 12, color: "#C0392B" }}>
                <strong>Sinais de alerta:</strong> {summary.sinais_alerta}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Section = ({
  icon,
  title,
  color,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  children: React.ReactNode;
}) => (
  <div>
    <div className="flex items-center gap-2 mb-1.5">
      <span style={{ color }}>{icon}</span>
      <p
        style={{
          fontFamily: "Syne, sans-serif",
          fontSize: 13,
          fontWeight: 700,
          color: "hsl(var(--foreground))",
        }}
      >
        {title}
      </p>
    </div>
    <div
      style={{
        fontFamily: "Instrument Sans, sans-serif",
        fontSize: 12.5,
        color: "hsl(var(--brown))",
        lineHeight: 1.55,
        paddingLeft: 24,
      }}
    >
      {children}
    </div>
  </div>
);
