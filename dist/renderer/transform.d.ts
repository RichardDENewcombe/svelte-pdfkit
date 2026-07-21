import type { LayoutBox, StyleProps } from '../types/pdf.js';
/**
 * Layout-node transforms (rotate / scale / translate / skew).
 *
 * Transforms are a render-time concern only — they never feed into Yoga layout,
 * so a transformed node still occupies its original layout slot (matching CSS
 * `transform`). The matrix produced here is applied around a node's draw via
 * PDFKit's `doc.transform(...)`.
 *
 * Matrices use the PDF 6-tuple convention `[a, b, c, d, e, f]`, where a point
 * `(x, y)` maps to `(a·x + c·y + e, b·x + d·y + f)`. PDFKit's coordinate system
 * has its origin at the top-left with y increasing downward, so the standard
 * counter-clockwise rotation matrix reads as a clockwise rotation on the page —
 * which is what `rotate` (positive = clockwise) promises.
 */
type Matrix = [number, number, number, number, number, number];
/** True when a style declares any transform that affects the drawn output. */
export declare function hasTransform(style: StyleProps): boolean;
/**
 * Resolves `transformOrigin` to an absolute page coordinate `[x, y]` (the box's
 * top-left plus the local pivot). Defaults to the box center.
 *
 * Keyword resolution is axis-aware and order-independent, matching CSS: `left`
 * and `right` always set the x axis, `top` and `bottom` always set the y axis,
 * and `center` plus percentage/point values fill whichever axis is still free
 * (in source order). So `'bottom right'` === `'right bottom'`, a lone `'bottom'`
 * resolves to bottom-centre, and any axis left unspecified defaults to centre.
 * Keywords are case-insensitive. Up to two tokens are read; extras are ignored.
 */
export declare function resolveTransformOrigin(origin: string | [number, number] | undefined, box: LayoutBox): [number, number];
/**
 * Builds the affine matrix for a node's transforms, composed about the resolved
 * origin in the fixed order: translate → rotate → scale → skew. Returns the
 * identity matrix when no transform props are present.
 */
export declare function buildTransformMatrix(style: StyleProps, box: LayoutBox): Matrix;
export {};
