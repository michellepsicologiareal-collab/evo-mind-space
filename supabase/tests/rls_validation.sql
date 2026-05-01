-- ═══════════════════════════════════════════════════════════════════
-- RLS VALIDATION QUERIES
-- Run each query to verify the security posture of clinical tables
-- ═══════════════════════════════════════════════════════════════════

-- TEST 1: All clinical tables have RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'patients','sessions','session_evolutions','case_formulations',
    'tcc_records','patient_progress','notifications','services','profiles'
  )
ORDER BY tablename;
-- EXPECTED: all rows show rowsecurity = true

-- TEST 2: Every clinical table has SELECT policy with auth.uid() check
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd = 'SELECT'
  AND tablename IN (
    'patients','sessions','session_evolutions','case_formulations',
    'tcc_records','patient_progress','notifications','services','profiles'
  )
ORDER BY tablename, policyname;
-- EXPECTED: each table has at least one policy with (auth.uid() = user_id) or (auth.uid() = id)

-- TEST 3: Every clinical table has INSERT policy with auth.uid() check
SELECT tablename, policyname, cmd, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd = 'INSERT'
  AND tablename IN (
    'patients','sessions','session_evolutions','case_formulations',
    'tcc_records','patient_progress','notifications','services','profiles'
  )
ORDER BY tablename;
-- EXPECTED: each table has WITH CHECK (auth.uid() = user_id)

-- TEST 4: Supervisor policies are SELECT-only
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND (policyname ILIKE '%supervisor%' OR qual ILIKE '%supervisor%' OR qual ILIKE '%can_supervisor%')
ORDER BY tablename, cmd;
-- EXPECTED: all supervisor policies are cmd = SELECT (never INSERT/UPDATE/DELETE)

-- TEST 5: No table has a permissive SELECT with qual = 'true' (except admin policies)
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd = 'SELECT'
  AND qual = 'true'
  AND policyname NOT ILIKE '%admin%';
-- EXPECTED: empty result (no open SELECT policies on clinical tables)

-- TEST 6: Security definer functions exist with correct search_path
SELECT proname, prosecdef, proconfig
FROM pg_proc
WHERE proname IN ('is_supervisor_of','can_supervisor_see_patient','has_role')
  AND pronamespace = 'public'::regnamespace;
-- EXPECTED: all have prosecdef = true, proconfig includes search_path=public
