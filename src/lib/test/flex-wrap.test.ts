/**
 * Regression test for flexWrap.
 *
 * `flexWrap` is a declared, documented StyleProps value, but for a while the
 * layout engine never forwarded it to Yoga (no setFlexWrap call), so wrapping
 * was silently ignored and row children overflowed off the page instead of
 * flowing onto a new line. These tests lock in that the prop reaches Yoga.
 */

import { describe, it, expect } from 'vitest';
import { createDocument } from '../runtime/document.js';
import { computeLayout } from '../layout/layout.js';
import type { PDFNode } from '../types/pdf.js';

/** Builds a page → row-container → N fixed-size children and computes layout. */
function layoutRow(flexWrap: 'wrap' | 'nowrap'): PDFNode {
	const children: PDFNode[] = Array.from({ length: 3 }, () => ({
		type: 'view',
		props: { style: { width: 80, height: 20 } },
		children: [],
		layout: undefined
	}));

	const container: PDFNode = {
		type: 'view',
		props: { style: { flexDirection: 'row', flexWrap, width: 200 } },
		children,
		layout: undefined
	};

	const page: PDFNode = {
		type: 'page',
		props: { size: 'A4', style: { padding: 0 } },
		children: [container],
		layout: undefined
	};

	const doc = createDocument();
	doc.children.push(page);
	computeLayout(doc);
	return container;
}

describe('flexWrap', () => {
	it('wraps overflowing row children onto a new line', () => {
		const container = layoutRow('wrap');
		const [a, b, c] = container.children;

		// 80 + 80 fit on the first line; the third (would reach x=240 > 200) wraps.
		expect(a.layout!.y).toBe(0);
		expect(b.layout!.y).toBe(0);
		expect(c.layout!.y).toBe(20);
		expect(c.layout!.x).toBe(0);
	});

	it('keeps children on one line when nowrap', () => {
		const container = layoutRow('nowrap');
		const [a, , c] = container.children;

		// No wrapping: all three share the first line (and overflow the width).
		expect(a.layout!.y).toBe(0);
		expect(c.layout!.y).toBe(0);
	});
});
