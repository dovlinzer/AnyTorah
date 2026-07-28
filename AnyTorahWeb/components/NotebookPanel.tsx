"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import AnchorNodeExtension from "./notebook/AnchorNodeExtension";
import IndentExtension from "./notebook/IndentExtension";
import TextDirectionExtension from "./notebook/TextDirectionExtension";
import SearchExtension from "./notebook/SearchExtension";
import SectionColorExtension from "./notebook/SectionColorExtension";
import TagNodeExtension from "./notebook/TagNodeExtension";
import {
  emptyNotebookBody,
  extractAnchors,
  extractTags,
  formatNotebookScopeLabel,
  loadNotebook,
  loadNotebooks,
  loadAndReconcileNotebooks,
  notebookScopeKey,
  saveNotebook,
  type Notebook,
  type NotebookScope,
} from "@/lib/notebooks";
import { formatAnchorLabel, type TextAnchor } from "@/lib/textAnchor";
import { HIGHLIGHT_CATEGORY_COUNT, loadHighlightCategoryLabels } from "@/lib/highlightCategories";
import FontSizeSlider from "@/components/FontSizeSlider";
import { fontSizePx, FONT_SIZE_MIN, FONT_SIZE_MAX } from "@/lib/fontSizeLevels";
import { schedulePreferencesSync } from "@/lib/preferences";
import { useAuth } from "@/components/AuthProvider";
import { getSubscriptionStatus, isActiveStatus } from "@/lib/subscription";
import { isNotebookScopeLocked } from "@/lib/notebookAccess";

const AUTOSAVE_DELAY_MS = 500;
const NOTEBOOK_FONT_SIZE_KEY = "anytorah:notebookFontSizeLevel";

function loadNotebookFontSizeLevel(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(NOTEBOOK_FONT_SIZE_KEY);
    const n = raw === null ? NaN : parseInt(raw, 10);
    return Number.isFinite(n) ? Math.min(Math.max(n, FONT_SIZE_MIN), FONT_SIZE_MAX) : 0;
  } catch {
    return 0;
  }
}

function storeNotebookFontSizeLevel(level: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NOTEBOOK_FONT_SIZE_KEY, String(level));
    schedulePreferencesSync();
  } catch {
    // localStorage unavailable — font size choice just won't persist.
  }
}

/** Walks the live editor doc for heading nodes — powers the outline panel's "jump to heading"
 *  navigation. `pos` is a live ProseMirror document position, valid only against the current
 *  doc/editor instance (not persisted), used with editor.view.nodeDOM to scroll to the actual
 *  rendered heading element. Recomputed on every edit (onUpdate) so the outline stays in sync
 *  while the user is typing new headings, not just on open. */
function extractHeadings(editor: Editor): { level: number; text: string; pos: number }[] {
  const items: { level: number; text: string; pos: number }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      items.push({ level: node.attrs.level as number, text: node.textContent.trim() || "(untitled)", pos });
    }
  });
  return items;
}

/** Distinct, alphabetized tag labels in this notebook — powers the find bar's tag-chip row (a
 *  notebook can have the same tag chip inserted more than once, same as cross-notebook search's
 *  own tag list). */
function dedupeTags(tags: { tagId: string; label: string }[]): string[] {
  return Array.from(new Set(tags.map((t) => t.label))).sort((a, b) => a.localeCompare(b));
}

export interface NotebookScopeOption {
  source: NotebookScope["source"];
  commentaryType?: NotebookScope["commentaryType"];
  label: string;
}

/** Side-panel Notebook editor for one scope (main text of the current book, or one of its active
 *  commentaries) — mount with `key={notebookScopeKey(scope)}` from Reader.tsx so switching scope
 *  remounts this component (and thus useEditor) instead of manually resyncing content. */
export default function NotebookPanel({
  scope,
  readerChapter,
  readerHalakha,
  readerAmud,
  hebrewMode = false,
  scopeOptions,
  onScopeChange,
  onNavigateToOtherScope,
  onNavigateAnchor,
  onEditorReady,
  onClose,
  initialSearchTerm,
  onInitialSearchConsumed,
}: {
  scope: NotebookScope;
  /** Wherever the reader currently is, within this notebook's scope's book/tractate — drives
   *  reverse sync: scrolling to and flashing whichever anchor pill(s) match. Anchor matching is
   *  chapter/halakha/amud granularity — this app still has no scroll-to-*segment* infrastructure,
   *  so an anchor pointing at a specific verse/paragraph still only resolves to its chapter. */
  readerChapter: number;
  readerHalakha?: number;
  /** Talmud only — which amud the reader is currently on, for amud-aware matching. Anchors
   *  created before this field existed omit `amud` and match on chapter alone (broader match). */
  readerAmud?: "a" | "b";
  /** saHebrewMode — the scope dropdown, header line, and newly-inserted anchor pill labels all
   *  render in Hebrew when true. */
  hebrewMode?: boolean;
  scopeOptions: NotebookScopeOption[];
  onScopeChange: (option: NotebookScopeOption) => void;
  /** Selecting a notebook from the "Other notebooks" group (any notebook ever created, not just
   *  ones for the current book) — unlike onScopeChange, this can change category/index too. */
  onNavigateToOtherScope: (scope: NotebookScope) => void;
  onNavigateAnchor: (anchor: TextAnchor) => void;
  onEditorReady: (insertAnchor: (anchor: TextAnchor) => void) => void;
  onClose: () => void;
  /** Set when arriving here from a cross-notebook search result (NotebookSearchModal) — opens
   *  the in-doc find bar pre-seeded with the query that matched, so the user lands on the hit. */
  initialSearchTerm?: string;
  /** Fired once initialSearchTerm has been applied — Reader.tsx clears its copy so a later,
   *  unrelated scope switch doesn't reapply a stale seeded search. */
  onInitialSearchConsumed?: () => void;
}) {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [findOpen, setFindOpen] = useState(!!initialSearchTerm);
  const [findQuery, setFindQuery] = useState(initialSearchTerm ?? "");
  const [colorFilter, setColorFilter] = useState<number | null>(null);
  const [findMatchInfo, setFindMatchInfo] = useState({ count: 0, index: -1 });
  const findInputRef = useRef<HTMLInputElement>(null);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [headings, setHeadings] = useState<{ level: number; text: string; pos: number }[]>([]);
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [colorLabels] = useState<string[]>(() => loadHighlightCategoryLabels());
  const [fontSizeLevel, setFontSizeLevelState] = useState(() => loadNotebookFontSizeLevel());
  const setFontSizeLevel = (level: number) => {
    setFontSizeLevelState(level);
    storeNotebookFontSizeLevel(level);
  };
  // Loaded once per mount (this component remounts on scope change anyway) — the "Other
  // notebooks" picker doesn't need to react to notebooks created in other tabs/sessions live.
  // Signed-in users additionally reconcile against Supabase on each mount, both to pick up
  // notebooks created on another device and to keep the free/locked computation below accurate.
  // loadAndReconcileNotebooks/getSubscriptionStatus both no-op to a signed-out-safe default
  // internally (they read the current user id themselves — see lib/supabase/sync.ts's
  // getSyncUserId), so these effects can call them unconditionally, same as Reader.tsx's
  // bookmarks/highlights reconcile effects.
  const { user } = useAuth();
  const [allNotebooks, setAllNotebooks] = useState<Notebook[]>(() => loadNotebooks());
  useEffect(() => {
    loadAndReconcileNotebooks().then(setAllNotebooks);
  }, [user?.id]);

  // Subscription gate (see lib/notebookAccess.ts) — UX only, the real gate is user_notebooks'
  // RLS policy (supabase/migrations/004_user_notebooks.sql), re-checked by Postgres on every
  // access regardless of what this predicts.
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
  const isLocked = isNotebookScopeLocked(scope, allNotebooks, { signedIn: !!user, subscriptionActive });

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      AnchorNodeExtension.configure({ onNavigate: onNavigateAnchor }),
      IndentExtension,
      TextDirectionExtension,
      SearchExtension,
      SectionColorExtension,
      TagNodeExtension,
    ],
    content: loadNotebook(scope)?.bodyJSON ?? emptyNotebookBody(),
    onCreate: ({ editor }) => {
      setHeadings(extractHeadings(editor));
      setNoteTags(dedupeTags(extractTags(editor.getJSON())));
    },
    onUpdate: ({ editor }) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveNotebook(scope, editor.getJSON());
      }, AUTOSAVE_DELAY_MS);
      setHeadings(extractHeadings(editor));
      setNoteTags(dedupeTags(extractTags(editor.getJSON())));
    },
    onTransaction: ({ editor }) => {
      setFindMatchInfo({
        count: editor.storage.notebookSearch.results.length,
        index: editor.storage.notebookSearch.resultIndex,
      });
    },
  });

  // Toggling `editable` imperatively (rather than passing it into useEditor's config) survives
  // this async, post-mount determination of isLocked without recreating the editor instance.
  useEffect(() => {
    editor?.setEditable(!isLocked);
  }, [editor, isLocked]);

  const scrollToHeading = (pos: number) => {
    if (!editor) return;
    const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
    if (!dom) return;
    dom.scrollIntoView({ behavior: "smooth", block: "start" });
    dom.classList.add("notebook-heading-flash");
    setTimeout(() => dom.classList.remove("notebook-heading-flash"), 1200);
  };

  // Run the seeded search whenever a fresh term arrives (cross-notebook search hand-off). Keyed
  // on initialSearchTerm itself, not just [editor] — navigating to a notebook that's already the
  // open one doesn't remount this component (same key={notebookScopeKey(scope)} in Reader.tsx),
  // so relying on mount alone would silently drop the seeded search in that case.
  useEffect(() => {
    if (!editor || !initialSearchTerm) return;
    setFindOpen(true);
    setFindQuery(initialSearchTerm);
    editor.commands.setSearchTerm(initialSearchTerm);
    onInitialSearchConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onInitialSearchConsumed ref intentionally excluded
  }, [editor, initialSearchTerm]);

  // Flush a pending debounced save immediately on unmount (scope switch or panel close) so the
  // last few hundred ms of typing aren't lost to the debounce window.
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        if (editor && !editor.isDestroyed) saveNotebook(scope, editor.getJSON());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only on unmount
  }, []);

  useEffect(() => {
    if (!editor) return;
    onEditorReady((anchor: TextAnchor) => {
      editor
        .chain()
        .focus()
        .insertAnchor({ anchor, nodeId: crypto.randomUUID(), label: formatAnchorLabel(anchor, hebrewMode) })
        .insertContent(" ")
        .run();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onEditorReady ref is set once editor exists
  }, [editor, hebrewMode]);

  // Reverse sync — scroll to and briefly flash whichever anchor pill(s) match wherever the
  // reader currently is. Runs on mount too (matching "always showing the matching notebook"),
  // not just on subsequent navigation, since Reader.tsx remounts this component fresh whenever
  // scope changes (key={notebookScopeKey(scope)}).
  useEffect(() => {
    if (!editor) return;
    const matches = extractAnchors(editor.getJSON()).filter(
      (a) =>
        a.anchor.chapter === readerChapter &&
        (a.anchor.halakha ?? undefined) === (readerHalakha ?? undefined) &&
        (!a.anchor.amud || a.anchor.amud === readerAmud),
    );
    if (matches.length === 0) return;
    const elements = matches.map((m) => document.getElementById(m.nodeId)).filter((el): el is HTMLElement => !!el);
    if (elements.length === 0) return;
    elements[0].scrollIntoView({ behavior: "smooth", block: "center" });
    elements.forEach((el) => el.classList.add("notebook-anchor-flash"));
    const timeout = setTimeout(() => {
      elements.forEach((el) => el.classList.remove("notebook-anchor-flash"));
    }, 1600);
    return () => clearTimeout(timeout);
  }, [editor, readerChapter, readerHalakha, readerAmud]);

  const currentOptionLabel =
    scopeOptions.find(
      (o) => o.source === scope.source && (o.commentaryType ?? undefined) === (scope.commentaryType ?? undefined),
    )?.label ?? formatNotebookScopeLabel(scope, hebrewMode);

  // "Other notebooks" — every notebook ever created that isn't already reachable through the
  // "this book" group above (a different book/tractate entirely, or a commentary that used to be
  // an active slot but no longer is). Selecting one can change category/index, unlike
  // onScopeChange which only switches source/commentaryType within the current book.
  const currentScopeKeys = new Set(
    scopeOptions.map((o) => notebookScopeKey({ category: scope.category, index: scope.index, source: o.source, commentaryType: o.commentaryType })),
  );
  const otherNotebookOptions = allNotebooks
    .filter((n) => !currentScopeKeys.has(n.scopeKey))
    .map((n) => ({ scopeKey: n.scopeKey, scope: n.scope, label: formatNotebookScopeLabel(n.scope, hebrewMode) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border p-2">
        <select
          value={notebookScopeKey(scope)}
          onChange={(e) => {
            const key = e.target.value;
            const here = scopeOptions.find(
              (o) =>
                notebookScopeKey({ category: scope.category, index: scope.index, source: o.source, commentaryType: o.commentaryType }) === key,
            );
            if (here) {
              onScopeChange(here);
              return;
            }
            const other = otherNotebookOptions.find((o) => o.scopeKey === key);
            if (other) onNavigateToOtherScope(other.scope);
          }}
          dir={hebrewMode ? "rtl" : "ltr"}
          className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
          style={hebrewMode ? { textAlign: "right" } : undefined}
          aria-label="Notebook scope"
        >
          <optgroup label={hebrewMode ? "הטקסט הזה" : "This text"}>
            {scopeOptions.map((o) => {
              const key = notebookScopeKey({ category: scope.category, index: scope.index, source: o.source, commentaryType: o.commentaryType });
              return (
                <option key={key} value={key}>
                  {o.label}
                </option>
              );
            })}
          </optgroup>
          {otherNotebookOptions.length > 0 && (
            <optgroup label={hebrewMode ? "עוד מחברות" : "Other notebooks"}>
              {otherNotebookOptions.map((o) => (
                <option key={o.scopeKey} value={o.scopeKey}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button
          onClick={onClose}
          aria-label="Close notebook"
          title="Close notebook"
          className="shrink-0 rounded-full border border-border px-2 py-1 text-xs hover:border-[var(--accent)]"
        >
          ✕
        </button>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border p-1.5">
        <ToolbarButton label="B" title="Bold" onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive("bold")} />
        <ToolbarButton label="I" title="Italic" onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive("italic")} />
        <ToolbarButton
          label="U"
          title="Underline"
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          active={editor?.isActive("underline")}
        />
        <ToolbarDivider />
        {[1, 2, 3].map((level) => (
          <ToolbarButton
            key={level}
            label={`H${level}`}
            title={`Heading ${level}`}
            onClick={() => editor?.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run()}
            active={editor?.isActive("heading", { level })}
          />
        ))}
        <ToolbarDivider />
        <ToolbarButton
          label="•"
          title="Bullet list"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          active={editor?.isActive("bulletList")}
        />
        <ToolbarButton
          label="1."
          title="Numbered list"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          active={editor?.isActive("orderedList")}
        />
        <ToolbarButton
          label="⇤"
          title="Outdent"
          onClick={() => {
            if (!editor) return;
            // Inside a list item, "outdent" un-nests it (sinkListItem/liftListItem are
            // StarterKit's own list-nesting commands); everywhere else it steps back the
            // paragraph/heading/blockquote's own margin-left (blockIndent, see
            // components/notebook/IndentExtension.ts).
            if (editor.isActive("listItem")) editor.chain().focus().liftListItem("listItem").run();
            else editor.chain().focus().outdent().run();
          }}
        />
        <ToolbarButton
          label="⇥"
          title="Indent"
          onClick={() => {
            if (!editor) return;
            if (editor.isActive("listItem")) editor.chain().focus().sinkListItem("listItem").run();
            else editor.chain().focus().indent().run();
          }}
        />
        <ToolbarButton
          label="❝"
          title="Blockquote"
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          active={editor?.isActive("blockquote")}
        />
        <ToolbarButton
          label="🔗"
          title="Link"
          onClick={() => {
            const url = window.prompt("Link URL");
            if (url) editor?.chain().focus().setLink({ href: url }).run();
          }}
          active={editor?.isActive("link")}
        />
        <ToolbarButton
          label="🏷"
          title="Insert a tag at the cursor"
          onClick={() => {
            const label = window.prompt("Tag name");
            if (label?.trim()) {
              editor?.chain().focus().insertTag({ tagId: crypto.randomUUID(), label: label.trim() }).insertContent(" ").run();
            }
          }}
        />
        <ToolbarDivider />
        {Array.from({ length: HIGHLIGHT_CATEGORY_COUNT }, (_, i) => i).map((i) => (
          <button
            key={i}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor?.chain().focus().setSectionColor(i).run()}
            title={`Highlight selection — ${colorLabels[i]}`}
            aria-label={`Highlight selection ${colorLabels[i]}`}
            className={`highlight-dot highlight-dot-${i}`}
          />
        ))}
        <ToolbarButton
          label="✕"
          title="Remove highlight color"
          onClick={() => editor?.chain().focus().unsetSectionColor().run()}
        />
        <ToolbarDivider />
        <ToolbarButton
          label="⇄"
          title="Toggle right-to-left text direction (for typing/pasting Hebrew)"
          onClick={() => {
            const isRtl = editor?.isActive({ dir: "rtl" }) ?? false;
            if (isRtl) editor?.chain().focus().unsetTextDirection().run();
            else editor?.chain().focus().setTextDirection("rtl").run();
          }}
          active={editor?.isActive({ dir: "rtl" })}
        />
        <ToolbarDivider />
        <ToolbarButton
          label="🔍"
          title="Find in this notebook"
          onClick={() => {
            setFindOpen((o) => {
              const next = !o;
              if (!next) {
                editor?.commands.setSearchTerm("");
                editor?.commands.setColorFilter(null);
                setColorFilter(null);
              }
              return next;
            });
            requestAnimationFrame(() => findInputRef.current?.focus());
          }}
          active={findOpen}
        />
        <ToolbarButton
          label="📑"
          title="Jump to a heading"
          onClick={() => setOutlineOpen((o) => !o)}
          active={outlineOpen}
        />
      </div>

      {outlineOpen && (
        <div className="flex max-h-40 shrink-0 flex-col gap-0.5 overflow-y-auto border-b border-border p-1.5">
          {headings.length === 0 ? (
            <p className="px-1 py-1 text-[10px] opacity-50">No headings yet — use H1/H2/H3 to add one.</p>
          ) : (
            headings.map((h) => (
              <button
                key={h.pos}
                onClick={() => {
                  scrollToHeading(h.pos);
                  setOutlineOpen(false);
                }}
                className="truncate rounded px-1.5 py-1 text-left text-xs hover:bg-[var(--border)]"
                style={{ paddingInlineStart: `${(h.level - 1) * 12 + 6}px`, fontWeight: h.level === 1 ? 600 : 400 }}
                title={h.text}
              >
                {h.text}
              </button>
            ))
          )}
        </div>
      )}

      {findOpen && (
        <div className="flex shrink-0 flex-col gap-1 border-b border-border p-1.5">
          <div className="flex items-center gap-1">
            <input
              ref={findInputRef}
              value={findQuery}
              onChange={(e) => {
                setFindQuery(e.target.value);
                editor?.commands.setSearchTerm(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (e.shiftKey) editor?.commands.goToPreviousMatch();
                  else editor?.commands.goToNextMatch();
                } else if (e.key === "Escape") {
                  setFindOpen(false);
                  setFindQuery("");
                  setColorFilter(null);
                  editor?.commands.setSearchTerm("");
                  editor?.commands.setColorFilter(null);
                }
              }}
              placeholder="Find in notebook — text or tags…"
              className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
              aria-label="Find in this notebook"
            />
            <span className="shrink-0 text-[10px] opacity-60">
              {findMatchInfo.count > 0 ? `${findMatchInfo.index + 1} / ${findMatchInfo.count}` : "0 / 0"}
            </span>
            <button
              onClick={() => editor?.commands.goToPreviousMatch()}
              disabled={findMatchInfo.count === 0}
              aria-label="Previous match"
              title="Previous match"
              className="shrink-0 rounded border border-border px-1.5 py-1 text-xs disabled:opacity-40"
            >
              ↑
            </button>
            <button
              onClick={() => editor?.commands.goToNextMatch()}
              disabled={findMatchInfo.count === 0}
              aria-label="Next match"
              title="Next match"
              className="shrink-0 rounded border border-border px-1.5 py-1 text-xs disabled:opacity-40"
            >
              ↓
            </button>
            <button
              onClick={() => {
                setFindOpen(false);
                setFindQuery("");
                setColorFilter(null);
                editor?.commands.setSearchTerm("");
                editor?.commands.setColorFilter(null);
              }}
              aria-label="Close find"
              title="Close find"
              className="shrink-0 rounded px-1.5 py-1 text-xs opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
          {noteTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] opacity-50">Tags:</span>
              {noteTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    const next = findQuery === t ? "" : t;
                    setFindQuery(next);
                    editor?.commands.setSearchTerm(next);
                  }}
                  className="rounded-full border px-2 py-0.5 text-[10px]"
                  style={{
                    borderColor: findQuery === t ? "var(--accent)" : "var(--border)",
                    opacity: findQuery === t ? 1 : 0.7,
                  }}
                >
                  🏷 {t}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] opacity-50">Highlighted:</span>
            {Array.from({ length: HIGHLIGHT_CATEGORY_COUNT }, (_, i) => i).map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  const next = colorFilter === i ? null : i;
                  setColorFilter(next);
                  editor?.commands.setColorFilter(next);
                }}
                title={`Jump through ${colorLabels[i]} sections`}
                aria-label={`Filter to ${colorLabels[i]} highlighted sections`}
                aria-pressed={colorFilter === i}
                className={`highlight-dot highlight-dot-${i}`}
                style={colorFilter === i ? { transform: "scale(1.25)", opacity: 1 } : undefined}
              />
            ))}
          </div>
        </div>
      )}

      <p
        dir={hebrewMode ? "rtl" : "ltr"}
        className={`shrink-0 px-2 pt-1.5 text-[10px] opacity-50 ${hebrewMode ? "text-right" : ""}`}
      >
        {hebrewMode ? `מחברת — ${currentOptionLabel}` : `Notebook — ${currentOptionLabel}`}
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {isLocked ? (
          <div dir={hebrewMode ? "rtl" : "ltr"} className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-sm font-medium opacity-80">{hebrewMode ? "מחברת זו נעולה" : "This notebook is locked"}</p>
            <p className="max-w-xs text-xs opacity-60">
              {hebrewMode
                ? "מחברת אחת חינם לכל משתמש רשום. הרשמה לתמיכה תפתח מחברות נוספות."
                : "One free notebook per signed-in account. Subscribe to unlock additional notebooks."}
            </p>
            <a
              href="/api/stripe/checkout"
              className="shrink-0 rounded-full border border-border px-4 py-1.5 text-xs transition-colors hover:border-[var(--accent)]"
              style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
            >
              {hebrewMode ? "הרשמה לתמיכה" : "Subscribe"}
            </a>
          </div>
        ) : (
          <EditorContent
            editor={editor}
            className="notebook-editor-content h-full"
            style={{ fontSize: fontSizePx(14, fontSizeLevel) }}
          />
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end border-t border-border p-1.5">
        <FontSizeSlider label="Notebook" level={fontSizeLevel} onChange={setFontSizeLevel} hebrewMode={hebrewMode} />
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  title,
  onClick,
  active,
}: {
  label: string;
  title: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      // A plain mousedown on this button blurs the editor's contentEditable and can collapse or
      // shift its selection *before* onClick's command runs — the classic Tiptap/ProseMirror
      // toolbar gotcha. Without this, a command could apply to the wrong node (confirmed: toggling
      // Bullet list right after pressing Enter for a new line wrapped the *previous* paragraph
      // instead of the one the cursor was actually in). Preventing default here keeps the
      // editor's DOM selection intact so the command sees the real, current selection.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={!!active}
      className="min-w-[1.75rem] rounded border border-border px-1.5 py-1 text-xs transition-colors hover:border-[var(--accent)]"
      style={active ? { background: "var(--accent)", color: "var(--accent-foreground)" } : undefined}
    >
      {label}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="mx-0.5 h-4 w-px shrink-0 bg-border" />;
}
