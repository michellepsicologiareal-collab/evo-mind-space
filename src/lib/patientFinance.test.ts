import { describe, expect, it } from "vitest";
import { summarizePatientFinance, type PatientFinanceSession } from "./patientFinance";

const session = (values: Partial<PatientFinanceSession>): PatientFinanceSession => ({
  id: "session", scheduled_at: "2026-10-20T12:00:00Z", status: "completed", payment_status: "pending", price: 100,
  payment_method: null, payment_reference: null, receita_saude_status: null, paid_at: null, session_type: null,
  notes: null, billing_sent_at: null, payment_due_date: null, patient: null, service: null, ...values,
});

describe("patient financial summary", () => {
  it("keeps the total as paid plus open, with future individual sessions separate", () => {
    const result = summarizePatientFinance([session({ payment_status: "paid", price: 200 }), session({}), session({ status: "scheduled", price: 150 })]);
    expect(result).toMatchObject({ paid: 200, pending: 100, total: 300, forecast: 150 });
  });
  it("includes future single-payment plans in open charges", () => {
    expect(summarizePatientFinance([session({ status: "scheduled", notes: "Plano 2 sessões (1/2) — Pgto único [abc123]" })])).toMatchObject({ pending: 100, forecast: 0 });
  });
  it("does not count cancellations or expenses as patient revenue", () => {
    expect(summarizePatientFinance([session({ status: "cancelled" }), session({ is_expense: true, payment_status: "paid" })]).total).toBe(0);
  });
});