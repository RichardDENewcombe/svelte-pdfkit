/** Tunable policy for remote resource loading. See {@link configureRemoteResources}. */
export interface RemoteResourceConfig {
    /** Abort a remote fetch after this many milliseconds. Default: 10000. */
    timeoutMs: number;
    /** Reject a remote response larger than this many bytes. Default: 10 MiB. */
    maxBytes: number;
    /**
     * Allow remote URLs that resolve to private / loopback / link-local ranges.
     * Default: false (SSRF guard on). Set true only when you trust every URL —
     * e.g. an internal font server on a private network.
     */
    allowPrivateHosts: boolean;
    /**
     * Per-host escape hatch, consulted before the private-range check. Return
     * true to allow a hostname the guard would otherwise block (e.g. a specific
     * internal host) without disabling the guard globally.
     */
    allowHost?: (hostname: string) => boolean;
    /**
     * Maximum number of entries kept in each of the font and image caches.
     * Oldest (least-recently-used) entries beyond this are evicted after a
     * render. Default: 256.
     */
    cacheMax: number;
}
/**
 * Overrides remote-resource loading policy for the whole process. Shallow-merges
 * the given fields over the current config; unspecified fields are unchanged.
 *
 * @example
 * // Tighter timeout, and permit an internal font host:
 * configureRemoteResources({
 *   timeoutMs: 3000,
 *   allowHost: (h) => h === 'fonts.internal.corp'
 * });
 */
export declare function configureRemoteResources(opts: Partial<RemoteResourceConfig>): void;
/** Returns the current remote-resource config (read-only snapshot semantics). */
export declare function getRemoteConfig(): Readonly<RemoteResourceConfig>;
/**
 * Throws if `rawUrl` is not a safe remote target to fetch on the server.
 *
 * Rejects non-http(s) protocols, and — unless the host is allow-listed — any URL
 * whose host resolves to a loopback, private, link-local, or cloud-metadata
 * address. Hostnames are resolved via DNS and *every* returned address is
 * checked, so a public hostname that maps to `127.0.0.1` is still blocked.
 *
 * Note: there is a residual DNS-rebinding TOCTOU gap — the address is checked
 * here, then fetched separately, so a host that changes its answer between the
 * two could slip through. Closing that fully requires pinning the connection to
 * the vetted IP, which is out of scope; this is the pragmatic bar.
 */
export declare function assertPublicUrl(rawUrl: string): Promise<void>;
/**
 * True when `address` (an IPv4 or IPv6 literal) is in a range that must not be
 * reachable via remote resource loading: loopback, private, link-local
 * (incl. the 169.254.169.254 cloud-metadata endpoint), or unspecified.
 */
export declare function isBlockedAddress(address: string): boolean;
