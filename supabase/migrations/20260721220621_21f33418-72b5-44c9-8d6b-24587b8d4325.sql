
CREATE OR REPLACE FUNCTION public.check_signup_availability(_email text, _phone_digits text)
RETURNS TABLE(email_exists boolean, phone_exists boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _e text := lower(trim(coalesce(_email, '')));
  _p text := regexp_replace(coalesce(_phone_digits, ''), '\D', '', 'g');
BEGIN
  RETURN QUERY SELECT
    CASE WHEN _e = '' THEN false
      ELSE EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = _e)
    END,
    CASE WHEN length(_p) < 10 THEN false
      ELSE EXISTS (
        SELECT 1 FROM public.profiles
        WHERE regexp_replace(coalesce(phone, ''), '\D', '', 'g') = _p
      )
    END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_signup_availability(text, text) TO anon, authenticated;
