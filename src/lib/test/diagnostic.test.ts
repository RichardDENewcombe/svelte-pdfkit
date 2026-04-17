/**
 * Diagnostic tests to understand the failure mode in context.test.ts.
 * Runs before we attempt any nesting — just establishes what the baseline is.
 */

import { render } from 'svelte/server';
import { describe, it, expect } from 'vitest';
import { createDocument } from '../runtime/document.js';
import DiagnosticTemplate from './DiagnosticTemplate.svelte';

describe('Svelte 5 SSR context diagnostics', () => {
	it('getContext receives the value injected via the context Map', () => {
		const doc = createDocument();
		let received: unknown = 'NOT_SET';

		// render() is lazy — must access .html to trigger component execution
		const { html: _ } = render(DiagnosticTemplate, {
			props: { onContext: (ctx) => { received = ctx; } },
			context: new Map([['__pdf__', doc]])
		});

		// If this fails with 'NOT_SET', the component body is not running at all.
		// If this fails with undefined, getContext is not receiving the injected context.
		expect(received).toBe(doc);
	});

	it('getContext receives the value even without explicit context Map entry', () => {
		// Sanity check: does the component body run at all?
		let ran = false;

		const { html: _ } = render(DiagnosticTemplate, {
			props: {
				onContext: () => { ran = true; }
			},
			context: new Map()
		});

		expect(ran).toBe(true);
	});
});
