# Alterar a data no painel financeiro

- Adicionar **Alterar data** em cada sessão do painel financeiro do paciente mostrado na imagem.
- Abrir um calendário com a data atual selecionada e permitir escolher e salvar outra data, mantendo o horário.
- Mostrar confirmação de salvamento ou erro e atualizar a sessão e a lista do Financeiro.
- Preservar pagamentos, valores, vencimentos, status e a composição dos pacotes; alterar somente a data da sessão escolhida.

## Verificação
- Testar a escolha da data no celular e no computador.
- Verificar o salvamento e a atualização da lista usando exclusivamente uma sessão fictícia, sem alterar pacientes reais.

## Detalhes técnicos
- Usar o calendário Shadcn com `pointer-events-auto` dentro do painel.
- Atualizar somente `scheduled_at`, com filtros de sessão, paciente e usuário, e reutilizar a atualização de dados existente do Financeiro.