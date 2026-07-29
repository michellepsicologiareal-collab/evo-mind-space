import { supabase } from "@/integrations/supabase/client";

/**
 * Copia o "Plano entre sessões" mais recente do paciente para uma sessão recém-agendada.
 *
 * Regras:
 * - Só copia se a nova sessão ainda não tiver plano vinculado.
 * - A cópia entra como rascunho (sent_at = null), para revisão antes do envio.
 * - Retorna o id do plano criado, ou null quando nada foi copiado.
 */
export async function carryOverHomeworkPlan(
  userId: string,
  patientId: string,
  newSessionId: string,
): Promise<string | null> {
  try {
    // Já existe plano para a nova sessão? Então não duplica.
    const { data: existing } = await supabase
      .from("homework_tasks")
      .select("id")
      .eq("user_id", userId)
      .eq("session_id", newSessionId)
      .limit(1);
    if (existing && existing.length > 0) return null;

    const { data: source } = await supabase
      .from("homework_tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!source) return null;

    const src = source as any;
    const hasContent =
      (src.weekly_goal?.trim?.() ?? "") ||
      (src.session_points?.trim?.() ?? "") ||
      (src.weekly_observations?.trim?.() ?? "") ||
      (src.coping_card_title?.trim?.() ?? "") ||
      (src.coping_card_content?.trim?.() ?? "") ||
      (Array.isArray(src.actions) && src.actions.length > 0);
    if (!hasContent) return null;

    const { data: inserted, error } = await supabase
      .from("homework_tasks")
      .insert({
        user_id: userId,
        patient_id: patientId,
        session_id: newSessionId,
        title: src.title ?? null,
        content: src.content ?? "",
        weekly_goal: src.weekly_goal ?? null,
        session_points: src.session_points ?? null,
        actions: src.actions ?? null,
        weekly_observations: src.weekly_observations ?? null,
        coping_card_title: src.coping_card_title ?? null,
        coping_card_content: src.coping_card_content ?? null,
        session_record_id: null,
        sent_at: null,
      } as any)
      .select("id")
      .single();

    if (error) return null;
    return inserted?.id ?? null;
  } catch {
    return null;
  }
}
