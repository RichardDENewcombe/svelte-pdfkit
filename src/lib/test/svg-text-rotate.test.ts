/**
 * Tests for SVG text rotation (the `rotate` prop on <SvgText>).
 *
 * Covered:
 *  1. AST — SvgText forwards `rotate` into its node props
 *  2. Renderer — a rotated svg_text calls doc.rotate(angle, { origin: [x, y] })
 *     about its anchor, inside the node's save/restore scope
 *  3. Renderer — an un-rotated svg_text does not call doc.rotate
 *  4. E2E — a template containing rotated text renders to a valid PDF
 */

import { describe, it, expect } from 'vitest';
import { render as svelteRender } from 'svelte/server';
import { createDocument } from '../runtime/document.js';
import { renderComponent } from '../runtime/render.js';
import { drawSvg } from '../renderer/draw-svg.js';
import type { PDFNode } from '../types/pdf.js';
import SvgTextTemplate from './SvgTextTemplate.svelte';

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
		layout: { x: 0, y: 0, width: 300, height: 120 }
	} as PDFNode;
}

// ── 1. AST construction ─────────────────────────────────────────────────────────

function buildDoc() {
	const doc = createDocument();
	// Accessing `.html` forces Svelte's lazy server render to execute the tree.
	const { html: _ } = svelteRender(SvgTextTemplate, {
		props: {},
		context: new Map([
			['__pdf__', doc],
			['__pdf_root__', doc]
		])
	});
	return doc;
}

describe('svg text rotate – AST construction', () => {
	it('SvgText forwards the rotate prop into its node props', () => {
		const doc = buildDoc();
		const svg = doc.children[0].children[0].children[0];
		const node = svg.children.find(
			(c: any) => c.type === 'svg_text' && c.props.text === 'Rotated'
		)!;
		expect(node).toBeDefined();
		expect(node.props.rotate).toBe(-90);
	});

	it('an un-rotated SvgText has undefined rotate', () => {
		const doc = buildDoc();
		const svg = doc.children[0].children[0].children[0];
		const node = svg.children.find(
			(c: any) => c.type === 'svg_text' && c.props.text === 'Hello, SVG!'
		)!;
		expect(node.props.rotate).toBeUndefined();
	});
});

// ── 2. Rotation rendering ────────────────────────────────────────────────────────

describe('svg text rotate – rendering', () => {
	it('rotates about the text anchor (x, y)', () => {
		const node = svgNode([
			{
				type: 'svg_text',
				props: { x: 40, y: 60, text: 'Hi', fontSize: 12, rotate: -90 },
				children: []
			} as PDFNode
		]);
		const doc = mockDoc();
		drawSvg(doc, node);
		const rotates = callsOf(doc, 'rotate');
		expect(rotates).toHaveLength(1);
		expect(rotates[0].args[0]).toBe(-90);
		expect(rotates[0].args[1]).toMatchObject({ origin: [40, 60] });
	});

	it('applies the rotation before drawing the text', () => {
		const node = svgNode([
			{
				type: 'svg_text',
				props: { x: 10, y: 20, text: 'Hi', fontSize: 12, rotate: 45 },
				children: []
			} as PDFNode
		]);
		const doc = mockDoc();
		drawSvg(doc, node);
		const seq = (doc.__calls as { method: string }[]).map((c) => c.method);
		const rotateIdx = seq.indexOf('rotate');
		const textIdx = seq.indexOf('text');
		expect(rotateIdx).toBeGreaterThanOrEqual(0);
		expect(textIdx).toBeGreaterThan(rotateIdx);
	});

	it('a text node without rotate does not call doc.rotate', () => {
		const node = svgNode([
			{
				type: 'svg_text',
				props: { x: 10, y: 20, text: 'Hi', fontSize: 12 },
				children: []
			} as PDFNode
		]);
		const doc = mockDoc();
		drawSvg(doc, node);
		expect(callsOf(doc, 'rotate')).toHaveLength(0);
	});

	it('rotate of 0 still applies (explicit angle)', () => {
		const node = svgNode([
			{
				type: 'svg_text',
				props: { x: 10, y: 20, text: 'Hi', fontSize: 12, rotate: 0 },
				children: []
			} as PDFNode
		]);
		const doc = mockDoc();
		drawSvg(doc, node);
		expect(callsOf(doc, 'rotate')).toHaveLength(1);
	});
});

// ── 3. End-to-end ────────────────────────────────────────────────────────────────

describe('svg text rotate – end-to-end rendering', () => {
	it('renders a template with rotated text to a valid PDF', async () => {
		const stream = await renderComponent(SvgTextTemplate);
		const buf = await streamToBuffer(stream);
		expect(buf.slice(0, 5).toString()).toBe('%PDF-');
		expect(buf.length).toBeGreaterThan(1000);
	});
});
