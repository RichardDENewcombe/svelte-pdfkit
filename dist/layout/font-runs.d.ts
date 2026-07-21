/**
 * Splitting text into per-font runs for glyph-level fallback (Issue #1).
 *
 * Family-level fallback resolves one font for an entire text node. Glyph-level
 * fallback instead walks the same `fontFamily` stack per grapheme: each cluster
 * keeps the first available family that has glyphs for *all* its code points,
 * dropping to later families only for the code points earlier ones lack.
 *
 * Splitting is done on grapheme clusters (via Intl.Segmenter), never raw code
 * points, so combining accents, flag emoji and skin-tone sequences are never
 * divided across two fonts — which would break their rendering.
 */
/** A maximal stretch of text rendered in a single resolved PDFKit font. */
export interface FontRun {
    text: string;
    /** Resolved PDFKit variant name, e.g. "Inter-Bold". */
    font: string;
}
/**
 * Splits `text` into per-font runs by walking the `fontFamily` fallback stack
 * per grapheme.
 *
 * The returned runs always concatenate back to `text`. When the stack has only
 * one available family, or the primary covers every glyph, a single run is
 * returned — the common case, letting callers take their existing single-font
 * fast path.
 */
export declare function splitFontRuns(text: string, fontFamily: string | string[] | undefined, weight?: string, style?: string): FontRun[];
/**
 * Sum of `widthOfString` for each run measured under its own font. Mutates the
 * measure/render doc's current font as a side effect (callers re-apply font as
 * needed afterwards), mirroring how single-font measurement already works.
 */
export declare function widthOfRuns(doc: any, runs: FontRun[], opts?: Record<string, any>): number;
