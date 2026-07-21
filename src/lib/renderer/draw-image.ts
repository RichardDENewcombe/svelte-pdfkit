import { createRequire } from 'node:module';
import type { PDFNode } from '../types/pdf.js';
import { getImageBuffer } from '../runtime/resources.js';

// svg-to-pdfkit ships as CommonJS. Resolve it lazily via createRequire (the
// same interop the project uses for pdfkit) so it is only loaded when an SVG
// image is actually drawn, and so ESM/Vite SSR contexts can require it.
let _SVGtoPDF: any;
function getSVGtoPDF(): any {
	if (!_SVGtoPDF) {
		_SVGtoPDF = createRequire(import.meta.url)('svg-to-pdfkit');
	}
	return _SVGtoPDF;
}

/**
 * Returns true when an image source should be rendered as vector SVG rather
 * than a raster bitmap.
 *
 * Detection order: a `.svg` extension, an `image/svg+xml` data URI, then a
 * content sniff of the buffer's first bytes for an `<svg` tag (covering sources
 * with no telltale extension, e.g. some URLs). Raster buffers decoded as UTF-8
 * are binary garbage and will not match the sniff.
 */
export function isSvgImage(src: string, buffer: Buffer): boolean {
	const path = src.toLowerCase().split('?')[0].split('#')[0];
	if (path.endsWith('.svg')) return true;
	if (src.startsWith('data:image/svg+xml')) return true;
	return /<svg[\s>]/i.test(buffer.subarray(0, 256).toString('utf-8'));
}

export function drawImage(doc: any, node: PDFNode): void {
	const { src } = node.props;
	const { x = 0, y = 0, width, height } = node.layout ?? {};

	const buffer = getImageBuffer(src);
	if (!buffer) {
		console.warn(`svelte-pdfkit: image not loaded: ${src}`);
		return;
	}

	if (isSvgImage(src, buffer)) {
		drawSvgImage(doc, src, buffer, x, y, width, height);
		return;
	}

	const opts: Record<string, number> = {};
	if (width) opts.width = width;
	if (height) opts.height = height;

	doc.image(buffer, x, y, opts);
}

/**
 * Renders an SVG image into the layout box via svg-to-pdfkit.
 *
 * Passing width/height fits the SVG to the Yoga-computed box (the SVG's own
 * preserveAspectRatio decides letterboxing). `assumePt: true` treats unitless
 * SVG lengths as PDF points so intrinsic sizing matches the rest of the layout.
 */
function drawSvgImage(
	doc: any,
	src: string,
	buffer: Buffer,
	x: number,
	y: number,
	width?: number,
	height?: number
): void {
	const opts: Record<string, any> = { assumePt: true };
	if (width) opts.width = width;
	if (height) opts.height = height;

	try {
		getSVGtoPDF()(doc, buffer.toString('utf-8'), x, y, opts);
	} catch (err) {
		console.warn(`svelte-pdfkit: failed to render SVG image "${src}": ${(err as Error).message}`);
	}
}
