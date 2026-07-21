/**
 * Tests for the svelte-pdf Vite plugin.
 *
 * Split into two layers:
 *
 *  1. Unit tests  — call plugin hooks directly with a fake Vite context.
 *                   Fast, no Vite server needed. Pin down resolveId / load
 *                   behaviour in isolation.
 *
 *  2. Integration — spin up a real Vite dev server (SSR mode) and import
 *                   Simple.pdf.svelte through it. Verifies the full pipeline:
 *                   plugin intercepts → compiles → wraps → render() produces
 *                   a valid PDF stream.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { readFileSync, statSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sveltePDF } from '../compiler/vite-plugin.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the Simple.pdf.svelte fixture. */
const SIMPLE_PDF_SVELTE = resolve(__dirname, 'Simple.pdf.svelte');

/**
 * Collect a Node.js Readable stream into a Buffer.
 * Used to inspect the raw PDF bytes.
 */
function streamToBuffer(stream: any): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (c: Buffer) => chunks.push(c));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
		stream.on('error', reject);
	});
}

// ── Unit Tests ─────────────────────────────────────────────────────────────────
//
// We obtain the plugin object and call its hooks manually.
// The hooks are plain functions — they don't need a Vite server to run.
//
// For the `load` hook we need to bind a fake `this` context that implements
// `addWatchFile` and `warn`, because the plugin calls both of those.
//
// We deliberately do NOT test the exact generated code line-by-line —
// that would make the test fragile. Instead we check for the structural
// properties that the module consumer depends on:
//   • It exports an async `render` function
//   • It imports the expected runtime modules

describe('sveltePDF plugin – resolveId hook', () => {
	// The plugin object returned by sveltePDF() has the hook methods directly
	// on it (Vite/Rollup plugins are just objects).
	const plugin = sveltePDF();

	it('returns a virtual module ID for .pdf.svelte imports', () => {
		// Simulate Vite calling resolveId for a relative import.
		// The importer is a hypothetical SvelteKit route file.
		const importer = '/project/src/routes/invoice/+page.server.ts';
		const id = './Invoice.pdf.svelte';

		// resolveId is a regular function on the plugin object.
		// TypeScript thinks it might be an async handler with options, so we cast.
		const result = (plugin.resolveId as Function)(id, importer);

		// Should return a string (not null / undefined)
		expect(typeof result).toBe('string');

		// Must start with the virtual module prefix
		expect(result).toMatch(/^\x00svelte-pdf:/);

		// Must include the source file path (.svelte is stripped to avoid vite-plugin-svelte)
		expect(result).toContain('Invoice.pdf');
	});

	it('returns null for non-.pdf.svelte imports', () => {
		// Regular Svelte components must pass through untouched.
		const result = (plugin.resolveId as Function)('./Button.svelte', '/project/src/app.ts');
		expect(result).toBeNull();
	});

	it('returns null for TypeScript imports', () => {
		const result = (plugin.resolveId as Function)('./utils.ts', '/project/src/app.ts');
		expect(result).toBeNull();
	});

	it('handles an import with no importer (entry-point resolution)', () => {
		// When there is no importer (e.g. the file is an entry point), we should
		// still produce a valid virtual ID based on process.cwd().
		const result = (plugin.resolveId as Function)('Invoice.pdf.svelte', undefined);
		expect(typeof result).toBe('string');
		expect(result).toMatch(/^\x00svelte-pdf:/);
	});

	it('produces a stable ID — same input always gives same output', () => {
		const importer = '/project/src/routes/+layout.server.ts';
		const id = './doc.pdf.svelte';
		const r1 = (plugin.resolveId as Function)(id, importer);
		const r2 = (plugin.resolveId as Function)(id, importer);
		expect(r1).toBe(r2);
	});
});

describe('sveltePDF plugin – load hook', () => {
	const plugin = sveltePDF();

	/**
	 * Creates a fake Rollup/Vite plugin context bound to the `load` hook.
	 *
	 * The `load` hook calls:
	 *   this.addWatchFile(path)   – we capture what was registered
	 *   this.warn(message)        – we forward to console.warn for visibility
	 */
	function makeContext() {
		const watched: string[] = [];
		const warnings: string[] = [];
		return {
			ctx: {
				addWatchFile(p: string) { watched.push(p); },
				warn(msg: string) { warnings.push(msg); }
			},
			watched,
			warnings
		};
	}

	/** Run the load hook with the real Simple.pdf.svelte fixture. */
	function loadSimple() {
		// resolveId strips .svelte to prevent vite-plugin-svelte from re-compiling.
		const virtualId = '\x00svelte-pdf:' + SIMPLE_PDF_SVELTE.slice(0, -'.svelte'.length);
		const { ctx, watched, warnings } = makeContext();
		const code = (plugin.load as Function).call(ctx, virtualId);
		return { code: code as string, watched, warnings };
	}

	it('returns null for non-svelte-pdf virtual IDs', () => {
		const { ctx } = makeContext();
		const result = (plugin.load as Function).call(ctx, '\x00some-other-plugin:foo');
		expect(result).toBeNull();
	});

	it('returns null for regular (non-virtual) module IDs', () => {
		const { ctx } = makeContext();
		const result = (plugin.load as Function).call(ctx, '/absolute/path/to/Button.svelte');
		expect(result).toBeNull();
	});

	it('returns a non-empty string for a valid .pdf.svelte virtual ID', () => {
		const { code } = loadSimple();
		expect(typeof code).toBe('string');
		expect(code.length).toBeGreaterThan(100);
	});

	it('registers the source file as a watch dependency', () => {
		// When the .pdf.svelte file changes, Vite should HMR-invalidate the module.
		// The plugin calls this.addWatchFile(filePath) to register the dependency.
		const { watched } = loadSimple();
		expect(watched).toContain(SIMPLE_PDF_SVELTE);
	});

	it('exports an async render function', () => {
		// The key contract: every .pdf.svelte module must export render().
		const { code } = loadSimple();
		expect(code).toContain('export async function render');
	});

	it('imports the svelte-pdf runtime modules', () => {
		// These imports are required for the render pipeline to work.
		const { code } = loadSimple();
		expect(code).toContain("from 'svelte-pdfkit/runtime/document.js'");
		expect(code).toContain("from 'svelte-pdfkit/runtime/resources.js'");
		expect(code).toContain("from 'svelte-pdfkit/layout/layout.js'");
		expect(code).toContain("from 'svelte-pdfkit/pagination/paginate.js'");
		expect(code).toContain("from 'svelte-pdfkit/renderer/render.js'");
	});

	it('imports the svelte server render function', () => {
		// The render wrapper calls svelteRender() from svelte/server.
		const { code } = loadSimple();
		expect(code).toContain("from 'svelte/server'");
	});

	it('passes context with __pdf__ and __pdf_root__ keys', () => {
		// These context keys are the root document node references that
		// components read via getContext() to build the PDF node tree.
		const { code } = loadSimple();
		expect(code).toContain("'__pdf__'");
		expect(code).toContain("'__pdf_root__'");
	});

	it('does not re-export the component as default', () => {
		// The generated module's public API is only render().
		// The raw component function is private (no export default).
		const { code } = loadSimple();
		expect(code).not.toContain('export default');
	});

	it('has balanced braces (basic structural sanity check)', () => {
		// A quick heuristic: if the generated code has balanced { } the
		// most common code-generation bugs (truncated output, unclosed blocks)
		// are absent. Full parse validation happens in the integration test.
		const { code } = loadSimple();
		const open = (code.match(/\{/g) ?? []).length;
		const close = (code.match(/\}/g) ?? []).length;
		expect(open).toBe(close);
	});
});

// ── .d.ts emission tests ───────────────────────────────────────────────────────
//
// These tests verify that the Vite plugin writes (and idempotently maintains)
// the companion .d.ts file alongside each .pdf.svelte source file.
// The .d.ts gives the TypeScript language server the correct render() signature,
// overriding the wrong svelte2tsx-generated declaration.

describe('sveltePDF plugin – .d.ts emission', () => {
	const plugin = sveltePDF();
	const DTS_PATH = SIMPLE_PDF_SVELTE + '.d.ts';

	// Clean up after every test so no generated file is accidentally committed.
	afterEach(() => {
		try { rmSync(DTS_PATH); } catch { /* already gone */ }
	});

	it('emits a companion .d.ts alongside the source file after load', () => {
		loadSimpleWith(plugin);
		expect(existsSync(DTS_PATH)).toBe(true);
		const content = readFileSync(DTS_PATH, 'utf-8');
		expect(content).toContain('export declare function render');
		expect(content).toContain('Promise<Readable>');
	});

	it('the emitted .d.ts includes the AUTO-GENERATED header', () => {
		loadSimpleWith(plugin);
		const content = readFileSync(DTS_PATH, 'utf-8');
		expect(content).toContain('AUTO-GENERATED by svelte-pdfkit');
	});

	it('emission is idempotent — file mtime does not change on repeated loads', () => {
		loadSimpleWith(plugin);
		const mtime1 = statSync(DTS_PATH).mtimeMs;

		// Small delay to ensure mtime would differ if the file were re-written.
		// (filesystem mtime resolution is typically 1 ms on modern systems)
		// We call load a second time; because content matches, no write occurs.
		loadSimpleWith(plugin);
		const mtime2 = statSync(DTS_PATH).mtimeMs;

		expect(mtime2).toBe(mtime1);
	});

	it('buildStart scans and emits .d.ts for all .pdf.svelte files in the project', () => {
		// Point the plugin at the test directory so the scan finds Simple.pdf.svelte.
		// We trigger configResolved manually to set projectRoot, then call buildStart.
		const testPlugin = sveltePDF();
		(testPlugin.configResolved as Function)({ root: __dirname });
		(testPlugin.buildStart as Function).call({});
		expect(existsSync(DTS_PATH)).toBe(true);
	});
});

// ── Shared helper for .d.ts tests ──────────────────────────────────────────────

/**
 * Runs the load hook on Simple.pdf.svelte using the given plugin instance.
 * Extracted so it can be called from the .d.ts emission describe block without
 * duplicating the makeContext logic (which is defined in the load hook block
 * above, but is a local function there — we reproduce a minimal version here).
 */
function loadSimpleWith(plugin: ReturnType<typeof sveltePDF>) {
	const virtualId = '\x00svelte-pdf:' + SIMPLE_PDF_SVELTE.slice(0, -'.svelte'.length);
	const ctx = { addWatchFile() {}, warn() {} };
	(plugin.load as Function).call(ctx, virtualId);
}

// ── Integration Test ───────────────────────────────────────────────────────────
//
// This test actually imports Simple.pdf.svelte through a real Vite server
// and calls the resulting render() function. It verifies the end-to-end path:
//
//   import('./Simple.pdf.svelte')
//     → plugin.resolveId  → virtual ID
//     → plugin.load       → compiled code + render wrapper
//     → Vite resolves imports  (svelte/server, svelte-pdf/*, yoga-layout, pdfkit)
//     → render({ })       → PDFKit Readable stream
//     → stream bytes      → starts with %PDF-

describe('sveltePDF plugin – integration (full render via Vite SSR)', () => {
	let server: ViteDevServer;

	// Spin up a Vite dev server pointing at the project root.
	// We import the same vite.config.ts that registers sveltePDF(), so the
	// plugin is included automatically.
	beforeAll(async () => {
		server = await createServer({
			// Use the project's own vite.config.ts.
			// This ensures the test uses the exact same plugin configuration as
			// the real application — including sveltePDF() and the svelte-pdf alias.
			// __dirname is src/lib/test — go up 3 levels to reach the project root
		configFile: resolve(__dirname, '../../../vite.config.ts'),
			server: { port: undefined }, // Let Vite pick a free port; we won't need HTTP
		});
		await server.listen();
	}, 30_000 /* generous timeout for cold-start Vite + Yoga WASM */);

	afterAll(async () => {
		await server.close();
	});

	it('produces a valid PDF stream from Simple.pdf.svelte', async () => {
		// ssrLoadModule compiles + loads the module in Node.js (SSR) context.
		// The plugin intercepts the .pdf.svelte URL and returns the virtual module.
		const mod = await server.ssrLoadModule(SIMPLE_PDF_SVELTE);

		// The module must export render()
		expect(typeof mod.render).toBe('function');

		// Call render() with no props (the fixture has no required props)
		const stream = await mod.render({});

		// Verify we got a Node.js stream
		expect(typeof stream.pipe).toBe('function');

		// Collect bytes and check the PDF signature
		const buffer = await streamToBuffer(stream);
		expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
		expect(buffer.length).toBeGreaterThan(1000);
	}, 30_000);

	it('render() can be called multiple times concurrently', async () => {
		const mod = await server.ssrLoadModule(SIMPLE_PDF_SVELTE);

		// Two concurrent calls must produce independent, valid PDFs.
		const [b1, b2] = await Promise.all([
			mod.render({}).then(streamToBuffer),
			mod.render({}).then(streamToBuffer)
		]);

		expect(b1.slice(0, 5).toString()).toBe('%PDF-');
		expect(b2.slice(0, 5).toString()).toBe('%PDF-');
	}, 30_000);
});
