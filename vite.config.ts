import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { sveltePDF } from './src/lib/compiler/vite-plugin.js';

// Resolve the absolute path to src/lib/ so we can alias 'svelte-pdf' → local source.
// This is needed because the generated render wrappers import from 'svelte-pdf/runtime/...',
// 'svelte-pdf/layout/...', etc. — those bare specifiers only work once the package is
// published, so during development and testing we redirect them here.
const libDir = fileURLToPath(new URL('./src/lib', import.meta.url));

export default defineConfig({
	plugins: [
		// sveltePDF must come before svelte() because it has enforce:'pre'.
		// It intercepts .pdf.svelte imports and converts them to virtual modules
		// before @sveltejs/vite-plugin-svelte has a chance to touch them.
		sveltePDF(),
		svelte({
			onwarn(warning, defaultHandler) {
				// These are SSR-only components — props are read once to build the
				// PDF AST. Reactivity is intentionally not needed, so this warning
				// is always a false positive here.
				if (warning.code === 'state_referenced_locally') return;
				defaultHandler(warning);
			}
		})
	],

	resolve: {
		alias: {
			// Map 'svelte-pdf' → our local src/lib during development and testing.
			// The generated wrappers import 'svelte-pdf/runtime/document.js' etc.
			// Without this alias those imports would fail with "Cannot find module".
			'svelte-pdf': libDir
		}
	},

	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});
