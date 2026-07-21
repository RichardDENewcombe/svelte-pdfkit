<script lang="ts">
	import { getContext, setContext } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { PDFNode, StyleProps } from '../../types/pdf.js';

	const {
		style = {},
		children
	}: {
		style?: Omit<StyleProps, 'flexDirection'>;
		children?: Snippet;
	} = $props();

	const parent = getContext<PDFNode>('__pdf__');
	// A row is a horizontal flex container. Children (Cells) share the row width.
	const node: PDFNode = {
		type: 'view',
		props: { style: { flexShrink: 0, ...style, flexDirection: 'row' } },
		children: []
	};
	parent.children.push(node);
	setContext('__pdf__', node);
</script>

{@render children?.()}
