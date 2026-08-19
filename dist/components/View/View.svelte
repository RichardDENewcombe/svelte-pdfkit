<script lang="ts">
	import { getContext, setContext } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { PDFNode, StyleProps } from '../../types/pdf.js';
	import { warn } from '../../runtime/warn.js';

	const {
		style = {},
		wrap = true,
		fixed = false,
		breakBefore = false,
		breakAfter = false,
		keepWithNext = false,
		bookmark,
		anchor,
		children
	}: {
		style?: StyleProps;
		/**
		 * Controls whether this view may be split across a page boundary.
		 *  - `true` (default): the view may be split normally.
		 *  - `false`: never split — moves whole to the next page if it doesn't fit.
		 *  - a fraction `0`–`1`: also moves the view whole to the next page if its
		 *    top falls in (or it extends into) the bottom `fraction` of the page —
		 *    even if it would otherwise have fit without being cut.
		 */
		wrap?: boolean | number;
		fixed?: boolean;
		breakBefore?: boolean;
		breakAfter?: boolean;
		/** Keep this view on the same page as the start of its next sibling. */
		keepWithNext?: boolean;
		/** Adds a navigable document-outline entry (bookmark) pointing to this view's page. */
		bookmark?: string;
		/** Registers this node's resolved page number under `key`, retrievable via `pageOf(key)` in a Text `render` prop. */
		anchor?: string;
		children?: Snippet;
	} = $props();

	if (typeof wrap === 'number' && (wrap < 0 || wrap > 1)) {
		warn(
			`<View wrap={${wrap}}> is out of range — expected a boolean or a fraction between 0 and 1. Clamping to ${Math.min(1, Math.max(0, wrap))}.`
		);
	}

	const parent = getContext<PDFNode>('__pdf__');
	const node: PDFNode = { type: 'view', props: { style, wrap, fixed, breakBefore, breakAfter, keepWithNext, bookmark, anchor }, children: [] };
	parent.children.push(node);
	setContext('__pdf__', node);
</script>

{@render children?.()}
