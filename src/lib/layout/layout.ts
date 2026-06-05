import Yoga, { FlexDirection, Edge, Align, Justify, Direction, Gutter, PositionType } from 'yoga-layout';
import type { DocumentContext, LayoutBox, PDFNode } from '../types/pdf.js';
import { measureText } from './text-measure.js';
import { imageAspectRatio } from './image-size.js';
import { getImageBuffer } from '../runtime/resources.js';

// Disable Yoga's pixel-grid rounding so measure callbacks receive and return
// exact float values.  The default pointScaleFactor of 1 causes Yoga to snap
// text-node heights upward via forceCeil, producing values like 15 for a
// PDFKit lineHeight of 13.872.  Setting it to 0 matches react-pdf's approach
// (packages/layout/src/yoga/index.ts) and eliminates the discrepancy.
const yogaConfig = Yoga.Config.create();
yogaConfig.setPointScaleFactor(0);

// ── Layout cache ──────────────────────────────────────────────────────────────
//
// Keyed by a hash of the page tree (structure + styles + text content) combined
// with the page dimensions. A cache hit means the same content was laid out at
// the same size before, so we can skip the Yoga computation and restore the
// previously computed LayoutBoxes directly.
//
// This is most useful when the same document template is rendered multiple
// times (e.g., generating many invoices with identical structure but different
// data) or during development hot-reload where only one section changes.
//
// Cache entries are stored as a flat DFS-ordered array of LayoutBoxes so
// restoration is a single linear pass over the new node tree.

const MAX_LAYOUT_CACHE_SIZE = 256;

/**
 * Flat DFS-ordered layout results for a single page.
 * Entries are `null` for SVG children, which have no Yoga layout.
 */
type CachedPageLayout = (LayoutBox | null)[];

const layoutCache = new Map<string, CachedPageLayout>();

/** Clears the layout cache. Intended for use in tests. */
export function clearLayoutCache(): void {
	layoutCache.clear();
}

/** Returns the current number of cached page layouts. */
export function getLayoutCacheSize(): number {
	return layoutCache.size;
}

// ── Hashing ───────────────────────────────────────────────────────────────────

/**
 * DJB2 hash — fast, good distribution, no dependencies.
 * Returns an unsigned 32-bit integer as a hex string.
 */
function djb2(str: string): string {
	let h = 5381;
	for (let i = 0; i < str.length; i++) {
		h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
	}
	return h.toString(16);
}

/**
 * Serialises the layout-relevant parts of a node tree to a stable string.
 * Function-valued props (render, draw) are replaced with '[fn]' because they
 * don't affect Yoga layout — text measurement uses a placeholder for render
 * functions and draw functions run at render time, not layout time.
 */
function serializeNode(node: PDFNode): string {
	const props: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(node.props)) {
		props[k] = typeof v === 'function' ? '[fn]' : v;
	}
	const childParts = node.children.map(serializeNode).join(',');
	return `${node.type}:${JSON.stringify(props)}[${childParts}]`;
}

function hashPageTree(page: PDFNode, width: number, height: number): string {
	return djb2(`${width}x${height}:${serializeNode(page)}`);
}

// ── Layout extraction / restoration ──────────────────────────────────────────

/**
 * Walks the tree DFS and collects LayoutBoxes into a flat array.
 * SVG nodes are visited (they have Yoga layout) but their children are not
 * — SVG child elements are not Yoga nodes and have no layout box.
 * A null sentinel is stored for nodes that had no layout set.
 */
function extractLayoutFlat(node: PDFNode, out: CachedPageLayout): void {
	out.push(node.layout ?? null);
	if (node.type !== 'svg') {
		for (const child of node.children) extractLayoutFlat(child, out);
	}
}

/**
 * Walks the tree DFS and restores LayoutBoxes from the flat array.
 * Mirrors the same SVG-child exclusion as extractLayoutFlat.
 */
function restoreLayoutFlat(node: PDFNode, boxes: CachedPageLayout, idx: { i: number }): void {
	const box = boxes[idx.i++];
	node.layout = box ?? undefined;
	if (node.type !== 'svg') {
		for (const child of node.children) restoreLayoutFlat(child, boxes, idx);
	}
}

const PAGE_SIZES: Record<string, [number, number]> = {
	A4: [595, 842],
	Letter: [612, 792],
	Legal: [612, 1008]
};

function getPageDimensions(page: PDFNode): [number, number] {
	const { size = 'A4', orientation = 'portrait' } = page.props;
	const [w, h] = Array.isArray(size)
		? (size as [number, number])
		: (PAGE_SIZES[size] ?? PAGE_SIZES.A4);
	return orientation === 'landscape' ? [h, w] : [w, h];
}

const flexDirectionMap: Record<string, number> = {
	row: FlexDirection.Row,
	column: FlexDirection.Column,
	'row-reverse': FlexDirection.RowReverse,
	'column-reverse': FlexDirection.ColumnReverse
};

const alignMap: Record<string, number> = {
	'flex-start': Align.FlexStart,
	'flex-end': Align.FlexEnd,
	center: Align.Center,
	stretch: Align.Stretch,
	baseline: Align.Baseline
};

const justifyMap: Record<string, number> = {
	'flex-start': Justify.FlexStart,
	'flex-end': Justify.FlexEnd,
	center: Justify.Center,
	'space-between': Justify.SpaceBetween,
	'space-around': Justify.SpaceAround,
	'space-evenly': Justify.SpaceEvenly
};

function setDim(node: any, method: string, value: number | string): void {
	if (typeof value === 'string' && value.endsWith('%')) {
		node[method + 'Percent'](parseFloat(value));
	} else {
		node[method](value);
	}
}

function applyStyle(yogaNode: any, node: PDFNode): void {
	const s = node.props.style ?? {};

	if (s.flexDirection != null)
		yogaNode.setFlexDirection(flexDirectionMap[s.flexDirection] ?? FlexDirection.Column);
	if (s.flexGrow != null) yogaNode.setFlexGrow(s.flexGrow);
	if (s.flexShrink != null) yogaNode.setFlexShrink(s.flexShrink);
	if (s.flexBasis != null) yogaNode.setFlexBasis(s.flexBasis);
	if (s.alignItems != null) yogaNode.setAlignItems(alignMap[s.alignItems] ?? Align.Stretch);
	if (s.alignSelf != null) yogaNode.setAlignSelf(alignMap[s.alignSelf] ?? Align.Auto);
	if (s.justifyContent != null)
		yogaNode.setJustifyContent(justifyMap[s.justifyContent] ?? Justify.FlexStart);

	if (s.width != null) setDim(yogaNode, 'setWidth', s.width);
	if (s.height != null) setDim(yogaNode, 'setHeight', s.height);
	if (s.minWidth != null) setDim(yogaNode, 'setMinWidth', s.minWidth);
	if (s.maxWidth != null) setDim(yogaNode, 'setMaxWidth', s.maxWidth);
	if (s.minHeight != null) setDim(yogaNode, 'setMinHeight', s.minHeight);
	if (s.maxHeight != null) setDim(yogaNode, 'setMaxHeight', s.maxHeight);

	if (s.gap != null) yogaNode.setGap(Gutter.All, s.gap);

	if (s.margin != null) yogaNode.setMargin(Edge.All, s.margin);
	if (s.marginTop != null) yogaNode.setMargin(Edge.Top, s.marginTop);
	if (s.marginRight != null) yogaNode.setMargin(Edge.Right, s.marginRight);
	if (s.marginBottom != null) yogaNode.setMargin(Edge.Bottom, s.marginBottom);
	if (s.marginLeft != null) yogaNode.setMargin(Edge.Left, s.marginLeft);

	if (s.padding != null) yogaNode.setPadding(Edge.All, s.padding);
	if (s.paddingTop != null) yogaNode.setPadding(Edge.Top, s.paddingTop);
	if (s.paddingRight != null) yogaNode.setPadding(Edge.Right, s.paddingRight);
	if (s.paddingBottom != null) yogaNode.setPadding(Edge.Bottom, s.paddingBottom);
	if (s.paddingLeft != null) yogaNode.setPadding(Edge.Left, s.paddingLeft);

	// Register border widths with Yoga so content area is reduced accordingly
	// (border-box model, matching react-pdf behaviour).
	if (s.borderWidth != null) yogaNode.setBorder(Edge.All, s.borderWidth);

	if (s.position === 'absolute') yogaNode.setPositionType(PositionType.Absolute);
	if (s.top != null) yogaNode.setPosition(Edge.Top, s.top);
	if (s.right != null) yogaNode.setPosition(Edge.Right, s.right);
	if (s.bottom != null) yogaNode.setPosition(Edge.Bottom, s.bottom);
	if (s.left != null) yogaNode.setPosition(Edge.Left, s.left);

	if (node.type === 'text') {
		// For render-prop nodes, measure with placeholder values since the actual
		// string won't be known until draw time. The user should design their
		// page-number text to be representative of the longest expected output.
		const textForMeasure =
			typeof node.props.render === 'function'
				? node.props.render({ pageNumber: 0, totalPages: 0 })
				: (node.props.text ?? '');
		yogaNode.setMeasureFunc((width: number) =>
			measureText(textForMeasure, node.props.style ?? {}, width)
		);
	}

	if (node.type === 'image') {
		// Give Yoga the image's intrinsic aspect ratio so that specifying only one
		// of width/height derives the other and preserves proportions. Only applied
		// when exactly one dimension is set — if both are given they are honoured
		// as-is (Yoga's aspectRatio would otherwise override an explicit value), and
		// if neither is given there is no base dimension to scale from.
		const hasWidth = s.width != null;
		const hasHeight = s.height != null;
		if (hasWidth !== hasHeight) {
			const buffer = getImageBuffer(node.props.src);
			if (buffer) {
				const ratio = imageAspectRatio(buffer);
				if (ratio != null) yogaNode.setAspectRatio(ratio);
			}
		}
	}
}

function buildYogaTree(node: PDFNode): any {
	const yogaNode = Yoga.Node.createWithConfig(yogaConfig);
	applyStyle(yogaNode, node);
	// svg nodes are Yoga leaves — their children are SVG elements, not Yoga nodes.
	if (node.type !== 'svg') {
		node.children.forEach((child, i) => {
			yogaNode.insertChild(buildYogaTree(child), i);
		});
	}
	return yogaNode;
}

function extractLayout(node: PDFNode, yogaNode: any, parentX = 0, parentY = 0): void {
	const x = parentX + yogaNode.getComputedLeft();
	const y = parentY + yogaNode.getComputedTop();
	node.layout = {
		x,
		y,
		width: yogaNode.getComputedWidth(),
		height: yogaNode.getComputedHeight()
	};
	if (node.type !== 'svg') {
		node.children.forEach((child, i) => extractLayout(child, yogaNode.getChild(i), x, y));
	}
}

export function computeLayout(doc: DocumentContext): void {
	for (const page of doc.children) {
		if (page.type !== 'page') continue;
		const [width, height] = getPageDimensions(page);
		page.props.width = width;
		page.props.height = height;

		// Check layout cache before running Yoga.
		const cacheKey = hashPageTree(page, width, height);
		const cached = layoutCache.get(cacheKey);
		if (cached) {
			restoreLayoutFlat(page, cached, { i: 0 });
			continue;
		}

		const yogaRoot = buildYogaTree(page);
		yogaRoot.calculateLayout(width, height, Direction.LTR);
		extractLayout(page, yogaRoot, 0, 0);
		yogaRoot.freeRecursive();

		// Store result. Evict oldest entry when the cache is full so memory
		// usage stays bounded even in long-running server processes.
		if (layoutCache.size >= MAX_LAYOUT_CACHE_SIZE) {
			const oldest = layoutCache.keys().next().value;
			if (oldest !== undefined) layoutCache.delete(oldest);
		}
		const boxes: CachedPageLayout = [];
		extractLayoutFlat(page, boxes);
		layoutCache.set(cacheKey, boxes);
	}
}
