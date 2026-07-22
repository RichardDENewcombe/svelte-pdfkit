<script lang="ts">
	import { getContext } from 'svelte';
	import type { PDFNode } from '../../types/pdf.js';

	const {
		d,
		fill,
		stroke,
		strokeWidth,
		opacity,
		fillOpacity,
		strokeOpacity,
		strokeDasharray,
		strokeDashoffset,
		clipPath
	}: {
		d: string;
		fill?: string;
		stroke?: string;
		strokeWidth?: number;
		opacity?: number;
		fillOpacity?: number;
		strokeOpacity?: number;
		strokeDasharray?: number | string;
		strokeDashoffset?: number;
		clipPath?: string;
	} = $props();

	const parent = getContext<PDFNode>('__svg__');
	parent.children.push({
		type: 'svg_path',
		props: { d, fill, stroke, strokeWidth, opacity, fillOpacity, strokeOpacity, strokeDasharray, strokeDashoffset, clipPath },
		children: []
	});
</script>
