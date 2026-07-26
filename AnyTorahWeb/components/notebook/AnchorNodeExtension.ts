// Custom Tiptap inline atom node embedded in a Notebook document (lib/notebooks.ts) — a clickable
// pill that jumps the reader to a specific location. Stored as plain JSON attrs (not HTML), so it
// round-trips losslessly through Notebook.bodyJSON and is scannable by extractAnchors/
// extractPlainText without any HTML parsing.
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type { TextAnchor } from "@/lib/textAnchor";
import AnchorPill from "./AnchorPill";

export interface AnchorNodeOptions {
  onNavigate: (anchor: TextAnchor) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    anchor: {
      insertAnchor: (attrs: { anchor: TextAnchor; nodeId: string; label: string }) => ReturnType;
    };
  }
}

const AnchorNodeExtension = Node.create<AnchorNodeOptions>({
  name: "anchor",
  group: "inline",
  inline: true,
  atom: true,

  addOptions() {
    return {
      onNavigate: () => {},
    };
  },

  addAttributes() {
    return {
      anchor: { default: null },
      nodeId: { default: null },
      label: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-anchor-node="true"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-anchor-node": "true" }), HTMLAttributes.label ?? ""];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AnchorPill);
  },

  addCommands() {
    return {
      insertAnchor:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});

export default AnchorNodeExtension;
