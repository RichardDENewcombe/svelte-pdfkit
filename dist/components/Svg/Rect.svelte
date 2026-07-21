<script lang="ts">
	import { getContext } from 'svelte';
	import type { PDFNode } from '../../types/pdf.js';

	const {
		x = 0,
		y = 0,
		width,
		height,
		rx,
		ry,
		fill,
		stroke,
		strokeWidth,
		opacity,
		clipPath
	}: {
		x?: number;
		y?: number;
		width: number;
		height: number;
		rx?: number;
		ry?: number;
		fill?: string;
		stroke?: string;
		strokeWidth?: number;
		opacity?: number;
		clipPath?: string;
	} = $props();

	const parent = getContext<PDFNode>('__svg__');
	parent.children.push({
		type: 'svg_rect',
		props: { x, y, width, height, rx, ry, fill, stroke, strokeWidth, opacity, clipPath },
		children: []
	});
</script>
