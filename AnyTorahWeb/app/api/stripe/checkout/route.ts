import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

// Starts a Stripe Checkout session for the signed-in user. Only ever reads subscriptions (RLS
// allows a user to read their own row — see supabase/migrations/003_subscriptions.sql); it never
// writes one. The actual subscriptions row is written by the webhook (route.ts in ../webhook),
// once Stripe confirms the checkout actually completed — this route only redirects to Stripe.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(origin);

  const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;
  if (!priceId) {
    console.warn("[stripe checkout] NEXT_PUBLIC_STRIPE_PRICE_ID is not set");
    return NextResponse.redirect(origin);
  }

  try {
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      ...(existing?.stripe_customer_id
        ? { customer: existing.stripe_customer_id }
        : { customer_email: user.email ?? undefined }),
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel`,
    });

    if (!session.url) throw new Error("Checkout session has no url");
    return NextResponse.redirect(session.url);
  } catch (err) {
    console.warn("[stripe checkout] failed to create session:", err);
    return NextResponse.redirect(`${origin}/?checkoutError=1`);
  }
}
