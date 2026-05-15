import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const isUuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const str = (v: unknown, max = 500) =>
  typeof v === "string" ? v.slice(0, max) : "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    if (req.method === "GET") {
      const templateId = url.searchParams.get("template_id");
      if (!isUuid(templateId)) {
        return json({ error: "template_id inválido" }, 400);
      }
      const { data: tpl } = await admin
        .from("contract_templates")
        .select(
          "id, user_id, professional_name, professional_crp, clauses, lgpd_clause",
        )
        .eq("id", templateId)
        .maybeSingle();
      if (!tpl) return json({ error: "Contrato não encontrado" }, 404);
      // Intentionally omit professional_cpf, professional_address, professional_email
      return json(tpl);
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (!body || !isUuid(body.template_id)) {
        return json({ error: "Dados inválidos" }, 400);
      }
      if (!body.accepted_lgpd) {
        return json({ error: "É necessário aceitar a LGPD" }, 400);
      }
      if (!body.patient_name || !body.patient_cpf) {
        return json({ error: "Nome e CPF são obrigatórios" }, 400);
      }

      const { data: tpl } = await admin
        .from("contract_templates")
        .select("id, user_id")
        .eq("id", body.template_id)
        .maybeSingle();
      if (!tpl) return json({ error: "Contrato não encontrado" }, 404);

      const clauseResp = body.clause_responses;
      const safeClauseResp =
        clauseResp && typeof clauseResp === "object" && !Array.isArray(clauseResp)
          ? clauseResp
          : {};

      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

      const payload = {
        template_id: tpl.id,
        user_id: tpl.user_id,
        patient_name: str(body.patient_name, 200),
        patient_whatsapp: str(body.patient_whatsapp, 50),
        patient_birth_date:
          typeof body.patient_birth_date === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(body.patient_birth_date)
            ? body.patient_birth_date
            : null,
        patient_cpf: str(body.patient_cpf, 50),
        patient_address: str(body.patient_address, 500),
        emergency_contact_name: str(body.emergency_contact_name, 200),
        emergency_contact_relationship: str(
          body.emergency_contact_relationship,
          100,
        ),
        emergency_contact_phone: str(body.emergency_contact_phone, 100),
        clause_responses: safeClauseResp,
        accepted_lgpd: true,
        ip_address: ip,
      };

      const { error } = await admin.from("signed_contracts").insert(payload);
      if (error) {
        console.error("insert error", error);
        return json({ error: "Erro ao salvar contrato" }, 500);
      }

      await admin.from("notifications").insert({
        user_id: tpl.user_id,
        title: "Novo termo assinado",
        message: `${payload.patient_name} assinou o termo de adesão.`,
        type: "general",
      });

      return json({ ok: true });
    }

    return json({ error: "Método não permitido" }, 405);
  } catch (e) {
    console.error(e);
    return json({ error: "Erro inesperado" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
