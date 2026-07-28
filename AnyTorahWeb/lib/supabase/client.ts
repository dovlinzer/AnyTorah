import { createBrowserClient } from "@supabase/ssr";

// Deliberately no `auth.storage` override here. createBrowserClient stores the session in
// cookies by default — that's the whole point of @supabase/ssr, and it's what lets the
// server-side /auth/callback route (which completes the magic-link sign-in) and this client
// share one session. An earlier version pointed `auth.storage` at localStorage (copied from
// yct-registrar's client, which doesn't have this problem — its sign-in is entirely
// client-side, no server callback route ever writes a session the client needs to pick up).
// That silently broke the handoff here: the callback route wrote a valid session cookie, but
// this client only ever checked localStorage, which nothing had populated, so the header kept
// showing "Sign in" even after a successful sign-in.
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
