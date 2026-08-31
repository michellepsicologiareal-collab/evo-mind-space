import React from "react";
import { SceneLayout } from "../components/SceneLayout";
import { colors } from "../theme";

export const ScenePainel: React.FC = () => (
  <SceneLayout
    kicker="Painel"
    title="Seu dia clínico em um olhar"
    bullets={[
      "Indicadores de pacientes, sessões e receita",
      "Aniversariantes do dia, da semana e do mês",
      "Formulações de caso pendentes em destaque",
    ]}
    image="images/mockup-dashboard.png"
    accent={colors.lilas}
  />
);

export const SceneAgenda: React.FC = () => (
  <SceneLayout
    kicker="Agenda"
    title="Um painel de trabalho, não só um calendário"
    bullets={[
      "Status coloridos: agendado, confirmado, realizado",
      "Ações rápidas: iniciar sessão, ficha, reagendar",
      "Humor do paciente e registro pendente no card",
    ]}
    image="images/mockup-agenda.png"
    accent={colors.terracota}
    flip
  />
);

export const ScenePacientes: React.FC = () => (
  <SceneLayout
    kicker="Pacientes"
    title="Cadastro clínico completo"
    bullets={[
      "Ficha com anamnese, formulação e histórico",
      "Alertas de quem precisa de atenção",
      "Exclusão segura: lixeira com 30 dias",
    ]}
    image="images/mockup-pacientes.png"
    accent={colors.verde}
  />
);

export const SceneTCC: React.FC = () => (
  <SceneLayout
    kicker="TCC"
    title="Ferramentas terapêuticas integradas"
    bullets={[
      "Registro de Pensamentos Disfuncionais (RPD)",
      "Armadilhas do pensamento em cards educativos",
      "Diagnóstico DSM-5-TR e formulação de caso",
    ]}
    image="images/mockup-emocoes-v2.png"
    accent={colors.dourado}
    flip
  />
);

export const SceneFinanceiro: React.FC = () => (
  <SceneLayout
    kicker="Financeiro"
    title="Cobrança simples e visual"
    bullets={[
      "Cards por paciente com status da cobrança",
      "Envio e lembretes automáticos por WhatsApp",
      "Receita Saúde editável direto no card",
    ]}
    image="images/mockup-financeiro.png"
    accent={colors.terracota}
  />
);

export const SceneAutocuidado: React.FC = () => (
  <SceneLayout
    kicker="Autocuidado"
    title="Quem cuida também precisa de cuidado"
    bullets={[
      "Painel de humor do terapeuta com heatmap",
      "Registros de bem-estar ao longo do mês",
      "Um espaço só seu dentro do PsiReal",
    ]}
    image="images/mockup-autocuidado.png"
    accent={colors.lilas}
    flip
  />
);
