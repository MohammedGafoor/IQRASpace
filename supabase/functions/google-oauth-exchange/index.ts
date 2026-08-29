// Edge Function: google-oauth-exchange
//
// Exchanges a Google OAuth "Connect Drive" authorization code for tokens,
// then stores the refresh token AES-GCM-encrypted server-side
// (tutors.google_refresh_token_enc) — never returned to the browser
// (architecture §8, §16).
//
// Status: code-complete, NOT YET DEPLOYED. Activating this feature needs
// three secrets this session cannot provision (only the project owner can,
// via a Google Cloud OAuth client — see docs/PROGRESS.md's expanded-scope
// entry and the Materials page's "not configured" state):
//   supabase secrets set GOOGLE_CLIENT_ID=...
//   supabase secrets set GOOGLE_CLIENT_SECRET=...
//   supabase secrets set GOOGLE_REDIRECT_URI=https://<project>.functions.supabase.co/google-oauth-exchange
//   supabase secrets set GOOGLE_TOKEN_ENCRYPTION_KEY=<32 random bytes, base64>
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided automatically to
// every Edge Function by the platform.
//
// Flow: the Materials page redirects the tutor's browser straight to
// Google's consent screen (client-side — the client ID is not secret); on
// approval Google redirects here with `?code=...&state=<tutorId>`. This
// function verifies the tutor, exchanges the code, encrypts + stores the
// refresh token, then redirects back into the app.

import { createClient } from "jsr:@supabase/supabase-js@2";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

function missingSecret(name: string) {
  return new Response(`Google Drive integration is not configured (missing ${name}).`, { status: 501 });
}

async function encryptRefreshToken(refreshToken: string, base64Key: string): Promise<string> {
  const keyBytes = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(refreshToken)
  );
  // Store iv + ciphertext together, base64-encoded, so decryption (in
  // drive-file-proxy) only needs the same symmetric key.
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const tutorId = url.searchParams.get("state");
  const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:3000";

  if (!code || !tutorId) {
    return new Response("Missing code or state (tutor id).", { status: 400 });
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI");
  const encryptionKey = Deno.env.get("GOOGLE_TOKEN_ENCRYPTION_KEY");
  if (!clientId) return missingSecret("GOOGLE_CLIENT_ID");
  if (!clientSecret) return missingSecret("GOOGLE_CLIENT_SECRET");
  if (!redirectUri) return missingSecret("GOOGLE_REDIRECT_URI");
  if (!encryptionKey) return missingSecret("GOOGLE_TOKEN_ENCRYPTION_KEY");

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Confirm the state param really is a tutor row (cheap sanity check —
  // the real authorization boundary is that only the browser session that
  // initiated the redirect knows its own tutorId, and Google's redirect_uri
  // is registered to this function alone).
  const { data: tutor } = await supabaseAdmin.from("tutors").select("id").eq("id", tutorId).maybeSingle();
  if (!tutor) return new Response("Unknown tutor.", { status: 403 });

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    const detail = await tokenResponse.text();
    return new Response(`Google token exchange failed: ${detail}`, { status: 502 });
  }

  const tokens = (await tokenResponse.json()) as { refresh_token?: string; access_token?: string };
  if (!tokens.refresh_token) {
    // Google only returns a refresh_token on first consent — see architecture
    // §8's "token refresh caveat". If the tutor already granted access once
    // before, they need to revoke it at myaccount.google.com/permissions and
    // reconnect to get a fresh refresh_token.
    return new Response(
      "Google did not return a refresh token. If you've connected before, revoke access at " +
        "myaccount.google.com/permissions and try again.",
      { status: 409 }
    );
  }

  const encrypted = await encryptRefreshToken(tokens.refresh_token, encryptionKey);
  const { error } = await supabaseAdmin
    .from("tutors")
    .update({ google_refresh_token_enc: encrypted })
    .eq("id", tutorId);

  if (error) {
    return new Response(`Failed to store Drive connection: ${error.message}`, { status: 500 });
  }

  return Response.redirect(`${appUrl}/materials?driveConnected=1`, 302);
});
