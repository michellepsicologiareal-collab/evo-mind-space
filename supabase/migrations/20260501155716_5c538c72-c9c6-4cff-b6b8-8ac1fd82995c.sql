-- ═══ SESSIONS ═══
DROP POLICY "Users can view own sessions" ON public.sessions;
DROP POLICY "Users can create own sessions" ON public.sessions;
DROP POLICY "Users can update own sessions" ON public.sessions;
DROP POLICY "Users can delete own sessions" ON public.sessions;

CREATE POLICY "Users can view own sessions" ON public.sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own sessions" ON public.sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sessions" ON public.sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ═══ PATIENTS ═══
DROP POLICY "Users can view own patients" ON public.patients;
DROP POLICY "Users can create own patients" ON public.patients;
DROP POLICY "Users can update own patients" ON public.patients;
DROP POLICY "Users can delete own patients" ON public.patients;

CREATE POLICY "Users can view own patients" ON public.patients FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own patients" ON public.patients FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own patients" ON public.patients FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own patients" ON public.patients FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ═══ PATIENT_PROGRESS ═══
DROP POLICY "Users can view own progress" ON public.patient_progress;
DROP POLICY "Users can create own progress" ON public.patient_progress;
DROP POLICY "Users can update own progress" ON public.patient_progress;
DROP POLICY "Users can delete own progress" ON public.patient_progress;

CREATE POLICY "Users can view own progress" ON public.patient_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own progress" ON public.patient_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.patient_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own progress" ON public.patient_progress FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ═══ PROFILES ═══
DROP POLICY "Users can view own profile" ON public.profiles;
DROP POLICY "Users can insert own profile" ON public.profiles;
DROP POLICY "Users can update own profile" ON public.profiles;
DROP POLICY "Supervisors can view supervisees" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Supervisors can view supervisees" ON public.profiles FOR SELECT TO authenticated USING (supervisor_id = auth.uid());