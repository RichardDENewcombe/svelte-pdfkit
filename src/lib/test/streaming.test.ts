/**
 * Milestone 34 — Streaming renderer
 *
 * Verifies that the PDF renderer:
 *  1. Can handle large documents (1,000+ pages) without error.
 *  2. Emits the PDF as multiple stream chunks rather than one giant buffer,
 *     confirming that PDFKit flushes incrementally per page.
 *  3. Keeps memory usage bounded — heap growth is proportional to document
 *     complexity, not to total page count.
 *  4. Returns a stream that is pipeable (has .pipe()) and ends cleanly.
 */

import { describe, it, expect } from 'vitest';
import { createDocument } from '../runtime/document.js';
import { createNode } from '../runtime/node.js';
import { computeLayout } from '../layout/layout.js';
import { paginate } from '../pagination/paginate.js';
import { renderPDF } from '../renderer/render.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function streamToBuffer(stream: any): Promise<{ buffer: Buffer; chunks: number }> {
	return new Promise((resolve, reject) => {
		const parts: Buffer[] = [];
		let chunks = 0;
		stream.on('data', (chunk: Buffer) => {
			parts.push(chunk);
			chunks++;
		});
		stream.on('end', () => resolve({ buffer: Buffer.concat(parts), chunks }));
		stream.on('error', reject);
	});
}

/**
 * Builds a document with `count` pages programmatically (no Svelte components).
 * Each page has a single text node so Yoga has real content to measure.
 */
function buildLargeDocument(count: number) {
	const doc = createDocument();
	for (let i = 0; i < count; i++) {
		const page = createNode('page', { size: 'A4' });
		const view = createNode('view', { style: { padding: 20 } });
		const text = createNode('text', {
			text: `Page ${i + 1} of ${count}`,
			style: { fontSize: 12 }
		});
		view.children.push(text);
		page.children.push(view);
		doc.children.push(page);
	}
	return doc;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('streaming renderer (milestone 34)', () => {
	it('renders a 1 000-page document without error', async () => {
		const PAGE_COUNT = 1_000;
		const doc = buildLargeDocument(PAGE_COUNT);
		computeLayout(doc);
		const pages = paginate(doc);

		expect(pages).toHaveLength(PAGE_COUNT);

		const stream = renderPDF(pages, [], {});
		const { buffer } = await streamToBuffer(stream);

		expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
		expect(buffer.length).toBeGreaterThan(50_000);
	}, 30_000);

	it('emits multiple data chunks — PDFKit flushes incrementally', async () => {
		// Use a modest page count so the test is fast, but enough to guarantee
		// that PDFKit's internal highWaterMark is exceeded and multiple chunks
		// are flushed.
		const doc = buildLargeDocument(200);
		computeLayout(doc);
		const pages = paginate(doc);

		const stream = renderPDF(pages, [], {});
		const { chunks } = await streamToBuffer(stream);

		// PDFKit writes a chunk per page (and additional cross-reference / trailer
		// chunks). Any value > 1 confirms incremental flushing is happening.
		expect(chunks).toBeGreaterThan(1);
	}, 15_000);

	it('output size scales linearly with page count', async () => {
		const small = buildLargeDocument(10);
		computeLayout(small);
		const { buffer: buf10 } = await streamToBuffer(renderPDF(paginate(small)));

		const large = buildLargeDocument(100);
		computeLayout(large);
		const { buffer: buf100 } = await streamToBuffer(renderPDF(paginate(large)));

		// The 100-page PDF should be meaningfully larger than the 10-page one —
		// at least 5× (allowing for fixed overhead like font tables).
		expect(buf100.length).toBeGreaterThan(buf10.length * 5);
	}, 15_000);

	it('stream is pipeable and ends cleanly', async () => {
		const doc = buildLargeDocument(5);
		computeLayout(doc);
		const stream = renderPDF(paginate(doc));

		expect(typeof stream.pipe).toBe('function');
		expect(typeof stream.on).toBe('function');

		const { buffer } = await streamToBuffer(stream);
		// PDF trailer ends with %%EOF
		const tail = buffer.slice(-10).toString();
		expect(tail).toContain('%%EOF');
	});

	it('heap growth is bounded when rendering a large document', async () => {
		// Force GC if the runtime exposes it (Node.js --expose-gc), otherwise
		// fall back to just measuring without GC.
		if (typeof global.gc === 'function') global.gc();

		const heapBefore = process.memoryUsage().heapUsed;

		const doc = buildLargeDocument(500);
		computeLayout(doc);
		const pages = paginate(doc);
		const stream = renderPDF(pages, [], {});
		await streamToBuffer(stream);

		if (typeof global.gc === 'function') global.gc();
		const heapAfter = process.memoryUsage().heapUsed;

		// Allow up to 150 MB of retained heap for a 500-page document.
		// In practice this should be well under 50 MB.
		const growthMB = (heapAfter - heapBefore) / 1024 / 1024;
		expect(growthMB).toBeLessThan(150);
	}, 30_000);
});
