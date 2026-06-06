import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { fetchAbordagem, buildAbordagemBlock, getAbordagemLabel } from "../_shared/abordagem.ts";

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

    const { patient_id, raw_text = "", save = true, include_clinical_context = true } = await req.json();
    if (!patient_id) {
      return new Response(JSON.stringify({ error: "Informe patient_id." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const hasText = typeof raw_text === "string" && raw_text.trim().length >= 20;
    if (!hasText && !include_clinical_context) {
      return new Response(JSON.stringify({ error: "Escreva ao menos 20 caracteres ou inclua os registros clínicos." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify patient ownership early (also enforced by RLS).
    const { data: patient } = await supabase
      .from("patients")
      .select("id, full_name, chief_complaint, anamnesis, notes, treatment_plan")
      .eq("id", patient_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!patient) {
      return new Response(JSON.stringify({ error: "Paciente não encontrado." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Optionally pull recent clinical context.
    let clinicalContext = "";
    if (include_clinical_context) {
      const [sessionsRes, recordsRes, evolutionsRes, progressRes] = await Promise.all([
        supabase
          .from("sessions")
          .select("scheduled_at, notes, status")
          .eq("user_id", user.id)
          .eq("patient_id", patient_id)
          .not("notes", "is", null)
          .order("scheduled_at", { ascending: false })
          .limit(10),
        supabase
          .from("session_records")
          .select("session_date, chief_complaint, themes, clinical_observations, next_session_plan, risk_indicator, engagement")
          .eq("user_id", user.id)
          .eq("patient_id", patient_id)
          .order("session_date", { ascending: false })
          .limit(8),
        supabase
          .from("session_evolutions")
          .select("created_at, session_summary, homework")
          .eq("user_id", user.id)
          .eq("patient_id", patient_id)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("patient_progress")
          .select("recorded_at, mood_score, note")
          .eq("user_id", user.id)
          .eq("patient_id", patient_id)
          .order("recorded_at", { ascending: false })
          .limit(10),
      ]);

      const trim = (s?: string | null, n = 800) => (s ?? "").toString().trim().slice(0, n);
      const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "");

      const parts: string[] = [];
      parts.push(`Paciente: ${patient.full_name}`);
      if (patient.chief_complaint) parts.push(`Queixa principal cadastrada: ${trim(patient.chief_complaint, 600)}`);
      if (patient.anamnesis) parts.push(`Anamnese resumida: ${trim(patient.anamnesis, 1200)}`);
      if (patient.notes) parts.push(`Notas gerais do paciente: ${trim(patient.notes, 800)}`);
      if (patient.treatment_plan) parts.push(`Plano de tratamento atual: ${trim(patient.treatment_plan, 800)}`);

      if (recordsRes.data?.length) {
        parts.push("\nRegistros de sessão recentes:");
        recordsRes.data.forEach((r: any, i: number) => {
          const themes = Array.isArray(r.themes) ? r.themes.join(", ") : "";
          parts.push(`- (${fmtDate(r.session_date)}) Queixa: ${trim(r.chief_complaint, 240)} | Temas: ${themes} | Observações: ${trim(r.clinical_observations, 400)} | Próximo plano: ${trim(r.next_session_plan, 240)} | Risco: ${r.risk_indicator ?? "none"} | Engajamento: ${r.engagement ?? "-"}`);
        });
      }

      if (evolutionsRes.data?.length) {
        parts.push("\nEvoluções de sessão recentes:");
        evolutionsRes.data.forEach((e: any) => {
          parts.push(`- (${fmtDate(e.created_at)}) Resumo: ${trim(e.session_summary, 400)} | Tarefa: ${trim(e.homework, 240)}`);
        });
      }

      if (sessionsRes.data?.length) {
        parts.push("\nNotas livres de sessões recentes:");
        sessionsRes.data.forEach((s: any) => {
          parts.push(`- (${fmtDate(s.scheduled_at)} • ${s.status}) ${trim(s.notes, 500)}`);
        });
      }

      if (progressRes.data?.length) {
        parts.push("\nRegistros de humor/progresso:");
        progressRes.data.forEach((p: any) => {
          parts.push(`- (${fmtDate(p.recorded_at)}) Humor: ${p.mood_score ?? "-"} | Nota: ${trim(p.note, 240)}`);
        });
      }

      clinicalContext = parts.join("\n");
    }


    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const abordagem = await fetchAbordagem(supabase, patient_id);
    const abordagemBlock = buildAbordagemBlock(abordagem, patient.full_name);

    const systemPrompt = `${abordagemBlock}

A partir do relato livre da terapeuta sobre um caso, organize uma FORMULAÇÃO DE CASO estruturada em português, profissional, acolhedora e clinicamente útil, usando obrigatoriamente a linguagem técnica da abordagem ${abordagem} indicada acima.

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
          {
            role: "user",
            content: [
              clinicalContext ? `Contexto clínico do paciente (registros e notas mais recentes):\n${clinicalContext}` : "",
              hasText ? `Relato livre adicional da terapeuta:\n${raw_text}` : "",
              "Com base no que está disponível acima, gere a formulação TCC estruturada chamando a função save_formulation.",
            ].filter(Boolean).join("\n\n"),
          },
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
      const { error: upErr } = await supabase
        .from("case_formulations")
        .upsert({ patient_id, user_id: user.id, ...formulation }, { onConflict: "patient_id,user_id" });
      if (upErr) {
        console.error("upsert error", upErr);
        return new Response(JSON.stringify({ error: "Falha ao salvar formulação." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ formulation, used_clinical_context: !!clinicalContext, abordagem, abordagem_label: getAbordagemLabel(abordagem) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-formulation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
