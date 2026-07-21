/**
 * svelte-pdf Vite Plugin
 *
 * Enables importing *.pdf.svelte files as modules that export render():
 *
 *   import { render } from './Invoice.pdf.svelte';
 *   const pdf = await render({ invoice });
 *   pdf.pipe(res);
 *
 * ─── How it works ────────────────────────────────────────────────────────────
 *
 * The plugin hooks into Vite's module resolution pipeline at two points:
 *
 * 1. resolveId  — When Vite sees an import ending in .pdf.svelte, we redirect
 *                 it to a virtual module ID (prefixed with \0svelte-pdf:).
 *                 The \0 prefix is the Rollup/Vite convention meaning "virtual
 *                 module — other plugins must not touch this ID".
 *                 This prevents @sveltejs/vite-plugin-svelte from also
 *                 processing the file as a normal Svelte component.
 *
 * 2. load       — When Vite asks for the content of the virtual module, we:
 *                   a) Read the original .pdf.svelte file from disk
 *                   b) Compile it with the Svelte compiler (generate: 'server')
 *                   c) Wrap the compiled component with the render() pipeline
 *                   d) Return the final JS module
 *
 * ─── Output shape ────────────────────────────────────────────────────────────
 *
 * The generated module looks roughly like:
 *
 *   // --- Svelte-compiled component (SSR) ---
 *   import * as $ from 'svelte/internal/server';
 *   function Invoice($$renderer, $$props) { ... }
 *
 *   // --- svelte-pdf render wrapper (injected by this plugin) ---
 *   import { render as __svelteRender } from 'svelte/server';
 *   import { createDocument } from 'svelte-pdfkit/runtime/document.js';
 *   // ... other runtime imports ...
 *
 *   export async function render(props = {}) {
 *     const doc = createDocument();
 *     const { html: _ } = __svelteRender(Invoice, { props, context: ... });
 *     await loadResources(doc.resources);
 *     computeLayout(doc);
 *     return renderPDF(paginate(doc));
 *   }
 */
import type { Plugin } from 'vite';
export declare function sveltePDF(): Plugin;
