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
	// A table is a column-direction flex container that spans full width by default.
	const node: PDFNode = {
		type: 'view',
		props: { style: { width: '100%', ...style, flexDirection: 'column' } },
		children: []
	};
	parent.children.push(node);
	setContext('__pdf__', node);
</script>

{@render children?.()}
