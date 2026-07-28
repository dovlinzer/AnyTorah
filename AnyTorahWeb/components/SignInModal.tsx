"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";

/** Magic-link sign-in, modeled on SASimanPicker/NumberPickerModal's modal chrome. */
export default function SignInModal({ onClose, hebrewMode = false }: { onClose: () => void; hebrewMode?: boolean }) {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    const { error } = await signInWithEmail(email.trim());
    if (error) {
      setErrorMessage(error);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        dir={hebrewMode ? "rtl" : "ltr"}
        className="w-full max-w-sm rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
            Sign in
          </h2>
          <button onClick={onClose} className="rounded px-2 py-1 text-sm opacity-60 hover:opacity-100" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="p-4">
          {status === "sent" ? (
            <p className="text-sm">
              Check <span className="font-medium">{email}</span> for a sign-in link.
            </p>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <p className="text-sm opacity-80">
                We&apos;ll email you a link — no password needed. Bookmarks, highlights, and notebooks made
                while signed out stay on this device only.
              </p>
              <input
                type="email"
                required
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded border border-border bg-background px-3 py-2 text-sm"
              />
              {status === "error" && <p className="text-sm text-red-500">{errorMessage}</p>}
              <button
                type="submit"
                disabled={status === "sending"}
                className="rounded px-3 py-2 text-sm font-medium disabled:opacity-60"
                style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
              >
                {status === "sending" ? "Sending…" : "Send sign-in link"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
