<script lang="ts">
	import { getContext } from 'svelte';
	import type { PDFNode, DocumentContext, StyleProps } from '../../types/pdf.js';
	import { warn } from '../../runtime/warn.js';

	const {
		src,
		style = {},
		breakBefore = false,
		breakAfter = false,
		keepWithNext = false,
		bookmark,
		anchor
	}: {
		src: string;
		style?: StyleProps;
		breakBefore?: boolean;
		breakAfter?: boolean;
		/** Keep this image on the same page as the start of its next sibling. */
		keepWithNext?: boolean;
		/** Adds a navigable document-outline entry (bookmark) pointing to this image's page. */
		bookmark?: string;
		/** Registers this node's resolved page number under `key`, retrievable via `pageOf(key)` in a Text `render` prop. */
		anchor?: string;
	} = $props();

	const parent = getContext<PDFNode>('__pdf__');
	const root = getContext<DocumentContext>('__pdf_root__');

	if (!src) warn('<Image> is missing a required `src` prop — no image will be rendered.');

	parent.children.push({ type: 'image', props: { src, style, breakBefore, breakAfter, keepWithNext, bookmark, anchor }, children: [] });
	root.resources.push({ type: 'image', src });
</script>
