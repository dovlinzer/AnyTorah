"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import AnchorNodeExtension from "./notebook/AnchorNodeExtension";
import IndentExtension from "./notebook/IndentExtension";
import TextDirectionExtension from "./notebook/TextDirectionExtension";
import {
  emptyNotebookBody,
  loadNotebook,
  saveNotebook,
  type NotebookScope,
} from "@/lib/notebooks";
import { formatAnchorLabel, type TextAnchor } from "@/lib/textAnchor";

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
  scopeOptions,
  onScopeChange,
  onNavigateAnchor,
  onEditorReady,
  onClose,
}: {
  scope: NotebookScope;
  scopeOptions: NotebookScopeOption[];
  onScopeChange: (option: NotebookScopeOption) => void;
  onNavigateAnchor: (anchor: TextAnchor) => void;
  onEditorReady: (insertAnchor: (anchor: TextAnchor) => void) => void;
  onClose: () => void;
}) {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      AnchorNodeExtension.configure({ onNavigate: onNavigateAnchor }),
      IndentExtension,
      TextDirectionExtension,
    ],
    content: loadNotebook(scope)?.bodyJSON ?? emptyNotebookBody(),
    onUpdate: ({ editor }) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveNotebook(scope, editor.getJSON());
      }, AUTOSAVE_DELAY_MS);
    },
  });

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
      </div>

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
