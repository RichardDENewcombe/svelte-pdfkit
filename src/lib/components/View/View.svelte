<script lang="ts">
	import { getContext, setContext } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { PDFNode, StyleProps } from '../../types/pdf.js';

	const {
		style = {},
		wrap = true,
		fixed = false,
		children
	}: {
		style?: StyleProps;
		wrap?: boolean;
		fixed?: boolean;
		children?: Snippet;
	} = $props();

	const parent = getContext<PDFNode>('__pdf__');
	const node: PDFNode = { type: 'view', props: { style, wrap, fixed }, children: [] };
	parent.children.push(node);
	setContext('__pdf__', node);
</script>

{@render children?.()}
