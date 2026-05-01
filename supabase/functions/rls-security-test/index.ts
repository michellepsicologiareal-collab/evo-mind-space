import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const admin = createClient(supabaseUrl, serviceKey);
  const anon = createClient(supabaseUrl, anonKey);

  const results: { test: string; pass: boolean; detail: string }[] = [];
  const fakeUserId = "00000000-0000-0000-0000-000000000000";

  // --- Get real user for test data ---
  const { data: realUsers } = await admin.from("profiles").select("id").limit(1);
  const realUserId = realUsers?.[0]?.id;

  if (!realUserId) {
    return new Response(JSON.stringify({ error: "No users found" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- TEST 1: Anon client cannot read notifications ---
  {
    const { data, error } = await anon
      .from("notifications")
      .select("*")
      .limit(5);
    const pass = (data?.length ?? 0) === 0;
    results.push({
      test: "Anon client cannot read notifications",
      pass,
      detail: pass
        ? "Returned 0 rows as expected"
        : `Returned ${data?.length} rows — RLS BYPASS DETECTED`,
    });
  }

  // --- TEST 2: Anon client cannot insert notification ---
  {
    const { error } = await anon.from("notifications").insert({
      user_id: realUserId,
      title: "HACK",
      message: "injected",
      type: "general",
    });
    const pass = !!error;
    results.push({
      test: "Anon client cannot insert notifications",
      pass,
      detail: pass ? `Blocked: ${error?.code}` : "INSERT succeeded — RLS BYPASS DETECTED",
    });
  }

  // --- TEST 3: Insert test notification as admin, then try to read with anon ---
  {
    const { data: inserted } = await admin.from("notifications").insert({
      user_id: realUserId,
      title: "RLS Test",
      message: "Should not be visible to anon",
      type: "general",
    }).select("id").single();

    const { data: anonRead } = await anon
      .from("notifications")
      .select("*")
      .eq("id", inserted?.id ?? "");
    const pass = (anonRead?.length ?? 0) === 0;
    results.push({
      test: "Anon cannot read notification inserted by admin for real user",
      pass,
      detail: pass
        ? "Notification invisible to anon"
        : "Anon read the notification — RLS BYPASS DETECTED",
    });

    // Cleanup
    if (inserted?.id) {
      await admin.from("notifications").delete().eq("id", inserted.id);
    }
  }

  // --- TEST 4: Realtime channel subscription with wrong user_id filter returns no data ---
  {
    // We can't fully test realtime subscriptions in an edge function,
    // but we verify the RLS query that backs postgres_changes
    const { data, error } = await anon
      .from("notifications")
      .select("id")
      .eq("user_id", realUserId)
      .limit(1);
    const pass = (data?.length ?? 0) === 0;
    results.push({
      test: "Anon query with real user_id filter returns nothing (simulates Realtime RLS)",
      pass,
      detail: pass
        ? "RLS blocked the query — Realtime would also block"
        : `Returned ${data?.length} rows — Realtime RLS may be bypassable`,
    });
  }

  // --- TEST 5: Cannot insert notification with fake user_id ---
  {
    const { error } = await anon.from("notifications").insert({
      user_id: fakeUserId,
      title: "SPOOF",
      message: "spoofed user_id",
      type: "general",
    });
    const pass = !!error;
    results.push({
      test: "Cannot insert notification with spoofed user_id",
      pass,
      detail: pass ? `Blocked: ${error?.code}` : "INSERT with fake user_id succeeded — CRITICAL",
    });
  }

  const allPassed = results.every((r) => r.pass);

  return new Response(
    JSON.stringify({ all_passed: allPassed, tests: results }, null, 2),
    {
      status: allPassed ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    }
  );
});
