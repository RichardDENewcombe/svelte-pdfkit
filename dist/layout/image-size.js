/**
 * Intrinsic image dimensions for PNG, JPEG, and SVG buffers.
 *
 * Used by the layout engine to set a Yoga aspect ratio on `<Image>` nodes so a
 * caller can specify just one of width/height and have the other derived,
 * preserving the image's natural proportions. No external dependency — the
 * parsers read only the header bytes each format needs.
 */
// ── PNG ─────────────────────────────────────────────────────────────────────────
function isPng(b) {
    // 89 50 4E 47 0D 0A 1A 0A
    return (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47 && b.readUInt32BE(4) === 0x0d0a1a0a);
}
function pngSize(b) {
    // IHDR is the first chunk: width/height are big-endian uint32 at byte 16/20.
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}
// ── JPEG ────────────────────────────────────────────────────────────────────────
function isJpeg(b) {
    return b.length >= 2 && b[0] === 0xff && b[1] === 0xd8;
}
function jpegSize(b) {
    let offset = 2; // skip SOI (FF D8)
    while (offset < b.length) {
        if (b[offset] !== 0xff) {
            offset++;
            continue;
        }
        let marker = b[offset + 1];
        // Skip any fill bytes (0xFF) before the marker.
        while (marker === 0xff && offset + 2 < b.length) {
            offset++;
            marker = b[offset + 1];
        }
        offset += 2;
        // Standalone markers (SOI, EOI, RSTn, TEM) carry no length payload.
        if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
            continue;
        }
        if (offset + 1 >= b.length)
            break;
        const len = b.readUInt16BE(offset);
        // SOF markers (C0–CF except C4/C8/CC) carry the frame dimensions.
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
            if (offset + 5 >= b.length)
                break;
            return { height: b.readUInt16BE(offset + 3), width: b.readUInt16BE(offset + 5) };
        }
        offset += len;
    }
    return null;
}
// ── SVG ─────────────────────────────────────────────────────────────────────────
function svgSize(b) {
    const head = b.subarray(0, 2048).toString('utf-8');
    const tagMatch = head.match(/<svg\b[^>]*>/i);
    if (!tagMatch)
        return null;
    const tag = tagMatch[0];
    // Prefer viewBox (min-x min-y width height) for the true aspect ratio.
    const vb = tag.match(/viewBox\s*=\s*["']\s*[-\d.eE]+[\s,]+[-\d.eE]+[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)\s*["']/i);
    if (vb) {
        const w = parseFloat(vb[1]);
        const h = parseFloat(vb[2]);
        if (w > 0 && h > 0)
            return { width: w, height: h };
    }
    // Fall back to width/height attributes (strip units like px).
    const wAttr = tag.match(/\bwidth\s*=\s*["']?\s*([\d.]+)/i);
    const hAttr = tag.match(/\bheight\s*=\s*["']?\s*([\d.]+)/i);
    if (wAttr && hAttr) {
        const w = parseFloat(wAttr[1]);
        const h = parseFloat(hAttr[1]);
        if (w > 0 && h > 0)
            return { width: w, height: h };
    }
    return null;
}
// ── Public API ────────────────────────────────────────────────────────────────
/** Returns the intrinsic dimensions of an image buffer, or null if unknown. */
export function imageSize(buffer) {
    if (isPng(buffer))
        return pngSize(buffer);
    if (isJpeg(buffer))
        return jpegSize(buffer);
    return svgSize(buffer);
}
/** Returns the width/height aspect ratio of an image buffer, or null. */
export function imageAspectRatio(buffer) {
    const size = imageSize(buffer);
    if (!size || size.width <= 0 || size.height <= 0)
        return null;
    return size.width / size.height;
}
