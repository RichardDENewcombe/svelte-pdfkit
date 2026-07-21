import { Readable } from 'node:stream';
/**
 * Wraps a PDF stream in a Web `Response`, ready to return from a SvelteKit
 * endpoint (or any Web-standard server runtime).
 *
 * `render()` (from a `.pdf.svelte` template) and `renderComponent()` return a
 * Node.js `Readable` — a PDFKit document. The Web `Response` constructor only
 * accepts a Web `ReadableStream` (and other `BodyInit` values), not a Node
 * stream, so passing the stream directly is both a TypeScript error and, on
 * non-Node adapters, a runtime one. This helper converts the stream with
 * `Readable.toWeb()` and sets a sensible default `Content-Type`, so the result
 * works across every SvelteKit adapter without buffering the PDF into memory.
 *
 * The `Content-Type` defaults to `application/pdf`; pass your own in `init`
 * to override it. All other `ResponseInit` fields (`status`, `statusText`,
 * additional headers) pass through unchanged.
 *
 * @example SvelteKit route
 *   import { toResponse } from 'svelte-pdfkit';
 *   import { render } from '../Invoice.pdf.svelte';
 *
 *   export const GET = async () => toResponse(await render({ invoice }));
 *
 * @example Force a download with a filename
 *   return toResponse(await render({ invoice }), {
 *     headers: { 'Content-Disposition': 'attachment; filename="invoice.pdf"' }
 *   });
 */
export function toResponse(pdf, init = {}) {
    const headers = new Headers(init.headers);
    if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/pdf');
    }
    // Readable.toWeb returns node:stream/web's ReadableStream, which is
    // structurally a valid BodyInit but not nominally the DOM type — hence the
    // cast. The conversion streams lazily; the PDF is never fully buffered.
    return new Response(Readable.toWeb(pdf), {
        ...init,
        headers
    });
}
