## Escopo

Criar página **Plano de Tratamento** dentro do perfil do paciente + aplicar ajustes de cor nos badges da Agenda (anexo).

---

## 1. Banco de dados (migrations)

Novas tabelas (todas com `patient_id`, `user_id`, RLS por `auth.uid() = user_id`):

- **treatment_plans** — `patient_id` (unique), `status` ('ativo'|'em_revisao'|'alta'), `cid`, `abordagem` (text[]), `conceitualizacao`
- **treatment_goals** — `patient_id`, `tipo` ('geral'|'intermediaria'|'comportamental'), `descricao`, `ordem`
- **treatment_techniques** — `patient_id`, `nome`
- **session_plans** — `patient_id`, `session_id` (nullable), `objetivo`, `meta_id` (fk treatment_goals), `retomar`, `tecnicas` (text[]), `observacoes`
- **treatment_revisions** — `patient_id`, `data` (timestamptz), `sessao_ref`, `descricao`

Cada uma com RLS completo (select/insert/update/delete via `auth.uid() = user_id`) + trigger `update_updated_at_column`.

---

## 2. Sidebar (`AppLayout.tsx`)

Adicionar item na seção CLÍNICA, **após Agenda e antes de Registro Sessão**:
- `{ to: "/app/plano-tratamento", label: "Plano de tratamento", icon: ClipboardList }`

Nota: a navegação atual é global (não por paciente). A página vai abrir com seletor de paciente no topo (ou redirecionar a partir do perfil do paciente). Confirmo abaixo.

---

## 3. Página `/app/plano-tratamento` (`src/pages/app/PlanoTratamento.tsx`)

Layout em blocos conforme spec:

**Header**
- Título + Select status (Ativo/Em revisão/Alta) + botões Exportar PDF (ghost) + Editar (accent)
- Seletor de paciente (combobox) para escolher de qual paciente é o plano

**Bloco 1 — Próxima sessão** (card com `border-l-4 border-l-[#6d4fc2]`)
- Busca próxima sessão futura via `sessions` where `patient_id` + `scheduled_at > now()` order asc limit 1
- Campos: objetivo, select de meta (lista de `treatment_goals`), retomar, tags de técnicas (com sugestões de `treatment_techniques`), observações
- Salva em `session_plans` (upsert por `session_id`)

**Bloco 2 — Diagnóstico e formulação**
- Grid 2 colunas: esquerda CID + multi-select abordagem (TCC, TE, ACT, Outra); direita textarea conceitualização
- Salva em `treatment_plans`

**Bloco 3 — Metas terapêuticas**
- Lista renderizada por tipo com cor da borda esquerda:
  - geral → `border-l-[#6d4fc2]` (roxo)
  - intermediaria → `border-l-[#BA7517]` (âmbar)
  - comportamental → `border-l-[#1D9E75]` (verde)
- Cada item: select tipo, textarea descrição, botão remover
- Botão "Adicionar meta"

**Bloco 4 — Técnicas do plano**
- Tags/pills com X para remover, input inline "+ adicionar"

**Bloco 5 — Histórico de revisões**
- Timeline vertical (linha à esquerda, dots), header com botão "Nova revisão"
- Cada item: data formatada, sessão_ref, descrição

**Exportar PDF**
- Abrir nova janela com HTML formatado e `window.print()` (mesmo padrão usado em Patients.tsx para formulação)

**Autosave**: usar debounce 800ms por bloco (padrão de outros formulários longos) + indicador "Salvo" sutil.

---

## 4. Rota (`src/App.tsx`)

Adicionar `<Route path="plano-tratamento" element={<PlanoTratamento />} />` dentro do AppLayout.

---

## 5. Ajustes de cor da Agenda (anexo)

Aplicar diretamente em `src/pages/app/Agenda.tsx` (o script aponta para `components/app/Agenda.tsx` mas o arquivo real é em pages):

- `statusClass`: scheduled cinza, confirmed verde, completed cinza claro, rescheduled âmbar
- `paymentStatusClass`: pending âmbar, paid verde
- Nome do paciente: `text-primary` → `text-foreground` (se existir nesse padrão)

---

## Arquivos a criar/editar

**Criar:**
- `supabase/migrations/<timestamp>_treatment_plan.sql`
- `src/pages/app/PlanoTratamento.tsx`

**Editar:**
- `src/components/app/AppLayout.tsx` (novo item de nav)
- `src/App.tsx` (rota)
- `src/pages/app/Agenda.tsx` (cores)

---

## Pergunta antes de executar

A navegação atual é global por seção (Pacientes, Agenda, etc.), não dentro do perfil do paciente. A página vai abrir com **um seletor de paciente no topo** (combobox listando os pacientes ativos) e todo o conteúdo é filtrado por esse paciente selecionado. Está ok assim, ou prefere acessar via botão dentro de cada paciente em `/app/pacientes` (sem item dedicado na sidebar)?
