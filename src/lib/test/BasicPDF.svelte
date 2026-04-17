<!--
	Basic end-to-end test template.
	Produces:
	  Page (A4)
	  └─ View (padding: 40, column)
	     ├─ Text "Hello, svelte-pdf!" (fontSize: 24)
	     └─ Text "Pipeline working." (fontSize: 12)
-->
<script lang="ts">
	import Page from '../components/Page/Page.svelte';
	import View from '../components/View/View.svelte';
	import Text from '../components/Text/Text.svelte';
</script>

<Page size="A4">
	<View style={{ padding: 40, flexDirection: 'column' }}>
		<Text text="Hello, svelte-pdf!" style={{ fontSize: 24 }} />
		<Text text="Pipeline working." style={{ fontSize: 12 }} />
	</View>
</Page>
