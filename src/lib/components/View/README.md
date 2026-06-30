# `<View>`

The primary layout container — the equivalent of a `<div>`. A flexbox box that
positions its children and can carry background, border, and spacing styles.

```svelte
<script>
  import { View, Text } from 'svelte-pdf';
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
| `wrap`         | `boolean`    | `true`  | Whether the view may be split across a page boundary. Set `false` to keep it whole — it moves entirely to the next page if it doesn't fit. |
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
