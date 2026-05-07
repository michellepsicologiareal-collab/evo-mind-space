const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_EMAIL = "Psi Real <contato@psireal.app>";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    console.log("Auth email hook payload:", JSON.stringify(payload));

    // Supabase Auth hook payload format
    const user = payload.user;
    const emailData = payload.email_data;

    if (!user?.email || !emailData) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = user.email;
    const actionType = emailData.email_action_type;
    const confirmationUrl = emailData.confirmation_url || "";
    const siteUrl = emailData.site_url || "https://psireal.app";

    let subject = "";
    let html = "";

    switch (actionType) {
      case "signup":
        subject = "Confirme seu cadastro — Psi Real";
        html = buildSignupEmail(confirmationUrl);
        break;
      case "recovery":
        subject = "Redefinir senha — Psi Real";
        html = buildRecoveryEmail(confirmationUrl);
        break;
      case "magic_link":
      case "magiclink":
        subject = "Seu link de acesso — Psi Real";
        html = buildMagicLinkEmail(confirmationUrl);
        break;
      case "email_change":
        subject = "Confirme a alteração de e-mail — Psi Real";
        html = buildEmailChangeEmail(confirmationUrl);
        break;
      case "invite":
        subject = "Você foi convidada — Psi Real";
        html = buildInviteEmail(confirmationUrl);
        break;
      default:
        subject = "Notificação — Psi Real";
        html = buildDefaultEmail(confirmationUrl);
    }

    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject,
        html,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", JSON.stringify(result));
      return new Response(JSON.stringify({ error: result }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Email sent successfully via Resend:", result.id);

    // Return empty body with 200 to tell Supabase Auth we handled the email
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error in auth-email-hook:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function emailWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
    <div style="background:#A57164;padding:24px;text-align:center;">
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">Psi Real</h1>
    </div>
    <div style="padding:32px 28px;">
      ${content}
    </div>
    <div style="padding:16px 28px 24px;text-align:center;border-top:1px solid #f0e8e0;">
      <p style="margin:0;font-size:12px;color:#bbb;">Psi Real — Gestão Inteligente para Psicólogas</p>
    </div>
  </div>
</body>
</html>`;
}

function ctaButton(url: string, text: string): string {
  return `<div style="text-align:center;margin:28px 0;">
    <a href="${url}" style="display:inline-block;padding:14px 36px;background-color:#A57164;color:#ffffff;font-size:15px;font-weight:600;border-radius:999px;text-decoration:none;">${text}</a>
  </div>`;
}

function buildSignupEmail(url: string): string {
  return emailWrapper(`
    <h2 style="font-size:20px;font-weight:600;color:#1a1a1a;margin:0 0 12px;">Bem-vinda ao Psi Real! 🌿</h2>
    <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 8px;">
      Obrigada por se cadastrar. Clique no botão abaixo para confirmar seu e-mail e ativar sua conta.
    </p>
    ${ctaButton(url, "Confirmar meu e-mail")}
    <p style="font-size:13px;color:#999;line-height:1.5;">Se você não criou uma conta no Psi Real, pode ignorar este e-mail.</p>
  `);
}

function buildRecoveryEmail(url: string): string {
  return emailWrapper(`
    <h2 style="font-size:20px;font-weight:600;color:#1a1a1a;margin:0 0 12px;">Redefinir sua senha 🔑</h2>
    <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 8px;">
      Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha.
    </p>
    ${ctaButton(url, "Redefinir senha")}
    <p style="font-size:13px;color:#999;line-height:1.5;">Se você não solicitou a redefinição de senha, pode ignorar este e-mail.</p>
  `);
}

function buildMagicLinkEmail(url: string): string {
  return emailWrapper(`
    <h2 style="font-size:20px;font-weight:600;color:#1a1a1a;margin:0 0 12px;">Seu link de acesso ✨</h2>
    <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 8px;">
      Clique no botão abaixo para acessar sua conta.
    </p>
    ${ctaButton(url, "Acessar minha conta")}
    <p style="font-size:13px;color:#999;line-height:1.5;">Se você não solicitou este link, pode ignorar este e-mail.</p>
  `);
}

function buildEmailChangeEmail(url: string): string {
  return emailWrapper(`
    <h2 style="font-size:20px;font-weight:600;color:#1a1a1a;margin:0 0 12px;">Confirme a alteração de e-mail 📧</h2>
    <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 8px;">
      Clique no botão abaixo para confirmar seu novo endereço de e-mail.
    </p>
    ${ctaButton(url, "Confirmar novo e-mail")}
    <p style="font-size:13px;color:#999;line-height:1.5;">Se você não solicitou esta alteração, pode ignorar este e-mail.</p>
  `);
}

function buildInviteEmail(url: string): string {
  return emailWrapper(`
    <h2 style="font-size:20px;font-weight:600;color:#1a1a1a;margin:0 0 12px;">Você foi convidada! 🎉</h2>
    <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 8px;">
      Você recebeu um convite para usar o Psi Real. Clique no botão abaixo para aceitar.
    </p>
    ${ctaButton(url, "Aceitar convite")}
    <p style="font-size:13px;color:#999;line-height:1.5;">Se você não esperava este convite, pode ignorar este e-mail.</p>
  `);
}

function buildDefaultEmail(url: string): string {
  return emailWrapper(`
    <p style="font-size:15px;color:#555;line-height:1.6;">
      Clique no botão abaixo para continuar.
    </p>
    ${ctaButton(url, "Continuar")}
  `);
}
