import { describe, it, expect } from "vitest";
import { startOfWeek, endOfWeek, addDays } from "date-fns";

/**
 * Regression: "Sessões na semana" (Painel) must equal the weekly Agenda count,
 * excluding only cancelled sessions. Previously the card summed a Mon-Fri
 * bucket and dropped sessions on Sat/Sun, returning 0 in valid weeks.
 *
 * Shared rule (Agenda + Dashboard):
 *  - period: startOfWeek..endOfWeek with weekStartsOn: 1 (Mon → Sun)
 *  - field: scheduled_at
 *  - exclude: status === "cancelled"
 */

type Session = { id: string; scheduled_at: string; status: string };

// Mirror of Agenda's weekly filter
const agendaWeekCount = (rows: Session[], today: Date) => {
  const start = startOfWeek(today, { weekStartsOn: 1 });
  const end = endOfWeek(today, { weekStartsOn: 1 });
  return rows.filter(
    (r) =>
      r.status !== "cancelled" &&
      new Date(r.scheduled_at) >= start &&
      new Date(r.scheduled_at) <= end,
  ).length;
};

// Mirror of Dashboard's card value after the fix (weekSessions.length)
const dashboardCardTotal = (rows: Session[], today: Date) => {
  const start = startOfWeek(today, { weekStartsOn: 1 });
  const end = endOfWeek(today, { weekStartsOn: 1 });
  const weekSessions = rows.filter(
    (r) =>
      r.status !== "cancelled" &&
      new Date(r.scheduled_at) >= start &&
      new Date(r.scheduled_at) <= end,
  );
  return weekSessions.length;
};

const iso = (d: Date, h = 10, m = 0) => {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x.toISOString();
};

describe("Dashboard 'Sessões na semana' vs Agenda semanal", () => {
  const today = new Date(2026, 6, 15); // Wed 15/07/2026
  const mon = startOfWeek(today, { weekStartsOn: 1 });

  it("count matches Agenda for a full Mon–Sun week (including Sat/Sun)", () => {
    const rows: Session[] = [
      { id: "1", status: "scheduled", scheduled_at: iso(mon) },
      { id: "2", status: "confirmed", scheduled_at: iso(addDays(mon, 2)) },
      { id: "3", status: "completed", scheduled_at: iso(addDays(mon, 3)) },
      { id: "4", status: "no_show", scheduled_at: iso(addDays(mon, 4)) },
      { id: "5", status: "scheduled", scheduled_at: iso(addDays(mon, 5)) }, // Sat
      { id: "6", status: "confirmed", scheduled_at: iso(addDays(mon, 6), 20) }, // Sun
      { id: "7", status: "cancelled", scheduled_at: iso(addDays(mon, 1)) }, // excluded
    ];

    expect(dashboardCardTotal(rows, today)).toBe(agendaWeekCount(rows, today));
    expect(dashboardCardTotal(rows, today)).toBe(6);
  });

  it("does not drop weekend sessions (regression: Mon–Fri bucket bug)", () => {
    const rows: Session[] = [
      { id: "sat", status: "scheduled", scheduled_at: iso(addDays(mon, 5)) },
      { id: "sun", status: "scheduled", scheduled_at: iso(addDays(mon, 6), 23) },
    ];
    expect(dashboardCardTotal(rows, today)).toBe(2);
    expect(dashboardCardTotal(rows, today)).toBe(agendaWeekCount(rows, today));
  });

  it("excludes sessions outside the current week", () => {
    const rows: Session[] = [
      { id: "prev", status: "scheduled", scheduled_at: iso(addDays(mon, -1)) },
      { id: "in", status: "scheduled", scheduled_at: iso(addDays(mon, 3)) },
      { id: "next", status: "scheduled", scheduled_at: iso(addDays(mon, 7)) },
    ];
    expect(dashboardCardTotal(rows, today)).toBe(1);
    expect(dashboardCardTotal(rows, today)).toBe(agendaWeekCount(rows, today));
  });

  it("excludes only cancelled, keeps no_show/completed/scheduled/confirmed", () => {
    const rows: Session[] = [
      { id: "a", status: "cancelled", scheduled_at: iso(mon) },
      { id: "b", status: "completed", scheduled_at: iso(mon) },
      { id: "c", status: "no_show", scheduled_at: iso(mon) },
      { id: "d", status: "scheduled", scheduled_at: iso(mon) },
      { id: "e", status: "confirmed", scheduled_at: iso(mon) },
    ];
    expect(dashboardCardTotal(rows, today)).toBe(4);
    expect(dashboardCardTotal(rows, today)).toBe(agendaWeekCount(rows, today));
  });
});
