## Objetivo

Garantir recuperação rápida em caso de incidentes com:
- Snapshot **JSON completo** diário (todas as tabelas do usuário) — restaurável.
- Exports **CSV** legíveis (Pacientes, Sessões, Prontuários, Financeiro) — para auditoria/uso externo.
- Tudo guardado em Lovable Cloud Storage privado, por usuário, com retenção de 7 dias.

## Como vai funcionar

```text
┌─ Cron diário 03:00 BRT ─┐
│ run-scheduled-backups   │  (edge function, service role)
└────────┬────────────────┘
         │ para cada usuário aprovado:
         ▼
   ┌─────────────────────────┐      ┌──────────────────────┐
   │ Gera JSON completo      │─────▶│ Storage: backups/    │
   │ Gera 4 CSVs (zipados)   │      │  {user_id}/{data}/   │
   └─────────────────────────┘      │   backup.json        │
         │                          │   exports.zip        │
         ▼                          └──────────────────────┘
   Insere linha em backup_history
   Apaga arquivos > 7 dias
```

## Backend

**Novo bucket privado `backups`** com RLS: usuário só lê pasta `{auth.uid()}/...`; escrita só via service role.

**Nova tabela `backup_history`** (1 linha por backup gerado):
- `user_id`, `backup_date`, `kind` ('auto' | 'manual'), `json_path`, `csv_zip_path`, `size_bytes`, `tables_count`, `status` ('success' | 'failed'), `error_message`

**Edge functions:**

1. `run-scheduled-backups` (nova, sem JWT, autenticada por header secret) — itera usuários aprovados, gera snapshot + CSVs, faz upload no storage, registra em `backup_history`, limpa arquivos antigos. Chamada pelo cron.
2. `backup-export` (existente) — adiciona parâmetro `?format=csv` que retorna ZIP com 4 CSVs (pacientes, sessões, prontuários, financeiro). Mantém JSON como default.
3. `backup-download` (nova) — gera URL assinada do storage para o usuário baixar arquivos do `backup_history`.

**Cron `pg_cron`** (via insert, não migration) — chama `run-scheduled-backups` todo dia 03:00 com header secret.

## Frontend

Nova aba **"Backups"** dentro de Perfil (`src/pages/app/Profile.tsx`):
- Card explicando frequência e retenção.
- Botão **"Baixar backup completo (JSON)"** — usa edge function existente.
- Botão **"Baixar exportação (CSV)"** — novo, com select de qual entidade ou tudo zipado.
- Lista dos últimos backups automáticos (de `backup_history`), com data, tamanho e botões "Baixar JSON" / "Baixar CSVs".
- Mantém botão atual de importar backup.

Sem mudanças em rotas, navegação ou outras telas.

## Detalhes técnicos

- CSV gerado server-side com headers em PT-BR; valores com vírgula/quebra de linha escapados conforme RFC 4180; encoding UTF-8 com BOM (Excel-friendly).
- ZIP feito com `jszip` via `npm:` no Deno.
- Financeiro = `sessions` com `payment_status`, valor, paciente, modalidade.
- Limite de tamanho: se backup individual > 50 MB, divide JSON por tabela. (Improvável neste volume, mas previne timeout.)
- Secret novo `BACKUP_CRON_SECRET` para autenticar o cron job.

## Arquivos tocados

- `supabase/migrations/...sql` — bucket `backups`, tabela `backup_history`, policies.
- `supabase/functions/run-scheduled-backups/index.ts` (novo)
- `supabase/functions/backup-download/index.ts` (novo)
- `supabase/functions/backup-export/index.ts` (acrescentar CSV/ZIP)
- `src/pages/app/Profile.tsx` (aba/seção de Backups)
- `src/components/profile/BackupsPanel.tsx` (novo)

## Você vai precisar fazer

- Aprovar o secret `BACKUP_CRON_SECRET` quando for solicitado.
- Aprovar a migração que cria bucket + tabela.
