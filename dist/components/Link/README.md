# `<Link>`

Wraps content in a clickable hyperlink. It behaves like a `<View>` for layout —
a flex container its children lay out inside — and makes that bounding box
clickable in the PDF (`doc.link(x, y, w, h, href)`).

```svelte
<script>
  import { Link, Text } from 'svelte-pdfkit';
</script>

<Link href="https://example.com">
  <Text text="Visit our website" style={{ color: '#1a56db', textDecoration: 'underline' }} />
</Link>
```

## Props

| Prop       | Type         | Description                       |
| ---------- | ------------ | --------------------------------- |
| `href`     | `string`     | Target URL (**required**)         |
| `style`    | `StyleProps` | Layout styles (same as `<View>`)  |
| `children` | `Snippet`    | The content to make clickable     |

A missing `href` logs a dev warning and the area is not clickable.

## Notes

- The clickable region is the layout box Yoga computes for the children — there
  is no separate hit area to manage.
- `<Link>` does not style its contents. Style the inner `<Text>` (e.g. colour
  and `textDecoration: 'underline'`) to make the link look like a link.
- Any components can be wrapped, not just `<Text>` — e.g. a linked `<Image>`.

See the [top-level README](../../../../README.md) for the full guide.
