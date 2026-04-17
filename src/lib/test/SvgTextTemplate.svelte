<script lang="ts">
	import Document from '../components/Document/Document.svelte';
	import Page from '../components/Page/Page.svelte';
	import View from '../components/View/View.svelte';
	import Svg from '../components/Svg/Svg.svelte';
	import SvgText from '../components/Svg/SvgText.svelte';
	import Tspan from '../components/Svg/Tspan.svelte';
</script>

<Document>
	<Page>
		<View style={{ flexDirection: 'column' }}>
			<Svg width={300} height={120}>
				<!-- Simple text -->
				<SvgText x={10} y={20} text="Hello, SVG!" fontSize={14} fill="#1a56db" />
				<!-- textAnchor middle -->
				<SvgText x={150} y={50} text="Centered" fontSize={12} textAnchor="middle" fill="black" />
				<!-- dx/dy tspan offsets -->
				<SvgText x={10} y={80} fontSize={12} fill="black">
					<Tspan text="Normal " fill="black" />
					<Tspan text="Bold" fontFamily="Helvetica-Bold" fill="red" />
				</SvgText>
				<!-- dy tspan offset -->
				<SvgText x={10} y={100} fontSize={10} fill="black">
					<Tspan text="Line one" />
					<Tspan text="Line two" dy={14} />
				</SvgText>
			</Svg>
		</View>
	</Page>
</Document>
