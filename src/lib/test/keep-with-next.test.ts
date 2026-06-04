/**
 * Tests for keep-with-next pagination control.
 *
 * A node marked `keepWithNext` must appear on the same page as the *start* of
 * its following flow sibling. When the natural page boundary would separate
 * them, the paginator pulls the break up to the kept node's top so both move to
 * the next page together — the classic "don't strand a heading at the bottom of
 * the page" rule.
 *
 * These tests drive the paginator directly with pre-laid-out node trees, the
 * same approach used by the widow/orphan and text-split suites.
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

// ── Core behaviour ───────────────────────────────────────────────────────────────

describe('keep-with-next', () => {
	it('defers a kept node to the next page when its successor would not fit', () => {
		// filler fills most of page 0; heading sits near the bottom and its body
		// starts past the page boundary.
		const doc = makeDoc([
			box('filler', 0, 775, { style: {} }),
			box('heading', 775, 20, { keepWithNext: true }),
			box('body', 795, 100)
		]);

		const pages = paginate(doc);

		// Heading is pulled to page 2 to stay with the body.
		expect(pageOf(pages, 'filler')).toBe(0);
		expect(pageOf(pages, 'heading')).toBe(1);
		expect(pageOf(pages, 'body')).toBe(1);
		// Heading and body share a page.
		expect(pageOf(pages, 'heading')).toBe(pageOf(pages, 'body'));
	});

	it('does NOT defer the node when keepWithNext is absent (control)', () => {
		const doc = makeDoc([
			box('filler', 0, 775),
			box('heading', 775, 20), // no keepWithNext
			box('body', 795, 100)
		]);

		const pages = paginate(doc);

		// Heading stays stranded on page 1, separated from its body.
		expect(pageOf(pages, 'heading')).toBe(0);
		expect(pageOf(pages, 'body')).toBe(1);
	});

	it('does not defer when the successor already starts on the same page', () => {
		// Body starts at 770, before the 792 boundary — nothing is separated.
		const doc = makeDoc([
			box('filler', 0, 750),
			box('heading', 750, 20, { keepWithNext: true }),
			box('body', 770, 100)
		]);

		const pages = paginate(doc);
		expect(pageOf(pages, 'heading')).toBe(0);
		expect(pageOf(pages, 'body')).toBe(0);
	});
});

// ── Edge cases ────────────────────────────────────────────────────────────────────

describe('keep-with-next – edge cases', () => {
	it('does not loop forever when the pair is taller than a page', () => {
		// Heading is already at the top of page 0 and the body is taller than a
		// whole page — the constraint cannot be satisfied, so the break is allowed.
		const doc = makeDoc([
			box('heading', 0, 20, { keepWithNext: true }),
			box('body', 20, 900)
		]);

		const pages = paginate(doc);
		expect(pageOf(pages, 'heading')).toBe(0);
		// Body overflows onto a second page but starts on page 0 with the heading.
		expect(pageOf(pages, 'body')).toBe(0);
		expect(pages.length).toBeGreaterThan(1);
	});

	it('has no effect when the kept node has no following sibling', () => {
		const doc = makeDoc([
			box('filler', 0, 775),
			box('trailing', 775, 100, { keepWithNext: true }) // last child
		]);

		const pages = paginate(doc);
		// Nothing to keep with — trailing node simply flows/splits naturally.
		expect(pageOf(pages, 'filler')).toBe(0);
		expect(pageOf(pages, 'trailing')).toBe(0);
	});

	it('moves a whole keepWithNext chain (A→B→C) to the next page together', () => {
		// A and B both keepWithNext; C is the block that does not fit. Pulling the
		// break to C's top exposes the B→? violation, then A→B, until all three
		// move together.
		const doc = makeDoc([
			box('filler', 0, 765),
			box('A', 765, 15, { keepWithNext: true }),
			box('B', 780, 15, { keepWithNext: true }),
			box('C', 795, 100)
		]);

		const pages = paginate(doc);

		expect(pageOf(pages, 'filler')).toBe(0);
		const pA = pageOf(pages, 'A');
		expect(pA).toBe(1);
		expect(pageOf(pages, 'B')).toBe(pA);
		expect(pageOf(pages, 'C')).toBe(pA);
	});
});
