import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

    const { data: patient } = await supabase
      .from("patients")
      .select("full_name, chief_complaint, anamnesis, notes")
      .eq("id", patient_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!patient) {
      return new Response(JSON.stringify({ error: "Paciente não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const [tccRes, teRes, actRes, recordsRes] = await Promise.all([
      supabase.from("case_formulations").select("environment, thoughts, emotions, behaviors, physical_reactions, core_beliefs, treatment_goals, ai_summary").eq("patient_id", patient_id).eq("user_id", user.id).maybeSingle(),
      supabase.from("schema_formulations").select("padrao_identificado, foco_terapeutico, conexao_gerada, esquemas_identificados, modos_ativados").eq("patient_id", patient_id).eq("user_id", user.id).maybeSingle(),
      supabase.from("act_formulations").select("apresentacao_problema, direcionamento_gerado, valores, fusao_evitacao, acoes_comprometidas").eq("patient_id", patient_id).eq("user_id", user.id).maybeSingle(),
      supabase.from("session_records").select("session_date, themes, clinical_observations, risk_indicator").eq("patient_id", patient_id).eq("user_id", user.id).order("session_date", { ascending: false }).limit(5),
    ]);

    const tcc = tccRes.data;
    const te = teRes.data;
    const act = actRes.data;
    const records = recordsRes.data || [];

    const hasAny = !!(tcc || te || act);
    if (!hasAny) {
      return new Response(JSON.stringify({ error: "Nenhuma formulação preenchida ainda. Preencha ao menos uma (TCC, TE ou ACT) para gerar o resumo integrado." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const goalsText = Array.isArray(tcc?.treatment_goals)
      ? (tcc!.treatment_goals as any[]).map((g: any) => typeof g === "string" ? g : g?.objective || g?.text || "").filter(Boolean).join("; ")
      : "";

    const ctx: string[] = [];
    ctx.push(`Paciente: ${patient.full_name}`);
    if (patient.chief_complaint) ctx.push(`Queixa principal: ${patient.chief_complaint}`);
    if (patient.anamnesis) ctx.push(`Anamnese: ${String(patient.anamnesis).slice(0, 1200)}`);
    if (tcc) {
      ctx.push(`\n[FORMULAÇÃO TCC]\nAmbiente: ${tcc.environment || "-"}\nPensamentos: ${tcc.thoughts || "-"}\nEmoções: ${tcc.emotions || "-"}\nComportamentos: ${tcc.behaviors || "-"}\nReações físicas: ${tcc.physical_reactions || "-"}\nCrenças centrais: ${tcc.core_beliefs || "-"}\nMetas: ${goalsText || "-"}`);
    }
    if (te) {
      ctx.push(`\n[FORMULAÇÃO TE]\nPadrão identificado: ${te.padrao_identificado || "-"}\nFoco terapêutico: ${te.foco_terapeutico || "-"}\nConexão: ${te.conexao_gerada || "-"}\nEsquemas: ${JSON.stringify(te.esquemas_identificados || "-").slice(0, 400)}\nModos: ${JSON.stringify(te.modos_ativados || "-").slice(0, 400)}`);
    }
    if (act) {
      ctx.push(`\n[FORMULAÇÃO ACT]\nApresentação: ${act.apresentacao_problema || "-"}\nDirecionamento: ${act.direcionamento_gerado || "-"}\nValores: ${JSON.stringify(act.valores || "-").slice(0, 300)}\nFusão/Evitação: ${JSON.stringify(act.fusao_evitacao || "-").slice(0, 300)}`);
    }
    if (records.length) {
      ctx.push(`\n[ÚLTIMOS REGISTROS DE SESSÃO]`);
      records.forEach((r: any) => {
        ctx.push(`- ${r.session_date}: temas=${Array.isArray(r.themes) ? r.themes.join(", ") : ""} | obs=${(r.clinical_observations || "").slice(0, 200)} | risco=${r.risk_indicator || "none"}`);
      });
    }

    const systemPrompt = `Você é uma assistente clínica especialista em integração de casos. Integre as formulações TCC, TE e/ou ACT do paciente em um RESUMO INTEGRADO DO CASO claro, organizado e clinicamente útil para a psicóloga consultar antes de cada sessão.

Use linguagem profissional, acolhedora, objetiva. Sem markdown pesado. Use apenas os dados fornecidos — nunca invente.

Retorne via tool save_integrated_summary com:
- visao_geral: 2-3 frases sintetizando o caso (idade/contexto se houver, hipótese diagnóstica integrada, padrão central).
- temas_principais: 4-7 temas clínicos transversais às formulações (lista de strings curtas).
- direcionamento_terapeutico: 2-3 frases integrando técnicas das abordagens preenchidas.
- plano_intervencao: 2-3 frases com objetivos e principais técnicas a serem trabalhadas.
- sinais_alerta: 1 frase curta com indicadores que merecem atenção na próxima sessão (ou "Sem sinais de alerta no momento").`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: ctx.join("\n") },
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_integrated_summary",
            description: "Salva o resumo integrado do caso",
            parameters: {
              type: "object",
              properties: {
                visao_geral: { type: "string" },
                temas_principais: { type: "array", items: { type: "string" } },
                direcionamento_terapeutico: { type: "string" },
                plano_intervencao: { type: "string" },
                sinais_alerta: { type: "string" },
              },
              required: ["visao_geral", "temas_principais", "direcionamento_terapeutico", "plano_intervencao", "sinais_alerta"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_integrated_summary" } },
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error("AI error:", aiRes.status, text);
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Limite de uso da IA atingido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "Falha ao gerar resumo integrado" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiRes.json();
    const call = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      return new Response(JSON.stringify({ error: "IA não retornou estrutura válida" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const parsed = JSON.parse(call.function.arguments);

    const abordagens: string[] = [];
    if (tcc) abordagens.push("TCC");
    if (te) abordagens.push("TE");
    if (act) abordagens.push("ACT");

    return new Response(JSON.stringify({ summary: parsed, abordagens }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("integrate-case-summary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
