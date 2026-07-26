// Local-storage notebooks — one long-form rich-text document per "book scope" (a work's main
// text, or a specific commentary on it), with embedded navigation anchors (see
// components/notebook/AnchorNodeExtension.ts) linking passages of the notebook to specific
// locations in the reader. Stores Tiptap/ProseMirror document JSON, not HTML — the Anchor node
// needs to round-trip losslessly and be programmatically scannable (extractAnchors below), which
// is native to the JSON doc model but awkward to do reliably by re-parsing HTML strings.
import type { JSONContent } from "@tiptap/core";
import type { ReaderCategory } from "./commentaryPools";
import {
  displayName as commentaryDisplayName,
  hebrewDisplayName as hebrewCommentaryDisplayName,
  type CommentaryType,
} from "./commentaryTypes";
import type { AnchorSource, TextAnchor } from "./textAnchor";
import { getCategoryItemName, getCategoryDisplayName } from "./categoryCatalog";

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

/** Human-readable label for a notebook's scope, e.g. "Tosafot on Gittin" / "Bavli, Gittin", or in
 *  Hebrew mode "תוספות על גיטין" / "בבלי, גיטין" — used by the cross-notebook search modal
 *  (NotebookSearchModal.tsx), which lists notebooks across every book/tractate at once and so
 *  can't rely on Reader.tsx's own scope-option labels (those are scoped to whatever's currently
 *  selected), and by NotebookPanel.tsx's own header/dropdown for the current scope. No chapter in
 *  the label — a Notebook is scoped to a whole book/commentary, not a chapter (see NotebookScope).
 *  Tanakh's book names are unambiguous on their own (no category prefix); every other category
 *  can share a tractate/work name across categories (e.g. "Pesachim" in both Mishnah and Talmud),
 *  so those get a category prefix. */
export function formatNotebookScopeLabel(scope: NotebookScope, hebrewMode = false): string {
  const bookName = getCategoryItemName(scope.category, scope.index, hebrewMode);
  if (scope.source === "commentary" && scope.commentaryType) {
    const commentaryName = hebrewMode
      ? hebrewCommentaryDisplayName[scope.commentaryType]
      : commentaryDisplayName[scope.commentaryType];
    return hebrewMode ? `${commentaryName} על ${bookName}` : `${commentaryName} on ${bookName}`;
  }
  if (scope.category === "tanakh") return bookName;
  return `${getCategoryDisplayName(scope.category, hebrewMode)}, ${bookName}`;
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

function isTagNode(node: JSONContent): boolean {
  return node.type === "tag" && !!node.attrs;
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

/** Walks a notebook doc for embedded tag chips (components/notebook/TagNodeExtension.ts) — used
 *  by cross-notebook search to filter/jump to a specific tagged passage, and to build the set of
 *  distinct tags in use across all notebooks for the search modal's filter row. `tagId` matches
 *  the DOM id TagChip's NodeView renders, same scrollIntoView pattern as extractAnchors. */
export function extractTags(doc: JSONContent): { tagId: string; label: string }[] {
  const found: { tagId: string; label: string }[] = [];
  function walk(node: JSONContent) {
    if (isTagNode(node)) {
      found.push({ tagId: node.attrs!.tagId as string, label: node.attrs!.label as string });
    }
    node.content?.forEach(walk);
  }
  walk(doc);
  return found;
}

/** Walks a notebook doc for every run of text carrying a `sectionColor` mark (see
 *  components/notebook/SectionColorExtension.ts) — used by the cross-notebook search modal to
 *  filter to (and preview) notebooks with a passage highlighted in a given color, the same 4
 *  colors reader Highlights use (lib/highlightCategories.ts). Colored text is already plain text
 *  content, so it's already covered by extractPlainText's own substring search — this is only
 *  for the *color-specific* filter, not general search. */
export function extractColoredRuns(doc: JSONContent): { colorIndex: number; text: string }[] {
  const found: { colorIndex: number; text: string }[] = [];
  function walk(node: JSONContent) {
    if (node.type === "text" && node.text) {
      const mark = node.marks?.find((m) => m.type === "sectionColor");
      const colorIndex = mark?.attrs?.colorIndex;
      if (typeof colorIndex === "number") found.push({ colorIndex, text: node.text });
    }
    node.content?.forEach(walk);
  }
  walk(doc);
  return found;
}

/** Flattens a notebook doc to plain text, for cross-notebook search (lib/notebooks.ts callers)
 *  — anchor pills and tag chips contribute their label text so a search for "Gittin" or a tag
 *  name also matches notebooks that only reference it via an embedded node, not just prose. */
export function extractPlainText(doc: JSONContent): string {
  const parts: string[] = [];
  function walk(node: JSONContent) {
    if (node.type === "text" && node.text) parts.push(node.text);
    if (isAnchorNode(node) && node.attrs?.label) parts.push(node.attrs.label as string);
    if (isTagNode(node) && node.attrs?.label) parts.push(node.attrs.label as string);
    node.content?.forEach(walk);
  }
  walk(doc);
  return parts.join(" ");
}
