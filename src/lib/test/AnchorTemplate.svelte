<!--
	Test fixture for the `anchor` prop / `pageOf` lookup.

	Page 1 is a Table of Contents whose <Text render> lines call `pageOf(...)`
	to resolve page numbers for sections defined LATER in the document —
	the forward-reference case a real ToC needs. breakBefore forces
	deterministic page placement:

	  Page 1: Table of Contents
	  Page 2: "Dead Legs" (anchor="dead-legs")
	  Page 3+4: a 900pt-tall View (anchor="spanning-section") that spans two
	            pages — pageOf must resolve to the FIRST page (3).

	`does-not-exist` is never anchored anywhere, proving pageOf returns
	undefined for an unknown key.
-->
<script lang="ts">
	import Page from '../components/Page/Page.svelte';
	import View from '../components/View/View.svelte';
	import Text from '../components/Text/Text.svelte';
</script>

<Page size="A4" style={{ padding: 40 }}>
	<Text render={({ pageOf }) => `TOC dead-legs page: ${pageOf('dead-legs') ?? 'MISSING'}`} style={{ fontSize: 12 }} />
	<Text render={({ pageOf }) => `TOC spanning-section page: ${pageOf('spanning-section') ?? 'MISSING'}`} style={{ fontSize: 12 }} />
	<Text render={({ pageOf }) => `TOC missing page: ${pageOf('does-not-exist') ?? 'MISSING'}`} style={{ fontSize: 12 }} />

	<Text text="Dead Legs" anchor="dead-legs" breakBefore={true} style={{ fontSize: 12 }} />

	<View
		anchor="spanning-section"
		breakBefore={true}
		style={{ height: 900, marginTop: 8, backgroundColor: '#eef2ff' }}
	>
		<Text text="Spanning section body" style={{ fontSize: 12 }} />
	</View>
</Page>
