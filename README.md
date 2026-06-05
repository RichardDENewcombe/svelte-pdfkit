# svelte-pdf

A Svelte-native PDF rendering library for Svelte 5. Write PDF layouts using Svelte components and render them server-side to a Node.js stream — no DOM required.

```svelte
<!-- Invoice.pdf.svelte -->
<script>
  import { Page, View, Text, Image } from 'svelte-pdf';
  const { invoice } = $props();
</script>

<Page size="A4" style={{ padding: 40 }}>
  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
    <Text text={invoice.company} style={{ fontSize: 24, fontFamily: 'Helvetica-Bold' }} />
    <Text text={invoice.date} style={{ fontSize: 12, color: '#6b7280' }} />
  </View>
</Page>
```

```ts
import { render } from "./Invoice.pdf.svelte";

const pdf = await render({ invoice });
pdf.pipe(fs.createWriteStream("invoice.pdf"));
```

---

## Contents

- [Installation](#installation)
- [Vite / SvelteKit setup](#vite--sveltekit-setup)
- [Quick start](#quick-start)
- [Components](#components)
  - [SVG components](#svg-components)
  - [Table components](#table-components)
- [Style reference](#style-reference)
- [Fixed elements (headers and footers)](#fixed-elements-headers-and-footers)
- [Page breaks and flow control](#page-breaks-and-flow-control)
  - [Explicit page breaks](#explicit-page-breaks)
  - [Keep with next](#keep-with-next)
  - [Orphans and widows](#orphans-and-widows)
  - [Justified text](#justified-text)
- [Using `renderComponent` directly](#using-rendercomponent-directly)
- [API reference](#api-reference)
- [How it works](#how-it-works)
- [TypeScript](#typescript)
- [Limitations](#limitations)

---

## Installation

```bash
npm install svelte-pdf
```

**Peer dependency:** Svelte 5

---

## Vite / SvelteKit setup

Add the Vite plugin so `.pdf.svelte` files are compiled into `render()` functions:

```ts
// vite.config.ts
import { sveltekit } from "@sveltejs/kit/vite";
import { sveltePDF } from "svelte-pdf/compiler/vite-plugin";

export default {
  plugins: [sveltePDF(), sveltekit()],
};
```

`sveltePDF()` must come **before** `sveltekit()` so it intercepts `.pdf.svelte` imports first.

### TypeScript types for `.pdf.svelte` files

The plugin automatically writes a companion `.d.ts` file alongside each `.pdf.svelte` template (e.g. `Invoice.pdf.svelte.d.ts`). This gives the TypeScript language server the correct `render()` signature and prevents the false "has no exported member 'render'" error caused by `svelte2tsx` generating its own `.d.ts` for every `.svelte` file.

The files are generated at dev server startup, on every build, and on first import of each template. They are fully deterministic so clean rebuilds never produce dirty git state.

Add the pattern to your `.gitignore` so generated files are not committed:

```
**/*.pdf.svelte.d.ts
```

---

## Quick start

### 1. Create a template

Create a file ending in `.pdf.svelte`. Use the provided components to build the layout — they work exactly like Svelte components.

```svelte
<!-- Report.pdf.svelte -->
<script lang="ts">
  import { Page, View, Text } from 'svelte-pdf';
  const { title, items } = $props<{ title: string; items: string[] }>();
</script>

<Page size="A4" style={{ padding: 40 }}>
  <Text text={title} style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 16 }} />

  {#each items as item}
    <View style={{ marginBottom: 8 }}>
      <Text text={item} style={{ fontSize: 12 }} />
    </View>
  {/each}
</Page>
```

### 2. Render from a SvelteKit route

`render()` returns a Node.js `Readable`. The `toResponse()` helper wraps it in a
Web `Response` — converting the stream and defaulting `Content-Type` to
`application/pdf` — so it works on **any** SvelteKit adapter without buffering:

```ts
// src/routes/report/+server.ts
import { toResponse } from "svelte-pdf";
import { render } from "$lib/Report.pdf.svelte";

export async function GET() {
  const pdf = await render({
    title: "Q1 Report",
    items: ["Revenue: $1M", "Users: 50k"],
  });

  return toResponse(pdf);
}
```

Pass a second `ResponseInit` argument to set a status, force a download, or add
headers (`Content-Type` still defaults to `application/pdf` unless you override it):

```ts
return toResponse(pdf, {
  headers: { "Content-Disposition": 'attachment; filename="report.pdf"' },
});
```

<details>
<summary>Doing it manually without <code>toResponse</code></summary>

`render()` returns a Node.js `Readable`, which the Web `Response` constructor
does not accept by type. Convert it to a Web stream:

```ts
import { Readable } from "node:stream";

return new Response(Readable.toWeb(pdf) as ReadableStream, {
  headers: { "Content-Type": "application/pdf" },
});
```

On `adapter-node` only, you may instead pass the Node stream directly with a
cast (`new Response(pdf as unknown as BodyInit, …)`), but that is not portable
to other adapters. `toResponse()` does the `Readable.toWeb` conversion for you.

</details>

### 3. Write to a file (Node.js)

```ts
import fs from "node:fs";
import { render } from "./Report.pdf.svelte";

const pdf = await render({ title: "Q1 Report", items: ["Revenue: $1M"] });
pdf.pipe(fs.createWriteStream("report.pdf"));
```

---

## Components

### `<Document>`

Optional wrapper that sets PDF metadata. Place it around your `<Page>` elements.

```svelte
<Document title="Invoice" author="Acme Corp" subject="INV-2026-0042">
  <Page size="A4">...</Page>
</Document>
```

| Prop       | Type     | Description          |
| ---------- | -------- | -------------------- |
| `title`    | `string` | PDF document title   |
| `author`   | `string` | Author name          |
| `subject`  | `string` | Document subject     |
| `keywords` | `string` | Search keywords      |
| `creator`  | `string` | Creator application  |
| `producer` | `string` | Producer application |

---

### `<Page>`

Defines a page. Content that overflows automatically wraps to new pages.

```svelte
<Page size="A4" style={{ padding: 40 }}>
  ...
</Page>
```

| Prop          | Type                          | Default      | Description              |
| ------------- | ----------------------------- | ------------ | ------------------------ |
| `size`        | `'A4' \| 'Letter' \| 'Legal'` | `'A4'`       | Page size                |
| `orientation` | `'portrait' \| 'landscape'`   | `'portrait'` | Page orientation         |
| `style`       | `StyleProps`                  | `{}`         | Flexbox / padding styles |

---

### `<View>`

A box container. The primary layout primitive — equivalent to a `<div>`.

```svelte
<View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 10 }}>
  <Text text="Left" />
  <Text text="Right" />
</View>
```

| Prop           | Type         | Default | Description                                            |
| -------------- | ------------ | ------- | ------------------------------------------------------ |
| `style`        | `StyleProps` | `{}`    | Layout and visual styles                               |
| `fixed`        | `boolean`    | `false` | Repeat on every page (use for headers/footers)         |
| `breakBefore`  | `boolean`    | `false` | Force a page break before this view                    |
| `breakAfter`   | `boolean`    | `false` | Force a page break after this view                     |
| `keepWithNext` | `boolean`    | `false` | Keep on the same page as the start of the next sibling |

`breakBefore`, `breakAfter`, and `keepWithNext` are explained in [Page breaks and flow control](#page-breaks-and-flow-control).

---

### `<Text>`

Renders text. Supports word wrapping, alignment, and dynamic page numbers.

```svelte
<!-- Static text -->
<Text text="Hello, world!" style={{ fontSize: 14, color: '#333' }} />

<!-- Children syntax -->
<Text style={{ fontSize: 14 }}>Hello, world!</Text>

<!-- Dynamic page number -->
<Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
```

| Prop           | Type                                 | Description                                            |
| -------------- | ------------------------------------ | ------------------------------------------------------ |
| `text`         | `string`                             | Static text content                                    |
| `children`     | `Snippet`                            | Text as Svelte children                                |
| `render`       | `(props: PageRenderProps) => string` | Dynamic text (for page numbers)                        |
| `style`        | `StyleProps`                         | Text and layout styles                                 |
| `breakBefore`  | `boolean`                            | Force a page break before this text                    |
| `breakAfter`   | `boolean`                            | Force a page break after this text                     |
| `keepWithNext` | `boolean`                            | Keep on the same page as the start of the next sibling |

Use `text`, `children`, or `render` — not multiple at once. See [Page breaks and flow control](#page-breaks-and-flow-control) for `breakBefore` / `breakAfter` / `keepWithNext`, and the [Typography](#typography) styles for `textAlign: 'justify'`, `orphans`, and `widows`.

---

### `<Image>`

Renders a PNG, JPEG, or **SVG** image. Supports local files, base64 / data URIs, and remote URLs.

```svelte
<Image src="/logo.png" style={{ width: 120, height: 60 }} />
<Image src="https://example.com/photo.jpg" style={{ width: 200, height: 150 }} />

<!-- SVG sources are rendered as vectors (crisp at any scale) -->
<Image src="/icons/check.svg" style={{ width: 48, height: 48 }} />
<Image src="data:image/svg+xml;base64,PHN2Zy4uLg==" style={{ width: 48, height: 48 }} />
```

| Prop           | Type         | Description                                            |
| -------------- | ------------ | ------------------------------------------------------ |
| `src`          | `string`     | File path, URL, or data URI                            |
| `style`        | `StyleProps` | Width, height, and layout                              |
| `breakBefore`  | `boolean`    | Force a page break before this image                   |
| `breakAfter`   | `boolean`    | Force a page break after this image                    |
| `keepWithNext` | `boolean`    | Keep on the same page as the start of the next sibling |

Raster sources (PNG/JPEG) are drawn by PDFKit; SVG sources are detected by extension, `image/svg+xml` data URI, or content, then drawn as vectors via [svg-to-pdfkit](https://github.com/alafr/SVG-to-PDFKit).

---

### `<Font>`

Declares a custom font. Place inside `<Document>` or at the top of a `<Page>`. Fonts are loaded asynchronously before layout runs.

```svelte
<!-- Local files -->
<Font name="Inter" src="/fonts/Inter-Regular.ttf" />
<Font name="Inter" src="/fonts/Inter-Bold.ttf" weight="bold" />
<Font name="Inter" src="/fonts/Inter-Italic.ttf" fontStyle="italic" />

<!-- Remote URL — fetched at render time -->
<Font name="Inter" src="https://example.com/fonts/Inter-Regular.ttf" />
```

Then use the font name in text styles:

```svelte
<Text text="Hello" style={{ fontFamily: 'Inter', fontSize: 14 }} />
<Text text="Bold"  style={{ fontFamily: 'Inter', fontWeight: 'bold', fontSize: 14 }} />
```

| Prop        | Type                   | Description                                  |
| ----------- | ---------------------- | -------------------------------------------- |
| `name`      | `string`               | Font family name (used in `fontFamily`)      |
| `src`       | `string`               | Path or `http(s)` URL to a `.ttf`/`.otf` file |
| `weight`    | `'normal' \| 'bold'`   | Font weight variant                          |
| `fontStyle` | `'normal' \| 'italic'` | Font style variant                           |

Local files and remote URLs are both loaded asynchronously before layout, and each `src` is cached for the process lifetime so it is fetched only once. If a remote font fails to load, a warning is logged and text falls back to Helvetica.

PDFKit's built-in fonts (`Helvetica`, `Helvetica-Bold`, `Helvetica-Oblique`, `Times-Roman`, `Courier`, etc.) are available without declaring a `<Font>`.

---

### `<Link>`

Wraps content with a clickable hyperlink in the PDF.

```svelte
<Link href="https://example.com">
  <Text text="Visit our website" style={{ color: '#1a56db' }} />
</Link>
```

| Prop    | Type         | Description   |
| ------- | ------------ | ------------- |
| `href`  | `string`     | Target URL    |
| `style` | `StyleProps` | Layout styles |

---

### `<Canvas>`

Low-level escape hatch. Receives the raw PDFKit document instance and the Yoga-computed layout box, so you can draw anything PDFKit supports.

```svelte
<Canvas
  style={{ width: 200, height: 100 }}
  draw={(doc, x, y, width, height) => {
    doc.rect(x, y, width, height).fill('#eef');
    doc.moveTo(x, y).lineTo(x + width, y + height).stroke('blue');
  }}
/>
```

| Prop    | Type                                 | Description                                                  |
| ------- | ------------------------------------ | ------------------------------------------------------------ |
| `style` | `StyleProps`                         | Must include `width` and `height` for Yoga to allocate space |
| `draw`  | `(doc, x, y, width, height) => void` | Drawing callback                                             |

---

### SVG components

Vector graphics using PDFKit's SVG primitives.

```svelte
<Svg width={100} height={100}>
  <Circle cx={50} cy={50} r={40} fill="#1a56db" stroke="#fff" strokeWidth={2} />
  <Rect x={10} y={10} width={80} height={80} fill="none" stroke="#333" />
  <Path d="M 10 80 L 50 20 L 90 80 Z" fill="#e5e7eb" />
  <Line x1={0} y1={0} x2={100} y2={100} stroke="red" strokeWidth={1} />
  <Ellipse cx={50} cy={50} rx={40} ry={20} fill="#fef3c7" />
  <G opacity={0.5}>
    <Circle cx={30} cy={30} r={10} fill="green" />
  </G>
</Svg>
```

| Component    | Key props                                        |
| ------------ | ------------------------------------------------ |
| `<Svg>`      | `width`, `height`, `style`                       |
| `<Circle>`   | `cx`, `cy`, `r`, `fill`, `stroke`, `strokeWidth` |
| `<Rect>`     | `x`, `y`, `width`, `height`, `fill`, `stroke`    |
| `<Path>`     | `d` (SVG path data), `fill`, `stroke`            |
| `<Line>`     | `x1`, `y1`, `x2`, `y2`, `stroke`, `strokeWidth`  |
| `<Ellipse>`  | `cx`, `cy`, `rx`, `ry`, `fill`, `stroke`         |
| `<Polyline>` | `points`, `fill`, `stroke`, `strokeWidth`        |
| `<Polygon>`  | `points`, `fill`, `stroke`, `strokeWidth`        |
| `<G>`        | `opacity`, `fill`, `stroke` (group wrapper)      |
| `<SvgText>`  | `x`, `y`, `text`, `fontSize`, `fill`, `textAnchor` |
| `<Tspan>`    | `text`, `x`, `y`, `dx`, `dy`, `fontSize`, `fill`  |

#### Gradients

Define gradients inside `<Defs>`, then reference them by id from any shape's `fill` or `stroke` prop using the `url(#id)` syntax.

```svelte
<Svg width={200} height={100}>
  <Defs>
    <!-- Linear gradient — left to right -->
    <LinearGradient id="grad1" x1={0} y1={0} x2={200} y2={0}>
      <Stop offset={0} stopColor="#1a56db" />
      <Stop offset={1} stopColor="#7c3aed" />
    </LinearGradient>

    <!-- Radial gradient -->
    <RadialGradient id="grad2" cx={100} cy={50} r={60}>
      <Stop offset={0} stopColor="white" stopOpacity={0.9} />
      <Stop offset={1} stopColor="#1a56db" stopOpacity={0} />
    </RadialGradient>
  </Defs>

  <Rect x={0} y={0} width={200} height={100} fill="url(#grad1)" />
  <Circle cx={100} cy={50} r={40} fill="url(#grad2)" />
</Svg>
```

| Component          | Key props                                                   |
| ------------------ | ----------------------------------------------------------- |
| `<Defs>`           | Container — no props; place gradient/clip definitions here  |
| `<LinearGradient>` | `id`, `x1`, `y1`, `x2`, `y2` (coordinates in SVG space)    |
| `<RadialGradient>` | `id`, `cx`, `cy`, `r`, `fx` (optional), `fy` (optional)    |
| `<Stop>`           | `offset` (0–1), `stopColor`, `stopOpacity` (optional, 0–1) |

`gradientUnits` defaults to `'userSpaceOnUse'` — coordinates are in the SVG viewport. `'objectBoundingBox'` is not yet supported.

#### Clip paths

A `<ClipPath>` masks a shape to the geometry of its children. Define inside `<Defs>`, then apply with `clipPath="url(#id)"` on any shape.

```svelte
<Svg width={200} height={200}>
  <Defs>
    <!-- Only the rectangular region will be visible -->
    <ClipPath id="clip1">
      <Rect x={20} y={20} width={160} height={160} />
    </ClipPath>
  </Defs>

  <!-- Circle is clipped to the rectangle above -->
  <Circle cx={100} cy={100} r={90} fill="#1a56db" clipPath="url(#clip1)" />
</Svg>
```

| Component    | Key props                                              |
| ------------ | ------------------------------------------------------ |
| `<ClipPath>` | `id` — referenced via `clipPath="url(#id)"` on shapes |

Any shape (`Rect`, `Circle`, `Ellipse`, `Path`, `Polygon`, `Polyline`) can be used as clip geometry inside `<ClipPath>`. Nested clip paths are not supported.

#### SVG text

Position text absolutely within the SVG coordinate space. Unlike `<Text>`, SVG text does not wrap and is placed at an explicit `x`/`y` point. For mixed styling within one text run, nest `<Tspan>` elements inside `<SvgText>`.

```svelte
<!-- Simple text -->
<Svg width={200} height={50}>
  <SvgText x={10} y={20} text="Hello, PDF!" fontSize={14} fill="#1a56db" />
</Svg>

<!-- Horizontal alignment via textAnchor -->
<Svg width={200} height={50}>
  <SvgText x={100} y={20} text="Centered" fontSize={12} textAnchor="middle" />
  <SvgText x={200} y={40} text="Right-aligned" fontSize={12} textAnchor="end" />
</Svg>

<!-- Mixed styling with Tspan -->
<Svg width={300} height={30}>
  <SvgText x={10} y={20} fontSize={12} fill="black">
    <Tspan text="Normal and then " />
    <Tspan text="red bold." fontFamily="Helvetica-Bold" fill="red" />
  </SvgText>
</Svg>

<!-- Line break via dy offset -->
<Svg width={200} height={60}>
  <SvgText x={10} y={20} fontSize={11} fill="black">
    <Tspan text="First line" />
    <Tspan text="Second line" dy={16} />
  </SvgText>
</Svg>
```

**`<SvgText>` props:**

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `x` | `number` | `0` | Horizontal position in SVG coordinate space |
| `y` | `number` | `0` | Vertical position in SVG coordinate space |
| `text` | `string` | — | Text content (omit when using `<Tspan>` children) |
| `fontSize` | `number` | `12` | Font size in points |
| `fontFamily` | `string` | `'Helvetica'` | PDFKit font name or family registered with `<Font>` |
| `fontWeight` | `'normal' \| 'bold'` | — | Resolved via font registry (e.g. `'Helvetica-Bold'`) |
| `fill` | `string` | `'black'` | Text colour |
| `opacity` | `number` | — | Opacity (0–1) |
| `textAnchor` | `'start' \| 'middle' \| 'end'` | `'start'` | Horizontal alignment relative to `x` |

**`<Tspan>` props:**

| Prop | Type | Description |
| --- | --- | --- |
| `text` | `string` | Text content for this span |
| `x` | `number` | Absolute x position (overrides cursor) |
| `y` | `number` | Absolute y position (overrides cursor) |
| `dx` | `number` | Relative x offset from the previous span's end |
| `dy` | `number` | Relative y offset from the previous span's baseline |
| `fontSize` | `number` | Per-span font size override |
| `fontFamily` | `string` | Per-span font family override |
| `fill` | `string` | Per-span colour override |
| `opacity` | `number` | Per-span opacity override |

> **Baseline note:** PDFKit origins text at the top of the em square. SVG's `alphabetic` baseline sits roughly `fontSize × 0.8` points below that. Adjust `y` manually if you need precise alignment with surrounding shapes. Nested `<Tspan>` inside `<Tspan>` is not supported.

---

### Table components

Structured table layout using flex rows and cells.

```svelte
<Table>
  <Row style={{ backgroundColor: '#1a56db' }}>
    <Cell style={{ padding: 6, flexGrow: 2 }}>
      <Text text="Product" style={{ color: 'white', fontFamily: 'Helvetica-Bold', fontSize: 10 }} />
    </Cell>
    <Cell style={{ padding: 6 }}>
      <Text text="Price" style={{ color: 'white', fontFamily: 'Helvetica-Bold', fontSize: 10 }} />
    </Cell>
  </Row>

  {#each items as item, i}
    <Row style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f9fafb' }}>
      <Cell style={{ padding: 5, flexGrow: 2 }}>
        <Text text={item.name} style={{ fontSize: 10 }} />
      </Cell>
      <Cell style={{ padding: 5 }}>
        <Text text={item.price} style={{ fontSize: 10, textAlign: 'right' }} />
      </Cell>
    </Row>
  {/each}
</Table>
```

---

## Style reference

All layout components accept a `style` prop typed as `StyleProps`.

### Flexbox

| Property         | Values                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `flexDirection`  | `'row'` `'column'` `'row-reverse'` `'column-reverse'`                                      |
| `flexGrow`       | number                                                                                     |
| `flexShrink`     | number                                                                                     |
| `flexBasis`      | number or string                                                                           |
| `flexWrap`       | `'wrap'` `'nowrap'`                                                                        |
| `justifyContent` | `'flex-start'` `'flex-end'` `'center'` `'space-between'` `'space-around'` `'space-evenly'` |
| `alignItems`     | `'flex-start'` `'flex-end'` `'center'` `'stretch'` `'baseline'`                            |
| `alignSelf`      | `'auto'` `'flex-start'` `'flex-end'` `'center'` `'stretch'` `'baseline'`                   |

### Sizing

| Property                  | Type                       |
| ------------------------- | -------------------------- |
| `width` / `height`        | number (points) or `'50%'` |
| `minWidth` / `maxWidth`   | number                     |
| `minHeight` / `maxHeight` | number                     |

### Spacing

| Property                                                        | Type               |
| --------------------------------------------------------------- | ------------------ |
| `margin`                                                        | number (all sides) |
| `marginTop` / `marginRight` / `marginBottom` / `marginLeft`     | number             |
| `padding`                                                       | number (all sides) |
| `paddingTop` / `paddingRight` / `paddingBottom` / `paddingLeft` | number             |

### Positioning

| Property                            | Values                    |
| ----------------------------------- | ------------------------- |
| `position`                          | `'relative'` `'absolute'` |
| `top` / `right` / `bottom` / `left` | number                    |

### Typography

| Property         | Values                                    |
| ---------------- | ----------------------------------------- |
| `fontFamily`     | string (font name)                        |
| `fontSize`       | number (points)                           |
| `fontWeight`     | `'normal'` `'bold'`                       |
| `fontStyle`      | `'normal'` `'italic'`                     |
| `color`          | CSS color string                          |
| `textAlign`      | `'left'` `'center'` `'right'` `'justify'` |
| `lineHeight`     | number (multiplier, e.g. `1.5`)           |
| `letterSpacing`  | number (points)                           |
| `textDecoration` | `'none'` `'underline'` `'line-through'`   |
| `orphans`        | number (min lines at page bottom, default `1`) |
| `widows`         | number (min lines at page top, default `1`)    |

`textAlign: 'justify'`, `orphans`, and `widows` are described under [Page breaks and flow control](#page-breaks-and-flow-control).

### Visual

| Property                                                                                              | Type             |
| ----------------------------------------------------------------------------------------------------- | ---------------- |
| `backgroundColor`                                                                                     | CSS color string |
| `opacity`                                                                                             | number (0–1)     |
| `borderWidth`                                                                                         | number (points)  |
| `borderColor`                                                                                         | CSS color string |
| `borderTopWidth` / `borderRightWidth` / `borderBottomWidth` / `borderLeftWidth`                       | number (points)  |
| `borderTopColor` / `borderRightColor` / `borderBottomColor` / `borderLeftColor`                       | CSS color string |
| `borderRadius`                                                                                        | number (points)  |
| `borderTopLeftRadius` / `borderTopRightRadius` / `borderBottomLeftRadius` / `borderBottomRightRadius` | number           |

---

## Fixed elements (headers and footers)

Set `fixed={true}` on a `<View>` to repeat it on every page. Combined with `position: 'absolute'`, this creates a persistent header or footer.

```svelte
<!-- Fixed page footer -->
<View
  fixed={true}
  style={{ position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' }}
>
  <Text text="Confidential" style={{ fontSize: 8, color: '#9ca3af' }} />
  <Text
    render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
    style={{ fontSize: 8, color: '#9ca3af' }}
  />
</View>
```

The paginator detects fixed elements and automatically reserves clearance above them so flow content is never obscured.

---

## Page breaks and flow control

Content that overflows a `<Page>` automatically flows onto new pages — long `<Text>` blocks are split line-by-line at the boundary, while views, tables, and images flow as units. The props and styles below give precise control over where those breaks fall.

### Explicit page breaks

`breakBefore` forces a new page before a node; `breakAfter` forces one after it. Both are available on `<View>`, `<Text>`, and `<Image>`, regardless of how much space remains on the current page.

```svelte
<View breakBefore>Starts at the top of a new page</View>

<View breakAfter>Everything after this starts on a new page</View>
```

### Keep with next

`keepWithNext` keeps a node on the same page as the **start of its following sibling** — typically to stop a heading from being stranded at the foot of a page, away from the content it introduces. If the page break would separate the pair, the marked node is moved to the next page so they stay together.

```svelte
<Text text="Section 3: Results" keepWithNext style={{ fontFamily: 'Helvetica-Bold' }} />
<View>The body that should stay with its heading…</View>
```

If the pair is taller than a whole page the break is allowed (the constraint cannot be satisfied). Available on `<View>`, `<Text>`, and `<Image>`.

### Orphans and widows

Set these on a `<Text>` style to limit isolated lines at a page boundary. An _orphan_ is the first line of a block left at the bottom of a page; a _widow_ is the last line carried alone to the top of the next. Both default to `1` (disabled); set to `2` or more to activate.

```svelte
<Text text={longParagraph} style={{ orphans: 2, widows: 2 }} />
```

| Style prop | Type     | Default | Description                                    |
| ---------- | -------- | ------- | ---------------------------------------------- |
| `orphans`  | `number` | `1`     | Minimum lines kept at the bottom of a page     |
| `widows`   | `number` | `1`     | Minimum lines kept at the top of the next page |

### Justified text

`textAlign: 'justify'` stretches each wrapped line to the full content width by distributing the slack across its word gaps. The last line of every paragraph keeps its natural width, and justification is preserved when a paragraph splits across pages.

```svelte
<Text text={paragraph} style={{ textAlign: 'justify' }} />
```

---

## Using `renderComponent` directly

For cases where you are not using `.pdf.svelte` files (e.g. in tests or non-Vite environments), call `renderComponent` directly:

```ts
import { renderComponent } from "svelte-pdf";
import MyDocument from "./MyDocument.svelte";

const pdf = await renderComponent(MyDocument, { title: "Hello" });
pdf.pipe(fs.createWriteStream("output.pdf"));
```

`renderComponent` runs the full pipeline: AST build → resource loading → Yoga layout → pagination → PDFKit stream. Its return value is the same Node.js `Readable` as `render()`, so `toResponse(pdf)` works here too.

---

## API reference

Everything below is exported from the package root (`svelte-pdf`) unless a
different import path is noted.

### Components

```ts
import { Document, Page, View, Text, Image, Font, Link, Canvas } from "svelte-pdf";
```

| Group | Components |
| ----- | ---------- |
| Layout & content | `Document`, `Page`, `View`, `Text`, `Image`, `Font`, `Link`, `Canvas` |
| SVG | `Svg`, `Path`, `Circle`, `Rect`, `Ellipse`, `Line`, `G`, `Polyline`, `Polygon`, `Defs`, `LinearGradient`, `RadialGradient`, `Stop`, `ClipPath`, `SvgText`, `Tspan` |
| Table | `Table`, `Row`, `Cell` |

See [Components](#components) and [SVG components](#svg-components) for props.

### Runtime functions

```ts
import { renderComponent, toResponse } from "svelte-pdf";
```

| Function | Signature | Description |
| -------- | --------- | ----------- |
| `renderComponent` | `(Component, props?) => Promise<Readable>` | Render a plain `.svelte` component to a PDF stream (no Vite plugin needed). |
| `toResponse` | `(pdf: Readable, init?: ResponseInit) => Response` | Wrap a PDF stream in a Web `Response`; defaults `Content-Type` to `application/pdf`. |
| `createDocument` | `() => DocumentContext` | Low-level: create a fresh document context. |
| `createNode` | `(type: NodeType, props?) => PDFNode` | Low-level: construct an AST node. |
| `resolveFont` | `(family: string, weight?: string, style?: string) => string` | Low-level: resolve a registered PDFKit font-variant name. |

### Types

```ts
import type { StyleProps, PageNumberRenderer } from "svelte-pdf";
```

`PDFNode`, `DocumentContext`, `StyleProps`, `NodeType`, `LayoutBox`,
`ResourceEntry`, `PDFMetadata`, `PageRenderProps`, `PageNumberRenderer`.

### Compiled templates

Each `.pdf.svelte` file, processed by the Vite plugin, exports:

| Export | Signature | Description |
| ------ | --------- | ----------- |
| `render` | `(props?) => Promise<Readable>` | Render this template to a PDF stream. |

### Vite plugin

```ts
import { sveltePDF } from "svelte-pdf/compiler/vite-plugin";
```

| Export | Signature | Description |
| ------ | --------- | ----------- |
| `sveltePDF` | `() => Plugin` | Vite plugin that compiles `.pdf.svelte` templates into `render()` modules. |

---

## How it works

The rendering pipeline is:

```
Svelte template (.pdf.svelte)
        ↓
Vite plugin compiles to server-side JS
        ↓
render(props) called
        ↓
Pass 1: Svelte executes server-side, components build a PDF node tree via context
        ↓
Async: fonts and images loaded in parallel
        ↓
Yoga computes flexbox layout (requires fonts for text measurement)
        ↓
Paginator splits the tree into pages
        ↓
PDFKit renders each page to a stream
        ↓
Node.js Readable stream returned
```

Components never touch the DOM. They use Svelte's `getContext`/`setContext` to build a tree of PDF nodes, which is then processed by the layout and rendering engines.

---

## TypeScript

All components and the `StyleProps` type are fully typed. Import types from `svelte-pdf`:

```ts
import type {
  StyleProps,
  PageNumberRenderer,
  PageRenderProps,
} from "svelte-pdf";

const footer: PageNumberRenderer = ({ pageNumber, totalPages }) =>
  `Page ${pageNumber} of ${totalPages}`;
```

---

## Limitations

- Server-side only — does not run in a browser
- Remote image and font loading requires network access at render time
- Text measurement uses PDFKit metrics; custom fonts must be declared with `<Font>` before layout runs
