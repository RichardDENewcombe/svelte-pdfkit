<script lang="ts">
	import Document from '../components/Document/Document.svelte';
	import Page from '../components/Page/Page.svelte';
	import View from '../components/View/View.svelte';
	import Svg from '../components/Svg/Svg.svelte';
	import Path from '../components/Svg/Path.svelte';
	import Circle from '../components/Svg/Circle.svelte';
	import Rect from '../components/Svg/Rect.svelte';
	import Ellipse from '../components/Svg/Ellipse.svelte';
	import Line from '../components/Svg/Line.svelte';
	import G from '../components/Svg/G.svelte';
	import Polyline from '../components/Svg/Polyline.svelte';
	import Polygon from '../components/Svg/Polygon.svelte';
</script>

<Document>
	<Page>
		<View style={{ flexDirection: 'column' }}>
			<!-- All eight SVG element types in one Svg viewport -->
			<Svg width={300} height={200}>
				<Rect x={10} y={10} width={50} height={30} fill="red" />
				<Circle cx={100} cy={30} r={20} fill="blue" />
				<Ellipse cx={160} cy={30} rx={30} ry={15} fill="green" />
				<Line x1={10} y1={80} x2={290} y2={80} stroke="black" strokeWidth={2} />
				<Path d="M 10 100 L 100 150 L 200 100 Z" fill="orange" />
				<G fill="purple">
					<Circle cx={250} cy={150} r={15} fill="purple" />
				</G>
				<Polyline points="10,150 50,120 90,160 130,110" stroke="navy" strokeWidth={1.5} fill="none" />
				<Polygon points="200,140 230,110 260,140" fill="teal" stroke="black" strokeWidth={1} />
			</Svg>
		</View>
	</Page>
</Document>
