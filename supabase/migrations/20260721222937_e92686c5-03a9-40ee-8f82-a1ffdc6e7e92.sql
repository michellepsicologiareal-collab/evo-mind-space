CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  -- service_role bypasses this check (checked via multiple sources for robustness)
  IF current_user = 'service_role' OR session_user = 'service_role' THEN
    RETURN NEW;
  END IF;

  BEGIN
    jwt_role := current_setting('request.jwt.claim.role', true);
  EXCEPTION WHEN OTHERS THEN
    jwt_role := NULL;
  END;
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  BEGIN
    jwt_role := (current_setting('request.jwt.claims', true)::jsonb ->> 'role');
  EXCEPTION WHEN OTHERS THEN
    jwt_role := NULL;
  END;
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Admins may modify sensitive fields
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    RAISE EXCEPTION 'Not allowed to modify subscription_status';
  END IF;
  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
    RAISE EXCEPTION 'Not allowed to modify is_approved';
  END IF;
  IF NEW.profile_type IS DISTINCT FROM OLD.profile_type THEN
    RAISE EXCEPTION 'Not allowed to modify profile_type';
  END IF;
  IF NEW.supervisor_id IS DISTINCT FROM OLD.supervisor_id THEN
    RAISE EXCEPTION 'Not allowed to modify supervisor_id';
  END IF;
  IF NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
    RAISE EXCEPTION 'Not allowed to modify trial_ends_at';
  END IF;
  IF NEW.subscription_ends_at IS DISTINCT FROM OLD.subscription_ends_at THEN
    RAISE EXCEPTION 'Not allowed to modify subscription_ends_at';
  END IF;
  IF NEW.rejected_at IS DISTINCT FROM OLD.rejected_at THEN
    RAISE EXCEPTION 'Not allowed to modify rejected_at';
  END IF;

  RETURN NEW;
END;
$$;