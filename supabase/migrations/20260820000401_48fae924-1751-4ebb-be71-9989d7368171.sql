CREATE POLICY "Supervisors can notify their supervisees"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (public.is_supervisor_of(user_id));