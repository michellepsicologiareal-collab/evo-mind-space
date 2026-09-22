import { supabase } from "@/integrations/supabase/client";

export type WhatsAppMessageType = "billing" | "rpd" | "confirmation" | "homework" | "other";

export const whatsappMessageTypeLabel: Record<string, string> = {
  billing: "Cobrança",
  rpd: "Link de RPD",
  confirmation: "Confirmação de sessão",
  homework: "Tarefa de casa",
  other: "Mensagem",
};

/**
 * Registra no histórico do paciente cada mensagem enviada pelo WhatsApp
 * (data, tipo e número utilizado). Nunca lança — falha silenciosa com aviso.
 */
export async function logWhatsAppMessage(args: {
  patientId: string | null;
  sessionId?: string | null;
  type: WhatsAppMessageType;
  phone?: string | null;
  detail?: string | null;
  channel?: "whatsapp" | "clipboard";
}) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { error } = await supabase.from("whatsapp_message_logs").insert({
      user_id: auth.user.id,
      patient_id: args.patientId,
      session_id: args.sessionId ?? null,
      message_type: args.type,
      phone: args.phone || null,
      detail: args.detail || null,
      channel: args.channel ?? "whatsapp",
    } as any);
    if (error) console.warn("Não foi possível registrar o envio:", error.message);
  } catch (e) {
    console.warn("Não foi possível registrar o envio:", e);
  }
}
