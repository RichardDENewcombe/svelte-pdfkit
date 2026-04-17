<!--
	Test fixture: a Page with a Link wrapping a Text node.
	Used to verify that Link creates the correct node type, stores href,
	and that child components nest inside the link node.
-->
<script lang="ts">
	import Page from '../components/Page/Page.svelte';
	import View from '../components/View/View.svelte';
	import Link from '../components/Link/Link.svelte';
	import Text from '../components/Text/Text.svelte';

	const { href }: { href: string } = $props();
</script>

<Page size="A4">
	<View style={{ padding: 40 }}>
		<Link {href} style={{ flexDirection: 'row' }}>
			<Text text="Click here" style={{ fontSize: 14, color: 'blue' }} />
		</Link>
	</View>
</Page>
