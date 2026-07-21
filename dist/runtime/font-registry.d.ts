/**
 * Font variant name resolution.
 *
 * PDFKit has no built-in font-family concept — every registered font needs a
 * unique string name. When a developer registers multiple variants of the same
 * family they use the same `name` prop but different `weight` / `style` values:
 *
 *   <Font name="Inter" src="Inter-Regular.ttf" />
 *   <Font name="Inter" src="Inter-Bold.ttf"    weight="bold" />
 *   <Font name="Inter" src="Inter-Italic.ttf"  style="italic" />
 *
 * We derive a deterministic internal PDFKit name for each variant:
 *
 *   normal            → "Inter"
 *   bold              → "Inter-Bold"
 *   italic            → "Inter-Italic"
 *   bold + italic     → "Inter-BoldItalic"
 *
 * This mirrors PDFKit's own built-in font naming convention (Helvetica-Bold,
 * Times-BoldItalic, etc.) so the approach feels consistent for developers who
 * mix built-in and custom fonts.
 *
 * Both the resource loader and the renderers call this function with the same
 * arguments to ensure the registered name and the looked-up name always match.
 */
export declare function resolveFont(family: string, weight?: string, style?: string): string;
/** Whether `variant` is one of the 14 standard PDF fonts (no buffer to embed). */
export declare function isBuiltinVariant(variant: string): boolean;
/** Records that a resolved font variant name has been registered with PDFKit. */
export declare function registerVariantName(name: string): void;
/** Clears the registered-variant set. Intended for tests needing a clean state. */
export declare function clearRegisteredVariants(): void;
/**
 * Normalises a `fontFamily` value into an ordered list of family names.
 * Accepts an array, a CSS-style comma-separated string, or undefined.
 * Surrounding quotes on individual names are stripped. Defaults to Helvetica.
 */
export declare function parseFontFamilies(value: string | string[] | undefined): string[];
/**
 * Whether `family` (at the given weight/style) resolves to a font that is
 * actually available — a registered custom variant or a PDFKit built-in. This
 * is the same availability test {@link resolveFontStack} applies; glyph-level
 * fallback uses it to build the candidate font list for a run.
 */
export declare function isFamilyAvailable(family: string, weight?: string, style?: string): boolean;
/**
 * Resolves a `fontFamily` (single or fallback list) plus weight/style to the
 * PDFKit variant name of the first available family. Falls back to the first
 * family's resolved name when none are available — the renderer's own try/catch
 * then drops to Helvetica.
 */
export declare function resolveFontStack(fontFamily: string | string[] | undefined, weight?: string, style?: string): string;
