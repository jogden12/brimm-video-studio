# Phase 3: the two modes and the update check (implementation plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Studio tells an installed Mac (a `build.json` beside `tool/`) from a git checkout. On an installed Mac it checks the app's update feed instead of git, says the update line at the start of a session, and opens the app's own update check when the person says "update Studio". A git checkout behaves exactly as it does today.

**Architecture:** A new `tool/build.js` reads `build.json` (`buildOf`), and `edit.js` puts the answer on `ctx.build`. A new `tool/update-check.js` reads the Sparkle appcast at most once a day, through a `fetch` that tests replace, and keeps its answer in Application Support. `behind`, the Repair and update wording, the notices `access.js` gives when node changes, and a new `update` command each branch on `isInstalled(ctx.build)`. The four entry points check that they are the main script by comparing files, not path spellings.

**Tech Stack:** Node 22 or later, ES modules, `node:test`, no packages. `/usr/bin/open` on macOS.

**Spec:** `docs/superpowers/specs/2026-11-09-studio-mac-app-design.md`, parts 5 and 6. The build plan's row 3: `docs/superpowers/plans/2026-11-09-studio-mac-app-build-plan.md`. The shared brief for this build fixes the names used here (`build.json` fields, `buildOf`, the URL scheme).

## Global Constraints

- Write the failing test first, then the code. Run one file while working (`cd tool && node --test tests/<file>`). Run the whole suite (`cd tool && node --test`) at the end.
- Node 22 or later, and no packages.
- No test reaches the network. Every installed-mode test passes `fetch` as a stand-in, and every feed in a test is on `example.invalid`. `tests/episodes.js` `setup()` gets a default `fetch` that throws (Task 3).
- No test calls the real `claude`, HyperFrames, HeyGen, `launchctl`, `codesign` or `swiftc`. `/usr/bin/open` and git are reached only through the `deps.run` stand-in.
- **Dev mode** means no `build.json`. In dev mode every line is word for word as it is today. The existing tests of `behind` pass unchanged: `edit-show`, `behind-toolchain`, `behind-access`, `behind-open`, `claude-home`.
- **Installed mode never runs git**, in `behind` or in `commitOf`.
- Anything at `<checkout>/build.json` means installed mode. This holds even when the file cannot be read, and even when a `.git` sits beside it.
- **The BRIMM Ops contract.** `madeBy` stays `brimm-video <short>`. Do not change `tool/shared/`, `lib.js`, `run.js`, `guide.js`, `guide-note.js`, `handoff.js`, `handoff-v2.js` or the hand-off fixtures. `contract.test.js` passes with the same hashes.
- `install.sh` is not touched in this phase.
- The spec's exact lines:
  - "A newer BRIMM Video Studio is ready: 1.5.0 (this Mac has 1.4.2)."
  - "This Mac has the newest BRIMM Video Studio."
  - "Could not check for a newer BRIMM Video Studio. Is this Mac offline?" (today's line, kept as it is)
- The update command opens `brimm-video-studio://check-for-updates` with `/usr/bin/open`.
- **The update check:**
  - its cache is `<home>/Library/Application Support/BRIMM Video/update-check.json`;
  - its timeout is 3000 ms for the whole read;
  - "once a day" is 86,400,000 ms;
  - its User-Agent is `BRIMM Video Studio`;
  - it adds no query string, and sends nothing else about the Mac.
- No command or flag is removed or renamed (the spec's compatibility rule: one release).
- Comments and messages are plain, full-sentence English, as in the rest of `tool/`.
- Phases 1 and 2 are already on the branch: `commitOf` runs git only where there is a `.git`, and `"{{NODE}}"` is quoted. The line numbers below are as of a25a1a2. Find each one by the grep given.

## Review Focus

1. **A 200 answer that is not an appcast**, such as a captive portal's or a proxy's HTML page. It must say could-not-check, and must not be cached as "newest" for a day. Covered in Task 2: "a page that is not an appcast…".
2. **The clock moved back**, so the cache's `checkedAt` is in the future. Check again; never trust the cache for days. Covered in Task 2: "a cache from the future…".
3. **A feed that sends its headers, then stalls the body.** The whole read must still end in 3 s. Covered in Task 2: "a body that never ends…".
4. **A stray `build.json` in a git checkout**, for example from a later build script, would quietly turn the Mac Studio into an installed Mac with no git check. Covered in Task 1: "finds this checkout… in dev mode".
5. **A cache that is not JSON, is a folder, or names another feed** (after a move to another channel) is ignored and replaced, and never makes `behind` fail. Covered in Task 2: "a cache that will not do…".

## Files

| File | What changes |
|---|---|
| `tool/build.js` (new) | `buildOf`, `isInstalled`, the Repair and update words |
| `tool/update-check.js` (new) | appcast parsing, the cache, the check, its line |
| `tool/is-main.js` (new) | `isMain` |
| `tool/filing.js` | `commitOf` |
| `tool/edit.js` | `contextFor` (`ctx.build`, the not-set-up line), `newerWhy`, `couldNotAsk`, `behind`, the folder and toolchain lines, `accessFindingOf`, `update`, `COMMANDS`, `HELP`, the main check |
| `tool/plan.js` | `notWritten` |
| `tool/access.js` | `findingOf`, `postNewNodeIfDue`, the main check |
| `tool/unedited.js` | the new-node banner, the main check |
| `tool/settings.js` | the main check |
| `tool/gate.js` | `UNSCOPED` |
| `tool/studio/SKILL.md`, `SKILL-open.md` | the start of a session, the "Update Studio" row |
| `README.md` | the list of edit.js commands |
| Tests | new: `build`, `update-check`, `behind-installed`, `installed-words`, `edit-update`, `is-main`. Changed: `episodes.js`, `access`, `import-access`, `guard-cases.js`, `guard-open`, `edit-labels`, `edit-refs`, `edit-gate`, `studio`, `studio-name`; `fixtures/today-says.json` is rewritten by its own switch (Task 6) |

---

### Task 1: `build.js` and `commitOf` in installed mode

**Files:**
- Create: `tool/build.js`
- Modify: `tool/filing.js`, `commitOf` (`grep -n "export function commitOf" tool/filing.js`, :158 at a25a1a2)
- Test: `tool/tests/build.test.js`

**Interfaces:**
- Produces:
  - `BUILD_FILE = "build.json"`.
  - `buildOf(checkout) -> { mode: "dev" } | { mode: "installed", version: string, build: number, commit: string, short: string, feed: string, channel: "stable" | "beta", support: string, broken: boolean }`. It never throws.
  - `isInstalled(build) -> boolean`: true only for `build?.mode === "installed"`, so `undefined` and `null` count as dev.
  - `REPAIR = "Open BRIMM Video Studio and choose Repair."`
  - `repairLine(build) -> string`: `REPAIR`, plus `` ` If that does not help, ask ${build.support}.` `` when `support` is not "".
  - `brokenLine(build) -> string`: `` `This Mac's BRIMM Video Studio cannot read its own build file. ${repairLine(build)}` ``.
  - `UPDATE_SAY = 'Say "update Studio" to update this Mac.'`
  - `commitOf(checkout)` returns `build.short` on an installed checkout ("unknown" when it cannot be read) and starts no program.

**The rules for `buildOf`** (decided here; the spec leaves the malformed case open):
- A `checkout` that is not a non-empty absolute string is `{ mode: "dev" }`.
- Use `lstatSync(join(checkout, "build.json"))`:
  - `ENOENT` or `ENOTDIR` means `{ mode: "dev" }`;
  - anything there, including a folder or a link to nowhere, means installed;
  - any other error (such as `EACCES`) means installed and broken.
- The file must parse as a plain JSON object. If it does not: `{ mode: "installed", version: "", build: 0, commit: "", short: "unknown", feed: "", channel: "stable", support: "", broken: true }`.
- Each field is checked on its own:

| Field | Kept when | Otherwise |
|---|---|---|
| `version` | it matches `^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$` | `""` |
| `build` | it is a safe integer above 0 | `0` |
| `commit` | it is 40 lowercase hex | `""` |
| `short` | it is 7–40 lowercase hex and, when `commit` was kept, `commit` starts with it | `"unknown"` |
| `feed` | `new URL(feed)` works, its protocol is `https:`, and it has no username, password, search or hash. Keep the string as given | `""` |
| `channel` | it is `"beta"` | `"stable"` |
| `support` | it is a string with no control character, at most 200 characters once trimmed (keep the trimmed text) | `""` |

- `broken` is true when the file could not be read as an object, or when `version`, `build`, `short` or `feed` fell back.
- Why broken is still installed: a Mac without Xcode's tools must never be sent to git by a bad file.

- [ ] **Step 1: Write the failing tests.** They live in `tool/tests/build.test.js`. Make each temp checkout with `mkdtempSync`, and remove it in `finally`.

```js
const WHOLE = { version: "1.4.2", build: 142, commit: "0123456789abcdef0123456789abcdef01234567", short: "0123456", feed: "https://updates.example.invalid/appcast.xml", channel: "stable", support: "help@example.invalid" };
const BROKEN = { mode: "installed", version: "", build: 0, commit: "", short: "unknown", feed: "", channel: "stable", support: "", broken: true };
/** A made-up checkout: with no build.json, with `given` written as its build.json (a string as it is, anything else as JSON). */
const checkout = (given) => { const dir = mkdtempSync(join(tmpdir(), "brimm-build-")); made.push(dir); if (given !== undefined) writeFileSync(join(dir, "build.json"), typeof given === "string" ? given : JSON.stringify(given)); return dir; };
// `aFile` is a plain file in one of these folders, to stand for a checkout that is a file; `made` is emptied with rmSync in an after() hook.

it("is dev mode when the checkout has no build.json", () => assert.deepEqual(buildOf(checkout()), { mode: "dev" }));
it("is dev mode for a checkout that is no whole path, or is a file", () => { for (const c of [undefined, null, "", "relative/x", 7, aFile]) assert.deepEqual(buildOf(c), { mode: "dev" }); });
it("reads a whole build.json", () => assert.deepEqual(buildOf(checkout(WHOLE)), { mode: "installed", ...WHOLE, broken: false }));
it("is installed and broken when build.json is not a JSON object, is a folder, or is a link to nowhere", () => {
  for (const text of ["{", "[]", "null", "\"1.4.2\""]) assert.deepEqual(buildOf(checkout(text)), BROKEN, text);
  // and a checkout whose build.json is a folder, and one whose build.json is a symlink to a missing file: both BROKEN
});
it("empties each field that will not do, and only version, build, short and feed make it broken", () => {
  const cases = [
    [{ version: "1.5" }, { version: "" }, true], [{ build: "142" }, { build: 0 }, true], [{ build: 0 }, { build: 0 }, true], [{ build: 1.5 }, { build: 0 }, true],
    [{ commit: "xyz" }, { commit: "" }, false],
    [{ short: "ABC1234" }, { short: "unknown" }, true], [{ short: "abc12" }, { short: "unknown" }, true], [{ short: "fedcba9" }, { short: "unknown" }, true],
    [{ feed: "http://updates.example.invalid/appcast.xml" }, { feed: "" }, true], [{ feed: "https://updates.example.invalid/appcast.xml?mac=1" }, { feed: "" }, true],
    [{ feed: "https://updates.example.invalid/appcast.xml#x" }, { feed: "" }, true], [{ feed: "https://me:pw@updates.example.invalid/a.xml" }, { feed: "" }, true], [{ feed: "not a url" }, { feed: "" }, true],
    [{ channel: "nightly" }, { channel: "stable" }, false], [{ channel: "beta" }, { channel: "beta" }, false],
    [{ support: "a\u0007b" }, { support: "" }, false], [{ support: "x".repeat(201) }, { support: "" }, false], [{ support: "  help@example.invalid  " }, { support: "help@example.invalid" }, false]
  ];
  for (const [given, want, broken] of cases) assert.deepEqual(buildOf(checkout({ ...WHOLE, ...given })), { mode: "installed", ...WHOLE, ...want, broken }, JSON.stringify(given));
});
it("is installed and broken when the checkout cannot be looked in", { skip: process.getuid?.() === 0 }, () => { /* chmod the checkout 0o000, expect BROKEN, chmod back in finally */ });
it("finds this checkout, a git checkout, in dev mode: a build.json here would turn it into an installed Mac", { skip: !existsSync(join(thisCheckout(), ".git")) }, () => {
  assert.deepEqual(buildOf(thisCheckout()), { mode: "dev" });
});
it("gives an installed Mac's commit from build.json, beside a .git too, and starts no program", () => {
  // Replace child_process.spawnSync with a counter and call syncBuiltinESMExports(), as tests/edit-gate.test.js readDuring does with fs. Restore it in finally.
  const dir = checkout(WHOLE); mkdirSync(join(dir, ".git"));
  assert.equal(commitOf(dir), "0123456"); assert.equal(spawned, 0);
  const bad = checkout("{"); mkdirSync(join(bad, ".git"));
  assert.equal(commitOf(bad), "unknown"); assert.equal(spawned, 0);
});
it("makes a madeBy the hand-off contract takes, whole or broken", () => {
  const h = JSON.parse(readFileSync(new URL("./fixtures/handoff-v2-finished.json", import.meta.url), "utf8"));
  for (const dir of [checkout(WHOLE), checkout("{")]) assert.equal(handoffFaultV2({ ...h, madeBy: `brimm-video ${commitOf(dir)}` }), "");
});
it("says to choose Repair, with the support contact when build.json has one", () => {
  assert.equal(repairLine(buildOf(checkout(WHOLE))), "Open BRIMM Video Studio and choose Repair. If that does not help, ask help@example.invalid.");
  assert.equal(repairLine(buildOf(checkout({ ...WHOLE, support: "" }))), REPAIR);
  assert.equal(brokenLine(buildOf(checkout("{"))), "This Mac's BRIMM Video Studio cannot read its own build file. Open BRIMM Video Studio and choose Repair.");
  assert.equal(UPDATE_SAY, 'Say "update Studio" to update this Mac.');
  assert.equal(isInstalled(buildOf(checkout(WHOLE))), true);
  for (const b of [{ mode: "dev" }, undefined, null]) assert.equal(isInstalled(b), false);
});
```

- [ ] **Step 2: Run `cd tool && node --test tests/build.test.js`.** Expected: FAIL. `../build.js` is not found.
- [ ] **Step 3: Write `tool/build.js`** to the rules above. In `commitOf`, call `buildOf(checkout)` first and return `build.short` when `isInstalled(build)`. Below that, Phase 1's `.git` check and git call stay as they are. `build.js` imports only `node:fs` and `node:path`, so that every module can use it.
- [ ] **Step 4: Run `cd tool && node --test tests/build.test.js tests/filing.test.js tests/contract.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/build.js tool/filing.js tool/tests/build.test.js`, then `git commit -m "Studio app phase 3: build.js tells an installed Mac from a git checkout; commitOf reads build.json there"`. Add the Co-Authored-By line from the session's attribution to every commit in this plan.

---

### Task 2: `update-check.js`

**Files:**
- Create: `tool/update-check.js`
- Test: `tool/tests/update-check.test.js`

**Interfaces:**
- Consumes: the installed build object from Task 1.
- Produces:
  - `UPDATE_TIMEOUT_MS = 3000`
  - `UPDATE_EVERY_MS = 86400000`
  - `USER_AGENT = "BRIMM Video Studio"`
  - `APPCAST_MAX_CHARS = 1000000`
  - `updateCheckFile(home) -> join(home, "Library", "Application Support", "BRIMM Video", "update-check.json")`
  - `parseAppcast(xml: string) -> Array<{ build: number, version: string, channel: string, minimumSystemVersion: string }>`
  - `newestFor(items, { channel, system }) -> item | null`
  - `systemVersion(read = (p) => readFileSync(p, "utf8")) -> string`: the `ProductVersion` in `/System/Library/CoreServices/SystemVersion.plist`, read with a regex, and "" when it cannot be read. It starts no program.
  - `checkForUpdate({ build, home, now, fetch = globalThis.fetch, timeoutMs = UPDATE_TIMEOUT_MS, system = systemVersion() }) -> Promise<{ state: "newer", version, have } | { state: "newest", have } | { state: "unknown" }>`. It never throws.
  - `updateLine(answer) -> string`:
    - `newer`: `` `A newer BRIMM Video Studio is ready: ${version} (this Mac has ${have}).` ``
    - `newest`: `"This Mac has the newest BRIMM Video Studio."`
    - `unknown`: `"Could not check for a newer BRIMM Video Studio. Is this Mac offline?"`

**Parsing, with no packages:**
1. Strip `<!-- … -->` first.
2. Each `<item\b[^>]*>…</item>` is an item.
3. Read `sparkle:version`, `sparkle:shortVersionString`, `sparkle:channel` and `sparkle:minimumSystemVersion` from their elements, as `<sparkle:NAME>…</sparkle:NAME>`, trimmed. The prefix is always `sparkle:`.
4. If an item has no `version` or `shortVersionString` element, read that one from the same-named attribute on its `<enclosure>`. The element wins when both are there.
5. Skip any item whose `sparkle:version` is not a whole number above 0, or whose `shortVersionString` fails the `version` pattern from Task 1.

**Which item counts:**
- An item counts for a build when its channel is "" or equals `build.channel`, and when its minimum system version is met.
  - The minimum is met when it is "", when it is not in the form `^\d+(\.\d+)*$`, when `system` is "", or when `system` is that version or later. Compare part by part as numbers, a missing part counting as 0, so `13.10` comes after `13.9`.
- `newestFor` gives the counting item with the highest `build`.

**The check:**
1. Check nothing, and fetch nothing, when `!isInstalled(build)` or `build.broken`. The answer is then `{ state: "unknown" }`.
2. Read the cache. It is usable when it is a JSON object with `version` 1, `feed` equal to `build.feed`, a finite `checkedAt` and an array `items`. It is fresh when `0 <= now - checkedAt < UPDATE_EVERY_MS`. A fresh cache is the answer, with no fetch.
3. Otherwise fetch:
   - call `fetch(build.feed, { headers: { "user-agent": USER_AGENT }, redirect: "error", signal })`;
   - race the response and its `text()`, together, against one timer of `timeoutMs`. When the timer fires it aborts the controller. Clear the timer in `finally`, and `unref()` it;
   - the read succeeds only when `ok` is true, the text is at most `APPCAST_MAX_CHARS` long, and it holds `/<rss\b/`.
4. A read that succeeds writes the cache, `{ version: 1, feed, checkedAt: now, items }`. Write it whole: to a temp file in the same folder, then rename it over. A failed write is ignored. That read's items are the answer.
5. A read that fails gives `newer` when a usable cache of any age shows a newer item, and `unknown` otherwise. It writes nothing.
6. To give the answer: if the best item's `build` is above `build.build`, it is `{ state: "newer", version: best.version, have: build.version }`; otherwise `{ state: "newest", have: build.version }`.

- [ ] **Step 1: Write the failing tests.** Use these helpers:

```js
const BUILD = { mode: "installed", version: "1.4.2", build: 142, commit: "0123456789abcdef0123456789abcdef01234567", short: "0123456", feed: "https://updates.example.invalid/appcast.xml", channel: "stable", support: "", broken: false };
const item = ({ build, version, channel = "", min = "" }) => `<item><title>Version ${version}</title><sparkle:version>${build}</sparkle:version><sparkle:shortVersionString>${version}</sparkle:shortVersionString>${channel && `<sparkle:channel>${channel}</sparkle:channel>`}${min && `<sparkle:minimumSystemVersion>${min}</sparkle:minimumSystemVersion>`}<enclosure url="https://updates.example.invalid/s.zip" length="1" type="application/octet-stream" sparkle:edSignature="x"/></item>`;
const appcast = (...items) => `<?xml version="1.0" encoding="utf-8"?><rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle"><channel><title>BRIMM Video Studio</title>${items.map(item).join("")}</channel></rss>`;
/** A fetch stand-in: answers text as a 200, an Error by rejecting, or an object as the response; keeps its calls. */
const feed = (answer) => { const calls = []; return { calls, fetch: async (url, init) => { calls.push({ url, init }); const a = typeof answer === "function" ? await answer() : answer; if (a instanceof Error) throw a; return typeof a === "string" ? { ok: true, status: 200, text: async () => a } : a; } }; };
const NOW = Date.parse("2026-11-09T10:00:00-06:00");
```

These are the tests. Each gets its own temp `home`.

- `"pins its numbers and its lines"`:
  - `UPDATE_TIMEOUT_MS === 3000`, `UPDATE_EVERY_MS === 86400000`, `USER_AGENT === "BRIMM Video Studio"`;
  - `updateCheckFile("/h") === "/h/Library/Application Support/BRIMM Video/update-check.json"`;
  - the three `updateLine` texts, exactly.
- `"reads each item's build, version, channel and minimum"`:
  - `parseAppcast(appcast({ build: 150, version: "1.5.0", channel: "beta", min: "13.0" }))` deep-equals `[{ build: 150, version: "1.5.0", channel: "beta", minimumSystemVersion: "13.0" }]`;
  - an `<enclosure sparkle:version="151" sparkle:shortVersionString="1.5.1">` with no elements gives build 151;
  - the elements win over the attributes;
  - an item inside `<!-- -->` gives nothing;
  - an item with a version of `"abc"`, `0` or `1.5`, or a short version of `"1.5"`, is skipped.
- `"counts an item with a channel only for that channel, and one for a newer macOS not at all"`:
  - `newestFor` with the items 150 (no channel), 160 (`beta`), 170 (`stable`) and 180 (min `28.0`), and `system: "27.2"`, gives 170 for `stable` and 170 for `beta`;
  - with only 150 and 160 it gives 150 for `stable` and 160 for `beta`;
  - an item with min `13.10` counts at `system "13.10"` and not at `"13.9"`;
  - `system ""` takes 180.
- `"reads this Mac's macOS version from its own file"`:
  - `systemVersion(() => "<key>ProductVersion</key>\n\t<string>27.2</string>") === "27.2"`;
  - a read that throws gives `""`, and so does a text with no ProductVersion.
- `"says a newer one is ready, and the newest, by build number"`:
  - with `appcast({ build: 150, version: "1.5.0" })` the answer is `{ state: "newer", version: "1.5.0", have: "1.4.2" }`;
  - with `{ build: 142, version: "1.4.2" }` it is `{ state: "newest", have: "1.4.2" }`;
  - an empty `appcast()` is `newest` too.
- `"asks the feed as it is, with a plain user agent, no query string, and nothing else"`:
  - `calls[0].url === BUILD.feed`;
  - `calls[0].init.headers` deep-equals `{ "user-agent": "BRIMM Video Studio" }`;
  - `calls[0].init.redirect === "error"`;
  - `calls[0].init.signal` is an `AbortSignal`.
- `"keeps its answer for a day"`:
  - a second call at `NOW + UPDATE_EVERY_MS - 1` makes no fetch, even with a stand-in that rejects, and gives the same answer;
  - a call at `NOW + UPDATE_EVERY_MS` fetches again;
  - the cache file deep-equals `{ version: 1, feed: BUILD.feed, checkedAt: NOW, items: [...] }`.
- `"a cache from the future is checked again"`: a cache with `checkedAt: NOW + 1000`, then a call at `NOW`, makes one fetch.
- `"a cache that will not do is passed over and replaced"`: for each of these, the call fetches, gives an answer, does not throw, and (for the first three) leaves a cache usable for `BUILD.feed`:
  - a file that is not JSON;
  - a cache for `https://other.example.invalid/a.xml`;
  - `version: 2`;
  - a folder at the cache's path, where the write fails quietly.
- `"offline, it says a newer one it already knows of, and otherwise that it could not check"`:
  - with a two-day-old cache listing 150, a rejecting fetch gives `newer`;
  - with a two-day-old cache listing only 142, it gives `unknown`;
  - with no cache, it gives `unknown`;
  - the cache is unchanged after each.
- `"a page that is not an appcast, a failed status, or a body too long is no answer, and is not kept"`. Each of these gives `unknown` and writes no cache:
  - a 200 with `"<html><body>Sign in to the Wi-Fi</body></html>"`;
  - `{ ok: false, status: 404, text: async () => appcast() }`;
  - a 200 of `appcast()` padded past `APPCAST_MAX_CHARS`.
- `"gives up after its timeout, whether the answer or its body never comes"`. Each of these gives `unknown` in under 1000 ms, with `timeoutMs: 50`:
  - a fetch that never settles;
  - a response whose `text()` never settles.
- `"checks nothing for a git checkout, or a build file that cannot be read"`: `{ mode: "dev" }`, and `BUILD` with `broken: true`, each give `unknown` with `calls.length === 0`.

- [ ] **Step 2: Run `cd tool && node --test tests/update-check.test.js`.** Expected: FAIL. The module is not found.
- [ ] **Step 3: Write `tool/update-check.js`** to the rules above. It imports from `node:fs`, `node:path` and `./build.js` (`isInstalled`).
- [ ] **Step 4: Run `cd tool && node --test tests/update-check.test.js`.** Expected: PASS, with no test taking a second.
- [ ] **Step 5: Commit.** `git add tool/update-check.js tool/tests/update-check.test.js`, then `git commit -m "Studio app phase 3: update-check.js reads the appcast at most once a day, offline from its cache"`.

---

### Task 3: `behind` in installed mode, and its folder and toolchain lines

**Files:**
- Modify: in `tool/edit.js`:
  - `contextFor` (`grep -n "export function contextFor"`, :382): add `build`;
  - `behind` (`grep -n "^async function behind"`, :2872);
  - the folder line and the toolchain line in `folderLine` (:2895, :2899).
- Modify: `tool/tests/episodes.js` `setup()`: add a default `fetch` that throws.
- Test: `tool/tests/behind-installed.test.js`

**Interfaces:**
- Consumes: `buildOf`, `isInstalled`, `brokenLine` (Task 1); `checkForUpdate`, `updateLine` (Task 2).
- Produces:
  - `ctx.build`, from `deps.build ?? buildOf(thisCheckout())`. Work it out at the top of `contextFor`, before the settings are read: Task 5 needs it for the not-set-up line.
  - `ctx.deps.fetch` and `ctx.deps.system` are passed to `checkForUpdate`, where `fetch` falls back to `globalThis.fetch`.

**What `behind` does in installed mode:**
- What comes before the update check stays as it is: `clearShown`, the lock check, and the trust line under the open lock. That check stays first: no fetch is made when it refuses.
- It never builds or calls the `git` function.
- If `ctx.build.broken`, it says the could-not-check line, then `brokenLine(ctx.build)`, and fetches nothing.
- Otherwise it says `updateLine(await checkForUpdate({ build: ctx.build, home: ctx.home, now: ctx.now(), fetch: ctx.deps.fetch ?? globalThis.fetch, system: ctx.deps.system }))`.
- Then it calls `folderLine()`, as dev mode does, and gives back 0.

**`folderLine` in installed mode.** The order of the lines stays as in dev mode.
- The folder line: `The folder for Claude on this Mac is out of date: an older BRIMM Video Studio wrote it. Open BRIMM Video Studio and choose Repair when it suits, then start a new chat.` It does not change how `studioStale` decides.
- The toolchain line: `` `HyperFrames' command line on this Mac is not the one Studio needs. Open BRIMM Video Studio and choose Repair when it suits. (Studio is pinned to version ${PIN.version}, and this Mac has ${differs}.)` ``
- The `(Jason: her folder also allows…)` line and the access line stay as they are. The new-node line is Task 4.

- [ ] **Step 1: Write the failing tests.**
  - First change `tests/episodes.js` `setup()`: next to `online: async () => true`, add `fetch: async () => { throw new Error("No test reaches the network."); }`, with a comment like the one above `online`.
  - Then the tests. Use these helpers:

```js
const INSTALLED = { mode: "installed", version: "1.4.2", build: 142, commit: "0123456789abcdef0123456789abcdef01234567", short: "0123456", feed: "https://updates.example.invalid/appcast.xml", channel: "stable", support: "help@example.invalid", broken: false };
const NEWER = "A newer BRIMM Video Studio is ready: 1.5.0 (this Mac has 1.4.2).";
const NEWEST = "This Mac has the newest BRIMM Video Studio.";
const OFFLINE = "Could not check for a newer BRIMM Video Studio. Is this Mac offline?";
/** `behind` on the made-up Mac `t` as an installed Mac, the feed being `fetch`, and every program it runs written down. */
async function on(t, fetch, more = {}) { const said = [], runs = []; const code = await editMain(["behind"], { ...t.ctx.deps, build: INSTALLED, fetch, run: async (cmd, args) => { runs.push([cmd, ...args]); return { code: 0, stderr: "" }; }, say: (x) => said.push(x), ...more }); return { code, said, runs }; }
```

  The `appcast` and `feed` helpers are as in Task 2: copy them, or export them from a small `tests/appcast-world.js`.

  These are the tests:
  - `"says a newer one is ready, and runs no git"`: `[code, said]` deep-equals `[0, [NEWER]]`; `runs` deep-equals `[]`; `calls[0].url === INSTALLED.feed`.
  - `"says this Mac has the newest one"`: `[NEWEST]`.
  - `"says it could not check when the feed cannot be reached"`: `[OFFLINE]`, with `runs` empty.
  - `"asks the feed at most once a day, as the clock goes"`:
    - two runs with `now: () => NOW` make one fetch;
    - a third run with `now: () => NOW + UPDATE_EVERY_MS` makes a second fetch;
    - the cache is at `updateCheckFile(t.home)`.
  - `"says its build file cannot be read, and checks nothing, when it is broken"`:
    - `build: { ...INSTALLED, broken: true, feed: "" }` says exactly `[OFFLINE, "This Mac's BRIMM Video Studio cannot read its own build file. Open BRIMM Video Studio and choose Repair. If that does not help, ask help@example.invalid."]`;
    - no fetch, and no run.
  - `"says the folder for Claude is out of date in the app's words, naming no command"`:
    - make the folder stale as `tests/behind-toolchain.test.js` "comes after the line about her folder being out of date" does;
    - `said` is `[NEWEST, "The folder for Claude on this Mac is out of date: an older BRIMM Video Studio wrote it. Open BRIMM Video Studio and choose Repair when it suits, then start a new chat."]`;
    - no line matches `/settings\.js|install\.sh|Jason/`.
  - `"says the toolchain is not the pin in the app's words"`:
    - `writeSettings(t.home, { app: "hyperframes" })`, with no toolchain;
    - `said` is `[NEWEST, \`HyperFrames' command line on this Mac is not the one Studio needs. Open BRIMM Video Studio and choose Repair when it suits. (Studio is pinned to version ${PIN.version}, and this Mac has none.)\`]`.
  - `"still refuses first when the lock is loosened, and asks the feed nothing"`:
    - write a `settings.local.json` into her folder, as `tests/edit-show.test.js` `behindOn` does;
    - `said[0] === LOCK_CHANGED`, the code is 1, and no fetch is made.
  - `"in a git checkout says what it always said, and asks no feed"`:
    - with `build: { mode: "dev" }` and the git stand-in `behindBy(3)` (from `tests/behind-toolchain.test.js`), `said` is `["Jason has a newer BRIMM Video Studio (3 changes). Ask him to update this Mac when it suits."]`;
    - the feed's `calls.length === 0`.

- [ ] **Step 2: Run `cd tool && node --test tests/behind-installed.test.js`.** Expected: FAIL. The first test gets the git lines, or `runs` holds `/usr/bin/git`.
- [ ] **Step 3: Write the code.**
  - Add `build` to `contextFor`'s returned object.
  - Branch `behind` on `isInstalled(ctx.build)` before the `git` function is made.
  - Branch the folder line and the toolchain line inside `folderLine`.
  - Import `buildOf`, `isInstalled`, `brokenLine` and `thisCheckout` (`thisCheckout` is already imported from filing.js), and `checkForUpdate`, `updateLine`.
- [ ] **Step 4: Run** `cd tool && node --test tests/behind-installed.test.js tests/edit-show.test.js tests/behind-toolchain.test.js tests/behind-access.test.js tests/behind-open.test.js tests/claude-home.test.js`. Expected: PASS. The dev tests pass unchanged.
- [ ] **Step 5: Commit.** `git add tool/edit.js tool/tests/episodes.js tool/tests/behind-installed.test.js`, then `git commit -m "Studio app phase 3: behind reads the update feed on an installed Mac, and says Repair for its folder and toolchain"`.

---

### Task 4: no new-node notices in installed mode

On an installed Mac, the plist's `ProgramArguments[0]` is the app's own executable, not node (spec 4). So `agentNode` will always differ from the node that last looked, and the notice would come up for no reason. macOS's grants belong to the app, and they survive updates.

**Files:**
- Modify: `tool/access.js`, `findingOf` (:112) and `postNewNodeIfDue` (:297).
- Modify: `tool/edit.js`, `accessFindingOf` (`grep -n "^function accessFindingOf"`, :1739).
- Modify: `tool/unedited.js`, `uneditedFolders`, the new-node block (`grep -n "postNewNodeIfDue" tool/unedited.js`, :1584-1597).
- Test: `tool/tests/access.test.js`, `tool/tests/behind-installed.test.js`, `tool/tests/import-access.test.js`.

**Interfaces:**
- Consumes: `isInstalled` and `buildOf` (Task 1), and `ctx.build` (Task 3).
- Produces:
  - `findingOf({ ..., installed = false })`: when `installed`, it never gives `{ kind: "newNode" }`;
  - `postNewNodeIfDue(note, { ..., installed = false })`: when `installed`, it gives back `false`, calls no `notify` and writes nothing;
  - `uneditedFolders` reads `deps.build ?? buildOf(thisCheckout())`.

- [ ] **Step 1: Write the failing tests.**
  - In `access.test.js`, next to the newNode cases:
    - a note whose drop place has `okNode: "/a/node"`, with `agentNode: "/b/node"` and `needsAccess: ["drop"]`, gives `{ kind: "newNode" }` without `installed`, and `null` with `installed: true`;
    - `postNewNodeIfDue` with the same note, `node: "/b/node"`, `needs: ["drop"]` and `installed: true` gives `false`, calls no `notify`, and leaves `note.told.newNode` undefined.
  - In `behind-installed.test.js`: `"says nothing of a new node, and asks no plutil"`.
    - Set up the world as `tests/behind-access.test.js` "asks the agent to look when no run is at work, and says the line" does: `worldOf(t)`, with `agentNode` a stand-in that counts its calls and gives `NEW_NODE`.
    - Running `behind` installed gives `said` of `[NEWEST]` alone.
    - The `agentNode` stand-in was called 0 times, and no kick was made.
  - In `import-access.test.js`, beside "a new node posts once, before the first touch of the drop folder" (:273): the same run, with `build: INSTALLED` in its deps, posts no banner.
- [ ] **Step 2: Run `cd tool && node --test tests/access.test.js tests/behind-installed.test.js tests/import-access.test.js`.** Expected: FAIL in the three new cases.
- [ ] **Step 3: Write the code.**
  - `access.js`: add the option to both functions.
  - `edit.js` `accessFindingOf`: when `isInstalled(ctx.build)`, skip the second `findingOf` call, the one that works out `needsAccess` and calls `ctx.agentNode()`.
  - `unedited.js`: let the block run only when `episodic && !installed`, and pass `installed` to `postNewNodeIfDue`.
- [ ] **Step 4: Run the same three files, plus `tests/edit-guide-access.test.js` and `tests/unedited.test.js`.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/access.js tool/edit.js tool/unedited.js tool/tests/access.test.js tool/tests/behind-installed.test.js tool/tests/import-access.test.js`, then `git commit -m "Studio app phase 3: no new-node notice on an installed Mac, whose grants are the app's"`.

---

### Task 5: Repair and update wording in installed mode

**The lines that change.** Only the lines whose dev words name `install.sh` or "Jason has a newer…" change here, and only in installed mode:
- `edit.js` `contextFor`'s not-set-up line (:385);
- `newerWhy` (:451) and every call to it;
- `couldNotAsk` (:2136) and its three calls (in `lateCheckOwed`, `retry` and `look`);
- `plan.js` `notWritten` (:332) and its three calls (:378, :386, :409).

**Left as they are (decided):**
- `episode.js:688`, the error `writeEpisode` throws (`NEWER`). Every command checks `readEpisode`'s `newer` first, through `newerWhy`, so this is only a backstop, and `episode.js` knows no mode.
- `settings.js` `MEND_SETTING` and `usable` (:238, :247): they are Jason's own command line.
- The `unedited.js` log lines (:1518, :1725, :1731, :1780): they go to the log, not the chat.
- `NO_COMMAND_LINE` and the "Ask Jason" lines in `access.js`: the wider move away from "her" and "Jason" waits for the brand-configurable project.
- `guide.js`: the contract.

**Files:**
- Modify: `tool/edit.js`, `tool/plan.js`.
- Test: `tool/tests/installed-words.test.js`

**Interfaces:**
- Consumes: `isInstalled`, `repairLine` and `UPDATE_SAY` (Task 1), and `ctx.build` (Task 3).
- Produces:
  - `newerWhy(record, build)`:
    - installed: `` `That is ${newerName(record)}. ${UPDATE_SAY}` ``;
    - otherwise, today's words.
    - Every one of the 13 calls passes `ctx.build` (`grep -n "newerWhy(" tool/edit.js`; each has `ctx` in scope). `editKit`'s entry (:7028) becomes `newerWhy: (record) => newerWhy(record, ctx.build)`, so `footage.js` and `join.js` get it unchanged.
  - `couldNotAsk(e, build)`:
    - installed: `` `The launch agent ${AGENT} could not be asked to look (${…as today…}). ${repairLine(build)}` ``.
  - `contextFor` with no settings:
    - installed: `` { why: `This Mac is not set up for episodes yet. ${repairLine(build)}` } ``.
  - `notWritten(e, build)` (plan.js, exported):
    - installed `NEWER`: `'a newer BRIMM Video Studio wrote it: say "update Studio" to update this Mac'`, with no closing full stop, since its callers add one;
    - every other code as today. The calls pass `ctx.build`.

- [ ] **Step 1: Write the failing tests.** `INSTALLED` is Task 3's. Each test file (here, and `import-access.test.js` in Task 4) keeps its own copy.
  - `"says a Mac that is not set up to choose Repair"`:
    - `contextFor({ home: emptyHome, build: INSTALLED }).why` is `"This Mac is not set up for episodes yet. Open BRIMM Video Studio and choose Repair. If that does not help, ask help@example.invalid."`;
    - with `support: ""` the line ends at "Repair.";
    - with `build: { mode: "dev" }` it is today's line.
  - `"says an episode a newer Studio wrote is for an update, for every command that names an episode"`:
    - make the episode as `tests/edit-gate.test.js` "the gate, a record of a layout newer…" does (:434-442);
    - walk the same `SCOPED` list (but `show`) with `build: INSTALLED`;
    - every line that holds "a newer BRIMM Video Studio wrote" ends with `Say "update Studio" to update this Mac.`, and no line holds "Jason has a newer".
  - `"says the agent that could not be asked to choose Repair"`: as `tests/edit-look.test.js` "a kickstart that throws…" (:76), with `build: INSTALLED`, `said` is `["The launch agent com.thebrimm.unedited could not be asked to look (no such service). Open BRIMM Video Studio and choose Repair. If that does not help, ask help@example.invalid."]`.
  - `"says a plan a newer Studio wrote is for an update"`:
    - `notWritten({ code: "NEWER" }, INSTALLED)` is `'a newer BRIMM Video Studio wrote it: say "update Studio" to update this Mac'`;
    - `notWritten({ code: "NEWER" })` is today's line;
    - `notWritten({ code: "CHANGED" }, INSTALLED)` is today's `CHANGED` line.
- [ ] **Step 2: Run `cd tool && node --test tests/installed-words.test.js`.** Expected: FAIL.
- [ ] **Step 3: Write the code** as the Interfaces block says.
- [ ] **Step 4: Run** `cd tool && node --test tests/installed-words.test.js tests/edit-gate.test.js tests/edit-look.test.js tests/edit.test.js tests/edit-plan.test.js tests/edit-footage.test.js tests/join.test.js`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/edit.js tool/plan.js tool/tests/installed-words.test.js`, then `git commit -m "Studio app phase 3: installed Macs are told to choose Repair or say update Studio, with the support contact"`.

---

### Task 6: the `update` command

**Files:**
- Modify: `tool/edit.js`: add `updateCommand` beside `behind`; add `update` to `COMMANDS` (:7114); add its lines to `HELP`, just after `behind`'s.
- Modify: `tool/gate.js`, `UNSCOPED` (:14): add `"update"`.
- Modify: `README.md` (the command list in `tool/edit.js`'s row, line 21): add the Mac app's `update` after `resolve`.
- Modify tests:
  - `tests/guard-cases.js` `ALLOWED`;
  - `tests/guard-open.test.js` :506;
  - `tests/edit-labels.test.js` `TODAY_ASKED` (:108), `walkWords` (:1262) and the walk's `words` map (:1453);
  - `tests/edit-refs.test.js` `WALK` (:638);
  - `tests/edit-gate.test.js` :198;
  - `tests/studio-name.test.js` `ALLOWED`;
  - `tests/fixtures/today-says.json`, rewritten with `UPDATE_TODAY=1`.
- Test: `tool/tests/edit-update.test.js`

**Interfaces:**
- Consumes: `isInstalled` (Task 1), `ctx.build` (Task 3), and `ctx.deps.run || runProgram`, called as `behind` calls it.
- Produces:
  - `CHECK_FOR_UPDATES_URL = "brimm-video-studio://check-for-updates"`, exported from edit.js.
  - `UPDATE_OPEN_MS = 10000`.
  - `update`, which ignores any words after it, as `behind` does.

**What `update` does:**
- **Installed:** `run("/usr/bin/open", [CHECK_FOR_UPDATES_URL], { limit: UPDATE_OPEN_MS })`.
  - On `code === 0` and not `outOfTime`, it says `BRIMM Video Studio is checking for updates: its own window takes over from here. Once it has updated and opened again, start a new chat.` and gives back 0.
  - Otherwise it says `` `BRIMM Video Studio could not be opened to check for updates. Open it from the Applications folder and choose Check for Updates….${build.support ? ` If that does not help, ask ${build.support}.` : ""}` `` and gives back 1.
- **Dev:** it runs nothing, says `This Mac runs BRIMM Video Studio from a git checkout, so it is not updated from here. Ask Jason to update it when it suits. (Jason: when no import is at work, pull main in the checkout.)` and gives back 0.

**Decisions:**
- `update` names no episode, so it goes in `UNSCOPED`. That puts it in `open-lock.js` `HELD_COMMANDS` by itself, so a chat that holds a session's words may run it. It prints no session words and sends nothing.
- No guard rule is added: both guards already let any `edit.js` command through in the skill's one spelling.
- `behind`'s HELP line stays word for word.

The HELP lines (the column as for `behind`):

```
  node edit.js update                   open BRIMM Video Studio's own check for updates, whose window takes over from
                                        there; in a git checkout it says how that Mac is updated instead, and opens nothing
```

- [ ] **Step 1: Write the failing tests** in `tests/edit-update.test.js`, with `setup()` from `episodes.js` and a `run` stand-in that writes down its calls:
  - `"on an installed Mac opens the app's check for updates, and says its window takes over"`:
    - `runs` deep-equals `[["/usr/bin/open", "brimm-video-studio://check-for-updates"]]`;
    - `[code, said]` is `[0, ["BRIMM Video Studio is checking for updates: its own window takes over from here. Once it has updated and opened again, start a new chat."]]`.
  - `"says how to check by hand when the app cannot be opened"`: with `run` giving `{ code: 1, stderr: "No application knows how to open URL" }`, `[code, said]` is `[1, ["BRIMM Video Studio could not be opened to check for updates. Open it from the Applications folder and choose Check for Updates…. If that does not help, ask help@example.invalid."]]`.
  - `"in a git checkout says how that Mac is updated, and runs nothing"`: with `build: { mode: "dev" }`, and again with no `build` at all, `[code, said]` is `[0, ["This Mac runs BRIMM Video Studio from a git checkout, so it is not updated from here. Ask Jason to update it when it suits. (Jason: when no import is at work, pull main in the checkout.)"]]`, and `runs` deep-equals `[]`.
  - `"takes no words: any after it change nothing"`: `update now please`, installed, makes the same single call.
  - `"is listed wherever edit.js's commands are"`:
    - `COMMAND_NAMES.includes("update")`;
    - `HELP.includes("  node edit.js update ")`;
    - `UNSCOPED.includes("update")`;
    - `README.md` holds `` `update` `` in `tool/edit.js`'s row.
- Then add `update` to the shared tables. Each holds every command, so a new one fails until it is added:
  - `guard-cases.js` `ALLOWED`: `` [`${EDIT} update`, ["update"]] `` (both guards' suites walk it);
  - `guard-open.test.js` :506: add `"update"` to the list a held chat may run;
  - `edit-labels.test.js`:
    - `TODAY_ASKED`: `update: []`, with a comment that `tests/edit-update.test.js` pins its words;
    - `walkWords`: `update: [[]]`;
    - the `words` map at :1453: `update: [[]]`;
  - `edit-refs.test.js` `WALK`: `update: [[]]`;
  - `edit-gate.test.js` :198: add `["update"]`;
  - `studio-name.test.js` `ALLOWED`: `{ file: "edit.js", has: "brimm-video-studio://", why: "the app's URL scheme (design 5), which the app registers" }`.
- [ ] **Step 2: Run** `cd tool && node --test tests/edit-update.test.js tests/gate.test.js tests/edit-labels.test.js`. Expected: FAIL. `update` is not a command, and `walkWords` is missing a name.
- [ ] **Step 3: Write the code.** Add `updateCommand`, `COMMANDS.update`, the HELP lines, `UNSCOPED`, and the README entry.
- [ ] **Step 4: Rewrite and check today's output.**
  - Run `cd tool && UPDATE_TODAY=1 node --test tests/edit-labels.test.js`.
  - `git diff tool/tests/fixtures/today-says.json` must show only the two new HELP lines, in each HELP that file holds. Anything else means today's output changed: stop and find out why.
  - Then run `cd tool && node --test tests/edit-update.test.js tests/gate.test.js tests/edit-gate.test.js tests/edit-labels.test.js tests/edit-refs.test.js tests/guard.test.js tests/guard-open.test.js tests/studio.test.js tests/studio-name.test.js tests/contract.test.js`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/edit.js tool/gate.js README.md tool/tests/edit-update.test.js tool/tests/guard-cases.js tool/tests/guard-open.test.js tool/tests/edit-labels.test.js tool/tests/edit-refs.test.js tool/tests/edit-gate.test.js tool/tests/studio-name.test.js tool/tests/fixtures/today-says.json`, then `git commit -m "Studio app phase 3: edit.js update opens the app's own check for updates"`.

---

### Task 7: the skills

**Files:**
- Modify: `tool/studio/SKILL.md` and `tool/studio/SKILL-open.md`. Their `## At the start of each session` paragraph is the one that starts "Run `behind`." (:14 in both). Their "What she says" table gets a row after the "Look again" row (:133 in SKILL.md).
- Test: `tool/tests/studio.test.js`
- `CLAUDE.md` and `CLAUDE-open.md` in `tool/studio/` say nothing about updating, so they stay as they are.

**Interfaces:**
- Consumes: the lines from Tasks 3 and 6. The skill quotes their first words.

The paragraph becomes this, in both files. It keeps the sentences about the lock as they are, and the git checkout's line word for word (`tests/studio-name.test.js` :125 pins it):

> Run `behind`. If it says "This folder's lock is changed on this Mac", tell her: "Something in this Claude folder's setup has changed; ask Jason before going on." Then stop: run nothing else, not even `episodes`, and show her nothing of what it says after that line. If it says "Jason has a newer BRIMM Video Studio", tell her: "Jason has a newer BRIMM Video Studio; ask him to update this Mac when it suits." If it says "A newer BRIMM Video Studio is ready", tell her that line as it is said, in one line, and that she can say "update Studio" whenever it suits. If it says "Her folder for Claude is out of date", tell her: "Your Claude folder needs an update from Jason; ask him when it suits." If a line says to open BRIMM Video Studio and choose Repair, tell her that line as it is said.

The new row, in both files:

> | "Update Studio" | `update`: tell her what it says, in plain words. |

- [ ] **Step 1: Write the failing test** in `studio.test.js`, next to "runs behind, then episodes…" (:521):

```js
it("passes the update line on in one line, offers \"update Studio\", and keeps a git checkout's line (Studio app, phase 3)", () => {
  for (const name of ["SKILL.md", "SKILL-open.md"]) {
    const text = readFileSync(new URL(`../studio/${name}`, import.meta.url), "utf8");
    const start = sectionOf(text, "## At the start of each session");
    for (const words of [
      'If it says "Jason has a newer BRIMM Video Studio", tell her: "Jason has a newer BRIMM Video Studio; ask him to update this Mac when it suits."',
      'If it says "A newer BRIMM Video Studio is ready", tell her that line as it is said, in one line, and that she can say "update Studio" whenever it suits.',
      'If it says "Her folder for Claude is out of date", tell her: "Your Claude folder needs an update from Jason; ask him when it suits."',
      "If a line says to open BRIMM Video Studio and choose Repair, tell her that line as it is said."
    ]) assert.ok(start.includes(words), `${name}: ${words}`);
    assert.equal(lineOf(text, '| "Update Studio" |'), '| "Update Studio" | `update`: tell her what it says, in plain words. |', name);
  }
});
```

  Import `lineOf` from `./skill-rows.js` if the file does not already import it. Each quoted trigger is the start of a line that a test pins: the newer line in Task 3, today's dev lines in `edit-show` and `behind-toolchain`, and the stale line in `behind-toolchain` :124.
- [ ] **Step 2: Run `cd tool && node --test tests/studio.test.js`.** Expected: FAIL in the new test.
- [ ] **Step 3: Edit both skills** as above.
- [ ] **Step 4: Run** `cd tool && node --test tests/studio.test.js tests/studio-name.test.js tests/studio-open.test.js tests/studio-ready.test.js`. Expected: PASS. That includes "runs only commands edit.js has", which now finds `update`, and the line limit of under 270.
- [ ] **Step 5: Commit.** `git add tool/studio/SKILL.md tool/studio/SKILL-open.md tool/tests/studio.test.js`, then `git commit -m "Studio app phase 3: the skills pass the update line on, and run update on \"update Studio\""`.

---

### Task 8: main checks that take any spelling of the path

This task does not depend on the others, and can be built at any point.

**Files:**
- Create: `tool/is-main.js`
- Modify: the four checks (`grep -n "process.argv\[1\] && resolve" tool/*.js`):
  - `access.js:335`
  - `edit.js:7167`
  - `settings.js:1402`
  - `unedited.js:1800`
- Test: `tool/tests/is-main.test.js`

**Interfaces:**
- Produces: `isMain(metaUrl: string, argv1 = process.argv[1]) -> boolean`.
  - It gives false when there is no `argv1`.
  - Otherwise it compares `statSync(resolve(argv1))` and `statSync(fileURLToPath(metaUrl))`: true when `dev` and `ino` are both equal.
  - If either stat throws, it falls back to `resolve(argv1) === fileURLToPath(metaUrl)`.
  - Why this works: Node names the main module by its real path, so the spellings can differ while the file is the same. A symlinked folder, `/var` against `/private/var`, and the `/System/Volumes/Data/…` firmlink are each one file.
  - `is-main.js` imports only `node:fs`, `node:path` and `node:url`.
- Each check becomes `if (isMain(import.meta.url)) {` (for access.js, `if (isMain(import.meta.url)) process.exitCode = …`). Remove any import that this leaves unused.

- [ ] **Step 1: Write the failing tests:**
  - `"is the same file however its path is spelled"`:
    - in `mkdtempSync(join(tmpdir(), "brimm main "))`, make `real dir/x.js` and a symlink `linked dir` → `real dir`;
    - with `url = pathToFileURL(realpathSync(join(real, "x.js"))).href`, each of these is true: `isMain(url, join(linked, "x.js"))`; `isMain(url, join(dir, "real dir", "x.js"))` (here `tmpdir()` is `/var/folders/…`, which is `/private/var/…` for real); and `isMain(url, "/System/Volumes/Data" + realpathSync(join(real, "x.js")))`, skipped when that path is not there;
    - another file, `isMain(url, undefined)` and a missing path are each false.
  - `"runs each entry point's main from a folder with spaces reached through a link, and by its Data-volume spelling"`:
    - `tool` is `fileURLToPath(new URL("..", import.meta.url))`;
    - `linked` is a symlink `<tmp>/with space/linked tool` → `tool`;
    - `home` is a temp folder;
    - for each `[file, args, first]` of `[["edit.js", ["--help"], "The command line for episodes on this Mac."], ["settings.js", ["--help"], "This Mac's settings for episodes"], ["unedited.js", ["--help"], "For a video that is not edited yet"], ["access.js", ["--setup-line"], "  Files and Folders, at the end:"]]`, and each folder of `[linked, "/System/Volumes/Data" + realpathSync(tool)]` (the second skipped when it is not there):
      - run `spawnSync(process.execPath, [join(folder, file), ...args], { env: { PATH: process.env.PATH, HOME: home, BRIMM_VIDEO_HOME: home }, encoding: "utf8", timeout: 30000 })`;
      - it ends with `status === 0`, and `stdout.startsWith(first)`.
- [ ] **Step 2: Run `cd tool && node --test tests/is-main.test.js`.** Expected: FAIL. The module is not found; once it is, the linked-folder runs print nothing.
- [ ] **Step 3: Write `tool/is-main.js`, and change the four checks.**
- [ ] **Step 4: Run** `cd tool && node --test tests/is-main.test.js tests/access.test.js tests/settings.test.js tests/load-each.test.js`. Expected: PASS.
- [ ] **Step 5: Commit.** `git add tool/is-main.js tool/access.js tool/edit.js tool/settings.js tool/unedited.js tool/tests/is-main.test.js`, then `git commit -m "Studio app phase 3: the main-script checks compare files, so a path with spaces, a link or the Data volume still runs main"`.

---

### Final check

- [ ] `cd tool && node --test`. Every test passes, with `contract.test.js`'s hashes unchanged.
- [ ] `git diff a25a1a2 --stat -- tool/shared tool/lib.js tool/run.js tool/guide.js tool/guide-note.js tool/handoff.js tool/handoff-v2.js tool/install.sh`, setting aside what Phases 1 and 2 changed. Expected: nothing from this phase.
- [ ] `git diff a25a1a2 -- tool/tests/fixtures` shows only `today-says.json`, and only the two HELP lines of `update`.
- [ ] `grep -n "newerWhy(" tool/edit.js`: every call passes `ctx.build`. `grep -n "/usr/bin/git" tool/edit.js`: still one line, inside `behind`'s dev branch.
- [ ] `grep -rn "fetch" tool/*.js`: `fetch` appears only in `update-check.js`, and in `edit.js`'s `behind` passing it on.
