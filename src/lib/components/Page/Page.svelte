<script lang="ts">
  import { getContext, setContext } from 'svelte';
  import type { Snippet } from 'svelte';
  import type { PDFNode, StyleProps } from '../../types/pdf.js';
  import { warn } from '../../runtime/warn.js';

  const {
    style = {},
    size = 'A4',
    orientation = 'portrait',
    children
  }: {
    style?: StyleProps;
    size?: string;
    orientation?: 'portrait' | 'landscape';
    children?: Snippet;
  } = $props();

  const KNOWN_SIZES = new Set(['A4', 'Letter', 'Legal']);

  const parent = getContext<PDFNode>('__pdf__');

  if (typeof size === 'string' && !KNOWN_SIZES.has(size)) {
    warn(`<Page size="${size}"> is not a recognised page size. Use 'A4', 'Letter', 'Legal', or a [width, height] tuple. Falling back to A4.`);
  }

  const node: PDFNode = { type: 'page', props: { style, size, orientation }, children: [] };
  parent.children.push(node);
  setContext('__pdf__', node);

</script>

{@render children?.()}
