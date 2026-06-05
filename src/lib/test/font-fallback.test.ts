/**
 * Tests for font fallback chains.
 *
 *  1. parseFontFamilies — normalise a fontFamily value into an ordered list.
 *  2. resolveFontStack  — pick the first available (registered or built-in)
 *     family, considering weight/style variants.
 *  3. measurement       — text measures with the first available family and
 *     falls back to Helvetica when none in the stack are available.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
	parseFontFamilies,
	resolveFontStack,
	registerVariantName,
	clearRegisteredVariants
} from '../runtime/font-registry.js';
import { measureText } from '../layout/text-measure.js';
import { loadResources, clearCaches } from '../runtime/resources.js';

const ANDALE = '/System/Library/Fonts/Supplemental/Andale Mono.ttf';

// ── 1. parseFontFamilies ─────────────────────────────────────────────────────────

describe('parseFontFamilies', () => {
	it('wraps a single family in a list', () => {
		expect(parseFontFamilies('Inter')).toEqual(['Inter']);
	});

	it('splits a CSS-style comma string and trims', () => {
		expect(parseFontFamilies('Inter, Helvetica ,Arial')).toEqual(['Inter', 'Helvetica', 'Arial']);
	});

	it('strips surrounding quotes', () => {
		expect(parseFontFamilies('"Times New Roman", Helvetica')).toEqual([
			'Times New Roman',
			'Helvetica'
		]);
	});

	it('passes an array through, trimming and dropping empties', () => {
		expect(parseFontFamilies(['Inter', ' ', 'Helvetica'])).toEqual(['Inter', 'Helvetica']);
	});

	it('defaults to Helvetica for undefined or empty input', () => {
		expect(parseFontFamilies(undefined)).toEqual(['Helvetica']);
		expect(parseFontFamilies('')).toEqual(['Helvetica']);
		expect(parseFontFamilies([])).toEqual(['Helvetica']);
	});
});

// ── 2. resolveFontStack ──────────────────────────────────────────────────────────

describe('resolveFontStack', () => {
	beforeEach(() => clearRegisteredVariants());

	it('resolves a single built-in family and its bold variant', () => {
		expect(resolveFontStack('Helvetica')).toBe('Helvetica');
		expect(resolveFontStack('Helvetica', 'bold')).toBe('Helvetica-Bold');
		expect(resolveFontStack('Courier', 'bold')).toBe('Courier-Bold');
	});

	it('accepts a built-in variant name as the family', () => {
		expect(resolveFontStack('Helvetica-Bold')).toBe('Helvetica-Bold');
	});

	it('skips an unregistered family and uses the next available one', () => {
		expect(resolveFontStack(['Inter', 'Helvetica'])).toBe('Helvetica');
		expect(resolveFontStack('Inter, Helvetica')).toBe('Helvetica');
	});

	it('prefers a registered custom family over later fallbacks', () => {
		registerVariantName('Inter');
		expect(resolveFontStack(['Inter', 'Helvetica'])).toBe('Inter');
	});

	it('matches the registered variant for the requested weight/style', () => {
		registerVariantName('Inter-Bold');
		expect(resolveFontStack(['Inter', 'Helvetica'], 'bold')).toBe('Inter-Bold');
		// Italic variant was not registered → falls through to Helvetica.
		expect(resolveFontStack(['Inter', 'Helvetica'], undefined, 'italic')).toBe('Helvetica-Italic');
	});

	it('returns the first family when none are available', () => {
		expect(resolveFontStack(['Foo', 'Bar'])).toBe('Foo');
	});
});

// ── 3. Measurement uses the resolved family ──────────────────────────────────────

describe('font fallback – measurement', () => {
	beforeEach(() => {
		clearCaches();
		clearRegisteredVariants();
	});

	it('falls back to Helvetica when no family in the stack is available', () => {
		const stacked = measureText('Hello world', { fontFamily: ['Nope', 'AlsoNope', 'Helvetica'], fontSize: 20 }, 0);
		const helvetica = measureText('Hello world', { fontFamily: 'Helvetica', fontSize: 20 }, 0);
		expect(stacked.width).toBeCloseTo(helvetica.width, 3);
	});

	it('measures with the first registered family in the stack', async () => {
		await loadResources([{ type: 'font', name: 'MonoTest', src: ANDALE }]);

		const stacked = measureText('iiiii', { fontFamily: ['MonoTest', 'Helvetica'], fontSize: 20 }, 0);
		const direct = measureText('iiiii', { fontFamily: 'MonoTest', fontSize: 20 }, 0);
		const helvetica = measureText('iiiii', { fontFamily: 'Helvetica', fontSize: 20 }, 0);

		// The stack resolved to the registered monospace font, not Helvetica.
		expect(stacked.width).toBeCloseTo(direct.width, 3);
		expect(stacked.width).not.toBeCloseTo(helvetica.width, 1);
	});
});
