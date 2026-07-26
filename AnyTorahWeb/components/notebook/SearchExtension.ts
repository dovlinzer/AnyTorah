// In-document find for the Notebook editor — a small, self-contained ProseMirror plugin (no
// official Tiptap search extension ships in this version) that decorates every case-insensitive
// text match for the current search term and moves the editor's selection to whichever one is
// "active", scrolling it into view. Cross-notebook search (searching *between* notebooks, not
// within one) lives separately in lib/notebooks.ts's extractPlainText + NotebookSearchModal.tsx.
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
  results: SearchMatch[];
  resultIndex: number;
}

const SearchPluginKey = new PluginKey("notebookSearch");

function findMatches(doc: ProseMirrorNode, term: string): SearchMatch[] {
  const q = term.trim().toLowerCase();
  if (!q) return [];
  const results: SearchMatch[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text.toLowerCase();
    let idx = text.indexOf(q);
    while (idx !== -1) {
      results.push({ from: pos + idx, to: pos + idx + q.length });
      idx = text.indexOf(q, idx + 1);
    }
  });
  return results;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    notebookSearch: {
      /** Sets the term, recomputes matches, and jumps to the first one. Empty string clears. */
      setSearchTerm: (term: string) => ReturnType;
      goToNextMatch: () => ReturnType;
      goToPreviousMatch: () => ReturnType;
    };
  }
  interface Storage {
    notebookSearch: SearchStorage;
  }
}

/** `getMatchInfo()` reads live off `storage`, so a toolbar can show "2 / 5" without re-running
 *  the search itself. */
const SearchExtension = Extension.create({
  name: "notebookSearch",

  addStorage(): SearchStorage {
    return { searchTerm: "", results: [], resultIndex: -1 };
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

    return {
      setSearchTerm:
        (term: string) =>
        ({ editor, tr, dispatch }) => {
          this.storage.searchTerm = term;
          this.storage.results = findMatches(editor.state.doc, term);
          this.storage.resultIndex = this.storage.results.length > 0 ? 0 : -1;
          if (dispatch) {
            jumpToActiveMatch(tr);
            dispatch(tr);
          }
          return true;
        },
      goToNextMatch:
        () =>
        ({ editor, tr, dispatch }) => {
          this.storage.results = findMatches(editor.state.doc, this.storage.searchTerm);
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
          this.storage.results = findMatches(editor.state.doc, this.storage.searchTerm);
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
