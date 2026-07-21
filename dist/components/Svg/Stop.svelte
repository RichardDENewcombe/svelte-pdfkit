<script lang="ts">
	import { getContext } from 'svelte';
	import type { PDFNode } from '../../types/pdf.js';

	const {
		offset = 0,
		stopColor = 'black',
		stopOpacity
	}: {
		offset?: number;
		stopColor?: string;
		stopOpacity?: number;
	} = $props();

	const parent = getContext<PDFNode>('__svg__');
	const node: PDFNode = {
		type: 'svg_stop',
		props: { offset, stopColor, stopOpacity },
		children: []
	};
	parent.children.push(node);
</script>
