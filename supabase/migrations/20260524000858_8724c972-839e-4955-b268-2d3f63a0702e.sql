-- 1) Library bucket: restrict UPDATE to admins
DROP POLICY IF EXISTS "Admins can update library files" ON storage.objects;
CREATE POLICY "Admins can update library files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'library' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'library' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) Realtime channel authorization: only allow subscribing to your own user channel
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can subscribe to their own channel" ON realtime.messages;
CREATE POLICY "Users can subscribe to their own channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    realtime.topic() = ('user:' || auth.uid()::text)
    OR realtime.topic() = auth.uid()::text
  )
);

-- 3) OAuth CSRF protection: store nonces server-side
CREATE TABLE IF NOT EXISTS public.google_oauth_states (
  user_id uuid NOT NULL,
  nonce text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  PRIMARY KEY (user_id, nonce)
);

ALTER TABLE public.google_oauth_states ENABLE ROW LEVEL SECURITY;

-- No policies = no access via PostgREST. Only service role (edge functions) can read/write.

CREATE INDEX IF NOT EXISTS idx_google_oauth_states_expires ON public.google_oauth_states (expires_at);