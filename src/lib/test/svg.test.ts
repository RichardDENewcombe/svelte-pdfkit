/**
 * Tests for SVG rendering support.
 *
 * Covered:
 *  1. AST construction — Svg and SVG child components build the correct node tree
 *  2. Layout — svg node gets Yoga-computed dimensions; SVG children have no layout
 *  3. Rendering — all eight element types produce a valid PDF without error
 *  4. G grouping — child nodes nest inside the group node
 *  5. Polyline — AST construction and props
 *  6. Polygon  — AST construction and props
 *  7. parsePoints — points string parsing (comma-separated, space-separated, mixed)
 */

import { describe, it, expect } from 'vitest';
import { render as svelteRender } from 'svelte/server';
import { createDocument } from '../runtime/document.js';
import { computeLayout } from '../layout/layout.js';
import { renderComponent } from '../runtime/render.js';
import SvgTemplate from './SvgTemplate.svelte';
import SvgGradientTemplate from './SvgGradientTemplate.svelte';
import SvgClipTemplate from './SvgClipTemplate.svelte';
import { parsePoints, parseUrlRef } from '../renderer/draw-svg.js';
import SvgTextTemplate from './SvgTextTemplate.svelte';

function streamToBuffer(stream: any): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (c: Buffer) => chunks.push(c));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
		stream.on('error', reject);
	});
}

function buildDoc() {
	const doc = createDocument();
	const { html: _ } = svelteRender(SvgTemplate, {
		props: {},
		context: new Map([
			['__pdf__', doc],
			['__pdf_root__', doc]
		])
	});
	return doc;
}

// ── 1. AST construction ───────────────────────────────────────────────────────

describe('Svg – AST construction', () => {
	it('svg node has type "svg"', () => {
		const doc = buildDoc();
		// doc → page → view → svg
		const svg = doc.children[0].children[0].children[0];
		expect(svg.type).toBe('svg');
	});

	it('svg node stores width and height in style props', () => {
		const doc = buildDoc();
		const svg = doc.children[0].children[0].children[0];
		expect(svg.props.style.width).toBe(300);
		expect(svg.props.style.height).toBe(200);
	});

	it('svg node has eight direct SVG children', () => {
		const doc = buildDoc();
		const svg = doc.children[0].children[0].children[0];
		// rect, circle, ellipse, line, path, g, polyline, polygon
		expect(svg.children).toHaveLength(8);
	});

	it('child types are correct', () => {
		const doc = buildDoc();
		const svg = doc.children[0].children[0].children[0];
		const types = svg.children.map((c) => c.type);
		expect(types).toContain('svg_rect');
		expect(types).toContain('svg_circle');
		expect(types).toContain('svg_ellipse');
		expect(types).toContain('svg_line');
		expect(types).toContain('svg_path');
		expect(types).toContain('svg_g');
		expect(types).toContain('svg_polyline');
		expect(types).toContain('svg_polygon');
	});

	it('Path node stores the d attribute', () => {
		const doc = buildDoc();
		const svg = doc.children[0].children[0].children[0];
		const path = svg.children.find((c) => c.type === 'svg_path');
		expect(path?.props.d).toBe('M 10 100 L 100 150 L 200 100 Z');
	});

	it('Circle node stores cx, cy, r', () => {
		const doc = buildDoc();
		const svg = doc.children[0].children[0].children[0];
		const circle = svg.children.find((c) => c.type === 'svg_circle');
		expect(circle?.props.cx).toBe(100);
		expect(circle?.props.cy).toBe(30);
		expect(circle?.props.r).toBe(20);
	});

	it('Rect node stores x, y, width, height', () => {
		const doc = buildDoc();
		const svg = doc.children[0].children[0].children[0];
		const rect = svg.children.find((c) => c.type === 'svg_rect');
		expect(rect?.props.x).toBe(10);
		expect(rect?.props.y).toBe(10);
		expect(rect?.props.width).toBe(50);
		expect(rect?.props.height).toBe(30);
	});

	it('Line node stores x1, y1, x2, y2', () => {
		const doc = buildDoc();
		const svg = doc.children[0].children[0].children[0];
		const line = svg.children.find((c) => c.type === 'svg_line');
		expect(line?.props.x1).toBe(10);
		expect(line?.props.y1).toBe(80);
		expect(line?.props.x2).toBe(290);
		expect(line?.props.y2).toBe(80);
	});
});

// ── 2. G grouping ─────────────────────────────────────────────────────────────

describe('G – grouping', () => {
	it('G node has type "svg_g"', () => {
		const doc = buildDoc();
		const svg = doc.children[0].children[0].children[0];
		const g = svg.children.find((c) => c.type === 'svg_g');
		expect(g).toBeDefined();
	});

	it('G node contains its child circle', () => {
		const doc = buildDoc();
		const svg = doc.children[0].children[0].children[0];
		const g = svg.children.find((c) => c.type === 'svg_g')!;
		expect(g.children).toHaveLength(1);
		expect(g.children[0].type).toBe('svg_circle');
	});

	it('SVG children do not appear as PDF tree siblings of the svg node', () => {
		const doc = buildDoc();
		// The view containing the svg should have exactly one child (the svg node).
		const view = doc.children[0].children[0];
		expect(view.children).toHaveLength(1);
		expect(view.children[0].type).toBe('svg');
	});
});

// ── 3. Layout ─────────────────────────────────────────────────────────────────

describe('Svg – layout', () => {
	it('svg node receives Yoga-computed layout', () => {
		const doc = buildDoc();
		computeLayout(doc);
		const svg = doc.children[0].children[0].children[0];
		expect(svg.layout).toBeDefined();
		expect(svg.layout!.width).toBe(300);
		expect(svg.layout!.height).toBe(200);
	});

	it('SVG children do not have Yoga layout (they are not Yoga nodes)', () => {
		const doc = buildDoc();
		computeLayout(doc);
		const svg = doc.children[0].children[0].children[0];
		// SVG element children should not have .layout set by Yoga
		for (const child of svg.children) {
			expect(child.layout).toBeUndefined();
		}
	});
});

// ── 4. End-to-end rendering ───────────────────────────────────────────────────

describe('Svg – end-to-end rendering', () => {
	it('produces a valid PDF', async () => {
		const stream = await renderComponent(SvgTemplate);
		const buf = await streamToBuffer(stream);
		expect(buf.slice(0, 5).toString()).toBe('%PDF-');
		expect(buf.length).toBeGreaterThan(1000);
	});

	it('produces exactly one page', async () => {
		const stream = await renderComponent(SvgTemplate);
		const buf = await streamToBuffer(stream);
		const match = buf.toString('latin1').match(/\/Count (\d+)/);
		expect(match).not.toBeNull();
		expect(parseInt(match![1])).toBe(1);
	});
});

// ── 5. Polyline ───────────────────────────────────────────────────────────────

describe('Polyline – AST construction', () => {
	it('Polyline node has type "svg_polyline"', () => {
		const doc = buildDoc();
		const svg = doc.children[0].children[0].children[0];
		const polyline = svg.children.find((c) => c.type === 'svg_polyline');
		expect(polyline).toBeDefined();
	});

	it('Polyline node stores the points prop', () => {
		const doc = buildDoc();
		const svg = doc.children[0].children[0].children[0];
		const polyline = svg.children.find((c) => c.type === 'svg_polyline');
		expect(polyline?.props.points).toBe('10,150 50,120 90,160 130,110');
	});

	it('Polyline node stores stroke and strokeWidth', () => {
		const doc = buildDoc();
		const svg = doc.children[0].children[0].children[0];
		const polyline = svg.children.find((c) => c.type === 'svg_polyline');
		expect(polyline?.props.stroke).toBe('navy');
		expect(polyline?.props.strokeWidth).toBe(1.5);
	});

	it('Polyline node stores fill="none"', () => {
		const doc = buildDoc();
		const svg = doc.children[0].children[0].children[0];
		const polyline = svg.children.find((c) => c.type === 'svg_polyline');
		expect(polyline?.props.fill).toBe('none');
	});

	it('Polyline does not appear in the PDF tree outside its svg parent', () => {
		const doc = buildDoc();
		const view = doc.children[0].children[0];
		// The view should still have exactly one child — the svg node
		expect(view.children).toHaveLength(1);
		expect(view.children[0].type).toBe('svg');
	});
});

// ── 6. Polygon ────────────────────────────────────────────────────────────────

describe('Polygon – AST construction', () => {
	it('Polygon node has type "svg_polygon"', () => {
		const doc = buildDoc();
		const svg = doc.children[0].children[0].children[0];
		const polygon = svg.children.find((c) => c.type === 'svg_polygon');
		expect(polygon).toBeDefined();
	});

	it('Polygon node stores the points prop', () => {
		const doc = buildDoc();
		const svg = doc.children[0].children[0].children[0];
		const polygon = svg.children.find((c) => c.type === 'svg_polygon');
		expect(polygon?.props.points).toBe('200,140 230,110 260,140');
	});

	it('Polygon node stores fill, stroke, and strokeWidth', () => {
		const doc = buildDoc();
		const svg = doc.children[0].children[0].children[0];
		const polygon = svg.children.find((c) => c.type === 'svg_polygon');
		expect(polygon?.props.fill).toBe('teal');
		expect(polygon?.props.stroke).toBe('black');
		expect(polygon?.props.strokeWidth).toBe(1);
	});

	it('Polygon does not appear in the PDF tree outside its svg parent', () => {
		const doc = buildDoc();
		const view = doc.children[0].children[0];
		expect(view.children).toHaveLength(1);
		expect(view.children[0].type).toBe('svg');
	});
});

// ── 7. parsePoints ────────────────────────────────────────────────────────────

describe('parsePoints', () => {
	it('parses comma-separated pairs', () => {
		expect(parsePoints('10,20 30,40 50,60')).toEqual([[10, 20], [30, 40], [50, 60]]);
	});

	it('parses space-separated values (no commas)', () => {
		expect(parsePoints('10 20 30 40 50 60')).toEqual([[10, 20], [30, 40], [50, 60]]);
	});

	it('parses mixed comma-and-space separators', () => {
		expect(parsePoints('10,20 30 40,50 60')).toEqual([[10, 20], [30, 40], [50, 60]]);
	});

	it('handles leading and trailing whitespace', () => {
		expect(parsePoints('  10,20 30,40  ')).toEqual([[10, 20], [30, 40]]);
	});

	it('returns an empty array for an empty string', () => {
		expect(parsePoints('')).toEqual([]);
	});

	it('returns an empty array for a whitespace-only string', () => {
		expect(parsePoints('   ')).toEqual([]);
	});

	it('drops a trailing odd number (unpaired coordinate)', () => {
		// "10,20 30" — only one coordinate in the second pair; discard it
		expect(parsePoints('10,20 30')).toEqual([[10, 20]]);
	});

	it('parses a single point', () => {
		expect(parsePoints('5,15')).toEqual([[5, 15]]);
	});

	it('parses floating-point coordinates', () => {
		expect(parsePoints('1.5,2.5 3.0,4.75')).toEqual([[1.5, 2.5], [3.0, 4.75]]);
	});

	it('parses negative coordinates', () => {
		expect(parsePoints('-10,-20 30,40')).toEqual([[-10, -20], [30, 40]]);
	});
});

// ── 8. parseUrlRef ────────────────────────────────────────────────────────────

describe('parseUrlRef', () => {
	it('extracts the id from url(#foo)', () => {
		expect(parseUrlRef('url(#myGradient)')).toBe('myGradient');
	});

	it('extracts an id with hyphens', () => {
		expect(parseUrlRef('url(#my-gradient)')).toBe('my-gradient');
	});

	it('returns null for plain color strings', () => {
		expect(parseUrlRef('red')).toBeNull();
		expect(parseUrlRef('#ff0000')).toBeNull();
	});

	it('returns null for "none"', () => {
		expect(parseUrlRef('none')).toBeNull();
	});

	it('returns null for "transparent"', () => {
		expect(parseUrlRef('transparent')).toBeNull();
	});

	it('returns null for undefined', () => {
		expect(parseUrlRef(undefined)).toBeNull();
	});

	it('returns null for empty string', () => {
		expect(parseUrlRef('')).toBeNull();
	});
});

// ── 9. Gradient AST construction ──────────────────────────────────────────────

function buildGradientDoc() {
	const doc = createDocument();
	const { html: _ } = svelteRender(SvgGradientTemplate, {
		props: {},
		context: new Map([
			['__pdf__', doc],
			['__pdf_root__', doc]
		])
	});
	return doc;
}

describe('LinearGradient – AST construction', () => {
	it('svg has one svg_defs child', () => {
		const doc = buildGradientDoc();
		const svg = doc.children[0].children[0].children[0];
		const defs = svg.children.find((c: any) => c.type === 'svg_defs');
		expect(defs).toBeDefined();
	});

	it('svg_defs contains the svg_linear_gradient node', () => {
		const doc = buildGradientDoc();
		const svg = doc.children[0].children[0].children[0];
		const defs = svg.children.find((c: any) => c.type === 'svg_defs')!;
		const lg = defs.children.find((c: any) => c.type === 'svg_linear_gradient')!;
		expect(lg).toBeDefined();
		expect(lg.props.id).toBe('grad1');
		expect(lg.props.x1).toBe(0);
		expect(lg.props.y1).toBe(0);
		expect(lg.props.x2).toBe(200);
		expect(lg.props.y2).toBe(0);
	});

	it('svg_linear_gradient has two svg_stop children', () => {
		const doc = buildGradientDoc();
		const svg = doc.children[0].children[0].children[0];
		const defs = svg.children.find((c: any) => c.type === 'svg_defs')!;
		const lg = defs.children.find((c: any) => c.type === 'svg_linear_gradient')!;
		expect(lg.children).toHaveLength(2);
		expect(lg.children[0].type).toBe('svg_stop');
		expect(lg.children[0].props.offset).toBe(0);
		expect(lg.children[0].props.stopColor).toBe('red');
		expect(lg.children[1].props.offset).toBe(1);
		expect(lg.children[1].props.stopColor).toBe('blue');
	});
});

describe('RadialGradient – AST construction', () => {
	it('svg_defs contains the svg_radial_gradient node', () => {
		const doc = buildGradientDoc();
		const svg = doc.children[0].children[0].children[0];
		const defs = svg.children.find((c: any) => c.type === 'svg_defs')!;
		const rg = defs.children.find((c: any) => c.type === 'svg_radial_gradient')!;
		expect(rg).toBeDefined();
		expect(rg.props.id).toBe('grad2');
		expect(rg.props.cx).toBe(150);
		expect(rg.props.cy).toBe(150);
		expect(rg.props.r).toBe(50);
	});

	it('svg_radial_gradient has two svg_stop children', () => {
		const doc = buildGradientDoc();
		const svg = doc.children[0].children[0].children[0];
		const defs = svg.children.find((c: any) => c.type === 'svg_defs')!;
		const rg = defs.children.find((c: any) => c.type === 'svg_radial_gradient')!;
		expect(rg.children).toHaveLength(2);
		expect(rg.children[0].props.stopColor).toBe('yellow');
		expect(rg.children[1].props.stopColor).toBe('green');
	});
});

// ── 10. ClipPath AST construction ─────────────────────────────────────────────

function buildClipDoc() {
	const doc = createDocument();
	const { html: _ } = svelteRender(SvgClipTemplate, {
		props: {},
		context: new Map([
			['__pdf__', doc],
			['__pdf_root__', doc]
		])
	});
	return doc;
}

describe('ClipPath – AST construction', () => {
	it('svg_defs contains a svg_clip_path node', () => {
		const doc = buildClipDoc();
		const svg = doc.children[0].children[0].children[0];
		const defs = svg.children.find((c: any) => c.type === 'svg_defs')!;
		expect(defs).toBeDefined();
		const cp = defs.children.find((c: any) => c.type === 'svg_clip_path')!;
		expect(cp).toBeDefined();
		expect(cp.props.id).toBe('clip1');
	});

	it('svg_clip_path contains a rect child', () => {
		const doc = buildClipDoc();
		const svg = doc.children[0].children[0].children[0];
		const defs = svg.children.find((c: any) => c.type === 'svg_defs')!;
		const cp = defs.children.find((c: any) => c.type === 'svg_clip_path')!;
		expect(cp.children).toHaveLength(1);
		expect(cp.children[0].type).toBe('svg_rect');
	});
});

// ── 11. E2E gradient rendering ─────────────────────────────────────────────────

describe('Gradient – end-to-end rendering', () => {
	it('renders a gradient-filled rect to a valid PDF buffer', async () => {
		const stream = await renderComponent(SvgGradientTemplate);
		const buf = await streamToBuffer(stream);
		expect(buf.slice(0, 5).toString()).toBe('%PDF-');
		expect(buf.length).toBeGreaterThan(1000);
	});
});

// ── 12. E2E clip path rendering ───────────────────────────────────────────────

describe('ClipPath – end-to-end rendering', () => {
	it('renders a clipped circle to a valid PDF buffer', async () => {
		const stream = await renderComponent(SvgClipTemplate);
		const buf = await streamToBuffer(stream);
		expect(buf.slice(0, 5).toString()).toBe('%PDF-');
		expect(buf.length).toBeGreaterThan(1000);
	});
});

// ── 13. SvgText & Tspan AST construction ──────────────────────────────────────

function buildTextDoc() {
	const doc = createDocument();
	const { html: _ } = svelteRender(SvgTextTemplate, {
		props: {},
		context: new Map([
			['__pdf__', doc],
			['__pdf_root__', doc]
		])
	});
	return doc;
}

describe('SvgText – AST construction', () => {
	it('svg node has svg_text children', () => {
		const doc = buildTextDoc();
		const svg = doc.children[0].children[0].children[0];
		const texts = svg.children.filter((c: any) => c.type === 'svg_text');
		expect(texts.length).toBeGreaterThan(0);
	});

	it('simple svg_text stores x, y, text, fontSize, fill', () => {
		const doc = buildTextDoc();
		const svg = doc.children[0].children[0].children[0];
		const node = svg.children.find((c: any) => c.type === 'svg_text' && c.props.text === 'Hello, SVG!')!;
		expect(node).toBeDefined();
		expect(node.props.x).toBe(10);
		expect(node.props.y).toBe(20);
		expect(node.props.fontSize).toBe(14);
		expect(node.props.fill).toBe('#1a56db');
	});

	it('svg_text with textAnchor stores the prop', () => {
		const doc = buildTextDoc();
		const svg = doc.children[0].children[0].children[0];
		const node = svg.children.find((c: any) => c.type === 'svg_text' && c.props.text === 'Centered')!;
		expect(node).toBeDefined();
		expect(node.props.textAnchor).toBe('middle');
		expect(node.props.x).toBe(150);
	});

	it('svg_text with Tspan children stores tspan nodes in its children', () => {
		const doc = buildTextDoc();
		const svg = doc.children[0].children[0].children[0];
		const node = svg.children.find(
			(c: any) => c.type === 'svg_text' && c.children.some((ch: any) => ch.type === 'svg_tspan')
		)!;
		expect(node).toBeDefined();
		const tspans = node.children.filter((c: any) => c.type === 'svg_tspan');
		expect(tspans.length).toBeGreaterThanOrEqual(2);
	});

	it('Tspan stores text, fontFamily, fill', () => {
		const doc = buildTextDoc();
		const svg = doc.children[0].children[0].children[0];
		const textNode = svg.children.find(
			(c: any) => c.type === 'svg_text' && c.children.some((ch: any) => ch.props.text === 'Bold')
		)!;
		expect(textNode).toBeDefined();
		const boldSpan = textNode.children.find((c: any) => c.props.text === 'Bold')!;
		expect(boldSpan).toBeDefined();
		expect(boldSpan.props.fontFamily).toBe('Helvetica-Bold');
		expect(boldSpan.props.fill).toBe('red');
	});

	it('Tspan stores dy offset', () => {
		const doc = buildTextDoc();
		const svg = doc.children[0].children[0].children[0];
		const textNode = svg.children.find(
			(c: any) => c.type === 'svg_text' && c.children.some((ch: any) => ch.props.text === 'Line two')
		)!;
		expect(textNode).toBeDefined();
		const span = textNode.children.find((c: any) => c.props.text === 'Line two')!;
		expect(span.props.dy).toBe(14);
	});

	it('SvgText does not appear in PDF tree outside svg parent', () => {
		const doc = buildTextDoc();
		const view = doc.children[0].children[0];
		expect(view.children).toHaveLength(1);
		expect(view.children[0].type).toBe('svg');
	});
});

// ── 14. SvgText end-to-end rendering ──────────────────────────────────────────

describe('SvgText – end-to-end rendering', () => {
	it('produces a valid PDF', async () => {
		const stream = await renderComponent(SvgTextTemplate);
		const buf = await streamToBuffer(stream);
		expect(buf.slice(0, 5).toString()).toBe('%PDF-');
		expect(buf.length).toBeGreaterThan(1000);
	});
});
