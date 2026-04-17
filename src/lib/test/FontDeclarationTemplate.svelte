<!--
	Test fixture: renders one or two Font declarations so we can inspect
	what gets pushed onto doc.resources.

	When secondName is provided a second Font is rendered, letting us test
	that multiple font declarations accumulate correctly.
-->
<script lang="ts">
	import Font from '../components/Font/Font.svelte';

	const {
		name,
		src,
		weight = 'normal',
		secondName = '',
		secondSrc = '',
		secondWeight = 'normal'
	}: {
		name: string;
		src: string;
		weight?: string;
		secondName?: string;
		secondSrc?: string;
		secondWeight?: string;
	} = $props();
</script>

<Font {name} {src} {weight} />
{#if secondName}
	<Font name={secondName} src={secondSrc} weight={secondWeight} />
{/if}
