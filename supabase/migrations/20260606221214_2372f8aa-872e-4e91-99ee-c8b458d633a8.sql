CREATE POLICY "Block direct client inserts on audit_logs"
ON public.audit_logs
AS RESTRICTIVE
FOR INSERT
TO authenticated, anon
WITH CHECK (false);