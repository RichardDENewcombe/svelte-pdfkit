<!--
	Test fixture: exercises per-corner border radius styles on View nodes.
-->
<script lang="ts">
	import Page from '../components/Page/Page.svelte';
	import View from '../components/View/View.svelte';
</script>

<Page size="A4" style={{ padding: 40 }}>
	<!-- Uniform shorthand -->
	<View style={{ width: 100, height: 40, borderRadius: 10, backgroundColor: '#aaa', marginBottom: 10 }} />

	<!-- Per-corner: only top-left rounded -->
	<View style={{ width: 100, height: 40, borderTopLeftRadius: 20, backgroundColor: '#bbb', marginBottom: 10 }} />

	<!-- Mix: shorthand + per-corner override (top-left wins at 25, others at 10) -->
	<View style={{ width: 100, height: 40, borderRadius: 10, borderTopLeftRadius: 25, backgroundColor: '#ccc', marginBottom: 10 }} />

	<!-- Extreme radius — clamped to half the shorter dimension -->
	<View style={{ width: 100, height: 40, borderTopLeftRadius: 9999, backgroundColor: '#ddd', marginBottom: 10 }} />

	<!-- Border with per-corner radii -->
	<View style={{ width: 100, height: 40, borderRadius: 8, borderBottomRightRadius: 0, borderWidth: 2, borderColor: '#333' }} />
</Page>
