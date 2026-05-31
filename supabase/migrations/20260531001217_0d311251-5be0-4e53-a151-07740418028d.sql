-- 3. Library bucket: only premium-active users (or admins) can read premium files.
--    Free materials remain enforced at the library_materials table; storage now
--    matches the same rule so direct path access cannot bypass premium check.
DROP POLICY IF EXISTS "Authenticated users can read library files" ON storage.objects;

CREATE POLICY "Library files require premium or admin"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'library'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.subscription_status = 'active'::public.subscription_status
    )
  )
);

-- 4. signed_contracts: explicitly block direct inserts/updates from anon and
--    authenticated clients. The public-contract edge function uses service_role,
--    which bypasses RLS and continues to work.
CREATE POLICY "Block direct inserts on signed_contracts"
ON public.signed_contracts
AS RESTRICTIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "Block direct updates on signed_contracts"
ON public.signed_contracts
AS RESTRICTIVE
FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- 6. google_oauth_states: RLS is enabled but no policy existed. Add explicit
--    deny-all policies for anon and authenticated. Service role still bypasses RLS.
CREATE POLICY "Deny all select on google_oauth_states"
ON public.google_oauth_states
FOR SELECT
TO anon, authenticated
USING (false);

CREATE POLICY "Deny all insert on google_oauth_states"
ON public.google_oauth_states
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "Deny all update on google_oauth_states"
ON public.google_oauth_states
FOR UPDATE
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny all delete on google_oauth_states"
ON public.google_oauth_states
FOR DELETE
TO anon, authenticated
USING (false);