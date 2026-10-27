import { describe, expect, it } from "vitest";
import { isSupervisionCase, matchesPatientTypeFilter } from "./patientTypeFilter";

describe("patientTypeFilter", () => {
  it("caso marcado como supervisão entra apenas no filtro Supervisão", () => {
    expect(isSupervisionCase("supervisao")).toBe(true);
    expect(matchesPatientTypeFilter("supervisao", "supervisao")).toBe(true);
    expect(matchesPatientTypeFilter("supervisao", "clinical")).toBe(false);
    expect(matchesPatientTypeFilter("supervisao", "all")).toBe(true);
  });

  it("paciente clínico entra apenas no filtro Atendimento Clínico", () => {
    for (const cat of ["individual", "crianca", "casal", "grupo", "adolescente", "avaliacao", "sessao_breve", null, undefined]) {
      expect(matchesPatientTypeFilter(cat, "clinical"), `categoria ${cat}`).toBe(true);
      expect(matchesPatientTypeFilter(cat, "supervisao")).toBe(false);
      expect(matchesPatientTypeFilter(cat, "all")).toBe(true);
    }
  });
});
