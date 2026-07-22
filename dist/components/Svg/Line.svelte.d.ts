type $$ComponentProps = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    strokeDasharray?: number | string;
    strokeDashoffset?: number;
    clipPath?: string;
};
declare const Line: import("svelte").Component<$$ComponentProps, {}, "">;
type Line = ReturnType<typeof Line>;
export default Line;
