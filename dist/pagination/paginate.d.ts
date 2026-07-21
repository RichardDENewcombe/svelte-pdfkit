/**
 * Pagination — splits Yoga-laid-out page nodes across physical PDF pages.
 *
 * ─── Why this is needed ──────────────────────────────────────────────────────
 *
 * Yoga computes layout treating the <Page> node as a flex container with fixed
 * dimensions (e.g. 595×842 for A4). If content overflows the page height, Yoga
 * still assigns y-coordinates beyond the page boundary rather than stopping —
 * it has no concept of pages. Nodes with layout.y > pageHeight are simply
 * positioned off the bottom of the page.
 *
 * The paginator reads those Yoga-computed positions and partitions the node
 * tree across multiple physical pages.
 *
 * ─── Algorithm ───────────────────────────────────────────────────────────────
 *
 * For each <Page> node:
 *
 *  1. Walk the tree to find contentBottom — the maximum (y + height) of any
 *     descendant. If contentBottom ≤ pageHeight, the page fits and is returned
 *     unchanged.
 *
 *  2. Otherwise, iterate over page slots [0, H), [H, 2H), [2H, 3H) …
 *     For each slot, call sliceNode() on the tree to produce a subtree
 *     containing only nodes that fall within that y-range. Y coordinates are
 *     shifted by -yStart so node positions are relative to each page's origin.
 *
 *  3. Fixed nodes (props.fixed === true) are collected separately and appended
 *     to every output page at their original y coordinates, implementing
 *     repeated headers and footers.
 *
 * ─── Text at page boundaries ─────────────────────────────────────────────────
 *
 * A text node that straddles a page boundary appears on both pages with its
 * adjusted y coordinate. PDFKit clips content at the page edge, so on the
 * first page you see the top portion and on the second the bottom portion.
 * True line-level text splitting (finding the exact line break point) is a
 * future improvement.
 *
 * ─── Margins / safe areas ────────────────────────────────────────────────────
 *
 * Use padding on the <Page> style prop — Yoga enforces it natively, exactly
 * as react-pdf does.  Content that should clear a fixed footer should be
 * matched with a corresponding paddingBottom on the page:
 *
 *   <Page style={{ padding: 40 }}>
 *     <View fixed style={{ position: 'absolute', bottom: 20, ... }}>…</View>
 *   </Page>
 */
import type { DocumentContext, PDFNode } from '../types/pdf.js';
export declare function paginate(doc: DocumentContext): PDFNode[];
