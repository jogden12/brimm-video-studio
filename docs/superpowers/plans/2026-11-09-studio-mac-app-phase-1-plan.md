# Studio runs without git or Xcode's tools (phase 1): the task plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a Mac with no Xcode command line tools, nothing in Studio starts `git`, `swift`, `/usr/bin/python3` or xcode-select's install dialog. The five helpers run compiled, from beside node, when they are there. Dev mode (a git checkout with Xcode's tools, as every Mac is today) keeps working exactly as before after an ordinary `git pull`.

**Architecture:** One new module, `tool/helpers.js`, is the only place that knows where a helper is. It looks for `brimm-<name>` in node's own folder (`dirname(process.execPath)`) and, when that is not there, uses `swift tool/<name>.swift` if `findPrograms` found Xcode's swift. Every user of a helper asks it, passing the `swift` it already gets from `tools` and the new `tools.bin`: the panel, the face finder, the uploaded flag, online-only and the read-through. The new `tool/read-through.swift` replaces the python3 program in `dropbox.js`, which stays only as the fallback when Xcode's tools are here. git runs only where the checkout has its own `.git`. `tool/build-helpers.js` compiles the five with `swiftc` into a folder, for Phase 6's `build-app.sh` and for a by-hand try.

**Tech Stack:** Node 22+, `node:test`, no packages. Swift (Darwin, Foundation, AppKit, Vision), compiled by `swiftc` for `arm64-apple-macos13.0`.

**Spec:** `docs/superpowers/specs/2026-11-09-studio-mac-app-design.md`, part 6, "Nothing at run time needs Xcode's tools". The phase table is `docs/superpowers/plans/2026-11-09-studio-mac-app-build-plan.md`, row 1.

## Global Constraints

- **Tests first.** Each task's tests are seen failing before its code. `cd tool && node --test <file>` while working; the whole suite (several minutes) at Task 8.
- **Fixed helper names.** The helpers are `brimm-faces`, `brimm-progress`, `brimm-uploaded` and `brimm-online-only` (from the four `tool/*.swift`), and `brimm-read-through` (new: `tool/read-through.swift`).
  - They sit beside the node that runs Studio: `dirname(process.execPath)`.
  - No environment variable or setting names another folder. The `bin` parameters below exist for tests: at run time `bin` is always node's own folder.
- **Fallbacks.** Studio falls back to `swift <file>.swift`, and to `/usr/bin/python3` for the read-through, only when Xcode's command line tools are present: `/usr/bin/xcode-select -p` ends with 0, exactly as today.
  - xcode-select is asked only when no compiled helper is there.
- **git** runs only where `<checkout>/.git` exists. That `.git` may be a folder, or a worktree's file.
- **`tool/run.js` (`findTools`) does not change.** It is a copy from brimm-operations, so `findPrograms` passes it a PATH with node's folder first instead.
- **Untouched files** (checked in Task 8):
  - `tool/shared/`, `tool/lib.js`, `tool/run.js` and `tool/guide.js`;
  - `tool/handoff.js`, `tool/handoff-v2.js` and `tool/tests/fixtures/`;
  - `tool/install.sh`, which is Phase 4's;
  - `tool/move-app/`, which is retired in Phase 8.
  - `madeBy` stays `brimm-video <short commit>`, and `contract.test.js` passes with the same hashes.
- **Dev mode keeps every message word for word.** For example:
  - "No progress panel is shown: swift, which draws it, is not installed."
  - "swift, which finds the faces, is not installed"
  - "This Mac has the newest BRIMM Video Studio."
  - New words appear only in cases dev mode never meets: `NO_READ_THROUGH` and `build-helpers.js`'s lines.
- **No test runs `swiftc`, the network, the real `claude`, HyperFrames or HeyGen.**
  - One test (Task 5) runs `swift tool/read-through.swift`, as `progress.test.js` already runs `swift progress.swift --print`.
  - Such a test is skipped unless `hasXcodeTools()` is true. A skip test never runs `swift --version`, which opens the install dialog on a Mac without the tools.
- **A new test that resolves a helper names its `bin`.** That is either a temp folder holding a file `brimm-<name>`, or `NO_BIN = "/no/such/folder"`.
  - No new test relies on node's own folder having no helper in it. In dev mode Homebrew's node runs from `/opt/homebrew/Cellar/node/<v>/bin`, which holds only node, npm and npx.
- **Helpers compiled for a try go in a scratch folder.** Never in node's own folder, never in the checkout's `tool/`, never in a drop folder. Never use one of Sallie's real videos.
- **Code style.** Comments and messages in the code's own style: plain, full-sentence English.
- **Line references** are to `app-development` at a25a1a2, checked against that code.
- **People and permissions.** Builders and fixers run on Sonnet 5.5, reviewers on Opus 5.5. Push, pull requests and merges wait for Jason's yes. Each commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## The resolver: `tool/helpers.js`, used by every task

```js
/** The helpers, by name: each is tool/<name>.swift, compiled as brimm-<name>. */
export const HELPERS = ["faces", "progress", "uploaded", "online-only", "read-through"];
/** The folder of the node that runs Studio: in the app, where its programs and compiled helpers are. */
export const ownBin = () => dirname(process.execPath);
/** The absolute path of tool/<name>.swift. */
export function helperSource(name)                                                  // string
/** brimm-<name> in `bin`, when it is there. */
export function compiledHelper(name, { bin = ownBin(), exists = existsSync } = {})    // { program, args: [] } | null
/** The compiled helper, else swift with the helper's source when `swift` is given, else none. */
export function helperCommand(name, { swift = "", bin = ownBin(), exists = existsSync } = {})  // { program, args } | null
/** Whether Xcode's command line tools are on this Mac. Moved here unchanged from unedited.js:98. */
export const hasXcodeTools = () => spawnSync("/usr/bin/xcode-select", ["-p"], { stdio: "ignore" }).status === 0;
```

- `helperSource`, `compiledHelper` and `helperCommand` throw `new Error(\`There is no helper named ${name}.\`)` for a name not in `HELPERS`.
- A caller starts `program` with `[...args, ...its own arguments]`, never through a shell.
- `findPrograms` (Task 2) returns `bin`. Everything that gets `tools` passes `bin: tools.bin` and `swift: tools.swift`.
- When `bin` is `undefined`, as in a test's hand-made `tools`, the default applies.

## Order

1. Task 1 comes first.
2. Tasks 2, 3, 4, 5 and 7 need it, and run in that order. Tasks 4 and 5 both change `dropbox.js`.
3. Task 6 needs nothing else, and may run at any point.
4. Task 8 comes last.

## Review Focus

1. **A compiled helper that is there but cannot run.** Examples: it lost its execute bit, or it was built for the wrong architecture.
   - Expected: that one use fails the way a failing helper does today. The failure is said in plain words, and the work goes on.
   - Nothing falls back to swift or python3 after it: on that Mac they would open the install dialog.
   - Tests: Task 3 (panel, EACCES) and Task 5 (reader, EACCES; python3 is not tried).
2. **Paths with spaces, apostrophes, quotes and `$`.** The app is "BRIMM Video Studio.app", and her files are "Sallie's …".
   - Expected: the helper's path and the file go to the program as separate arguments, never through a shell.
   - Expected: the compile script writes correctly into such a folder.
   - Tests: Task 4 U4, Task 5 R1 and Task 7.
3. **A worktree, whose `.git` is a file.** Expected: dev mode still names its commit in every record. Test: Task 6.
4. **A Mac with both a compiled helper and Xcode's tools.** Examples: the Mac Studio after a by-hand try, or a dev Mac that later runs the app.
   - Expected: the compiled helper is used, and xcode-select is not asked.
   - Tests: Tasks 1, 2, 3 and 5.
5. **The quiet-time stop, with the compiled reader.** Expected: a placeholder that Dropbox never brings down still never holds a run.
   - After the quiet time the reader is killed with SIGKILL, and the run is told so in plain words.
   - Test: Task 5's behaviour tests run once for each reader.

---

### Task 1: `tool/helpers.js`, the one place that knows where a helper is

**Files:**
- Create: `tool/helpers.js`
- Create: `tool/tests/helpers.test.js`
- Modify: `README.md:12-24` (a row for `tool/helpers.js` in "What is where")

**Interfaces:**
- Consumes: nothing.
- Produces: the block in "The resolver" above, exactly.

- [ ] **Step 1: Write the failing test** (`tool/tests/helpers.test.js`, with a header comment in the style of the others: what is tested, and that nothing here starts a program)

```js
const BIN = "/app/BRIMM Video Studio/bin";
describe("where a helper is", () => {
  it("is one of five, each named for its Swift file beside the tool", () => {
    assert.deepEqual(HELPERS, ["faces", "progress", "uploaded", "online-only", "read-through"]);
    for (const name of ["faces", "progress", "uploaded", "online-only"]) {
      assert.ok(helperSource(name).endsWith(`/tool/${name}.swift`), name);
      assert.ok(existsSync(helperSource(name)), name);
    }
  });
  it("is brimm-<name> in node's own folder, when it is there", () => {
    const there = (p) => p === `${BIN}/brimm-online-only`;
    assert.deepEqual(compiledHelper("online-only", { bin: BIN, exists: there }), { program: `${BIN}/brimm-online-only`, args: [] });
    assert.equal(compiledHelper("faces", { bin: BIN, exists: there }), null);
  });
  it("is looked for beside the node that runs Studio unless a folder is given", () => {
    const looked = [];
    compiledHelper("uploaded", { exists: (p) => (looked.push(p), false) });
    assert.equal(ownBin(), dirname(process.execPath));
    assert.deepEqual(looked, [join(dirname(process.execPath), "brimm-uploaded")]);
  });
  it("is the compiled one before swift, swift with its source only when there is none, and none without either", () => {
    const all = () => true;
    const none = () => false;
    assert.deepEqual(helperCommand("progress", { swift: "/usr/bin/swift", bin: BIN, exists: all }), { program: `${BIN}/brimm-progress`, args: [] });
    assert.deepEqual(helperCommand("progress", { swift: "/usr/bin/swift", bin: BIN, exists: none }), { program: "/usr/bin/swift", args: [helperSource("progress")] });
    assert.equal(helperCommand("progress", { swift: "", bin: BIN, exists: none }), null);
    assert.deepEqual(helperCommand("faces", { swift: "", bin: BIN, exists: all }), { program: `${BIN}/brimm-faces`, args: [] });
  });
  it("is never a helper it does not know, however it is spelled", () => {
    for (const name of ["online_only", "brimm-faces", "faces.swift", ""]) {
      assert.throws(() => helperCommand(name, { exists: () => true }), { message: `There is no helper named ${name}.` });
    }
  });
});
```

- [ ] **Step 2: Run the test and see it fail**

Run: `cd tool && node --test tests/helpers.test.js`
Expected: FAIL, because the module `../helpers.js` cannot be found.

- [ ] **Step 3: Write `tool/helpers.js`**

Use the signatures in "The resolver". Its header comment says three things:
- why the helpers are compiled (Xcode's tools are not on an installed Mac);
- where they are (node's own folder);
- when swift is used instead (only when `findPrograms` found Xcode's swift).

- [ ] **Step 4: Run the test and see it pass**

Run: `cd tool && node --test tests/helpers.test.js`
Expected: PASS.

- [ ] **Step 5: Add the README row, then commit**

The row: `| \`tool/helpers.js\` | Where Studio's five helpers are: compiled, as brimm-<name> beside node, in the app; run by swift from their .swift files on a Mac with Xcode's command line tools |`

```bash
git add tool/helpers.js tool/tests/helpers.test.js README.md
git commit -m "Studio app phase 1, task 1: helpers.js, the one place that knows where a helper is"
```

---

### Task 2: `findPrograms` looks in node's own folder first, and the face finder goes through the resolver

**Files:**
- Modify: `tool/unedited.js`:
  - `:66-69`: `FACES` goes, and `FACES_PRINTED` stays;
  - `:96-98`: `hasXcodeTools` is removed and imported from `helpers.js`;
  - `:100-119`: `findPrograms`;
  - `:373-398`: `facesIn`.
- Test: `tool/tests/unedited.test.js:982-1030` ("before it starts")
- Test: `tool/tests/faces.test.js`

**Interfaces:**
- Consumes: `ownBin`, `helperCommand` and `hasXcodeTools` (Task 1).
- Produces: `findPrograms({ exists = existsSync, env = process.env, xcodeTools = hasXcodeTools, bin = ownBin() } = {})`, which returns `{ ffmpeg, whisper, model, missing, ffprobe, swift, claude, bin }`.
  - `bin` is the folder looked in first, and the one compiled helpers are looked for in. Tasks 3 and 4 read it as `tools.bin`.
  - Order for ffmpeg and whisper (through `findTools`, given `env: { ...env, PATH: [bin, ...path].join(":") }`): node's folder, then PATH, then Homebrew's folders.
  - Order for ffprobe: beside ffmpeg, then `bin`, then PATH, then Homebrew's folders.
  - Order for claude: `bin`, then PATH, then Homebrew's folders, then `~/.local/bin`.
  - swift is found as before: PATH, then `/usr/bin`, only when `xcodeTools()` is true. It is never looked for in `bin`.
- `facesIn(file, work, { run, tools, limit })` keeps its shape. Its finder is `helperCommand("faces", { swift: tools.swift, bin: tools.bin })`, started as `run(finder.program, [...finder.args, stillsFolder], { out: FACES_PRINTED, ...limit })`.
  - With no finder it gives `{ why: "swift, which finds the faces, is not installed" }`, as today.

- [ ] **Step 1: Write the failing tests**

In `unedited.test.js` "before it starts":
- `const BIN = "/app/BRIMM Video Studio/bin";`
- The helper `found` passes `bin: BIN`.
- The deepEqual at :989 gains `bin: BIN`.

Then add:

```js
it("looks first in node's own folder, where the app keeps its programs, for ffmpeg, ffprobe, the transcriber and Claude Code", () => {
  const brew = ["/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe", "/opt/homebrew/bin/whisper-cli", "/opt/homebrew/bin/claude", MODEL];
  const app = ["ffmpeg", "ffprobe", "whisper-cli", "claude"].map((n) => `${BIN}/${n}`);
  const got = found([...brew, ...app], "/opt/homebrew/bin:/usr/bin");
  assert.deepEqual([got.ffmpeg, got.ffprobe, got.whisper, got.claude, got.missing], [...app, []]);
  // The transcriber's other name, whisper-cpp, is found there too.
  assert.equal(found([...brew.filter((p) => !p.endsWith("whisper-cli")), `${BIN}/whisper-cpp`], "/opt/homebrew/bin").whisper, `${BIN}/whisper-cpp`);
});
it("finds each program where it did before when node's folder holds only node, as Homebrew's does", () => {
  const cellar = "/opt/homebrew/Cellar/node/26.11.1/bin";
  const there = ["/opt/homebrew/bin/ffmpeg", "/opt/homebrew/bin/ffprobe", "/opt/homebrew/bin/whisper-cli", MODEL, `${cellar}/node`, `${cellar}/npm`];
  assert.deepEqual(findPrograms({ exists: (p) => there.includes(p), env: { HOME, PATH: "/usr/bin:/bin" }, xcodeTools: () => true, bin: cellar }),
    { ffmpeg: "/opt/homebrew/bin/ffmpeg", whisper: "/opt/homebrew/bin/whisper-cli", model: MODEL, ffprobe: "/opt/homebrew/bin/ffprobe", swift: "", claude: "", bin: cellar, missing: [] });
});
it("keeps the rest of the environment for the transcript tool's own finder: its model setting and the home folder", () => {
  assert.equal(findPrograms({ exists: () => true, env: { HOME, PATH: "/usr/bin", BRIMM_WHISPER_MODEL: "/models/m.bin" }, xcodeTools: () => false, bin: BIN }).model, "/models/m.bin");
  assert.equal(found([], "/usr/bin").model, MODEL);
});
it("names node's own folder as bin when it is given none", () => {
  assert.equal(findPrograms({ exists: () => false, env: { HOME, PATH: "" }, xcodeTools: () => false }).bin, dirname(process.execPath));
});
```

In `faces.test.js`:
- `world()`'s tools become `{ ffmpeg: "FFMPEG", swift: "SWIFT", bin: NO_BIN }`.
- The "without swift" test's tools become `{ ffmpeg: "FFMPEG", bin: NO_BIN }`, and its message is unchanged.
- The header's "the finder swift runs" becomes "the finder: brimm-faces beside node, or swift with faces.swift".

Then add:

```js
it("runs the app's own finder, brimm-faces beside node, when it is there, with the stills' folder its one argument, swift or no swift", async (c) => {
  const bin = mkdtempSync(join(tmpdir(), "brimm-bin-"));
  c.after(() => rmSync(bin, { recursive: true, force: true }));
  writeFileSync(join(bin, "brimm-faces"), "");
  for (const swift of ["", "SWIFT"]) {
    const w = world(c);
    assert.deepEqual(await facesIn("/in/reel.mp4", w.work, { run: w.run, tools: { ffmpeg: "FFMPEG", swift, bin }, limit: 180000 }), { stills: STILLS });
    const finder = w.asked[1];
    assert.deepEqual([finder.cmd, finder.args, finder.options.limit], [join(bin, "brimm-faces"), [join(w.work, "stills")], 180000]);
    assert.ok(finder.options.out >= 1000000);
  }
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `cd tool && node --test tests/unedited.test.js tests/faces.test.js`
Expected: FAIL. `bin` is missing from what `findPrograms` gives, and `SWIFT` is run in place of `brimm-faces`.

- [ ] **Step 3: Change `findPrograms` and `facesIn`**

Write them as in Interfaces. Rewrite `findPrograms`' doc comment (at :100-108) so that it names node's own folder first and says why.

- [ ] **Step 4: Run the tests and see them pass**

Run: `cd tool && node --test tests/unedited.test.js tests/faces.test.js tests/edit-workcopy-reel.test.js tests/closing-wired.test.js tests/ask-again.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/unedited.js tool/tests/unedited.test.js tool/tests/faces.test.js
git commit -m "Studio app phase 1, task 2: findPrograms looks in node's own folder first; the face finder through helpers.js"
```

---

### Task 3: the progress panel goes through the resolver

**Files:**
- Modify: `tool/progress.js`:
  - `:7-17`: import from `helpers.js`; `PANEL` becomes `helperSource("progress")`, the same path as today;
  - `:116-136`: the reporter's doc comment and its new `bin`;
  - `:205-222`: `showPanel`.
- Modify: `tool/edit.js:2630`, `:3971` and `:7093`, and `tool/unedited.js:1686`. Each passes `bin` from the same `findPrograms()` result (or `tools`) that gives it `swift`.
- Modify: `README.md:125-126`
- Test: `tool/tests/progress.test.js`:
  - `:14-33`: `setup` takes `bin`, by default `NO_BIN`, and passes it to the reporter;
  - `:449-478`: the panel tests;
  - `:497-499`: the skip condition of the real panel test.

**Interfaces:**
- Consumes: `helperCommand`, `helperSource` and `hasXcodeTools` (Task 1), and `tools.bin` (Task 2).
- Produces: `reporter({ folder, swift = "", bin, log, pid, now, start, alive, bootedAt, timer })`.
  - The panel is `helperCommand("progress", { swift, bin })`, started as `start(panel.program, [...panel.args, folder], { detached: true, stdio: "ignore" })`.
  - With no panel, the log says "No progress panel is shown: swift, which draws it, is not installed." once, as today.

- [ ] **Step 1: Write the failing tests** (in "the panel"; `helperFolder(name)` is a small test helper that makes a temp folder holding an empty file of that name)

```js
it("is the app's own panel, brimm-progress beside node, when it is there, with the folder its one argument, swift or no swift", () => {
  const bin = helperFolder("brimm-progress");
  for (const swift of ["", "/usr/bin/swift"]) {
    const t = setup({ swift, bin });
    t.r.begin("a.mov");
    assert.deepEqual(t.started, [{ cmd: join(bin, "brimm-progress"), args: [t.folder], options: { detached: true, stdio: "ignore" } }]);
    t.done();
  }
});
it("says an app's panel that cannot be started once in the log, as it says swift's, and never tries swift after it", () => {
  const bin = helperFolder("brimm-progress");
  const tried = [];
  const logs = [];
  const r = reporter({ folder: join(bin, "progress"), swift: "/usr/bin/swift", bin, log: (l) => logs.push(l), now: () => 0,
    start: (cmd) => { tried.push(cmd); throw Object.assign(new Error("spawn EACCES"), { code: "EACCES" }); } });
  r.begin("a.mov");
  r.begin("b.mov");
  assert.deepEqual([...new Set(tried)], [join(bin, "brimm-progress")]);
  assert.deepEqual(logs, ["The progress panel could not be shown (EACCES). The work goes on without it."]);
});
```

- The existing "is not shown without swift" test keeps its message, with the default `bin: NO_BIN`.
- The skip condition of "progress.swift, the panel itself" becomes `!hasXcodeTools()` in place of `spawnSync("swift", ["--version"])`.

- [ ] **Step 2: Run the tests and see them fail**

Run: `cd tool && node --test tests/progress.test.js`
Expected: FAIL. `/usr/bin/swift` is started, or nothing is.

- [ ] **Step 3: Change `progress.js` and the four call sites**

Write them as in Interfaces.

README :125-126: "It is drawn by `tool/progress.swift`: compiled, as `brimm-progress` beside node, in the app, and run by swift on a Mac with Xcode's command line tools. Without either there is no window, and the log says so once."

- [ ] **Step 4: Run the tests and see them pass**

Run: `cd tool && node --test tests/progress.test.js tests/edit-guide-app.test.js tests/unedited.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/progress.js tool/edit.js tool/unedited.js tool/tests/progress.test.js README.md
git commit -m "Studio app phase 1, task 3: the progress panel through helpers.js"
```

---

### Task 4: the uploaded flag and online-only go through the resolver

**Files:**
- Modify: `tool/dropbox.js:269-305`:
  - `UPLOADED` and `ONLINE_ONLY` become `helperSource(...)`, the same paths as today;
  - each function gets the new `bin`, and builds the helper's command.
- Modify: `tool/originals.js:346` and `:401`, which pass `bin: deps.tools && deps.tools.bin` beside `swift`.
- Test: `tool/tests/dropbox.test.js:465-527` (U1 to U3; a new U4)
- Test: `tool/tests/originals.test.js`: its header at :1-4, and a new O12 after O11 at :751.

**Interfaces:**
- Consumes: `helperCommand` and `helperSource` (Task 1), and `tools.bin` (Task 2).
- Produces:
  - `uploadedOf(path, { swift = "", bin, exec = execFileSync, timeoutMs = UPLOADED_TIMEOUT_MS } = {})`
  - `makeOnlineOnly(path, { swift = "", bin, exec, timeoutMs, said } = {})`
  - Each runs `exec(helper.program, [...helper.args, path], { encoding: "utf8", timeout: timeoutMs, stdio: ["ignore", "pipe", "ignore"] })`.
  - `helper` is `helperCommand("uploaded" | "online-only", { swift, bin })`. When it is null, each function gives null and runs nothing.
  - Both timeouts stay 20 s.

- [ ] **Step 1: Write the failing tests**

In `dropbox.test.js`, add `bin: NO_BIN` to every existing call in U1, U2 and the makeOnlineOnly test. Then:

```js
it("U4: asks brimm-uploaded and brimm-online-only beside node when they are there, with the file their one argument, and needs no swift", async () => {
  const { uploadedOf, makeOnlineOnly, UPLOADED_TIMEOUT_MS } = await import("../dropbox.js");
  const bin = mkdtempSync(join(tmpdir(), "brimm-bin-"));
  for (const name of ["brimm-uploaded", "brimm-online-only"]) writeFileSync(join(bin, name), "");
  const calls = [];
  const giving = (text) => (...args) => (calls.push(args), text);
  const file = "/Users/sallie/Dropbox/BRIMM Video/Episodes/2026-11-09 Sallie's talk (Mac Studio)/Original files/talk.mov";
  assert.equal(uploadedOf(file, { swift: "", bin, exec: giving('{"uploaded": true}') }), true);
  assert.equal(makeOnlineOnly(file, { swift: "/usr/bin/swift", bin, exec: giving('{"onlineOnly": true}') }), true);
  assert.deepEqual(calls.map(([cmd, args]) => [cmd, args]), [[join(bin, "brimm-uploaded"), [file]], [join(bin, "brimm-online-only"), [file]]]);
  assert.equal(calls[0][2].timeout, UPLOADED_TIMEOUT_MS);
  rmSync(bin, { recursive: true, force: true });
});
```

In `originals.test.js`, write O12 on O1's pattern (`world`, `local`, `moveIt`, `t.advance(LATE_CHECK_MS)`, `look`):

```js
it("O12: with no swift, the flag and the request to make the copy online-only are asked of the helpers beside node (tools.bin)", () => {
  // bin = join(t.dir, "bin") holds two stand-ins, each a /bin/sh script made executable (0o755). Each appends its "$1" to
  // join(t.dir, "asked.txt") and prints its document: {"uploaded": true} and {"onlineOnly": true}.
  look(t, depsOf(t, { uploaded: undefined, onlineOnly: undefined, tools: { swift: "", bin } }));
  assert.equal(existsSync(join(found.video, FILE)), false);
  assert.deepEqual(readFileSync(join(t.dir, "asked.txt"), "utf8").trim().split("\n"), [originalOf(found), originalOf(found)]);
  assert.ok(t.logs.some((l) => l.endsWith("its recording in Original files is made online-only.")), t.logs.join("\n"));
});
```

The header changes from "a stand-in gives that flag: no test runs swift" to: "a stand-in gives that flag, or, in O12, two stand-in helpers, short shell scripts in the test's own folder. No test runs swift."

- [ ] **Step 2: Run the tests and see them fail**

Run: `cd tool && node --test tests/dropbox.test.js tests/originals.test.js`
Expected: FAIL. U4 gets null, and in O12 the Mac's copy stays.

- [ ] **Step 3: Change `uploadedOf`, `makeOnlineOnly` and the two lines in `originals.js`**

Change their doc comments: "(no swift …)" becomes "(no helper: neither brimm-<name> beside node nor swift …)".

- [ ] **Step 4: Run the tests and see them pass**

Run: `cd tool && node --test tests/dropbox.test.js tests/originals.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/dropbox.js tool/originals.js tool/tests/dropbox.test.js tool/tests/originals.test.js
git commit -m "Studio app phase 1, task 4: the uploaded flag and online-only through helpers.js"
```

---

### Task 5: `brimm-read-through` replaces python3

**Files:**
- Create: `tool/read-through.swift`
- Modify: `tool/dropbox.js:145-201`. `READ_THROUGH` stays as the fallback, and its comment says so. Add `NO_READ_THROUGH` and `readThroughCommand`, and change `readThrough`.
- Modify: `README.md:193` ("The read is python3's …") and the table at `:12-24` (a row for `tool/read-through.swift`).
- Test: `tool/tests/dropbox.test.js`: `:1-17` (the header; `NO_BIN`; imports from `../helpers.js`) and `:320-417`.
- Test: `tool/tests/helpers.test.js` (one more test).

**Interfaces:**
- Consumes: `compiledHelper`, `helperSource` and `hasXcodeTools` (Task 1).
- Produces:

```js
export const NO_READ_THROUGH = "nothing on this Mac can bring it down: BRIMM Video Studio's own reader is not here, and nor are Xcode's command line tools";
export function readThroughCommand({ bin, exists, xcodeTools = hasXcodeTools } = {})
  // compiledHelper("read-through", { bin, exists }) || (xcodeTools() ? { program: "/usr/bin/python3", args: ["-I", "-c", READ_THROUGH] } : null)
export const readThrough = (path, { spawn: start = spawn, quietMs = READ_QUIET_MS, bin, xcodeTools } = {}) => Promise<void>
```

- When the command is null, `readThrough` rejects with `new Error(NO_READ_THROUGH)` and starts nothing.
- Otherwise it calls `start(cmd.program, [...cmd.args, path], { stdio: ["ignore", "pipe", "pipe"] })`, and everything after that is as today:
  - the quiet timer starts again with each chunk on standard output;
  - when it runs out: SIGKILL, and "Dropbox sent nothing of it for …, so it was given up";
  - on a non-zero end, the last line of standard error;
  - a start error, as it is.
- The callers do not change: `edit.js`, `finish.js`, `join.js`, `reading.js`, `references.js` and `unedited.js`.
- The helper's contract is `brimm-read-through <file>`:
  - after each read, its standard output gets the running total of bytes, a decimal number and a newline;
  - at the end of the file it ends with 0;
  - on any failure it ends with 1, after one line on standard error.

The body of `tool/read-through.swift` is pinned. It was tried on the Mac Studio on 2026-11-09 with `swift` and with `swiftc -O -target arm64-apple-macos13.0`: the last line was 9437185 for 9 MiB + 1 byte, and a missing file gave "No such file or directory" with exit 1.

```swift
// The read-through: it reads one file to its end, a mebibyte at a time, so that Dropbox brings all of it down to this Mac, as it
// does for a file that is there only as a placeholder (dropbox.js readThrough). It takes the place of python3, which only Xcode's
// command line tools bring.
//
//   brimm-read-through <file>
//
// Each program on a Mac has a setting for whether its reads of a file that is not here yet have the file brought down, and one the
// launch agent starts has it off: such a read is refused at once, with "Resource deadlock avoided" (EDEADLK; Apple's TN3150 and the
// getiopolicy_np manual). So it turns the setting on first, for itself alone, with setiopolicy_np:
// IOPOL_TYPE_VFS_MATERIALIZE_DATALESS_FILES (3), IOPOL_SCOPE_PROCESS (0), IOPOL_MATERIALIZE_DATALESS_FILES_ON (2).
// After each read it prints how much of the file it has read, one number to a line, written straight out so that each line
// reaches the tool at once. When the file cannot be read it says why in plain words, in one line on standard error, and ends
// with 1. What it reads is let go: it writes nothing. It runs only on a Mac, and nothing leaves the machine.
import Darwin

func stop(_ why: String) -> Never {
  fputs(why + "\n", stderr)
  exit(1)
}

guard CommandLine.arguments.count == 2 else { stop("Give it one file: brimm-read-through <file>") }
guard setiopolicy_np(3, 0, 2) == 0 else { stop("reads that bring a file down could not be turned on") }
let fd = open(CommandLine.arguments[1], O_RDONLY)
guard fd >= 0 else { stop(String(cString: strerror(errno))) }
var buffer = [UInt8](repeating: 0, count: 1048576)
var total = 0
while true {
  let got = buffer.withUnsafeMutableBytes { read(fd, $0.baseAddress, 1048576) }
  if got == 0 { break }
  if got < 0 {
    let failed = errno
    if failed == EINTR { continue }
    stop(String(cString: strerror(failed)))
  }
  total += got
  let line = "\(total)\n"
  _ = line.withCString { write(1, $0, strlen($0)) }
}
close(fd)
exit(0)
```

- [ ] **Step 1: Write the failing tests** (in `dropbox.test.js` "reading a file through")

- The stand-in `python` is renamed `reader`, and is otherwise unchanged.
- `APP_BIN` is a temp folder named `BRIMM Video Studio's bin`, which holds an empty file `brimm-read-through`.
- `const READERS = [{ name: "brimm-read-through", bin: APP_BIN, xcodeTools: () => false }, { name: "python3", bin: NO_BIN, xcodeTools: () => true }];`

```js
it("reads it with brimm-read-through beside node when it is there, the file its one argument, and asks nothing of Xcode's tools", async () => {
  let asked = 0;
  const p = reader({ reads: [[5, 4194304]] });
  const file = "/Users/sallie/Dropbox/BRIMM Video/Sallie's \"talk\" $HOME.mp4";
  await readThrough(file, { spawn: p.spawn, quietMs: 100, bin: APP_BIN, xcodeTools: () => ((asked += 1), true) });
  assert.deepEqual(p.runs, [{ cmd: join(APP_BIN, "brimm-read-through"), args: [file] }]);
  assert.equal(asked, 0);
});
it("with neither the app's reader nor Xcode's command line tools, starts nothing and says why in plain words", async () => {
  const p = reader();
  await assert.rejects(readThrough("/Dropbox/talk.mp4", { spawn: p.spawn, bin: NO_BIN, xcodeTools: () => false }), { message: NO_READ_THROUGH });
  assert.deepEqual(p.runs, []);
});
it("has read-through.swift turn on the reads that bring a file down before it opens the file, and read a mebibyte at a time", () => {
  const src = readFileSync(helperSource("read-through"), "utf8");
  assert.ok(src.includes("setiopolicy_np(3, 0, 2)") && src.indexOf("setiopolicy_np(") < src.indexOf("open("), "setiopolicy_np first");
  assert.match(src, /1048576/);
});
```

- The python3 test at :361 gets `bin: NO_BIN, xcodeTools: () => true`, and is renamed "falls back to python3 only when Xcode's command line tools are here: it first turns on, …". Its assertions are unchanged.
- The four behaviour tests at :373-392 each run once for every reader in `READERS`, named `${r.name}: …` and given `bin: r.bin, xcodeTools: r.xcodeTools`:
  - it waits while more keeps coming;
  - it gives up after the quiet time, and the kills are `["SIGKILL"]`;
  - it says why in the reader's words;
  - it says why when the reader cannot be started. For brimm-read-through the refusal is `spawn … EACCES`, and `p.runs.length` is 1, so python3 is not tried after it.
- The real python3 test at :396 passes `bin: NO_BIN` to both of its calls.
- New test, beside that one:

```js
const noSwift = process.platform !== "darwin" || !hasXcodeTools() ? "only a Mac with Xcode's command line tools has swift to run read-through.swift" : false;
it("reads a file that is here to its end with read-through.swift, run by the Mac's own swift, and says why for one that is not there", { skip: noSwift }, async () => {
  // As the python3 test at :396: 9 MiB and 1 byte; more than one line; the last line "9437185"; "gone.mp4" rejects with
  // "No such file or directory". bin is APP_BIN, so the compiled reader is the one chosen, and spawn runs its real program:
  // (cmd, args, opts) => { const child = spawn("swift", [helperSource("read-through"), ...args], opts); child.stdout.on("data", …); return child; }
});
```

In `helpers.test.js`:

```js
it("has one helper for each .swift file beside the tool", () => {
  assert.deepEqual(readdirSync(TOOL).filter((n) => n.endsWith(".swift")).map((n) => n.slice(0, -".swift".length)).sort(), [...HELPERS].sort());
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `cd tool && node --test tests/dropbox.test.js tests/helpers.test.js`
Expected: FAIL. `NO_READ_THROUGH` is not exported, python3 is started in place of brimm-read-through, and `read-through.swift` is missing.

- [ ] **Step 3: Write `tool/read-through.swift` (the body above), then change `dropbox.js` as in Interfaces**

- [ ] **Step 4: Run the tests and see them pass**

Run: `cd tool && node --test tests/dropbox.test.js tests/helpers.test.js tests/join.test.js`
Expected: PASS. The real-swift test runs on this Mac, which has the tools.

- [ ] **Step 5: Update the README, then commit**

README :193: "The read is BRIMM Video Studio's own reader, `brimm-read-through`, compiled from `tool/read-through.swift`. On a Mac with Xcode's command line tools and no compiled reader, python3 makes the read. Either first turns downloads on for itself alone: …" The rest of the paragraph stays as it is.

The table row: `| \`tool/read-through.swift\` | Reads one file to its end, a mebibyte at a time, with downloads turned on for itself alone, so that Dropbox brings a placeholder down; \`readThrough\` in \`tool/dropbox.js\` runs it, compiled as brimm-read-through |`

```bash
git add tool/read-through.swift tool/dropbox.js tool/tests/dropbox.test.js tool/tests/helpers.test.js README.md
git commit -m "Studio app phase 1, task 5: brimm-read-through takes python3's place; python3 only with Xcode's tools"
```

---

### Task 6: git runs only where the checkout has its own `.git`

**Files:**
- Modify: `tool/filing.js:156-162` (`isGitCheckout` is new; `commitOf` changes)
- Modify: `tool/edit.js:2862-2927` (`behind`'s doc comment, and one line before the fetch at :2916)
- Modify: `tool/tests/episodes.js`, near `agentPid` at :111, and `tool/tests/open-world.js:95-110` (`openDeps`). Each gets the stand-in `isGitCheckout: () => true`, with a comment: "No test looks for a real .git: the made-up checkout is a git checkout unless a test says otherwise (filing.js isGitCheckout)."
- Test: `tool/tests/filing.test.js:201-217`
- Test: `tool/tests/edit-show.test.js:218-283`

**Interfaces:**
- Produces: `isGitCheckout(checkout, { exists = existsSync } = {}): boolean`, which is `exists(join(checkout, ".git"))`.
- Produces: `commitOf(checkout, { spawn = spawnSync, exists = existsSync } = {}): string`.
  - Where `isGitCheckout` is false, it gives `"unknown"` and asks nothing.
  - Otherwise it works as today: `spawn("git", ["-C", checkout, "rev-parse", "--short", "HEAD"], { encoding: "utf8" })`, giving 7 or more hex characters, else "unknown".
  - The git half is a module-private function of its own. Phase 3 then puts `buildOf(checkout)` (build.json) in front of it as a one-line change.
- `behind` reads `(ctx.deps.isGitCheckout || isGitCheckout)(ctx.settings.checkout)`. When that is false, it runs no git and says no line about a newer version: Phase 3 says the update check's line there. It still says every line that needs no network, as when git cannot fetch (`return folderLine()`), and ends with 0.

- [ ] **Step 1: Write the failing tests**

`filing.test.js` "which BRIMM Video Studio wrote a record" (import `isGitCheckout`):

```js
it("is a git checkout only where the folder has a .git of its own: a folder, or a worktree's file", () => {
  const dir = mkdtempSync(join(tmpdir(), "brimm-filing-"));
  for (const name of ["main", "worktree", "copy"]) mkdirSync(join(dir, name));
  mkdirSync(join(dir, "main", ".git"));
  writeFileSync(join(dir, "worktree", ".git"), "gitdir: /somewhere/.git/worktrees/x\n");
  assert.deepEqual(["main", "worktree", "copy", "not there"].map((n) => isGitCheckout(join(dir, n))), [true, true, false, false]);
  assert.equal(isGitCheckout(join(REPO, "tool")), false);
  rmSync(dir, { recursive: true, force: true });
});
it("is unknown, and git is not asked, where the folder has no .git of its own, as the app's copy of the code has none", () => {
  const asked = [];
  const spawn = (...a) => (asked.push(a), { status: 0, stdout: "abc1234\n" });
  assert.equal(commitOf("/Applications/BRIMM Video Studio.app/Contents/Resources/studio", { spawn, exists: () => false }), "unknown");
  assert.equal(commitOf(join(REPO, "tool"), { spawn }), "unknown");
  assert.deepEqual(asked, []);
});
it("is asked of git as before where there is one", () => {
  const asked = [];
  const spawn = (...a) => (asked.push(a), { status: 0, stdout: "abc1234\n" });
  assert.equal(commitOf("/checkout", { spawn, exists: (p) => p === "/checkout/.git" }), "abc1234");
  assert.deepEqual(asked, [["git", ["-C", "/checkout", "rev-parse", "--short", "HEAD"], { encoding: "utf8" }]]);
  assert.equal(commitOf("/checkout", { spawn: () => ({ status: 0, stdout: "not a commit\n" }), exists: () => true }), "unknown");
});
```

`edit-show.test.js` "behind": lift the `stale` line out of the test at :265 so that the describe holds it, then add:

```js
it("asks git nothing where this Mac's checkout has no .git of its own, and still says what needs no network", async () => {
  const t = setup();
  const g = git({ code: 0, stderr: "" }, { code: 0, stderr: "", stdout: "3\n" });
  const looked = [];
  const none = (checkout) => (looked.push(checkout), false);
  const quiet = await on({ ...t.ctx.deps, run: g.run, isGitCheckout: none }, "behind");
  assert.deepEqual([quiet.code, quiet.text], [0, ""]);
  const folder = writeStudio(t.home, { checkout: "/checkout", node: "/opt/homebrew/bin/node" });
  const skill = join(folder, ".claude", "skills", "brimm-edit", "SKILL.md");
  writeFileSync(skill, readFileSync(skill, "utf8").replace(/\| "Show me the Reels".*\n/, ""));
  const r = await on({ ...t.ctx.deps, run: g.run, isGitCheckout: none }, "behind");
  assert.deepEqual([r.code, r.text], [0, stale]);
  assert.deepEqual([g.calls, looked], [[], ["/checkout", "/checkout"]]);
  t.done();
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `cd tool && node --test tests/filing.test.js tests/edit-show.test.js`
Expected: FAIL. `isGitCheckout` is not exported, and git is asked.

- [ ] **Step 3: Change `filing.js` and `behind`, then add the two harness stand-ins**

`behind`'s doc comment gains one sentence: "A checkout with no .git of its own is not asked of git (phase 1); phase 3 says the update check's line there."

- [ ] **Step 4: Run the tests and see them pass**

Run: `cd tool && node --test tests/filing.test.js tests/edit-show.test.js tests/behind-access.test.js tests/behind-open.test.js tests/behind-toolchain.test.js tests/claude-home.test.js tests/reveal.test.js tests/part-f-fixes.test.js tests/edit-gate.test.js tests/sandboxed.test.js tests/studio.test.js tests/guard-open.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tool/filing.js tool/edit.js tool/tests/filing.test.js tool/tests/edit-show.test.js tool/tests/episodes.js tool/tests/open-world.js
git commit -m "Studio app phase 1, task 6: git only where the checkout has its own .git"
```

---

### Task 7: compile the helpers into a folder (`tool/build-helpers.js`)

**Files:**
- Create: `tool/build-helpers.js`
- Create: `tool/tests/build-helpers.test.js`
- Modify: `README.md:12-24` (a row for `tool/build-helpers.js`)

**Interfaces:**
- Consumes: `HELPERS` and `helperSource` (Task 1), and `lastLine` from `run.js` (imported, not changed).
- Produces: the command `node tool/build-helpers.js <folder>`, for Phase 6's `build-app.sh` and for a by-hand try.
  - Without exactly one argument: standard error gets "Give it the folder to put the helpers in: node tool/build-helpers.js <folder>", it ends with 2, and nothing is compiled.
  - It makes the folder, with any folders it needs.
  - For each of `HELPERS`, in order, it runs `spawnSync("swiftc", ["-O", "-target", "arm64-apple-macos13.0", "-o", join(folder, \`brimm-${name}\`), helperSource(name)], { encoding: "utf8" })`, finding `swiftc` on PATH.
  - When one is compiled, standard output gets "Compiled brimm-<name>."
  - When swiftc cannot be started (ENOENT), standard error gets "swiftc is not on this Mac: it comes with Xcode's command line tools. Nothing more was compiled.", and it ends with 1.
  - When swiftc ends badly, it removes `<folder>/brimm-<name>` if that is there. Standard error gets "brimm-<name> could not be compiled (<swiftc's last line>). Nothing more was compiled.", and it ends with 1.
  - It signs nothing, because Phase 6 signs inside-out, and writes nothing else.
  - Its check for being started as the main script compares the `realpathSync` of each side, inside a try (design part 6).

- [ ] **Step 1: Write the failing tests** (`tool/tests/build-helpers.test.js`)

- The header says that no test runs the real swiftc: a stand-in is the only `swiftc` on PATH.
- The environment is built from scratch: `{ PATH: <stand-in folder>, HOME, SWIFTC_LOG, FAIL_FOR? }`, run with `spawnSync(process.execPath, [BUILD, ...args])`.
- The stand-in is a `/bin/sh` script with mode 0o755. It writes its arguments into `$SWIFTC_LOG`, one to a line, followed by a line `--`.
  - When its last argument equals `$FAIL_FOR`, it says `error: nope` on standard error and ends with 1.
  - Otherwise it writes `compiled` to the path after `-o`.
- `w.calls()` reads the log back as arrays.

```js
it("compiles each helper with swiftc, in order, for Apple silicon on macOS 13, as brimm-<name> in the folder it is given", () => {
  const out = join(w.dir, "Sallie's helpers", "bin");
  const r = w.run([out]);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(w.calls(), HELPERS.map((n) => ["-O", "-target", "arm64-apple-macos13.0", "-o", join(out, `brimm-${n}`), helperSource(n)]));
  assert.deepEqual(readdirSync(out).sort(), HELPERS.map((n) => `brimm-${n}`).sort());
  assert.equal(r.stdout, HELPERS.map((n) => `Compiled brimm-${n}.\n`).join(""));
});
it("stops at the first helper swiftc cannot compile, says which in swiftc's words, ends with 1, and leaves no file of that name", () => {
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "brimm-progress"), "an older build");
  const r = w.run([out], { FAIL_FOR: helperSource("progress") });
  assert.deepEqual([r.status, r.stderr], [1, "brimm-progress could not be compiled (error: nope). Nothing more was compiled.\n"]);
  assert.deepEqual(w.calls().map((c) => c.at(-1)), [helperSource("faces"), helperSource("progress")]);
  assert.deepEqual(readdirSync(out), ["brimm-faces"]);
});
it("says so, and ends with 1, on a Mac with no swiftc", () => {
  // PATH is an empty folder.
  assert.deepEqual([r.status, r.stderr], [1, "swiftc is not on this Mac: it comes with Xcode's command line tools. Nothing more was compiled.\n"]);
});
it("compiles nothing, and ends with 2, without exactly one folder", () => {
  for (const args of [[], [a, b]]) {
    assert.deepEqual([r.status, r.stderr], [2, "Give it the folder to put the helpers in: node tool/build-helpers.js <folder>\n"]);
  }
  assert.deepEqual(w.calls(), []);
});
```

- [ ] **Step 2: Run the tests and see them fail**

Run: `cd tool && node --test tests/build-helpers.test.js`
Expected: FAIL, because `build-helpers.js` cannot be found.

- [ ] **Step 3: Write `tool/build-helpers.js`, as in Interfaces**

- [ ] **Step 4: Run the tests and see them pass**

Run: `cd tool && node --test tests/build-helpers.test.js`
Expected: PASS.

- [ ] **Step 5: Add the by-hand check, and the README row**

Add a check, with the next free number, to the Studio By-Hand Checks page (https://claude.ai/artifact/TmFpCY7GfR1KWw9hcftzrT). Read the page first, and give the check a results box. Claude may run the Terminal steps 1 to 5 itself on the Mac Studio. Jason runs step 6.
1. From this worktree: `node tool/build-helpers.js "<scratch>/helpers"`. Expect five "Compiled" lines. Never compile into node's own folder or a drop folder.
2. `"<scratch>/helpers/brimm-read-through" "<scratch>/test.bin"` on a 50 MB file made with `mkfile 50m`. Expect growing numbers, the last one being 52428800. On a missing file, expect "No such file or directory" and exit 1.
3. `brimm-progress --print "<scratch>/empty"`. Expect `[]`.
4. `brimm-uploaded` on a throwaway test file in Dropbox. Expect `{"uploaded": true}` once Dropbox shows it synced.
5. `brimm-faces` on a folder of stills that ffmpeg cut from a test clip of Jason's own (never one of Sallie's). Expect JSON with a box for each face.
6. After the merge and the Mac Studio's next idle pull: the next import still shows the progress panel and still finds a Reel's faces, as before.

Then delete the scratch folder.

The README row: `| \`tool/build-helpers.js\` | Compiles the five helpers with swiftc into a folder, as brimm-<name>, for the app's build; it signs nothing |`

```bash
git add tool/build-helpers.js tool/tests/build-helpers.test.js README.md
git commit -m "Studio app phase 1, task 7: build-helpers.js compiles the five helpers into a folder"
```

---

### Task 8: the phase's guard, and the whole suite

**Files:**
- Create: `tool/tests/no-xcode-tools.test.js`, modelled on `no-hard-link.test.js`.
  - It reads every `.js` and `.mjs` under `tool/`, except `tests/`, `move-app/` (the old installer, retired in Phase 8) and `vendor/`.
  - It does not read `install.sh`, which is Phase 4's. Its header says so.

**Interfaces:**
- Consumes: the code as Tasks 1 to 7 left it. The `ALLOWED` substrings below are copied from those lines as written.
- `PROGRAM = /["'](?:\/usr\/bin\/)?(?:git|python3|swiftc?|xcode-select|xcrun)["']/`. A line that matches must be one of `ALLOWED`, each a `[file, substring, why]`:
  - `helpers.js`: `"/usr/bin/xcode-select", ["-p"]`. That is `hasXcodeTools`: it asks where the tools are, and never installs them.
  - `dropbox.js`: `program: "/usr/bin/python3"`. The read-through's fallback, used only when `hasXcodeTools()` is true.
  - `filing.js`: `"git", ["-C", checkout, "rev-parse"`. That is `commitOf`, only where `isGitCheckout` is true.
  - `edit.js`: `"/usr/bin/git", ["-C", ctx.settings.checkout`. That is `behind`, only where `isGitCheckout` is true.
  - `unedited.js`: `join(dir, "swift")`. That is `findPrograms` looking for swift; it starts nothing.
  - `progress.js`: `once("swift", `. The key of a log line.
  - `build-helpers.js`: `"swiftc"`. The build's own compile, which Studio never runs.
- `SWIFT_STARTED = /\b(?:run|start|exec|spawn|spawnSync|execFile|execFileSync)\(\s*(?:tools\.|found\.)?swift\b/` must match no line. Every helper is started through `helperCommand`.

- [ ] **Step 1: Write the test**

```js
it("starts git, python3, swift, swiftc, xcrun and xcode-select only where each is guarded", () => { /* every PROGRAM line is in ALLOWED, with file:line in the message */ });
it("starts no helper with swift itself: each goes through helpers.js helperCommand", () => { /* no SWIFT_STARTED line */ });
it("knows a program's name when it sees one, and not a word in a sentence", () => {
  for (const l of ['spawnSync("git", ["status"])', 'run("/usr/bin/python3", [])', "start('swift', [x])", 'execFileSync("xcrun", ["swiftc"])', 'run("swiftc", a)']) assert.ok(PROGRAM.test(l), l);
  for (const l of ["// git runs only where there is a .git", '"Run git pull in the checkout"', 'join(dir, "swiftly")', "GIT"]) assert.ok(!PROGRAM.test(l), l);
  for (const l of ["run(tools.swift, [FACES, folder])", "start(swift, [PANEL, folder])", "exec(swift, [UPLOADED, path])"]) assert.ok(SWIFT_STARTED.test(l), l);
  for (const l of ["start(panel.program, [...panel.args, folder])", 'helperCommand("faces", { swift: tools.swift })']) assert.ok(!SWIFT_STARTED.test(l), l);
});
```

- [ ] **Step 2: Run it and see it pass**

Run: `cd tool && node --test tests/no-xcode-tools.test.js`
Expected: PASS. The third test shows the two patterns catch the old forms, such as `exec(swift, [UPLOADED, path])`. If either of the first two tests fails, it names a line that starts one of these programs with no guard. That line is fixed in the task that owns it, not allowed here.

- [ ] **Step 3: Run the whole suite**

Run: `cd tool && node --test`
Expected: PASS, every file, `contract.test.js` included with unchanged hashes.

- [ ] **Step 4: Check that the contract and the copies are untouched**

Run: `git diff --stat c7bb35a -- tool/run.js tool/lib.js tool/shared tool/guide.js tool/handoff.js tool/handoff-v2.js tool/tests/fixtures tool/install.sh tool/move-app`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add tool/tests/no-xcode-tools.test.js
git commit -m "Studio app phase 1, task 8: a guard that nothing else starts git, python3, swift or xcode-select"
```

---

## Decisions this plan made (the design left them open)

1. **The resolver.**
   - One module, `tool/helpers.js`, with the interface above.
   - `findPrograms` gives the folder as `tools.bin`, and every `bin` defaults to node's own folder. A call site that forgets `bin` therefore still uses the compiled helper in the app.
2. **Compiled before Xcode.**
   - A compiled helper is used even when Xcode's tools are present. xcode-select is asked only when there is none.
   - A compiled helper that is there but fails is not followed by swift or python3.
3. **`behind` with no `.git`.**
   - In this phase, `behind` on a checkout with no `.git` of its own says no line about versions. "Is this Mac offline?" would be wrong.
   - Phase 3 fills that place with the update check.
   - The `.git` must be the checkout's own: a folder inside a repository, such as `tool/`, is not a checkout.
4. **The read-through with neither reader** rejects with `NO_READ_THROUGH`. Every caller already says a rejection in its own words.
5. **`findPrograms` looks in node's folder for `claude` too**, as the brief asks, though Claude Code installs into `~/.local/bin`.
   - A node run from a shared folder such as `/usr/local/bin` would make that folder's ffmpeg win over PATH order. This is accepted: Homebrew's node runs from `Cellar/node/<v>/bin`.
6. **The compile script** is a node script, so that the list of helpers lives in one place (`HELPERS`). It targets `arm64-apple-macos13.0` with `-O`, stops at the first failure, and removes a failed helper's file.
7. **A source-scanning guard (Task 8)** keeps later changes from starting these programs unguarded.

## Not in this phase

- **`install.sh`.** Its launch agent's PATH (:92) and its lines about Xcode's tools (:709-724) are Phase 4's.
- **`tool/studio/CLAUDE-open.md:7`.** It tells Claude it may make a file with `python3 -c`. That is Claude's own command in her folder, not Studio's.
  - On a Mac without Xcode's tools it would open the install dialog.
  - `install.test.js:767` pins the word.
  - This is for Phase 3 or Phase 5, or for Jason to decide.
- **A git checkout on a Mac whose Xcode tools were removed** would still start git where `.git` is there. Every such Mac is a dev Mac, and its `git pull` needs the tools anyway.
