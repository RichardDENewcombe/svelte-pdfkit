import type { ResourceEntry } from '../types/pdf.js';
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
export declare function loadResources(resources: ResourceEntry[]): Promise<void>;
export declare function getFontBuffer(src: string): Buffer | undefined;
export declare function getImageBuffer(src: string): Buffer | undefined;
/**
 * Returns the current number of cached entries for each resource type.
 * Useful for verifying cache behaviour in tests.
 */
export declare function getCacheStats(): {
    fonts: number;
    images: number;
};
/**
 * Clears all cached font and image buffers.
 * Intended for use in tests that need a clean cache state.
 * In production, caches are intentionally long-lived (process lifetime).
 */
export declare function clearCaches(): void;
