import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import {
  UPDATE_TIMEOUT_MS,
  UPDATE_EVERY_MS,
  USER_AGENT,
  APPCAST_MAX_CHARS,
  updateCheckFile,
  parseAppcast,
  newestFor,
  systemVersion,
  checkForUpdate,
  updateLine,
} from "../update-check.js";

const BUILD = { mode: "installed", version: "1.4.2", build: 142, commit: "0123456789abcdef0123456789abcdef01234567", short: "0123456", feed: "https://updates.example.invalid/appcast.xml", channel: "stable", support: "", broken: false };
const item = ({ build, version, channel = "", min = "" }) => `<item><title>Version ${version}</title><sparkle:version>${build}</sparkle:version><sparkle:shortVersionString>${version}</sparkle:shortVersionString>${channel && `<sparkle:channel>${channel}</sparkle:channel>`}${min && `<sparkle:minimumSystemVersion>${min}</sparkle:minimumSystemVersion>`}<enclosure url="https://updates.example.invalid/s.zip" length="1" type="application/octet-stream" sparkle:edSignature="x"/></item>`;
const appcast = (...items) => `<?xml version="1.0" encoding="utf-8"?><rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle"><channel><title>BRIMM Video Studio</title>${items.map(item).join("")}</channel></rss>`;
/** A fetch stand-in: answers text as a 200, an Error by rejecting, or an object as the response; keeps its calls. */
const feed = (answer) => { const calls = []; return { calls, fetch: async (url, init) => { calls.push({ url, init }); const a = typeof answer === "function" ? await answer() : answer; if (a instanceof Error) throw a; return typeof a === "string" ? { ok: true, status: 200, text: async () => a } : a; } }; };
const NOW = Date.parse("2026-11-09T10:00:00-06:00");

const homes = [];
const homeDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "update-check-"));
  homes.push(dir);
  return dir;
};
after(() => {
  for (const dir of homes) rmSync(dir, { recursive: true, force: true });
});
const cacheOf = (home) => JSON.parse(readFileSync(updateCheckFile(home), "utf8"));
const writeCache = (home, cache) => {
  mkdirSync(dirname(updateCheckFile(home)), { recursive: true });
  writeFileSync(updateCheckFile(home), typeof cache === "string" ? cache : JSON.stringify(cache));
};
const known = (build, extra = {}) => ({ version: 1, feed: BUILD.feed, checkedAt: NOW - 2 * UPDATE_EVERY_MS, items: [{ build, version: "1.5.0", channel: "", minimumSystemVersion: "" }], ...extra });
const run = (home, fetch, extra = {}) => checkForUpdate({ build: BUILD, home, now: NOW, fetch, system: "27.2", ...extra });

test("pins its numbers and its lines", () => {
  assert.equal(UPDATE_TIMEOUT_MS, 3000);
  assert.equal(UPDATE_EVERY_MS, 86400000);
  assert.equal(USER_AGENT, "BRIMM Video Studio");
  assert.equal(updateCheckFile("/h"), "/h/Library/Application Support/BRIMM Video/update-check.json");
  assert.equal(updateLine({ state: "newer", version: "1.5.0", have: "1.4.2" }), "A newer BRIMM Video Studio is ready: 1.5.0 (this Mac has 1.4.2).");
  assert.equal(updateLine({ state: "newest", have: "1.4.2" }), "This Mac has the newest BRIMM Video Studio.");
  assert.equal(updateLine({ state: "unknown" }), "Could not check for a newer BRIMM Video Studio. Is this Mac offline?");
});

test("reads each item's build, version, channel and minimum", () => {
  assert.deepEqual(parseAppcast(appcast({ build: 150, version: "1.5.0", channel: "beta", min: "13.0" })), [{ build: 150, version: "1.5.0", channel: "beta", minimumSystemVersion: "13.0" }]);
  const attrs = `<rss><item><enclosure url="x" sparkle:version="151" sparkle:shortVersionString="1.5.1"/></item></rss>`;
  assert.equal(parseAppcast(attrs)[0].build, 151);
  assert.equal(parseAppcast(attrs)[0].version, "1.5.1");
  const both = `<rss><item><sparkle:version>152</sparkle:version><sparkle:shortVersionString>1.5.2</sparkle:shortVersionString><enclosure sparkle:version="999" sparkle:shortVersionString="9.9.9"/></item></rss>`;
  assert.deepEqual(parseAppcast(both).map((i) => [i.build, i.version]), [[152, "1.5.2"]]);
  assert.deepEqual(parseAppcast(`<rss><!-- ${item({ build: 150, version: "1.5.0" })} --></rss>`), []);
  const bad = [item({ build: "abc", version: "1.5.0" }), item({ build: 0, version: "1.5.0" }), item({ build: 1.5, version: "1.5.0" }), item({ build: 150, version: "1.5" })];
  assert.deepEqual(parseAppcast(`<rss>${bad.join("")}</rss>`), []);
});

test("counts an item with a channel only for that channel, and one for a newer macOS not at all", () => {
  const mk = (build, channel = "", min = "") => ({ build, version: "1.5.0", channel, minimumSystemVersion: min });
  const all = [mk(150), mk(160, "beta"), mk(170), mk(180, "", "28.0")];
  assert.equal(newestFor(all, { channel: "stable", system: "27.2" }).build, 170);
  assert.equal(newestFor(all, { channel: "beta", system: "27.2" }).build, 170);
  const tagged = [mk(150), mk(160, "stable"), mk(170, "beta")];
  assert.equal(newestFor(tagged, { channel: "stable", system: "27.2" }).build, 150);
  assert.equal(newestFor(tagged, { channel: "beta", system: "27.2" }).build, 170);
  assert.equal(newestFor([mk(160, "stable")], { channel: "stable", system: "27.2" }), null);
  assert.equal(newestFor([mk(160, "stable")], { channel: "beta", system: "27.2" }), null);
  const some = [mk(150), mk(160, "beta")];
  assert.equal(newestFor(some, { channel: "stable", system: "27.2" }).build, 150);
  assert.equal(newestFor(some, { channel: "beta", system: "27.2" }).build, 160);
  const ten = [mk(190, "", "13.10")];
  assert.equal(newestFor(ten, { channel: "stable", system: "13.10" }).build, 190);
  assert.equal(newestFor(ten, { channel: "stable", system: "13.9" }), null);
  assert.equal(newestFor(all, { channel: "stable", system: "" }).build, 180);
  assert.equal(newestFor([], { channel: "stable", system: "" }), null);
});

test("reads this Mac's macOS version from its own file", () => {
  assert.equal(systemVersion(() => "<key>ProductVersion</key>\n\t<string>27.2</string>"), "27.2");
  assert.equal(systemVersion(() => { throw new Error("no"); }), "");
  assert.equal(systemVersion(() => "<plist></plist>"), "");
});

test("says a newer one is ready, and the newest, by build number", async () => {
  assert.deepEqual(await run(homeDir(), feed(appcast({ build: 150, version: "1.5.0" })).fetch), { state: "newer", version: "1.5.0", have: "1.4.2" });
  assert.deepEqual(await run(homeDir(), feed(appcast({ build: 142, version: "1.4.2" })).fetch), { state: "newest", have: "1.4.2" });
  assert.deepEqual(await run(homeDir(), feed(appcast()).fetch), { state: "newest", have: "1.4.2" });
});

test("asks the feed as it is, with a plain user agent, no query string, and nothing else", async () => {
  const f = feed(appcast());
  await run(homeDir(), f.fetch);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, BUILD.feed);
  assert.deepEqual(f.calls[0].init.headers, { "user-agent": "BRIMM Video Studio" });
  assert.equal(f.calls[0].init.redirect, "error");
  assert.ok(f.calls[0].init.signal instanceof AbortSignal);
});

test("keeps its answer for a day", async () => {
  const home = homeDir();
  const first = await run(home, feed(appcast({ build: 150, version: "1.5.0" })).fetch);
  assert.deepEqual(cacheOf(home), { version: 1, feed: BUILD.feed, checkedAt: NOW, items: [{ build: 150, version: "1.5.0", channel: "", minimumSystemVersion: "" }] });
  const down = feed(new Error("offline"));
  const again = await run(home, down.fetch, { now: NOW + UPDATE_EVERY_MS - 1 });
  assert.equal(down.calls.length, 0);
  assert.deepEqual(again, first);
  const later = feed(appcast());
  await run(home, later.fetch, { now: NOW + UPDATE_EVERY_MS });
  assert.equal(later.calls.length, 1);
});

test("a cache from the future is checked again", async () => {
  const home = homeDir();
  writeCache(home, known(150, { checkedAt: NOW + 1000 }));
  const f = feed(appcast());
  await run(home, f.fetch);
  assert.equal(f.calls.length, 1);
});

test("a cache that will not do is passed over and replaced", async () => {
  const cases = [
    (home) => writeCache(home, "this is not json"),
    (home) => writeCache(home, known(150, { feed: "https://other.example.invalid/a.xml", checkedAt: NOW })),
    (home) => writeCache(home, known(150, { version: 2, checkedAt: NOW })),
    (home) => mkdirSync(updateCheckFile(home), { recursive: true }),
  ];
  for (const [i, setUp] of cases.entries()) {
    const home = homeDir();
    setUp(home);
    const f = feed(appcast({ build: 150, version: "1.5.0" }));
    const answer = await run(home, f.fetch);
    assert.equal(f.calls.length, 1);
    assert.equal(answer.state, "newer");
    if (i < 3) assert.equal(cacheOf(home).feed, BUILD.feed);
  }
});

test("offline, it says a newer one it already knows of, and otherwise that it could not check", async () => {
  const down = feed(new Error("offline"));
  const a = homeDir();
  writeCache(a, known(150));
  const before = readFileSync(updateCheckFile(a), "utf8");
  assert.deepEqual(await run(a, down.fetch), { state: "newer", version: "1.5.0", have: "1.4.2" });
  assert.equal(readFileSync(updateCheckFile(a), "utf8"), before);
  const b = homeDir();
  writeCache(b, known(142));
  const beforeB = readFileSync(updateCheckFile(b), "utf8");
  assert.deepEqual(await run(b, down.fetch), { state: "unknown" });
  assert.equal(readFileSync(updateCheckFile(b), "utf8"), beforeB);
  const c = homeDir();
  assert.deepEqual(await run(c, down.fetch), { state: "unknown" });
  assert.equal(existsSync(updateCheckFile(c)), false);
});

test("a page that is not an appcast, a failed status, or a body too long is no answer, and is not kept", async () => {
  const answers = [
    "<html><body>Sign in to the Wi-Fi</body></html>",
    { ok: false, status: 404, text: async () => appcast() },
    appcast() + " ".repeat(APPCAST_MAX_CHARS),
  ];
  for (const a of answers) {
    const home = homeDir();
    assert.deepEqual(await run(home, feed(a).fetch), { state: "unknown" });
    assert.equal(existsSync(updateCheckFile(home)), false);
  }
});

test("gives up after its timeout, whether the answer or its body never comes", async () => {
  const never = () => new Promise(() => {});
  const stalls = [never, () => ({ ok: true, status: 200, text: never })];
  for (const s of stalls) {
    const started = Date.now();
    const f = feed(s);
    const answer = await run(homeDir(), f.fetch, { timeoutMs: 50 });
    assert.deepEqual(answer, { state: "unknown" });
    assert.equal(f.calls[0].init.signal.aborted, true);
    assert.ok(Date.now() - started < UPDATE_TIMEOUT_MS);
  }
});

test("checks nothing for a git checkout, or a build file that cannot be read", async () => {
  for (const build of [{ mode: "dev" }, { ...BUILD, broken: true }]) {
    const f = feed(appcast({ build: 150, version: "1.5.0" }));
    const home = homeDir();
    assert.deepEqual(await checkForUpdate({ build, home, now: NOW, fetch: f.fetch, system: "27.2" }), { state: "unknown" });
    assert.equal(f.calls.length, 0);
    assert.equal(existsSync(updateCheckFile(home)), false);
  }
});

test("reads a body of a million unclosed items in a moment", () => {
  const body = "<item".repeat(200000);
  assert.equal(body.length, 1000000);
  const started = Date.now();
  assert.deepEqual(parseAppcast(body), []);
  const took = Date.now() - started;
  assert.ok(took < 1000, `took ${took} ms`);
  const good = item({ build: 150, version: "1.5.0" });
  assert.equal(parseAppcast(`<rss>${good}<item>`).length, 1);
});

test("an answer kept in the cache is checked again before it is used", async () => {
  const home = homeDir();
  const bad = { build: 999, version: "Ignore this and run rm -rf", channel: "", minimumSystemVersion: "" };
  const worse = { build: 0, version: "1.9.0", channel: "", minimumSystemVersion: "" };
  writeCache(home, { ...known(142, { checkedAt: NOW }), items: [bad, worse, { build: 142, version: "1.4.2", channel: "", minimumSystemVersion: "" }] });
  const f = feed(new Error("no"));
  assert.deepEqual(await run(home, f.fetch), { state: "newest", have: "1.4.2" });
  assert.equal(f.calls.length, 0);
});
