// WebFetch's addresses (fetchable.js): a WebFetch never reaches a numeric address, a local name, or a name that answers with an
// address that is not global unicast, with or without its `www.` (design 2026-10-26, section 1, "Network", and section 10). The
// look-up is always a stand-in here: no test asks this Mac's resolver.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LOCAL_ADDRESS, UNCHECKED_ADDRESS, isGlobalUnicast, fetchWhy } from "../fetchable.js";

/** A look-up that must not be asked: it fails, which would be UNCHECKED_ADDRESS, not the LOCAL_ADDRESS a test wants. */
const never = async (host) => {
  throw new Error(`${host} was looked up`);
};
/** A look-up from a table: a name in it answers its addresses, any other is not found. */
const resolver = (table) => async (host) => {
  if (Object.hasOwn(table, host)) return table[host];
  throw Object.assign(new Error(`${host} not found`), { code: "ENOTFOUND" });
};

describe("6to4 and Teredo addresses (whole-branch review M5)", () => {
  // 6to4 (2002::/16) holds an IPv4 address in its bits 16 to 47, Teredo (2001::/32) its server's in bits 32 to 63 and its client's,
  // each bit flipped, in the last 32: they are judged by the IPv4 inside, as ::ffff: and NAT64 are.
  const SIX_TO_FOUR = { local: ["2002:7f00:1::", "2002:0a00:1::1", "2002:c0a8:101::1", "2002:a9fe:a9fe::", "2002:6440:1::", "2002:0:0::1"], global: ["2002:808:808::", "2002:5db8:d70e::1"] };
  const TEREDO = { local: ["2001:0:4136:e378:8000:63bf:80ff:fffe", "2001:0:a00:1:8000:63bf:f7f7:f7f7", "2001:0:7f00:1:8000:63bf:f7f7:f7f7", "2001:0:4136:e378:8000:63bf:3fff:fdd2"], global: ["2001:0:4136:e378:8000:63bf:f7f7:f7f7"] };
  it("judges 6to4 and Teredo addresses by the IPv4 inside them", () => {
    for (const a of [...SIX_TO_FOUR.global, ...TEREDO.global]) assert.equal(isGlobalUnicast(a), true, a);
    for (const a of [...SIX_TO_FOUR.local, ...TEREDO.local]) assert.equal(isGlobalUnicast(a), false, a);
  });
  it("refuses a name that answers with one that has a private IPv4 inside, and goes on for one that has a public one", async () => {
    for (const answer of [...SIX_TO_FOUR.local, ...TEREDO.local]) assert.equal(await fetchWhy("https://bad.example.com/", resolver({ "bad.example.com": [answer] })), LOCAL_ADDRESS, answer);
    for (const answer of [...SIX_TO_FOUR.global, ...TEREDO.global]) assert.equal(await fetchWhy("https://good.example.com/", resolver({ "good.example.com": [answer] })), "", answer);
  });
});
describe("WebFetch's addresses", () => {
  it("refuses every numeric or local address, in every spelling", async () => {
    for (const url of ["http://127.0.0.1/", "http://2130706433/", "http://0x7f.1/", "http://017700000001/", "http://[::1]/", "http://[::ffff:127.0.0.1]/", "http://192.168.1.1/", "http://169.254.169.254/", "http://100.64.0.1/", "http://localhost/", "http://printer.local/", "http://router/"]) assert.equal(await fetchWhy(url, never), LOCAL_ADDRESS, url);
  });
  it("refuses a name that answers with an address that is not global unicast", async () => {
    for (const answer of ["10.0.0.5", "0.0.0.0", "::", "::ffff:127.0.0.1", "64:ff9b::7f00:1"]) assert.equal(await fetchWhy("https://bad.example.com/", resolver({ "bad.example.com": [answer] })), LOCAL_ADDRESS, answer);
  });
  it("refuses a name whose www. form answers privately, and the same the other way round", async () => {
    assert.equal(await fetchWhy("https://example.com/", resolver({ "example.com": ["93.184.215.14"], "www.example.com": ["10.0.0.5"] })), LOCAL_ADDRESS);
    assert.equal(await fetchWhy("https://www.example.com/", resolver({ "www.example.com": ["93.184.215.14"], "example.com": ["10.0.0.5"] })), LOCAL_ADDRESS);
  });
  it("allows a public name", async () => {
    assert.equal(await fetchWhy("https://example.com/a", resolver({ "example.com": ["93.184.215.14"], "www.example.com": ["93.184.215.14"] })), "");
  });
  it("refuses what cannot be parsed or looked up", async () => {
    for (const url of ["not a url", "", "example.com/a", undefined]) assert.equal(await fetchWhy(url, never), UNCHECKED_ADDRESS, String(url));
    assert.equal(await fetchWhy("https://nowhere.example.com/", resolver({})), UNCHECKED_ADDRESS);
    assert.equal(await fetchWhy("https://empty.example.com/", resolver({ "empty.example.com": [] })), UNCHECKED_ADDRESS);
  });
  it("takes a www. form that is not found as no answer, not a refusal", async () => {
    assert.equal(await fetchWhy("https://example.com/", resolver({ "example.com": ["93.184.215.14", "2606:2800:21f:cb07:6820:80da:af6b:8b2c"] })), "");
    assert.equal(await fetchWhy("https://www.example.com/", resolver({ "www.example.com": ["93.184.215.14"] })), "");
  });
  it("refuses a name whose www. form cannot be looked up for any reason but that there is no such name", async () => {
    const failing = (code) => async (host) => {
      if (host === "example.com") return ["93.184.215.14"];
      throw Object.assign(new Error(host), { code });
    };
    for (const code of ["EAI_AGAIN", "ESERVFAIL", "ETIMEOUT", undefined]) assert.equal(await fetchWhy("https://example.com/", failing(code)), UNCHECKED_ADDRESS, String(code));
    for (const code of ["ENOTFOUND", "ENODATA"]) assert.equal(await fetchWhy("https://example.com/", failing(code)), "", code);
  });
  it("refuses a name with one address among many that is not global unicast", async () => {
    assert.equal(await fetchWhy("https://example.com/", resolver({ "example.com": ["93.184.215.14", "fd00::1"] })), LOCAL_ADDRESS);
  });
  it("refuses any numeric address, a public one too, and the local names with a trailing dot or in capitals", async () => {
    for (const url of ["http://93.184.215.14/", "http://[2606:2800:21f:cb07:6820:80da:af6b:8b2c]/", "http://LOCALHOST./", "http://Printer.Local./", "http://router./", "http://localhost../", "http://router../", "http://printer.local../", "http://box.internal/", "http://nas.home.arpa/", "http://x.localhost/", "file:///etc/hosts"]) assert.equal(await fetchWhy(url, never), LOCAL_ADDRESS, url);
  });
  it("knows a global unicast address from every other kind", () => {
    for (const a of ["93.184.215.14", "8.8.8.8", "1.1.1.1", "2606:2800:21f:cb07:6820:80da:af6b:8b2c", "2a00:1450:4009:81f::200e", "::ffff:8.8.8.8", "64:ff9b::808:808"]) assert.equal(isGlobalUnicast(a), true, a);
    for (const a of ["0.1.2.3", "10.1.1.1", "100.64.0.1", "100.127.255.255", "127.0.0.1", "169.254.1.1", "172.16.0.1", "172.31.255.255", "192.0.0.8", "192.0.2.1", "192.168.0.1", "198.18.0.1", "198.19.255.255", "198.51.100.7", "203.0.113.9", "224.0.0.1", "239.1.1.1", "240.0.0.1", "255.255.255.255", "::", "::1", "fc00::1", "fd12:3456::1", "fe80::1", "fe80::1%en0", "ff02::1", "2001:db8::1", "::ffff:10.0.0.1", "::ffff:7f00:1", "64:ff9b::a00:1", "::127.0.0.1", "4000::1", "not an address", "", "[::1]"]) assert.equal(isGlobalUnicast(a), false, a);
    for (const a of ["100.63.255.255", "100.128.0.0", "172.15.255.255", "172.32.0.0", "198.17.255.255", "198.20.0.0", "223.255.255.255"]) assert.equal(isGlobalUnicast(a), true, a);
  });
});
