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
    description: "Esperar que a pior possibilidade aconteça ou imaginar que não conseguiria lidar com ela.",
    example: "“Se eu errar nessa apresentação, vai ser um desastre.”",
    howAppears:
      "Costuma aparecer quando a mente antecipa o cenário mais grave e trata essa possibilidade como provável, mesmo sem evidências.",
    examples: [
      "“Se eu for mal na prova, minha vida acabou.”",
      "“Se eu sentir ansiedade na reunião, vou perder o controle.”",
    ],
    question: "Qual é o pior cenário que minha mente está prevendo? Qual é o cenário mais provável?",
  },
  {
    simple: "Achar que sei o que o outro pensa",
    technical: "Leitura mental",
    description: "Acreditar que sabemos o que outra pessoa está pensando sem ter evidências suficientes.",
    example: "“Ela não respondeu porque está irritada comigo.”",
    howAppears:
      "Aparece quando completamos a lacuna de informação com uma interpretação negativa sobre o que o outro pensa de nós.",
    examples: [
      "“Ele olhou pro celular porque estava entediado comigo.”",
      "“Meu chefe acha que eu sou incompetente.”",
    ],
    question: "Quais evidências reais eu tenho do que essa pessoa está pensando? Existe outra explicação possível?",
  },
  {
    simple: "Prever o futuro",
    technical: "Adivinhação do futuro",
    description: "Tratar uma previsão negativa como se ela já fosse um fato.",
    example: "“Eu sei que não vou conseguir.”",
    howAppears:
      "Aparece quando antecipamos um resultado negativo e agimos como se ele já estivesse decidido, antes mesmo de acontecer.",
    examples: [
      "“Não adianta tentar, vai dar errado.”",
      "“Na festa ninguém vai conversar comigo.”",
    ],
    question: "Isso é um fato ou uma previsão? O que já aconteceu antes em situações parecidas?",
  },
  {
    simple: "Tudo ou nada",
    technical: "Pensamento dicotômico",
    description: "Enxergar as situações em extremos, sem considerar possibilidades intermediárias.",
    example: "“Ou faço perfeitamente ou sou um fracasso.”",
    howAppears:
      "Aparece quando avaliamos a nós mesmos ou as situações em categorias absolutas — perfeito ou horrível, sucesso ou fracasso.",
    examples: [
      "“Se não for o melhor, não serve pra nada.”",
      "“Se ele me decepcionou uma vez, não posso confiar nele nunca.”",
    ],
    question: "Existe algum ponto intermediário entre esses dois extremos? O que estaria entre 0 e 100?",
  },
  {
    simple: "Focar só no que deu errado",
    technical: "Filtro mental",
    description: "Dar muita atenção a um aspecto negativo e deixar de considerar o restante da situação.",
    example: "“Recebi vários elogios, mas só consigo pensar naquela crítica.”",
    howAppears:
      "Aparece quando a mente se prende a um detalhe negativo e o restante da experiência fica em segundo plano, como se não existisse.",
    examples: [
      "“O dia inteiro foi bom, mas aquele comentário estragou tudo.”",
      "“Acertei quase tudo, mas aquele erro mostra como eu sou.”",
    ],
    question: "Se eu olhasse a cena inteira, como um filme, o que mais estaria acontecendo além dessa parte negativa?",
  },
  {
    simple: "Ignorar o que deu certo",
    technical: "Desqualificação do positivo",
    description: "Diminuir ou desconsiderar experiências positivas.",
    example: "“Consegui porque foi fácil. Não conta.”",
    howAppears:
      "Aparece quando conquistas e momentos bons são explicados como sorte, facilidade ou exceção — e nunca como mérito.",
    examples: [
      "“Foi sorte, qualquer um conseguiria.”",
      "“Ele elogiou só por educação.”",
    ],
    question: "Se uma pessoa de quem eu gosto tivesse feito isso, eu também diria que “não conta”?",
  },
  {
    simple: "Transformar um episódio em regra",
    technical: "Supergeneralização",
    description: "Usar uma experiência negativa para concluir que aquilo sempre acontecerá.",
    example: "“Não deu certo dessa vez. Nunca dá certo para mim.”",
    howAppears:
      "Aparece com palavras como “sempre”, “nunca”, “todo mundo” e “ninguém”, transformando um fato isolado em padrão absoluto.",
    examples: [
      "“Eu sempre estrago tudo.”",
      "“Ninguém nunca me leva a sério.”",
    ],
    question: "Isso aconteceu sempre mesmo? Consigo lembrar de alguma vez em que foi diferente?",
  },
  {
    simple: "Me culpar por tudo",
    technical: "Personalização",
    description: "Assumir responsabilidade excessiva por situações que possuem vários fatores envolvidos.",
    example: "“Ele está triste. Eu devo ter feito alguma coisa.”",
    howAppears:
      "Aparece quando assumimos que o mal-estar ou os problemas dos outros são culpa nossa, ignorando outras causas possíveis.",
    examples: [
      "“A reunião foi ruim por minha causa.”",
      "“Meu filho está mal na escola, falhei como mãe.”",
    ],
    question: "Que outros fatores, além de mim, podem estar contribuindo para essa situação?",
  },
  {
    simple: "Me cobrar com “tenho que”",
    technical: "Imperativos / Deveria",
    description: "Criar regras rígidas sobre como você ou outras pessoas deveriam agir.",
    example: "“Eu deveria conseguir dar conta de tudo.”",
    howAppears:
      "Aparece em frases com “tenho que”, “preciso” e “deveria”, como se existisse uma regra inegociável — e a frustração vira culpa ou raiva.",
    examples: [
      "“Eu não posso demonstrar fraqueza.”",
      "“As pessoas deveriam me tratar como eu as trato.”",
    ],
    question: "Essa regra é um fato ou uma expectativa minha? O que aconteceria se fosse uma preferência, e não uma obrigação?",
  },
  {
    simple: "Colocar um rótulo",
    technical: "Rotulação",
    description: "Transformar um comportamento ou erro em uma definição global sobre você ou outra pessoa.",
    example: "“Errei isso. Sou incompetente.”",
    howAppears:
      "Aparece quando, em vez de descrever o que aconteceu (“eu errei”), a mente define quem a pessoa é (“eu sou um erro”).",
    examples: [
      "“Sou um fracasso.”",
      "“Ele é um idiota.”",
    ],
    question: "Estou descrevendo um comportamento ou definindo uma pessoa inteira por um único momento?",
  },
  {
    simple: "Sentir = acreditar que é verdade",
    technical: "Raciocínio emocional",
    description: "Concluir que algo é verdadeiro porque parece verdadeiro emocionalmente.",
    example: "“Eu me sinto incapaz, então provavelmente sou incapaz.”",
    howAppears:
      "Aparece quando tratamos a emoção como evidência dos fatos: “sinto, logo é verdade” — sem checar o que a realidade mostra.",
    examples: [
      "“Sinto medo, então deve ser perigoso.”",
      "“Me sinto culpado, então devo ter feito algo errado.”",
    ],
    question: "Minha emoção é uma evidência dos fatos ou um sinal de como estou interpretando a situação?",
  },
  {
    simple: "Aumentar o negativo e diminuir o positivo",
    technical: "Magnificação e minimização",
    description: "Dar um peso muito maior aos erros e menor às próprias capacidades ou conquistas.",
    example: "“Meu erro foi enorme, mas o que fiz bem não foi nada demais.”",
    howAppears:
      "Aparece quando a mente usa uma lente desigual: amplia falhas e encolhe acertos, como uma balança com pesos adulterados.",
    examples: [
      "“Aquele erro apaga todo o resto.”",
      "“Minhas qualidades? Qualquer pessoa tem isso.”",
    ],
    question: "Estou pesando erros e acertos com a mesma régua? Como essa situação pareceria se eu usasse pesos iguais?",
  },
  {
    simple: "Não sei identificar ainda",
    technical: "",
    description: "Tudo bem. Reconhecer padrões de pensamento é uma habilidade que se desenvolve com prática.",
    example: "",
    howAppears:
      "Não conseguir identificar uma armadilha agora não é um problema — você pode conversar sobre isso com seu terapeuta e voltar a esse registro depois.",
    examples: [],
    question: "Se eu lesse esse pensamento em voz alta, alguma parte dele pareceria exagerada ou rígida demais?",
    notDistortion: true,
  },
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
    question: "Seu pensamento caiu em alguma dessas armadilhas?",
    term: "Armadilhas do pensamento",
    description:
      "Leia as opções abaixo e clique nas que mais se parecem com a forma como você pensou naquela situação. Você pode escolher mais de uma — e tudo bem se ainda não souber identificar.",
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
          (d.technical && normalize(d.technical) === normalize(technicalPart || simplePart)),
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
  if (others.length) distortions.push("Outra");
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
