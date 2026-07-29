"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

/** NodeView for a per-section tag chip — a small inline label with its own delete affordance
 *  (✕), since unlike the anchor pill there's no other editor action that removes just this node.
 *  `node.attrs.tagId` is stable across edits/reloads so cross-notebook search results can jump to
 *  the exact chip's DOM position (extractTags in lib/notebooks.ts). A tag stamped with
 *  `sourceNodeIds` (created via AnchorPill's "tag this source" control, not the general 🏷
 *  toolbar button) gets a small 📍 suffix so it reads as "linked to a source" at a glance —
 *  distinct from a plain, unassociated notebook tag. */
export default function TagChip({ node, deleteNode }: NodeViewProps) {
  const sourceNodeIds = node.attrs.sourceNodeIds as string[] | null;
  const isSourced = Boolean(sourceNodeIds?.length);
  return (
    <NodeViewWrapper
      as="span"
      id={node.attrs.tagId}
      className="notebook-tag-chip"
      contentEditable={false}
      title={isSourced ? "Tag linked to a source" : undefined}
    >
      🏷 {node.attrs.label}
      {isSourced && <span aria-hidden="true"> 📍</span>}
      <button type="button" onClick={() => deleteNode()} aria-label={`Remove tag ${node.attrs.label}`} title="Remove tag">
        ✕
      </button>
    </NodeViewWrapper>
  );
}
