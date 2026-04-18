<!--
	Report example template.

	Demonstrates:
	  - Cover page with full-bleed background and SVG wave decoration
	  - Table of contents page
	  - Section pages with running header, body text, optional bar chart, optional table
	  - Fixed running header only on section pages (not cover or TOC)
	  - SVG bar chart using SvgText for labels and axis

	Usage:
	  import { renderComponent } from '../lib/runtime/render.js';
	  import Report from './Report.pdf.svelte';
	  const stream = await renderComponent(Report, reportData);
-->
<script lang="ts">
	import Page from '../lib/components/Page/Page.svelte';
	import View from '../lib/components/View/View.svelte';
	import Text from '../lib/components/Text/Text.svelte';
	import Table from '../lib/components/Table/Table.svelte';
	import Row from '../lib/components/Table/Row.svelte';
	import Cell from '../lib/components/Table/Cell.svelte';
	import Svg from '../lib/components/Svg/Svg.svelte';
	import Rect from '../lib/components/Svg/Rect.svelte';
	import Line from '../lib/components/Svg/Line.svelte';
	import Path from '../lib/components/Svg/Path.svelte';
	import SvgText from '../lib/components/Svg/SvgText.svelte';
	import SectionHeading from './shared/SectionHeading.svelte';
	import type { PageNumberRenderer } from '../lib/types/pdf.js';
	import type { ReportProps } from './types/report.js';
	import { REPORT } from './shared/colors.js';

	const {
		title,
		subtitle,
		author,
		date,
		organization,
		tableOfContents,
		sections
	}: ReportProps = $props();

	const pageCounter: PageNumberRenderer = ({ pageNumber, totalPages }) =>
		`${pageNumber} / ${totalPages}`;

	// Bar chart layout constants
	const CHART_W = 515;
	const CHART_H = 120;
	const AXIS_X = 50;       // x of the vertical axis line
	const BAR_AREA_W = 445;  // CHART_W - AXIS_X - 20 (right margin)
	const BAR_Y_TOP = 10;    // y where bars start (top)
	const BAR_BOTTOM = 100;  // y of the baseline
	const BAR_HEIGHT = BAR_BOTTOM - BAR_Y_TOP;  // 90

	function barLayout(stats: NonNullable<ReportProps['sections'][0]['stats']>) {
		const gap = 8;
		const maxW = 80;
		const count = stats.length;
		const barW = Math.min(maxW, Math.floor((BAR_AREA_W - gap * (count - 1)) / count));
		const totalBarsW = barW * count + gap * (count - 1);
		const startX = AXIS_X + 1 + Math.floor((BAR_AREA_W - totalBarsW) / 2);
		const maxVal = Math.max(...stats.map((s) => s.value));

		return stats.map((s, i) => {
			const x = startX + i * (barW + gap);
			const h = maxVal > 0 ? Math.round((s.value / maxVal) * BAR_HEIGHT) : 4;
			const y = BAR_BOTTOM - h;
			const cx = x + Math.floor(barW / 2);
			return { x, y, h, barW, cx };
		});
	}
</script>

<!-- ══════════════════════════════════════════════════════════════════════ -->
<!-- Cover page                                                              -->
<!-- ══════════════════════════════════════════════════════════════════════ -->
<Page size="A4">

	<!-- Full-bleed background -->
	<View
		style={{
			position: 'absolute',
			top: 0,
			left: 0,
			width: '100%',
			height: '100%',
			backgroundColor: REPORT.coverBg
		}}
	/>

	<!-- Decorative wave at the bottom of the cover -->
	<View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
		<Svg width={595} height={120}>
			<Path
				d="M 0,80 C 150,20 350,120 595,40 L 595,120 L 0,120 Z"
				fill="rgba(255,255,255,0.06)"
			/>
			<Path
				d="M 0,100 C 200,40 400,140 595,60 L 595,120 L 0,120 Z"
				fill="rgba(255,255,255,0.04)"
			/>
		</Svg>
	</View>

	<!-- Cover content -->
	<View
		style={{
			flexGrow: 1,
			justifyContent: 'center',
			alignItems: 'center',
			padding: 60
		}}
	>
		{#if organization}
			<Text
				text={organization.toUpperCase()}
				style={{
					fontFamily: 'Helvetica-Bold',
					fontSize: 9,
					color: '#93c5fd',
					letterSpacing: 2,
					marginBottom: 24
				}}
			/>
		{/if}

		<Text
			text={title}
			style={{
				fontFamily: 'Helvetica-Bold',
				fontSize: 30,
				color: '#ffffff',
				textAlign: 'center',
				lineHeight: 1.3,
				marginBottom: 12
			}}
		/>

		{#if subtitle}
			<Text
				text={subtitle}
				style={{
					fontFamily: 'Helvetica-Oblique',
					fontSize: 13,
					color: '#93c5fd',
					textAlign: 'center',
					marginBottom: 32
				}}
			/>
		{/if}

		<!-- Decorative divider -->
		<Svg width={80} height={4}>
			<Rect x={0} y={0} width={80} height={3} rx={1} ry={1} fill="#93c5fd" />
		</Svg>

		<View style={{ marginTop: 32, alignItems: 'center' }}>
			<Text
				text={author}
				style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: '#ffffff', marginBottom: 4 }}
			/>
			<Text
				text={date}
				style={{ fontFamily: 'Helvetica', fontSize: 10, color: '#93c5fd' }}
			/>
		</View>
	</View>

</Page>

<!-- ══════════════════════════════════════════════════════════════════════ -->
<!-- Table of Contents page                                                  -->
<!-- ══════════════════════════════════════════════════════════════════════ -->
<Page size="A4" style={{ padding: 40 }}>

	<Text
		text="Table of Contents"
		style={{
			fontFamily: 'Helvetica-Bold',
			fontSize: 20,
			color: REPORT.accent,
			marginBottom: 24
		}}
	/>

	{#each tableOfContents as entry}
		<View
			style={{
				flexDirection: 'row',
				alignItems: 'flex-end',
				marginBottom: 12,
				paddingBottom: 5,
				borderBottomWidth: 0.5,
				borderBottomColor: REPORT.border
			}}
		>
			<Text
				text={entry.title}
				style={{ flexGrow: 1, fontFamily: 'Helvetica', fontSize: 11, color: REPORT.text }}
			/>
			<Text
				text={entry.pageLabel}
				style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: REPORT.accent }}
			/>
		</View>
	{/each}

</Page>

<!-- ══════════════════════════════════════════════════════════════════════ -->
<!-- Section pages                                                           -->
<!-- ══════════════════════════════════════════════════════════════════════ -->
{#each sections as section}
	<Page size="A4" style={{ padding: 40 }}>

		<!-- Fixed running header — appears on every section page -->
		<View
			fixed={true}
			style={{
				position: 'absolute',
				top: 0,
				left: 0,
				right: 0,
				backgroundColor: REPORT.accent,
				flexDirection: 'row',
				justifyContent: 'space-between',
				alignItems: 'center',
				paddingTop: 6,
				paddingBottom: 6,
				paddingLeft: 40,
				paddingRight: 40
			}}
		>
			<Text
				text={title}
				style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#ffffff' }}
			/>
			<Text
				render={pageCounter}
				style={{ fontFamily: 'Helvetica', fontSize: 8, color: '#ffffff' }}
			/>
		</View>

		<!-- Spacer below fixed header -->
		<View style={{ marginTop: 18 }} />

		<!-- Section title -->
		<SectionHeading text={section.title} color={REPORT.accent} style={{ marginBottom: 12 }} />

		<!-- Body text -->
		<Text
			text={section.body}
			style={{
				fontFamily: 'Helvetica',
				fontSize: 10,
				color: REPORT.text,
				lineHeight: 1.6,
				marginBottom: 20
			}}
		/>

		<!-- Bar chart (optional) -->
		{#if section.stats && section.stats.length > 0}
			<Text
				text="Key Metrics"
				style={{
					fontFamily: 'Helvetica-Bold',
					fontSize: 9,
					color: REPORT.accent,
					marginBottom: 8
				}}
			/>
			{@const bars = barLayout(section.stats)}
			<Svg width={CHART_W} height={CHART_H}>
				<!-- Vertical axis -->
				<Line
					x1={AXIS_X}
					y1={BAR_Y_TOP}
					x2={AXIS_X}
					y2={BAR_BOTTOM}
					stroke={REPORT.muted}
					strokeWidth={1}
				/>
				<!-- Baseline -->
				<Line
					x1={AXIS_X}
					y1={BAR_BOTTOM}
					x2={CHART_W - 10}
					y2={BAR_BOTTOM}
					stroke={REPORT.muted}
					strokeWidth={0.5}
				/>

				{#each section.stats as stat, i}
					{@const b = bars[i]}
					<!-- Bar -->
					<Rect
						x={b.x}
						y={b.y}
						width={b.barW}
						height={b.h}
						fill={stat.color ?? REPORT.sectionBar}
					/>
					<!-- Value label above bar -->
					<SvgText
						x={b.cx}
						y={b.y - 4}
						text={stat.displayValue}
						fontSize={8}
						fontFamily="Helvetica-Bold"
						fill={REPORT.accent}
						textAnchor="middle"
					/>
					<!-- Category label below baseline -->
					<SvgText
						x={b.cx}
						y={BAR_BOTTOM + 12}
						text={stat.label}
						fontSize={8}
						fill={REPORT.muted}
						textAnchor="middle"
					/>
				{/each}
			</Svg>
		{/if}

		<!-- Data table (optional) -->
		{#if section.table}
			<View style={{ marginTop: 16 }}>
				<Table>
					<Row style={{ backgroundColor: REPORT.accent }}>
						{#each section.table.headers as header}
							<Cell style={{ padding: 6 }}>
								<Text
									text={header}
									style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#ffffff' }}
								/>
							</Cell>
						{/each}
					</Row>
					{#each section.table.rows as row, i}
						<Row style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : REPORT.tableBg }}>
							{#each row.cells as cell}
								<Cell style={{ padding: 5, borderWidth: 0.5, borderColor: REPORT.border }}>
									<Text text={cell} style={{ fontFamily: 'Helvetica', fontSize: 9 }} />
								</Cell>
							{/each}
						</Row>
					{/each}
				</Table>
			</View>
		{/if}

	</Page>
{/each}
