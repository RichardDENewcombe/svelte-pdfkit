# `<Document>`

Optional root wrapper that sets PDF metadata (title, author, etc.). It renders
no visible output of its own — it only writes metadata onto the document context
and renders its children.

You do **not** need a `<Document>` for a PDF to render; a bare `<Page>` works.
Add it when you want metadata in the output file.

```svelte
<script>
  import { Document, Page, Text } from 'svelte-pdfkit';
</script>

<Document title="Invoice INV-0042" author="Acme Corp" subject="January invoice">
  <Page size="A4" style={{ padding: 40 }}>
    <Text text="Hello" />
  </Page>
</Document>
```

## Props

| Prop       | Type     | Description          |
| ---------- | -------- | -------------------- |
| `title`    | `string` | PDF document title   |
| `author`   | `string` | Author name          |
| `subject`  | `string` | Document subject     |
| `keywords` | `string` | Search keywords      |
| `creator`  | `string` | Creator application  |
| `producer` | `string` | Producer application |
| `children` | `Snippet`| Page(s) to render    |

Every prop is optional; only the ones you set are written to the PDF.

## Notes

- A document may contain multiple `<Page>` elements.
- Metadata is written once for the whole document — placing `<Document>` deeper
  in the tree, or using more than one, is not supported.

See the [top-level README](../../../../README.md) for the full guide.
