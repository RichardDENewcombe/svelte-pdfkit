<script lang="ts">
	import { getContext } from 'svelte';
	import type { PDFNode } from '../../types/pdf.js';

	const {
		cx,
		cy,
		r,
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
		r: number;
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
		type: 'svg_circle',
		props: { cx, cy, r, fill, stroke, strokeWidth, opacity, strokeDasharray, strokeDashoffset, clipPath },
		children: []
	});
</script>
