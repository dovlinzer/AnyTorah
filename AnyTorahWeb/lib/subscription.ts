// Reads the current user's subscription status (see supabase/migrations/003_subscriptions.sql,
// populated by the Stripe webhook — app/api/stripe/webhook/route.ts). This is UX only: it lets
// the app show a clear "subscribe to unlock" state instead of a confusing failed query, but the
// real gate is user_notebooks' RLS policy (004_user_notebooks.sql), which is re-checked by
// Postgres on every access regardless of what this returns.
import { createClient } from "./supabase/client";
import { getSyncUserId } from "./supabase/sync";

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "none";

let cached: { userId: string; status: SubscriptionStatus } | null = null;
let inflight: Promise<SubscriptionStatus> | null = null;

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  const userId = getSyncUserId();
  if (!userId) return "none";
  if (cached?.userId === userId) return cached.status;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from("subscriptions").select("status").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      const status = (data?.status as SubscriptionStatus | undefined) ?? "none";
      cached = { userId, status };
      return status;
    } catch (err) {
      console.warn("[subscription] failed to fetch status:", err);
      return "none";
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Matches the RLS policy's own check exactly (status = 'active') — 'trialing' isn't granted
 *  notebook access by the database, so it isn't treated as unlocked here either, to avoid the UI
 *  claiming access that the database would then refuse. */
export function isActiveStatus(status: SubscriptionStatus): boolean {
  return status === "active";
}

/** Call after a checkout/portal round trip so the next getSubscriptionStatus() call re-fetches
 *  instead of serving a stale cached value. */
export function clearSubscriptionStatusCache() {
  cached = null;
}
