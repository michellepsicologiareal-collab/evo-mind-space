import { C } from "./theme";

export type Block = {
  shots: string[];
  kicker: string;
  title: string;
  accent?: string;
  align?: "left" | "right";
  focus?: { x: number; y: number; from: number; to: number };
};

/** Blocos 2..13 (bloco 1 = abertura, bloco 14 = encerramento). */
export const BLOCKS: Block[] = [
  {
    shots: ["02_painel_kpis", "01_painel"],
    kicker: "Painel",
    title: "O resumo da sua clínica assim que você entra",
    accent: C.lilac,
  },
  {
    shots: ["10_agenda", "11_agenda_cards"],
    kicker: "Agenda",
    title: "Sessões com status, valor e acesso direto ao paciente",
    accent: C.terra,
    align: "right",
  },
  {
    shots: ["20_pacientes", "22_prontuario"],
    kicker: "Pacientes",
    title: "Cada paciente com seu espaço clínico completo",
    accent: C.moss,
  },
  {
    shots: ["30_registro", "31_registro2"],
    kicker: "Registro de sessão",
    title: "Queixa, intervenção, evolução e plano da próxima",
    accent: C.terra,
    align: "right",
  },
  {
    shots: ["35_plano", "40_form_tcc", "42_form_te", "43_form_act"],
    kicker: "Plano e formulação de caso",
    title: "TCC, Terapia do Esquema e ACT em modelos estruturados",
    accent: C.lilac,
  },
  {
    shots: ["31_registro2", "35_plano"],
    kicker: "Entre sessões",
    title: "Atividades e registros enviados ao paciente",
    accent: C.moss,
    align: "right",
  },
  {
    shots: ["60_financeiro", "61_fin_grafico", "62_fin_cards"],
    kicker: "Financeiro",
    title: "Sessão avulsa e plano de atendimento em uma única visão",
    accent: C.terra,
  },
  {
    shots: ["70_whatsapp_conferencia"],
    kicker: "Cobrança",
    title: "Conferência da cobrança e envio pelo WhatsApp",
    accent: C.moss,
    align: "right",
  },
  {
    shots: ["63_fin_cards2"],
    kicker: "Receita Saúde",
    title: "Acompanhe o que precisa ser emitido",
    accent: C.gold,
    focus: { x: 0.8, y: 0.5, from: 1.02, to: 1.09 },
  },
  {
    shots: ["50_humor", "52_autocuidado"],
    kicker: "Humor e autocuidado",
    title: "O acompanhamento do paciente e o cuidado com você",
    accent: C.lilac,
  },
  {
    shots: ["80_anamneses", "81_contratos"],
    kicker: "Documentos",
    title: "Anamneses, termos de consentimento e contratos",
    accent: C.moss,
    align: "right",
  },
  {
    shots: ["90_supervisao", "91_biblioteca", "92_comece"],
    kicker: "Supervisão e apoio",
    title: "Supervisão, biblioteca e central de ajuda",
    accent: C.terra,
  },
];
