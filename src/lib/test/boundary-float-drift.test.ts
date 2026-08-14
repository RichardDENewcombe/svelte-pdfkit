/**
 * Regression tests for issue #15: wrap={false} self-pairs cascaded into
 * one-row-per-page for tightly-packed flow siblings, because the paginator
 * compared two independently-Yoga-accumulated layout values with exact
 * floating-point equality.
 *
 * For a run of tightly-packed same-height siblings, one row's bottom and the
 * next row's (or a forced break's) top are mathematically equal but computed
 * via different accumulation paths through Yoga's float32 layout tree, so
 * they land a few millionths of a point apart. findKeepWithNextBreak()'s old
 * `bTop >= yEnd` self-pair check treated that noise as "doesn't fit," pulled
 * the boundary back to the row's own top — itself subject to the same kind
 * of noise against the row above — and repeated, collapsing a whole run down
 * to one row per page.
 *
 * These tests hand-craft PDFNode trees with the drift encoded explicitly
 * (mirroring the ~8.6e-6 drift captured in the issue's real-world repro),
 * the same direct-tree approach used by no-wrap.test.ts and
 * keep-with-next.test.ts — no real Yoga/Svelte layout needed, since the bug
 * lives entirely in the comparison logic.
 *
 * A structurally analogous risk in the keepWithNext path (via
 * wouldRenderInSlot()) was investigated but deliberately not "fixed" — see
 * the comment on wouldRenderInSlot() in paginate.ts for why a naive nudge
 * there creates a worse, more easily triggered inconsistency (the trial
 * decision disagreeing with the real, un-nudged render pass) without a
 * confirmed real-world case to justify the larger change a sound fix would
 * need.
 */

import { describe, it, expect } from 'vitest';
import { createDocument } from '../runtime/document.js';
import { paginate } from '../pagination/paginate.js';
import type { PDFNode } from '../types/pdf.js';

const PAGE_HEIGHT = 842;
const PAD_BOTTOM = 50;
const CONTENT_END = PAGE_HEIGHT - PAD_BOTTOM; // 792

// Mirrors the ~8.6e-6 drift captured from a real Yoga float32 accumulation
// in the issue #15 report — comfortably smaller than LAYOUT_EPSILON (0.1).
const DRIFT = 0.00001;

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

describe('wrap={false} — floating-point boundary drift (issue #15)', () => {
	it('does not cascade into one-row-per-page for tightly-packed rows with sub-point drift', () => {
		const rowHeight = 20;
		const rowCount = 10;

		// Each row's height carries a deliberate DRIFT so its own bottom lands a
		// hair above the next row's/section's "clean" top — exactly the pattern
		// Yoga's float32 accumulation produces for a tightly-packed run.
		const rows: PDFNode[] = [];
		for (let i = 0; i < rowCount; i++) {
			rows.push(box(`row${i}`, i * rowHeight, rowHeight + DRIFT, { wrap: false }));
		}
		const sectionTop = rowCount * rowHeight; // clean value, no drift
		const section = box('section', sectionTop, 20, { breakBefore: true });

		const doc = makeDoc([...rows, section]);
		const pages = paginate(doc);

		// All 10 rows pack onto page 1; only the forced-break section moves to
		// page 2. A cascade would instead scatter rows across many pages with
		// one row each.
		expect(pages).toHaveLength(2);
		for (let i = 0; i < rowCount; i++) {
			expect(pageOf(pages, `row${i}`)).toBe(0);
		}
		expect(pageOf(pages, 'section')).toBe(1);
	});

	it('still defers a row that genuinely does not fit, without cascading the rest', () => {
		const rowHeight = 20;
		const rowCount = 10;

		const rows: PDFNode[] = [];
		for (let i = 0; i < rowCount; i++) {
			// Every row carries the same sub-epsilon drift as the core repro...
			let height = rowHeight + DRIFT;
			// ...except the last row before the break, which is genuinely 5pt
			// too tall — real overflow, not noise.
			if (i === rowCount - 1) height = rowHeight + 5;
			rows.push(box(`row${i}`, i * rowHeight, height, { wrap: false }));
		}
		const sectionTop = rowCount * rowHeight;
		const section = box('section', sectionTop, 20, { breakBefore: true });

		const doc = makeDoc([...rows, section]);
		const pages = paginate(doc);

		// Rows 0-8 still pack together (noise tolerated); only the genuinely
		// oversized last row is pushed off page 1 — and it does not drag the
		// rest of the run down with it.
		for (let i = 0; i < rowCount - 1; i++) {
			expect(pageOf(pages, `row${i}`)).toBe(0);
		}
		expect(pageOf(pages, `row${rowCount - 1}`)).toBeGreaterThan(0);
	});
});
