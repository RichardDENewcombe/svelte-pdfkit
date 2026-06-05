/**
 * Tests for remote (HTTP) font loading.
 *
 * Fonts declared with an http/https `src` are fetched at render time, mirroring
 * remote image loading. These tests mock globalThis.fetch so no real network
 * requests are made, plus one end-to-end render that feeds real font bytes
 * through a mocked fetch to prove the full pipeline works.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import { loadResources, getFontBuffer } from '../runtime/resources.js';
import { renderComponent } from '../runtime/render.js';
import FontRenderTemplate from './FontRenderTemplate.svelte';

// A real single-weight TTF present on macOS — same font the other font tests use.
const TEST_FONT_PATH = '/System/Library/Fonts/Supplemental/Andale Mono.ttf';

/** Fake fetch that resolves with the given bytes and status. */
function mockFetch(body: Buffer, status = 200) {
	return vi.fn().mockResolvedValue({
		ok: status >= 200 && status < 300,
		status,
		arrayBuffer: () =>
			Promise.resolve(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength))
	});
}

function streamToBuffer(stream: any): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (c: Buffer) => chunks.push(c));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
		stream.on('error', reject);
	});
}

describe('loadResources – remote fonts', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('calls fetch() for http:// URLs', async () => {
		const url = 'http://example.com/font.ttf';
		const fetchMock = mockFetch(Buffer.from([1, 2, 3, 4]));
		vi.stubGlobal('fetch', fetchMock);

		await loadResources([{ type: 'font', name: 'RemoteA', src: url }]);

		expect(fetchMock).toHaveBeenCalledOnce();
		expect(fetchMock).toHaveBeenCalledWith(url);
	});

	it('calls fetch() for https:// URLs', async () => {
		const url = 'https://cdn.example.com/Inter.ttf';
		const fetchMock = mockFetch(Buffer.from([1, 2, 3, 4]));
		vi.stubGlobal('fetch', fetchMock);

		await loadResources([{ type: 'font', name: 'RemoteB', src: url }]);

		expect(fetchMock).toHaveBeenCalledOnce();
		expect(fetchMock).toHaveBeenCalledWith(url);
	});

	it('stores the fetched bytes in the font cache', async () => {
		const url = 'https://example.com/unique-font-cache-test.ttf';
		vi.stubGlobal('fetch', mockFetch(Buffer.from([0xde, 0xad, 0xbe, 0xef])));

		await loadResources([{ type: 'font', name: 'RemoteC', src: url }]);

		const cached = getFontBuffer(url);
		expect(cached).toBeInstanceOf(Buffer);
		expect(Array.from(cached!)).toEqual([0xde, 0xad, 0xbe, 0xef]);
	});

	it('does not fetch the same URL twice (cache hit)', async () => {
		// Reuse the URL from the previous test — it should already be cached.
		const url = 'https://example.com/unique-font-cache-test.ttf';
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		await loadResources([{ type: 'font', name: 'RemoteC', src: url }]);

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('warns and continues when fetch returns a non-2xx status', async () => {
		const url = 'https://example.com/missing-font.ttf';
		vi.stubGlobal('fetch', mockFetch(Buffer.alloc(0), 404));
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await expect(
			loadResources([{ type: 'font', name: 'RemoteMissing', src: url }])
		).resolves.toBeUndefined();

		expect(warnSpy).toHaveBeenCalledOnce();
		expect(warnSpy.mock.calls[0][0]).toContain('HTTP 404');
		// Nothing was cached for the failed fetch.
		expect(getFontBuffer(url)).toBeUndefined();
	});

	it('does not use fetch() for local file paths', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		await loadResources([{ type: 'font', name: 'Local', src: TEST_FONT_PATH }]);

		expect(fetchMock).not.toHaveBeenCalled();
		expect(getFontBuffer(TEST_FONT_PATH)).toBeInstanceOf(Buffer);
	});

	it('loads multiple remote fonts in parallel', async () => {
		const urls = [
			'https://example.com/parallel-font-a.ttf',
			'https://example.com/parallel-font-b.ttf',
			'https://example.com/parallel-font-c.ttf'
		];
		const fetchMock = mockFetch(Buffer.from([1]));
		vi.stubGlobal('fetch', fetchMock);

		await loadResources(
			urls.map((src, i) => ({ type: 'font' as const, name: `Parallel${i}`, src }))
		);

		expect(fetchMock).toHaveBeenCalledTimes(3);
		for (const url of urls) {
			expect(getFontBuffer(url)).toBeInstanceOf(Buffer);
		}
	});

	it('renders a valid PDF from a remote font (end-to-end)', async () => {
		// Feed real font bytes through the mocked fetch so PDFKit accepts them.
		const realFont = await fs.readFile(TEST_FONT_PATH);
		const url = 'https://example.com/remote-andale.ttf';
		vi.stubGlobal('fetch', mockFetch(realFont));

		const stream = await renderComponent(FontRenderTemplate, { fontPath: url });
		const buf = await streamToBuffer(stream);

		expect(buf.slice(0, 5).toString()).toBe('%PDF-');
		expect(buf.length).toBeGreaterThan(1000);
		expect(getFontBuffer(url)).toBeInstanceOf(Buffer);
	});
});
