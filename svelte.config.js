import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
	preprocess: vitePreprocess(),
	compilerOptions: {
		// svelte-pdf components run once during server-side render to build a
		// static AST node — they never re-render reactively. Reading a prop's
		// initial value at init is exactly the intended behaviour, so the
		// `state_referenced_locally` warning does not apply to this library.
		warningFilter: (warning) => warning.code !== 'state_referenced_locally'
	}
};
