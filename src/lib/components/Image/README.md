# `<Image>`

Renders a PNG, JPEG, or **SVG** image. Sources may be local file paths, base64 /
data URIs, or remote `http(s)` URLs. Images are loaded asynchronously before
layout.

```svelte
<script>
  import { Image } from 'svelte-pdf';
</script>

<Image src="/logo.png" style={{ width: 120, height: 60 }} />
<Image src="https://example.com/photo.jpg" style={{ width: 200, height: 150 }} />

<!-- SVG sources render as vectors (crisp at any scale) -->
<Image src="/icons/check.svg" style={{ width: 48, height: 48 }} />
<Image src="data:image/svg+xml;base64,PHN2Zy4uLg==" style={{ width: 48, height: 48 }} />
```

## Props

| Prop           | Type         | Description                                            |
| -------------- | ------------ | ------------------------------------------------------ |
| `src`          | `string`     | File path, `http(s)` URL, or data URI (**required**)   |
| `style`        | `StyleProps` | Width, height, and layout                              |
| `breakBefore`  | `boolean`    | Force a page break before this image                   |
| `breakAfter`   | `boolean`    | Force a page break after this image                    |
| `keepWithNext` | `boolean`    | Keep on the same page as the start of the next sibling |

A missing `src` logs a dev warning and renders nothing.

## Sizing and aspect ratio

Set `width` and/or `height` in `style`:

- **Both set** → image is stretched to that exact box.
- **One set** → the other is derived from the image's intrinsic proportions
  (read from the PNG/JPEG header or the SVG `viewBox`), preserving aspect ratio.
- **Neither set** → the image reserves no space.

## Notes

- Raster sources (PNG/JPEG) are drawn by PDFKit. SVG sources are detected by
  extension, `image/svg+xml` data URI, or content sniff, then drawn as vectors
  via [svg-to-pdfkit](https://github.com/alafr/SVG-to-PDFKit).
- Each `src` is loaded once and cached for the process lifetime.
- Remote sources require network access at render time; a failed fetch logs a
  warning.
- For inline vector drawing authored as components (rather than an image file),
  use the [SVG components](../Svg/README.md) instead.

See the [top-level README](../../../../README.md) for the full guide.
