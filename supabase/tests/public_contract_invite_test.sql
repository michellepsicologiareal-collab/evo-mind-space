-- ============================================================
-- Test suite for public-contract single-use invite token flow.
-- Runs directly against the database. Verifies:
--   1. Valid GET on active token
--   2. GET on unknown token → empty
--   3. GET on expired token → status='expired'
--   4. GET on revoked token → status='revoked'
--   5. GET on used token → status='used'
--   6. Successful POST (submit) marks used_at + creates signed row
--   7. Reuse of same token fails with invite_already_used
--   8. Expired token submission fails with invite_expired
--   9. Revoked token submission fails with invite_revoked
--  10. Cross-user isolation: RLS blocks reading other user's invite via anon/authenticated
--  11. Client cannot bypass used_at via direct UPDATE
-- ============================================================
BEGIN;

-- Uses existing users and the existing template of USER_A (rollback safe).
-- USER_A: 26897e6b-6a01-444b-8461-93316e06ce8c
-- USER_B: c0d9dc49-6f6e-4da0-adf8-1e8d1f658a27
-- TEMPLATE_A: 213b813a-f631-4868-8447-a4632f17f20d
--
-- Test injects three invites for USER_A/TEMPLATE_A: active, expired, revoked.

INSERT INTO public.contract_invites (id, user_id, template_id, token, expires_at, revoked_at)
VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccc01', '26897e6b-6a01-444b-8461-93316e06ce8c',
   '213b813a-f631-4868-8447-a4632f17f20d',
   'dddddddd-dddd-dddd-dddd-dddddddddd01', now() + interval '30 days', NULL),
  ('cccccccc-cccc-cccc-cccc-cccccccccc02', '26897e6b-6a01-444b-8461-93316e06ce8c',
   '213b813a-f631-4868-8447-a4632f17f20d',
   'dddddddd-dddd-dddd-dddd-dddddddddd02', now() - interval '1 day', NULL),
  ('cccccccc-cccc-cccc-cccc-cccccccccc03', '26897e6b-6a01-444b-8461-93316e06ce8c',
   '213b813a-f631-4868-8447-a4632f17f20d',
   'dddddddd-dddd-dddd-dddd-dddddddddd03', now() + interval '30 days', now());

-- ─── TEST 1: GET active token returns row ──────────────────
DO $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM public.get_contract_by_invite_token('dddddddd-dddd-dddd-dddd-dddddddddd01');
  IF r.status <> 'active' THEN RAISE EXCEPTION 'TEST 1 FAIL: expected active, got %', r.status; END IF;
  IF r.professional_name IS NULL THEN RAISE EXCEPTION 'TEST 1 FAIL: wrong template'; END IF;
  RAISE NOTICE 'TEST 1 PASS: active token returns template';
END $$;

-- ─── TEST 2: GET unknown token returns nothing ─────────────
DO $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM public.get_contract_by_invite_token('00000000-0000-0000-0000-000000000000');
  IF cnt <> 0 THEN RAISE EXCEPTION 'TEST 2 FAIL: expected 0 rows, got %', cnt; END IF;
  RAISE NOTICE 'TEST 2 PASS: unknown token returns empty';
END $$;

-- ─── TEST 3: GET expired token flagged ─────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM public.get_contract_by_invite_token('dddddddd-dddd-dddd-dddd-dddddddddd02');
  IF r.status <> 'expired' THEN RAISE EXCEPTION 'TEST 3 FAIL: expected expired, got %', r.status; END IF;
  RAISE NOTICE 'TEST 3 PASS: expired token flagged';
END $$;

-- ─── TEST 4: GET revoked token flagged ─────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM public.get_contract_by_invite_token('dddddddd-dddd-dddd-dddd-dddddddddd03');
  IF r.status <> 'revoked' THEN RAISE EXCEPTION 'TEST 4 FAIL: expected revoked, got %', r.status; END IF;
  RAISE NOTICE 'TEST 4 PASS: revoked token flagged';
END $$;

-- ─── TEST 6: Successful submit marks used_at + creates signed row ──
DO $$
DECLARE _sid uuid;
DECLARE _inv RECORD;
BEGIN
  _sid := public.submit_signed_contract(
    'dddddddd-dddd-dddd-dddd-dddddddddd01',
    jsonb_build_object(
      'patient_name','Paciente Teste',
      'patient_cpf','123',
      'accepted_lgpd', true,
      'clause_responses', jsonb_build_object('C1','Aceito')
    ),
    '1.2.3.4', 'test-agent/1.0'
  );
  IF _sid IS NULL THEN RAISE EXCEPTION 'TEST 6 FAIL: no signed_contract_id'; END IF;
  SELECT * INTO _inv FROM public.contract_invites WHERE token = 'dddddddd-dddd-dddd-dddd-dddddddddd01';
  IF _inv.used_at IS NULL THEN RAISE EXCEPTION 'TEST 6 FAIL: used_at not set'; END IF;
  IF _inv.signed_contract_id IS DISTINCT FROM _sid THEN RAISE EXCEPTION 'TEST 6 FAIL: signed_contract_id mismatch'; END IF;

  -- Verify signed_contracts row content
  PERFORM 1 FROM public.signed_contracts
    WHERE id = _sid AND user_id = '26897e6b-6a01-444b-8461-93316e06ce8c'
      AND patient_name = 'Paciente Teste' AND ip_address = '1.2.3.4' AND user_agent = 'test-agent/1.0';
  IF NOT FOUND THEN RAISE EXCEPTION 'TEST 6 FAIL: signed row not persisted correctly'; END IF;
  RAISE NOTICE 'TEST 6 PASS: submit succeeded and invite marked used';
END $$;

-- ─── TEST 5: GET on now-used token flagged ─────────────────
DO $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM public.get_contract_by_invite_token('dddddddd-dddd-dddd-dddd-dddddddddd01');
  IF r.status <> 'used' THEN RAISE EXCEPTION 'TEST 5 FAIL: expected used, got %', r.status; END IF;
  RAISE NOTICE 'TEST 5 PASS: used token flagged';
END $$;

-- ─── TEST 7: Reuse fails ───────────────────────────────────
DO $$
DECLARE _err text;
BEGIN
  BEGIN
    PERFORM public.submit_signed_contract(
      'dddddddd-dddd-dddd-dddd-dddddddddd01',
      jsonb_build_object('patient_name','X','patient_cpf','1','accepted_lgpd',true),
      '', ''
    );
    RAISE EXCEPTION 'TEST 7 FAIL: expected reuse to raise';
  EXCEPTION WHEN OTHERS THEN
    _err := SQLERRM;
    IF _err NOT LIKE '%invite_already_used%' THEN
      RAISE EXCEPTION 'TEST 7 FAIL: wrong error: %', _err;
    END IF;
    RAISE NOTICE 'TEST 7 PASS: reuse rejected with invite_already_used';
  END;
END $$;

-- ─── TEST 8: Expired token submission fails ────────────────
DO $$
DECLARE _err text;
BEGIN
  BEGIN
    PERFORM public.submit_signed_contract(
      'dddddddd-dddd-dddd-dddd-dddddddddd02',
      jsonb_build_object('patient_name','X','patient_cpf','1','accepted_lgpd',true),
      '', ''
    );
    RAISE EXCEPTION 'TEST 8 FAIL: expected expired to raise';
  EXCEPTION WHEN OTHERS THEN
    _err := SQLERRM;
    IF _err NOT LIKE '%invite_expired%' THEN
      RAISE EXCEPTION 'TEST 8 FAIL: wrong error: %', _err;
    END IF;
    RAISE NOTICE 'TEST 8 PASS: expired token rejected';
  END;
END $$;

-- ─── TEST 9: Revoked token submission fails ────────────────
DO $$
DECLARE _err text;
BEGIN
  BEGIN
    PERFORM public.submit_signed_contract(
      'dddddddd-dddd-dddd-dddd-dddddddddd03',
      jsonb_build_object('patient_name','X','patient_cpf','1','accepted_lgpd',true),
      '', ''
    );
    RAISE EXCEPTION 'TEST 9 FAIL: expected revoked to raise';
  EXCEPTION WHEN OTHERS THEN
    _err := SQLERRM;
    IF _err NOT LIKE '%invite_revoked%' THEN
      RAISE EXCEPTION 'TEST 9 FAIL: wrong error: %', _err;
    END IF;
    RAISE NOTICE 'TEST 9 PASS: revoked token rejected';
  END;
END $$;

-- ─── TEST 10: Cross-user RLS blocks direct SELECT ──────────
-- User B (id 22...) should NOT see User A's invite via authenticated role
DO $$
DECLARE cnt int;
BEGIN
  SET LOCAL role = authenticated;
  SET LOCAL "request.jwt.claim.sub" = 'c0d9dc49-6f6e-4da0-adf8-1e8d1f658a27';
  SET LOCAL "request.jwt.claims" = '{"sub":"c0d9dc49-6f6e-4da0-adf8-1e8d1f658a27","role":"authenticated"}';
  SELECT count(*) INTO cnt FROM public.contract_invites
    WHERE user_id = '26897e6b-6a01-444b-8461-93316e06ce8c';
  RESET role;
  IF cnt <> 0 THEN RAISE EXCEPTION 'TEST 10 FAIL: user B saw % of user A''s invites', cnt; END IF;
  RAISE NOTICE 'TEST 10 PASS: RLS blocks cross-user SELECT on contract_invites';
END $$;

-- ─── TEST 11: Authenticated cannot forge used_at ───────────
DO $$
DECLARE _err text; _still_null boolean;
BEGIN
  BEGIN
    SET LOCAL role = authenticated;
    SET LOCAL "request.jwt.claim.sub" = '26897e6b-6a01-444b-8461-93316e06ce8c';
    SET LOCAL "request.jwt.claims" = '{"sub":"26897e6b-6a01-444b-8461-93316e06ce8c","role":"authenticated"}';
    -- Owner tries to fake used_at on their still-active third invite (create fresh)
    INSERT INTO public.contract_invites (id, user_id, template_id, token, expires_at)
    VALUES ('cccccccc-cccc-cccc-cccc-cccccccccc04', '26897e6b-6a01-444b-8461-93316e06ce8c',
            '213b813a-f631-4868-8447-a4632f17f20d',
            'dddddddd-dddd-dddd-dddd-dddddddddd04', now() + interval '30 days');
    UPDATE public.contract_invites
      SET used_at = now(), signed_contract_id = gen_random_uuid()
      WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccc04';
    RESET role;
    SELECT used_at IS NULL INTO _still_null FROM public.contract_invites
      WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccc04';
    IF NOT _still_null THEN RAISE EXCEPTION 'TEST 11 FAIL: authenticated forged used_at'; END IF;
    RAISE NOTICE 'TEST 11 PASS: authenticated cannot mutate used_at/signed_contract_id';
  EXCEPTION WHEN OTHERS THEN
    RESET role;
    RAISE;
  END;
END $$;

ROLLBACK;
