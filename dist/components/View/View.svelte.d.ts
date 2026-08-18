import type { Snippet } from 'svelte';
import type { StyleProps } from '../../types/pdf.js';
type $$ComponentProps = {
    style?: StyleProps;
    /**
     * Controls whether this view may be split across a page boundary.
     *  - `true` (default): the view may be split normally.
     *  - `false`: never split — moves whole to the next page if it doesn't fit.
     *  - a fraction `0`–`1`: also moves the view whole to the next page if its
     *    top falls in (or it extends into) the bottom `fraction` of the page —
     *    even if it would otherwise have fit without being cut.
     */
    wrap?: boolean | number;
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
