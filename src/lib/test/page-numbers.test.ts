/**
 * Tests for the page-number render prop on <Text>.
 *
 * Page numbers use a `render` prop — a function called at draw time with
 * { pageNumber, totalPages } — so the text can vary per page without a
 * second render pass.
 */

import { describe, it, expect } from 'vitest';
import { render as svelteRender } from 'svelte/server';
import { createDocument } from '../runtime/document.js';
import { renderComponent } from '../runtime/render.js';
import Text from '../components/Text/Text.svelte';
import PageNumberTemplate from './PageNumberTemplate.svelte';

function makeContext(doc: ReturnType<typeof createDocument>) {
	return new Map<string, unknown>([['__pdf__', doc], ['__pdf_root__', doc]]);
}

function streamToBuffer(stream: any): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (c: Buffer) => chunks.push(c));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
		stream.on('error', reject);
	});
}

// ── 1. AST — render prop is stored on the node ────────────────────────────────

describe('Text render prop – AST', () => {
	it('stores the render function on the node props', () => {
		const doc = createDocument();
		const renderFn = ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
			`${pageNumber} / ${totalPages}`;

		const { html: _ } = svelteRender(Text, {
			props: { render: renderFn },
			context: makeContext(doc)
		});

		expect(doc.children).toHaveLength(1);
		const node = doc.children[0];
		expect(node.type).toBe('text');
		expect(typeof node.props.render).toBe('function');
		// Static text should not be set
		expect(node.props.text).toBeUndefined();
	});

	it('render function returns the expected string when called', () => {
		const doc = createDocument();
		const renderFn = ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
			`Page ${pageNumber} of ${totalPages}`;

		const { html: _ } = svelteRender(Text, {
			props: { render: renderFn },
			context: makeContext(doc)
		});

		const fn = doc.children[0].props.render;
		expect(fn({ pageNumber: 1, totalPages: 3 })).toBe('Page 1 of 3');
		expect(fn({ pageNumber: 3, totalPages: 3 })).toBe('Page 3 of 3');
	});
});

// ── 2. End-to-end — produces a valid PDF with page numbers ───────────────────

describe('Page numbers – end-to-end', () => {
	it('renders a multi-page PDF with page-number footer', async () => {
		const stream = await renderComponent(PageNumberTemplate);
		const buffer = await streamToBuffer(stream);

		expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
		expect(buffer.length).toBeGreaterThan(1000);
	});

	it('PDF contains multiple pages when content overflows', async () => {
		const stream = await renderComponent(PageNumberTemplate);
		const buffer = await streamToBuffer(stream);

		expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
		// Count Page objects to confirm multi-page output
		const pageCount = (buffer.toString('binary').match(/\/Type \/Page[^s]/g) || []).length;
		expect(pageCount).toBeGreaterThan(1);
	});
});
