import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated Quran content (scripts/sync-content.mjs) — large,
    // single-line JSON data files, not source code. Without this, ESLint
    // tries to parse them as JS/TS (huge minified-looking "files") and
    // effectively hangs — not just noisy, genuinely too slow to finish.
    "src/content/generated/**",
  ]),
]);

export default eslintConfig;
