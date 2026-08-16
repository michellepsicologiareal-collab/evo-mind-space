ALTER TABLE public.personal_events
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_interval integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_until date;

ALTER TABLE public.personal_events
  DROP CONSTRAINT IF EXISTS personal_events_recurrence_check;

ALTER TABLE public.personal_events
  ADD CONSTRAINT personal_events_recurrence_check
  CHECK (recurrence IN ('none','daily','weekly','monthly'));

ALTER TABLE public.personal_events
  DROP CONSTRAINT IF EXISTS personal_events_recurrence_interval_check;

ALTER TABLE public.personal_events
  ADD CONSTRAINT personal_events_recurrence_interval_check
  CHECK (recurrence_interval >= 1 AND recurrence_interval <= 52);