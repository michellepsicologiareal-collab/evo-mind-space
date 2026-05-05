
-- Add modality and meeting_link to sessions
ALTER TABLE public.sessions
  ADD COLUMN modality text NOT NULL DEFAULT 'presencial',
  ADD COLUMN meeting_link text NULL DEFAULT NULL;
