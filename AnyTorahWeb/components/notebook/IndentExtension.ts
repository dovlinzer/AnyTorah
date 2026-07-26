// Paragraph/heading/blockquote indent (margin-left steps) for the Notebook editor's
// Indent/Outdent toolbar buttons. Distinct from list nesting (sinkListItem/liftListItem, already
// provided by StarterKit's ListItem) — NotebookPanel.tsx's indent/outdent handlers use that
// instead whenever the selection is inside a list item, and only fall back to this extension's
// commands for plain paragraphs/headings/blockquotes.
import { Extension, type CommandProps } from "@tiptap/core";

const INDENT_STEP_EM = 1.5;
const INDENT_MAX = 8;
const INDENTABLE_TYPES = ["paragraph", "heading", "blockquote"];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blockIndent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
  }
}

function adjustIndent(direction: 1 | -1) {
  return () =>
    ({ tr, state, dispatch }: CommandProps) => {
      const { from, to } = state.selection;
      let changed = false;
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (!INDENTABLE_TYPES.includes(node.type.name)) return true;
        const current = (node.attrs.indent as number) ?? 0;
        const next = Math.min(INDENT_MAX, Math.max(0, current + direction));
        if (next !== current) {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
          changed = true;
        }
        // Stop descending — an indentable block's own indentable children (e.g. a blockquote's
        // paragraph) shouldn't also get indented, or one Tab press would compound into two.
        return false;
      });
      if (changed && dispatch) dispatch(tr);
      return changed;
    };
}

const IndentExtension = Extension.create({
  name: "blockIndent",

  addGlobalAttributes() {
    return [
      {
        types: INDENTABLE_TYPES,
        attributes: {
          indent: {
            default: 0,
            renderHTML: (attributes) => {
              const level = (attributes.indent as number) ?? 0;
              if (!level) return {};
              return { style: `margin-left: ${level * INDENT_STEP_EM}em` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      indent: adjustIndent(1),
      outdent: adjustIndent(-1),
    };
  },
});

export default IndentExtension;
