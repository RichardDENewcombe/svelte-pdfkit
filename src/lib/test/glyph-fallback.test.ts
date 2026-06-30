/**
 * Tests for glyph-level (per-character) font fallback — Issue #1.
 *
 * Builds on family-level fallback (font-fallback.test.ts): instead of picking
 * one font for a whole run, each grapheme keeps the primary font when it has the
 * glyph and drops to the next font in the `fontFamily` stack only for code
 * points the primary lacks.
 *
 * Fixtures use two macOS system fonts with known, disjoint coverage:
 *   • Andale Mono   — basic Latin only (no CJK, no combining marks)
 *   • Arial Unicode — covers Latin + CJK + combining marks
 * (The existing font tests already hardcode these /System paths.)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
	registerFontCoverage,
	fontCovers,
	clearFontCoverage
} from '../runtime/glyph-coverage.js';
import { splitFontRuns, widthOfRuns } from '../layout/font-runs.js';
import { clearRegisteredVariants } from '../runtime/font-registry.js';
import { loadResources, clearCaches } from '../runtime/resources.js';
import { measureText, getMeasureDoc, wrapLinesMeta, getLineHeight } from '../layout/text-measure.js';
import { drawText } from '../renderer/draw-text.js';
import type { PDFNode } from '../types/pdf.js';

/** Run-aware width of a string under a fallback stack (test helper). */
function runWidth(text: string, families: string[], fontSize = 20): number {
	const doc = getMeasureDoc();
	doc.fontSize(fontSize);
	return widthOfRuns(doc, splitFontRuns(text, families));
}

const LATIN = '/System/Library/Fonts/Supplemental/Andale Mono.ttf'; // Latin only
const UNI = '/System/Library/Fonts/Supplemental/Arial Unicode.ttf'; // covers CJK

// Register both fonts as a Latin primary + Unicode fallback stack.
async function registerStack() {
	await loadResources([
		{ type: 'font', name: 'DemoLatin', src: LATIN },
		{ type: 'font', name: 'DemoCJK', src: UNI }
	]);
}

beforeEach(async () => {
	clearCaches();
	clearRegisteredVariants();
	clearFontCoverage();
	await registerStack();
});

// ── 1. fontCovers ───────────────────────────────────────────────────────────

describe('fontCovers', () => {
	it('reports true/false per code point for a registered custom font', () => {
		expect(fontCovers('DemoLatin', 'A'.codePointAt(0)!)).toBe(true);
		expect(fontCovers('DemoLatin', 0x4e16)).toBe(false); // 世 — Andale lacks CJK
		expect(fontCovers('DemoCJK', 0x4e16)).toBe(true);
	});

	it('treats built-in fonts as covering WinAnsi/Latin-1 but not CJK', () => {
		expect(fontCovers('Helvetica', 'A'.codePointAt(0)!)).toBe(true);
		expect(fontCovers('Helvetica', 0x00e9)).toBe(true); // é (Latin-1)
		expect(fontCovers('Helvetica', 0x20ac)).toBe(true); // € (WinAnsi special)
		expect(fontCovers('Helvetica', 0x4e16)).toBe(false); // 世 (CJK)
	});

	it('returns false for an unknown variant', () => {
		expect(fontCovers('NeverRegistered', 'A'.codePointAt(0)!)).toBe(false);
	});
});

// ── 2. splitFontRuns ────────────────────────────────────────────────────────

describe('splitFontRuns', () => {
	it('keeps primary-covered text in the primary font', () => {
		const runs = splitFontRuns('Hello', ['DemoLatin', 'DemoCJK']);
		expect(runs).toEqual([{ text: 'Hello', font: 'DemoLatin' }]);
	});

	it('substitutes only the uncovered code points, coalescing runs', () => {
		const runs = splitFontRuns('A世界B', ['DemoLatin', 'DemoCJK']);
		expect(runs).toEqual([
			{ text: 'A', font: 'DemoLatin' },
			{ text: '世界', font: 'DemoCJK' },
			{ text: 'B', font: 'DemoLatin' }
		]);
	});

	it('never splits a grapheme cluster across fonts (base + combining mark)', () => {
		// "e" + U+0301 combining acute = one grapheme. Andale has "e" but not the
		// combining mark, so the *whole cluster* must go to the fallback together.
		const runs = splitFontRuns('é', ['DemoLatin', 'DemoCJK']);
		expect(runs).toEqual([{ text: 'é', font: 'DemoCJK' }]);
	});

	it('returns a single run when only one family is available (fast path)', () => {
		const runs = splitFontRuns('A世', ['DemoLatin']);
		expect(runs).toHaveLength(1);
		expect(runs[0].font).toBe('DemoLatin');
		expect(runs[0].text).toBe('A世');
	});

	it('returns a single run when the primary covers everything (fast path)', () => {
		const runs = splitFontRuns('Hello world', ['DemoLatin', 'DemoCJK']);
		expect(runs).toHaveLength(1);
	});
});

// ── 3. Run-aware measurement ─────────────────────────────────────────────────

describe('measureText — multi-font', () => {
	it('measures a mixed-script line as the sum of its per-font run widths', () => {
		const doc = getMeasureDoc();
		const wA = (doc.font('DemoLatin').fontSize(20), doc.widthOfString('A'));
		const wCJK = (doc.font('DemoCJK').fontSize(20), doc.widthOfString('世'));

		const measured = measureText('A世', { fontFamily: ['DemoLatin', 'DemoCJK'], fontSize: 20 }, 0);
		expect(measured.width).toBeCloseTo(wA + wCJK, 2);
	});

	it('differs from measuring the whole string in the primary font alone', () => {
		const stacked = measureText('A世界', { fontFamily: ['DemoLatin', 'DemoCJK'], fontSize: 20 }, 0);
		const primaryOnly = measureText('A世界', { fontFamily: 'DemoLatin', fontSize: 20 }, 0);
		expect(stacked.width).not.toBeCloseTo(primaryOnly.width, 1);
	});
});

// ── 4. widthOfRuns helper ────────────────────────────────────────────────────

describe('widthOfRuns', () => {
	it('sums widthOfString across each run under its own font', () => {
		const doc = getMeasureDoc();
		doc.fontSize(20);
		const runs = splitFontRuns('A世', ['DemoLatin', 'DemoCJK']);
		const wA = (doc.font('DemoLatin'), doc.widthOfString('A'));
		const wCJK = (doc.font('DemoCJK'), doc.widthOfString('世'));
		expect(widthOfRuns(doc, runs)).toBeCloseTo(wA + wCJK, 2);
	});
});

// ── 5. Renderer draws each run in its own font ───────────────────────────────

/**
 * A minimal PDFKit stand-in that records font() and text() calls. text()
 * accepts both the 4-arg (text, x, y, opts) first-fragment form and the 2-arg
 * (text, opts) continued form.
 */
function fakeDoc() {
	const fontCalls: string[] = [];
	const textCalls: Array<{ text: string; font: string; x?: number; opts: any }> = [];
	let current = '';
	const doc: any = {
		fontCalls,
		textCalls,
		font(name: string) {
			current = name;
			fontCalls.push(name);
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
			return s.length * 6;
		},
		text(t: string, a?: any, b?: any, c?: any) {
			const opts = typeof a === 'object' ? a : c;
			const x = typeof a === 'number' ? a : undefined;
			textCalls.push({ text: t, font: current, x, opts });
			return doc;
		}
	};
	return doc;
}

function textNode(text: string, style: Record<string, any>, width = 0): PDFNode {
	return {
		type: 'text',
		props: { text, style },
		children: [],
		layout: { x: 0, y: 0, width, height: 100 }
	};
}

describe('drawText — multi-font rendering', () => {
	it('draws each run with its own font at an advancing x', () => {
		const doc = fakeDoc(); // widthOfString = length * 6

		drawText(doc, textNode('A世', { fontFamily: ['DemoLatin', 'DemoCJK'], fontSize: 20 }));

		// Two runs rendered in order, each in the right font.
		expect(doc.textCalls.map((c: any) => [c.text, c.font])).toEqual([
			['A', 'DemoLatin'],
			['世', 'DemoCJK']
		]);
		// The second run starts after the first run's measured width (6pt), not at
		// the same x — runs are positioned manually, not via PDFKit continuation.
		expect(doc.textCalls[0].x).toBe(0);
		expect(doc.textCalls[1].x).toBeCloseTo(6, 5);
	});

	it('keeps single-font text on the unchanged single doc.text() path', () => {
		const doc = fakeDoc();
		drawText(doc, textNode('Hello', { fontFamily: ['DemoLatin', 'DemoCJK'], fontSize: 20 }));

		// One text() call for the whole string (PDFKit handles it directly).
		expect(doc.textCalls).toHaveLength(1);
		expect(doc.textCalls[0].text).toBe('Hello');
	});
});

// ── 6. Multi-font wrapping (Increment 2) ─────────────────────────────────────

describe('wrapLinesMeta — multi-font', () => {
	const FAMILIES = ['DemoLatin', 'DemoCJK'];
	const STYLE = { fontFamily: FAMILIES, fontSize: 20 };
	// A paragraph mixing Latin words and CJK words so wrap points depend on the
	// per-run widths (CJK glyphs are wider than the Latin monospace).
	const PARA = 'hello 世界 from 你好 svelte 世界 pdf 你好 world 世界';

	it('reconstructs the original paragraph from the wrapped lines', () => {
		const lines = wrapLinesMeta(PARA, STYLE, 160).map((l) => l.text);
		expect(lines.join(' ')).toBe(PARA);
	});

	it('keeps every multi-word line within the max width (run-aware)', () => {
		const maxWidth = 160;
		const lines = wrapLinesMeta(PARA, STYLE, maxWidth).map((l) => l.text);
		expect(lines.length).toBeGreaterThan(1);
		for (const line of lines) {
			// Single-token lines may legitimately overflow; multi-token lines must fit.
			if (line.includes(' ')) {
				expect(runWidth(line, FAMILIES)).toBeLessThanOrEqual(maxWidth + 0.01);
			}
		}
	});

	it('measureText height matches the wrapped line count × line height', () => {
		const maxWidth = 160;
		const lineCount = wrapLinesMeta(PARA, STYLE, maxWidth).length;
		const lh = getLineHeight(STYLE, PARA);
		const measured = measureText(PARA, STYLE, maxWidth);
		expect(measured.height).toBeCloseTo(lh * lineCount, 2);
	});
});

// ── 7. Multi-font justification (Increment 3) ────────────────────────────────

describe('drawText — multi-font justification', () => {
	function justifyNode(lines: { text: string; lastInParagraph: boolean }[], width: number): PDFNode {
		return {
			type: 'text',
			props: {
				text: lines.map((l) => l.text).join('\n'),
				justifyLines: lines,
				style: { fontFamily: ['DemoLatin', 'DemoCJK'], fontSize: 20, textAlign: 'justify' }
			},
			children: [],
			layout: { x: 0, y: 0, width, height: 100 }
		};
	}

	it('stretches a mixed-font non-final line to the box width via wordSpacing', () => {
		const doc = fakeDoc(); // widthOfString = length * 6
		// 'A 世 B' → runs ['A '(Latin), '世'(CJK), ' B'(Latin)]; natural = 30.
		drawText(doc, justifyNode([
			{ text: 'A 世 B', lastInParagraph: false },
			{ text: 'end', lastInParagraph: true }
		], 100));

		// The mixed line is split across three fonts.
		const line1 = doc.textCalls.filter((c: any) => 'A 世 B'.includes(c.text) && c.text !== 'end');
		expect(line1.map((c: any) => c.font)).toEqual(['DemoLatin', 'DemoCJK', 'DemoLatin']);

		// slack = 100 - 30 = 70 over 2 spaces → wordSpacing 35 on every run of the line.
		for (const c of line1) expect(c.opts.wordSpacing).toBeCloseTo(35, 5);
	});

	it('never stretches the final line of a paragraph', () => {
		const doc = fakeDoc();
		drawText(doc, justifyNode([
			{ text: 'A 世 B', lastInParagraph: false },
			{ text: '世 end', lastInParagraph: true }
		], 100));

		// The final line '世 end' splits into a CJK run then a Latin run; neither
		// carries wordSpacing because the last line of a paragraph is never
		// stretched.
		const finalLine = doc.textCalls.slice(-2);
		expect(finalLine.map((c: any) => c.font)).toEqual(['DemoCJK', 'DemoLatin']);
		for (const c of finalLine) expect(c.opts.wordSpacing).toBeUndefined();
	});
});
