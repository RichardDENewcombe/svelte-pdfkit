# Table components

`<Table>`, `<Row>`, and `<Cell>` are thin, semantic wrappers over `<View>` flex
layout. They exist for readability — a table is a column of rows, a row is a
horizontal flex container, and a cell is a flex child.

```svelte
<script>
  import { Table, Row, Cell, Text } from 'svelte-pdfkit';
  const { items } = $props();
</script>

<Table>
  <Row style={{ backgroundColor: '#1a56db' }}>
    <Cell style={{ padding: 6, flexGrow: 2 }}>
      <Text text="Product" style={{ color: 'white', fontFamily: 'Helvetica-Bold', fontSize: 10 }} />
    </Cell>
    <Cell style={{ padding: 6 }}>
      <Text text="Price" style={{ color: 'white', fontFamily: 'Helvetica-Bold', fontSize: 10 }} />
    </Cell>
  </Row>

  {#each items as item, i}
    <Row style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f9fafb' }}>
      <Cell style={{ padding: 5, flexGrow: 2 }}>
        <Text text={item.name} style={{ fontSize: 10 }} />
      </Cell>
      <Cell style={{ padding: 5 }}>
        <Text text={item.price} style={{ fontSize: 10, textAlign: 'right' }} />
      </Cell>
    </Row>
  {/each}
</Table>
```

## Components and defaults

| Component | Renders as              | Default style                                  |
| --------- | ----------------------- | ---------------------------------------------- |
| `<Table>` | `<View>` (column)       | `width: '100%'`, `flexDirection: 'column'`     |
| `<Row>`   | `<View>` (row)          | `flexShrink: 0`, `flexDirection: 'row'`        |
| `<Cell>`  | `<View>` (column)       | `flexGrow: 1`, `flexBasis: 0` (equal columns)  |

Each accepts `style` (and `children`). `flexDirection` is fixed by the component
and cannot be overridden on `<Table>` / `<Row>`.

## Column widths

Cells split a row equally by default. Control widths via `style`:

```svelte
<Cell style={{ flexGrow: 2 }}>Wide (2 parts)</Cell>
<Cell style={{ flexGrow: 1 }}>Narrow (1 part)</Cell>

<Cell style={{ width: 120 }}>Fixed 120pt column</Cell>
```

## Notes

- Because these are just `<View>`s, all `<View>` styling applies —
  `backgroundColor`, `border*`, `padding`, alignment, etc.
- For borders between cells, set per-side borders on the cells (e.g.
  `borderBottomWidth`) rather than a single table border.
- Rows flow across page boundaries like any other content; a header row does not
  automatically repeat. For a repeating header, render it as a `fixed` `<View>`
  or repeat it per page manually.

See the [top-level README](../../../../README.md) for the full guide.
