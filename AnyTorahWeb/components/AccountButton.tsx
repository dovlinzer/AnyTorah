"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import SignInModal from "./SignInModal";
import { getSubscriptionStatus, isActiveStatus } from "@/lib/subscription";

/** Header account affordance: "Sign in" pill when signed out; email + sign-out popover when
 *  signed in. Placement/sizing mirror the other header pill buttons in Reader.tsx. */
export default function AccountButton({ pillButtonClass, hebrewMode = false }: { pillButtonClass: string; hebrewMode?: boolean }) {
  const { user, loading, signOut } = useAuth();
  const [signInOpen, setSignInOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getSubscriptionStatus().then((status) => {
      if (!cancelled) setSubscriptionActive(isActiveStatus(status));
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);
  // Surfaces app/auth/callback/route.ts's ?signInError= param (e.g. a cross-browser magic-link
  // click, where the PKCE code_verifier doesn't match) instead of silently redirecting as if
  // nothing happened. Read via a lazy initializer (runs once, during render) rather than an
  // effect that calls setState — the effect below only performs the URL-cleanup side effect.
  const [signInError, setSignInError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("signInError");
  });

  useEffect(() => {
    if (!signInError) return;
    const params = new URLSearchParams(window.location.search);
    params.delete("signInError");
    const next = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (next ? `?${next}` : ""));
  }, [signInError]);

  useEffect(() => {
    if (!menuOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", onOutside);
    return () => window.removeEventListener("mousedown", onOutside);
  }, [menuOpen]);

  const errorBanner = signInError && (
    <div
      className="fixed top-4 right-4 z-50 flex max-w-sm items-start gap-2 rounded-lg border border-red-500/50 bg-card p-3 text-sm shadow-xl"
      role="alert"
    >
      <span className="flex-1">Sign-in failed: {signInError}</span>
      <button onClick={() => setSignInError(null)} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
        ✕
      </button>
    </div>
  );

  if (loading) return errorBanner;

  if (!user) {
    return (
      <>
        {errorBanner}
        <button onClick={() => setSignInOpen(true)} className={pillButtonClass} title="Sign in">
          Sign in
        </button>
        {signInOpen && <SignInModal onClose={() => setSignInOpen(false)} hebrewMode={hebrewMode} />}
      </>
    );
  }

  return (
    <div ref={menuRef} className="relative shrink-0">
      {errorBanner}
      <button onClick={() => setMenuOpen((o) => !o)} className={pillButtonClass} title={user.email ?? "Account"}>
        👤
      </button>
      {menuOpen && (
        <div
          dir={hebrewMode ? "rtl" : "ltr"}
          className="absolute top-full z-20 mt-1 min-w-48 rounded-lg border border-border bg-card p-2 text-sm shadow-xl"
          style={hebrewMode ? { left: 0 } : { right: 0 }}
        >
          <div className="truncate px-2 py-1 opacity-70">{user.email}</div>
          {subscriptionActive ? (
            <a
              href="/api/stripe/portal"
              className="block w-full rounded px-2 py-1 text-left hover:bg-[var(--border)]"
            >
              Manage subscription
            </a>
          ) : (
            <a
              href="/api/stripe/checkout"
              className="block w-full rounded px-2 py-1 text-left hover:bg-[var(--border)]"
            >
              Upgrade — unlock more notebooks
            </a>
          )}
          <button
            onClick={() => {
              setMenuOpen(false);
              void signOut();
            }}
            className="w-full rounded px-2 py-1 text-left hover:bg-[var(--border)]"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
