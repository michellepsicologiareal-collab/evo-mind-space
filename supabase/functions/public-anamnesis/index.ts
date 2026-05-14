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

const ALLOWED_FIELDS = [
  "email", "child_name", "child_birth_date", "schooling", "sleep", "feeding",
  "sexual_curiosity", "relationship_father", "relationship_mother",
  "social_relationship", "school_relationship", "chief_complaint",
  "was_desired", "parents_kinship", "pregnancy_health_issue",
  "pregnancy_health_which", "mother_name", "mother_schooling",
  "mother_profession", "father_name", "father_schooling", "father_profession",
  "weeks_at_birth", "delivery_type", "has_disease",
  "parents_living_together", "parents_relationship", "parents_disorder",
  "parents_disorder_which",
] as const;

const isUuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    if (req.method === "GET") {
      const patientId = url.searchParams.get("patient_id");
      if (!isUuid(patientId)) {
        return json({ error: "patient_id inválido" }, 400);
      }
      const { data: patient } = await admin
        .from("patients")
        .select("id, full_name, user_id")
        .eq("id", patientId)
        .maybeSingle();
      if (!patient) return json({ error: "Paciente não encontrado" }, 404);

      const { data: profile } = await admin
        .from("profiles")
        .select("full_name, crp")
        .eq("id", patient.user_id)
        .maybeSingle();

      return json({
        child_name: patient.full_name ?? "",
        professional_name: profile?.full_name ?? "",
        professional_crp: profile?.crp ?? "",
      });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (!body || !isUuid(body.patient_id)) {
        return json({ error: "Dados inválidos" }, 400);
      }
      if (!body.authorized_lgpd) {
        return json({ error: "É necessário autorizar a LGPD" }, 400);
      }

      const { data: patient } = await admin
        .from("patients")
        .select("id, user_id")
        .eq("id", body.patient_id)
        .maybeSingle();
      if (!patient) return json({ error: "Paciente não encontrado" }, 404);

      const payload: Record<string, unknown> = {
        user_id: patient.user_id,
        patient_id: patient.id,
        authorized_lgpd: true,
      };
      for (const f of ALLOWED_FIELDS) {
        const v = body[f];
        if (typeof v === "string") {
          if (v.length > 5000) {
            return json({ error: `Campo ${f} excede o limite` }, 400);
          }
          payload[f] = v;
        }
      }
      if (body.child_birth_date && /^\d{4}-\d{2}-\d{2}$/.test(body.child_birth_date)) {
        payload.child_birth_date = body.child_birth_date;
      } else {
        payload.child_birth_date = null;
      }

      const { error } = await admin.from("child_anamneses").insert(payload);
      if (error) {
        console.error("insert error", error);
        return json({ error: "Erro ao salvar anamnese" }, 500);
      }

      // Notificar o(a) profissional
      await admin.from("notifications").insert({
        user_id: patient.user_id,
        title: "Nova anamnese recebida",
        message: `${payload.child_name || "Um(a) paciente"} preencheu a anamnese da criança.`,
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
