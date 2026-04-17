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
