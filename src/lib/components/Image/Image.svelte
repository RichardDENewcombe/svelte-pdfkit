<script lang="ts">
	import { getContext } from 'svelte';
	import type { PDFNode, DocumentContext, StyleProps } from '../../types/pdf.js';
	import { warn } from '../../runtime/warn.js';

	const {
		src,
		style = {},
		breakBefore = false,
		breakAfter = false
	}: {
		src: string;
		style?: StyleProps;
		breakBefore?: boolean;
		breakAfter?: boolean;
	} = $props();

	const parent = getContext<PDFNode>('__pdf__');
	const root = getContext<DocumentContext>('__pdf_root__');

	if (!src) warn('<Image> is missing a required `src` prop — no image will be rendered.');

	parent.children.push({ type: 'image', props: { src, style, breakBefore, breakAfter }, children: [] });
	root.resources.push({ type: 'image', src });
</script>
