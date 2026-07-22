<script lang="ts">
	import Document from '../components/Document/Document.svelte';
	import Page from '../components/Page/Page.svelte';
	import View from '../components/View/View.svelte';
	import Svg from '../components/Svg/Svg.svelte';
	import Line from '../components/Svg/Line.svelte';
	import Rect from '../components/Svg/Rect.svelte';
</script>

<Document>
	<Page>
		<View style={{ flexDirection: 'column' }}>
			<!-- viewBox: 50×25 user units mapped into a 200×100 box (uniform ×4 → clamped by height ×4). -->
			<Svg width={200} height={100} viewBox="0 0 50 25">
				<Line
					x1={0}
					y1={5}
					x2={50}
					y2={5}
					stroke="black"
					strokeWidth={1}
					strokeDasharray="4 2"
					strokeDashoffset={1}
				/>
				<Rect x={5} y={10} width={40} height={10} stroke="red" strokeWidth={1} fill="none" strokeDasharray="3" />
			</Svg>
		</View>
	</Page>
</Document>
