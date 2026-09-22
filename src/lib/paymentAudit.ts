import { supabase } from "@/integrations/supabase/client";

export type PaymentChangeAction = "paid" | "undone" | "repaid";

export const paymentChangeLabel: Record<string, string> = {
  paid: "Pagamento registrado",
  undone: "Baixa desfeita",
  repaid: "Pagamento registrado novamente",
};

/**
 * Registra no histórico de alterações financeiras quando uma sessão foi paga,
 * desfeita ou paga novamente — com data e usuário responsável.
 */
export async function logPaymentChange(args: {
  userId: string;
  actorName?: string | null;
  patientId?: string | null;
  sessionIds: string[];
  action: PaymentChangeAction;
  amount?: number | null;
  label?: string | null;
}) {
  if (args.sessionIds.length === 0) return;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const actorId = auth.user?.id ?? args.userId;
    const rows = args.sessionIds.map((sessionId) => ({
      user_id: args.userId,
      actor_id: actorId,
      actor_name: args.actorName || auth.user?.email || null,
      patient_id: args.patientId ?? null,
      session_id: sessionId,
      action: args.action,
      sessions_count: args.sessionIds.length,
      amount: args.amount ?? null,
      label: args.label ?? null,
    }));
    const { error } = await supabase.from("payment_change_logs").insert(rows as any);
    if (error) console.warn("Não foi possível registrar a alteração financeira:", error.message);
  } catch (e) {
    console.warn("Não foi possível registrar a alteração financeira:", e);
  }
}
