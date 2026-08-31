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

export interface DistortionOption {
  /** Nome simples exibido em destaque (também persistido). */
  simple: string;
  /** Nome técnico da distorção cognitiva (mantido no banco para relatórios clínicos). */
  technical: string;
  /** Explicação curta exibida no card. */
  description: string;
  /** Exemplo simples exibido no card. */
  example: string;
  /** Conteúdo do recurso educativo "Entender melhor". */
  howAppears: string;
  examples: string[];
  question: string;
  /** true = opção de resposta, não uma distorção cognitiva. */
  notDistortion?: boolean;
  /** Nomes usados em registros antigos — garantem que o parse continue funcionando. */
  legacy?: string[];
}

export const DISTORTION_OPTIONS: DistortionOption[] = [
  {
    simple: "Imaginar o pior",
    technical: "Catastrofização",
    description: "Imaginar que o pior resultado é o mais provável ou que você não conseguiria lidar com ele.",
    example: "“Se eu errar nessa apresentação, vai ser um desastre.”",
    howAppears:
      "A mente aumenta o tamanho da ameaça e diminui sua percepção de capacidade para enfrentá-la.",
    examples: [],
    question:
      "Qual é o resultado mais provável? Se algo difícil acontecer, como eu poderia lidar com isso?",
  },
  {
    simple: "Achar que sei o que o outro pensa",
    technical: "Leitura mental",
    description: "Acreditar que sabe o que outra pessoa está pensando, mesmo sem evidências suficientes.",
    example: "“Ela não respondeu porque está irritada comigo.”",
    howAppears: "Você trata uma interpretação como se fosse uma certeza.",
    examples: [],
    question: "Que evidências apoiam essa conclusão? Existem outras explicações possíveis?",
  },
  {
    simple: "Prever o futuro",
    technical: "Adivinhação do futuro",
    description: "Tratar uma previsão negativa como se ela já fosse um fato.",
    example: "“Eu sei que não vou conseguir.”",
    howAppears: "A mente tenta eliminar a incerteza prevendo um resultado, geralmente negativo.",
    examples: [],
    question: "Estou descrevendo um fato ou fazendo uma previsão? O que ainda pode acontecer de diferente?",
  },
  {
    simple: "Tudo ou nada",
    technical: "Pensamento dicotômico",
    description: "Enxergar uma situação em extremos, sem perceber possibilidades intermediárias.",
    example: "“Ou faço perfeitamente ou sou um fracasso.”",
    howAppears: "As experiências são avaliadas apenas como sucesso ou fracasso, certo ou errado.",
    examples: [],
    question: "Existe algum ponto intermediário? Como eu avaliaria essa situação em uma escala de 0 a 10?",
  },
  {
    simple: "Focar só no que deu errado",
    technical: "Filtro mental",
    description: "Concentrar-se em um aspecto negativo e deixar o restante da experiência em segundo plano.",
    example: "“Recebi vários elogios, mas só consigo pensar na crítica.”",
    howAppears: "Um detalhe negativo ocupa toda a atenção e passa a representar a situação inteira.",
    examples: [],
    question: "O que mais aconteceu? Que informações estou deixando de considerar?",
  },
  {
    simple: "Ignorar o que deu certo",
    technical: "Desqualificação do positivo",
    description: "Diminuir ou desconsiderar experiências positivas, tratando-as como se não tivessem valor.",
    example: "“Só consegui porque tive sorte.”",
    howAppears: "Resultados positivos são explicados como acaso, obrigação ou algo sem importância.",
    examples: [],
    question: "Como eu reconheceria esse resultado se tivesse acontecido com outra pessoa?",
  },
  {
    simple: "Tirar uma regra de um único caso",
    technical: "Supergeneralização",
    legacy: ["Transformar um episódio em regra"],
    description: "Usar uma experiência negativa para criar uma conclusão ampla sobre outras situações.",
    example: "“Não passei nessa entrevista. Nunca vou conseguir um emprego.”",
    howAppears:
      "Um acontecimento isolado vira uma regra sobre o presente ou o futuro. Observe palavras como “sempre”, “nunca” e “tudo”.",
    examples: [],
    question: "Um episódio é suficiente para provar essa conclusão?",
  },
  {
    simple: "Colocar um rótulo em mim ou no outro",
    technical: "Rotulação",
    legacy: ["Colocar um rótulo"],
    description: "Transformar um comportamento ou erro em uma definição global da pessoa.",
    example: "“Cometi um erro, então sou incompetente.”",
    howAppears:
      "Em vez de descrever o que aconteceu, você transforma a experiência em uma identidade fixa. Troque “eu sou” por uma descrição específica: “Eu errei nesta situação.”",
    examples: [],
    question: "Estou descrevendo o que aconteceu ou definindo uma pessoa inteira por um único momento?",
  },
  {
    simple: "Achar que tudo é sobre mim",
    technical: "Personalização",
    legacy: ["Me culpar por tudo"],
    description: "Assumir responsabilidade por algo sem considerar todos os fatores envolvidos.",
    example: "“Eles estão quietos porque eu estraguei o clima.”",
    howAppears: "Você se coloca como causa principal de acontecimentos que podem ter diversas explicações.",
    examples: [],
    question: "Que outros fatores ou pessoas também podem ter influenciado isso?",
  },
  {
    simple: "Pensar em “deveria” e “tenho que”",
    technical: "Afirmações do tipo “Deveria”",
    legacy: ["Me cobrar com “tenho que”", "Imperativos / Deveria"],
    description: "Criar regras rígidas sobre como você, os outros ou o mundo deveriam funcionar.",
    example: "“Eu não deveria me sentir ansioso.”",
    howAppears:
      "Regras rígidas podem gerar culpa, frustração ou cobrança excessiva. Experimente substituir “deveria” por “eu gostaria”, “seria importante” ou “posso tentar”.",
    examples: [],
    question: "Essa regra é um fato ou uma expectativa minha?",
  },
  {
    simple: "Sentir que algo é verdade",
    technical: "Raciocínio emocional",
    legacy: ["Sentir = acreditar que é verdade"],
    description: "Concluir que algo é verdadeiro porque parece verdadeiro emocionalmente.",
    example: "“Eu me sinto incapaz, então devo ser incapaz.”",
    howAppears: "Os sentimentos são importantes, mas não são provas isoladas.",
    examples: [],
    question: "O que os fatos mostram, além do que estou sentindo agora?",
  },
  {
    simple: "Aumentar o negativo e diminuir o positivo",
    technical: "Magnificação e minimização",
    description: "Dar um peso exagerado a dificuldades e reduzir a importância das próprias qualidades ou conquistas.",
    example: "“Meu erro foi enorme, mas meu acerto não foi nada demais.”",
    howAppears: "A mente utiliza medidas diferentes para avaliar erros e acertos.",
    examples: [],
    question: "Estou avaliando os dois lados com o mesmo critério?",
  },
  {
    simple: "Outra armadilha",
    technical: "",
    description: "Percebi um padrão diferente dos apresentados.",
    example: "",
    howAppears: "",
    examples: [],
    question: "",
    notDistortion: true,
  },
  {
    simple: "Ainda não sei identificar",
    technical: "",
    legacy: ["Não sei identificar ainda"],
    description: "Não consegui reconhecer uma armadilha neste momento — e tudo bem.",
    example: "",
    howAppears:
      "Não conseguir identificar uma armadilha agora não é um problema — você pode conversar sobre isso com seu terapeuta e voltar a esse registro depois.",
    examples: [],
    question: "",
    notDistortion: true,
  },
];

export interface RpdStep {
  n: number;
  question: string;
  term: string;
  description: string;
  placeholder?: string;
  /** Texto complementar exibido em destaque menor abaixo da descrição. */
  note?: string;
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
    question: "Seu pensamento caiu em alguma dessas armadilhas?",
    term: "Armadilhas do pensamento",
    description:
      "Às vezes, nossa mente interpreta uma situação de forma rápida e automática. Leia os post-its e marque aqueles que mais se parecem com a forma como você pensou. Você pode escolher mais de um — e tudo bem se ainda não souber identificar.",
    note: "Essas armadilhas não significam que você pensou “errado”. Elas são padrões comuns de interpretação que podem influenciar como nos sentimos e agimos.",
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

// ---------------------------------------------------------------------------
// Recuperação (parse) — mantém o nome técnico e devolve a seleção da Etapa 5
// ---------------------------------------------------------------------------

export interface DistortionChip {
  simple: string;
  technical: string;
  known: boolean;
}

const normalize = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Converte o texto salvo em `cognitive_distortion` em chips (nome simples + técnico). */
export const parseDistortionChips = (text?: string | null): DistortionChip[] => {
  if (!text) return [];
  return text
    .split(";")
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      // formato salvo: "Nome simples (Nome técnico)"
      const m = raw.match(/^(.*?)\s*\((.+)\)$/);
      const simplePart = (m ? m[1] : raw).trim();
      const technicalPart = m ? m[2].trim() : "";
      const opt = DISTORTION_OPTIONS.find(
        (d) =>
          normalize(d.simple) === normalize(simplePart) ||
          (d.technical && normalize(d.technical) === normalize(technicalPart || simplePart)) ||
          (d.legacy ?? []).some((l) => normalize(l) === normalize(simplePart) || normalize(l) === normalize(technicalPart)),
      );
      if (opt) return { simple: opt.simple, technical: opt.technical, known: true };
      return { simple: simplePart || raw, technical: technicalPart, known: false };
    });
};

/** Recupera a seleção da Etapa 5 para reabrir o formulário sem perder nada. */
export const parseDistortions = (
  text?: string | null,
): { distortions: string[]; distortion_other: string } => {
  const chips = parseDistortionChips(text);
  const distortions = chips.filter((c) => c.known).map((c) => c.simple);
  const others = chips.filter((c) => !c.known).map((c) => c.simple);
  if (others.length) distortions.push("Outra armadilha");
  return { distortions, distortion_other: others.join("; ") };
};

const parseEmotionsFromRecord = (record: any): { emotions: RpdEmotion[]; emotion_other: string } => {
  const before: any[] = Array.isArray(record?.intensidade_emocao_inicial) ? record.intensidade_emocao_inicial : [];
  const after: any[] = Array.isArray(record?.intensidade_emocao_final) ? record.intensidade_emocao_final : [];
  if (before.length || after.length) {
    const names = Array.from(new Set([...before, ...after].map((e) => String(e?.emocao ?? "")).filter(Boolean)));
    const known = names.filter((n) => EMOTION_OPTIONS.includes(n));
    const custom = names.filter((n) => !EMOTION_OPTIONS.includes(n));
    const emotions: RpdEmotion[] = known.map((name) => ({
      name,
      before: before.find((e) => e.emocao === name)?.intensidade ?? null,
      after: after.find((e) => e.emocao === name)?.intensidade ?? null,
    }));
    if (custom.length) {
      emotions.push({
        name: "Outra",
        before: before.find((e) => e.emocao === custom[0])?.intensidade ?? null,
        after: after.find((e) => e.emocao === custom[0])?.intensidade ?? null,
      });
    }
    return { emotions, emotion_other: custom[0] ?? "" };
  }
  // fallback: texto legível "Ansiedade — 80/100 (depois: 40/100)"
  const raw = String(record?.emotion ?? "").trim();
  if (!raw) return { emotions: [], emotion_other: "" };
  const emotions: RpdEmotion[] = [];
  let emotion_other = "";
  raw.split(";").map((p) => p.trim()).filter(Boolean).forEach((part) => {
    const name = part.split("—")[0].split("(")[0].trim();
    const beforeM = part.match(/—\s*(\d+)\/100/);
    const afterM = part.match(/depois:\s*(\d+)\/100/i);
    const known = EMOTION_OPTIONS.includes(name);
    if (!known && !emotion_other) emotion_other = name;
    emotions.push({
      name: known ? name : "Outra",
      before: beforeM ? Number(beforeM[1]) : null,
      after: afterM ? Number(afterM[1]) : null,
    });
  });
  return { emotions, emotion_other };
};

/** Reconstrói o estado do formulário a partir de um registro salvo. */
export const fromRpdRecord = (record: any): RpdFormState => {
  const { distortions, distortion_other } = parseDistortions(record?.cognitive_distortion);
  const { emotions, emotion_other } = parseEmotionsFromRecord(record);
  return {
    situation: record?.situation ?? "",
    automatic_thought: record?.automatic_thought ?? "",
    behavior: record?.behavior ?? "",
    rational_response: record?.rational_response ?? "",
    emotions,
    emotion_other,
    distortions,
    distortion_other,
    belief_before: record?.crenca_pensamento_inicial ?? null,
    belief_after: record?.crenca_pensamento_final ?? null,
  };
};

/** Agrega as armadilhas mais frequentes (evolução do paciente / relatórios). */
export const aggregateDistortions = (
  records: { cognitive_distortion?: string | null }[],
): { simple: string; technical: string; count: number }[] => {
  const map = new Map<string, { simple: string; technical: string; count: number }>();
  records.forEach((r) => {
    parseDistortionChips(r.cognitive_distortion).forEach((c) => {
      const opt = DISTORTION_OPTIONS.find((d) => d.simple === c.simple);
      if (opt?.notDistortion) return;
      const key = c.simple;
      const cur = map.get(key);
      if (cur) cur.count += 1;
      else map.set(key, { simple: c.simple, technical: c.technical, count: 1 });
    });
  });
  return [...map.values()].sort((a, b) => b.count - a.count);
};
