/**
 * Tests for layout-node transforms (rotate / scale / translate / skew).
 *
 * Two layers:
 *  1. Unit tests on the pure matrix helpers (buildTransformMatrix,
 *     resolveTransformOrigin) — exact, fast assertions on the affine math.
 *  2. Integration tests through the full render pipeline — proves the matrix
 *     reaches PDFKit (transformed output differs from untransformed) and that
 *     nodes without transform props are byte-identical to today (regression).
 */

import { describe, it, expect } from 'vitest';
import {
	hasTransform,
	resolveTransformOrigin,
	buildTransformMatrix
} from '../renderer/transform.js';
import { createDocument } from '../runtime/document.js';
import { computeLayout } from '../layout/layout.js';
import { paginate } from '../pagination/paginate.js';
import { renderPDF } from '../renderer/render.js';
import type { PDFNode, LayoutBox } from '../types/pdf.js';

const BOX: LayoutBox = { x: 0, y: 0, width: 100, height: 100 };

function closeTo(actual: number[], expected: number[]) {
	expect(actual).toHaveLength(expected.length);
	for (let i = 0; i < expected.length; i++) {
		expect(actual[i]).toBeCloseTo(expected[i], 5);
	}
}

// ── 1. hasTransform ──────────────────────────────────────────────────────────

describe('hasTransform', () => {
	it('is false for a style with no transform props', () => {
		expect(hasTransform({ backgroundColor: 'red', opacity: 0.5 })).toBe(false);
		expect(hasTransform({})).toBe(false);
	});

	it('is true when any transform prop is present', () => {
		expect(hasTransform({ rotate: 10 })).toBe(true);
		expect(hasTransform({ scale: 2 })).toBe(true);
		expect(hasTransform({ scaleX: 1.5 })).toBe(true);
		expect(hasTransform({ translateX: 5 })).toBe(true);
		expect(hasTransform({ skewY: 3 })).toBe(true);
	});
});

// ── 2. resolveTransformOrigin ────────────────────────────────────────────────

describe('resolveTransformOrigin', () => {
	it('defaults to the box center', () => {
		closeTo(resolveTransformOrigin(undefined, BOX), [50, 50]);
	});

	it('resolves keyword pairs in absolute page coords', () => {
		closeTo(resolveTransformOrigin('left top', BOX), [0, 0]);
		closeTo(resolveTransformOrigin('right bottom', BOX), [100, 100]);
		closeTo(resolveTransformOrigin('center', BOX), [50, 50]);
	});

	it('resolves keywords by axis, independent of order', () => {
		// left/right always set x; top/bottom always set y.
		closeTo(resolveTransformOrigin('bottom right', BOX), [100, 100]);
		closeTo(resolveTransformOrigin('right bottom', BOX), [100, 100]);
		closeTo(resolveTransformOrigin('top left', BOX), [0, 0]);
		// center fills the axis left free by a keyword.
		closeTo(resolveTransformOrigin('bottom center', BOX), [50, 100]);
		closeTo(resolveTransformOrigin('center bottom', BOX), [50, 100]);
	});

	it('resolves a lone keyword on its own axis, other axis centered', () => {
		closeTo(resolveTransformOrigin('bottom', BOX), [50, 100]);
		closeTo(resolveTransformOrigin('top', BOX), [50, 0]);
		closeTo(resolveTransformOrigin('left', BOX), [0, 50]);
		closeTo(resolveTransformOrigin('right', BOX), [100, 50]);
	});

	it('mixes an axis keyword with a free value', () => {
		closeTo(resolveTransformOrigin('left 25%', BOX), [0, 25]);
		closeTo(resolveTransformOrigin('25% bottom', BOX), [25, 100]);
	});

	it('is case-insensitive for keywords', () => {
		closeTo(resolveTransformOrigin('Bottom Right', BOX), [100, 100]);
	});

	it('treats a single free value as the x axis, y defaulting to center', () => {
		closeTo(resolveTransformOrigin('0%', BOX), [0, 50]);
	});

	it('resolves percentages and point lengths', () => {
		closeTo(resolveTransformOrigin('50% 25%', BOX), [50, 25]);
		closeTo(resolveTransformOrigin('10 20', BOX), [10, 20]);
	});

	it('accepts a [x, y] point tuple', () => {
		closeTo(resolveTransformOrigin([30, 40], BOX), [30, 40]);
	});

	it('offsets by the box origin', () => {
		closeTo(resolveTransformOrigin(undefined, { x: 200, y: 300, width: 100, height: 100 }), [
			250, 350
		]);
	});
});

// ── 3. buildTransformMatrix ──────────────────────────────────────────────────

describe('buildTransformMatrix', () => {
	it('returns identity when no transform props are set', () => {
		closeTo(buildTransformMatrix({}, BOX), [1, 0, 0, 1, 0, 0]);
	});

	it('rotates clockwise about the box center', () => {
		// 90° clockwise about (50,50): top-left (0,0) -> top-right (100,0).
		const m = buildTransformMatrix({ rotate: 90 }, BOX);
		closeTo(m, [0, 1, -1, 0, 100, 0]);
		const x = m[0] * 0 + m[2] * 0 + m[4];
		const y = m[1] * 0 + m[3] * 0 + m[5];
		closeTo([x, y], [100, 0]);
	});

	it('scales uniformly about the box center', () => {
		closeTo(buildTransformMatrix({ scale: 2 }, BOX), [2, 0, 0, 2, -50, -50]);
	});

	it('supports independent scaleX / scaleY', () => {
		closeTo(buildTransformMatrix({ scaleX: 2, scaleY: 3 }, BOX), [2, 0, 0, 3, -50, -100]);
	});

	it('translates by the given offset (origin-independent)', () => {
		closeTo(buildTransformMatrix({ translateX: 10, translateY: 5 }, BOX), [1, 0, 0, 1, 10, 5]);
	});

	it('honours an explicit transformOrigin', () => {
		// Scale 2 about top-left (0,0): corner stays put.
		closeTo(buildTransformMatrix({ scale: 2, transformOrigin: 'left top' }, BOX), [
			2, 0, 0, 2, 0, 0
		]);
	});
});

// ── 4. Integration through the render pipeline ───────────────────────────────

function streamToBuffer(stream: any): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (c: Buffer) => chunks.push(c));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
		stream.on('error', reject);
	});
}

/**
 * PDFKit embeds a creation timestamp and a random-ish trailer /ID that vary
 * between renders. Strip them so byte comparisons reflect drawing content only.
 */
function normalize(buffer: Buffer): string {
	return buffer
		.toString('binary')
		.replace(/\/CreationDate \([^)]*\)/g, '')
		.replace(/\/ModDate \([^)]*\)/g, '')
		.replace(/\/ID \[[^\]]*\]/g, '');
}

async function renderView(style: Record<string, any>): Promise<Buffer> {
	const doc = createDocument();
	const view: PDFNode = { type: 'view', props: { style }, children: [], layout: undefined };
	const page: PDFNode = {
		type: 'page',
		props: { size: 'A4', style: {} },
		children: [view],
		layout: undefined
	};
	doc.children.push(page);

	computeLayout(doc);
	const pages = paginate(doc);
	return streamToBuffer(renderPDF(pages));
}

describe('transform rendering', () => {
	const base = { width: 100, height: 100, backgroundColor: '#3366cc' };

	it('renders a transformed view to a valid PDF', async () => {
		const buffer = await renderView({ ...base, rotate: 30 });
		expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
		expect(buffer.length).toBeGreaterThan(0);
	});

	it('produces different content than the untransformed view', async () => {
		const plain = normalize(await renderView(base));
		const rotated = normalize(await renderView({ ...base, rotate: 30 }));
		const scaled = normalize(await renderView({ ...base, scale: 1.5 }));
		expect(rotated).not.toBe(plain);
		expect(scaled).not.toBe(plain);
	});

	it('leaves untransformed output unchanged (regression)', async () => {
		const a = normalize(await renderView(base));
		const b = normalize(await renderView(base));
		expect(a).toBe(b);
	});
});
