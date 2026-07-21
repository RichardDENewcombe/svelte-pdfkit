import type { PDFNode } from '../types/pdf.js';
/**
 * Returns true when an image source should be rendered as vector SVG rather
 * than a raster bitmap.
 *
 * Detection order: a `.svg` extension, an `image/svg+xml` data URI, then a
 * content sniff of the buffer's first bytes for an `<svg` tag (covering sources
 * with no telltale extension, e.g. some URLs). Raster buffers decoded as UTF-8
 * are binary garbage and will not match the sniff.
 */
export declare function isSvgImage(src: string, buffer: Buffer): boolean;
export declare function drawImage(doc: any, node: PDFNode): void;
