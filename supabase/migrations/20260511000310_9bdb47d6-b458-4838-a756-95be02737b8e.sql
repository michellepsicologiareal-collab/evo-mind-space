CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, profile_type, phone, is_approved)
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
    END
  );

  IF lower(NEW.email) IN ('michellepsicologiareal@gmail.com', 'michelledonegas@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

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
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  INSERT INTO public.profiles (id, full_name, profile_type, phone, is_approved)
  VALUES (
    _user_id,
    _full_name,
    _profile_type,
    _phone,
    CASE WHEN _email IN ('michellepsicologiareal@gmail.com', 'michelledonegas@gmail.com') THEN true ELSE false END
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone);

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
$function$;