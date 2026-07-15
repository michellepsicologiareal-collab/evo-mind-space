import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Filter, Search, Stethoscope, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type DSM5Detail = {
  diagnosis: string;        // human-readable label (also stored in plan.cid)
  code?: string;            // short slug
  criteriaChecked: string[];
  severity: string;
  notes?: string;
};

type Entry = {
  code: string;
  label: string;
  short?: string;
  keywords?: string[];
  criteria: string[];
  severity: string[];
  differentials: string[];
  schemas: string[];
};

export const DSM5_CATALOG_KEYWORDS: Record<string, string[]> = {
  // Ansiedade
  TAG: ["preocupação", "ansiedade generalizada", "tensão", "insônia", "ruminação"],
  PANICO: ["ataque", "taquicardia", "falta de ar", "morte"],
  AGORA: ["agorafobia", "sair de casa", "multidão", "transporte"],
  FS: ["social", "vergonha", "timidez", "desempenho", "público"],
  FE: ["fobia", "animal", "altura", "sangue", "avião"],
  TAS: ["separação", "apego", "infância"],
  MS: ["mutismo", "seletivo", "criança", "não fala"],
  // TOC e relacionados
  TOC: ["obsessão", "compulsão", "ritual", "limpeza", "verificação", "contaminação"],
  TDC: ["dismórfico", "imagem corporal", "aparência", "defeito"],
  TACU: ["acumulação", "descarte", "hoarding"],
  TRIC: ["tricotilomania", "arrancar cabelo"],
  TESC: ["escoriação", "beliscar pele"],
  // Somático
  TAD: ["hipocondria", "saúde", "doença", "somático"],
  TSS: ["sintomas somáticos", "dor", "queixas físicas"],
  TCONV: ["conversão", "neurológico funcional", "paralisia", "convulsão psicogênica"],
  TFAC: ["factício", "simulação", "adoecer intencional"],
  // Humor
  EDM: ["depressão", "tristeza", "anedonia", "suicídio", "humor"],
  TDP: ["distimia", "crônica", "desesperança"],
  TDDH: ["irritabilidade", "criança", "explosão", "humor disruptivo"],
  TDPM: ["pré-menstrual", "TPM", "disfórico"],
  // Bipolar
  TB1: ["mania", "bipolar", "euforia", "grandiosidade"],
  TB2: ["hipomania", "bipolar", "ciclos"],
  CICLO: ["ciclotimia", "oscilação leve"],
  // Psicóticos
  ESQ: ["esquizofrenia", "alucinação", "delírio", "psicose"],
  ESQAF: ["esquizoafetivo"],
  ESQFORME: ["esquizofreniforme"],
  TPB_PSI: ["psicótico breve"],
  TDEL: ["delirante", "paranoide crônico"],
  // Personalidade
  TPB: ["borderline", "abandono", "instabilidade", "automutilação", "limítrofe"],
  TPN: ["narcisista", "grandiosidade", "admiração", "empatia"],
  TPPAR: ["paranoide", "desconfiança"],
  TPESQ: ["esquizoide", "isolamento", "frio"],
  TPESQT: ["esquizotípica", "excêntrico", "pensamento mágico"],
  TPAS: ["antissocial", "psicopatia", "sociopata"],
  TPHIS: ["histriônica", "dramática", "atenção"],
  TPEV: ["evitativa", "inibição", "inadequação"],
  TPDEP: ["dependente", "submissão", "cuidados"],
  TPOC: ["obsessivo-compulsiva", "perfeccionismo", "rigidez"],
  // Neurodesenvolvimento
  TDAH: ["atenção", "hiperatividade", "impulsividade", "concentração", "desatenção"],
  TEA: ["autismo", "espectro", "comunicação social", "estereotipia"],
  DI: ["deficiência intelectual", "QI", "atraso cognitivo"],
  TAPR: ["dislexia", "discalculia", "aprendizagem"],
  TCOM: ["linguagem", "fala", "gagueira", "pragmática"],
  TTIC: ["tique", "Tourette", "vocal", "motor"],
  // Trauma
  TEPT: ["trauma", "pesadelo", "flashback", "estresse pós", "hipervigilância"],
  TEA_AG: ["estresse agudo"],
  TA: ["ajustamento", "estressor", "luto", "adaptação"],
  TLP: ["luto prolongado", "luto complicado"],
  TAR: ["apego reativo", "criança institucional"],
  TESD: ["envolvimento social desinibido"],
  // Dissociativo
  TID: ["identidade dissociativa", "múltiplas personalidades"],
  AD: ["amnésia dissociativa", "fuga"],
  TDR: ["despersonalização", "desrealização"],
  // Alimentar
  TCAP: ["compulsão alimentar", "binge", "comida"],
  BN: ["bulimia", "purga", "vômito", "compensação"],
  AN: ["anorexia", "magreza", "restrição alimentar", "imagem corporal"],
  ARFID: ["ARFID", "restritivo evitativo", "seletividade alimentar"],
  PICA: ["pica", "ingestão não alimentar"],
  TRUM: ["ruminação", "regurgitação"],
  // Eliminação
  ENUR: ["enurese", "urina", "xixi na cama"],
  ENCO: ["encoprese", "fezes"],
  // Sono
  INS: ["insônia"],
  HIPER: ["hipersonolência", "sonolência excessiva"],
  NARCO: ["narcolepsia", "cataplexia"],
  APN: ["apneia do sono"],
  PES: ["pesadelo"],
  TSREM: ["comportamento REM"],
  SPI: ["pernas inquietas"],
  // Sexual / Gênero
  DE: ["disfunção erétil"],
  EJP: ["ejaculação precoce"],
  TDSM: ["desejo sexual", "libido"],
  DG: ["disforia de gênero"],
  // Disruptivos
  TOD: ["opositivo desafiador", "birra"],
  TC: ["transtorno de conduta", "agressividade", "delinquência"],
  TEI: ["explosivo intermitente", "raiva", "descontrole"],
  PIRO: ["piromania", "fogo"],
  CLEP: ["cleptomania", "furto"],
  // Substância
  TUA: ["álcool", "alcoolismo"],
  TUS: ["substância", "droga", "dependência química"],
  TJOGO: ["jogo patológico", "aposta", "gambling"],
  // Neurocognitivos
  DEL: ["delirium", "confusão aguda"],
  TNCM: ["demência", "neurocognitivo maior", "Alzheimer"],
  TNCL: ["neurocognitivo leve", "declínio cognitivo"],
};

export type DSM5Category =
  | "Ansiedade"
  | "TOC"
  | "Somático"
  | "Humor"
  | "Bipolar"
  | "Psicótico"
  | "Personalidade"
  | "Neurodesenvolvimento"
  | "Trauma"
  | "Dissociativo"
  | "Alimentar"
  | "Eliminação"
  | "Sono"
  | "Sexual/Gênero"
  | "Disruptivo"
  | "Substância"
  | "Neurocognitivo";

export const DSM5_CATEGORY_OF: Record<string, DSM5Category> = {
  TAG: "Ansiedade", PANICO: "Ansiedade", AGORA: "Ansiedade", FS: "Ansiedade", FE: "Ansiedade", TAS: "Ansiedade", MS: "Ansiedade",
  TOC: "TOC", TDC: "TOC", TACU: "TOC", TRIC: "TOC", TESC: "TOC",
  TAD: "Somático", TSS: "Somático", TCONV: "Somático", TFAC: "Somático",
  EDM: "Humor", TDP: "Humor", TDDH: "Humor", TDPM: "Humor",
  TB1: "Bipolar", TB2: "Bipolar", CICLO: "Bipolar",
  ESQ: "Psicótico", ESQAF: "Psicótico", ESQFORME: "Psicótico", TPB_PSI: "Psicótico", TDEL: "Psicótico",
  TPB: "Personalidade", TPN: "Personalidade", TPPAR: "Personalidade", TPESQ: "Personalidade", TPESQT: "Personalidade",
  TPAS: "Personalidade", TPHIS: "Personalidade", TPEV: "Personalidade", TPDEP: "Personalidade", TPOC: "Personalidade",
  TDAH: "Neurodesenvolvimento", TEA: "Neurodesenvolvimento", DI: "Neurodesenvolvimento",
  TAPR: "Neurodesenvolvimento", TCOM: "Neurodesenvolvimento", TTIC: "Neurodesenvolvimento",
  TEPT: "Trauma", TEA_AG: "Trauma", TA: "Trauma", TLP: "Trauma", TAR: "Trauma", TESD: "Trauma",
  TID: "Dissociativo", AD: "Dissociativo", TDR: "Dissociativo",
  TCAP: "Alimentar", BN: "Alimentar", AN: "Alimentar", ARFID: "Alimentar", PICA: "Alimentar", TRUM: "Alimentar",
  ENUR: "Eliminação", ENCO: "Eliminação",
  INS: "Sono", HIPER: "Sono", NARCO: "Sono", APN: "Sono", PES: "Sono", TSREM: "Sono", SPI: "Sono",
  DE: "Sexual/Gênero", EJP: "Sexual/Gênero", TDSM: "Sexual/Gênero", DG: "Sexual/Gênero",
  TOD: "Disruptivo", TC: "Disruptivo", TEI: "Disruptivo", PIRO: "Disruptivo", CLEP: "Disruptivo",
  TUA: "Substância", TUS: "Substância", TJOGO: "Substância",
  DEL: "Neurocognitivo", TNCM: "Neurocognitivo", TNCL: "Neurocognitivo",
};

const CATEGORY_OPTIONS: DSM5Category[] = [
  "Ansiedade", "TOC", "Somático", "Humor", "Bipolar", "Psicótico", "Personalidade",
  "Neurodesenvolvimento", "Trauma", "Dissociativo", "Alimentar", "Eliminação", "Sono",
  "Sexual/Gênero", "Disruptivo", "Substância", "Neurocognitivo",
];

const SEVERITY_OPTIONS = ["Leve", "Moderado", "Grave"];


const CATALOG: Entry[] = [
  {
    code: "TAG",
    label: "Transtorno de Ansiedade Generalizada (TAG)",
    short: "TAG",
    criteria: [
      "Ansiedade e preocupação excessivas na maioria dos dias por ≥6 meses",
      "Dificuldade de controlar a preocupação",
      "Inquietação ou sensação de estar 'no limite'",
      "Fatigabilidade",
      "Dificuldade de concentração ou 'branco' mental",
      "Irritabilidade",
      "Tensão muscular",
      "Perturbação do sono",
      "Sofrimento clinicamente significativo ou prejuízo funcional",
    ],
    severity: ["Leve", "Moderada", "Grave"],
    differentials: ["Transtorno do Pânico", "TOC", "TEPT", "Transtorno de Ansiedade por Doença", "Depressão", "Hipertireoidismo"],
    schemas: ["Vulnerabilidade ao Dano", "Padrões Inflexíveis", "Autocontrole/Autodisciplina insuficientes", "Modo Crítico Punitivo"],
  },
  {
    code: "PANICO",
    label: "Transtorno do Pânico",
    short: "Pânico",
    criteria: [
      "Ataques de pânico recorrentes e inesperados",
      "Preocupação persistente com novos ataques (≥1 mês)",
      "Mudança desadaptativa de comportamento relacionada aos ataques",
      "Palpitações, sudorese, tremores",
      "Falta de ar, sensação de asfixia",
      "Dor torácica, náusea, tontura",
      "Medo de morrer ou enlouquecer",
      "Despersonalização/desrealização",
    ],
    severity: ["Leve (≤1 ataque/sem)", "Moderada", "Grave (diários)"],
    differentials: ["TAG", "Fobia específica", "Causas médicas (cardíacas, tireoide)", "Uso de substâncias"],
    schemas: ["Vulnerabilidade ao Dano", "Dependência/Incompetência", "Modo Criança Vulnerável"],
  },
  {
    code: "FS",
    label: "Fobia Social (Transtorno de Ansiedade Social)",
    short: "Fobia Social",
    criteria: [
      "Medo acentuado de situações sociais com possível avaliação",
      "Receio de agir/mostrar sintomas que causem humilhação",
      "Situações sociais quase sempre provocam medo/ansiedade",
      "Evitação ou suportadas com intenso sofrimento",
      "Medo desproporcional à ameaça real",
      "Duração ≥6 meses",
      "Sofrimento ou prejuízo significativo",
    ],
    severity: ["Leve", "Moderada", "Grave", "Apenas desempenho"],
    differentials: ["TAG", "Transtorno de Personalidade Esquiva", "Transtorno do Espectro Autista", "TDC"],
    schemas: ["Isolamento Social", "Defectividade/Vergonha", "Padrões Inflexíveis", "Subjugação"],
  },
  {
    code: "TOC",
    label: "Transtorno Obsessivo-Compulsivo (TOC)",
    short: "TOC",
    criteria: [
      "Obsessões: pensamentos/imagens recorrentes e intrusivos",
      "Compulsões: comportamentos/atos mentais repetitivos",
      "Tentativas de neutralizar/suprimir obsessões",
      "Consome >1h/dia ou causa sofrimento marcado",
      "Não explicado por outro transtorno mental",
      "Especificar grau de insight",
    ],
    severity: ["Insight bom", "Insight pobre", "Insight ausente/delirante"],
    differentials: ["TAG", "Transtorno Dismórfico Corporal", "Tiques", "Personalidade Obsessivo-Compulsiva"],
    schemas: ["Padrões Inflexíveis", "Vulnerabilidade ao Dano", "Modo Crítico Punitivo", "Modo Protetor Desligado"],
  },
  {
    code: "TAD",
    label: "Transtorno de Ansiedade por Doença",
    short: "T. Ansiedade Doença",
    criteria: [
      "Preocupação com ter/adquirir uma doença grave",
      "Sintomas somáticos ausentes ou leves",
      "Alto nível de ansiedade sobre saúde",
      "Comportamentos excessivos relacionados à saúde OU evitação maladaptativa",
      "Duração ≥6 meses",
      "Não explicada por outro transtorno",
    ],
    severity: ["Tipo busca de cuidados", "Tipo evitação de cuidados"],
    differentials: ["Transtorno de Sintomas Somáticos", "TOC", "TAG", "Transtorno Depressivo"],
    schemas: ["Vulnerabilidade ao Dano", "Modo Criança Vulnerável", "Padrões Inflexíveis"],
  },
  {
    code: "EDM",
    label: "Episódio Depressivo Maior",
    short: "Depressão",
    criteria: [
      "Humor deprimido na maior parte do dia (≥2 semanas)",
      "Anedonia / perda de interesse",
      "Alteração significativa de peso/apetite",
      "Insônia ou hipersonia",
      "Agitação/retardo psicomotor observável",
      "Fadiga ou perda de energia",
      "Sentimentos de inutilidade ou culpa excessiva",
      "Dificuldade de concentração/indecisão",
      "Ideação suicida recorrente",
    ],
    severity: ["Leve", "Moderado", "Grave", "Com sintomas psicóticos"],
    differentials: ["Transtorno Bipolar", "Transtorno de Ajustamento", "Luto", "Hipotireoidismo"],
    schemas: ["Defectividade/Vergonha", "Privação Emocional", "Fracasso", "Modo Crítico Punitivo", "Modo Criança Vulnerável"],
  },
  {
    code: "TDP",
    label: "Transtorno Depressivo Persistente (Distimia)",
    short: "Distimia",
    criteria: [
      "Humor deprimido na maioria dos dias por ≥2 anos",
      "Pouco apetite ou hiperfagia",
      "Insônia ou hipersonia",
      "Baixa energia/fadiga",
      "Baixa autoestima",
      "Concentração/decisão prejudicadas",
      "Sentimentos de desesperança",
      "Sem alívio >2 meses no período",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["EDM", "Transtorno Ciclotímico", "Transtorno de Personalidade", "Hipotireoidismo"],
    schemas: ["Defectividade/Vergonha", "Privação Emocional", "Fracasso", "Negativismo/Pessimismo"],
  },
  {
    code: "TB1",
    label: "Transtorno Bipolar I",
    short: "Bipolar I",
    criteria: [
      "Episódio maníaco (≥1 semana ou hospitalização)",
      "Humor elevado/expansivo/irritável persistente",
      "Autoestima inflada/grandiosidade",
      "Diminuição da necessidade de sono",
      "Mais falante / pressão para falar",
      "Fuga de ideias",
      "Distratibilidade",
      "Aumento de atividade dirigida a objetivos",
      "Envolvimento em atividades de risco",
    ],
    severity: ["Leve", "Moderado", "Grave", "Com características psicóticas"],
    differentials: ["TB II", "Esquizoafetivo", "TDAH", "Uso de substâncias", "Borderline"],
    schemas: ["Grandiosidade/Merecimento", "Autocontrole insuficiente", "Padrões Inflexíveis"],
  },
  {
    code: "TB2",
    label: "Transtorno Bipolar II",
    short: "Bipolar II",
    criteria: [
      "≥1 episódio hipomaníaco (≥4 dias)",
      "≥1 episódio depressivo maior",
      "Nunca houve episódio maníaco",
      "Alteração observável por terceiros",
      "Sem prejuízo grave durante hipomania",
      "Sintomas não atribuíveis a substância",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["TB I", "Ciclotimia", "Borderline", "EDM com irritabilidade"],
    schemas: ["Padrões Inflexíveis", "Privação Emocional", "Autocontrole insuficiente"],
  },
  {
    code: "TPB",
    label: "Transtorno de Personalidade Borderline",
    short: "Borderline",
    criteria: [
      "Esforços frenéticos para evitar abandono",
      "Relações instáveis e intensas",
      "Perturbação de identidade",
      "Impulsividade em ≥2 áreas potencialmente danosas",
      "Comportamento/ameaças/automutilação suicida recorrente",
      "Instabilidade afetiva acentuada",
      "Sentimentos crônicos de vazio",
      "Raiva intensa e dificuldade de controlá-la",
      "Ideação paranoide ou dissociação transitórias sob estresse",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["TB II", "TEPT complexo", "Histriônica", "Narcisista", "Dependente"],
    schemas: ["Abandono", "Desconfiança/Abuso", "Privação Emocional", "Defectividade", "Modo Criança Abandonada", "Modo Criança Raivosa", "Modo Protetor Desligado", "Modo Crítico Punitivo"],
  },
  {
    code: "TPN",
    label: "Transtorno de Personalidade Narcisista",
    short: "Narcisista",
    criteria: [
      "Sentimento grandioso de auto-importância",
      "Fantasias de sucesso/poder/brilho ilimitados",
      "Crença de ser 'especial' e único",
      "Necessidade excessiva de admiração",
      "Senso de merecimento",
      "Comportamento explorativo",
      "Falta de empatia",
      "Frequentemente invejoso",
      "Comportamentos/atitudes arrogantes",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["Antissocial", "Histriônica", "Borderline", "Mania/Hipomania"],
    schemas: ["Grandiosidade/Merecimento", "Padrões Inflexíveis", "Defectividade (oculta)", "Modo Auto-engrandecedor", "Modo Protetor Desligado"],
  },
  {
    code: "TDAH",
    label: "Transtorno de Déficit de Atenção/Hiperatividade (TDAH)",
    short: "TDAH",
    criteria: [
      "Desatenção: erros por descuido frequentes",
      "Dificuldade em manter atenção em tarefas",
      "Parece não escutar quando falam",
      "Não segue instruções/finaliza tarefas",
      "Dificuldade de organização",
      "Hiperatividade: inquietação, mexe mãos/pés",
      "Levanta-se em situações inadequadas",
      "Fala em excesso",
      "Impulsividade: responde antes da pergunta",
      "Dificuldade em esperar a vez",
      "Sintomas antes dos 12 anos",
      "Prejuízo em ≥2 contextos",
    ],
    severity: ["Apresentação desatenta", "Apresentação hiperativa/impulsiva", "Combinada", "Leve/Moderada/Grave"],
    differentials: ["TAG", "TB", "Borderline", "TEA", "Trauma", "Apneia do sono"],
    schemas: ["Autocontrole/Autodisciplina insuficientes", "Fracasso", "Defectividade", "Modo Criança Impulsiva"],
  },
  {
    code: "TEPT",
    label: "Transtorno de Estresse Pós-Traumático (TEPT)",
    short: "TEPT",
    criteria: [
      "Exposição a evento traumático (vivido, testemunhado, soube)",
      "Sintomas intrusivos (memórias, pesadelos, flashbacks)",
      "Evitação persistente de estímulos associados",
      "Alterações negativas em cognições e humor",
      "Alterações de excitação/reatividade (irritabilidade, hipervigilância)",
      "Duração >1 mês",
      "Sofrimento ou prejuízo significativo",
    ],
    severity: ["Leve", "Moderado", "Grave", "Com sintomas dissociativos"],
    differentials: ["T. Estresse Agudo", "T. Ajustamento", "Borderline", "Depressão", "T. Pânico"],
    schemas: ["Desconfiança/Abuso", "Vulnerabilidade ao Dano", "Defectividade", "Modo Criança Vulnerável", "Modo Protetor Desligado"],
  },
  {
    code: "TA",
    label: "Transtorno de Ajustamento",
    short: "T. Ajustamento",
    criteria: [
      "Sintomas emocionais/comportamentais em resposta a estressor identificável",
      "Início ≤3 meses após o estressor",
      "Sofrimento desproporcional à intensidade do estressor OU prejuízo",
      "Não corresponde a outro transtorno",
      "Não é apenas exacerbação de transtorno preexistente",
      "Sintomas resolvem em ≤6 meses após cessação do estressor",
    ],
    severity: ["Humor deprimido", "Ansiedade", "Misto", "Distúrbio de conduta", "Misto emoções e conduta"],
    differentials: ["EDM", "TAG", "TEPT", "Luto"],
    schemas: ["Vulnerabilidade ao Dano", "Modo Criança Vulnerável", "Privação Emocional"],
  },
  {
    code: "TAS",
    label: "Transtorno de Ansiedade de Separação",
    short: "T. Separação",
    criteria: [
      "Sofrimento excessivo antecipando ou diante de separação",
      "Preocupação persistente em perder figuras de apego",
      "Preocupação com evento que cause separação",
      "Relutância em sair/ficar sozinho",
      "Recusa em dormir longe de casa",
      "Pesadelos repetidos sobre separação",
      "Queixas somáticas em separações",
      "Duração ≥4 sem (crianças) ou ≥6 meses (adultos)",
    ],
    severity: ["Leve", "Moderada", "Grave"],
    differentials: ["TAG", "Fobia Social", "Agorafobia", "TEPT"],
    schemas: ["Abandono", "Dependência/Incompetência", "Privação Emocional"],
  },
  {
    code: "TCAP",
    label: "Transtorno de Compulsão Alimentar",
    short: "Compulsão Alimentar",
    criteria: [
      "Episódios recorrentes de compulsão alimentar",
      "Comer muito mais rápido que o normal",
      "Comer até sentir-se desconfortavelmente cheio",
      "Comer grandes quantidades sem fome",
      "Comer sozinho por vergonha",
      "Sentir-se deprimido/culpado após o episódio",
      "Sofrimento marcado",
      "≥1x/sem por ≥3 meses",
      "Sem comportamentos compensatórios regulares",
    ],
    severity: ["Leve (1–3/sem)", "Moderado (4–7)", "Grave (8–13)", "Extremo (≥14)"],
    differentials: ["Bulimia Nervosa", "Anorexia subtipo BP", "EDM com hiperfagia", "Bipolar"],
    schemas: ["Autocontrole insuficiente", "Defectividade", "Privação Emocional", "Modo Criança Impulsiva", "Modo Protetor Desligado"],
  },
  {
    code: "BN",
    label: "Bulimia Nervosa",
    short: "Bulimia",
    criteria: [
      "Episódios recorrentes de compulsão alimentar",
      "Comportamentos compensatórios inadequados recorrentes",
      "Compulsão e compensação ≥1x/sem por ≥3 meses",
      "Autoavaliação indevidamente influenciada por forma/peso",
      "Não ocorre exclusivamente durante AN",
    ],
    severity: ["Leve (1–3/sem)", "Moderado (4–7)", "Grave (8–13)", "Extremo (≥14)"],
    differentials: ["TCAP", "Anorexia subtipo BP", "Bipolar com hiperfagia"],
    schemas: ["Defectividade/Vergonha", "Padrões Inflexíveis", "Autocontrole insuficiente", "Modo Crítico Punitivo"],
  },
  {
    code: "AN",
    label: "Anorexia Nervosa",
    short: "Anorexia",
    criteria: [
      "Restrição da ingesta levando a baixo peso significativo",
      "Medo intenso de ganhar peso ou engordar",
      "Perturbação na percepção do peso/forma",
      "Negação da gravidade do baixo peso atual",
      "Subtipo restritivo OU compulsão/purgação",
    ],
    severity: ["Leve (IMC ≥17)", "Moderado (16–16.99)", "Grave (15–15.99)", "Extremo (<15)"],
    differentials: ["Bulimia", "Causas médicas de perda de peso", "EDM com perda de apetite", "TOC"],
    schemas: ["Padrões Inflexíveis", "Defectividade/Vergonha", "Subjugação", "Modo Crítico Punitivo", "Modo Hipercontrolador"],
  },
  // ─────────── ANSIEDADE (adicionais) ───────────
  {
    code: "AGORA", label: "Agorafobia", short: "Agorafobia",
    criteria: [
      "Medo/ansiedade acentuados em ≥2 situações (transporte público, espaços abertos/fechados, filas, multidões, sair sozinho)",
      "Medo de não conseguir escapar ou receber ajuda",
      "Situações quase sempre provocam medo",
      "Evitação, exigência de companhia ou sofrimento intenso",
      "Duração ≥6 meses; prejuízo funcional",
    ],
    severity: ["Leve", "Moderada", "Grave"],
    differentials: ["Fobia específica", "T. Pânico sem agorafobia", "TEPT", "T. Depressivo"],
    schemas: ["Vulnerabilidade ao Dano", "Dependência/Incompetência"],
  },
  {
    code: "FE", label: "Fobia Específica", short: "Fobia Específica",
    criteria: [
      "Medo acentuado de objeto ou situação específica",
      "Exposição quase sempre provoca ansiedade imediata",
      "Evitação ativa ou sofrimento intenso",
      "Medo desproporcional à ameaça real",
      "Duração ≥6 meses; prejuízo/sofrimento",
    ],
    severity: ["Animal", "Ambiente natural", "Sangue-injeção-ferimento", "Situacional", "Outras"],
    differentials: ["Agorafobia", "T. Pânico", "TOC", "TEPT"],
    schemas: ["Vulnerabilidade ao Dano"],
  },
  {
    code: "MS", label: "Mutismo Seletivo", short: "Mutismo Seletivo",
    criteria: [
      "Fracasso consistente em falar em situações sociais específicas apesar de falar em outras",
      "Interferência no desempenho escolar/social/comunicação",
      "Duração ≥1 mês (não apenas o 1º mês escolar)",
      "Não devido a falta de conhecimento do idioma",
      "Não explicado por T. de Comunicação",
    ],
    severity: ["Leve", "Moderada", "Grave"],
    differentials: ["T. Comunicação", "Fobia Social", "TEA"],
    schemas: ["Inibição Emocional", "Defectividade"],
  },
  // ─────────── TOC E RELACIONADOS ───────────
  {
    code: "TDC", label: "Transtorno Dismórfico Corporal", short: "TDC",
    criteria: [
      "Preocupação com um ou mais defeitos percebidos na aparência, não observáveis ou leves aos outros",
      "Comportamentos repetitivos (espelho, camuflagem, comparação) ou atos mentais",
      "Sofrimento ou prejuízo significativo",
      "Não é melhor explicada por T. Alimentar",
      "Especificar: com dismorfia muscular; grau de insight",
    ],
    severity: ["Insight bom", "Insight pobre", "Insight ausente/delirante"],
    differentials: ["TOC", "T. Alimentar", "Fobia Social", "T. Depressivo"],
    schemas: ["Defectividade/Vergonha", "Padrões Inflexíveis"],
  },
  {
    code: "TACU", label: "Transtorno de Acumulação", short: "Acumulação",
    criteria: [
      "Dificuldade persistente em descartar bens, independentemente do valor",
      "Necessidade percebida de guardar e sofrimento ao descartar",
      "Acúmulo congestiona áreas de moradia e compromete uso",
      "Sofrimento ou prejuízo significativo",
      "Especificar aquisição excessiva; insight",
    ],
    severity: ["Insight bom", "Insight pobre", "Insight ausente/delirante"],
    differentials: ["TOC", "TDC", "TNC", "Depressão"],
    schemas: ["Privação Emocional", "Vulnerabilidade ao Dano"],
  },
  {
    code: "TRIC", label: "Tricotilomania", short: "Tricotilomania",
    criteria: [
      "Arrancar recorrente dos próprios cabelos com perda perceptível",
      "Tentativas repetidas de reduzir/cessar o comportamento",
      "Sofrimento ou prejuízo significativo",
      "Não atribuível a condição médica",
      "Não é melhor explicado por outro transtorno",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["TOC", "TDC", "Estereotipia motora"],
    schemas: ["Autocontrole insuficiente", "Modo Criança Vulnerável"],
  },
  {
    code: "TESC", label: "Transtorno de Escoriação (Skin-picking)", short: "Escoriação",
    criteria: [
      "Beliscar a pele recorrente resultando em lesões",
      "Tentativas repetidas de reduzir/cessar",
      "Sofrimento ou prejuízo significativo",
      "Não atribuível a substância/condição médica",
      "Não é melhor explicado por outro transtorno",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["TOC", "TDC", "Autolesão não suicida"],
    schemas: ["Autocontrole insuficiente", "Defectividade"],
  },
  // ─────────── SOMÁTICOS ───────────
  {
    code: "TSS", label: "Transtorno de Sintomas Somáticos", short: "Sintomas Somáticos",
    criteria: [
      "≥1 sintoma somático angustiante ou que prejudica a vida diária",
      "Pensamentos, sentimentos ou comportamentos excessivos relacionados aos sintomas",
      "Estado sintomático persistente (≥6 meses)",
      "Especificar: com dor predominante; persistente; gravidade",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["T. Ansiedade Doença", "T. Conversivo", "T. Depressivo", "T. Pânico"],
    schemas: ["Vulnerabilidade ao Dano", "Privação Emocional"],
  },
  {
    code: "TCONV", label: "Transtorno Conversivo (Sintoma Neurológico Funcional)", short: "Conversivo",
    criteria: [
      "≥1 sintoma de função motora ou sensorial alterada",
      "Evidência clínica de incompatibilidade com condição neurológica",
      "Sintoma não é melhor explicado por outra condição",
      "Sofrimento ou prejuízo significativo",
      "Especificar tipo (paralisia, convulsão psicogênica, etc.)",
    ],
    severity: ["Episódio agudo (<6 meses)", "Persistente (≥6 meses)"],
    differentials: ["Doença neurológica", "T. Sintomas Somáticos", "Simulação"],
    schemas: ["Vulnerabilidade ao Dano", "Dependência/Incompetência"],
  },
  {
    code: "TFAC", label: "Transtorno Factício", short: "Factício",
    criteria: [
      "Falsificação de sinais/sintomas físicos ou psicológicos, ou indução de lesão",
      "Apresenta-se aos outros como doente/prejudicado",
      "Comportamento evidente mesmo sem recompensas externas óbvias",
      "Não é melhor explicado por outro transtorno",
      "Especificar: imposto a si mesmo ou a outro",
    ],
    severity: ["Episódio único", "Recorrente"],
    differentials: ["Simulação", "T. Sintomas Somáticos", "T. Conversivo"],
    schemas: ["Privação Emocional", "Defectividade"],
  },
  // ─────────── HUMOR (adicionais) ───────────
  {
    code: "TDDH", label: "Transtorno Disruptivo da Desregulação do Humor", short: "TDDH",
    criteria: [
      "Explosões de raiva graves e recorrentes desproporcionais",
      "≥3x por semana, em ≥2 contextos, por ≥12 meses",
      "Humor persistentemente irritável/raivoso entre as explosões",
      "Início antes dos 10 anos; diagnóstico entre 6–18 anos",
      "Não coexiste com TB",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["TB pediátrico", "TOD", "TDAH", "TEPT"],
    schemas: ["Autocontrole insuficiente", "Modo Criança Raivosa"],
  },
  {
    code: "TDPM", label: "Transtorno Disfórico Pré-Menstrual", short: "TDPM",
    criteria: [
      "Sintomas na maioria dos ciclos, semana pré-menstrual, remitindo pós-menses",
      "≥1: labilidade afetiva, irritabilidade, humor deprimido, ansiedade",
      "≥1 adicional: anedonia, dificuldade de concentração, letargia, alterações apetite/sono, sensação de descontrole, sintomas físicos",
      "Prejuízo significativo",
      "Confirmação prospectiva por ≥2 ciclos",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["EDM", "TAG", "Bipolar", "TPB"],
    schemas: ["Privação Emocional", "Modo Criança Vulnerável"],
  },
  // ─────────── BIPOLAR (adicional) ───────────
  {
    code: "CICLO", label: "Transtorno Ciclotímico", short: "Ciclotimia",
    criteria: [
      "≥2 anos de períodos com sintomas hipomaníacos e depressivos que não atingem critérios plenos",
      "Sintomas presentes ≥metade do tempo; sem ausência >2 meses",
      "Sem episódio maníaco/hipomaníaco/depressivo maior no período",
      "Sofrimento ou prejuízo significativo",
      "Não explicado por substância/condição médica",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["TB I", "TB II", "TPB", "T. Depressivo"],
    schemas: ["Autocontrole insuficiente", "Padrões Inflexíveis"],
  },
  // ─────────── PSICÓTICOS ───────────
  {
    code: "ESQ", label: "Esquizofrenia", short: "Esquizofrenia",
    criteria: [
      "≥2 dos seguintes por ≥1 mês: delírios, alucinações, discurso desorganizado, comportamento grosseiramente desorganizado/catatônico, sintomas negativos",
      "Ao menos 1 deve ser delírios, alucinações ou discurso desorganizado",
      "Prejuízo em áreas maiores do funcionamento",
      "Sinais contínuos por ≥6 meses",
      "Exclusão de T. Esquizoafetivo e T. de Humor com sintomas psicóticos",
    ],
    severity: ["Primeiro episódio", "Múltiplos episódios", "Contínuo", "Em remissão"],
    differentials: ["Esquizoafetivo", "Esquizofreniforme", "TB/EDM com psicose", "Uso de substâncias"],
    schemas: ["Desconfiança/Abuso", "Isolamento Social"],
  },
  {
    code: "ESQAF", label: "Transtorno Esquizoafetivo", short: "Esquizoafetivo",
    criteria: [
      "Período ininterrupto com episódio de humor maior (depressivo/maníaco) concomitante a critério A de esquizofrenia",
      "Delírios/alucinações por ≥2 semanas sem episódio de humor",
      "Sintomas de humor presentes na maior parte do curso",
      "Não atribuível a substância/condição médica",
    ],
    severity: ["Tipo bipolar", "Tipo depressivo"],
    differentials: ["Esquizofrenia", "TB/EDM com psicose", "Uso de substâncias"],
    schemas: [],
  },
  {
    code: "ESQFORME", label: "Transtorno Esquizofreniforme", short: "Esquizofreniforme",
    criteria: [
      "Critério A da esquizofrenia",
      "Duração ≥1 mês e <6 meses",
      "Exclusão de T. Esquizoafetivo e de humor com psicose",
      "Não atribuível a substância/condição médica",
    ],
    severity: ["Com bons prognósticos", "Sem bons prognósticos"],
    differentials: ["Esquizofrenia", "T. Psicótico Breve", "TB com psicose"],
    schemas: [],
  },
  {
    code: "TPB_PSI", label: "Transtorno Psicótico Breve", short: "Psicótico Breve",
    criteria: [
      "≥1: delírios, alucinações, discurso desorganizado, comportamento desorganizado/catatônico",
      "Duração ≥1 dia e <1 mês, com retorno completo ao funcionamento prévio",
      "Não é melhor explicado por outro transtorno",
    ],
    severity: ["Com estressor(es) marcante(s)", "Sem estressor(es)", "Pós-parto"],
    differentials: ["Esquizofreniforme", "TB com psicose", "Uso de substâncias"],
    schemas: [],
  },
  {
    code: "TDEL", label: "Transtorno Delirante", short: "Delirante",
    criteria: [
      "≥1 delírio por ≥1 mês",
      "Critério A da esquizofrenia nunca preenchido (alucinações, quando presentes, são congruentes ao delírio)",
      "Funcionamento não muito prejudicado além do impacto do delírio",
      "Especificar tipo: erotomaníaco, grandioso, ciumento, persecutório, somático, misto",
    ],
    severity: ["Primeiro episódio", "Múltiplos episódios", "Contínuo"],
    differentials: ["Esquizofrenia", "TOC com insight ausente", "Paranoide"],
    schemas: ["Desconfiança/Abuso"],
  },
  // ─────────── PERSONALIDADE (Cluster A/B/C adicionais) ───────────
  {
    code: "TPPAR", label: "Transtorno da Personalidade Paranoide", short: "Paranoide",
    criteria: [
      "Desconfiança e suspeita generalizadas dos outros",
      "Suspeita de exploração/dano sem base",
      "Preocupação com lealdade de amigos",
      "Relutância em confiar",
      "Leitura de significados ocultos benignos como ameaçadores",
      "Guarda rancores",
      "Percepções de ataque ao caráter sem base",
      "Suspeitas recorrentes de infidelidade",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["T. Delirante", "Esquizotípica", "Borderline"],
    schemas: ["Desconfiança/Abuso"],
  },
  {
    code: "TPESQ", label: "Transtorno da Personalidade Esquizoide", short: "Esquizoide",
    criteria: [
      "Padrão de distanciamento das relações sociais",
      "Não deseja/aprecia relações próximas",
      "Escolhe atividades solitárias",
      "Pouco interesse em experiências sexuais com outros",
      "Prazer em poucas atividades",
      "Poucos amigos próximos",
      "Indiferença a elogios/críticas",
      "Frieza emocional/afeto embotado",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["Esquizotípica", "Evitativa", "TEA"],
    schemas: ["Isolamento Social", "Privação Emocional"],
  },
  {
    code: "TPESQT", label: "Transtorno da Personalidade Esquizotípica", short: "Esquizotípica",
    criteria: [
      "Déficits sociais/interpessoais com desconforto agudo",
      "Ideias de referência",
      "Crenças estranhas/pensamento mágico",
      "Experiências perceptuais incomuns",
      "Pensamento e discurso estranhos",
      "Suspeição/ideação paranoide",
      "Afeto inadequado/constrito",
      "Comportamento/aparência excêntricos",
      "Poucos amigos próximos",
      "Ansiedade social excessiva",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["Esquizofrenia", "Esquizoide", "TEA"],
    schemas: ["Desconfiança/Abuso", "Isolamento Social"],
  },
  {
    code: "TPAS", label: "Transtorno da Personalidade Antissocial", short: "Antissocial",
    criteria: [
      "Desrespeito e violação dos direitos dos outros desde os 15 anos",
      "Não conformidade com normas sociais/legais",
      "Impulsividade / não planejamento",
      "Irritabilidade e agressividade",
      "Desconsideração pela segurança própria/alheia",
      "Irresponsabilidade consistente",
      "Ausência de remorso",
      "Idade ≥18 anos; evidência de T. Conduta antes dos 15",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["T. Conduta", "TPB", "Uso de substâncias", "TPN"],
    schemas: ["Desconfiança/Abuso", "Grandiosidade/Merecimento"],
  },
  {
    code: "TPHIS", label: "Transtorno da Personalidade Histriônica", short: "Histriônica",
    criteria: [
      "Padrão de emocionalidade excessiva e busca de atenção",
      "Desconforto quando não é o centro das atenções",
      "Comportamento sedutor/provocativo inadequado",
      "Expressão emocional superficial e rapidamente mutável",
      "Uso da aparência física para chamar atenção",
      "Discurso impressionístico com poucos detalhes",
      "Dramatização/teatralidade",
      "Sugestionabilidade",
      "Considera relações mais íntimas do que realmente são",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["Borderline", "Narcisista", "Dependente"],
    schemas: ["Busca de Aprovação", "Privação Emocional"],
  },
  {
    code: "TPEV", label: "Transtorno da Personalidade Evitativa", short: "Evitativa",
    criteria: [
      "Padrão de inibição social, sentimentos de inadequação e hipersensibilidade a avaliação negativa",
      "Evita atividades ocupacionais que envolvam contato interpessoal",
      "Não se envolve a menos que tenha certeza de ser querido",
      "Reserva em relacionamentos íntimos por medo de humilhação",
      "Preocupação com crítica/rejeição em situações sociais",
      "Inibição em situações interpessoais novas",
      "Vê-se como socialmente inepto/inferior",
      "Relutância em correr riscos pessoais",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["Fobia Social", "Esquizoide", "Dependente"],
    schemas: ["Defectividade/Vergonha", "Isolamento Social", "Inibição Emocional"],
  },
  {
    code: "TPDEP", label: "Transtorno da Personalidade Dependente", short: "Dependente",
    criteria: [
      "Necessidade excessiva e generalizada de ser cuidado",
      "Dificuldade em tomar decisões cotidianas sem aconselhamento",
      "Necessita que outros assumam responsabilidades",
      "Dificuldade em expressar desacordo",
      "Dificuldade em iniciar projetos por conta própria",
      "Vai a extremos para obter cuidado",
      "Sente-se desconfortável/desamparado quando sozinho",
      "Busca urgente de outra relação ao término",
      "Preocupação irrealista de ser deixado para cuidar de si",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["Borderline", "Histriônica", "Evitativa", "T. Ansiedade"],
    schemas: ["Dependência/Incompetência", "Subjugação", "Abandono"],
  },
  {
    code: "TPOC", label: "Transtorno da Personalidade Obsessivo-Compulsiva", short: "TPOC",
    criteria: [
      "Preocupação com ordem, perfeccionismo e controle mental/interpessoal",
      "Perfeccionismo que interfere na conclusão de tarefas",
      "Devoção excessiva ao trabalho em detrimento do lazer",
      "Escrupulosidade excessiva sobre moralidade",
      "Incapacidade de descartar objetos gastos",
      "Relutância em delegar",
      "Estilo econômico/avaro",
      "Rigidez e teimosia",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["TOC", "Narcisista", "Esquizoide"],
    schemas: ["Padrões Inflexíveis", "Autocontrole excessivo"],
  },
  // ─────────── NEURODESENVOLVIMENTO (adicionais) ───────────
  {
    code: "TEA", label: "Transtorno do Espectro Autista", short: "TEA",
    criteria: [
      "Déficits persistentes na comunicação social e interação em múltiplos contextos",
      "Reciprocidade socioemocional reduzida",
      "Déficits em comunicação não verbal",
      "Dificuldades em desenvolver/manter/entender relacionamentos",
      "Padrões restritos/repetitivos de comportamento, interesses ou atividades",
      "Sintomas presentes desde o desenvolvimento inicial",
      "Prejuízo clinicamente significativo",
    ],
    severity: ["Nível 1 (requer apoio)", "Nível 2 (apoio substancial)", "Nível 3 (apoio muito substancial)"],
    differentials: ["Deficiência Intelectual", "T. Comunicação Social", "TDAH", "T. Ansiedade Social"],
    schemas: ["Isolamento Social", "Defectividade"],
  },
  {
    code: "DI", label: "Deficiência Intelectual (T. do Desenvolvimento Intelectual)", short: "DI",
    criteria: [
      "Déficits em funções intelectuais confirmados por avaliação clínica e testes padronizados",
      "Déficits em funcionamento adaptativo (conceitual, social, prático)",
      "Início durante o período de desenvolvimento",
    ],
    severity: ["Leve", "Moderada", "Grave", "Profunda"],
    differentials: ["T. Aprendizagem", "TEA", "TNC", "Atraso Global do Desenvolvimento"],
    schemas: [],
  },
  {
    code: "TAPR", label: "Transtorno Específico da Aprendizagem", short: "T. Aprendizagem",
    criteria: [
      "Dificuldades persistentes em leitura, escrita ou matemática por ≥6 meses apesar de intervenção",
      "Habilidades acadêmicas substancialmente abaixo do esperado para a idade",
      "Início na idade escolar (podem se manifestar depois)",
      "Não explicado por DI, prejuízo sensorial, adversidade psicossocial",
    ],
    severity: ["Leve", "Moderada", "Grave"],
    differentials: ["DI", "TDAH", "T. Comunicação", "Prejuízo sensorial"],
    schemas: ["Fracasso", "Defectividade"],
  },
  {
    code: "TCOM", label: "Transtornos da Comunicação", short: "T. Comunicação",
    criteria: [
      "Dificuldades persistentes na aquisição/uso da linguagem (vocabulário, sentenças, discurso) OU",
      "Fala (T. do Som da Fala) OU fluência (Gagueira / T. da Fluência com início na Infância) OU",
      "Comunicação social pragmática",
      "Habilidades substancialmente abaixo do esperado para a idade",
      "Início no período de desenvolvimento",
    ],
    severity: ["Leve", "Moderada", "Grave"],
    differentials: ["TEA", "DI", "Prejuízo auditivo"],
    schemas: [],
  },
  {
    code: "TTIC", label: "Transtornos de Tique (incl. Tourette)", short: "Tique/Tourette",
    criteria: [
      "Tiques motores e/ou vocais múltiplos",
      "Frequência pode variar; presentes por >1 ano (Tourette exige motores múltiplos + ≥1 vocal)",
      "Início antes dos 18 anos",
      "Não atribuíveis a substância/condição médica",
    ],
    severity: ["T. de Tique Provisório", "T. de Tique Motor/Vocal Persistente", "T. de Tourette"],
    differentials: ["TOC", "Estereotipias", "T. Movimento induzido por substância"],
    schemas: [],
  },
  // ─────────── TRAUMA (adicionais) ───────────
  {
    code: "TEA_AG", label: "Transtorno de Estresse Agudo", short: "Estresse Agudo",
    criteria: [
      "Exposição a evento traumático",
      "≥9 sintomas de 5 categorias (intrusão, humor negativo, dissociação, evitação, excitação)",
      "Duração 3 dias a 1 mês após o trauma",
      "Sofrimento ou prejuízo significativo",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["TEPT", "T. Ajustamento", "T. Pânico", "TCE"],
    schemas: ["Vulnerabilidade ao Dano"],
  },
  {
    code: "TLP", label: "Transtorno de Luto Prolongado", short: "Luto Prolongado",
    criteria: [
      "Morte, há ≥12 meses (adultos) ou ≥6 meses (crianças), de pessoa próxima",
      "Saudade intensa/persistente OU preocupação com o falecido",
      "≥3 sintomas: perturbação de identidade, descrença, evitação de lembranças, dor emocional intensa, dificuldade de reintegração, entorpecimento, sensação de vida sem sentido, solidão intensa",
      "Prejuízo funcional; nível acima do esperado culturalmente",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["Luto normativo", "EDM", "TEPT"],
    schemas: ["Abandono", "Privação Emocional"],
  },
  {
    code: "TAR", label: "Transtorno de Apego Reativo", short: "Apego Reativo",
    criteria: [
      "Padrão inibido, emocionalmente retraído em relação a cuidadores",
      "Perturbação social e emocional persistente",
      "Padrão extremo de cuidados insuficientes (negligência, mudanças repetidas de cuidador)",
      "Início antes dos 5 anos; idade de desenvolvimento ≥9 meses",
    ],
    severity: ["Persistente (>12 meses)", "Grave"],
    differentials: ["TEA", "DI", "T. Depressivo"],
    schemas: ["Privação Emocional", "Abandono"],
  },
  {
    code: "TESD", label: "Transtorno de Envolvimento Social Desinibido", short: "Envolvimento Desinibido",
    criteria: [
      "Padrão de aproximação e interação com adultos desconhecidos",
      "Comportamento verbal/físico excessivamente familiar",
      "Redução ou ausência de reticência com estranhos",
      "Padrão extremo de cuidados insuficientes",
      "Idade de desenvolvimento ≥9 meses",
    ],
    severity: ["Persistente", "Grave"],
    differentials: ["TDAH", "Apego Reativo"],
    schemas: ["Privação Emocional"],
  },
  // ─────────── DISSOCIATIVOS ───────────
  {
    code: "TID", label: "Transtorno Dissociativo de Identidade", short: "TID",
    criteria: [
      "Ruptura da identidade caracterizada por ≥2 estados de personalidade distintos",
      "Lacunas recorrentes na recordação de eventos cotidianos, informações pessoais ou traumas",
      "Sofrimento ou prejuízo significativo",
      "Não faz parte de prática cultural/religiosa amplamente aceita",
      "Não atribuível a substância/condição médica",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["TEPT", "TPB", "T. Psicótico", "T. Conversivo"],
    schemas: ["Desconfiança/Abuso", "Defectividade"],
  },
  {
    code: "AD", label: "Amnésia Dissociativa", short: "Amnésia Dissociativa",
    criteria: [
      "Incapacidade de recordar informações autobiográficas importantes, geralmente traumáticas",
      "Sofrimento ou prejuízo significativo",
      "Não atribuível a substância/condição neurológica",
      "Especificar: com fuga dissociativa",
    ],
    severity: ["Localizada", "Seletiva", "Generalizada", "Contínua", "Sistematizada"],
    differentials: ["TID", "TEPT", "TNC", "Amnésia por TCE"],
    schemas: ["Vulnerabilidade ao Dano"],
  },
  {
    code: "TDR", label: "Transtorno de Despersonalização/Desrealização", short: "Despers/Desrealização",
    criteria: [
      "Experiências persistentes/recorrentes de despersonalização (irrealidade de si) ou desrealização (irrealidade do mundo)",
      "Teste de realidade preservado",
      "Sofrimento ou prejuízo significativo",
      "Não atribuível a substância/condição médica",
      "Não é melhor explicado por outro transtorno",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["T. Pânico", "TEPT", "T. Psicótico", "Uso de substâncias"],
    schemas: ["Modo Protetor Desligado"],
  },
  // ─────────── ALIMENTARES (adicionais) ───────────
  {
    code: "ARFID", label: "Transtorno Alimentar Restritivo/Evitativo (ARFID)", short: "ARFID",
    criteria: [
      "Perturbação alimentar com falha em atender necessidades nutricionais/energéticas",
      "Perda de peso, deficiência nutricional, dependência de suplementação/enteral, ou prejuízo psicossocial",
      "Não explicada por falta de disponibilidade de comida ou prática cultural",
      "Não ocorre exclusivamente durante AN/BN",
      "Sem perturbação da imagem corporal",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["AN", "T. Ansiedade", "TEA", "Fobia Específica"],
    schemas: ["Vulnerabilidade ao Dano"],
  },
  {
    code: "PICA", label: "Pica", short: "Pica",
    criteria: [
      "Ingestão persistente de substâncias não nutritivas/não alimentares por ≥1 mês",
      "Inadequada ao nível de desenvolvimento (≥2 anos)",
      "Não faz parte de prática cultural/social aceita",
      "Se associada a outro transtorno, é grave o suficiente para atenção clínica",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["DI", "TEA", "Esquizofrenia"],
    schemas: [],
  },
  {
    code: "TRUM", label: "Transtorno de Ruminação", short: "Ruminação",
    criteria: [
      "Regurgitação repetida do alimento por ≥1 mês",
      "Não atribuível a condição gastrointestinal",
      "Não ocorre exclusivamente durante outro T. Alimentar",
      "Se associada a outro transtorno, é grave o suficiente para atenção clínica",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["Refluxo", "AN", "BN"],
    schemas: [],
  },
  // ─────────── ELIMINAÇÃO ───────────
  {
    code: "ENUR", label: "Enurese", short: "Enurese",
    criteria: [
      "Emissão repetida de urina em locais inapropriados (roupa, cama)",
      "≥2x/semana por ≥3 meses OU prejuízo/sofrimento significativo",
      "Idade cronológica ≥5 anos",
      "Não atribuível a substância/condição médica",
    ],
    severity: ["Só noturna", "Só diurna", "Noturna e diurna"],
    differentials: ["Diabetes", "Infecção urinária", "Anomalia estrutural"],
    schemas: [],
  },
  {
    code: "ENCO", label: "Encoprese", short: "Encoprese",
    criteria: [
      "Eliminação repetida de fezes em locais inapropriados (voluntária ou involuntária)",
      "≥1x/mês por ≥3 meses",
      "Idade cronológica ≥4 anos",
      "Não atribuível a substância/condição médica (exceto por constipação)",
    ],
    severity: ["Com constipação e incontinência por transbordamento", "Sem constipação"],
    differentials: ["Constipação", "Hirschsprung"],
    schemas: [],
  },
  // ─────────── SONO ───────────
  {
    code: "INS", label: "Transtorno de Insônia", short: "Insônia",
    criteria: [
      "Insatisfação com quantidade/qualidade do sono: dificuldade em iniciar, manter ou despertar precoce",
      "≥3 noites/semana, por ≥3 meses",
      "Oportunidade adequada para dormir",
      "Sofrimento ou prejuízo significativo",
      "Não explicada por outro T. de sono, substância ou condição médica",
    ],
    severity: ["Episódica", "Persistente", "Recorrente"],
    differentials: ["Apneia", "SPI", "T. do Ritmo Circadiano", "Depressão"],
    schemas: ["Vulnerabilidade ao Dano"],
  },
  {
    code: "HIPER", label: "Transtorno de Hipersonolência", short: "Hipersonolência",
    criteria: [
      "Sonolência excessiva apesar de ≥7h de sono, com ≥1: episódios recorrentes de sono no mesmo dia; sono principal >9h não restaurador; dificuldade em ficar totalmente desperto ao acordar",
      "≥3x/semana por ≥3 meses",
      "Sofrimento ou prejuízo significativo",
    ],
    severity: ["Leve", "Moderada", "Grave"],
    differentials: ["Narcolepsia", "Apneia", "Depressão atípica"],
    schemas: [],
  },
  {
    code: "NARCO", label: "Narcolepsia", short: "Narcolepsia",
    criteria: [
      "Períodos recorrentes de necessidade irresistível de dormir/cair no sono",
      "≥1: cataplexia; deficiência de hipocretina no LCR; latência REM ≤15 min ou latência média do sono ≤8 min com ≥2 SOREMPs",
      "≥3x/semana por ≥3 meses",
    ],
    severity: ["Leve", "Moderada", "Grave"],
    differentials: ["Hipersonolência", "Apneia", "Síncope"],
    schemas: [],
  },
  {
    code: "APN", label: "Apneia Obstrutiva do Sono / Hipopneia", short: "Apneia do Sono",
    criteria: [
      "Evidência por polissonografia de ≥5 apneias/hipopneias obstrutivas por hora com sintomas noturnos/diurnos, OU",
      "≥15 apneias/hipopneias obstrutivas por hora independente de sintomas",
    ],
    severity: ["Leve (IAH 5–14)", "Moderada (15–29)", "Grave (≥30)"],
    differentials: ["Hipersonolência primária", "Insônia", "Insuficiência cardíaca"],
    schemas: [],
  },
  {
    code: "PES", label: "Transtorno do Pesadelo", short: "Pesadelo",
    criteria: [
      "Ocorrência repetida de sonhos disfóricos extensos, bem lembrados, envolvendo ameaças à sobrevivência/segurança",
      "Ao acordar, torna-se rapidamente orientado/alerta",
      "Sofrimento ou prejuízo significativo",
    ],
    severity: ["Leve (<1x/sem)", "Moderado (≥1x/sem)", "Grave (noturno)"],
    differentials: ["Terror noturno", "TEPT", "T. Comportamento REM"],
    schemas: ["Vulnerabilidade ao Dano"],
  },
  {
    code: "TSREM", label: "Transtorno Comportamental do Sono REM", short: "REM Behavior",
    criteria: [
      "Episódios repetidos de excitação com vocalização e/ou comportamento motor complexo durante o sono REM",
      "Comportamentos consistentes com o conteúdo do sonho",
      "Ao acordar, alerta imediato",
      "Evidência polissonográfica de REM sem atonia OU história com sinergia clínica (α-sinucleinopatia)",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["Pesadelo", "Terror noturno", "Convulsão noturna"],
    schemas: [],
  },
  {
    code: "SPI", label: "Síndrome das Pernas Inquietas", short: "SPI",
    criteria: [
      "Urgência em mover as pernas, geralmente com sensações desagradáveis",
      "Início/piora em repouso; alívio parcial com movimento",
      "Pior à noite",
      "≥3x/semana por ≥3 meses; sofrimento/prejuízo",
    ],
    severity: ["Leve", "Moderada", "Grave"],
    differentials: ["Neuropatia", "Cãibras", "Acatisia"],
    schemas: [],
  },
  // ─────────── SEXUAL / GÊNERO ───────────
  {
    code: "DE", label: "Transtorno Erétil", short: "Disf. Erétil",
    criteria: [
      "≥1: dificuldade acentuada em obter/manter ereção; redução marcante da rigidez",
      "≥6 meses; ≥75% das ocasiões",
      "Sofrimento significativo",
      "Não explicado por outro transtorno/condição médica/substância",
    ],
    severity: ["Leve", "Moderada", "Grave"],
    differentials: ["Vascular", "Diabetes", "T. Depressivo", "Uso de substâncias"],
    schemas: ["Defectividade"],
  },
  {
    code: "EJP", label: "Ejaculação Prematura (Precoce)", short: "Ejac. Precoce",
    criteria: [
      "Padrão persistente de ejaculação durante a atividade sexual em cerca de 1 minuto após penetração",
      "≥6 meses; ≥75% das ocasiões",
      "Sofrimento significativo",
    ],
    severity: ["Leve (30–60s)", "Moderada (15–30s)", "Grave (<15s)"],
    differentials: ["T. Ansiedade", "Uso de substâncias"],
    schemas: ["Defectividade"],
  },
  {
    code: "TDSM", label: "Transtorno do Desejo Sexual Hipoativo Masculino / T. Interesse-Excitação Sexual Feminino", short: "Desejo Hipoativo",
    criteria: [
      "Redução/ausência persistente de pensamentos/fantasias sexuais e desejo de atividade sexual",
      "≥6 meses",
      "Sofrimento significativo",
      "Não explicado por outro transtorno/condição médica",
    ],
    severity: ["Leve", "Moderada", "Grave"],
    differentials: ["T. Depressivo", "Endocrinopatia", "Efeito de medicamentos"],
    schemas: ["Privação Emocional"],
  },
  {
    code: "DG", label: "Disforia de Gênero", short: "Disforia de Gênero",
    criteria: [
      "Incongruência acentuada entre gênero experienciado/expressado e gênero designado, ≥6 meses",
      "Adultos: ≥2 de 6 indicadores (desejo de mudança, ser tratado como o outro gênero, características sexuais primárias/secundárias etc.)",
      "Sofrimento ou prejuízo significativo",
      "Crianças: critérios específicos (≥6/8 indicadores)",
    ],
    severity: ["Com/sem transtorno do desenvolvimento sexual", "Pós-transição"],
    differentials: ["Não conformidade de gênero sem sofrimento", "T. Dismórfico Corporal"],
    schemas: ["Defectividade"],
  },
  // ─────────── DISRUPTIVOS/IMPULSO ───────────
  {
    code: "TOD", label: "Transtorno de Opositivo Desafiador", short: "TOD",
    criteria: [
      "Padrão de humor irritável/desafiador/vingativo por ≥6 meses",
      "≥4 sintomas: perde a paciência, discute, desafia regras, incomoda, culpa outros, sensível/irritável, rancoroso, vingativo",
      "Interações com ≥1 pessoa que não seja irmão",
      "Prejuízo social/acadêmico ou impacto no entorno",
    ],
    severity: ["Leve (1 ambiente)", "Moderado (2)", "Grave (≥3)"],
    differentials: ["T. Conduta", "TDDH", "TDAH"],
    schemas: ["Direitos Especiais/Grandiosidade"],
  },
  {
    code: "TC", label: "Transtorno de Conduta", short: "T. Conduta",
    criteria: [
      "Padrão repetitivo de violação de direitos/normas sociais por ≥12 meses",
      "≥3 critérios: agressão a pessoas/animais, destruição de propriedade, fraude/furto, violação séria de regras",
      "Prejuízo significativo",
      "Especificar: início na infância (<10a), na adolescência, não especificado; com traços interpessoais insensíveis",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["TOD", "T. Explosivo Intermitente", "Antissocial (adulto)"],
    schemas: ["Direitos Especiais/Grandiosidade", "Autocontrole insuficiente"],
  },
  {
    code: "TEI", label: "Transtorno Explosivo Intermitente", short: "Explosivo Interm.",
    criteria: [
      "Explosões comportamentais recorrentes por falha em controlar impulsos agressivos",
      "Agressão verbal ≥2x/sem por 3 meses OU 3 episódios de destruição/agressão física em 12 meses",
      "Desproporcional à provocação",
      "Não premeditadas; sofrimento/prejuízo",
      "Idade ≥6 anos",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["TOD", "TB", "Antissocial", "TPB"],
    schemas: ["Autocontrole insuficiente"],
  },
  {
    code: "PIRO", label: "Piromania", short: "Piromania",
    criteria: [
      "Provocação deliberada e proposital de incêndios em >1 ocasião",
      "Tensão/excitação afetiva antes do ato",
      "Fascínio/atração por fogo",
      "Prazer/gratificação/alívio ao atear ou testemunhar",
      "Não motivada por ganho material, ideológico, raiva, delírio ou julgamento prejudicado",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["T. Conduta", "Uso de substâncias", "Psicose"],
    schemas: [],
  },
  {
    code: "CLEP", label: "Cleptomania", short: "Cleptomania",
    criteria: [
      "Fracasso recorrente em resistir a impulsos de roubar objetos não necessários",
      "Tensão crescente imediatamente antes do ato",
      "Prazer/gratificação/alívio ao cometer o furto",
      "Não realizado por raiva/vingança ou em resposta a delírio",
      "Não é melhor explicado por T. Conduta/mania/antissocial",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["Furto comum", "T. Conduta", "Mania"],
    schemas: [],
  },
  // ─────────── SUBSTÂNCIA / VÍCIOS COMPORTAMENTAIS ───────────
  {
    code: "TUA", label: "Transtorno por Uso de Álcool", short: "T. Uso Álcool",
    criteria: [
      "Padrão problemático levando a prejuízo/sofrimento em 12 meses",
      "≥2 de 11: uso maior/mais tempo do que planejado; desejo/tentativas fracassadas de reduzir; muito tempo obtendo/usando; fissura; falha em obrigações; uso apesar de problemas sociais; abandono de atividades; uso em situações de risco; uso apesar de problemas físicos/psíquicos; tolerância; abstinência",
    ],
    severity: ["Leve (2–3)", "Moderado (4–5)", "Grave (≥6)"],
    differentials: ["Uso recreativo", "TB", "T. Ansiedade"],
    schemas: ["Autocontrole insuficiente"],
  },
  {
    code: "TUS", label: "Transtorno por Uso de Substância (outras)", short: "T. Uso Substância",
    criteria: [
      "Mesmos 11 critérios aplicados a: cannabis, opioides, sedativos/hipnóticos, estimulantes, alucinógenos, inalantes, tabaco, cafeína (limitado), outras",
      "Prejuízo/sofrimento em 12 meses",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["Uso recreativo", "Efeito clínico de medicamentos"],
    schemas: ["Autocontrole insuficiente", "Privação Emocional"],
  },
  {
    code: "TJOGO", label: "Transtorno do Jogo (Gambling)", short: "Jogo Patológico",
    criteria: [
      "Comportamento problemático persistente com jogo levando a prejuízo em 12 meses",
      "≥4 de 9: necessidade de apostar quantias crescentes; inquietação/irritabilidade ao tentar parar; tentativas mal-sucedidas; preocupação com jogo; joga quando angustiado; 'perseguir' perdas; mentir sobre o jogo; comprometer relações/trabalho; depender de outros para dinheiro",
    ],
    severity: ["Leve (4–5)", "Moderado (6–7)", "Grave (8–9)"],
    differentials: ["Mania", "Personalidade Antissocial"],
    schemas: ["Autocontrole insuficiente", "Grandiosidade/Merecimento"],
  },
  // ─────────── NEUROCOGNITIVOS ───────────
  {
    code: "DEL", label: "Delirium", short: "Delirium",
    criteria: [
      "Perturbação da atenção e consciência",
      "Desenvolve-se em curto período (horas–dias), flutua",
      "Alteração cognitiva adicional (memória, linguagem, percepção)",
      "Não explicada por TNC preexistente/coma",
      "Evidência de causa fisiológica (médica/substância/toxina)",
    ],
    severity: ["Agudo (horas–dias)", "Persistente (semanas–meses)", "Hiperativo/Hipoativo/Misto"],
    differentials: ["TNC Maior", "T. Psicótico", "T. Depressivo"],
    schemas: [],
  },
  {
    code: "TNCM", label: "Transtorno Neurocognitivo Maior", short: "TNC Maior",
    criteria: [
      "Declínio cognitivo significativo em ≥1 domínio (atenção, executivo, aprendizagem/memória, linguagem, perceptomotor, cognição social)",
      "Interfere na independência para AVDs",
      "Não exclusivo de delirium",
      "Não explicado por outro transtorno mental",
      "Especificar etiologia (Alzheimer, vascular, corpos de Lewy, DFT, TCE, HIV, Parkinson, etc.)",
    ],
    severity: ["Leve", "Moderado", "Grave"],
    differentials: ["TNC Leve", "Delirium", "Depressão", "DI"],
    schemas: [],
  },
  {
    code: "TNCL", label: "Transtorno Neurocognitivo Leve", short: "TNC Leve",
    criteria: [
      "Declínio cognitivo modesto em ≥1 domínio",
      "Não interfere na independência para AVDs (podem exigir esforço/estratégias)",
      "Não exclusivo de delirium",
      "Não explicado por outro transtorno",
      "Especificar etiologia",
    ],
    severity: ["Leve"],
    differentials: ["TNC Maior", "Envelhecimento normal", "Depressão"],
    schemas: [],
  },
];

export type DSM5HistoryItem = {
  diagnosis: string;
  code?: string;
  severity: string;
  criteriaChecked: string[];
  notes?: string;
  updatedAt: string;
};

interface Props {
  value: string;
  onValueChange: (label: string) => void;
  detail: DSM5Detail | null;
  onDetailChange: (d: DSM5Detail | null) => void;
  recent?: DSM5HistoryItem[];
}

export function getDsm5EntryByLabel(label: string) {
  const e = CATALOG.find(x => x.label === label);
  if (!e) return null;
  return { code: e.code, label: e.label, criteria: e.criteria, severity: e.severity, differentials: e.differentials, schemas: e.schemas };
}

export function DSM5Diagnostic({ value, onValueChange, detail, onDetailChange, recent = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [category, setCategory] = useState<DSM5Category | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [onlyWithCriteria, setOnlyWithCriteria] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const historyByLabel = useMemo(() => {
    const m: Record<string, DSM5HistoryItem> = {};
    for (const h of recent) m[h.diagnosis] = h;
    return m;
  }, [recent]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATALOG.filter(e => {
      if (category !== "all" && DSM5_CATEGORY_OF[e.code] !== category) return false;
      if (severityFilter !== "all") {
        const sev = severityFilter.toLowerCase();
        const has = e.severity.some(s => s.toLowerCase().includes(sev));
        if (!has) return false;
      }
      if (onlyWithCriteria) {
        const h = historyByLabel[e.label];
        if (!h || h.criteriaChecked.length === 0) return false;
      }
      if (!q) return true;
      const kws = DSM5_CATALOG_KEYWORDS[e.code] ?? [];
      return (
        e.label.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q) ||
        (e.short ?? "").toLowerCase().includes(q) ||
        kws.some(k => k.toLowerCase().includes(q))
      );
    });
  }, [query, category, severityFilter, onlyWithCriteria, historyByLabel]);

  const activeFilterCount =
    (category !== "all" ? 1 : 0) + (severityFilter !== "all" ? 1 : 0) + (onlyWithCriteria ? 1 : 0);



  const selected = useMemo(() => CATALOG.find(e => e.label === value) || null, [value]);

  const pickEntry = (e: Entry) => {
    onValueChange(e.label);
    setQuery(e.label);
    setOpen(false);
    if (!detail || detail.diagnosis !== e.label) {
      onDetailChange({
        diagnosis: e.label,
        code: e.code,
        criteriaChecked: [],
        severity: e.severity[0] ?? "",
        notes: detail?.notes ?? "",
      });
    }
  };

  const clear = () => {
    onValueChange("");
    setQuery("");
    onDetailChange(null);
  };

  const toggleCriterion = (c: string) => {
    if (!detail) return;
    const has = detail.criteriaChecked.includes(c);
    onDetailChange({
      ...detail,
      criteriaChecked: has ? detail.criteriaChecked.filter(x => x !== c) : [...detail.criteriaChecked, c],
    });
  };

  return (
    <div className="space-y-4">
      <div ref={wrapRef} className="relative">
        <Label className="flex items-center gap-1.5">
          <Stethoscope className="h-3.5 w-3.5 text-primary" /> Diagnóstico DSM-5-TR
        </Label>
        <div className="relative mt-1.5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onFocus={() => setOpen(true)}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            placeholder="Busque por nome, sigla ou sintoma (ex: TAG, pânico, vômito, flashback...)"
            className="w-full h-10 pl-9 pr-9 rounded-md border border-input bg-background text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {value ? (
            <button type="button" onClick={clear} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground" aria-label="Limpar">
              <X className="h-4 w-4" />
            </button>
          ) : (
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          )}
        </div>
        {recent.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Recentes:</span>
            {recent.map(item => {
              const entry = CATALOG.find(e => e.label === item.diagnosis);
              if (!entry) return null;
              const isActive = item.diagnosis === value;
              return (
                <button
                  key={item.diagnosis}
                  type="button"
                  onClick={() => pickEntry(entry)}
                  className={cn(
                    "text-[11px] px-2 py-1 rounded-full border transition-colors inline-flex items-center gap-1",
                    isActive
                      ? "bg-primary/10 text-primary border-primary/40"
                      : "bg-secondary text-secondary-foreground border-border hover:bg-accent",
                  )}
                  title={`${entry.label}${item.severity ? ` · ${item.severity}` : ""}`}
                >
                  <span>{entry.short ?? entry.label}</span>
                  {item.criteriaChecked.length > 0 && (
                    <span className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded-full font-semibold leading-none",
                      isActive ? "bg-primary/20 text-primary" : "bg-background/60 text-muted-foreground",
                    )}>
                      {item.criteriaChecked.length}/{entry.criteria.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            <Filter className="h-3 w-3" /> Filtros
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px]">{activeFilterCount}</span>
            )}
          </div>
          <Select value={category} onValueChange={(v) => setCategory(v as any)}>
            <SelectTrigger className="h-7 text-xs w-auto min-w-[130px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {CATEGORY_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="h-7 text-xs w-auto min-w-[110px]"><SelectValue placeholder="Gravidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer gravidade</SelectItem>
              {SEVERITY_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={() => setOnlyWithCriteria(v => !v)}
            className={cn(
              "h-7 px-2.5 rounded-md border text-[11px] transition-colors",
              onlyWithCriteria
                ? "bg-primary/10 text-primary border-primary/40"
                : "bg-background text-muted-foreground border-input hover:bg-accent",
            )}
          >
            Com critérios marcados
          </button>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => { setCategory("all"); setSeverityFilter("all"); setOnlyWithCriteria(false); }}
              className="h-7 px-2 rounded-md text-[11px] text-muted-foreground hover:text-foreground"
            >
              Limpar
            </button>
          )}
        </div>


        {open && (
          <div className="absolute z-50 mt-1 w-full max-h-72 overflow-auto rounded-md border bg-popover shadow-lg">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">Nenhum diagnóstico encontrado.</div>
            )}
            {filtered.map(e => (
              <button
                key={e.code}
                type="button"
                onClick={() => pickEntry(e)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between gap-2",
                  e.label === value && "bg-accent/60",
                )}
              >
                <span>{e.label}</span>
                {e.label === value && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && detail && (
        <div className="space-y-4 rounded-xl border bg-card/60 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">DSM-5-TR</Badge>
            <span className="text-sm font-semibold">{selected.label}</span>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Critérios diagnósticos · marque os observados
              <span className="ml-2 text-primary">({detail.criteriaChecked.length}/{selected.criteria.length})</span>
            </p>
            <ul className="space-y-1.5">
              {selected.criteria.map(c => {
                const checked = detail.criteriaChecked.includes(c);
                return (
                  <li key={c}>
                    <label className="flex items-start gap-2 cursor-pointer text-sm leading-snug">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCriterion(c)}
                        className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                      />
                      <span className={cn(checked && "text-foreground", !checked && "text-foreground/80")}>{c}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gravidade / especificadores</Label>
              <Select value={detail.severity} onValueChange={(v) => onDetailChange({ ...detail, severity: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {selected.severity.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observações clínicas</Label>
              <Textarea
                value={detail.notes ?? ""}
                onChange={e => onDetailChange({ ...detail, notes: e.target.value })}
                rows={2}
                className="mt-1.5 text-sm"
                placeholder="Notas pontuais sobre o quadro..."
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Diagnósticos diferenciais</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.differentials.map(d => (
                  <span key={d} className="text-[11px] px-2 py-1 rounded-full bg-secondary text-secondary-foreground border">{d}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Esquemas e modos associados</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.schemas.map(s => (
                  <span key={s} className="text-[11px] px-2 py-1 rounded-full bg-[#f0ebf7] text-[#5b4a7a] border border-[#e2d8f0]">{s}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DSM5Diagnostic;
