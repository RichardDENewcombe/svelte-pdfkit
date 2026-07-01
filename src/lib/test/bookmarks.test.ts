/**
 * Tests for PDF bookmarks / document outline.
 *
 * Split into deterministic unit tests (assignBookmarkIds / emitBookmarks against
 * a mock outline — no PDF parsing) and end-to-end tests that render through the
 * full pipeline and assert the outline appears in the PDF byte stream.
 */

import { describe, it, expect } from 'vitest';
import { render as svelteRender } from 'svelte/server';
import type { PDFNode } from '../types/pdf.js';
import { assignBookmarkIds, emitBookmarks } from '../renderer/bookmarks.js';
import { createDocument } from '../runtime/document.js';
import { renderComponent } from '../runtime/render.js';
import BookmarksTemplate from './BookmarksTemplate.svelte';

function streamToBuffer(stream: any): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (c: Buffer) => chunks.push(c));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
		stream.on('error', reject);
	});
}

function node(props: Record<string, any>, children: PDFNode[] = []): PDFNode {
	return { type: 'view', props, children };
}

/**
 * A minimal stand-in for PDFKit's outline. Each addItem records the parent→child
 * title relationship and returns a child item that can itself receive children,
 * so we can assert the hierarchy without generating a real PDF.
 */
function mockOutline() {
	const edges: Array<{ parent: string; child: string }> = [];
	const make = (title: string): any => ({
		title,
		addItem(childTitle: string) {
			edges.push({ parent: title, child: childTitle });
			return make(childTitle);
		}
	});
	return { doc: { outline: make('__root__') }, edges };
}

// ── assignBookmarkIds ───────────────────────────────────────────────────────────

describe('assignBookmarkIds', () => {
	it('stamps sequential ids on bookmarked nodes in document order', () => {
		const root = node({}, [
			node({ bookmark: 'A' }, [node({ bookmark: 'B' })]),
			node({ bookmark: 'C' })
		]);
		assignBookmarkIds(root);
		expect(root.props.__bookmarkId).toBeUndefined();
		expect(root.children[0].props.__bookmarkId).toBe(0); // A
		expect(root.children[0].children[0].props.__bookmarkId).toBe(1); // B
		expect(root.children[1].props.__bookmarkId).toBe(2); // C
	});

	it('ignores empty and non-string bookmark values', () => {
		const root = node({}, [node({ bookmark: '' }), node({ bookmark: 5 as any })]);
		assignBookmarkIds(root);
		expect(root.children[0].props.__bookmarkId).toBeUndefined();
		expect(root.children[1].props.__bookmarkId).toBeUndefined();
	});
});

// ── emitBookmarks ───────────────────────────────────────────────────────────────

describe('emitBookmarks', () => {
	it('adds a top-level item for each bookmarked node', () => {
		const { doc, edges } = mockOutline();
		const nodes = [node({ bookmark: 'One', __bookmarkId: 0 }), node({ bookmark: 'Two', __bookmarkId: 1 })];
		emitBookmarks(doc, nodes, new Map());
		expect(edges).toEqual([
			{ parent: '__root__', child: 'One' },
			{ parent: '__root__', child: 'Two' }
		]);
	});

	it('nests a bookmarked child under its bookmarked ancestor', () => {
		const { doc, edges } = mockOutline();
		const nodes = [
			node({ bookmark: 'Parent', __bookmarkId: 0 }, [
				node({}, [node({ bookmark: 'Child', __bookmarkId: 1 })]) // unbookmarked node in between
			])
		];
		emitBookmarks(doc, nodes, new Map());
		expect(edges).toContainEqual({ parent: '__root__', child: 'Parent' });
		expect(edges).toContainEqual({ parent: 'Parent', child: 'Child' });
	});

	it('dedups the same bookmark id across pages (spanning node)', () => {
		const { doc, edges } = mockOutline();
		const itemById = new Map<number, any>();
		// Same logical node copied onto two pages shares __bookmarkId.
		const page1 = [node({ bookmark: 'Spanning', __bookmarkId: 7 })];
		const page2 = [node({ bookmark: 'Spanning', __bookmarkId: 7 })];
		emitBookmarks(doc, page1, itemById);
		emitBookmarks(doc, page2, itemById);
		expect(edges.filter((e) => e.child === 'Spanning')).toHaveLength(1);
	});

	it('still nests descendants that first appear on a later page under the remembered item', () => {
		const { doc, edges } = mockOutline();
		const itemById = new Map<number, any>();
		// Parent seen on page 1; a child of that same parent appears on page 2.
		emitBookmarks(doc, [node({ bookmark: 'Sec', __bookmarkId: 3 })], itemById);
		emitBookmarks(
			doc,
			[node({ bookmark: 'Sec', __bookmarkId: 3 }, [node({ bookmark: 'Sub', __bookmarkId: 4 })])],
			itemById
		);
		expect(edges.filter((e) => e.child === 'Sec')).toHaveLength(1);
		expect(edges).toContainEqual({ parent: 'Sec', child: 'Sub' });
	});
});

// ── AST construction ────────────────────────────────────────────────────────────

describe('bookmark prop on components', () => {
	it('stores the bookmark title on View, Text, Image, and Link nodes', () => {
		const doc = createDocument();
		// render() from svelte/server is lazy — destructure html to force execution.
		const { html: _ } = svelteRender(BookmarksTemplate, {
			props: {},
			context: new Map([
				['__pdf__', doc],
				['__pdf_root__', doc]
			])
		});
		const page = doc.children[0];
		const [section1, section2, link, image] = page.children;

		expect(section1.type).toBe('view');
		expect(section1.props.bookmark).toBe('Section 1');
		expect(section1.children[0].props.bookmark).toBe('Subsection 1.1');
		expect(section1.children[1].props.bookmark).toBe('Subsection 1.2');
		expect(section2.props.bookmark).toBe('Section 2');
		expect(link.type).toBe('link');
		expect(link.props.bookmark).toBe('Docs link');
		expect(image.type).toBe('image');
		expect(image.props.bookmark).toBe('Logo');
	});
});

// ── End-to-end ──────────────────────────────────────────────────────────────────

describe('bookmarks – end-to-end PDF', () => {
	it('emits a valid outline into the PDF byte stream', async () => {
		const stream = await renderComponent(BookmarksTemplate);
		const buffer = await streamToBuffer(stream);
		const text = buffer.toString('latin1');

		expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
		expect(text).toContain('/Outlines');
		expect(text).toContain('/PageMode /UseOutlines');

		for (const title of ['Section 1', 'Subsection 1.1', 'Subsection 1.2', 'Section 2', 'Spanning']) {
			expect(text).toContain(title);
		}
	});

	it('adds a bookmark that spans two pages exactly once', async () => {
		const stream = await renderComponent(BookmarksTemplate);
		const buffer = await streamToBuffer(stream);
		const text = buffer.toString('latin1');
		// The outline title is written as the PDF string `(Spanning)`; the drawn
		// body text is `(Spanning box)`, so an exact `(Spanning)` match isolates
		// the single outline item even though the node is sliced onto two pages.
		expect((text.match(/\(Spanning\)/g) || []).length).toBe(1);
	});
});
