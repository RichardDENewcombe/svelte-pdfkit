# `<Page>`

Defines a page in the document. This is the top-level layout container —
everything you draw lives inside a `<Page>`. Content that overflows the page
height automatically flows onto new pages.

```svelte
<script>
  import { Page, View, Text } from 'svelte-pdf';
</script>

<Page size="A4" style={{ padding: 40 }}>
  <Text text="Title" style={{ fontSize: 20 }} />
  <View style={{ flexGrow: 1 }}>…</View>
</Page>
```

## Props

| Prop          | Type                                       | Default      | Description                       |
| ------------- | ------------------------------------------ | ------------ | --------------------------------- |
| `size`        | `'A4' \| 'Letter' \| 'Legal' \| [w, h]`    | `'A4'`       | Page size, or a `[width, height]` point tuple |
| `orientation` | `'portrait' \| 'landscape'`                | `'portrait'` | Page orientation                  |
| `style`       | `StyleProps`                               | `{}`         | Flexbox / padding styles for the page body |
| `children`    | `Snippet`                                  | —            | Page content                      |

An unrecognised string `size` logs a dev warning and falls back to A4.

## Page dimensions (points)

| Size     | Portrait (w × h) |
| -------- | ---------------- |
| `A4`     | 595 × 842        |
| `Letter` | 612 × 792        |
| `Legal`  | 612 × 1008       |

`landscape` swaps width and height. 1 point = 1/72 inch.

## Notes

- `style` is applied to the page as a flex container. The default
  `flexDirection` is `column`, so children stack vertically.
- Use `padding` on the page to create page margins.
- For repeating headers/footers, mark a child `<View fixed>` — see the
  [View docs](../View/README.md) and the [fixed elements section](../../../../README.md#fixed-elements-headers-and-footers).

See the [top-level README](../../../../README.md) for the full guide.
