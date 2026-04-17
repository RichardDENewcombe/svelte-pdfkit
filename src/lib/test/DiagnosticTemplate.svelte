<script lang="ts">
	import { getContext } from 'svelte';
	import type { PDFNode } from '../types/pdf.js';

	// Simply read the context and call a callback — no push/pop, no children
	const { onContext }: { onContext: (ctx: unknown) => void } = $props();

	const ctx = getContext<PDFNode>('__pdf__');
	onContext(ctx);
</script>
