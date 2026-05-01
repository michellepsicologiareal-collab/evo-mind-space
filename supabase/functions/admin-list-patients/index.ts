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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles").select("role")
      .eq("user_id", user.id).eq("role", "admin").maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all patients
    const { data: patients, error: pErr } = await adminClient
      .from("patients")
      .select("id, user_id, full_name, email, phone, is_active, category, shared_with_supervisor, chief_complaint, created_at, session_price");
    if (pErr) throw pErr;

    // Get profiles for therapist names + supervisor mapping
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, full_name, profile_type, supervisor_id");

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    // Get last session per patient
    const { data: sessions } = await adminClient
      .from("sessions")
      .select("patient_id, scheduled_at, status")
      .order("scheduled_at", { ascending: false });

    // Build last session map (first occurrence = most recent)
    const lastSessionMap = new Map<string, { scheduled_at: string; status: string }>();
    const sessionCountMap = new Map<string, number>();
    (sessions ?? []).forEach((s: any) => {
      sessionCountMap.set(s.patient_id, (sessionCountMap.get(s.patient_id) ?? 0) + 1);
      if (!lastSessionMap.has(s.patient_id)) {
        lastSessionMap.set(s.patient_id, { scheduled_at: s.scheduled_at, status: s.status });
      }
    });

    // Get evolution counts per patient
    const { data: evolutions } = await adminClient
      .from("session_evolutions")
      .select("patient_id");

    const evolutionCountMap = new Map<string, number>();
    (evolutions ?? []).forEach((e: any) => {
      evolutionCountMap.set(e.patient_id, (evolutionCountMap.get(e.patient_id) ?? 0) + 1);
    });

    const result = (patients ?? []).map((p: any) => {
      const therapist = profileMap.get(p.user_id);
      const supervisorId = therapist?.supervisor_id;
      const supervisor = supervisorId ? profileMap.get(supervisorId) : null;
      const lastSession = lastSessionMap.get(p.id);

      return {
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        is_active: p.is_active,
        category: p.category,
        shared_with_supervisor: p.shared_with_supervisor,
        chief_complaint: p.chief_complaint,
        session_price: p.session_price,
        created_at: p.created_at,
        therapist_id: p.user_id,
        therapist_name: therapist?.full_name ?? "—",
        therapist_type: therapist?.profile_type ?? "standard",
        supervisor_id: supervisorId ?? null,
        supervisor_name: supervisor?.full_name ?? null,
        session_count: sessionCountMap.get(p.id) ?? 0,
        evolution_count: evolutionCountMap.get(p.id) ?? 0,
        last_session_at: lastSession?.scheduled_at ?? null,
        last_session_status: lastSession?.status ?? null,
      };
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
