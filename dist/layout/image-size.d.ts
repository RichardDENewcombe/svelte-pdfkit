/**
 * Intrinsic image dimensions for PNG, JPEG, and SVG buffers.
 *
 * Used by the layout engine to set a Yoga aspect ratio on `<Image>` nodes so a
 * caller can specify just one of width/height and have the other derived,
 * preserving the image's natural proportions. No external dependency — the
 * parsers read only the header bytes each format needs.
 */
export interface ImageDimensions {
    width: number;
    height: number;
}
/** Returns the intrinsic dimensions of an image buffer, or null if unknown. */
export declare function imageSize(buffer: Buffer): ImageDimensions | null;
/** Returns the width/height aspect ratio of an image buffer, or null. */
export declare function imageAspectRatio(buffer: Buffer): number | null;
