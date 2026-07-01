/**
 * Tests for cutting a bordered / filled box cleanly across a page boundary.
 *
 * When a <View> with a border (or background) is tall enough to straddle a page
 * break, it must not be redrawn as a whole closed box on each page — that draws
 * a false bottom edge on the first fragment and a false top edge on the second,
 * making one box look like two stacked boxes.
 *
 * Instead the paginator clamps the box to each page's content band and flags the
 * cut edge(s) via __cutTop / __cutBottom; the renderer then suppresses the
 * border and corner radii on the cut edge so the shape reads as continuous —
 * mirroring react-pdf's splitNode().
 *
 * These tests cover the paginator's flags + geometry, and a smoke render that
 * the cut-border draw path produces a valid PDF.
 */

import { describe, it, expect } from 'vitest';
import { createDocument } from '../runtime/document.js';
import { paginate } from '../pagination/paginate.js';
import { renderPDF } from '../renderer/render.js';
import type { PDFNode } from '../types/pdf.js';

const PAGE_HEIGHT = 842;
const PAD = 40;
const CONTENT_END = PAGE_HEIGHT - PAD; // 802

function streamToBuffer(stream: any): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (c: Buffer) => chunks.push(c));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
		stream.on('error', reject);
	});
}

function makeDoc(children: PDFNode[]) {
	const doc = createDocument();
	const page: PDFNode = {
		type: 'page',
		props: { size: 'A4', width: 595, height: PAGE_HEIGHT, style: { padding: PAD } },
		children,
		layout: { x: 0, y: 0, width: 595, height: PAGE_HEIGHT }
	};
	doc.children.push(page);
	return doc;
}

/** Finds the first view node in a page tree (the bordered box under test). */
function findView(page: PDFNode): PDFNode | undefined {
	let found: PDFNode | undefined;
	(function walk(n: PDFNode) {
		if (!found && n.type === 'view') found = n;
		n.children.forEach(walk);
	})(page);
	return found;
}

/**
 * A bordered box spanning y=700..900 (200pt) that straddles CONTENT_END (802),
 * with one child on each side of the break so it survives on both pages.
 */
function straddlingBox(): PDFNode {
	return {
		type: 'view',
		props: { style: { borderWidth: 1, borderRadius: 4, borderColor: 'red' } },
		layout: { x: 40, y: 700, width: 500, height: 200 },
		children: [
			{
				type: 'view',
				props: { style: {} },
				layout: { x: 50, y: 710, width: 480, height: 40 },
				children: []
			},
			{
				type: 'view',
				props: { style: {} },
				layout: { x: 50, y: 850, width: 480, height: 40 },
				children: []
			}
		]
	};
}

describe('paginate – bordered box across a page break', () => {
	it('splits onto two pages', () => {
		const pages = paginate(makeDoc([straddlingBox()]));
		expect(pages.length).toBe(2);
	});

	it('flags only the bottom edge as cut on the first-page fragment', () => {
		const pages = paginate(makeDoc([straddlingBox()]));
		const first = findView(pages[0])!;
		expect(first.props.__cutBottom).toBe(true);
		expect(first.props.__cutTop).toBeUndefined();
	});

	it('clamps the first-page fragment to the content boundary', () => {
		const pages = paginate(makeDoc([straddlingBox()]));
		const first = findView(pages[0])!;
		// Real top preserved; bottom cut at the content-area edge (802).
		expect(first.layout!.y).toBeCloseTo(700, 5);
		expect(first.layout!.y + first.layout!.height).toBeCloseTo(CONTENT_END, 5);
	});

	it('flags only the top edge as cut on the continuation fragment', () => {
		const pages = paginate(makeDoc([straddlingBox()]));
		const second = findView(pages[1])!;
		expect(second.props.__cutTop).toBe(true);
		expect(second.props.__cutBottom).toBeUndefined();
	});

	it('clamps the continuation fragment to the top padding', () => {
		const pages = paginate(makeDoc([straddlingBox()]));
		const second = findView(pages[1])!;
		// Top cut at the content-area top (padding); real bottom preserved.
		// Original bottom 900 → 900 - 802 + 40 = 138 in page-2 coordinates.
		expect(second.layout!.y).toBeCloseTo(PAD, 5);
		expect(second.layout!.y + second.layout!.height).toBeCloseTo(138, 5);
	});

	it('does not flag an undecorated container that straddles the break', () => {
		// Same geometry but no border/background — no cut flags, no clamping.
		const box = straddlingBox();
		box.props.style = {};
		const pages = paginate(makeDoc([box]));
		for (const p of pages) {
			const v = findView(p);
			expect(v?.props.__cutTop).toBeUndefined();
			expect(v?.props.__cutBottom).toBeUndefined();
		}
	});

	it('renders both fragments to a valid PDF (cut-border path does not throw)', async () => {
		const pages = paginate(makeDoc([straddlingBox()]));
		const stream = renderPDF(pages);
		const buf = await streamToBuffer(stream);
		expect(buf.slice(0, 5).toString()).toBe('%PDF-');
	});
});

describe('paginate – continuation box wraps deferred content', () => {
	// A bordered box with padding whose text is deferred to the next page by
	// orphan control. On the continuation the text is repositioned to the top of
	// the content band; the box must grow to cover it plus the bottom padding so
	// the border does not cut through the last line.
	it('grows the continuation box to cover deferred text + bottom padding', () => {
		const PAD_BOX = 8;
		const lineHeight = 14; // Helvetica @ ~12pt; exact value not important here
		// Box near the boundary: label fits on page 1, body (4 lines) is deferred.
		// Box height fits its content tightly (pad + label + body + pad), so on the
		// continuation the box's Yoga-derived bottom would sit above the deferred,
		// repositioned text unless we grow it. This is what reproduces the bug.
		const box: PDFNode = {
			type: 'view',
			props: { style: { borderWidth: 1, padding: PAD_BOX } },
			// Straddles CONTENT_END (802): top on page 1, bottom just past it.
			layout: { x: 40, y: 760, width: 220, height: 45 }, // 760..805, straddles 802
			children: [
				{
					type: 'text',
					props: { text: 'Label', style: { fontSize: 12, fontFamily: 'Helvetica' } },
					layout: { x: 48, y: 768, width: 204, height: lineHeight },
					children: []
				},
				{
					type: 'text',
					props: {
						// Narrow column forces several wrapped lines; orphan control keeps
						// them together, so with only one line's room before the break the
						// whole block defers to page 2 and is repositioned to the top of
						// the content band.
						text: 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen',
						style: { fontSize: 12, fontFamily: 'Helvetica', orphans: 2 }
					},
					layout: { x: 48, y: 785, width: 204, height: 3 * lineHeight },
					children: []
				}
			]
		};

		const pages = paginate(makeDoc([box]));
		const cont = findView(pages[pages.length - 1])!;
		expect(cont.props.__cutTop).toBe(true);

		// The deepest text child's bottom, in the continuation's coordinates.
		const childBottom = cont.children.reduce((max, c) => {
			if (c.type !== 'text' || !c.layout) return max;
			return Math.max(max, c.layout.y + c.layout.height);
		}, 0);

		expect(childBottom).toBeGreaterThan(0);
		// Box must extend at least the bottom padding below the last line.
		expect(cont.layout!.y + cont.layout!.height).toBeGreaterThanOrEqual(childBottom + PAD_BOX);
	});
});

describe('paginate – bordered box spanning three pages', () => {
	/** A box tall enough to cross two page breaks; the middle fragment is cut both ends. */
	function tallBox(): PDFNode {
		const child = (y: number): PDFNode => ({
			type: 'view',
			props: { style: {} },
			layout: { x: 50, y, width: 480, height: 20 },
			children: []
		});
		return {
			type: 'view',
			props: { style: { borderWidth: 1, borderColor: 'blue' } },
			layout: { x: 40, y: 700, width: 500, height: 1700 }, // 700..2400
			children: [child(710), child(1200), child(2350)]
		};
	}

	it('cuts both edges on the middle fragment', () => {
		const pages = paginate(makeDoc([tallBox()]));
		expect(pages.length).toBe(3);

		const first = findView(pages[0])!;
		expect(first.props.__cutTop).toBeUndefined();
		expect(first.props.__cutBottom).toBe(true);

		const middle = findView(pages[1])!;
		expect(middle.props.__cutTop).toBe(true);
		expect(middle.props.__cutBottom).toBe(true);

		const last = findView(pages[2])!;
		expect(last.props.__cutTop).toBe(true);
		expect(last.props.__cutBottom).toBeUndefined();
	});
});
