import type { Snippet } from 'svelte';
import type { StyleProps } from '../../types/pdf.js';
type $$ComponentProps = {
    style?: StyleProps;
    size?: string;
    orientation?: 'portrait' | 'landscape';
    children?: Snippet;
};
declare const Page: import("svelte").Component<$$ComponentProps, {}, "">;
type Page = ReturnType<typeof Page>;
export default Page;
