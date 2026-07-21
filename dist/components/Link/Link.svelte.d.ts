import type { Snippet } from 'svelte';
import type { StyleProps } from '../../types/pdf.js';
type $$ComponentProps = {
    /** The URL the link points to. */
    href: string;
    /** Optional layout/style props — same as View. */
    style?: StyleProps;
    /** Adds a navigable document-outline entry (bookmark) pointing to this link's page. */
    bookmark?: string;
    children?: Snippet;
};
declare const Link: import("svelte").Component<$$ComponentProps, {}, "">;
type Link = ReturnType<typeof Link>;
export default Link;
