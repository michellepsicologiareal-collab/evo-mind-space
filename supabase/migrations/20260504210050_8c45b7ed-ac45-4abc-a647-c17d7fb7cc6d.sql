ALTER TABLE public.profiles
  ADD COLUMN goal_sessions integer NOT NULL DEFAULT 40,
  ADD COLUMN goal_revenue numeric NOT NULL DEFAULT 10000,
  ADD COLUMN goal_records integer NOT NULL DEFAULT 20;