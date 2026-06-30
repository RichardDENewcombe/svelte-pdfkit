import { createRequire } from 'node:module';
import type { PDFNode, PDFMetadata, ResourceEntry } from '../types/pdf.js';
import { getFontBuffer } from '../runtime/resources.js';
import { resolveFont } from '../runtime/font-registry.js';
import { drawText } from './draw-text.js';
import { drawImage } from './draw-image.js';
import { drawSvg } from './draw-svg.js';
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

function drawNodes(doc: any, nodes: PDFNode[], pageNumber = 1, totalPages = 1): void {
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
					const r = s.borderRadius ?? 0;
					const tl  = s.borderTopLeftRadius     ?? r;
					const tr  = s.borderTopRightRadius    ?? r;
					const brr = s.borderBottomRightRadius ?? r;
					const bl  = s.borderBottomLeftRadius  ?? r;

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
						drawRoundedRectPath(doc, x, y, width, height, tl, tr, brr, bl);
						doc.lineWidth(s.borderWidth * 2).stroke(s.borderColor ?? 'black');
					}

					// Per-side borders — drawn as individual lines (no border-radius).
					const fallbackColor = s.borderColor ?? 'black';
					if (s.borderTopWidth) {
						doc.moveTo(x, y).lineTo(x + width, y)
							.lineWidth(s.borderTopWidth).stroke(s.borderTopColor ?? fallbackColor);
					}
					if (s.borderRightWidth) {
						doc.moveTo(x + width, y).lineTo(x + width, y + height)
							.lineWidth(s.borderRightWidth).stroke(s.borderRightColor ?? fallbackColor);
					}
					if (s.borderBottomWidth) {
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
				drawText(doc, node, pageNumber, totalPages);
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
			drawNodes(doc, node.children, pageNumber, totalPages);
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
 * @returns A Node.js Readable stream (PDFDocument extends stream.PassThrough).
 */
export function renderPDF(
	pages: PDFNode[],
	resources: ResourceEntry[] = [],
	metadata: PDFMetadata = {}
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

	const totalPages = pages.length;
	for (let i = 0; i < pages.length; i++) {
		const page = pages[i];
		const width = page.props.width ?? 595;
		const height = page.props.height ?? 842;
		doc.addPage({ size: [width, height], margin: 0 });
		drawNodes(doc, page.children, i + 1, totalPages);
	}

	doc.end();
	return doc;
}
