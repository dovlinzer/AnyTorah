// Local-storage notebooks — one long-form rich-text document per "book scope" (a work's main
// text, or a specific commentary on it), with embedded navigation anchors (see
// components/notebook/AnchorNodeExtension.ts) linking passages of the notebook to specific
// locations in the reader. Stores Tiptap/ProseMirror document JSON, not HTML — the Anchor node
// needs to round-trip losslessly and be programmatically scannable (extractAnchors below), which
// is native to the JSON doc model but awkward to do reliably by re-parsing HTML strings.
import type { JSONContent } from "@tiptap/core";
import type { ReaderCategory } from "./commentaryPools";
import type { CommentaryType } from "./commentaryTypes";
import type { AnchorSource, TextAnchor } from "./textAnchor";

export interface NotebookScope {
  category: ReaderCategory;
  index: number;
  source: AnchorSource;
  /** Set only when source === "commentary". */
  commentaryType?: CommentaryType;
}

export interface Notebook {
  /** Derived from NotebookScope — also the lookup/storage key. */
  scopeKey: string;
  scope: NotebookScope;
  bodyJSON: JSONContent;
  updatedAt: string; // ISO 8601
}

export function notebookScopeKey(scope: NotebookScope): string {
  return `${scope.category}:${scope.index}:${scope.source}:${scope.commentaryType ?? ""}`;
}

/** Empty Tiptap doc — a single empty paragraph, the shape `editor.getJSON()` produces for a
 *  blank editor, so a freshly created Notebook round-trips through setContent identically to
 *  one that's been typed in and cleared. */
export function emptyNotebookBody(): JSONContent {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

const STORAGE_KEY = "anytorah:notebooks";

interface NotebookStore {
  [scopeKey: string]: Notebook;
}

function loadStore(): NotebookStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NotebookStore) : {};
  } catch {
    return {};
  }
}

function saveStore(store: NotebookStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage unavailable (private browsing, quota) — notebook just won't persist.
  }
}

export function loadNotebooks(): Notebook[] {
  return Object.values(loadStore());
}

export function loadNotebook(scope: NotebookScope): Notebook | undefined {
  return loadStore()[notebookScopeKey(scope)];
}

export function saveNotebook(scope: NotebookScope, bodyJSON: JSONContent) {
  const store = loadStore();
  const scopeKey = notebookScopeKey(scope);
  store[scopeKey] = { scopeKey, scope, bodyJSON, updatedAt: new Date().toISOString() };
  saveStore(store);
}

function isAnchorNode(node: JSONContent): boolean {
  return node.type === "anchor" && !!node.attrs;
}

/** Walks a notebook doc for embedded Anchor nodes — used by cross-notebook search and by the
 *  reader→notebook scroll-sync (finding which anchor, if any, matches the current reading
 *  position). `nodeId` matches the DOM id AnchorNodeExtension's NodeView renders, so a caller can
 *  scrollIntoView it directly. */
export function extractAnchors(doc: JSONContent): { anchor: TextAnchor; nodeId: string; label: string }[] {
  const found: { anchor: TextAnchor; nodeId: string; label: string }[] = [];
  function walk(node: JSONContent) {
    if (isAnchorNode(node)) {
      found.push({
        anchor: node.attrs!.anchor as TextAnchor,
        nodeId: node.attrs!.nodeId as string,
        label: node.attrs!.label as string,
      });
    }
    node.content?.forEach(walk);
  }
  walk(doc);
  return found;
}

/** Flattens a notebook doc to plain text, for cross-notebook search (lib/notebooks.ts callers)
 *  — anchor pills contribute their label text so a search for "Gittin" also matches notebooks
 *  that only reference it via an anchor, not just prose mentioning it. */
export function extractPlainText(doc: JSONContent): string {
  const parts: string[] = [];
  function walk(node: JSONContent) {
    if (node.type === "text" && node.text) parts.push(node.text);
    if (isAnchorNode(node) && node.attrs?.label) parts.push(node.attrs.label as string);
    node.content?.forEach(walk);
  }
  walk(doc);
  return parts.join(" ");
}
