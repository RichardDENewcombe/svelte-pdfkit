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
		clipPath?: string;
	} = $props();

	const parent = getContext<PDFNode>('__svg__');
	parent.children.push({
		type: 'svg_ellipse',
		props: { cx, cy, rx, ry, fill, stroke, strokeWidth, opacity, clipPath },
		children: []
	});
</script>
