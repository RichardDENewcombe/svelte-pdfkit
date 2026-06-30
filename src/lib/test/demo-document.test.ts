/**
 * Smoke test for the showcase DemoDocument.
 *
 * DemoDocument exercises most library features together (tables, SVG,
 * gradients, page breaks, justified text, hyphenation, keep-with-next). This
 * test renders it end-to-end through the full pipeline and asserts the output
 * is a valid, multi-page PDF — catching regressions that unit tests on isolated
 * subsystems would miss.
 */

import { describe, it, expect } from 'vitest';
import { renderComponent } from '../runtime/render.js';
import DemoDocument from './DemoDocument.svelte';

function streamToBuffer(stream: any): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (c: Buffer) => chunks.push(c));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
		stream.on('error', reject);
	});
}

function pageCount(buffer: Buffer): number {
	return (buffer.toString('binary').match(/\/Type \/Page[^s]/g) || []).length;
}

describe('DemoDocument', () => {
	it('renders to a valid multi-page PDF including the hyphenation page', async () => {
		const stream = await renderComponent(DemoDocument);
		const buffer = await streamToBuffer(stream);

		// Valid PDF header and trailer.
		expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
		expect(buffer.toString('binary')).toContain('%%EOF');

		// The document declares nine feature pages; pagination splits the
		// explicit-page-breaks page into three, so the rendered total is higher.
		// Assert a generous lower bound so the test is robust to layout tweaks.
		expect(pageCount(buffer)).toBeGreaterThanOrEqual(9);
		// The glyph-fallback page fetches an ~8 MB remote CJK font (cached after
		// the first request); allow extra time, and rely on graceful degradation
		// to a built-in font if the network is unavailable.
	}, 60_000);
});
