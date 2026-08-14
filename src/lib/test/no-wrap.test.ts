/**
 * Tests for the `wrap={false}` pagination control.
 *
 * A node marked `wrap={false}` must not be sliced across a page boundary — if it
 * doesn't fit in the remaining space on the current page, it moves whole to the
 * next page instead of being cut mid-content. This reuses the keep-with-next
 * boundary-pulling mechanism in the paginator, treating the node's own top/bottom
 * as a self-pair (see collectNoWrapPairs() in ../pagination/paginate.ts).
 *
 * These tests drive the paginator directly with pre-laid-out node trees, the
 * same approach used by the keep-with-next and widow/orphan suites.
 */

import { describe, it, expect } from 'vitest';
import { createDocument } from '../runtime/document.js';
import { paginate } from '../pagination/paginate.js';
import type { PDFNode } from '../types/pdf.js';

const PAGE_HEIGHT = 842;
const PAD_BOTTOM = 50;
const CONTENT_END = PAGE_HEIGHT - PAD_BOTTOM; // 792

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

describe('wrap={false}', () => {
	it('defers a wrap={false} node to the next page when it does not fit', () => {
		// filler fills most of page 0; the wrap={false} box starts near the bottom
		// and is taller than the remaining space.
		const doc = makeDoc([
			box('filler', 0, 775),
			box('block', 775, 100, { wrap: false })
		]);

		const pages = paginate(doc);

		expect(pageOf(pages, 'filler')).toBe(0);
		// Moved whole to page 2 rather than split across pages 1 and 2.
		expect(pageOf(pages, 'block')).toBe(1);
	});

	it('control: without wrap={false}, the same layout splits across the boundary', () => {
		const doc = makeDoc([
			box('filler', 0, 775),
			box('block', 775, 100) // no wrap prop — defaults to wrap: true
		]);

		const pages = paginate(doc);

		// Split: appears (in some sliced form) on both page 0 and page 1.
		expect(pageOf(pages, 'filler')).toBe(0);
		const onPage0 = pages[0].children.some((c) => findTestId(c, 'block'));
		const onPage1 = pages[1]?.children.some((c) => findTestId(c, 'block'));
		expect(onPage0).toBe(true);
		expect(onPage1).toBe(true);
	});

	it('does not defer when the node already fits entirely on the current page', () => {
		// Block starts at 700 and ends at 780 — before the 792 boundary.
		const doc = makeDoc([
			box('filler', 0, 700),
			box('block', 700, 80, { wrap: false })
		]);

		const pages = paginate(doc);
		expect(pageOf(pages, 'filler')).toBe(0);
		expect(pageOf(pages, 'block')).toBe(0);
	});
});

function findTestId(node: PDFNode, testId: string): boolean {
	if (node.props.testId === testId) return true;
	return node.children.some((c) => findTestId(c, testId));
}

// ── Edge cases ────────────────────────────────────────────────────────────────────

describe('wrap={false} – edge cases', () => {
	it('falls back to splitting when the node is taller than a whole page', () => {
		// The wrap={false} block is already at the top of page 0 (nothing above it)
		// and is taller than a full content band — the constraint cannot be
		// satisfied, so it splits normally rather than looping forever.
		const doc = makeDoc([box('block', 0, 900, { wrap: false })]);

		const pages = paginate(doc);
		expect(pageOf(pages, 'block')).toBe(0);
		expect(pages.length).toBeGreaterThan(1);
	});

	it('does not crowd a following sibling when the block is deferred whole', () => {
		// filler fills most of page 0; a wrap={false} block doesn't fit and is
		// deferred whole to page 1; a normal sibling follows it with a 10pt gap
		// (Yoga-computed). The sibling must land directly after the deferred
		// block on page 1 with that gap preserved, not crowded against it.
		const doc = makeDoc([
			box('filler', 0, 775),
			box('block', 775, 60, { wrap: false }),
			box('sibling', 845, 40) // 10pt gap after block's original bottom (775+60=835)
		]);

		const pages = paginate(doc);

		expect(pageOf(pages, 'filler')).toBe(0);
		const blockPage = pageOf(pages, 'block');
		const siblingPage = pageOf(pages, 'sibling');
		expect(blockPage).toBe(1);
		expect(siblingPage).toBe(1);

		const blockY = layoutYOf(pages, 'block');
		const siblingY = layoutYOf(pages, 'sibling');
		expect(blockY).toBeDefined();
		expect(siblingY).toBeDefined();
		// The sibling sits exactly 60 (block height) + 10 (original gap) below
		// the block's new top — the same offset Yoga originally computed.
		expect(siblingY! - blockY!).toBe(70);
	});

	it('keeps a decorated (bordered) block intact — not cut mid-border', () => {
		const doc = makeDoc([
			box('filler', 0, 775),
			{
				type: 'view',
				props: { testId: 'block', wrap: false, style: { borderWidth: 1 } },
				children: [box('inner', 775, 90)],
				layout: { x: 40, y: 775, width: 515, height: 100 }
			}
		]);

		const pages = paginate(doc);

		expect(pageOf(pages, 'filler')).toBe(0);
		expect(pageOf(pages, 'block')).toBe(1);

		function findNode(nodes: PDFNode[], testId: string): PDFNode | undefined {
			for (const n of nodes) {
				if (n.props.testId === testId) return n;
				const found = findNode(n.children, testId);
				if (found) return found;
			}
			return undefined;
		}
		const blockNode = findNode(pages[1].children, 'block');
		expect(blockNode).toBeDefined();
		// Moved whole — neither cut edge flag should be set.
		expect(blockNode!.props.__cutTop).toBeFalsy();
		expect(blockNode!.props.__cutBottom).toBeFalsy();
	});
});
