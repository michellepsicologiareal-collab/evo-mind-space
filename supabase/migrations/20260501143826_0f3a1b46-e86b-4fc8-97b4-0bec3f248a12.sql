-- Add 'confirmed' to session_status enum
ALTER TYPE public.session_status ADD VALUE IF NOT EXISTS 'confirmed';

-- Add confirmation token column
ALTER TABLE public.sessions
ADD COLUMN confirmation_token uuid DEFAULT NULL;

-- Index for fast token lookup
CREATE UNIQUE INDEX idx_sessions_confirmation_token
ON public.sessions (confirmation_token)
WHERE confirmation_token IS NOT NULL;

-- Allow public (unauthenticated) access to session by token for confirmation page
CREATE POLICY "Public can view session by confirmation token"
ON public.sessions
FOR SELECT
TO anon
USING (confirmation_token IS NOT NULL AND confirmation_token = confirmation_token);

CREATE POLICY "Public can confirm or cancel session by token"
ON public.sessions
FOR UPDATE
TO anon
USING (confirmation_token IS NOT NULL)
WITH CHECK (confirmation_token IS NOT NULL);