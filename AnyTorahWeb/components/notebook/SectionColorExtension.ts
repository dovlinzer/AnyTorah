// Inline highlight-color mark for notebook text — lets the user paint a run of selected text
// with one of the same 4 colors used for reader Highlights (lib/highlightCategories.ts), so a
// notebook can visually organize itself into color-coded sections the same way a real highlighter
// would (e.g. yellow for halakhic conclusions, blue for open questions). Deliberately reuses the
// reader's color set/labels rather than a separate palette, for visual consistency between the
// two features — a color means the same thing whether it's on a verse or in a notebook.
import { Mark, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    sectionColor: {
      setSectionColor: (colorIndex: number) => ReturnType;
      unsetSectionColor: () => ReturnType;
    };
  }
}

const SectionColorExtension = Mark.create({
  name: "sectionColor",

  addAttributes() {
    return {
      colorIndex: {
        default: 0,
        parseHTML: (element) => Number(element.getAttribute("data-color-index")) || 0,
        renderHTML: (attributes) => ({ "data-color-index": attributes.colorIndex }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-color-index]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const colorIndex = HTMLAttributes["data-color-index"] ?? 0;
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: `notebook-section-color-${colorIndex}` }),
      0,
    ];
  },

  addCommands() {
    return {
      // Unset-then-set (rather than a plain toggle) so clicking a different color swatch while
      // some other color is already active on the selection always applies the newly-clicked
      // color, matching how HighlightColorPicker's swatches behave for reader highlights (pick a
      // color, don't toggle it) — the ✕ swatch is the dedicated "remove" action.
      setSectionColor:
        (colorIndex: number) =>
        ({ chain }) =>
          chain().unsetMark(this.name).setMark(this.name, { colorIndex }).run(),
      unsetSectionColor:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});

export default SectionColorExtension;
