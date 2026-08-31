/**
 * Server-side-only client for the Quran Foundation Content API.
 *
 * See ../../../QURAN-CONTENT.md for the full auth model, licensing terms,
 * and the caching rule this file's callers must respect (re-sync at least
 * every 7 days — this client does not enforce that itself, the sync
 * schedule does, see ../../../ARCHITECTURE.md §4).
 *
 * NEVER import this from a client component or a "use client" file — the
 * client secret must not reach the browser (ARCHITECTURE.md §9).
 */

const HOSTS = {
  prelive: {
    auth: "https://prelive-oauth2.quran.foundation",
    api: "https://apis-prelive.quran.foundation",
  },
  production: {
    auth: "https://oauth2.quran.foundation",
    api: "https://apis.quran.foundation",
  },
} as const;

type QuranFoundationEnv = keyof typeof HOSTS;

function resolveEnv(): QuranFoundationEnv {
  const raw = process.env.QURAN_FOUNDATION_ENV?.trim().toLowerCase();
  if (raw === "production") return "production";
  // Every new Quran Foundation app starts in "pre-live" status (see
  // QURAN-CONTENT.md §2) — defaulting here means a fresh checkout with no
  // env var set talks to the right host without extra configuration.
  return "prelive";
}

/**
 * Two separate credential pairs can exist side by side — pre-live
 * (QURAN_FOUNDATION_CLIENT_ID/_SECRET) and production
 * (QURAN_FOUNDATION_PROD_CLIENT_ID/_SECRET, only after go-live approval,
 * QURAN-CONTENT.md §5) — QURAN_FOUNDATION_ENV picks which one is actually
 * used. This lets a project keep both around (e.g. to re-test against
 * pre-live's small sandbox later) without overwriting either.
 */
function requireCredentials(env: QuranFoundationEnv): { clientId: string; clientSecret: string } {
  const [idVar, secretVar] =
    env === "production"
      ? (["QURAN_FOUNDATION_PROD_CLIENT_ID", "QURAN_FOUNDATION_PROD_CLIENT_SECRET"] as const)
      : (["QURAN_FOUNDATION_CLIENT_ID", "QURAN_FOUNDATION_CLIENT_SECRET"] as const);

  const clientId = process.env[idVar];
  const clientSecret = process.env[secretVar];
  if (!clientId || !clientSecret) {
    throw new Error(
      `${idVar} / ${secretVar} are not set (QURAN_FOUNDATION_ENV=${env}). ` +
        "Register a project at https://dev-console.quran.foundation/projects and " +
        "set both in .env.local — see QURAN-CONTENT.md §5. This client cannot " +
        "fall back to a public/unauthenticated mode; the Content API requires " +
        "client-credentials auth for every request."
    );
  }
  return { clientId, clientSecret };
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Fetches (and caches in-process) an OAuth2 client-credentials access
 * token. Tokens are valid for 3600s and there is no refresh_token in this
 * flow (QURAN-CONTENT.md §2) — this re-requests a fresh one once the
 * cached one is within 60s of expiring, rather than waiting for a 401.
 */
async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) {
    return cachedToken.value;
  }

  const env = resolveEnv();
  const { clientId, clientSecret } = requireCredentials(env);
  const { auth } = HOSTS[env];
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(`${auth}/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=content",
  });

  if (!res.ok) {
    throw new Error(
      `Quran Foundation token request failed: ${res.status} ${res.statusText} — ${await res.text()}`
    );
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.value;
}

/**
 * GETs a Content API resource, e.g. `resource = "chapters"` or
 * `"verses/by_chapter/1"`. Handles token acquisition/caching and the
 * required x-auth-token / x-client-id headers.
 */
export async function fetchContent<T = unknown>(
  resource: string,
  searchParams?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  const env = resolveEnv();
  const { clientId } = requireCredentials(env);
  const token = await getAccessToken();
  const { api } = HOSTS[env];

  const url = new URL(`${api}/content/api/v4/${resource.replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const res = await fetch(url, {
    headers: {
      "x-auth-token": token,
      "x-client-id": clientId,
    },
  });

  if (!res.ok) {
    throw new Error(
      `Quran Foundation content request failed (${resource}): ${res.status} ${res.statusText} — ${await res.text()}`
    );
  }

  return res.json() as Promise<T>;
}
