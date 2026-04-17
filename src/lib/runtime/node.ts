import type { NodeType, PDFNode } from '../types/pdf.js';

export function createNode(type: NodeType, props: Record<string, any> = {}): PDFNode {
	return { type, props, children: [] };
}
