<script lang="ts">
	import { getContext } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { DocumentContext } from '../../types/pdf.js';

	const {
		children,
		title,
		author,
		subject,
		keywords,
		creator,
		producer
	}: {
		children?: Snippet;
		title?: string;
		author?: string;
		subject?: string;
		keywords?: string;
		creator?: string;
		producer?: string;
	} = $props();

	const doc = getContext<DocumentContext>('__pdf_root__');

	if (title !== undefined) doc.metadata.title = title;
	if (author !== undefined) doc.metadata.author = author;
	if (subject !== undefined) doc.metadata.subject = subject;
	if (keywords !== undefined) doc.metadata.keywords = keywords;
	if (creator !== undefined) doc.metadata.creator = creator;
	if (producer !== undefined) doc.metadata.producer = producer;
</script>

{@render children?.()}
