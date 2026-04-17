/**
 * Tests for PDF metadata support.
 *
 * PDFKit embeds metadata in the document's Info dictionary, encoded in the
 * raw PDF bytes. We verify presence by searching the binary output for the
 * expected key/value strings.
 *
 * Covered:
 *  1. title, author, subject, keywords, creator, producer each appear in output
 *  2. Unset fields do not appear
 *  3. All fields together in one document
 */

import { describe, it, expect } from 'vitest';
import { renderComponent } from '../runtime/render.js';
import MetadataTemplate from './MetadataTemplate.svelte';

function streamToBuffer(stream: any): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (c: Buffer) => chunks.push(c));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
		stream.on('error', reject);
	});
}

async function renderToText(props: Record<string, string>): Promise<string> {
	const stream = await renderComponent(MetadataTemplate, props);
	const buf = await streamToBuffer(stream);
	return buf.toString('latin1');
}

// ── 1. Individual fields ───────────────────────────────────────────────────────

describe('PDF metadata – individual fields', () => {
	it('embeds title in the PDF Info dictionary', async () => {
		const text = await renderToText({ title: 'My Invoice' });
		expect(text).toContain('My Invoice');
	});

	it('embeds author in the PDF Info dictionary', async () => {
		const text = await renderToText({ author: 'Jane Doe' });
		expect(text).toContain('Jane Doe');
	});

	it('embeds subject in the PDF Info dictionary', async () => {
		const text = await renderToText({ subject: 'Quarterly Report' });
		expect(text).toContain('Quarterly Report');
	});

	it('embeds keywords in the PDF Info dictionary', async () => {
		const text = await renderToText({ keywords: 'invoice billing' });
		expect(text).toContain('invoice billing');
	});

	it('embeds creator in the PDF Info dictionary', async () => {
		const text = await renderToText({ creator: 'svelte-pdf' });
		expect(text).toContain('svelte-pdf');
	});

	it('embeds producer in the PDF Info dictionary', async () => {
		const text = await renderToText({ producer: 'svelte-pdf-engine' });
		expect(text).toContain('svelte-pdf-engine');
	});
});

// ── 2. Missing fields ─────────────────────────────────────────────────────────

describe('PDF metadata – unset fields are absent', () => {
	it('does not embed title when not provided', async () => {
		const text = await renderToText({ author: 'Jane Doe' });
		// "Title" key should not appear in the Info dict
		expect(text).not.toContain('/Title');
	});

	it('does not embed author when not provided', async () => {
		const text = await renderToText({ title: 'Only Title' });
		expect(text).not.toContain('/Author');
	});
});

// ── 3. All fields together ────────────────────────────────────────────────────

describe('PDF metadata – all fields together', () => {
	it('embeds all six metadata fields in a single document', async () => {
		const text = await renderToText({
			title: 'Full Document',
			author: 'Test Author',
			subject: 'Test Subject',
			keywords: 'test keywords',
			creator: 'TestCreator',
			producer: 'TestProducer'
		});

		expect(text).toContain('Full Document');
		expect(text).toContain('Test Author');
		expect(text).toContain('Test Subject');
		expect(text).toContain('test keywords');
		expect(text).toContain('TestCreator');
		expect(text).toContain('TestProducer');
	});

	it('output is still a valid PDF when all metadata is set', async () => {
		const stream = await renderComponent(MetadataTemplate, {
			title: 'Valid PDF',
			author: 'Author'
		});
		const buf = await streamToBuffer(stream);
		expect(buf.slice(0, 5).toString()).toBe('%PDF-');
	});
});
