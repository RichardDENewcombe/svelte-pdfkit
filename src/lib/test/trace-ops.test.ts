import { describe, it } from 'vitest';
import { createDocument } from '../runtime/document.js';
import { computeLayout } from '../layout/layout.js';
import { paginate } from '../pagination/paginate.js';

describe('trace render ops', () => {
  it('prints fill/stroke sequence for 3 rows', () => {
    const subtle = '#f3f4f6';
    const brand = '#1a56db';
    const border = '#d1d5db';

    const doc = createDocument();
    const pageNode: any = { type: 'page', props: { size: 'A4', style: { padding: 40 } }, children: [] };
    doc.children.push(pageNode);
    const tableNode: any = { type: 'view', props: { style: { width: '100%', flexDirection: 'column' } }, children: [] };
    pageNode.children.push(tableNode);

    // Header (NO borders)
    const headerRow: any = { type: 'view', props: { style: { flexShrink: 0, backgroundColor: brand, flexDirection: 'row' } }, children: [] };
    tableNode.children.push(headerRow);
    const hCell: any = { type: 'view', props: { style: { flexGrow: 1, flexBasis: 0, flexDirection: 'column', padding: 6 } }, children: [] };
    hCell.children.push({ type: 'text', props: { text: 'Header', style: { fontSize: 10 } }, children: [] });
    headerRow.children.push(hCell);

    // 3 data rows WITH cell borders
    for (let i = 0; i < 3; i++) {
      const rowBg = i % 2 === 0 ? 'white' : subtle;
      const row: any = { type: 'view', props: { style: { flexShrink: 0, backgroundColor: rowBg, flexDirection: 'row' } }, children: [] };
      tableNode.children.push(row);
      const cell: any = { type: 'view', props: { style: { flexGrow: 1, flexBasis: 0, flexDirection: 'column', padding: 5, borderWidth: 0.5, borderColor: border } }, children: [] };
      cell.children.push({ type: 'text', props: { text: `Row ${i}`, style: { fontSize: 10 } }, children: [] });
      row.children.push(cell);
    }

    computeLayout(doc);
    const pages = paginate(doc);

    function printOps(node: any, depth = 0): void {
      const s = node.props?.style ?? {};
      const l = node.layout;
      if (l && (s.backgroundColor || s.borderWidth)) {
        const bottom = l.y + l.height;
        const bw = s.borderWidth ?? 0;
        const tag = s.backgroundColor && s.borderWidth ? 'FILL+STROKE' :
                    s.backgroundColor ? 'FILL' : 'STROKE';
        console.log(`${'  '.repeat(depth)}${tag}(bg=${s.backgroundColor ?? '-'} bw=${bw}) y=${l.y.toFixed(2)}..${bottom.toFixed(2)} h=${l.height.toFixed(2)} stroke_range=[${(l.y-bw/2).toFixed(2)},${(bottom+bw/2).toFixed(2)}]`);
      }
      for (const child of node.children ?? []) printOps(child, depth+1);
    }

    console.log('=== Render op order ===');
    for (const page of pages) {
      for (const child of page.children) printOps(child, 0);
    }
  });
});
