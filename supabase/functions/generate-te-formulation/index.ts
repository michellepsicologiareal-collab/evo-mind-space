import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getAbordagemLabel } from "../_shared/abordagem.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TE_SYSTEM = `Você é um assistente clínico especializado em Terapia do Esquema baseada em Jeffrey Young.

Use exclusivamente linguagem da Terapia do Esquema:
- Esquemas Iniciais Desadaptativos (EIDs) e domínios de esquema
- Modos esquemáticos (criança vulnerável, criança raivosa, protetor evitador, capitulador complacente, supercompensador, pai/mãe punitivo, pai/mãe exigente, adulto saudável)
- Necessidades emocionais básicas não atendidas
- Reparentalização limitada e trabalho experiencial

NÃO use termos de TCC (distorção cognitiva, reestruturação cognitiva, registro de pensamento) nem de ACT (desfusão, hexaflex, valores).
Tom clínico, objetivo, direto. Nunca invente dados clínicos.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const {
      patient_id,
      mode = "conexao", // 'conexao' | 'foco'
      historia_origem = "",
      ambiente_familiar = "",
      figuras_vinculacao = "",
      eventos_marcantes = "",
      padrao_identificado = "",
      necessidades = [],
      outras_necessidades = "",
      esquemas = [],
      modos = {},
      adulto_saudavel_forca = null,
      conexao_existente = "",
    } = body;

    if (!patient_id) {
      return new Response(JSON.stringify({ error: "patient_id requerido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const necessidadesText = Array.isArray(necessidades) && necessidades.length
      ? necessidades.join("; ")
      : "(nenhuma marcada)";

    const esquemasText = Array.isArray(esquemas) && esquemas.length
      ? esquemas.map((e: any) => `${e.nome ?? e}${e.intensidade ? ` (${e.intensidade})` : ""}${e.manifestacao ? ` — manifestação: ${e.manifestacao}` : ""}`).join("\n- ")
      : "(nenhum selecionado)";

    const modosText = modos && typeof modos === "object" && Object.keys(modos).length
      ? Object.entries(modos)
          .filter(([_, v]: any) => v?.ativo)
          .map(([k, v]: any) => `${k}: freq=${v.frequencia ?? "-"}${v.manifestacao ? `, manifestação: ${v.manifestacao}` : ""}`)
          .join("\n- ")
      : "(nenhum modo ativo)";

    const contexto = `Dados do paciente (Terapia do Esquema):

História de origem:
- Ambiente familiar: ${ambiente_familiar || "-"}
- Figuras de vinculação: ${figuras_vinculacao || "-"}
- Eventos marcantes: ${eventos_marcantes || "-"}
- Padrão identificado: ${padrao_identificado || "-"}
- Histórico adicional: ${historia_origem || "-"}

Necessidades emocionais básicas não atendidas:
- ${necessidadesText}
${outras_necessidades ? `- Outras: ${outras_necessidades}` : ""}

Esquemas Iniciais Desadaptativos (EIDs):
- ${esquemasText}

Modos esquemáticos ativos:
- ${modosText}
${adulto_saudavel_forca ? `Força atual do Adulto Saudável: ${adulto_saudavel_forca}/5` : ""}`;

    let userPrompt = "";
    if (mode === "foco") {
      userPrompt = `${contexto}

${conexao_existente ? `Padrão central já gerado:\n${conexao_existente}\n\n` : ""}Gere o FOCO TERAPÊUTICO usando exatamente este formato em markdown, máximo 4 parágrafos curtos no total:

## Esquema prioritário
Qual EID deve ser trabalhado primeiro e por quê.

## Modo a fortalecer
Como desenvolver o Adulto Saudável neste caso e qual modo precisa ser reduzido/integrado.

## Necessidade central
Qual necessidade emocional básica deve ser reparentalizada como prioridade.`;
    } else {
      userPrompt = `${contexto}

Gere o PADRÃO CENTRAL em UM parágrafo único (máximo 4 frases), seguindo exatamente este modelo:

"O esquema de [EID principal] — originado em [contexto da história de origem] — ativa o modo [modo dominante] diante de [gatilho típico]. Isso se manifesta como [comportamento/padrão atual], reforçando a crença de [crença esquemática central]."

Use apenas EIDs e modos efetivamente listados acima. Não invente dados. Use somente vocabulário da Terapia do Esquema.`;
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: TE_SYSTEM },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Limite de uso da IA atingido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, t);
      return new Response(JSON.stringify({ error: "Falha ao gerar formulação TE" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiRes.json();
    const text = aiData?.choices?.[0]?.message?.content?.trim() ?? "";

    return new Response(
      JSON.stringify({
        result: text,
        mode,
        abordagem: "TE",
        abordagem_label: getAbordagemLabel("TE"),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-te-formulation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
