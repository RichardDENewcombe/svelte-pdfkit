# svelte-pdfkit — LLM usage guide

A dense, authoritative reference for generating correct svelte-pdfkit code. If you
are an AI assistant writing PDF templates with this library, read this file
first. It states the rules, the complete API surface, and the features that do
**not** exist (so you don't invent them).

`svelte-pdfkit` renders PDFs from Svelte 5 components, **server-side only** (Node /
edge), via Yoga (flexbox layout) + PDFKit (drawing). No DOM, no browser.

---

## Mental model (rules — follow exactly)

1. **It's Svelte, not HTML.** Templates are `.svelte` / `.pdf.svelte` files.
   Use `{#each}`, `{#if}`, `$props()`, etc. There are **no** HTML elements
   (`div`, `span`, `p`) — use `<View>` and `<Text>`.
2. **Text only lives in `<Text>`.** Bare text inside a `<View>` or `<Page>` is
   invalid. Wrap every string in `<Text>`.
3. **Everything is flexbox.** Styling is a subset of CSS flexbox + a few visual
   props, passed as a `style` object: `style={{ ... }}`. Units are PDF **points**
   (1pt = 1/72 inch); percentages allowed for `width`/`height` as strings
   (`'50%'`). There is **no** `display`, `grid`, `float`, or CSS string syntax.
4. **Default layout direction is `column`** (top-to-bottom), like React Native —
   not `row`. Set `flexDirection: 'row'` for horizontal.
5. **Declare fonts before using them.** Custom `fontFamily` needs a `<Font>`.
   PDFKit built-ins work without declaration (see below).
6. **Pages auto-paginate.** Content overflowing a `<Page>` flows to new pages
   automatically. You rarely manage pages manually.
7. **`render()` returns a Node.js `Readable` stream**, not a Buffer or Blob.

---

## Setup

### Vite plugin (compiles `.pdf.svelte` → a `render()` export)

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { sveltePDF } from 'svelte-pdfkit/compiler/vite-plugin';

export default { plugins: [sveltePDF(), sveltekit()] }; // sveltePDF() must be first
```

### Render and serve (SvelteKit)

```ts
// +server.ts
import { toResponse } from 'svelte-pdfkit';
import { render } from '$lib/Invoice.pdf.svelte';

export async function GET() {
  const pdf = await render({ invoice });            // Promise<Readable>
  return toResponse(pdf);                            // Web Response, Content-Type: application/pdf
  // download: toResponse(pdf, { headers: { 'Content-Disposition': 'attachment; filename="invoice.pdf"' } })
}
```

### Render to a file (Node)

```ts
import fs from 'node:fs';
import { render } from './Invoice.pdf.svelte';
const pdf = await render({ invoice });
pdf.pipe(fs.createWriteStream('invoice.pdf'));
```

### Without the Vite plugin (plain `.svelte` component)

```ts
import { renderComponent } from 'svelte-pdfkit';
import Doc from './Doc.svelte';
const pdf = await renderComponent(Doc, { title: 'Hi' });
```

---

## Minimal complete template

```svelte
<!-- Invoice.pdf.svelte -->
<script lang="ts">
  import { Document, Page, View, Text, Font } from 'svelte-pdfkit';
  const { invoice } = $props();
</script>

<Document title={`Invoice ${invoice.number}`} author={invoice.company}>
  <Font name="Inter" src="/fonts/Inter-Regular.ttf" />
  <Font name="Inter" src="/fonts/Inter-Bold.ttf" weight="bold" />

  <Page size="A4" style={{ padding: 40, fontFamily: 'Inter', fontSize: 11 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
      <Text text={invoice.company} style={{ fontSize: 22, fontWeight: 'bold' }} />
      <Text text={invoice.date} style={{ color: '#6b7280' }} />
    </View>

    {#each invoice.lines as line}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text text={line.description} />
        <Text text={line.amount} style={{ textAlign: 'right' }} />
      </View>
    {/each}

    <!-- Fixed footer with page numbers, repeated on every page -->
    <View fixed style={{ position: 'absolute', bottom: 20, left: 40, right: 40,
                         flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text text="Thank you" style={{ fontSize: 8, color: '#9ca3af' }} />
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
            style={{ fontSize: 8, color: '#9ca3af' }} />
    </View>
  </Page>
</Document>
```

---

## Components (complete)

Import everything from `'svelte-pdfkit'`.

### Layout & content

| Component    | Purpose | Key props |
| ------------ | ------- | --------- |
| `<Document>` | Optional root; sets PDF metadata | `title` `author` `subject` `keywords` `creator` `producer` |
| `<Page>`     | A page; auto-paginates overflow | `size` (`'A4'`/`'Letter'`/`'Legal'`/`[w,h]`, default `'A4'`), `orientation` (`'portrait'`/`'landscape'`), `style` |
| `<View>`     | Flex box container (the `<div>`) | `style`, `wrap` (default `true`), `fixed`, `breakBefore`, `breakAfter`, `keepWithNext` |
| `<Text>`     | Text (leaf) | `text` *or* children *or* `render`, `style`, `breakBefore`, `breakAfter`, `keepWithNext` |
| `<Image>`    | PNG/JPEG/SVG image | `src` (path/URL/data-URI), `style`, `breakBefore`, `breakAfter`, `keepWithNext` |
| `<Font>`     | Declares a custom font (renders nothing) | `name`, `src`, `weight` (`'normal'`/`'bold'`), `style` (`'normal'`/`'italic'`) |
| `<Link>`     | Clickable hyperlink wrapper | `href`, `style`, children |
| `<Canvas>`   | Raw PDFKit escape hatch | `style` (needs `width`+`height`), `draw: (doc, x, y, w, h) => void` |

`<Text>` content: provide exactly one of `text` (string), children, or `render`
(`({ pageNumber, totalPages }) => string`, for page numbers). Precedence if more
than one is given: `render` → `text` → children.

### SVG (vector graphics) — `style` not used; props are SVG coords

```
<Svg width height viewBox? style>
  <Rect x y width height rx ry fill stroke strokeWidth opacity clipPath />
  <Circle cx cy r ... />   <Ellipse cx cy rx ry ... />
  <Line x1 y1 x2 y2 stroke strokeWidth />
  <Polyline points fill stroke strokeWidth />   <Polygon points ... />
  <Path d fill stroke strokeWidth fillRule fillOpacity strokeOpacity />
  <G fill stroke strokeWidth opacity> ...children... </G>
  <!-- All shapes also accept strokeDasharray ("4 2" | number) + strokeDashoffset for dashed strokes. -->
  <Defs>
    <LinearGradient id x1 y1 x2 y2> <Stop offset stopColor stopOpacity /> ... </LinearGradient>
    <RadialGradient id cx cy r fx? fy?> <Stop .../> </RadialGradient>
    <ClipPath id> ...shape... </ClipPath>
  </Defs>
  <SvgText x y text fontSize fontFamily fontWeight fill opacity textAnchor>
    <Tspan text x y dx dy fontSize fontFamily fill opacity />
  </SvgText>
</Svg>
```

- Reference a gradient/clip from a shape: `fill="url(#id)"`, `clipPath="url(#id)"`.
- `<Svg>` takes a fixed `width`/`height` box. With a `viewBox` the content scales
  to fit; without one, SVG coords are PDF points.
- SVG text does not wrap.

### Table (sugar over `<View>` flex)

```svelte
<Table>                          <!-- View, column, width 100% -->
  <Row>                          <!-- View, row -->
    <Cell style={{ flexGrow: 2 }}><Text text="Wide" /></Cell>
    <Cell><Text text="Equal" /></Cell>   <!-- default flexGrow:1 -->
    <Cell style={{ width: 80 }}><Text text="Fixed" /></Cell>
  </Row>
</Table>
```

All three accept `style`. Cells are equal-width by default; use `flexGrow` for
ratios or `width` for fixed columns. Header rows do **not** auto-repeat.

---

## Style reference (`StyleProps`, complete)

All numeric values are points unless noted.

**Flexbox:** `flexDirection` (`row`/`column`/`row-reverse`/`column-reverse`),
`flexGrow`, `flexShrink`, `flexBasis`, `flexWrap` (`wrap`/`nowrap`),
`justifyContent` (`flex-start`/`flex-end`/`center`/`space-between`/`space-around`/`space-evenly`),
`alignItems` (`flex-start`/`flex-end`/`center`/`stretch`/`baseline`),
`alignSelf` (+`auto`), `gap`.

**Sizing:** `width`, `height` (number or `'50%'`), `minWidth`, `maxWidth`,
`minHeight`, `maxHeight`.

**Spacing:** `margin`, `marginTop/Right/Bottom/Left`, `padding`,
`paddingTop/Right/Bottom/Left`.

**Position:** `position` (`relative`/`absolute`), `top`, `right`, `bottom`, `left`.

**Typography (on `<Text>`):** `fontFamily` (string | comma-list | `string[]`
fallback chain), `fontSize`, `fontWeight` (`normal`/`bold`), `fontStyle`
(`normal`/`italic`), `color`, `textAlign` (`left`/`center`/`right`/`justify`),
`lineHeight` (multiplier), `letterSpacing`, `textDecoration`
(`none`/`underline`/`line-through`), `orphans`, `widows`, `hyphenation` (bool),
`hyphenationLang` (`en-gb` default / `en-us` / registered).

**Visual:** `backgroundColor`, `opacity` (0–1), `borderWidth`, `borderColor`,
`border{Top,Right,Bottom,Left}Width`, `border{Top,Right,Bottom,Left}Color`,
`borderRadius`, `border{TopLeft,TopRight,BottomLeft,BottomRight}Radius`.

Colors are CSS color strings (`'#1a56db'`, `'white'`, `'rgb(...)'`).

---

## Fonts

Built-in PDFKit fonts need **no** `<Font>`: `Helvetica`, `Helvetica-Bold`,
`Helvetica-Oblique`, `Helvetica-BoldOblique`, `Times-Roman`, `Times-Bold`,
`Times-Italic`, `Times-BoldItalic`, `Courier` (+ `-Bold`/`-Oblique`),
`Symbol`, `ZapfDingbats`.

Custom fonts: one `<Font>` per variant; use the family name + `fontWeight`/
`fontStyle` in `<Text>`:

```svelte
<Font name="Inter" src="/fonts/Inter-Regular.ttf" />
<Font name="Inter" src="/fonts/Inter-Bold.ttf" weight="bold" />
<Text style={{ fontFamily: 'Inter', fontWeight: 'bold' }}>Bold</Text>
```

Fallback chain: `fontFamily: ['Inter', 'Helvetica']`. The list is also a
per-glyph fallback — each character uses the first family that has its glyph, so
`['Inter', 'NotoSansSC']` renders Latin from Inter and CJK from Noto in the same
run. Colour emoji renders monochrome (PDFKit limitation).

---

## Page flow control

- **Auto-pagination:** overflow flows to new pages; long `<Text>` splits
  line-by-line.
- **`breakBefore` / `breakAfter`** (on `<View>`/`<Text>`/`<Image>`): force a page
  break before/after.
- **`keepWithNext`**: keep a node with the start of its next sibling (e.g. a
  heading with its body).
- **`wrap={false}`** (on `<View>`): keep the view whole — move it to the next
  page rather than splitting it.
- **`fixed`** (on `<View>`): repeat on every page; combine with
  `position: 'absolute'` for headers/footers.
- **Page numbers:** `<Text render={({ pageNumber, totalPages }) => ...} />`.
- **`orphans` / `widows`** (on `<Text>` style, default 1): min lines at page
  bottom/top.
- **Justify + hyphenation:** `style={{ textAlign: 'justify', hyphenation: true }}`.
  Set global language with `setDefaultHyphenationLang('en-us')`, or register
  other languages with `registerHyphenationCallback(word => parts)`.

---

## Runtime exports (from `'svelte-pdfkit'`)

| Export | Signature | Use |
| ------ | --------- | --- |
| `toResponse` | `(pdf, init?) => Response` | Wrap stream in a Web Response (default `application/pdf`) |
| `renderComponent` | `(Component, props?) => Promise<Readable>` | Render a plain `.svelte` without the Vite plugin |
| `setDefaultHyphenationLang` | `(lang) => void` | Global hyphenation language |
| `registerHyphenationCallback` | `(fn) => void` | Custom hyphenation |
| `hyphenateWord` | `(word, lang?) => string[]` | Low-level hyphenation |
| `configureRemoteResources` | `(opts) => void` | Policy for remote font/image fetches: `timeoutMs`, `maxBytes`, `allowPrivateHosts`, `allowHost`, `cacheMax` |
| `createDocument`, `createNode`, `resolveFont` | — | Low-level internals (rarely needed) |

Remote (`http(s)`) fonts/images are fetched server-side with a 10 s timeout, a
10 MiB size cap, and an SSRF guard that blocks private/loopback/metadata hosts by
default. Failures are warned and skipped. Adjust via `configureRemoteResources`.

Types: `StyleProps`, `PageRenderProps`, `PageNumberRenderer`, `PDFNode`,
`DocumentContext`, `NodeType`, `LayoutBox`, `ResourceEntry`, `PDFMetadata`,
`RemoteResourceConfig`.

---

## NOT supported — do not generate these

- HTML elements (`div`, `span`, `p`, `table`/`tr`/`td` — use the components above).
- CSS strings (`style="..."`), CSS classes, `class=`, stylesheets, `@media`.
- `display`, `grid`, `float`, `inline`, `z-index`, box-shadow. (Transforms —
  `rotate` / `scale` / `translateX` / `translateY` / `skewX` / `skewY` — ARE
  supported on layout nodes; see the transform style props.)
- Colour emoji (COLR/CBDT/sbix) — per-glyph fallback works, but emoji render
  monochrome (gated by PDFKit).
- Fillable form fields (AcroForm), file attachments.
- Running in the browser; reading from the DOM.
- `gradientUnits: 'objectBoundingBox'`, nested `<ClipPath>`, nested `<Tspan>`.

---

## Common mistakes

- Putting raw text in a `<View>` → wrap it in `<Text>`.
- Forgetting `flexDirection: 'row'` and expecting horizontal layout (default is
  column).
- Using a `fontFamily` without a matching `<Font>` (and it's not a built-in).
- Sizing a `<Canvas>` or `<Svg>` without `width`/`height` → zero size, nothing
  drawn.
- `await`ing `toResponse` (it's synchronous) or `render` returning a Buffer
  (it's a `Readable` stream — `await` the `render()` call, then stream it).
- Expecting a table header row to repeat across pages — render it `fixed` or
  repeat it manually.

---

For prose explanations and more examples see [`README.md`](./README.md); for
internals and contribution setup see [`CONTRIBUTING.md`](./CONTRIBUTING.md).
