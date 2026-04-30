ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reminder_group_sort text NOT NULL DEFAULT 'recent';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_reminder_group_sort_check
  CHECK (reminder_group_sort IN ('recent', 'oldest', 'value', 'count', 'name'));