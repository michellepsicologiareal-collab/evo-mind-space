-- Normalize legacy homework_tasks.actions into [{text: string, done: boolean}]
WITH normalized AS (
  SELECT
    h.id,
    COALESCE(
      (
        SELECT jsonb_agg(item)
        FROM (
          SELECT
            CASE
              WHEN jsonb_typeof(elem) = 'string' THEN
                jsonb_build_object('text', trim(both '"' from elem::text), 'done', false)
              WHEN jsonb_typeof(elem) = 'object' AND COALESCE(btrim(elem->>'text'), '') <> '' THEN
                jsonb_build_object(
                  'text', btrim(elem->>'text'),
                  'done', COALESCE((elem->>'done')::boolean, false)
                )
              ELSE NULL
            END AS item
          FROM jsonb_array_elements(h.actions) AS elem
        ) s
        WHERE item IS NOT NULL
      ),
      '[]'::jsonb
    ) AS new_actions
  FROM public.homework_tasks h
  WHERE h.actions IS NOT NULL
    AND jsonb_typeof(h.actions) = 'array'
)
UPDATE public.homework_tasks h
SET actions = CASE
  WHEN jsonb_array_length(n.new_actions) = 0 THEN NULL
  ELSE n.new_actions
END
FROM normalized n
WHERE h.id = n.id
  AND h.actions IS DISTINCT FROM (CASE WHEN jsonb_array_length(n.new_actions) = 0 THEN NULL ELSE n.new_actions END);

-- Zera linhas em que actions não é um array (formato totalmente inválido)
UPDATE public.homework_tasks
SET actions = NULL
WHERE actions IS NOT NULL
  AND jsonb_typeof(actions) <> 'array';