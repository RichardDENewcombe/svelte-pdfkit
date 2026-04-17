/**
 * Tests for deep nested fixed nodes.
 *
 * Fixed nodes nested inside non-fixed View containers must still appear on
 * every output page, just like direct-child fixed nodes. The paginator should
 * walk the full tree to collect them rather than only looking at direct
 * children of the <Page> node.
 */

import { describe, it, expect } from 'vitest';
import { render as svelteRender } from 'svelte/server';
import { createDocument } from '../runtime/document.js';
import { computeLayout } from '../layout/layout.js';
import { paginate } from '../pagination/paginate.js';
import { renderComponent } from '../runtime/render.js';
import type { PDFNode } from '../types/pdf.js';

import NestedFixedTemplate from './NestedFixedTemplate.svelte';

// ── Helpers ────────────────────────────────────────────────────────────────────

function streamToBuffer(stream: any): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (c: Buffer) => chunks.push(c));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
		stream.on('error', reject);
	});
}

function renderAndPaginate(component: any, props: Record<string, any> = {}): PDFNode[] {
	const doc = createDocument();
	// Must access .html to force lazy execution of the component tree.
	const { html: _ } = svelteRender(component, {
		props,
		context: new Map([['__pdf__', doc], ['__pdf_root__', doc]])
	});
	computeLayout(doc);
	return paginate(doc);
}

/** Recursively find all nodes with props.fixed === true in a subtree. */
function findFixed(node: PDFNode): PDFNode[] {
	const result: PDFNode[] = [];
	if (node.props.fixed === true) result.push(node);
	for (const child of node.children) {
		result.push(...findFixed(child));
	}
	return result;
}

// ── 1. Basic appearance on every page ──────────────────────────────────────────

describe('nested fixed nodes – appear on every page', () => {
	it('produces more than one page (prerequisite)', () => {
		const pages = renderAndPaginate(NestedFixedTemplate, { count: 50 });
		expect(pages.length).toBeGreaterThan(1);
	});

	it('every page contains at least one fixed node', () => {
		const pages = renderAndPaginate(NestedFixedTemplate, { count: 50 });
		for (const page of pages) {
			const fixed = findFixed(page);
			expect(fixed.length).toBeGreaterThan(0);
		}
	});

	it('the fixed node appears the same number of times on every page', () => {
		const pages = renderAndPaginate(NestedFixedTemplate, { count: 50 });
		const counts = pages.map(p => findFixed(p).length);
		const first = counts[0];
		for (const c of counts) {
			expect(c).toBe(first);
		}
	});
});

// ── 2. Y-coordinate consistency ───────────────────────────────────────────────

describe('nested fixed nodes – consistent y coordinate', () => {
	it('the fixed node has the same y coordinate on every page', () => {
		const pages = renderAndPaginate(NestedFixedTemplate, { count: 50 });
		const yValues = pages.map(p => {
			const fixed = findFixed(p);
			return fixed[0]?.layout?.y;
		});
		const first = yValues[0];
		for (const y of yValues) {
			expect(y).toBe(first);
		}
	});
});

// ── 3. Fixed node not duplicated in flow content ───────────────────────────────

describe('nested fixed nodes – not in flow content', () => {
	it('the fixed node does not appear in the flow children (would cause duplication)', () => {
		const pages = renderAndPaginate(NestedFixedTemplate, { count: 50 });
		for (const page of pages) {
			// Flow children are non-fixed direct children.
			const flowChildren = page.children.filter(c => !c.props.fixed);
			for (const child of flowChildren) {
				// Recursively walk flow children — none should be fixed.
				const nestedFixed = child.children.flatMap(c => findFixed(c));
				expect(nestedFixed).toHaveLength(0);
			}
		}
	});
});

// ── 4. Manually constructed deep nesting ──────────────────────────────────────

describe('nested fixed nodes – manual construction', () => {
	it('a fixed node nested 3 levels deep is collected and repeated', () => {
		// Build the tree manually to test collectFixed at a known depth.
		//
		//  page
		//   └─ view (non-fixed)
		//       └─ view (non-fixed)
		//           └─ view (fixed) ← three levels from page
		//
		//  page
		//   └─ text (flow, tall enough to overflow)

		const doc = createDocument();

		const deepFixed: PDFNode = {
			type: 'view',
			props: { fixed: true, style: {} },
			children: [{
				type: 'text',
				props: { text: 'Deep fixed header', style: {} },
				children: [],
				layout: { x: 10, y: 5, width: 200, height: 15 }
			}],
			layout: { x: 0, y: 0, width: 595, height: 25 }
		};

		const wrapper2: PDFNode = {
			type: 'view',
			props: { style: {} },
			children: [deepFixed],
			layout: { x: 0, y: 0, width: 595, height: 25 }
		};

		const wrapper1: PDFNode = {
			type: 'view',
			props: { style: {} },
			children: [wrapper2],
			layout: { x: 0, y: 0, width: 595, height: 25 }
		};

		// Tall flow content to force a second page.
		const flowRows: PDFNode[] = Array.from({ length: 60 }, (_, i) => ({
			type: 'text' as const,
			props: { text: `Row ${i + 1}`, style: {} },
			children: [],
			layout: { x: 40, y: 30 + i * 14, width: 515, height: 14 }
		}));

		const page: PDFNode = {
			type: 'page',
			props: { size: 'A4', width: 595, height: 842, style: {} },
			children: [wrapper1, ...flowRows],
			layout: { x: 0, y: 0, width: 595, height: 842 }
		};
		doc.children.push(page);

		const pages = paginate(doc);
		expect(pages.length).toBeGreaterThan(1);

		// The deeply nested fixed node must appear on every output page.
		for (const p of pages) {
			const fixed = findFixed(p);
			expect(fixed.length).toBeGreaterThan(0);
			// And it must contain the text node.
			const hasText = fixed.some(f => f.children.some(c => c.props.text === 'Deep fixed header'));
			expect(hasText).toBe(true);
		}
	});
});

// ── 5. End-to-end ─────────────────────────────────────────────────────────────

describe('nested fixed nodes – end-to-end', () => {
	it('NestedFixedTemplate renders a valid multi-page PDF', async () => {
		const stream = await renderComponent(NestedFixedTemplate, { count: 50 });
		const buf = await streamToBuffer(stream);
		expect(buf.slice(0, 5).toString()).toBe('%PDF-');
		const match = buf.toString('latin1').match(/\/Count (\d+)/);
		expect(match).not.toBeNull();
		expect(parseInt(match![1])).toBeGreaterThan(1);
	});
});
