import { resolveFontStack } from '../runtime/font-registry.js';
import { wrapLinesMeta, WRAP_TOLERANCE } from '../layout/text-measure.js';
import { splitFontRuns, widthOfRuns } from '../layout/font-runs.js';
export function drawText(doc, node, pageNumber = 1, totalPages = 1, pageOf = () => undefined) {
    const { style = {} } = node.props;
    const { x = 0, y = 0, width = 0 } = node.layout ?? {};
    // Resolve the text string — either static or from a render-prop function.
    const text = typeof node.props.render === 'function'
        ? node.props.render({ pageNumber, totalPages, pageOf })
        : (node.props.text ?? '');
    if (!text)
        return;
    const fontSize = style.fontSize ?? 12;
    const color = style.color ?? 'black';
    const opacity = style.opacity ?? 1;
    const align = style.textAlign ?? 'left';
    // Resolve the fontFamily stack to the first available family; the try/catch is
    // a final safety net that drops to Helvetica if even that cannot be selected.
    const fontName = resolveFontStack(style.fontFamily, style.fontWeight, style.fontStyle);
    try {
        doc.font(fontName);
    }
    catch {
        doc.font('Helvetica');
    }
    doc.fontSize(fontSize);
    // Per-glyph font fallback: if the text needs more than one font (e.g. a Latin
    // primary plus a CJK fallback for code points it lacks), the whole text
    // pipeline below — which assumes one font — can't be used as-is. We detect
    // that here and route to the run-aware paths. Single-font text (the common
    // case) is unaffected and takes the original PDFKit paths.
    const multiFont = splitFontRuns(text, style.fontFamily, style.fontWeight, style.fontStyle).length > 1;
    // Justified text needs per-line handling: PDFKit's native `align: 'justify'`
    // only stretches lines it wraps itself, but the paginator pre-wraps text and
    // joins lines with '\n', which PDFKit reads as separate single-line
    // paragraphs (and never justifies the last line of a paragraph). So we lay
    // out each line ourselves and distribute the slack via wordSpacing, skipping
    // the final line of every paragraph.
    if (align === 'justify' && width > 0) {
        drawJustified(doc, node, text, x, y, width, color, opacity, fontSize, style, multiFont);
        return;
    }
    // Mixed-font flow (non-justified): pre-wrap and draw each line's runs, since
    // PDFKit's own wrapping can only apply a single font.
    if (multiFont) {
        drawMultiFontFlow(doc, text, x, y, width, color, opacity, fontSize, align, style);
        return;
    }
    // Compute lineGap from lineHeight multiplier.
    // PDFKit's lineGap is extra pixels between lines, not a multiplier.
    // We convert: lineGap = (multiplier - 1) * naturalLineHeight.
    let lineGap;
    if (style.lineHeight != null) {
        lineGap = (style.lineHeight - 1) * doc.currentLineHeight(true);
    }
    doc
        .fillColor(color, opacity)
        .text(text, x, y, {
        // Add the wrap tolerance so PDFKit's own line breaker doesn't re-wrap
        // text that already fit during layout: the layout width is Yoga's
        // float32 rounding of the natural width and can be a sub-ulp too narrow.
        width: width ? width + WRAP_TOLERANCE : undefined,
        align,
        lineBreak: true,
        ...(lineGap != null && { lineGap }),
        ...(style.letterSpacing != null && { characterSpacing: style.letterSpacing }),
        ...(style.textDecoration === 'underline' && { underline: true }),
        ...(style.textDecoration === 'line-through' && { strike: true })
    });
}
/**
 * Renders justified text one line at a time.
 *
 * The font and size are already set on `doc` by the caller. Each line is placed
 * at its own y coordinate (advancing by the same effective line height the
 * layout engine used) and stretched to `width` by adding wordSpacing across its
 * spaces. Lines that end a paragraph — and single-word lines, which have no gaps
 * to stretch — render at their natural width.
 */
function drawJustified(doc, node, text, x, y, width, color, opacity, fontSize, style, multiFont = false) {
    const charSpacing = style.letterSpacing;
    const widthOpts = charSpacing != null ? { characterSpacing: charSpacing } : undefined;
    // Prefer the metadata the paginator carried through (it knows the true
    // paragraph boundaries for split text); otherwise wrap the text here.
    const lines = Array.isArray(node.props.justifyLines)
        ? node.props.justifyLines
        : wrapLinesMeta(text, style, width);
    // Effective line advance: natural PDFKit line height × the lineHeight
    // multiplier — matches measureText()/getLineHeight() so positions line up
    // with the Yoga-computed box. Multi-font lines use the tallest run font.
    const lineAdvance = multiFont
        ? multiFontLineAdvance(doc, splitFontRuns(text, style.fontFamily, style.fontWeight, style.fontStyle), style)
        : doc.currentLineHeight(true) * (style.lineHeight ?? 1);
    doc.fillColor(color, opacity).fontSize(fontSize);
    lines.forEach((line, i) => {
        const lineY = y + i * lineAdvance;
        const spaceCount = (line.text.match(/ /g) ?? []).length;
        // Slack distributed across the line's spaces (skip the paragraph's final
        // line and single-word lines, which keep their natural width).
        let wordSpacing;
        if (!line.lastInParagraph && spaceCount > 0) {
            const natural = multiFont
                ? widthOfRuns(doc, splitFontRuns(line.text, style.fontFamily, style.fontWeight, style.fontStyle), widthOpts)
                : doc.widthOfString(line.text, widthOpts);
            const slack = width - natural;
            if (slack > 0)
                wordSpacing = slack / spaceCount;
        }
        if (!multiFont) {
            // Deliberately omit `width`. We already position the line at an explicit
            // x and stretch it to the box via wordSpacing, so a width constraint
            // serves no purpose — and is actively harmful: PDFKit re-wraps a line
            // that meets/exceeds `width` even with lineBreak:false, stranding the
            // last word on a second visual line that overlaps the line below. (The
            // multi-font path below has never passed width, for the same reason.)
            doc.text(line.text, x, lineY, {
                lineBreak: false,
                ...(charSpacing != null && { characterSpacing: charSpacing }),
                ...(style.textDecoration === 'underline' && { underline: true }),
                ...(style.textDecoration === 'line-through' && { strike: true }),
                ...(wordSpacing != null && { wordSpacing })
            });
            return;
        }
        // Multi-font line: draw each run at an explicit x, applying the same
        // wordSpacing to every run so all of the line's spaces stretch evenly.
        const runs = splitFontRuns(line.text, style.fontFamily, style.fontWeight, style.fontStyle);
        drawRunsLine(doc, runs, x, lineY, {
            charSpacing,
            wordSpacing,
            underline: style.textDecoration === 'underline',
            strike: style.textDecoration === 'line-through'
        });
    });
}
/**
 * Effective line advance for a multi-font line: the tallest run font's natural
 * line height × the lineHeight multiplier. Mirrors the layout engine's
 * measurement so rendered lines sit where the Yoga box expects them. Leaves the
 * doc's current font set to one of the run fonts (callers re-set per run).
 */
function multiFontLineAdvance(doc, runs, style) {
    let natural = 0;
    const seen = new Set();
    for (const run of runs) {
        if (seen.has(run.font))
            continue;
        seen.add(run.font);
        try {
            doc.font(run.font);
        }
        catch {
            doc.font('Helvetica');
        }
        natural = Math.max(natural, doc.currentLineHeight(true));
    }
    return natural * (style.lineHeight ?? 1);
}
/**
 * Draws one line's font runs left-to-right, each at an explicit x.
 *
 * We position runs manually rather than using PDFKit's `continued` chaining
 * because PDFKit collapses whitespace at the seam between continued fragments,
 * which visually merges words across a font boundary. Advancing x by each run's
 * measured width (which counts a boundary space even when PDFKit doesn't paint
 * the seam glyph) preserves the gap. `wordSpacing` widens the line's spaces for
 * justification; it is added to the advance since widthOfString doesn't include
 * it.
 */
function drawRunsLine(doc, runs, startX, lineY, opts) {
    const widthOpts = opts.charSpacing != null ? { characterSpacing: opts.charSpacing } : undefined;
    let runX = startX;
    for (const run of runs) {
        doc.font(run.font).text(run.text, runX, lineY, {
            lineBreak: false,
            ...(opts.charSpacing != null && { characterSpacing: opts.charSpacing }),
            ...(opts.wordSpacing != null && { wordSpacing: opts.wordSpacing }),
            ...(opts.underline && { underline: true }),
            ...(opts.strike && { strike: true })
        });
        let advance = doc.widthOfString(run.text, widthOpts);
        if (opts.wordSpacing != null) {
            const spaces = run.text.length - run.text.replace(/ /g, '').length;
            advance += opts.wordSpacing * spaces;
        }
        runX += advance;
    }
}
/**
 * Renders non-justified text that spans multiple fonts. PDFKit can only apply a
 * single font per `text()` call and per wrap pass, so we pre-wrap, split each
 * line into per-font runs, and draw the runs ourselves. Alignment is applied by
 * offsetting each line's start x by its measured width.
 */
function drawMultiFontFlow(doc, text, x, y, width, color, opacity, fontSize, align, style) {
    doc.fontSize(fontSize);
    const lineAdvance = multiFontLineAdvance(doc, splitFontRuns(text, style.fontFamily, style.fontWeight, style.fontStyle), style);
    // Pre-wrap to lines. With no width constraint, only hard newlines break.
    const lineTexts = width > 0
        ? wrapLinesMeta(text, style, width).map((l) => l.text)
        : text.split('\n');
    const charSpacing = style.letterSpacing;
    const widthOpts = charSpacing != null ? { characterSpacing: charSpacing } : undefined;
    doc.fillColor(color, opacity);
    lineTexts.forEach((lineText, i) => {
        const runs = splitFontRuns(lineText, style.fontFamily, style.fontWeight, style.fontStyle);
        // Natural width of the line across its runs, for alignment offset.
        let lineWidth = 0;
        for (const run of runs) {
            doc.font(run.font);
            lineWidth += doc.widthOfString(run.text, widthOpts);
        }
        let lineX = x;
        if (width > 0) {
            if (align === 'center')
                lineX = x + (width - lineWidth) / 2;
            else if (align === 'right')
                lineX = x + (width - lineWidth);
        }
        const lineY = y + i * lineAdvance;
        drawRunsLine(doc, runs, lineX, lineY, {
            charSpacing,
            underline: style.textDecoration === 'underline',
            strike: style.textDecoration === 'line-through'
        });
    });
}
