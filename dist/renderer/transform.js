const IDENTITY = [1, 0, 0, 1, 0, 0];
const DEG = Math.PI / 180;
const TRANSFORM_KEYS = [
    'rotate',
    'scale',
    'scaleX',
    'scaleY',
    'translateX',
    'translateY',
    'skewX',
    'skewY'
];
/** True when a style declares any transform that affects the drawn output. */
export function hasTransform(style) {
    return TRANSFORM_KEYS.some((k) => style[k] != null);
}
/**
 * Composes `A ∘ B` (apply B first, then A) in PDF tuple convention.
 */
function multiply(a, b) {
    return [
        a[0] * b[0] + a[2] * b[1],
        a[1] * b[0] + a[3] * b[1],
        a[0] * b[2] + a[2] * b[3],
        a[1] * b[2] + a[3] * b[3],
        a[0] * b[4] + a[2] * b[5] + a[4],
        a[1] * b[4] + a[3] * b[5] + a[5]
    ];
}
/** Resolves one transform-origin token against an axis length, in points. */
function resolveToken(token, length) {
    switch (token) {
        case 'left':
        case 'top':
            return 0;
        case 'center':
            return length / 2;
        case 'right':
        case 'bottom':
            return length;
    }
    if (token.endsWith('%')) {
        return (parseFloat(token) / 100) * length;
    }
    return parseFloat(token);
}
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
export function resolveTransformOrigin(origin, box) {
    if (origin == null) {
        return [box.x + box.width / 2, box.y + box.height / 2];
    }
    if (Array.isArray(origin)) {
        return [box.x + origin[0], box.y + origin[1]];
    }
    const tokens = origin.trim().toLowerCase().split(/\s+/).slice(0, 2);
    // Pin axis-bound keywords to their axis; collect the rest (center, %, points)
    // to fill the remaining axes positionally.
    let xToken;
    let yToken;
    const free = [];
    for (const t of tokens) {
        if (t === 'left' || t === 'right')
            xToken = t;
        else if (t === 'top' || t === 'bottom')
            yToken = t;
        else
            free.push(t);
    }
    for (const t of free) {
        if (xToken === undefined)
            xToken = t;
        else if (yToken === undefined)
            yToken = t;
    }
    const localX = xToken === undefined ? box.width / 2 : resolveToken(xToken, box.width);
    const localY = yToken === undefined ? box.height / 2 : resolveToken(yToken, box.height);
    return [box.x + localX, box.y + localY];
}
/**
 * Builds the affine matrix for a node's transforms, composed about the resolved
 * origin in the fixed order: translate → rotate → scale → skew. Returns the
 * identity matrix when no transform props are present.
 */
export function buildTransformMatrix(style, box) {
    if (!hasTransform(style))
        return IDENTITY;
    const [ox, oy] = resolveTransformOrigin(style.transformOrigin, box);
    let m = IDENTITY;
    if (style.translateX != null || style.translateY != null) {
        m = multiply(m, [1, 0, 0, 1, style.translateX ?? 0, style.translateY ?? 0]);
    }
    if (style.rotate != null) {
        const r = style.rotate * DEG;
        const cos = Math.cos(r);
        const sin = Math.sin(r);
        m = multiply(m, [cos, sin, -sin, cos, 0, 0]);
    }
    const sx = style.scaleX ?? style.scale;
    const sy = style.scaleY ?? style.scale;
    if (sx != null || sy != null) {
        m = multiply(m, [sx ?? 1, 0, 0, sy ?? 1, 0, 0]);
    }
    if (style.skewX != null || style.skewY != null) {
        const tx = style.skewX != null ? Math.tan(style.skewX * DEG) : 0;
        const ty = style.skewY != null ? Math.tan(style.skewY * DEG) : 0;
        m = multiply(m, [1, ty, tx, 1, 0, 0]);
    }
    // Apply the composed transform about the origin: T(o) · M · T(-o).
    m = multiply([1, 0, 0, 1, ox, oy], m);
    m = multiply(m, [1, 0, 0, 1, -ox, -oy]);
    return m;
}
