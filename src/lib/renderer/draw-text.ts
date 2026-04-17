import type { PDFNode } from '../types/pdf.js';
import { resolveFont } from '../runtime/font-registry.js';

export function drawText(
	doc: any,
	node: PDFNode,
	pageNumber = 1,
	totalPages = 1
): void {
	const { style = {} } = node.props;
	const { x = 0, y = 0, width = 0 } = node.layout ?? {};

	// Resolve the text string — either static or from a render-prop function.
	const text =
		typeof node.props.render === 'function'
			? node.props.render({ pageNumber, totalPages })
			: (node.props.text ?? '');

	if (!text) return;

	const fontFamily = style.fontFamily ?? 'Helvetica';
	const fontSize = style.fontSize ?? 12;
	const color = style.color ?? 'black';
	const opacity = style.opacity ?? 1;
	const align = style.textAlign ?? 'left';
	const fontName = resolveFont(fontFamily, style.fontWeight, style.fontStyle);

	try {
		doc.font(fontName);
	} catch {
		// Variant not registered — fall back to base family, then Helvetica.
		try {
			doc.font(fontFamily);
		} catch {
			doc.font('Helvetica');
		}
	}

	doc.fontSize(fontSize);

	// Compute lineGap from lineHeight multiplier.
	// PDFKit's lineGap is extra pixels between lines, not a multiplier.
	// We convert: lineGap = (multiplier - 1) * naturalLineHeight.
	let lineGap: number | undefined;
	if (style.lineHeight != null) {
		lineGap = (style.lineHeight - 1) * doc.currentLineHeight(true);
	}

	doc
		.fillColor(color, opacity)
		.text(text, x, y, {
			width: width || undefined,
			align,
			lineBreak: true,
			...(lineGap != null && { lineGap }),
			...(style.letterSpacing != null && { characterSpacing: style.letterSpacing }),
			...(style.textDecoration === 'underline' && { underline: true }),
			...(style.textDecoration === 'line-through' && { strike: true })
		});
}
