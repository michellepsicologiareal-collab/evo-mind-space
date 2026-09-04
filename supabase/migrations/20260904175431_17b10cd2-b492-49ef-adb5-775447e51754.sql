CREATE OR REPLACE FUNCTION public.notify_patient_rpd_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF NEW.filled_by IS DISTINCT FROM 'patient' THEN
    RETURN NEW;
  END IF;
  SELECT full_name INTO v_name FROM public.patients WHERE id = NEW.patient_id;
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    NEW.user_id,
    'Novo RPD do paciente',
    COALESCE(v_name, 'Seu paciente') || ' preencheu um novo Registro de Pensamentos (RPD). Abra a Agenda e toque em "Ver RPD" no card do paciente para ler.',
    'general'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_patient_rpd ON public.tcc_records;
CREATE TRIGGER trg_notify_patient_rpd
AFTER INSERT ON public.tcc_records
FOR EACH ROW
EXECUTE FUNCTION public.notify_patient_rpd_submission();