
# Auditoria de Responsividade — PsiReal

Escopo grande (30+ telas + componentes). Antes de aplicar, alinho o plano de execução para não desconfigurar telas que já estão OK.

## Abordagem

Faço em **3 ondas**, priorizando o que hoje quebra mais em mobile (tabelas densas, drawers, formulários longos). Cada onda é auditada em headless browser a 360/390/768px, corrigida e verificada. Nada de mudança de regra de negócio, query ou cálculo — só camada de apresentação (Tailwind, layout, overflow, empty states).

### Padrões que vou aplicar (sem inventar novos componentes)

- **Tabelas densas** (Financeiro, Pacientes, Sessões, Supervisão):
  - Desktop/tablet ≥768px: tabela atual.
  - Mobile <768px: mesma fonte, virar **lista de cards** (um card por linha) usando `<div className="md:hidden">` + `hidden md:block` na tabela. Reaproveita os mesmos badges/ações. Ações vão para menu `...` já existente onde aplicável.
- **Filtros/chips**: `flex-wrap gap-2` + `overflow-x-auto -mx-4 px-4 snap-x` quando forem muitos, para não empilhar em 3 linhas em telas pequenas.
- **KPI cards / grids**: revisar `grid-cols-*` para começar em `grid-cols-1`, `sm:grid-cols-2`, `lg:grid-cols-N`. Hoje muitos usam `md:grid-cols-5` direto, que quebra em 768px.
- **Modais/Dialogs**: `max-w-*` + `w-[95vw]` + `max-h-[90vh] overflow-y-auto` para telas pequenas.
- **Drawers laterais** (Ficha do Paciente, Financeiro): `w-full sm:max-w-md md:max-w-2xl` — hoje alguns forçam largura fixa.
- **Formulários longos** (Registro de Sessão, Anamneses, Formulações): revisar grids de 2/3 colunas para colapsar em 1 no mobile; botões de ação (Salvar/Cancelar) `sticky bottom-0` no mobile para não sumir depois do scroll.
- **Gráficos** (Humor, Dashboard, Financeiro): garantir `ResponsiveContainer` com altura fixa e wrapper com `overflow-x-auto` quando o eixo X for denso.
- **Calendário (Agenda)**: view diária/semanal — no mobile forçar view diária, com scroll horizontal para a semana; header de dias com `overflow-x-auto snap-x`.
- **PageHeader**: título + ações — hoje alguns quebram; ajustar para `flex-col sm:flex-row` e ações em `w-full sm:w-auto`.
- **Landing Page**: revisar seções hero/features/pricing para clampar tamanhos de fonte (`text-4xl md:text-6xl`) e paddings.
- **Auth (Login/Cadastro)**: já é card centralizado; revisar apenas paddings em 320px.
- **Bottom bar mobile**: garantir `pb-20` nas páginas para conteúdo não ficar atrás da bottom bar.

### Ondas

**Onda 1 — Alta densidade / maior impacto**
1. Financeiro (`Finance.tsx`) — tabela agrupada, KPI grid 5-col, filtros, drawer.
2. Pacientes (`Patients.tsx`) — tabela + chips + drawer da ficha.
3. Agenda (`Agenda.tsx`) — calendário, modais de nova sessão/recorrente.
4. Painel (`Dashboard.tsx`) — KPI grid.
5. `AppLayout.tsx` — sidebar/bottom bar, paddings globais.

**Onda 2 — Formulários longos e detalhamento clínico**
6. Registro de Sessão (`RegistroSessao.tsx` + Hub).
7. Formulações (`FormulacaoACT/TCC/TE/Livre/IA.tsx` + `CaseFormulation.tsx`).
8. Plano de Atendimento (`PlanoTratamento.tsx` + Hub + `PlanModal.tsx`).
9. Anamneses (`Anamneses.tsx` + `ChildAnamnesisForm.tsx` + `AdultAnamnesisViewer.tsx`).
10. Ficha do paciente drawer (dentro de `Patients.tsx`).

**Onda 3 — Auxiliares e públicas**
11. Supervisão (`Supervision.tsx`, `SupervisaoCaso.tsx`, `Supervisees.tsx`).
12. Humor (`Humor.tsx`) — gráficos.
13. Configurações (`Profile.tsx`).
14. Comece Por Aqui, Biblioteca, Autocuidado, Contratos, Tarefas.
15. Landing (`Index.tsx` + `src/components/landing/*`).
16. Auth, ResetPassword, Admin.
17. Páginas públicas: `AnamnesePublica`, `AnamneseAdultoPublica`, `ContratoPublico`, `ConfirmarSessao`, `SessaoConfirmada`.

### Verificação por onda

Para cada onda rodo um script Playwright headless nos viewports 360, 390, 768, 1024 tirando screenshots das rotas alteradas, e leio-os para confirmar visualmente. Sem restart do dev server.

## Restrições que respeitarei

- **Sem** mudanças em `src/integrations/supabase/*`, queries, handlers, cálculos financeiros.
- **Sem** reduzir font-size em tabelas.
- **Sem** cortar informações — em mobile, tabela vira cards com os mesmos dados.
- Mesma paleta (Terracota/Musgo/Lilás/Champagne), mesmos componentes shadcn, mesma tipografia (Plus Jakarta Sans / Inter).

## Entrega final

Ao terminar as 3 ondas, retorno:
- Lista de telas ajustadas.
- Lista de componentes ajustados.
- Problemas encontrados × correções aplicadas.
- Confirmação de typecheck limpo + evidências (screenshots) por viewport.

## Duração estimada

Trabalho grande — múltiplas rodadas de edição + verificação. Sigo direto até o fim se aprovar, sem parar para confirmar cada tela.

Confirmo a abordagem para iniciar pela **Onda 1**?
