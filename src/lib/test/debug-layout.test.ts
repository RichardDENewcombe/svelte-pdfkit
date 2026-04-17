import { describe, it } from 'vitest';
import { render as svelteRender } from 'svelte/server';
import { createDocument } from '../runtime/document.js';
import { computeLayout } from '../layout/layout.js';
import TableTemplate from './TableTemplate.svelte';

describe('debug table row layout', () => {
  it('prints row y positions and checks for gaps', () => {
    const doc = createDocument();
    const context = new Map<string, unknown>([['__pdf__', doc], ['__pdf_root__', doc]]);
    const { html: _ } = svelteRender(TableTemplate as any, { props: {}, context });

    computeLayout(doc);

    const page = doc.children[0];
    const wrapper = page.children[0];
    const table = wrapper.children[0];

    console.log('Table layout:', JSON.stringify(table.layout));
    let gapFound = false;
    for (let i = 0; i < table.children.length; i++) {
      const row = table.children[i];
      console.log(`Row ${i}: y=${row.layout?.y} h=${row.layout?.height} bottom=${(row.layout?.y ?? 0) + (row.layout?.height ?? 0)}`);
      if (i > 0) {
        const prevRow = table.children[i - 1];
        if (row.layout && prevRow.layout) {
          const gap = row.layout.y - (prevRow.layout.y + prevRow.layout.height);
          if (Math.abs(gap) > 0.0001) {
            console.log(`  *** GAP: ${gap}pt between row ${i-1} and row ${i}`);
            gapFound = true;
          }
        }
      }
    }
    if (!gapFound) console.log('No gaps found between rows');
  });
});
