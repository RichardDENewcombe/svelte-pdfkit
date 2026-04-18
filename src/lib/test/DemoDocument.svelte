<!--
	Demo document: exercises page numbers, tables, remote images, font variants,
	SVG primitives, gradients, clip paths, and SVG text in a multi-page PDF.

	Render it with:
	  import { renderComponent } from 'svelte-pdf';
	  import DemoDocument from './DemoDocument.svelte';
	  const stream = await renderComponent(DemoDocument);

	Page margins are set once on <Page style={{ padding: 40 }}>.  Yoga enforces
	them natively on every page, including overflow pages — no need to add
	paddingLeft/paddingRight to individual child views.

	The fixed footer uses position:absolute with bottom/left/right values that
	are relative to the page edge (Yoga uses border-box for absolute elements),
	so it is unaffected by page padding.  The paginator automatically detects
	fixed footer nodes in the bottom half of the page and reserves enough space
	(footer height + 15pt clearance) so flow content never runs behind them.

	Font variants: uses PDFKit's built-in Helvetica family so no font files are
	needed.  To use a custom font instead, declare it with <Font>:
	  <Font name="Inter" src="/path/to/Inter-Regular.ttf" weight="normal" />
	  <Font name="Inter" src="/path/to/Inter-Bold.ttf"    weight="bold"   />
	  <Font name="Inter" src="/path/to/Inter-Italic.ttf"  fontStyle="italic" />
	Then replace fontFamily values below with 'Inter'.
-->
<script lang="ts">
	import Page from '../components/Page/Page.svelte';
	import View from '../components/View/View.svelte';
	import Text from '../components/Text/Text.svelte';
	import Image from '../components/Image/Image.svelte';
	import Table from '../components/Table/Table.svelte';
	import Row from '../components/Table/Row.svelte';
	import Cell from '../components/Table/Cell.svelte';
	import Svg from '../components/Svg/Svg.svelte';
	import G from '../components/Svg/G.svelte';
	import Rect from '../components/Svg/Rect.svelte';
	import Circle from '../components/Svg/Circle.svelte';
	import Ellipse from '../components/Svg/Ellipse.svelte';
	import Line from '../components/Svg/Line.svelte';
	import Path from '../components/Svg/Path.svelte';
	import Polyline from '../components/Svg/Polyline.svelte';
	import Polygon from '../components/Svg/Polygon.svelte';
	import Defs from '../components/Svg/Defs.svelte';
	import LinearGradient from '../components/Svg/LinearGradient.svelte';
	import RadialGradient from '../components/Svg/RadialGradient.svelte';
	import Stop from '../components/Svg/Stop.svelte';
	import ClipPath from '../components/Svg/ClipPath.svelte';
	import SvgText from '../components/Svg/SvgText.svelte';
	import Tspan from '../components/Svg/Tspan.svelte';
	import type { PageNumberRenderer } from '../types/pdf.js';

	// ── Page number footer ─────────────────────────────────────────────────────
	const pageFooter: PageNumberRenderer = ({ pageNumber, totalPages }) =>
		`Page ${pageNumber} of ${totalPages}`;

	// ── Table data ─────────────────────────────────────────────────────────────
	const items = [
		{ name: 'Mechanical Keyboard', qty: 1, unit: '$129.00', total: '$129.00' },
		{ name: 'USB-C Hub (7-port)',   qty: 2, unit: '$45.00',  total: '$90.00'  },
		{ name: 'Monitor Stand',        qty: 1, unit: '$35.00',  total: '$35.00'  },
		{ name: 'Cable Organiser Set',  qty: 3, unit: '$12.00',  total: '$36.00'  },
		{ name: 'Desk Pad (90×40 cm)',  qty: 1, unit: '$28.00',  total: '$28.00'  },
	];

	// Enough extra rows to push content onto a second page.
	const extraRows = Array.from({ length: 40 }, (_, i) => ({
		name: `Filler Item ${i + 1}`,
		qty: 1,
		unit: '$1.00',
		total: '$1.00',
	}));

	const allItems = [...items, ...extraRows];

	// ── Colours ────────────────────────────────────────────────────────────────
	const brand  = '#1a56db';
	const subtle = '#f3f4f6';
	const border = '#d1d5db';
	const muted  = '#6b7280';
</script>

<!--
	padding: 40 — 40pt margin on all four sides, enforced by Yoga on every page.
	No manual paddingBottom needed: the paginator automatically detects the fixed
	footer below and adds 15pt clearance above it, keeping flow content clear.
-->
<Page size="A4" style={{ padding: 40 }}>

	<!-- ── Header ─────────────────────────────────────────────────────────── -->
	<View style={{ flexDirection: 'row', alignItems: 'center' }}>
		<!--
			Remote image — fetched over HTTPS at render time.
			picsum.photos returns a stable placeholder photo for a given seed.
			Replace the URL with your own logo.
		-->
		<Image
			src="https://picsum.photos/seed/svelte-pdf/120/60"
			style={{ width: 120, height: 60, marginRight: 20 }}
		/>

		<View style={{ flexDirection: 'column', flexGrow: 1 }}>
			<Text
				text="INVOICE"
				style={{ fontFamily: 'Helvetica-Bold', fontSize: 28, color: brand }}
			/>
			<Text
				text="INV-2026-0042"
				style={{ fontFamily: 'Helvetica', fontSize: 12, color: muted, marginTop: 4 }}
			/>
		</View>

		<View style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
			<Text text="Acme Corp"              style={{ fontFamily: 'Helvetica-Bold',    fontSize: 12 }} />
			<Text text="123 Main St, Springfield" style={{ fontFamily: 'Helvetica-Oblique', fontSize: 10, color: muted }} />
			<Text text="hello@acmecorp.example" style={{ fontFamily: 'Helvetica',         fontSize: 10, color: muted }} />
		</View>
	</View>

	<!-- ── Divider ────────────────────────────────────────────────────────── -->
	<View style={{ marginTop: 20, borderWidth: 1, borderColor: border }} />

	<!-- ── Font variants showcase ─────────────────────────────────────────── -->
	<View style={{ paddingTop: 16, paddingBottom: 8 }}>
		<Text
			text="Font Variants"
			style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 6 }}
		/>
		<View style={{ flexDirection: 'row' }}>
			<Text text="Regular · "   style={{ fontFamily: 'Helvetica',           fontSize: 11 }} />
			<Text text="Bold · "      style={{ fontFamily: 'Helvetica-Bold',      fontSize: 11 }} />
			<Text text="Oblique · "   style={{ fontFamily: 'Helvetica-Oblique',   fontSize: 11 }} />
			<Text text="BoldOblique"  style={{ fontFamily: 'Helvetica-BoldOblique', fontSize: 11 }} />
		</View>
	</View>

	<!-- ── Bill-to block ──────────────────────────────────────────────────── -->
	<View style={{ marginTop: 8, padding: 12, backgroundColor: subtle, borderRadius: 4 }}>
		<Text text="Bill To"           style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: muted, marginBottom: 4 }} />
		<Text text="Jane Smith"        style={{ fontFamily: 'Helvetica-Bold', fontSize: 11 }} />
		<Text text="456 Oak Avenue"    style={{ fontFamily: 'Helvetica',      fontSize: 10 }} />
		<Text text="Portland, OR 97201" style={{ fontFamily: 'Helvetica',     fontSize: 10 }} />
	</View>

	<!-- ── SVG shapes showcase ─────────────────────────────────────────────── -->
	<View style={{ paddingTop: 16, paddingBottom: 8 }}>
		<Text
			text="SVG Shapes"
			style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 8 }}
		/>
		<View style={{ flexDirection: 'row', gap: 20 }}>

			<!-- Polyline: open zigzag line -->
			<View style={{ flexDirection: 'column', alignItems: 'center' }}>
				<Svg width={120} height={60}>
					<Polyline
						points="0,50 20,10 40,40 60,5 80,35 100,15 120,45"
						fill="none"
						stroke={brand}
						strokeWidth={2}
					/>
				</Svg>
				<Text text="Polyline" style={{ fontFamily: 'Helvetica', fontSize: 9, color: muted, marginTop: 4 }} />
			</View>

			<!-- Polygon: filled triangle -->
			<View style={{ flexDirection: 'column', alignItems: 'center' }}>
				<Svg width={80} height={60}>
					<Polygon
						points="40,0 80,60 0,60"
						fill="#dbeafe"
						stroke={brand}
						strokeWidth={1.5}
					/>
				</Svg>
				<Text text="Polygon (triangle)" style={{ fontFamily: 'Helvetica', fontSize: 9, color: muted, marginTop: 4 }} />
			</View>

			<!-- Polygon: filled pentagon -->
			<View style={{ flexDirection: 'column', alignItems: 'center' }}>
				<Svg width={80} height={80}>
					<Polygon
						points="40,0 76,27 62,70 18,70 4,27"
						fill="#fef9c3"
						stroke="#ca8a04"
						strokeWidth={1.5}
					/>
				</Svg>
				<Text text="Polygon (pentagon)" style={{ fontFamily: 'Helvetica', fontSize: 9, color: muted, marginTop: 4 }} />
			</View>

		</View>
	</View>

	<!-- ── Line-items table ────────────────────────────────────────────────── -->
	<View style={{ paddingTop: 16 }}>
		<Table>
			<!-- Header row -->
			<Row style={{ backgroundColor: brand }}>
				<Cell style={{ padding: 6, flexGrow: 3 }}>
					<Text text="Description" style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: 'white' }} />
				</Cell>
				<Cell style={{ padding: 6 }}>
					<Text text="Qty"   style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: 'white', textAlign: 'center' }} />
				</Cell>
				<Cell style={{ padding: 6 }}>
					<Text text="Unit"  style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: 'white', textAlign: 'right' }} />
				</Cell>
				<Cell style={{ padding: 6 }}>
					<Text text="Total" style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: 'white', textAlign: 'right' }} />
				</Cell>
			</Row>

			<!-- Data rows — alternate shading -->
			{#each allItems as item, i}
				<Row style={{ backgroundColor: i % 2 === 0 ? 'white' : subtle }}>
					<Cell style={{ padding: 5, flexGrow: 3, borderWidth: 0.5, borderColor: border }}>
						<Text text={item.name}        style={{ fontFamily: 'Helvetica', fontSize: 10 }} />
					</Cell>
					<Cell style={{ padding: 5, borderWidth: 0.5, borderColor: border }}>
						<Text text={String(item.qty)} style={{ fontFamily: 'Helvetica', fontSize: 10, textAlign: 'center' }} />
					</Cell>
					<Cell style={{ padding: 5, borderWidth: 0.5, borderColor: border }}>
						<Text text={item.unit}        style={{ fontFamily: 'Helvetica', fontSize: 10, textAlign: 'right' }} />
					</Cell>
					<Cell style={{ padding: 5, borderWidth: 0.5, borderColor: border }}>
						<Text text={item.total}       style={{ fontFamily: 'Helvetica', fontSize: 10, textAlign: 'right' }} />
					</Cell>
				</Row>
			{/each}
		</Table>
	</View>

	<!--
		Fixed footer — repeats on every page.
		position:absolute with bottom/left/right is relative to the page edge
		(border-box), so these values are independent of the page padding above.
		left/right: 40 aligns the footer with the page content margin.
	-->
	<View
		fixed={true}
		style={{ position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' }}
	>
		<Text
			text="Acme Corp · Confidential"
			style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: muted }}
		/>
		<Text
			render={pageFooter}
			style={{ fontFamily: 'Helvetica', fontSize: 8, color: muted }}
		/>
	</View>

</Page>

<!-- ══════════════════════════════════════════════════════════════════════ -->
<!-- Orphan & Widow Control page                                            -->
<!--                                                                        -->
<!-- Demonstrates the orphans / widows style props.                         -->
<!--                                                                        -->
<!-- Side-by-side comparison:                                               -->
<!--   Left  — orphans: 1 (default, disabled): a single orphaned line      -->
<!--           remains at the bottom of this page and the rest of the       -->
<!--           paragraph continues on the next page.                        -->
<!--   Right — orphans: 2 (enabled): the entire paragraph is deferred to   -->
<!--           the next page so no orphan appears.                          -->
<!--                                                                        -->
<!-- The <View style={{ height: N }}> spacers inside each column push the  -->
<!-- demo paragraphs close to the page boundary.  Increase N if both       -->
<!-- paragraphs still fit on this page; decrease N if neither shows any    -->
<!-- content here.                                                          -->
<!-- ══════════════════════════════════════════════════════════════════════ -->
<Page size="A4" style={{ padding: 40 }}>

	<!-- Title -->
	<Text
		text="Orphan & Widow Control"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 20, color: brand, marginBottom: 4 }}
	/>
	<Text
		text="Prevent isolated lines at page boundaries with the orphans and widows style props on <Text> nodes."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: muted, marginBottom: 20 }}
	/>

	<!-- What they are -->
	<Text
		text="What they are"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 6 }}
	/>
	<Text
		text="An orphan is the first line of a paragraph left alone at the bottom of a page while the rest continues on the next. A widow is the last line of a paragraph appearing alone at the top of a page, cut off from the body above it."
		style={{ fontFamily: 'Helvetica', fontSize: 10, marginBottom: 8 }}
	/>
	<Text
		text="Both are typographic defects that fragment reading flow. Professional typesetting systems require a minimum number of lines at each boundary so neither condition can arise."
		style={{ fontFamily: 'Helvetica', fontSize: 10, marginBottom: 16 }}
	/>

	<!-- Style props -->
	<Text
		text="Style props"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 6 }}
	/>
	<View style={{ backgroundColor: subtle, padding: 12, borderRadius: 4, marginBottom: 16 }}>
		<Text
			text="orphans: 2   — minimum lines kept at the bottom of a page (start of block)"
			style={{ fontFamily: 'Courier', fontSize: 9, color: brand, marginBottom: 4 }}
		/>
		<Text
			text="widows:  2   — minimum lines kept at the top    of a page (end of block)"
			style={{ fontFamily: 'Courier', fontSize: 9, color: brand, marginBottom: 8 }}
		/>
		<Text
			text="Both default to 1 (disabled). Set to 2 or more on any <Text> node to activate."
			style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: muted }}
		/>
	</View>

	<!-- How they work -->
	<Text
		text="How orphan control works"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 6 }}
	/>
	<Text
		text="When orphans: 2 is set, the paginator counts how many lines of the block fit before the page break. If fewer than two would be visible, the entire block is deferred to the next page — eliminating the orphan."
		style={{ fontFamily: 'Helvetica', fontSize: 10, marginBottom: 14 }}
	/>
	<Text
		text="How widow control works"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 6 }}
	/>
	<Text
		text="When widows: 2 is set, the paginator ensures at least two lines appear at the top of the next page. If only one line would remain, a line is moved forward from the current page so both sides of the break show at least two lines."
		style={{ fontFamily: 'Helvetica', fontSize: 10, marginBottom: 18 }}
	/>

	<!-- Demo header -->
	<Text
		text="Live demo — orphan control"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 4 }}
	/>
	<Text
		text="Both panels below are positioned near the page boundary. Left uses orphans: 1 (disabled); right uses orphans: 2. Compare the bottom of this page with the top of the next to see the difference."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: muted, marginBottom: 10 }}
	/>

	<!-- Side-by-side comparison columns -->
	<View style={{ flexDirection: 'row', gap: 12 }}>

		<!-- Left: orphans disabled (default) -->
		<View style={{ flexGrow: 1 }}>
			<!--
				Spacer pushes the demo paragraph close to the page boundary.
				With the content above this section ~540 pt tall and a column
				of ~251 pt available width, a spacer of ~130 pt leaves roughly
				one line of the paragraph visible before the break — exactly the
				orphan scenario.
			-->
			<View style={{ height: 130 }} />
			<View style={{ borderWidth: 1, borderColor: '#fca5a5', borderRadius: 4, padding: 8 }}>
				<Text
					text="orphans: 1 — control disabled"
					style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#ef4444', marginBottom: 4 }}
				/>
				<Text
					text="Orphan control is off. If only one line fits before the page break it is left here as an orphan, disconnected from the rest of the paragraph which continues at the top of the next page. This is the default behaviour when orphans is not set."
					style={{ fontFamily: 'Helvetica', fontSize: 9, orphans: 1 }}
				/>
			</View>
		</View>

		<!-- Right: orphans: 2 -->
		<View style={{ flexGrow: 1 }}>
			<View style={{ height: 130 }} />
			<View style={{ borderWidth: 1, borderColor: '#86efac', borderRadius: 4, padding: 8 }}>
				<Text
					text="orphans: 2 — orphan prevented"
					style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#16a34a', marginBottom: 4 }}
				/>
				<Text
					text="Orphan control is on. Because fewer than two lines fit before the page break, the entire paragraph is moved to the next page intact. No isolated line appears at the bottom here — the paragraph opens cleanly at the top of the following page."
					style={{ fontFamily: 'Helvetica', fontSize: 9, orphans: 2 }}
				/>
			</View>
		</View>

	</View>

	<!-- Fixed footer -->
	<View
		fixed={true}
		style={{ position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' }}
	>
		<Text
			text="Acme Corp · Confidential"
			style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: muted }}
		/>
		<Text
			render={pageFooter}
			style={{ fontFamily: 'Helvetica', fontSize: 8, color: muted }}
		/>
	</View>

</Page>

<!-- ══════════════════════════════════════════════════════════════════════ -->
<!-- SVG Feature Gallery page                                               -->
<!-- ══════════════════════════════════════════════════════════════════════ -->
<Page size="A4" style={{ padding: 40 }}>

	<!-- Title -->
	<Text
		text="SVG Feature Gallery"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 20, color: brand, marginBottom: 4 }}
	/>
	<Text
		text="Every SVG primitive rendered by svelte-pdf: Rect, Circle, Ellipse, Line, Polyline, Polygon, Path, and G (group)."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: muted, marginBottom: 20 }}
	/>

	<!-- ── Row 1: Rect & Circle ──────────────────────────────────────────── -->
	<View style={{ flexDirection: 'row', marginBottom: 20, gap: 16 }}>

		<!-- Rect — plain, rounded, and stroked -->
		<View style={{ flexGrow: 1 }}>
			<Text text="Rect" style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: brand, marginBottom: 6 }} />
			<Svg width={200} height={80}>
				<!-- plain fill -->
				<Rect x={0} y={10} width={50} height={50} fill="#dbeafe" stroke={brand} strokeWidth={1} />
				<!-- rounded corners -->
				<Rect x={60} y={10} width={50} height={50} rx={10} ry={10} fill="#fef9c3" stroke="#ca8a04" strokeWidth={1} />
				<!-- stroke only -->
				<Rect x={120} y={10} width={50} height={50} fill="none" stroke="#16a34a" strokeWidth={2} />
			</Svg>
		</View>

		<!-- Circle — solid, ring, semi-transparent -->
		<View style={{ flexGrow: 1 }}>
			<Text text="Circle" style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: brand, marginBottom: 6 }} />
			<Svg width={200} height={80}>
				<Circle cx={30} cy={40} r={28} fill={brand} />
				<Circle cx={100} cy={40} r={28} fill="none" stroke={brand} strokeWidth={2} />
				<Circle cx={170} cy={40} r={28} fill="#ef4444" opacity={0.4} />
			</Svg>
		</View>

	</View>

	<!-- ── Row 2: Ellipse & Line ─────────────────────────────────────────── -->
	<View style={{ flexDirection: 'row', marginBottom: 20, gap: 16 }}>

		<!-- Ellipse — wide, tall, and rotated-ish via rx/ry swap -->
		<View style={{ flexGrow: 1 }}>
			<Text text="Ellipse" style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: brand, marginBottom: 6 }} />
			<Svg width={200} height={80}>
				<Ellipse cx={50}  cy={40} rx={45} ry={25} fill="#dbeafe" stroke={brand} strokeWidth={1} />
				<Ellipse cx={150} cy={40} rx={25} ry={35} fill="#fce7f3" stroke="#db2777" strokeWidth={1} />
			</Svg>
		</View>

		<!-- Line — horizontal, vertical, diagonal -->
		<View style={{ flexGrow: 1 }}>
			<Text text="Line" style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: brand, marginBottom: 6 }} />
			<Svg width={200} height={80}>
				<!-- horizontal -->
				<Line x1={10} y1={20} x2={190} y2={20} stroke={brand} strokeWidth={2} />
				<!-- vertical -->
				<Line x1={100} y1={0} x2={100} y2={80} stroke="#16a34a" strokeWidth={2} />
				<!-- diagonal -->
				<Line x1={10} y1={70} x2={190} y2={10} stroke="#ef4444" strokeWidth={1.5} opacity={0.8} />
			</Svg>
		</View>

	</View>

	<!-- ── Row 3: Polyline & Polygon ─────────────────────────────────────── -->
	<View style={{ flexDirection: 'row', marginBottom: 20, gap: 16 }}>

		<!-- Polyline — open zigzag, no fill -->
		<View style={{ flexGrow: 1 }}>
			<Text text="Polyline" style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: brand, marginBottom: 6 }} />
			<Svg width={200} height={80}>
				<Polyline
					points="5,70 30,15 55,55 80,10 105,50 130,20 155,60 180,10"
					fill="none"
					stroke={brand}
					strokeWidth={2}
				/>
			</Svg>
		</View>

		<!-- Polygon — triangle and star-like hexagon -->
		<View style={{ flexGrow: 1 }}>
			<Text text="Polygon" style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: brand, marginBottom: 6 }} />
			<Svg width={200} height={80}>
				<!-- triangle -->
				<Polygon points="50,5 95,75 5,75" fill="#dbeafe" stroke={brand} strokeWidth={1.5} />
				<!-- hexagon -->
				<Polygon
					points="160,5 192,22 192,58 160,75 128,58 128,22"
					fill="#fef9c3"
					stroke="#ca8a04"
					strokeWidth={1.5}
				/>
			</Svg>
		</View>

	</View>

	<!-- ── Row 4: Path ───────────────────────────────────────────────────── -->
	<View style={{ marginBottom: 20 }}>
		<Text text="Path" style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: brand, marginBottom: 6 }} />
		<Svg width={515} height={100}>
			<!-- Smooth cubic bezier wave -->
			<Path
				d="M 0,50 C 40,10 80,90 120,50 C 160,10 200,90 240,50 C 280,10 320,90 360,50 C 400,10 440,90 480,50"
				fill="none"
				stroke={brand}
				strokeWidth={2}
			/>
			<!-- Filled arc-based leaf shape -->
			<Path
				d="M 60,95 Q 30,60 60,20 Q 90,60 60,95 Z"
				fill="#dbeafe"
				stroke={brand}
				strokeWidth={1}
			/>
			<!-- Filled crescent using two arcs -->
			<Path
				d="M 200,20 A 35,35 0 1 1 200,80 A 25,25 0 1 0 200,20 Z"
				fill="#fce7f3"
				stroke="#db2777"
				strokeWidth={1}
			/>
			<!-- Simple arrow head -->
			<Path
				d="M 340,55 L 390,55 L 380,45 M 390,55 L 380,65"
				fill="none"
				stroke="#16a34a"
				strokeWidth={2}
			/>
		</Svg>
	</View>

	<!-- ── Row 5: G (group with shared style) ────────────────────────────── -->
	<View style={{ marginBottom: 20 }}>
		<Text text="G (group)" style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: brand, marginBottom: 6 }} />
		<Text
			text="A <G> applies shared stroke/fill to all children. The inner circle overrides fill individually."
			style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: muted, marginBottom: 6 }}
		/>
		<Svg width={515} height={90}>
			<!-- Group: shared blue stroke, no fill -->
			<G stroke={brand} strokeWidth={2} fill="none">
				<Rect x={10}  y={10} width={60} height={60} rx={6} ry={6} />
				<Circle cx={120} cy={40} r={28} />
				<Ellipse cx={210} cy={40} rx={40} ry={25} />
				<!-- Child overrides fill -->
				<Circle cx={300} cy={40} r={28} fill="#dbeafe" />
			</G>
			<!-- Nested groups with opacity cascade -->
			<G stroke="#ef4444" strokeWidth={1.5} opacity={0.5}>
				<Line x1={370} y1={10} x2={420} y2={80} />
				<Line x1={420} y1={10} x2={370} y2={80} />
				<Circle cx={395} cy={45} r={20} fill="#fecaca" />
			</G>
		</Svg>
	</View>

	<!-- Fixed footer (same as page 1) -->
	<View
		fixed={true}
		style={{ position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' }}
	>
		<Text
			text="Acme Corp · Confidential"
			style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: muted }}
		/>
		<Text
			render={pageFooter}
			style={{ fontFamily: 'Helvetica', fontSize: 8, color: muted }}
		/>
	</View>

</Page>

<!-- ══════════════════════════════════════════════════════════════════════ -->
<!-- Gradients & Clip Paths page                                            -->
<!-- ══════════════════════════════════════════════════════════════════════ -->
<Page size="A4" style={{ padding: 40 }}>

	<!-- Title -->
	<Text
		text="Gradients & Clip Paths"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 20, color: brand, marginBottom: 4 }}
	/>
	<Text
		text="SVG Phase 2: LinearGradient, RadialGradient, Stop, Defs, and ClipPath components."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: muted, marginBottom: 20 }}
	/>

	<!-- ── Linear gradients ───────────────────────────────────────────────── -->
	<Text
		text="Linear Gradients"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 8 }}
	/>
	<View style={{ flexDirection: 'row', gap: 16, marginBottom: 20 }}>

		<!-- Horizontal gradient on a rect -->
		<View style={{ flexGrow: 1, flexDirection: 'column', alignItems: 'center' }}>
			<Svg width={155} height={60}>
				<Defs>
					<LinearGradient id="lg-horiz" x1={0} y1={0} x2={155} y2={0}>
						<Stop offset={0} stopColor="#1a56db" />
						<Stop offset={1} stopColor="#7c3aed" />
					</LinearGradient>
				</Defs>
				<Rect x={0} y={0} width={155} height={60} fill="url(#lg-horiz)" />
			</Svg>
			<Text text="Horizontal" style={{ fontFamily: 'Helvetica', fontSize: 8, color: muted, marginTop: 4 }} />
		</View>

		<!-- Vertical gradient on a rect -->
		<View style={{ flexGrow: 1, flexDirection: 'column', alignItems: 'center' }}>
			<Svg width={155} height={60}>
				<Defs>
					<LinearGradient id="lg-vert" x1={0} y1={0} x2={0} y2={60}>
						<Stop offset={0} stopColor="#fbbf24" />
						<Stop offset={1} stopColor="#ef4444" />
					</LinearGradient>
				</Defs>
				<Rect x={0} y={0} width={155} height={60} fill="url(#lg-vert)" />
			</Svg>
			<Text text="Vertical" style={{ fontFamily: 'Helvetica', fontSize: 8, color: muted, marginTop: 4 }} />
		</View>

		<!-- Diagonal gradient on a rounded rect -->
		<View style={{ flexGrow: 1, flexDirection: 'column', alignItems: 'center' }}>
			<Svg width={155} height={60}>
				<Defs>
					<LinearGradient id="lg-diag" x1={0} y1={0} x2={155} y2={60}>
						<Stop offset={0} stopColor="#10b981" />
						<Stop offset={0.5} stopColor="#3b82f6" />
						<Stop offset={1} stopColor="#8b5cf6" />
					</LinearGradient>
				</Defs>
				<Rect x={0} y={0} width={155} height={60} rx={12} ry={12} fill="url(#lg-diag)" />
			</Svg>
			<Text text="Diagonal (3 stops)" style={{ fontFamily: 'Helvetica', fontSize: 8, color: muted, marginTop: 4 }} />
		</View>

	</View>

	<!-- ── Radial gradients ───────────────────────────────────────────────── -->
	<Text
		text="Radial Gradients"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 8 }}
	/>
	<View style={{ flexDirection: 'row', gap: 16, marginBottom: 20 }}>

		<!-- Radial on a circle -->
		<View style={{ flexGrow: 1, flexDirection: 'column', alignItems: 'center' }}>
			<Svg width={100} height={100}>
				<Defs>
					<RadialGradient id="rg-circle" cx={50} cy={50} r={50}>
						<Stop offset={0} stopColor="white" />
						<Stop offset={1} stopColor={brand} />
					</RadialGradient>
				</Defs>
				<Circle cx={50} cy={50} r={48} fill="url(#rg-circle)" />
			</Svg>
			<Text text="Circle" style={{ fontFamily: 'Helvetica', fontSize: 8, color: muted, marginTop: 4 }} />
		</View>

		<!-- Radial on a rect — spotlight effect -->
		<View style={{ flexGrow: 1, flexDirection: 'column', alignItems: 'center' }}>
			<Svg width={200} height={100}>
				<Defs>
					<LinearGradient id="rg-bg" x1={0} y1={0} x2={200} y2={0}>
						<Stop offset={0} stopColor="#1e1b4b" />
						<Stop offset={1} stopColor="#312e81" />
					</LinearGradient>
					<RadialGradient id="rg-spot" cx={100} cy={50} r={60}>
						<Stop offset={0} stopColor="white" stopOpacity={0.25} />
						<Stop offset={1} stopColor="white" stopOpacity={0} />
					</RadialGradient>
				</Defs>
				<Rect x={0} y={0} width={200} height={100} fill="url(#rg-bg)" />
				<Rect x={0} y={0} width={200} height={100} fill="url(#rg-spot)" />
			</Svg>
			<Text text="Spotlight overlay" style={{ fontFamily: 'Helvetica', fontSize: 8, color: muted, marginTop: 4 }} />
		</View>

		<!-- Radial with off-centre focal point -->
		<View style={{ flexGrow: 1, flexDirection: 'column', alignItems: 'center' }}>
			<Svg width={100} height={100}>
				<Defs>
					<RadialGradient id="rg-focal" cx={50} cy={50} r={50} fx={30} fy={30}>
						<Stop offset={0} stopColor="#fde68a" />
						<Stop offset={1} stopColor="#f59e0b" />
					</RadialGradient>
				</Defs>
				<Circle cx={50} cy={50} r={48} fill="url(#rg-focal)" />
			</Svg>
			<Text text="Off-centre focal (fx, fy)" style={{ fontFamily: 'Helvetica', fontSize: 8, color: muted, marginTop: 4 }} />
		</View>

	</View>

	<!-- ── Clip paths ─────────────────────────────────────────────────────── -->
	<Text
		text="Clip Paths"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 8 }}
	/>
	<View style={{ flexDirection: 'row', gap: 16, marginBottom: 20 }}>

		<!-- Circle clipped to a rect -->
		<View style={{ flexGrow: 1, flexDirection: 'column', alignItems: 'center' }}>
			<Svg width={120} height={100}>
				<Defs>
					<ClipPath id="cp-rect">
						<Rect x={20} y={10} width={80} height={80} />
					</ClipPath>
				</Defs>
				<!-- Circle is clipped to the square region -->
				<Circle cx={60} cy={50} r={48} fill={brand} clipPath="url(#cp-rect)" />
			</Svg>
			<Text text="Circle clipped to Rect" style={{ fontFamily: 'Helvetica', fontSize: 8, color: muted, marginTop: 4 }} />
		</View>

		<!-- Gradient rect clipped to a circle -->
		<View style={{ flexGrow: 1, flexDirection: 'column', alignItems: 'center' }}>
			<Svg width={120} height={100}>
				<Defs>
					<LinearGradient id="cp-grad" x1={0} y1={0} x2={120} y2={100}>
						<Stop offset={0} stopColor="#10b981" />
						<Stop offset={1} stopColor="#3b82f6" />
					</LinearGradient>
					<ClipPath id="cp-circle">
						<Circle cx={60} cy={50} r={44} />
					</ClipPath>
				</Defs>
				<!-- Full-size rect painted with gradient, clipped to the circle -->
				<Rect x={0} y={0} width={120} height={100} fill="url(#cp-grad)" clipPath="url(#cp-circle)" />
			</Svg>
			<Text text="Gradient clipped to Circle" style={{ fontFamily: 'Helvetica', fontSize: 8, color: muted, marginTop: 4 }} />
		</View>

		<!-- Star-burst: gradient circle clipped to a polygon -->
		<View style={{ flexGrow: 1, flexDirection: 'column', alignItems: 'center' }}>
			<Svg width={120} height={100}>
				<Defs>
					<RadialGradient id="cp-rg" cx={60} cy={50} r={50}>
						<Stop offset={0} stopColor="#fde68a" />
						<Stop offset={1} stopColor="#f59e0b" />
					</RadialGradient>
					<!-- Pentagon clip -->
					<ClipPath id="cp-penta">
						<Polygon points="60,5 108,38 90,90 30,90 12,38" />
					</ClipPath>
				</Defs>
				<Rect x={0} y={0} width={120} height={100} fill="url(#cp-rg)" clipPath="url(#cp-penta)" />
			</Svg>
			<Text text="Radial gradient clipped to Polygon" style={{ fontFamily: 'Helvetica', fontSize: 8, color: muted, marginTop: 4 }} />
		</View>

	</View>

	<!-- ── Combined: gradient + clip ──────────────────────────────────────── -->
	<Text
		text="Combined: gradient fill with clip path"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 8 }}
	/>
	<Svg width={515} height={80}>
		<Defs>
			<LinearGradient id="combo-grad" x1={0} y1={0} x2={515} y2={0}>
				<Stop offset={0}    stopColor="#1a56db" />
				<Stop offset={0.33} stopColor="#7c3aed" />
				<Stop offset={0.66} stopColor="#db2777" />
				<Stop offset={1}    stopColor="#ef4444" />
			</LinearGradient>
			<!-- Wave-like clip: a wide path that reveals the top portion -->
			<ClipPath id="combo-clip">
				<Path d="M 0,0 L 515,0 L 515,60 C 400,80 300,30 200,55 C 100,80 50,45 0,60 Z" />
			</ClipPath>
		</Defs>
		<Rect x={0} y={0} width={515} height={80} fill="url(#combo-grad)" clipPath="url(#combo-clip)" />
	</Svg>

	<!-- Fixed footer -->
	<View
		fixed={true}
		style={{ position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' }}
	>
		<Text
			text="Acme Corp · Confidential"
			style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: muted }}
		/>
		<Text
			render={pageFooter}
			style={{ fontFamily: 'Helvetica', fontSize: 8, color: muted }}
		/>
	</View>

</Page>

<!-- ══════════════════════════════════════════════════════════════════════ -->
<!-- SVG Text page                                                          -->
<!-- ══════════════════════════════════════════════════════════════════════ -->
<Page size="A4" style={{ padding: 40 }}>

	<!-- Title -->
	<Text
		text="SVG Text"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 20, color: brand, marginBottom: 4 }}
	/>
	<Text
		text="SVG Phase 3: SvgText and Tspan — absolute positioning, textAnchor alignment, and inline style overrides."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: muted, marginBottom: 20 }}
	/>

	<!-- ── Simple text ────────────────────────────────────────────────────── -->
	<Text
		text="Simple text"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 8 }}
	/>
	<Text
		text="SvgText places text at an absolute x/y point in SVG coordinate space. No word wrap — each element is one line."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: muted, marginBottom: 8 }}
	/>
	<Svg width={515} height={60}>
		<!-- Left column: size and weight variants -->
		<SvgText x={0}   y={12} text="12pt regular"            fontSize={12} fill="black" />
		<SvgText x={0}   y={30} text="16pt brand colour"       fontSize={16} fill={brand} />
		<SvgText x={0}   y={50} text="10pt muted"              fontSize={10} fill={muted} />
		<!-- Right column -->
		<SvgText x={260} y={12} text="Bold via fontFamily"     fontSize={12} fontFamily="Helvetica-Bold"      fill="black" />
		<SvgText x={260} y={30} text="Oblique via fontFamily"  fontSize={12} fontFamily="Helvetica-Oblique"   fill="black" />
		<SvgText x={260} y={50} text="Opacity 0.4"             fontSize={12} fill={brand} opacity={0.4} />
	</Svg>

	<View style={{ marginTop: 16, marginBottom: 16, borderWidth: 0.5, borderColor: border }} />

	<!-- ── textAnchor ─────────────────────────────────────────────────────── -->
	<Text
		text="Text anchoring (textAnchor)"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 8 }}
	/>
	<Text
		text="All three texts share x=258 (the midpoint). textAnchor controls which part of the string aligns to that x."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: muted, marginBottom: 8 }}
	/>
	<Svg width={515} height={66}>
		<!-- Reference line at the shared x anchor -->
		<Line x1={258} y1={0} x2={258} y2={66} stroke={border} strokeWidth={0.75} />

		<SvgText x={258} y={15} text="textAnchor='start' — text begins at x"  fontSize={10} fill={brand}     textAnchor="start" />
		<SvgText x={258} y={35} text="textAnchor='middle' — text centred on x" fontSize={10} fill="#16a34a"  textAnchor="middle" />
		<SvgText x={258} y={55} text="textAnchor='end' — text ends at x"       fontSize={10} fill="#ef4444"  textAnchor="end" />
	</Svg>

	<View style={{ marginTop: 16, marginBottom: 16, borderWidth: 0.5, borderColor: border }} />

	<!-- ── Tspan: inline style overrides ─────────────────────────────────── -->
	<Text
		text="Mixed styling with Tspan"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 8 }}
	/>
	<Text
		text="Tspan children override font, colour, and position within a single text element. Successive spans continue from the previous span's end."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: muted, marginBottom: 8 }}
	/>
	<Svg width={515} height={90}>
		<!-- Colour run: normal + highlighted bold + normal + accent -->
		<SvgText x={0} y={18} fontSize={12} fill="black">
			<Tspan text="Revenue " />
			<Tspan text="increased" fontFamily="Helvetica-Bold" fill="#16a34a" />
			<Tspan text=" by " fill="black" />
			<Tspan text="32%" fontFamily="Helvetica-Bold" fill="#16a34a" />
			<Tspan text=" versus last quarter." fill="black" />
		</SvgText>

		<!-- Warning-style run with accent colour -->
		<SvgText x={0} y={42} fontSize={11} fill="black">
			<Tspan text="Status: " />
			<Tspan text="OVERDUE" fontFamily="Helvetica-Bold" fill="#ef4444" />
			<Tspan text=" — payment was due " fill={muted} />
			<Tspan text="14 days ago." fontFamily="Helvetica-Oblique" fill={muted} />
		</SvgText>

		<!-- Multi-line using absolute y on second Tspan -->
		<SvgText x={0} y={66} fontSize={10} fill={muted}>
			<Tspan text="Line 1 — absolute y=66" />
			<Tspan text="Line 2 — absolute y=82 (set via y prop)" y={82} />
		</SvgText>
	</Svg>

	<View style={{ marginTop: 16, marginBottom: 16, borderWidth: 0.5, borderColor: border }} />

	<!-- ── Practical example: bar chart ──────────────────────────────────── -->
	<Text
		text="Practical example: bar chart with labels"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 8 }}
	/>
	<Text
		text="SvgText with textAnchor='end' for axis labels, textAnchor='start' for value callouts, and textAnchor='middle' for the title."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: muted, marginBottom: 8 }}
	/>
	<!--
		Bar chart layout:
		  x=0..44    — quarter labels (textAnchor="end")
		  x=50       — axis line
		  x=52..452  — bar area (400px max for value=200)
		  x=452+     — value labels (textAnchor="start")
		Bar heights: 22px tall, 10px gap between bars.
		y positions (bar top): 30, 62, 94, 126
	-->
	<Svg width={515} height={165}>
		<!-- Chart title (centred) -->
		<SvgText x={258} y={14} text="Revenue by Quarter  (USD thousands)" fontSize={11} fontFamily="Helvetica-Bold" fill={brand} textAnchor="middle" />

		<!-- Axis line -->
		<Line x1={50} y1={26} x2={50} y2={153} stroke={muted} strokeWidth={1} />
		<!-- Baseline -->
		<Line x1={50} y1={153} x2={460} y2={153} stroke={muted} strokeWidth={0.5} />

		<!-- Q1  value=120  width=240 -->
		<Rect x={51} y={30} width={240} height={22} fill={brand} />
		<SvgText x={46} y={45} text="Q1" fontSize={10} fontFamily="Helvetica-Bold" fill="black" textAnchor="end" />
		<SvgText x={297} y={45} text="$120K" fontSize={9} fill={muted} textAnchor="start" />

		<!-- Q2  value=160  width=320 -->
		<Rect x={51} y={62} width={320} height={22} fill="#3b82f6" />
		<SvgText x={46} y={77} text="Q2" fontSize={10} fontFamily="Helvetica-Bold" fill="black" textAnchor="end" />
		<SvgText x={377} y={77} text="$160K" fontSize={9} fill={muted} textAnchor="start" />

		<!-- Q3  value=145  width=290 -->
		<Rect x={51} y={94} width={290} height={22} fill="#60a5fa" />
		<SvgText x={46} y={109} text="Q3" fontSize={10} fontFamily="Helvetica-Bold" fill="black" textAnchor="end" />
		<SvgText x={347} y={109} text="$145K" fontSize={9} fill={muted} textAnchor="start" />

		<!-- Q4  value=200  width=400 -->
		<Rect x={51} y={126} width={400} height={22} fill="#93c5fd" />
		<SvgText x={46} y={141} text="Q4" fontSize={10} fontFamily="Helvetica-Bold" fill="black" textAnchor="end" />
		<SvgText x={457} y={141} text="$200K" fontSize={9} fill={muted} textAnchor="start" />

		<!-- X-axis label -->
		<SvgText x={255} y={163} text="USD (thousands)" fontSize={8} fill={muted} textAnchor="middle" />
	</Svg>

	<!-- Fixed footer -->
	<View
		fixed={true}
		style={{ position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' }}
	>
		<Text
			text="Acme Corp · Confidential"
			style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: muted }}
		/>
		<Text
			render={pageFooter}
			style={{ fontFamily: 'Helvetica', fontSize: 8, color: muted }}
		/>
	</View>

</Page>
