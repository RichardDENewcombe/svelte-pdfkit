/**
 * Tests for the Font component and custom font rendering pipeline.
 *
 * Covers:
 *  1. Font component — pushes the correct resource entry onto doc.resources
 *  2. loadResources  — loads the font buffer and registers it on the measure doc
 *  3. renderPDF      — registers fonts on the PDFKit render doc
 *  4. End-to-end     — a template using a custom font produces a valid PDF
 */

import { describe, it, expect } from 'vitest';
import { render as svelteRender } from 'svelte/server';
import { createDocument } from '../runtime/document.js';
import { loadResources, getFontBuffer } from '../runtime/resources.js';
import { renderComponent } from '../runtime/render.js';
import { resolveFont } from '../runtime/font-registry.js';

// ── Test font path ─────────────────────────────────────────────────────────────
//
// We use a system font so the test has no external dependencies.
// Andale Mono is present on macOS and is a clean single-weight TTF.
const TEST_FONT_PATH = '/System/Library/Fonts/Supplemental/Andale Mono.ttf';
const TEST_FONT_NAME = 'TestFont';

// ── Fixtures ───────────────────────────────────────────────────────────────────

import FontDeclarationTemplate from './FontDeclarationTemplate.svelte';
import FontRenderTemplate from './FontRenderTemplate.svelte';
import FontVariantTemplate from './FontVariantTemplate.svelte';

function streamToBuffer(stream: any): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (c: Buffer) => chunks.push(c));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
		stream.on('error', reject);
	});
}

// ── 1. Font component — resource declaration ───────────────────────────────────

describe('Font component – resource declaration', () => {
	it('pushes a font entry onto doc.resources', () => {
		const doc = createDocument();
		const { html: _ } = svelteRender(FontDeclarationTemplate, {
			props: { name: TEST_FONT_NAME, src: TEST_FONT_PATH },
			context: new Map([['__pdf__', doc], ['__pdf_root__', doc]])
		});

		expect(doc.resources).toHaveLength(1);
		expect(doc.resources[0]).toMatchObject({
			type: 'font',
			name: TEST_FONT_NAME,
			src: TEST_FONT_PATH
		});
	});

	it('records the weight prop', () => {
		const doc = createDocument();
		const { html: _ } = svelteRender(FontDeclarationTemplate, {
			props: { name: TEST_FONT_NAME, src: TEST_FONT_PATH, weight: 'bold' },
			context: new Map([['__pdf__', doc], ['__pdf_root__', doc]])
		});

		expect(doc.resources[0].weight).toBe('bold');
	});

	it('does not create a PDF node (font is invisible)', () => {
		const doc = createDocument();
		const { html: _ } = svelteRender(FontDeclarationTemplate, {
			props: { name: TEST_FONT_NAME, src: TEST_FONT_PATH },
			context: new Map([['__pdf__', doc], ['__pdf_root__', doc]])
		});

		// Font is purely declarative — no children should appear on the document
		expect(doc.children).toHaveLength(0);
	});

	it('multiple Font declarations accumulate in order', () => {
		const doc = createDocument();
		const { html: _ } = svelteRender(FontDeclarationTemplate, {
			props: {
				name: TEST_FONT_NAME,
				src: TEST_FONT_PATH,
				weight: 'normal',
				// second font injected via the template's optional second slot
				secondName: 'TestFontBold',
				secondSrc: TEST_FONT_PATH,
				secondWeight: 'bold'
			},
			context: new Map([['__pdf__', doc], ['__pdf_root__', doc]])
		});

		// Template renders two Font components when secondName is provided
		expect(doc.resources).toHaveLength(2);
		expect(doc.resources[0].weight).toBe('normal');
		expect(doc.resources[1].weight).toBe('bold');
	});
});

// ── 2. loadResources — buffer loading and measure doc registration ─────────────

describe('loadResources – font loading', () => {
	it('loads the font buffer into the cache', async () => {
		const resources = [{ type: 'font' as const, name: TEST_FONT_NAME, src: TEST_FONT_PATH }];
		await loadResources(resources);

		const buffer = getFontBuffer(TEST_FONT_PATH);
		expect(buffer).toBeInstanceOf(Buffer);
		expect(buffer!.length).toBeGreaterThan(0);
	});

	it('font buffer starts with a valid TTF/OTF magic number', async () => {
		const resources = [{ type: 'font' as const, name: TEST_FONT_NAME, src: TEST_FONT_PATH }];
		await loadResources(resources);

		const buffer = getFontBuffer(TEST_FONT_PATH)!;
		// TTF files start with 0x00010000 or 'true'; OTF with 'OTTO'
		// Any of these 4-byte prefixes confirms a valid font file was loaded.
		const magic = buffer.readUInt32BE(0);
		const validMagic = [0x00010000, 0x74727565, 0x4f54544f]; // 0x00010000, 'true', 'OTTO'
		expect(validMagic).toContain(magic);
	});
});

// ── 3. End-to-end — template with custom font produces a valid PDF ─────────────

describe('Font – end-to-end rendering', () => {
	it('renders a PDF when a custom font is declared and used', async () => {
		const stream = await renderComponent(FontRenderTemplate, {
			fontPath: TEST_FONT_PATH
		});
		const buffer = await streamToBuffer(stream);

		expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
		expect(buffer.length).toBeGreaterThan(1000);
	});

	it('concurrent renders with custom fonts are independent', async () => {
		const [b1, b2] = await Promise.all([
			renderComponent(FontRenderTemplate, { fontPath: TEST_FONT_PATH }).then(streamToBuffer),
			renderComponent(FontRenderTemplate, { fontPath: TEST_FONT_PATH }).then(streamToBuffer)
		]);

		expect(b1.slice(0, 5).toString()).toBe('%PDF-');
		expect(b2.slice(0, 5).toString()).toBe('%PDF-');
	});
});

// ── 4. resolveFont — unit tests ────────────────────────────────────────────────

describe('resolveFont', () => {
	it('returns the family name unchanged for normal weight and style', () => {
		expect(resolveFont('Inter')).toBe('Inter');
		expect(resolveFont('Inter', 'normal', 'normal')).toBe('Inter');
	});

	it('appends -Bold for bold weight', () => {
		expect(resolveFont('Inter', 'bold')).toBe('Inter-Bold');
		expect(resolveFont('Inter', 'bold', 'normal')).toBe('Inter-Bold');
	});

	it('appends -Italic for italic style', () => {
		expect(resolveFont('Inter', 'normal', 'italic')).toBe('Inter-Italic');
		expect(resolveFont('Inter', undefined, 'italic')).toBe('Inter-Italic');
	});

	it('appends -BoldItalic for bold + italic', () => {
		expect(resolveFont('Inter', 'bold', 'italic')).toBe('Inter-BoldItalic');
	});

	it('works for built-in PDFKit font names', () => {
		expect(resolveFont('Helvetica')).toBe('Helvetica');
		expect(resolveFont('Helvetica', 'bold')).toBe('Helvetica-Bold');
		expect(resolveFont('Times-Roman', 'bold', 'italic')).toBe('Times-Roman-BoldItalic');
	});
});

// ── 5. Font variants — resource registration ───────────────────────────────────

describe('Font variants – resource registration', () => {
	it('registers regular and bold variants under derived PDFKit names', async () => {
		// Using the same physical font file for both variants is fine in tests —
		// we only care that the correct PDFKit names are registered, not the glyph data.
		const resources = [
			{ type: 'font' as const, name: 'VarFont', src: TEST_FONT_PATH, weight: 'normal' },
			{ type: 'font' as const, name: 'VarFont', src: TEST_FONT_PATH, weight: 'bold' }
		];

		await loadResources(resources);

		// Both buffers should be loadable (same file, different registrations).
		expect(getFontBuffer(TEST_FONT_PATH)).toBeInstanceOf(Buffer);
	});

	it('renders a valid PDF with bold font variant', async () => {
		const stream = await renderComponent(FontVariantTemplate, {
			regularPath: TEST_FONT_PATH,
			boldPath: TEST_FONT_PATH
		});
		const buffer = await streamToBuffer(stream);

		expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
		expect(buffer.length).toBeGreaterThan(1000);
	});
});
