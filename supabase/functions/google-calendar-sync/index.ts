import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function getValidAccessToken(
  supabase: any,
  userId: string
): Promise<string | null> {
  const { data: tokenRow } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!tokenRow) return null;

  // If token is still valid (with 5 min buffer)
  if (new Date(tokenRow.expires_at).getTime() > Date.now() + 5 * 60 * 1000) {
    return tokenRow.access_token;
  }

  // Refresh the token
  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: tokenRow.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    console.error("Token refresh failed:", data);
    return null;
  }

  const expiresAt = new Date(
    Date.now() + (data.expires_in || 3600) * 1000
  ).toISOString();

  await supabase
    .from("google_calendar_tokens")
    .update({
      access_token: data.access_token,
      expires_at: expiresAt,
      ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
    })
    .eq("user_id", userId);

  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const { action, session } = body;
    // action: "sync" | "delete" | "disconnect" | "status"

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Status check
    if (action === "status") {
      const { data } = await supabaseAdmin
        .from("google_calendar_tokens")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      return new Response(
        JSON.stringify({ connected: !!data }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Disconnect
    if (action === "disconnect") {
      await supabaseAdmin
        .from("google_calendar_tokens")
        .delete()
        .eq("user_id", userId);
      await supabaseAdmin
        .from("session_gcal_events")
        .delete()
        .eq("user_id", userId);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get valid access token
    const accessToken = await getValidAccessToken(supabaseAdmin, userId);
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Google Calendar não conectado ou token expirado. Reconecte." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const calendarId = "primary";
    const gcalBase = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;

    // Delete event
    if (action === "delete" && session?.id) {
      const { data: mapping } = await supabaseAdmin
        .from("session_gcal_events")
        .select("gcal_event_id")
        .eq("session_id", session.id)
        .maybeSingle();

      if (mapping) {
        await fetch(`${gcalBase}/${mapping.gcal_event_id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        await supabaseAdmin
          .from("session_gcal_events")
          .delete()
          .eq("session_id", session.id);
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sync (create or update) event
    if (action === "sync" && session) {
      const startTime = new Date(session.scheduled_at);
      const endTime = new Date(
        startTime.getTime() + (session.duration_minutes || 50) * 60 * 1000
      );

      const eventBody = {
        summary: `Sessão - ${session.patient_name || "Paciente"}`,
        description: session.notes || "",
        start: {
          dateTime: startTime.toISOString(),
          timeZone: "America/Sao_Paulo",
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: "America/Sao_Paulo",
        },
        reminders: {
          useDefault: false,
          overrides: [{ method: "popup", minutes: 30 }],
        },
      };

      // Check if event already exists
      const { data: existing } = await supabaseAdmin
        .from("session_gcal_events")
        .select("gcal_event_id")
        .eq("session_id", session.id)
        .maybeSingle();

      let gcalEventId: string;

      if (existing) {
        // Update
        const res = await fetch(
          `${gcalBase}/${existing.gcal_event_id}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(eventBody),
          }
        );
        const data = await res.json();
        if (!res.ok) {
          console.error("GCal update failed:", data);
          return new Response(
            JSON.stringify({ error: "Falha ao atualizar evento" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        gcalEventId = data.id;
      } else {
        // Create
        const res = await fetch(gcalBase, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventBody),
        });
        const data = await res.json();
        if (!res.ok) {
          console.error("GCal create failed:", data);
          return new Response(
            JSON.stringify({ error: "Falha ao criar evento" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        gcalEventId = data.id;

        await supabaseAdmin.from("session_gcal_events").insert({
          user_id: userId,
          session_id: session.id,
          gcal_event_id: gcalEventId,
        });
      }

      return new Response(JSON.stringify({ ok: true, gcalEventId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("google-calendar-sync error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
