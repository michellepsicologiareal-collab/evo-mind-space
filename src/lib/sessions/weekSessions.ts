import { startOfWeek, endOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export interface WeekSessionRow {
  id: string;
  scheduled_at: string;
  status: string;
  modality: string | null;
  patient_name: string;
}

/**
 * Fonte única de verdade para "Sessões na semana".
 * Regras idênticas às usadas pela Agenda:
 *  - campo de data: scheduled_at
 *  - intervalo: segunda a domingo (weekStartsOn: 1)
 *  - exclui apenas status = "cancelled"
 *  - embed explícito com FK (evita ambiguidade patient_id x discussed_patient_id)
 */
export async function fetchWeekSessions(params: {
  userId: string;
  reference?: Date;
}): Promise<{ data: WeekSessionRow[]; weekStart: Date; weekEnd: Date; error: unknown }> {
  const ref = params.reference ?? new Date();
  const weekStart = startOfWeek(ref, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(ref, { weekStartsOn: 1 });

  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, scheduled_at, status, modality, patient:patients!sessions_patient_id_fkey(full_name)",
    )
    .eq("user_id", params.userId)
    .gte("scheduled_at", weekStart.toISOString())
    .lte("scheduled_at", weekEnd.toISOString())
    .neq("status", "cancelled")
    .order("scheduled_at", { ascending: true });

  const rows: WeekSessionRow[] = (data ?? []).map((r: any) => ({
    id: r.id,
    scheduled_at: r.scheduled_at,
    status: r.status,
    modality: r.modality,
    patient_name: r.patient?.full_name ?? "Paciente",
  }));

  return { data: rows, weekStart, weekEnd, error };
}
