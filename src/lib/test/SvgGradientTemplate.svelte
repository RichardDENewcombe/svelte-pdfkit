<script lang="ts">
	import Document from '../components/Document/Document.svelte';
	import Page from '../components/Page/Page.svelte';
	import View from '../components/View/View.svelte';
	import Svg from '../components/Svg/Svg.svelte';
	import Defs from '../components/Svg/Defs.svelte';
	import LinearGradient from '../components/Svg/LinearGradient.svelte';
	import RadialGradient from '../components/Svg/RadialGradient.svelte';
	import Stop from '../components/Svg/Stop.svelte';
	import Rect from '../components/Svg/Rect.svelte';
	import Circle from '../components/Svg/Circle.svelte';
</script>

<Document>
	<Page>
		<View style={{ flexDirection: 'column' }}>
			<Svg width={300} height={200}>
				<Defs>
					<LinearGradient id="grad1" x1={0} y1={0} x2={200} y2={0}>
						<Stop offset={0} stopColor="red" />
						<Stop offset={1} stopColor="blue" />
					</LinearGradient>
					<RadialGradient id="grad2" cx={150} cy={150} r={50}>
						<Stop offset={0} stopColor="yellow" />
						<Stop offset={1} stopColor="green" />
					</RadialGradient>
				</Defs>
				<Rect x={10} y={10} width={200} height={80} fill="url(#grad1)" />
				<Circle cx={150} cy={150} r={50} fill="url(#grad2)" />
			</Svg>
		</View>
	</Page>
</Document>
