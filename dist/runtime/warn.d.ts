/**
 * Central warning utility for svelte-pdf.
 *
 * All warnings are emitted via console.warn with a consistent prefix so they
 * are easy to grep and filter. Because this library runs entirely server-side,
 * warnings are always on — there is no DOM and no hot-path penalty.
 */
export declare function warn(message: string): void;
