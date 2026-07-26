"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import type { AnchorNodeOptions } from "./AnchorNodeExtension";

/** NodeView for the Notebook's embedded anchor pill — clicking it navigates the reader to the
 *  anchored chapter/halakha (see AnchorNodeExtension's `onNavigate` option, wired by
 *  NotebookPanel.tsx to Reader.tsx's navigateToAnchor). Rendered inline so it sits within a line
 *  of prose like a link, not as a block. */
export default function AnchorPill({ node, extension }: NodeViewProps) {
  const { onNavigate } = extension.options as AnchorNodeOptions;

  return (
    <NodeViewWrapper as="span" className="notebook-anchor-pill" contentEditable={false}>
      <button
        type="button"
        onClick={() => onNavigate(node.attrs.anchor)}
        title="Jump to this location in the reader"
      >
        📍 {node.attrs.label}
      </button>
    </NodeViewWrapper>
  );
}
