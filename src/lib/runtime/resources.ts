import fs from 'node:fs/promises';
import type { ResourceEntry } from '../types/pdf.js';
import { registerFontOnMeasureDoc } from '../layout/text-measure.js';
import { resolveFont, registerVariantName } from './font-registry.js';
import { registerFontCoverage, clearFontCoverage } from './glyph-coverage.js';
import { assertPublicUrl, getRemoteConfig } from './remote-config.js';
import { warn } from './warn.js';

// Per-process caches. These survive across render() calls intentionally —
// a font file or image that was loaded once doesn't need to be re-read from
// disk or re-fetched on the next request. The cache key is the src path.
//
// They are bounded LRUs: relying on a JS Map's insertion-order iteration, a
// read moves its key to the newest position (see `cacheGet`) and entries beyond
// `cacheMax` are evicted after each render (see `trimCache`). This keeps memory
// bounded when rendering many distinct remote URLs (e.g. per-user avatars).
const fontCache = new Map<string, Buffer>();
const imageCache = new Map<string, Buffer>();

/** LRU read: returns the value and marks the key most-recently-used. */
function cacheGet(cache: Map<string, Buffer>, key: string): Buffer | undefined {
	const value = cache.get(key);
	if (value !== undefined) {
		cache.delete(key);
		cache.set(key, value);
	}
	return value;
}

/**
 * Evicts least-recently-used entries until `cache.size <= cacheMax`, never
 * evicting a key in `keep` (the current render's working set). Called after a
 * render completes so a single render that declares more resources than the cap
 * is never starved mid-flight.
 */
function trimCache(cache: Map<string, Buffer>, keep: Set<string>): void {
	const max = getRemoteConfig().cacheMax;
	if (cache.size <= max) return;
	for (const key of [...cache.keys()]) {
		if (cache.size <= max) break;
		if (keep.has(key)) continue;
		cache.delete(key);
	}
}

/**
 * Loads all declared font and image resources in parallel.
 *
 * Called between Pass 1 (Svelte component execution) and Pass 2 (layout).
 * After this resolves:
 *   • Every font buffer is in fontCache and registered on the PDFKit measure
 *     document, so text measurement during layout uses correct font metrics.
 *   • Every image buffer is in imageCache, ready for the renderer to draw.
 *
 * Remote (http/https) sources are fetched with a timeout, a response-size cap,
 * and an SSRF guard (see `remote-config.ts`). A resource that fails any of these
 * is warned about and skipped — rendering continues without it.
 */
export async function loadResources(resources: ResourceEntry[]): Promise<void> {
	await Promise.all(
		resources.map(async (entry) => {
			if (entry.type === 'font') {
				// Load the buffer if not already cached. Fonts may be local files
				// or remote URLs (http/https), mirroring image loading.
				if (!fontCache.has(entry.src)) {
					if (isRemote(entry.src)) {
						const buffer = await fetchRemote(entry.src, 'font');
						if (!buffer) return;
						fontCache.set(entry.src, buffer);
					} else {
						fontCache.set(entry.src, await fs.readFile(entry.src));
					}
				}

				// Register on the measure doc so layout gets correct font metrics.
				// We do this even if the buffer was already cached, because a new
				// Vite SSR context may have a fresh measure doc instance.
				// Use the derived variant name (e.g. "Inter-Bold") so that the
				// measure doc has the exact same font names the renderer will use.
				if (entry.name) {
					const pdfkitName = resolveFont(entry.name, entry.weight, entry.fontStyle);
					const buffer = cacheGet(fontCache, entry.src)!;
					registerFontOnMeasureDoc(pdfkitName, buffer);
					// Record the variant as available so font-fallback resolution can
					// prefer it over later families in a fontFamily stack.
					registerVariantName(pdfkitName);
					// Parse the buffer for per-glyph coverage queries (glyph-level
					// fallback) so each code point can pick the right font in the stack.
					registerFontCoverage(pdfkitName, buffer);
				}
			}

			if (entry.type === 'image' && !imageCache.has(entry.src)) {
				if (entry.src.startsWith('data:')) {
					const decoded = decodeDataUri(entry.src);
					if (decoded) {
						imageCache.set(entry.src, decoded);
					} else {
						warn('malformed data URI image source');
					}
				} else if (isRemote(entry.src)) {
					const buffer = await fetchRemote(entry.src, 'image');
					if (buffer) imageCache.set(entry.src, buffer);
				} else {
					imageCache.set(entry.src, await fs.readFile(entry.src));
				}
			}
		})
	);

	// Bound the caches once the render's working set is fully loaded.
	const keep = new Set(resources.map((r) => r.src));
	trimCache(fontCache, keep);
	trimCache(imageCache, keep);
}

function isRemote(src: string): boolean {
	return src.startsWith('http://') || src.startsWith('https://');
}

/**
 * Fetches a remote font/image with the configured timeout, size cap, and SSRF
 * guard. Returns the bytes, or null (after a warning) if the fetch was blocked,
 * failed, timed out, or exceeded the size limit — the caller then skips it.
 */
async function fetchRemote(url: string, kind: 'font' | 'image'): Promise<Buffer | null> {
	const cfg = getRemoteConfig();

	try {
		await assertPublicUrl(url);
	} catch (err) {
		warn(`refusing to fetch ${kind} "${url}": ${(err as Error).message}`);
		return null;
	}

	let response: Response;
	try {
		response = await fetch(url, { signal: AbortSignal.timeout(cfg.timeoutMs) });
	} catch (err) {
		const reason = (err as Error).name === 'TimeoutError' ? `timed out after ${cfg.timeoutMs}ms` : (err as Error).message;
		warn(`failed to fetch ${kind} "${url}": ${reason}`);
		return null;
	}

	if (!response.ok) {
		warn(`failed to fetch ${kind} "${url}": HTTP ${response.status}`);
		return null;
	}

	// Reject early if the server declares an oversized body.
	const declared = Number(response.headers?.get?.('content-length'));
	if (Number.isFinite(declared) && declared > cfg.maxBytes) {
		warn(`refusing ${kind} "${url}": ${declared} bytes exceeds limit of ${cfg.maxBytes}`);
		return null;
	}

	const bytes = Buffer.from(await response.arrayBuffer());
	if (bytes.byteLength > cfg.maxBytes) {
		warn(`refusing ${kind} "${url}": ${bytes.byteLength} bytes exceeds limit of ${cfg.maxBytes}`);
		return null;
	}
	return bytes;
}

/**
 * Decodes a `data:` URI into a Buffer.
 *
 * Supports both base64 (`data:image/png;base64,…`) and textual payloads
 * (`data:image/svg+xml,<svg…>`, optionally percent-encoded). Returns null when
 * the URI has no comma separator (malformed).
 */
function decodeDataUri(uri: string): Buffer | null {
	const comma = uri.indexOf(',');
	if (comma === -1) return null;
	const meta = uri.slice('data:'.length, comma);
	const data = uri.slice(comma + 1);
	if (/;base64/i.test(meta)) {
		return Buffer.from(data, 'base64');
	}
	try {
		return Buffer.from(decodeURIComponent(data), 'utf-8');
	} catch {
		// Not percent-encoded — use the raw text.
		return Buffer.from(data, 'utf-8');
	}
}

export function getFontBuffer(src: string): Buffer | undefined {
	return cacheGet(fontCache, src);
}

export function getImageBuffer(src: string): Buffer | undefined {
	return cacheGet(imageCache, src);
}

/**
 * Returns the current number of cached entries for each resource type.
 * Useful for verifying cache behaviour in tests.
 */
export function getCacheStats(): { fonts: number; images: number } {
	return { fonts: fontCache.size, images: imageCache.size };
}

/**
 * Clears all cached font and image buffers.
 * Intended for use in tests that need a clean cache state.
 * In production, caches are intentionally long-lived (process lifetime).
 */
export function clearCaches(): void {
	fontCache.clear();
	imageCache.clear();
	clearFontCoverage();
}
