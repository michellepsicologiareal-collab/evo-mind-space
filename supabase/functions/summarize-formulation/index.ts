import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { fetchAbordagem, buildAbordagemBlock, getAbordagemLabel } from "../_shared/abordagem.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { patient_id } = await req.json();
    if (!patient_id) {
      return new Response(JSON.stringify({ error: "patient_id requerido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: f, error: fErr } = await supabase
      .from("case_formulations")
      .select("environment, thoughts, emotions, behaviors, physical_reactions, core_beliefs, treatment_goals")
      .eq("patient_id", patient_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fErr || !f) {
      return new Response(JSON.stringify({ error: "Formulação não encontrada" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const goalsText = Array.isArray(f.treatment_goals)
      ? (f.treatment_goals as any[]).map((g: any) => typeof g === "string" ? g : g?.objective || g?.text || g?.title || g?.description || "").filter(Boolean).join("; ")
      : "";

    const abordagem = await fetchAbordagem(supabase, patient_id);
    const abordagemBlock = buildAbordagemBlock(abordagem);

    const prompt = `Resuma em 2-3 frases curtas (máx 320 caracteres) os destaques clínicos desta formulação de caso, em português, tom profissional e acolhedor, usando obrigatoriamente a linguagem técnica da abordagem ${abordagem}. Destaque o padrão central e direção terapêutica. Sem títulos, sem markdown.

Ambiente/Situação: ${f.environment || "-"}
Pensamentos: ${f.thoughts || "-"}
Emoções: ${f.emotions || "-"}
Comportamentos: ${f.behaviors || "-"}
Reações físicas: ${f.physical_reactions || "-"}
Crenças centrais: ${f.core_beliefs || "-"}
Metas: ${goalsText || "-"}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: abordagemBlock },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de uso da IA atingido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "Falha ao gerar resumo", details: text }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiRes.json();
    const summary: string = aiData?.choices?.[0]?.message?.content?.trim() || "";

    if (summary) {
      await supabase
        .from("case_formulations")
        .update({ ai_summary: summary })
        .eq("patient_id", patient_id)
        .eq("user_id", user.id);
    }

    return new Response(JSON.stringify({ summary, abordagem, abordagem_label: getAbordagemLabel(abordagem) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("summarize-formulation error:", e);
    return new Response(JSON.stringify({ error: "Erro ao gerar resumo" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
