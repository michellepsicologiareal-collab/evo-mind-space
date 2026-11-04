import { describe, expect, it } from "vitest";
import { sessionDateUpdate } from "./sessionDate";

describe("changing a session date", () => {
  it("changes only the chosen day and preserves the time", () => {
    const original = new Date(2026, 10, 27, 16, 0, 15, 120);
    const update = sessionDateUpdate(original.toISOString(), new Date(2026, 11, 4));
    const next = new Date(update.scheduled_at);
    expect([next.getFullYear(), next.getMonth(), next.getDate()]).toEqual([2026, 11, 4]);
    expect([next.getHours(), next.getMinutes(), next.getSeconds(), next.getMilliseconds()]).toEqual([16, 0, 15, 120]);
    expect(Object.keys(update)).toEqual(["scheduled_at"]);
  });
});