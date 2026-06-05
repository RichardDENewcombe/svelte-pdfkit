/**
 * Tests for intrinsic image dimensions and the Yoga aspect-ratio integration.
 *
 *  1. imageSize / imageAspectRatio — parse PNG, JPEG, and SVG headers.
 *  2. computeLayout — an <Image> given only one dimension derives the other
 *     from its intrinsic aspect ratio; specifying both still wins.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { imageSize, imageAspectRatio } from '../layout/image-size.js';
import { createDocument } from '../runtime/document.js';
import { computeLayout } from '../layout/layout.js';
import { loadResources, clearCaches } from '../runtime/resources.js';
import type { PDFNode } from '../types/pdf.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────────

/** Minimal PNG header declaring width=200, height=100 (IHDR only). */
function makePng(width: number, height: number): Buffer {
	const b = Buffer.alloc(24);
	b.writeUInt32BE(0x89504e47, 0);
	b.writeUInt32BE(0x0d0a1a0a, 4);
	// bytes 8..15: IHDR length + type (content irrelevant to the parser)
	b.writeUInt32BE(width, 16);
	b.writeUInt32BE(height, 20);
	return b;
}

/** Minimal JPEG: SOI + a SOF0 frame header declaring the given dimensions. */
function makeJpeg(width: number, height: number): Buffer {
	const b = Buffer.from([
		0xff, 0xd8, // SOI
		0xff, 0xc0, // SOF0
		0x00, 0x11, // length = 17
		0x08, // precision
		(height >> 8) & 0xff, height & 0xff,
		(width >> 8) & 0xff, width & 0xff,
		0x03 // component count
	]);
	return b;
}

const SVG_2x1 = Buffer.from(
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="200" height="100"/></svg>'
);
const SVG_ATTRS = Buffer.from(
	'<svg xmlns="http://www.w3.org/2000/svg" width="300px" height="100px"><rect/></svg>'
);

// ── 1. Parsers ───────────────────────────────────────────────────────────────────

describe('imageSize', () => {
	it('reads PNG dimensions from IHDR', () => {
		expect(imageSize(makePng(200, 100))).toEqual({ width: 200, height: 100 });
	});

	it('reads JPEG dimensions from the SOF marker', () => {
		expect(imageSize(makeJpeg(640, 480))).toEqual({ width: 640, height: 480 });
	});

	it('reads SVG dimensions from viewBox', () => {
		expect(imageSize(SVG_2x1)).toEqual({ width: 200, height: 100 });
	});

	it('reads SVG dimensions from width/height attributes (stripping units)', () => {
		expect(imageSize(SVG_ATTRS)).toEqual({ width: 300, height: 100 });
	});

	it('returns null for an unrecognised buffer', () => {
		expect(imageSize(Buffer.from('not an image'))).toBeNull();
	});

	it('computes the aspect ratio', () => {
		expect(imageAspectRatio(makePng(200, 100))).toBeCloseTo(2, 5);
		expect(imageAspectRatio(SVG_2x1)).toBeCloseTo(2, 5);
		expect(imageAspectRatio(Buffer.from('x'))).toBeNull();
	});
});

// ── 2. Layout integration ─────────────────────────────────────────────────────────

describe('computeLayout – image aspect ratio', () => {
	afterEach(() => clearCaches());

	function imageNode(src: string, style: Record<string, any>): PDFNode {
		return { type: 'image', props: { src, style }, children: [] };
	}

	function docWith(image: PDFNode) {
		const doc = createDocument();
		const page: PDFNode = {
			type: 'page',
			props: { size: 'A4', style: {} },
			children: [image]
		};
		doc.children.push(page);
		return doc;
	}

	it('derives height from width using the intrinsic ratio (2:1 SVG)', async () => {
		const src = 'data:image/svg+xml,' + encodeURIComponent(SVG_2x1.toString('utf-8'));
		await loadResources([{ type: 'image', src }]);

		const img = imageNode(src, { width: 160 });
		computeLayout(docWith(img));

		expect(img.layout!.width).toBeCloseTo(160, 3);
		expect(img.layout!.height).toBeCloseTo(80, 3);
	});

	it('derives width from height using the intrinsic ratio', async () => {
		const src = 'data:image/svg+xml,' + encodeURIComponent(SVG_2x1.toString('utf-8'));
		await loadResources([{ type: 'image', src }]);

		const img = imageNode(src, { height: 50 });
		computeLayout(docWith(img));

		expect(img.layout!.height).toBeCloseTo(50, 3);
		expect(img.layout!.width).toBeCloseTo(100, 3);
	});

	it('respects both dimensions when explicitly set (no aspect adjustment)', async () => {
		const src = 'data:image/svg+xml,' + encodeURIComponent(SVG_2x1.toString('utf-8'));
		await loadResources([{ type: 'image', src }]);

		const img = imageNode(src, { width: 120, height: 120 });
		computeLayout(docWith(img));

		expect(img.layout!.width).toBeCloseTo(120, 3);
		expect(img.layout!.height).toBeCloseTo(120, 3);
	});
});
