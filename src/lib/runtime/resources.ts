import fs from 'node:fs/promises';
import type { ResourceEntry } from '../types/pdf.js';
import { registerFontOnMeasureDoc } from '../layout/text-measure.js';
import { resolveFont } from './font-registry.js';

// Per-process caches. These survive across render() calls intentionally —
// a font file or image that was loaded once doesn't need to be re-read from
// disk on the next request. The cache key is the src path.
const fontCache = new Map<string, Buffer>();
const imageCache = new Map<string, Buffer>();

/**
 * Loads all declared font and image resources in parallel.
 *
 * Called between Pass 1 (Svelte component execution) and Pass 2 (layout).
 * After this resolves:
 *   • Every font buffer is in fontCache and registered on the PDFKit measure
 *     document, so text measurement during layout uses correct font metrics.
 *   • Every image buffer is in imageCache, ready for the renderer to draw.
 */
export async function loadResources(resources: ResourceEntry[]): Promise<void> {
	await Promise.all(
		resources.map(async (entry) => {
			if (entry.type === 'font') {
				// Load the buffer if not already cached.
				if (!fontCache.has(entry.src)) {
					const buffer = await fs.readFile(entry.src);
					fontCache.set(entry.src, buffer);
				}

				// Register on the measure doc so layout gets correct font metrics.
				// We do this even if the buffer was already cached, because a new
				// Vite SSR context may have a fresh measure doc instance.
				// Use the derived variant name (e.g. "Inter-Bold") so that the
				// measure doc has the exact same font names the renderer will use.
				if (entry.name) {
					const pdfkitName = resolveFont(entry.name, entry.weight, entry.fontStyle);
					registerFontOnMeasureDoc(pdfkitName, fontCache.get(entry.src)!);
				}
			}

			if (entry.type === 'image' && !imageCache.has(entry.src)) {
				if (entry.src.startsWith('http://') || entry.src.startsWith('https://')) {
					const response = await fetch(entry.src);
					if (!response.ok) {
						console.warn(`svelte-pdf: failed to fetch image "${entry.src}": HTTP ${response.status}`);
						return;
					}
					const ab = await response.arrayBuffer();
					imageCache.set(entry.src, Buffer.from(ab));
				} else {
					const buffer = await fs.readFile(entry.src);
					imageCache.set(entry.src, buffer);
				}
			}
		})
	);
}

export function getFontBuffer(src: string): Buffer | undefined {
	return fontCache.get(src);
}

export function getImageBuffer(src: string): Buffer | undefined {
	return imageCache.get(src);
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
}
