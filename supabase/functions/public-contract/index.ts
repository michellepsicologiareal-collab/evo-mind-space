// Public contract endpoint — token-based single-use signing.
// GET  ?token=<uuid>  → returns template + invite status
// POST { token, patient_*, clause_responses, accepted_lgpd }
//   → atomically marks invite used + inserts signed_contracts row
//
// Access via template_id has been removed. Old /contrato/<templateId>
// links now return 404 by design.

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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string =>
  typeof v === "string" && UUID_RE.test(v);

const str = (v: unknown, max = 500) =>
  typeof v === "string" ? v.slice(0, max) : "";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ??
    ""
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // ─── GET: fetch invite + template by token ─────────────────
    if (req.method === "GET") {
      const token = url.searchParams.get("token");
      if (!isUuid(token)) return json({ error: "token inválido" }, 400);

      const { data, error } = await admin.rpc(
        "get_contract_by_invite_token",
        { _token: token },
      );
      if (error) {
        console.error("get_contract_by_invite_token", error);
        return json({ error: "Erro ao carregar contrato" }, 500);
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return json({ error: "Link inválido ou expirado" }, 404);

      if (row.status !== "active") {
        return json(
          {
            error:
              row.status === "used"
                ? "Este link já foi utilizado."
                : row.status === "revoked"
                ? "Este link foi revogado pelo profissional."
                : "Este link expirou.",
            status: row.status,
          },
          410,
        );
      }

      return json({
        invite_id: row.invite_id,
        template_id: row.template_id,
        professional_name: row.professional_name ?? "",
        professional_crp: row.professional_crp ?? "",
        clauses: row.clauses ?? [],
        lgpd_clause: row.lgpd_clause ?? "",
        expires_at: row.expires_at,
      });
    }

    // ─── POST: submit signed contract ──────────────────────────
    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (!body || !isUuid(body.token)) {
        return json({ error: "Dados inválidos" }, 400);
      }
      if (!body.accepted_lgpd) {
        return json({ error: "É necessário aceitar a LGPD" }, 400);
      }
      const patient_name = str(body.patient_name, 200).trim();
      const patient_cpf = str(body.patient_cpf, 50).trim();
      if (!patient_name || !patient_cpf) {
        return json({ error: "Nome e CPF são obrigatórios" }, 400);
      }

      const clauseResp = body.clause_responses;
      const safeClauseResp =
        clauseResp && typeof clauseResp === "object" &&
          !Array.isArray(clauseResp)
          ? clauseResp
          : {};

      const payload = {
        patient_name,
        patient_cpf,
        patient_whatsapp: str(body.patient_whatsapp, 50),
        patient_birth_date:
          typeof body.patient_birth_date === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(body.patient_birth_date)
            ? body.patient_birth_date
            : null,
        patient_address: str(body.patient_address, 500),
        emergency_contact_name: str(body.emergency_contact_name, 200),
        emergency_contact_relationship: str(
          body.emergency_contact_relationship,
          100,
        ),
        emergency_contact_phone: str(body.emergency_contact_phone, 100),
        clause_responses: safeClauseResp,
        accepted_lgpd: true,
      };

      const ip = clientIp(req);
      const ua = req.headers.get("user-agent") ?? "";

      const { data, error } = await admin.rpc("submit_signed_contract", {
        _token: body.token,
        _payload: payload,
        _ip: ip,
        _ua: ua,
      });

      if (error) {
        const msg = (error.message || "").toLowerCase();
        // Map DB exceptions → HTTP
        if (msg.includes("invite_not_found")) {
          return json({ error: "Link inválido" }, 404);
        }
        if (msg.includes("invite_already_used")) {
          return json({ error: "Este link já foi utilizado." }, 410);
        }
        if (msg.includes("invite_expired")) {
          return json({ error: "Este link expirou." }, 410);
        }
        if (msg.includes("invite_revoked")) {
          return json(
            { error: "Este link foi revogado pelo profissional." },
            410,
          );
        }
        if (msg.includes("lgpd_required")) {
          return json({ error: "É necessário aceitar a LGPD" }, 400);
        }
        if (msg.includes("missing_patient_fields")) {
          return json({ error: "Nome e CPF são obrigatórios" }, 400);
        }
        console.error("submit_signed_contract", error);
        return json({ error: "Erro ao salvar contrato" }, 500);
      }

      return json({ ok: true, signed_contract_id: data });
    }

    return json({ error: "Método não permitido" }, 405);
  } catch (e) {
    console.error(e);
    return json({ error: "Erro inesperado" }, 500);
  }
});
