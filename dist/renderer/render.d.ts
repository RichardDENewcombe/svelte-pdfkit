import type { PDFNode, PDFMetadata, ResourceEntry } from '../types/pdf.js';
/**
 * Renders a list of page nodes to a PDFKit stream.
 *
 * @param pages     - Array of page PDFNodes from paginate().
 * @param resources - The full resource list from the DocumentContext.
 *                    Used to register custom fonts on the PDFKit document
 *                    before drawing begins. If omitted, only built-in PDFKit
 *                    fonts (Helvetica, Courier, Times) are available.
 * @returns A Node.js Readable stream (PDFDocument extends stream.PassThrough).
 */
export declare function renderPDF(pages: PDFNode[], resources?: ResourceEntry[], metadata?: PDFMetadata): any;
