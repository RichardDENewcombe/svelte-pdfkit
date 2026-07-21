<script lang="ts">
	import { getContext } from 'svelte';
	import type { PDFNode, StyleProps } from '../../types/pdf.js';
	import { warn } from '../../runtime/warn.js';

	// Canvas is an escape hatch that hands the raw PDFKit document directly
	// to user code, letting you draw anything PDFKit supports (paths, shapes,
	// gradients, bezier curves, etc.) at the exact position Yoga computes.
	//
	// Usage:
	//   <Canvas
	//     style={{ width: 200, height: 100 }}
	//     draw={(doc, x, y, width, height) => {
	//       doc.rect(x, y, width, height).fill('#eee');
	//       doc.moveTo(x, y).lineTo(x + width, y + height).stroke('red');
	//     }}
	//   />
	//
	// The `draw` function is called during the render phase (Pass 2), after
	// Yoga has computed the layout, so `x`, `y`, `width`, and `height` are
	// the final absolute page coordinates ready to draw at.
	//
	// Canvas is a leaf node — it has no children.

	const {
		style = {},
		draw
	}: {
		/** Layout dimensions for the canvas area. width and height are required
		 *  for Yoga to allocate space — without them the canvas has zero size. */
		style?: StyleProps;
		/** Called during rendering with the PDFKit doc and computed layout box.
		 *  @param doc    - The PDFKit document instance.
		 *  @param x      - Left edge of the canvas in absolute page coordinates.
		 *  @param y      - Top edge of the canvas in absolute page coordinates.
		 *  @param width  - Width of the canvas as computed by Yoga.
		 *  @param height - Height of the canvas as computed by Yoga.
		 */
		draw: (doc: any, x: number, y: number, width: number, height: number) => void;
	} = $props();

	const parent = getContext<PDFNode>('__pdf__');

	if (typeof draw !== 'function') {
		warn('<Canvas> requires a `draw` function prop — nothing will be drawn.');
	}

	// Canvas is a leaf — no children, no setContext.
	parent.children.push({ type: 'canvas', props: { style, draw }, children: [] });
</script>
