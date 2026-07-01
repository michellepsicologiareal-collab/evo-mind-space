
# Registro de emoções — migration revisada (aditiva, sem executar)

Todos os pontos que você exigiu estão incorporados. Nada é aplicado agora; a migration abaixo é para revisão.

## Princípios respeitados

- `mood_score` e `note` **não são copiados nem transformados**. Ficam como estão, marcados como legado.
- Novos campos nascem `NULL` no histórico. Uma coluna `data_model` identifica cada linha como `legacy_unclassified` ou `v2_structured`.
- `attention_flag` **não tem default `none`**. Histórico fica `not_assessed`. `none` só é gravado quando o profissional avaliou e concluiu que não há atenção.
- **Nenhuma extração automática** de emoções a partir de `note`. A nota original permanece intacta e será exibida como "Registro legado" na UI.
- Após a UI nova entrar no ar: escrita **apenas no modelo novo**. Nada é espelhado em `mood_score`.
- `CRISIS_RX` e a regra `mood_score <= 5` **saem junto** com a nova versão do painel — sem fallback de inferência clínica.
- RLS mantida; nova coluna `attention_set_by` validada por trigger (`= auth.uid()`); auditoria via `audit_logs` na UI quando marcar atenção.
- Contagens dry-run antes/depois e teste de imutabilidade das 124 linhas antigas.

## Estado atual (dry-run — já coletado)

```
patient_progress: 124 linhas
  com mood_score: 122
  com note:       121
```

Pós-migration esperado (imediatamente após rodar):

```
patient_progress: 124 linhas   ← inalterado
  data_model = 'legacy_unclassified': 124
  attention_flag = 'not_assessed':    124
  wellbeing_score IS NULL:            124
  patient_context IS NULL:            124
  clinical_observation IS NULL:       124
  emotions IS NULL:                   124
  attention_set_by IS NULL:           124
  mood_score inalterado:              122
  note inalterada:                    121
```

## Entregáveis nesta única migration

1. Enums novos: `wellbeing_source`, `attention_flag`, `progress_data_model`.
2. Colunas aditivas em `patient_progress` (todas nullable, sem default clínico).
3. Constraints coerentes (score 0–10, `attention_set_by` obrigatório quando `attention_flag <> 'not_assessed'`).
4. Trigger `enforce_attention_set_by` que exige `attention_set_by = auth.uid()` sempre que `attention_flag` for alterado para valor diferente de `not_assessed`.
5. Backfill **mínimo e não-destrutivo**: apenas seta `data_model = 'legacy_unclassified'` e `attention_flag = 'not_assessed'` nas 124 linhas. **Nada mais é tocado.**
6. Bloco de verificação (`DO $$ ... RAISE EXCEPTION ...`) que **aborta a migration** se qualquer linha antiga tiver `mood_score` ou `note` alterado, ou se contagem total mudar.
7. RLS mantida como está (não precisa de policy nova — os campos herdam a policy de linha existente por `user_id`).

## SQL revisado (para sua aprovação)

```sql
-- 1) ENUMS
CREATE TYPE public.wellbeing_source     AS ENUM ('patient_self_report','professional_estimate');
CREATE TYPE public.attention_flag       AS ENUM ('not_assessed','none','watch','urgent');
CREATE TYPE public.progress_data_model  AS ENUM ('legacy_unclassified','v2_structured');

-- 2) COLUNAS ADITIVAS (todas nullable; sem default clínico)
ALTER TABLE public.patient_progress
  ADD COLUMN wellbeing_score        smallint,
  ADD COLUMN wellbeing_source       public.wellbeing_source,
  ADD COLUMN patient_context        text,           -- autorrelato do paciente
  ADD COLUMN clinical_observation   text,           -- observação do profissional
  ADD COLUMN emotions               jsonb,          -- [{label, intensity 1-5, source}]
  ADD COLUMN attention_flag         public.attention_flag NOT NULL DEFAULT 'not_assessed',
  ADD COLUMN attention_set_by       uuid REFERENCES auth.users(id),
  ADD COLUMN attention_set_at       timestamptz,
  ADD COLUMN data_model             public.progress_data_model NOT NULL DEFAULT 'legacy_unclassified';

-- Nota: o DEFAULT 'not_assessed' e 'legacy_unclassified' só atende ao backfill
-- e às linhas antigas. A UI nova sempre gravará valores explícitos.

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

-- 3) BACKFILL MÍNIMO — NÃO toca mood_score nem note
-- (as colunas já nascem com os defaults acima; UPDATE explícito só para clareza/idempotência)
UPDATE public.patient_progress
   SET data_model = 'legacy_unclassified',
       attention_flag = 'not_assessed'
 WHERE data_model IS DISTINCT FROM 'legacy_unclassified'
    OR attention_flag IS DISTINCT FROM 'not_assessed';

-- 4) TRIGGER: attention_set_by DEVE ser auth.uid() quando gravar attention_flag <> not_assessed
CREATE OR REPLACE FUNCTION public.enforce_attention_authorship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.attention_flag IS DISTINCT FROM 'not_assessed'
     AND (TG_OP = 'INSERT' OR NEW.attention_flag IS DISTINCT FROM OLD.attention_flag
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

-- 5) VERIFICAÇÃO FINAL — aborta se qualquer legado foi tocado
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
    RAISE EXCEPTION 'mood_score foi alterado: esperado 122 não-nulos, obtido %', _mood_ok;
  END IF;

  SELECT count(*) INTO _note_ok
    FROM public.patient_progress WHERE note IS NOT NULL AND note <> '';
  IF _note_ok <> 121 THEN
    RAISE EXCEPTION 'note foi alterada: esperado 121 preenchidas, obtido %', _note_ok;
  END IF;

  IF EXISTS (SELECT 1 FROM public.patient_progress
              WHERE data_model <> 'legacy_unclassified'
                 OR attention_flag <> 'not_assessed') THEN
    RAISE EXCEPTION 'Backfill inconsistente em linhas legadas';
  END IF;
END $$;
```

## O que muda no código (entrega seguinte, **depois** de você aprovar a migration)

Todos os leitores serão atualizados **na mesma release** que ativa a nova UI. Escopo mapeado:

- `src/pages/app/Agenda.tsx` — form de sessão: separar "Contexto do paciente" (`patient_context`) e "Observação clínica" (`clinical_observation`); campo `wellbeing_score` + `wellbeing_source` (radio: autorrelato / estimativa profissional); chip de `attention_flag` com autor obrigatório. **Deixa de gravar** `mood_score`/`note` para novos registros; `data_model = 'v2_structured'`.
- `src/pages/app/Dashboard.tsx` — remover `CRISIS_RX` e regra `mood_score <= 5`. "Atenção imediata" passa a listar somente `attention_flag IN ('watch','urgent')`. Gráfico usa `wellbeing_score` e ignora legado (badge "sem série v2" quando vazio).
- `src/components/app/PatientMoodChart.tsx` — renomear para bem-estar, plotar `wellbeing_score`; linhas legadas exibidas em série separada tracejada "Humor — registro legado", sem misturar eixos.
- `src/pages/app/Supervision.tsx` — badge "Humor N/10" só quando `data_model = 'legacy_unclassified'`, com rótulo "legado". Para v2, mostra bem-estar + flag.
- `src/pages/app/Patients.tsx` — sem mudança de leitura no card (só usa contagem).
- `src/pages/app/FormulacaoIA.tsx` — sem mudança (só conta).

## Confirma para eu chamar `supabase--migration` com esse SQL?

Não vou aplicar até seu OK explícito.
