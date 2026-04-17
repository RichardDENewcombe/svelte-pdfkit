<!--
	Test fixture: a page with a fixed header and enough content to overflow.

	The fixed View should appear on every output page regardless of which
	page slice its y-coordinate falls into.
-->
<script lang="ts">
	import Page from '../components/Page/Page.svelte';
	import View from '../components/View/View.svelte';
	import Text from '../components/Text/Text.svelte';

	const { count = 50 }: { count?: number } = $props();
	const items = Array.from({ length: count }, (_, i) => `Row ${i + 1}`);
</script>

<Page size="A4">
	<!-- Fixed header — should appear on every page -->
	<View fixed style={{ padding: 10, flexDirection: 'row' }}>
		<Text text="Header — appears on every page" style={{ fontSize: 12 }} />
	</View>

	<!-- Flow content — overflows across pages -->
	<View style={{ padding: 20, flexDirection: 'column' }}>
		{#each items as item}
			<Text text={item} style={{ fontSize: 20 }} />
		{/each}
	</View>
</Page>
