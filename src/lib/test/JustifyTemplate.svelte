<script lang="ts">
	import Page from '../components/Page/Page.svelte';
	import View from '../components/View/View.svelte';
	import Text from '../components/Text/Text.svelte';

	// A long paragraph that wraps to many lines and overflows a single page so
	// the paginator must split it — exercising the carried justifyLines metadata
	// through real PDFKit rendering.
	const para = Array.from({ length: 40 }, (_, i) =>
		`Sentence number ${i + 1} contains several words so the line wraps and the justification stretches the inter-word gaps to fill the content width nicely.`
	).join(' ');
</script>

<Page size="A4" style={{ padding: 40 }}>
	<View>
		<Text style={{ fontSize: 12, textAlign: 'justify', lineHeight: 1.4 }}>{para}</Text>
	</View>
</Page>
