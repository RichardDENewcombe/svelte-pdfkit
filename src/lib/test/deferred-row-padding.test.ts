/**
 * Regression tests for issue #12: a row (or any padded container) that is
 * pushed *entirely* to the next page — nothing of it drawn on the page
 * before, because orphan control deferred its text on the first attempt —
 * must keep its own paddingTop (and top border / corner radii) on its first
 * real appearance, exactly as it would if it had started fresh at the top of
 * a page without ever having been deferred.
 *
 * A row that genuinely straddles a page break (some of it already drawn on
 * the previous page) is a different case and must keep flushing to the top
 * of the continuation page with no padding re-added — that's covered here
 * too, as a non-regression check.
 */

import { describe, it, expect } from 'vitest';
import { createDocument } from '../runtime/document.js';
import { paginate } from '../pagination/paginate.js';
import { getLineHeight } from '../layout/text-measure.js';
import type { PDFNode } from '../types/pdf.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

const PAGE_HEIGHT = 842;
const PAD_BOTTOM  = 50;
const CONTENT_END = PAGE_HEIGHT - PAD_BOTTOM; // 792

const BASE_STYLE = { fontSize: 12, fontFamily: 'Helvetica' };
const ROW_PAD = 2.5;

function makeDoc(children: PDFNode[], padBottom = PAD_BOTTOM) {
	const doc = createDocument();
	const page: PDFNode = {
		type: 'page',
		props: { size: 'A4', width: 595, height: PAGE_HEIGHT, style: { paddingBottom: padBottom } },
		children,
		layout: { x: 0, y: 0, width: 595, height: PAGE_HEIGHT }
	};
	doc.children.push(page);
	return doc;
}

/**
 * A "row": a view with paddingTop/paddingBottom of ROW_PAD wrapping one text
 * node, positioned as Yoga would — the text's absolute y is the row's top
 * plus ROW_PAD.
 */
function makeRow(
	textY: number,
	textHeight: number,
	rowStyle: Record<string, any> = {},
	text = 'Row text'
): PDFNode {
	const rowY = textY - ROW_PAD;
	const rowHeight = ROW_PAD + textHeight + ROW_PAD;
	const textNode: PDFNode = {
		type: 'text',
		props: { text, style: { ...BASE_STYLE } },
		children: [],
		layout: { x: 20, y: textY, width: 400, height: textHeight }
	};
	return {
		type: 'view',
		props: { style: { paddingTop: ROW_PAD, paddingBottom: ROW_PAD, ...rowStyle } },
		children: [textNode],
		layout: { x: 20, y: rowY, width: 440, height: rowHeight }
	};
}

function findFirst(node: PDFNode, type: string): PDFNode | undefined {
	if (node.type === type) return node;
	for (const c of node.children) {
		const found = findFirst(c, type);
		if (found) return found;
	}
	return undefined;
}

// ── Full deferral: fresh appearance must keep its own padding ─────────────────

describe('deferred row keeps its own top padding (issue #12)', () => {
	it('a row fully deferred (0 lines fit) keeps its paddingTop on the next page', () => {
		const lh = getLineHeight(BASE_STYLE);
		// Less than one line height of room before the boundary — 0 lines fit,
		// orphan control (default) defers the whole row, not just the text.
		const textY = CONTENT_END - lh * 0.5;
		const row = makeRow(textY, lh);

		const pages = paginate(makeDoc([row]));

		expect(pages).toHaveLength(2);
		expect(findFirst(pages[0], 'text')).toBeUndefined();

		const rowOut = findFirst(pages[1], 'view')!;
		const textOut = findFirst(pages[1], 'text')!;
		expect(rowOut).toBeDefined();
		expect(textOut).toBeDefined();
		expect(textOut.layout!.y - rowOut.layout!.y).toBeCloseTo(ROW_PAD, 5);
	});

	it('a decorated row fully deferred does not get its top border/corner suppressed', () => {
		const lh = getLineHeight(BASE_STYLE);
		const textY = CONTENT_END - lh * 0.5;
		const row = makeRow(textY, lh, { backgroundColor: '#eee' });

		const pages = paginate(makeDoc([row]));

		expect(pages).toHaveLength(2);
		const rowOut = findFirst(pages[1], 'view')!;
		expect(rowOut.props.__cutTop).not.toBe(true);
	});

	it('does not defer a row whose text already fits on this page (control case)', () => {
		// Sanity check: a row with enough room for its single line is NOT
		// deferred — it renders on page 1 as normal, keeping its own padding.
		const lh = getLineHeight(BASE_STYLE);
		const row = makeRow(100, lh); // plenty of room

		const pages = paginate(makeDoc([row]));

		expect(pages).toHaveLength(1);
		const rowOut = findFirst(pages[0], 'view')!;
		const textOut = findFirst(pages[0], 'text')!;
		expect(textOut.layout!.y - rowOut.layout!.y).toBeCloseTo(ROW_PAD, 5);
	});

	it('no content is lost across a full-row deferral', () => {
		const lh = getLineHeight(BASE_STYLE);
		const textY = CONTENT_END - lh * 0.5;
		const row = makeRow(textY, lh, {}, 'Only line');

		const pages = paginate(makeDoc([row]));

		const allText = pages.flatMap((p) => {
			const t = findFirst(p, 'text');
			return t ? [t.props.text as string] : [];
		});
		expect(allText).toEqual(['Only line']);
	});
});

// ── Genuine mid-content split: must NOT gain padding it never had ─────────────

describe('a row that genuinely straddles a page break (non-regression)', () => {
	it('continuation flushes to the top with no padding re-added, undecorated', () => {
		const lh = getLineHeight(BASE_STYLE);
		// 3 lines of text, positioned so exactly 1 line fits on page 1 — a real
		// partial split, not a whole-block deferral.
		const textY = CONTENT_END - lh * 1.5;
		const text = 'Line 1\nLine 2\nLine 3';
		const row = makeRow(textY, lh * 3, {}, text);

		const pages = paginate(makeDoc([row]));

		expect(pages).toHaveLength(2);

		// Page 1 shows the first line, still under the row's own paddingTop.
		const rowP1 = findFirst(pages[0], 'view')!;
		const textP1 = findFirst(pages[0], 'text')!;
		expect(textP1.props.text).toBe('Line 1');
		expect(textP1.layout!.y - rowP1.layout!.y).toBeCloseTo(ROW_PAD, 5);

		// Page 2 is a genuine continuation — flush to the top, no padding.
		const textP2 = findFirst(pages[1], 'text')!;
		expect(textP2.props.text).toBe('Line 2\nLine 3');
		expect(textP2.layout!.y).toBe(0);
	});

	it('continuation still gets its top border suppressed when decorated', () => {
		const lh = getLineHeight(BASE_STYLE);
		const textY = CONTENT_END - lh * 1.5;
		const text = 'Line 1\nLine 2\nLine 3';
		const row = makeRow(textY, lh * 3, { backgroundColor: '#eee' }, text);

		const pages = paginate(makeDoc([row]));

		expect(pages).toHaveLength(2);
		const rowP2 = findFirst(pages[1], 'view')!;
		expect(rowP2.props.__cutTop).toBe(true);
	});
});
