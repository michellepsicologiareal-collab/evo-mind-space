-- 1. Bucket privado para backups
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Policies do bucket: usuário lê apenas a própria pasta; escrita só pelo service role
CREATE POLICY "Users can read own backup files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'backups'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- (sem INSERT/UPDATE/DELETE para clients — apenas service role escreve)

-- 3. Tabela de histórico
CREATE TABLE public.backup_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  backup_date timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL DEFAULT 'auto' CHECK (kind IN ('auto', 'manual')),
  json_path text,
  csv_zip_path text,
  size_bytes bigint NOT NULL DEFAULT 0,
  tables_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.backup_history TO authenticated;
GRANT ALL ON public.backup_history TO service_role;

ALTER TABLE public.backup_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own backup history"
ON public.backup_history FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_backup_history_user_date
ON public.backup_history (user_id, backup_date DESC);

-- 4. Extensões para agendamento
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;