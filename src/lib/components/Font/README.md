# `<Font>`

Declares a custom font for use in `fontFamily` styles. It renders nothing — it
only registers a font resource that is loaded asynchronously before layout, then
registered with PDFKit so text measurement and drawing use the correct metrics.

Place `<Font>` inside `<Document>` or near the top of a `<Page>`, before the text
that uses it.

```svelte
<script>
  import { Font, Text } from 'svelte-pdf';
</script>

<!-- Local files: register each weight/style as a separate variant -->
<Font name="Inter" src="/fonts/Inter-Regular.ttf" />
<Font name="Inter" src="/fonts/Inter-Bold.ttf" weight="bold" />
<Font name="Inter" src="/fonts/Inter-Italic.ttf" style="italic" />

<!-- Remote URL — fetched at render time -->
<Font name="Inter" src="https://example.com/fonts/Inter-Regular.ttf" />

<Text text="Regular" style={{ fontFamily: 'Inter' }} />
<Text text="Bold"    style={{ fontFamily: 'Inter', fontWeight: 'bold' }} />
```

## Props

| Prop     | Type                   | Default    | Description                                   |
| -------- | ---------------------- | ---------- | --------------------------------------------- |
| `name`   | `string`               | —          | Family name used in `fontFamily` (**required**) |
| `src`    | `string`               | —          | Path or `http(s)` URL to a `.ttf`/`.otf` file (**required**) |
| `weight` | `'normal' \| 'bold'`   | `'normal'` | Weight variant                                |
| `style`  | `'normal' \| 'italic'` | `'normal'` | Style variant                                 |

Missing `name` or `src` logs a dev warning and the font is not registered.

## Variants

Register the same `name` multiple times with different `weight` / `style` values
to build a family. `<Text>` then resolves the right file from `fontWeight` /
`fontStyle`:

```svelte
<Font name="Inter" src="/fonts/Inter-Regular.ttf" />
<Font name="Inter" src="/fonts/Inter-Bold.ttf" weight="bold" />

<Text style={{ fontFamily: 'Inter', fontWeight: 'bold' }}>Bold Inter</Text>
```

## Notes

- **Built-in fonts need no declaration:** `Helvetica`, `Helvetica-Bold`,
  `Helvetica-Oblique`, `Times-Roman`, `Times-Bold`, `Courier`, etc.
- Each `src` is loaded once and cached for the process lifetime.
- A remote font that fails to load logs a warning and falls back to Helvetica.
- `fontFamily` supports **fallback chains** (`['Inter', 'Helvetica']`) so a
  missing custom font degrades to the next choice. See [Text](../Text/README.md).

See the [top-level README](../../../../README.md) for the full guide.
