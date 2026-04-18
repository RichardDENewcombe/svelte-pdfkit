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
import { getLineHeight, wrapLines } from '../layout/text-measure.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Minimum gap (in points) automatically preserved between flow content and
 * the top edge of any fixed footer detected on the page.
 */
const FOOTER_CLEARANCE = 15;

// ── Public API ────────────────────────────────────────────────────────────────

export function paginate(doc: DocumentContext): PDFNode[] {
	const result: PDFNode[] = [];
	for (const page of doc.children) {
		if (page.type !== 'page') continue;
		result.push(...paginatePage(page));
	}
	return result;
}

// ── Page padding helpers ──────────────────────────────────────────────────────

/**
 * Returns the resolved paddingTop and paddingBottom for a page node.
 * Individual side values take precedence over the shorthand `padding`.
 */
function getPagePadding(page: PDFNode): { top: number; bottom: number } {
	const s = page.props.style ?? {};
	return {
		top:    s.paddingTop    ?? s.padding ?? 0,
		bottom: s.paddingBottom ?? s.padding ?? 0,
	};
}

/**
 * Scans fixed nodes that sit in the bottom half of the page and returns
 * the minimum paddingBottom needed to keep flow content at least
 * FOOTER_CLEARANCE points above the topmost such footer.
 *
 * This means callers never need to manually tune paddingBottom to account
 * for a fixed footer's height — the paginator does it automatically.
 */
function autoBottomPad(fixedNodes: PDFNode[], pageHeight: number): number {
	let needed = 0;
	for (const node of fixedNodes) {
		if (!node.layout) continue;
		// Only treat nodes whose top edge is in the lower half of the page as
		// footers.  Header nodes (top half) are intentionally excluded.
		if (node.layout.y <= pageHeight / 2) continue;
		// Distance from the page bottom to the top of this footer node,
		// plus the desired clearance gap above it.
		const clearance = (pageHeight - node.layout.y) + FOOTER_CLEARANCE;
		if (clearance > needed) needed = clearance;
	}
	return needed;
}

// ── Page splitting ────────────────────────────────────────────────────────────

function paginatePage(page: PDFNode): PDFNode[] {
	const pageHeight = page.props.height ?? 842;
	const { top: padTop, bottom: explicitPadBottom } = getPagePadding(page);

	// Fixed nodes repeat on every output page at their original y coordinates.
	// Collect them early so we can inspect their layout for auto-padding.
	const fixedNodes = collectFixed(page);

	// Automatically extend paddingBottom to keep flow content at least
	// FOOTER_CLEARANCE points above any fixed footer detected in the bottom
	// half of the page.  Explicit paddingBottom on <Page> is still respected
	// if it is already larger than the computed minimum.
	const padBottom = Math.max(explicitPadBottom, autoBottomPad(fixedNodes, pageHeight));

	// The usable content band per page sits between the padding zones.
	// Yoga has already placed content starting at y=padTop, so on page 0 we
	// simply respect its layout.  On overflow pages we re-apply padTop as a
	// y-offset so each page's content starts in the correct position.
	const contentEnd    = pageHeight - padBottom;   // last y available on page 0
	const contentHeight = contentEnd - padTop;      // usable band on pages 1+

	// Fast path: all content fits within the padding-respecting boundary.
	const contentBottom = getContentBottom(page);
	if (padTop === 0 && contentBottom <= contentEnd) {
		return [page];
	}

	const outputPages: PDFNode[] = [];
	let pageIndex = 0;

	while (true) {
		// Page 0 uses the full Yoga-computed band [0, contentEnd).
		// Pages 1+ use [contentEnd + (N-1)*contentHeight, contentEnd + N*contentHeight).
		const yStart = pageIndex === 0
			? 0
			: contentEnd + (pageIndex - 1) * contentHeight;
		const yEnd = pageIndex === 0
			? contentEnd
			: yStart + contentHeight;
		// On page 0, Yoga already placed content at y=padTop — no adjustment needed.
		// On overflow pages, shift content down by padTop so it lands in the
		// correct position on the new page.
		const yOffset = pageIndex === 0 ? 0 : padTop;

		if (yStart >= contentBottom) break;

		const slicedChildren = page.children
			.filter((c) => !c.props.fixed)
			.map((child) => sliceNode(child, yStart, yEnd, yOffset))
			.filter((c): c is PDFNode => c !== null);

		// Always emit the first page even if empty (a <Page> with no content is
		// valid). Skip empty subsequent pages — they would be blank filler.
		if (slicedChildren.length > 0 || pageIndex === 0) {
			outputPages.push({
				type: 'page',
				props: { ...page.props },
				// Fixed nodes keep their original y coordinates — they are designed
				// to sit at a fixed position (top/bottom of every page).
				children: [...slicedChildren, ...fixedNodes],
				layout: page.layout
			});
		}

		pageIndex++;
	}

	return outputPages;
}

// ── Tree slicing ──────────────────────────────────────────────────────────────

/**
 * Returns a copy of `node` containing only the portion that falls within
 * [yStart, yEnd), with y coordinates adjusted so yStart maps to `yOffset`.
 * Returns null if the node is entirely outside the range.
 *
 * `yOffset` is non-zero on overflow pages when the page has paddingTop: it
 * shifts content down so it starts in the correct padded position on the
 * new page.
 */
function sliceNode(node: PDFNode, yStart: number, yEnd: number, yOffset = 0): PDFNode | null {
	// Fixed nodes are handled separately — exclude from flow slicing.
	if (node.props.fixed) return null;

	const layout = node.layout;
	if (!layout) return null;

	const nodeTop = layout.y;
	const nodeBottom = layout.y + layout.height;

	// Completely above or below this page slot — exclude.
	if (nodeBottom <= yStart || nodeTop >= yEnd) return null;

	// Shift y so it is relative to this page's top edge, then apply the
	// padding offset so content lands in the correct position on overflow pages.
	const adjustedLayout = { ...layout, y: layout.y - yStart + yOffset };

	// ── Text splitting ────────────────────────────────────────────────────────
	// Text nodes that straddle a page boundary are split at the line level so
	// each page shows only the lines that belong to it, rather than clipping
	// the full text at the page edge.
	//
	// Render-prop text (page numbers etc.) is always a short single-line string
	// and is excluded from splitting — we fall through to the leaf path below.
	if (node.type === 'text' && typeof node.props.render !== 'function') {
		const text = node.props.text != null ? String(node.props.text) : '';
		const style = node.props.style ?? {};
		const lineHeight = getLineHeight(style);

		if (lineHeight > 0) {
			const lines = wrapLines(text, style, layout.width);

			// Lines already consumed by previous pages (when the text node started
			// above the current page slot's top boundary).
			const linesBefore =
				nodeTop < yStart ? Math.floor((yStart - nodeTop) / lineHeight) : 0;

			// Top of the visible portion of this text node within this page slot.
			const visibleTop = Math.max(nodeTop, yStart);

			// Lines available in the remaining vertical space on this page.
			const linesAvailable = Math.max(0, Math.floor((yEnd - visibleTop) / lineHeight));

			const pageLines = lines.slice(linesBefore, linesBefore + linesAvailable);

			if (pageLines.length === 0) return null;

			return {
				...node,
				props: { ...node.props, text: pageLines.join('\n') },
				layout: {
					...layout,
					y: visibleTop - yStart + yOffset,
					height: pageLines.length * lineHeight
				}
			};
		}
	}

	// Leaf node — include it directly.
	// SVG nodes are also treated as leaves: their children are SVG elements
	// with no Yoga layout and must not be recursed into.
	if (node.children.length === 0 || node.type === 'svg') {
		return { ...node, layout: adjustedLayout };
	}

	// Container — recurse into children.
	const slicedChildren = node.children
		.map((child) => sliceNode(child, yStart, yEnd, yOffset))
		.filter((c): c is PDFNode => c !== null);

	// If the node had children but all were excluded from this page slot, and
	// the node itself extends past the page boundary, it belongs entirely on
	// the next page.  Returning null here prevents an empty styled box (e.g. a
	// table row's background / border) from appearing on page 1 and overlapping
	// the footer.
	if (node.children.length > 0 && slicedChildren.length === 0 && nodeBottom > yEnd) {
		return null;
	}

	return { ...node, layout: adjustedLayout, children: slicedChildren };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the maximum (y + height) across all descendants of `node`.
 * This tells us the total height of the laid-out content.
 */
function getContentBottom(node: PDFNode): number {
	let max = 0;
	function walk(n: PDFNode): void {
		if (n.layout) {
			const bottom = n.layout.y + n.layout.height;
			if (bottom > max) max = bottom;
		}
		n.children.forEach(walk);
	}
	walk(node);
	return max;
}

/**
 * Collects every node with props.fixed === true anywhere in the page tree.
 *
 * The search stops at each fixed node and does not recurse into it — its
 * children belong to the fixed node itself and must not be double-collected.
 * This is safe because sliceNode already returns null for any fixed node it
 * encounters, so nested fixed nodes are already excluded from flow slicing
 * regardless of how deeply they are nested.
 */
function collectFixed(page: PDFNode): PDFNode[] {
	const result: PDFNode[] = [];
	function walk(node: PDFNode): void {
		for (const child of node.children) {
			if (child.props.fixed === true) {
				result.push(child);
				// Do not recurse — children are owned by this fixed node.
			} else {
				walk(child);
			}
		}
	}
	walk(page);
	return result;
}
