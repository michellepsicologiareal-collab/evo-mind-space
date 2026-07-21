import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "approve" | "reject" | "reactivate" | "delete";

const TRIAL_DAYS = 14;

const emailSubjects: Record<string, string> = {
  approve: "Sua conta no Psi Real foi aprovada 🎉",
  reject: "Atualização sobre sua solicitação no Psi Real",
  reactivate: "Sua conta no Psi Real foi reativada",
  trial_warning: "Seu período gratuito no Psi Real está acabando",
  subscription_warning: "Seu plano no Psi Real está próximo do vencimento",
};

function emailBody(action: string, name: string, extras: Record<string, string> = {}): string {
  const greeting = `Olá ${name || "psicólogo(a)"},`;
  const appUrl = "https://psireal.app";
  const signature = `\n\nAbraços,\nEquipe Psi Real`;
  switch (action) {
    case "approve": {
      const trialEnd = extras.trial_ends_at
        ? new Date(extras.trial_ends_at).toLocaleDateString("pt-BR")
        : "";
      return `${greeting}\n\nSua conta foi aprovada e já pode ser acessada em ${appUrl}.\n\nVocê tem ${TRIAL_DAYS} dias gratuitos para explorar o Psi Real${
        trialEnd ? ` (até ${trialEnd})` : ""
      }. Aproveite para cadastrar pacientes, criar formulações e organizar sua agenda.${signature}`;
    }
    case "reject":
      return `${greeting}\n\nApós análise, sua solicitação de acesso ao Psi Real não foi aprovada neste momento. Se acredita que houve engano, responda este e-mail para revisarmos seu cadastro.${signature}`;
    case "reactivate":
      return `${greeting}\n\nSua conta no Psi Real foi reativada. Você já pode acessar em ${appUrl}.${signature}`;
    case "trial_warning": {
      const trialEnd = extras.trial_ends_at
        ? new Date(extras.trial_ends_at).toLocaleDateString("pt-BR")
        : "em breve";
      return `${greeting}\n\nSeu período gratuito de ${TRIAL_DAYS} dias no Psi Real termina em ${trialEnd}. Para continuar usando sem interrupções, escolha um plano em ${appUrl}/app/profile.${signature}`;
    }
    case "subscription_warning": {
      const subEnd = extras.subscription_ends_at
        ? new Date(extras.subscription_ends_at).toLocaleDateString("pt-BR")
        : "em breve";
      return `${greeting}\n\nSeu plano no Psi Real vence em ${subEnd}. Renove sua assinatura para manter todos os recursos ativos.${signature}`;
    }
    default:
      return `${greeting}${signature}`;
  }
}

async function sendEmail(
  supabase: any,
  to: string,
  emailAction: string,
  name: string,
  extras: Record<string, string> = {},
): Promise<{ sent: boolean; reason?: string }> {
  try {
    const { error } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to,
        subject: emailSubjects[emailAction],
        text: emailBody(emailAction, name, extras),
        template_name: `admin_${emailAction}`,
      },
    });
    if (error) return { sent: false, reason: error.message };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

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

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
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

    const { userId, action } = (await req.json()) as { userId: string; action: Action };
    if (!userId || !action) {
      return new Response(JSON.stringify({ error: "Missing params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load target user info for email
    const { data: targetAuth } = await adminClient.auth.admin.getUserById(userId);
    const targetEmail = targetAuth?.user?.email ?? null;
    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    const targetName = (targetProfile as any)?.full_name ?? "";

    let emailInfo: { sent: boolean; reason?: string } = { sent: false, reason: "no_email" };

    if (action === "approve") {
      const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await adminClient
        .from("profiles")
        .update({
          is_approved: true,
          rejected_at: null,
          trial_ends_at: trialEnd,
        } as any)
        .eq("id", userId);
      if (error) throw error;
      if (targetEmail) {
        emailInfo = await sendEmail(adminClient, targetEmail, "approve", targetName, {
          trial_ends_at: trialEnd,
        });
      }
    } else if (action === "reject") {
      const { error } = await adminClient
        .from("profiles")
        .update({
          is_approved: false,
          rejected_at: new Date().toISOString(),
        } as any)
        .eq("id", userId);
      if (error) throw error;
      if (targetEmail) {
        emailInfo = await sendEmail(adminClient, targetEmail, "reject", targetName);
      }
    } else if (action === "reactivate") {
      const { error } = await adminClient
        .from("profiles")
        .update({
          is_approved: true,
          rejected_at: null,
        } as any)
        .eq("id", userId);
      if (error) throw error;
      if (targetEmail) {
        emailInfo = await sendEmail(adminClient, targetEmail, "reactivate", targetName);
      }
    } else if (action === "delete") {
      // Delete profile first (cascades via app data / handled by FKs); then auth user
      await adminClient.from("profiles").delete().eq("id", userId);
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) throw error;
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, email: emailInfo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
