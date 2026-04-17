<!--
	Test fixture: a multi-page document with a fixed footer showing page numbers.

	Each text row has flexShrink: 0 so Yoga doesn't compress them to fit one page —
	content naturally overflows to a second page and the fixed footer repeats.
-->
<script lang="ts">
	import Page from '../components/Page/Page.svelte';
	import View from '../components/View/View.svelte';
	import Text from '../components/Text/Text.svelte';
	import type { PageNumberRenderer } from '../types/pdf.js';

	const pageLabel: PageNumberRenderer = ({ pageNumber, totalPages }) =>
		`Page ${pageNumber} of ${totalPages}`;

	// 80 rows at ~16pt each = ~1280pt total — clearly overflows A4 (842pt).
	const rows = Array.from({ length: 80 }, (_, i) => i + 1);
</script>

<Page size="A4">
	<View style={{ padding: 40, flexDirection: 'column' }}>
		{#each rows as row}
			<Text
				text={`Row ${row}: body text that fills the page and causes overflow`}
				style={{ fontSize: 12, flexShrink: 0 }}
			/>
		{/each}
	</View>

	<!-- Fixed footer — repeats on every output page -->
	<View
		fixed={true}
		style={{ position: 'absolute', bottom: 20, left: 40, right: 40 }}
	>
		<Text render={pageLabel} style={{ fontSize: 10, textAlign: 'center' }} />
	</View>
</Page>
