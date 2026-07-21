/** A function that splits a word into its hyphenation parts (joined === word). */
export type HyphenationCallback = (word: string) => string[];
/**
 * Sets the language used when a node enables hyphenation without naming one.
 * Accepts any key that has a bundled dictionary (`en-gb`, `en-us`) — other
 * languages should be supplied through {@link registerHyphenationCallback}.
 */
export declare function setDefaultHyphenationLang(lang: string): void;
/**
 * Registers a custom hyphenation function, overriding the bundled dictionaries
 * entirely (the `lang` style prop is then ignored). Use this to support any
 * language — e.g. wrap your own `hypher` instance:
 *
 * ```ts
 * import Hypher from 'hypher';
 * import de from 'hyphenation.de';
 * const h = new Hypher(de);
 * registerHyphenationCallback((word) => h.hyphenate(word));
 * ```
 *
 * Pass `null` to clear and fall back to the bundled dictionaries.
 */
export declare function registerHyphenationCallback(fn: HyphenationCallback | null): void;
/**
 * Splits `word` into the parts between which a hyphen may be inserted. The
 * returned parts always join back to the original `word`. A word that should not
 * (or cannot) be broken returns `[word]`.
 *
 * @param lang Language key for a bundled dictionary; ignored when a custom
 *   callback is registered. Defaults to the value set via
 *   {@link setDefaultHyphenationLang}.
 */
export declare function hyphenateWord(word: string, lang?: string): string[];
