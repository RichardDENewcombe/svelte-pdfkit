import type { Snippet } from 'svelte';
import type { StyleProps } from '../../types/pdf.js';
type $$ComponentProps = {
    width: number;
    height: number;
    style?: Omit<StyleProps, 'width' | 'height'>;
    children?: Snippet;
};
declare const Svg: import("svelte").Component<$$ComponentProps, {}, "">;
type Svg = ReturnType<typeof Svg>;
export default Svg;
