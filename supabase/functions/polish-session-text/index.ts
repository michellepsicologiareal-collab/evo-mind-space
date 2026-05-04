import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { chief_complaint, clinical_observations, next_session_plan, private_notes } = await req.json();

    const texts = [
      chief_complaint && `Queixa/Tema: ${chief_complaint}`,
      clinical_observations && `Observações clínicas: ${clinical_observations}`,
      next_session_plan && `Combinados: ${next_session_plan}`,
      private_notes && `Notas privadas: ${private_notes}`,
    ].filter(Boolean).join("\n\n");

    if (!texts.trim()) {
      return new Response(JSON.stringify({ error: "Nenhum texto para revisar." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um assistente de redação clínica para psicólogos. Sua tarefa é revisar e melhorar os textos de registro de sessão.

Regras:
- Corrija erros de ortografia e gramática.
- Melhore a clareza e a coesão textual.
- Mantenha o sentido original — NÃO adicione informações nem faça interpretações.
- Use linguagem profissional, técnica e objetiva.
- NÃO faça diagnósticos, NÃO mencione DSM-5, CID ou transtornos.
- NÃO use emojis.
- Retorne no formato JSON com as chaves: chief_complaint, clinical_observations, next_session_plan, private_notes.
- Se um campo estava vazio, retorne string vazia para ele.`
          },
          {
            role: "user",
            content: `Revise e melhore estes textos de registro de sessão:\n\n${texts}`
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Contate o administrador." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao processar texto." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Try to parse JSON from the AI response
    let result: any = {};
    try {
      // Remove markdown code fences if present
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      // If not JSON, return the raw text as clinical_observations
      result = {
        chief_complaint: chief_complaint || "",
        clinical_observations: content,
        next_session_plan: next_session_plan || "",
        private_notes: private_notes || "",
      };
    }

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("polish-session-text error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
