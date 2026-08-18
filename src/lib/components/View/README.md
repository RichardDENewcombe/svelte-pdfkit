# `<View>`

The primary layout container — the equivalent of a `<div>`. A flexbox box that
positions its children and can carry background, border, and spacing styles.

```svelte
<script>
  import { View, Text } from 'svelte-pdfkit';
</script>

<View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 10 }}>
  <Text text="Left" />
  <Text text="Right" />
</View>
```

## Props

| Prop           | Type         | Default | Description                                            |
| -------------- | ------------ | ------- | ------------------------------------------------------ |
| `style`        | `StyleProps` | `{}`    | Layout and visual styles                               |
| `wrap`         | `boolean \| number` | `true` | Whether the view may be split across a page boundary. `false` keeps it whole — it moves entirely to the next page if it doesn't fit. A fraction `0`–`1` also moves it whole to the next page if it starts within (or extends into) that bottom fraction of the page. |
| `fixed`        | `boolean`    | `false` | Repeat this view on every page (headers/footers)       |
| `breakBefore`  | `boolean`    | `false` | Force a page break before this view                    |
| `breakAfter`   | `boolean`    | `false` | Force a page break after this view                     |
| `keepWithNext` | `boolean`    | `false` | Keep on the same page as the start of the next sibling |
| `children`     | `Snippet`    | —       | Nested content                                         |

## Layout

`<View>` is a flex container. The most-used `style` properties:

- `flexDirection` — `'row'` or `'column'` (default `'column'`)
- `justifyContent`, `alignItems`, `alignSelf`
- `flexGrow`, `flexShrink`, `flexBasis`, `flexWrap`, `gap`
- `width` / `height` (points or `'50%'`), `min*`/`max*`
- `padding*`, `margin*`
- `position: 'absolute'` with `top`/`right`/`bottom`/`left`
- `backgroundColor`, `border*`, `borderRadius`, `opacity`

See the [style reference](../../../../README.md#style-reference) for the full set.

## Transforms

`rotate` (degrees, clockwise), `scale` / `scaleX` / `scaleY`,
`translateX` / `translateY` (points), and `skewX` / `skewY` (degrees) transform
how the view is drawn. They are a render-time effect only — the layout box is
unchanged, so surrounding flow is unaffected (exactly like CSS `transform`). The
pivot is set by `transformOrigin`, defaulting to the view's centre. When several
are combined they apply in the order translate → rotate → scale → skew.

### `transformOrigin`

Accepts one or two space-separated tokens, or an `[x, y]` point tuple. Tokens may
be:

- **Keywords** — `left` / `right` (x axis), `top` / `bottom` (y axis), `center`
  (either axis).
- **Percentages** — `'50%'` (of the box width on x, height on y).
- **Point lengths** — `'10'`.

Keyword resolution is **axis-aware and order-independent**, like CSS: `left` /
`right` always set x and `top` / `bottom` always set y, so `'bottom right'` ===
`'right bottom'`. `center` and numeric values fill whichever axis is still free,
in source order. Any axis you don't specify defaults to centre — so a lone
`'bottom'` means bottom-centre. Keywords are case-insensitive.

```svelte
<View style={{ rotate: 15 }}>centre pivot (default)</View>
<View style={{ rotate: 15, transformOrigin: 'left top' }}>top-left pivot</View>
<View style={{ rotate: 15, transformOrigin: 'bottom' }}>bottom-centre pivot</View>
<View style={{ scale: 1.2, transformOrigin: '25% 75%' }}>percentage pivot</View>
<View style={{ scale: 1.2, transformOrigin: [10, 20] }}>point pivot</View>
```

## Flow control

`fixed`, `wrap`, `breakBefore`, `breakAfter`, and `keepWithNext` control how the
view behaves across page boundaries — see
[Page breaks and flow control](../../../../README.md#page-breaks-and-flow-control).

### Fixed header/footer example

```svelte
<View
  fixed
  style={{ position: 'absolute', bottom: 20, left: 40, right: 40,
           flexDirection: 'row', justifyContent: 'space-between' }}
>
  <Text text="Confidential" style={{ fontSize: 8, color: '#9ca3af' }} />
  <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        style={{ fontSize: 8, color: '#9ca3af' }} />
</View>
```

See the [top-level README](../../../../README.md) for the full guide.
