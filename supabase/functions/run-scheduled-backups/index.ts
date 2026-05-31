// Daily scheduled backup runner. Called by pg_cron via pg_net with header secret.
// Iterates over approved users, generates JSON snapshot + CSV ZIP, uploads to storage,
// writes backup_history row, and prunes files older than 7 days.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-backup-cron-secret",
};

const TABLES = [
  "patients",
  "sessions",
  "patient_progress",
  "session_records",
  "session_evolutions",
  "tcc_records",
  "case_formulations",
  "child_anamneses",
  "treatment_plans",
  "treatment_goals",
  "treatment_techniques",
  "treatment_revisions",
  "session_plans",
  "services",
  "contract_templates",
  "signed_contracts",
  "notifications",
  "selfcare_checkins",
  "therapist_triggers",
  "supervisee_goals",
];

const RETENTION_DAYS = 7;

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/"/g, '""');
  return `"${s}"`;
}

function toCsv(rows: Record<string, unknown>[], headers: { key: string; label: string }[]): string {
  const bom = "\uFEFF";
  const head = headers.map(h => csvEscape(h.label)).join(",");
  const body = rows.map(r => headers.map(h => csvEscape(r[h.key])).join(",")).join("\n");
  return bom + head + "\n" + body + "\n";
}

async function backupUser(
  admin: ReturnType<typeof createClient>,
  userId: string,
  userEmail: string,
  dateFolder: string,
): Promise<{ jsonPath: string; csvPath: string; size: number; tablesCount: number }> {
  const snapshot: Record<string, unknown[]> = {};
  let tablesCount = 0;

  for (const table of TABLES) {
    const { data, error } = await admin.from(table).select("*").eq("user_id", userId);
    if (error) {
      console.warn(`[${userId}] ${table}:`, error.message);
      snapshot[table] = [];
    } else {
      snapshot[table] = data ?? [];
      if ((data?.length ?? 0) > 0) tablesCount++;
    }
  }

  const { data: profile } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();

  const exportData = {
    version: 1,
    exported_at: new Date().toISOString(),
    user_id: userId,
    user_email: userEmail,
    profile,
    tables: snapshot,
  };

  const jsonStr = JSON.stringify(exportData, null, 2);
  const jsonBytes = new TextEncoder().encode(jsonStr);

  // Build CSVs
  const patients = (snapshot.patients ?? []) as Record<string, unknown>[];
  const patientMap = new Map(patients.map(p => [p.id as string, p.full_name as string]));
  const withPatient = (rows: Record<string, unknown>[]) =>
    rows.map(r => ({ ...r, _patient_name: patientMap.get(r.patient_id as string) ?? "—" }));

  const patientsCsv = toCsv(patients, [
    { key: "full_name", label: "Nome" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Telefone" },
    { key: "birth_date", label: "Nascimento" },
    { key: "is_active", label: "Ativo" },
    { key: "session_price", label: "Preço Sessão" },
    { key: "category", label: "Categoria" },
    { key: "chief_complaint", label: "Queixa Principal" },
    { key: "treatment_start_date", label: "Início Tratamento" },
    { key: "notes", label: "Notas" },
  ]);

  const sessionsCsv = toCsv(withPatient((snapshot.sessions ?? []) as Record<string, unknown>[]), [
    { key: "_patient_name", label: "Paciente" },
    { key: "scheduled_at", label: "Data" },
    { key: "status", label: "Status" },
    { key: "duration_minutes", label: "Duração (min)" },
    { key: "modality", label: "Modalidade" },
    { key: "price", label: "Preço" },
    { key: "payment_status", label: "Pagamento" },
    { key: "payment_method", label: "Método" },
    { key: "paid_at", label: "Pago Em" },
    { key: "notes", label: "Notas" },
  ]);

  const recordsCsv = toCsv(withPatient((snapshot.session_records ?? []) as Record<string, unknown>[]), [
    { key: "_patient_name", label: "Paciente" },
    { key: "session_date", label: "Data" },
    { key: "session_number", label: "Nº Sessão" },
    { key: "modality", label: "Modalidade" },
    { key: "chief_complaint", label: "Queixa" },
    { key: "clinical_observations", label: "Observações Clínicas" },
    { key: "themes", label: "Temas" },
    { key: "risk_indicator", label: "Risco" },
    { key: "engagement", label: "Engajamento" },
    { key: "next_session_plan", label: "Plano Próxima" },
  ]);

  const financeRows = ((snapshot.sessions ?? []) as Record<string, unknown>[])
    .filter(s => !s.is_expense)
    .map(s => ({ ...s, _patient_name: patientMap.get(s.patient_id as string) ?? "—" }));
  const financeCsv = toCsv(financeRows, [
    { key: "_patient_name", label: "Paciente" },
    { key: "scheduled_at", label: "Data" },
    { key: "price", label: "Valor" },
    { key: "payment_status", label: "Status Pagamento" },
    { key: "payment_method", label: "Método" },
    { key: "paid_at", label: "Pago Em" },
    { key: "payment_reference", label: "Referência" },
  ]);

  const zip = new JSZip();
  zip.file("pacientes.csv", patientsCsv);
  zip.file("sessoes.csv", sessionsCsv);
  zip.file("prontuarios.csv", recordsCsv);
  zip.file("financeiro.csv", financeCsv);
  const zipBytes = await zip.generateAsync({ type: "uint8array" });

  const jsonPath = `${userId}/${dateFolder}/backup.json`;
  const csvPath = `${userId}/${dateFolder}/exports.zip`;

  const upJson = await admin.storage.from("backups").upload(jsonPath, jsonBytes, {
    contentType: "application/json",
    upsert: true,
  });
  if (upJson.error) throw new Error(`upload json: ${upJson.error.message}`);

  const upZip = await admin.storage.from("backups").upload(csvPath, zipBytes, {
    contentType: "application/zip",
    upsert: true,
  });
  if (upZip.error) throw new Error(`upload zip: ${upZip.error.message}`);

  return {
    jsonPath,
    csvPath,
    size: jsonBytes.byteLength + zipBytes.byteLength,
    tablesCount,
  };
}

async function pruneOldBackups(admin: ReturnType<typeof createClient>, userId: string) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  // List user folders (date-named)
  const { data: folders } = await admin.storage.from("backups").list(userId, { limit: 1000 });
  if (!folders) return;

  for (const folder of folders) {
    // folder.name is YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(folder.name)) continue;
    if (new Date(folder.name) >= cutoff) continue;

    const prefix = `${userId}/${folder.name}`;
    const { data: files } = await admin.storage.from("backups").list(prefix, { limit: 100 });
    if (!files) continue;
    const paths = files.map(f => `${prefix}/${f.name}`);
    if (paths.length > 0) {
      await admin.storage.from("backups").remove(paths);
    }
  }

  // Also prune old history rows
  await admin
    .from("backup_history")
    .delete()
    .eq("user_id", userId)
    .lt("backup_date", cutoff.toISOString());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const provided = req.headers.get("x-backup-cron-secret");
  const expected = Deno.env.get("BACKUP_CRON_SECRET");
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Allow optional single-user run via body { user_id }
  let targetUserId: string | null = null;
  try {
    if (req.headers.get("content-length") && req.headers.get("content-length") !== "0") {
      const body = await req.json();
      targetUserId = body?.user_id ?? null;
    }
  } catch { /* ignore */ }

  const today = new Date().toISOString().slice(0, 10);

  // Fetch approved users (we need email too, via admin auth API)
  const { data: profiles, error: profErr } = await admin
    .from("profiles")
    .select("id")
    .eq("is_approved", true);
  if (profErr) {
    return new Response(JSON.stringify({ error: profErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const users = targetUserId
    ? (profiles ?? []).filter(p => p.id === targetUserId)
    : (profiles ?? []);

  const results: { user_id: string; status: string; error?: string }[] = [];

  for (const p of users) {
    try {
      const { data: u } = await admin.auth.admin.getUserById(p.id);
      const email = u?.user?.email ?? "";
      const out = await backupUser(admin, p.id, email, today);
      await admin.from("backup_history").insert({
        user_id: p.id,
        backup_date: new Date().toISOString(),
        kind: "auto",
        json_path: out.jsonPath,
        csv_zip_path: out.csvPath,
        size_bytes: out.size,
        tables_count: out.tablesCount,
        status: "success",
      });
      await pruneOldBackups(admin, p.id);
      results.push({ user_id: p.id, status: "success" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin.from("backup_history").insert({
        user_id: p.id,
        backup_date: new Date().toISOString(),
        kind: "auto",
        status: "failed",
        error_message: msg,
      });
      results.push({ user_id: p.id, status: "failed", error: msg });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
