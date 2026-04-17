<script lang="ts">
	import Document from '../components/Document/Document.svelte';
	import Page from '../components/Page/Page.svelte';
	import View from '../components/View/View.svelte';
	import Svg from '../components/Svg/Svg.svelte';
	import Defs from '../components/Svg/Defs.svelte';
	import ClipPath from '../components/Svg/ClipPath.svelte';
	import Rect from '../components/Svg/Rect.svelte';
	import Circle from '../components/Svg/Circle.svelte';
</script>

<Document>
	<Page>
		<View style={{ flexDirection: 'column' }}>
			<Svg width={300} height={200}>
				<Defs>
					<ClipPath id="clip1">
						<Rect x={50} y={50} width={100} height={100} />
					</ClipPath>
				</Defs>
				<Circle cx={100} cy={100} r={80} fill="blue" clipPath="url(#clip1)" />
			</Svg>
		</View>
	</Page>
</Document>
