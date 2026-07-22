ALTER TABLE public.homework_tasks ADD COLUMN IF NOT EXISTS weekly_goal text NULL;
ALTER TABLE public.homework_tasks ALTER COLUMN title DROP NOT NULL;