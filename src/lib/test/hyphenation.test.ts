/**
 * Tests for dictionary hyphenation in line wrapping.
 *
 * Covers:
 *   1. hyphenateWord()   — dictionary split points, gb/us difference, guards.
 *   2. wrapLinesMeta()   — overflowing words break with a trailing hyphen only
 *                          when `hyphenation` is enabled; off by default.
 *   3. custom callback   — registerHyphenationCallback overrides the dictionary.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { wrapLines, wrapLinesMeta, measureText } from '../layout/text-measure.js';
import {
	hyphenateWord,
	registerHyphenationCallback,
	setDefaultHyphenationLang
} from '../layout/hyphenation.js';

const BASE_STYLE = { fontSize: 12, fontFamily: 'Helvetica' };

afterEach(() => {
	// Reset module-level state so tests don't leak into each other.
	registerHyphenationCallback(null);
	setDefaultHyphenationLang('en-gb');
});

// ── 1. hyphenateWord ─────────────────────────────────────────────────────────

describe('hyphenateWord', () => {
	it('splits a word into parts that rejoin to the original', () => {
		const parts = hyphenateWord('hyphenation');
		expect(parts.length).toBeGreaterThan(1);
		expect(parts.join('')).toBe('hyphenation');
	});

	it('uses British patterns by default and American when asked', () => {
		expect(hyphenateWord('knowledge', 'en-gb').join('-')).toBe('know-ledge');
		expect(hyphenateWord('knowledge', 'en-us').join('-')).toBe('knowl-edge');
		// Default (en-gb) matches the explicit gb call.
		expect(hyphenateWord('knowledge')).toEqual(hyphenateWord('knowledge', 'en-gb'));
	});

	it('does not break very short words', () => {
		expect(hyphenateWord('the')).toEqual(['the']);
		expect(hyphenateWord('cat')).toEqual(['cat']);
	});

	it('preserves surrounding punctuation on the outer parts', () => {
		const parts = hyphenateWord('(responsibility),');
		expect(parts.join('')).toBe('(responsibility),');
		expect(parts[0].startsWith('(')).toBe(true);
		expect(parts[parts.length - 1].endsWith('),')).toBe(true);
	});

	it('honours setDefaultHyphenationLang', () => {
		setDefaultHyphenationLang('en-us');
		expect(hyphenateWord('knowledge').join('-')).toBe('knowl-edge');
	});
});

// ── 2. wrapLinesMeta with hyphenation ──────────────────────────────────────────

describe('wrapLinesMeta – hyphenation', () => {
	// A width that fits "hy-" but not the whole word "hyphenation".
	const NARROW = 30;

	it('does NOT break words when hyphenation is disabled (default)', () => {
		const lines = wrapLines('hyphenation', BASE_STYLE, NARROW);
		// Single overlong word stays whole on its own line.
		expect(lines).toEqual(['hyphenation']);
	});

	it('breaks an overlong word with a trailing hyphen when enabled', () => {
		const style = { ...BASE_STYLE, hyphenation: true };
		const lines = wrapLines('hyphenation', style, NARROW);

		expect(lines.length).toBeGreaterThan(1);
		// Every line except the last ends with a hyphen.
		for (let i = 0; i < lines.length - 1; i++) {
			expect(lines[i].endsWith('-')).toBe(true);
		}
		expect(lines[lines.length - 1].endsWith('-')).toBe(false);
		// Stripping the inserted hyphens reconstructs the original word.
		expect(lines.join('').replace(/-/g, '')).toBe('hyphenation');
	});

	it('breaks a trailing word onto the current line rather than the next', () => {
		const style = { ...BASE_STYLE, hyphenation: true };
		// Wide enough for "a hyphen-" together but not "a hyphenation".
		const lines = wrapLines('a hyphenation', style, 55);
		expect(lines[0].startsWith('a ')).toBe(true);
		expect(lines[0].endsWith('-')).toBe(true);
		// Joining with a space between lines and stripping the inserted hyphen
		// reconstructs the original text (the mid-line space is preserved).
		expect(lines.join('').replace(/-/g, '')).toBe('a hyphenation');
	});

	it('keeps every wrapped line within the max width', () => {
		const style = { ...BASE_STYLE, hyphenation: true };
		const text = 'extraordinarily complicated responsibilities notwithstanding';
		const maxWidth = 80;
		const lines = wrapLinesMeta(text, style, maxWidth);
		// Re-measure each produced line; none may exceed the width.
		for (const line of lines) {
			expect(getWidth(line.text, style)).toBeLessThanOrEqual(maxWidth + 0.01);
		}
	});

	it('marks only the final line of a paragraph as lastInParagraph', () => {
		const style = { ...BASE_STYLE, hyphenation: true };
		const lines = wrapLinesMeta('hyphenation', style, NARROW);
		const flags = lines.map((l) => l.lastInParagraph);
		expect(flags.slice(0, -1).every((f) => f === false)).toBe(true);
		expect(flags[flags.length - 1]).toBe(true);
	});

	it('does not lose characters: hyphenated wrap round-trips the text', () => {
		const style = { ...BASE_STYLE, hyphenation: true };
		const text = 'internationalisation';
		const lines = wrapLines(text, style, NARROW);
		expect(lines.join('').replace(/-/g, '')).toBe(text);
	});
});

// ── 3. custom callback ─────────────────────────────────────────────────────────

describe('registerHyphenationCallback', () => {
	it('overrides the bundled dictionary', () => {
		// Break strictly in the middle, ignoring language patterns.
		registerHyphenationCallback((word) => {
			const mid = Math.ceil(word.length / 2);
			return [word.slice(0, mid), word.slice(mid)];
		});
		expect(hyphenateWord('abcdef')).toEqual(['abc', 'def']);
	});

	it('falls back to [word] when the callback returns nothing', () => {
		registerHyphenationCallback(() => []);
		expect(hyphenateWord('hyphenation')).toEqual(['hyphenation']);
	});
});

// Natural rendered width of a string, via the same PDFKit measure doc the
// wrapper uses (unconstrained measureText returns widthOfString).
function getWidth(text: string, style: Record<string, any>): number {
	return measureText(text, style).width;
}
