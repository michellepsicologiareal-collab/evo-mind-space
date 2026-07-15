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
