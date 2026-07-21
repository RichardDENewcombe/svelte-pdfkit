import type { Snippet } from 'svelte';
import type { StyleProps } from '../../types/pdf.js';
type $$ComponentProps = {
    style?: Omit<StyleProps, 'flexDirection'>;
    children?: Snippet;
};
declare const Table: import("svelte").Component<$$ComponentProps, {}, "">;
type Table = ReturnType<typeof Table>;
export default Table;
