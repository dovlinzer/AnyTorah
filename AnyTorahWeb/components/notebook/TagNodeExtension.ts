// Inline "tag chip" node embedded in a Notebook document — marks a specific point/section with a
// short label (e.g. "open question", "halakha lemaaseh"), mirroring AnchorNodeExtension's shape
// (plain JSON attrs, not HTML, so it round-trips losslessly and is scannable without HTML
// parsing). Distinct from Highlights' whole-record tags (lib/highlights.ts) — this tags a point
// *within* one long notebook document, which is what makes cross-notebook search able to jump
// straight to the tagged passage rather than just the top of the matching document.
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import TagChip from "./TagChip";

export interface TagNodeOptions {
  onDelete?: (tagId: string) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tag: {
      insertTag: (attrs: {
        tagId: string;
        label: string;
        /** Source-sheet association (see lib/notebooks.ts's extractTaggedAnchors) — the
         *  nodeId(s) of the anchor(s) this tag was explicitly created to tag, stamped only by
         *  AnchorPill's "tag this source" control. A tag inserted via the general 🏷 toolbar
         *  button omits this — it's just a plain, unassociated notebook tag. */
        sourceNodeIds?: string[];
      }) => ReturnType;
    };
  }
}

const TagNodeExtension = Node.create<TagNodeOptions>({
  name: "tag",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      tagId: { default: null },
      label: { default: "" },
      sourceNodeIds: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-tag-node="true"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-tag-node": "true" }), HTMLAttributes.label ?? ""];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TagChip);
  },

  addCommands() {
    return {
      insertTag:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});

export default TagNodeExtension;
