<script lang="ts">
	import { getContext, setContext } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { PDFNode, StyleProps } from '../../types/pdf.js';

	const {
		style = {},
		children
	}: {
		/**
		 * Accepts all layout and visual style props.
		 *
		 * By default a Cell grows to fill its row equally (flexGrow: 1).
		 * Override with an explicit `width` to create fixed-width columns,
		 * or set `flexGrow` to a different value for proportional widths.
		 *
		 * @example Equal columns (default):
		 *   <Cell>…</Cell>  — all cells in a row share width equally
		 *
		 * @example Fixed width:
		 *   <Cell style={{ width: 120 }}>…</Cell>
		 *
		 * @example 2:1 ratio:
		 *   <Cell style={{ flexGrow: 2 }}>…</Cell>
		 *   <Cell style={{ flexGrow: 1 }}>…</Cell>
		 */
		style?: StyleProps;
		children?: Snippet;
	} = $props();

	const parent = getContext<PDFNode>('__pdf__');
	// Default: equal-width columns via flexGrow. Explicit width/flexGrow overrides.
	const node: PDFNode = {
		type: 'view',
		props: { style: { flexGrow: 1, flexBasis: 0, flexDirection: 'column', ...style } },
		children: []
	};
	parent.children.push(node);
	setContext('__pdf__', node);
</script>

{@render children?.()}
