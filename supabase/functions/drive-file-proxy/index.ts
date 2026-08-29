// Edge Function: drive-file-proxy
//
// Streams a Google Drive file's bytes to an authenticated tutor using the
// tutor's stored (encrypted) refresh token, so raw Drive URLs/tokens never
// reach the browser and a Drive-side permission revocation takes effect
// immediately (architecture §8, §16).
//
// Status: code-complete, NOT YET DEPLOYED — same secrets prerequisite as
// google-oauth-exchange (see that function's header comment). Until a tutor
// has actually connected Drive (google-oauth-exchange has run successfully),
// this will always 404 "Drive not connected" for them, which is the correct,
// honest behavior rather than a fake success.
//
// Called as: GET /drive-file-proxy?fileId=<driveFileId>
// Authorization: Bearer <supabase access token> (the signed-in tutor's session)

import { createClient } from "jsr:@supabase/supabase-js@2";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

async function decryptRefreshToken(encoded: string, base64Key: string): Promise<string> {
  const keyBytes = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const combined = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const fileId = url.searchParams.get("fileId");
  if (!fileId) return new Response("Missing fileId.", { status: 400 });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return new Response("Missing Authorization header.", { status: 401 });
  const accessToken = authHeader.slice("Bearer ".length);

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const encryptionKey = Deno.env.get("GOOGLE_TOKEN_ENCRYPTION_KEY");
  if (!clientId || !clientSecret || !encryptionKey) {
    return new Response("Google Drive integration is not configured.", { status: 501 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Identify the caller from their own session token (never trust a client-
  // supplied user id), then confirm they're a tutor with a connected Drive.
  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !user) return new Response("Invalid session.", { status: 401 });

  const { data: tutor } = await supabaseAdmin
    .from("tutors")
    .select("google_refresh_token_enc")
    .eq("id", user.id)
    .maybeSingle();
  if (!tutor?.google_refresh_token_enc) {
    return new Response("Drive not connected for this tutor.", { status: 404 });
  }

  const refreshToken = await decryptRefreshToken(tutor.google_refresh_token_enc, encryptionKey);

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!tokenResponse.ok) {
    return new Response("Could not refresh Google access token — reconnect Drive.", { status: 502 });
  }
  const { access_token: driveAccessToken } = (await tokenResponse.json()) as { access_token: string };

  const driveResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { Authorization: `Bearer ${driveAccessToken}` } }
  );
  if (!driveResponse.ok || !driveResponse.body) {
    return new Response("Could not fetch file from Google Drive.", { status: 502 });
  }

  return new Response(driveResponse.body, {
    headers: {
      "Content-Type": driveResponse.headers.get("Content-Type") ?? "application/octet-stream",
    },
  });
});
