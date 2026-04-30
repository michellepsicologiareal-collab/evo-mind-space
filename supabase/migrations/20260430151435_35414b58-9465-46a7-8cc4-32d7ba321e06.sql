
CREATE TYPE public.payment_method AS ENUM ('pix', 'card', 'cash');

ALTER TABLE public.sessions
  ADD COLUMN payment_method public.payment_method,
  ADD COLUMN payment_reference TEXT;
