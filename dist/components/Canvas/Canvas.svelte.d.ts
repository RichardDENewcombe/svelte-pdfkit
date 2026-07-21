import type { StyleProps } from '../../types/pdf.js';
type $$ComponentProps = {
    /** Layout dimensions for the canvas area. width and height are required
     *  for Yoga to allocate space — without them the canvas has zero size. */
    style?: StyleProps;
    /** Called during rendering with the PDFKit doc and computed layout box.
     *  @param doc    - The PDFKit document instance.
     *  @param x      - Left edge of the canvas in absolute page coordinates.
     *  @param y      - Top edge of the canvas in absolute page coordinates.
     *  @param width  - Width of the canvas as computed by Yoga.
     *  @param height - Height of the canvas as computed by Yoga.
     */
    draw: (doc: any, x: number, y: number, width: number, height: number) => void;
};
declare const Canvas: import("svelte").Component<$$ComponentProps, {}, "">;
type Canvas = ReturnType<typeof Canvas>;
export default Canvas;
