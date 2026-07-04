import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { patient_id, force, reason: clientReason } = await req.json();
    if (!patient_id) return json({ error: "patient_id requerido" }, 400);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Não autenticado" }, 401);

    // Verifica ownership
    const { data: patient } = await supabase
      .from("patients")
      .select("id, full_name, chief_complaint, birth_date")
      .eq("id", patient_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!patient) return json({ error: "Paciente não encontrado" }, 404);

    // Cache existente
    const { data: existing } = await supabase
      .from("patient_ai_summaries")
      .select("*")
      .eq("patient_id", patient_id)
      .maybeSingle();

    // Conta registros novos desde a última geração
    const since = existing?.generated_at ?? "1970-01-01";
    const [sessRecCount, progCount] = await Promise.all([
      supabase.from("session_records").select("id", { count: "exact", head: true }).eq("patient_id", patient_id).eq("user_id", user.id).gt("updated_at", since),
      supabase.from("patient_progress").select("id", { count: "exact", head: true }).eq("patient_id", patient_id).eq("user_id", user.id).gt("updated_at", since),
    ]);
    const newRecords = (sessRecCount.count ?? 0) + (progCount.count ?? 0);

    // Se há cache e não foi forçado e não há registros novos, retorna cache
    if (existing && !force && newRecords === 0) {
      return json({ summary: existing, cached: true, new_records: 0 });
    }
    // Se aprovado e não forçado, também não regenera (só sinaliza desatualização)
    if (existing && existing.status === "approved" && !force) {
      return json({ summary: existing, cached: true, new_records: newRecords, stale: newRecords > 0 });
    }
    // Se aprovado E forçado: NÃO substitui o conteúdo aprovado.
    // Gera abaixo e grava em pending_draft_*, mantendo summary_data intocado.

    // Coleta dados clínicos mínimos
    const [tccRes, teRes, actRes, recordsRes, progressRes] = await Promise.all([
      supabase.from("case_formulations").select("environment, thoughts, emotions, behaviors, physical_reactions, core_beliefs, treatment_goals, ai_summary, updated_at").eq("patient_id", patient_id).eq("user_id", user.id).maybeSingle(),
      supabase.from("schema_formulations").select("padrao_identificado, foco_terapeutico, conexao_gerada, updated_at").eq("patient_id", patient_id).eq("user_id", user.id).maybeSingle(),
      supabase.from("act_formulations").select("apresentacao_problema, direcionamento_gerado, valores, fusao_evitacao, acoes_comprometidas, updated_at").eq("patient_id", patient_id).eq("user_id", user.id).maybeSingle(),
      supabase.from("session_records").select("id, session_date, themes, clinical_observations, risk_indicator").eq("patient_id", patient_id).eq("user_id", user.id).order("session_date", { ascending: false }).limit(10),
      supabase.from("patient_progress").select("id, created_at, wellbeing_score, wellbeing_source, emotions, attention_flag, clinical_observation, data_model").eq("patient_id", patient_id).eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
    ]);

    const records = recordsRes.data || [];
    const progress = progressRes.data || [];
    const firstName = (patient.full_name || "Paciente").split(" ")[0];
    const age = patient.birth_date ? Math.floor((Date.now() - new Date(patient.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000)) : null;

    const parts: string[] = [];
    parts.push(`Paciente: ${firstName}${age ? `, ${age} anos` : ""}`);
    if (patient.chief_complaint) parts.push(`Queixa: ${patient.chief_complaint}`);
    if (tccRes.data) parts.push(`\n[TCC] Ambiente:${tccRes.data.environment||"-"} | Pensamentos:${tccRes.data.thoughts||"-"} | Emoções:${tccRes.data.emotions||"-"} | Comportamentos:${tccRes.data.behaviors||"-"} | Crenças:${tccRes.data.core_beliefs||"-"}`);
    if (teRes.data) parts.push(`\n[TE] Padrão:${teRes.data.padrao_identificado||"-"} | Foco:${teRes.data.foco_terapeutico||"-"}`);
    if (actRes.data) parts.push(`\n[ACT] Apresentação:${actRes.data.apresentacao_problema||"-"} | Direcionamento:${actRes.data.direcionamento_gerado||"-"}`);
    if (records.length) {
      parts.push(`\n[SESSÕES RECENTES]`);
      records.forEach((r: any) => parts.push(`- ${r.session_date}: temas=${Array.isArray(r.themes)?r.themes.join(", "):""} | obs=${(r.clinical_observations||"").slice(0,250)}`));
    }
    if (progress.length) {
      parts.push(`\n[PROGRESSO RECENTE]`);
      progress.forEach((p: any) => {
        if (p.data_model === "v2_structured") {
          parts.push(`- ${p.created_at?.slice(0,10)}: bem-estar=${p.wellbeing_score??"-"}(${p.wellbeing_source||"-"}) | emoções=${Array.isArray(p.emotions)?p.emotions.join(","):""} | atenção=${p.attention_flag||"-"} | obs=${(p.clinical_observation||"").slice(0,200)}`);
        }
      });
    }

    const systemPrompt = `Você é uma assistente clínica que produz um RESUMO CLÍNICO objetivo para consulta rápida do profissional antes da sessão.

REGRAS OBRIGATÓRIAS:
- NUNCA diagnostique, atribua risco clínico, nem afirme "crise" ou "urgência" — o profissional avalia.
- NUNCA transforme humor baixo automaticamente em crise.
- Para lacunas, escreva EXATAMENTE "informação não disponível" — jamais invente.
- Baseie-se APENAS nos dados fornecidos.
- Linguagem profissional, concisa, sem markdown pesado.

Use a tool save_summary retornando as 6 seções.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    const model = "google/gemini-2.5-flash";
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: parts.join("\n") },
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_summary",
            description: "Salva o resumo clínico",
            parameters: {
              type: "object",
              properties: {
                visao_geral: { type: "string", description: "2-3 frases" },
                temas_recorrentes: { type: "array", items: { type: "string" } },
                evolucao_percebida: { type: "string" },
                intervencoes_estrategias: { type: "array", items: { type: "string" } },
                pontos_acompanhamento: { type: "array", items: { type: "string" } },
                pendencias_documentais: { type: "array", items: { type: "string" } },
              },
              required: ["visao_geral","temas_recorrentes","evolucao_percebida","intervencoes_estrategias","pontos_acompanhamento","pendencias_documentais"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_summary" } },
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error("AI error:", aiRes.status, text);
      if (aiRes.status === 429) return json({ error: "Limite de uso da IA atingido. Tente novamente em instantes." }, 429);
      if (aiRes.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
      return json({ error: "Falha ao gerar resumo" }, 500);
    }

    const aiData = await aiRes.json();
    const call = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) return json({ error: "IA não retornou estrutura válida" }, 500);
    const parsed = JSON.parse(call.function.arguments);
    const tokens = aiData?.usage?.total_tokens ?? null;

    const sourceRecords = {
      session_record_ids: records.map((r: any) => r.id),
      progress_ids: progress.map((p: any) => p.id),
      formulations: {
        tcc: tccRes.data?.updated_at ?? null,
        te: teRes.data?.updated_at ?? null,
        act: actRes.data?.updated_at ?? null,
      },
      generated_from_records: newRecords,
    };

    // Se já existe registro aprovado, grava apenas em pending_draft_* (não substitui aprovado)
    if (existing && existing.status === "approved") {
      const { data: saved, error: updErr } = await admin
        .from("patient_ai_summaries")
        .update({
          pending_draft_data: parsed,
          pending_draft_generated_at: new Date().toISOString(),
          pending_draft_source_records: sourceRecords,
          pending_draft_model: model,
          pending_draft_tokens: tokens,
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (updErr) {
        console.error("pending draft update error", updErr);
        return json({ error: updErr.message }, 500);
      }
      return json({ summary: saved, cached: false, new_records: newRecords, pending_created: true });
    }

    const payload = {
      patient_id,
      user_id: user.id,
      summary_data: parsed,
      status: "draft" as const,
      source_records: sourceRecords,
      model_used: model,
      tokens_used: tokens,
      generated_at: new Date().toISOString(),
      edited_content: null,
      approved_at: null,
      approved_by: null,
      pending_draft_data: null,
      pending_draft_generated_at: null,
      pending_draft_source_records: null,
      pending_draft_model: null,
      pending_draft_tokens: null,
    };

    const { data: saved, error: upsertErr } = await admin
      .from("patient_ai_summaries")
      .upsert(payload, { onConflict: "patient_id" })
      .select()
      .single();

    if (upsertErr) {
      console.error("upsert error", upsertErr);
      return json({ error: upsertErr.message }, 500);
    }

    return json({ summary: saved, cached: false, new_records: newRecords });
  } catch (e) {
    console.error("generate-patient-summary error:", e);
    return json({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});
