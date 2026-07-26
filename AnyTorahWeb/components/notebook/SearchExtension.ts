// In-document find for the Notebook editor — a small, self-contained ProseMirror plugin (no
// official Tiptap search extension ships in this version) that decorates every case-insensitive
// text match for the current search term (also matching tag chip labels, since those aren't
// plain text nodes) and moves the editor's selection to whichever one is "active", scrolling it
// into view. A color filter can additionally restrict/seed matches to text carrying a given
// SectionColorExtension mark, so a user can jump through just the "yellow" passages, with or
// without a text term. Cross-notebook search (searching *between* notebooks, not within one)
// lives separately in lib/notebooks.ts's extractPlainText + NotebookSearchModal.tsx.
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface SearchMatch {
  from: number;
  to: number;
}

interface SearchStorage {
  searchTerm: string;
  /** null = no color filter (plain text search); a HIGHLIGHT_CATEGORY index otherwise — see
   *  lib/highlightCategories.ts, the same 4 colors SectionColorExtension marks text with. */
  colorFilter: number | null;
  results: SearchMatch[];
  resultIndex: number;
}

const SearchPluginKey = new PluginKey("notebookSearch");

/** Every contiguous run of text carrying a `sectionColor` mark of the given index — used both as
 *  the color filter's own match set (no text term) and to restrict text/tag matches to colored
 *  passages (term + filter combined). */
function findColoredRanges(doc: ProseMirrorNode, colorIndex: number): SearchMatch[] {
  const ranges: SearchMatch[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    const mark = node.marks.find((m) => m.type.name === "sectionColor" && m.attrs.colorIndex === colorIndex);
    if (mark) ranges.push({ from: pos, to: pos + node.nodeSize });
  });
  return ranges;
}

function overlaps(a: SearchMatch, b: SearchMatch): boolean {
  return a.from < b.to && b.from < a.to;
}

function findMatches(doc: ProseMirrorNode, term: string, colorFilter: number | null): SearchMatch[] {
  const q = term.trim().toLowerCase();
  const coloredRanges = colorFilter !== null ? findColoredRanges(doc, colorFilter) : null;

  if (!q) {
    // No text term — a color filter alone means "every colored run of this color", otherwise
    // there's nothing to match.
    return coloredRanges ?? [];
  }

  const results: SearchMatch[] = [];
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const text = node.text.toLowerCase();
      let idx = text.indexOf(q);
      while (idx !== -1) {
        results.push({ from: pos + idx, to: pos + idx + q.length });
        idx = text.indexOf(q, idx + 1);
      }
    } else if (node.type.name === "tag" && typeof node.attrs.label === "string" && node.attrs.label.toLowerCase().includes(q)) {
      // Atom node, not text — the whole node is the match, same convention extractAnchors/
      // extractTags (lib/notebooks.ts) already use for "this node is the unit," not a substring
      // range within it.
      results.push({ from: pos, to: pos + node.nodeSize });
    }
  });

  if (!coloredRanges) return results;
  return results.filter((r) => coloredRanges.some((c) => overlaps(r, c)));
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    notebookSearch: {
      /** Sets the term, recomputes matches, and jumps to the first one. Empty string clears
       *  (unless a color filter is also active, in which case it seeds from that instead). */
      setSearchTerm: (term: string) => ReturnType;
      /** null clears the filter back to plain text search. */
      setColorFilter: (colorIndex: number | null) => ReturnType;
      goToNextMatch: () => ReturnType;
      goToPreviousMatch: () => ReturnType;
    };
  }
  interface Storage {
    notebookSearch: SearchStorage;
  }
}

const SearchExtension = Extension.create({
  name: "notebookSearch",

  addStorage(): SearchStorage {
    return { searchTerm: "", colorFilter: null, results: [], resultIndex: -1 };
  },

  addCommands() {
    const jumpToActiveMatch = (tr: import("@tiptap/pm/state").Transaction) => {
      const match = this.storage.results[this.storage.resultIndex];
      if (match) {
        tr.setSelection(TextSelection.create(tr.doc, match.from, match.to));
        tr.scrollIntoView();
      }
      tr.setMeta(SearchPluginKey, true);
    };
    const recompute = (doc: ProseMirrorNode) => {
      this.storage.results = findMatches(doc, this.storage.searchTerm, this.storage.colorFilter);
      this.storage.resultIndex = this.storage.results.length > 0 ? 0 : -1;
    };

    return {
      setSearchTerm:
        (term: string) =>
        ({ editor, tr, dispatch }) => {
          this.storage.searchTerm = term;
          recompute(editor.state.doc);
          if (dispatch) {
            jumpToActiveMatch(tr);
            dispatch(tr);
          }
          return true;
        },
      setColorFilter:
        (colorIndex: number | null) =>
        ({ editor, tr, dispatch }) => {
          this.storage.colorFilter = colorIndex;
          recompute(editor.state.doc);
          if (dispatch) {
            jumpToActiveMatch(tr);
            dispatch(tr);
          }
          return true;
        },
      goToNextMatch:
        () =>
        ({ editor, tr, dispatch }) => {
          this.storage.results = findMatches(editor.state.doc, this.storage.searchTerm, this.storage.colorFilter);
          if (this.storage.results.length === 0) return false;
          this.storage.resultIndex = (this.storage.resultIndex + 1 + this.storage.results.length) % this.storage.results.length;
          if (dispatch) {
            jumpToActiveMatch(tr);
            dispatch(tr);
          }
          return true;
        },
      goToPreviousMatch:
        () =>
        ({ editor, tr, dispatch }) => {
          this.storage.results = findMatches(editor.state.doc, this.storage.searchTerm, this.storage.colorFilter);
          if (this.storage.results.length === 0) return false;
          this.storage.resultIndex = (this.storage.resultIndex - 1 + this.storage.results.length) % this.storage.results.length;
          if (dispatch) {
            jumpToActiveMatch(tr);
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    // A closure (not a `const extensionThis = this` alias) reading `this.storage` live each time
    // it's called — needed because the Plugin's own `state.apply` isn't called with the
    // extension as `this`.
    const getStorage = () => this.storage;
    return [
      new Plugin({
        key: SearchPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            if (!tr.docChanged && !tr.getMeta(SearchPluginKey)) return old.map(tr.mapping, tr.doc);
            const { results, resultIndex } = getStorage();
            const decorations = results.map((r, i) =>
              Decoration.inline(r.from, r.to, {
                class: i === resultIndex ? "notebook-search-match notebook-search-match-active" : "notebook-search-match",
              }),
            );
            return DecorationSet.create(tr.doc, decorations);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state) ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

export default SearchExtension;
