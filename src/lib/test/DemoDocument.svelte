<!--
	Demo document: exercises page numbers, tables, remote images, font variants,
	SVG primitives, gradients, clip paths, SVG text, explicit page breaks
	(breakBefore / breakAfter), justified text (textAlign: 'justify'),
	hyphenation (the hyphenation style prop), and keep-with-next pagination
	control in a multi-page PDF.

	Render it with:
	  import { renderComponent } from 'svelte-pdfkit';
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
	Fonts may also be loaded from a URL — fetched (and cached) at render time:
	  <Font name="Inter" src="https://example.com/fonts/Inter-Regular.ttf" />
	Then replace fontFamily values below with 'Inter'.
-->
<script lang="ts">
	import Page from '../components/Page/Page.svelte';
	import View from '../components/View/View.svelte';
	import Text from '../components/Text/Text.svelte';
	import Image from '../components/Image/Image.svelte';
	import Font from '../components/Font/Font.svelte';
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

	// A paragraph long enough to overflow a page, used to show a bordered,
	// background-filled box being cut cleanly where it crosses the page break.
	const spanningParagraph = Array.from(
		{ length: 9 },
		(_, i) =>
			`(${i + 1}) When a filled and bordered container is taller than the space left on a page, the paginator splits it across the boundary and the renderer suppresses the border on the cut edge — so the box opens at the bottom of one page and continues, seamlessly, at the top of the next rather than closing and reopening as two separate boxes.`
	).join(' ');

	// ── SVG image source ─────────────────────────────────────────────────────────
	// A 2:1 (200×100) badge rendered via <Image src="data:image/svg+xml,...">.
	// SVG images are drawn as vectors (crisp at any scale) by svg-to-pdfkit, and
	// the 2:1 viewBox lets the aspect-ratio demo derive one dimension from the other.
	const svgBadge =
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">' +
		  '<rect x="0" y="0" width="200" height="100" rx="12" fill="#1a56db"/>' +
		  '<circle cx="50" cy="50" r="30" fill="#fbbf24"/>' +
		  '<path d="M40 50 L58 70 L92 30" stroke="#ffffff" stroke-width="8" fill="none"/>' +
		  '<rect x="112" y="34" width="72" height="12" rx="6" fill="#ffffff" opacity="0.9"/>' +
		  '<rect x="112" y="56" width="52" height="10" rx="5" fill="#ffffff" opacity="0.6"/>' +
		'</svg>';
	const svgImage = 'data:image/svg+xml,' + encodeURIComponent(svgBadge);

	// ── Glyph-level font fallback fonts ──────────────────────────────────────────
	// Fetched from the Noto Fonts GitHub raw URLs at render time (cached after the
	// first request). Noto Sans covers Latin (incl. accents like Nguyễn); Noto Sans
	// SC covers the CJK code points Noto Sans lacks. Used as a fallback stack so each
	// glyph is drawn by the first font in the list that actually has it.
	const notoLatin =
		'https://raw.githubusercontent.com/notofonts/notofonts.github.io/main/fonts/NotoSans/hinted/ttf/NotoSans-Regular.ttf';
	const notoCJK =
		'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf';
	// One mixed-script string reused across the comparison.
	const mixedSample = 'Hello 世界 — 你好 from svelte-pdf · Nguyễn';
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
				bookmark="Invoice"
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
	<View bookmark="Bill To" style={{ marginTop: 8, padding: 12, backgroundColor: subtle, borderRadius: 4 }}>
		<Text text="Bill To"           style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: muted, marginBottom: 4 }} />
		<Text text="Jane Smith" bookmark="Jane Smith" style={{ fontFamily: 'Helvetica-Bold', fontSize: 11 }} />
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
<!-- Transforms page                                                        -->
<!--                                                                        -->
<!-- Demonstrates the rotate / scale / translate / skew style props on      -->
<!-- layout nodes (View, Text, Image). Transforms are a render-time effect  -->
<!-- only: the layout box is unchanged, so each demo tile reserves its full  -->
<!-- slot while its content is visually transformed about transformOrigin    -->
<!-- (default: the node's centre).                                          -->
<!-- ══════════════════════════════════════════════════════════════════════ -->
<Page size="A4" style={{ padding: 40 }}>

	<!-- Title -->
	<Text
		text="Transforms"
		bookmark="Transforms"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 20, color: brand, marginBottom: 4 }}
	/>
	<Text
		text="Rotate, scale, translate, and skew any View, Text, or Image with the transform style props. Transforms affect drawing only — not layout — and pivot about transformOrigin (default: centre)."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: muted, marginBottom: 20 }}
	/>

	<!-- ── Rotate ─────────────────────────────────────────────────────────── -->
	<Text text="rotate" style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 8 }} />
	<View style={{ flexDirection: 'row', gap: 24, marginBottom: 24, height: 80, alignItems: 'center' }}>
		{#each [0, 15, 45, 90] as deg}
			<View style={{ width: 70, height: 40, backgroundColor: '#dbeafe', borderWidth: 1, borderColor: brand, borderRadius: 4, alignItems: 'center', justifyContent: 'center', rotate: deg }}>
				<Text text={`${deg}°`} style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: brand }} />
			</View>
		{/each}
	</View>

	<!-- ── Scale ──────────────────────────────────────────────────────────── -->
	<Text text="scale / scaleX / scaleY" style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 8 }} />
	<View style={{ flexDirection: 'row', gap: 28, marginBottom: 24, height: 70, alignItems: 'center' }}>
		<View style={{ width: 60, height: 40, backgroundColor: '#fef9c3', borderWidth: 1, borderColor: '#ca8a04', borderRadius: 4, scale: 0.6 }} />
		<View style={{ width: 60, height: 40, backgroundColor: '#fef9c3', borderWidth: 1, borderColor: '#ca8a04', borderRadius: 4 }} />
		<View style={{ width: 60, height: 40, backgroundColor: '#fef9c3', borderWidth: 1, borderColor: '#ca8a04', borderRadius: 4, scaleX: 1.4 }} />
		<View style={{ width: 60, height: 40, backgroundColor: '#fef9c3', borderWidth: 1, borderColor: '#ca8a04', borderRadius: 4, scaleY: 1.4 }} />
	</View>

	<!-- ── Translate ──────────────────────────────────────────────────────── -->
	<Text text="translateX / translateY" style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 8 }} />
	<Text
		text="The outlined box shows the original (untransformed) layout slot; the solid tile is translated out of it."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: muted, marginBottom: 8 }}
	/>
	<View style={{ flexDirection: 'row', gap: 40, marginBottom: 24, height: 70 }}>
		<View style={{ width: 60, height: 50, borderWidth: 1, borderColor: border, borderRadius: 4 }}>
			<View style={{ width: 60, height: 50, backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#16a34a', borderRadius: 4, translateX: 20, translateY: 12 }} />
		</View>
	</View>

	<!-- ── Skew ───────────────────────────────────────────────────────────── -->
	<Text text="skewX / skewY" style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 8 }} />
	<View style={{ flexDirection: 'row', gap: 36, marginBottom: 24, height: 60, alignItems: 'center' }}>
		<View style={{ width: 70, height: 40, backgroundColor: '#fce7f3', borderWidth: 1, borderColor: '#db2777', skewX: 20 }} />
		<View style={{ width: 70, height: 40, backgroundColor: '#fce7f3', borderWidth: 1, borderColor: '#db2777', skewY: 12 }} />
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
<!-- transformOrigin page                                                   -->
<!--                                                                        -->
<!-- A 3×3 grid of every keyword origin, each tile given the same rotation   -->
<!-- so the pivot point's effect is directly comparable. Relies on flexWrap   -->
<!-- to break the nine cells into three rows.                                -->
<!-- ══════════════════════════════════════════════════════════════════════ -->
<Page size="A4" style={{ padding: 40 }}>

	<!-- Title -->
	<Text
		text="transformOrigin"
		bookmark="transformOrigin"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 20, color: brand, marginBottom: 4 }}
	/>
	<Text
		text="The pivot a transform turns about. Below: the same 40° rotation applied with each of the nine keyword origins, so you can see where each one anchors. left/right set the x axis, top/bottom set y — in any order — and any axis you omit defaults to centre."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: muted, marginBottom: 20 }}
	/>

	<!-- 3×3 grid: each pale cell is the untransformed layout slot; the solid
	     tile inside is rotated about the labelled origin. flexWrap breaks the
	     nine 160pt cells into rows of three within the ~515pt content width. -->
	<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 15 }}>
		{#each ['left top', 'center top', 'right top', 'left center', 'center', 'right center', 'left bottom', 'center bottom', 'right bottom'] as origin}
			<View style={{ width: 161, height: 110, backgroundColor: '#faf5ff', borderWidth: 0.5, borderColor: '#ddd6fe', borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}>
				<View style={{ width: 110, height: 40, backgroundColor: '#ddd6fe', borderWidth: 1, borderColor: '#7c3aed', borderRadius: 3, alignItems: 'center', justifyContent: 'center', rotate: 40, transformOrigin: origin }}>
					<Text text={origin} style={{ fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#5b21b6' }} />
				</View>
			</View>
		{/each}
	</View>

	<!-- Equivalent non-keyword forms -->
	<View style={{ marginTop: 24, backgroundColor: subtle, padding: 12, borderRadius: 4 }}>
		<Text
			text="Equivalent forms"
			style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: brand, marginBottom: 6 }}
		/>
		<Text
			text={"transformOrigin: 'bottom'         — same as 'center bottom' (omitted x axis → centre)"}
			style={{ fontFamily: 'Courier', fontSize: 9, color: brand, marginBottom: 3 }}
		/>
		<Text
			text={"transformOrigin: 'bottom right'   — same as 'right bottom' (keywords are order-independent)"}
			style={{ fontFamily: 'Courier', fontSize: 9, color: brand, marginBottom: 3 }}
		/>
		<Text
			text={"transformOrigin: '50% 100%'       — percentages of the box; matches 'center bottom'"}
			style={{ fontFamily: 'Courier', fontSize: 9, color: brand, marginBottom: 3 }}
		/>
		<Text
			text={"transformOrigin: [10, 20]         — an exact point pivot in the box's coordinates"}
			style={{ fontFamily: 'Courier', fontSize: 9, color: brand }}
		/>
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
		bookmark="Orphan & Widow Control"
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
		<View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
			<!--
				Spacer pushes the demo paragraph close to the page boundary.
				The body paragraph starts at y ≈ 473.7 + spacer; the page break
				sits at y = 802 (842 − 40 bottom padding). A 308 pt spacer places
				the paragraph start at y ≈ 781.7, leaving room for exactly one
				line before the break — the orphan scenario. The left column
				(orphans: 1) keeps that single orphaned line at the foot of the
				page; the right column (orphans: 2) defers the whole paragraph to
				the next page. Verified working range is ~305–311 pt; adjust if
				the content above this section changes height.
			-->
			<View style={{ height: 308 }} />
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
		<View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>
			<!-- Same 308 pt spacer as the left column so both paragraphs reach the
			     page boundary together (see the note on the left spacer above). -->
			<View style={{ height: 308 }} />
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
<!-- Boxes across a page break                                              -->
<!--                                                                        -->
<!-- Demonstrates clean border/background cutting when a styled container    -->
<!-- straddles a page boundary.  The paginator flags the cut edge and the    -->
<!-- renderer omits the border (and flattens the corner radii) there, so the -->
<!-- box reads as one continuous shape the page break passes through — the   -->
<!-- same model react-pdf uses.  Watch the bordered box below: its border    -->
<!-- runs off the bottom of this page with no closing line, and resumes at   -->
<!-- the top of the next page with no opening line.                          -->
<!-- ══════════════════════════════════════════════════════════════════════ -->
<Page size="A4" style={{ padding: 40 }}>

	<!-- Title -->
	<Text
		text="Boxes Across Page Breaks"
		bookmark="Boxes Across Page Breaks"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 20, color: brand, marginBottom: 4 }}
	/>
	<Text
		text="A bordered or filled container that is taller than the remaining page space is split across the boundary. The border is cut — not redrawn — so the box stays visually continuous."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: muted, marginBottom: 16 }}
	/>

	<!-- What to look for -->
	<Text
		text="What to look for"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 6 }}
	/>
	<View style={{ backgroundColor: subtle, padding: 12, borderRadius: 4, marginBottom: 16 }}>
		<Text
			text="• The box's left and right edges run all the way to the page edge at the break."
			style={{ fontFamily: 'Helvetica', fontSize: 9, color: brand, marginBottom: 4 }}
		/>
		<Text
			text="• No horizontal border line is drawn where the page splits (no false bottom, no false top)."
			style={{ fontFamily: 'Helvetica', fontSize: 9, color: brand, marginBottom: 4 }}
		/>
		<Text
			text="• Rounded corners appear only at the real top (page 1) and real bottom (final page)."
			style={{ fontFamily: 'Helvetica', fontSize: 9, color: brand }}
		/>
	</View>

	<!-- The spanning box: filled + bordered, long enough to overflow the page. -->
	<View
		style={{
			backgroundColor: '#eff6ff',
			borderWidth: 1.5,
			borderColor: brand,
			borderRadius: 10,
			padding: 16
		}}
	>
		<Text
			text="Continuous bordered box"
			style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 8 }}
		/>
		<Text
			text={spanningParagraph}
			style={{ fontFamily: 'Helvetica', fontSize: 11, lineHeight: 1.5, color: '#1e3a8a' }}
		/>
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
		bookmark="SVG Feature Gallery"
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
				<!-- dashed horizontal -->
				<Line x1={10} y1={40} x2={190} y2={40} stroke="#16a34a" strokeWidth={2} strokeDasharray="6 3" />
				<!-- dashed diagonal with dash offset -->
				<Line
					x1={10}
					y1={70}
					x2={190}
					y2={55}
					stroke="#ef4444"
					strokeWidth={1.5}
					strokeDasharray="2 2"
					strokeDashoffset={1}
					opacity={0.8}
				/>
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

	<!-- ── Row 4b: viewBox (same 0..100 art, three scales) & dashed rect ──── -->
	<View style={{ marginBottom: 20 }}>
		<Text text="viewBox" style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: brand, marginBottom: 6 }} />
		<Text
			text="Identical 0..100 SVG coordinates scale to fit each box via viewBox. The dashed rect uses strokeDasharray in user units."
			style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: muted, marginBottom: 6 }}
		/>
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
			{#each [60, 90, 120] as boxSize}
				<Svg width={boxSize} height={boxSize} viewBox="0 0 100 100">
					<!-- Coordinates never change; only the viewBox → box mapping does. -->
					<Rect
						x={5}
						y={5}
						width={90}
						height={90}
						fill="none"
						stroke={brand}
						strokeWidth={2}
						strokeDasharray="8 4"
					/>
					<Circle cx={50} cy={50} r={30} fill="#dbeafe" stroke={brand} strokeWidth={2} />
					<Line x1={50} y1={20} x2={50} y2={80} stroke="#ef4444" strokeWidth={2} />
				</Svg>
			{/each}
		</View>
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
		bookmark="Gradients & Clip Paths"
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
<!-- Explicit Page Breaks page                                               -->
<!--                                                                        -->
<!-- Demonstrates breakBefore and breakAfter props on View nodes.           -->
<!--                                                                        -->
<!-- All three sections live inside a single <Page> element.  The           -->
<!-- paginator splits it into three physical pages:                         -->
<!--   Page N   — title, explanation, and Section A                        -->
<!--   Page N+1 — Section B (breakBefore) + isolated block (breakAfter)    -->
<!--   Page N+2 — Section C pushed here by the breakAfter above            -->
<!-- ══════════════════════════════════════════════════════════════════════ -->
<Page size="A4" style={{ padding: 40 }}>

	<!-- Title -->
	<Text
		text="Explicit Page Breaks"
		bookmark="Explicit Page Breaks"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 20, color: brand, marginBottom: 4 }}
	/>
	<Text
		text="Force page boundaries at specific points with breakBefore and breakAfter props on View, Text, and Image."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: muted, marginBottom: 20 }}
	/>

	<!-- What they do -->
	<Text
		text="breakBefore"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 6 }}
	/>
	<Text
		text="Inserting breakBefore on a node tells the paginator to start a new page immediately before that node, regardless of how much space remains on the current page. The node always appears at the top of the new page."
		style={{ fontFamily: 'Helvetica', fontSize: 10, marginBottom: 14 }}
	/>

	<Text
		text="breakAfter"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 6 }}
	/>
	<Text
		text="Inserting breakAfter on a node tells the paginator to start a new page immediately after that node. All subsequent flow content begins at the top of the new page."
		style={{ fontFamily: 'Helvetica', fontSize: 10, marginBottom: 14 }}
	/>

	<!-- Usage reference -->
	<View style={{ backgroundColor: subtle, padding: 12, borderRadius: 4, marginBottom: 20 }}>
		<Text
			text={'<View breakBefore>   — start this block on a new page'}
			style={{ fontFamily: 'Courier', fontSize: 9, color: brand, marginBottom: 4 }}
		/>
		<Text
			text={'<View breakAfter>    — push everything after this to a new page'}
			style={{ fontFamily: 'Courier', fontSize: 9, color: brand, marginBottom: 8 }}
		/>
		<Text
			text="Both props are supported on View, Text, and Image components. They do not affect fixed nodes."
			style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: muted }}
		/>
	</View>

	<!-- Live demo intro -->
	<Text
		text="Live demo — three sections across three pages"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 6 }}
	/>
	<Text
		text="Section A is below. Section B carries breakBefore so it starts at the top of the next page — even though this page has space remaining. Section C is pushed to a third page by breakAfter on the block above it."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: muted, marginBottom: 14 }}
	/>

	<!-- ── Section A (stays on this page) ────────────────────────────────── -->
	<View style={{ backgroundColor: '#dbeafe', borderRadius: 6, padding: 16, marginBottom: 10 }}>
		<Text
			text="Section A"
			style={{ fontFamily: 'Helvetica-Bold', fontSize: 13, color: brand, marginBottom: 6 }}
		/>
		<Text
			text="This section lives on the first page of the demo. It contains enough content to make it obvious that space is left on the page before the forced break fires."
			style={{ fontFamily: 'Helvetica', fontSize: 10, marginBottom: 8 }}
		/>
		<Text
			text="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."
			style={{ fontFamily: 'Helvetica', fontSize: 10 }}
		/>
	</View>

	<!-- Callout: space remains but break will fire -->
	<View style={{ borderWidth: 1, borderColor: '#fca5a5', borderRadius: 4, padding: 10, marginBottom: 6 }}>
		<Text
			text="Space remains on this page — but Section B is forced onto the next page by breakBefore."
			style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: '#b91c1c' }}
		/>
	</View>

	<!-- ── Section B — breakBefore fires here, new page starts ───────────── -->
	<View
		breakBefore={true}
		style={{ backgroundColor: '#dcfce7', borderRadius: 6, padding: 16, marginBottom: 14 }}
	>
		<Text
			text="Section B  ← starts here due to breakBefore"
			style={{ fontFamily: 'Helvetica-Bold', fontSize: 13, color: '#15803d', marginBottom: 6 }}
		/>
		<Text
			text="This block was given breakBefore. No matter how much space was left on the previous page, the paginator opened a fresh page and placed this block at the top."
			style={{ fontFamily: 'Helvetica', fontSize: 10, marginBottom: 8 }}
		/>
		<Text
			text="Use breakBefore for chapter headings, new document sections, or any content that must always begin at the top of a page."
			style={{ fontFamily: 'Helvetica', fontSize: 10 }}
		/>
	</View>

	<!-- breakAfter explanation on Section B's page -->
	<Text
		text="breakAfter demo"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 6 }}
	/>
	<Text
		text="The highlighted block below has breakAfter set. Section C will begin on the next page even though there is space remaining on this one."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: muted, marginBottom: 10 }}
	/>

	<!-- Block with breakAfter -->
	<View
		breakAfter={true}
		style={{ backgroundColor: '#fef9c3', borderRadius: 6, padding: 16, borderWidth: 1, borderColor: '#ca8a04' }}
	>
		<Text
			text="Isolated Block  (breakAfter)"
			style={{ fontFamily: 'Helvetica-Bold', fontSize: 12, color: '#92400e', marginBottom: 6 }}
		/>
		<Text
			text="breakAfter is set on this view. The paginator inserts a page break immediately after its bottom edge. Everything below — including Section C — moves to the next page."
			style={{ fontFamily: 'Helvetica', fontSize: 10 }}
		/>
	</View>

	<!-- ── Section C — pushed here by breakAfter above ───────────────────── -->
	<View style={{ backgroundColor: '#f3e8ff', borderRadius: 6, padding: 16 }}>
		<Text
			text="Section C  ← pushed here by breakAfter"
			style={{ fontFamily: 'Helvetica-Bold', fontSize: 13, color: '#7c3aed', marginBottom: 6 }}
		/>
		<Text
			text="This section follows the breakAfter block in the source, so the paginator placed it at the top of a new page automatically."
			style={{ fontFamily: 'Helvetica', fontSize: 10, marginBottom: 8 }}
		/>
		<Text
			text="Use breakAfter when a block marks the end of a logical unit and you want a clean visual separation from whatever comes next — a title page, a summary, or a section divider."
			style={{ fontFamily: 'Helvetica', fontSize: 10 }}
		/>
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
<!-- Justified Text page                                                    -->
<!--                                                                        -->
<!-- Demonstrates textAlign: 'justify'.  Wrapped lines are stretched to the -->
<!-- full content width by distributing slack across word gaps; the final   -->
<!-- line of each paragraph keeps its natural width.                        -->
<!-- ══════════════════════════════════════════════════════════════════════ -->
<Page size="A4" style={{ padding: 40 }}>

	<!-- Title -->
	<Text
		text="Justified Text"
		bookmark="Justified Text"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 20, color: brand, marginBottom: 4 }}
	/>
	<Text
		text="Stretch lines flush to both margins with the textAlign: 'justify' style prop on any <Text> node."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: muted, marginBottom: 20 }}
	/>

	<!-- What it does -->
	<Text
		text="How it works"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 6 }}
	/>
	<Text
		text="svelte-pdf wraps the text, measures each line, then distributes the leftover horizontal space evenly across that line's word gaps so it reaches the right margin. The last line of every paragraph is left at its natural width — exactly as a typesetter would set it — and single-word lines are never stretched."
		style={{ fontFamily: 'Helvetica', fontSize: 10, marginBottom: 16 }}
	/>

	<!-- Style prop reference -->
	<View style={{ backgroundColor: subtle, padding: 12, borderRadius: 4, marginBottom: 20 }}>
		<Text
			text={"<Text style={{ textAlign: 'justify' }}>…</Text>"}
			style={{ fontFamily: 'Courier', fontSize: 9, color: brand, marginBottom: 8 }}
		/>
		<Text
			text="Works across page breaks too: when a justified paragraph splits, each page's lines stay correctly justified."
			style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: muted }}
		/>
	</View>

	<!-- Side-by-side comparison -->
	<Text
		text="Left-aligned vs justified — same paragraph"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 4 }}
	/>
	<Text
		text="Notice the ragged right edge on the left and the flush right edge on the right (every line but the last)."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: muted, marginBottom: 10 }}
	/>
	<View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>

		<!-- Left: default left alignment -->
		<View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, borderWidth: 1, borderColor: border, borderRadius: 4, padding: 8 }}>
			<Text
				text="textAlign: 'left' (default)"
				style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, color: muted, marginBottom: 6 }}
			/>
			<Text
				text="The quick brown fox jumps over the lazy dog while the typesetter measures every word and leaves the right edge ragged, as ordinary left-aligned prose naturally falls."
				style={{ fontFamily: 'Helvetica', fontSize: 10, textAlign: 'left', lineHeight: 1.35 }}
			/>
		</View>

		<!-- Right: justified -->
		<View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, borderWidth: 1, borderColor: '#93c5fd', borderRadius: 4, padding: 8 }}>
			<Text
				text="textAlign: 'justify'"
				style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, color: brand, marginBottom: 6 }}
			/>
			<Text
				text="The quick brown fox jumps over the lazy dog while the typesetter measures every word and leaves the right edge ragged, as ordinary left-aligned prose naturally falls."
				style={{ fontFamily: 'Helvetica', fontSize: 10, textAlign: 'justify', lineHeight: 1.35 }}
			/>
		</View>

	</View>

	<!-- Full-width justified block -->
	<Text
		text="Full-width justified paragraph"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 6 }}
	/>
	<Text
		text="Justification shines in dense, column-width body copy such as terms and conditions, legal clauses, or article text. Each line below is stretched to the page margins by widening the spaces between words just enough to fill the available measure, producing the clean rectangular block of text associated with professional print typography. The final line, having nothing to align against, simply ends wherever the words run out."
		style={{ fontFamily: 'Helvetica', fontSize: 10, textAlign: 'justify', lineHeight: 1.4 }}
	/>

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
<!-- Hyphenation page                                                       -->
<!--                                                                        -->
<!-- Demonstrates the opt-in `hyphenation` style prop on <Text>.  Words that -->
<!-- overflow a line are broken at dictionary hyphenation points with a      -->
<!-- trailing hyphen instead of being pushed whole to the next line.         -->
<!--                                                                        -->
<!-- Two comparisons:                                                        -->
<!--   1. Justified, off vs on — hyphenation removes the wide word gaps     -->
<!--      ("rivers") that justification alone leaves in a narrow column.     -->
<!--   2. British vs American patterns — the same paragraph hyphenated with  -->
<!--      en-gb and en-us, which genuinely break words at different points   -->
<!--      (e.g. know-ledge vs knowl-edge).                                   -->
<!-- ══════════════════════════════════════════════════════════════════════ -->
<Page size="A4" style={{ padding: 40 }}>

	<!-- Title -->
	<Text
		text="Hyphenation"
		bookmark="Hyphenation"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 20, color: brand, marginBottom: 4 }}
	/>
	<Text
		text="Break long words across lines at dictionary hyphenation points with the opt-in hyphenation style prop on any <Text> node."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: muted, marginBottom: 20 }}
	/>

	<!-- What it does -->
	<Text
		text="How it works"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 6 }}
	/>
	<Text
		text="With hyphenation enabled, a word that would overflow the line is split at a valid Knuth-Liang pattern point and a trailing hyphen is inserted, rather than being moved whole to the next line. It is off by default and most noticeable in narrow columns and justified text, where it removes the wide inter-word gaps that justification alone produces."
		style={{ fontFamily: 'Helvetica', fontSize: 10, marginBottom: 16 }}
	/>

	<!-- Style prop reference -->
	<View style={{ backgroundColor: subtle, padding: 12, borderRadius: 4, marginBottom: 20 }}>
		<Text
			text={"<Text style={{ hyphenation: true }}>…</Text>"}
			style={{ fontFamily: 'Courier', fontSize: 9, color: brand, marginBottom: 4 }}
		/>
		<Text
			text={"hyphenationLang: 'en-gb' (default) | 'en-us'   — patterns are language-specific"}
			style={{ fontFamily: 'Courier', fontSize: 9, color: brand, marginBottom: 8 }}
		/>
		<Text
			text="en-gb and en-us ship bundled; other languages can be supplied via registerHyphenationCallback()."
			style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: muted }}
		/>
	</View>

	<!-- ── Comparison 1: justified, off vs on ─────────────────────────────── -->
	<Text
		text="Justified text — hyphenation off vs on"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 4 }}
	/>
	<Text
		text="The same justified paragraph in a narrow column. On the left, justification alone stretches the spaces to fill each line, leaving uneven gaps. On the right, hyphenation lets long words break so the spacing stays tight and even."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: muted, marginBottom: 10 }}
	/>
	<View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>

		<!-- Left: justified, hyphenation off -->
		<View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, borderWidth: 1, borderColor: border, borderRadius: 4, padding: 8 }}>
			<Text
				text="hyphenation: false (default)"
				style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, color: muted, marginBottom: 6 }}
			/>
			<Text
				text="Notwithstanding the extraordinary administrative responsibilities, the internationalisation programme demonstrated incontrovertibly that comprehensive documentation consistently outperforms improvised alternatives."
				style={{ fontFamily: 'Helvetica', fontSize: 10, textAlign: 'justify', lineHeight: 1.4 }}
			/>
		</View>

		<!-- Right: justified, hyphenation on -->
		<View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, borderWidth: 1, borderColor: '#93c5fd', borderRadius: 4, padding: 8 }}>
			<Text
				text="hyphenation: true"
				style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, color: brand, marginBottom: 6 }}
			/>
			<Text
				text="Notwithstanding the extraordinary administrative responsibilities, the internationalisation programme demonstrated incontrovertibly that comprehensive documentation consistently outperforms improvised alternatives."
				style={{ fontFamily: 'Helvetica', fontSize: 10, textAlign: 'justify', lineHeight: 1.4, hyphenation: true }}
			/>
		</View>

	</View>

	<!-- ── Comparison 2: British vs American patterns ─────────────────────── -->
	<Text
		text="British vs American break points"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 4 }}
	/>
	<Text
		text="The same paragraph hyphenated with each dictionary. British (en-gb) breaks by etymology, American (en-us) by pronunciation, so words split at different points — e.g. know-ledge vs knowl-edge, demo-cracy vs democ-racy. Left-aligned here so the hyphen positions are easy to compare."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: muted, marginBottom: 10 }}
	/>
	<View style={{ flexDirection: 'row', gap: 12 }}>

		<!-- Left: en-gb (default) -->
		<View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, borderWidth: 1, borderColor: '#86efac', borderRadius: 4, padding: 8 }}>
			<Text
				text="hyphenationLang: 'en-gb'"
				style={{ fontFamily: 'Courier', fontSize: 8, color: '#16a34a', marginBottom: 6 }}
			/>
			<Text
				text="The committee acknowledged the knowledge, democracy, and responsibility underpinning the organisation's international development philosophy."
				style={{ fontFamily: 'Helvetica', fontSize: 10, lineHeight: 1.4, hyphenation: true, hyphenationLang: 'en-gb' }}
			/>
		</View>

		<!-- Right: en-us -->
		<View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, borderWidth: 1, borderColor: '#fca5a5', borderRadius: 4, padding: 8 }}>
			<Text
				text="hyphenationLang: 'en-us'"
				style={{ fontFamily: 'Courier', fontSize: 8, color: '#ef4444', marginBottom: 6 }}
			/>
			<Text
				text="The committee acknowledged the knowledge, democracy, and responsibility underpinning the organisation's international development philosophy."
				style={{ fontFamily: 'Helvetica', fontSize: 10, lineHeight: 1.4, hyphenation: true, hyphenationLang: 'en-us' }}
			/>
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
<!-- Keep-With-Next page                                                    -->
<!--                                                                        -->
<!-- Demonstrates the keepWithNext prop.  A node marked keepWithNext is kept -->
<!-- on the same page as the start of its following sibling — preventing a   -->
<!-- heading from being stranded at the bottom of a page, away from its body.-->
<!--                                                                        -->
<!-- Live demo: a spacer pushes a heading + body pair near the page boundary -->
<!-- so the body would start past it.  The heading carries keepWithNext, so   -->
<!-- the paginator pulls the heading onto the next page to keep it with the   -->
<!-- body, rather than stranding it at the foot of this page.                 -->
<!--                                                                          -->
<!-- (A side-by-side "with vs without" comparison isn't possible here: a page -->
<!-- break is horizontal across the whole page, so pulling the break up would -->
<!-- move both columns.  The contrast is described in text instead.)          -->
<!--                                                                          -->
<!-- The spacer height is tuned so the body starts just past the boundary;    -->
<!-- adjust it if the surrounding content above changes.                      -->
<!-- ══════════════════════════════════════════════════════════════════════ -->
<Page size="A4" style={{ padding: 40 }}>

	<!-- Title -->
	<Text
		text="Keep With Next"
		bookmark="Keep With Next"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 20, color: brand, marginBottom: 4 }}
	/>
	<Text
		text="Keep a heading on the same page as the content it introduces with the keepWithNext prop."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: muted, marginBottom: 20 }}
	/>

	<!-- What it does -->
	<Text
		text="What it does"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 6 }}
	/>
	<Text
		text="A node marked keepWithNext must appear on the same page as the start of its following sibling. If the natural page break would separate the two, the paginator moves the marked node to the next page so they travel together — eliminating the classic 'orphaned heading' stranded at the foot of a page."
		style={{ fontFamily: 'Helvetica', fontSize: 10, marginBottom: 16 }}
	/>

	<!-- Prop reference -->
	<View style={{ backgroundColor: subtle, padding: 12, borderRadius: 4, marginBottom: 16 }}>
		<Text
			text={'<Text keepWithNext>Section 3: Results</Text>'}
			style={{ fontFamily: 'Courier', fontSize: 9, color: brand, marginBottom: 4 }}
		/>
		<Text
			text={'<View>…body of the section…</View>'}
			style={{ fontFamily: 'Courier', fontSize: 9, color: brand, marginBottom: 8 }}
		/>
		<Text
			text="Supported on View, Text, and Image. If the pair is taller than a whole page, the break is allowed (the constraint cannot be satisfied)."
			style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: muted }}
		/>
	</View>

	<!-- Live demo intro -->
	<Text
		text="Live demo — heading pulled to stay with its body"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 4 }}
	/>
	<Text
		text="The spacer below pushes the green heading to the very bottom of this page, where its body no longer fits. Because the heading is marked keepWithNext, the paginator moves it to the top of the next page so it stays directly above its body. Without keepWithNext the heading would remain stranded here, alone at the foot of the page."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: muted, marginBottom: 8 }}
	/>

	<!--
		Spacer: pushes the heading down so its body would start just past the page
		boundary (≈797pt).  Tuned against the content above; adjust if that
		content changes (raise to push lower, lower to pull up).
	-->
	<View style={{ height: 482 }} />

	<!-- Heading marked keepWithNext, immediately followed by its body sibling. -->
	<Text
		text="Section 3: Results  (keepWithNext)"
		keepWithNext={true}
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 13, color: '#16a34a', marginBottom: 6 }}
	/>
	<View style={{ borderWidth: 1, borderColor: '#86efac', borderRadius: 4, padding: 10 }}>
		<Text
			text="This body is the heading's following sibling. Because the heading carries keepWithNext, the paginator detected that the body would not fit beneath it on the previous page and pulled the heading forward — so this block opens cleanly with its heading at the top of a fresh page, never separated by the break."
			style={{ fontFamily: 'Helvetica', fontSize: 10, lineHeight: 1.35 }}
		/>
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
<!-- SVG Text page                                                          -->
<!-- ══════════════════════════════════════════════════════════════════════ -->
<Page size="A4" style={{ padding: 40 }}>

	<!-- Title -->
	<Text
		text="SVG Text"
		bookmark="SVG Text"
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

	<!-- ── Rotated text (rotate) ─────────────────────────────────────────── -->
	<Text
		text="Rotated text (rotate)"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 8 }}
	/>
	<Text
		text="The rotate prop turns text clockwise in degrees about its (x, y) anchor — ideal for vertical axis titles and gutter labels. Combine with textAnchor='middle' to spin a label in place."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: muted, marginBottom: 8 }}
	/>
	<Svg width={515} height={120}>
		<!-- Baseline reference for the flat label -->
		<Line x1={30} y1={100} x2={485} y2={100} stroke={border} strokeWidth={0.75} />

		<!-- Vertical axis title: -90° reads bottom-to-top -->
		<SvgText x={16} y={60} text="Y axis (rotate=-90)" fontSize={10} fill={brand} textAnchor="middle" rotate={-90} />

		<!-- A fan of angles about a shared anchor -->
		<SvgText x={160} y={60} text="0°"   fontSize={11} fill="black"    textAnchor="middle" rotate={0} />
		<SvgText x={260} y={60} text="45°"  fontSize={11} fill="#16a34a" textAnchor="middle" rotate={45} />
		<SvgText x={360} y={60} text="90°"  fontSize={11} fill="#ef4444" textAnchor="middle" rotate={90} />
		<SvgText x={455} y={60} text="180°" fontSize={11} fill={muted}   textAnchor="middle" rotate={180} />
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

<!-- ══════════════════════════════════════════════════════════════════════ -->
<!-- Image Sources & Aspect Ratio page                                      -->
<!--                                                                        -->
<!-- Demonstrates <Image> SVG sources (drawn as vectors) and automatic      -->
<!-- aspect-ratio sizing: specify one of width/height and the other is      -->
<!-- derived from the image's intrinsic proportions.                        -->
<!-- ══════════════════════════════════════════════════════════════════════ -->
<Page size="A4" style={{ padding: 40 }}>

	<!-- Title -->
	<Text
		text="Image Sources & Aspect Ratio"
		bookmark="Image Sources & Aspect Ratio"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 20, color: brand, marginBottom: 4 }}
	/>
	<Text
		text="<Image> renders PNG and JPEG bitmaps as well as SVG sources, from local files, remote URLs, or data URIs."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: muted, marginBottom: 20 }}
	/>

	<!-- ── SVG image source ───────────────────────────────────────────────── -->
	<Text
		text="SVG image source"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 6 }}
	/>
	<Text
		text="SVG sources are drawn as true vectors (crisp at any scale) via svg-to-pdfkit. The badge below is a data:image/svg+xml URI — a .svg file path or URL works identically. Rendered here at three sizes from the same source:"
		style={{ fontFamily: 'Helvetica', fontSize: 10, marginBottom: 10 }}
	/>
	<View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 20 }}>
		<Image src={svgImage} style={{ width: 200, height: 100 }} />
		<Image src={svgImage} style={{ width: 120, height: 60 }} />
		<Image src={svgImage} style={{ width: 70, height: 35 }} />
	</View>

	<!-- ── Aspect ratio ───────────────────────────────────────────────────── -->
	<Text
		text="Automatic aspect ratio"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 6 }}
	/>
	<Text
		text="The badge's intrinsic ratio is 2:1. Set only one of width or height and the layout derives the other so proportions are preserved. Set both to override and stretch. This works for PNG and JPEG too — the size is read from the image header."
		style={{ fontFamily: 'Helvetica', fontSize: 10, marginBottom: 12 }}
	/>

	<View style={{ flexDirection: 'column', gap: 14 }}>

		<!-- width only -->
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
			<View style={{ width: 200 }}>
				<Text text="style={{ width: 180 }}" style={{ fontFamily: 'Courier', fontSize: 9, color: brand }} />
				<Text text="height derived → 90 (2:1)" style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: muted, marginTop: 2 }} />
			</View>
			<Image src={svgImage} style={{ width: 180 }} />
		</View>

		<!-- height only -->
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
			<View style={{ width: 200 }}>
				<Text text="style={{ height: 60 }}" style={{ fontFamily: 'Courier', fontSize: 9, color: brand }} />
				<Text text="width derived → 120 (2:1)" style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: muted, marginTop: 2 }} />
			</View>
			<Image src={svgImage} style={{ height: 60 }} />
		</View>

		<!-- both — stretched -->
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
			<View style={{ width: 200 }}>
				<Text text="style={{ width: 120, height: 120 }}" style={{ fontFamily: 'Courier', fontSize: 9, color: brand }} />
				<Text text="both set → stretched to a square" style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: muted, marginTop: 2 }} />
			</View>
			<Image src={svgImage} style={{ width: 120, height: 120 }} />
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
<!-- Glyph-Level Font Fallback page                                          -->
<!--                                                                        -->
<!-- Demonstrates per-character font substitution. A fontFamily list is a    -->
<!-- per-glyph fallback chain: each character keeps the first font in the    -->
<!-- list that has its glyph. Proof is by contrast — the same mixed-script   -->
<!-- string rendered with the primary font alone (CJK shows as .notdef/tofu  -->
<!-- boxes) beside the full stack (CJK filled from the fallback font).        -->
<!--                                                                        -->
<!-- Fonts are fetched from the Noto Fonts GitHub raw URLs at render time. If -->
<!-- the network is unavailable the fetch fails gracefully (loadResources     -->
<!-- warns, the renderer drops to Helvetica) and this page still renders a    -->
<!-- valid PDF — the fallback column simply won't show the CJK glyphs.        -->
<!-- ══════════════════════════════════════════════════════════════════════ -->
<Page size="A4" style={{ padding: 40 }}>

	<!--
		Font declarations. <Font> is purely declarative (renders nothing); it
		registers a remote font the rest of the page can reference by name.
	-->
	<Font name="NotoLatin" src={notoLatin} />
	<Font name="NotoCJK" src={notoCJK} />

	<!-- Title -->
	<Text
		text="Glyph-Level Font Fallback"
		bookmark="Glyph-Level Font Fallback"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 20, color: brand, marginBottom: 4 }}
	/>
	<Text
		text="Mix scripts in one run: a fontFamily list acts as a per-character fallback chain, so each glyph is drawn by the first font in the list that actually has it."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: muted, marginBottom: 20 }}
	/>

	<!-- How it works -->
	<Text
		text="How it works"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 6 }}
	/>
	<Text
		text="Family-level fallback picks one font for an entire run. Glyph-level fallback goes further: it keeps the primary font for the glyphs it has and drops to the next font in the same list only for the code points the primary lacks — CJK, emoji, or rare symbols — without splitting grapheme clusters such as accents or flag emoji."
		style={{ fontFamily: 'Helvetica', fontSize: 10, marginBottom: 16 }}
	/>

	<!-- Style prop reference -->
	<View style={{ backgroundColor: subtle, padding: 12, borderRadius: 4, marginBottom: 20 }}>
		<Text
			text={"<Text style={{ fontFamily: ['NotoLatin', 'NotoCJK'] }}>Hello 世界</Text>"}
			style={{ fontFamily: 'Courier', fontSize: 9, color: brand, marginBottom: 8 }}
		/>
		<Text
			text="No new prop — the existing fontFamily list is the fallback chain. Colour emoji (COLR/sbix) renders monochrome; that is gated by PDFKit and out of scope here."
			style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: muted }}
		/>
	</View>

	<!-- ── Contrast: primary only vs full stack ───────────────────────────── -->
	<Text
		text="Primary font alone vs the full fallback stack"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 4 }}
	/>
	<Text
		text="Both panels render the same string. Left uses only the Latin font, so the CJK characters have no glyph and appear as .notdef boxes. Right adds the CJK font as a fallback, so those same characters are filled in — while the Latin text stays in the primary font."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: muted, marginBottom: 10 }}
	/>
	<View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>

		<!-- Left: primary only — CJK is missing -->
		<View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, borderWidth: 1, borderColor: '#fca5a5', borderRadius: 4, padding: 10 }}>
			<Text
				text="fontFamily: 'NotoLatin'"
				style={{ fontFamily: 'Courier', fontSize: 8, color: '#ef4444', marginBottom: 8 }}
			/>
			<Text
				text={mixedSample}
				style={{ fontFamily: 'NotoLatin', fontSize: 14, lineHeight: 1.4 }}
			/>
			<Text
				text="Above: CJK glyphs missing (tofu)"
				style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: muted, marginTop: 8 }}
			/>
		</View>

		<!-- Right: full stack — CJK filled from the fallback -->
		<View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0, borderWidth: 1, borderColor: '#86efac', borderRadius: 4, padding: 10 }}>
			<Text
				text="fontFamily: ['NotoLatin', 'NotoCJK']"
				style={{ fontFamily: 'Courier', fontSize: 8, color: '#16a34a', marginBottom: 8 }}
			/>
			<Text
				text={mixedSample}
				style={{ fontFamily: ['NotoLatin', 'NotoCJK'], fontSize: 14, lineHeight: 1.4 }}
			/>
			<Text
				text="Above: CJK filled from the fallback font"
				style={{ fontFamily: 'Helvetica-Oblique', fontSize: 8, color: muted, marginTop: 8 }}
			/>
		</View>

	</View>

	<!-- ── Alignment: mixed runs across left / center / right ─────────────── -->
	<Text
		text="Mixed runs across alignments"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 4 }}
	/>
	<Text
		text="The fallback stack is measured and positioned correctly under every alignment — the font switches mid-line without disturbing layout."
		style={{ fontFamily: 'Helvetica-Oblique', fontSize: 9, color: muted, marginBottom: 10 }}
	/>
	<View style={{ borderWidth: 1, borderColor: border, borderRadius: 4, padding: 10, marginBottom: 20 }}>
		<Text
			text={mixedSample}
			style={{ fontFamily: ['NotoLatin', 'NotoCJK'], fontSize: 12, textAlign: 'left', marginBottom: 6 }}
		/>
		<Text
			text={mixedSample}
			style={{ fontFamily: ['NotoLatin', 'NotoCJK'], fontSize: 12, textAlign: 'center', marginBottom: 6 }}
		/>
		<Text
			text={mixedSample}
			style={{ fontFamily: ['NotoLatin', 'NotoCJK'], fontSize: 12, textAlign: 'right' }}
		/>
	</View>

	<!-- ── Justified multi-font paragraph ─────────────────────────────────── -->
	<Text
		text="Justified, with per-glyph fallback"
		style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: brand, marginBottom: 6 }}
	/>
	<Text
		text="Justification distributes slack across the whole line even where it switches fonts mid-line. The paragraph below mixes Latin and CJK — 世界 means world, 你好 means hello — and is stretched flush to both margins, while the final line keeps its natural width."
		style={{ fontFamily: ['NotoLatin', 'NotoCJK'], fontSize: 11, textAlign: 'justify', lineHeight: 1.5 }}
	/>

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
