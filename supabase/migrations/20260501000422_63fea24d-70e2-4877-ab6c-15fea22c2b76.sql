-- 1. Profile type enum
DO $$ BEGIN
  CREATE TYPE public.profile_type AS ENUM ('standard', 'supervisee');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Add columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_type public.profile_type NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS supervisor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_supervisor_id ON public.profiles(supervisor_id);

-- 3. Security definer helper: is the current user the supervisor of _supervisee_id?
CREATE OR REPLACE FUNCTION public.is_supervisor_of(_supervisee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _supervisee_id
      AND supervisor_id = auth.uid()
      AND profile_type = 'supervisee'
  );
$$;

-- 4. Update handle_new_user trigger to capture profile_type from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, profile_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'profile_type', '')::public.profile_type,
      'standard'::public.profile_type
    )
  );
  RETURN NEW;
END;
$$;

-- Make sure the trigger is wired up (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. PROFILES: allow supervisors to see their supervisees' profiles
DROP POLICY IF EXISTS "Supervisors can view supervisees" ON public.profiles;
CREATE POLICY "Supervisors can view supervisees"
  ON public.profiles FOR SELECT
  USING (supervisor_id = auth.uid());

-- 6. PATIENTS: allow supervisors to read patients of their supervisees
DROP POLICY IF EXISTS "Supervisors can view supervisee patients" ON public.patients;
CREATE POLICY "Supervisors can view supervisee patients"
  ON public.patients FOR SELECT
  USING (public.is_supervisor_of(user_id));

-- 7. SESSIONS: allow supervisors to read sessions of their supervisees
DROP POLICY IF EXISTS "Supervisors can view supervisee sessions" ON public.sessions;
CREATE POLICY "Supervisors can view supervisee sessions"
  ON public.sessions FOR SELECT
  USING (public.is_supervisor_of(user_id));

-- 8. Prevent users from setting themselves as their own supervisor
CREATE OR REPLACE FUNCTION public.prevent_self_supervisor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.supervisor_id IS NOT NULL AND NEW.supervisor_id = NEW.id THEN
    RAISE EXCEPTION 'Um perfil n\u00e3o pode ser supervisor de si mesmo';
  END IF;
  -- Only supervisees may have a supervisor
  IF NEW.profile_type <> 'supervisee' AND NEW.supervisor_id IS NOT NULL THEN
    NEW.supervisor_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_self_supervisor ON public.profiles;
CREATE TRIGGER profiles_prevent_self_supervisor
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_supervisor();