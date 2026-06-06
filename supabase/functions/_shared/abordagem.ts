// Helpers para adaptar prompts da IA à abordagem terapêutica do plano ativo.
// Compartilhado por: generate-formulation, summarize-formulation,
// supervise-formulation, padesky-coach, organize-notes.

export type Abordagem = "TCC" | "TE" | "ACT";

const NORMALIZE: Record<string, Abordagem> = {
  tcc: "TCC",
  "terapia cognitivo-comportamental": "TCC",
  "terapia cognitivo comportamental": "TCC",
  cbt: "TCC",
  te: "TE",
  "terapia do esquema": "TE",
  "schema therapy": "TE",
  esquema: "TE",
  act: "ACT",
  "terapia de aceitação e compromisso": "ACT",
  "terapia de aceitacao e compromisso": "ACT",
  "aceitação e compromisso": "ACT",
};

export function normalizeAbordagem(input: unknown): Abordagem {
  const pickFirst = (v: unknown): string => {
    if (Array.isArray(v)) return v.find((x) => typeof x === "string" && x.trim()) ?? "";
    return typeof v === "string" ? v : "";
  };
  const raw = pickFirst(input).trim().toLowerCase();
  if (!raw) return "TCC";
  if (NORMALIZE[raw]) return NORMALIZE[raw];
  for (const key of Object.keys(NORMALIZE)) {
    if (raw.includes(key)) return NORMALIZE[key];
  }
  return "TCC";
}

export async function fetchAbordagem(supabase: any, patient_id?: string | null): Promise<Abordagem> {
  if (!patient_id) return "TCC";
  try {
    const { data } = await supabase
      .from("treatment_plans")
      .select("abordagem,status")
      .eq("patient_id", patient_id)
      .ilike("status", "ativo")
      .maybeSingle();
    return normalizeAbordagem(data?.abordagem);
  } catch {
    return "TCC";
  }
}

export function getContextoClinico(abordagem: Abordagem): string {
  switch (abordagem) {
    case "TE":
      return `Você é um assistente clínico especializado em Terapia do Esquema baseada em Jeffrey Young. Use linguagem técnica de TE:
- Esquemas Iniciais Desadaptativos (EIDs)
- Modos esquemáticos (criança vulnerável, pai punitivo, adulto saudável, etc)
- Necessidades emocionais básicas não atendidas
- Reparentalização limitada e trabalho experiencial
- Domínios de esquema (desconexão, autonomia prejudicada, limites prejudicados, etc)
Evite o termo distorção cognitiva — use esquema ou crença esquemática.`;
    case "ACT":
      return `Você é um assistente clínico especializado em Terapia de Aceitação e Compromisso (ACT) baseada em Steven Hayes. Use linguagem técnica de ACT:
- Hexaflex: aceitação, desfusão cognitiva, contato com o momento presente, eu como contexto, valores e ação comprometida
- Fusão cognitiva e desfusão
- Evitação experiencial e flexibilidade psicológica
- Clarificação de valores e comprometimento com ação
- Metáforas ACT quando relevante
Evite os termos distorção cognitiva e reestruturação cognitiva — use desfusão e aceitação.`;
    case "TCC":
    default:
      return `Você é um assistente clínico especializado em Terapia Cognitivo-Comportamental baseada no modelo de Aaron Beck. Use linguagem técnica de TCC:
- Pensamentos automáticos e crenças intermediárias
- Crenças nucleares (visão de si, do mundo e do futuro)
- Distorções cognitivas (catastrofização, leitura mental, generalização, etc)
- Reestruturação cognitiva e registro de pensamento
- Modelo cognitivo: situação → pensamento → emoção → comportamento → reação física
Evite termos de outras abordagens.`;
  }
}

export function getTecnicasSugeridas(abordagem: Abordagem): string[] {
  switch (abordagem) {
    case "TE":
      return [
        "Reparentalização Limitada",
        "Imagery Rescripting",
        "Cadeiras (diálogo entre modos)",
        "Diário de Esquemas",
        "Cartão de Flashcard de Esquema",
        "Trabalho com a Criança Vulnerável",
      ];
    case "ACT":
      return [
        "Defusão Cognitiva",
        "Exercício do Observador",
        "Matriz ACT",
        "Clarificação de Valores",
        "Ação Comprometida",
        "Mindfulness Formal",
        "Metáfora do Ônibus",
        "Exercício das Folhas no Rio",
      ];
    case "TCC":
    default:
      return [
        "Registro de Pensamento Disfuncional",
        "Reestruturação Cognitiva",
        "Experimento Comportamental",
        "Exposição Gradual",
        "Seta Descendente",
        "Role-play",
        "Psicoeducação",
        "Agendamento de Atividades",
      ];
  }
}

export const REGRAS_GERAIS_IA = `Regras obrigatórias:
- Nunca misture linguagem de abordagens diferentes no mesmo output.
- Sempre use a linguagem técnica da abordagem selecionada acima.
- Tom clínico, objetivo, sem excesso de adjetivos.
- Máximo 3 parágrafos em resumos.
- Nunca invente dados clínicos — use apenas o que foi fornecido no contexto.`;

export function buildAbordagemBlock(abordagem: Abordagem, patientName?: string): string {
  const tecnicas = getTecnicasSugeridas(abordagem).join(", ");
  return `${getContextoClinico(abordagem)}

${patientName ? `Paciente: ${patientName}\n` : ""}Abordagem selecionada: ${abordagem}
Técnicas válidas para esta abordagem (use apenas estas quando sugerir intervenções): ${tecnicas}

${REGRAS_GERAIS_IA}`;
}
