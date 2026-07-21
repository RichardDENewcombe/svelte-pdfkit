import type { DocumentContext } from '../types/pdf.js';
/** Clears the layout cache. Intended for use in tests. */
export declare function clearLayoutCache(): void;
/** Returns the current number of cached page layouts. */
export declare function getLayoutCacheSize(): number;
export declare function computeLayout(doc: DocumentContext): void;
