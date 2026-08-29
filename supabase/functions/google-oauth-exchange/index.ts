// Edge Function: google-oauth-exchange
// Status: NOT IMPLEMENTED — planned for Phase 2 (docs/architecture.md §8, §17).
//
// Purpose (per architecture §8): exchange a Google OAuth "Connect Drive" auth code
// for access + refresh tokens, then store the refresh token encrypted server-side
// (tutors.google_refresh_token_enc). Must never return the refresh token to the browser.
//
// Deno.serve(async (req) => {
//   return new Response("not implemented", { status: 501 });
// });
