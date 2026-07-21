# `<Canvas>`

The low-level escape hatch. It hands you the raw PDFKit document and the
Yoga-computed layout box, so you can draw anything PDFKit supports — paths,
shapes, gradients, bezier curves — at the exact position the layout assigns.

```svelte
<script>
  import { Canvas } from 'svelte-pdfkit';
</script>

<Canvas
  style={{ width: 200, height: 100 }}
  draw={(doc, x, y, width, height) => {
    doc.rect(x, y, width, height).fill('#eef');
    doc.moveTo(x, y).lineTo(x + width, y + height).stroke('blue');
  }}
/>
```

## Props

| Prop    | Type                                                       | Description                                                  |
| ------- | ---------------------------------------------------------- | ------------------------------------------------------------ |
| `style` | `StyleProps`                                               | **Must include `width` and `height`** so Yoga allocates space — without them the canvas has zero size |
| `draw`  | `(doc, x, y, width, height) => void`                       | Drawing callback (**required**)                              |

The `draw` arguments:

| Arg      | Description                                          |
| -------- | ---------------------------------------------------- |
| `doc`    | The PDFKit document instance                         |
| `x`, `y` | Top-left of the canvas box in absolute page points   |
| `width`  | Box width computed by Yoga                            |
| `height` | Box height computed by Yoga                           |

A missing/invalid `draw` logs a dev warning and nothing is drawn.

## Notes

- `draw` runs during the render pass (after layout), so the coordinates are
  final absolute page positions — draw directly at `x`/`y`.
- `<Canvas>` is a leaf node; it has no children.
- For declarative vector graphics (shapes as components, gradients, clipping),
  prefer the [SVG components](../Svg/README.md). Reach for `<Canvas>` when you
  need direct PDFKit control or something the SVG set doesn't cover (e.g.
  charting).

See the [top-level README](../../../../README.md) for the full guide.
