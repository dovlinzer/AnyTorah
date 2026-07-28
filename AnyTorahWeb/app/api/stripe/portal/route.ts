import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

// Opens the Stripe-hosted Customer Portal for the signed-in user's existing subscription
// (upgrade/cancel/update payment method). Requires a stripe_customer_id already on file, which
// only exists once they've completed Checkout at least once — see ../checkout/route.ts.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(origin);

  try {
    const { data } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data?.stripe_customer_id) return NextResponse.redirect(origin);

    const stripe = getStripe();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: origin,
    });
    return NextResponse.redirect(portalSession.url);
  } catch (err) {
    console.warn("[stripe portal] failed to create session:", err);
    return NextResponse.redirect(origin);
  }
}
