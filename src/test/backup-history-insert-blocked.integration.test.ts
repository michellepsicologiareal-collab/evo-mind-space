/**
 * Integration test: an authenticated (or anon) client MUST NOT be able to
 * insert into `public.backup_history`.
 *
 * `backup_history` intentionally has NO RLS INSERT policy. Writes are only
 * allowed via the `run-scheduled-backups` edge function, which uses the
 * service-role key and therefore bypasses RLS.
 *
 * This test hits PostgREST directly with the public (anon) key — the same
 * surface every browser client uses. With no INSERT policy, PostgREST must
 * reject the request (401/403 or 42501 permission-denied / 42P17-style
 * error). A successful insert here would be a critical regression.
 *
 * We do NOT require a signed-in JWT: RLS blocks the write regardless of
 * whether the caller is `anon` or `authenticated`, because there is simply
 * no policy that grants INSERT. If one day someone adds an INSERT policy
 * for `authenticated`, this test will start passing under anon but the
 * companion static test (`backup-history-inserts.test.ts`) will fail on
 * the policy scan — the two together lock the behavior down.
 */

import { describe, it, expect } from "vitest";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || import.meta.env?.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;

const hasCreds = Boolean(SUPABASE_URL && SUPABASE_KEY);

describe("backup_history INSERT is blocked for non-service-role callers", () => {
  it.runIf(hasCreds)("PostgREST rejects an anon/authenticated insert", async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/backup_history`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY!,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        // Fabricated payload — must never reach the table.
        user_id: "00000000-0000-0000-0000-000000000000",
        backup_date: new Date().toISOString(),
        kind: "auto",
        status: "success",
      }),
    });

    // Must be rejected. Accept any non-2xx (401/403/42501-style).
    expect(res.ok).toBe(false);
    expect([401, 403, 404, 400]).toContain(res.status);

    // If the body parses, it should carry a permission/RLS error — never a row.
    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch { /* ignore */ }

    // A successful insert would echo back the inserted row as an array.
    // Guard against that shape explicitly.
    expect(bodyText).not.toMatch(/"backup_date"\s*:/);

    // Typical PostgREST rejection signatures for a missing INSERT policy /
    // missing GRANT: "permission denied", code 42501, or "new row violates
    // row-level security policy".
    if (bodyText) {
      expect(
        /permission denied|row-level security|42501|not allowed|Unauthorized/i.test(bodyText)
      ).toBe(true);
    }
  });

  it("has credentials configured for the integration check", () => {
    // Fails loudly in CI if the env is missing so the test above isn't silently skipped.
    expect(hasCreds).toBe(true);
  });
});
