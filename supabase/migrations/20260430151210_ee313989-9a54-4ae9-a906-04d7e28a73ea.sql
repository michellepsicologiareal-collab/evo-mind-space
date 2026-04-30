
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid');

ALTER TABLE public.sessions
  ADD COLUMN payment_status public.payment_status NOT NULL DEFAULT 'pending',
  ADD COLUMN paid_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_sessions_user_scheduled ON public.sessions(user_id, scheduled_at);
CREATE INDEX idx_sessions_user_payment ON public.sessions(user_id, payment_status);
