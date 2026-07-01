/**
 * Tests for text justification (textAlign: 'justify').
 *
 * Justification stretches each line to the full content width by distributing
 * slack across its word gaps — EXCEPT the last line of a paragraph, which
 * renders at its natural width. Because the paginator pre-wraps text and joins
 * lines with '\n' (which PDFKit would read as separate one-line paragraphs and
 * refuse to justify), the renderer lays out justified text line-by-line using
 * paragraph metadata carried through from wrapping.
 *
 * These tests cover three layers:
 *   1. wrapLinesMeta() — correct lastInParagraph flags.
 *   2. paginate()      — split justified text carries justifyLines metadata.
 *   3. drawText()      — non-final lines get wordSpacing; final lines do not.
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { createDocument } from '../runtime/document.js';
import { paginate } from '../pagination/paginate.js';
import { getLineHeight, wrapLinesMeta } from '../layout/text-measure.js';
import { drawText } from '../renderer/draw-text.js';
import { renderComponent } from '../runtime/render.js';
import JustifyTemplate from './JustifyTemplate.svelte';
import type { PDFNode } from '../types/pdf.js';

function streamToBuffer(stream: any): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (c: Buffer) => chunks.push(c));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
		stream.on('error', reject);
	});
}

const PAGE_HEIGHT = 842;
const PAD_BOTTOM = 50;
const CONTENT_END = PAGE_HEIGHT - PAD_BOTTOM; // 792
const BASE_STYLE = { fontSize: 12, fontFamily: 'Helvetica' };

function makeDoc(children: PDFNode[]) {
	const doc = createDocument();
	const page: PDFNode = {
		type: 'page',
		props: { size: 'A4', width: 595, height: PAGE_HEIGHT, style: { paddingBottom: PAD_BOTTOM } },
		children,
		layout: { x: 0, y: 0, width: 595, height: PAGE_HEIGHT }
	};
	doc.children.push(page);
	return doc;
}

function collectText(page: PDFNode): PDFNode[] {
	const result: PDFNode[] = [];
	function walk(n: PDFNode) {
		if (n.type === 'text') result.push(n);
		n.children.forEach(walk);
	}
	walk(page);
	return result;
}

/**
 * A minimal stand-in for a PDFKit document that records text() calls so we can
 * inspect the options (notably wordSpacing) the renderer passes per line.
 * widthOfString returns a width proportional to character count so "slack" is
 * deterministic; currentLineHeight is a fixed value.
 */
function fakeDoc() {
	const calls: Array<{ text: string; x: number; y: number; opts: any }> = [];
	const doc: any = {
		calls,
		_charWidth: 6,
		font() {
			return doc;
		},
		fontSize() {
			return doc;
		},
		fillColor() {
			return doc;
		},
		currentLineHeight() {
			return 14;
		},
		widthOfString(s: string) {
			return s.length * doc._charWidth;
		},
		text(t: string, x: number, y: number, opts: any) {
			calls.push({ text: t, x, y, opts });
			return doc;
		}
	};
	return doc;
}

// ── 1. wrapLinesMeta ────────────────────────────────────────────────────────────

describe('wrapLinesMeta – paragraph metadata', () => {
	it('marks only the final wrapped line of a paragraph as lastInParagraph', () => {
		// A long single paragraph that wraps to several lines within a narrow box.
		const text = 'one two three four five six seven eight nine ten eleven twelve';
		const lines = wrapLinesMeta(text, BASE_STYLE, 80);

		expect(lines.length).toBeGreaterThan(1);
		// Every line except the last belongs mid-paragraph.
		lines.slice(0, -1).forEach((l) => expect(l.lastInParagraph).toBe(false));
		expect(lines[lines.length - 1].lastInParagraph).toBe(true);
	});

	it('treats each hard newline as a paragraph boundary', () => {
		const lines = wrapLinesMeta('alpha\nbeta\ngamma', BASE_STYLE, 500);
		// Each short paragraph fits on one line and therefore ends its paragraph.
		expect(lines.map((l) => l.text)).toEqual(['alpha', 'beta', 'gamma']);
		expect(lines.every((l) => l.lastInParagraph)).toBe(true);
	});

	it('reconstructs the original line content via .text', () => {
		const text = 'aaa bbb ccc ddd eee fff ggg hhh';
		const lines = wrapLinesMeta(text, BASE_STYLE, 60);
		expect(lines.map((l) => l.text).join(' ')).toBe(text);
	});
});

// ── 2. Paginator metadata pass-through ───────────────────────────────────────────

describe('paginate – justify metadata', () => {
	it('attaches justifyLines to a split justified text node', () => {
		const lh = getLineHeight(BASE_STYLE);
		const textY = CONTENT_END - lh * 1.5; // 1 line fits on page 1
		const text = 'Line 1\nLine 2\nLine 3';
		const doc = makeDoc([
			{
				type: 'text',
				props: { text, style: { ...BASE_STYLE, textAlign: 'justify' } },
				children: [],
				layout: { x: 40, y: textY, width: 515, height: 3 * lh }
			}
		]);

		const pages = paginate(doc);
		const allText = pages.flatMap((p) => collectText(p));

		// Every emitted slice of a justified node carries paragraph metadata.
		for (const n of allText) {
			expect(Array.isArray(n.props.justifyLines)).toBe(true);
			expect(n.props.justifyLines.length).toBe(n.props.text.split('\n').length);
		}
	});

	it('does NOT attach justifyLines when textAlign is not justify', () => {
		const lh = getLineHeight(BASE_STYLE);
		const textY = CONTENT_END - lh * 1.5;
		const doc = makeDoc([
			{
				type: 'text',
				props: { text: 'Line 1\nLine 2\nLine 3', style: { ...BASE_STYLE, textAlign: 'left' } },
				children: [],
				layout: { x: 40, y: textY, width: 515, height: 3 * lh }
			}
		]);

		const pages = paginate(doc);
		for (const n of pages.flatMap((p) => collectText(p))) {
			expect(n.props.justifyLines).toBeUndefined();
		}
	});
});

// ── 3. Renderer behaviour ─────────────────────────────────────────────────────────

describe('drawText – justified rendering', () => {
	function justifiedNode(text: string, justifyLines?: any): PDFNode {
		return {
			type: 'text',
			props: {
				text,
				style: { ...BASE_STYLE, textAlign: 'justify' },
				...(justifyLines && { justifyLines })
			},
			children: [],
			layout: { x: 0, y: 0, width: 120, height: 100 }
		};
	}

	it('stretches non-final lines and leaves the final line natural', () => {
		const doc = fakeDoc();
		// A paragraph of three wrapped lines (the third ends the paragraph).
		// Explicit metadata keeps the wrapping deterministic under the fake doc.
		const node = justifiedNode('aa bb cc\ndd ee ff\ngg hh ii', [
			{ text: 'aa bb cc', lastInParagraph: false },
			{ text: 'dd ee ff', lastInParagraph: false },
			{ text: 'gg hh ii', lastInParagraph: true }
		]);
		drawText(doc, node);

		expect(doc.calls).toHaveLength(3);
		// The final line of the paragraph is never justified.
		expect(doc.calls[2].opts.wordSpacing).toBeUndefined();
		// The two earlier lines are stretched.
		expect(doc.calls[0].opts.wordSpacing).toBeGreaterThan(0);
		expect(doc.calls[1].opts.wordSpacing).toBeGreaterThan(0);
	});

	it('advances each line by the effective line height', () => {
		const doc = fakeDoc();
		drawText(
			doc,
			justifiedNode('aa bb cc\ndd ee ff\ngg hh ii', [
				{ text: 'aa bb cc', lastInParagraph: false },
				{ text: 'dd ee ff', lastInParagraph: false },
				{ text: 'gg hh ii', lastInParagraph: true }
			])
		);
		const ys = doc.calls.map((c: { y: number }) => c.y);
		// 14 = currentLineHeight, lineHeight multiplier defaults to 1.
		for (let i = 1; i < ys.length; i++) {
			expect(ys[i] - ys[i - 1]).toBeCloseTo(14, 5);
		}
	});

	it('does not stretch single-word lines (no gaps to distribute into)', () => {
		const doc = fakeDoc();
		// A word longer than the box width sits alone on a line; it cannot be
		// justified and must not receive wordSpacing even though it is not final.
		const node = justifiedNode('superlongunbreakableword and more words here please');
		drawText(doc, node);
		const firstLine = doc.calls[0];
		expect(firstLine.text.includes(' ')).toBe(false);
		expect(firstLine.opts.wordSpacing).toBeUndefined();
	});

	it('honours carried justifyLines metadata over re-wrapping', () => {
		const doc = fakeDoc();
		// Simulate a paginator slice: mid-paragraph lines (lastInParagraph false)
		// even though each is a complete short string. All should be stretched.
		const justifyLines = [
			{ text: 'aa bb cc', lastInParagraph: false },
			{ text: 'dd ee ff', lastInParagraph: false }
		];
		const node = justifiedNode('aa bb cc\ndd ee ff', justifyLines);
		drawText(doc, node);

		expect(doc.calls).toHaveLength(2);
		// Both lines stretched because metadata says neither ends a paragraph.
		expect(doc.calls[0].opts.wordSpacing).toBeGreaterThan(0);
		expect(doc.calls[1].opts.wordSpacing).toBeGreaterThan(0);
	});

	it('distributes the correct slack across word gaps', () => {
		const doc = fakeDoc();
		const justifyLines = [{ text: 'aa bb cc', lastInParagraph: false }];
		const node = justifiedNode('aa bb cc', justifyLines);
		drawText(doc, node);

		// width 120, natural = "aa bb cc".length(8) * 6 = 48, slack = 72,
		// 2 spaces → wordSpacing = 36.
		expect(doc.calls[0].opts.wordSpacing).toBeCloseTo(36, 5);
	});

	it('never passes a width constraint to text() (PDFKit re-wraps a full line despite lineBreak:false)', () => {
		const doc = fakeDoc();
		// A justified line stretched to exactly the box width sits on the wrap
		// boundary. If width were passed, PDFKit would wrap the trailing word onto
		// a second visual line — even with lineBreak:false — and it would overlap
		// the next line. The single-font path must therefore omit `width` entirely,
		// matching the multi-font path which positions runs explicitly.
		const node = justifiedNode('aa bb cc', [{ text: 'aa bb cc', lastInParagraph: false }]);
		drawText(doc, node);
		expect(doc.calls[0].opts.width).toBeUndefined();
		expect(doc.calls[0].opts.lineBreak).toBe(false);
	});

	it('does not let a full-width justified line re-wrap (real PDFKit)', () => {
		const _require = createRequire(import.meta.url);
		const PDFDocument = _require('pdfkit');
		const doc = new PDFDocument({ autoFirstPage: false });
		doc.addPage();

		// natural width ≈ 222 in Helvetica @10pt — a hair wider than the 220 box.
		// With the old `width` option PDFKit wrapped "while" onto a second line
		// (cursor advances ~2 line heights); without it the line draws once.
		const width = 220;
		const text = 'The quick brown fox jumps over the lazy dog while';
		const node: PDFNode = {
			type: 'text',
			props: {
				text,
				style: { fontSize: 10, fontFamily: 'Helvetica', textAlign: 'justify' },
				justifyLines: [{ text, lastInParagraph: false }]
			},
			children: [],
			layout: { x: 40, y: 100, width, height: 50 }
		};

		drawText(doc, node);

		const lh = doc.currentLineHeight(true);
		// One line drawn ⇒ cursor advanced by ~one line height, not two.
		expect(doc.y - 100).toBeLessThan(lh * 1.5);
	});

	it('falls back to the normal path when width is 0', () => {
		const doc = fakeDoc();
		const node: PDFNode = {
			type: 'text',
			props: { text: 'aa bb cc', style: { ...BASE_STYLE, textAlign: 'justify' } },
			children: [],
			layout: { x: 0, y: 0, width: 0, height: 20 }
		};
		drawText(doc, node);
		// Single text() call (the standard path), passing align through.
		expect(doc.calls).toHaveLength(1);
		expect(doc.calls[0].opts.align).toBe('justify');
	});
});

// ── 4. End-to-end render (real PDFKit) ───────────────────────────────────────────

describe('justify – end-to-end render', () => {
	it('renders a valid multi-page justified PDF', async () => {
		const stream = await renderComponent(JustifyTemplate);
		const buf = await streamToBuffer(stream);

		expect(buf.slice(0, 5).toString()).toBe('%PDF-');
		expect(buf.length).toBeGreaterThan(1000);
		// The long justified paragraph overflows one page, so the paginator must
		// split it — confirming the carried justifyLines metadata survives a real
		// render across page boundaries.
		const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
		expect(pages).toBeGreaterThan(1);
	});
});
