/**
 * Context propagation test
 *
 * This test determines whether Svelte 5's setContext() in a child component
 * correctly affects the context seen by components rendered via
 * {@render children?.()}.
 *
 * If this test passes:
 *   - The getContext/setContext approach is valid for building the PDF AST.
 *   - Each component can safely set itself as the parent for its children.
 *
 * If this test fails:
 *   - Snippets inherit the context of where they were DEFINED, not where
 *     they are RENDERED.
 *   - We must switch to AsyncLocalStorage for the rendering context instead.
 */

import { render } from 'svelte/server';
import { describe, it, expect } from 'vitest';
import { createDocument } from '../runtime/document.js';
import ShallowTemplate from './ShallowTemplate.svelte';
import DeepTemplate from './DeepTemplate.svelte';

function makeContext(doc: ReturnType<typeof createDocument>) {
	return new Map<string, unknown>([
		['__pdf__', doc],
		['__pdf_root__', doc]
	]);
}

describe('Svelte 5 context propagation through snippets', () => {
	it('builds a correctly nested tree (one level)', () => {
		const doc = createDocument();

		// render() is lazy — must access .html to trigger component execution
		const { html: _ } = render(ShallowTemplate, {
			props: {},
			context: makeContext(doc)
		});

		/**
		 * PASS: context propagates through snippets correctly.
		 *
		 *   doc
		 *   ├─ view
		 *   │  └─ text "inside view"
		 *   └─ text "outside view"
		 *
		 * FAIL: context does NOT propagate — all nodes land at root level.
		 *
		 *   doc
		 *   ├─ view          ← correct
		 *   ├─ text "inside view"   ← wrong: should be inside view
		 *   └─ text "outside view"
		 */
		expect(doc.children).toHaveLength(2);

		const view = doc.children[0];
		expect(view.type).toBe('view');
		expect(view.props.style.flexDirection).toBe('row');
		expect(view.children).toHaveLength(1);
		expect(view.children[0].type).toBe('text');
		expect(view.children[0].props.text).toBe('inside view');

		const outsideText = doc.children[1];
		expect(outsideText.type).toBe('text');
		expect(outsideText.props.text).toBe('outside view');
	});

	it('builds a correctly nested tree (three levels deep)', () => {
		const doc = createDocument();

		const { html: _ } = render(DeepTemplate, {
			props: {},
			context: makeContext(doc)
		});

		/**
		 * PASS: context propagates transitively at every level.
		 *
		 *   doc
		 *   └─ view (outer, column)
		 *      └─ page (style: row)
		 *         └─ text "deep text"
		 *
		 * FAIL: nodes are flattened — either at root or at a single level.
		 */
		expect(doc.children).toHaveLength(1);

		const outerView = doc.children[0];
		expect(outerView.type).toBe('view');
		expect(outerView.props.style.flexDirection).toBe('column');
		expect(outerView.children).toHaveLength(1);

		const innerPage = outerView.children[0];
		expect(innerPage.type).toBe('page');
		expect(innerPage.props.style.flexDirection).toBe('row');
		expect(innerPage.children).toHaveLength(1);

		const text = innerPage.children[0];
		expect(text.type).toBe('text');
		expect(text.props.text).toBe('deep text');
	});

	it('isolates trees across separate render() calls', () => {
		// Ensures createDocument() produces independent contexts —
		// concurrent requests cannot bleed into each other.
		const doc1 = createDocument();
		const doc2 = createDocument();

		const { html: _1 } = render(ShallowTemplate, { props: {}, context: makeContext(doc1) });
		const { html: _2 } = render(ShallowTemplate, { props: {}, context: makeContext(doc2) });

		expect(doc1.children).toHaveLength(2);
		expect(doc2.children).toHaveLength(2);

		// Nodes must be distinct objects
		expect(doc1.children[0]).not.toBe(doc2.children[0]);
	});
});

// ── Text children extraction ───────────────────────────────────────────────────

import TextChildrenTemplate from './TextChildrenTemplate.svelte';

describe('Text children extraction', () => {
	it('extracts text from children snippet syntax', () => {
		const doc = createDocument();

		const { html: _ } = render(TextChildrenTemplate, {
			props: {},
			context: makeContext(doc)
		});

		expect(doc.children).toHaveLength(1);
		const view = doc.children[0];
		expect(view.type).toBe('view');
		expect(view.children).toHaveLength(2);

		expect(view.children[0].props.text).toBe('Hello world');
		expect(view.children[1].props.text).toBe('Goodbye');
	});
});
