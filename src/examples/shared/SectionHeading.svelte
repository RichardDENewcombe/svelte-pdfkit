<script lang="ts">
	import View from '../../lib/components/View/View.svelte';
	import Text from '../../lib/components/Text/Text.svelte';
	import type { StyleProps } from '../../lib/types/pdf.js';

	const {
		text,
		color,
		style = {}
	}: {
		text: string;
		color: string;
		style?: StyleProps;
	} = $props();
</script>

<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, ...style }}>
	<View style={{ width: 4, minHeight: 16, backgroundColor: color, marginRight: 8 }} />
	<Text
		{text}
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: '#111827', flexGrow: 1 }}
	/>
</View>
