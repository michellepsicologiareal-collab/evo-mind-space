// Conteúdo compartilhado do RPD (Registro de Pensamentos) — linguagem acessível
// mantendo o modelo cognitivo da TCC. Os campos do banco continuam os mesmos.

export interface RpdEmotion {
  name: string;
  before: number | null;
  after: number | null;
}

export interface RpdFormState {
  situation: string;
  automatic_thought: string;
  behavior: string;
  rational_response: string;
  emotions: RpdEmotion[];
  emotion_other: string;
  distortions: string[];
  distortion_other: string;
  belief_before: number | null;
  belief_after: number | null;
}

export const emptyRpdForm = (): RpdFormState => ({
  situation: "",
  automatic_thought: "",
  behavior: "",
  rational_response: "",
  emotions: [],
  emotion_other: "",
  distortions: [],
  distortion_other: "",
  belief_before: null,
  belief_after: null,
});

export const EMOTION_OPTIONS = [
  "Ansiedade",
  "Medo",
  "Tristeza",
  "Raiva",
  "Culpa",
  "Vergonha",
  "Frustração",
  "Insegurança",
  "Outra",
];

export const DISTORTION_OPTIONS: { simple: string; technical: string }[] = [
  { simple: "Imaginar o pior", technical: "Catastrofização" },
  { simple: "Achar que sei o que o outro pensa", technical: "Leitura mental" },
  { simple: "Pensar em tudo ou nada", technical: "Pensamento dicotômico" },
  { simple: "Ignorar coisas positivas", technical: "Desqualificação do positivo" },
  { simple: "Me culpar por tudo", technical: "Personalização" },
  { simple: "Tratar uma possibilidade como certeza", technical: "Adivinhação do futuro" },
  { simple: "Generalizar a partir de uma situação", technical: "Supergeneralização" },
  { simple: "Focar apenas no que deu errado", technical: "Filtro mental" },
  { simple: "Me cobrar com “tenho que” ou “deveria”", technical: "Imperativos" },
  { simple: "Colocar rótulos em mim ou nos outros", technical: "Rotulação" },
  { simple: "Outra / Não sei identificar", technical: "" },
];

export interface RpdStep {
  n: number;
  question: string;
  term: string;
  description: string;
  placeholder?: string;
}

export const RPD_STEPS: RpdStep[] = [
  {
    n: 1,
    question: "O que aconteceu?",
    term: "Situação",
    description:
      "Descreva brevemente o que estava acontecendo quando você percebeu uma mudança no seu humor ou comportamento.",
    placeholder: "Ex.: Meu chefe pediu para conversar comigo no final do dia.",
  },
  {
    n: 2,
    question: "O que passou pela minha cabeça?",
    term: "Pensamento",
    description:
      "Escreva o pensamento, imagem, lembrança ou preocupação que apareceu naquele momento. Tente registrar exatamente como veio à sua mente.",
    placeholder: "Ex.: Eu devo ter feito alguma coisa errada.",
  },
  {
    n: 3,
    question: "O que eu senti?",
    term: "Emoção",
    description: "Identifique as emoções que apareceram e, se conseguir, indique a intensidade.",
  },
  {
    n: 4,
    question: "O que eu fiz?",
    term: "Comportamento",
    description:
      "Conte como você reagiu à situação. Pode incluir algo que você fez, evitou, falou, deixou de fazer ou sentiu vontade de fazer.",
    placeholder: "Ex.: Passei a tarde revendo meu trabalho e tentando descobrir onde tinha errado.",
  },
  {
    n: 5,
    question: "Meu pensamento caiu em alguma armadilha?",
    term: "Armadilhas do pensamento",
    description:
      "Observe se sua mente interpretou a situação de uma forma que pode ter aumentado seu sofrimento.",
  },
  {
    n: 6,
    question: "Existe outra forma de olhar para isso?",
    term: "Pensamento mais equilibrado",
    description:
      "Agora tente construir uma interpretação mais completa da situação. Não é pensar positivo nem ignorar o problema. É considerar os fatos, outras possibilidades e aquilo que você diria para alguém de quem gosta na mesma situação.",
    placeholder:
      "Ex.: Meu chefe querer conversar não significa necessariamente que fiz algo errado. Existem várias razões possíveis. Posso esperar a conversa antes de concluir alguma coisa.",
  },
];

/** Texto legível salvo na coluna `emotion` (compatibilidade com registros antigos). */
export const serializeEmotions = (form: RpdFormState): string => {
  const parts = form.emotions.map((e) => {
    const label = e.name === "Outra" && form.emotion_other.trim() ? form.emotion_other.trim() : e.name;
    const before = e.before != null ? ` — ${e.before}/100` : "";
    const after = e.after != null ? ` (depois: ${e.after}/100)` : "";
    return `${label}${before}${after}`;
  });
  return parts.join("; ");
};

/** Texto legível salvo na coluna `cognitive_distortion`. */
export const serializeDistortions = (form: RpdFormState): string => {
  const parts = form.distortions.map((simple) => {
    const opt = DISTORTION_OPTIONS.find((d) => d.simple === simple);
    if (simple.startsWith("Outra") && form.distortion_other.trim()) return form.distortion_other.trim();
    return opt?.technical ? `${opt.simple} (${opt.technical})` : simple;
  });
  return parts.join("; ");
};

/** Payload compatível com as colunas existentes + novos campos opcionais. */
export const toRpdPayload = (form: RpdFormState) => ({
  situation: form.situation.trim(),
  automatic_thought: form.automatic_thought.trim(),
  emotion: serializeEmotions(form),
  behavior: form.behavior.trim(),
  cognitive_distortion: serializeDistortions(form),
  rational_response: form.rational_response.trim(),
  crenca_pensamento_inicial: form.belief_before,
  crenca_pensamento_final: form.belief_after,
  intensidade_emocao_inicial: form.emotions.length
    ? form.emotions.map((e) => ({ emocao: e.name === "Outra" && form.emotion_other.trim() ? form.emotion_other.trim() : e.name, intensidade: e.before }))
    : null,
  intensidade_emocao_final: form.emotions.some((e) => e.after != null)
    ? form.emotions.map((e) => ({ emocao: e.name === "Outra" && form.emotion_other.trim() ? form.emotion_other.trim() : e.name, intensidade: e.after }))
    : null,
});

export const hasRpdContent = (form: RpdFormState) => {
  const p = toRpdPayload(form);
  return Boolean(p.situation || p.automatic_thought || p.emotion || p.behavior || p.cognitive_distortion || p.rational_response);
};
