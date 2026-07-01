/**
 * PDF document outline (bookmarks) support.
 *
 * A node opts into the outline with a `bookmark` prop (a string title). We emit
 * a navigable outline via PDFKit's `doc.outline.addItem(title, { expanded })`.
 *
 * ─── Two subtleties this module handles ──────────────────────────────────────
 *
 * 1. **Destination is page-level.** In PDFKit, `addItem` always targets the
 *    *current* page (`doc.page`) at 'Fit' — there is no y-precise destination.
 *    So an item must be created while its target page is the current page, and
 *    the caller (renderPDF) invokes emitBookmarks inside its per-page loop.
 *
 * 2. **A node can appear on several pages.** Pagination copies a node that
 *    straddles a page boundary onto each page it touches, and repeats `fixed`
 *    nodes on every page. We must add each bookmark exactly once — on the first
 *    (earliest) page it appears. assignBookmarkIds stamps a stable id on every
 *    bookmarked node *before* pagination so the copies share one identity, and
 *    emitBookmarks dedups on that id.
 *
 * Nesting is derived from the component tree: a bookmarked node nested inside
 * another bookmarked node becomes its child in the outline.
 */

import type { PDFNode } from '../types/pdf.js';

/** True when a node carries a usable (non-empty string) bookmark title. */
function bookmarkTitle(node: PDFNode): string | null {
	const title = node.props.bookmark;
	return typeof title === 'string' && title.length > 0 ? title : null;
}

/**
 * Stamps a stable, document-ordered id onto every bookmarked node BEFORE
 * pagination, so the copies pagination makes share one identity for dedup.
 *
 * Must run on the original document tree (pre-pagination) — running it after
 * pagination would give each page's copy a different id and defeat dedup.
 */
export function assignBookmarkIds(root: PDFNode): void {
	let seq = 0;
	const walk = (n: PDFNode) => {
		if (bookmarkTitle(n) !== null && n.props.__bookmarkId == null) {
			n.props.__bookmarkId = seq++;
		}
		for (const c of n.children) walk(c);
	};
	walk(root);
}

/**
 * Walks one page's node tree (in document order) and adds outline items.
 *
 * `parentItem` starts at doc.outline; each bookmarked node nests its own
 * children under its item, producing a hierarchical outline that mirrors the
 * component tree. `itemById` dedups across pages: a node already seen on an
 * earlier page (spanning / fixed) is not re-added, but its remembered item is
 * still used as the parent for any descendants that first appear on this page.
 *
 * Because ancestors are always visited before their descendants, a child's
 * parent item always exists by the time the child is emitted.
 */
export function emitBookmarks(
	doc: any,
	nodes: PDFNode[],
	itemById: Map<number, any>,
	parentItem: any = doc.outline
): void {
	for (const node of nodes) {
		let childParent = parentItem;

		const title = bookmarkTitle(node);
		if (title !== null) {
			const id = node.props.__bookmarkId as number | undefined;
			let item = id != null ? itemById.get(id) : undefined;
			if (!item) {
				item = parentItem.addItem(title, { expanded: true });
				if (id != null) itemById.set(id, item);
			}
			childParent = item;
		}

		if (node.children.length > 0) {
			emitBookmarks(doc, node.children, itemById, childParent);
		}
	}
}
