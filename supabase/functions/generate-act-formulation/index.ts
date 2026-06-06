import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getAbordagemLabel } from "../_shared/abordagem.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ACT_SYSTEM = `Você é um assistente clínico especializado em Terapia de Aceitação e Compromisso (ACT) baseada em Steven Hayes.

Use exclusivamente linguagem ACT:
- Fusão cognitiva e desfusão
- Evitação experiencial e aceitação
- Valores e ação comprometida
- Flexibilidade psicológica e hexaflex
- Eu como contexto e momento presente

Não use termos de TCC (distorção cognitiva, reestruturação) nem de TE (esquema, modo).
Tom clínico, objetivo, direto. Nunca invente dados clínicos.
Máximo 4 parágrafos por seção.`;

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
      modo = "barreiras", // 'barreiras' | 'direcionamento'
      apresentacao_problema = {},
      hexaflex = {},
      valores = [],
      matriz_act = {},
      barreiras_existentes = "",
    } = body;

    if (!patient_id) {
      return new Response(JSON.stringify({ error: "patient_id requerido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const hexaflexText = Object.entries(hexaflex || {})
      .map(([k, v]: any) => `${k}: score=${v?.score ?? "-"}/5${v?.observacao ? `, manifestação: ${v.observacao}` : ""}${v?.lado ? `, lado: ${v.lado}` : ""}`)
      .join("\n- ") || "(sem dados)";

    const valoresText = Array.isArray(valores) && valores.length
      ? valores.map((v: any) => `${v.dominio}: valor="${v.valor_declarado || "-"}"; ações="${v.acoes_alinhadas || "-"}"; barreiras="${v.barreiras || "-"}"${v.alinhamento ? `; alinhamento=${v.alinhamento}` : ""}`).join("\n- ")
      : "(sem dados)";

    const contexto = `Dados do paciente (ACT):

Apresentação do problema:
- Queixa em linguagem ACT: ${apresentacao_problema?.queixa_act || "-"}
- O que evita/controla: ${apresentacao_problema?.o_que_evita || "-"}
- Custo do controle: ${apresentacao_problema?.custo_controle || "-"}

Hexaflex (6 processos):
- ${hexaflexText}

Valores por domínio:
- ${valoresText}

Matriz ACT:
- Q1 (experiência interna que dificulta): ${matriz_act?.q1_experiencia_interna || "-"}
- Q2 (comportamento de afastamento): ${matriz_act?.q2_comportamento_afastamento || "-"}
- Q3 (valores e quem importa): ${matriz_act?.q3_valores || "-"}
- Q4 (ação comprometida): ${matriz_act?.q4_acao_comprometida || "-"}`;

    let userPrompt = "";
    if (modo === "direcionamento") {
      userPrompt = `${contexto}

${barreiras_existentes ? `Barreiras já identificadas:\n${barreiras_existentes}\n\n` : ""}Gere o DIRECIONAMENTO TERAPÊUTICO ACT em markdown, com exatamente estas 3 seções:

## Processo prioritário
Qual dos 6 processos do hexaflex trabalhar primeiro e por quê (baseado nos scores e na funcionalidade do caso).

## Metáfora ACT recomendada
Indique uma metáfora clínica ACT específica e justifique a escolha. Use uma destas (ou outra clássica): Metáfora do Ônibus, Folhas no Rio, Cabo de Guerra com o Monstro, Xadrez, Mochila de Pedras, Passageiros do Ônibus.

## Exercícios iniciais
Liste 2-3 exercícios ACT específicos para começar o trabalho com este paciente (defusão, desfusão de pensamentos, matriz, observador, clarificação de valores, ação comprometida, mindfulness etc).`;
    } else {
      userPrompt = `${contexto}

Gere as BARREIRAS DE FLEXIBILIDADE PSICOLÓGICA em UM parágrafo (máximo 4 frases), seguindo exatamente este modelo:

"O processo de [processo mais comprometido do hexaflex] é o principal obstáculo à flexibilidade psicológica deste paciente. A regra verbal dominante parece ser '[fusão central identificada]', que alimenta um padrão de [evitação principal observada]. Isso tem custo direto no domínio de [valor mais bloqueado], onde [impacto concreto observado]."

Use apenas dados efetivamente fornecidos acima. Não invente. Use somente vocabulário ACT.`;
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: ACT_SYSTEM },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Limite de uso da IA atingido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, t);
      return new Response(JSON.stringify({ error: "Falha ao gerar formulação ACT" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiRes.json();
    const text = aiData?.choices?.[0]?.message?.content?.trim() ?? "";

    return new Response(
      JSON.stringify({
        result: text,
        modo,
        abordagem: "ACT",
        abordagem_label: getAbordagemLabel("ACT"),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-act-formulation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
