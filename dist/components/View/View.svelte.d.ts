import type { Snippet } from 'svelte';
import type { StyleProps } from '../../types/pdf.js';
type $$ComponentProps = {
    style?: StyleProps;
    wrap?: boolean;
    fixed?: boolean;
    breakBefore?: boolean;
    breakAfter?: boolean;
    /** Keep this view on the same page as the start of its next sibling. */
    keepWithNext?: boolean;
    /** Adds a navigable document-outline entry (bookmark) pointing to this view's page. */
    bookmark?: string;
    children?: Snippet;
};
declare const View: import("svelte").Component<$$ComponentProps, {}, "">;
type View = ReturnType<typeof View>;
export default View;
