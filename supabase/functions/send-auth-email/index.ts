import { corsHeaders } from '@supabase/supabase-js/cors'

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_EMAIL = "Psi Real <contato@psireal.app>";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { type, email, confirmation_url, token_hash, redirect_to } = await req.json();

    let subject = "";
    let html = "";

    if (type === "signup" || type === "email_confirmation") {
      subject = "Confirme seu cadastro — Psi Real";
      html = `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0;">Psi Real</h1>
          </div>
          <h2 style="font-size: 20px; font-weight: 600; color: #1a1a1a; margin-bottom: 12px;">Bem-vinda ao Psi Real! 🌿</h2>
          <p style="font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 24px;">
            Obrigada por se cadastrar. Clique no botão abaixo para confirmar seu e-mail e ativar sua conta.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${confirmation_url}" style="display: inline-block; padding: 14px 32px; background-color: #A57164; color: #ffffff; font-size: 15px; font-weight: 600; border-radius: 999px; text-decoration: none;">
              Confirmar meu e-mail
            </a>
          </div>
          <p style="font-size: 13px; color: #999; line-height: 1.5; margin-top: 32px;">
            Se você não criou uma conta no Psi Real, pode ignorar este e-mail.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="font-size: 12px; color: #bbb; text-align: center;">Psi Real — Gestão Inteligente para Psicólogas</p>
        </div>
      `;
    } else if (type === "recovery" || type === "password_recovery") {
      subject = "Redefinir senha — Psi Real";
      html = `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0;">Psi Real</h1>
          </div>
          <h2 style="font-size: 20px; font-weight: 600; color: #1a1a1a; margin-bottom: 12px;">Redefinir sua senha 🔑</h2>
          <p style="font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 24px;">
            Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${confirmation_url}" style="display: inline-block; padding: 14px 32px; background-color: #A57164; color: #ffffff; font-size: 15px; font-weight: 600; border-radius: 999px; text-decoration: none;">
              Redefinir senha
            </a>
          </div>
          <p style="font-size: 13px; color: #999; line-height: 1.5; margin-top: 32px;">
            Se você não solicitou a redefinição de senha, pode ignorar este e-mail. Sua senha permanecerá a mesma.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="font-size: 12px; color: #bbb; text-align: center;">Psi Real — Gestão Inteligente para Psicólogas</p>
        </div>
      `;
    } else if (type === "magic_link" || type === "magiclink") {
      subject = "Seu link de acesso — Psi Real";
      html = `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0;">Psi Real</h1>
          </div>
          <h2 style="font-size: 20px; font-weight: 600; color: #1a1a1a; margin-bottom: 12px;">Seu link de acesso ✨</h2>
          <p style="font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 24px;">
            Clique no botão abaixo para acessar sua conta.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${confirmation_url}" style="display: inline-block; padding: 14px 32px; background-color: #A57164; color: #ffffff; font-size: 15px; font-weight: 600; border-radius: 999px; text-decoration: none;">
              Acessar minha conta
            </a>
          </div>
          <p style="font-size: 13px; color: #999; line-height: 1.5; margin-top: 32px;">
            Se você não solicitou este link, pode ignorar este e-mail.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="font-size: 12px; color: #bbb; text-align: center;">Psi Real — Gestão Inteligente para Psicólogas</p>
        </div>
      `;
    } else {
      subject = "Notificação — Psi Real";
      html = `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
          <p style="font-size: 15px; color: #555;">
            <a href="${confirmation_url}" style="color: #A57164;">Clique aqui para continuar</a>
          </p>
          <p style="font-size: 12px; color: #bbb; text-align: center; margin-top: 32px;">Psi Real</p>
        </div>
      `;
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
      console.error("Resend error:", JSON.stringify(result));
      return new Response(JSON.stringify({ error: result }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error sending email:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
