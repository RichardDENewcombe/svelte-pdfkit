export interface InvoiceItem {
	description: string;
	quantity: number;
	unitPrice: number;
	total: number;
}

export interface Address {
	name: string;
	company?: string;
	line1: string;
	line2?: string;
	country?: string;
}

export interface InvoiceCompany {
	name: string;
	tagline?: string;
	address: Address;
	email: string;
	phone?: string;
	website?: string;
}

export interface InvoiceProps {
	invoiceNumber: string;
	issueDate: string;
	dueDate: string;
	company: InvoiceCompany;
	billTo: Address;
	shipTo?: Address;
	items: InvoiceItem[];
	subtotal: number;
	taxRate?: number;
	tax?: number;
	total: number;
	notes?: string;
	currency?: string;
}
