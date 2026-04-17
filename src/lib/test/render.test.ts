import { describe, it, expect } from 'vitest';
import { renderComponent } from '../runtime/render.js';
import BasicPDF from './BasicPDF.svelte';

function streamToBuffer(stream: any): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (chunk: Buffer) => chunks.push(chunk));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
		stream.on('error', reject);
	});
}

describe('end-to-end PDF rendering', () => {
	it('produces a valid PDF from a basic template', async () => {
		const stream = await renderComponent(BasicPDF);
		const buffer = await streamToBuffer(stream);

		// All PDFs start with the %PDF- header
		expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
		expect(buffer.length).toBeGreaterThan(1000);
	});

	it('produces a non-empty stream', async () => {
		const stream = await renderComponent(BasicPDF);
		expect(stream).toBeTruthy();
		expect(typeof stream.pipe).toBe('function');
	});

	it('produces independent output across concurrent renders', async () => {
		// Simulate concurrent requests — both should complete without interference
		const [buf1, buf2] = await Promise.all([
			renderComponent(BasicPDF).then(streamToBuffer),
			renderComponent(BasicPDF).then(streamToBuffer)
		]);

		expect(buf1.slice(0, 5).toString()).toBe('%PDF-');
		expect(buf2.slice(0, 5).toString()).toBe('%PDF-');
	});
});
