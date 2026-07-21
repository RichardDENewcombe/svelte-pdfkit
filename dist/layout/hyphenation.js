// Hyphenation engine. Splits a word into the points where a soft break is
// allowed, so the line-wrapper in `text-measure.ts` can break long words across
// lines with a trailing hyphen instead of leaving ragged gaps (most visible in
// justified text).
//
// Patterns are language-specific Knuth-Liang TeX dictionaries. British and
// American English genuinely hyphenate differently (e.g. `know-ledge` vs
// `knowl-edge`), so the language is selectable. `en-gb` and `en-us` ship bundled;
// any other language can be supplied via `registerHyphenationCallback`.
import { createRequire } from 'node:module';
// `hypher` and the `hyphenation.*` pattern packages are CommonJS; load them via
// createRequire so they work under ESM / Vite SSR, mirroring the pdfkit pattern
// used elsewhere in the codebase.
const _require = createRequire(import.meta.url);
// The bundled dictionaries we know how to lazy-load by language key.
const BUNDLED = {
    'en-gb': 'hyphenation.en-gb',
    'en-us': 'hyphenation.en-us'
};
// Cache of constructed Hypher instances, keyed by language.
const instances = new Map();
let defaultLang = 'en-gb';
let customCallback = null;
/**
 * Sets the language used when a node enables hyphenation without naming one.
 * Accepts any key that has a bundled dictionary (`en-gb`, `en-us`) — other
 * languages should be supplied through {@link registerHyphenationCallback}.
 */
export function setDefaultHyphenationLang(lang) {
    defaultLang = lang;
}
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
export function registerHyphenationCallback(fn) {
    customCallback = fn;
}
/** Lazily constructs (and caches) a Hypher instance for a bundled language. */
function getInstance(lang) {
    const cached = instances.get(lang);
    if (cached)
        return cached;
    const pkg = BUNDLED[lang];
    if (!pkg)
        return null;
    try {
        const Hypher = _require('hypher');
        const patterns = _require(pkg);
        const instance = new Hypher(patterns);
        instances.set(lang, instance);
        return instance;
    }
    catch {
        // Dictionary or hypher not installed — treat as "no hyphenation".
        return null;
    }
}
// Matches a token as: leading non-word chars, an alphabetic core, trailing
// non-word chars. Only the core is hyphenated; surrounding punctuation is
// re-attached to the first/last part so the parts still join to the original.
const TOKEN = /^(\W*)([A-Za-z][A-Za-z']*?)(\W*)$/;
// Words shorter than this are never broken — too small to gain anything and a
// guard against silly one/two-letter fragments slipping past pattern minimums.
const MIN_CORE_LENGTH = 5;
/**
 * Splits `word` into the parts between which a hyphen may be inserted. The
 * returned parts always join back to the original `word`. A word that should not
 * (or cannot) be broken returns `[word]`.
 *
 * @param lang Language key for a bundled dictionary; ignored when a custom
 *   callback is registered. Defaults to the value set via
 *   {@link setDefaultHyphenationLang}.
 */
export function hyphenateWord(word, lang = defaultLang) {
    if (customCallback) {
        const parts = customCallback(word);
        return parts && parts.length > 0 ? parts : [word];
    }
    const m = TOKEN.exec(word);
    if (!m)
        return [word];
    const [, lead, core, trail] = m;
    if (core.length < MIN_CORE_LENGTH)
        return [word];
    const instance = getInstance(lang);
    if (!instance)
        return [word];
    const parts = instance.hyphenate(core);
    if (parts.length < 2)
        return [word];
    // Re-attach surrounding punctuation to the outer parts.
    parts[0] = lead + parts[0];
    parts[parts.length - 1] = parts[parts.length - 1] + trail;
    return parts;
}
