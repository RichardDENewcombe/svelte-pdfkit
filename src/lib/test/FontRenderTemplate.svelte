<!--
	Test fixture: a full document that declares a custom font and uses it in Text.
	Used by the end-to-end font rendering test to verify the complete pipeline:
	  Font declaration → resource loading → font registration → text rendering.
-->
<script lang="ts">
	import Page from '../components/Page/Page.svelte';
	import View from '../components/View/View.svelte';
	import Text from '../components/Text/Text.svelte';
	import Font from '../components/Font/Font.svelte';

	const { fontPath }: { fontPath: string } = $props();
</script>

<Font name="TestFont" src={fontPath} />

<Page size="A4">
	<View style={{ padding: 40, flexDirection: 'column' }}>
		<Text text="Custom font rendering." style={{ fontFamily: 'TestFont', fontSize: 18 }} />
		<Text text="Fallback to Helvetica if font fails." style={{ fontSize: 12 }} />
	</View>
</Page>
