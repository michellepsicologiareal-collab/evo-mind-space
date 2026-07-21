// Scheduled function to send trial/subscription expiration warnings.
// Trigger via pg_cron or manually. Requires email infrastructure to be set up.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TRIAL_DAYS = 14;

const emailSubjects: Record<string, string> = {
  trial_warning: "Seu período gratuito no Psi Real está acabando",
  subscription_warning: "Seu plano no Psi Real está próximo do vencimento",
};

function fmt(d: string | null): string {
  if (!d) return "em breve";
  return new Date(d).toLocaleDateString("pt-BR");
}

function trialBody(name: string, trialEnd: string) {
  return `Olá ${name || "psicólogo(a)"},\n\nSeu período gratuito de ${TRIAL_DAYS} dias no Psi Real termina em ${fmt(
    trialEnd,
  )}. Para continuar usando sem interrupções, escolha um plano em https://psireal.app/app/profile.\n\nAbraços,\nEquipe Psi Real`;
}

function subBody(name: string, subEnd: string) {
  return `Olá ${name || "psicólogo(a)"},\n\nSeu plano no Psi Real vence em ${fmt(
    subEnd,
  )}. Renove sua assinatura para manter todos os recursos ativos.\n\nAbraços,\nEquipe Psi Real`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const in3days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = now.toISOString();

    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const emailById = new Map<string, string>();
    (users?.users ?? []).forEach((u: any) => { if (u.email) emailById.set(u.id, u.email); });

    // Trial ends within 3 days
    const { data: trialProfiles } = await admin
      .from("profiles")
      .select("id, full_name, trial_ends_at, subscription_status")
      .eq("is_approved", true)
      .not("trial_ends_at", "is", null)
      .lte("trial_ends_at", in3days)
      .gte("trial_ends_at", nowIso);

    // Subscription ends within 7 days
    const { data: subProfiles } = await admin
      .from("profiles")
      .select("id, full_name, subscription_ends_at, subscription_status")
      .in("subscription_status", ["active", "pending"] as any)
      .not("subscription_ends_at", "is", null)
      .lte("subscription_ends_at", in7days)
      .gte("subscription_ends_at", nowIso);

    let trialSent = 0;
    let subSent = 0;

    for (const p of (trialProfiles ?? []) as any[]) {
      const email = emailById.get(p.id);
      if (!email) continue;
      const { error } = await admin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          to: email,
          subject: emailSubjects.trial_warning,
          text: trialBody(p.full_name ?? "", p.trial_ends_at),
          template_name: "trial_warning",
        },
      });
      if (!error) trialSent++;
    }

    for (const p of (subProfiles ?? []) as any[]) {
      const email = emailById.get(p.id);
      if (!email) continue;
      const { error } = await admin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          to: email,
          subject: emailSubjects.subscription_warning,
          text: subBody(p.full_name ?? "", p.subscription_ends_at),
          template_name: "subscription_warning",
        },
      });
      if (!error) subSent++;
    }

    return new Response(
      JSON.stringify({ ok: true, trial_sent: trialSent, subscription_sent: subSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
