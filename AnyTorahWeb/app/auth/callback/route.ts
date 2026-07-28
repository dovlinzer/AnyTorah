import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Landing point for the magic-link email. Supabase's link points here with a `code` query param;
// exchanging it sets the session cookies via the server client's cookie handlers, then we bounce
// back into the reader.
//
// The exchange fails (not just "no code") if the link is opened in a different browser than the
// one that requested it — PKCE's code_verifier is stored per-browser, so a mismatch is silent
// unless checked. Redirecting to origin regardless of outcome used to mask exactly that failure
// (confirmed live: a cross-browser sign-in attempt looked identical to a successful one from the
// user's side). Surface it instead of swallowing it.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const url = new URL("/", origin);
      url.searchParams.set("signInError", error.message);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.redirect(origin);
}
