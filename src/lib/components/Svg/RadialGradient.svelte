<script lang="ts">
	import { getContext, setContext } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { PDFNode } from '../../types/pdf.js';

	const {
		id,
		cx = 0,
		cy = 0,
		r = 0,
		fx,
		fy,
		gradientUnits = 'userSpaceOnUse',
		children
	}: {
		id: string;
		cx?: number;
		cy?: number;
		r?: number;
		fx?: number;
		fy?: number;
		gradientUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
		children?: Snippet;
	} = $props();

	const parent = getContext<PDFNode>('__svg__');
	const node: PDFNode = {
		type: 'svg_radial_gradient',
		props: { id, cx, cy, r, fx, fy, gradientUnits },
		children: []
	};
	parent.children.push(node);
	setContext('__svg__', node);
</script>

{@render children?.()}
