/**
 * Glyph-coverage queries for per-character font fallback (Issue #1).
 *
 * Family-level fallback (font-registry.ts) picks one font for a whole run.
 * Glyph-level fallback needs to know, per code point, whether a given font
 * actually has a glyph for it — a query PDFKit does not expose. We answer it
 * with fontkit, parsing the same font buffers we cache for rendering.
 *
 * fontkit is pinned to the exact version PDFKit embeds with (1.9.0) so our
 * coverage view always agrees with what PDFKit ultimately embeds. fontkit ships
 * as CommonJS with no bundled types, so — like pdfkit elsewhere in this package
 * — we load it via createRequire and treat it as `any`.
 */
/**
 * Parses a font buffer with fontkit and records it under its PDFKit variant
 * name so {@link fontCovers} can answer glyph-coverage queries for it.
 *
 * Safe to call repeatedly for the same variant (e.g. across SSR contexts); a
 * buffer that fails to parse is skipped — such a font simply reports no coverage
 * and callers fall through to the next family in the stack.
 */
export declare function registerFontCoverage(variant: string, buffer: Buffer): void;
/**
 * Returns whether the font registered under `variant` has a glyph for
 * `codePoint`.
 *
 * • Registered custom variant → fontkit `hasGlyphForCodePoint`.
 * • Built-in PDF font (Helvetica/Times/Courier/Symbol/ZapfDingbats) → no buffer
 *   to parse; approximated by {@link builtinCovers} (WinAnsi/Latin-1).
 * • Anything else → false, so the caller tries the next fallback family.
 */
export declare function fontCovers(variant: string, codePoint: number): boolean;
/** Clears all parsed coverage fonts and memoised answers. For tests. */
export declare function clearFontCoverage(): void;
