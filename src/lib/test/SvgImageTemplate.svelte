<!--
	Test fixture: renders an <Image> from an SVG source (file path, data URI, or
	URL passed as the `src` prop). Used by the SVG-image end-to-end tests.
-->
<script lang="ts">
	import Page from '../components/Page/Page.svelte';
	import View from '../components/View/View.svelte';
	import Image from '../components/Image/Image.svelte';

	const { src }: { src: string } = $props();
</script>

<Page size="A4" style={{ padding: 40 }}>
	<View style={{ flexDirection: 'row', gap: 16 }}>
		<Image src={src} style={{ width: 120, height: 120 }} />
		<Image src={src} style={{ width: 60, height: 60 }} />
	</View>
</Page>
