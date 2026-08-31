/**
 * Builds the real Google OAuth consent URL for "Connect Google Drive"
 * (architecture §8). A client ID is not secret — safe to expose via
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID — only the client *secret* (used exclusively
 * server-side, in the google-oauth-exchange Edge Function) must never reach
 * the browser. `drive.file` is the least-privileged scope that still lets a
 * tutor pick any file via the Google Picker (§8's scope rationale).
 */
export function buildGoogleDriveConsentUrl(tutorId: string): string {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI;
  const params = new URLSearchParams({
    client_id: clientId ?? "",
    redirect_uri: redirectUri ?? "",
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "https://www.googleapis.com/auth/drive.file",
    state: tutorId,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
