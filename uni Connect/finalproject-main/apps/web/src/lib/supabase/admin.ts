import "server-only";

import { createClient } from "@supabase/supabase-js";

import { requireSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

/**
 * Service-role client: BYPASSES row-level security.
 *
 * Only for trusted server code: AI indexing, the email outbox, cron routes,
 * signing private-bucket URLs. Never import it from a Client Component
 * (`server-only` makes the build fail if you do) and never use it to answer
 * a user's own read request.
 */
export function createAdminClient() {
  const { url } = requireSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set (server-only, never NEXT_PUBLIC).");
  }

  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
