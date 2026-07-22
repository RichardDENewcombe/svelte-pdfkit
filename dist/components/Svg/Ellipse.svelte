<script lang="ts">
	import { getContext } from 'svelte';
	import type { PDFNode } from '../../types/pdf.js';

	const {
		cx,
		cy,
		rx,
		ry,
		fill,
		stroke,
		strokeWidth,
		opacity,
		strokeDasharray,
		strokeDashoffset,
		clipPath
	}: {
		cx: number;
		cy: number;
		rx: number;
		ry: number;
		fill?: string;
		stroke?: string;
		strokeWidth?: number;
		opacity?: number;
		strokeDasharray?: number | string;
		strokeDashoffset?: number;
		clipPath?: string;
	} = $props();

	const parent = getContext<PDFNode>('__svg__');
	parent.children.push({
		type: 'svg_ellipse',
		props: { cx, cy, rx, ry, fill, stroke, strokeWidth, opacity, strokeDasharray, strokeDashoffset, clipPath },
		children: []
	});
</script>
