/**
 * Tests for explicit page break control via breakBefore / breakAfter props.
 *
 * breakBefore on a node: a page break is inserted just before the node, so it
 *   always starts at the top of a new page.
 *
 * breakAfter on a node: a page break is inserted just after the node, so all
 *   subsequent content starts on a new page.
 *
 * Both props are supported on View, Text, and Image nodes.
 * Fixed nodes are excluded from forced-break collection.
 */

import { describe, it, expect } from 'vitest';
import { createDocument } from '../runtime/document.js';
import { paginate } from '../pagination/paginate.js';
import type { PDFNode } from '../types/pdf.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

const PAGE_H = 842;
const PAGE_W = 595;

function makeDoc(children: PDFNode[]): ReturnType<typeof createDocument> {
	const doc = createDocument();
	doc.children.push({
		type: 'page',
		props: { size: 'A4', width: PAGE_W, height: PAGE_H, style: {} },
		children,
		layout: { x: 0, y: 0, width: PAGE_W, height: PAGE_H }
	});
	return doc;
}

function view(y: number, height: number, extra: Record<string, unknown> = {}): PDFNode {
	return {
		type: 'view',
		props: { style: {}, ...extra },
		children: [],
		layout: { x: 0, y, width: PAGE_W, height }
	};
}

function collectViews(page: PDFNode): PDFNode[] {
	const out: PDFNode[] = [];
	function walk(n: PDFNode) {
		if (n.type === 'view') out.push(n);
		n.children.forEach(walk);
	}
	walk(page);
	return out;
}

// ── breakBefore ────────────────────────────────────────────────────────────────

describe('breakBefore', () => {
	it('forces a mid-page node onto a new page', () => {
		// Two views that both fit on one page; the second has breakBefore.
		const doc = makeDoc([
			view(0,   200),
			view(200, 200, { breakBefore: true })
		]);

		const pages = paginate(doc);

		// The break before the second view splits the single page into two.
		expect(pages).toHaveLength(2);
		expect(collectViews(pages[0])).toHaveLength(1);
		expect(collectViews(pages[1])).toHaveLength(1);
	});

	it('page 1 view starts at the padTop position after the break', () => {
		const doc = makeDoc([
			view(0,   100),
			view(100, 150, { breakBefore: true })
		]);

		const pages = paginate(doc);
		expect(pages).toHaveLength(2);

		// On page 2 (overflow), yOffset = padTop = 0 (no page padding here).
		// The view's adjusted y should be 0 (yStart=100, yOffset=0).
		const p2views = collectViews(pages[1]);
		expect(p2views[0].layout?.y).toBe(0);
	});

	it('places the break-before node first on page 2 when combined with earlier content', () => {
		const doc = makeDoc([
			view(0,   300),
			view(300, 300),
			view(600, 100, { breakBefore: true })
		]);

		const pages = paginate(doc);
		expect(pages).toHaveLength(2);

		// Pages[0] should contain the first two views (y 0–300 and 300–600).
		expect(collectViews(pages[0])).toHaveLength(2);
		// Pages[1] should contain only the break-before view.
		expect(collectViews(pages[1])).toHaveLength(1);
	});

	it('multiple breakBefore nodes each start on their own page', () => {
		const doc = makeDoc([
			view(0,   100),
			view(100, 100, { breakBefore: true }),
			view(200, 100, { breakBefore: true })
		]);

		const pages = paginate(doc);
		expect(pages).toHaveLength(3);
		expect(collectViews(pages[0])).toHaveLength(1);
		expect(collectViews(pages[1])).toHaveLength(1);
		expect(collectViews(pages[2])).toHaveLength(1);
	});

	it('no content is lost after a breakBefore split', () => {
		const doc = makeDoc([
			view(0,   200),
			view(200, 200, { breakBefore: true }),
			view(400, 200)
		]);

		const pages = paginate(doc);
		const total = pages.reduce((sum, p) => sum + collectViews(p).length, 0);
		expect(total).toBe(3);
	});
});

// ── breakAfter ────────────────────────────────────────────────────────────────

describe('breakAfter', () => {
	it('forces all subsequent content onto a new page', () => {
		const doc = makeDoc([
			view(0,   200, { breakAfter: true }),
			view(200, 200)
		]);

		const pages = paginate(doc);

		expect(pages).toHaveLength(2);
		expect(collectViews(pages[0])).toHaveLength(1);
		expect(collectViews(pages[1])).toHaveLength(1);
	});

	it('the break-after view is on page 1, subsequent content on page 2', () => {
		const doc = makeDoc([
			view(0,   150, { breakAfter: true }),
			view(150, 150)
		]);

		const pages = paginate(doc);
		expect(pages).toHaveLength(2);

		// Break-after view should be on page 1.
		const p1views = collectViews(pages[0]);
		expect(p1views).toHaveLength(1);
		expect(p1views[0].layout?.y).toBe(0);

		// Following view should be on page 2.
		const p2views = collectViews(pages[1]);
		expect(p2views).toHaveLength(1);
	});

	it('no content is lost after a breakAfter split', () => {
		const doc = makeDoc([
			view(0,   200, { breakAfter: true }),
			view(200, 200),
			view(400, 200)
		]);

		const pages = paginate(doc);
		const total = pages.reduce((sum, p) => sum + collectViews(p).length, 0);
		expect(total).toBe(3);
	});
});

// ── breakBefore + breakAfter combined ─────────────────────────────────────────

describe('breakBefore and breakAfter combined', () => {
	it('a node with both props is isolated on its own page', () => {
		const doc = makeDoc([
			view(0,   100),
			view(100, 100, { breakBefore: true, breakAfter: true }),
			view(200, 100)
		]);

		const pages = paginate(doc);

		// Three nodes → three pages: before / isolated / after.
		expect(pages).toHaveLength(3);
		expect(collectViews(pages[0])).toHaveLength(1);
		expect(collectViews(pages[1])).toHaveLength(1);
		expect(collectViews(pages[2])).toHaveLength(1);
	});
});

// ── Natural overflow + forced breaks ──────────────────────────────────────────

describe('forced breaks with overflow content', () => {
	it('forced break within an already-overflowing page works correctly', () => {
		// Total content: 3 views each 400pt tall = 1200pt > PAGE_H (842).
		// The second view has breakBefore.
		const doc = makeDoc([
			view(0,    400),
			view(400,  400, { breakBefore: true }),
			view(800,  400)
		]);

		const pages = paginate(doc);

		// Page 1: view 0 (y 0–400)
		// Page 2: view 1 forced to new page (breakBefore at y=400)
		// Page 3: view 2 (y 800–1200, overflows from natural page 2)
		expect(pages.length).toBeGreaterThanOrEqual(2);

		// View 1 must not appear on the same page as view 0.
		const p1views = collectViews(pages[0]);
		expect(p1views.every(v => (v.layout?.y ?? 0) < 400)).toBe(true);
	});
});
