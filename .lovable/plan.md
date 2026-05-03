
## Redesign da Agenda

### O que muda

1. **Calendário mensal interativo** -- Um mini-calendário mensal (DayPicker) no topo ou lateral esquerda. Dias com sessões terão indicador visual (bolinha). Clicar em um dia mostra a lista de pacientes/sessões daquele dia.

2. **Visão semanal melhorada** -- Mantém a grade de 7 dias, mas com cards maiores mostrando o nome completo do paciente (não truncado), horário e status. No desktop, layout mais espaçoso.

3. **Tabs Mês / Semana / Dia** -- Três abas para alternar entre visão mensal (calendário + lista do dia selecionado), semanal (grade atual melhorada) e dia (lista detalhada).

4. **Remover Google Calendar** -- Botão de sincronização com Google Calendar e todo código relacionado (gcal state, funções `syncSessionToGcal`, `deleteGcalEvent`, `startGcalAuth`, `disconnectGcal`, `checkGcalStatus`) serão removidos da Agenda. As edge functions ficam no projeto para uso futuro.

5. **Exclusão de pendências financeiras** -- No painel de Sessões Pendentes, adicionar botão de excluir (lixeira) em cada item, que remove a sessão e suas referências financeiras. No dialog de edição, botão "Excluir sessão" também disponível.

6. **Filtros por data ou paciente** -- Ao clicar em uma sessão/paciente, abrir painel lateral ou seção expandida mostrando todas as sessões daquele paciente, com opção de ordenar por data (ascendente/descendente) ou agrupar por paciente. Dropdown de filtro no topo da lista.

7. **Edição completa vinculada ao paciente** -- O dialog de edição já existe; será expandido para mostrar o nome do paciente, link para ficha, e permitir trocar paciente se necessário.

### Detalhes técnicos

- **Arquivo principal**: `src/pages/app/Agenda.tsx` (reescrever ~80%)
- **Componentes**: Usar `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` do shadcn para as visões
- **Calendário**: Usar `Calendar` (DayPicker) já existente no projeto com `pointer-events-auto`
- **Dados**: Buscar sessões do mês inteiro (não só da semana) quando em visão mensal
- **Sem migração de banco** necessária -- tudo usa tabelas existentes (`sessions`, `patients`, `patient_progress`)
- **Sem mudanças em edge functions**
