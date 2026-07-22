<script lang="ts">
	import { getContext } from 'svelte';
	import type { PDFNode } from '../../types/pdf.js';

	const {
		points,
		fill,
		stroke,
		strokeWidth,
		opacity,
		strokeDasharray,
		strokeDashoffset,
		clipPath
	}: {
		points: string;
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
		type: 'svg_polyline',
		props: { points, fill, stroke, strokeWidth, opacity, strokeDasharray, strokeDashoffset, clipPath },
		children: []
	});
</script>
