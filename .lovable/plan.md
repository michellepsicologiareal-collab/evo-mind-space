# Skeletons e estados de carregamento

## Objetivo
Substituir telas vazias, textos “Carregando…” e indicadores isolados por estruturas visuais que preservem o formato do conteúdo enquanto os dados chegam, sem alterar regras ou fluxos.

## Implementação
- Evoluir os skeletons compartilhados para cobrir indicadores, listas, calendário e formulários, com animação discreta e acessibilidade de carregamento.
- Aplicar skeletons específicos nas três visualizações da Agenda (mês, semana e dia), mantendo cabeçalho, filtros e dimensões estáveis durante trocas de período.
- Aplicar estados equivalentes em Financeiro, Painel, Pacientes, Registro de Sessão e Plano de Tratamento.
- Manter carregamentos de ações pontuais, como salvar e enviar, nos próprios botões; skeletons serão usados apenas na carga inicial ou troca de conjunto de dados.
- Preservar os estados vazios atuais para quando a consulta terminar sem resultados.

## Detalhes técnicos
- Reutilizar tokens visuais existentes (`bg-card`, `bg-muted`, `border-border`) e respeitar redução de movimento.
- Usar componentes compartilhados para evitar duplicação e garantir consistência em celular, tablet e computador.
- Validar tipagem, testes relevantes e renderização da Agenda e das telas principais em desktop e mobile.

## Fora do escopo
- Nenhuma mudança em dados, consultas, navegação, regras financeiras ou funcionalidades.
