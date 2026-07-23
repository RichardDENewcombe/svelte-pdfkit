import type { Snippet } from 'svelte';
type $$ComponentProps = {
    x?: number;
    y?: number;
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: 'normal' | 'bold';
    fill?: string;
    opacity?: number;
    textAnchor?: 'start' | 'middle' | 'end';
    dominantBaseline?: string;
    /** Clockwise rotation in degrees, applied about the (x, y) anchor. */
    rotate?: number;
    children?: Snippet;
};
declare const SvgText: import("svelte").Component<$$ComponentProps, {}, "">;
type SvgText = ReturnType<typeof SvgText>;
export default SvgText;
