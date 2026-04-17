<!--
	Tests Text with children syntax instead of text= prop.
	Expected tree:
	  doc
	  └─ view
	     ├─ text "Hello world"
	     └─ text "Goodbye"
-->
<script lang="ts">
	import View from '../components/View/View.svelte';
	import Text from '../components/Text/Text.svelte';
</script>

<View style={{ flexDirection: 'column' }}>
	<Text style={{ fontSize: 24 }}>Hello world</Text>
	<Text style={{ fontSize: 14 }}>Goodbye</Text>
</View>
