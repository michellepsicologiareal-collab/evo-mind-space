import { describe, it, expect } from "vitest";
import { normalizeActions, serializeActions, actionsSchema } from "./PatientHomework";

describe("normalizeActions — migração de formatos legados", () => {
  it("retorna [] para null/undefined", () => {
    expect(normalizeActions(null)).toEqual([]);
    expect(normalizeActions(undefined as any)).toEqual([]);
  });

  it("retorna [] quando o valor não é um array (formato inválido antigo)", () => {
    expect(normalizeActions("respirar fundo" as any)).toEqual([]);
    expect(normalizeActions({ text: "x", done: false } as any)).toEqual([]);
    expect(normalizeActions(42 as any)).toEqual([]);
  });

  it("converte array de strings legado em objetos {text, done:false}", () => {
    const legacy = ["Respirar fundo", "Escrever no diário", "Caminhar 10min"] as any;
    expect(normalizeActions(legacy)).toEqual([
      { text: "Respirar fundo", done: false },
      { text: "Escrever no diário", done: false },
      { text: "Caminhar 10min", done: false },
    ]);
  });

  it("preenche done=false quando ausente e faz trim no text", () => {
    const legacy = [{ text: "  Meditar  " }, { text: "Ler capítulo 2" }] as any;
    expect(normalizeActions(legacy)).toEqual([
      { text: "Meditar", done: false },
      { text: "Ler capítulo 2", done: false },
    ]);
  });

  it("coage done não booleano em booleano", () => {
    const legacy = [
      { text: "A", done: 1 },
      { text: "B", done: 0 },
      { text: "C", done: "yes" },
      { text: "D", done: null },
    ] as any;
    expect(normalizeActions(legacy)).toEqual([
      { text: "A", done: true },
      { text: "B", done: false },
      { text: "C", done: true },
      { text: "D", done: false },
    ]);
  });

  it("descarta itens inválidos: sem text, text vazio, null, número, texto só com espaços", () => {
    const legacy = [
      { done: true },
      { text: "" },
      { text: "   " },
      null,
      123,
      "",
      "   ",
      { text: "Válido", done: true },
    ] as any;
    expect(normalizeActions(legacy)).toEqual([{ text: "Válido", done: true }]);
  });

  it("mistura strings e objetos legados no mesmo array", () => {
    const legacy = [
      "Item antigo em string",
      { text: "Item novo", done: true },
      { text: "Sem done" },
    ] as any;
    expect(normalizeActions(legacy)).toEqual([
      { text: "Item antigo em string", done: false },
      { text: "Item novo", done: true },
      { text: "Sem done", done: false },
    ]);
  });

  it("aplica cap máximo de 50 itens via schema", () => {
    const legacy = Array.from({ length: 60 }, (_, i) => `Ação ${i}`) as any;
    const result = normalizeActions(legacy);
    // 60 > 50 → schema rejeita, normalize retorna []
    expect(result).toEqual([]);
    // Sanity: 50 exatos passam
    const ok = Array.from({ length: 50 }, (_, i) => `Ação ${i}`) as any;
    expect(normalizeActions(ok)).toHaveLength(50);
  });

  it("respeita limite de 500 chars por item (descartando os maiores)", () => {
    const legacy = [
      { text: "ok" },
      { text: "x".repeat(600) },
    ] as any;
    // Schema rejeita o array inteiro se qualquer item exceder → retorna []
    expect(normalizeActions(legacy)).toEqual([]);
  });
});

describe("serializeActions", () => {
  it("retorna null para lista vazia", () => {
    expect(serializeActions([])).toBeNull();
  });

  it("retorna array normalizado válido conforme schema", () => {
    const items = [{ text: "A", done: false }, { text: "B", done: true }];
    const out = serializeActions(items);
    expect(out).toEqual(items);
    expect(actionsSchema.safeParse(out).success).toBe(true);
  });
});

describe("round-trip: carregar legado → serializar → recarregar", () => {
  it("normaliza uma vez e mantém estabilidade em cargas subsequentes", () => {
    const legacy = ["A", { text: "B", done: true }, { text: "C" }] as any;
    const first = normalizeActions(legacy);
    const serialized = serializeActions(first);
    const second = normalizeActions(serialized);
    expect(second).toEqual(first);
  });
});
