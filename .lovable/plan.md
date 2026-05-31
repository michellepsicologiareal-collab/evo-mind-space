# Plano de correção de segurança (ordem de prioridade)

Ordem definida por **impacto × facilidade de exploração**. Vou corrigir tudo em uma única rodada, mas nesta sequência para minimizar risco caso algo precise voltar.

## 🔴 Prioridade 1 — Exploráveis com pouco esforço

### 1. IDOR no Google Calendar Sync
**Por que primeiro:** qualquer usuário autenticado pode quebrar/duplicar sync de outro só passando um `session_id` alheio. Exploração trivial.
- Em `supabase/functions/google-calendar-sync/index.ts`, adicionar `.eq('user_id', userId)` nas queries de select/delete sobre `session_gcal_events`.
- Validar que `session.id` pertence ao usuário autenticado antes de qualquer ação (select em `sessions` filtrando por `user_id`).

### 2. Backup Import — sobrescrita por UUID
**Por que segundo:** permite transferir posse de registros. Precisa do UUID alvo, mas o estrago é grave.
- Em `supabase/functions/backup-import/index.ts`, remover `id`, `user_id`, `created_at`, `updated_at` de cada row antes de gravar.
- Trocar `upsert({ onConflict: 'id' })` por `insert()` — backup deve sempre criar registros novos.

## 🟠 Prioridade 2 — Vazamento de dados pagos

### 3. Arquivos premium da `library` acessíveis a todo authenticated
**Por que terceiro:** vaza conteúdo pago, mas exige conhecer/adivinhar o path do arquivo.
- Migration: substituir a policy de SELECT no `storage.objects` do bucket `library` para exigir `subscription_status = 'active'` no `profiles` do usuário (ou ser admin).

## 🟡 Prioridade 3 — Endurecimento (defesa em profundidade)

### 4. `signed_contracts` sem policy de INSERT
**Por que aqui:** RLS está habilitada e não há policy de INSERT → o PostgREST já bloqueia. É hardening explícito.
- Migration: adicionar policy restritiva negando INSERT a `anon` e `authenticated` (service role da edge function continua passando).

### 5. Vazamento de detalhes de erro em `summarize-formulation`
- Trocar `String(e)` por mensagem genérica `'Erro ao gerar resumo'` e `console.error` server-side.
- Varrer outras edge functions com o mesmo padrão e aplicar o mesmo tratamento.

### 6. RLS habilitada sem policy (`google_oauth_states`)
- Adicionar comentário/policy explícita bloqueando tudo para `anon`/`authenticated` (uso é só service role) — silencia o linter e documenta a intenção.

## Detalhes técnicos resumidos

```text
1. google-calendar-sync/index.ts → +.eq('user_id', userId) nas queries
2. backup-import/index.ts        → strip id/user_id/timestamps + insert()
3. migration                     → storage policy library checa subscription_status
4. migration                     → policy restritiva INSERT em signed_contracts
5. summarize-formulation         → erro genérico + log server-side
6. migration                     → policies deny-all em google_oauth_states
```

## Validação após implementar

- Rodar o security scan novamente para confirmar que as 6 issues somem.
- Testar sync do Google Calendar e import de backup com usuário real para garantir que nada regrediu.
- Confirmar que usuário free não consegue baixar arquivo premium direto pela URL do storage.

Posso começar pela ordem acima assim que aprovar.
