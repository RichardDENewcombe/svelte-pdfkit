/**
 * Tests for image resource loading — local files and remote URLs.
 *
 * Remote URL tests mock globalThis.fetch so no real network requests are made.
 * Local file tests use a real file from disk (the same system font used by
 * other tests, since we only care about the loading path, not image validity
 * for the resource-loading unit tests).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The SSRF guard resolves hostnames via DNS; mock it so example.com is
// deterministically a public address and no real network lookup happens.
// A plain function (not a spy) so vi.restoreAllMocks() in afterEach can't wipe it.
vi.mock('node:dns/promises', () => ({
	lookup: async () => [{ address: '93.184.216.34', family: 4 }]
}));

import { loadResources, getImageBuffer } from '../runtime/resources.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** A minimal valid 1×1 PNG (white pixel, RGB). Used where PDFKit must accept the buffer. */
const MINIMAL_PNG = Buffer.from(
	'89504e470d0a1a0a' +        // PNG signature
	'0000000d49484452' +        // IHDR chunk length + type
	'00000001' +                // width = 1
	'00000001' +                // height = 1
	'0802000000' +              // bit depth 8, colour type 2 (RGB), compression, filter, interlace
	'9001 2e00' +               // IHDR CRC (placeholder — PDFKit doesn't validate CRC)
	'0000000c49444154' +        // IDAT chunk
	'08d763f8cfc00000' +
	'00020001e221bc33' +
	'000000004945 4e44' +       // IEND
	'ae426082',
	'hex'
);

/** Fake fetch that returns the given bytes with status 200. */
function mockFetch(body: Buffer, status = 200) {
	return vi.fn().mockResolvedValue({
		ok: status >= 200 && status < 300,
		status,
		arrayBuffer: () => Promise.resolve(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength))
	});
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('loadResources – remote images', () => {
	const REMOTE_URL = 'https://example.com/logo.png';

	beforeEach(() => {
		// Clear the module-level image cache between tests by forcing a fresh URL.
		// (The cache is a module singleton — we use unique URLs to avoid cross-test pollution.)
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('calls fetch() for http:// URLs', async () => {
		const url = 'http://example.com/image.png';
		const fakeBuffer = Buffer.from([1, 2, 3, 4]);
		const fetchMock = mockFetch(fakeBuffer);
		vi.stubGlobal('fetch', fetchMock);

		await loadResources([{ type: 'image', src: url }]);

		expect(fetchMock).toHaveBeenCalledOnce();
		expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({ signal: expect.any(AbortSignal) }));
	});

	it('calls fetch() for https:// URLs', async () => {
		const url = 'https://cdn.example.com/photo.jpg';
		const fakeBuffer = Buffer.from([10, 20, 30]);
		const fetchMock = mockFetch(fakeBuffer);
		vi.stubGlobal('fetch', fetchMock);

		await loadResources([{ type: 'image', src: url }]);

		expect(fetchMock).toHaveBeenCalledOnce();
		expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({ signal: expect.any(AbortSignal) }));
	});

	it('stores the fetched bytes in the image cache', async () => {
		const url = 'https://example.com/unique-cache-test.png';
		const fakeBuffer = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
		vi.stubGlobal('fetch', mockFetch(fakeBuffer));

		await loadResources([{ type: 'image', src: url }]);

		const cached = getImageBuffer(url);
		expect(cached).toBeInstanceOf(Buffer);
		expect(Array.from(cached!)).toEqual([0xde, 0xad, 0xbe, 0xef]);
	});

	it('does not fetch the same URL twice (cache hit)', async () => {
		// Use the URL from the previous test — it should already be cached.
		const url = 'https://example.com/unique-cache-test.png';
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		await loadResources([{ type: 'image', src: url }]);

		// Already cached — fetch should not have been called.
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('warns and continues when fetch returns a non-2xx status', async () => {
		const url = 'https://example.com/missing.png';
		vi.stubGlobal('fetch', mockFetch(Buffer.alloc(0), 404));
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		// Should not throw
		await expect(
			loadResources([{ type: 'image', src: url }])
		).resolves.toBeUndefined();

		expect(warnSpy).toHaveBeenCalledOnce();
		expect(warnSpy.mock.calls[0][0]).toContain('HTTP 404');
	});

	it('does not use fetch() for local file paths', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		// Use a path that starts with "/" — fs.readFile handles it.
		// We don't care if the read fails; we just want to confirm fetch is not called.
		try {
			await loadResources([{ type: 'image', src: '/nonexistent/local/image.png' }]);
		} catch {
			// expected — file doesn't exist
		}

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('loads multiple remote images in parallel', async () => {
		const urls = [
			'https://example.com/parallel-a.png',
			'https://example.com/parallel-b.png',
			'https://example.com/parallel-c.png'
		];
		const fakeBuffer = Buffer.from([1]);
		const fetchMock = mockFetch(fakeBuffer);
		vi.stubGlobal('fetch', fetchMock);

		await loadResources(urls.map((src) => ({ type: 'image' as const, src })));

		expect(fetchMock).toHaveBeenCalledTimes(3);
		for (const url of urls) {
			expect(getImageBuffer(url)).toBeInstanceOf(Buffer);
		}
	});
});
