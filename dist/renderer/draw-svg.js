import { resolveFont } from '../runtime/font-registry.js';
// ── Points parser ─────────────────────────────────────────────────────────────
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
export function parsePoints(points) {
    const nums = points.trim().split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
    const result = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
        result.push([nums[i], nums[i + 1]]);
    }
    return result;
}
// ── URL reference parser ───────────────────────────────────────────────────────
/**
 * Extracts the id from a `url(#id)` reference.
 * Returns `null` for plain colors, `none`, `transparent`, or `undefined`.
 */
export function parseUrlRef(value) {
    if (!value)
        return null;
    const match = value.match(/^url\(#([^)]+)\)$/);
    return match ? match[1] : null;
}
/**
 * Walks the SVG children to find all `svg_defs` nodes.
 * Creates PDFKit gradient objects and registers clip path nodes by id.
 */
function collectDefs(children, doc) {
    const registry = new Map();
    for (const child of children) {
        if (child.type !== 'svg_defs')
            continue;
        for (const def of child.children) {
            if (def.type === 'svg_linear_gradient') {
                const { id, x1, y1, x2, y2 } = def.props;
                const grad = doc.linearGradient(x1 ?? 0, y1 ?? 0, x2 ?? 0, y2 ?? 0);
                for (const stop of def.children) {
                    if (stop.type === 'svg_stop') {
                        grad.stop(stop.props.offset ?? 0, stop.props.stopColor ?? 'black', stop.props.stopOpacity ?? 1);
                    }
                }
                registry.set(id, grad);
            }
            else if (def.type === 'svg_radial_gradient') {
                const { id, cx, cy, r, fx, fy } = def.props;
                // PDFKit radialGradient(x1, y1, r1, x2, y2, r2) — inner point with r=0, outer with r
                const grad = doc.radialGradient(fx ?? cx ?? 0, fy ?? cy ?? 0, 0, cx ?? 0, cy ?? 0, r ?? 0);
                for (const stop of def.children) {
                    if (stop.type === 'svg_stop') {
                        grad.stop(stop.props.offset ?? 0, stop.props.stopColor ?? 'black', stop.props.stopOpacity ?? 1);
                    }
                }
                registry.set(id, grad);
            }
            else if (def.type === 'svg_clip_path') {
                registry.set(def.props.id, def);
            }
        }
    }
    return registry;
}
// ── Paint helpers ─────────────────────────────────────────────────────────────
/** Returns true if the value means "no paint" in SVG — i.e. transparent / none. */
function isNoPaint(value) {
    return value === 'transparent' || value === 'none';
}
function applyPaint(doc, fill, stroke, strokeWidth, opacity, defs) {
    if (opacity != null)
        doc.opacity(opacity);
    if (strokeWidth != null)
        doc.lineWidth(strokeWidth);
    // Resolve url(#id) references to pre-created gradient objects
    const fillRef = parseUrlRef(fill);
    const strokeRef = parseUrlRef(stroke);
    const resolvedFill = fillRef ? defs.get(fillRef) : fill;
    const resolvedStroke = strokeRef ? defs.get(strokeRef) : stroke;
    const hasFill = resolvedFill != null && !isNoPaint(fill);
    const hasStroke = resolvedStroke != null && !isNoPaint(stroke);
    if (hasFill && hasStroke) {
        doc.fillAndStroke(resolvedFill, resolvedStroke);
    }
    else if (hasFill) {
        doc.fill(resolvedFill);
    }
    else if (hasStroke) {
        doc.stroke(resolvedStroke);
    }
    else if (fill == null && stroke == null) {
        // SVG spec default when neither is specified: black fill.
        doc.fill('black');
    }
    // If fill/stroke are explicitly "none"/"transparent", draw nothing.
}
// ── Clip path application ─────────────────────────────────────────────────────
/**
 * Draws clip path shape geometry (without paint) and calls doc.clip().
 * Must be called after doc.save() and before the clipped shape is drawn.
 */
function applyClipPath(doc, clipNode, defs) {
    for (const shape of clipNode.children) {
        drawSvgNode(doc, shape, defs, true);
    }
    doc.clip();
}
// ── SVG node renderer ─────────────────────────────────────────────────────────
function drawSvgNode(doc, node, defs, asClip = false) {
    const { type, props } = node;
    doc.save();
    // Apply clip path if referenced
    if (!asClip && props.clipPath) {
        const clipId = parseUrlRef(props.clipPath);
        if (clipId) {
            const clipDef = defs.get(clipId);
            if (clipDef && clipDef.type === 'svg_clip_path') {
                applyClipPath(doc, clipDef, defs);
            }
        }
    }
    switch (type) {
        case 'svg_path': {
            if (props.d) {
                doc.path(props.d);
                if (!asClip)
                    applyPaint(doc, props.fill, props.stroke, props.strokeWidth, props.opacity, defs);
            }
            break;
        }
        case 'svg_circle': {
            doc.circle(props.cx ?? 0, props.cy ?? 0, props.r ?? 0);
            if (!asClip)
                applyPaint(doc, props.fill, props.stroke, props.strokeWidth, props.opacity, defs);
            break;
        }
        case 'svg_rect': {
            if (props.rx != null || props.ry != null) {
                // PDFKit roundedRect takes a single corner radius; average rx/ry.
                const r = ((props.rx ?? props.ry ?? 0) + (props.ry ?? props.rx ?? 0)) / 2;
                doc.roundedRect(props.x ?? 0, props.y ?? 0, props.width ?? 0, props.height ?? 0, r);
            }
            else {
                doc.rect(props.x ?? 0, props.y ?? 0, props.width ?? 0, props.height ?? 0);
            }
            if (!asClip)
                applyPaint(doc, props.fill, props.stroke, props.strokeWidth, props.opacity, defs);
            break;
        }
        case 'svg_ellipse': {
            doc.ellipse(props.cx ?? 0, props.cy ?? 0, props.rx ?? 0, props.ry ?? props.rx ?? 0);
            if (!asClip)
                applyPaint(doc, props.fill, props.stroke, props.strokeWidth, props.opacity, defs);
            break;
        }
        case 'svg_line': {
            doc.moveTo(props.x1 ?? 0, props.y1 ?? 0).lineTo(props.x2 ?? 0, props.y2 ?? 0);
            if (!asClip) {
                // Lines have no fill surface; fall back to black stroke if none specified.
                if (props.opacity != null)
                    doc.opacity(props.opacity);
                if (props.strokeWidth != null)
                    doc.lineWidth(props.strokeWidth);
                doc.stroke(props.stroke ?? 'black');
            }
            break;
        }
        case 'svg_polyline': {
            const pts = parsePoints(props.points ?? '');
            if (pts.length >= 2) {
                doc.moveTo(pts[0][0], pts[0][1]);
                for (let i = 1; i < pts.length; i++)
                    doc.lineTo(pts[i][0], pts[i][1]);
                if (!asClip)
                    applyPaint(doc, props.fill, props.stroke, props.strokeWidth, props.opacity, defs);
            }
            break;
        }
        case 'svg_polygon': {
            const pts = parsePoints(props.points ?? '');
            if (pts.length >= 2) {
                doc.moveTo(pts[0][0], pts[0][1]);
                for (let i = 1; i < pts.length; i++)
                    doc.lineTo(pts[i][0], pts[i][1]);
                doc.closePath();
                if (!asClip)
                    applyPaint(doc, props.fill, props.stroke, props.strokeWidth, props.opacity, defs);
            }
            break;
        }
        case 'svg_g': {
            // Group — no geometry of its own, just recurse into children.
            for (const child of node.children) {
                drawSvgNode(doc, child, defs, asClip);
            }
            break;
        }
        case 'svg_text': {
            const { x = 0, y = 0, text, fontSize = 12, fontFamily = 'Helvetica', fontWeight, fill, opacity, textAnchor = 'start' } = props;
            const fontName = resolveFont(fontFamily, fontWeight, undefined);
            try {
                doc.font(fontName);
            }
            catch {
                try {
                    doc.font(fontFamily);
                }
                catch {
                    doc.font('Helvetica');
                }
            }
            doc.fontSize(fontSize);
            const effectiveFill = fill ?? 'black';
            if (!isNoPaint(effectiveFill))
                doc.fillColor(effectiveFill);
            if (opacity != null)
                doc.opacity(opacity);
            const tspans = node.children.filter((c) => c.type === 'svg_tspan');
            if (tspans.length > 0) {
                let cursorX = x;
                let cursorY = y;
                for (const tspan of tspans) {
                    const tp = tspan.props;
                    const tx = tp.x != null ? tp.x : cursorX + (tp.dx ?? 0);
                    const ty = tp.y != null ? tp.y : cursorY + (tp.dy ?? 0);
                    const tFontFamily = tp.fontFamily ?? fontFamily;
                    const tFontWeight = tp.fontWeight ?? fontWeight;
                    const tFontSize = tp.fontSize ?? fontSize;
                    const tFill = tp.fill ?? fill ?? 'black';
                    const tFontName = resolveFont(tFontFamily, tFontWeight, undefined);
                    try {
                        doc.font(tFontName);
                    }
                    catch {
                        try {
                            doc.font(tFontFamily);
                        }
                        catch {
                            doc.font('Helvetica');
                        }
                    }
                    doc.fontSize(tFontSize);
                    if (!isNoPaint(tFill))
                        doc.fillColor(tFill);
                    if (tp.opacity != null)
                        doc.opacity(tp.opacity);
                    const tText = tp.text ?? '';
                    doc.text(tText, tx, ty, { lineBreak: false });
                    cursorX = tx + doc.widthOfString(tText);
                    cursorY = ty;
                }
            }
            else if (text) {
                let adjustedX = x;
                if (textAnchor === 'middle') {
                    adjustedX = x - doc.widthOfString(text) / 2;
                }
                else if (textAnchor === 'end') {
                    adjustedX = x - doc.widthOfString(text);
                }
                doc.text(text, adjustedX, y, { lineBreak: false });
            }
            break;
        }
    }
    doc.restore();
}
// ── Public API ────────────────────────────────────────────────────────────────
/**
 * Renders an `svg` PDFNode at its Yoga-computed position.
 *
 * All SVG child coordinates are relative to the SVG viewport origin.
 * We translate the PDFKit CTM so that (0, 0) inside the SVG maps to
 * the top-left corner of the Yoga-allocated box.
 */
export function drawSvg(doc, node) {
    const { x = 0, y = 0 } = node.layout ?? {};
    // Collection pass: build defs registry before any drawing occurs.
    const defs = collectDefs(node.children, doc);
    doc.save();
    doc.translate(x, y);
    for (const child of node.children) {
        if (child.type !== 'svg_defs')
            drawSvgNode(doc, child, defs);
    }
    doc.restore();
}
