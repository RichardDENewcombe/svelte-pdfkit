<!--
	Test fixture: generates enough text nodes to overflow a single A4 page.

	A4 height is 842pt. Each Text node is given fontSize:20 which PDFKit
	renders at roughly 24pt line height. With 50 items at 24pt each we get
	~1200pt of content — well beyond one page, forcing the paginator to
	split across two pages.

	The `count` prop controls how many rows are rendered so tests can
	produce exactly the overflow depth they need.
-->
<script lang="ts">
	import Page from '../components/Page/Page.svelte';
	import View from '../components/View/View.svelte';
	import Text from '../components/Text/Text.svelte';

	const { count = 50 }: { count?: number } = $props();

	const items = Array.from({ length: count }, (_, i) => `Line ${i + 1}`);
</script>

<Page size="A4">
	<View style={{ padding: 20, flexDirection: 'column' }}>
		{#each items as item}
			<Text text={item} style={{ fontSize: 20 }} />
		{/each}
	</View>
</Page>
