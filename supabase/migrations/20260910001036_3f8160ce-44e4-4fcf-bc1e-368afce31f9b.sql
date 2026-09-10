CREATE INDEX IF NOT EXISTS idx_session_records_user_date ON public.session_records (user_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_session_records_session ON public.session_records (session_id);
CREATE INDEX IF NOT EXISTS idx_session_plans_user_patient ON public.session_plans (user_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_tcc_records_user_filled_created ON public.tcc_records (user_id, filled_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rpd_invites_user_created ON public.rpd_invites (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_progress_user_recorded ON public.patient_progress (user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_type_scheduled ON public.sessions (user_id, session_type, scheduled_at DESC);