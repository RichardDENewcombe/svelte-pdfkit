/**
 * Snapshot tests for svelte-pdf rendered output.
 *
 * Rather than binary PDF snapshots (which contain variable timestamps),
 * we snapshot structural properties: page count, text content, and
 * the serialised pre-layout AST.  This catches regressions in the
 * AST builder, layout engine, and paginator without being fragile.
 */

import { describe, it, expect } from 'vitest';
import { render as svelteRender } from 'svelte/server';
import { createDocument } from '../runtime/document.js';
import { computeLayout } from '../layout/layout.js';
import { paginate } from '../pagination/paginate.js';
import { renderComponent } from '../runtime/render.js';
import type { PDFNode } from '../types/pdf.js';

import BasicPDF from './BasicPDF.svelte';
import OverflowTemplate from './OverflowTemplate.svelte';
import PageNumberTemplate from './PageNumberTemplate.svelte';
import TableTemplate from './TableTemplate.svelte';
import LinkTemplate from './LinkTemplate.svelte';
import SvgTemplate from './SvgTemplate.svelte';

// ── Helpers ────────────────────────────────────────────────────────────────────

function streamToBuffer(stream: any): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (c: Buffer) => chunks.push(c));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
		stream.on('error', reject);
	});
}

function pageCount(buffer: Buffer): number {
	return (buffer.toString('binary').match(/\/Type \/Page[^s]/g) || []).length;
}

/** Strip variable fields and return a stable structural summary of a node tree. */
function summariseNode(node: PDFNode): object {
	return {
		type: node.type,
		// Capture text content and render-prop presence, but not functions themselves
		...(node.props.text !== undefined && { text: node.props.text }),
		...(node.props.render !== undefined && { render: '<fn>' }),
		...(node.props.href !== undefined && { href: node.props.href }),
		...(node.props.src !== undefined && { src: node.props.src }),
		...(node.children.length > 0 && { children: node.children.map(summariseNode) })
	};
}

function buildAst(component: any, props: Record<string, any> = {}) {
	const doc = createDocument();
	const { html: _ } = svelteRender(component, {
		props,
		context: new Map<string, unknown>([['__pdf__', doc], ['__pdf_root__', doc]])
	});
	return doc;
}

// ── AST snapshots ─────────────────────────────────────────────────────────────

describe('AST snapshots', () => {
	it('BasicPDF AST', () => {
		const doc = buildAst(BasicPDF);
		expect(doc.children.map(summariseNode)).toMatchSnapshot();
	});

	it('LinkTemplate AST', () => {
		const doc = buildAst(LinkTemplate);
		expect(doc.children.map(summariseNode)).toMatchSnapshot();
	});

	it('TableTemplate AST', () => {
		const doc = buildAst(TableTemplate);
		expect(doc.children.map(summariseNode)).toMatchSnapshot();
	});

	it('PageNumberTemplate AST has render prop on footer text', () => {
		const doc = buildAst(PageNumberTemplate);
		expect(doc.children.map(summariseNode)).toMatchSnapshot();
	});
});

// ── Pagination snapshots ───────────────────────────────────────────────────────

describe('Pagination snapshots', () => {
	it('BasicPDF produces 1 page', () => {
		const doc = buildAst(BasicPDF);
		computeLayout(doc);
		const pages = paginate(doc);
		expect(pages.length).toMatchSnapshot();
	});

	it('OverflowTemplate(10) produces 1 page', () => {
		const doc = buildAst(OverflowTemplate, { count: 10 });
		computeLayout(doc);
		const pages = paginate(doc);
		expect(pages.length).toMatchSnapshot();
	});

	it('OverflowTemplate(80) produces multiple pages', () => {
		const doc = buildAst(OverflowTemplate, { count: 80 });
		computeLayout(doc);
		const pages = paginate(doc);
		expect(pages.length).toMatchSnapshot();
	});

	it('PageNumberTemplate produces multiple pages', () => {
		const doc = buildAst(PageNumberTemplate);
		computeLayout(doc);
		const pages = paginate(doc);
		expect(pages.length).toMatchSnapshot();
	});
});

// ── End-to-end PDF snapshots ──────────────────────────────────────────────────

describe('End-to-end PDF structure snapshots', () => {
	it('BasicPDF PDF structure', async () => {
		const buffer = await renderComponent(BasicPDF).then(streamToBuffer);
		expect({
			valid: buffer.slice(0, 5).toString() === '%PDF-',
			pages: pageCount(buffer)
		}).toMatchSnapshot();
	});

	it('OverflowTemplate(80) PDF structure', async () => {
		const buffer = await renderComponent(OverflowTemplate, { count: 80 }).then(streamToBuffer);
		expect({
			valid: buffer.slice(0, 5).toString() === '%PDF-',
			pages: pageCount(buffer)
		}).toMatchSnapshot();
	});

	it('PageNumberTemplate PDF structure', async () => {
		const buffer = await renderComponent(PageNumberTemplate).then(streamToBuffer);
		expect({
			valid: buffer.slice(0, 5).toString() === '%PDF-',
			pages: pageCount(buffer)
		}).toMatchSnapshot();
	});

	it('TableTemplate PDF structure', async () => {
		const buffer = await renderComponent(TableTemplate).then(streamToBuffer);
		expect({
			valid: buffer.slice(0, 5).toString() === '%PDF-',
			pages: pageCount(buffer)
		}).toMatchSnapshot();
	});

	it('SvgTemplate PDF structure', async () => {
		const buffer = await renderComponent(SvgTemplate).then(streamToBuffer);
		expect({
			valid: buffer.slice(0, 5).toString() === '%PDF-',
			pages: pageCount(buffer)
		}).toMatchSnapshot();
	});
});
