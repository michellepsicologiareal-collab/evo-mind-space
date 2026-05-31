import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

// Order matters: delete in reverse, insert in forward order (dependencies)
const TABLES_ORDER = [
  "patients",
  "services",
  "sessions",
  "patient_progress",
  "session_records",
  "session_evolutions",
  "tcc_records",
  "case_formulations",
  "notifications",
  "selfcare_checkins",
  "therapist_triggers",
  "contract_templates",
  "signed_contracts",
  "session_gcal_events",
  "supervisee_goals",
];

const DELETE_ORDER = [...TABLES_ORDER].reverse();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body || body.version !== 1 || !body.tables) {
    return new Response(JSON.stringify({ error: "Formato de backup inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Record<string, { deleted: number; inserted: number; error?: string }> = {};

  // 1. Delete existing data (reverse order to avoid FK issues)
  for (const table of DELETE_ORDER) {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: "exact" })
      .eq("user_id", user.id);
    results[table] = { deleted: count ?? 0, inserted: 0 };
    if (error) {
      results[table].error = `delete: ${error.message}`;
      console.error(`Delete ${table}:`, error.message);
    }
  }

  // 2. Insert backup data (forward order)
  for (const table of TABLES_ORDER) {
    const rows = body.tables[table];
    if (!rows || !Array.isArray(rows) || rows.length === 0) continue;

    // Always create new records: strip id and any auto/ownership fields
    const safeRows = rows.map((r: any) => {
      const { id, user_id, created_at, updated_at, ...rest } = r;
      return { ...rest, user_id: user.id };
    });

    // Insert in batches of 50
    for (let i = 0; i < safeRows.length; i += 50) {
      const batch = safeRows.slice(i, i + 50);
      const { error } = await supabase.from(table).insert(batch);
      if (error) {
        results[table] = {
          ...results[table],
          error: `insert: ${error.message}`,
        };
        console.error(`Insert ${table}:`, error.message);
      } else {
        results[table].inserted += batch.length;
      }
    }
  }

  // 3. Restore profile fields (except security fields)
  if (body.profile) {
    const { full_name, clinic_name, crp, phone, specialty, pix_key } = body.profile;
    await supabase
      .from("profiles")
      .update({ full_name, clinic_name, crp, phone, specialty, pix_key })
      .eq("id", user.id);
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
