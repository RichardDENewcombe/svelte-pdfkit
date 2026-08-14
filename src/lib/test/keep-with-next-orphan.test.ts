/**
 * Regression tests for issue #14: keepWithNext failed silently when its
 * successor was entirely orphan-deferred.
 *
 * findKeepWithNextBreak() used to decide a pair was "violated" purely by
 * comparing the successor's raw Yoga top (bTop) against the candidate page
 * boundary. But sliceNode()'s orphan-control branch can defer a text node
 * — and therefore any container whose only content is that text node —
 * entirely, even when its raw top is comfortably before the boundary,
 * whenever fewer than `orphans` (default 1) lines fit in the remaining
 * space. The fix reuses sliceNode() itself via wouldRenderInSlot() to ask
 * "would this node actually produce visible content here," rather than
 * trusting bTop alone.
 *
 * These tests borrow widow-orphan.test.ts's getLineHeight-based precise
 * positioning (real text nodes, not opaque leaf boxes) combined with
 * keep-with-next.test.ts's box()/pageOf() helpers, since the bug is
 * specifically about a keepWithNext successor whose content is real,
 * orphan-controlled text.
 */

import { describe, it, expect } from 'vitest';
import { createDocument } from '../runtime/document.js';
import { paginate } from '../pagination/paginate.js';
import { getLineHeight } from '../layout/text-measure.js';
import type { PDFNode } from '../types/pdf.js';

const PAGE_HEIGHT = 842;
const PAD_BOTTOM = 50;
const CONTENT_END = PAGE_HEIGHT - PAD_BOTTOM; // 792
const BASE_STYLE = { fontSize: 12, fontFamily: 'Helvetica' };

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

/** A bordered container wrapping a single real text child, tagged with a testId. */
function bodyBlock(testId: string, text: string, y: number, lineCount: number, lh: number): PDFNode {
	return {
		type: 'view',
		props: { testId, style: { borderWidth: 1 } },
		children: [
			{
				type: 'text',
				props: { text, style: BASE_STYLE },
				children: [],
				layout: { x: 40, y, width: 515, height: lineCount * lh }
			}
		],
		layout: { x: 40, y, width: 515, height: lineCount * lh }
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

function collectText(page: PDFNode): PDFNode[] {
	const result: PDFNode[] = [];
	function walk(n: PDFNode) {
		if (n.type === 'text') result.push(n);
		n.children.forEach(walk);
	}
	walk(page);
	return result;
}

describe('keep-with-next — successor orphan-deferred entirely (issue #14)', () => {
	it('pulls the kept node forward when its successor is entirely orphan-deferred, even though the successor\'s raw top clears the boundary', () => {
		const lh = getLineHeight(BASE_STYLE);
		// Body's single text line has only half a line-height of room before
		// CONTENT_END — default orphans:1 defers it entirely, and it's the
		// body container's only child, so the container also returns null.
		// Its raw top (bodyTop) is nonetheless comfortably before CONTENT_END.
		const bodyTop = CONTENT_END - lh * 0.5;
		const headingHeight = 20;
		const fillerEnd = bodyTop - headingHeight;

		const doc = makeDoc([
			box('filler', 0, fillerEnd),
			box('heading', fillerEnd, headingHeight, { keepWithNext: true }),
			bodyBlock('body', 'Body text', bodyTop, 1, lh)
		]);

		const pages = paginate(doc);

		expect(pageOf(pages, 'filler')).toBe(0);
		// Both the heading and the body must move to page 2 together — the
		// heading must NOT be left stranded alone on page 1.
		expect(pageOf(pages, 'heading')).toBe(1);
		expect(pageOf(pages, 'body')).toBe(1);

		// No content lost: the text still renders somewhere.
		const allText = pages.flatMap((p) => collectText(p)).map((n) => n.props.text);
		expect(allText).toContain('Body text');
	});

	it('does NOT pull the kept node when the successor renders at least partially', () => {
		const lh = getLineHeight(BASE_STYLE);
		// Exactly 1 line fits before CONTENT_END (mirrors widow-orphan.test.ts's
		// "does NOT defer" positioning) — the body block renders its first line
		// on this page, so it is not entirely absent and the pair is not violated.
		const bodyTop = CONTENT_END - lh * 1.5;
		const headingHeight = 20;
		const fillerEnd = bodyTop - headingHeight;

		const doc = makeDoc([
			box('filler', 0, fillerEnd),
			box('heading', fillerEnd, headingHeight, { keepWithNext: true }),
			bodyBlock('body', 'Body line 1\nBody line 2', bodyTop, 2, lh)
		]);

		const pages = paginate(doc);

		expect(pageOf(pages, 'filler')).toBe(0);
		// Heading is not pulled — it stays with the (partially rendered) body.
		expect(pageOf(pages, 'heading')).toBe(0);
		expect(pageOf(pages, 'body')).toBe(0);

		const p0Lines = collectText(pages[0]).flatMap((n) => (n.props.text as string).split('\n'));
		const p1Lines = collectText(pages[1]).flatMap((n) => (n.props.text as string).split('\n'));
		expect(p0Lines).toEqual(['Body line 1']);
		expect(p1Lines).toEqual(['Body line 2']);
	});
});
