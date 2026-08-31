// Gerado a partir das legendas dos vídeos do tutorial.
export interface Cue { s: number; e: number; text: string }
export interface Chapter { t: number; title: string }
export const tutorialTranscripts: Record<string, { chapters: Chapter[]; cues: Cue[] }> = {
  "01-visao-geral.mp4": {
    chapters: [{ t: 0, title: "Boas-vindas" }, { t: 15, title: "Tour pelo menu lateral" }],
    cues: [
      { s: 6.25, e: 9.45, text: "Bem-vindo ao PsiReal. Vamos conhecer o sistema passo a passo." },
      { s: 9.5, e: 14.95, text: "Todos os módulos ficam no menu lateral, à esquerda." },
      { s: 15.0, e: 18.7, text: "Painel: a visão geral do seu dia e dos seus números." },
      { s: 18.75, e: 22.45, text: "Pacientes: o cadastro clínico de cada pessoa atendida." },
      { s: 22.5, e: 26.2, text: "Agenda: seus atendimentos, confirmações e reagendamentos." },
      { s: 26.25, e: 29.7, text: "Humor dos Pacientes: acompanhe o humor registrado nas sessões." },
      { s: 29.75, e: 33.45, text: "Autocuidado: o seu próprio check-in de bem-estar." },
      { s: 33.5, e: 37.2, text: "Financeiro: pagamentos, cobranças e Receita Saúde." },
      { s: 37.25, e: 40.7, text: "Anamneses: envie o formulário para o paciente preencher." },
      { s: 40.75, e: 44.45, text: "Termo de Consentimento: o modelo do seu contrato." },
      { s: 44.5, e: 48.2, text: "Contratos: os termos já assinados pelos pacientes." },
      { s: 48.25, e: 52.35, text: "Configurações: seus dados, metas e preferências." },
    ],
  },
  "02-painel.mp4": {
    chapters: [{ t: 0, title: "Indicadores do dia" }, { t: 12.25, title: "Valores médios" }, { t: 17.25, title: "Aniversariantes" }],
    cues: [
      { s: 3.25, e: 7.45, text: "O Painel resume a sua semana assim que você entra." },
      { s: 7.5, e: 12.2, text: "Aqui estão pacientes ativos, sessões e formulações pendentes." },
      { s: 12.25, e: 17.2, text: "Mais abaixo: valores médios por sessão e por Plano de Atendimento." },
      { s: 17.25, e: 20.6, text: "E os aniversariantes do mês, da semana e do dia." },
    ],
  },
  "03-agenda.mp4": {
    chapters: [{ t: 0, title: "Visão da Agenda" }, { t: 18.75, title: "Criar uma nova sessão" }, { t: 62.75, title: "Status e cores" }, { t: 69.25, title: "Editar, reagendar ou cancelar" }],
    cues: [
      { s: 4.25, e: 7.2, text: "A Agenda mostra os atendimentos do dia selecionado." },
      { s: 7.25, e: 18.7, text: "Para mudar a data, use as setas." },
      { s: 18.75, e: 26.2, text: "Para criar um atendimento, clique em Nova sessão." },
      { s: 26.25, e: 36.2, text: "Escolha o paciente." },
      { s: 36.25, e: 44.2, text: "Defina a data e o horário." },
      { s: 44.25, e: 54.7, text: "Escolha a modalidade: online ou presencial." },
      { s: 54.75, e: 60.1, text: "E confirme em Agendar." },
      { s: 62.75, e: 65.7, text: "Pronto. A sessão já aparece na Agenda." },
      { s: 65.75, e: 69.2, text: "Cada cor indica o status: agendado, confirmado ou realizado." },
      { s: 69.25, e: 72.35, text: "Para editar, reagendar ou cancelar, abra a sessão." },
    ],
  },
  "04-pacientes.mp4": {
    chapters: [{ t: 0, title: "Tela de Pacientes" }, { t: 9.75, title: "Cadastrar um paciente" }, { t: 32.25, title: "Prontuário do paciente" }],
    cues: [
      { s: 3.5, e: 6.2, text: "Em Pacientes fica o cadastro clínico de cada pessoa." },
      { s: 6.25, e: 9.7, text: "No topo, indicadores de formulações pendentes e próximas sessões." },
      { s: 9.75, e: 15.6, text: "Para cadastrar, clique em Novo paciente." },
      { s: 17.5, e: 25.45, text: "Preencha nome, contato, data de nascimento e valor da sessão." },
      { s: 25.5, e: 32.2, text: "Neste tutorial vamos apenas fechar sem salvar." },
      { s: 32.25, e: 43.7, text: "Clique no paciente para abrir o prontuário." },
      { s: 43.75, e: 48.7, text: "Aqui ficam dados cadastrais, histórico e informações clínicas." },
      { s: 48.75, e: 53.6, text: "E também as sessões anteriores do paciente." },
    ],
  },
  "05-registro-sessao.mp4": {
    chapters: [{ t: 0, title: "Escolher o paciente" }, { t: 15.5, title: "Preencher a sessão" }, { t: 31, title: "Salvar o registro" }, { t: 37.5, title: "Atualizar o plano" }],
    cues: [
      { s: 3.5, e: 6.2, text: "Depois do atendimento, você registra a sessão." },
      { s: 6.25, e: 8.35, text: "Escolha o paciente na lista." },
      { s: 15.5, e: 30.95, text: "Preencha queixa, temas, observações clínicas e plano da próxima sessão." },
      { s: 31.0, e: 37.45, text: "Ao final, clique em Salvar. Você permanece na mesma tela." },
      { s: 37.5, e: 41.1, text: "O botão Atualizar Plano abre o Plano de Tratamento ao lado." },
    ],
  },
  "06-plano-atendimento.mp4": {
    chapters: [{ t: 0, title: "Criar o plano na Agenda" }, { t: 12, title: "Sessões, intervalo e valor" }, { t: 16.75, title: "Acompanhamento do plano" }],
    cues: [
      { s: 3.5, e: 11.95, text: "O Plano de Atendimento é criado na Agenda, em Nova sessão." },
      { s: 12.0, e: 16.7, text: "Informe a quantidade de sessões, o intervalo e o valor." },
      { s: 16.75, e: 20.45, text: "O sistema cria todas as sessões e acompanha realizadas e restantes." },
      { s: 20.5, e: 24.1, text: "O plano aparece na Agenda e vira uma cobrança única no Financeiro." },
    ],
  },
  "07-financeiro.mp4": {
    chapters: [{ t: 0, title: "Resumo do mês" }, { t: 15.25, title: "Filtros rápidos" }, { t: 19.75, title: "Cards por paciente" }, { t: 26.25, title: "Status de pagamento e cobrança" }, { t: 34, title: "Dar baixa em um pagamento" }, { t: 62, title: "Conferir na aba Pagos" }],
    cues: [
      { s: 7.25, e: 10.2, text: "O Financeiro reúne tudo em uma única visualização." },
      { s: 10.25, e: 15.2, text: "No topo: recebido, receita realizada, a receber e sessões do mês." },
      { s: 15.25, e: 19.7, text: "Use os filtros por quinzena, Receita Saúde e paciente." },
      { s: 19.75, e: 26.2, text: "Cada card é um paciente com seu Plano de Atendimento ou sessão única." },
      { s: 26.25, e: 29.95, text: "Pago: já recebido. Pendente: em aberto. Parcial: parte recebida." },
      { s: 30.0, e: 33.95, text: "A cobrança tem status: a enviar, enviada, perto do vencimento ou vencida." },
      { s: 34.0, e: 41.45, text: "Para dar baixa em um pagamento, clique no seletor de Pagamento." },
      { s: 41.5, e: 50.7, text: "Selecione Pago." },
      { s: 50.75, e: 53.7, text: "Pronto. O pagamento foi registrado." },
      { s: 53.75, e: 61.95, text: "Como a aba mostra Pendentes, o card sai desta lista." },
      { s: 62.0, e: 68.7, text: "Na aba Pagos ele aparece com o pagamento confirmado." },
      { s: 68.75, e: 74.6, text: "O resumo no topo recalcula o valor recebido automaticamente." },
    ],
  },
  "08-cobranca-whatsapp.mp4": {
    chapters: [{ t: 0, title: "Identificar a cobrança" }, { t: 6.5, title: "Enviar pelo WhatsApp" }, { t: 18.75, title: "Depois do envio" }],
    cues: [
      { s: 1.25, e: 6.45, text: "Identifique uma cobrança a enviar." },
      { s: 6.5, e: 14.95, text: "Clique em Enviar cobrança pelo WhatsApp." },
      { s: 15.0, e: 18.7, text: "O sistema monta a mensagem com valor, sessões e vencimento." },
      { s: 18.75, e: 22.2, text: "Depois do envio, o card mostra Enviada com a data." },
      { s: 22.25, e: 25.6, text: "O mesmo botão permite reenviar a cobrança quando necessário." },
    ],
  },
  "09-receita-saude.mp4": {
    chapters: [{ t: 0, title: "Os três estados" }, { t: 21, title: "Alterar direto no card" }, { t: 32.75, title: "Pagamento x Receita Saúde" }],
    cues: [
      { s: 8.75, e: 11.45, text: "A Receita Saúde tem três estados." },
      { s: 11.5, e: 14.7, text: "Não emitida: precisa emitir e ainda não foi feito." },
      { s: 14.75, e: 17.7, text: "Emitida: a Receita Saúde já foi emitida." },
      { s: 17.75, e: 21.35, text: "Não se aplica: aquele recebimento não exige Receita Saúde." },
      { s: 32.75, e: 36.2, text: "Atenção: Pagamento e Receita Saúde são controles diferentes." },
      { s: 36.25, e: 40.1, text: "É possível ter Pago com Receita Saúde ainda não emitida." },
    ],
  },
  "10-historico-detalhes.mp4": {
    chapters: [{ t: 0, title: "Histórico de envios" }, { t: 14, title: "Detalhes dos lembretes" }],
    cues: [
      { s: 5.75, e: 13.95, text: "O botão Histórico mostra todos os envios da cobrança." },
      { s: 14.0, e: 19.35, text: "Envios, reenvios, datas e a antecedência dos lembretes." },
    ],
  },
  "11-demais-modulos.mp4": {
    chapters: [{ t: 0, title: "Humor dos Pacientes" }, { t: 11.25, title: "Autocuidado" }, { t: 20, title: "Anamneses" }, { t: 28.5, title: "Termo de Consentimento" }, { t: 37, title: "Contratos" }, { t: 45, title: "Configurações" }, { t: 53, title: "Meu Plano" }, { t: 60.75, title: "Fechamento" }],
    cues: [
      { s: 3.25, e: 6.85, text: "Humor dos Pacientes: acompanha o humor registrado ao longo do tratamento." },
      { s: 11.25, e: 14.85, text: "Autocuidado: seu check-in diário de estresse, sono e pausas." },
      { s: 20.0, e: 23.6, text: "Anamneses: gere um link para o paciente preencher antes da primeira sessão." },
      { s: 28.5, e: 32.1, text: "Termo de Consentimento: monte o modelo do seu contrato." },
      { s: 37.0, e: 40.6, text: "Contratos: consulte os termos já assinados." },
      { s: 45.0, e: 48.6, text: "Configurações: seus dados profissionais, metas e lembretes." },
      { s: 53.0, e: 56.6, text: "Meu Plano: sua assinatura do PsiReal." },
      { s: 60.75, e: 63.45, text: "Esse é o fluxo completo do PsiReal." },
      { s: 63.5, e: 67.6, text: "Cadastre, atenda, registre, cobre e acompanhe — tudo em um só lugar." },
    ],
  },
};
