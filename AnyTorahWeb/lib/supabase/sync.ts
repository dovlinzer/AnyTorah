// Cross-device sync for the localStorage-backed feature modules (bookmarks, highlights, and
// later preferences/notebooks). Deliberately NOT a full async rewrite of those modules' public
// API — loadX()/saveX() stay synchronous, localStorage-backed, and unchanged in signature for
// every existing call site (Reader.tsx, the edit/list modals). This module only adds a
// background mirror to Supabase on top, so localStorage remains the always-fresh local cache the
// UI reads from, and Supabase is a write-behind copy plus the thing that gets pulled from on
// reconcile.
//
// Conflict rule, deliberately simple (see the accounts/sync plan — "no merge UI" is accepted):
// on reconcile, an id present in both local and remote is resolved **remote wins**. Bookmark/
// Highlight have no reliable per-item last-edited timestamp (Bookmark.createdAt never changes on
// edit), so comparing "which is newer" isn't possible at the item level — trusting the server's
// already-synced copy over a possibly-stale local one is the safer default.
import { createClient } from "./client";

let currentUserId: string | null = null;

export function setSyncUserId(id: string | null) {
  currentUserId = id;
}

export function getSyncUserId(): string | null {
  return currentUserId;
}

/** Fire-and-forget: upserts every item that's new or changed in `next` vs. `previous`, deletes
 *  every item that dropped out of `next`. Errors are logged, not thrown — a failed background
 *  sync must never block or roll back the local save that already succeeded. `getId` extracts
 *  each item's natural key (`Bookmark.id`/`Highlight.id`/`Notebook.id`) — tables vary in
 *  what they call the matching column, hence `idColumn` (defaults to "client_id", the column
 *  every table including notebooks now uses). */
export function syncArrayDiff<T>(table: string, previous: T[], next: T[], getId: (item: T) => string, idColumn = "client_id") {
  const userId = currentUserId;
  if (!userId) return;

  const prevById = new Map(previous.map((item) => [getId(item), item]));
  const nextById = new Map(next.map((item) => [getId(item), item]));

  const upserts = next.filter((item) => {
    const prev = prevById.get(getId(item));
    return !prev || JSON.stringify(prev) !== JSON.stringify(item);
  });
  const deletedIds = previous.filter((item) => !nextById.has(getId(item))).map(getId);

  void runSync(table, userId, upserts, deletedIds, getId, idColumn);
}

async function runSync<T>(
  table: string,
  userId: string,
  upserts: T[],
  deletedIds: string[],
  getId: (item: T) => string,
  idColumn: string,
) {
  try {
    const supabase = createClient();
    if (upserts.length > 0) {
      const rows = upserts.map((item) => ({
        user_id: userId,
        [idColumn]: getId(item),
        data: item,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from(table).upsert(rows, { onConflict: `user_id,${idColumn}` });
      if (error) throw error;
    }
    if (deletedIds.length > 0) {
      const { error } = await supabase.from(table).delete().eq("user_id", userId).in(idColumn, deletedIds);
      if (error) throw error;
    }
  } catch (err) {
    console.warn(`[sync] failed to sync ${table}:`, err);
  }
}

/** Pulls every row for the current user from `table`, unions with `local` (remote wins on a
 *  shared id), pushes any local-only items up, and returns the merged array — the same shape
 *  that should be written back to localStorage and to React state. Called whenever a session is
 *  confirmed present (a fresh sign-in, or a page load that restores an existing session) — there
 *  is no realtime channel, so this doubles as both "first-ever merge" and "pick up anything made
 *  on another device since last visit." */
export async function reconcileArray<T>(
  table: string,
  local: T[],
  getId: (item: T) => string,
  idColumn = "client_id",
): Promise<T[]> {
  const userId = currentUserId;
  if (!userId) return local;

  const supabase = createClient();
  let remote: T[];
  try {
    const { data, error } = await supabase.from(table).select("data").eq("user_id", userId);
    if (error) throw error;
    remote = (data ?? []).map((row) => row.data as T);
  } catch (err) {
    console.warn(`[sync] failed to reconcile ${table}:`, err);
    return local;
  }

  const remoteIds = new Set(remote.map(getId));
  const localOnly = local.filter((item) => !remoteIds.has(getId(item)));

  // Pushing local-only items is a separate try/catch from the fetch above: a row-level-security
  // rejection here (e.g. a locked, unsubscribed 2nd notebook — see supabase/migrations/
  // 004_user_notebooks.sql) must not discard the successful fetch that already happened. The
  // rejected item(s) simply stay local-only and keep retrying via the normal save-path sync
  // (syncArrayDiff) on their next edit.
  if (localOnly.length > 0) {
    try {
      const rows = localOnly.map((item) => ({
        user_id: userId,
        [idColumn]: getId(item),
        data: item,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from(table).upsert(rows, { onConflict: `user_id,${idColumn}` });
      if (error) throw error;
    } catch (err) {
      console.warn(`[sync] failed to push local-only items while reconciling ${table}:`, err);
    }
  }

  return [...remote, ...localOnly];
}
