type $$ComponentProps = {
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    strokeDasharray?: number | string;
    strokeDashoffset?: number;
    clipPath?: string;
};
declare const Ellipse: import("svelte").Component<$$ComponentProps, {}, "">;
type Ellipse = ReturnType<typeof Ellipse>;
export default Ellipse;
