/**
 * Anchor-based page-number lookup, for Table of Contents support.
 *
 * A node opts in with an `anchor` prop (a string key). After pagination —
 * once every page is known, including pages from conditional sections — we
 * walk the full pages[] array and build a `Map<anchorKey, {pageNumber,
 * totalPages}>` recording the FIRST page each anchor appears on. That map is
 * threaded into the draw phase as a `pageOf(key)` function, exposed on the
 * Text `render` prop, so content drawn on an earlier page (a ToC) can
 * resolve the eventual page number of content drawn later.
 *
 * This mirrors bookmarks.ts's identity-stamping technique (a node spanning a
 * page break becomes several PDFNode copies, one per page, so a stable id
 * must be stamped before pagination for them to share identity) but differs
 * from it in when the lookup is built: emitBookmarks runs lazily inside the
 * draw loop (bookmarks only ever need same-or-earlier-page info), while
 * buildAnchorIndex runs eagerly, once, before any page is drawn — required
 * for the forward-reference case a ToC needs.
 */
import { warn } from '../runtime/warn.js';
/** True when a node carries a usable (non-empty string) anchor key. */
function anchorKeyOf(node) {
    const key = node.props.anchor;
    return typeof key === 'string' && key.length > 0 ? key : null;
}
/**
 * Stamps a stable, document-ordered id onto every anchored node BEFORE
 * pagination, so the copies pagination makes share one identity for dedup.
 *
 * Must run on the original document tree (pre-pagination) — running it after
 * pagination would give each page's copy a different id and defeat dedup.
 */
export function assignAnchorIds(root) {
    let seq = 0;
    const walk = (n) => {
        if (anchorKeyOf(n) !== null && n.props.__anchorId == null) {
            n.props.__anchorId = seq++;
        }
        for (const c of n.children)
            walk(c);
    };
    walk(root);
}
/**
 * Walks the paginated pages[] array once and records the first page each
 * anchor key appears on. `__anchorId` distinguishes a node's own repeated
 * page-copy (spanning / fixed — dedup silently) from a genuine collision:
 * two different nodes reusing the same anchor string, which would silently
 * produce a wrong page number, so it's surfaced with a warning.
 */
export function buildAnchorIndex(pages) {
    const index = new Map();
    const seenIds = new Set();
    const totalPages = pages.length;
    const walk = (nodes, pageNumber) => {
        for (const node of nodes) {
            const key = anchorKeyOf(node);
            if (key !== null) {
                const id = node.props.__anchorId;
                const isPageCopyOfSeenNode = id != null && seenIds.has(id);
                if (!isPageCopyOfSeenNode) {
                    if (id != null)
                        seenIds.add(id);
                    if (index.has(key)) {
                        warn(`Duplicate anchor "${key}" — pageOf('${key}') resolves to the first page it appears on (page ${index.get(key).pageNumber}).`);
                    }
                    else {
                        index.set(key, { pageNumber, totalPages });
                    }
                }
            }
            if (node.children.length > 0)
                walk(node.children, pageNumber);
        }
    };
    for (let i = 0; i < pages.length; i++)
        walk(pages[i].children, i + 1);
    return index;
}
