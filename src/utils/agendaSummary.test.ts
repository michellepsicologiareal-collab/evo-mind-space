import { describe, it, expect } from "vitest";
import { computeAgendaSummary, type AgendaSummarySession } from "./agendaSummary";

const baseDate = "2026-08-15T10:00:00.000Z";
const now = new Date(baseDate);

const makeSession = (overrides: Partial<AgendaSummarySession> & { scheduled_at: string }): AgendaSummarySession => ({
  id: `s-${overrides.scheduled_at}`,
  patient_id: "p1",
  patient_name: "Paciente Teste",
  session_type: "clinical",
  status: "completed",
  payment_status: "pending",
  is_expense: false,
  price: 150,
  ...overrides,
});

describe("computeAgendaSummary", () => {
  it("atualiza contadores de sessões ao mudar o dia selecionado", () => {
    const sessions = [
      makeSession({ scheduled_at: "2026-08-15T14:00:00.000Z", status: "confirmed" }),
      makeSession({ scheduled_at: "2026-08-16T14:00:00.000Z", status: "confirmed" }),
    ];

    const day15 = computeAgendaSummary({
      sessions,
      selectedDate: new Date("2026-08-15T12:00:00.000Z"),
      currentMonth: new Date("2026-08-01T00:00:00.000Z"),
      now,
      sessionRecordIds: new Set(),
      sessionRecordKeys: new Set(),
      moodBySession: new Map(),
      moodTodayPatients: new Set(),
    });

    expect(day15.todayCount).toBe(1);
    expect(day15.labels.sessions).toBe("Sessões de hoje");

    const day16 = computeAgendaSummary({
      sessions,
      selectedDate: new Date("2026-08-16T12:00:00.000Z"),
      currentMonth: new Date("2026-08-01T00:00:00.000Z"),
      now,
      sessionRecordIds: new Set(),
      sessionRecordKeys: new Set(),
      moodBySession: new Map(),
      moodTodayPatients: new Set(),
    });

    expect(day16.todayCount).toBe(1);
    expect(day16.labels.sessions).toBe("Sessões em 16/08");
  });

  it("atualiza rótulos de pendências ao mudar o mês exibido", () => {
    const sessions = [
      makeSession({ scheduled_at: "2026-07-10T14:00:00.000Z", status: "completed" }),
      makeSession({ scheduled_at: "2026-08-10T14:00:00.000Z", status: "completed" }),
    ];

    const july = computeAgendaSummary({
      sessions,
      selectedDate: new Date("2026-07-31T12:00:00.000Z"),
      currentMonth: new Date("2026-07-01T00:00:00.000Z"),
      now,
      sessionRecordIds: new Set(),
      sessionRecordKeys: new Set(),
      moodBySession: new Map(),
      moodTodayPatients: new Set(),
    });

    expect(july.pendingRecords).toBe(1);
    expect(july.labels.pendingRecords).toMatch(/jul/);

    const august = computeAgendaSummary({
      sessions,
      selectedDate: new Date("2026-08-31T12:00:00.000Z"),
      currentMonth: new Date("2026-08-01T00:00:00.000Z"),
      now,
      sessionRecordIds: new Set(),
      sessionRecordKeys: new Set(),
      moodBySession: new Map(),
      moodTodayPatients: new Set(),
    });

    // Como o corte vai até o fim do dia selecionado (31/08), a sessão de julho também aparece
    expect(august.pendingRecords).toBe(2);
    expect(august.labels.pendingRecords).toMatch(/ago/);
  });

  it("ignora sessões canceladas no contador de sessões do dia", () => {
    const sessions = [
      makeSession({ scheduled_at: "2026-08-15T10:00:00.000Z", status: "cancelled" }),
      makeSession({ scheduled_at: "2026-08-15T14:00:00.000Z", status: "confirmed" }),
    ];

    const summary = computeAgendaSummary({
      sessions,
      selectedDate: new Date("2026-08-15T12:00:00.000Z"),
      currentMonth: new Date("2026-08-01T00:00:00.000Z"),
      now,
      sessionRecordIds: new Set(),
      sessionRecordKeys: new Set(),
      moodBySession: new Map(),
      moodTodayPatients: new Set(),
    });

    expect(summary.todayCount).toBe(1);
  });

  it("não conta registros já existentes como pendentes", () => {
    const sessions = [
      makeSession({ id: "sess-1", scheduled_at: "2026-08-10T14:00:00.000Z", status: "completed" }),
    ];

    const withRecord = computeAgendaSummary({
      sessions,
      selectedDate: new Date("2026-08-15T12:00:00.000Z"),
      currentMonth: new Date("2026-08-01T00:00:00.000Z"),
      now,
      sessionRecordIds: new Set(["sess-1"]),
      sessionRecordKeys: new Set(),
      moodBySession: new Map(),
      moodTodayPatients: new Set(),
    });

    expect(withRecord.pendingRecords).toBe(0);
    expect(withRecord.pendingRecordList).toHaveLength(0);
  });

  it("não conta pagamentos de supervisão ou despesas", () => {
    const sessions = [
      makeSession({ scheduled_at: "2026-08-10T14:00:00.000Z", status: "completed", session_type: "supervision" }),
      makeSession({ scheduled_at: "2026-08-11T14:00:00.000Z", status: "completed", is_expense: true }),
      makeSession({ scheduled_at: "2026-08-12T14:00:00.000Z", status: "completed" }),
    ];

    const summary = computeAgendaSummary({
      sessions,
      selectedDate: new Date("2026-08-15T12:00:00.000Z"),
      currentMonth: new Date("2026-08-01T00:00:00.000Z"),
      now,
      sessionRecordIds: new Set(),
      sessionRecordKeys: new Set(),
      moodBySession: new Map(),
      moodTodayPatients: new Set(),
    });

    expect(summary.pendingPayments).toBe(1);
    expect(summary.pendingPaymentList[0].scheduled_at).toContain("2026-08-12");
  });

  it("limita contagem de pendências até 'agora' quando o dia selecionado é futuro", () => {
    const sessions = [
      makeSession({ scheduled_at: "2026-08-20T14:00:00.000Z", status: "completed" }),
      makeSession({ scheduled_at: "2026-08-21T14:00:00.000Z", status: "completed" }),
    ];

    const summary = computeAgendaSummary({
      sessions,
      selectedDate: new Date("2026-08-25T12:00:00.000Z"),
      currentMonth: new Date("2026-08-01T00:00:00.000Z"),
      now,
      sessionRecordIds: new Set(),
      sessionRecordKeys: new Set(),
      moodBySession: new Map(),
      moodTodayPatients: new Set(),
    });

    // Nenhuma sessão deve ser considerada pendente porque a data futura está além de 'now'
    expect(summary.pendingRecords).toBe(0);
    expect(summary.pendingPayments).toBe(0);
    expect(summary.cutoff.getTime()).toBeLessThan(new Date("2026-08-25T23:59:59.999Z").getTime());
  });

  it("conta humor do dia usando moodTodayPatients quando é hoje", () => {
    const sessions = [
      makeSession({ id: "s1", scheduled_at: "2026-08-15T14:00:00.000Z", status: "confirmed" }),
    ];

    const summary = computeAgendaSummary({
      sessions,
      selectedDate: new Date("2026-08-15T12:00:00.000Z"),
      currentMonth: new Date("2026-08-01T00:00:00.000Z"),
      now,
      sessionRecordIds: new Set(),
      sessionRecordKeys: new Set(),
      moodBySession: new Map(),
      moodTodayPatients: new Set(["p1", "p2"]),
    });

    expect(summary.moodCount).toBe(2);
    expect(summary.labels.mood).toBe("Humor respondido hoje");
  });

  it("conta humor por sessão quando o dia selecionado não é hoje", () => {
    const sessions = [
      makeSession({ id: "s1", scheduled_at: "2026-08-14T14:00:00.000Z", status: "confirmed" }),
      makeSession({ id: "s2", scheduled_at: "2026-08-14T16:00:00.000Z", status: "confirmed" }),
      makeSession({ id: "s3", scheduled_at: "2026-08-13T14:00:00.000Z", status: "confirmed" }),
    ];

    const summary = computeAgendaSummary({
      sessions,
      selectedDate: new Date("2026-08-14T12:00:00.000Z"),
      currentMonth: new Date("2026-08-01T00:00:00.000Z"),
      now,
      sessionRecordIds: new Set(),
      sessionRecordKeys: new Set(),
      moodBySession: new Map([["s1", { mood: "happy" }], ["s3", { mood: "sad" }]]),
      moodTodayPatients: new Set(),
    });

    expect(summary.moodCount).toBe(1);
    expect(summary.labels.mood).toBe("Humor em 14/08");
  });

  it("exibe cutoff até o fim do dia selecionado quando o dia é passado", () => {
    const sessions = [
      makeSession({ scheduled_at: "2026-08-10T14:00:00.000Z", status: "completed" }),
    ];

    const summary = computeAgendaSummary({
      sessions,
      selectedDate: new Date("2026-08-10T12:00:00.000Z"),
      currentMonth: new Date("2026-08-01T00:00:00.000Z"),
      now,
      sessionRecordIds: new Set(),
      sessionRecordKeys: new Set(),
      moodBySession: new Map(),
      moodTodayPatients: new Set(),
    });

    expect(summary.pendingRecords).toBe(1);
    const endOfDay = new Date("2026-08-10T23:59:59.999Z");
    expect(summary.cutoff.getTime()).toBe(endOfDay.getTime());
  });

  it("retorna estados vazios (zero) quando não há sessões no período", () => {
    const summary = computeAgendaSummary({
      sessions: [],
      selectedDate: new Date("2026-08-15T12:00:00.000Z"),
      currentMonth: new Date("2026-08-01T00:00:00.000Z"),
      now,
      sessionRecordIds: new Set(),
      sessionRecordKeys: new Set(),
      moodBySession: new Map(),
      moodTodayPatients: new Set(),
    });

    expect(summary.todayCount).toBe(0);
    expect(summary.pendingRecords).toBe(0);
    expect(summary.pendingPayments).toBe(0);
    expect(summary.moodCount).toBe(0);
    expect(summary.pendingRecordList).toHaveLength(0);
    expect(summary.pendingPaymentList).toHaveLength(0);
  });

  it("ordena listas de pendências da mais recente para a mais antiga", () => {
    const sessions = [
      makeSession({ scheduled_at: "2026-08-05T14:00:00.000Z", status: "completed" }),
      makeSession({ scheduled_at: "2026-08-12T14:00:00.000Z", status: "completed" }),
      makeSession({ scheduled_at: "2026-08-08T14:00:00.000Z", status: "completed" }),
    ];

    const summary = computeAgendaSummary({
      sessions,
      selectedDate: new Date("2026-08-15T12:00:00.000Z"),
      currentMonth: new Date("2026-08-01T00:00:00.000Z"),
      now,
      sessionRecordIds: new Set(),
      sessionRecordKeys: new Set(),
      moodBySession: new Map(),
      moodTodayPatients: new Set(),
    });

    const dates = summary.pendingRecordList.map((s) => s.scheduled_at);
    expect(dates[0]).toContain("2026-08-12");
    expect(dates[1]).toContain("2026-08-08");
    expect(dates[2]).toContain("2026-08-05");
  });
});
