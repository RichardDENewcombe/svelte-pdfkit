<script lang="ts">
	import { getContext } from 'svelte';
	import type { PDFNode } from '../../types/pdf.js';

	const {
		x,
		y,
		dx,
		dy,
		text,
		fontSize,
		fontFamily,
		fill,
		opacity
	}: {
		x?: number;
		y?: number;
		dx?: number;
		dy?: number;
		text?: string;
		fontSize?: number;
		fontFamily?: string;
		fill?: string;
		opacity?: number;
	} = $props();

	const parent = getContext<PDFNode>('__svg__');
	parent.children.push({
		type: 'svg_tspan',
		props: { x, y, dx, dy, text, fontSize, fontFamily, fill, opacity },
		children: []
	});
</script>
