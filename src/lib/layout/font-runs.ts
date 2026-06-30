/**
 * Splitting text into per-font runs for glyph-level fallback (Issue #1).
 *
 * Family-level fallback resolves one font for an entire text node. Glyph-level
 * fallback instead walks the same `fontFamily` stack per grapheme: each cluster
 * keeps the first available family that has glyphs for *all* its code points,
 * dropping to later families only for the code points earlier ones lack.
 *
 * Splitting is done on grapheme clusters (via Intl.Segmenter), never raw code
 * points, so combining accents, flag emoji and skin-tone sequences are never
 * divided across two fonts — which would break their rendering.
 */

import {
	parseFontFamilies,
	resolveFont,
	resolveFontStack,
	isFamilyAvailable
} from '../runtime/font-registry.js';
import { fontCovers } from '../runtime/glyph-coverage.js';

/** A maximal stretch of text rendered in a single resolved PDFKit font. */
export interface FontRun {
	text: string;
	/** Resolved PDFKit variant name, e.g. "Inter-Bold". */
	font: string;
}

// One grapheme segmenter, reused across calls (construction is not free).
let _segmenter: Intl.Segmenter | null = null;
function graphemes(text: string): string[] {
	if (!_segmenter) _segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
	const out: string[] = [];
	for (const { segment } of _segmenter.segment(text)) out.push(segment);
	return out;
}

/** True when every code point in `cluster` has a glyph in `variant`. */
function fontCoversCluster(variant: string, cluster: string): boolean {
	for (const ch of cluster) {
		if (!fontCovers(variant, ch.codePointAt(0)!)) return false;
	}
	return true;
}

/**
 * Splits `text` into per-font runs by walking the `fontFamily` fallback stack
 * per grapheme.
 *
 * The returned runs always concatenate back to `text`. When the stack has only
 * one available family, or the primary covers every glyph, a single run is
 * returned — the common case, letting callers take their existing single-font
 * fast path.
 */
export function splitFontRuns(
	text: string,
	fontFamily: string | string[] | undefined,
	weight?: string,
	style?: string
): FontRun[] {
	if (!text) return [];

	// Ordered list of available candidate variants (deduped, order preserved).
	const candidates: string[] = [];
	for (const family of parseFontFamilies(fontFamily)) {
		if (!isFamilyAvailable(family, weight, style)) continue;
		const variant = resolveFont(family, weight, style);
		if (!candidates.includes(variant)) candidates.push(variant);
	}

	// Terminal pick when no candidate covers a cluster (guaranteed selectable;
	// the renderer's try/catch backstops to Helvetica if even this fails).
	const fallback = resolveFontStack(fontFamily, weight, style);

	// Fast path: nothing to choose between — one font for the whole string.
	if (candidates.length <= 1) {
		return [{ text, font: candidates[0] ?? fallback }];
	}

	const runs: FontRun[] = [];
	for (const cluster of graphemes(text)) {
		// Whitespace is font-neutral: every font renders a space identically, so it
		// must never trigger a font switch. Keeping it in the current run also
		// avoids a leading space on the next run — PDFKit drops those when chaining
		// `continued` fragments, which would visually merge words across a font
		// boundary. A leading whitespace cluster (no current run) falls through and
		// picks a font normally.
		const last = runs[runs.length - 1];
		if (last && /^\s+$/.test(cluster)) {
			last.text += cluster;
			continue;
		}
		const font = candidates.find((v) => fontCoversCluster(v, cluster)) ?? fallback;
		if (last && last.font === font) last.text += cluster;
		else runs.push({ text: cluster, font });
	}
	return runs;
}

/**
 * Sum of `widthOfString` for each run measured under its own font. Mutates the
 * measure/render doc's current font as a side effect (callers re-apply font as
 * needed afterwards), mirroring how single-font measurement already works.
 */
export function widthOfRuns(doc: any, runs: FontRun[], opts?: Record<string, any>): number {
	let total = 0;
	for (const run of runs) {
		doc.font(run.font);
		total += doc.widthOfString(run.text, opts);
	}
	return total;
}
