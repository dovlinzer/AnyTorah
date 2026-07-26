"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
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
  loadNotebook,
  saveNotebook,
  type NotebookScope,
} from "@/lib/notebooks";
import { formatAnchorLabel, type TextAnchor } from "@/lib/textAnchor";
import { HIGHLIGHT_CATEGORY_COUNT, loadHighlightCategoryLabels } from "@/lib/highlightCategories";

const AUTOSAVE_DELAY_MS = 500;

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
  scopeOptions,
  onScopeChange,
  onNavigateAnchor,
  onEditorReady,
  onClose,
  initialSearchTerm,
  onInitialSearchConsumed,
}: {
  scope: NotebookScope;
  /** Wherever the reader currently is, within this notebook's scope's book/tractate — drives
   *  reverse sync: scrolling to and flashing whichever anchor pill(s) match. Anchor matching is
   *  chapter/halakha granularity only, same limitation as anchor *navigation* itself (see
   *  navigateToAnchor in Reader.tsx) — this app has no scroll-to-segment infrastructure. */
  readerChapter: number;
  readerHalakha?: number;
  scopeOptions: NotebookScopeOption[];
  onScopeChange: (option: NotebookScopeOption) => void;
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
  const [findMatchInfo, setFindMatchInfo] = useState({ count: 0, index: -1 });
  const findInputRef = useRef<HTMLInputElement>(null);
  const [colorLabels] = useState<string[]>(() => loadHighlightCategoryLabels());

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
    onUpdate: ({ editor }) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveNotebook(scope, editor.getJSON());
      }, AUTOSAVE_DELAY_MS);
    },
    onTransaction: ({ editor }) => {
      setFindMatchInfo({
        count: editor.storage.notebookSearch.results.length,
        index: editor.storage.notebookSearch.resultIndex,
      });
    },
  });

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
        .insertAnchor({ anchor, nodeId: crypto.randomUUID(), label: formatAnchorLabel(anchor) })
        .insertContent(" ")
        .run();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onEditorReady ref is set once editor exists
  }, [editor]);

  // Reverse sync — scroll to and briefly flash whichever anchor pill(s) match wherever the
  // reader currently is. Runs on mount too (matching "always showing the matching notebook"),
  // not just on subsequent navigation, since Reader.tsx remounts this component fresh whenever
  // scope changes (key={notebookScopeKey(scope)}).
  useEffect(() => {
    if (!editor) return;
    const matches = extractAnchors(editor.getJSON()).filter(
      (a) => a.anchor.chapter === readerChapter && (a.anchor.halakha ?? undefined) === (readerHalakha ?? undefined),
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
  }, [editor, readerChapter, readerHalakha]);

  const currentOptionLabel =
    scopeOptions.find(
      (o) => o.source === scope.source && (o.commentaryType ?? undefined) === (scope.commentaryType ?? undefined),
    )?.label ?? "Main text";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border p-2">
        <select
          value={JSON.stringify({ source: scope.source, commentaryType: scope.commentaryType ?? null })}
          onChange={(e) => {
            const parsed = JSON.parse(e.target.value) as { source: NotebookScope["source"]; commentaryType: string | null };
            const option = scopeOptions.find(
              (o) => o.source === parsed.source && (o.commentaryType ?? null) === parsed.commentaryType,
            );
            if (option) onScopeChange(option);
          }}
          className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
          aria-label="Notebook scope"
        >
          {scopeOptions.map((o) => (
            <option
              key={`${o.source}:${o.commentaryType ?? ""}`}
              value={JSON.stringify({ source: o.source, commentaryType: o.commentaryType ?? null })}
            >
              {o.label}
            </option>
          ))}
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
              if (!next) editor?.commands.setSearchTerm("");
              return next;
            });
            requestAnimationFrame(() => findInputRef.current?.focus());
          }}
          active={findOpen}
        />
      </div>

      {findOpen && (
        <div className="flex shrink-0 items-center gap-1 border-b border-border p-1.5">
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
                editor?.commands.setSearchTerm("");
              }
            }}
            placeholder="Find in notebook…"
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
              editor?.commands.setSearchTerm("");
            }}
            aria-label="Close find"
            title="Close find"
            className="shrink-0 rounded px-1.5 py-1 text-xs opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      <p className="shrink-0 px-2 pt-1.5 text-[10px] opacity-50">Notebook — {currentOptionLabel}</p>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <EditorContent editor={editor} className="notebook-editor-content h-full text-sm" />
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
