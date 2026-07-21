import type { Snippet } from 'svelte';
type $$ComponentProps = {
    id: string;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    gradientUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
    children?: Snippet;
};
declare const LinearGradient: import("svelte").Component<$$ComponentProps, {}, "">;
type LinearGradient = ReturnType<typeof LinearGradient>;
export default LinearGradient;
