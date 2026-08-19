import type { Snippet } from 'svelte';
import type { StyleProps, PageNumberRenderer } from '../../types/pdf.js';
type $$ComponentProps = {
    /** Explicit text string. Use either this, children, or render — not multiple. */
    text?: string;
    style?: StyleProps;
    children?: Snippet;
    /**
     * Dynamic render prop for page-number text.
     *
     * Called at draw time with the current page context. Use this for
     * headers/footers that must show page numbers or total page counts:
     *
     * @example
     *   <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
     */
    render?: PageNumberRenderer;
    breakBefore?: boolean;
    breakAfter?: boolean;
    /** Keep this text on the same page as the start of its next sibling. */
    keepWithNext?: boolean;
    /** Adds a navigable document-outline entry (bookmark) pointing to this text's page. */
    bookmark?: string;
    /** Registers this node's resolved page number under `key`, retrievable via `pageOf(key)` in a Text `render` prop. */
    anchor?: string;
};
declare const Text: import("svelte").Component<$$ComponentProps, {}, "">;
type Text = ReturnType<typeof Text>;
export default Text;
