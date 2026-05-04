import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const TABLES = [
  "patients",
  "sessions",
  "patient_progress",
  "session_records",
  "session_evolutions",
  "tcc_records",
  "case_formulations",
  "notifications",
  "selfcare_checkins",
  "therapist_triggers",
  "services",
  "contract_templates",
  "signed_contracts",
  "session_gcal_events",
  "supervisee_goals",
];

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
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Verify user
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

  const backup: Record<string, unknown[]> = {};

  for (const table of TABLES) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("user_id", user.id);
    if (error) {
      console.error(`Error fetching ${table}:`, error.message);
      backup[table] = [];
    } else {
      backup[table] = data ?? [];
    }
  }

  // Also get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

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
