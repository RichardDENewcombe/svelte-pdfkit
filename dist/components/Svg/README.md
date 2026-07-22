# SVG components

Declarative vector graphics built on PDFKit's native drawing API. Each SVG
primitive is a real Svelte component that pushes a node into an SVG-specific
subtree inside `<Svg>` — no string templating. The renderer walks that subtree
and emits PDFKit vector calls.

```svelte
<script>
  import { Svg, Circle, Rect, Path, Line, Ellipse, G } from 'svelte-pdfkit';
</script>

<Svg width={100} height={100}>
  <Rect x={10} y={10} width={80} height={80} fill="none" stroke="#333" />
  <Circle cx={50} cy={50} r={40} fill="#1a56db" stroke="#fff" strokeWidth={2} />
  <Path d="M 10 80 L 50 20 L 90 80 Z" fill="#e5e7eb" />
  <Line x1={0} y1={0} x2={100} y2={100} stroke="red" strokeWidth={1} />
  <G opacity={0.5}>
    <Circle cx={30} cy={30} r={10} fill="green" />
  </G>
</Svg>
```

## Coordinate system

`<Svg>` participates in Yoga layout as a fixed-size box (`width` × `height`). Its
children are drawn in SVG coordinate space. If you set a `viewBox`, the content
is uniformly scaled + translated to fit the layout box; without one, SVG
coordinates are treated as PDF points directly.

## `<Svg>` — container

| Prop      | Type         | Description                                          |
| --------- | ------------ | ---------------------------------------------------- |
| `width`   | `number`     | Layout box width (**required**)                      |
| `height`  | `number`     | Layout box height (**required**)                     |
| `viewBox` | `string`     | `"min-x min-y width height"` — uniformly scales + translates the SVG coordinate space to fit the box (`xMidYMid meet`). Omit to use point coordinates directly. |
| `style`   | `StyleProps` | Extra layout props (margin, position, …); `width`/`height` are set via the dedicated props |

## Shapes

All shapes accept `fill`, `stroke`, `strokeWidth`, `opacity`, `clipPath`
(`"url(#id)"`), and stroke-dash props unless noted.

Dashed strokes are controlled with `strokeDasharray` (a `number`, or an SVG
dash string such as `"4 2"` / `"4,2"`) and an optional `strokeDashoffset`
(`number`, maps to the PDF dash phase). Non-positive / non-finite lengths are
dropped; `"none"` (or nothing usable) renders a solid stroke.

| Component    | Specific props                                        | Maps to                          |
| ------------ | ----------------------------------------------------- | -------------------------------- |
| `<Rect>`     | `x`, `y`, `width`, `height`, `rx`, `ry`               | `doc.rect()` / `doc.roundedRect()` |
| `<Circle>`   | `cx`, `cy`, `r`                                       | `doc.circle()`                   |
| `<Ellipse>`  | `cx`, `cy`, `rx`, `ry`                                | `doc.ellipse()`                  |
| `<Line>`     | `x1`, `y1`, `x2`, `y2` (stroke only)                  | `doc.moveTo().lineTo().stroke()` |
| `<Polyline>` | `points` (`"0,0 50,100 100,0"`)                       | open `doc.path()`                |
| `<Polygon>`  | `points`                                              | closed `doc.path()`              |
| `<Path>`     | `d` (SVG path data), `fillRule` (`'nonzero'`/`'evenodd'`), `fillOpacity`, `strokeOpacity` | `doc.path(d)` |

## `<G>` — group

Groups children and applies a shared `fill`/`stroke`/`strokeWidth`/`opacity`.
Children nest inside via context.

| Prop     | Type     | Description           |
| -------- | -------- | --------------------- |
| `fill` / `stroke` / `strokeWidth` / `opacity` | — | Inherited by children |

## Gradients

Define gradients inside `<Defs>`, then reference by id from a shape's `fill` or
`stroke` using `url(#id)`.

```svelte
<Svg width={200} height={100}>
  <Defs>
    <LinearGradient id="grad1" x1={0} y1={0} x2={200} y2={0}>
      <Stop offset={0} stopColor="#1a56db" />
      <Stop offset={1} stopColor="#7c3aed" />
    </LinearGradient>
    <RadialGradient id="grad2" cx={100} cy={50} r={60}>
      <Stop offset={0} stopColor="white" stopOpacity={0.9} />
      <Stop offset={1} stopColor="#1a56db" stopOpacity={0} />
    </RadialGradient>
  </Defs>

  <Rect x={0} y={0} width={200} height={100} fill="url(#grad1)" />
  <Circle cx={100} cy={50} r={40} fill="url(#grad2)" />
</Svg>
```

| Component          | Props                                                       |
| ------------------ | ----------------------------------------------------------- |
| `<Defs>`           | none — container for gradient/clip definitions              |
| `<LinearGradient>` | `id`, `x1`, `y1`, `x2`, `y2`, `gradientUnits`               |
| `<RadialGradient>` | `id`, `cx`, `cy`, `r`, `fx?`, `fy?`, `gradientUnits`        |
| `<Stop>`           | `offset` (0–1), `stopColor`, `stopOpacity?` (0–1)           |

`gradientUnits` defaults to `'userSpaceOnUse'` (coordinates in the SVG viewport).
`'objectBoundingBox'` is not yet supported.

## Clip paths

A `<ClipPath>` masks a shape to the geometry of its children. Define inside
`<Defs>`, then apply with `clipPath="url(#id)"`.

```svelte
<Svg width={200} height={200}>
  <Defs>
    <ClipPath id="clip1">
      <Rect x={20} y={20} width={160} height={160} />
    </ClipPath>
  </Defs>
  <Circle cx={100} cy={100} r={90} fill="#1a56db" clipPath="url(#clip1)" />
</Svg>
```

Any shape can serve as clip geometry. Nested clip paths are not supported.

## SVG text

Absolutely positioned text in SVG space. Unlike `<Text>`, it does not wrap. Nest
`<Tspan>` for per-span styling or manual line breaks.

```svelte
<Svg width={300} height={30}>
  <SvgText x={10} y={20} fontSize={12} fill="black">
    <Tspan text="Normal and then " />
    <Tspan text="red bold." fontFamily="Helvetica-Bold" fill="red" />
  </SvgText>
</Svg>
```

**`<SvgText>` props:** `x`, `y`, `text`, `fontSize`, `fontFamily`, `fontWeight`,
`fill`, `opacity`, `textAnchor` (`'start'`/`'middle'`/`'end'`),
`dominantBaseline`.

**`<Tspan>` props:** `text`, `x`, `y`, `dx`, `dy`, `fontSize`, `fontFamily`,
`fill`, `opacity`.

> **Baseline note:** PDFKit origins text at the top of the em square; SVG's
> alphabetic baseline sits ~`fontSize × 0.8` below that. Adjust `y` for precise
> alignment with shapes. Nested `<Tspan>` inside `<Tspan>` is not supported.

## When to use SVG vs. Canvas vs. Image

- **SVG components** — declarative shapes, gradients, clipping authored inline.
- **[`<Canvas>`](../Canvas/README.md)** — direct PDFKit control / anything the
  SVG set doesn't cover.
- **[`<Image src="*.svg">`](../Image/README.md)** — an existing `.svg` asset
  rendered as a vector.

See the [top-level README](../../../../README.md) for the full guide.
