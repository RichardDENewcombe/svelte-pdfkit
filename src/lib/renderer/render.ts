import { createRequire } from 'node:module';
import type { PDFNode, PDFMetadata, ResourceEntry } from '../types/pdf.js';
import { getFontBuffer } from '../runtime/resources.js';
import { resolveFont } from '../runtime/font-registry.js';
import { drawText } from './draw-text.js';
import { drawImage } from './draw-image.js';
import { drawSvg } from './draw-svg.js';
import { emitBookmarks } from './bookmarks.js';
import { hasTransform, buildTransformMatrix } from './transform.js';

const _require = createRequire(import.meta.url);

/**
 * Cubic-bezier approximation constant for a quarter-circle arc.
 * Using this factor for control-point offsets produces a near-perfect circle.
 */
const KAPPA = 0.5522847498;

/**
 * Draws a rectangle path with independent radii on each corner.
 * Falls back to a plain rect when all radii are zero.
 *
 * Radii are clamped so that adjacent radii on the same edge never exceed
 * half the edge length (standard CSS behaviour).
 */
function drawRoundedRectPath(
	doc: any,
	x: number,
	y: number,
	w: number,
	h: number,
	tl: number,
	tr: number,
	br: number,
	bl: number
): void {
	// Clamp each radius so adjacent corners don't overlap.
	const maxH = w / 2;
	const maxV = h / 2;
	tl = Math.min(tl, maxH, maxV);
	tr = Math.min(tr, maxH, maxV);
	br = Math.min(br, maxH, maxV);
	bl = Math.min(bl, maxH, maxV);

	if (tl === 0 && tr === 0 && br === 0 && bl === 0) {
		doc.rect(x, y, w, h);
		return;
	}

	doc
		.moveTo(x + tl, y)
		.lineTo(x + w - tr, y)
		.bezierCurveTo(x + w - tr + KAPPA * tr, y,           x + w, y + tr - KAPPA * tr,           x + w, y + tr)
		.lineTo(x + w, y + h - br)
		.bezierCurveTo(x + w, y + h - br + KAPPA * br,       x + w - br + KAPPA * br, y + h,       x + w - br, y + h)
		.lineTo(x + bl, y + h)
		.bezierCurveTo(x + bl - KAPPA * bl, y + h,           x, y + h - bl + KAPPA * bl,           x, y + h - bl)
		.lineTo(x, y + tl)
		.bezierCurveTo(x, y + tl - KAPPA * tl,               x + tl - KAPPA * tl, y,               x + tl, y)
		.closePath();
}

/**
 * Builds the outline of a box whose top and/or bottom edge has been "cut" by a
 * page break, as an OPEN path covering only the edges that should be stroked.
 *
 * When a bordered box splits across a page boundary we must not draw a border
 * along the cut — that would render a false closing line on the first fragment
 * and a false opening line on the continuation, making one box look like two.
 * This mirrors react-pdf's splitNode(), which zeroes the border (and corner
 * radii) on the cut edge of each fragment so the box reads as continuous.
 *
 * Left and right edges are always present (page breaks are horizontal). The cut
 * edge's two corners are square (the caller passes zeroed radii there), so the
 * sides simply run straight to the page boundary.
 */
function strokeCutBorderPath(
	doc: any,
	x: number,
	y: number,
	w: number,
	h: number,
	tl: number,
	tr: number,
	br: number,
	bl: number,
	cutTop: boolean,
	cutBottom: boolean
): void {
	if (cutTop && cutBottom) {
		// Middle fragment of a box spanning 3+ pages: only the two sides show.
		doc.moveTo(x, y).lineTo(x, y + h);
		doc.moveTo(x + w, y).lineTo(x + w, y + h);
		return;
	}

	if (cutBottom) {
		// Real top + both sides; open along the bottom cut (bl/br are 0).
		doc
			.moveTo(x, y + h)
			.lineTo(x, y + tl)
			.bezierCurveTo(x, y + tl - KAPPA * tl, x + tl - KAPPA * tl, y, x + tl, y)
			.lineTo(x + w - tr, y)
			.bezierCurveTo(x + w - tr + KAPPA * tr, y, x + w, y + tr - KAPPA * tr, x + w, y + tr)
			.lineTo(x + w, y + h);
		return;
	}

	// cutTop: real bottom + both sides; open along the top cut (tl/tr are 0).
	doc
		.moveTo(x, y)
		.lineTo(x, y + h - bl)
		.bezierCurveTo(x, y + h - bl + KAPPA * bl, x + bl - KAPPA * bl, y + h, x + bl, y + h)
		.lineTo(x + w - br, y + h)
		.bezierCurveTo(x + w - br + KAPPA * br, y + h, x + w, y + h - br + KAPPA * br, x + w, y + h - br)
		.lineTo(x + w, y);
}

function drawNodes(
	doc: any,
	nodes: PDFNode[],
	pageNumber = 1,
	totalPages = 1,
	pageOf: (anchorKey: string) => number | undefined = () => undefined
): void {
	for (const node of nodes) {
		// Apply any transform (rotate/scale/translate/skew) around the node's own
		// draw and its child subtree, matching CSS. Transforms don't affect layout,
		// so the box coordinates below are unchanged — only the CTM is.
		const style = node.props.style ?? {};
		const transformed = !!node.layout && hasTransform(style);
		if (transformed) {
			doc.save();
			doc.transform(...buildTransformMatrix(style, node.layout!));
		}

		// SVG draws its own children, so it must skip the generic recursion below.
		let skipChildren = false;

		switch (node.type) {
			case 'view': {
				// Draw background fill and/or border before rendering children.
				const s = node.props.style ?? {};
				const hasSideBorder = s.borderTopWidth || s.borderRightWidth || s.borderBottomWidth || s.borderLeftWidth;
				if (node.layout && (s.backgroundColor || s.borderWidth || hasSideBorder)) {
					const { x = 0, y = 0, width = 0, height = 0 } = node.layout;
					doc.save();

					// A box that straddles a page break is flagged by the paginator so
					// we suppress the border (and flatten the radii) on the cut edge,
					// matching react-pdf's splitNode(). The box then reads as one
					// continuous shape the page boundary passes through.
					const cutTop = node.props.__cutTop === true;
					const cutBottom = node.props.__cutBottom === true;

					const r = s.borderRadius ?? 0;
					const tl  = cutTop    ? 0 : (s.borderTopLeftRadius     ?? r);
					const tr  = cutTop    ? 0 : (s.borderTopRightRadius    ?? r);
					const brr = cutBottom ? 0 : (s.borderBottomRightRadius ?? r);
					const bl  = cutBottom ? 0 : (s.borderBottomLeftRadius  ?? r);

					if (s.backgroundColor) {
						drawRoundedRectPath(doc, x, y, width, height, tl, tr, brr, bl);
						doc.fill(s.backgroundColor);
					}

					if (s.borderWidth) {
						// Clip to the node's shape, then draw a double-width stroke so
						// only the inset half is visible — matching react-pdf's border model.
						// This prevents the stroke from bleeding into adjacent sibling nodes.
						drawRoundedRectPath(doc, x, y, width, height, tl, tr, brr, bl);
						doc.clip();
						if (cutTop || cutBottom) {
							strokeCutBorderPath(doc, x, y, width, height, tl, tr, brr, bl, cutTop, cutBottom);
						} else {
							drawRoundedRectPath(doc, x, y, width, height, tl, tr, brr, bl);
						}
						doc.lineWidth(s.borderWidth * 2).stroke(s.borderColor ?? 'black');
					}

					// Per-side borders — drawn as individual lines (no border-radius).
					// The cut edge is skipped for the same reason as the uniform border.
					const fallbackColor = s.borderColor ?? 'black';
					if (s.borderTopWidth && !cutTop) {
						doc.moveTo(x, y).lineTo(x + width, y)
							.lineWidth(s.borderTopWidth).stroke(s.borderTopColor ?? fallbackColor);
					}
					if (s.borderRightWidth) {
						doc.moveTo(x + width, y).lineTo(x + width, y + height)
							.lineWidth(s.borderRightWidth).stroke(s.borderRightColor ?? fallbackColor);
					}
					if (s.borderBottomWidth && !cutBottom) {
						doc.moveTo(x, y + height).lineTo(x + width, y + height)
							.lineWidth(s.borderBottomWidth).stroke(s.borderBottomColor ?? fallbackColor);
					}
					if (s.borderLeftWidth) {
						doc.moveTo(x, y).lineTo(x, y + height)
							.lineWidth(s.borderLeftWidth).stroke(s.borderLeftColor ?? fallbackColor);
					}

					doc.restore();
				}
				break;
			}
			case 'text':
				drawText(doc, node, pageNumber, totalPages, pageOf);
				break;
			case 'image':
				drawImage(doc, node);
				break;
			case 'link':
				if (node.layout) {
					const { x, y, width, height } = node.layout;
					doc.link(x, y, width, height, node.props.href);
				}
				break;
			case 'canvas':
				if (node.layout && typeof node.props.draw === 'function') {
					const { x, y, width, height } = node.layout;
					node.props.draw(doc, x, y, width, height);
				}
				break;
			case 'svg':
				drawSvg(doc, node);
				// SVG handles its own children — do not fall through to the generic recurse.
				skipChildren = true;
				break;
		}
		if (!skipChildren && node.children.length > 0) {
			drawNodes(doc, node.children, pageNumber, totalPages, pageOf);
		}

		if (transformed) {
			doc.restore();
		}
	}
}

/**
 * Renders a list of page nodes to a PDFKit stream.
 *
 * @param pages     - Array of page PDFNodes from paginate().
 * @param resources - The full resource list from the DocumentContext.
 *                    Used to register custom fonts on the PDFKit document
 *                    before drawing begins. If omitted, only built-in PDFKit
 *                    fonts (Helvetica, Courier, Times) are available.
 * @param pageOf    - Looks up the page number a node with the given `anchor`
 *                    key resolved to, for the Text `render` prop. Built from
 *                    the full pages[] array before drawing starts, so it can
 *                    resolve pages that haven't been drawn yet.
 * @returns A Node.js Readable stream (PDFDocument extends stream.PassThrough).
 */
export function renderPDF(
	pages: PDFNode[],
	resources: ResourceEntry[] = [],
	metadata: PDFMetadata = {},
	pageOf: (anchorKey: string) => number | undefined = () => undefined
): any {
	const PDFDocument = _require('pdfkit');

	const info: Record<string, string> = {};
	if (metadata.title) info['Title'] = metadata.title;
	if (metadata.author) info['Author'] = metadata.author;
	if (metadata.subject) info['Subject'] = metadata.subject;
	if (metadata.keywords) info['Keywords'] = metadata.keywords;
	if (metadata.creator) info['Creator'] = metadata.creator;
	if (metadata.producer) info['Producer'] = metadata.producer;

	const doc = new PDFDocument({ autoFirstPage: false, info });

	// Register all custom fonts declared in the document.
	//
	// loadResources() already loaded the buffers into the font cache during
	// the async phase. We re-register here because this PDFDocument instance
	// is brand new — each render() call creates a fresh one. Without this step,
	// calls to doc.font('Inter') would throw "font not found".
	for (const entry of resources) {
		if (entry.type === 'font' && entry.name) {
			const buffer = getFontBuffer(entry.src);
			if (buffer) {
				const pdfkitName = resolveFont(entry.name, entry.weight, entry.fontStyle);
				try {
					doc.registerFont(pdfkitName, buffer);
				} catch {
					// Already registered on this instance — safe to ignore.
				}
			}
		}
	}

	// Tracks outline items already emitted, keyed by the bookmark id stamped
	// before pagination, so a node sliced across pages (or a repeated fixed
	// node) produces exactly one item — on the first page it appears.
	const bookmarkItems = new Map<number, any>();

	const totalPages = pages.length;
	for (let i = 0; i < pages.length; i++) {
		const page = pages[i];
		const width = page.props.width ?? 595;
		const height = page.props.height ?? 842;
		doc.addPage({ size: [width, height], margin: 0 });
		drawNodes(doc, page.children, i + 1, totalPages, pageOf);
		// Emit outline entries while this page is the current PDFKit page:
		// addItem's destination is always doc.page ('Fit'), so items land on
		// the page just added and drawn.
		emitBookmarks(doc, page.children, bookmarkItems);
	}

	doc.end();
	return doc;
}
