
-- 1. Services catalog
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own services" ON public.services FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own services" ON public.services FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own services" ON public.services FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own services" ON public.services FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER set_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Link sessions to services
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE SET NULL;

-- 3. TCC records (prontuário TCC)
CREATE TABLE public.tcc_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  situation text,
  automatic_thought text,
  emotion text,
  behavior text,
  cognitive_distortion text,
  rational_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tcc_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tcc_records" ON public.tcc_records FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own tcc_records" ON public.tcc_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tcc_records" ON public.tcc_records FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tcc_records" ON public.tcc_records FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Supervisors can view shared tcc_records" ON public.tcc_records FOR SELECT TO authenticated USING (can_supervisor_see_patient(patient_id));

CREATE TRIGGER set_tcc_records_updated_at BEFORE UPDATE ON public.tcc_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
