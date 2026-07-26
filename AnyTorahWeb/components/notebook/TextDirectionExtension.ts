// Per-block LTR/RTL toggle for the Notebook editor — the user may be writing in English prose but
// inserting a line of Hebrew (or vice versa), so direction is a block-level attribute the user
// flips with a toolbar button, not a fixed document-wide setting.
//
// `setTextDirection`/`unsetTextDirection` are already built into every Tiptap editor (part of
// @tiptap/core's always-included `Commands` core extension, same bundle that supplies `focus`/
// `setContent`/etc. — no extension needed just to call them). What's missing without this
// extension is the `dir` node attribute itself: those commands call `tr.setNodeMarkup` with a
// `dir` key, but ProseMirror silently drops unknown attribute keys not declared in a node's
// schema, so paragraph/heading/blockquote/listItem need to actually declare it via
// `addGlobalAttributes` before the commands' writes have anywhere to land.
import { Extension } from "@tiptap/core";

const DIRECTIONAL_TYPES = ["paragraph", "heading", "blockquote", "listItem"];

const TextDirectionExtension = Extension.create({
  name: "notebookTextDirection",

  addGlobalAttributes() {
    return [
      {
        types: DIRECTIONAL_TYPES,
        attributes: {
          dir: {
            default: null,
            renderHTML: (attributes) => {
              const dir = attributes.dir as "rtl" | "ltr" | "auto" | null;
              if (!dir) return {};
              return { dir, style: `text-align: ${dir === "rtl" ? "right" : "left"}` };
            },
          },
        },
      },
    ];
  },
});

export default TextDirectionExtension;
