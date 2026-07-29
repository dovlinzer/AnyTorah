"use client";

import { useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import type { AnchorNodeOptions } from "./AnchorNodeExtension";

/** NodeView for the Notebook's embedded anchor pill. Two independent controls, each with its own
 *  `stopPropagation` (mirrors HighlightMark.tsx's 📌 button living alongside the highlight's own
 *  click area): the 📍 button navigates the reader to the anchored chapter/halakha (see
 *  AnchorNodeExtension's `onNavigate` option, wired by NotebookPanel.tsx to Reader.tsx's
 *  navigateToAnchor) — unchanged; the ▾/▸ toggle expands/collapses an inline preview of the quote
 *  snapshotted at anchor-creation time (node.attrs.quoteHe/quoteEn), so a user can read the source
 *  without leaving the notebook. Rendered inline so it sits within a line of prose like a link,
 *  not as a block. */
export default function AnchorPill({ node, extension }: NodeViewProps) {
  const { onNavigate } = extension.options as AnchorNodeOptions;
  const [expanded, setExpanded] = useState(false);
  const { quoteHe, quoteEn } = node.attrs as { quoteHe?: string; quoteEn?: string };
  const hasQuote = Boolean(quoteHe || quoteEn);

  return (
    <NodeViewWrapper as="span" id={node.attrs.nodeId} className="notebook-anchor-pill" contentEditable={false}>
      <button
        type="button"
        onClick={() => onNavigate(node.attrs.anchor)}
        title="Jump to this location in the reader"
      >
        📍 {node.attrs.label}
      </button>
      {hasQuote && (
        <button
          type="button"
          className="notebook-anchor-pill-toggle"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          title={expanded ? "Hide source preview" : "Show source preview"}
        >
          {expanded ? "▾" : "▸"}
        </button>
      )}
      {expanded && hasQuote && (
        <span className="notebook-anchor-pill-quote" contentEditable={false}>
          {quoteHe && (
            <span dir="rtl" lang="he" className="notebook-anchor-pill-quote-line">
              {quoteHe}
            </span>
          )}
          {quoteEn && (
            <span dir="ltr" lang="en" className="notebook-anchor-pill-quote-line">
              {quoteEn}
            </span>
          )}
        </span>
      )}
    </NodeViewWrapper>
  );
}
