/**
 * Tests for SVG image sources on <Image>.
 *
 * Covers SVG detection, data-URI decoding in the resource loader, and
 * end-to-end rendering of an <Image> whose src is an SVG file or data URI —
 * which must route through svg-to-pdfkit rather than PDFKit's raster
 * doc.image().
 */

import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadResources, getImageBuffer } from '../runtime/resources.js';
import { isSvgImage } from '../renderer/draw-image.js';
import { renderComponent } from '../runtime/render.js';
import SvgImageTemplate from './SvgImageTemplate.svelte';

const SVG_FILE = fileURLToPath(new URL('./sample.svg', import.meta.url));

const SVG_MARKUP =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="green"/></svg>';

function streamToBuffer(stream: any): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (c: Buffer) => chunks.push(c));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
		stream.on('error', reject);
	});
}

// ── 1. Detection ─────────────────────────────────────────────────────────────────

describe('isSvgImage – detection', () => {
	const empty = Buffer.alloc(0);
	const svgBuf = Buffer.from(SVG_MARKUP);
	// A minimal PNG signature — must NOT be detected as SVG.
	const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

	it('detects a .svg file extension', () => {
		expect(isSvgImage('/assets/logo.svg', empty)).toBe(true);
	});

	it('detects a .svg extension despite a query string', () => {
		expect(isSvgImage('https://cdn.example.com/logo.svg?v=2', empty)).toBe(true);
	});

	it('detects an image/svg+xml data URI', () => {
		expect(isSvgImage('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', empty)).toBe(true);
	});

	it('detects SVG by content sniff when the source has no extension', () => {
		expect(isSvgImage('https://example.com/badge', svgBuf)).toBe(true);
	});

	it('does NOT detect a PNG buffer as SVG', () => {
		expect(isSvgImage('/assets/photo.png', pngBuf)).toBe(false);
	});

	it('does NOT detect a non-svg URL with binary content', () => {
		expect(isSvgImage('https://example.com/photo.jpg', pngBuf)).toBe(false);
	});
});

// ── 2. Resource loading (data URIs + files) ─────────────────────────────────────

describe('loadResources – SVG sources', () => {
	it('loads an .svg file into the image cache', async () => {
		await loadResources([{ type: 'image', src: SVG_FILE }]);
		const buf = getImageBuffer(SVG_FILE);
		expect(buf).toBeInstanceOf(Buffer);
		expect(buf!.toString('utf-8')).toContain('<svg');
	});

	it('decodes a base64 image/svg+xml data URI', async () => {
		const uri = 'data:image/svg+xml;base64,' + Buffer.from(SVG_MARKUP).toString('base64');
		await loadResources([{ type: 'image', src: uri }]);
		const buf = getImageBuffer(uri);
		expect(buf!.toString('utf-8')).toBe(SVG_MARKUP);
	});

	it('decodes a percent-encoded (non-base64) image/svg+xml data URI', async () => {
		const uri = 'data:image/svg+xml,' + encodeURIComponent(SVG_MARKUP);
		await loadResources([{ type: 'image', src: uri }]);
		const buf = getImageBuffer(uri);
		expect(buf!.toString('utf-8')).toBe(SVG_MARKUP);
	});
});

// ── 3. End-to-end render ─────────────────────────────────────────────────────────

describe('SVG image – end-to-end render', () => {
	it('renders a valid PDF from an .svg file source without an SVG-render warning', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		try {
			const stream = await renderComponent(SvgImageTemplate, { src: SVG_FILE });
			const buf = await streamToBuffer(stream);
			expect(buf.slice(0, 5).toString()).toBe('%PDF-');
			expect(buf.length).toBeGreaterThan(1000);
			// drawSvgImage swallows render errors with a warning; assert none fired,
			// confirming the SVG was actually drawn rather than skipped.
			const svgWarnings = warnSpy.mock.calls.filter((c) => String(c[0]).includes('SVG'));
			expect(svgWarnings).toHaveLength(0);
		} finally {
			warnSpy.mockRestore();
		}
	});

	it('renders a valid PDF from an SVG data URI source', async () => {
		const realSvg = await fs.readFile(SVG_FILE, 'utf-8');
		const uri = 'data:image/svg+xml;base64,' + Buffer.from(realSvg).toString('base64');
		const stream = await renderComponent(SvgImageTemplate, { src: uri });
		const buf = await streamToBuffer(stream);
		expect(buf.slice(0, 5).toString()).toBe('%PDF-');
		expect(buf.length).toBeGreaterThan(1000);
	});
});
