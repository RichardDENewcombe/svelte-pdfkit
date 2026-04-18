<!--
	Invoice example template.

	Demonstrates:
	  - Full-bleed dark header via negative margin trick
	  - Two-column address blocks
	  - Line-items table with alternating row colours
	  - Right-aligned totals summary
	  - Conditional ship-to and notes sections
	  - Fixed footer with page numbers

	Usage:
	  import { renderComponent } from '../lib/runtime/render.js';
	  import Invoice from './Invoice.pdf.svelte';
	  const stream = await renderComponent(Invoice, invoiceData);
-->
<script lang="ts">
	import Page from '../lib/components/Page/Page.svelte';
	import View from '../lib/components/View/View.svelte';
	import Text from '../lib/components/Text/Text.svelte';
	import Table from '../lib/components/Table/Table.svelte';
	import Row from '../lib/components/Table/Row.svelte';
	import Cell from '../lib/components/Table/Cell.svelte';
	import type { PageNumberRenderer } from '../lib/types/pdf.js';
	import type { InvoiceProps } from './types/invoice.js';
	import { INVOICE } from './shared/colors.js';

	const {
		invoiceNumber,
		issueDate,
		dueDate,
		company,
		billTo,
		shipTo,
		items,
		subtotal,
		taxRate,
		tax,
		total,
		notes,
		currency = '$'
	}: InvoiceProps = $props();

	const fmt = (n: number) => `${currency}${n.toFixed(2)}`;

	const pageFooter: PageNumberRenderer = ({ pageNumber, totalPages }) =>
		`Page ${pageNumber} of ${totalPages}`;

	// Initials for logo placeholder
	const initials = company.name
		.split(' ')
		.map((w) => w[0])
		.slice(0, 2)
		.join('');
</script>

<Page size="A4" style={{ padding: 40 }}>

	<!-- ── Full-bleed header band ──────────────────────────────────────── -->
	<!--
		Negative margin expands the view to the page edges despite page padding.
		Inner padding restores the 40pt content margin inside the band.
	-->
	<View
		style={{
			backgroundColor: INVOICE.headerBg,
			margin: -40,
			marginBottom: 0,
			padding: 40,
			paddingBottom: 28,
			flexDirection: 'row',
			alignItems: 'center'
		}}
	>
		<!-- Logo placeholder -->
		<View
			style={{
				width: 48,
				height: 48,
				backgroundColor: INVOICE.accent,
				borderRadius: 6,
				justifyContent: 'center',
				alignItems: 'center',
				flexShrink: 0
			}}
		>
			<Text
				text={initials}
				style={{ fontFamily: 'Helvetica-Bold', fontSize: 18, color: '#ffffff' }}
			/>
		</View>

		<!-- Company info -->
		<View style={{ flexGrow: 1, paddingLeft: 16 }}>
			<Text
				text={company.name}
				style={{ fontFamily: 'Helvetica-Bold', fontSize: 14, color: '#ffffff' }}
			/>
			{#if company.tagline}
				<Text
					text={company.tagline}
					style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: '#94a3b8', marginTop: 2 }}
				/>
			{/if}
		</View>

		<!-- Invoice title -->
		<View style={{ alignItems: 'flex-end' }}>
			<Text
				text="INVOICE"
				style={{
					fontFamily: 'Helvetica-Bold',
					fontSize: 26,
					color: '#ffffff',
					letterSpacing: 2
				}}
			/>
			<Text
				text={invoiceNumber}
				style={{ fontFamily: 'Helvetica', fontSize: 10, color: '#94a3b8', marginTop: 4 }}
			/>
		</View>
	</View>

	<!-- ── Meta row: dates + addresses ────────────────────────────────── -->
	<View style={{ flexDirection: 'row', marginTop: 24, gap: 20 }}>

		<!-- Dates -->
		<View style={{ flexGrow: 1 }}>
			<Text
				text="ISSUE DATE"
				style={{
					fontFamily: 'Helvetica-Bold',
					fontSize: 8,
					color: INVOICE.muted,
					letterSpacing: 0.8,
					marginBottom: 3
				}}
			/>
			<Text
				text={issueDate}
				style={{ fontFamily: 'Helvetica', fontSize: 10, color: INVOICE.text, marginBottom: 12 }}
			/>
			<Text
				text="DUE DATE"
				style={{
					fontFamily: 'Helvetica-Bold',
					fontSize: 8,
					color: INVOICE.muted,
					letterSpacing: 0.8,
					marginBottom: 3
				}}
			/>
			<Text
				text={dueDate}
				style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: INVOICE.accent }}
			/>
		</View>

		<!-- Bill To -->
		<View
			style={{
				flexGrow: 1,
				padding: 12,
				backgroundColor: INVOICE.tableBg,
				borderRadius: 4,
				borderWidth: 1,
				borderColor: INVOICE.border
			}}
		>
			<Text
				text="BILL TO"
				style={{
					fontFamily: 'Helvetica-Bold',
					fontSize: 8,
					color: INVOICE.muted,
					letterSpacing: 0.8,
					marginBottom: 4
				}}
			/>
			{#if billTo.company}
				<Text
					text={billTo.company}
					style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: INVOICE.text }}
				/>
			{/if}
			<Text
				text={billTo.name}
				style={{ fontFamily: 'Helvetica', fontSize: 10, color: INVOICE.text }}
			/>
			<Text
				text={billTo.line1}
				style={{ fontFamily: 'Helvetica', fontSize: 9, color: INVOICE.muted, marginTop: 2 }}
			/>
			{#if billTo.line2}
				<Text
					text={billTo.line2}
					style={{ fontFamily: 'Helvetica', fontSize: 9, color: INVOICE.muted }}
				/>
			{/if}
			{#if billTo.country}
				<Text
					text={billTo.country}
					style={{ fontFamily: 'Helvetica', fontSize: 9, color: INVOICE.muted }}
				/>
			{/if}
		</View>

		<!-- Ship To (optional) -->
		{#if shipTo}
			<View
				style={{
					flexGrow: 1,
					padding: 12,
					backgroundColor: INVOICE.tableBg,
					borderRadius: 4,
					borderWidth: 1,
					borderColor: INVOICE.border
				}}
			>
				<Text
					text="SHIP TO"
					style={{
						fontFamily: 'Helvetica-Bold',
						fontSize: 8,
						color: INVOICE.muted,
						letterSpacing: 0.8,
						marginBottom: 4
					}}
				/>
				{#if shipTo.company}
					<Text
						text={shipTo.company}
						style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: INVOICE.text }}
					/>
				{/if}
				<Text
					text={shipTo.name}
					style={{ fontFamily: 'Helvetica', fontSize: 10, color: INVOICE.text }}
				/>
				<Text
					text={shipTo.line1}
					style={{ fontFamily: 'Helvetica', fontSize: 9, color: INVOICE.muted, marginTop: 2 }}
				/>
				{#if shipTo.line2}
					<Text
						text={shipTo.line2}
						style={{ fontFamily: 'Helvetica', fontSize: 9, color: INVOICE.muted }}
					/>
				{/if}
				{#if shipTo.country}
					<Text
						text={shipTo.country}
						style={{ fontFamily: 'Helvetica', fontSize: 9, color: INVOICE.muted }}
					/>
				{/if}
			</View>
		{/if}
	</View>

	<!-- ── Line items table ────────────────────────────────────────────── -->
	<View style={{ marginTop: 24 }}>
		<Table>
			<!-- Header row -->
			<Row style={{ backgroundColor: INVOICE.accent }}>
				<Cell style={{ padding: 7, flexGrow: 3 }}>
					<Text
						text="Description"
						style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#ffffff' }}
					/>
				</Cell>
				<Cell style={{ padding: 7 }}>
					<Text
						text="Qty"
						style={{
							fontFamily: 'Helvetica-Bold',
							fontSize: 9,
							color: '#ffffff',
							textAlign: 'center'
						}}
					/>
				</Cell>
				<Cell style={{ padding: 7 }}>
					<Text
						text="Unit Price"
						style={{
							fontFamily: 'Helvetica-Bold',
							fontSize: 9,
							color: '#ffffff',
							textAlign: 'right'
						}}
					/>
				</Cell>
				<Cell style={{ padding: 7 }}>
					<Text
						text="Total"
						style={{
							fontFamily: 'Helvetica-Bold',
							fontSize: 9,
							color: '#ffffff',
							textAlign: 'right'
						}}
					/>
				</Cell>
			</Row>

			<!-- Data rows -->
			{#each items as item, i}
				<Row style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : INVOICE.rowAlt }}>
					<Cell style={{ padding: 6, flexGrow: 3, borderWidth: 0.5, borderColor: INVOICE.border }}>
						<Text
							text={item.description}
							style={{ fontFamily: 'Helvetica', fontSize: 9, color: INVOICE.text }}
						/>
					</Cell>
					<Cell style={{ padding: 6, borderWidth: 0.5, borderColor: INVOICE.border }}>
						<Text
							text={String(item.quantity)}
							style={{
								fontFamily: 'Helvetica',
								fontSize: 9,
								color: INVOICE.text,
								textAlign: 'center'
							}}
						/>
					</Cell>
					<Cell style={{ padding: 6, borderWidth: 0.5, borderColor: INVOICE.border }}>
						<Text
							text={fmt(item.unitPrice)}
							style={{
								fontFamily: 'Helvetica',
								fontSize: 9,
								color: INVOICE.text,
								textAlign: 'right'
							}}
						/>
					</Cell>
					<Cell style={{ padding: 6, borderWidth: 0.5, borderColor: INVOICE.border }}>
						<Text
							text={fmt(item.total)}
							style={{
								fontFamily: 'Helvetica',
								fontSize: 9,
								color: INVOICE.text,
								textAlign: 'right'
							}}
						/>
					</Cell>
				</Row>
			{/each}
		</Table>
	</View>

	<!-- ── Totals summary ─────────────────────────────────────────────── -->
	<View style={{ flexDirection: 'row', marginTop: 12 }}>
		<!-- Spacer -->
		<View style={{ flexGrow: 1 }} />

		<View style={{ width: 200 }}>
			<!-- Subtotal -->
			<View
				style={{
					flexDirection: 'row',
					justifyContent: 'space-between',
					paddingTop: 6,
					paddingBottom: 6,
					borderBottomWidth: 0.5,
					borderBottomColor: INVOICE.border
				}}
			>
				<Text
					text="Subtotal"
					style={{ fontFamily: 'Helvetica', fontSize: 9, color: INVOICE.muted }}
				/>
				<Text
					text={fmt(subtotal)}
					style={{ fontFamily: 'Helvetica', fontSize: 9, color: INVOICE.text }}
				/>
			</View>

			<!-- Tax (conditional) -->
			{#if tax != null}
				<View
					style={{
						flexDirection: 'row',
						justifyContent: 'space-between',
						paddingTop: 6,
						paddingBottom: 6,
						borderBottomWidth: 0.5,
						borderBottomColor: INVOICE.border
					}}
				>
					<Text
						text={taxRate != null ? `Tax (${(taxRate * 100).toFixed(0)}%)` : 'Tax'}
						style={{ fontFamily: 'Helvetica', fontSize: 9, color: INVOICE.muted }}
					/>
					<Text
						text={fmt(tax)}
						style={{ fontFamily: 'Helvetica', fontSize: 9, color: INVOICE.text }}
					/>
				</View>
			{/if}

			<!-- Total -->
			<View
				style={{
					flexDirection: 'row',
					justifyContent: 'space-between',
					paddingTop: 8,
					paddingBottom: 8,
					backgroundColor: INVOICE.accent,
					paddingLeft: 8,
					paddingRight: 8,
					borderRadius: 4,
					marginTop: 4
				}}
			>
				<Text
					text="TOTAL"
					style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: '#ffffff' }}
				/>
				<Text
					text={fmt(total)}
					style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: '#ffffff' }}
				/>
			</View>
		</View>
	</View>

	<!-- ── Notes (conditional) ────────────────────────────────────────── -->
	{#if notes}
		<View
			style={{
				marginTop: 24,
				padding: 12,
				backgroundColor: INVOICE.tableBg,
				borderRadius: 4,
				borderWidth: 1,
				borderColor: INVOICE.border
			}}
		>
			<Text
				text="Notes"
				style={{
					fontFamily: 'Helvetica-Bold',
					fontSize: 9,
					color: INVOICE.muted,
					marginBottom: 4
				}}
			/>
			<Text
				text={notes}
				style={{
					fontFamily: 'Helvetica',
					fontSize: 9,
					color: INVOICE.text,
					lineHeight: 1.5
				}}
			/>
		</View>
	{/if}

	<!-- ── Fixed footer ───────────────────────────────────────────────── -->
	<View
		fixed={true}
		style={{
			position: 'absolute',
			bottom: 20,
			left: 40,
			right: 40,
			flexDirection: 'row',
			justifyContent: 'space-between',
			borderTopWidth: 0.5,
			borderTopColor: INVOICE.border,
			paddingTop: 6
		}}
	>
		<Text
			text={`${company.name} · ${company.email}`}
			style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: INVOICE.muted }}
		/>
		<Text
			render={pageFooter}
			style={{ fontFamily: 'Helvetica', fontSize: 8, color: INVOICE.muted }}
		/>
	</View>

</Page>
