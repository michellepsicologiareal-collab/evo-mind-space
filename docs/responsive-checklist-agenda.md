# Checklist de breakpoints — Agenda (mobile/tablet)

Objetivo: evitar regressões de **corte** (conteúdo truncado) e **sobreposição** (elementos empilhados por cima uns dos outros) na tela `/app/agenda`.

## Breakpoints oficiais

| Largura | Dispositivo de referência | Nível |
| --- | --- | --- |
| 320px | iPhone SE (1ª ger.) | mínimo suportado |
| 360px | Android comum | crítico |
| 375px | iPhone SE/13 mini | crítico |
| 390px | iPhone 14/15 | crítico |
| 414px | iPhone Plus | importante |
| 430px | iPhone Pro Max | importante |
| 640px | `sm` do Tailwind | transição |
| 768px | `md` / tablet retrato | transição |
| 820px | iPad Air | importante |
| 1024px | `lg` / tablet paisagem | desktop reduzido |

## Itens a verificar em cada largura

Repetir nas três visualizações: **Dia**, **Semana**, **Mês**.

### Cabeçalho
- [ ] Título "Agenda" em uma linha; descrição longa oculta abaixo de `sm`.
- [ ] Linha de ações (Atualizar / Google / Sincronizar) rola horizontalmente, sem quebrar altura.
- [ ] Nenhum botão sobreposto ao título ou cortado na borda direita.
- [ ] Botão "+ Nova sessão" aparece como FAB no mobile e inline a partir de `sm`.

### Filtros
- [ ] Chips de serviço em **uma linha** com rolagem horizontal (sem wrap que estica a página).
- [ ] Chip longo truncado com `max-w`, nunca estourando a viewport.
- [ ] Select de paciente ocupa a linha inteira no mobile; botão "Limpar" visível quando ativo.
- [ ] Mês e Ano lado a lado em grade de 2 colunas no mobile; alinhados em linha a partir de `sm`.
- [ ] Selects abrem menu nativo/portal sem cortar opções.

### Navegação de datas
- [ ] Abas Dia/Semana/Mês não se sobrepõem às setas ‹ › nem ao rótulo do período.
- [ ] Rótulo do período trunca com reticências em vez de empurrar a linha.
- [ ] "Hoje" e "Compacto" permanecem clicáveis (alvo mínimo de 32px).

### Cards de sessão
- [ ] Nome do paciente quebra em várias linhas em vez de vazar.
- [ ] Badges clínicos (lembrete, plano, pagamento) reduzidos a ícones com tooltip no mobile.
- [ ] Rodapé de atalhos (Sessões, Financeiro, Plano) em grade de 2 colunas no mobile, sem corte à direita.
- [ ] "Registrar sessão" em largura total no mobile.

### KPIs e modais
- [ ] Cards de KPI em 2 colunas no mobile, com números legíveis e rótulos quebrando.
- [ ] Modais ("Nova sessão", "Plano entre Sessões") com `max-h` e rolagem interna, sem rolagem dupla.
- [ ] Nada fica escondido atrás da bottom nav nem do FAB.

### Global
- [ ] `document.documentElement.scrollWidth === window.innerWidth` (sem rolagem horizontal da página).
- [ ] Nenhum elemento com texto cortado sem `truncate`/`overflow-auto`.

## Como validar

```bash
python3 scripts/responsive_audit.py            # audita /app/agenda
python3 scripts/responsive_audit.py /app/pacientes
```

O script percorre todas as larguras da tabela, alterna Dia/Semana/Mês, reporta `PASS`/`FAIL` por combinação e salva screenshots em `/tmp/responsive-audit`. Sai com código 1 se houver falhas.

## Estado da última validação

Todas as larguras de 320px a 1024px, nas três visualizações: **sem rolagem horizontal e sem elementos cortados**.

Falso positivo conhecido: contêineres com margem negativa (`-mx-4 sm:-mx-6 lg:-mx-10`) dentro de um pai com padding equivalente aparecem ultrapassando a viewport em medições ingênuas. Como a página não rola horizontalmente, não é regressão — o script já ignora esse caso.
