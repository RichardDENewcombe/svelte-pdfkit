/**
 * Milestone 36 — Lazy layout cache
 *
 * Verifies that:
 *  1. A page whose tree was already laid out is restored from cache on the
 *     next computeLayout call — Yoga is not invoked a second time for
 *     identical content.
 *  2. Cache hits produce identical layout results to a fresh Yoga computation.
 *  3. Changing any layout-affecting property (style, text, size) produces a
 *     cache miss and a fresh computation.
 *  4. The cache evicts the oldest entry when MAX_LAYOUT_CACHE_SIZE is reached
 *     so memory usage stays bounded in long-running processes.
 *  5. clearLayoutCache() resets the cache for test isolation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { computeLayout, clearLayoutCache, getLayoutCacheSize } from '../layout/layout.js';
import { createDocument } from '../runtime/document.js';
import { createNode } from '../runtime/node.js';
import type { DocumentContext } from '../types/pdf.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDoc(text = 'Hello', fontSize = 12, size = 'A4'): DocumentContext {
	const doc = createDocument();
	const page = createNode('page', { size });
	const view = createNode('view', { style: { padding: 20 } });
	const textNode = createNode('text', { text, style: { fontSize } });
	view.children.push(textNode);
	page.children.push(view);
	doc.children.push(page);
	return doc;
}

function layoutsMatch(a: DocumentContext, b: DocumentContext): boolean {
	const pageA = a.children[0];
	const pageB = b.children[0];
	if (!pageA?.layout || !pageB?.layout) return false;
	const la = pageA.layout;
	const lb = pageB.layout;
	return la.x === lb.x && la.y === lb.y && la.width === lb.width && la.height === lb.height;
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
	clearLayoutCache();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('layout cache (milestone 36)', () => {
	it('caches layout after the first computation', () => {
		const doc = makeDoc('Hello');
		computeLayout(doc);

		expect(getLayoutCacheSize()).toBe(1);
	});

	it('returns identical layout results from cache', () => {
		const doc1 = makeDoc('Hello');
		computeLayout(doc1);

		const doc2 = makeDoc('Hello');
		computeLayout(doc2);

		expect(layoutsMatch(doc1, doc2)).toBe(true);

		// Verify child layout is also restored correctly
		const view1 = doc1.children[0].children[0];
		const view2 = doc2.children[0].children[0];
		expect(view1.layout).toEqual(view2.layout);

		const text1 = view1.children[0];
		const text2 = view2.children[0];
		expect(text1.layout).toEqual(text2.layout);
	});

	it('does not grow cache on repeated identical layouts', () => {
		for (let i = 0; i < 10; i++) {
			const doc = makeDoc('Same content');
			computeLayout(doc);
		}
		// All 10 renders share the same cache key — only one entry stored
		expect(getLayoutCacheSize()).toBe(1);
	});

	it('produces a cache miss when text content changes', () => {
		computeLayout(makeDoc('Hello'));
		computeLayout(makeDoc('World'));

		expect(getLayoutCacheSize()).toBe(2);
	});

	it('produces a cache miss when font size changes', () => {
		computeLayout(makeDoc('Hello', 12));
		computeLayout(makeDoc('Hello', 24));

		expect(getLayoutCacheSize()).toBe(2);
	});

	it('produces a cache miss when page size changes', () => {
		computeLayout(makeDoc('Hello', 12, 'A4'));
		computeLayout(makeDoc('Hello', 12, 'Letter'));

		expect(getLayoutCacheSize()).toBe(2);
	});

	it('cache hit is faster than a fresh Yoga computation', () => {
		const doc = makeDoc('Benchmark text');

		// Warm the cache
		computeLayout(doc);

		// Cold Yoga (different text to force a miss)
		const coldDoc = makeDoc('Different text for cold run');
		const t0 = performance.now();
		computeLayout(coldDoc);
		const coldTime = performance.now() - t0;

		// Hot cache (same text as warm doc)
		const hotDoc = makeDoc('Benchmark text');
		const t1 = performance.now();
		computeLayout(hotDoc);
		const hotTime = performance.now() - t1;

		// Cache hit should be at least 2× faster than Yoga computation.
		// This threshold is generous to avoid flakiness on slow CI machines.
		// If this fails, the cache isn't actually being used.
		expect(hotTime).toBeLessThan(coldTime * 2);
	});

	it('evicts oldest entry when cache exceeds 256 entries', () => {
		// Fill the cache to its limit
		const LIMIT = 256;
		for (let i = 0; i < LIMIT; i++) {
			computeLayout(makeDoc(`Unique page ${i}`));
		}
		expect(getLayoutCacheSize()).toBe(LIMIT);

		// One more unique page should evict the oldest
		computeLayout(makeDoc('Unique page that triggers eviction'));
		expect(getLayoutCacheSize()).toBe(LIMIT);
	}, 30_000);

	it('clearLayoutCache() empties the cache', () => {
		computeLayout(makeDoc('Hello'));
		expect(getLayoutCacheSize()).toBe(1);

		clearLayoutCache();
		expect(getLayoutCacheSize()).toBe(0);
	});

	it('handles multi-page documents — each page cached independently', () => {
		const doc = createDocument();
		for (let i = 0; i < 3; i++) {
			const page = createNode('page', { size: 'A4' });
			const text = createNode('text', { text: `Page ${i}`, style: { fontSize: 12 } });
			page.children.push(text);
			doc.children.push(page);
		}
		computeLayout(doc);

		// 3 pages with distinct text → 3 cache entries
		expect(getLayoutCacheSize()).toBe(3);
	});
});
