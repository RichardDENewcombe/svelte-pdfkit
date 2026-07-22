import type { PDFNode } from '../types/pdf.js';
/**
 * Parses an SVG `points` attribute string into an array of [x, y] pairs.
 *
 * Handles all valid SVG points formats:
 *   "10,20 30,40"      — comma-separated pairs
 *   "10 20 30 40"      — space-separated values
 *   "10,20 30 40,50"   — mixed
 *
 * Unpaired trailing values are discarded.
 */
export declare function parsePoints(points: string): [number, number][];
/**
 * Extracts the id from a `url(#id)` reference.
 * Returns `null` for plain colors, `none`, `transparent`, or `undefined`.
 */
export declare function parseUrlRef(value: string | undefined): string | null;
/**
 * Parses an SVG `viewBox` ("min-x min-y width height") into its four numbers.
 * Accepts comma- or space-separated values. Returns `null` if it isn't four
 * finite numbers.
 */
export declare function parseViewBox(value: string | undefined): {
    minX: number;
    minY: number;
    width: number;
    height: number;
} | null;
/**
 * Renders an `svg` PDFNode at its Yoga-computed position.
 *
 * All SVG child coordinates are relative to the SVG viewport origin.
 * We translate the PDFKit CTM so that (0, 0) inside the SVG maps to
 * the top-left corner of the Yoga-allocated box.
 */
export declare function drawSvg(doc: any, node: PDFNode): void;
