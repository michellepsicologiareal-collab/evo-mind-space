// Diagnóstico de e-mail (somente admin): verifica domínios autenticados no Resend
// e permite disparar um e-mail de teste com o remetente oficial do Psi Real.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTransactionalEmail, FROM_EMAIL } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isEmail(v: unknown): v is string {
  return typeof v === "string" && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const apiKey = Deno.env.get("RESEND_API_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: any = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch (_) { body = {}; }
    }

    // Status dos domínios no Resend
    const domainsRes = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const domainsBody = await domainsRes.text();
    let domains: any = domainsBody;
    try { domains = JSON.parse(domainsBody); } catch (_) { /* texto puro */ }

    const summary = Array.isArray(domains?.data)
      ? domains.data.map((d: any) => ({ name: d.name, status: d.status, region: d.region }))
      : domains;

    let testEmail: any = null;
    if (isEmail(body?.test_to)) {
      testEmail = await sendTransactionalEmail({
        to: body.test_to,
        subject: "Teste de envio — Psi Real",
        text:
          "Olá,\n\nEste é um e-mail de teste do Psi Real para validar a autenticação do remetente e a entrega das mensagens.\n\nSe você recebeu esta mensagem, o envio está funcionando corretamente.\n\nAbraços,\nEquipe Psi Real",
      });
    } else if (body?.test_to !== undefined) {
      testEmail = { sent: false, reason: "E-mail de destino inválido" };
    }

    return new Response(
      JSON.stringify({ from: FROM_EMAIL, domains: summary, test_email: testEmail }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
