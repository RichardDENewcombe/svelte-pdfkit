import type { Component } from 'svelte';
/**
 * Renders a Svelte component as a PDF and returns a Node.js Readable stream.
 *
 * This is what the Vite plugin generates for .pdf.svelte templates.
 * It can also be called directly for testing or non-template use cases.
 */
export declare function renderComponent(component: Component<any, any, any>, props?: Record<string, any>): Promise<any>;
