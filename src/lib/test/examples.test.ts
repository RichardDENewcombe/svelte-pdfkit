/**
 * Integration tests for the three user-facing example templates.
 *
 * Each template is loaded through a real Vite SSR server (same approach as
 * vite-plugin.test.ts) so the full pipeline is exercised:
 *
 *   .pdf.svelte → sveltePDF plugin → render() → PDF stream
 *
 * Tests verify:
 *   • render() resolves without throwing
 *   • The stream starts with the PDF magic bytes (%PDF-)
 *   • The output is larger than a minimal PDF (confirms real content was drawn)
 *
 * PDF files are written to /tmp/ so they can be opened for visual inspection.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Paths to the three example templates. */
const EXAMPLES_DIR = resolve(__dirname, '../../examples');
const INVOICE_PATH = resolve(EXAMPLES_DIR, 'Invoice.pdf.svelte');
const REPORT_PATH  = resolve(EXAMPLES_DIR, 'Report.pdf.svelte');
const RESUME_PATH  = resolve(EXAMPLES_DIR, 'Resume.pdf.svelte');

/** Collect a Node.js Readable stream into a Buffer. */
function streamToBuffer(stream: any): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (c: Buffer) => chunks.push(c));
		stream.on('end', () => resolve(Buffer.concat(chunks)));
		stream.on('error', reject);
	});
}

// ── Shared Vite SSR server ─────────────────────────────────────────────────────

let server: ViteDevServer;

beforeAll(async () => {
	server = await createServer({
		configFile: resolve(__dirname, '../../../vite.config.ts'),
		server: { port: undefined }
	});
	await server.listen();
}, 30_000);

afterAll(async () => {
	await server.close();
});

// ── Mock data ──────────────────────────────────────────────────────────────────

const invoiceData = {
	invoiceNumber: 'INV-2026-0042',
	issueDate: '18 April 2026',
	dueDate: '18 May 2026',
	company: {
		name: 'Acme Corp',
		tagline: 'Quality Products Since 1982',
		address: { name: 'Acme Corp', line1: '123 Main St', line2: 'Suite 100', country: 'USA' },
		email: 'billing@acme.com',
		phone: '+1 555-0100',
		website: 'https://acme.com'
	},
	billTo: {
		name: 'Jane Doe',
		company: 'Example Ltd',
		line1: '456 Oak Ave',
		line2: 'Floor 3',
		country: 'United States'
	},
	shipTo: {
		name: 'Jane Doe',
		line1: '789 Pine Rd',
		country: 'United States'
	},
	items: [
		{ description: 'Web Development (40 hours)', quantity: 40, unitPrice: 150, total: 6000 },
		{ description: 'UI/UX Design Services',      quantity: 10, unitPrice: 100, total: 1000 },
		{ description: 'Project Management',          quantity:  5, unitPrice: 120, total:  600 }
	],
	subtotal: 7600,
	taxRate: 0.1,
	tax: 760,
	total: 8360,
	notes: 'Payment due within 30 days. Thank you for your business!'
};

const reportData = {
	title: 'Q1 2026 Business Performance Report',
	subtitle: 'Quarterly Review and Key Metrics',
	author: 'Data Analytics Team',
	date: 'April 2026',
	organization: 'Acme Corp',
	tableOfContents: [
		{ title: 'Executive Summary', pageLabel: '3' },
		{ title: 'Revenue Analysis',  pageLabel: '4' },
		{ title: 'User Growth',       pageLabel: '5' }
	],
	sections: [
		{
			title: 'Executive Summary',
			body: 'Q1 2026 demonstrated strong performance across all key metrics. Revenue grew 15% year-over-year, driven by expansion in the enterprise segment. User acquisition continued at a healthy pace with 12,000 new accounts activated during the quarter.',
			stats: [
				{ label: 'Revenue', value: 1200000, displayValue: '$1.2M', color: '#1a56db' },
				{ label: 'Users',   value:   50000, displayValue: '50K',   color: '#059669' },
				{ label: 'NPS',     value:      72, displayValue: '72',    color: '#d97706' }
			]
		},
		{
			title: 'Revenue Analysis',
			body: 'Revenue grew steadily across all three months of Q1, with March showing the strongest performance due to end-of-quarter deal closures and new product launches.',
			table: {
				headers: ['Month', 'Revenue', 'Growth YoY', 'New Accounts'],
				rows: [
					{ cells: ['January 2026',  '$380,000', '+12%', '3,200'] },
					{ cells: ['February 2026', '$400,000', '+14%', '4,100'] },
					{ cells: ['March 2026',    '$420,000', '+20%', '4,700'] }
				]
			}
		}
	]
};

const resumeData = {
	name: 'Jane Smith',
	title: 'Senior Software Engineer',
	contact: {
		email: 'jane.smith@example.com',
		phone: '+1 (555) 012-3456',
		location: 'San Francisco, CA',
		linkedin: 'linkedin.com/in/janesmith',
		github: 'github.com/janesmith'
	},
	summary: 'Experienced software engineer with 8+ years building scalable distributed systems and developer-facing APIs. Passionate about clean architecture, performance, and developer experience. Led teams of up to 8 engineers across multiple product areas.',
	experience: [
		{
			company: 'Tech Startup Inc.',
			role: 'Senior Software Engineer',
			period: '2022 – Present',
			bullets: [
				'Led architecture for the real-time data pipeline, reducing latency by 60%',
				'Mentored 3 junior engineers with weekly code reviews and design sessions',
				'Designed and shipped a public REST API used by 200+ enterprise customers'
			]
		},
		{
			company: 'Previous Corp',
			role: 'Software Engineer',
			period: '2019 – 2022',
			bullets: [
				'Built microservices in Go serving 50M requests per day with 99.9% uptime',
				'Owned the search and discovery feature, improving conversion rate by 18%'
			]
		}
	],
	education: [
		{
			institution: 'Massachusetts Institute of Technology',
			degree: 'B.S. Computer Science',
			year: '2018'
		}
	],
	skills: [
		{ category: 'Languages',       skills: ['TypeScript', 'Go', 'Python', 'Rust'] },
		{ category: 'Frameworks',      skills: ['Svelte', 'React', 'Node.js', 'Fastify'] },
		{ category: 'Infrastructure',  skills: ['Kubernetes', 'PostgreSQL', 'Redis', 'AWS'] }
	]
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Example templates – end-to-end render', () => {

	it('Invoice.pdf.svelte renders a valid PDF', async () => {
		const mod = await server.ssrLoadModule(INVOICE_PATH);
		expect(typeof mod.render).toBe('function');

		const stream = await mod.render(invoiceData);
		expect(typeof stream.pipe).toBe('function');

		const buffer = await streamToBuffer(stream);
		expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
		expect(buffer.length).toBeGreaterThan(2000);

		writeFileSync('/tmp/example-invoice.pdf', buffer);
	}, 30_000);

	it('Report.pdf.svelte renders a valid PDF', async () => {
		const mod = await server.ssrLoadModule(REPORT_PATH);
		expect(typeof mod.render).toBe('function');

		const stream = await mod.render(reportData);
		expect(typeof stream.pipe).toBe('function');

		const buffer = await streamToBuffer(stream);
		expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
		expect(buffer.length).toBeGreaterThan(2000);

		writeFileSync('/tmp/example-report.pdf', buffer);
	}, 30_000);

	it('Resume.pdf.svelte renders a valid PDF', async () => {
		const mod = await server.ssrLoadModule(RESUME_PATH);
		expect(typeof mod.render).toBe('function');

		const stream = await mod.render(resumeData);
		expect(typeof stream.pipe).toBe('function');

		const buffer = await streamToBuffer(stream);
		expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
		expect(buffer.length).toBeGreaterThan(2000);

		writeFileSync('/tmp/example-resume.pdf', buffer);
	}, 30_000);

	it('all three examples can render concurrently without interference', async () => {
		const [invoiceMod, reportMod, resumeMod] = await Promise.all([
			server.ssrLoadModule(INVOICE_PATH),
			server.ssrLoadModule(REPORT_PATH),
			server.ssrLoadModule(RESUME_PATH)
		]);

		const [invoiceBuf, reportBuf, resumeBuf] = await Promise.all([
			invoiceMod.render(invoiceData).then(streamToBuffer),
			reportMod.render(reportData).then(streamToBuffer),
			resumeMod.render(resumeData).then(streamToBuffer)
		]);

		expect(invoiceBuf.slice(0, 5).toString()).toBe('%PDF-');
		expect(reportBuf.slice(0, 5).toString()).toBe('%PDF-');
		expect(resumeBuf.slice(0, 5).toString()).toBe('%PDF-');
	}, 30_000);
});
