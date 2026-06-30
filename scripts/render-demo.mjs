/**
 * Renders the showcase DemoDocument to a PDF file.
 *
 * DemoDocument is a `.svelte` component, so it must be compiled before it can
 * run. We boot Vite in middleware mode (reusing this project's svelte config)
 * and SSR-load both the runtime and the component, then stream the PDF to disk.
 *
 * Usage:
 *   node scripts/render-demo.mjs [outputPath]
 *
 * With no argument the PDF is written to ~/Desktop/DemoDocument.pdf.
 */

import { createServer } from 'vite';
import { createWriteStream } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const out = process.argv[2] ?? join(homedir(), 'Desktop', 'DemoDocument.pdf');

const server = await createServer({
	server: { middlewareMode: true },
	appType: 'custom',
	logLevel: 'warn'
});

try {
	const { renderComponent } = await server.ssrLoadModule('/src/lib/runtime/render.ts');
	const { default: DemoDocument } = await server.ssrLoadModule('/src/lib/test/DemoDocument.svelte');

	const stream = await renderComponent(DemoDocument);

	await new Promise((resolve, reject) => {
		const file = createWriteStream(out);
		stream.pipe(file);
		file.on('finish', resolve);
		file.on('error', reject);
		stream.on('error', reject);
	});

	console.log(`Wrote ${out}`);
} finally {
	await server.close();
}
