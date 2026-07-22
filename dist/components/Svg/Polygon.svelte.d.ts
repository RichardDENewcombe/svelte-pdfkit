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
declare const Polygon: import("svelte").Component<$$ComponentProps, {}, "">;
type Polygon = ReturnType<typeof Polygon>;
export default Polygon;
