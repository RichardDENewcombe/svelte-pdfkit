<!--
	Font — declares a custom font for use in this document.

	Usage:
	  <Font name="Inter" src="/fonts/Inter-Regular.ttf" />
	  <Font name="Inter" src="/fonts/Inter-Bold.ttf" weight="bold" />

	This component is purely declarative — it creates no PDF node and renders
	nothing visible. Its only job is to push a font resource entry onto
	doc.resources during Pass 1 (Svelte component execution).

	During the async resource loading phase, loadResources() reads these entries,
	loads each font file into a Buffer, and registers it on the PDFKit measure
	document so that text measurement during layout uses correct font metrics.

	During rendering, renderPDF() re-registers each loaded font on the PDFKit
	render document so doc.font('Inter') works when drawing text.

	Variants:
	  Register the same `name` with different `weight` / `style` values to
	  support bold and italic. PDFKit merges these into a font family:

	    <Font name="Inter" src="Inter-Regular.ttf" />
	    <Font name="Inter" src="Inter-Bold.ttf" weight="bold" />

	  Then in Text:
	    <Text text="Hello" style={{ fontFamily: 'Inter', fontWeight: 'bold' }} />
-->
<script lang="ts">
	import { getContext } from 'svelte';
	import type { DocumentContext } from '../../types/pdf.js';
	import { warn } from '../../runtime/warn.js';

	const {
		name,
		src,
		weight = 'normal',
		style: fontStyle = 'normal'
	}: {
		/** The font family name used in style={{ fontFamily: '...' }}. */
		name: string;
		/** Absolute or relative path to the font file (.ttf, .otf, .woff). */
		src: string;
		/** Font weight variant: 'normal' | 'bold'. Default: 'normal'. */
		weight?: string;
		/** Font style variant: 'normal' | 'italic'. Default: 'normal'. */
		style?: string;
	} = $props();

	// Font is a resource declaration, not a visible element — no PDF node needed.
	// We only push to doc.resources so the async loader knows what to fetch.
	const root = getContext<DocumentContext>('__pdf_root__');

	if (!name) warn('<Font> is missing a required `name` prop — font will not be registered.');
	if (!src)  warn(`<Font name="${name}"> is missing a required \`src\` prop — font will not be loaded.`);

	root.resources.push({ type: 'font', name, src, weight, fontStyle });
</script>
