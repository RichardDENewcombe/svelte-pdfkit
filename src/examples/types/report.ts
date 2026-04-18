export interface StatItem {
	label: string;
	value: number;
	displayValue: string;
	color?: string;
}

export interface DataRow {
	cells: string[];
}

export interface ReportSection {
	title: string;
	body: string;
	stats?: StatItem[];
	table?: {
		headers: string[];
		rows: DataRow[];
	};
}

export interface TocEntry {
	title: string;
	pageLabel: string;
}

export interface ReportProps {
	title: string;
	subtitle?: string;
	author: string;
	date: string;
	organization?: string;
	tableOfContents: TocEntry[];
	sections: ReportSection[];
}
