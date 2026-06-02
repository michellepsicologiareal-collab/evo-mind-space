import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { patient_id, raw_text, save = true } = await req.json();
    if (!patient_id || !raw_text || typeof raw_text !== "string" || raw_text.trim().length < 20) {
      return new Response(JSON.stringify({ error: "Informe patient_id e um texto descritivo (mín. 20 caracteres)." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const systemPrompt = `Você é uma psicóloga clínica especialista em Terapia Cognitivo-Comportamental, no estilo Christine Padesky (Modelo de 5 Sistemas + Mind Over Mood).
A partir do relato livre da terapeuta sobre um caso, organize uma FORMULAÇÃO TCC estruturada em português, profissional, acolhedora e clinicamente útil.

Preencha cada campo com 2-4 frases curtas e claras. NÃO use markdown, NÃO use bullets, apenas texto corrido por campo.
Se algum campo não tiver informação suficiente no relato, escreva "A investigar." em vez de inventar.
Em treatment_goals, gere 3 a 5 objetivos terapêuticos SMART (específicos, mensuráveis e clinicamente coerentes), cada um como string curta.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "save_formulation",
          description: "Salva uma formulação de caso TCC (modelo Padesky de 5 sistemas).",
          parameters: {
            type: "object",
            properties: {
              environment: { type: "string", description: "Ambiente / situação atual e gatilhos contextuais." },
              thoughts: { type: "string", description: "Pensamentos automáticos centrais identificados." },
              emotions: { type: "string", description: "Emoções predominantes e intensidade quando relatado." },
              behaviors: { type: "string", description: "Comportamentos de enfrentamento, evitação ou padrões observados." },
              physical_reactions: { type: "string", description: "Reações físicas/somáticas associadas." },
              core_beliefs: { type: "string", description: "Crenças centrais e regras condicionais hipotetizadas." },
              treatment_goals: {
                type: "array",
                description: "3 a 5 objetivos terapêuticos SMART.",
                items: { type: "string" },
              },
            },
            required: ["environment", "thoughts", "emotions", "behaviors", "physical_reactions", "core_beliefs", "treatment_goals"],
            additionalProperties: false,
          },
        },
      },
    ];

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Relato livre da terapeuta:\n\n${raw_text}` },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "save_formulation" } },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Limite de uso da IA atingido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, t);
      return new Response(JSON.stringify({ error: "Falha ao gerar formulação" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiRes.json();
    const call = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return new Response(JSON.stringify({ error: "IA não retornou estrutura válida." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let parsed: any;
    try { parsed = JSON.parse(call.function.arguments); } catch {
      return new Response(JSON.stringify({ error: "Resposta da IA inválida." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const formulation = {
      environment: String(parsed.environment ?? ""),
      thoughts: String(parsed.thoughts ?? ""),
      emotions: String(parsed.emotions ?? ""),
      behaviors: String(parsed.behaviors ?? ""),
      physical_reactions: String(parsed.physical_reactions ?? ""),
      core_beliefs: String(parsed.core_beliefs ?? ""),
      treatment_goals: Array.isArray(parsed.treatment_goals)
        ? parsed.treatment_goals.filter((g: any) => typeof g === "string" && g.trim()).map((g: string) => ({ objective: g }))
        : [],
    };

    if (save) {
      // Verify the patient belongs to this user (RLS will enforce too)
      const { data: pat } = await supabase.from("patients").select("id").eq("id", patient_id).eq("user_id", user.id).maybeSingle();
      if (!pat) {
        return new Response(JSON.stringify({ error: "Paciente não encontrado." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { error: upErr } = await supabase
        .from("case_formulations")
        .upsert({ patient_id, user_id: user.id, ...formulation }, { onConflict: "patient_id,user_id" });
      if (upErr) {
        console.error("upsert error", upErr);
        return new Response(JSON.stringify({ error: "Falha ao salvar formulação." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ formulation }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-formulation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
