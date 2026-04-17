import type { PDFNode } from '../types/pdf.js';
import { getImageBuffer } from '../runtime/resources.js';

export function drawImage(doc: any, node: PDFNode): void {
	const { src } = node.props;
	const { x = 0, y = 0, width, height } = node.layout ?? {};

	const buffer = getImageBuffer(src);
	if (!buffer) {
		console.warn(`svelte-pdf: image not loaded: ${src}`);
		return;
	}

	const opts: Record<string, number> = {};
	if (width) opts.width = width;
	if (height) opts.height = height;

	doc.image(buffer, x, y, opts);
}
