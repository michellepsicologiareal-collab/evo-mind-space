CREATE OR REPLACE FUNCTION public.ensure_current_profile()
RETURNS TABLE(is_approved boolean, profile_type public.profile_type)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  _full_name text := coalesce(auth.jwt() -> 'user_metadata' ->> 'full_name', '');
  _profile_type public.profile_type := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'profile_type', '')::public.profile_type,
    'standard'::public.profile_type
  );
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  INSERT INTO public.profiles (id, full_name, profile_type, is_approved)
  VALUES (
    _user_id,
    _full_name,
    _profile_type,
    CASE WHEN _email IN ('michellepsicologiareal@gmail.com', 'michelledonegas@gmail.com') THEN true ELSE false END
  )
  ON CONFLICT (id) DO NOTHING;

  IF _email IN ('michellepsicologiareal@gmail.com', 'michelledonegas@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.profiles
    SET is_approved = true
    WHERE id = _user_id;
  END IF;

  RETURN QUERY
  SELECT p.is_approved, p.profile_type
  FROM public.profiles p
  WHERE p.id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_access_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  NEW.is_approved := OLD.is_approved;
  NEW.subscription_status := OLD.subscription_status;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_access_fields ON public.profiles;
CREATE TRIGGER profiles_protect_access_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_access_fields();