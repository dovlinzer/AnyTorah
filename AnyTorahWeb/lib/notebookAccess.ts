// App-side mirror of the user_notebooks RLS policy's "oldest notebook stays free" rule (see
// supabase/migrations/004_user_notebooks.sql) — used only to decide what the UI shows (an
// editable panel vs. a locked upsell placeholder). The database re-checks this independently on
// every access; this module can never grant real access, only predict it for UX purposes.
import type { Notebook, NotebookScope } from "./notebooks";
import { notebookScopeKey } from "./notebooks";

/** Sorts by createdAt, falling back to updatedAt for notebooks saved before that field existed
 *  (an honest best-effort for pre-existing local data, not a guarantee). */
function creationOrderKey(n: Notebook): string {
  return n.createdAt ?? n.updatedAt;
}

/** The one scopeKey that stays free regardless of subscription — the earliest-created notebook,
 *  or null if the user has no notebooks yet (meaning whichever scope they write into first
 *  becomes the free one, matching the RLS policy's own insert-time bootstrap case). */
export function getFreeScopeKey(notebooks: Notebook[]): string | null {
  if (notebooks.length === 0) return null;
  return notebooks.reduce((oldest, n) => (creationOrderKey(n) < creationOrderKey(oldest) ? n : oldest)).scopeKey;
}

/** Whether writing to `scope` should be blocked in the UI. Only ever true when signed in — local,
 *  signed-out use is never capped (see the accounts/sync plan's explicit decision on this). */
export function isNotebookScopeLocked(
  scope: NotebookScope,
  notebooks: Notebook[],
  { signedIn, subscriptionActive }: { signedIn: boolean; subscriptionActive: boolean },
): boolean {
  if (!signedIn || subscriptionActive) return false;
  const freeScopeKey = getFreeScopeKey(notebooks);
  if (freeScopeKey === null) return false; // no notebooks yet — this one would become the free one
  return notebookScopeKey(scope) !== freeScopeKey;
}
