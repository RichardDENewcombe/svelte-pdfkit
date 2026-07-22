/**
 * Tests for SVG stroke-dash and viewBox support.
 *
 * Covered:
 *  1. AST — Line/Rect store strokeDasharray/strokeDashoffset; Svg stores viewBox
 *  2. Renderer — dashed strokes call doc.dash() with the parsed pattern + phase
 *  3. Renderer — viewBox scales + translates the SVG coordinate space to fit the box
 *  4. E2E — a dashed + viewBox template renders to a valid PDF
 */

import { describe, it, expect } from 'vitest';
import { render as svelteRender } from 'svelte/server';
import { createDocument } from '../runtime/document.js';
import { renderComponent } from '../runtime/render.js';
import { drawSvg } from '../renderer/draw-svg.js';
import type { PDFNode } from '../types/pdf.js';
import SvgDashTemplate from './SvgDashTemplate.svelte';

function streamToBuffer(stream: any): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (c: Buffer) => chunks.push(c));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
		stream.on('error', reject);
	});
}

/**
 * A chainable recording stand-in for the PDFKit document. Every method call is
 * recorded; all methods return the proxy so `doc.x().y()` chains work, and
 * widthOfString returns a fixed number so text paths don't blow up.
 */
function mockDoc() {
	const calls: { method: string; args: any[] }[] = [];
	const proxy: any = new Proxy(
		{},
		{
			get(_t, prop) {
				if (prop === '__calls') return calls;
				if (prop === 'widthOfString') return () => 10;
				if (prop === 'linearGradient' || prop === 'radialGradient') {
					return (...args: any[]) => {
						calls.push({ method: String(prop), args });
						return { stop: () => {} };
					};
				}
				return (...args: any[]) => {
					calls.push({ method: String(prop), args });
					return proxy;
				};
			}
		}
	);
	return proxy;
}

function callsOf(doc: any, method: string) {
	return (doc.__calls as { method: string; args: any[] }[]).filter((c) => c.method === method);
}

function svgNode(children: PDFNode[], props: Record<string, any> = {}): PDFNode {
	return {
		type: 'svg',
		props,
		children,
		layout: { x: 0, y: 0, width: 200, height: 100 }
	} as PDFNode;
}

// ── 1. AST construction ─────────────────────────────────────────────────────────

function buildDoc() {
	const doc = createDocument();
	// Accessing `.html` forces Svelte's lazy server render to execute the tree.
	const { html: _ } = svelteRender(SvgDashTemplate, {
		props: {},
		context: new Map([
			['__pdf__', doc],
			['__pdf_root__', doc]
		])
	});
	return doc;
}

describe('dash / viewBox – AST construction', () => {
	it('Svg node stores viewBox in props', () => {
		const doc = buildDoc();
		const svg = doc.children[0].children[0].children[0];
		expect(svg.props.viewBox).toBe('0 0 50 25');
	});

	it('Line node stores strokeDasharray and strokeDashoffset', () => {
		const doc = buildDoc();
		const svg = doc.children[0].children[0].children[0];
		const line = svg.children.find((c: any) => c.type === 'svg_line');
		expect(line?.props.strokeDasharray).toBe('4 2');
		expect(line?.props.strokeDashoffset).toBe(1);
	});

	it('Rect node stores strokeDasharray', () => {
		const doc = buildDoc();
		const svg = doc.children[0].children[0].children[0];
		const rect = svg.children.find((c: any) => c.type === 'svg_rect');
		expect(rect?.props.strokeDasharray).toBe('3');
	});
});

// ── 2. Dash rendering ───────────────────────────────────────────────────────────

describe('dash – rendering', () => {
	it('a dashed line calls doc.dash with the parsed pattern', () => {
		const node = svgNode([
			{
				type: 'svg_line',
				props: { x1: 0, y1: 0, x2: 10, y2: 0, stroke: 'red', strokeDasharray: '4 2' },
				children: []
			} as PDFNode
		]);
		const doc = mockDoc();
		drawSvg(doc, node);
		const dashes = callsOf(doc, 'dash');
		expect(dashes).toHaveLength(1);
		expect(dashes[0].args[0]).toEqual([4, 2]);
	});

	it('strokeDashoffset maps to the dash phase option', () => {
		const node = svgNode([
			{
				type: 'svg_line',
				props: { x1: 0, y1: 0, x2: 10, y2: 0, stroke: 'red', strokeDasharray: 4, strokeDashoffset: 3 },
				children: []
			} as PDFNode
		]);
		const doc = mockDoc();
		drawSvg(doc, node);
		const dashes = callsOf(doc, 'dash');
		expect(dashes).toHaveLength(1);
		expect(dashes[0].args[0]).toEqual([4]);
		expect(dashes[0].args[1]).toMatchObject({ phase: 3 });
	});

	it('a dashed filled+stroked rect calls doc.dash', () => {
		const node = svgNode([
			{
				type: 'svg_rect',
				props: { x: 0, y: 0, width: 10, height: 10, fill: 'none', stroke: 'blue', strokeDasharray: '3,3' },
				children: []
			} as PDFNode
		]);
		const doc = mockDoc();
		drawSvg(doc, node);
		expect(callsOf(doc, 'dash')).toHaveLength(1);
		expect(callsOf(doc, 'dash')[0].args[0]).toEqual([3, 3]);
	});

	it('a solid line does not call doc.dash', () => {
		const node = svgNode([
			{
				type: 'svg_line',
				props: { x1: 0, y1: 0, x2: 10, y2: 0, stroke: 'red' },
				children: []
			} as PDFNode
		]);
		const doc = mockDoc();
		drawSvg(doc, node);
		expect(callsOf(doc, 'dash')).toHaveLength(0);
	});

	it('an invalid/empty dash array is ignored (no doc.dash)', () => {
		const node = svgNode([
			{
				type: 'svg_line',
				props: { x1: 0, y1: 0, x2: 10, y2: 0, stroke: 'red', strokeDasharray: 'none' },
				children: []
			} as PDFNode
		]);
		const doc = mockDoc();
		drawSvg(doc, node);
		expect(callsOf(doc, 'dash')).toHaveLength(0);
	});
});

// ── 3. viewBox rendering ────────────────────────────────────────────────────────

describe('viewBox – rendering', () => {
	it('uniformly scales content to fit the layout box (meet)', () => {
		// viewBox 50×50 into a 200×100 box → min(200/50, 100/50) = 2
		const node = svgNode([], { viewBox: '0 0 50 50' });
		node.children.push({ type: 'svg_rect', props: { x: 0, y: 0, width: 10, height: 10, fill: 'red' }, children: [] } as PDFNode);
		const doc = mockDoc();
		drawSvg(doc, node);
		const scales = callsOf(doc, 'scale');
		expect(scales).toHaveLength(1);
		expect(scales[0].args[0]).toBe(2);
	});

	it('translates by the viewBox min-x / min-y offset', () => {
		const node = svgNode([], { viewBox: '10 20 50 50' });
		node.children.push({ type: 'svg_rect', props: { x: 0, y: 0, width: 10, height: 10, fill: 'red' }, children: [] } as PDFNode);
		const doc = mockDoc();
		drawSvg(doc, node);
		const translates = callsOf(doc, 'translate');
		// Expect a translate(-10, -20) after the box-origin translate.
		expect(translates.some((t) => t.args[0] === -10 && t.args[1] === -20)).toBe(true);
	});

	it('without a viewBox, no scale is applied', () => {
		const node = svgNode([]);
		node.children.push({ type: 'svg_rect', props: { x: 0, y: 0, width: 10, height: 10, fill: 'red' }, children: [] } as PDFNode);
		const doc = mockDoc();
		drawSvg(doc, node);
		expect(callsOf(doc, 'scale')).toHaveLength(0);
	});
});

// ── 4. End-to-end ───────────────────────────────────────────────────────────────

describe('dash / viewBox – end-to-end rendering', () => {
	it('renders a dashed + viewBox template to a valid PDF', async () => {
		const stream = await renderComponent(SvgDashTemplate);
		const buf = await streamToBuffer(stream);
		expect(buf.slice(0, 5).toString()).toBe('%PDF-');
		expect(buf.length).toBeGreaterThan(1000);
	});
});
