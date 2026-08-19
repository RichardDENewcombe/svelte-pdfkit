import type { PDFNode, PDFMetadata, ResourceEntry } from '../types/pdf.js';
/**
 * Renders a list of page nodes to a PDFKit stream.
 *
 * @param pages     - Array of page PDFNodes from paginate().
 * @param resources - The full resource list from the DocumentContext.
 *                    Used to register custom fonts on the PDFKit document
 *                    before drawing begins. If omitted, only built-in PDFKit
 *                    fonts (Helvetica, Courier, Times) are available.
 * @param pageOf    - Looks up the page number a node with the given `anchor`
 *                    key resolved to, for the Text `render` prop. Built from
 *                    the full pages[] array before drawing starts, so it can
 *                    resolve pages that haven't been drawn yet.
 * @returns A Node.js Readable stream (PDFDocument extends stream.PassThrough).
 */
export declare function renderPDF(pages: PDFNode[], resources?: ResourceEntry[], metadata?: PDFMetadata, pageOf?: (anchorKey: string) => number | undefined): any;
