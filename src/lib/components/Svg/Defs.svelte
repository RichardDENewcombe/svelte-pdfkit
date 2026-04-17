<script lang="ts">
	import { getContext, setContext } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { PDFNode } from '../../types/pdf.js';

	const { children }: { children?: Snippet } = $props();

	const parent = getContext<PDFNode>('__svg__');
	const node: PDFNode = {
		type: 'svg_defs',
		props: {},
		children: []
	};
	parent.children.push(node);
	setContext('__svg__', node);
</script>

{@render children?.()}
