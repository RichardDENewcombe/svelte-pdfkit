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
export function resolveFont(
	family: string,
	weight?: string,
	style?: string
): string {
	const bold = weight === 'bold';
	const italic = style === 'italic';

	if (bold && italic) return `${family}-BoldItalic`;
	if (bold) return `${family}-Bold`;
	if (italic) return `${family}-Italic`;
	return family;
}

// ── Font fallback chains ─────────────────────────────────────────────────────────
//
// `fontFamily` may be a single family or a fallback list (CSS-style comma string
// or an array). At measure/draw time we resolve to the first family that is
// actually available — a registered custom variant or a PDFKit built-in — so a
// missing custom font degrades gracefully to the next choice instead of
// silently falling back to Helvetica.
//
// This is the family-level resolution. Per-glyph substitution (keeping the
// primary font for the glyphs it has and dropping to a later family only for the
// code points it lacks — e.g. CJK in an otherwise-Latin run) is layered on top
// in layout/font-runs.ts, which uses the same family list as the fallback chain.

/** The 14 standard PDF fonts, always available in PDFKit without registration. */
const BUILTIN_FONTS = new Set([
	'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique',
	'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique',
	'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic',
	'Symbol', 'ZapfDingbats'
]);

/** Whether `variant` is one of the 14 standard PDF fonts (no buffer to embed). */
export function isBuiltinVariant(variant: string): boolean {
	return BUILTIN_FONTS.has(variant);
}

// Variant names (e.g. "Inter-Bold") that have been registered with PDFKit via a
// <Font> declaration. Populated by loadResources() and persists for the process
// lifetime, mirroring the font buffer cache.
const registeredVariants = new Set<string>();

/** Records that a resolved font variant name has been registered with PDFKit. */
export function registerVariantName(name: string): void {
	registeredVariants.add(name);
}

/** Clears the registered-variant set. Intended for tests needing a clean state. */
export function clearRegisteredVariants(): void {
	registeredVariants.clear();
}

/**
 * Normalises a `fontFamily` value into an ordered list of family names.
 * Accepts an array, a CSS-style comma-separated string, or undefined.
 * Surrounding quotes on individual names are stripped. Defaults to Helvetica.
 */
export function parseFontFamilies(value: string | string[] | undefined): string[] {
	const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
	const list = raw
		.map((f) => f.trim().replace(/^['"]|['"]$/g, '').trim())
		.filter(Boolean);
	return list.length ? list : ['Helvetica'];
}

/**
 * Whether `family` (at the given weight/style) resolves to a font that is
 * actually available — a registered custom variant or a PDFKit built-in. This
 * is the same availability test {@link resolveFontStack} applies; glyph-level
 * fallback uses it to build the candidate font list for a run.
 */
export function isFamilyAvailable(family: string, weight?: string, style?: string): boolean {
	const variant = resolveFont(family, weight, style);
	return registeredVariants.has(variant) || BUILTIN_FONTS.has(variant) || BUILTIN_FONTS.has(family);
}

/**
 * Resolves a `fontFamily` (single or fallback list) plus weight/style to the
 * PDFKit variant name of the first available family. Falls back to the first
 * family's resolved name when none are available — the renderer's own try/catch
 * then drops to Helvetica.
 */
export function resolveFontStack(
	fontFamily: string | string[] | undefined,
	weight?: string,
	style?: string
): string {
	const families = parseFontFamilies(fontFamily);
	for (const family of families) {
		if (isFamilyAvailable(family, weight, style)) {
			return resolveFont(family, weight, style);
		}
	}
	return resolveFont(families[0], weight, style);
}
