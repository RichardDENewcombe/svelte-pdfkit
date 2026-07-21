import type { Snippet } from 'svelte';
type $$ComponentProps = {
    id: string;
    cx?: number;
    cy?: number;
    r?: number;
    fx?: number;
    fy?: number;
    gradientUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
    children?: Snippet;
};
declare const RadialGradient: import("svelte").Component<$$ComponentProps, {}, "">;
type RadialGradient = ReturnType<typeof RadialGradient>;
export default RadialGradient;
