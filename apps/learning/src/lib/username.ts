// Username-based auth (0019_username_auth.sql). Supabase Auth (GoTrue) still
// needs an email-shaped identifier per account — there's no username-native
// grant type — so an account created with no real email gets a synthetic
// one built from its username instead. This is purely a technical identifier
// for Supabase Auth (`public.users.auth_email`); it's never shown in the UI
// and the real, optional contact email lives in `public.users.email`.
export const SYNTHETIC_EMAIL_DOMAIN = "users.iqraspace.internal";

export function buildAuthEmail(username: string, contactEmail?: string | null): string {
  const trimmed = contactEmail?.trim();
  if (trimmed) return trimmed;
  return `${username}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

/** Friendlier message for the one error users are likely to hit repeatedly. */
export function friendlyAuthError(message: string): string {
  if (message.includes("users_username_key")) return "That username is already taken.";
  return message;
}
