import type { StyleProps } from '../../types/pdf.js';
type $$ComponentProps = {
    src: string;
    style?: StyleProps;
    breakBefore?: boolean;
    breakAfter?: boolean;
    /** Keep this image on the same page as the start of its next sibling. */
    keepWithNext?: boolean;
    /** Adds a navigable document-outline entry (bookmark) pointing to this image's page. */
    bookmark?: string;
    /** Registers this node's resolved page number under `key`, retrievable via `pageOf(key)` in a Text `render` prop. */
    anchor?: string;
};
declare const Image: import("svelte").Component<$$ComponentProps, {}, "">;
type Image = ReturnType<typeof Image>;
export default Image;
