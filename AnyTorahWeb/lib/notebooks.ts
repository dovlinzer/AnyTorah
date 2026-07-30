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
import { syncArrayDiff, reconcileArray } from "./supabase/sync";

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
  /** ISO 8601, set once at first save and never touched again — determines which notebook is the
   *  permanently-free one under the subscription paywall (see supabase/migrations/
   *  004_user_notebooks.sql and lib/notebookAccess.ts). Optional only because notebooks saved
   *  before this field existed don't have it — callers sorting by creation order should fall back
   *  to updatedAt for those. */
  createdAt?: string;
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
  const previous = Object.values(store);
  const scopeKey = notebookScopeKey(scope);
  const existing = store[scopeKey];
  store[scopeKey] = {
    scopeKey,
    scope,
    bodyJSON,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveStore(store);
  syncArrayDiff("user_notebooks", previous, Object.values(store), (n) => n.scopeKey, "scope_key");
}

/** Same reconcile-on-load pattern as lib/bookmarks.ts's loadAndReconcileBookmarks — see
 *  lib/supabase/sync.ts for the merge rule. A locked (non-free, unsubscribed) notebook's row is
 *  invisible via Supabase's RLS policy even to its own owner, so this only ever pulls in whatever
 *  the current subscription status actually grants; pushing a local-only locked notebook up will
 *  fail silently (logged, not thrown) and it simply stays local-only until unlocked. */
export async function loadAndReconcileNotebooks(): Promise<Notebook[]> {
  const local = loadNotebooks();
  const merged = await reconcileArray("user_notebooks", local, (n) => n.scopeKey, "scope_key");
  const store: NotebookStore = {};
  for (const notebook of merged) store[notebook.scopeKey] = notebook;
  saveStore(store);
  return merged;
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
 *  scrollIntoView it directly. `quoteHe`/`quoteEn` (additive, Phase A's expand-in-place snapshot)
 *  are surfaced here too so the Source Sheet Builder (Phase C) can reuse the same captured quote
 *  AnchorPill already shows, rather than re-fetching anything. */
export function extractAnchors(
  doc: JSONContent,
): { anchor: TextAnchor; nodeId: string; label: string; quoteHe?: string; quoteEn?: string }[] {
  const found: { anchor: TextAnchor; nodeId: string; label: string; quoteHe?: string; quoteEn?: string }[] = [];
  function walk(node: JSONContent) {
    if (isAnchorNode(node)) {
      found.push({
        anchor: node.attrs!.anchor as TextAnchor,
        nodeId: node.attrs!.nodeId as string,
        label: node.attrs!.label as string,
        quoteHe: (node.attrs!.quoteHe as string | null) ?? undefined,
        quoteEn: (node.attrs!.quoteEn as string | null) ?? undefined,
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
 *  the DOM id TagChip's NodeView renders, same scrollIntoView pattern as extractAnchors.
 *  `sourceNodeIds` (source-sheet association, see extractTaggedAnchors below) is present only on
 *  tags created via AnchorPill's "tag this source" control — a tag inserted via the general 🏷
 *  toolbar button has none, and is just a plain unassociated notebook tag. */
export function extractTags(doc: JSONContent): { tagId: string; label: string; sourceNodeIds?: string[] }[] {
  const found: { tagId: string; label: string; sourceNodeIds?: string[] }[] = [];
  function walk(node: JSONContent) {
    if (isTagNode(node)) {
      found.push({
        tagId: node.attrs!.tagId as string,
        label: node.attrs!.label as string,
        sourceNodeIds: (node.attrs!.sourceNodeIds as string[] | null) ?? undefined,
      });
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

// --- Source-sheet association (Phase B) ---------------------------------------------------
//
// Source sheets (design doc discussed with the user, not yet built beyond this plumbing) need to
// resolve, for a given anchor, which color-tier and which tags apply to it. Color is by
// *containment* (an anchor sitting inside/alongside a sectionColor-marked range in the same
// block) — unambiguous, since a color mark already spans a range. Tags are by *explicit*
// association only (AnchorPill's "tag this source" control stamps a new tag chip's
// `sourceNodeIds` with the anchor's `nodeId`) — deliberately not a proximity guess, so the same
// visual action never silently behaves differently depending on how many anchors happen to sit
// in the same paragraph. Both need a notion of "the block an anchor lives in" (a paragraph/
// heading — whatever directly holds inline content: text, anchor, and tag nodes), which the
// three helpers below share via one internal walker.

interface NotebookBlockContext {
  anchors: { anchor: TextAnchor; nodeId: string; label: string }[];
  tags: { tagId: string; label: string; sourceNodeIds?: string[] }[];
  coloredRuns: { colorIndex: number; text: string }[];
  /** Plain prose in the block — literal text only, excluding anchor/tag label text. This is what
   *  "notes" means for a notebook-derived source-sheet entry (see getAnchorNotes). */
  plainText: string;
}

/** A paragraph/heading (or similar) holds inline content — text, anchor, and tag nodes — directly
 *  in its own `content` array. Blockquotes/list items instead hold block children (paragraphs),
 *  so this is false for them and the walk below recurses into their paragraphs instead. */
function isInlineContentNode(node: JSONContent): boolean {
  return !!node.content?.some((c) => c.type === "text" || isAnchorNode(c) || isTagNode(c));
}

function collectBlockContext(node: JSONContent): NotebookBlockContext {
  const ctx: NotebookBlockContext = { anchors: [], tags: [], coloredRuns: [], plainText: "" };
  for (const child of node.content ?? []) {
    if (isAnchorNode(child)) {
      ctx.anchors.push({
        anchor: child.attrs!.anchor as TextAnchor,
        nodeId: child.attrs!.nodeId as string,
        label: child.attrs!.label as string,
      });
    } else if (isTagNode(child)) {
      ctx.tags.push({
        tagId: child.attrs!.tagId as string,
        label: child.attrs!.label as string,
        sourceNodeIds: (child.attrs!.sourceNodeIds as string[] | null) ?? undefined,
      });
    } else if (child.type === "text" && child.text) {
      const mark = child.marks?.find((m) => m.type === "sectionColor");
      const colorIndex = mark?.attrs?.colorIndex;
      if (typeof colorIndex === "number") ctx.coloredRuns.push({ colorIndex, text: child.text });
      ctx.plainText += (ctx.plainText ? " " : "") + child.text;
    }
  }
  return ctx;
}

function walkNotebookBlocks(doc: JSONContent, visit: (ctx: NotebookBlockContext) => void) {
  function walk(node: JSONContent) {
    if (isInlineContentNode(node)) {
      visit(collectBlockContext(node));
      return;
    }
    node.content?.forEach(walk);
  }
  walk(doc);
}

/** Every block (paragraph/heading/etc.) in the doc, in document order — a flat list rather than a
 *  visitor, so a caller can look at a block's *neighbors*, not just find one block and stop. Used
 *  by getAnchorNotes below to expand a "highlighted section" across block boundaries: a
 *  sectionColor mark is inline and block-scoped in the document model, so a user coloring text
 *  that visually spans a heading + the paragraph(s) under it (or several paragraphs) actually
 *  produces several sibling blocks each independently carrying part of that color — not one block
 *  with a long colored run. */
function collectAllBlocks(doc: JSONContent): NotebookBlockContext[] {
  const blocks: NotebookBlockContext[] = [];
  walkNotebookBlocks(doc, (ctx) => blocks.push(ctx));
  return blocks;
}

/** The color-tier for a given anchor, by containment: the colorIndex of any sectionColor-marked
 *  text in the same block as the anchor, or null if the anchor's block has no colored text (or
 *  the anchor isn't found at all). If a block somehow carries more than one distinct color (an
 *  unusual case — SectionColorExtension applies one color per selection, not per block), the
 *  first one encountered wins; there's no principled way to prefer one over another. */
export function getAnchorColor(doc: JSONContent, nodeId: string): number | null {
  let result: number | null = null;
  walkNotebookBlocks(doc, (ctx) => {
    if (result !== null) return;
    if (ctx.anchors.some((a) => a.nodeId === nodeId) && ctx.coloredRuns.length > 0) {
      result = ctx.coloredRuns[0].colorIndex;
    }
  });
  return result;
}

/** The user-authored prose sharing an anchor's "highlighted section," excluding the anchor's own
 *  label and any tag-chip labels — this is the "notes" text for a notebook-derived source-sheet
 *  entry (see the "include notes" design decision), distinct from the anchor's own captured quote
 *  (AnchorNodeExtension's quoteHe/quoteEn — the source, not the note about it).
 *
 *  When the anchor's own block has a `sectionColor`-marked range (the same one `getAnchorColor`
 *  resolves the anchor's color-tier from), notes expand to *every contiguous block* carrying that
 *  color — not just the one block the anchor happens to sit in. A `sectionColor` mark is inline
 *  and block-scoped in the underlying document model, so a highlighted section that visually spans
 *  a heading plus the paragraph(s) under it (or several paragraphs) is actually several sibling
 *  blocks each independently carrying part of that color, not one block with one long colored run
 *  — a real gap found live: a heading-only or single-short-run block was returned as "the notes"
 *  instead of the full multi-paragraph highlighted section around it. Expansion walks outward from
 *  the anchor's own block, in document order, stopping at the first block (in each direction) with
 *  no run of that color — only the colored portions of each block are included, not any of that
 *  block's other, uncolored prose. Without a color at all, notes fall back to the anchor's own
 *  block's whole plain text, unchanged from before this expansion existed. */
export function getAnchorNotes(doc: JSONContent, nodeId: string): string {
  const blocks = collectAllBlocks(doc);
  const anchorIndex = blocks.findIndex((b) => b.anchors.some((a) => a.nodeId === nodeId));
  if (anchorIndex === -1) return "";

  const anchorBlock = blocks[anchorIndex];
  if (anchorBlock.coloredRuns.length === 0) return anchorBlock.plainText.trim();

  const colorIndex = anchorBlock.coloredRuns[0].colorIndex;
  const coloredText = (ctx: NotebookBlockContext) =>
    ctx.coloredRuns
      .filter((r) => r.colorIndex === colorIndex)
      .map((r) => r.text)
      .join(" ");

  const parts = [coloredText(anchorBlock)];
  for (let i = anchorIndex - 1; i >= 0; i--) {
    if (!blocks[i].coloredRuns.some((r) => r.colorIndex === colorIndex)) break;
    parts.unshift(coloredText(blocks[i]));
  }
  for (let i = anchorIndex + 1; i < blocks.length; i++) {
    if (!blocks[i].coloredRuns.some((r) => r.colorIndex === colorIndex)) break;
    parts.push(coloredText(blocks[i]));
  }
  return parts.join(" ").trim();
}

/** Joins tag chips to the anchor(s) they were explicitly created to tag (TagNodeExtension's
 *  `sourceNodeIds`, stamped only by AnchorPill's "tag this source" control — see the module
 *  comment above). A tag whose `sourceNodeIds` points at an anchor that's since been deleted is
 *  silently dropped (an honest, accepted gap, not an error) rather than surfaced as broken. Feeds
 *  the Source Sheet Builder's tag+color query directly. */
export function extractTaggedAnchors(
  doc: JSONContent,
): { tag: { tagId: string; label: string }; anchor: ReturnType<typeof extractAnchors>[number] }[] {
  const tags = extractTags(doc);
  const anchorsById = new Map(extractAnchors(doc).map((a) => [a.nodeId, a] as const));
  const result: { tag: { tagId: string; label: string }; anchor: ReturnType<typeof extractAnchors>[number] }[] = [];
  for (const t of tags) {
    for (const nodeId of t.sourceNodeIds ?? []) {
      const anchor = anchorsById.get(nodeId);
      if (anchor) result.push({ tag: { tagId: t.tagId, label: t.label }, anchor });
    }
  }
  return result;
}
