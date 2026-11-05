import { describe, expect, it } from "vitest";
import { groupSessionsByPatient, summarizePatientFinance, type PatientFinanceSession } from "./patientFinance";

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

describe("grouping the clickable summary by patient", () => {
  it("puts every session of a patient in one block, alphabetically, with that patient's subtotal", () => {
    const groups = groupSessionsByPatient([
      session({ id: "t1", patient: { id: "p2", full_name: "Tassio Abreu de Souza" }, price: 30 }),
      session({ id: "e1", patient: { id: "p1", full_name: "Eduardo Martinez Martin" }, price: 15 }),
      session({ id: "e2", patient: { id: "p1", full_name: "Eduardo Martinez Martin" }, price: 15 }),
    ]);
    expect(groups.map((g) => g.name)).toEqual(["Eduardo Martinez Martin", "Tassio Abreu de Souza"]);
    expect(groups[0].rows.map((r) => r.id)).toEqual(["e1", "e2"]);
    expect(groups[0].total).toBe(30);
    expect(groups[1].total).toBe(30);
  });

  it("sorts a patient's sessions by session date and ignores accents and letter case", () => {
    const groups = groupSessionsByPatient([
      session({ id: "a2", patient: { id: "p1", full_name: "ANA PAULA" }, scheduled_at: "2026-11-18T12:00:00Z" }),
      session({ id: "a1", patient: { id: "p1", full_name: "Ana paula" }, scheduled_at: "2026-11-04T12:00:00Z" }),
      session({ id: "b1", patient: { id: "p2", full_name: "Átila Nunes" } }),
    ]);
    expect(groups.map((g) => g.name)).toEqual(["Ana paula", "Átila Nunes"]);
    expect(groups[0].rows.map((r) => r.id)).toEqual(["a1", "a2"]);
  });

  it("keeps sessions without a patient together under 'Sem paciente'", () => {
    const groups = groupSessionsByPatient([session({ id: "x1" }), session({ id: "x2", price: 40 })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("Sem paciente");
    expect(groups[0].total).toBe(140);
  });
});