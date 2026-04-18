/** Passed to a Text render-prop function at draw time. */
export interface PageRenderProps {
  pageNumber: number;
  totalPages: number;
}

/** A function that returns a string given the current page context. */
export type PageNumberRenderer = (props: PageRenderProps) => string;

export type NodeType =
  | "document"
  | "page"
  | "view"
  | "text"
  | "image"
  | "canvas"
  | "link"
  | "svg"
  | "svg_path"
  | "svg_circle"
  | "svg_rect"
  | "svg_ellipse"
  | "svg_line"
  | "svg_g"
  | "svg_polyline"
  | "svg_polygon"
  | "svg_defs"
  | "svg_linear_gradient"
  | "svg_radial_gradient"
  | "svg_stop"
  | "svg_clip_path"
  | "svg_text"
  | "svg_tspan";

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
  justifyContent?:
    | "flex-start"
    | "flex-end"
    | "center"
    | "space-between"
    | "space-around"
    | "space-evenly";
  alignItems?: "flex-start" | "flex-end" | "center" | "stretch" | "baseline";
  alignSelf?:
    | "auto"
    | "flex-start"
    | "flex-end"
    | "center"
    | "stretch"
    | "baseline";
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
  fontFamily?: string;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  color?: string;
  opacity?: number;
  textAlign?: "left" | "center" | "right" | "justify";
  /** Line height multiplier. 1 = natural, 1.5 = 150% of the font's natural line height. */
  lineHeight?: number;
  /** Additional space between characters in points. */
  letterSpacing?: number;
  /** Text decoration: underline or line-through. */
  textDecoration?: "none" | "underline" | "line-through";
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
