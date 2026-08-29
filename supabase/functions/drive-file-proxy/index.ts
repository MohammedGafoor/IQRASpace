// Edge Function: drive-file-proxy
// Status: NOT IMPLEMENTED — planned for Phase 2 (docs/architecture.md §8, §16).
//
// Purpose (per architecture §8, §16): stream a Google Drive file's bytes to an
// authenticated tutor/student using the tutor's stored refresh token, so raw Drive
// URLs are never exposed to the client and Drive-side permission changes take
// effect immediately. Must run server-side only (uses the encrypted refresh token).
//
// Deno.serve(async (req) => {
//   return new Response("not implemented", { status: 501 });
// });
