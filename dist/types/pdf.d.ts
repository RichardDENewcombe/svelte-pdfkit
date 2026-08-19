/** Passed to a Text render-prop function at draw time. */
export interface PageRenderProps {
    pageNumber: number;
    totalPages: number;
    /** Looks up the page number a node with the given `anchor` key resolved to. */
    pageOf: (anchorKey: string) => number | undefined;
}
/** A function that returns a string given the current page context. */
export type PageNumberRenderer = (props: PageRenderProps) => string;
export type NodeType = "document" | "page" | "view" | "text" | "image" | "canvas" | "link" | "svg" | "svg_path" | "svg_circle" | "svg_rect" | "svg_ellipse" | "svg_line" | "svg_g" | "svg_polyline" | "svg_polygon" | "svg_defs" | "svg_linear_gradient" | "svg_radial_gradient" | "svg_stop" | "svg_clip_path" | "svg_text" | "svg_tspan";
export interface LayoutBox {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface PDFNode {
    type: NodeType;
    props: Record<string, any>;
    children: PDFNode[];
    layout?: LayoutBox;
}
export interface ResourceEntry {
    type: "font" | "image";
    name?: string;
    src: string;
    weight?: string;
    fontStyle?: string;
}
export interface PDFMetadata {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creator?: string;
    producer?: string;
}
export interface DocumentContext extends PDFNode {
    type: "document";
    resources: ResourceEntry[];
    metadata: PDFMetadata;
}
export type StyleProps = {
    flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
    flexGrow?: number;
    flexShrink?: number;
    flexBasis?: number | string;
    flexWrap?: "wrap" | "nowrap";
    justifyContent?: "flex-start" | "flex-end" | "center" | "space-between" | "space-around" | "space-evenly";
    alignItems?: "flex-start" | "flex-end" | "center" | "stretch" | "baseline";
    alignSelf?: "auto" | "flex-start" | "flex-end" | "center" | "stretch" | "baseline";
    gap?: number;
    margin?: number;
    marginTop?: number;
    marginRight?: number;
    marginBottom?: number;
    marginLeft?: number;
    padding?: number;
    paddingTop?: number;
    paddingRight?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    width?: number | string;
    height?: number | string;
    minWidth?: number | string;
    maxWidth?: number | string;
    minHeight?: number | string;
    maxHeight?: number | string;
    position?: "relative" | "absolute";
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
    fontSize?: number;
    /**
     * Font family name, or a fallback list (CSS-style comma string or array).
     *
     * The list is also a **per-glyph** fallback chain: each character is drawn by
     * the first family that actually has a glyph for it, so a primarily-Latin font
     * can fall back to e.g. a CJK font only for the code points it lacks — without
     * splitting grapheme clusters (accents, flag emoji). Colour emoji renders
     * monochrome (gated by PDFKit).
     * @example fontFamily: 'Inter'
     * @example fontFamily: ['Inter', 'NotoSansSC'] // Latin from Inter, CJK from Noto
     * @example fontFamily: 'Inter, Helvetica'
     */
    fontFamily?: string | string[];
    fontWeight?: "normal" | "bold";
    fontStyle?: "normal" | "italic";
    color?: string;
    opacity?: number;
    /**
     * Rotation in degrees (clockwise) about `transformOrigin`. Transforms are a
     * render-time effect only — they do not change the node's layout box, exactly
     * like CSS `transform`.
     */
    rotate?: number;
    /** Uniform scale factor about `transformOrigin`. */
    scale?: number;
    /** Horizontal scale factor about `transformOrigin`. */
    scaleX?: number;
    /** Vertical scale factor about `transformOrigin`. */
    scaleY?: number;
    /** Horizontal translation in points. */
    translateX?: number;
    /** Vertical translation in points. */
    translateY?: number;
    /** Horizontal skew angle in degrees. */
    skewX?: number;
    /** Vertical skew angle in degrees. */
    skewY?: number;
    /**
     * Pivot for `rotate` / `scale` / `skew`. One or two space-separated tokens, or
     * an `[x, y]` point tuple. Tokens are keywords (`left`/`right` set x,
     * `top`/`bottom` set y, `center` either), percentages (`'50%'`), or point
     * lengths.
     *
     * Keyword resolution is axis-aware and order-independent like CSS: so
     * `'bottom right'` === `'right bottom'`, a lone `'bottom'` is bottom-center,
     * and `center`/numeric values fill whichever axis is still free (in source
     * order). Any unspecified axis defaults to center, which is also the default
     * when `transformOrigin` is omitted. Keywords are case-insensitive.
     */
    transformOrigin?: string | [number, number];
    textAlign?: "left" | "center" | "right" | "justify";
    /** Line height multiplier. 1 = natural, 1.5 = 150% of the font's natural line height. */
    lineHeight?: number;
    /** Additional space between characters in points. */
    letterSpacing?: number;
    /** Text decoration: underline or line-through. */
    textDecoration?: "none" | "underline" | "line-through";
    /**
     * Minimum number of lines of a text block that must remain at the **bottom**
     * of a page before a page break (orphan control). When fewer lines would fit,
     * the entire block is deferred to the next page. Default: 1 (disabled).
     */
    orphans?: number;
    /**
     * Minimum number of lines of a text block that must appear at the **top** of
     * a page after a page break (widow control). When fewer lines would remain,
     * lines are moved from the current page to the next until the threshold is
     * met. Default: 1 (disabled).
     */
    widows?: number;
    /**
     * Enables dictionary hyphenation for this text: words that overflow a line are
     * broken at valid hyphenation points with a trailing `-`, instead of being
     * pushed whole to the next line. Most visible with `textAlign: 'justify'`.
     * Default: false.
     */
    hyphenation?: boolean;
    /**
     * Hyphenation language for this text when `hyphenation` is enabled. Bundled:
     * `'en-gb'` (default) and `'en-us'`. Other languages require a callback
     * registered via `registerHyphenationCallback`. Ignored when such a callback
     * is set.
     */
    hyphenationLang?: string;
    /** Background fill colour for a View / Cell. */
    backgroundColor?: string;
    /** Width of the border stroke drawn around a View / Cell, in points. */
    borderWidth?: number;
    /** Colour of the border. Defaults to black when borderWidth is set. */
    borderColor?: string;
    /** Per-side border widths. These take precedence over `borderWidth` for their side. */
    borderTopWidth?: number;
    borderRightWidth?: number;
    borderBottomWidth?: number;
    borderLeftWidth?: number;
    /** Per-side border colours. Falls back to `borderColor` then black. */
    borderTopColor?: string;
    borderRightColor?: string;
    borderBottomColor?: string;
    borderLeftColor?: string;
    /** Border corner radius in points — applies to all four corners. */
    borderRadius?: number;
    /** Per-corner border radii. These take precedence over `borderRadius`. */
    borderTopLeftRadius?: number;
    borderTopRightRadius?: number;
    borderBottomRightRadius?: number;
    borderBottomLeftRadius?: number;
};
