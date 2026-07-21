## Objetivo

Eliminar a duplicidade "planejar próxima sessão em dois lugares". O **Registro de Sessão** passa a ser a única fonte de verdade. O **Plano Terapêutico** apenas exibe o planejamento salvo e leva de volta ao Registro para edição. Sem alterações de banco, sem novas regras clínicas.

---

## 1. Registro de Sessão — bloco "Próxima sessão"

No fim do formulário (`src/pages/app/RegistroSessao.tsx`), substituir o campo solto "Combinados para a próxima sessão" por um bloco **Próxima sessão** com:

- **Data da próxima sessão** (opcional) — input date+hora
- **Objetivo da próxima sessão** — textarea
- **O que retomar** — textarea
- **Meta vinculada** — select (metas do plano ativo, se existir)
- **Técnicas previstas** — chips clicáveis (técnicas do plano ativo, se existir)
- **Observações / lembretes** — textarea

Se não houver plano ativo, os textareas + data continuam disponíveis; meta e técnicas ficam vazias e um texto explica que serão vinculadas depois.

Pré-carregar valores existentes se houver `session_plans` da próxima sessão futura.

## 2. Ação de salvar

Ao clicar **Salvar registro**, em sequência:

1. Salva `session_records` (mantendo `next_session_plan` como texto sintético a partir de objetivo + retomar + observações, para preservar as telas que já usam esse campo).
2. Resolve a "próxima sessão-alvo":
   - Sessão futura já agendada → usa esse `session_id`.
   - Nova data informada e sem sessão futura → cria `sessions` (`status='scheduled'`), Agenda atualizada.
   - Nova data informada e sessão futura em data diferente → atualiza `scheduled_at`.
   - Sem data e sem sessão futura → salva o planejamento com `session_id = null`.
3. Upsert em `session_plans` com objetivo, meta_id, retomar, tecnicas, observacoes.
4. **Verifica se existe `treatment_plans` ativo** (`status='ativo'`) para o paciente. Ver seção 3.
5. Redireciona para a aba **Sessões** da ficha do paciente (fluxo atual) — exceto quando a modal do passo 3 estiver aberta.

## 3. Regra quando NÃO existir Plano Terapêutico ativo

Após salvar tudo com sucesso, se o paciente não tiver `treatment_plans` ativo, abrir um **diálogo amigável** (sem criar nada em segundo plano):

> Você registrou a sessão com sucesso.
> Este paciente ainda não possui um Plano Terapêutico.
> Deseja criar um agora utilizando as informações já registradas?

Dois botões:

- **Depois** — fecha o diálogo e segue para a aba Sessões. Nenhum plano é criado.
- **Criar Plano Terapêutico** — cria um `treatment_plans` novo com `status='rascunho'` para o paciente, pré-preenchendo **apenas**:
  - Objetivo atual → a partir do `objetivo` da próxima sessão recém-salva.
  - Meta vinculada → se havia `meta_id` selecionada, criar 1 registro em `treatment_goals` com essa descrição (quando ela não existir ainda). Se `meta_id` já apontava para meta existente, apenas manter o vínculo lógico.
  - Técnicas previstas → cada técnica selecionada vira 1 registro em `treatment_techniques` vinculado ao novo plano.
  - **NÃO** preencher: diagnóstico, CID, hipóteses, conceituação/formulação, indicadores, critérios de alta, revisões, abordagem — permanecem em branco para a psicóloga completar.
  - Após criar, navegar para `/app/plano-tratamento?patient=<id>` e mostrar um banner/toast persistente: "Plano criado como **Rascunho** — revise antes de ativar." O banner só some quando o status muda de `rascunho`.

A criação **só acontece após clique explícito**. Nenhum plano é gerado silenciosamente. Se ocorrer erro na criação, exibir toast de erro e manter a psicóloga na tela do Registro (o registro em si já foi salvo).

## 4. Plano Terapêutico — bloco "Próxima sessão" somente leitura

Em `src/pages/app/PlanoTratamento.tsx`, o Card atual (linhas 559-619) deixa de ter formulário. Passa a exibir:

- Data/hora da próxima sessão (`sessions`)
- Objetivo, O que retomar, Meta vinculada (nome resolvido), Técnicas (chips não clicáveis), Observações

Um único botão **Editar planejamento** → `navigate("/app/registro-sessao?patient=<id>&focus=proxima-sessao")`.

Estado vazio: "Nenhum planejamento salvo. Registre a sessão para planejar a próxima." + mesmo botão.

Se o plano estiver em `rascunho`, mostrar o banner descrito na seção 3.

Remover: `saveSessionPlan`, inputs editáveis, `toggleSessionTech`. Manter as consultas usadas para render.

## 5. Consistência

- `session_records.next_session_plan` continua populado com texto sintético — mantém compatibilidade com Agenda, `PatientSessionsQuickView`, resumo IA.
- Sem migração de dados.
- Registros antigos continuam abrindo normalmente.

---

## Detalhes técnicos

**Arquivos editados:**

- `src/pages/app/RegistroSessao.tsx`
  - Estender `emptyForm`: `next_scheduled_at`, `next_objetivo`, `next_retomar`, `next_meta_id`, `next_tecnicas`, `next_observacoes`.
  - Buscar plano ativo + `treatment_goals` + `treatment_techniques` quando `patient_id` muda.
  - Novo bloco de UI no lugar do textarea único.
  - `handleSave`:
    1. `session_records` upsert (com `next_session_plan` sintético).
    2. Resolver `nextSessionId` (`sessions` futuras, ordem asc).
    3. `insert`/`update` em `sessions` se `next_scheduled_at` informado.
    4. `upsert` em `session_plans`.
    5. `select` em `treatment_plans` com `status='ativo'` — se vazio, abrir `NoTreatmentPlanDialog`.
  - Novo componente `NoTreatmentPlanDialog` (inline no arquivo): 2 botões. "Criar Plano Terapêutico" executa:
    - `insert` em `treatment_plans` (`status='rascunho'`, `conceitualizacao=objetivo`, demais campos vazios/null).
    - Se técnicas → `insert` em `treatment_techniques` (bulk).
    - Se `meta_id` era nova/inexistente → criar `treatment_goals` correspondente.
    - `navigate("/app/plano-tratamento?patient=<id>")`.
  - Suporte a `?focus=proxima-sessao` (scroll + highlight temporário).

- `src/pages/app/PlanoTratamento.tsx`
  - Substituir Card 559-619 por card read-only + botão único `Editar planejamento`.
  - Adicionar banner "Rascunho — revise antes de ativar" quando `plan.status === 'rascunho'`.
  - Remover `saveSessionPlan`, `toggleSessionTech`, inputs editáveis do bloco.

**Sem mudanças em:** schema, RLS, tipos gerados, edge functions, resumo IA, Agenda, `PatientSessionsQuickView`.

**Validação:**

1. Paciente sem plano → salvar registro → aparece diálogo. "Depois" volta para Sessões, nenhum plano criado. "Criar" cria rascunho com objetivo/meta/técnicas e abre o Plano com banner.
2. Paciente com plano ativo → salvar registro → nenhum diálogo, volta direto para Sessões.
3. Plano Terapêutico exibe planejamento salvo e "Editar planejamento" leva ao Registro focado no bloco.
4. Salvar com data cria/atualiza sessão na Agenda.
