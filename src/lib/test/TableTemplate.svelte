<!--
	Test fixture: a three-column table with a header row and two data rows.

	Expected tree (simplified):
	  doc
	  └─ page
	     └─ view (padding)
	        └─ table (view, column)
	           ├─ row (view, row) [header]
	           │  ├─ cell (view)  "Name"
	           │  ├─ cell (view)  "Qty"
	           │  └─ cell (view)  "Price"
	           ├─ row (view, row)
	           │  ├─ cell (view)  "Widget"
	           │  ├─ cell (view)  "3"
	           │  └─ cell (view)  "$9.00"
	           └─ row (view, row)
	              ├─ cell (view)  "Gadget"
	              ├─ cell (view)  "1"
	              └─ cell (view)  "$15.00"
-->
<script lang="ts">
	import Page from '../components/Page/Page.svelte';
	import View from '../components/View/View.svelte';
	import Text from '../components/Text/Text.svelte';
	import Table from '../components/Table/Table.svelte';
	import Row from '../components/Table/Row.svelte';
	import Cell from '../components/Table/Cell.svelte';
</script>

<Page size="A4">
	<View style={{ padding: 20 }}>
		<Table>
			<Row style={{ backgroundColor: '#eeeeee' }}>
				<Cell style={{ padding: 4, borderWidth: 1, borderColor: '#cccccc' }}>
					<Text text="Name" style={{ fontWeight: 'bold' }} />
				</Cell>
				<Cell style={{ padding: 4, borderWidth: 1, borderColor: '#cccccc' }}>
					<Text text="Qty" style={{ fontWeight: 'bold' }} />
				</Cell>
				<Cell style={{ padding: 4, borderWidth: 1, borderColor: '#cccccc' }}>
					<Text text="Price" style={{ fontWeight: 'bold' }} />
				</Cell>
			</Row>
			<Row>
				<Cell style={{ padding: 4, borderWidth: 1, borderColor: '#cccccc' }}>
					<Text text="Widget" />
				</Cell>
				<Cell style={{ padding: 4, borderWidth: 1, borderColor: '#cccccc' }}>
					<Text text="3" />
				</Cell>
				<Cell style={{ padding: 4, borderWidth: 1, borderColor: '#cccccc' }}>
					<Text text="$9.00" />
				</Cell>
			</Row>
			<Row>
				<Cell style={{ padding: 4, borderWidth: 1, borderColor: '#cccccc' }}>
					<Text text="Gadget" />
				</Cell>
				<Cell style={{ padding: 4, borderWidth: 1, borderColor: '#cccccc' }}>
					<Text text="1" />
				</Cell>
				<Cell style={{ padding: 4, borderWidth: 1, borderColor: '#cccccc' }}>
					<Text text="$15.00" />
				</Cell>
			</Row>
		</Table>
	</View>
</Page>
