## Objetivo

Adicionar um **lembrete automático** no Financeiro que destaque, especificamente, sessões pagas via PIX ou cartão **nas últimas 24 horas** que ainda estão sem referência preenchida — separando-as do alerta geral existente, já que são as mais urgentes (transação recente, ainda fácil de localizar o comprovante).

## O que muda

Apenas `src/pages/app/Finance.tsx`. Sem migrações, sem nova tabela, sem edge function.

### 1. Cálculo do subgrupo "últimas 24h"

Aproveitar `missingReference` já existente e derivar:

```ts
const now = Date.now();
const recentMissing = missingReference.filter((r) => {
  const ref = r.paid_at ?? r.scheduled_at; // paid_at é o sinal de "quando virou pago"
  return ref && now - new Date(ref).getTime() <= 24 * 60 * 60 * 1000;
});
```

Usa `paid_at` quando existir (já é setado ao marcar como pago); cai para `scheduled_at` como fallback.

### 2. Toast automático ao carregar

Após cada `load()` bem-sucedido, se `recentMissing.length > 0`, dispara **uma vez por sessão de navegação** um `toast.warning` com ação "Ver":

- Controle via `useRef<Set<string>>` com os IDs já notificados, para não spammar a cada troca de mês ou refetch.
- Reseta o set quando o usuário corrige (após `load()` que retorna a lista vazia).
- Mensagem: "X pagamento(s) recente(s) sem referência" + descrição com nomes (até 2) e botão "Revisar" que rola até o banner.

### 3. Banner destacado "Últimas 24h" acima do alerta atual

Novo `<Alert>` (variant destructive, mais proeminente — ícone `BellRing`) renderizado **antes** do alerta geral existente, somente quando `recentMissing.length > 0`. Estrutura idêntica ao alerta atual (lista com até 5 itens + botão "Corrigir" que abre `setEditing`), mas com:

- Título: "Lembrete: pagamentos recentes sem referência"
- Subtítulo indicando "marcados como pagos nas últimas 24h"
- Para cada item, mostrar tempo relativo ("há 3h") usando `formatDistanceToNow` do date-fns/ptBR

O alerta geral atual (`missingReference`) continua existindo, mas filtrado para excluir os já mostrados no bloco de 24h, evitando duplicação:

```ts
const olderMissing = missingReference.filter((r) => !recentMissing.includes(r));
```

### 4. Ajuste visual

- Importar `BellRing` do lucide-react e `formatDistanceToNow` do date-fns.
- Banner de 24h com classe levemente diferente (ex.: `border-destructive bg-destructive/10`) para se destacar do alerta secundário.

## Detalhes técnicos

- Nenhum estado novo além de um `useRef<Set<string>>` para deduplicar toasts.
- `recentMissing` recalculado por `useMemo` dependente de `rows`.
- O toast usa `sonner` (já importado).
- Sem mudanças em rotas, schema, RLS ou outras telas.

## Fora do escopo

- Notificações por email/push (exigiria edge function + cron). Pode ser proposto depois caso o usuário queira lembretes mesmo sem abrir o app.
- Persistir "lembretes dispensados" entre sessões.