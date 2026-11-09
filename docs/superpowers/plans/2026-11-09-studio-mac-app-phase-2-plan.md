# Phase 2, "Quote {{NODE}}": Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sallie's skill, her folder's allow rule, the open lock's excluded command and both guards name node in double quotes, so that the installed app's node, whose path has spaces, runs edit.js and nothing else.

**Architecture:** One function in `studio.js`, `editStart`, builds how an edit.js command may start, and all three matchers use it: today's guard (`guardDecision`), the open guard's step 5 (`bashDecision`) and the held chat's narrowing (`firstWord`). A path that cannot stand inside double quotes (`quotable`) is refused when her folder is written and is never matched. The hook's own arguments stay the raw path: the hooks run in exec form, and `guard.sh` and `receipt.sh` already pass `"$1"` as one word.

**Tech Stack:** Node 22 or later, `node:test`, no packages; zsh and bash for the shell checks.

**Spec:** `docs/superpowers/specs/2026-11-09-studio-mac-app-design.md`, part 6, "Two path fixes" (first bullet), and part 5, "Compatibility". The phase table: `docs/superpowers/plans/2026-11-09-studio-mac-app-build-plan.md`, row 2.

## Global Constraints

- Failing test first, then the code. `cd tool && node --test` runs everything (several minutes); run single files while working.
- No test runs the real `claude`, the HyperFrames app, HeyGen or the real `edit.js` on this Mac's episodes. Commands the guards let through are run only with stand-ins (`printf`, a stand-in `node`).
- The BRIMM Ops contract is untouched: `tool/shared/`, `tool/lib.js`, `tool/run.js`, `tool/guide.js`, `tool/handoff*.js`, `tool/tests/fixtures/`. `tests/contract.test.js` passes with the same hashes.
- Dev mode keeps working exactly as today, including on a Mac whose folder for Claude still has today's skill (between `git pull` and the folder's rewrite).
- The hooks' `args` stay `[<guard.sh or receipt.sh>, <node, raw>, <her folder>]`, never a quoted node.
- `OPEN_LOCK_CLAUDE` stays `null`: the open lock stays off on every Mac.
- Never read a `.env` file. Never `cd` into `~/Claude Code/brimm-video-studio`. `install.sh` only with `--print`. Push, the pull request and the merge wait for Jason's yes.
- Comments and messages are plain, full-sentence English, as in the files around them.

## What is decided here (the design left it open)

1. **Today's guard keeps node bare, but only for a plain path.** It lets through three spellings: `"<node>"`, the word `node` (as today), and `<node>` bare when the path is `/` followed only by a plain word's letters (`[A-Za-z0-9_.,:+=@%/-]`, as `WORD`'s plain word). Why it is needed: in dev mode a `git pull` updates the guard at once, but her folder's skill keeps today's bare spelling until Jason rewrites it, so every chat on a pulled Mac would break without it (part 5, "Compatibility"). Why it is safe: such a word holds nothing zsh or bash split or expand (no space, quote, `$`, backtick, backslash, `~`, glob or brace letter), the same letters and the same reasoning as `WORD`'s plain words, which the random-command tests check in both shells. It starts with `/`, so it cannot be an assignment, a `=cmd`, a `~` or a `%` job. It is narrower than today, which let any node through bare: a path with a space is refused bare, because the shells would run `/Applications/BRIMM` with the rest as its words, and a non-admin can write `~/Applications/BRIMM`. Removing the bare form waits until every Mac's folder is rewritten (after Phase 8); it is not done here.
2. **The open guard takes `"<node>"` alone,** the one spelling its sandbox's excluded command names. The open lock is in effect on no Mac, so no chat spans this change under it.
3. **The open lock's `sandbox.excludedCommands` (`studio.js:140`) is quoted too.** The design's list (`SKILL.md:8`, `studio.js:340`, `open-lock.js:154,186`) leaves it out, but step 5's one spelling must be the one the sandbox leaves out.
4. **What may stand in double quotes (`quotable`):** an absolute path with no `"`, `$`, backtick or backslash (the letters `WORD`'s double-quoted word refuses) and no control character (U+0000 to U+001F, U+007F). `!` is allowed, as it already is in `WORD`'s double-quoted words: Claude Code runs commands in a non-interactive shell, where neither zsh nor bash expands history. Letters outside ASCII are allowed.
5. **The checkout is held to the same rule.** It has stood inside double quotes since the start, unchecked. A checkout or a node that is not quotable makes `editStart` give `null`, and then every edit.js command is refused, the word `node` too: fail closed.
6. **`behind`'s line for Jason keeps `--node ${stale.node}` as it is.** Phase 3 rewrites that wording for installed mode; here `nameableNode` only stops naming a node the studio command would refuse.
7. `tests/guard.test.js` is the watchdog's (`guard.js`), not the lock's: it is not touched.

## Review Focus

1. **A dev Mac between the pull and her folder's rewrite.** Her skill still says the bare Homebrew spelling: every chat keeps working, and `behind` says only "out of date", never "lock changed", ending 0. Tests: Task 1, `NODE_CASES` Homebrew `strictOnly`; Task 3, Step 1, the edit-show test.
2. **A node path with letters the shells read outside quotes but not inside them** (space, apostrophe, parentheses, `&`, `;`, `!`, `é`). The quoted spelling is let through, and zsh and bash run exactly that path with edit.js and the words. Test: Task 1, the stand-in node test.
3. **The `~/Applications` copy** a person who is not an admin gets (design part 1). It is treated as `/Applications` is. Test: Task 1, `HOME_APP_NODE` in `NODE_CASES`.
4. **A chat begun before a takeover,** whose skill names Homebrew's node, on a Mac now running the app's node. It is refused like any other node and never run. Test: Task 1, the `APP_NODE` refused rows `run(NODE)` and `run('"' + NODE + '"')`.
5. **A held chat** (one shown a session's words) using any spelling today's guard allows. It is narrowed the same way. Test: Task 1, the guard-open section IV test.

Left to by-hand checks, since no test here can see it: whether Claude Code's sandbox matches an `excludedCommands` entry (and a `Bash()` allow rule) that starts with a quoted word. Under the strict lock nothing rests on that, because the guard's own "allow" answers first. Under the open lock it does (lock-loosened design, C7), so Task 4 adds it to the open lock's by-hand round.

---

### Task 1: The security cases, seen failing

**Files:**
- Modify: `tool/tests/guard-cases.js` (whole file, 20 lines: add the tables below; `EDIT` itself is not changed until Task 3)
- Modify: `tool/tests/studio.test.js` (import at :19; a new describe after "the guard and paths that hold a regular expression's own characters", :927-938)
- Modify: `tool/tests/guard-open.test.js` (imports at :18 and :20; a new `it` in section III, :368-423; a new `it` in section IV after :504-516)
- Modify: `tool/tests/settings.test.js` (a new `it` in the describe at :372)

**Interfaces:**
- Consumes: `guardDecision`, `writeStudio`, `studioFolder`, `openSettingsOf` (studio.js); `openDecision`, `guardAnswer`, `RUN_ALONE` (open-lock.js); `settingsMain` (settings.js); `untiedMark` (held.js).
- Produces, in `tests/guard-cases.js`: `APP_NODE`, `HOME_APP_NODE`, `APOSTROPHE_NODE` (strings); `EDIT_BARE` (string, today's `EDIT`); `NODE_CASES: { node, both: string[], strictOnly: string[], refused: string[] }[]`; `UNQUOTABLE_NODES: string[]`; `UNQUOTABLE_CHECKOUTS: string[]`; `spellingsOf(node, checkout = CHECKOUT): string[]`.

- [ ] **Step 1: Note the base commit for the review in Task 5**

Run: `git rev-parse HEAD` and keep the hash in the task notes as `BASE`.

- [ ] **Step 2: Add the tables to `tests/guard-cases.js`**

Add `import { dirname } from "node:path";` and, after `ALLOWED`:

```js
/** The node in BRIMM Video Studio.app (design part 1), in /Applications and in ~/Applications for a person who is not an admin. */
export const APP_NODE = "/Applications/BRIMM Video Studio.app/Contents/Resources/bin/node";
export const HOME_APP_NODE = "/Users/sallie/Applications/BRIMM Video Studio.app/Contents/Resources/bin/node";
/** A node under a home folder whose name has an apostrophe. */
export const APOSTROPHE_NODE = "/Users/o'hara/.nvm/versions/node/v22.11.0/bin/node";
/** Node bare, as her folder was written before node was quoted. */
export const EDIT_BARE = `${NODE} "${CHECKOUT}/tool/edit.js"`;
/** A command that starts with `start` and runs the checkout's edit.js with `words`. */
const run = (start, words = "episodes", checkout = CHECKOUT) => `${start} "${checkout}/tool/edit.js" ${words}`;
/** What both guards refuse whatever this Mac's node is: other quotes, other paths, quotes that end early or hold more. */
const refusedFor = (node) => [
  run(`'${node}'`), run(`"${node}\\"`),
  run(`"${node}2"`), run(`"${dirname(node)}/nodejs"`), run('"/usr/local/bin/node"'),
  run(`"${node.replace("/bin/", '/bin"/"')}"`),
  run(`"${node}$(date)"`), run(`"$HOME${node}"`), run(`"${node}\`date\`"`),
  run(`"${dirname(node)}"/node`), run(`${dirname(node)}/"node"`),
  `"${node}" -e "1"`, `"${node}" "${CHECKOUT}/tool/unedited.js" --from-plan x`, `"${node}" "/other/tool/edit.js" episodes`,
  run(`"${node}"`, "episodes; date"), run(`"${node}"`, 'open "$(date)"'), ` ${run(`"${node}"`)}`, run(`"${node}" `)
];
/** For each node her folder may be written with: the commands both guards let through (node in double quotes, the open lock's one
    spelling), those only today's guard lets through, and those both refuse. Bare, a path with spaces would have the shells run
    /Applications/BRIMM with the rest as its words; Homebrew's node on a Mac with the app's is a chat begun before the takeover. */
export const NODE_CASES = [
  ...[APP_NODE, HOME_APP_NODE].map((node) => ({ node, both: [run(`"${node}"`), run(`"${node}"`, 'open "Pricing talk"')], strictOnly: [run("node")], refused: [run(node), run(NODE), run(`"${NODE}"`), ...refusedFor(node)] })),
  { node: NODE, both: [run(`"${NODE}"`), run(`"${NODE}"`, 'open "Pricing talk"')], strictOnly: [run("node"), run(NODE), run(NODE, 'open "Pricing talk"')], refused: [run(`"${APP_NODE}"`), ...refusedFor(NODE)] },
  { node: APOSTROPHE_NODE, both: [run(`"${APOSTROPHE_NODE}"`)], strictOnly: [run("node")], refused: [run(APOSTROPHE_NODE), ...refusedFor(APOSTROPHE_NODE)] }
];
/** Paths that cannot stand inside double quotes: her folder is never written with one, and no command is let through with one. */
export const UNQUOTABLE_NODES = ['/Users/sallie/odd"dir/bin/node', "/Users/sallie/$HOME/bin/node", "/Users/sallie/back`tick/bin/node", "/Users/sallie/back\\slash/bin/node", "/Users/sallie/line\nbreak/bin/node", "/Users/sallie/tab\tstop/bin/node"];
export const UNQUOTABLE_CHECKOUTS = ['/Users/sallie/Claude Code/BRIMM" video', "/Users/sallie/Claude Code/$BRIMM video"];
/** Every spelling of edit.js, for `node` and `checkout`. */
export const spellingsOf = (node, checkout = CHECKOUT) => [run(`"${node}"`, "episodes", checkout), run(node, "episodes", checkout), run("node", "episodes", checkout)];
```

Update the file's header comment: it now also holds the cases for node's path in double quotes (design 2026-11-09, part 6).

- [ ] **Step 3: Today's guard, in `tests/studio.test.js`**

Add a new `describe("the guard and node's path in double quotes (design 2026-11-09, part 6)")` with `decide = (command, node, checkout = CHECKOUT) => guardDecision({ tool_name: "Bash", tool_input: { command } }, { checkout, node }).decision` and these tests:

- `it("lets through node in double quotes, the word node, and a plain node bare, and refuses every other spelling")`: for each of `NODE_CASES`, every `both` and `strictOnly` command is `"allow"`, and every `refused` command is `"deny"` (message: the command).
- `it("refuses every spelling when node or the checkout cannot be put in double quotes")`: for each of `UNQUOTABLE_NODES`, each of `spellingsOf(node)` is `"deny"`; for each of `UNQUOTABLE_CHECKOUTS`, each of `spellingsOf(NODE, checkout)` is `"deny"` with that checkout (message: `JSON.stringify(command)`).
- `it("is given a node in double quotes that zsh and bash run as that one program, with edit.js and its words; bare, the shells run no such program")` (async, uses `inEachShell`). Make a temporary folder (`mkdtempSync`, `realpathSync`), and `node = join(dir, "Sallie's BRIMM (1) & Co; ok! é", "node")`, a stand-in written `"#!/bin/sh\nprintf '%s\\n' \"$@\"\n"` with mode `0o755`. Then `quoted = `"${node}" "${CHECKOUT}/tool/edit.js" open "Pricing talk"``:
  - `decide(quoted, node)` is `"allow"`, and `decide(quoted.slice(1).replace('" "', ' "'), node)` (the same command bare) is `"deny"`;
  - in each shell, `spawnSync(shell, [...flags, quoted], { encoding: "utf8", env: { PATH: "/usr/bin:/bin" } })` ends 0, and its lines are `[`${CHECKOUT}/tool/edit.js`, "open", "Pricing talk"]`;
  - in each shell, the bare command does not end 0 and prints nothing to stdout.
  - Remove the folder in a `finally`.
- `it("is never written into her folder for a node or checkout that cannot be put in double quotes")`: for each of `UNQUOTABLE_NODES`, in a fresh `mkdtempSync` home, `assert.throws(() => writeStudio(home, { checkout: CHECKOUT, node }), { message: NODE_FAULT })` and `existsSync(studioFolder(home))` is false. The same for each of `UNQUOTABLE_CHECKOUTS` with `node: NODE` and `CHECKOUT_FAULT`. The two texts, pinned here and in Step 5:

```js
const NODE_FAULT = 'the path to node holds a letter that cannot go inside double quotes (", $, `, \\ or a control character)';
const CHECKOUT_FAULT = 'the path to the checkout of BRIMM Video Studio holds a letter that cannot go inside double quotes (", $, `, \\ or a control character)';
```

And in the describe "the guard, run as Claude Code runs the hook" (:1010), add `it("answers so with a node whose path has spaces: in double quotes allowed, bare refused")`. Make a temporary folder holding `BRIMM Video Studio.app/Contents/Resources/bin/node` as a link (`symlinkSync`) to `process.execPath`. Then `hook({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command } }, node)` answers `permissionDecision` `"allow"` for `"${node}" "${THIS_CHECKOUT}/tool/edit.js" episodes` and `"deny"` for `${node} "${THIS_CHECKOUT}/tool/edit.js" episodes`, each ending 0.

- [ ] **Step 4: The open guard, in `tests/guard-open.test.js`**

Import `openSettingsOf` from `../studio.js` and the new names from `./guard-cases.js`. In section III (`ctx` there names `CHECKOUT` and `NODE`):

- `it("allows node in double quotes alone, the spelling the sandbox's excluded command takes, and nothing else as edit.js")`: for each of `NODE_CASES`, with `{ ...ctx, node }`:
  - every `both` command is `{ decision: "allow", reason: "BRIMM Video Studio's own command" }`, and starts with `excluded.slice(0, -1)`, where `excluded = openSettingsOf({ checkout: CHECKOUT, node, folder: w.folder, facts: w.facts }).sandbox.excludedCommands[0]`;
  - every `strictOnly` and `refused` command has a reason other than "BRIMM Video Studio's own command", and those whose text includes `edit.js` are `ALONE`.
- `it("refuses every spelling when node or the checkout cannot be put in double quotes")`: each of `spellingsOf(node)` for `UNQUOTABLE_NODES`, and of `spellingsOf(NODE, checkout)` for `UNQUOTABLE_CHECKOUTS` with `{ ...ctx, checkout }`, is `ALONE`.

In section IV, after "lets a chat that holds a session's words run only the commands a session runs" (:504), add `it("narrows a held chat the same way whichever spelling today's guard lets through")`. Use `w = chat()` and `untiedMark({ home: w.home, now: Date.parse("2026-10-26T10:30:00.000Z") })`. Then for each `start` of `` [`"${w.node}"`, w.node, "node"] `` with `edit = `${start} "${w.checkout}/tool/edit.js"``: `${edit} episodes` is `"allow"`, and `${edit} name "Pricing talk" "x"` is `{ decision: "deny", reason: HELD_NARROWED }`.

- [ ] **Step 5: The studio command, in `tests/settings.test.js`**

In the describe at :372, add `it("refuses a node or a checkout that cannot be put in double quotes, and writes nothing")`, using `studioWorld()`:
- for each of `UNQUOTABLE_NODES`, both `t.run(MINIMUM, "studio", "--node", node)` and the same with `"--print"` end 1, and `t.said` is `[`Not written: ${NODE_FAULT}.`]`;
- after `writeSettings(t.home, { checkout: UNQUOTABLE_CHECKOUTS[0] })`, `t.run(MINIMUM, "studio", "--node", NODE)` ends 1, and `t.said` is `[`Not written: ${CHECKOUT_FAULT}.`]`;
- the settings file is as it was before each refused run, `existsSync(studioFolder(t.home))` is false, and `t.ports()` is 0.

Pin the same two texts as in Step 3, as constants at the top of the `it`.

- [ ] **Step 6: Run them and see each fail**

Run: `cd tool && node --test --test-name-pattern="double quotes|whose path has spaces|whichever spelling" tests/studio.test.js tests/guard-open.test.js tests/settings.test.js`

Expected: every new test FAILS, for these reasons. The quoted `APP_NODE` spelling is answered `deny` (strict) or `RUN_ALONE` (open). `${node} "…" episodes` for an unquotable node is answered `allow`. `writeStudio` does not throw. The studio command ends 0. Run the files whole too: every test that is not new still passes.

- [ ] **Step 7: Commit**

```bash
git add tool/tests/guard-cases.js tool/tests/studio.test.js tool/tests/guard-open.test.js tool/tests/settings.test.js
git commit -m "Tests: the guards' cases for node's path in double quotes, failing until Phase 2's code"
```

---

### Task 2: Refuse, when writing her folder, a path that cannot be quoted

**Files:**
- Modify: `tool/studio.js:30` (add `isAbsolute` to the `node:path` import), new exports after `literally` (:311), `writeStudio` (:243)
- Modify: `tool/settings.js:41` (import), `:1178` (in `studio`)
- Modify: `tool/edit.js:98` (import), `:2965` (`nameableNode`)
- Test: `tool/tests/edit-show.test.js:877-908`

**Interfaces:**
- Consumes: Task 1's `UNQUOTABLE_NODES`, `UNQUOTABLE_CHECKOUTS`.
- Produces, in `studio.js`: `quotable(path: unknown): boolean` and `quotingFault({ checkout, node }): string | null`. The second gives the text pinned in Task 1, node's first, then the checkout's. Task 3 uses `quotable`.

- [ ] **Step 1: Write the failing test for `nameableNode`**

In edit-show's "names the node that rewrites her folder only when …" (:877), make `join(bin, 'quo"te')`, `join(bin, "back\\slash")` and `join(bin, "dollar$x")`, each with an empty `node` file. Add three rows, each printing `HOMEBREW`: `[join(bin, 'quo"te', "node"), HOMEBREW]`, `[join(bin, "back\\slash", "node"), HOMEBREW]`, `[join(bin, "dollar$x", "node"), HOMEBREW]`. Add to the test's name: "and that can go inside double quotes".

- [ ] **Step 2: Run it and see it fail**

Run: `cd tool && node --test --test-name-pattern="names the node that rewrites" tests/edit-show.test.js`
Expected: FAIL. The line names `…/quo"te/node`, not `/opt/homebrew/bin/node`.

- [ ] **Step 3: Implement**

- `studio.js`: `export const quotable = (path) => typeof path === "string" && isAbsolute(path) && !/["$`\\\u0000-\u001f\u007f]/.test(path);` and `export function quotingFault({ checkout, node })`, giving `NODE_FAULT`'s text when `!quotable(node)`, else `CHECKOUT_FAULT`'s when `!quotable(checkout)`, else `null`. Each gets a doc comment saying why: these are the letters zsh and bash read inside double quotes, as `WORD`'s double-quoted word refuses them.
- `writeStudio`: as its first line, `const fault = quotingFault({ checkout, node }); if (fault) throw new Error(fault);`, so it makes nothing. `studioFiles` stays as it is: `studioStale` calls it with whatever her folder's settings name.
- `settings.js` `studio`, at :1178: `const fault = settingsFault(would) || quotingFault({ checkout: would.checkout, node: told.node });`. This is before anything is written or a port is picked, and before `--print`.
- `edit.js` `nameableNode`: `quotable(node) && basename(node) === "node" && existsSync(node)`. `quotable` takes over the old control-character test and `isAbsolute`. Update its doc comment.

- [ ] **Step 4: Run and see them pass**

Run: `cd tool && node --test tests/edit-show.test.js tests/settings.test.js tests/studio.test.js tests/studio-open.test.js`
Expected: Task 2's test and Task 1's writing tests (studio.test.js "is never written…", settings.test.js "refuses a node or a checkout…") PASS. Task 1's guard tests still FAIL (Task 3). Nothing else fails.

- [ ] **Step 5: Commit**

```bash
git add tool/studio.js tool/settings.js tool/edit.js tool/tests/edit-show.test.js
git commit -m "Her folder: refuse a node or checkout that cannot go inside double quotes"
```

---

### Task 3: Node in double quotes, in her folder and in both guards

**Files:**
- Modify: `tool/studio/SKILL.md:8`, `tool/studio/SKILL-open.md:8`: `"{{NODE}}" "{{CHECKOUT}}/tool/edit.js" <command> …`
- Modify: `tool/studio.js:71`, `:126` (allow rules), `:140` (excluded command), `:328-344` (`guardDecision` and its doc comment), new `editStart` after `WORD` (:326)
- Modify: `tool/open-lock.js:41-44` (step 5's comment), `:58` (import: `editStart` in, `literally` out if nothing else uses it), `:152-165` (`bashDecision`), `:184-190` (`firstWord`)
- Test: `tool/tests/guard-cases.js` (`EDIT`), `tool/tests/studio.test.js`, `tool/tests/studio-open.test.js`, `tool/tests/guard-open.test.js`, `tool/tests/studio-home.test.js`, `tool/tests/edit-show.test.js`, `tool/tests/receipts.test.js`

**Interfaces:**
- Consumes: `quotable` (Task 2); `literally`, `WORD` (studio.js).
- Produces: `editStart({ checkout, node }, { quotedOnly = false } = {}): string | null`, a regular expression's source with no anchors. It is `null` when `!quotable(checkout) || !quotable(node)`. The body, exactly:

```js
const quoted = `"${literally(node)}"`;
const starts = quotedOnly ? [quoted] : ["node", quoted, ...(/^\/[A-Za-z0-9_.,:+=@%/-]*$/.test(node) ? [literally(node)] : [])];
return `(?:${starts.join("|")}) "${literally(checkout)}/tool/edit\\.js"`;
```

- [ ] **Step 1: Change the expected text, and add the tests that pin her folder**

- `guard-cases.js`: `EDIT` becomes `` `"${NODE}" "${CHECKOUT}/tool/edit.js"` ``; its comment says it is the skill's spelling, node in double quotes. `ALLOWED` is unchanged (its `node "…"` row stays). Tests that keep their text but now test the quoted spelling: `studio.test.js:130` (`Bash(${EDIT} *)`), `:156` (`includes(EDIT)`), the random commands (:101), `edit-plan.test.js:913`, `edit-footage.test.js:1390`, `join.test.js:1845`.
- `studio.test.js`, in "her folder's settings": `it("names node in double quotes in the skill and the allow rule for a node whose path has spaces, and gives the hook that path as it is")`. With `files = studioFiles({ checkout: CHECKOUT, node: APP_NODE, folder: FOLDER })`:
  - the skill includes `` `exactly so: "${APP_NODE}" "${CHECKOUT}/tool/edit.js" <command> …\n` ``;
  - `permissions.allow` is `` [`Bash("${APP_NODE}" "${CHECKOUT}/tool/edit.js" *)`] ``;
  - `hooks.PreToolUse[0].hooks[0].args` is `` [`${CHECKOUT}/tool/studio/guard.sh`, APP_NODE, FOLDER] ``.
- `studio-open.test.js:40`, `:59`, `:142`, `:143`: `` `Bash("${w.node}" "${w.checkout}/tool/edit.js" *)` ``. `:57`: `` [`"${w.node}" "${w.checkout}/tool/edit.js" *`] ``. `:176`: `` includes(`"${w.node}" "${w.checkout}/tool/edit.js"`) ``. Also assert that the receipt hook's `args` (`PostToolUse[0].hooks[0].args`) are `` [`${w.checkout}/tool/studio/receipt.sh`, w.node, w.folder] ``.
- `guard-open.test.js:383`: `assert.ok(command.startsWith(excluded.slice(0, -1)), command)`, with `excluded` from `openSettingsOf({ checkout: CHECKOUT, node: NODE, folder: w.folder, facts: w.facts }).sandbox.excludedCommands[0]`. Rename the test: "…every form it allows starts as the excluded entry does". `:388`: add `` `${EDIT_BARE} episodes` `` to the refused list, and name the test "…bare node or the word node, …". `:434`: `` w.edit = `"${w.node}" "${w.checkout}/tool/edit.js"` ``.
- `studio-home.test.js:183` (its own `NODE` and `CHECKOUT`, :166): `` const edit = `"${NODE}" "${CHECKOUT}/tool/edit.js"` ``. `:193`: `` const edit = `"${w.node}" "${w.checkout}/tool/edit.js"` ``. Each refusal test must use the spelling that would otherwise be let through.
- `edit-show.test.js`, after the test at :265: `it("finds her folder up to date when this checkout wrote it with a node whose path has spaces, and out of date, not changed, when it was written before node was quoted")`:
  - `writeStudio(t.home, { checkout: "/checkout", node: APP_NODE })`, with `APP_NODE` imported from `./guard-cases.js`; `behind` says exactly "This Mac has the newest BRIMM Video Studio.";
  - then `writeStudio` with `/opt/homebrew/bin/node`, and in its SKILL.md replace `'"/opt/homebrew/bin/node" "/checkout/tool/edit.js"'` with `'/opt/homebrew/bin/node "/checkout/tool/edit.js"'`; `behind` ends 0 with the newest line and then the existing out-of-date line, which names `/opt/homebrew/bin/node`.
- `receipts.test.js`, in the test at :356, add: run `receipt.sh` with a link to `process.execPath` at `<tmp>/BRIMM Video Studio.app/Contents/Resources/bin/node`; it ends 0 and writes one more receipt. This passes before and after: it pins that the raw path in `args` reaches node as one word.

- [ ] **Step 2: Run and see them fail**

Run: `cd tool && node --test tests/studio.test.js tests/studio-open.test.js tests/guard-open.test.js tests/studio-home.test.js tests/edit-show.test.js`
Expected: FAIL. The skill and the settings still name node bare. The open guard answers `RUN_ALONE` to `EDIT`. Task 1's guard tests fail as before.

- [ ] **Step 3: Implement**

- `SKILL.md:8`, `SKILL-open.md:8`: put `{{NODE}}` in double quotes. `filled` (:59) is unchanged.
- `studio.js:71`, `:126`: `` `Bash("${node}" "${checkout}/tool/edit.js" *)` ``. `:140`: `` `"${node}" "${checkout}/tool/edit.js" *` ``. The hooks' `args` (:79, :156) are unchanged.
- `editStart` as above, with a doc comment. It should name the three spellings, why the bare one is kept and only for a plain path (decision 1), `quotedOnly` as the open lock's one spelling, and `null` failing closed.
- `guardDecision` (:340-341): `const start = editStart({ checkout, node });` then allow only when `start && typeof command === "string" && new RegExp(`^${start}(?: ${WORD})*$`).test(command)`. Update its doc comment (:328-332) to name the three spellings.
- `bashDecision` (:154-158): `const start = editStart(ctx, { quotedOnly: true });`. Only when `start` is not null, test `^${start}(?: ${WORD})+$` and, in the background, `^${start} guide ${WORD} tell$`, as today. Otherwise fall through to the refusal of any command naming edit.js. Update the comments at :5-8 (step 5) and :41-44 to say "this Mac's node in double quotes".
- `firstWord` (:186): `const start = editStart(ctx); if (!start) return null;` then `new RegExp(`^${start} (${WORD})`)`. It must take every spelling `guardDecision` allows, since it narrows that guard's answer.

- [ ] **Step 4: Run and see them pass**

Run: `cd tool && node --test tests/studio.test.js tests/studio-open.test.js tests/guard-open.test.js tests/studio-home.test.js tests/edit-show.test.js tests/settings.test.js tests/receipts.test.js tests/edit-plan.test.js tests/edit-footage.test.js tests/join.test.js tests/behind-open.test.js tests/behind-toolchain.test.js`
Expected: PASS, every Task 1 case among them.

- [ ] **Step 5: Run the whole suite**

Run: `cd tool && node --test`
Expected: `# fail 0`, and `tests/contract.test.js` passes. `git diff BASE --stat -- tool/shared tool/lib.js tool/run.js tool/guide.js tool/handoff.js tool/handoff-v2.js tool/tests/fixtures` prints nothing.

- [ ] **Step 6: Commit**

```bash
git add tool/studio tool/studio.js tool/open-lock.js tool/tests
git commit -m "Her skill, the allow rule, the excluded command and both guards name node in double quotes"
```

---

### Task 4: The by-hand check

**Files:** none in the repo. The Studio By-Hand Checks page, https://claude.ai/artifact/TmFpCY7GfR1KWw9hcftzrT (CLAUDE.md, "Every by-hand step for Jason goes into an artifact").

- [ ] **Step 1: Read the page** with `Artifact` `action: "read"`, and build on the file it names.
- [ ] **Step 2: Add one check, numbered after the last,** "Phase 2: node in double quotes", for each Mac after this phase's pull (the Mac Studio, Jason's MacBook, Sallie's laptop). Steps:
  1. A new Code-tab session in `~/BRIMM Video Studio`: `behind` says her folder is out of date, and `episodes` still runs with no card (her old skill, bare node).
  2. In Terminal, by absolute path: `/opt/homebrew/bin/node "<checkout>/tool/settings.js" studio --node /opt/homebrew/bin/node`, which prints `Written: …`. On the Mac Studio the checkout is `/Users/jasonogden/Claude Code/brimm-video-studio`, pulled only when idle.
  3. `grep -n 'exactly so' ~/"BRIMM Video Studio"/.claude/skills/brimm-edit/SKILL.md` shows `"/opt/homebrew/bin/node" "<checkout>/tool/edit.js"`.
  4. A new session there: `behind` says nothing of her folder, and `episodes` runs with no card.
  5. A results box for each Mac.

  Add one line to the open lock's by-hand round (R2) on the same page, or to this check's notes if the page has no R2 section: check again that `sandbox.excludedCommands` and the `Bash()` allow rule take a command that starts with node in double quotes, with a node path that has spaces (lock-loosened design, C7).
- [ ] **Step 3: Republish to the same URL,** and keep the check's number for the pull request's text.

---

### Task 5: Independent security review

**Files:** none changed by the reviewer. Fixes, if any, follow the same failing-test-first steps, by a fixer on Sonnet 5.5.

- [ ] **Step 1: Dispatch a fresh reviewer** with the Agent tool, `model: "opus"`, `subagent_type: "general-purpose"`. Do not give it this plan's conclusions or decisions. Give it:
  - the change: `git diff BASE..HEAD -- tool/`;
  - the code to read whole: `tool/studio.js` (`quotable`, `quotingFault`, `editStart`, `WORD`, `literally`, `guardDecision`, `settingsOf`, `openSettingsOf`, `lockBroken`, `openBroken`, `writeStudio`), `tool/open-lock.js` (`bashDecision`, `wordsOf`, `firstWord`, `narrowed`, `heldDecision`, `guardAnswer`), `tool/settings.js` (`studioToldBy`, `studio`), `tool/edit.js` (`studioStale`, `nameableNode`), `tool/studio/guard.sh`, `guard.mjs`, `receipt.sh`, `receipt.mjs`, line 8 of `SKILL.md` and `SKILL-open.md`, and `tool/tests/guard-cases.js`;
  - the design's part 6, "Two path fixes", and part 5, "Compatibility"; and CLAUDE.md;
  - its limits. It reads and runs only. It may run `node --test` on single files, and probes of `guardDecision` and `openDecision` with `node -e` or a script in its scratchpad. Any command a guard allows is run only with a stand-in node (`printf`), never the real `edit.js`, which would act on this Mac's episodes. No edits, no commits, never a `.env` file.

  The questions it must answer, each with a verdict and the evidence (a probe, a test, a line):
  1. Can any command either guard answers "BRIMM Video Studio's own command" run anything other than `<checkout>/tool/edit.js`? It must run under this Mac's node (or the word `node`, under today's guard), with words that zsh and bash give edit.js letter for letter. Try node paths with spaces, an apostrophe, `!`, `&`, `;`, parentheses, non-ASCII letters, and plain ones.
  2. Can the quoting be escaped? Look for a node path, a checkout path, a command or a word that ends the double quotes early, or makes either shell expand something inside them. Is `quotable`'s set right for zsh and bash as Claude Code runs a command (non-interactive, through `eval`)? Is it right to allow `!` and letters outside ASCII?
  3. Is keeping node bare for a plain path (`/` and `[A-Za-z0-9_.,:+=@%/-]`) safe, as a command's first word in both shells? Is it never wider than before the change?
  4. Do the three matchers agree? Is there a command `guardDecision` allows for which `firstWord` gives another word or `null`? Is there one `bashDecision` allows that does not start as the sandbox's excluded command `"<node>" "<checkout>/tool/edit.js" *`?
  5. Does the lock check still match? The strict `lockBroken` (the guard's entry, `args[0]`, `args[2]`). The open `openBroken` (the whole settings against `openSettingsOf` with `studioNode`). `studioStale` (`args[1]` into `studioFiles`): is a folder this checkout writes, with a node whose path has spaces, unchanged and up to date? Is one written before this change "out of date" under the strict lock and "changed" under the open lock?
  6. Does the receipt still match? Do the guard's and the receipt's `args` keep the raw path, and do `guard.sh` and `receipt.sh` pass it to node as one word?
  7. Can a node or checkout that `quotable` refuses reach her folder by any route: `settings.js studio`, `--print`, `writeStudio`, `install.sh` (read it, run only `--print`), or the node `behind` tells Jason to write with?
  8. Anything else in the change that weakens either lock.

  Findings come back ranked Critical, Important or Minor, each with the input that shows it.
- [ ] **Step 2: Fix every Critical and Important finding.** For each one: a failing case in `tests/guard-cases.js` first (or the test file that owns it), then the code, then the single files, then `node --test`. Commit each fix by itself. Send the fixes to the same reviewer (SendMessage) and repeat until it reports none. List the Minor findings in the pull request's text.
- [ ] **Step 3: Final run.** `cd tool && node --test` gives `# fail 0`, and `contract.test.js` passes with unchanged hashes.
- [ ] **Step 4: Stop for Jason.** Push, the pull request (its own, "Phase 2: quote node", linking the check from Task 4 and the review's verdicts) and the merge wait for his yes.
