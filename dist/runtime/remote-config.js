// Configuration and safety policy for loading *remote* (http/https) font and
// image resources. Loading a URL on the server is an SSRF vector and an
// unbounded-work vector, so remote fetches are bounded in time and size and, by
// default, blocked from reaching private/internal address ranges.
//
// This mirrors the module-level-config pattern used by `layout/hyphenation.ts`
// (`registerHyphenationCallback` / `setDefaultHyphenationLang`): a process-wide
// settings object with a single setter. There is no per-request config because
// the resource loader is a process-wide singleton (it also owns the caches).
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
const config = {
    timeoutMs: 10_000,
    maxBytes: 10 * 1024 * 1024,
    allowPrivateHosts: false,
    allowHost: undefined,
    cacheMax: 256
};
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
export function configureRemoteResources(opts) {
    Object.assign(config, opts);
}
/** Returns the current remote-resource config (read-only snapshot semantics). */
export function getRemoteConfig() {
    return config;
}
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
export async function assertPublicUrl(rawUrl) {
    let url;
    try {
        url = new URL(rawUrl);
    }
    catch {
        throw new Error(`invalid URL: ${rawUrl}`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error(`unsupported protocol "${url.protocol}" (only http/https)`);
    }
    // Strip IPv6 brackets: new URL('http://[::1]/').hostname === '[::1]' → '::1'.
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    if (config.allowPrivateHosts || config.allowHost?.(hostname))
        return;
    // IP literal → check directly, no DNS. Otherwise resolve and check every
    // address the name maps to.
    const literal = isIP(hostname);
    if (literal !== 0) {
        if (isBlockedAddress(hostname)) {
            throw new Error(`blocked private/loopback address: ${hostname}`);
        }
        return;
    }
    let addresses;
    try {
        addresses = await lookup(hostname, { all: true });
    }
    catch {
        throw new Error(`DNS lookup failed for host: ${hostname}`);
    }
    for (const { address } of addresses) {
        if (isBlockedAddress(address)) {
            throw new Error(`host ${hostname} resolves to blocked address ${address}`);
        }
    }
}
/**
 * True when `address` (an IPv4 or IPv6 literal) is in a range that must not be
 * reachable via remote resource loading: loopback, private, link-local
 * (incl. the 169.254.169.254 cloud-metadata endpoint), or unspecified.
 */
export function isBlockedAddress(address) {
    // IPv4-mapped IPv6 (::ffff:a.b.c.d) — check the embedded v4 address.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (mapped)
        return isBlockedV4(mapped[1]);
    if (isIP(address) === 4)
        return isBlockedV4(address);
    return isBlockedV6(address);
}
function isBlockedV4(address) {
    const parts = address.split('.').map((n) => Number(n));
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
        return true; // Unparseable → treat as unsafe.
    }
    const [a, b] = parts;
    return (a === 0 || // 0.0.0.0/8 "this host"
        a === 10 || // 10.0.0.0/8 private
        a === 127 || // 127.0.0.0/8 loopback
        (a === 169 && b === 254) || // 169.254.0.0/16 link-local + metadata
        (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 private
        (a === 192 && b === 168) // 192.168.0.0/16 private
    );
}
function isBlockedV6(address) {
    const addr = address.toLowerCase();
    if (addr === '::' || addr === '::1')
        return true; // unspecified, loopback
    if (addr.startsWith('fe80'))
        return true; // fe80::/10 link-local
    // fc00::/7 unique-local (fc00–fdff).
    if (addr.startsWith('fc') || addr.startsWith('fd'))
        return true;
    return false;
}
