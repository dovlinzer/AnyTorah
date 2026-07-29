"use client";

import { useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import type { AnchorNodeOptions } from "./AnchorNodeExtension";

/** NodeView for the Notebook's embedded anchor pill. Three independent controls, each with its
 *  own `stopPropagation` (mirrors HighlightMark.tsx's 📌 button living alongside the highlight's
 *  own click area): the 📍 button navigates the reader to the anchored chapter/halakha (see
 *  AnchorNodeExtension's `onNavigate` option, wired by NotebookPanel.tsx to Reader.tsx's
 *  navigateToAnchor) — unchanged; the ▾/▸ toggle expands/collapses an inline preview of the quote
 *  snapshotted at anchor-creation time (node.attrs.quoteHe/quoteEn), so a user can read the source
 *  without leaving the notebook; and a 🏷 "tag this source" button (rendered last, per explicit
 *  user placement request) that inserts a tag chip immediately after the pill, stamped with this
 *  anchor's nodeId (source-sheet association — see lib/notebooks.ts's extractTaggedAnchors — is
 *  deliberately always explicit via this control, never a proximity guess). Rendered inline so it
 *  sits within a line of prose like a link, not as a block. */
export default function AnchorPill({ node, extension, editor, getPos }: NodeViewProps) {
  const { onNavigate } = extension.options as AnchorNodeOptions;
  const [expanded, setExpanded] = useState(false);
  const { quoteHe, quoteEn } = node.attrs as { quoteHe?: string; quoteEn?: string };
  const hasQuote = Boolean(quoteHe || quoteEn);

  const handleTagThisSource = () => {
    const label = window.prompt("Tag name");
    if (!label?.trim()) return;
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor
      .chain()
      .focus()
      .insertContentAt(pos + node.nodeSize, {
        type: "tag",
        attrs: { tagId: crypto.randomUUID(), label: label.trim(), sourceNodeIds: [node.attrs.nodeId] },
      })
      .run();
  };

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
      <button
        type="button"
        className="notebook-anchor-pill-tag"
        onClick={(e) => {
          e.stopPropagation();
          handleTagThisSource();
        }}
        title="Tag this source"
      >
        🏷
      </button>
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
