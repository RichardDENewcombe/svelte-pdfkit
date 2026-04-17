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

```ts
// src/routes/report/+server.ts
import { render } from "$lib/Report.pdf.svelte";

export async function GET() {
  const pdf = await render({
    title: "Q1 Report",
    items: ["Revenue: $1M", "Users: 50k"],
  });

  return new Response(pdf as unknown as ReadableStream, {
    headers: { "Content-Type": "application/pdf" },
  });
}
```

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

| Prop    | Type         | Description                                    |
| ------- | ------------ | ---------------------------------------------- |
| `style` | `StyleProps` | Layout and visual styles                       |
| `fixed` | `boolean`    | Repeat on every page (use for headers/footers) |

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

| Prop       | Type                                 | Description                     |
| ---------- | ------------------------------------ | ------------------------------- |
| `text`     | `string`                             | Static text content             |
| `children` | `Snippet`                            | Text as Svelte children         |
| `render`   | `(props: PageRenderProps) => string` | Dynamic text (for page numbers) |
| `style`    | `StyleProps`                         | Text and layout styles          |

Use `text`, `children`, or `render` — not multiple at once.

---

### `<Image>`

Renders a PNG or JPEG image. Supports local files, base64 data URIs, and remote URLs.

```svelte
<Image src="/logo.png" style={{ width: 120, height: 60 }} />
<Image src="https://example.com/photo.jpg" style={{ width: 200, height: 150 }} />
```

| Prop    | Type         | Description                        |
| ------- | ------------ | ---------------------------------- |
| `src`   | `string`     | File path, URL, or base64 data URI |
| `style` | `StyleProps` | Width, height, and layout          |

---

### `<Font>`

Declares a custom font. Place inside `<Document>` or at the top of a `<Page>`. Fonts are loaded asynchronously before layout runs.

```svelte
<Font name="Inter" src="/fonts/Inter-Regular.ttf" />
<Font name="Inter" src="/fonts/Inter-Bold.ttf" weight="bold" />
<Font name="Inter" src="/fonts/Inter-Italic.ttf" fontStyle="italic" />
```

Then use the font name in text styles:

```svelte
<Text text="Hello" style={{ fontFamily: 'Inter', fontSize: 14 }} />
<Text text="Bold"  style={{ fontFamily: 'Inter', fontWeight: 'bold', fontSize: 14 }} />
```

| Prop        | Type                   | Description                             |
| ----------- | ---------------------- | --------------------------------------- |
| `name`      | `string`               | Font family name (used in `fontFamily`) |
| `src`       | `string`               | Path to `.ttf` or `.otf` file           |
| `weight`    | `'normal' \| 'bold'`   | Font weight variant                     |
| `fontStyle` | `'normal' \| 'italic'` | Font style variant                      |

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

### Visual

| Property                                                                                              | Type             |
| ----------------------------------------------------------------------------------------------------- | ---------------- |
| `backgroundColor`                                                                                     | CSS color string |
| `opacity`                                                                                             | number (0–1)     |
| `borderWidth`                                                                                         | number (points)  |
| `borderColor`                                                                                         | CSS color string |
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

## Using `renderComponent` directly

For cases where you are not using `.pdf.svelte` files (e.g. in tests or non-Vite environments), call `renderComponent` directly:

```ts
import { renderComponent } from "svelte-pdf";
import MyDocument from "./MyDocument.svelte";

const pdf = await renderComponent(MyDocument, { title: "Hello" });
pdf.pipe(fs.createWriteStream("output.pdf"));
```

`renderComponent` runs the full pipeline: AST build → resource loading → Yoga layout → pagination → PDFKit stream.

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
- Remote image loading requires network access at render time
- Text measurement uses PDFKit metrics; custom fonts must be declared with `<Font>` before layout runs
