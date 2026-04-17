<!--
	Test fixture: a Page with a Canvas node.
	The draw function receives the PDFKit doc and layout coordinates —
	we capture the call args via an onDraw callback prop so tests can
	assert the values without needing to parse the PDF bytes.
-->
<script lang="ts">
	import Page from '../components/Page/Page.svelte';
	import View from '../components/View/View.svelte';
	import Canvas from '../components/Canvas/Canvas.svelte';

	const {
		onDraw
	}: {
		onDraw: (doc: any, x: number, y: number, w: number, h: number) => void;
	} = $props();
</script>

<Page size="A4">
	<View style={{ padding: 40 }}>
		<Canvas style={{ width: 200, height: 100 }} draw={onDraw} />
	</View>
</Page>
