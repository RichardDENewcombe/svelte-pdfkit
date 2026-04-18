/**
 * Tests for widow and orphan control in the pagination engine.
 *
 * Orphan: a text block that starts at the bottom of a page with too few lines
 *   before the break.  The whole block should be deferred to the next page.
 *
 * Widow: a text block that ends at the top of a page with too few lines after
 *   the break.  Lines should be moved from the previous page so the next page
 *   starts with at least `widows` lines.
 *
 * Both features are opt-in via the `orphans` / `widows` style props.
 * Defaults of 1 preserve the original behaviour (no adjustment).
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

function collectText(page: PDFNode): PDFNode[] {
	const result: PDFNode[] = [];
	function walk(n: PDFNode) {
		if (n.type === 'text') result.push(n);
		n.children.forEach(walk);
	}
	walk(page);
	return result;
}

function allLines(pages: PDFNode[]): string[] {
	return pages
		.flatMap(p => collectText(p))
		.flatMap(n => (n.props.text as string).split('\n'));
}

// ── Orphan control ─────────────────────────────────────────────────────────────

describe('orphan control', () => {
	it('defers a block to the next page when only 1 line fits and orphans=2', () => {
		const lh = getLineHeight(BASE_STYLE);
		// Place text so exactly 1 line fits before CONTENT_END.
		const textY = CONTENT_END - lh * 1.5;
		const text  = 'Line 1\nLine 2\nLine 3';
		const doc = makeDoc([{
			type: 'text',
			props: { text, style: { ...BASE_STYLE, orphans: 2 } },
			children: [],
			layout: { x: 40, y: textY, width: 515, height: 3 * lh }
		}]);

		const pages = paginate(doc);

		// All content should be on page 2 — page 1 is empty but still emitted.
		expect(pages).toHaveLength(2);
		expect(collectText(pages[0])).toHaveLength(0);
		expect(collectText(pages[1])).toHaveLength(1);
		expect(collectText(pages[1])[0].props.text).toBe('Line 1\nLine 2\nLine 3');
	});

	it('does NOT defer when orphans=1 (default, disabled)', () => {
		const lh = getLineHeight(BASE_STYLE);
		const textY = CONTENT_END - lh * 1.5;
		const text  = 'Line 1\nLine 2\nLine 3';
		const doc = makeDoc([{
			type: 'text',
			props: { text, style: { ...BASE_STYLE, orphans: 1 } },
			children: [],
			layout: { x: 40, y: textY, width: 515, height: 3 * lh }
		}]);

		const pages = paginate(doc);
		// Original behaviour: 1 line on page 1, rest on page 2.
		const p1Texts = collectText(pages[0]);
		expect(p1Texts).toHaveLength(1);
		expect(p1Texts[0].props.text).toBe('Line 1');
	});

	it('does NOT defer when all remaining lines fit on the page (no orphan situation)', () => {
		const lh = getLineHeight(BASE_STYLE);
		// Text fits well within the page — no split at all.
		const doc = makeDoc([{
			type: 'text',
			props: { text: 'Line 1\nLine 2', style: { ...BASE_STYLE, orphans: 2 } },
			children: [],
			layout: { x: 40, y: 100, width: 515, height: 2 * lh }
		}]);

		const pages = paginate(doc);
		expect(pages).toHaveLength(1);
		expect(collectText(pages[0])[0].props.text).toBe('Line 1\nLine 2');
	});

	it('no lines are lost after orphan deferral', () => {
		const lh = getLineHeight(BASE_STYLE);
		const textY = CONTENT_END - lh * 1.5;
		const text  = 'Line 1\nLine 2\nLine 3';
		const doc = makeDoc([{
			type: 'text',
			props: { text, style: { ...BASE_STYLE, orphans: 2 } },
			children: [],
			layout: { x: 40, y: textY, width: 515, height: 3 * lh }
		}]);

		const pages = paginate(doc);
		const lines = allLines(pages);
		expect(lines).toHaveLength(3);
		expect(lines).toContain('Line 1');
		expect(lines).toContain('Line 2');
		expect(lines).toContain('Line 3');
	});
});

// ── Widow control ──────────────────────────────────────────────────────────────

describe('widow control', () => {
	it('moves a line to the next page so at least widows=2 lines appear there', () => {
		const lh = getLineHeight(BASE_STYLE);
		// Place text so exactly 2 lines fit, leaving only 1 line for page 2.
		const textY = CONTENT_END - lh * 2.5;
		const text  = 'Line 1\nLine 2\nLine 3';
		const doc = makeDoc([{
			type: 'text',
			props: { text, style: { ...BASE_STYLE, widows: 2 } },
			children: [],
			layout: { x: 40, y: textY, width: 515, height: 3 * lh }
		}]);

		const pages = paginate(doc);
		expect(pages).toHaveLength(2);

		const p1Lines = collectText(pages[0]).flatMap(n => (n.props.text as string).split('\n'));
		const p2Lines = collectText(pages[1]).flatMap(n => (n.props.text as string).split('\n'));

		// Widow adjustment moves 1 line from page 1 to page 2.
		expect(p1Lines).toHaveLength(1);
		expect(p2Lines).toHaveLength(2);
		expect(p1Lines[0]).toBe('Line 1');
		expect(p2Lines[0]).toBe('Line 2');
		expect(p2Lines[1]).toBe('Line 3');
	});

	it('does NOT adjust when widows=1 (default, disabled)', () => {
		const lh = getLineHeight(BASE_STYLE);
		const textY = CONTENT_END - lh * 2.5;
		const text  = 'Line 1\nLine 2\nLine 3';
		const doc = makeDoc([{
			type: 'text',
			props: { text, style: { ...BASE_STYLE, widows: 1 } },
			children: [],
			layout: { x: 40, y: textY, width: 515, height: 3 * lh }
		}]);

		const pages = paginate(doc);
		expect(pages).toHaveLength(2);

		const p1Lines = collectText(pages[0]).flatMap(n => (n.props.text as string).split('\n'));
		const p2Lines = collectText(pages[1]).flatMap(n => (n.props.text as string).split('\n'));

		// No adjustment: original split — 2 lines on page 1, 1 on page 2.
		expect(p1Lines).toHaveLength(2);
		expect(p2Lines).toHaveLength(1);
	});

	it('no lines are lost after widow adjustment', () => {
		const lh = getLineHeight(BASE_STYLE);
		const textY = CONTENT_END - lh * 2.5;
		const text  = 'Line 1\nLine 2\nLine 3';
		const doc = makeDoc([{
			type: 'text',
			props: { text, style: { ...BASE_STYLE, widows: 2 } },
			children: [],
			layout: { x: 40, y: textY, width: 515, height: 3 * lh }
		}]);

		const pages = paginate(doc);
		const lines = allLines(pages);
		expect(lines).toHaveLength(3);
		expect(lines).toContain('Line 1');
		expect(lines).toContain('Line 2');
		expect(lines).toContain('Line 3');
	});
});

// ── Combined orphan + widow ────────────────────────────────────────────────────

describe('orphan and widow control combined', () => {
	it('orphan deferral still satisfies widow constraint after deferral', () => {
		const lh = getLineHeight(BASE_STYLE);
		// 1 line fits on page 1 → orphan control defers all 3 to page 2.
		// Page 2 has all 3 lines — widow constraint (2) is trivially satisfied.
		const textY = CONTENT_END - lh * 1.5;
		const text  = 'Line 1\nLine 2\nLine 3';
		const doc = makeDoc([{
			type: 'text',
			props: { text, style: { ...BASE_STYLE, orphans: 2, widows: 2 } },
			children: [],
			layout: { x: 40, y: textY, width: 515, height: 3 * lh }
		}]);

		const pages = paginate(doc);
		const lines = allLines(pages);
		expect(lines).toHaveLength(3);
		// All lines on a single page (page 2).
		const p2Lines = collectText(pages[1]).flatMap(n => (n.props.text as string).split('\n'));
		expect(p2Lines).toHaveLength(3);
	});
});
