// Service-role Supabase client — bypasses RLS entirely. Server-only, and only for use by the
// Stripe webhook (app/api/stripe/webhook/route.ts): that route runs with no signed-in user
// session (Stripe calls it directly), so it can't write to `subscriptions` through the normal
// user-scoped client, which only allows a user to read/write their own row via auth.uid(). Every
// other write path in this codebase goes through the normal per-request client instead — this is
// the first and only service-role usage.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");
  return createSupabaseClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
