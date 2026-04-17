<!--
	Tests three levels of nesting.
	Expected tree:
	  doc
	  └─ view (outer)
	     └─ view (inner)
	        └─ text "deep text"
-->
<script lang="ts">
	import View from '../components/View/View.svelte';
  import Page from '../components/Page/Page.svelte';
	import Text from '../components/Text/Text.svelte';
</script>

<View style={{ flexDirection: 'column' }}>
	<Page style={{ flexDirection: 'row' }}>
		<Text text="deep text" />
	</Page>
</View>
