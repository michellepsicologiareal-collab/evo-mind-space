// Envio de e-mails transacionais do Psi Real via Resend.
// O domínio psireal.app já está verificado no Resend (SPF/DKIM ativos).
// Não alterar o remetente sem verificar o domínio correspondente no Resend.

const RESEND_API_URL = "https://api.resend.com/emails";
export const FROM_EMAIL = "Psi Real <contato@psireal.app>";
export const REPLY_TO = "contato@psireal.app";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Converte o corpo em texto simples no layout de marca do Psi Real. */
export function renderEmailHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => `<p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 14px;">${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
    <div style="background:#A57164;padding:24px;text-align:center;">
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">Psi Real</h1>
    </div>
    <div style="padding:32px 28px;">${paragraphs}</div>
    <div style="padding:16px 28px 24px;text-align:center;border-top:1px solid #f0e8e0;">
      <p style="margin:0;font-size:12px;color:#bbb;">Psi Real — Gestão Inteligente para Psicólogas</p>
    </div>
  </div>
</body>
</html>`;
}

export interface SendResult {
  sent: boolean;
  id?: string;
  reason?: string;
}

export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY não configurada" };

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        reply_to: REPLY_TO,
        to: [params.to],
        subject: params.subject,
        text: params.text,
        html: params.html ?? renderEmailHtml(params.text),
      }),
    });

    const body = await res.text();
    if (!res.ok) {
      console.error(`Resend error [${res.status}]: ${body}`);
      return { sent: false, reason: `[${res.status}] ${body}` };
    }

    let id: string | undefined;
    try {
      id = JSON.parse(body)?.id;
    } catch (_) { /* resposta sem JSON */ }

    console.log("E-mail transacional enviado via Resend:", id ?? "(sem id)");
    return { sent: true, id };
  } catch (e) {
    console.error("Falha ao chamar o Resend:", e);
    return { sent: false, reason: (e as Error).message };
  }
}
