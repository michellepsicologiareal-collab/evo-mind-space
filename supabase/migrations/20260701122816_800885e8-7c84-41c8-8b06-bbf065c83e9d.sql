CREATE OR REPLACE FUNCTION public.protect_contract_invite_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text := auth.role();
BEGIN
  IF _role IN ('authenticated', 'anon') THEN
    NEW.used_at := OLD.used_at;
    NEW.signed_contract_id := OLD.signed_contract_id;
    NEW.token := OLD.token;
    NEW.template_id := OLD.template_id;
    NEW.user_id := OLD.user_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;