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
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { raw_text = "", patient_name = "" } = await req.json();
    if (typeof raw_text !== "string" || raw_text.trim().length < 30) {
      return new Response(JSON.stringify({ error: "Escreva ao menos 30 caracteres descrevendo o caso." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const systemPrompt = `Você é uma SUPERVISORA experiente em Terapia Cognitivo-Comportamental (TCC), no estilo de Christine Padesky e Judith Beck.
A terapeuta vai te enviar um relato LIVRE de um caso — pode ser desorganizado, fragmentado, com hipóteses misturadas.
Sua tarefa é ler como supervisora clínica e devolver uma DEVOLUTIVA DE SUPERVISÃO em português, acolhedora, técnica e prática.

Estruture sua resposta exatamente nestas seções em markdown, nesta ordem:

## 1. Leitura clínica do caso
Síntese de 3-5 frases do que você entendeu da apresentação do paciente.

## 2. Conceitualização TCC (Padesky · 5 sistemas)
- **Ambiente / Gatilhos:** ...
- **Pensamentos automáticos:** ...
- **Emoções:** ...
- **Comportamentos:** ...
- **Reações físicas:** ...

## 3. Hipóteses de crenças centrais e regras condicionais
Liste 2-4 hipóteses, marcando como "Hipótese a investigar:" quando o dado for indireto.

## 4. Pontos fortes e recursos do paciente
Sempre destaque ao menos 2 recursos protetivos.

## 5. Riscos e sinais de alerta
Riscos clínicos, comorbidades, indicação de avaliação psiquiátrica/risco.

## 6. Plano de tratamento sugerido
- Metas SMART (3-5)
- Intervenções TCC recomendadas (com nome técnico: ativação comportamental, reestruturação, exposição, etc.)
- Ordem sugerida para as próximas 3-5 sessões.

## 7. Sugestões de tarefas de casa
2-3 tarefas concretas e mensuráveis.

## 8. Perguntas que eu, supervisora, faria para você
4-6 perguntas que ajudam a terapeuta a aprofundar a conceitualização.

Regras: nunca invente dados que não estão no relato — marque como "a investigar". Use linguagem profissional mas próxima. Não use jargão sem definir. Não inclua disclaimers genéricos.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${patient_name ? `Paciente: ${patient_name}\n\n` : ""}Relato livre da terapeuta:\n\n${raw_text}` },
        ],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Limite de uso da IA atingido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, t);
      return new Response(JSON.stringify({ error: "Falha ao gerar supervisão." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiRes.json();
    const supervision = aiData?.choices?.[0]?.message?.content ?? "";
    if (!supervision) {
      return new Response(JSON.stringify({ error: "IA não retornou resposta." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ supervision }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("supervise-formulation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
