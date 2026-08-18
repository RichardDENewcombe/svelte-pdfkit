/**
 * Tests for the `wrap={fraction}` pagination control (`wrap` as a number
 * between 0 and 1, rather than a boolean).
 *
 * This is a proactive sibling of `wrap={false}`: instead of only reacting to
 * an actual cut, `wrap={0.2}` moves a node whole to the next page if its top
 * falls in (or it extends into) the bottom 20% of the page — even if the
 * node would technically have fit without being cut. It reuses the same
 * keep-with-next boundary-pulling mechanism as `wrap={false}`, via
 * collectWrapFractionPairs() in ../pagination/paginate.ts, so it inherits
 * the same LAYOUT_EPSILON float-tolerance and aTop<=yStart termination
 * guard already hardened by issues #13/#14/#15 — see that function's doc
 * comment for the mechanism.
 *
 * Like wrap={false} (see no-wrap.test.ts), the fraction check only applies
 * once a document actually needs to split across pages — a page whose
 * content fits within one page never enters the boundary-pulling loop at
 * all (paginatePage()'s fast path), so every case below that expects a
 * defer includes enough trailing content to force real pagination.
 *
 * These tests drive the paginator directly with pre-laid-out node trees,
 * the same approach used by no-wrap.test.ts and boundary-float-drift.test.ts.
 */

import { describe, it, expect } from 'vitest';
import { createDocument } from '../runtime/document.js';
import { paginate } from '../pagination/paginate.js';
import type { PDFNode } from '../types/pdf.js';

const PAGE_HEIGHT = 842;
const PAD_BOTTOM = 50;
const CONTENT_END = PAGE_HEIGHT - PAD_BOTTOM; // 792
const THRESHOLD_20 = CONTENT_END * 0.8; // 633.6 — bottom-20% zone starts here on page 0

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

/** A leaf flow node tagged with a testId for locating it across output pages. */
function box(
	testId: string,
	y: number,
	height: number,
	extraProps: Record<string, any> = {}
): PDFNode {
	return {
		type: 'view',
		props: { testId, style: {}, ...extraProps },
		children: [],
		layout: { x: 40, y, width: 515, height }
	};
}

/** Returns the index of the output page that contains the node with `testId`. */
function pageOf(pages: PDFNode[], testId: string): number {
	for (let i = 0; i < pages.length; i++) {
		let found = false;
		function walk(n: PDFNode) {
			if (n.props.testId === testId) found = true;
			n.children.forEach(walk);
		}
		pages[i].children.forEach(walk);
		if (found) return i;
	}
	return -1;
}

/** Returns the page-relative layout.y of the node with `testId` on the page it lands on. */
function layoutYOf(pages: PDFNode[], testId: string): number | undefined {
	let result: number | undefined;
	function walk(n: PDFNode) {
		if (n.props.testId === testId) result = n.layout?.y;
		n.children.forEach(walk);
	}
	for (const page of pages) page.children.forEach(walk);
	return result;
}

// ── Core behaviour ───────────────────────────────────────────────────────────────

describe('wrap={fraction}', () => {
	it('leaves a node fully above the zone untouched', () => {
		const doc = makeDoc([
			box('block', 400, 100, { wrap: 0.2 }), // ends at 500, well below the 633.6 threshold
			box('tail', 600, 300) // forces real pagination (contentBottom 900 > 792)
		]);

		const pages = paginate(doc);
		expect(pageOf(pages, 'block')).toBe(0);
	});

	it('defers a node that starts in the zone even though it would have fit uncut', () => {
		// The key differentiator from wrap={false}: block (700-750) fits
		// entirely within contentEnd (792) and would never be cut, but its top
		// (700) is past the bottom-20% threshold (633.6).
		const doc = makeDoc([
			box('filler', 0, 700),
			box('block', 700, 50, { wrap: 0.2 }),
			box('tail', 750, 100) // forces real pagination (contentBottom 850 > 792)
		]);

		const pages = paginate(doc);
		expect(pageOf(pages, 'filler')).toBe(0);
		expect(pageOf(pages, 'block')).toBe(1);
	});

	it('control: the same placement with wrap={false} does not defer, since it fits uncut', () => {
		const doc = makeDoc([
			box('filler', 0, 700),
			box('block', 700, 50, { wrap: false }),
			box('tail', 750, 100)
		]);

		const pages = paginate(doc);
		expect(pageOf(pages, 'filler')).toBe(0);
		expect(pageOf(pages, 'block')).toBe(0);
	});

	it('defers a node that straddles the zone boundary (starts above, extends into it)', () => {
		const doc = makeDoc([
			box('filler', 0, 600),
			box('straddle', 600, 100, { wrap: 0.2 }), // 600-700 straddles the 633.6 threshold
			box('tail', 700, 200) // forces real pagination
		]);

		const pages = paginate(doc);
		expect(pageOf(pages, 'filler')).toBe(0);
		expect(pageOf(pages, 'straddle')).toBe(1);
	});

	it('does not crowd a following sibling when the block is deferred whole', () => {
		const doc = makeDoc([
			box('filler', 0, 550),
			box('early', 550, 25, { wrap: 0.2 }), // ends at 575, before the zone — stays
			box('block', 650, 60, { wrap: 0.2 }), // 650-710, in the zone — deferred
			box('sibling', 720, 40) // 10pt gap after block's original bottom (710)
		]);

		const pages = paginate(doc);

		expect(pageOf(pages, 'filler')).toBe(0);
		expect(pageOf(pages, 'early')).toBe(0);
		const blockPage = pageOf(pages, 'block');
		const siblingPage = pageOf(pages, 'sibling');
		expect(blockPage).toBe(1);
		expect(siblingPage).toBe(1);

		const blockY = layoutYOf(pages, 'block');
		const siblingY = layoutYOf(pages, 'sibling');
		expect(blockY).toBeDefined();
		expect(siblingY).toBeDefined();
		// Sibling sits exactly 60 (block height) + 10 (original gap) below the
		// block's new top — the same offset Yoga originally computed.
		expect(siblingY! - blockY!).toBe(70);
	});
});

// ── Edge cases ────────────────────────────────────────────────────────────────────

describe('wrap={fraction} – edge cases', () => {
	it('falls back to splitting when the node is taller than a whole page', () => {
		const doc = makeDoc([box('block', 0, 900, { wrap: 0.3 })]);

		const pages = paginate(doc);
		expect(pageOf(pages, 'block')).toBe(0);
		expect(pages.length).toBeGreaterThan(1);
	});

	it('fast path: a document that fits on one page is unaffected by wrap={fraction}', () => {
		// block's top (700) is within what would be the bottom-20% zone, but the
		// page has no bottom padding (contentEnd == pageHeight == the page's own
		// full-height layout box), so paginatePage()'s fast-path check
		// (contentBottom <= contentEnd) is satisfied and the boundary-pulling
		// loop never runs at all — mirrors wrap={false}'s existing behavior.
		// (Unlike the other tests in this file, this one can't reuse the shared
		// makeDoc() helper, since its PAD_BOTTOM=50 makes contentEnd strictly
		// less than the page's own layout height, always forcing the loop.)
		const doc = createDocument();
		const page: PDFNode = {
			type: 'page',
			props: { size: 'A4', width: 595, height: PAGE_HEIGHT, style: {} },
			children: [box('block', 700, 50, { wrap: 0.2 })],
			layout: { x: 0, y: 0, width: 595, height: PAGE_HEIGHT }
		};
		doc.children.push(page);

		const pages = paginate(doc);
		expect(pages).toHaveLength(1);
		expect(pageOf(pages, 'block')).toBe(0);
	});

	it('wrap={0} behaves like wrap={false}', () => {
		const zero = makeDoc([
			box('filler', 0, 775),
			box('block', 775, 100, { wrap: 0 }),
			box('tail', 875, 50)
		]);
		const bool = makeDoc([
			box('filler', 0, 775),
			box('block', 775, 100, { wrap: false }),
			box('tail', 875, 50)
		]);

		expect(pageOf(paginate(zero), 'block')).toBe(pageOf(paginate(bool), 'block'));
	});

	it('clamps a negative fraction to 0', () => {
		const negative = makeDoc([
			box('filler', 0, 775),
			box('block', 775, 100, { wrap: -0.5 }),
			box('tail', 875, 50)
		]);
		const zero = makeDoc([
			box('filler', 0, 775),
			box('block', 775, 100, { wrap: 0 }),
			box('tail', 875, 50)
		]);

		expect(pageOf(paginate(negative), 'block')).toBe(pageOf(paginate(zero), 'block'));
	});

	it('clamps a fraction above 1 to 1', () => {
		const over = makeDoc([
			box('filler', 0, 700),
			box('block', 700, 50, { wrap: 1.5 }),
			box('tail', 750, 100)
		]);
		const one = makeDoc([
			box('filler', 0, 700),
			box('block', 700, 50, { wrap: 1 }),
			box('tail', 750, 100)
		]);

		expect(pageOf(paginate(over), 'block')).toBe(pageOf(paginate(one), 'block'));
	});

	it('wrap={1} (extreme case) terminates and defers every node not already at the top of its page', () => {
		const doc = makeDoc([
			box('box1', 0, 100, { wrap: 1 }),
			box('box2', 100, 100, { wrap: 1 }),
			box('box3', 200, 100, { wrap: 1 }),
			box('tail', 300, 600) // forces real pagination
		]);

		const pages = paginate(doc);

		// Must terminate (this test would hang/timeout otherwise) and make
		// monotonic forward progress rather than deferring indefinitely.
		expect(pages.length).toBeGreaterThan(1);
		expect(pages.length).toBeLessThan(10);
		const p1 = pageOf(pages, 'box1');
		const p2 = pageOf(pages, 'box2');
		const p3 = pageOf(pages, 'box3');
		expect(p1).toBeGreaterThanOrEqual(0);
		expect(p2).toBeGreaterThanOrEqual(p1);
		expect(p3).toBeGreaterThanOrEqual(p2);
	});
});

// ── Floating-point boundary drift (issue #15 regression, fraction path) ────────────

describe('wrap={fraction} — floating-point boundary drift', () => {
	// Mirrors the ~8.6e-6 drift captured from a real Yoga float32 accumulation
	// in the issue #15 report — comfortably smaller than LAYOUT_EPSILON (0.1).
	const DRIFT = 0.00001;

	it('does not spuriously defer a row whose bottom lands within drift of the threshold', () => {
		const doc = makeDoc([
			box('filler', 0, THRESHOLD_20 - 20 - 20), // fills up to threshold - 20
			box('before', THRESHOLD_20 - 20, 20, { wrap: 0.2 }), // clearly below threshold — stays
			// row's bottom is threshold + DRIFT: a hair over, by pure float noise.
			box('atThreshold', THRESHOLD_20 - 20 + DRIFT, 20, { wrap: 0.2 }),
			box('tail', THRESHOLD_20 + DRIFT, 200) // forces real pagination
		]);

		const pages = paginate(doc);

		expect(pageOf(pages, 'before')).toBe(0);
		// Sub-epsilon overshoot must be tolerated, not treated as a real violation.
		expect(pageOf(pages, 'atThreshold')).toBe(0);
	});

	it('still defers a row that genuinely crosses the threshold, without cascading earlier rows', () => {
		const doc = makeDoc([
			box('filler', 0, THRESHOLD_20 - 20 - 20),
			box('before', THRESHOLD_20 - 20, 20, { wrap: 0.2 }), // stays
			// Genuinely 20pt into the zone — real overflow, not noise.
			box('after', THRESHOLD_20 + DRIFT, 20, { wrap: 0.2 }),
			box('tail', THRESHOLD_20 + 20 + DRIFT, 200) // forces real pagination
		]);

		const pages = paginate(doc);

		expect(pageOf(pages, 'before')).toBe(0);
		expect(pageOf(pages, 'after')).toBeGreaterThan(0);
	});
});
