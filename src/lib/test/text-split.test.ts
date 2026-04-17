/**
 * Tests for line-level text splitting at page boundaries.
 *
 * Text nodes that straddle a page boundary should be split so that:
 *  - Page 1 shows only the lines that fit above the boundary.
 *  - Page 2 shows the remaining lines starting at the correct y position.
 *  - No lines are lost or duplicated across pages.
 *  - Render-prop text (page numbers) is left unsplit.
 */

import { describe, it, expect } from 'vitest';
import { createDocument } from '../runtime/document.js';
import { paginate } from '../pagination/paginate.js';
import { getLineHeight, wrapLines } from '../layout/text-measure.js';
import type { PDFNode } from '../types/pdf.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

const PAGE_HEIGHT = 842;
const PAD_BOTTOM  = 50;
const CONTENT_END = PAGE_HEIGHT - PAD_BOTTOM; // 792

const BASE_STYLE = { fontSize: 12, fontFamily: 'Helvetica' };

/** Build a minimal document with a single pre-laid-out page node. */
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

/** Collect all text nodes (recursively) from a page. */
function collectText(page: PDFNode): PDFNode[] {
	const result: PDFNode[] = [];
	function walk(n: PDFNode) {
		if (n.type === 'text') result.push(n);
		n.children.forEach(walk);
	}
	walk(page);
	return result;
}

// ── 1. Basic split ─────────────────────────────────────────────────────────────

describe('text splitting – basic straddling', () => {
	it('produces two pages when a text node crosses the boundary', () => {
		const lh = getLineHeight(BASE_STYLE);
		// Place the text so that exactly 1 line fits before CONTENT_END.
		const textY  = CONTENT_END - lh * 1.5; // 1.5 lines of space on page 1
		const text   = 'Line 1\nLine 2\nLine 3';
		const doc = makeDoc([{
			type: 'text',
			props: { text, style: BASE_STYLE },
			children: [],
			layout: { x: 40, y: textY, width: 515, height: 3 * lh }
		}]);

		const pages = paginate(doc);
		expect(pages).toHaveLength(2);
	});

	it('page 1 contains only the lines that fit above the boundary', () => {
		const lh = getLineHeight(BASE_STYLE);
		const textY = CONTENT_END - lh * 1.5;
		const text  = 'Line 1\nLine 2\nLine 3';
		const doc = makeDoc([{
			type: 'text',
			props: { text, style: BASE_STYLE },
			children: [],
			layout: { x: 40, y: textY, width: 515, height: 3 * lh }
		}]);

		const pages = paginate(doc);
		const p1Texts = collectText(pages[0]);
		expect(p1Texts).toHaveLength(1);
		expect(p1Texts[0].props.text).toBe('Line 1');
	});

	it('page 2 contains the remaining lines', () => {
		const lh = getLineHeight(BASE_STYLE);
		const textY = CONTENT_END - lh * 1.5;
		const text  = 'Line 1\nLine 2\nLine 3';
		const doc = makeDoc([{
			type: 'text',
			props: { text, style: BASE_STYLE },
			children: [],
			layout: { x: 40, y: textY, width: 515, height: 3 * lh }
		}]);

		const pages = paginate(doc);
		const p2Texts = collectText(pages[1]);
		expect(p2Texts).toHaveLength(1);
		expect(p2Texts[0].props.text).toBe('Line 2\nLine 3');
	});

	it('no lines are lost: total across pages equals the original line count', () => {
		const lh = getLineHeight(BASE_STYLE);
		const textY = CONTENT_END - lh * 1.5;
		const text  = 'Line 1\nLine 2\nLine 3';
		const doc = makeDoc([{
			type: 'text',
			props: { text, style: BASE_STYLE },
			children: [],
			layout: { x: 40, y: textY, width: 515, height: 3 * lh }
		}]);

		const pages = paginate(doc);
		const allLines = pages
			.flatMap(p => collectText(p))
			.flatMap(n => (n.props.text as string).split('\n'));

		expect(allLines).toHaveLength(3);
		expect(allLines).toContain('Line 1');
		expect(allLines).toContain('Line 2');
		expect(allLines).toContain('Line 3');
	});
});

// ── 2. No split when text fits on page 1 ───────────────────────────────────────

describe('text splitting – no split when text fits', () => {
	it('returns a single page when a text node fits within the content boundary', () => {
		const lh = getLineHeight(BASE_STYLE);
		// Text well away from the boundary
		const doc = makeDoc([{
			type: 'text',
			props: { text: 'Line 1\nLine 2', style: BASE_STYLE },
			children: [],
			layout: { x: 40, y: 100, width: 515, height: 2 * lh }
		}]);

		const pages = paginate(doc);
		expect(pages).toHaveLength(1);
	});

	it('text node on a single page is preserved unchanged', () => {
		const lh = getLineHeight(BASE_STYLE);
		const doc = makeDoc([{
			type: 'text',
			props: { text: 'Hello World', style: BASE_STYLE },
			children: [],
			layout: { x: 40, y: 100, width: 515, height: lh }
		}]);

		const pages = paginate(doc);
		const texts = collectText(pages[0]);
		expect(texts[0].props.text).toBe('Hello World');
	});
});

// ── 3. Render-prop text is not split ──────────────────────────────────────────

describe('text splitting – render-prop text is left unsplit', () => {
	it('a render-prop text node retains its render function on each page', () => {
		const lh = getLineHeight(BASE_STYLE);
		const renderFn = ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
			`${pageNumber} / ${totalPages}`;

		// Place a render-prop text near the boundary; also add a tall filler
		// to force the document to paginate.
		const filler: PDFNode = {
			type: 'text',
			props: { text: 'filler', style: BASE_STYLE },
			children: [],
			layout: { x: 40, y: 0, width: 515, height: CONTENT_END + 200 }
		};
		const renderNode: PDFNode = {
			type: 'text',
			props: { render: renderFn, style: BASE_STYLE },
			children: [],
			layout: { x: 40, y: CONTENT_END - lh * 0.5, width: 200, height: lh * 2 }
		};
		const doc = makeDoc([filler, renderNode]);
		const pages = paginate(doc);

		// The render function must survive pagination intact on at least one page.
		const allTextNodes = pages.flatMap(p => collectText(p));
		const withRender = allTextNodes.filter(n => typeof n.props.render === 'function');
		expect(withRender.length).toBeGreaterThan(0);
		// The function should still be callable.
		expect(withRender[0].props.render({ pageNumber: 2, totalPages: 3 })).toBe('2 / 3');
	});
});

// ── 4. Word-wrap correctness ───────────────────────────────────────────────────

describe('wrapLines', () => {
	it('returns individual words as separate lines when they do not fit together', () => {
		// Very narrow width forces each long word onto its own line.
		const style = { fontSize: 12 };
		const lines = wrapLines('Hello World', style, 1);
		expect(lines).toHaveLength(2);
		expect(lines[0]).toBe('Hello');
		expect(lines[1]).toBe('World');
	});

	it('keeps words on one line when they fit', () => {
		const lines = wrapLines('Hi', BASE_STYLE, 500);
		expect(lines).toHaveLength(1);
		expect(lines[0]).toBe('Hi');
	});

	it('honours explicit newlines as paragraph breaks', () => {
		const lines = wrapLines('First\nSecond', BASE_STYLE, 500);
		expect(lines).toHaveLength(2);
		expect(lines[0]).toBe('First');
		expect(lines[1]).toBe('Second');
	});

	it('returns empty array for empty input', () => {
		expect(wrapLines('', BASE_STYLE, 500)).toHaveLength(0);
	});
});

// ── 5. Page 2 y-position ──────────────────────────────────────────────────────

describe('text splitting – page 2 y positioning', () => {
	it('overflow text on page 2 starts at y=0 when there is no paddingTop', () => {
		const lh = getLineHeight(BASE_STYLE);
		const textY = CONTENT_END - lh * 1.5;
		const doc = makeDoc([{
			type: 'text',
			props: { text: 'Line 1\nLine 2\nLine 3', style: BASE_STYLE },
			children: [],
			layout: { x: 40, y: textY, width: 515, height: 3 * lh }
		}]);

		const pages = paginate(doc);
		expect(pages).toHaveLength(2);
		const p2Texts = collectText(pages[1]);
		expect(p2Texts[0].layout!.y).toBeCloseTo(0, 0);
	});
});
