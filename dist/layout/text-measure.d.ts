export declare function getMeasureDoc(): any;
/**
 * Registers a loaded font buffer on the measure document.
 *
 * Must be called for every custom font after loadResources() fetches the
 * buffer — before computeLayout() runs — so that widthOfString() and
 * currentLineHeight() use the correct metrics for that typeface.
 *
 * PDFKit throws if you register the same name+variant twice, so we swallow
 * that specific error silently.
 */
export declare function registerFontOnMeasureDoc(name: string, buffer: Buffer): void;
/**
 * Returns the effective line height for a text style — the natural PDFKit
 * line height multiplied by the `lineHeight` style prop if set. Pass `text`
 * so multi-font lines are sized by their tallest font.
 */
export declare function getLineHeight(style: Record<string, any>, text?: string): number;
/**
 * Slack added to a layout-derived wrap width before comparing it against
 * double-precision text measurement.
 *
 * Yoga stores computed values as 32-bit floats, so a text node's computed width
 * is `Math.fround(naturalWidth)` — which for many strings rounds *down*, leaving
 * the box a sub-ulp narrower than the text measured to fit it. Re-measuring in
 * double precision at wrap/draw time then reports an overflow and breaks a line
 * that should not break. This tolerance (far below any glyph advance, comfortably
 * above a float32 ulp for page-sized widths) absorbs that rounding so wrapping at
 * draw time matches the wrapping the layout pass computed.
 */
export declare const WRAP_TOLERANCE = 0.01;
/** A single wrapped line plus the metadata justification needs. */
export interface WrappedLine {
    text: string;
    /**
     * True when this line is the final line of its source paragraph — i.e. a
     * hard newline follows it, or it is the end of the text. Justified text must
     * NOT stretch these lines: the last line of a paragraph always renders at its
     * natural width.
     */
    lastInParagraph: boolean;
}
/**
 * Word-wraps `text` to fit within `maxWidth` points using PDFKit font metrics,
 * returning each line together with whether it ends its source paragraph.
 *
 * Splits on explicit newlines first, then applies greedy word-wrap within each
 * paragraph. When `style.hyphenation` is enabled, words that overflow are broken
 * at dictionary hyphenation points with a trailing `-`; otherwise an overlong
 * word is placed on its own line without mid-word breaking.
 *
 * The doc must already have the correct font and size set before calling this,
 * but that is guaranteed because `getLineHeight` is always called first in the
 * split path and sets the font state.
 *
 * Returns an array of {@link WrappedLine}. An empty `text` returns `[]`.
 */
export declare function wrapLinesMeta(text: string, style: Record<string, any>, maxWidth: number): WrappedLine[];
/**
 * Word-wraps `text` into plain line strings — a thin wrapper over
 * {@link wrapLinesMeta} for callers that don't need paragraph metadata.
 */
export declare function wrapLines(text: string, style: Record<string, any>, maxWidth: number): string[];
export declare function measureText(text: string, style: Record<string, any>, constrainedWidth?: number): {
    width: number;
    height: number;
};
