// Cross-device sync for reader preferences — the ~12 small localStorage keys in Reader.tsx/
// NotebookPanel.tsx (font sizes, hebrew mode, display modes, reverse nav, daf image/position,
// panel widths, commentary-slot assignments). Unlike bookmarks/highlights (lib/supabase/sync.ts,
// one row per item), these sync as a single JSON blob in one row per user — there's no natural
// "item id" for a font-size setting, and 12 separate round-trips for one save would be wasteful.
import { createClient } from "./supabase/client";
import { getSyncUserId } from "./supabase/sync";

// Fixed keys, kept as raw strings rather than re-typed — this stays a thin mirror of whatever
// Reader.tsx/NotebookPanel.tsx already read/write, no parallel schema to keep in sync.
const FIXED_PREFERENCE_KEYS = [
  "anytorah:fontSizeLevel",
  "anytorah:commentaryFontSizeLevel",
  "anytorah:notebookFontSizeLevel",
  "anytorah:hebrewMode",
  "anytorah:textDisplayMode",
  "anytorah:commentaryDisplayMode",
  "anytorah:reverseNavigation",
  "anytorah:showDafImage",
  "anytorah:dafPosition",
  "anytorah:saTextMode",
  "anytorah:narrowPanelWidth",
  "anytorah:commentaryWidth",
  "anytorah:notebookWidth",
  "anytorah:teshuvotGroupBy",
];

// Commentary-slot assignments are stored one key per context ("anytorah:slots:talmud",
// "anytorah:slots:sa:0", ...) — open-ended, so they're found by prefix scan rather than listed.
const SLOT_KEY_PREFIX = "anytorah:slots:";

function readPreferencesBlob(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const blob: Record<string, string> = {};
  for (const key of FIXED_PREFERENCE_KEYS) {
    const v = window.localStorage.getItem(key);
    if (v !== null) blob[key] = v;
  }
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k?.startsWith(SLOT_KEY_PREFIX)) {
      const v = window.localStorage.getItem(k);
      if (v !== null) blob[k] = v;
    }
  }
  return blob;
}

function writePreferencesBlob(blob: Record<string, string>) {
  if (typeof window === "undefined") return;
  for (const [key, value] of Object.entries(blob)) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // localStorage unavailable — this preference just won't persist.
    }
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

/** Fire-and-forget, debounced — the generic store*() helpers in Reader.tsx/NotebookPanel.tsx call
 *  this on every preference change (e.g. dragging a resize handle fires many writes per second),
 *  so this coalesces them into one upsert 800ms after the last change. */
export function schedulePreferencesSync() {
  if (!getSyncUserId()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushPreferences();
  }, 800);
}

async function pushPreferences() {
  const userId = getSyncUserId();
  if (!userId) return;
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("user_preferences")
      .upsert({ user_id: userId, data: readPreferencesBlob(), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw error;
  } catch (err) {
    console.warn("[sync] failed to sync user_preferences:", err);
  }
}

let reconciledForSession = false;

/** Pulls the remote preferences blob (if any) and writes it into localStorage — remote wins, same
 *  convention as bookmarks/highlights. Unlike those, preference values are already read into ~12
 *  separate pieces of component state via useState lazy initializers at mount, so there's no
 *  single place to re-derive them all from a changed localStorage value — a one-time reload is
 *  the simplest correct fix. `reconciledForSession` (in-memory, reset on every real page load)
 *  guards it to fire at most once and never loop: after reloading, the freshly-read local blob
 *  already matches the remote one, so the second call is a no-op. */
export async function reconcilePreferences(): Promise<void> {
  if (reconciledForSession) return;
  reconciledForSession = true;
  const userId = getSyncUserId();
  if (!userId) return;
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("user_preferences").select("data").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (data?.data) {
      const remote = data.data as Record<string, string>;
      const changed = JSON.stringify(remote) !== JSON.stringify(readPreferencesBlob());
      writePreferencesBlob(remote);
      if (changed && typeof window !== "undefined") window.location.reload();
    } else {
      await pushPreferences();
    }
  } catch (err) {
    console.warn("[sync] failed to reconcile user_preferences:", err);
  }
}
