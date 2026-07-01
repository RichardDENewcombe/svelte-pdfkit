<script lang="ts">
	import { getContext } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { PDFNode, StyleProps, PageNumberRenderer } from '../../types/pdf.js';
	import { warn } from '../../runtime/warn.js';

	const {
		text: textProp,
		style = {},
		children,
		render: renderFn,
		breakBefore = false,
		breakAfter = false,
		keepWithNext = false,
		bookmark
	}: {
		/** Explicit text string. Use either this, children, or render — not multiple. */
		text?: string;
		style?: StyleProps;
		children?: Snippet;
		/**
		 * Dynamic render prop for page-number text.
		 *
		 * Called at draw time with the current page context. Use this for
		 * headers/footers that must show page numbers or total page counts:
		 *
		 * @example
		 *   <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
		 */
		render?: PageNumberRenderer;
		breakBefore?: boolean;
		breakAfter?: boolean;
		/** Keep this text on the same page as the start of its next sibling. */
		keepWithNext?: boolean;
		/** Adds a navigable document-outline entry (bookmark) pointing to this text's page. */
		bookmark?: string;
	} = $props();

	const parent = getContext<PDFNode>('__pdf__');

	const contentSources = [textProp != null, !!children, !!renderFn].filter(Boolean).length;
	if (contentSources > 1) {
		warn('<Text> received multiple content sources (text, children, render). Only one should be used — the render prop takes priority, then text, then children.');
	}

	if (renderFn) {
		// Render-prop text: no static text at build time.
		// The actual string is produced at draw time by drawText().
		// Yoga measures with placeholder values (0, 0) to estimate space.
		parent.children.push({ type: 'text', props: { render: renderFn, style, breakBefore, breakAfter, keepWithNext, bookmark }, children: [] });
	} else {
		let resolvedText = textProp != null ? String(textProp) : '';

		if (!textProp && children) {
			// In Svelte 5 SSR, snippets compile to ($$renderer) => void functions.
			// The renderer accumulates output via push(). We create a minimal fake
			// renderer to capture the text without writing to the real SSR output.
			const fakeRenderer = {
				_out: '',
				push(str: string) { this._out += str; },
				component(fn: Function) { fn(this); }
			};
			try {
				(children as any)(fakeRenderer);
			} catch {
				// ignore — renderer shape may vary across Svelte versions
			}
			resolvedText = fakeRenderer._out
				.replace(/<!--[\s\S]*?-->/g, '') // strip Svelte anchor comments
				.replace(/<[^>]+>/g, '')         // strip any HTML tags
				.trim();
		}

		parent.children.push({ type: 'text', props: { text: resolvedText, style, breakBefore, breakAfter, keepWithNext, bookmark }, children: [] });
	}
</script>
