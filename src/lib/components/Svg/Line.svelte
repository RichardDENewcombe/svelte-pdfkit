<script lang="ts">
	import { getContext } from 'svelte';
	import type { PDFNode } from '../../types/pdf.js';

	const {
		x1,
		y1,
		x2,
		y2,
		stroke,
		strokeWidth,
		opacity,
		strokeDasharray,
		strokeDashoffset,
		clipPath
	}: {
		x1: number;
		y1: number;
		x2: number;
		y2: number;
		stroke?: string;
		strokeWidth?: number;
		opacity?: number;
		strokeDasharray?: number | string;
		strokeDashoffset?: number;
		clipPath?: string;
	} = $props();

	const parent = getContext<PDFNode>('__svg__');
	parent.children.push({
		type: 'svg_line',
		props: { x1, y1, x2, y2, stroke, strokeWidth, opacity, strokeDasharray, strokeDashoffset, clipPath },
		children: []
	});
</script>
