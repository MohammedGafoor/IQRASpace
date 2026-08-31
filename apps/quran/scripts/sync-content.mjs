#!/usr/bin/env node
/**
 * Full Quran content sync: chapters (all 114) + verses (Uthmani text +
 * one translation) for every Surah, from the Quran Foundation Content
 * API. This is what Phase 1's Surah list and reader pages read from
 * (ARCHITECTURE.md §4) — plain generated JSON, not a live API call per
 * request.
 *
 * Deliberately plain Node ESM, not a TypeScript import from
 * src/lib/quran-api/client.ts — see that file's own header for why, and
 * apps/web/scripts/*.mjs for the same repo-wide pattern.
 *
 * Usage: npm run sync:content   (reads .env.local via --env-file)
 * Requires QURAN_FOUNDATION_CLIENT_ID / _SECRET — see .env.local.example
 * and QURAN-CONTENT.md §5.
 *
 * Rate-limit posture (QURAN-CONTENT.md §3): the actual numeric limit is
 * still unpublished/unconfirmed, so this paces requests deliberately
 * (REQUEST_DELAY_MS between calls) and retries 429/5xx with backoff,
 * rather than firing ~150 requests as fast as possible.
 *
 * Re-run at least every 7 days once this is the real production sync job
 * — that's a license requirement (QURAN-CONTENT.md §3), not a suggestion.
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "src", "content", "generated");
const SURAH_DIR = path.join(OUT_DIR, "surah");

const HOSTS = {
  prelive: {
    auth: "https://prelive-oauth2.quran.foundation",
    api: "https://apis-prelive.quran.foundation",
  },
  production: {
    auth: "https://oauth2.quran.foundation",
    api: "https://apis.quran.foundation",
  },
};

// Confirmed present in BOTH pre-live (14-translation sandbox) and
// production (144 translations) by querying GET /resources/translations
// directly against each (QURAN-CONTENT.md §4a/§4b) — not a guess in
// either environment. Production also has Saheeh International (id 20),
// Pickthall (19), Yusuf Ali (22), and others if this default is ever
// reconsidered — see QURAN-CONTENT.md §4b for the full list found.
const TRANSLATION_RESOURCE_ID = 85; // M.A.S. Abdel Haleem
const PER_PAGE = 50; // API maximum (verses-by-chapter query params)
const REQUEST_DELAY_MS = 250;
const MAX_RETRIES = 3;

function resolveEnv() {
  const raw = (process.env.QURAN_FOUNDATION_ENV ?? "").trim().toLowerCase();
  return raw === "production" ? "production" : "prelive";
}

// Two credential pairs can coexist (pre-live + production, see
// .env.local.example) — QURAN_FOUNDATION_ENV picks which is actually used.
function requireCredentials(env) {
  const [idVar, secretVar] =
    env === "production"
      ? ["QURAN_FOUNDATION_PROD_CLIENT_ID", "QURAN_FOUNDATION_PROD_CLIENT_SECRET"]
      : ["QURAN_FOUNDATION_CLIENT_ID", "QURAN_FOUNDATION_CLIENT_SECRET"];
  const clientId = process.env[idVar];
  const clientSecret = process.env[secretVar];
  if (!clientId || !clientSecret) {
    console.error(
      `\n${idVar} / ${secretVar} are not set (QURAN_FOUNDATION_ENV=${env}).\n` +
        "Register a project at https://dev-console.quran.foundation/projects,\n" +
        "then copy .env.local.example to .env.local and fill both in.\n" +
        "See QURAN-CONTENT.md §5 for the full explanation.\n"
    );
    process.exit(1);
  }
  return { clientId, clientSecret };
}

async function getAccessToken(clientId, clientSecret, env) {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${HOSTS[env].auth}/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=content",
  });
  if (!res.ok) {
    throw new Error(`Token request failed: ${res.status} ${res.statusText} — ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchContent(env, clientId, token, resource, attempt = 1) {
  const url = `${HOSTS[env].api}/content/api/v4/${resource}`;
  const res = await fetch(url, {
    headers: { "x-auth-token": token, "x-client-id": clientId },
  });

  if (res.status === 429 || res.status >= 500) {
    if (attempt > MAX_RETRIES) {
      throw new Error(`Request failed after ${MAX_RETRIES} retries (${resource}): ${res.status}`);
    }
    const backoff = REQUEST_DELAY_MS * 2 ** attempt;
    console.warn(`  ${res.status} on ${resource} — retrying in ${backoff}ms (attempt ${attempt}/${MAX_RETRIES})`);
    await sleep(backoff);
    return fetchContent(env, clientId, token, resource, attempt + 1);
  }

  if (!res.ok) {
    throw new Error(`Request failed (${resource}): ${res.status} ${res.statusText} — ${await res.text()}`);
  }

  await sleep(REQUEST_DELAY_MS);
  return res.json();
}

/** Fetches every page of a chapter's verses (Uthmani text + translation). */
async function fetchAllVerses(env, clientId, token, chapterNumber) {
  const verses = [];
  let page = 1;
  let totalPages = 1;

  do {
    const data = await fetchContent(
      env,
      clientId,
      token,
      `verses/by_chapter/${chapterNumber}?words=false&fields=text_uthmani&translations=${TRANSLATION_RESOURCE_ID}&per_page=${PER_PAGE}&page=${page}`
    );
    verses.push(...data.verses);
    totalPages = data.pagination?.total_pages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return verses;
}

async function main() {
  const env = resolveEnv();
  const { clientId, clientSecret } = requireCredentials(env);
  console.log(`Syncing against ${env} (${HOSTS[env].api})...`);
  console.log(`Translation resource id: ${TRANSLATION_RESOURCE_ID}\n`);

  const token = await getAccessToken(clientId, clientSecret, env);

  await mkdir(SURAH_DIR, { recursive: true });

  console.log("Fetching chapter list (all 114)...");
  const chaptersRes = await fetchContent(env, clientId, token, "chapters?language=en");
  const chapters = chaptersRes.chapters;
  if (chapters.length !== 114) {
    console.warn(`  Expected 114 chapters, got ${chapters.length} — writing what was returned.`);
  }
  await writeFile(
    path.join(OUT_DIR, "chapters.json"),
    JSON.stringify({ syncedAt: new Date().toISOString(), chapters }, null, 2)
  );
  console.log(`  Wrote chapters.json (${chapters.length} chapters)\n`);

  for (const chapter of chapters) {
    const n = chapter.id;
    process.stdout.write(`Surah ${n}/${chapters.length} (${chapter.name_simple})... `);
    const verses = await fetchAllVerses(env, clientId, token, n);
    await writeFile(
      path.join(SURAH_DIR, `${n}.json`),
      JSON.stringify({ syncedAt: new Date().toISOString(), chapter, verses }, null, 2)
    );
    console.log(`${verses.length} verses`);
  }

  console.log(`\nDone. Wrote ${chapters.length} surah files to ${SURAH_DIR}`);
  console.log(
    "\nReminder (QURAN-CONTENT.md §3): re-run this at least every 7 days once this " +
      "becomes the real sync job — that's a license requirement, not a suggestion."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
