<script lang="ts">
	import { getContext, setContext } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { PDFNode } from '../../types/pdf.js';

	// G is a grouping element. It has no geometry of its own.
	// Children inherit context from __svg__ so they push into this group's children.
	const {
		fill,
		stroke,
		strokeWidth,
		opacity,
		children
	}: {
		fill?: string;
		stroke?: string;
		strokeWidth?: number;
		opacity?: number;
		children?: Snippet;
	} = $props();

	const parent = getContext<PDFNode>('__svg__');
	const node: PDFNode = {
		type: 'svg_g',
		props: { fill, stroke, strokeWidth, opacity },
		children: []
	};
	parent.children.push(node);
	setContext('__svg__', node);
</script>

{@render children?.()}
