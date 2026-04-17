/**
 * Tests for dev warnings emitted via console.warn.
 *
 * Each component emits a [svelte-pdf] prefixed warning when it receives
 * invalid or missing props. renderComponent() warns when a document has
 * no <Page> elements.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render as svelteRender } from 'svelte/server';
import { createDocument } from '../runtime/document.js';
import { renderComponent } from '../runtime/render.js';

import ImageComponent  from '../components/Image/Image.svelte';
import TextComponent   from '../components/Text/Text.svelte';
import FontComponent   from '../components/Font/Font.svelte';
import CanvasComponent from '../components/Canvas/Canvas.svelte';
import LinkComponent   from '../components/Link/Link.svelte';
import PageComponent   from '../components/Page/Page.svelte';
import NoPagesTemplate from './NoPagesTemplate.svelte';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Render a component with the standard PDF contexts set up. */
function renderInContext(component: any, props: Record<string, any> = {}) {
	const doc = createDocument();
	// A minimal page node acts as the parent for components that need one.
	const pageNode = {
		type: 'page' as const,
		props: {},
		children: [] as any[],
		layout: undefined
	};
	// Must access .html to force lazy execution of the component tree.
	const { html: _ } = svelteRender(component, {
		props,
		context: new Map([
			['__pdf__', pageNode],
			['__pdf_root__', doc]
		])
	});
	return { doc, pageNode };
}

afterEach(() => {
	vi.restoreAllMocks();
});

// ── Image ──────────────────────────────────────────────────────────────────────

describe('warnings – <Image>', () => {
	it('warns when src is an empty string', () => {
		const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		renderInContext(ImageComponent, { src: '' });
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('[svelte-pdf]'));
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('<Image>'));
	});

	it('does not warn when src is provided', () => {
		const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		renderInContext(ImageComponent, { src: 'https://example.com/img.png' });
		expect(spy).not.toHaveBeenCalled();
	});
});

// ── Text ───────────────────────────────────────────────────────────────────────

describe('warnings – <Text>', () => {
	it('warns when both text and render props are provided', () => {
		const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		renderInContext(TextComponent, {
			text: 'hello',
			render: () => 'world'
		});
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('[svelte-pdf]'));
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('<Text>'));
	});

	it('does not warn when only text is provided', () => {
		const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		renderInContext(TextComponent, { text: 'hello' });
		expect(spy).not.toHaveBeenCalled();
	});

	it('does not warn when only render is provided', () => {
		const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		renderInContext(TextComponent, { render: () => 'world' });
		expect(spy).not.toHaveBeenCalled();
	});
});

// ── Font ───────────────────────────────────────────────────────────────────────

describe('warnings – <Font>', () => {
	it('warns when name is missing', () => {
		const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		renderInContext(FontComponent, { src: '/fonts/Inter.ttf' } as any);
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('[svelte-pdf]'));
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('<Font>'));
	});

	it('warns when src is missing', () => {
		const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		renderInContext(FontComponent, { name: 'Inter' } as any);
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('[svelte-pdf]'));
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('src'));
	});

	it('does not warn when both name and src are provided', () => {
		const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		renderInContext(FontComponent, { name: 'Inter', src: '/fonts/Inter.ttf' });
		expect(spy).not.toHaveBeenCalled();
	});
});

// ── Canvas ─────────────────────────────────────────────────────────────────────

describe('warnings – <Canvas>', () => {
	it('warns when draw prop is missing', () => {
		const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		renderInContext(CanvasComponent, { style: {} } as any);
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('[svelte-pdf]'));
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('<Canvas>'));
	});

	it('does not warn when draw is a function', () => {
		const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		renderInContext(CanvasComponent, { draw: () => {} });
		expect(spy).not.toHaveBeenCalled();
	});
});

// ── Link ───────────────────────────────────────────────────────────────────────

describe('warnings – <Link>', () => {
	it('warns when href is an empty string', () => {
		const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		renderInContext(LinkComponent, { href: '' });
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('[svelte-pdf]'));
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('<Link>'));
	});

	it('does not warn when href is provided', () => {
		const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		renderInContext(LinkComponent, { href: 'https://example.com' });
		expect(spy).not.toHaveBeenCalled();
	});
});

// ── Page ───────────────────────────────────────────────────────────────────────

describe('warnings – <Page>', () => {
	it('warns when size is an unrecognised string', () => {
		const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const doc = createDocument();
		const { html: _ } = svelteRender(PageComponent, {
			props: { size: 'A3' },
			context: new Map([['__pdf__', doc], ['__pdf_root__', doc]])
		});
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('[svelte-pdf]'));
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('A3'));
	});

	it('does not warn for known sizes', () => {
		for (const size of ['A4', 'Letter', 'Legal']) {
			const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const doc = createDocument();
			const { html: _ } = svelteRender(PageComponent, {
				props: { size },
				context: new Map([['__pdf__', doc], ['__pdf_root__', doc]])
			});
			expect(spy).not.toHaveBeenCalled();
			vi.restoreAllMocks();
		}
	});
});

// ── renderComponent – no pages ─────────────────────────────────────────────────

describe('warnings – renderComponent with no <Page>', () => {
	it('warns when the document contains no page nodes', async () => {
		const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await renderComponent(NoPagesTemplate as any);
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('[svelte-pdf]'));
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('<Page>'));
	});
});
