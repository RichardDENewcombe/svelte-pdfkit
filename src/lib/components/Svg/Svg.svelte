<script lang="ts">
	import { getContext, setContext } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { PDFNode, StyleProps } from '../../types/pdf.js';

	// width and height define the Yoga-allocated box.
	// style allows additional layout props (margin, position, etc.).
	const {
		width,
		height,
		style = {},
		children
	}: {
		width: number;
		height: number;
		style?: Omit<StyleProps, 'width' | 'height'>;
		children?: Snippet;
	} = $props();

	const parent = getContext<PDFNode>('__pdf__');

	// svg is a Yoga leaf — width/height go into style so applyStyle picks them up.
	// Its children are SVG elements stored in node.children, not Yoga nodes.
	const node: PDFNode = {
		type: 'svg',
		props: { style: { width, height, ...style } },
		children: []
	};
	parent.children.push(node);

	// SVG children use __svg__ context so they push into node.children
	// without ever touching the Yoga tree.
	setContext('__svg__', node);
</script>

{@render children?.()}
