import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Não autenticado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Não autenticado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "json").toLowerCase();

  const backup: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select("*").eq("user_id", user.id);
    if (error) {
      console.error(`Error fetching ${table}:`, error.message);
      backup[table] = [];
    } else {
      backup[table] = data ?? [];
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (format === "csv") {
    const patients = (backup.patients ?? []) as Record<string, unknown>[];
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

    const sessionsCsv = toCsv(withPatient((backup.sessions ?? []) as Record<string, unknown>[]), [
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

    const recordsCsv = toCsv(withPatient((backup.session_records ?? []) as Record<string, unknown>[]), [
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

    const financeRows = ((backup.sessions ?? []) as Record<string, unknown>[])
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

    return new Response(zipBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="psireal_exports_${new Date().toISOString().slice(0, 10)}.zip"`,
      },
    });
  }

  const exportData = {
    version: 1,
    exported_at: new Date().toISOString(),
    user_id: user.id,
    user_email: user.email,
    profile,
    tables: backup,
  };

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="psireal_backup_${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});
