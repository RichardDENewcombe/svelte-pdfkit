<!--
	Test fixture: registers two variants of the same font family (regular + bold)
	then renders two Text nodes — one normal, one bold — so we can verify that
	the correct PDFKit font names are used during layout and rendering.
-->
<script lang="ts">
	import Page from '../components/Page/Page.svelte';
	import View from '../components/View/View.svelte';
	import Text from '../components/Text/Text.svelte';
	import Font from '../components/Font/Font.svelte';
	import Document from '../components/Document/Document.svelte';

	const { regularPath, boldPath }: { regularPath: string; boldPath: string } = $props();
</script>

<Document>
	<Font name="VarFont" src={regularPath} weight="normal" />
	<Font name="VarFont" src={boldPath} weight="bold" />
	<Page size="A4">
		<View style={{ padding: 20, flexDirection: 'column' }}>
			<Text text="Regular weight" style={{ fontFamily: 'VarFont', fontSize: 14 }} />
			<Text text="Bold weight" style={{ fontFamily: 'VarFont', fontWeight: 'bold', fontSize: 14 }} />
		</View>
	</Page>
</Document>
