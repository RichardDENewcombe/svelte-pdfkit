import type { PDFNode } from '../types/pdf.js';
import { resolveFontStack } from '../runtime/font-registry.js';
import { wrapLinesMeta, type WrappedLine } from '../layout/text-measure.js';

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

	const fontSize = style.fontSize ?? 12;
	const color = style.color ?? 'black';
	const opacity = style.opacity ?? 1;
	const align = style.textAlign ?? 'left';
	// Resolve the fontFamily stack to the first available family; the try/catch is
	// a final safety net that drops to Helvetica if even that cannot be selected.
	const fontName = resolveFontStack(style.fontFamily, style.fontWeight, style.fontStyle);

	try {
		doc.font(fontName);
	} catch {
		doc.font('Helvetica');
	}

	doc.fontSize(fontSize);

	// Justified text needs per-line handling: PDFKit's native `align: 'justify'`
	// only stretches lines it wraps itself, but the paginator pre-wraps text and
	// joins lines with '\n', which PDFKit reads as separate single-line
	// paragraphs (and never justifies the last line of a paragraph). So we lay
	// out each line ourselves and distribute the slack via wordSpacing, skipping
	// the final line of every paragraph.
	if (align === 'justify' && width > 0) {
		drawJustified(doc, node, text, x, y, width, color, opacity, fontSize, style);
		return;
	}

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

/**
 * Renders justified text one line at a time.
 *
 * The font and size are already set on `doc` by the caller. Each line is placed
 * at its own y coordinate (advancing by the same effective line height the
 * layout engine used) and stretched to `width` by adding wordSpacing across its
 * spaces. Lines that end a paragraph — and single-word lines, which have no gaps
 * to stretch — render at their natural width.
 */
function drawJustified(
	doc: any,
	node: PDFNode,
	text: string,
	x: number,
	y: number,
	width: number,
	color: string,
	opacity: number,
	fontSize: number,
	style: Record<string, any>
): void {
	// Effective line advance: natural PDFKit line height × the lineHeight
	// multiplier — matches measureText()/getLineHeight() so positions line up
	// with the Yoga-computed box.
	const lineAdvance = doc.currentLineHeight(true) * (style.lineHeight ?? 1);
	const charSpacing = style.letterSpacing as number | undefined;

	// Prefer the metadata the paginator carried through (it knows the true
	// paragraph boundaries for split text); otherwise wrap the text here.
	const lines: WrappedLine[] = Array.isArray(node.props.justifyLines)
		? node.props.justifyLines
		: wrapLinesMeta(text, style, width);

	doc.fillColor(color, opacity).fontSize(fontSize);

	const widthOpts = charSpacing != null ? { characterSpacing: charSpacing } : undefined;

	lines.forEach((line, i) => {
		const opts: Record<string, any> = {
			width,
			lineBreak: false,
			...(charSpacing != null && { characterSpacing: charSpacing }),
			...(style.textDecoration === 'underline' && { underline: true }),
			...(style.textDecoration === 'line-through' && { strike: true })
		};

		const spaceCount = (line.text.match(/ /g) ?? []).length;
		if (!line.lastInParagraph && spaceCount > 0) {
			const natural = doc.widthOfString(line.text, widthOpts);
			const slack = width - natural;
			if (slack > 0) opts.wordSpacing = slack / spaceCount;
		}

		doc.text(line.text, x, y + i * lineAdvance, opts);
	});
}
