// Server-only Stripe client — never import this from a "use client" file. Used by the three
// app/api/stripe/*.ts routes (checkout, portal, webhook).
import Stripe from "stripe";

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key);
  }
  return client;
}
