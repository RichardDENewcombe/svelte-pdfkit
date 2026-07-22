import type { Snippet } from 'svelte';
import type { StyleProps } from '../../types/pdf.js';
type $$ComponentProps = {
    width: number;
    height: number;
    /** "min-x min-y width height" — scales the SVG coordinate space to fit width×height. */
    viewBox?: string;
    style?: Omit<StyleProps, 'width' | 'height'>;
    children?: Snippet;
};
declare const Svg: import("svelte").Component<$$ComponentProps, {}, "">;
type Svg = ReturnType<typeof Svg>;
export default Svg;
