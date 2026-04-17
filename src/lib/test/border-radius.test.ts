/**
 * Tests for per-corner border radius rendering.
 *
 * Covers:
 *  1. Uniform borderRadius still works (regression)
 *  2. Per-corner props produce a valid PDF
 *  3. Mix of borderRadius shorthand + per-corner override
 *  4. Extreme radius values are clamped (no crash / garbled output)
 *  5. Different radii produce different PDF byte content
 */

import { describe, it, expect } from 'vitest';
import { renderComponent } from '../runtime/render.js';
import { createDocument } from '../runtime/document.js';
import { computeLayout } from '../layout/layout.js';
import { paginate } from '../pagination/paginate.js';
import { renderPDF } from '../renderer/render.js';
import BorderRadiusTemplate from './BorderRadiusTemplate.svelte';
import type { PDFNode } from '../types/pdf.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function streamToBuffer(stream: any): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (c: Buffer) => chunks.push(c));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
		stream.on('error', reject);
	});
}

/**
 * Directly render a single pre-built page node to PDF bytes.
 * Bypasses Svelte rendering so we can test specific style combinations
 * without needing Svelte fixture files for every case.
 */
async function renderPageToPDF(style: Record<string, any>): Promise<Buffer> {
	const doc = createDocument();
	const view: PDFNode = {
		type: 'view',
		props: { style },
		children: [],
		layout: undefined
	};
	const page: PDFNode = {
		type: 'page',
		props: { size: 'A4', style: {} },
		children: [view],
		layout: undefined
	};
	doc.children.push(page);

	computeLayout(doc);
	const pages = paginate(doc);
	const stream = renderPDF(pages);
	return streamToBuffer(stream);
}

// ── 1. Regression: uniform borderRadius ────────────────────────────────────────

describe('border radius – uniform borderRadius regression', () => {
	it('renders a view with borderRadius without error', async () => {
		const buf = await renderPageToPDF({
			width: 100, height: 50,
			borderRadius: 10,
			backgroundColor: '#aaa'
		});
		expect(buf.slice(0, 5).toString()).toBe('%PDF-');
		expect(buf.length).toBeGreaterThan(500);
	});
});

// ── 2. Per-corner radii ────────────────────────────────────────────────────────

describe('border radius – per-corner props', () => {
	it('renders with only borderTopLeftRadius set', async () => {
		const buf = await renderPageToPDF({
			width: 100, height: 50,
			borderTopLeftRadius: 20,
			backgroundColor: '#bbb'
		});
		expect(buf.slice(0, 5).toString()).toBe('%PDF-');
	});

	it('renders with all four corners set independently', async () => {
		const buf = await renderPageToPDF({
			width: 100, height: 50,
			borderTopLeftRadius: 5,
			borderTopRightRadius: 10,
			borderBottomRightRadius: 15,
			borderBottomLeftRadius: 0,
			backgroundColor: '#ccc'
		});
		expect(buf.slice(0, 5).toString()).toBe('%PDF-');
	});

	it('renders with per-corner border radii alongside a border', async () => {
		const buf = await renderPageToPDF({
			width: 100, height: 50,
			borderTopLeftRadius: 10,
			borderBottomRightRadius: 10,
			borderWidth: 2,
			borderColor: '#333'
		});
		expect(buf.slice(0, 5).toString()).toBe('%PDF-');
	});
});

// ── 3. Mix: shorthand + per-corner override ────────────────────────────────────

describe('border radius – shorthand plus per-corner override', () => {
	it('renders when borderRadius and borderTopLeftRadius are both set', async () => {
		const buf = await renderPageToPDF({
			width: 100, height: 50,
			borderRadius: 10,
			borderTopLeftRadius: 25,
			backgroundColor: '#eee'
		});
		expect(buf.slice(0, 5).toString()).toBe('%PDF-');
	});

	it('produces different output than uniform borderRadius alone', async () => {
		const uniform = await renderPageToPDF({
			width: 100, height: 50,
			borderRadius: 10,
			backgroundColor: '#eee'
		});
		const mixed = await renderPageToPDF({
			width: 100, height: 50,
			borderRadius: 10,
			borderTopLeftRadius: 25,
			backgroundColor: '#eee'
		});
		// Path data differs because top-left corner uses a different radius.
		expect(uniform.equals(mixed)).toBe(false);
	});
});

// ── 4. Clamping – extreme radius values ───────────────────────────────────────

describe('border radius – extreme radius clamping', () => {
	it('clamps borderRadius larger than half the shorter dimension without crashing', async () => {
		const buf = await renderPageToPDF({
			width: 100, height: 40,
			borderTopLeftRadius: 9999,
			backgroundColor: '#f00'
		});
		expect(buf.slice(0, 5).toString()).toBe('%PDF-');
	});

	it('clamps all corners when borderRadius exceeds half the box', async () => {
		const buf = await renderPageToPDF({
			width: 80, height: 80,
			borderRadius: 9999,
			backgroundColor: '#0f0'
		});
		expect(buf.slice(0, 5).toString()).toBe('%PDF-');
	});
});

// ── 5. Full template integration ──────────────────────────────────────────────

describe('border radius – full template integration', () => {
	it('BorderRadiusTemplate renders a valid PDF', async () => {
		const stream = await renderComponent(BorderRadiusTemplate);
		const buf = await streamToBuffer(stream);
		expect(buf.slice(0, 5).toString()).toBe('%PDF-');
		expect(buf.length).toBeGreaterThan(1000);
	});

	it('per-corner radii produce different output from no radius', async () => {
		const noRadius = await renderPageToPDF({
			width: 100, height: 50,
			backgroundColor: '#aaa'
		});
		const withPerCorner = await renderPageToPDF({
			width: 100, height: 50,
			borderTopLeftRadius: 15,
			backgroundColor: '#aaa'
		});
		expect(noRadius.equals(withPerCorner)).toBe(false);
	});
});
