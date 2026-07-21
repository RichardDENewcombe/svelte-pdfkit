type $$ComponentProps = {
    /** The font family name used in style={{ fontFamily: '...' }}. */
    name: string;
    /** Absolute or relative path to the font file (.ttf, .otf, .woff). */
    src: string;
    /** Font weight variant: 'normal' | 'bold'. Default: 'normal'. */
    weight?: string;
    /** Font style variant: 'normal' | 'italic'. Default: 'normal'. */
    style?: string;
};
declare const Font: import("svelte").Component<$$ComponentProps, {}, "">;
type Font = ReturnType<typeof Font>;
export default Font;
