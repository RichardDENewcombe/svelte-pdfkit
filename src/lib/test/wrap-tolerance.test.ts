/**
 * Regression tests for float32 wrap tolerance.
 *
 * Yoga stores computed layout values as 32-bit floats, so a text node's
 * computed width is the float32 rounding of the double-precision natural width
 * that PDFKit measured. For many strings that rounding goes *down* (e.g.
 * Math.fround(36.008) === 36.00799942…), making the layout box a hair narrower
 * than the text that was measured to fit it.
 *
 * At draw time PDFKit re-measures in double precision, finds the string wider
 * than the box by that sub-ulp amount, and wraps — chopping the last character
 * of a single word onto a second line, or stranding the last word of a phrase.
 * The renderer/wrapper absorb this with a small tolerance so a box within a
 * float32 ulp of the natural width does not trigger a spurious break.
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { drawText } from '../renderer/draw-text.js';
import { wrapLines } from '../layout/text-measure.js';
import type { PDFNode } from '../types/pdf.js';

const _require = createRequire(import.meta.url);

const STYLE = { fontFamily: 'Helvetica', fontSize: 8 };

/** A word whose natural width float32-rounds *downward* — the failing case. */
const WORD = 'Horizontal';

function makeDoc() {
	const PDFDocument = _require('pdfkit');
	const doc = new PDFDocument({ autoFirstPage: false });
	doc.addPage();
	doc.font('Helvetica').fontSize(8);
	return doc;
}

describe('float32 wrap tolerance', () => {
	it('the natural width float32-rounds down (precondition for the bug)', () => {
		const doc = makeDoc();
		const natural = doc.widthOfString(WORD);
		expect(Math.fround(natural)).toBeLessThan(natural);
	});

	it('renderer does not chop a single word whose box is float32(natural)', () => {
		const doc = makeDoc();
		const natural = doc.widthOfString(WORD);
		const lineHeight = doc.currentLineHeight(true);

		const node: PDFNode = {
			type: 'text',
			props: { text: WORD, style: STYLE },
			children: [],
			// The width Yoga would hand us: the float32 rounding of the natural width.
			layout: { x: 50, y: 100, width: Math.fround(natural), height: lineHeight }
		};

		// drawText places the text at the node's explicit y (100) and advances
		// doc.y by one line height per rendered line.
		drawText(doc, node);
		const lines = Math.round((doc.y - 100) / lineHeight);
		expect(lines).toBe(1);
	});

	it('wrapper keeps a phrase on one line when the box is float32(natural)', () => {
		const doc = makeDoc();
		const phrase = 'Horizontal Vertical';
		const natural = doc.widthOfString(phrase);
		// Only meaningful if float32 truncates down; otherwise the assertion still
		// holds trivially.
		const box = Math.fround(natural);
		expect(wrapLines(phrase, STYLE, box)).toEqual([phrase]);
	});
});
