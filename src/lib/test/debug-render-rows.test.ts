// Render a simplified DemoDocument-like table to a PDF file to examine gaps
import { describe, it } from 'vitest';
import { render as svelteRender } from 'svelte/server';
import { createDocument } from '../runtime/document.js';
import { computeLayout } from '../layout/layout.js';
import { paginate } from '../pagination/paginate.js';
import { renderPDF } from '../renderer/render.js';
import { writeFileSync } from 'fs';

// Inline page/view/text/table building
describe('render table to file', () => {
  it('writes a PDF with alternating row backgrounds', async () => {
    const doc = createDocument();
    const subtle = '#f3f4f6';
    const border = '#d1d5db';
    const brand = '#1a56db';

    const pageNode: any = { type: 'page', props: { size: 'A4', style: { padding: 40 } }, children: [] };
    doc.children.push(pageNode);

    const tableNode: any = { type: 'view', props: { style: { width: '100%', flexDirection: 'column' } }, children: [] };
    pageNode.children.push(tableNode);

    // Header row
    const headerRow: any = { type: 'view', props: { style: { flexShrink: 0, backgroundColor: brand, flexDirection: 'row' } }, children: [] };
    tableNode.children.push(headerRow);
    for (const [label, grow] of [['Description', 3], ['Qty', 1], ['Unit', 1], ['Total', 1]] as [string, number][]) {
      const cell: any = { type: 'view', props: { style: { flexGrow: grow, flexBasis: 0, flexDirection: 'column', padding: 6 } }, children: [] };
      const txt: any = { type: 'text', props: { text: label, style: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: 'white' } }, children: [] };
      cell.children.push(txt);
      headerRow.children.push(cell);
    }

    // 20 data rows
    for (let i = 0; i < 20; i++) {
      const rowBg = i % 2 === 0 ? 'white' : subtle;
      const row: any = { type: 'view', props: { style: { flexShrink: 0, backgroundColor: rowBg, flexDirection: 'row' } }, children: [] };
      tableNode.children.push(row);
      for (const [text, grow] of [
        [`Item ${i+1}`, 3], [String(i+1), 1], ['$10.00', 1], ['$10.00', 1]
      ] as [string, number][]) {
        const cell: any = { type: 'view', props: { style: { flexGrow: grow, flexBasis: 0, flexDirection: 'column', padding: 5, borderWidth: 0.5, borderColor: border } }, children: [] };
        const txt: any = { type: 'text', props: { text, style: { fontFamily: 'Helvetica', fontSize: 10 } }, children: [] };
        cell.children.push(txt);
        row.children.push(cell);
      }
    }

    computeLayout(doc);

    // Print row heights to detect inconsistencies
    const table = pageNode.children[0];
    console.log('Row heights:');
    for (let i = 0; i < table.children.length; i++) {
      const row = table.children[i];
      console.log(`  Row ${i}: y=${row.layout?.y} h=${row.layout?.height}`);
    }

    const pages = paginate(doc);
    const pdfStream = renderPDF(pages, doc.resources);

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      pdfStream.on('data', (c: Buffer) => chunks.push(c));
      pdfStream.on('end', () => resolve());
      pdfStream.on('error', reject);
    });

    const pdfBuf = Buffer.concat(chunks);
    writeFileSync('/tmp/debug-table-rows.pdf', pdfBuf);
    console.log(`PDF written to /tmp/debug-table-rows.pdf (${pdfBuf.length} bytes)`);
  });
});
