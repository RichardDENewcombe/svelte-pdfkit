<script lang="ts">
	import { getContext, setContext } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { PDFNode } from '../../types/pdf.js';

	const {
		x,
		y,
		text,
		fontSize,
		fontFamily,
		fontWeight,
		fill,
		opacity,
		textAnchor,
		dominantBaseline,
		children
	}: {
		x?: number;
		y?: number;
		text?: string;
		fontSize?: number;
		fontFamily?: string;
		fontWeight?: 'normal' | 'bold';
		fill?: string;
		opacity?: number;
		textAnchor?: 'start' | 'middle' | 'end';
		dominantBaseline?: string;
		children?: Snippet;
	} = $props();

	const parent = getContext<PDFNode>('__svg__');
	const node: PDFNode = {
		type: 'svg_text',
		props: { x, y, text, fontSize, fontFamily, fontWeight, fill, opacity, textAnchor, dominantBaseline },
		children: []
	};
	parent.children.push(node);
	setContext('__svg__', node);
</script>

{@render children?.()}
