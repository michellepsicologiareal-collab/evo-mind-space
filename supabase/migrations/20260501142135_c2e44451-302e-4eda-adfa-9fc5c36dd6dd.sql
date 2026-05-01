-- Create category enum (if not exists)
DO $$ BEGIN
  CREATE TYPE public.library_category AS ENUM ('documentos_legais', 'materiais_pacientes', 'guias_tcc');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.library_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category public.library_category NOT NULL,
  file_url text,
  is_premium boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.library_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view library materials"
ON public.library_materials FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert library materials"
ON public.library_materials FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update library materials"
ON public.library_materials FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete library materials"
ON public.library_materials FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_library_materials_updated_at
BEFORE UPDATE ON public.library_materials
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO storage.buckets (id, name, public) VALUES ('library', 'library', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read library files"
ON storage.objects FOR SELECT USING (bucket_id = 'library');

CREATE POLICY "Admins can upload library files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'library' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete library files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'library' AND public.has_role(auth.uid(), 'admin'));