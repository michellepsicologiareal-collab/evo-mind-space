import { describe, it, expect } from "vitest";
import { renumberPlanNotes } from "./billing";
describe("renumberPlanNotes", () => {
  it("pacote de 4 vira 3 mantendo o id", () => {
    expect(renumberPlanNotes("Plano 4 sessões (4/4) — Pgto único [9fc268dd]", 3, 3)).toBe("Plano 3 sessões (3/3) — Pgto único [9fc268dd]");
  });
});
