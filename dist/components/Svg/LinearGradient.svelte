<script lang="ts">
	import { getContext, setContext } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { PDFNode } from '../../types/pdf.js';

	const {
		id,
		x1 = 0,
		y1 = 0,
		x2 = 1,
		y2 = 0,
		gradientUnits = 'userSpaceOnUse',
		children
	}: {
		id: string;
		x1?: number;
		y1?: number;
		x2?: number;
		y2?: number;
		gradientUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
		children?: Snippet;
	} = $props();

	const parent = getContext<PDFNode>('__svg__');
	const node: PDFNode = {
		type: 'svg_linear_gradient',
		props: { id, x1, y1, x2, y2, gradientUnits },
		children: []
	};
	parent.children.push(node);
	setContext('__svg__', node);
</script>

{@render children?.()}
