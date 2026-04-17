<script lang="ts">
	import Document from '../components/Document/Document.svelte';
	import Page from '../components/Page/Page.svelte';
	import View from '../components/View/View.svelte';

	const {
		title,
		author,
		subject,
		keywords,
		creator,
		producer
	}: {
		title?: string;
		author?: string;
		subject?: string;
		keywords?: string;
		creator?: string;
		producer?: string;
	} = $props();
</script>

<Document {title} {author} {subject} {keywords} {creator} {producer}>
	<Page>
		<View style={{ width: 100, height: 100 }} />
	</Page>
</Document>
