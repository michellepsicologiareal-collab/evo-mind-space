import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  // This is called as a redirect from Google, so it's a GET with query params
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // We'll redirect the user back to the app after processing
  const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://psireal.app";
  const redirectSuccess = `${appBaseUrl}/app/agenda?gcal=connected`;
  const redirectError = `${appBaseUrl}/app/agenda?gcal=error`;

  if (error || !code || !stateParam) {
    return Response.redirect(redirectError, 302);
  }

  try {
    // Decode state to get user_id
    const statePayload = JSON.parse(atob(stateParam));
    const userId = statePayload.uid;

    if (!userId) {
      return Response.redirect(redirectError, 302);
    }

    // Exchange code for tokens
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const GOOGLE_REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI")!;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Token exchange failed:", tokenData);
      return Response.redirect(redirectError, 302);
    }

    // Store tokens using service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const expiresAt = new Date(
      Date.now() + (tokenData.expires_in || 3600) * 1000
    ).toISOString();

    const { error: upsertError } = await supabase
      .from("google_calendar_tokens")
      .upsert(
        {
          user_id: userId,
          access_token: tokenData.access_token,
          refresh_token:
            tokenData.refresh_token || "",
          expires_at: expiresAt,
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("Failed to store tokens:", upsertError);
      return Response.redirect(redirectError, 302);
    }

    return Response.redirect(redirectSuccess, 302);
  } catch (err) {
    console.error("google-calendar-callback error:", err);
    return Response.redirect(redirectError, 302);
  }
});
