<!--
	Test fixture: a fixed header nested two levels deep inside non-fixed Views,
	with enough flow content to force multiple pages.

	Page > View (non-fixed) > View (fixed header)
	Page > View (non-fixed, flow content rows)

	The nested fixed View must appear on every output page even though it is
	not a direct child of the Page node.
-->
<script lang="ts">
	import Page from '../components/Page/Page.svelte';
	import View from '../components/View/View.svelte';
	import Text from '../components/Text/Text.svelte';

	const { count = 50 }: { count?: number } = $props();
	const items = Array.from({ length: count }, (_, i) => `Row ${i + 1}`);
</script>

<Page size="A4">
	<!-- Non-fixed wrapper — fixed header is nested one level inside it -->
	<View>
		<View fixed style={{ padding: 10 }}>
			<Text text="Nested Fixed Header" style={{ fontSize: 12 }} />
		</View>
	</View>

	<!-- Flow content — overflows onto page 2 -->
	<View style={{ paddingTop: 40, flexDirection: 'column' }}>
		{#each items as item}
			<Text text={item} style={{ fontSize: 20 }} />
		{/each}
	</View>
</Page>
