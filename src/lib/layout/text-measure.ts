// Lazy-initialised PDFDocument used only for text measurement — never rendered.
// Fonts must be registered on this instance before measurement can be accurate
// for custom typefaces. Built-in PDFKit fonts (Helvetica, Courier, etc.) work
// without any setup.

import { createRequire } from 'node:module';
import { resolveFont } from '../runtime/font-registry.js';

// pdfkit ships as CommonJS. In an ESM / Vite SSR context `require` is not
// available as a global, but Node.js provides `createRequire` so we can get
// a CJS require function that works in any module format.
const _require = createRequire(import.meta.url);

let measureDoc: any = null;

function getMeasureDoc(): any {
	if (!measureDoc) {
		const PDFDocument = _require('pdfkit');
		measureDoc = new PDFDocument({ autoFirstPage: false });
		measureDoc.addPage();
	}
	return measureDoc;
}

/**
 * Registers a loaded font buffer on the measure document.
 *
 * Must be called for every custom font after loadResources() fetches the
 * buffer — before computeLayout() runs — so that widthOfString() and
 * currentLineHeight() use the correct metrics for that typeface.
 *
 * PDFKit throws if you register the same name+variant twice, so we swallow
 * that specific error silently.
 */
export function registerFontOnMeasureDoc(name: string, buffer: Buffer): void {
	const doc = getMeasureDoc();
	try {
		doc.registerFont(name, buffer);
	} catch {
		// Already registered — safe to ignore.
	}
}

/**
 * Returns the effective line height for a text style — the natural PDFKit
 * line height multiplied by the `lineHeight` style prop if set.
 */
export function getLineHeight(style: Record<string, any>): number {
	const doc = getMeasureDoc();
	const fontSize = style.fontSize ?? 12;
	const fontFamily = style.fontFamily ?? 'Helvetica';
	const fontName = resolveFont(fontFamily, style.fontWeight, style.fontStyle);

	try {
		doc.font(fontName).fontSize(fontSize);
	} catch {
		try {
			doc.font(fontFamily).fontSize(fontSize);
		} catch {
			doc.font('Helvetica').fontSize(fontSize);
		}
	}

	const natural = doc.currentLineHeight(true);
	return style.lineHeight != null ? natural * style.lineHeight : natural;
}

/** A single wrapped line plus the metadata justification needs. */
export interface WrappedLine {
	text: string;
	/**
	 * True when this line is the final line of its source paragraph — i.e. a
	 * hard newline follows it, or it is the end of the text. Justified text must
	 * NOT stretch these lines: the last line of a paragraph always renders at its
	 * natural width.
	 */
	lastInParagraph: boolean;
}

/**
 * Word-wraps `text` to fit within `maxWidth` points using PDFKit font metrics,
 * returning each line together with whether it ends its source paragraph.
 *
 * Splits on explicit newlines first, then applies greedy word-wrap within each
 * paragraph. Words wider than `maxWidth` are placed on their own line without
 * mid-word breaking (hyphenation is a future improvement).
 *
 * The doc must already have the correct font and size set before calling this,
 * but that is guaranteed because `getLineHeight` is always called first in the
 * split path and sets the font state.
 *
 * Returns an array of {@link WrappedLine}. An empty `text` returns `[]`.
 */
export function wrapLinesMeta(
	text: string,
	style: Record<string, any>,
	maxWidth: number
): WrappedLine[] {
	const safeText = text != null ? String(text) : '';
	if (!safeText) return [];
	text = safeText;

	const doc = getMeasureDoc();
	const fontSize = style.fontSize ?? 12;
	const fontFamily = style.fontFamily ?? 'Helvetica';
	const fontName = resolveFont(fontFamily, style.fontWeight, style.fontStyle);

	try {
		doc.font(fontName).fontSize(fontSize);
	} catch {
		try {
			doc.font(fontFamily).fontSize(fontSize);
		} catch {
			doc.font('Helvetica').fontSize(fontSize);
		}
	}

	const result: WrappedLine[] = [];

	for (const paragraph of text.split('\n')) {
		if (maxWidth <= 0) {
			// No width constraint — each paragraph is one line, and that line ends
			// the paragraph.
			result.push({ text: paragraph, lastInParagraph: true });
			continue;
		}

		const words = paragraph.split(' ');
		let current = '';
		const paraLines: string[] = [];

		for (const word of words) {
			if (!current) {
				current = word;
			} else {
				const candidate = `${current} ${word}`;
				if (doc.widthOfString(candidate) <= maxWidth) {
					current = candidate;
				} else {
					paraLines.push(current);
					current = word;
				}
			}
		}

		paraLines.push(current);

		paraLines.forEach((line, i) => {
			result.push({ text: line, lastInParagraph: i === paraLines.length - 1 });
		});
	}

	return result;
}

/**
 * Word-wraps `text` into plain line strings — a thin wrapper over
 * {@link wrapLinesMeta} for callers that don't need paragraph metadata.
 */
export function wrapLines(text: string, style: Record<string, any>, maxWidth: number): string[] {
	return wrapLinesMeta(text, style, maxWidth).map((l) => l.text);
}

export function measureText(
	text: string,
	style: Record<string, any>,
	constrainedWidth = 0
): { width: number; height: number } {
	if (!text) return { width: 0, height: 0 };

	const doc = getMeasureDoc();
	const fontSize = style.fontSize ?? 12;
	const fontFamily = style.fontFamily ?? 'Helvetica';
	const fontName = resolveFont(fontFamily, style.fontWeight, style.fontStyle);

	try {
		doc.font(fontName).fontSize(fontSize);
	} catch {
		// Variant not registered — fall back to the base family, then Helvetica.
		try {
			doc.font(fontFamily).fontSize(fontSize);
		} catch {
			doc.font('Helvetica').fontSize(fontSize);
		}
	}

	const naturalLineHeight = doc.currentLineHeight(true);
	// Apply the lineHeight multiplier if set. This matches draw-text.ts where
	// we convert the multiplier to PDFKit's lineGap for rendering.
	const lineHeight =
		style.lineHeight != null ? naturalLineHeight * style.lineHeight : naturalLineHeight;

	if (constrainedWidth > 0) {
		// Use actual word-wrapping to count lines so the Yoga-computed height
		// matches the paginator's line splitting exactly.  The simple
		// ceil(totalWidth / constrainedWidth) approximation ignores word
		// boundaries and can produce heights that differ from the real wrap,
		// causing content to be misplaced across page boundaries.
		const wrappedLines = wrapLines(text, style, constrainedWidth);
		const fullWidth = doc.widthOfString(text);
		return {
			width: Math.min(fullWidth, constrainedWidth),
			height: lineHeight * Math.max(1, wrappedLines.length)
		};
	}

	return {
		width: doc.widthOfString(text),
		height: lineHeight
	};
}
