import { render as svelteRender } from 'svelte/server';
import type { Component } from 'svelte';
import { createDocument } from './document.js';
import { loadResources } from './resources.js';
import { computeLayout } from '../layout/layout.js';
import { paginate } from '../pagination/paginate.js';
import { renderPDF } from '../renderer/render.js';
import { assignBookmarkIds } from '../renderer/bookmarks.js';
import { assignAnchorIds, buildAnchorIndex } from '../renderer/anchors.js';
import { warn } from './warn.js';

/**
 * Renders a Svelte component as a PDF and returns a Node.js Readable stream.
 *
 * This is what the Vite plugin generates for .pdf.svelte templates.
 * It can also be called directly for testing or non-template use cases.
 */
export async function renderComponent(
	component: Component<any, any, any>,
	props: Record<string, any> = {}
): Promise<any> {
	const doc = createDocument();

	// render() from svelte/server is lazy — access .html to force execution
	const { html: _ } = svelteRender(component, {
		props,
		context: new Map([
			['__pdf__', doc],
			['__pdf_root__', doc]
		])
	});

	await loadResources(doc.resources);

	const pageCount = doc.children.filter((c) => c.type === 'page').length;
	if (pageCount === 0) {
		warn('The rendered component contains no <Page> elements — the output PDF will be empty. Wrap your content in at least one <Page>.');
	}

	// Stamp bookmark/anchor ids before pagination so nodes sliced across page
	// boundaries keep one identity for dedup during outline emission / lookup.
	assignBookmarkIds(doc);
	assignAnchorIds(doc);

	computeLayout(doc);
	const pages = paginate(doc);

	// pages[] now has every page, including conditional sections, so anchor
	// resolution can happen before any drawing starts — required for a Text
	// render prop on an earlier page (e.g. a Table of Contents) to look up a
	// later page's number.
	const anchorIndex = buildAnchorIndex(pages);
	const pageOf = (key: string) => anchorIndex.get(key)?.pageNumber;

	return renderPDF(pages, doc.resources, doc.metadata, pageOf);
}
