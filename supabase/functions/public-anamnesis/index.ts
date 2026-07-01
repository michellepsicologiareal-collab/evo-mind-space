import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

// Best-effort throttle em memória (por token e por IP)
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const buckets = new Map<string, number[]>();
function throttle(key: string): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  buckets.set(key, arr);
  return arr.length > MAX_PER_WINDOW;
}

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const first = xff.split(",")[0]?.trim();
  return first || req.headers.get("cf-connecting-ip") || "";
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ip = clientIp(req);
    const ua = req.headers.get("user-agent") ?? "";

    if (req.method === "GET") {
      const token = new URL(req.url).searchParams.get("token");
      if (!isUuid(token)) return json({ error: "token inválido" }, 400);
      if (throttle(`ip:${ip}`) || throttle(`tk:${token}`)) {
        return json({ error: "Muitas tentativas. Aguarde um instante." }, 429);
      }

      const { data, error } = await admin.rpc("get_child_anamnesis_by_invite_token", { _token: token });
      if (error) {
        console.error("rpc get error", error);
        return json({ error: "Erro ao validar link" }, 500);
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return json({ error: "Link inválido ou expirado" }, 404);

      if (row.status === "expired") return json({ error: "Este link expirou.", status: "expired" }, 410);
      if (row.status === "revoked") return json({ error: "Este link foi revogado pelo profissional.", status: "revoked" }, 410);
      if (row.status === "used") return json({ error: "Este link já foi utilizado.", status: "used" }, 410);

      return json({
        child_name: row.child_name ?? "",
        professional_name: row.professional_name ?? "",
        professional_crp: row.professional_crp ?? "",
        expires_at: row.expires_at,
        status: "active",
      });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (!body || !isUuid(body.token)) return json({ error: "Dados inválidos" }, 400);
      if (throttle(`ip:${ip}`) || throttle(`tk:${body.token}`)) {
        return json({ error: "Muitas tentativas. Aguarde um instante." }, 429);
      }

      // Nunca aceitar ip/user_agent vindos do cliente — server side only
      const { token, ip: _ip, ip_address: _ipa, user_agent: _ua, ...clean } = body;

      const { data, error } = await admin.rpc("submit_child_anamnesis", {
        _token: token,
        _payload: { ...clean, authorized_lgpd: !!body.authorized_lgpd },
        _ip: ip,
        _ua: ua,
      });

      if (error) {
        const msg = (error.message ?? "").toLowerCase();
        if (msg.includes("invite_revoked")) return json({ error: "Este link foi revogado pelo profissional.", status: "revoked" }, 410);
        if (msg.includes("invite_already_used")) return json({ error: "Este link já foi utilizado.", status: "used" }, 410);
        if (msg.includes("invite_expired")) return json({ error: "Este link expirou.", status: "expired" }, 410);
        if (msg.includes("invite_not_found")) return json({ error: "Link inválido" }, 404);
        if (msg.includes("lgpd_required")) return json({ error: "É necessário autorizar a LGPD" }, 400);
        if (msg.includes("missing_child_name")) return json({ error: "Nome da criança é obrigatório" }, 400);
        console.error("rpc submit error", error);
        return json({ error: "Erro ao salvar anamnese" }, 500);
      }

      return json({ ok: true, anamnesis_id: data });
    }

    return json({ error: "Método não permitido" }, 405);
  } catch (e) {
    console.error(e);
    return json({ error: "Erro inesperado" }, 500);
  }
});
