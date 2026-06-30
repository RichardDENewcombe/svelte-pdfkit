// Lazy-initialised PDFDocument used only for text measurement — never rendered.
// Fonts must be registered on this instance before measurement can be accurate
// for custom typefaces. Built-in PDFKit fonts (Helvetica, Courier, etc.) work
// without any setup.

import { createRequire } from 'node:module';
import { resolveFontStack } from '../runtime/font-registry.js';
import { hyphenateWord } from './hyphenation.js';
import { splitFontRuns, widthOfRuns, type FontRun } from './font-runs.js';

// pdfkit ships as CommonJS. In an ESM / Vite SSR context `require` is not
// available as a global, but Node.js provides `createRequire` so we can get
// a CJS require function that works in any module format.
const _require = createRequire(import.meta.url);

let measureDoc: any = null;

export function getMeasureDoc(): any {
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

/** Splits a string into per-font runs for a text style's fallback stack. */
function styleRuns(text: string, style: Record<string, any>): FontRun[] {
	return splitFontRuns(text, style.fontFamily, style.fontWeight, style.fontStyle);
}

/**
 * Width of `text` under `style`, accounting for per-glyph font fallback: a
 * mixed-script string is measured run by run, each in the font that actually
 * has its glyphs. Single-font text (the common case) takes the unchanged path.
 *
 * The font/size must already be applied via {@link applyMeasureFont}; for
 * multi-font text the primary font is re-applied afterwards so later calls on
 * the shared measure doc see the expected state.
 */
function measureWidth(
	doc: any,
	text: string,
	style: Record<string, any>,
	opts?: Record<string, any>
): number {
	const runs = styleRuns(text, style);
	if (runs.length <= 1) return doc.widthOfString(text, opts);
	const width = widthOfRuns(doc, runs, opts);
	applyMeasureFont(doc, style);
	return width;
}

/**
 * Natural PDFKit line height for `text` under `style`. For multi-font text the
 * tallest font in the line drives the height, so a line mixing a short Latin
 * font with a tall CJK fallback reserves enough vertical space. Restores the
 * primary font afterwards.
 */
function naturalLineHeight(doc: any, style: Record<string, any>, text?: string): number {
	if (text) {
		const runs = styleRuns(text, style);
		if (runs.length > 1) {
			let max = 0;
			const seen = new Set<string>();
			for (const run of runs) {
				if (seen.has(run.font)) continue;
				seen.add(run.font);
				try {
					doc.font(run.font);
				} catch {
					doc.font('Helvetica');
				}
				max = Math.max(max, doc.currentLineHeight(true));
			}
			applyMeasureFont(doc, style);
			return max;
		}
	}
	return doc.currentLineHeight(true);
}

/**
 * Returns the effective line height for a text style — the natural PDFKit
 * line height multiplied by the `lineHeight` style prop if set. Pass `text`
 * so multi-font lines are sized by their tallest font.
 */
export function getLineHeight(style: Record<string, any>, text?: string): number {
	const doc = getMeasureDoc();
	applyMeasureFont(doc, style);

	const natural = naturalLineHeight(doc, style, text);
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
	// Run-aware width function: for single-font text this is just
	// doc.widthOfString; for mixed-script text it measures each font run under its
	// own font so wrap points reflect the real per-glyph widths.
	const measure = makeMeasure(doc, style, text);

	const result: WrappedLine[] = [];

	for (const paragraph of text.split('\n')) {
		if (maxWidth <= 0) {
			// No width constraint — each paragraph is one line, and that line ends
			// the paragraph.
			result.push({ text: paragraph, lastInParagraph: true });
			continue;
		}

		const paraLines = wrapParagraph(measure, paragraph, maxWidth, hyphenate, lang);

		paraLines.forEach((line, i) => {
			result.push({ text: line, lastInParagraph: i === paraLines.length - 1 });
		});
	}

	return result;
}

/** A width function used by the wrapper: returns the rendered width of a string. */
type Measure = (s: string) => number;

/**
 * Builds the width function the wrapper measures candidate lines with. When
 * `text` needs only one font, returns `doc.widthOfString` directly so single-font
 * wrapping is byte-for-byte unchanged. When it spans multiple fonts, returns a
 * run-aware function that measures each font run under its own font and restores
 * the primary font afterwards.
 */
function makeMeasure(doc: any, style: Record<string, any>, text: string): Measure {
	const multi = styleRuns(text, style).length > 1;
	if (!multi) return (s: string) => doc.widthOfString(s);
	return (s: string) => {
		const w = widthOfRuns(doc, styleRuns(s, style));
		applyMeasureFont(doc, style);
		return w;
	};
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
	measure: Measure,
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
		if (measure(acc + HYPHEN) <= avail) {
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
	measure: Measure,
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
		while (measure(rem) > maxWidth) {
			const br = breakWordToFit(measure, rem, maxWidth, lang);
			if (!br) break;
			lines.push(br.head + HYPHEN);
			rem = br.tail;
		}
		return rem;
	};

	// Starts a fresh line with `word`, breaking it if it is itself too wide.
	const startLine = (word: string): string =>
		!hyphenate || measure(word) <= maxWidth ? word : flushOverlong(word);

	for (const word of words) {
		if (!current) {
			current = startLine(word);
			continue;
		}

		const candidate = `${current} ${word}`;
		if (measure(candidate) <= maxWidth) {
			current = candidate;
			continue;
		}

		if (hyphenate) {
			// Try to fit a hyphenated prefix of `word` onto the current line.
			const avail = maxWidth - measure(`${current} `);
			const br = breakWordToFit(measure, word, avail, lang);
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

	const natural = naturalLineHeight(doc, style, text);
	// Apply the lineHeight multiplier if set. This matches draw-text.ts where
	// we convert the multiplier to PDFKit's lineGap for rendering.
	const lineHeight = style.lineHeight != null ? natural * style.lineHeight : natural;

	if (constrainedWidth > 0) {
		// Use actual word-wrapping to count lines so the Yoga-computed height
		// matches the paginator's line splitting exactly.  The simple
		// ceil(totalWidth / constrainedWidth) approximation ignores word
		// boundaries and can produce heights that differ from the real wrap,
		// causing content to be misplaced across page boundaries.
		const wrappedLines = wrapLines(text, style, constrainedWidth);
		const fullWidth = measureWidth(doc, text, style);
		return {
			width: Math.min(fullWidth, constrainedWidth),
			height: lineHeight * Math.max(1, wrappedLines.length)
		};
	}

	return {
		width: measureWidth(doc, text, style),
		height: lineHeight
	};
}
