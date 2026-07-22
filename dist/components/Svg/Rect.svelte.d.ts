type $$ComponentProps = {
    x?: number;
    y?: number;
    width: number;
    height: number;
    rx?: number;
    ry?: number;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    strokeDasharray?: number | string;
    strokeDashoffset?: number;
    clipPath?: string;
};
declare const Rect: import("svelte").Component<$$ComponentProps, {}, "">;
type Rect = ReturnType<typeof Rect>;
export default Rect;
