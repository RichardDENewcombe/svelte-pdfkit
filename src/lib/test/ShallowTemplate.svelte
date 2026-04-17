<!--
	Tests one level of nesting.
	Expected tree:
	  doc
	  ├─ view { flexDirection: 'row' }
	  │  └─ text "inside view"
	  └─ text "outside view"
-->
<script lang="ts">
	import View from '../components/View/View.svelte';
	import Text from '../components/Text/Text.svelte';
</script>

<View style={{ flexDirection: 'row' }}>
	<Text text="inside view" />
</View>
<Text text="outside view" />
