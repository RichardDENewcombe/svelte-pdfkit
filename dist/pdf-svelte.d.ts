/**
 * Ambient module declaration for *.pdf.svelte files.
 *
 * Add a reference to this file in your project's src/app.d.ts:
 *
 *   /// <reference types="svelte-pdfkit/pdf-svelte" />
 *
 * This tells TypeScript that any *.pdf.svelte import exposes a render()
 * function that returns a Node.js Readable stream containing PDF data.
 */

import type { Readable } from 'node:stream';

declare module '*.pdf.svelte' {
	/**
	 * Renders the PDF template with the given props.
	 * @returns A Node.js Readable stream of PDF bytes.
	 */
	export function render(props?: Record<string, any>): Promise<Readable>;
}
