// Debug test: intercepts PDFKit operations to trace what rectangles are drawn
import { describe, it, expect } from 'vitest';
import { render as svelteRender } from 'svelte/server';
import { createDocument } from '../runtime/document.js';
import { computeLayout } from '../layout/layout.js';
import { paginate } from '../pagination/paginate.js';
import TableTemplate from './TableTemplate.svelte';

describe('debug render operations', () => {
  it('traces fill and stroke operations', () => {
    const doc = createDocument();
    const context = new Map<string, unknown>([['__pdf__', doc], ['__pdf_root__', doc]]);
    const { html: _ } = svelteRender(TableTemplate as any, { props: {}, context });

    computeLayout(doc);
    const pages = paginate(doc);

    // Intercept by monkey-patching the renderPDF internals via a fake PDFKit
    const ops: Array<{op: string; args: any[]}> = [];
    
    // We'll manually walk the tree instead
    function walkNode(node: any, depth = 0) {
      const s = node.props?.style ?? {};
      const layout = node.layout;
      if (layout && (s.backgroundColor || s.borderWidth)) {
        const { x, y, width, height } = layout;
        if (s.backgroundColor && s.borderWidth) {
          console.log(`${'  '.repeat(depth)}fillAndStroke(bg=${s.backgroundColor}, bw=${s.borderWidth}) at y=${y} h=${height} bottom=${y+height}`);
        } else if (s.backgroundColor) {
          console.log(`${'  '.repeat(depth)}fill(${s.backgroundColor}) at y=${y.toFixed(4)} h=${height.toFixed(4)} bottom=${(y+height).toFixed(4)}`);
        } else if (s.borderWidth) {
          console.log(`${'  '.repeat(depth)}stroke(bw=${s.borderWidth}) at y=${y.toFixed(4)} h=${height.toFixed(4)} range=[${(y-s.borderWidth/2).toFixed(4)}, ${(y+height+s.borderWidth/2).toFixed(4)}]`);
        }
      }
      for (const child of node.children ?? []) {
        walkNode(child, depth + 1);
      }
    }
    
    for (const page of pages) {
      for (const child of page.children) {
        walkNode(child, 0);
      }
    }
  });
});
