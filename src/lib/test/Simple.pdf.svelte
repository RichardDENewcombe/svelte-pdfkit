<!--
	Minimal .pdf.svelte fixture used by the Vite plugin integration tests.

	This file is intentionally simple — just enough to exercise the full
	plugin pipeline (compile → wrap → resolve imports → render) without
	depending on any advanced features that might obscure test failures.

	Produces:
	  Page (A4)
	  └─ View (padding: 20)
	     └─ Text "Plugin works."
-->
<script lang="ts">
	import Page from '../components/Page/Page.svelte';
	import View from '../components/View/View.svelte';
	import Text from '../components/Text/Text.svelte';
</script>

<Page size="A4">
	<View style={{ padding: 20 }}>
		<Text text="Plugin works." style={{ fontSize: 14 }} />
	</View>
</Page>
