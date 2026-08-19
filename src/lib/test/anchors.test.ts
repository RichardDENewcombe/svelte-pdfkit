/**
 * Tests for the `anchor` prop / `pageOf` page-number lookup.
 *
 * Split into deterministic unit tests (assignAnchorIds / buildAnchorIndex
 * against hand-built PDFNode trees — no PDF parsing) and an end-to-end test
 * that renders through the full pipeline and asserts the drawn page numbers
 * are correct, including the forward-reference case a Table of Contents
 * needs (a page-1 render prop resolving a later page's number).
 */

import { inflateSync } from 'node:zlib';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render as svelteRender } from 'svelte/server';
import type { PDFNode } from '../types/pdf.js';
import { assignAnchorIds, buildAnchorIndex } from '../renderer/anchors.js';
import { createDocument } from '../runtime/document.js';
import { renderComponent } from '../runtime/render.js';
import AnchorTemplate from './AnchorTemplate.svelte';

function streamToBuffer(stream: any): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (c: Buffer) => chunks.push(c));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
		stream.on('error', reject);
	});
}

/**
 * Reconstructs the literal drawn text from a rendered PDF buffer, for
 * asserting on actual glyph content rather than just structural validity.
 * Only reliable for simple (non-embedded, e.g. Helvetica) fonts, where a
 * hex-encoded PDF string's bytes are WinAnsi/ASCII codepoints.
 */
function extractDrawnText(buffer: Buffer): string {
	const raw = buffer.toString('binary');
	const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
	let all = '';
	let m: RegExpExecArray | null;
	while ((m = streamRe.exec(raw))) {
		try {
			all += inflateSync(Buffer.from(m[1], 'binary')).toString('latin1');
		} catch {
			// Not a Flate stream (e.g. an image/font) — skip.
		}
	}
	return [...all.matchAll(/<([0-9A-Fa-f]+)>/g)]
		.map((hex) => Buffer.from(hex[1], 'hex').toString('latin1'))
		.join('');
}

function node(props: Record<string, any>, children: PDFNode[] = []): PDFNode {
	return { type: 'view', props, children };
}

function page(children: PDFNode[]): PDFNode {
	return { type: 'page', props: {}, children };
}

afterEach(() => {
	vi.restoreAllMocks();
});

// ── assignAnchorIds ─────────────────────────────────────────────────────────────

describe('assignAnchorIds', () => {
	it('stamps sequential ids on anchored nodes in document order', () => {
		const root = node({}, [
			node({ anchor: 'a' }, [node({ anchor: 'b' })]),
			node({ anchor: 'c' })
		]);
		assignAnchorIds(root);
		expect(root.props.__anchorId).toBeUndefined();
		expect(root.children[0].props.__anchorId).toBe(0); // a
		expect(root.children[0].children[0].props.__anchorId).toBe(1); // b
		expect(root.children[1].props.__anchorId).toBe(2); // c
	});

	it('ignores empty and non-string anchor values', () => {
		const root = node({}, [node({ anchor: '' }), node({ anchor: 5 as any })]);
		assignAnchorIds(root);
		expect(root.children[0].props.__anchorId).toBeUndefined();
		expect(root.children[1].props.__anchorId).toBeUndefined();
	});
});

// ── buildAnchorIndex ────────────────────────────────────────────────────────────

describe('buildAnchorIndex', () => {
	it('records the first page number for each anchor across pages', () => {
		const pages = [
			page([node({ anchor: 'intro', __anchorId: 0 })]),
			page([node({ anchor: 'details', __anchorId: 1 })])
		];
		const index = buildAnchorIndex(pages);
		expect(index.get('intro')).toEqual({ pageNumber: 1, totalPages: 2 });
		expect(index.get('details')).toEqual({ pageNumber: 2, totalPages: 2 });
	});

	it('dedups a spanning node (same __anchorId on two pages) to its first page', () => {
		const pages = [
			page([node({ anchor: 'spanning', __anchorId: 7 })]),
			page([node({ anchor: 'spanning', __anchorId: 7 })])
		];
		const index = buildAnchorIndex(pages);
		expect(index.size).toBe(1);
		expect(index.get('spanning')).toEqual({ pageNumber: 1, totalPages: 2 });
	});

	it('returns undefined for an unregistered key', () => {
		const index = buildAnchorIndex([page([node({ anchor: 'known', __anchorId: 0 })])]);
		expect(index.get('does-not-exist')).toBeUndefined();
	});

	it('warns and keeps the first page on a genuine anchor collision', () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const pages = [
			page([node({ anchor: 'dup', __anchorId: 0 })]),
			page([node({ anchor: 'dup', __anchorId: 1 })])
		];
		const index = buildAnchorIndex(pages);
		expect(index.get('dup')).toEqual({ pageNumber: 1, totalPages: 2 });
		expect(warnSpy).toHaveBeenCalledTimes(1);
		expect(warnSpy.mock.calls[0][0]).toContain('Duplicate anchor "dup"');
	});
});

// ── AST construction ────────────────────────────────────────────────────────────

describe('anchor prop on components', () => {
	it('stores the anchor key on Text and View nodes', () => {
		const doc = createDocument();
		// render() from svelte/server is lazy — destructure html to force execution.
		const { html: _ } = svelteRender(AnchorTemplate, {
			props: {},
			context: new Map([
				['__pdf__', doc],
				['__pdf_root__', doc]
			])
		});
		const page = doc.children[0];
		const [, , , deadLegs, spanning] = page.children;

		expect(deadLegs.props.anchor).toBe('dead-legs');
		expect(spanning.props.anchor).toBe('spanning-section');
	});
});

// ── End-to-end ──────────────────────────────────────────────────────────────────

describe('anchor / pageOf – end-to-end PDF', () => {
	it('resolves forward-referenced page numbers, including across a spanning node', async () => {
		const stream = await renderComponent(AnchorTemplate);
		const buffer = await streamToBuffer(stream);

		expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
		expect(buffer.toString('binary')).toContain('%%EOF');

		const text = extractDrawnText(buffer);
		expect(text).toContain('TOC dead-legs page: 2');
		expect(text).toContain('TOC spanning-section page: 3');
		expect(text).toContain('TOC missing page: MISSING');
	});
});
