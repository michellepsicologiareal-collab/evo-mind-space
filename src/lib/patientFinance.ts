import { isForecastCharge, isPendingCharge } from "@/lib/billing";

export interface PatientFinanceSession {
  id: string;
  scheduled_at: string;
  status: string;
  payment_status: "pending" | "paid";
  payment_method: "pix" | "card" | "cash" | null;
  payment_reference: string | null;
  receita_saude_status: "to_issue" | "issued" | null;
  price: number | null;
  paid_at: string | null;
  session_type: string | null;
  notes: string | null;
  billing_sent_at: string | null;
  payment_due_date: string | null;
  is_expense?: boolean | null;
  patient: { id: string; full_name: string } | null;
  service: { name: string } | null;
}

export const patientFinanceColumns = "id, scheduled_at, status, payment_status, payment_method, payment_reference, receita_saude_status, price, paid_at, session_type, notes, billing_sent_at, payment_due_date, is_expense, patient:patients!sessions_patient_id_fkey(id, full_name), service:services(name)";

export function summarizePatientFinance(sessions: PatientFinanceSession[]) {
  const valid = sessions.filter((s) => s.status !== "cancelled" && !s.is_expense);
  const sum = (list: PatientFinanceSession[]) => list.reduce((total, s) => total + Number(s.price ?? 0), 0);
  const paid = sum(valid.filter((s) => s.payment_status === "paid"));
  const pending = sum(valid.filter(isPendingCharge));
  const forecast = sum(valid.filter(isForecastCharge));
  return { paid, pending, forecast, total: paid + pending, completed: valid.filter((s) => s.status === "completed").length, receipts: valid.filter((s) => s.receita_saude_status === "to_issue").length };
}