// App-side mirror of the user_notebooks RLS policy's "oldest notebook stays free" rule (see
// supabase/migrations/004_user_notebooks.sql) — used only to decide what the UI shows (an
// editable panel vs. a locked upsell placeholder). The database re-checks this independently on
// every access; this module can never grant real access, only predict it for UX purposes.
//
// Currently dead code — NotebookPanel.tsx hardcodes isLocked = false (the subscription flow isn't
// ready to ship yet; see its own comment). Kept correct against the current Notebook.id-based
// identity model so it's ready to re-enable, not deleted.
import type { Notebook } from "./notebooks";

/** Sorts by createdAt, falling back to updatedAt for notebooks saved before that field existed
 *  (an honest best-effort for pre-existing local data, not a guarantee). */
function creationOrderKey(n: Notebook): string {
  return n.createdAt ?? n.updatedAt;
}

/** The one notebook id that stays free regardless of subscription — the earliest-created
 *  notebook, or null if the user has no notebooks yet (meaning whichever one they create first
 *  becomes the free one, matching the RLS policy's own insert-time bootstrap case). */
export function getFreeNotebookId(notebooks: Notebook[]): string | null {
  if (notebooks.length === 0) return null;
  return notebooks.reduce((oldest, n) => (creationOrderKey(n) < creationOrderKey(oldest) ? n : oldest)).id;
}

/** Whether opening/editing this notebook should be blocked in the UI. Only ever true when signed
 *  in — local, signed-out use is never capped (see the accounts/sync plan's explicit decision on
 *  this). */
export function isNotebookLocked(
  notebookId: string,
  notebooks: Notebook[],
  { signedIn, subscriptionActive }: { signedIn: boolean; subscriptionActive: boolean },
): boolean {
  if (!signedIn || subscriptionActive) return false;
  const freeId = getFreeNotebookId(notebooks);
  if (freeId === null) return false; // no notebooks yet — this one would become the free one
  return notebookId !== freeId;
}
