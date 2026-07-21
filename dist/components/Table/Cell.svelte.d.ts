import type { Snippet } from 'svelte';
import type { StyleProps } from '../../types/pdf.js';
type $$ComponentProps = {
    /**
     * Accepts all layout and visual style props.
     *
     * By default a Cell grows to fill its row equally (flexGrow: 1).
     * Override with an explicit `width` to create fixed-width columns,
     * or set `flexGrow` to a different value for proportional widths.
     *
     * @example Equal columns (default):
     *   <Cell>…</Cell>  — all cells in a row share width equally
     *
     * @example Fixed width:
     *   <Cell style={{ width: 120 }}>…</Cell>
     *
     * @example 2:1 ratio:
     *   <Cell style={{ flexGrow: 2 }}>…</Cell>
     *   <Cell style={{ flexGrow: 1 }}>…</Cell>
     */
    style?: StyleProps;
    children?: Snippet;
};
declare const Cell: import("svelte").Component<$$ComponentProps, {}, "">;
type Cell = ReturnType<typeof Cell>;
export default Cell;
