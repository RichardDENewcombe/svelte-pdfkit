// Lazy-initialised PDFDocument used only for text measurement — never rendered.
// Fonts must be registered on this instance before measurement can be accurate
// for custom typefaces. Built-in PDFKit fonts (Helvetica, Courier, etc.) work
// without any setup.

import { createRequire } from 'node:module';
import { resolveFontStack } from '../runtime/font-registry.js';
import { hyphenateWord } from './hyphenation.js';

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
 * Sets the measure document's font and size from a text style.
 *
 * Resolves the `fontFamily` (single value or fallback stack) to the first
 * available family, falling back to Helvetica if even that cannot be selected.
 */
function applyMeasureFont(doc: any, style: Record<string, any>): void {
	const fontSize = style.fontSize ?? 12;
	const fontName = resolveFontStack(style.fontFamily, style.fontWeight, style.fontStyle);
	try {
		doc.font(fontName).fontSize(fontSize);
	} catch {
		doc.font('Helvetica').fontSize(fontSize);
	}
}

/**
 * Returns the effective line height for a text style — the natural PDFKit
 * line height multiplied by the `lineHeight` style prop if set.
 */
export function getLineHeight(style: Record<string, any>): number {
	const doc = getMeasureDoc();
	applyMeasureFont(doc, style);

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
 * paragraph. When `style.hyphenation` is enabled, words that overflow are broken
 * at dictionary hyphenation points with a trailing `-`; otherwise an overlong
 * word is placed on its own line without mid-word breaking.
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
	applyMeasureFont(doc, style);

	const hyphenate = style.hyphenation === true;
	const lang = style.hyphenationLang as string | undefined;

	const result: WrappedLine[] = [];

	for (const paragraph of text.split('\n')) {
		if (maxWidth <= 0) {
			// No width constraint — each paragraph is one line, and that line ends
			// the paragraph.
			result.push({ text: paragraph, lastInParagraph: true });
			continue;
		}

		const paraLines = wrapParagraph(doc, paragraph, maxWidth, hyphenate, lang);

		paraLines.forEach((line, i) => {
			result.push({ text: line, lastInParagraph: i === paraLines.length - 1 });
		});
	}

	return result;
}

/** Hyphen inserted at a mid-word break. ASCII so every font has the glyph. */
const HYPHEN = '-';

/**
 * Finds the longest leading prefix of `word`'s hyphenation parts that fits —
 * with a trailing hyphen — within `avail` points. Returns the `head` (without
 * the hyphen, which the caller appends) and the remaining `tail`, or `null` if
 * no usable break exists.
 */
function breakWordToFit(
	doc: any,
	word: string,
	avail: number,
	lang: string | undefined
): { head: string; tail: string } | null {
	const parts = hyphenateWord(word, lang);
	if (parts.length < 2) return null;

	let best: { head: string; tail: string } | null = null;
	let acc = '';
	// Stop before the last part so the tail is never empty.
	for (let i = 0; i < parts.length - 1; i++) {
		acc += parts[i];
		if (doc.widthOfString(acc + HYPHEN) <= avail) {
			best = { head: acc, tail: parts.slice(i + 1).join('') };
		} else {
			break;
		}
	}
	return best;
}

/**
 * Greedy word-wrap for a single paragraph (no embedded newlines), returning the
 * line strings. With `hyphenate` off this is plain greedy wrapping; with it on,
 * overflowing words are broken at hyphenation points where that lets more text
 * fit on a line.
 */
function wrapParagraph(
	doc: any,
	paragraph: string,
	maxWidth: number,
	hyphenate: boolean,
	lang: string | undefined
): string[] {
	const words = paragraph.split(' ');
	const lines: string[] = [];
	let current = '';

	// Emits hyphenated head-lines for a word that is wider than a whole line,
	// returning the trailing remainder (which fits, or is the largest piece that
	// could not be broken further).
	const flushOverlong = (word: string): string => {
		let rem = word;
		while (doc.widthOfString(rem) > maxWidth) {
			const br = breakWordToFit(doc, rem, maxWidth, lang);
			if (!br) break;
			lines.push(br.head + HYPHEN);
			rem = br.tail;
		}
		return rem;
	};

	// Starts a fresh line with `word`, breaking it if it is itself too wide.
	const startLine = (word: string): string =>
		!hyphenate || doc.widthOfString(word) <= maxWidth ? word : flushOverlong(word);

	for (const word of words) {
		if (!current) {
			current = startLine(word);
			continue;
		}

		const candidate = `${current} ${word}`;
		if (doc.widthOfString(candidate) <= maxWidth) {
			current = candidate;
			continue;
		}

		if (hyphenate) {
			// Try to fit a hyphenated prefix of `word` onto the current line.
			const avail = maxWidth - doc.widthOfString(`${current} `);
			const br = breakWordToFit(doc, word, avail, lang);
			if (br) {
				lines.push(`${current} ${br.head}${HYPHEN}`);
				current = flushOverlong(br.tail);
				continue;
			}
		}

		// No mid-word break — push the line and start the next with `word`.
		lines.push(current);
		current = startLine(word);
	}

	lines.push(current);
	return lines;
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
	applyMeasureFont(doc, style);

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
