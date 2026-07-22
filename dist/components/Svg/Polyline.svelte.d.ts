type $$ComponentProps = {
    points: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    strokeDasharray?: number | string;
    strokeDashoffset?: number;
    clipPath?: string;
};
declare const Polyline: import("svelte").Component<$$ComponentProps, {}, "">;
type Polyline = ReturnType<typeof Polyline>;
export default Polyline;
