/**
 * Anchor-based page-number lookup, for Table of Contents support.
 *
 * A node opts in with an `anchor` prop (a string key). After pagination —
 * once every page is known, including pages from conditional sections — we
 * walk the full pages[] array and build a `Map<anchorKey, {pageNumber,
 * totalPages}>` recording the FIRST page each anchor appears on. That map is
 * threaded into the draw phase as a `pageOf(key)` function, exposed on the
 * Text `render` prop, so content drawn on an earlier page (a ToC) can
 * resolve the eventual page number of content drawn later.
 *
 * This mirrors bookmarks.ts's identity-stamping technique (a node spanning a
 * page break becomes several PDFNode copies, one per page, so a stable id
 * must be stamped before pagination for them to share identity) but differs
 * from it in when the lookup is built: emitBookmarks runs lazily inside the
 * draw loop (bookmarks only ever need same-or-earlier-page info), while
 * buildAnchorIndex runs eagerly, once, before any page is drawn — required
 * for the forward-reference case a ToC needs.
 */
import type { PDFNode } from '../types/pdf.js';
/**
 * Stamps a stable, document-ordered id onto every anchored node BEFORE
 * pagination, so the copies pagination makes share one identity for dedup.
 *
 * Must run on the original document tree (pre-pagination) — running it after
 * pagination would give each page's copy a different id and defeat dedup.
 */
export declare function assignAnchorIds(root: PDFNode): void;
export interface AnchorEntry {
    pageNumber: number;
    totalPages: number;
}
/**
 * Walks the paginated pages[] array once and records the first page each
 * anchor key appears on. `__anchorId` distinguishes a node's own repeated
 * page-copy (spanning / fixed — dedup silently) from a genuine collision:
 * two different nodes reusing the same anchor string, which would silently
 * produce a wrong page number, so it's surfaced with a warning.
 */
export declare function buildAnchorIndex(pages: PDFNode[]): Map<string, AnchorEntry>;
