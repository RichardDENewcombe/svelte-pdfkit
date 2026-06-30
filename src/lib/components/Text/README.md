# `<Text>`

Renders text with word wrapping, alignment, and typographic controls. A leaf
node — it does not lay out child components, only text.

```svelte
<script>
  import { Text } from 'svelte-pdf';
</script>

<!-- Static text via the `text` prop (preferred) -->
<Text text="Hello, world!" style={{ fontSize: 14, color: '#333' }} />

<!-- Or as children -->
<Text style={{ fontSize: 14 }}>Hello, world!</Text>

<!-- Dynamic page number (resolved at draw time, per page) -->
<Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
```

## Props

| Prop           | Type                                 | Description                                            |
| -------------- | ------------------------------------ | ------------------------------------------------------ |
| `text`         | `string`                             | Static text content                                    |
| `children`     | `Snippet`                            | Text as Svelte children                                |
| `render`       | `(props: PageRenderProps) => string` | Dynamic text computed per page (for page numbers)      |
| `style`        | `StyleProps`                         | Text and layout styles                                 |
| `breakBefore`  | `boolean`                            | Force a page break before this text                    |
| `breakAfter`   | `boolean`                            | Force a page break after this text                     |
| `keepWithNext` | `boolean`                            | Keep on the same page as the start of the next sibling |

Provide **one** of `text`, `children`, or `render`. If more than one is given, a
dev warning is logged and precedence is `render` → `text` → `children`.

`PageRenderProps` is `{ pageNumber: number; totalPages: number }`.

## Typography styles

Set these in `style`:

| Property         | Values                                                |
| ---------------- | ----------------------------------------------------- |
| `fontFamily`     | string, comma list, or `string[]` (fallback chain)    |
| `fontSize`       | number (points)                                       |
| `fontWeight`     | `'normal'` `'bold'`                                   |
| `fontStyle`      | `'normal'` `'italic'`                                 |
| `color`          | CSS color string                                      |
| `textAlign`      | `'left'` `'center'` `'right'` `'justify'`             |
| `lineHeight`     | number multiplier (e.g. `1.5`)                        |
| `letterSpacing`  | number (points)                                       |
| `textDecoration` | `'none'` `'underline'` `'line-through'`               |
| `orphans`        | min lines kept at page bottom (default `1`)           |
| `widows`         | min lines kept at page top (default `1`)              |
| `hyphenation`    | `boolean` — break overflowing words (default `false`) |
| `hyphenationLang`| `'en-gb'` (default) `'en-us'` or a registered language |

## Notes

- **Fonts must be declared before use.** Custom families need a `<Font>`
  declaration; PDFKit built-ins (`Helvetica`, `Times-Roman`, `Courier`, and
  their `-Bold`/`-Oblique` variants) work without one. See [Font](../Font/README.md).
- `fontFamily` accepts a **fallback chain** (`['Inter', 'Helvetica']` or
  `'Inter, Helvetica'`); the first registered/built-in family wins. This is
  family-level fallback — per-glyph substitution is not yet supported.
- Justified text (`textAlign: 'justify'`) pairs well with `hyphenation: true`.
  See [Page breaks and flow control](../../../../README.md#page-breaks-and-flow-control).
- Long text blocks split line-by-line across page boundaries automatically.

See the [top-level README](../../../../README.md) for the full guide.
