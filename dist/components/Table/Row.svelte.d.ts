import type { Snippet } from 'svelte';
import type { StyleProps } from '../../types/pdf.js';
type $$ComponentProps = {
    style?: Omit<StyleProps, 'flexDirection'>;
    children?: Snippet;
};
declare const Row: import("svelte").Component<$$ComponentProps, {}, "">;
type Row = ReturnType<typeof Row>;
export default Row;
