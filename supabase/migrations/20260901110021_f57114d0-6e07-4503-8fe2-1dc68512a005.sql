ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'overdue';
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'expired';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_name text NOT NULL DEFAULT 'Grátis',
  ADD COLUMN IF NOT EXISTS subscription_started_at date,
  ADD COLUMN IF NOT EXISTS last_payment_at date,
  ADD COLUMN IF NOT EXISTS next_renewal_at date,
  ADD COLUMN IF NOT EXISTS subscription_notes text;

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings readable by everyone" ON public.app_settings;
CREATE POLICY "app_settings readable by everyone" ON public.app_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "app_settings admin manage" ON public.app_settings;
CREATE POLICY "app_settings admin manage" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.app_settings (key, value)
VALUES ('kiwify_checkout_url', 'https://pay.kiwify.com.br/k4VMHLa')
ON CONFLICT (key) DO NOTHING;