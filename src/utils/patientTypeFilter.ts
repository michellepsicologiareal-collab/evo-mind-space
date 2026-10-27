export type PatientTypeFilter = "all" | "clinical" | "supervisao";

/** Casos de supervisão usam a categoria "supervisao" em patients.category. */
export function isSupervisionCase(category?: string | null): boolean {
  return category === "supervisao";
}

export function matchesPatientTypeFilter(
  category: string | null | undefined,
  filter: PatientTypeFilter
): boolean {
  if (filter === "supervisao") return isSupervisionCase(category);
  if (filter === "clinical") return !isSupervisionCase(category);
  return true;
}
