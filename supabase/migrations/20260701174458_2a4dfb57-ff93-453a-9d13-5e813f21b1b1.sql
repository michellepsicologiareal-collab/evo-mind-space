
-- Endurecer RLS: garantir que o paciente pertence ao mesmo profissional
DROP POLICY IF EXISTS "Owner insert anamnesis invites" ON public.anamnesis_invites;
DROP POLICY IF EXISTS "Owner update anamnesis invites" ON public.anamnesis_invites;

CREATE POLICY "Owner insert anamnesis invites"
ON public.anamnesis_invites
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = anamnesis_invites.patient_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Owner update anamnesis invites"
ON public.anamnesis_invites
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = anamnesis_invites.patient_id
      AND p.user_id = auth.uid()
  )
);

-- Limpeza de dados E2E (4 convites e2ea* e a anamnese vinculada)
DELETE FROM public.child_anamneses
WHERE invite_id IN (
  'e2ea0001-0000-0000-0000-000000000001',
  'e2ea0002-0000-0000-0000-000000000002',
  'e2ea0003-0000-0000-0000-000000000003',
  'e2ea0004-0000-0000-0000-000000000004'
);

DELETE FROM public.anamnesis_invites
WHERE id IN (
  'e2ea0001-0000-0000-0000-000000000001',
  'e2ea0002-0000-0000-0000-000000000002',
  'e2ea0003-0000-0000-0000-000000000003',
  'e2ea0004-0000-0000-0000-000000000004'
);
