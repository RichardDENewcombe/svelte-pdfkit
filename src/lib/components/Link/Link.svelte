<script lang="ts">
	import { getContext, setContext } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { PDFNode, StyleProps } from '../../types/pdf.js';
	import { warn } from '../../runtime/warn.js';

	// Link wraps other components (typically Text or View) and makes the
	// bounding box of its children clickable in the PDF.
	//
	// PDFKit renders hyperlinks by calling doc.link(x, y, width, height, url).
	// The renderer fires this call using the layout box computed by Yoga, so
	// the clickable area automatically matches whatever the children render to.
	//
	// Usage:
	//   <Link href="https://example.com">
	//     <Text text="Click here" style={{ color: 'blue' }} />
	//   </Link>
	//
	// Link behaves exactly like View for layout purposes — it is a flex
	// container that its children lay out inside. The href is stored in props
	// and picked up by the renderer after layout.

	const {
		href,
		style = {},
		children
	}: {
		/** The URL the link points to. */
		href: string;
		/** Optional layout/style props — same as View. */
		style?: StyleProps;
		children?: Snippet;
	} = $props();

	const parent = getContext<PDFNode>('__pdf__');

	if (!href) warn('<Link> is missing a required `href` prop — the link will not be clickable.');

	const node: PDFNode = { type: 'link', props: { href, style }, children: [] };
	parent.children.push(node);

	// Set context so child components (Text, View, Image) append themselves
	// inside this link's bounding box rather than to the parent.
	setContext('__pdf__', node);
</script>

{@render children?.()}
