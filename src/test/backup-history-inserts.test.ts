/**
 * Regression test: only the `run-scheduled-backups` edge function may INSERT
 * into `public.backup_history`.
 *
 * Background: `backup_history` intentionally has NO RLS INSERT policy. Writes
 * must go through the scheduled edge function using the service role client
 * (which bypasses RLS). Any client-side or user-JWT insert would silently
 * fail, and any other server-side insert would represent an undocumented
 * write path that must be reviewed.
 *
 * This is a static-analysis test that scans the repository for insert calls
 * targeting `backup_history` and asserts they only exist in the approved
 * edge function.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..", "..");
const ALLOWED_INSERT_FILE = "supabase/functions/run-scheduled-backups/index.ts";

// Directories to skip entirely.
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".git",
  ".lovable",
  ".workspace",
  ".agents",
  ".claude",
  ".github",
]);

// File extensions to scan.
const SCAN_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|sql)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (SCAN_EXT.test(entry)) out.push(full);
  }
  return out;
}

/** Match supabase-js `.from("backup_history").insert(` (any quotes, whitespace). */
const CLIENT_INSERT = /\.from\(\s*["'`]backup_history["'`]\s*\)[\s\S]{0,200}?\.insert\s*\(/;
/** Match raw SQL `INSERT INTO ... backup_history`. */
const SQL_INSERT = /insert\s+into\s+(?:public\.)?backup_history\b/i;

describe("backup_history INSERT surface", () => {
  const files = walk(ROOT);

  it("only run-scheduled-backups performs supabase-js inserts", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      // Skip this test file itself and the allowed edge function.
      if (rel === "src/test/backup-history-inserts.test.ts") continue;
      const src = readFileSync(file, "utf8");
      if (CLIENT_INSERT.test(src) && rel !== ALLOWED_INSERT_FILE) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no SQL migration or function inserts into backup_history", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      if (rel === "src/test/backup-history-inserts.test.ts") continue;
      if (!file.endsWith(".sql")) continue;
      const src = readFileSync(file, "utf8");
      if (SQL_INSERT.test(src)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it("run-scheduled-backups uses the service-role client for inserts", () => {
    const src = readFileSync(join(ROOT, ALLOWED_INSERT_FILE), "utf8");
    // Must contain the insert.
    expect(CLIENT_INSERT.test(src)).toBe(true);
    // Must construct an admin client with SERVICE_ROLE_KEY.
    expect(src).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    // The insert should be called on the `admin` client, not a user-JWT client.
    expect(src).toMatch(/admin\s*\.\s*from\(\s*["'`]backup_history["'`]\s*\)/);
  });

  it("backup_history table has no INSERT policy (writes bypass RLS via service role)", () => {
    // Scan every SQL migration for a CREATE POLICY ... ON public.backup_history ... FOR INSERT.
    const insertPolicy = /create\s+policy[\s\S]{0,300}?on\s+(?:public\.)?backup_history[\s\S]{0,200}?for\s+insert/i;
    const offenders: string[] = [];
    for (const file of files) {
      if (!file.endsWith(".sql")) continue;
      const src = readFileSync(file, "utf8");
      if (insertPolicy.test(src)) offenders.push(relative(ROOT, file));
    }
    expect(offenders).toEqual([]);
  });
});
