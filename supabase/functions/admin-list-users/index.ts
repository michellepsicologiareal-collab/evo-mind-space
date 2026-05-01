import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { users }, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;

    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, full_name, crp, profile_type, clinic_name, subscription_status, is_approved, supervisor_id, phone, specialty, created_at");

    const { data: patientCounts } = await adminClient
      .from("patients")
      .select("user_id");

    const { data: sessionCounts } = await adminClient
      .from("sessions")
      .select("user_id");

    // Count patients per user
    const patientMap = new Map<string, number>();
    (patientCounts ?? []).forEach((p: any) => {
      patientMap.set(p.user_id, (patientMap.get(p.user_id) ?? 0) + 1);
    });

    // Count sessions per user
    const sessionMap = new Map<string, number>();
    (sessionCounts ?? []).forEach((s: any) => {
      sessionMap.set(s.user_id, (sessionMap.get(s.user_id) ?? 0) + 1);
    });

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    // Build supervisor name map
    const supervisorNames = new Map<string, string>();
    (profiles ?? []).forEach((p: any) => {
      if (p.full_name) supervisorNames.set(p.id, p.full_name);
    });

    const result = users.map((u: any) => {
      const profile = profileMap.get(u.id);
      return {
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        full_name: profile?.full_name ?? null,
        crp: profile?.crp ?? null,
        profile_type: profile?.profile_type ?? null,
        clinic_name: profile?.clinic_name ?? null,
        subscription_status: profile?.subscription_status ?? "free",
        is_approved: profile?.is_approved ?? false,
        supervisor_id: profile?.supervisor_id ?? null,
        supervisor_name: profile?.supervisor_id ? (supervisorNames.get(profile.supervisor_id) ?? null) : null,
        phone: profile?.phone ?? null,
        specialty: profile?.specialty ?? null,
        patient_count: patientMap.get(u.id) ?? 0,
        session_count: sessionMap.get(u.id) ?? 0,
      };
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
