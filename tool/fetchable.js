// WebFetch's addresses (design 2026-10-26, section 1, "Network"; C29, C39): WebFetch runs in Claude Code's own process, outside
// the sandbox and its deniedDomains, and reaches the Mac and the home network by number. So under the open lock the guard lets a
// WebFetch through only to a name that answers with global unicast addresses alone, with and without its `www.` (WebFetch follows
// a redirect between the two without asking again). Any numeric host is refused, in any spelling: the URL parser turns
// `2130706433`, `0x7f.1` and `017700000001` into 127.0.0.1 first. So is a local name: `localhost`, a name with no dot, and one
// under .local, .localhost, .internal or .home.arpa. An answer that is IPv4 inside IPv6 (`::ffff:…`, NAT64's `64:ff9b::…`) is
// judged by the IPv4 inside it. A redirect to another host comes back to the guard as a new address; a name whose answer changes
// between the look-up and the fetch is let through (section 11).
//
// The look-up is given (`resolve`, a host to its addresses), so that a test gives a stand-in and never asks this Mac's resolver.
import { isIP } from "node:net";

export const LOCAL_ADDRESS = "That address is on this Mac or its network, which this folder never fetches.";
export const UNCHECKED_ADDRESS = "That address could not be checked, so it is not fetched.";

/** The IPv4 blocks that are not global unicast, each as its first address and its length. */
const V4_NOT_GLOBAL = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24],
  ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

/** The local names' endings: a name that is one of them, or ends with one, is on this Mac or its network. */
const LOCAL_ENDINGS = ["local", "localhost", "internal", "home.arpa"];

const v4Number = (bytes) => bytes.reduce((n, b) => n * 256 + b, 0);
const V4_BLOCKS = V4_NOT_GLOBAL.map(([first, length]) => [v4Number(first.split(".").map(Number)), length]);

/** Whether four bytes of IPv4 are global unicast: in none of the blocks above. */
function v4Global(bytes) {
  const n = v4Number(bytes);
  return !V4_BLOCKS.some(([first, length]) => Math.floor(n / 2 ** (32 - length)) === Math.floor(first / 2 ** (32 - length)));
}

/** An IPv6 address as its eight 16-bit groups, or null. `text` is one isIP takes as 6, with no zone. */
function v6Groups(text) {
  let rest = text.toLowerCase();
  let tail = [];
  const dotted = rest.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const b = dotted[2].split(".").map(Number);
    tail = [b[0] * 256 + b[1], b[2] * 256 + b[3]];
    rest = dotted[1].endsWith("::") ? dotted[1] : dotted[1].slice(0, -1);
  }
  const halves = rest.split("::");
  const groups = (half) => (half === "" ? [] : half.split(":").map((g) => parseInt(g, 16)));
  const head = groups(halves[0]);
  const after = halves.length === 2 ? groups(halves[1]) : [];
  const zeros = halves.length === 2 ? Array(8 - head.length - after.length - tail.length).fill(0) : [];
  const all = [...head, ...zeros, ...after, ...tail];
  return all.length === 8 && all.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? all : null;
}

/** Whether `address`, an IPv4 or IPv6 address as a look-up gives it, is global unicast. IPv4 outside the blocks above; IPv6 in
    2000::/3 but not 2001:db8::/32, after an IPv4-mapped (`::ffff:…`) or NAT64 (`64:ff9b::/96`) address is judged by its IPv4.
    Anything else, a name or a bracketed address among them, is not. */
export function isGlobalUnicast(address) {
  if (typeof address !== "string") return false;
  const text = address.replace(/%[^%]*$/, "");
  const kind = isIP(text);
  if (kind === 4) return v4Global(text.split(".").map(Number));
  if (kind !== 6) return false;
  const g = v6Groups(text);
  if (!g) return false;
  const v4 = [g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255];
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return v4Global(v4);
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return v4Global(v4);
  return (g[0] & 0xe000) === 0x2000 && !(g[0] === 0x2001 && g[1] === 0x0db8);
}

/** The addresses a look-up gives `host`, or null when it fails or gives none. */
async function answers(host, resolve) {
  try {
    const got = await resolve(host);
    return Array.isArray(got) && got.length ? got : null;
  } catch {
    return null;
  }
}

/** Why a WebFetch of `url` is refused, or "" when it may be fetched. `resolve` looks a host up, giving its addresses. A URL that
    does not parse, or whose host cannot be looked up, is UNCHECKED_ADDRESS; a numeric host, a local name, or a name that, with or
    without its `www.`, answers with any address that is not global unicast, is LOCAL_ADDRESS. The `www.` form is asked too, and
    when it is not found it gives no answer, which is no refusal. */
export async function fetchWhy(url, resolve) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return UNCHECKED_ADDRESS;
  }
  if (host.startsWith("[") || isIP(host)) return LOCAL_ADDRESS;
  const name = host.endsWith(".") ? host.slice(0, -1) : host;
  if (!name.includes(".") || LOCAL_ENDINGS.some((end) => name === end || name.endsWith(`.${end}`))) return LOCAL_ADDRESS;
  const own = await answers(name, resolve);
  if (!own) return UNCHECKED_ADDRESS;
  const other = await answers(name.startsWith("www.") ? name.slice(4) : `www.${name}`, resolve);
  return [...own, ...(other || [])].every(isGlobalUnicast) ? "" : LOCAL_ADDRESS;
}
