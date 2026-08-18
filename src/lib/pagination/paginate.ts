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

/**
 * Tolerance (in points) for comparing two independently Yoga-accumulated
 * layout values that are mathematically expected to coincide — e.g. one
 * row's bottom vs. the next row's top for a tightly-packed run, or a
 * breakBefore node's own top vs. that same value reached through a
 * different accumulation path. Yoga accumulates in float32, so such values
 * can differ by a few millionths of a point even when "equal" by
 * construction (see issue #15, where a real render captured a drift of
 * ~8.6e-6 between two values that should have been identical). Comparing
 * them with exact `>=` treated that noise as genuine overflow, and because
 * the boundary-pulling loop in paginatePage() feeds each decision's result
 * into the next comparison, the mistake self-reinforced into one-row-per-page
 * cascades. LAYOUT_EPSILON is comfortably larger than that noise floor and
 * comfortably smaller than any real single point of overflow that should
 * legitimately trigger a page break.
 */
const LAYOUT_EPSILON = 0.1;

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
	// of its following sibling (e.g. a heading kept with its body text). Merged
	// with wrap={false} self-pairs — a node that must not be sliced by a break
	// landing inside its own bounds — since both are "don't let a break land
	// between aTop and bTop" constraints and share the same boundary-pulling
	// mechanism below. See collectNoWrapPairs().
	const keepPairs = [...collectKeepWithNext(page), ...collectNoWrapPairs(page)];

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

	// Tracks which nodes have actually emitted visible content on an earlier
	// page slot. Distinguishes a node that's a genuine mid-content
	// continuation (already partly drawn — flush to the top, no padding) from
	// one that was pushed to this page wholesale and is appearing for the
	// first time (e.g. deferred whole by orphan control) — which should keep
	// its own padding, exactly as if it started fresh at the top of a page.
	// See sliceNode() for how this is used.
	const renderedBefore = new Set<PDFNode>();

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
		// node (aTop) starts before the boundary but its successor doesn't fit —
		// for keep-with-next pairs that means the successor would render nothing
		// at all in this slot (checked via wouldRenderInSlot(), not just its raw
		// top, since orphan control can defer it entirely even when its top
		// clears the boundary — issue #14); for wrap={false} self-pairs it means
		// the node's own bottom doesn't clear the boundary; for wrap={fraction}
		// self-pairs (see collectWrapFractionPairs()) it means the node overlaps
		// the bottom fraction of this slot at all, whether or not it would have
		// been cut.  We only pull the break to aTop when aTop > yStart so we
		// still make forward progress — if the kept node is already at the top
		// of the page and its successor still doesn't fit, the pair is taller
		// than a page and we let it break normally.  Looping handles chains
		// (A→B→C) and pairs newly exposed as the boundary moves up; yEnd
		// strictly decreases each pass and is bounded below by yStart, so it
		// always terminates.
		//
		// wrap={fraction} pairs depend on this slot's own yStart/yEnd_natural
		// (the bottom-fraction zone differs per slot), so — unlike keepPairs
		// above, which is hoisted out of the loop — they must be recomputed
		// fresh each iteration and merged in here.
		const slotPairs = [...keepPairs, ...collectWrapFractionPairs(page, yStart, yEnd_natural)];
		let pulled = findKeepWithNextBreak(slotPairs, yStart, yEnd);
		while (pulled !== null) {
			yEnd = pulled;
			pulled = findKeepWithNextBreak(slotPairs, yStart, yEnd);
		}

		// On page 0, Yoga already placed content at y=padTop — no adjustment needed.
		// On overflow pages (including those after a forced break), shift content
		// down by padTop so it lands in the correct padded position on the new page.
		const yOffset = pageIndex === 0 ? 0 : padTop;

		// yStart is the real page-height boundary, but a node deferred WHOLE by
		// orphan control (nothing of it drawn on the previous page) leaves a gap
		// of unused space behind it — the previous page's actual content stopped
		// short of yStart. Positioning this page's content directly against the
		// real yStart would either clamp the deferred node's own top (losing its
		// padding) or, if corrected per-node, desync it from its own later
		// siblings (who'd still be measured against the real yStart). Instead we
		// find the true top of whatever will first render on this page — pulling
		// the reference up to it when there's a gap — and use that single value
		// for every node in this slot, deferred or not, so the whole page shifts
		// as one contiguous block and every Yoga-computed offset between rows is
		// preserved automatically. See findSlotYStart() and sliceNode().
		const slotYStart = findSlotYStart(page, yStart, yEnd, renderedBefore);

		const slicedChildren = page.children
			.filter((c) => !c.props.fixed)
			.map((child) => sliceNode(child, slotYStart, yEnd, yOffset, nodeProgress, renderedBefore))
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
 * Finds the true top of this page slot, in original Yoga coordinates.
 *
 * Normally that's just `yStart` (the real page-height boundary). But when
 * orphan control defers a node WHOLE to this slot — nothing of it drawn on
 * the previous page — the previous page's actual content stopped short of
 * `yStart`, leaving a gap. Positioning this slot's content against the real
 * `yStart` would either clamp the deferred node's own top (discarding its
 * padding) or, if corrected only for that one node, desync it from its own
 * later siblings, who would still be measured against the real `yStart` and
 * so drift out of sync with it (see the issue #12 follow-up: this was
 * exactly the earlier version of this fix's bug — it corrected a deferred
 * row's own position but not its neighbours', crowding the row after it).
 *
 * The fix is to find the topmost point of whatever will genuinely be new on
 * this page — the smallest `layout.y` among nodes that haven't emitted any
 * content yet (`!renderedBefore.has(node)`) but do belong somewhere in this
 * slot (`nodeBottom > yStart`, `nodeTop < yEnd`) — and use that as the slot's
 * effective top instead. Every node in the slot, deferred or not, is then
 * measured against this same value, so the whole slot shifts as one
 * contiguous block and every Yoga-computed offset between siblings (gaps,
 * padding) is preserved automatically — exactly as it already is for a slot
 * with no deferral gap, where this simply returns `yStart` unchanged.
 *
 * A parent container's top is always ≤ its children's (no negative
 * padding/margin in this layout model), so checking every node in the tree
 * — not just leaves — and taking the minimum is sufficient: a deferred
 * container is its own topmost candidate, no separate check of its children
 * is needed to find the slot's true top.
 */
function findSlotYStart(
	page: PDFNode,
	yStart: number,
	yEnd: number,
	renderedBefore: Set<PDFNode>
): number {
	let top = yStart;
	function walk(node: PDFNode): void {
		if (node.props.fixed) return;
		const layout = node.layout;
		if (layout) {
			const nodeBottom = layout.y + layout.height;
			if (!renderedBefore.has(node) && nodeBottom > yStart && layout.y < yEnd && layout.y < top) {
				top = layout.y;
			}
		}
		for (const child of node.children) walk(child);
	}
	for (const child of page.children) walk(child);
	return top;
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
 *
 * `yStart` here is whatever findSlotYStart() decided for this slot — it may
 * be pulled up from the real page boundary when a node was deferred whole
 * (see paginatePage()), but within this function it's just "the top of this
 * slot" and every node in the slot is measured against it uniformly.
 *
 * `renderedBefore` tracks which nodes have already emitted visible content
 * on an earlier page slot — used by findSlotYStart() on the *next* slot, and
 * by this function only to record that this node was shown (mark(), below).
 */
function sliceNode(
	node: PDFNode,
	yStart: number,
	yEnd: number,
	yOffset = 0,
	nodeProgress = new Map<PDFNode, number>(),
	renderedBefore = new Set<PDFNode>()
): PDFNode | null {
	// Fixed nodes are handled separately — exclude from flow slicing.
	if (node.props.fixed) return null;

	const layout = node.layout;
	if (!layout) return null;

	const nodeTop = layout.y;
	const nodeBottom = layout.y + layout.height;

	// Completely above or below this page slot — exclude.
	if (nodeBottom <= yStart || nodeTop >= yEnd) return null;

	// Marks `node` as having emitted visible content, so a later slot's
	// findSlotYStart() knows this was a real continuation, not a fresh
	// deferral. Call immediately before every non-null return below.
	const mark = <T,>(result: T): T => {
		renderedBefore.add(node);
		return result;
	};

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

			return mark({
				...node,
				props: newProps,
				layout: {
					...layout,
					y: visibleTop - yStart + yOffset,
					height: pageLines.length * lineHeight
				}
			});
		}
	}

	// Leaf node — include it directly.
	// SVG nodes are also treated as leaves: their children are SVG elements
	// with no Yoga layout and must not be recursed into.
	if (node.children.length === 0 || node.type === 'svg') {
		return mark({ ...node, layout: adjustedLayout });
	}

	// Container — recurse into children.
	const slicedChildren = node.children
		.map((child) => sliceNode(child, yStart, yEnd, yOffset, nodeProgress, renderedBefore))
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
	// nodeTop < yStart is only true for a genuine continuation now — findSlotYStart()
	// already pulled yStart up to a fresh node's own top when it was deferred
	// whole, so this correctly stays false for it and its border/corner radii
	// are left intact.
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

	return mark({ ...node, props: newProps, layout: effectiveLayout, children: slicedChildren });
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

/**
 * A "don't let a break land between aTop and bTop" constraint, consumed by
 * findKeepWithNextBreak() below. Populated from two distinct sources:
 *
 *  - keep-with-next: aTop is the kept node's top, bTop is its following flow
 *    sibling's top, and bNode is that sibling node itself — keeps the pair
 *    from being separated by a break landing between them
 *    (collectKeepWithNext()).
 *  - wrap={false}: aTop and bTop are the same node's own top and bottom, and
 *    bNode is absent — keeps the node itself from being sliced by a break
 *    landing inside it (collectNoWrapPairs()).
 *  - wrap={fraction 0..1}: aTop is the node's own top, bTop is Infinity, and
 *    bNode is absent — unconditionally defers the node whole whenever it's
 *    in scope for the current slot, because it was only included in the
 *    first place when it overlaps the slot's bottom fraction zone
 *    (collectWrapFractionPairs()).
 *
 * bNode lets findKeepWithNextBreak() ask "would the successor actually
 * render anything here" (via wouldRenderInSlot()) rather than trusting bTop
 * alone — bTop can clear the boundary while the successor's content is still
 * entirely orphan-deferred by sliceNode() (see issue #14). wrap={false} and
 * wrap={fraction} pairs have no separate node to trial-render — their own
 * bTop vs. yEnd check is already exact — so bNode is left undefined for them.
 */
interface KeepPair {
	/** Top edge (Yoga y) of the node carrying the constraint. */
	aTop: number;
	/** Bottom-of-range edge (Yoga y) the constraint must not be split from. */
	bTop: number;
	/**
	 * The successor node itself, for keep-with-next pairs — used to check
	 * whether it would actually render anything in a candidate slot instead
	 * of just comparing bTop. Undefined for wrap={false} and wrap={fraction}
	 * self-pairs.
	 */
	bNode?: PDFNode;
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
					pairs.push({ aTop: child.layout.y, bTop: next.layout.y, bNode: next });
				}
			}
			walk(child);
		}
	}
	walk(page);
	return pairs;
}

/**
 * Collects wrap={false} self-pairs from the page tree: each such node's own
 * top and bottom, reusing the keep-with-next boundary-pulling mechanism to
 * defer the whole node to the next page slot instead of slicing through it.
 *
 * A pair (aTop, bTop) is "violated" — and its break pulled up to aTop — by
 * findKeepWithNextBreak() exactly when a boundary would land strictly inside
 * [aTop, bTop). For a keep-with-next pair that means separating two sibling
 * nodes; here, with aTop/bTop being one node's own top/bottom, it means the
 * break would land inside that node — which findKeepWithNextBreak() defers by
 * pulling the boundary up to the node's own top, moving it whole.
 *
 * If the node is taller than a full page, the same fallback that already
 * applies to keep-with-next kicks in: once the node is deferred to the top of
 * a fresh slot (aTop == yStart, no longer > yStart), the constraint stops
 * triggering and the node is sliced normally — the only sane outcome for a
 * box that can never fit on one page.
 */
function collectNoWrapPairs(page: PDFNode): KeepPair[] {
	const pairs: KeepPair[] = [];
	function walk(node: PDFNode): void {
		if (node.props.fixed) return;
		if (node.props.wrap === false && node.layout) {
			pairs.push({ aTop: node.layout.y, bTop: node.layout.y + node.layout.height });
		}
		for (const child of node.children) walk(child);
	}
	for (const child of page.children) walk(child);
	return pairs;
}

/**
 * Collects wrap={0..1} self-pairs for the current page slot: any node whose
 * layout box overlaps the bottom `frac` fraction of this slot's *natural*
 * span [yStart, yEndNatural) — whether it starts inside that zone, or starts
 * above it and extends into it — is deferred whole to the next page, exactly
 * like a wrap={false} node that would otherwise be cut by the boundary. This
 * is a proactive version of wrap={false}: it can defer a node that would
 * technically have fit without being cut, if it merely starts too close to
 * the bottom margin (e.g. a heading or card landing in a cramped strip).
 *
 * Unlike collectKeepWithNext()/collectNoWrapPairs(), this must be recomputed
 * per slot (not hoisted above the while loop in paginatePage()) because the
 * zone's extent depends on this slot's own yStart/yEndNatural — page 0's span
 * and later pages' spans differ (contentEnd vs. contentHeight, see the
 * yEnd_natural comment above), and the zone must track whichever slot is
 * currently being decided.
 *
 * The zone is measured against yEndNatural (the slot's natural boundary,
 * before any breakBefore/breakAfter truncation), not the live/pulled `yEnd`
 * passed into findKeepWithNextBreak() later — "bottom X% of the page" is a
 * property of the page, not of incidental forced breaks elsewhere on it.
 *
 * The overlap check is toleranced by LAYOUT_EPSILON for the same reason as
 * collectNoWrapPairs() (issue #15): without it, a node whose bottom lands a
 * few millionths of a point into the zone due to Yoga's float32 accumulation
 * noise would be spuriously deferred, and for a tightly-packed run that
 * misfire cascades into one node per page.
 *
 * bTop is set to Infinity rather than a computed value: once a pair is
 * included at all, its aTop is already known to be "in scope" for this slot
 * per findKeepWithNextBreak()'s own aTop > yStart / aTop < yEnd guard, and it
 * must then be unconditionally treated as violated — there is no finite yEnd
 * this slot could ever produce that should un-violate it. Infinity makes the
 * existing self-pair check `bTop - yEnd > LAYOUT_EPSILON` true for any finite
 * yEnd, reusing that check exactly as-is; findKeepWithNextBreak() itself is
 * not modified. The same aTop <= yStart guard that already prevents infinite
 * deferral for wrap={false} (see collectNoWrapPairs()) applies here too: once
 * a node is deferred to the top of a fresh slot, aTop === yStart and the
 * constraint stops firing, so a node taller than a page — or wrap={1}, the
 * most extreme fraction — still terminates and falls back to normal slicing.
 */
function collectWrapFractionPairs(page: PDFNode, yStart: number, yEndNatural: number): KeepPair[] {
	const pairs: KeepPair[] = [];
	const slotHeight = yEndNatural - yStart;
	function walk(node: PDFNode): void {
		if (node.props.fixed) return;
		const w = node.props.wrap;
		if (typeof w === 'number' && node.layout) {
			const frac = Math.min(1, Math.max(0, w));
			const thresholdY = yEndNatural - slotHeight * frac;
			const nodeTop = node.layout.y;
			const nodeBottom = nodeTop + node.layout.height;
			if (nodeTop < yEndNatural && nodeBottom - thresholdY > LAYOUT_EPSILON) {
				pairs.push({ aTop: nodeTop, bTop: Infinity });
			}
		}
		for (const child of node.children) walk(child);
	}
	for (const child of page.children) walk(child);
	return pairs;
}

/**
 * Trial-slices `node` against a candidate slot [yStart, yEnd) using scratch
 * progress/rendered-before state, to answer "would this node actually
 * produce visible content in this slot" — as opposed to just comparing its
 * raw Yoga top to the boundary.
 *
 * A node can have layout.y comfortably before yEnd and still render nothing:
 * sliceNode()'s orphan-control branch defers a text node entirely when fewer
 * than `orphans` lines fit before yEnd, and that null propagates up through
 * any container whose only content was that text (see issue #14). Reusing
 * sliceNode() itself keeps this in lockstep with the real slicing decision
 * instead of re-deriving a second, potentially diverging estimate of "does
 * it fit."
 *
 * The scratch Map/Set are thrown away after the call — this must not affect
 * the real nodeProgress/renderedBefore bookkeeping, since it's only ever
 * used to decide where the *boundary* should land, not to actually render
 * anything.
 *
 * Deliberately NOT given the same LAYOUT_EPSILON tolerance as the
 * wrap={false} self-pair check below (issue #15): nudging `yEnd` here would
 * make this trial call disagree with the real, un-nudged sliceNode() calls
 * in paginatePage()'s main rendering loop — a successor could be judged
 * "renders" by the nudged trial yet still be excluded by the exact
 * comparison when actually sliced, separating it from its keepWithNext
 * node instead of preventing that. A theoretical analogous cascade for a
 * tightly-packed chain of keepWithNext nodes remains possible in principle,
 * but fixing it soundly needs the tolerance applied consistently wherever
 * a node's fit is decided — a larger, riskier change than this file's
 * central, heavily-tested slicing path warrants without a confirmed
 * real-world case (unlike wrap={false}, which issue #15 captured directly
 * from a production render).
 */
function wouldRenderInSlot(node: PDFNode, yStart: number, yEnd: number): boolean {
	return sliceNode(node, yStart, yEnd, 0, new Map(), new Set()) !== null;
}

/**
 * Returns the smallest kept-node top that the current slot boundary would
 * separate from its successor, or null if no pair is violated.
 *
 * A pair (aTop, bTop[, bNode]) is violated when the kept node starts within
 * this slot (aTop > yStart, so pulling the break to aTop still advances) but
 * before the boundary (aTop < yEnd) while its successor doesn't fit:
 *
 *  - For keep-with-next pairs (bNode present), "doesn't fit" means the
 *    successor node would render nothing at all in [yStart, yEnd) — checked
 *    via wouldRenderInSlot() rather than a raw bTop comparison, since a
 *    successor can vanish entirely to orphan control even when its own top
 *    clears the boundary (issue #14).
 *  - For wrap={false} self-pairs (bNode absent), "doesn't fit" is
 *    `bTop - yEnd > LAYOUT_EPSILON` rather than the exact `bTop >= yEnd` —
 *    for a tightly-packed run of siblings, a row's own bottom and the next
 *    boundary are mathematically expected to coincide but are accumulated
 *    independently through Yoga's layout tree, landing a few millionths of
 *    a point apart (see issue #15). Comparing with exact `>=` treated that
 *    noise as overflow, and because this loop feeds each `pulled` result
 *    back into the next comparison (see paginatePage()), the mistake
 *    self-reinforced into one-row-per-page cascades. A node whose bottom
 *    lands exactly on `yEnd` fits — it touches the boundary, not crosses
 *    it — so the tolerant strict `>` is also the intended semantics, not
 *    just noise-absorption.
 *
 * Breaking at the smallest such aTop moves the kept node and everything
 * after it to the next page.
 */
function findKeepWithNextBreak(pairs: KeepPair[], yStart: number, yEnd: number): number | null {
	let pulled: number | null = null;
	for (const { aTop, bTop, bNode } of pairs) {
		if (aTop <= yStart || aTop >= yEnd) continue;
		const violated = bNode ? !wouldRenderInSlot(bNode, yStart, yEnd) : bTop - yEnd > LAYOUT_EPSILON;
		if (violated && (pulled === null || aTop < pulled)) pulled = aTop;
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
