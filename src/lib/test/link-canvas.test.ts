/**
 * Tests for the Link and Canvas components.
 *
 * Link  — wraps children, stores href, behaves like a flex container for layout.
 * Canvas — leaf node, stores the draw function, receives layout coords at render time.
 */

import { describe, it, expect, vi } from 'vitest';
import { render as svelteRender } from 'svelte/server';
import { createDocument } from '../runtime/document.js';
import { renderComponent } from '../runtime/render.js';
import LinkTemplate from './LinkTemplate.svelte';
import CanvasTemplate from './CanvasTemplate.svelte';

function streamToBuffer(stream: any): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (c: Buffer) => chunks.push(c));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
		stream.on('error', reject);
	});
}

// ── Link ───────────────────────────────────────────────────────────────────────

describe('Link component – node construction', () => {
	function renderLink(href: string) {
		const doc = createDocument();
		const { html: _ } = svelteRender(LinkTemplate, {
			props: { href },
			context: new Map([['__pdf__', doc], ['__pdf_root__', doc]])
		});
		return doc;
	}

	it('creates a link node with the correct type', () => {
		const doc = renderLink('https://example.com');
		// doc → page → view → link
		const link = doc.children[0].children[0].children[0];
		expect(link.type).toBe('link');
	});

	it('stores the href in props', () => {
		const doc = renderLink('https://svelte.dev');
		const link = doc.children[0].children[0].children[0];
		expect(link.props.href).toBe('https://svelte.dev');
	});

	it('child Text node nests inside the link node', () => {
		const doc = renderLink('https://example.com');
		const link = doc.children[0].children[0].children[0];
		expect(link.children).toHaveLength(1);
		expect(link.children[0].type).toBe('text');
		expect(link.children[0].props.text).toBe('Click here');
	});

	it('link node is not a sibling of its children', () => {
		const doc = renderLink('https://example.com');
		const view = doc.children[0].children[0];
		// The view should have exactly one child (the link), not two
		expect(view.children).toHaveLength(1);
	});
});

describe('Link component – end-to-end rendering', () => {
	it('produces a valid PDF containing a link', async () => {
		const stream = await renderComponent(LinkTemplate, { href: 'https://example.com' });
		const buffer = await streamToBuffer(stream);
		expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
		expect(buffer.length).toBeGreaterThan(1000);
	});

	it('link annotation appears in the PDF byte stream', async () => {
		const stream = await renderComponent(LinkTemplate, { href: 'https://example.com' });
		const buffer = await streamToBuffer(stream);
		// PDFKit encodes link annotations as /URI entries in the PDF
		expect(buffer.toString('latin1')).toContain('/URI');
	});
});

// ── Canvas ─────────────────────────────────────────────────────────────────────

describe('Canvas component – node construction', () => {
	function renderCanvas(onDraw: () => void) {
		const doc = createDocument();
		const { html: _ } = svelteRender(CanvasTemplate, {
			props: { onDraw },
			context: new Map([['__pdf__', doc], ['__pdf_root__', doc]])
		});
		return doc;
	}

	it('creates a canvas node with the correct type', () => {
		const doc = renderCanvas(vi.fn());
		// doc → page → view → canvas
		const canvas = doc.children[0].children[0].children[0];
		expect(canvas.type).toBe('canvas');
	});

	it('stores the draw function in props', () => {
		const fn = vi.fn();
		const doc = renderCanvas(fn);
		const canvas = doc.children[0].children[0].children[0];
		expect(canvas.props.draw).toBe(fn);
	});

	it('canvas is a leaf node — has no children', () => {
		const doc = renderCanvas(vi.fn());
		const canvas = doc.children[0].children[0].children[0];
		expect(canvas.children).toHaveLength(0);
	});

	it('canvas dimensions are stored in style props', () => {
		const doc = renderCanvas(vi.fn());
		const canvas = doc.children[0].children[0].children[0];
		expect(canvas.props.style.width).toBe(200);
		expect(canvas.props.style.height).toBe(100);
	});
});

describe('Canvas component – end-to-end rendering', () => {
	it('calls the draw function with the PDFKit doc and layout coordinates', async () => {
		const onDraw = vi.fn();
		await renderComponent(CanvasTemplate, { onDraw }).then(streamToBuffer);

		expect(onDraw).toHaveBeenCalledOnce();

		const [doc, x, y, width, height] = onDraw.mock.calls[0];
		// The draw function receives the live PDFKit document
		expect(typeof doc.text).toBe('function');
		// Layout coordinates should be numbers
		expect(typeof x).toBe('number');
		expect(typeof y).toBe('number');
		// Canvas has explicit dimensions of 200×100 in the template
		expect(width).toBe(200);
		expect(height).toBe(100);
	});

	it('produces a valid PDF when the draw function draws a rectangle', async () => {
		const onDraw = (doc: any, x: number, y: number, w: number, h: number) => {
			doc.rect(x, y, w, h).fill('#cccccc');
		};
		const stream = await renderComponent(CanvasTemplate, { onDraw });
		const buffer = await streamToBuffer(stream);
		expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
		expect(buffer.length).toBeGreaterThan(1000);
	});

	it('produces a valid PDF when the draw function is a no-op', async () => {
		const stream = await renderComponent(CanvasTemplate, { onDraw: () => {} });
		const buffer = await streamToBuffer(stream);
		expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
	});
});
