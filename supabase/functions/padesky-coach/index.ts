import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // --- Auth check ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { systems, coreBeliefs, question } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const ctx = `
**Ambiente:** ${systems?.environment || "(vazio)"}
**Pensamentos:** ${systems?.thoughts || "(vazio)"}
**Emoções:** ${systems?.emotions || "(vazio)"}
**Comportamentos:** ${systems?.behaviors || "(vazio)"}
**Reações Físicas:** ${systems?.physical_reactions || "(vazio)"}
**Crenças Nucleares:** ${coreBeliefs || "(vazio)"}
`.trim();

    const userPrompt = question?.trim()
      ? `Contexto atual da formulação:\n\n${ctx}\n\nPergunta da psicóloga: ${question}`
      : `Analise a formulação abaixo e ajude a psicóloga a pensar como uma terapeuta TCC experiente, no estilo de Christine Padesky.\n\n${ctx}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um(a) supervisor(a) clínico(a) experiente em Terapia Cognitivo-Comportamental, treinado(a) na abordagem de Christine Padesky (Modelo de 5 Sistemas + Mind Over Mood). Seu papel **NÃO é responder pela psicóloga**, mas **ensiná-la a pensar** clinicamente.

Princípios:
- Use **questionamento Socrático**: faça perguntas que abram hipóteses ao invés de dar diagnósticos prontos.
- Conecte os 5 sistemas (Ambiente, Pensamentos, Emoções, Comportamentos, Reações Físicas) mostrando ciclos de manutenção.
- Sugira hipóteses cognitivas tentativas ("uma possibilidade é..."), nunca afirmações fechadas.
- Aponte o que está faltando na formulação para clarear o caso.
- Sugira perguntas-chave que a psi pode levar para a próxima sessão.
- Sugira possíveis intervenções TCC (registro de pensamentos, experimentos comportamentais, ativação, exposição, etc.) e POR QUE fariam sentido aqui.
- NÃO faça diagnóstico DSM/CID. NÃO use jargão sem explicar.
- Linguagem acolhedora, profissional e didática — como uma supervisora gentil.

Formato de saída em markdown, usando estas seções quando fizer sentido:
## Leitura do caso
(síntese socrática do que se vê nos 5 sistemas)
## Hipóteses cognitivas a considerar
## Ciclo de manutenção
## Perguntas Socráticas para a próxima sessão
## Intervenções TCC sugeridas
## O que ainda falta investigar`,
          },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Contate o administrador." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao consultar coach." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("padesky-coach error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
