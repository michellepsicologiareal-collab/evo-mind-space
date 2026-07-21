
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role bypasses this check
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
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

  -- Also protect trial/subscription expiration timestamps if present
  IF TG_TABLE_NAME = 'profiles' THEN
    IF NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
      RAISE EXCEPTION 'Not allowed to modify trial_ends_at';
    END IF;
    IF NEW.subscription_ends_at IS DISTINCT FROM OLD.subscription_ends_at THEN
      RAISE EXCEPTION 'Not allowed to modify subscription_ends_at';
    END IF;
    IF NEW.rejected_at IS DISTINCT FROM OLD.rejected_at THEN
      RAISE EXCEPTION 'Not allowed to modify rejected_at';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_escalation();
