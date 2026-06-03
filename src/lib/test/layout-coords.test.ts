/**
 * Layout coordinate assertions.
 *
 * Verifies that specific Yoga-computed and paginator-adjusted coordinates
 * land at the expected positions. These tests catch regressions in:
 *  - padding and sizing via Yoga (BasicPDF coordinates)
 *  - y-adjustment when text overflows onto page 2
 *  - the paginator's container-clamping fix for bordered Views on overflow pages
 */

import { describe, it, expect } from 'vitest';
import { render as svelteRender } from 'svelte/server';
import { createDocument } from '../runtime/document.js';
import { computeLayout } from '../layout/layout.js';
import { paginate } from '../pagination/paginate.js';
import { getLineHeight } from '../layout/text-measure.js';
import type { PDFNode } from '../types/pdf.js';

import BasicPDF from './BasicPDF.svelte';
import OverflowTemplate from './OverflowTemplate.svelte';

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildAndLayout(component: any, props: Record<string, any> = {}) {
	const doc = createDocument();
	// Svelte 5 SSR render() is lazy — accessing .html forces component execution.
	const { html: _ } = svelteRender(component, {
		props,
		context: new Map<string, unknown>([['__pdf__', doc], ['__pdf_root__', doc]])
	});
	computeLayout(doc);
	return doc;
}

function collectTextNodes(node: PDFNode): PDFNode[] {
	const result: PDFNode[] = [];
	function walk(n: PDFNode) {
		if (n.type === 'text') result.push(n);
		n.children.forEach(walk);
	}
	walk(node);
	return result;
}

// ── BasicPDF layout coordinates ───────────────────────────────────────────────

describe('layout coordinates – BasicPDF', () => {
	it('View fills the page and 40pt padding places text at x=40, y=40', () => {
		const doc = buildAndLayout(BasicPDF);
		const view  = doc.children[0].children[0];
		const text1 = view.children[0];
		const text2 = view.children[1];

		expect(view.layout!.x).toBe(0);
		expect(view.layout!.y).toBe(0);
		expect(view.layout!.width).toBe(595);

		expect(text1.layout!.x).toBe(40);
		expect(text1.layout!.y).toBe(40);
		expect(text1.layout!.width).toBe(515); // 595 − 2 × 40

		expect(text2.layout!.x).toBe(40);
		expect(text2.layout!.width).toBe(515);
	});

	it('text node heights are proportional to font size and within 2pt of PDFKit line height', () => {
		const doc = buildAndLayout(BasicPDF);
		const view  = doc.children[0].children[0];
		const text1 = view.children[0]; // "Hello, svelte-pdf!" fontSize: 24
		const text2 = view.children[1]; // "Pipeline working." fontSize: 12

		const lh24 = getLineHeight({ fontSize: 24 });
		const lh12 = getLineHeight({ fontSize: 12 });

		// fontSize:24 must produce a taller node than fontSize:12.
		expect(text1.layout!.height).toBeGreaterThan(text2.layout!.height);

		// Yoga rounds measure-callback results to its internal grid; allow 2pt.
		expect(text1.layout!.height).toBeGreaterThan(lh24 - 2);
		expect(text1.layout!.height).toBeLessThan(lh24 + 2);

		expect(text2.layout!.height).toBeGreaterThan(lh12 - 2);
		expect(text2.layout!.height).toBeLessThan(lh12 + 2);
	});

	it('second text node follows immediately below first node with no gap', () => {
		const doc = buildAndLayout(BasicPDF);
		const view  = doc.children[0].children[0];
		const text1 = view.children[0];
		const text2 = view.children[1];

		// Yoga's position and height rounding can diverge by up to 1pt.
		// The key invariant is that text2 starts within 1pt of text1's bottom edge.
		const gap = text2.layout!.y - (text1.layout!.y + text1.layout!.height);
		expect(gap).toBeGreaterThanOrEqual(-1);
		expect(gap).toBeLessThanOrEqual(1);
	});
});

// ── Overflow page y-adjustment ────────────────────────────────────────────────

describe('layout coordinates – overflow page y-adjustment', () => {
	it('all text nodes on every page have y >= 0', () => {
		const doc = buildAndLayout(OverflowTemplate, { count: 50 });
		const pages = paginate(doc);

		for (const page of pages) {
			for (const node of collectTextNodes(page)) {
				expect(node.layout!.y).toBeGreaterThanOrEqual(0);
			}
		}
	});

	it('all text nodes on page 1 have y strictly less than pageHeight', () => {
		const doc = buildAndLayout(OverflowTemplate, { count: 50 });
		const pages = paginate(doc);
		const pageHeight = pages[0].props.height as number;

		for (const node of collectTextNodes(pages[0])) {
			expect(node.layout!.y).toBeLessThan(pageHeight);
		}
	});

	it('text nodes on each page have strictly increasing y coordinates', () => {
		const doc = buildAndLayout(OverflowTemplate, { count: 50 });
		const pages = paginate(doc);

		for (const page of pages) {
			const texts = collectTextNodes(page);
			for (let i = 1; i < texts.length; i++) {
				expect(texts[i].layout!.y).toBeGreaterThan(texts[i - 1].layout!.y);
			}
		}
	});

	it('no text lines are lost or duplicated across pages', () => {
		const count = 50;
		const doc = buildAndLayout(OverflowTemplate, { count });
		const pages = paginate(doc);

		const allLines: string[] = [];
		for (const page of pages) {
			for (const node of collectTextNodes(page)) {
				allLines.push(...(node.props.text as string).split('\n').filter(Boolean));
			}
		}

		expect(allLines).toHaveLength(count);
		expect(new Set(allLines).size).toBe(count); // no duplicates
	});

	it('first text on page 2 starts within the first line height from the page top', () => {
		const doc = buildAndLayout(OverflowTemplate, { count: 50 });
		const pages = paginate(doc);
		expect(pages.length).toBeGreaterThan(1);

		const lh20 = getLineHeight({ fontSize: 20 });
		const texts = collectTextNodes(pages[1]);
		expect(texts.length).toBeGreaterThan(0);
		// Whether the first text straddles the boundary (y=0) or starts just
		// after it, its top edge must be less than one line height from page top.
		expect(texts[0].layout!.y).toBeLessThan(lh20);
	});
});

// ── Container clamping on overflow pages ──────────────────────────────────────

describe('layout coordinates – straddling container clamping', () => {
	it('a container straddling the page boundary has y=0 on page 2', () => {
		// Before the paginator fix, the container's raw adjusted y was
		// 800 − 842 = −42.  The fix clamps it to 0 so that borders /
		// backgrounds do not render above the visible page area.
		const doc = createDocument();
		const container: PDFNode = {
			type: 'view',
			props: { style: { borderWidth: 1, borderColor: '#000' } },
			children: [{
				type: 'text',
				props: { text: 'overflow content', style: {} },
				children: [],
				layout: { x: 40, y: 900, width: 515, height: 20 }
			}],
			// starts on page 1 (y=800), ends on page 2 (y+h=940 > 842)
			layout: { x: 0, y: 800, width: 595, height: 140 }
		};
		const page: PDFNode = {
			type: 'page',
			props: { size: 'A4', width: 595, height: 842, style: {} },
			children: [container],
			layout: { x: 0, y: 0, width: 595, height: 842 }
		};
		doc.children.push(page);

		const pages = paginate(doc);
		expect(pages).toHaveLength(2);

		const containerOnPage2 = pages[1].children[0];
		expect(containerOnPage2.layout!.y).toBe(0);
	});

	it('clamped container bottom reaches at least as far as its child bottom', () => {
		const doc = createDocument();
		const child: PDFNode = {
			type: 'text',
			props: { text: 'overflow content', style: {} },
			children: [],
			layout: { x: 40, y: 900, width: 515, height: 20 }
		};
		const container: PDFNode = {
			type: 'view',
			props: { style: { borderWidth: 1 } },
			children: [child],
			layout: { x: 0, y: 800, width: 595, height: 140 }
		};
		const page: PDFNode = {
			type: 'page',
			props: { size: 'A4', width: 595, height: 842, style: {} },
			children: [container],
			layout: { x: 0, y: 0, width: 595, height: 842 }
		};
		doc.children.push(page);

		const pages = paginate(doc);
		const c2 = pages[1].children[0];
		const ch = c2.children[0];

		// Container must enclose its child.
		const containerBottom = c2.layout!.y + c2.layout!.height;
		const childBottom     = ch.layout!.y + ch.layout!.height;
		expect(containerBottom).toBeGreaterThanOrEqual(childBottom);
	});

	it('a container that fits entirely on page 1 is unaffected by the clamping path', () => {
		const doc = createDocument();
		const container: PDFNode = {
			type: 'view',
			props: { style: { borderWidth: 1 } },
			children: [{
				type: 'text',
				props: { text: 'fits on page 1', style: {} },
				children: [],
				layout: { x: 40, y: 100, width: 515, height: 20 }
			}],
			layout: { x: 0, y: 80, width: 595, height: 60 }
		};
		// Overflow node forces a second page without touching the container.
		const filler: PDFNode = {
			type: 'text',
			props: { text: 'overflow filler', style: {} },
			children: [],
			layout: { x: 40, y: 900, width: 515, height: 20 }
		};
		const page: PDFNode = {
			type: 'page',
			props: { size: 'A4', width: 595, height: 842, style: {} },
			children: [container, filler],
			layout: { x: 0, y: 0, width: 595, height: 842 }
		};
		doc.children.push(page);

		const pages = paginate(doc);
		expect(pages.length).toBeGreaterThan(1);

		// Page 1 container must retain its original coordinates.
		const p1Container = pages[0].children.find(c => c.type === 'view')!;
		expect(p1Container.layout!.y).toBe(80);
		expect(p1Container.layout!.height).toBe(60);
	});
});
