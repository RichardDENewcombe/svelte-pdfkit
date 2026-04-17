import type { DocumentContext } from '../types/pdf.js';

export function createDocument(): DocumentContext {
	return {
		type: 'document',
		props: {},
		children: [],
		resources: [],
		metadata: {}
	};
}
