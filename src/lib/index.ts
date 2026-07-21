// ── Components ────────────────────────────────────────────────────────────────
export { default as Document } from './components/Document/Document.svelte';
export { default as Page } from './components/Page/Page.svelte';
export { default as View } from './components/View/View.svelte';
export { default as Text } from './components/Text/Text.svelte';
export { default as Image } from './components/Image/Image.svelte';
export { default as Font } from './components/Font/Font.svelte';
export { default as Link } from './components/Link/Link.svelte';
export { default as Canvas } from './components/Canvas/Canvas.svelte';
export { default as Svg } from './components/Svg/Svg.svelte';
export { default as Path } from './components/Svg/Path.svelte';
export { default as Circle } from './components/Svg/Circle.svelte';
export { default as Rect } from './components/Svg/Rect.svelte';
export { default as Ellipse } from './components/Svg/Ellipse.svelte';
export { default as Line } from './components/Svg/Line.svelte';
export { default as G } from './components/Svg/G.svelte';
export { default as Polyline } from './components/Svg/Polyline.svelte';
export { default as Polygon } from './components/Svg/Polygon.svelte';
export { default as Defs } from './components/Svg/Defs.svelte';
export { default as LinearGradient } from './components/Svg/LinearGradient.svelte';
export { default as RadialGradient } from './components/Svg/RadialGradient.svelte';
export { default as Stop } from './components/Svg/Stop.svelte';
export { default as ClipPath } from './components/Svg/ClipPath.svelte';
export { default as SvgText } from './components/Svg/SvgText.svelte';
export { default as Tspan } from './components/Svg/Tspan.svelte';
export { default as Table } from './components/Table/Table.svelte';
export { default as Row } from './components/Table/Row.svelte';
export { default as Cell } from './components/Table/Cell.svelte';

// ── Runtime ───────────────────────────────────────────────────────────────────
export { createDocument } from './runtime/document.js';
export { createNode } from './runtime/node.js';
export { renderComponent } from './runtime/render.js';
export { toResponse } from './runtime/to-response.js';
export { resolveFont } from './runtime/font-registry.js';
export {
	registerHyphenationCallback,
	setDefaultHyphenationLang,
	hyphenateWord
} from './layout/hyphenation.js';
export type { HyphenationCallback } from './layout/hyphenation.js';
export { configureRemoteResources, getRemoteConfig } from './runtime/remote-config.js';
export type { RemoteResourceConfig } from './runtime/remote-config.js';

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
	PDFNode,
	DocumentContext,
	StyleProps,
	NodeType,
	LayoutBox,
	ResourceEntry,
	PDFMetadata,
	PageRenderProps,
	PageNumberRenderer
} from './types/pdf.js';
