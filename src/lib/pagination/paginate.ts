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
import { getLineHeight, wrapLinesMeta } from '../layout/text-measure.js';

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

	// Sorted y-positions where a forced page break must occur (breakBefore /
	// breakAfter props on flow nodes).  These shrink the natural slot boundaries
	// so that content on either side of a break lands on separate pages.
	const forcedBreaks = collectForcedBreaks(page);

	// keep-with-next pairs: a node that must stay on the same page as the start
	// of its following sibling (e.g. a heading kept with its body text).
	const keepPairs = collectKeepWithNext(page);

	// Fast path: all content fits within the padding-respecting boundary and
	// there are no forced breaks that would split the page.  keepPairs cannot
	// matter here because nothing is being split.
	const contentBottom = getContentBottom(page);
	if (padTop === 0 && contentBottom <= contentEnd && forcedBreaks.length === 0) {
		return [page];
	}

	const outputPages: PDFNode[] = [];

	// Tracks how many lines of each text node have already been placed on
	// previous pages.  Shared across all page slots so widow/orphan adjustments
	// from one page are reflected accurately on the next.
	const nodeProgress = new Map<PDFNode, number>();

	let yStart = 0;
	let pageIndex = 0;

	while (yStart < contentBottom) {
		// Natural slot boundary: page 0 ends at contentEnd; every subsequent page
		// spans exactly contentHeight from wherever yStart currently sits.
		const yEnd_natural = pageIndex === 0 ? contentEnd : yStart + contentHeight;

		// Shrink the slot to the first forced break that falls strictly inside it.
		const forcedBreak = forcedBreaks.find((b) => b > yStart && b < yEnd_natural);
		let yEnd = forcedBreak ?? yEnd_natural;

		// keep-with-next: if the boundary would separate a kept node from the
		// start of its successor, pull the break up to the kept node's top so
		// both move to the next page together.  A pair is violated when the kept
		// node (aTop) starts before the boundary but its successor (bTop) starts
		// at or after it.  We only pull the break to aTop when aTop > yStart so we
		// still make forward progress — if the kept node is already at the top of
		// the page and its successor still doesn't fit, the pair is taller than a
		// page and we let it break normally.  Looping handles chains (A→B→C) and
		// pairs newly exposed as the boundary moves up; yEnd strictly decreases
		// each pass and is bounded below by yStart, so it always terminates.
		let pulled = findKeepWithNextBreak(keepPairs, yStart, yEnd);
		while (pulled !== null) {
			yEnd = pulled;
			pulled = findKeepWithNextBreak(keepPairs, yStart, yEnd);
		}

		// On page 0, Yoga already placed content at y=padTop — no adjustment needed.
		// On overflow pages (including those after a forced break), shift content
		// down by padTop so it lands in the correct padded position on the new page.
		const yOffset = pageIndex === 0 ? 0 : padTop;

		const slicedChildren = page.children
			.filter((c) => !c.props.fixed)
			.map((child) => sliceNode(child, yStart, yEnd, yOffset, nodeProgress))
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

		yStart = yEnd;
		pageIndex++;
	}

	return outputPages;
}

/**
 * True when a node paints a box (background or any border) that must be cut
 * cleanly where it crosses a page boundary, rather than redrawn whole on each
 * fragment.
 */
function hasBoxDecoration(style: Record<string, any>): boolean {
	return !!(
		style.backgroundColor ||
		style.borderWidth ||
		style.borderTopWidth ||
		style.borderRightWidth ||
		style.borderBottomWidth ||
		style.borderLeftWidth
	);
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
 *
 * `nodeProgress` tracks how many lines of each text node have already been
 * placed on previous pages.  Using explicit progress rather than inferring
 * from y-coordinates ensures widow/orphan adjustments on one page are
 * correctly reflected on subsequent pages.
 */
function sliceNode(
	node: PDFNode,
	yStart: number,
	yEnd: number,
	yOffset = 0,
	nodeProgress = new Map<PDFNode, number>()
): PDFNode | null {
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
		// Pass the text so multi-font lines are sized by their tallest font,
		// matching measureText() so line slicing stays aligned with layout.
		const lineHeight = getLineHeight(style, text);

		if (lineHeight > 0) {
			const lines = wrapLinesMeta(text, style, layout.width);

			// Use explicit progress tracking rather than inferring from y-geometry.
			// This ensures widow/orphan adjustments on a previous page are not
			// undone by a stale geometry-based linesBefore calculation.
			const linesBefore = nodeProgress.get(node) ?? 0;

			// Top of the visible portion of this text node within this page slot.
			const visibleTop = Math.max(nodeTop, yStart);

			// Lines available in the remaining vertical space on this page.
			const linesAvailable = Math.max(0, Math.floor((yEnd - visibleTop) / lineHeight));

			// ── Widow / orphan control ─────────────────────────────────────────
			// Both props default to 1, which preserves the original behaviour
			// (no adjustment).  Set either to 2 or more to activate control.
			const minOrphans = (style.orphans as number | undefined) ?? 1;
			const minWidows  = (style.widows  as number | undefined) ?? 1;

			const totalLines     = lines.length;
			const remainingLines = totalLines - linesBefore;
			const isStart        = linesBefore === 0;

			let lineCount = Math.min(linesAvailable, remainingLines);
			const isEnd   = linesBefore + lineCount >= totalLines;

			// Orphan control: text starts on this page but too few lines fit
			// before the page break — defer the entire block to the next page.
			// nodeProgress is NOT updated so the next page starts from line 0.
			if (!isEnd && isStart && lineCount < minOrphans) {
				return null;
			}

			// Widow control: too few lines would remain for the next page after
			// this slot — reduce lineCount so the next page gets enough lines.
			if (!isEnd) {
				const linesAfter = remainingLines - lineCount;
				if (linesAfter > 0 && linesAfter < minWidows) {
					const deficit = minWidows - linesAfter;
					lineCount = Math.max(0, lineCount - deficit);
					if (lineCount === 0) return null;
					// Re-check orphan constraint after the widow reduction.
					if (isStart && lineCount < minOrphans) {
						return null;
					}
				}
			}

			const pageLines = lines.slice(linesBefore, linesBefore + lineCount);

			if (pageLines.length === 0) return null;

			// Record progress so the next page starts from the correct line.
			nodeProgress.set(node, linesBefore + lineCount);

			// Joining wrapped lines with '\n' loses the paragraph structure that
			// justification depends on, so for justified text we carry the sliced
			// line metadata through on a dedicated prop the renderer reads.
			const newProps: Record<string, any> = {
				...node.props,
				text: pageLines.map((l) => l.text).join('\n')
			};
			if (style.textAlign === 'justify') {
				newProps.justifyLines = pageLines;
			}

			return {
				...node,
				props: newProps,
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
		.map((child) => sliceNode(child, yStart, yEnd, yOffset, nodeProgress))
		.filter((c): c is PDFNode => c !== null);

	// If the node had children but all were excluded from this page slot, there
	// is nothing to draw here.  Two reasons this can happen:
	//   1. All content starts after this page's boundary (nodeBottom > yEnd) —
	//      the container belongs entirely to the next page.
	//   2. All content was already rendered on a previous page (e.g. a row that
	//      physically straddles the boundary but whose text was fully consumed
	//      on page 1) — nothing remains to show on this page.
	// In both cases returning null prevents an empty styled box (background /
	// border) from appearing with no content.
	if (node.children.length > 0 && slicedChildren.length === 0) {
		return null;
	}

	// A bordered / filled box that straddles this slot's boundaries is cut, not
	// redrawn whole. We clamp it to the slot and flag the cut edge(s) so the
	// renderer suppresses the border (and corner radii) there — the box then
	// reads as one continuous shape the page break passes through, matching
	// react-pdf's splitNode(). nodeTop/nodeBottom are in original Yoga space;
	// the slot spans [yStart, yEnd], which maps to [yOffset, yEnd-yStart+yOffset]
	// in this page's adjusted coordinates.
	const decorated = hasBoxDecoration(node.props.style ?? {});
	const cutTop = decorated && nodeTop < yStart;
	const cutBottom = decorated && nodeBottom > yEnd;

	let effectiveLayout = adjustedLayout;
	if (cutTop || cutBottom) {
		const style = node.props.style ?? {};
		const slotTopAdj = yOffset;
		const slotBotAdj = yEnd - yStart + yOffset;
		const top = cutTop ? slotTopAdj : adjustedLayout.y;
		let bottom = cutBottom ? slotBotAdj : adjustedLayout.y + adjustedLayout.height;

		// On a real-bottom fragment (the box actually ends on this page), make sure
		// the box wraps its sliced children plus its own bottom padding + border.
		// Orphan/widow control can defer a child to a later page and reposition it
		// to the top of the content band, so the child no longer sits where Yoga
		// placed it relative to the box — without this the bottom border can cut
		// through the deferred text.
		if (!cutBottom) {
			const padBottom = style.paddingBottom ?? style.padding ?? 0;
			const borderBottom = style.borderBottomWidth ?? style.borderWidth ?? 0;
			const childrenBottom = slicedChildren.reduce((max, child) => {
				if (!child.layout) return max;
				return Math.max(max, child.layout.y + child.layout.height);
			}, top);
			bottom = Math.max(bottom, childrenBottom + padBottom + borderBottom);
		}

		effectiveLayout = { ...adjustedLayout, y: top, height: Math.max(bottom - top, 0) };
	} else if (slicedChildren.length > 0 && adjustedLayout.y < yOffset) {
		// On overflow pages an (undecorated) container may have started on the
		// previous page (adjustedLayout.y < yOffset, i.e. before the top padding).
		// Clamp its y to yOffset and grow the height to cover all of its sliced
		// children so it renders around the actual visible content rather than
		// mostly off the top of the page.
		const maxChildBottom = slicedChildren.reduce((max, child) => {
			if (!child.layout) return max;
			return Math.max(max, child.layout.y + child.layout.height);
		}, yOffset);
		effectiveLayout = {
			...adjustedLayout,
			y: yOffset,
			height: Math.max(maxChildBottom - yOffset, 0)
		};
	}

	const newProps =
		cutTop || cutBottom
			? { ...node.props, ...(cutTop && { __cutTop: true }), ...(cutBottom && { __cutBottom: true }) }
			: node.props;

	return { ...node, props: newProps, layout: effectiveLayout, children: slicedChildren };
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
 * Collects sorted forced-break y-positions from breakBefore / breakAfter props.
 *
 * - breakBefore on a node inserts a break at the node's top edge (layout.y).
 * - breakAfter on a node inserts a break at the node's bottom edge (layout.y + height).
 *
 * Fixed nodes are excluded — they do not participate in flow pagination.
 * Duplicate positions are removed and the result is sorted ascending.
 */
function collectForcedBreaks(page: PDFNode): number[] {
	const breaks = new Set<number>();
	function walk(node: PDFNode): void {
		if (node.props.fixed) return;
		if (node.layout) {
			if (node.props.breakBefore) breaks.add(node.layout.y);
			if (node.props.breakAfter)  breaks.add(node.layout.y + node.layout.height);
		}
		for (const child of node.children) walk(child);
	}
	for (const child of page.children) walk(child);
	return [...breaks].sort((a, b) => a - b);
}

/** A keep-with-next constraint: the kept node's top and its successor's top. */
interface KeepPair {
	/** Top edge (Yoga y) of the node carrying keepWithNext. */
	aTop: number;
	/** Top edge (Yoga y) of that node's following flow sibling. */
	bTop: number;
}

/**
 * Collects keep-with-next pairs from the page tree.
 *
 * For each flow node with `keepWithNext`, the pair's successor is the node's
 * next non-fixed sibling — the element it must stay with.  A node with no such
 * sibling (last child, or only fixed siblings after it) contributes no pair.
 *
 * Tops are taken in the original Yoga coordinate space, matching the values the
 * slot loop compares against.
 */
function collectKeepWithNext(page: PDFNode): KeepPair[] {
	const pairs: KeepPair[] = [];
	function walk(node: PDFNode): void {
		if (node.props.fixed) return;
		const flowChildren = node.children.filter((c) => !c.props.fixed);
		for (let i = 0; i < flowChildren.length; i++) {
			const child = flowChildren[i];
			if (child.props.keepWithNext && child.layout) {
				const next = flowChildren[i + 1];
				if (next?.layout) {
					pairs.push({ aTop: child.layout.y, bTop: next.layout.y });
				}
			}
			walk(child);
		}
	}
	walk(page);
	return pairs;
}

/**
 * Returns the smallest kept-node top that the current slot boundary would
 * separate from its successor, or null if no pair is violated.
 *
 * A pair (aTop, bTop) is violated when the kept node starts within this slot
 * (aTop > yStart, so pulling the break to aTop still advances) but before the
 * boundary (aTop < yEnd) while its successor lands at or beyond the boundary
 * (bTop >= yEnd).  Breaking at the smallest such aTop moves the kept node and
 * everything after it to the next page.
 */
function findKeepWithNextBreak(pairs: KeepPair[], yStart: number, yEnd: number): number | null {
	let pulled: number | null = null;
	for (const { aTop, bTop } of pairs) {
		if (aTop > yStart && aTop < yEnd && bTop >= yEnd) {
			if (pulled === null || aTop < pulled) pulled = aTop;
		}
	}
	return pulled;
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
