import { describe, it } from 'vitest';
import { render as svelteRender } from 'svelte/server';
import { createDocument } from '../runtime/document.js';
import { computeLayout } from '../layout/layout.js';
import { paginate } from '../pagination/paginate.js';

// Inline minimal demo - replicating DemoDocument table without image/network
import Page from '../components/Page/Page.svelte';
import View from '../components/View/View.svelte';
import Text from '../components/Text/Text.svelte';
import Table from '../components/Table/Table.svelte';
import Row from '../components/Table/Row.svelte';
import Cell from '../components/Table/Cell.svelte';

describe('DemoDocument-like row layout', () => {
  it('checks row heights and gaps with alternating backgrounds', () => {
    const doc = createDocument();
    const context = new Map<string, unknown>([['__pdf__', doc], ['__pdf_root__', doc]]);

    // Manually build the AST (simulates the Svelte component tree)
    // Page with padding 40
    const pageNode: any = { type: 'page', props: { size: 'A4', style: { padding: 40 } }, children: [] };
    doc.children.push(pageNode);

    const tableNode: any = { type: 'view', props: { style: { width: '100%', flexDirection: 'column' } }, children: [] };
    pageNode.children.push(tableNode);

    const brand = '#1a56db';
    const subtle = '#f3f4f6';
    const border = '#d1d5db';

    // Header row
    const headerRow: any = { type: 'view', props: { style: { flexShrink: 0, backgroundColor: brand, flexDirection: 'row' } }, children: [] };
    tableNode.children.push(headerRow);
    for (const label of ['Description', 'Qty', 'Unit', 'Total']) {
      const flexGrow = label === 'Description' ? 3 : 1;
      const cell: any = { type: 'view', props: { style: { flexGrow, flexBasis: 0, flexDirection: 'column', padding: 6 } }, children: [] };
      const txt: any = { type: 'text', props: { text: label, style: { fontFamily: 'Helvetica-Bold', fontSize: 10 } }, children: [] };
      cell.children.push(txt);
      headerRow.children.push(cell);
    }

    // 10 data rows (enough to see the pattern)
    const items = Array.from({ length: 10 }, (_, i) => ({
      name: `Item ${i + 1}`, qty: 1, unit: '$10.00', total: '$10.00'
    }));

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rowBg = i % 2 === 0 ? 'white' : subtle;
      const row: any = { type: 'view', props: { style: { flexShrink: 0, backgroundColor: rowBg, flexDirection: 'row' } }, children: [] };
      tableNode.children.push(row);
      for (const text of [item.name, String(item.qty), item.unit, item.total]) {
        const flexGrow = text === item.name ? 3 : 1;
        const cell: any = { type: 'view', props: { style: { flexGrow, flexBasis: 0, flexDirection: 'column', padding: 5, borderWidth: 0.5, borderColor: border } }, children: [] };
        const txt: any = { type: 'text', props: { text, style: { fontFamily: 'Helvetica', fontSize: 10 } }, children: [] };
        cell.children.push(txt);
        row.children.push(cell);
      }
    }

    computeLayout(doc);

    const page = doc.children[0];
    const table = page.children[0]; // table is direct child of page

    console.log('Table layout:', JSON.stringify(table.layout));
    
    // Print header + data rows
    for (let i = 0; i < table.children.length; i++) {
      const row = table.children[i];
      const y = row.layout?.y ?? 0;
      const h = row.layout?.height ?? 0;
      console.log(`Row ${i}: y=${y.toFixed(6)} h=${h.toFixed(6)} bottom=${(y+h).toFixed(6)}`);
    }

    // Check for gaps
    let gapFound = false;
    for (let i = 1; i < table.children.length; i++) {
      const prev = table.children[i-1];
      const curr = table.children[i];
      if (prev.layout && curr.layout) {
        const gap = curr.layout.y - (prev.layout.y + prev.layout.height);
        if (Math.abs(gap) > 0.0001) {
          console.log(`GAP between row ${i-1} and ${i}: ${gap}pt`);
          gapFound = true;
        }
      }
    }
    if (!gapFound) console.log('No layout gaps found');

    // Also check cell heights vs row heights
    for (let i = 0; i < table.children.length; i++) {
      const row = table.children[i];
      for (let j = 0; j < row.children.length; j++) {
        const cell = row.children[j];
        if (row.layout && cell.layout) {
          const diff = Math.abs(cell.layout.height - row.layout.height);
          if (diff > 0.0001) {
            console.log(`Row ${i} Cell ${j}: cell height ${cell.layout.height.toFixed(6)} != row height ${row.layout.height.toFixed(6)} diff=${diff}`);
          }
        }
      }
    }
  });
});
