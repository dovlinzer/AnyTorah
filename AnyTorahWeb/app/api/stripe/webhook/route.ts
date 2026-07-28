import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

// Keeps supabase's `subscriptions` table in sync with Stripe — the only writer of that table
// (see supabase/migrations/003_subscriptions.sql: users can only read their own row). Runs with
// no user session (Stripe calls this directly), hence the service-role client.
export const runtime = "nodejs";

function periodEnd(sub: Stripe.Subscription): string | null {
  // Stripe API 2025-03-31+ moved current_period_end off the top-level Subscription object and
  // onto each subscription item (confirmed against the installed SDK's own type defs — this
  // account is pinned to 2026-06-24.dahlia, well past that change).
  const end = sub.items.data[0]?.current_period_end;
  return end ? new Date(end * 1000).toISOString() : null;
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[stripe webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const body = await request.text();
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.warn("[stripe webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  try {
    switch (event.type) {
      // Fires once at the end of a successful Checkout — this is where we learn which Supabase
      // user (client_reference_id, set in ../checkout/route.ts) maps to which Stripe customer.
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (!userId || !customerId) break;

        let status = "active";
        let currentPeriodEnd: string | null = null;
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          status = sub.status;
          currentPeriodEnd = periodEnd(sub);
        }

        const { error } = await supabase.from("subscriptions").upsert(
          {
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId ?? null,
            status,
            current_period_end: currentPeriodEnd,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        if (error) throw error;
        break;
      }

      // Ongoing lifecycle sync — renewals, plan changes, past-due, and cancellation (including
      // "cancel at period end" finally taking effect) all land here, keyed by customer id since
      // no user session is available to key off user_id directly.
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

        const { data: existing, error: lookupError } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        if (lookupError) throw lookupError;
        if (!existing) break; // no known Supabase user for this customer — nothing to update

        const { error } = await supabase
          .from("subscriptions")
          .update({
            stripe_subscription_id: sub.id,
            status: event.type === "customer.subscription.deleted" ? "canceled" : sub.status,
            current_period_end: periodEnd(sub),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", existing.user_id);
        if (error) throw error;
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.warn(`[stripe webhook] failed to handle ${event.type}:`, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
