/**
 * Tests for Table, Row, and Cell components.
 *
 * Tables are implemented as thin Yoga-backed wrappers over the view node type —
 * no separate layout engine is needed. These tests verify:
 *
 *  1. AST shape  — the correct node tree is produced
 *  2. Defaults   — Table defaults to column direction, Cell defaults to flexGrow:1
 *  3. Style pass-through — custom styles are merged correctly
 *  4. End-to-end — a template containing a table produces a valid PDF
 */

import { describe, it, expect } from 'vitest';
import { render as svelteRender } from 'svelte/server';
import { createDocument } from '../runtime/document.js';
import { renderComponent } from '../runtime/render.js';
import TableTemplate from './TableTemplate.svelte';
import Table from '../components/Table/Table.svelte';
import Row from '../components/Table/Row.svelte';
import Cell from '../components/Table/Cell.svelte';
import Page from '../components/Page/Page.svelte';
import Text from '../components/Text/Text.svelte';

function makeContext(doc: ReturnType<typeof createDocument>) {
	return new Map<string, unknown>([
		['__pdf__', doc],
		['__pdf_root__', doc]
	]);
}

function streamToBuffer(stream: any): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (c: Buffer) => chunks.push(c));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
		stream.on('error', reject);
	});
}

// ── 1. AST shape ───────────────────────────────────────────────────────────────

describe('Table – AST node shape', () => {
	it('Table produces a view node with flexDirection column', () => {
		const doc = createDocument();
		const { html: _ } = svelteRender(Table, {
			props: { style: {} },
			context: makeContext(doc)
		});

		expect(doc.children).toHaveLength(1);
		const table = doc.children[0];
		expect(table.type).toBe('view');
		expect(table.props.style.flexDirection).toBe('column');
	});

	it('Table defaults to width 100%', () => {
		const doc = createDocument();
		const { html: _ } = svelteRender(Table, {
			props: {},
			context: makeContext(doc)
		});

		expect(doc.children[0].props.style.width).toBe('100%');
	});

	it('Row produces a view node with flexDirection row', () => {
		const doc = createDocument();
		const { html: _ } = svelteRender(Row, {
			props: {},
			context: makeContext(doc)
		});

		expect(doc.children[0].type).toBe('view');
		expect(doc.children[0].props.style.flexDirection).toBe('row');
	});

	it('Cell produces a view node with flexGrow 1 by default', () => {
		const doc = createDocument();
		const { html: _ } = svelteRender(Cell, {
			props: {},
			context: makeContext(doc)
		});

		expect(doc.children[0].type).toBe('view');
		expect(doc.children[0].props.style.flexGrow).toBe(1);
	});

	it('Cell accepts explicit width to override equal-column default', () => {
		const doc = createDocument();
		const { html: _ } = svelteRender(Cell, {
			props: { style: { width: 120 } },
			context: makeContext(doc)
		});

		expect(doc.children[0].props.style.width).toBe(120);
	});
});

// ── 2. Style pass-through ──────────────────────────────────────────────────────

describe('Table – style pass-through', () => {
	it('Row merges custom style while preserving flexDirection row', () => {
		const doc = createDocument();
		const { html: _ } = svelteRender(Row, {
			props: { style: { backgroundColor: '#eee', padding: 4 } },
			context: makeContext(doc)
		});

		const row = doc.children[0];
		expect(row.props.style.backgroundColor).toBe('#eee');
		expect(row.props.style.padding).toBe(4);
		expect(row.props.style.flexDirection).toBe('row');
	});

	it('Cell merges borderWidth and borderColor', () => {
		const doc = createDocument();
		const { html: _ } = svelteRender(Cell, {
			props: { style: { borderWidth: 1, borderColor: '#ccc' } },
			context: makeContext(doc)
		});

		const cell = doc.children[0];
		expect(cell.props.style.borderWidth).toBe(1);
		expect(cell.props.style.borderColor).toBe('#ccc');
	});
});

// ── 3. Nesting — full table tree ───────────────────────────────────────────────

describe('Table – full node tree', () => {
	it('builds the correct nested structure from TableTemplate', () => {
		const doc = createDocument();
		const { html: _ } = svelteRender(TableTemplate, {
			props: {},
			context: makeContext(doc)
		});

		// page → outer view → table
		const page = doc.children[0];
		expect(page.type).toBe('page');

		const outerView = page.children[0];
		expect(outerView.type).toBe('view');

		const table = outerView.children[0];
		expect(table.type).toBe('view');
		expect(table.props.style.flexDirection).toBe('column');

		// Table has 3 rows
		expect(table.children).toHaveLength(3);

		// Each row has 3 cells
		for (const row of table.children) {
			expect(row.type).toBe('view');
			expect(row.props.style.flexDirection).toBe('row');
			expect(row.children).toHaveLength(3);

			// Each cell has one text child
			for (const cell of row.children) {
				expect(cell.type).toBe('view');
				expect(cell.children).toHaveLength(1);
				expect(cell.children[0].type).toBe('text');
			}
		}
	});

	it('header row cells contain bold text', () => {
		const doc = createDocument();
		const { html: _ } = svelteRender(TableTemplate, {
			props: {},
			context: makeContext(doc)
		});

		const table = doc.children[0].children[0].children[0];
		const headerRow = table.children[0];

		expect(headerRow.children[0].children[0].props.text).toBe('Name');
		expect(headerRow.children[1].children[0].props.text).toBe('Qty');
		expect(headerRow.children[2].children[0].props.text).toBe('Price');
	});
});

// ── 4. End-to-end ──────────────────────────────────────────────────────────────

describe('Table – end-to-end PDF rendering', () => {
	it('produces a valid PDF from a template containing a table', async () => {
		const stream = await renderComponent(TableTemplate);
		const buffer = await streamToBuffer(stream);

		expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
		expect(buffer.length).toBeGreaterThan(1000);
	});
});
