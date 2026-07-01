-- 1) ENUMS
CREATE TYPE public.wellbeing_source     AS ENUM ('patient_self_report','professional_estimate');
CREATE TYPE public.attention_flag       AS ENUM ('not_assessed','none','watch','urgent');
CREATE TYPE public.progress_data_model  AS ENUM ('legacy_unclassified','v2_structured');

-- 2) COLUNAS ADITIVAS
ALTER TABLE public.patient_progress
  ADD COLUMN wellbeing_score        smallint,
  ADD COLUMN wellbeing_source       public.wellbeing_source,
  ADD COLUMN patient_context        text,
  ADD COLUMN clinical_observation   text,
  ADD COLUMN emotions               jsonb,
  ADD COLUMN attention_flag         public.attention_flag NOT NULL DEFAULT 'not_assessed',
  ADD COLUMN attention_set_by       uuid REFERENCES auth.users(id),
  ADD COLUMN attention_set_at       timestamptz,
  ADD COLUMN data_model             public.progress_data_model NOT NULL DEFAULT 'legacy_unclassified';

ALTER TABLE public.patient_progress
  ADD CONSTRAINT wellbeing_score_range
    CHECK (wellbeing_score IS NULL OR (wellbeing_score BETWEEN 0 AND 10)),
  ADD CONSTRAINT wellbeing_source_consistency
    CHECK ((wellbeing_score IS NULL) = (wellbeing_source IS NULL)),
  ADD CONSTRAINT attention_author_required
    CHECK (
      attention_flag = 'not_assessed'
      OR (attention_set_by IS NOT NULL AND attention_set_at IS NOT NULL)
    );

-- 3) BACKFILL MÍNIMO
UPDATE public.patient_progress
   SET data_model = 'legacy_unclassified',
       attention_flag = 'not_assessed'
 WHERE data_model IS DISTINCT FROM 'legacy_unclassified'
    OR attention_flag IS DISTINCT FROM 'not_assessed';

-- 4) TRIGGER de autoria da atenção
CREATE OR REPLACE FUNCTION public.enforce_attention_authorship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.attention_flag IS DISTINCT FROM 'not_assessed'
     AND (TG_OP = 'INSERT'
          OR NEW.attention_flag IS DISTINCT FROM OLD.attention_flag
          OR NEW.attention_set_by IS DISTINCT FROM COALESCE(OLD.attention_set_by, NEW.attention_set_by)) THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'attention_flag requer usuário autenticado';
    END IF;
    IF NEW.attention_set_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'attention_set_by deve ser igual ao usuário autenticado';
    END IF;
    IF NEW.attention_set_at IS NULL THEN
      NEW.attention_set_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_attention_authorship_trg
BEFORE INSERT OR UPDATE ON public.patient_progress
FOR EACH ROW EXECUTE FUNCTION public.enforce_attention_authorship();

-- 5) VERIFICAÇÃO FINAL
DO $$
DECLARE
  _total int;
  _mood_ok int;
  _note_ok int;
BEGIN
  SELECT count(*) INTO _total FROM public.patient_progress;
  IF _total <> 124 THEN
    RAISE EXCEPTION 'Contagem total mudou: esperado 124, obtido %', _total;
  END IF;

  SELECT count(*) INTO _mood_ok
    FROM public.patient_progress WHERE mood_score IS NOT NULL;
  IF _mood_ok <> 122 THEN
    RAISE EXCEPTION 'mood_score alterado: esperado 122, obtido %', _mood_ok;
  END IF;

  SELECT count(*) INTO _note_ok
    FROM public.patient_progress WHERE note IS NOT NULL AND note <> '';
  IF _note_ok <> 121 THEN
    RAISE EXCEPTION 'note alterada: esperado 121, obtido %', _note_ok;
  END IF;

  IF EXISTS (SELECT 1 FROM public.patient_progress
              WHERE data_model <> 'legacy_unclassified'
                 OR attention_flag <> 'not_assessed') THEN
    RAISE EXCEPTION 'Backfill inconsistente em linhas legadas';
  END IF;
END $$;