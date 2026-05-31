-- Add terms acceptance tracking to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

-- Update handle_new_user to require terms acceptance on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _terms_accepted_at timestamptz;
  _raw_terms text;
BEGIN
  _raw_terms := NULLIF(NEW.raw_user_meta_data ->> 'terms_accepted_at', '');

  IF _raw_terms IS NULL THEN
    RAISE EXCEPTION 'Aceite dos Termos de Uso e da Política de Privacidade é obrigatório'
      USING ERRCODE = 'check_violation';
  END IF;

  BEGIN
    _terms_accepted_at := _raw_terms::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Data de aceite dos termos inválida'
      USING ERRCODE = 'check_violation';
  END;

  INSERT INTO public.profiles (id, full_name, profile_type, phone, is_approved, terms_accepted_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'profile_type', '')::public.profile_type,
      'standard'::public.profile_type
    ),
    NULLIF(NEW.raw_user_meta_data ->> 'phone', ''),
    CASE
      WHEN lower(NEW.email) IN ('michellepsicologiareal@gmail.com', 'michelledonegas@gmail.com') THEN true
      ELSE false
    END,
    _terms_accepted_at
  );

  IF lower(NEW.email) IN ('michellepsicologiareal@gmail.com', 'michelledonegas@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Also update ensure_current_profile to backfill acceptance if available in JWT metadata
CREATE OR REPLACE FUNCTION public.ensure_current_profile()
RETURNS TABLE(is_approved boolean, profile_type profile_type)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  _full_name text := coalesce(auth.jwt() -> 'user_metadata' ->> 'full_name', '');
  _phone text := nullif(auth.jwt() -> 'user_metadata' ->> 'phone', '');
  _profile_type public.profile_type := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'profile_type', '')::public.profile_type,
    'standard'::public.profile_type
  );
  _terms text := nullif(auth.jwt() -> 'user_metadata' ->> 'terms_accepted_at', '');
  _terms_ts timestamptz := NULL;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF _terms IS NOT NULL THEN
    BEGIN
      _terms_ts := _terms::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      _terms_ts := NULL;
    END;
  END IF;

  INSERT INTO public.profiles (id, full_name, profile_type, phone, is_approved, terms_accepted_at)
  VALUES (
    _user_id,
    _full_name,
    _profile_type,
    _phone,
    CASE WHEN _email IN ('michellepsicologiareal@gmail.com', 'michelledonegas@gmail.com') THEN true ELSE false END,
    _terms_ts
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    terms_accepted_at = COALESCE(public.profiles.terms_accepted_at, EXCLUDED.terms_accepted_at);

  IF _email IN ('michellepsicologiareal@gmail.com', 'michelledonegas@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.profiles SET is_approved = true WHERE id = _user_id;
  END IF;

  RETURN QUERY
  SELECT p.is_approved, p.profile_type
  FROM public.profiles p
  WHERE p.id = _user_id;
END;
$function$;