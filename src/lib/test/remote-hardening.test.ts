/**
 * Tests for the hardening of remote (http/https) resource loading:
 *   • SSRF guard — private/loopback/link-local hosts blocked by default,
 *     with an allow-list escape hatch.
 *   • Timeout — a hanging/aborted fetch is skipped, not fatal.
 *   • Size cap — oversized responses are refused.
 *   • Bounded LRU caches — old entries evicted beyond `cacheMax`.
 *
 * DNS is mocked so hostname resolution is deterministic and offline.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock DNS before importing anything that transitively pulls in the guard.
vi.mock('node:dns/promises', () => ({
	lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
}));

import { lookup } from 'node:dns/promises';
import {
	loadResources,
	getFontBuffer,
	getImageBuffer,
	getCacheStats,
	clearCaches
} from '../runtime/resources.js';
import { configureRemoteResources } from '../runtime/remote-config.js';

const lookupMock = vi.mocked(lookup);

/** Fake fetch resolving with the given bytes + optional headers. */
function mockFetch(body: Buffer, { status = 200, contentLength }: { status?: number; contentLength?: number } = {}) {
	return vi.fn().mockResolvedValue({
		ok: status >= 200 && status < 300,
		status,
		headers: { get: (h: string) => (h.toLowerCase() === 'content-length' && contentLength != null ? String(contentLength) : null) },
		arrayBuffer: () => Promise.resolve(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength))
	});
}

beforeEach(() => {
	clearCaches();
	// Reset config to defaults each test.
	configureRemoteResources({
		timeoutMs: 10_000,
		maxBytes: 10 * 1024 * 1024,
		allowPrivateHosts: false,
		allowHost: undefined,
		cacheMax: 256
	});
	lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as any);
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('SSRF guard – IP-literal hosts (no DNS)', () => {
	const blocked = [
		'http://127.0.0.1/x.ttf',
		'http://169.254.169.254/latest/meta-data/', // cloud metadata
		'http://10.0.0.1/x.ttf',
		'http://192.168.1.5/x.ttf',
		'http://172.16.0.9/x.ttf',
		'http://[::1]/x.ttf'
	];

	for (const url of blocked) {
		it(`blocks ${url}`, async () => {
			const fetchMock = vi.fn();
			vi.stubGlobal('fetch', fetchMock);
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			await loadResources([{ type: 'font', name: 'Blocked', src: url }]);

			expect(fetchMock).not.toHaveBeenCalled();
			expect(lookupMock).not.toHaveBeenCalled(); // IP literal → no DNS
			expect(getFontBuffer(url)).toBeUndefined();
			expect(warnSpy).toHaveBeenCalled();
		});
	}

	it('allows a public IP literal', async () => {
		const url = 'http://93.184.216.34/x.ttf';
		vi.stubGlobal('fetch', mockFetch(Buffer.from([1, 2, 3, 4])));

		await loadResources([{ type: 'font', name: 'PublicIP', src: url }]);

		expect(getFontBuffer(url)).toBeInstanceOf(Buffer);
	});
});

describe('SSRF guard – hostname resolution', () => {
	it('blocks a public hostname that resolves to a private address', async () => {
		const url = 'https://sneaky.example.com/x.ttf';
		lookupMock.mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }] as any);
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await loadResources([{ type: 'image', src: url }]);

		expect(fetchMock).not.toHaveBeenCalled();
		expect(getImageBuffer(url)).toBeUndefined();
		expect(warnSpy).toHaveBeenCalled();
	});

	it('allows a hostname that resolves to a public address', async () => {
		const url = 'https://cdn.example.com/allowed.ttf';
		lookupMock.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }] as any);
		vi.stubGlobal('fetch', mockFetch(Buffer.from([9, 9, 9])));

		await loadResources([{ type: 'font', name: 'PublicHost', src: url }]);

		expect(getFontBuffer(url)).toBeInstanceOf(Buffer);
	});
});

describe('SSRF guard – escape hatches', () => {
	it('allowPrivateHosts=true permits a loopback host', async () => {
		configureRemoteResources({ allowPrivateHosts: true });
		const url = 'http://127.0.0.1/internal.ttf';
		vi.stubGlobal('fetch', mockFetch(Buffer.from([1])));

		await loadResources([{ type: 'font', name: 'Internal', src: url }]);

		expect(getFontBuffer(url)).toBeInstanceOf(Buffer);
	});

	it('allowHost permits a matching private host only', async () => {
		configureRemoteResources({ allowHost: (h) => h === 'fonts.internal' });
		lookupMock.mockResolvedValue([{ address: '10.1.2.3', family: 4 }] as any);
		vi.stubGlobal('fetch', mockFetch(Buffer.from([1])));

		const allowed = 'http://fonts.internal/a.ttf';
		const denied = 'http://other.internal/b.ttf';
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await loadResources([
			{ type: 'font', name: 'Allowed', src: allowed },
			{ type: 'font', name: 'Denied', src: denied }
		]);

		expect(getFontBuffer(allowed)).toBeInstanceOf(Buffer);
		expect(getFontBuffer(denied)).toBeUndefined();
		expect(warnSpy).toHaveBeenCalled();
	});
});

describe('remote fetch – timeout', () => {
	it('skips (and warns) when the fetch aborts, without rejecting loadResources', async () => {
		const url = 'https://slow.example.com/hang.ttf';
		// Simulate AbortSignal.timeout firing: fetch rejects with a TimeoutError.
		const fetchMock = vi.fn().mockRejectedValue(Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' }));
		vi.stubGlobal('fetch', fetchMock);
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await expect(loadResources([{ type: 'font', name: 'Slow', src: url }])).resolves.toBeUndefined();

		expect(getFontBuffer(url)).toBeUndefined();
		expect(warnSpy.mock.calls.some((c) => String(c[0]).includes('timed out'))).toBe(true);
	});

	it('passes an AbortSignal to fetch', async () => {
		const url = 'https://example.com/withsignal.ttf';
		const fetchMock = mockFetch(Buffer.from([1]));
		vi.stubGlobal('fetch', fetchMock);

		await loadResources([{ type: 'font', name: 'Sig', src: url }]);

		expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({ signal: expect.any(AbortSignal) }));
	});
});

describe('remote fetch – size cap', () => {
	it('refuses a response whose Content-Length exceeds maxBytes', async () => {
		configureRemoteResources({ maxBytes: 100 });
		const url = 'https://example.com/big-declared.png';
		const fetchMock = mockFetch(Buffer.alloc(10), { contentLength: 5000 });
		vi.stubGlobal('fetch', fetchMock);
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await loadResources([{ type: 'image', src: url }]);

		expect(getImageBuffer(url)).toBeUndefined();
		expect(warnSpy).toHaveBeenCalled();
	});

	it('refuses a response whose actual body exceeds maxBytes (lying/absent header)', async () => {
		configureRemoteResources({ maxBytes: 100 });
		const url = 'https://example.com/big-body.png';
		vi.stubGlobal('fetch', mockFetch(Buffer.alloc(500))); // no content-length
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await loadResources([{ type: 'image', src: url }]);

		expect(getImageBuffer(url)).toBeUndefined();
		expect(warnSpy).toHaveBeenCalled();
	});

	it('accepts a response within the limit', async () => {
		configureRemoteResources({ maxBytes: 1000 });
		const url = 'https://example.com/small.png';
		vi.stubGlobal('fetch', mockFetch(Buffer.alloc(200), { contentLength: 200 }));

		await loadResources([{ type: 'image', src: url }]);

		expect(getImageBuffer(url)).toBeInstanceOf(Buffer);
	});
});

describe('bounded LRU caches', () => {
	it('evicts least-recently-used entries beyond cacheMax across renders', async () => {
		configureRemoteResources({ cacheMax: 2 });
		vi.stubGlobal('fetch', mockFetch(Buffer.from([1])));

		// Render 1: load A then B → cache = [A, B].
		await loadResources([
			{ type: 'image', src: 'https://example.com/a.png' },
			{ type: 'image', src: 'https://example.com/b.png' }
		]);
		expect(getCacheStats().images).toBe(2);

		// Touch A so B becomes least-recently-used.
		expect(getImageBuffer('https://example.com/a.png')).toBeInstanceOf(Buffer);

		// Render 2: load C → over cap → evict LRU (B), keep A and C.
		await loadResources([{ type: 'image', src: 'https://example.com/c.png' }]);

		expect(getCacheStats().images).toBe(2);
		expect(getImageBuffer('https://example.com/a.png')).toBeInstanceOf(Buffer);
		expect(getImageBuffer('https://example.com/c.png')).toBeInstanceOf(Buffer);
		expect(getImageBuffer('https://example.com/b.png')).toBeUndefined();
	});

	it('never evicts entries in the current render even when it exceeds cacheMax', async () => {
		configureRemoteResources({ cacheMax: 2 });
		vi.stubGlobal('fetch', mockFetch(Buffer.from([1])));

		const srcs = ['x', 'y', 'z'].map((n) => `https://example.com/${n}.png`);
		await loadResources(srcs.map((src) => ({ type: 'image' as const, src })));

		// All three were part of one render's working set → all retained.
		expect(getCacheStats().images).toBe(3);
		for (const src of srcs) expect(getImageBuffer(src)).toBeInstanceOf(Buffer);
	});
});
