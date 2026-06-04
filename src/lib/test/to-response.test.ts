/**
 * Tests for toResponse() — wrapping a PDF stream in a Web Response.
 *
 * Covers the default Content-Type, caller overrides, pass-through of other
 * ResponseInit fields, body round-trips, and a real rendered PDF.
 */

import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import { toResponse } from '../runtime/to-response.js';
import { renderComponent } from '../runtime/render.js';
import BasicPDF from './BasicPDF.svelte';

describe('toResponse', () => {
	it('defaults Content-Type to application/pdf and status to 200', () => {
		const res = toResponse(Readable.from(Buffer.from('x')));
		expect(res.headers.get('Content-Type')).toBe('application/pdf');
		expect(res.status).toBe(200);
	});

	it('streams the underlying bytes as the response body', async () => {
		const bytes = Buffer.from('%PDF-1.7 hello world');
		const res = toResponse(Readable.from(bytes));
		const out = Buffer.from(await res.arrayBuffer());
		expect(out.equals(bytes)).toBe(true);
	});

	it('lets the caller override the Content-Type', () => {
		const res = toResponse(Readable.from(Buffer.from('x')), {
			headers: { 'Content-Type': 'application/octet-stream' }
		});
		expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
	});

	it('passes through status, statusText, and extra headers', () => {
		const res = toResponse(Readable.from(Buffer.from('x')), {
			status: 201,
			statusText: 'Created',
			headers: { 'Content-Disposition': 'attachment; filename="invoice.pdf"' }
		});
		expect(res.status).toBe(201);
		expect(res.statusText).toBe('Created');
		expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="invoice.pdf"');
		// Default Content-Type still applies because it was not overridden.
		expect(res.headers.get('Content-Type')).toBe('application/pdf');
	});

	it('wraps a real rendered PDF into a valid Response body', async () => {
		const pdf = await renderComponent(BasicPDF);
		const res = toResponse(pdf);

		expect(res.headers.get('Content-Type')).toBe('application/pdf');
		const out = Buffer.from(await res.arrayBuffer());
		expect(out.slice(0, 5).toString()).toBe('%PDF-');
		expect(out.length).toBeGreaterThan(100);
	});
});
