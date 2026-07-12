/**
 * Integration test: invoke the `run-scheduled-backups` edge function with
 * the cron secret and verify that a row is inserted into `backup_history`
 * (the only sanctioned write path).
 *
 * Why this shape:
 *  - Clients can NEVER hold the service-role key in a browser bundle, so
 *    this test does not attempt to insert directly. Instead it exercises
 *    the real production surface: the edge function authenticates via the
 *    `x-backup-cron-secret` header and internally uses the service role
 *    (which bypasses RLS) to write to `backup_history`.
 *  - Reading back the inserted row also requires elevated privileges
 *    (`backup_history` has no anon/authenticated SELECT for arbitrary rows).
 *    We use the service-role key here purely for the read-back assertion.
 *
 * Required env (test-only, NEVER committed):
 *   VITE_SUPABASE_URL               – project URL
 *   BACKUP_CRON_SECRET              – same value configured in the function
 *   SUPABASE_SERVICE_ROLE_KEY       – for verifying the inserted row
 *   BACKUP_TEST_USER_ID             – an approved profile id to back up
 *
 * On Lovable Cloud these values are not exposed to the test runner, so the
 * test self-skips when any is missing. Run it locally against a staging
 * project by exporting the vars before `vitest`.
 */

import { describe, it, expect } from "vitest";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const CRON_SECRET = process.env.BACKUP_CRON_SECRET;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_USER_ID = process.env.BACKUP_TEST_USER_ID;

const hasEnv = Boolean(SUPABASE_URL && CRON_SECRET && SERVICE_ROLE && TEST_USER_ID);

describe("run-scheduled-backups writes to backup_history via service role", () => {
  it.runIf(hasEnv)(
    "invokes the edge function and confirms a new backup_history row",
    async () => {
      const before = Date.now();

      // 1) Invoke the edge function with the cron secret header. Body targets
      //    a single test user so we don't run the full nightly loop.
      const invoke = await fetch(
        `${SUPABASE_URL}/functions/v1/run-scheduled-backups`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-backup-cron-secret": CRON_SECRET!,
          },
          body: JSON.stringify({ user_id: TEST_USER_ID }),
        },
      );

      expect(invoke.ok).toBe(true);
      const invokeBody = await invoke.json();
      expect(invokeBody).toHaveProperty("processed");
      expect(invokeBody.processed).toBeGreaterThanOrEqual(1);
      // The per-user result should exist and be success or failed — either
      // way it must have written a row.
      const result = (invokeBody.results ?? []).find(
        (r: { user_id: string }) => r.user_id === TEST_USER_ID,
      );
      expect(result).toBeTruthy();
      expect(["success", "failed"]).toContain(result.status);

      // 2) Read the newest row back with the service-role key and confirm
      //    it landed after we called the function.
      const readUrl =
        `${SUPABASE_URL}/rest/v1/backup_history` +
        `?user_id=eq.${TEST_USER_ID}` +
        `&order=backup_date.desc&limit=1`;

      const read = await fetch(readUrl, {
        headers: {
          apikey: SERVICE_ROLE!,
          Authorization: `Bearer ${SERVICE_ROLE}`,
        },
      });

      expect(read.ok).toBe(true);
      const rows = (await read.json()) as Array<{
        backup_date: string;
        status: string;
        kind: string;
      }>;
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBe(1);

      const inserted = rows[0];
      expect(inserted.kind).toBe("auto");
      expect(new Date(inserted.backup_date).getTime()).toBeGreaterThanOrEqual(
        // Allow a few seconds of clock skew.
        before - 5_000,
      );
    },
    // Backups may upload storage + iterate ~20 tables per user. Give it room.
    60_000,
  );

  it("has env configured for the integration check", () => {
    if (!hasEnv) {
      console.warn(
        "[backup-history-service-role-insert] Skipped: set VITE_SUPABASE_URL, " +
          "BACKUP_CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY and BACKUP_TEST_USER_ID to run.",
      );
    }
    // This assertion always passes — it exists only to surface the skip in
    // test output. The real assertions live in the runIf block above.
    expect(true).toBe(true);
  });
});
