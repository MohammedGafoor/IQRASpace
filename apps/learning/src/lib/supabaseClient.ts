import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly and early rather than letting every call site produce a
  // confusing runtime error deep inside @supabase/supabase-js.
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy .env.local.example to .env.local and fill in your Supabase project's values."
  );
}

// Single shared browser client. Uses the public anon key only — RLS policies
// (see supabase/migrations) are what actually scope access per role, per
// docs/architecture.md §16. Never import the service_role key into this file
// or any other client-bundled code.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
