<!--
	Test fixture for PDF bookmarks / document outline.

	Layout produces:
	  Section 1                     (View, top-level)
	    Subsection 1.1              (Text, nested in Section 1)
	    Subsection 1.2              (Text, nested in Section 1)
	  Section 2                     (Text, top-level)
	  Spanning                      (View taller than a page → sliced onto two
	                                 pages; must yield ONE outline item)

	Image and Link also carry bookmarks to prove the prop is stored on every
	supported component.
-->
<script lang="ts">
	import Page from '../components/Page/Page.svelte';
	import View from '../components/View/View.svelte';
	import Text from '../components/Text/Text.svelte';
	import Image from '../components/Image/Image.svelte';
	import Link from '../components/Link/Link.svelte';

	// 1×1 green PNG (base64) — no network needed.
	const pngDot =
		'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
</script>

<Page size="A4" style={{ padding: 40 }}>
	<View bookmark="Section 1">
		<Text bookmark="Subsection 1.1" text="First subsection" style={{ fontSize: 12 }} />
		<Text bookmark="Subsection 1.2" text="Second subsection" style={{ fontSize: 12 }} />
	</View>

	<Text bookmark="Section 2" text="Section two body" style={{ fontSize: 12, marginTop: 8 }} />

	<Link bookmark="Docs link" href="https://example.com">
		<Text text="External link" style={{ fontSize: 12, color: 'blue' }} />
	</Link>

	<Image bookmark="Logo" src={pngDot} style={{ width: 20, height: 20, marginTop: 8 }} />

	<!-- Taller than the ~762pt content band → sliced across two pages. -->
	<View
		bookmark="Spanning"
		style={{ height: 900, marginTop: 8, backgroundColor: '#eef2ff' }}
	>
		<Text text="Spanning box" style={{ fontSize: 12 }} />
	</View>
</Page>
