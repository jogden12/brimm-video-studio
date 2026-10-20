# Phase 1b follow-ups (after the weekend). Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix what the fidelity pass of merged phase 1b (main 2504589, PR 21) found: seven bugs, three deviations and one missing test in the code, then bring the spec, the README, the requirements and the repo's guide in line with what PR 21 built.

**Architecture:** Small, separate changes to `tool/install.sh`, `tool/edit.js`, `tool/episode.js` and `tool/studio.js` (with `tool/studio/SKILL.md`), each with its own tests, then documents. No new files of code, no new packages.

**Tech Stack:** Node 22+ (ESM, `node:test`), zsh for the installer.

**Spec:** `docs/superpowers/specs/2026-10-14-brimm-video-next-version-design.md`. The plan these follow up: `docs/superpowers/plans/2026-10-14-phase-1b-sallies-laptop.md`. The findings, numbered as below: the architect's fidelity report of 2504589 (sent to the lead on 2026-10-14).

**Not here:** 1.1 (her folder's skill and settings are not rewritten by `git pull`) is Builder B's, with PR 19, which is what changes her skill. PR 21's own follow-ups (Q1, T5, finish's `filesIn` dot files, `--over-later-records`, `--from-plan`'s claim check) stay listed in PR 21's body. The four guide changes for the morning are in the lead's Doc (rev 40); Task 9 copies them into the repo's guide.

**Order:** Tasks 1 and 2 first (the lead's priority), then 3–8 in any order, then 9. Each task leaves main working.

**As built, with the lead's review of this plan (P1–P19).** Built on five branches off main 2504589, which all merge together with 1311 of 1311 tests passing: `fix/open-held-first` (Task 2), `fix/guard-single-quotes` (Task 3), `fix/installer-check-agent` (Tasks 1 and 5), `fix/followups-resolve-release` (Tasks 4, 6, 7 and 8), and `docs/as-built-1b` (Task 9, merged last). The review changed the tasks as follows:
- **Task 1** (P4, P5, P6, P14, P15): one function takes the check agent away, from traps on EXIT, INT and TERM; a Ctrl-C or a kill stops the setup there (130 or 143). An agent an earlier setup left behind is named by `--print` and taken away first by every setup, `--rules-only` and no Claude Code included. `--remove` takes it away (tested with a stand-in `launchctl`). The agent is given a time three minutes on (`--check-claude --until`), past which it asks Claude nothing, so one a `kill -9` leaves is harmless. The guide and README add an `ls` check after a real setup. Tests that run zsh are skipped where there is no `/bin/zsh`.
- **Task 2** (P8, P16): a take-over on a Mac without the files brings them first and says to say "take it over" again, so she is asked once. "How far is it?" says so only while that take-over is still to happen, and the skill takes it over again unasked only then. Each condition after the wait has a test of its own.
- **Task 3** (P3, P4, P9, P17): a straight double quote goes in single quotes too. A property test reads random words alike in the guard, zsh and bash. The real Claude Code was checked as for PR 21 (CLI 2.1.296 and the app's 2.1.295; default, dontAsk, acceptEdits and plan; `-p` and as an SDK host): no prompt, and every word arrived letter for letter, except that Claude Code itself turns `>nul` inside quotes into `>/dev/null` (described, not refused). The guard is read from the checkout, so it changes at the `git pull`: the lock-down check runs again in that sitting, on every Mac with a folder, with a `$` title among its questions.
- **Task 4** (P13, P18): a conflicted episode is found by its record's name and by the copy's name (the guide's Test A / Test B), and refused at once.
- **Task 6** (P1, P7): `remade` is built from the same parts as the copies. A copy of its own that Dropbox took away, and that release does not make again, is listed no more; a missing copy the other Mac made stays under the not-whole check. The reviewer's test is in.
- **Task 7** (P10, P11, P19): `CONFLICT_FORMS` builds `CONFLICTED`, `OWN_WORDS` and resolve's naming of a copy's Mac; the test pins that finding copies never grows narrower.
- **Task 9** (P2, P12, P3, P11): the documents describe the code after Tasks 1–8. The guide takes only the Doc's changes that still hold, keeps step 12, and gives Task 3's rule in place of the "$ is refused" row. PR 21's own body is left for the lead.

## Global Constraints

- The tool drafts. It never posts, sends or publishes anything.
- Never read a `.env` file. The one secret is the deploy key on Sallie's laptop.
- Nothing is installed on a Mac, and no launch agent added or changed, without Jason's yes in chat. The installer runs only with `--print` in tests.
- Write a failing test first, then the code. `cd tool && node --test` passes whole before each commit (PR 21 lists three tests that sometimes fail under load: run a failing file again alone before calling it broken).
- No test calls the real `claude`, `git`, ffmpeg, `open` or Final Cut, or writes outside a temp home and root.
- Every file into Dropbox goes by the rule (made outside, `/bin/cp -c`, a new `record/NNNN.json` with `expectRev`).
- A change to the guard (`tool/studio.js` `guardDecision`) is reviewed by the lead, and the lock-down check ("Check that her Claude folder only runs BRIMM Video" in the lead's Doc) is run again on her laptop once her folder is rewritten.

## Review Focus

1. Her laptop opens an episode the Mac Studio holds, with its files online-only: refused at once, nothing downloaded (Task 2).
2. A title with `$`, a backtick or a backslash reaches edit.js letter for letter, in zsh and in bash (Task 3).
3. The installer stopped during its 90-second check: no `com.thebrimm.claude-check` is left to run at the next login (Task 1).
4. An episode renamed, then given a conflicted copy, is found by its new name, and the conflict is shown (Task 4).
5. A release when the other Mac made a part's newest push: none of this Mac's older Shares or exports of that part are copied (Task 6).

---

### Task 1: The one-shot check agent is always taken away (finding 1.4)

**Files:** Modify `tool/install.sh` (:56-58, :200-216, :360-374, :442-460); Test `tool/tests/install.test.js`; Modify `README.md` (:273).

Today the check's bootout and `rm` (:457-458) run only when the 90-second wait ends normally; under `set -euo pipefail` a Ctrl-C, or a failure at :448 or :450, leaves `~/Library/LaunchAgents/com.thebrimm.claude-check.plist` with `RunAtLoad`, so launchd calls Claude at every login, and `--remove` does not know it.

- [ ] **Step 1: Write the failing tests** (beside the "installer's own text" tests, which read install.sh):

```js
it("takes the check agent away however the install ends", () => {
  const text = readFileSync(INSTALL, "utf8");
  // A trap set before the check agent is written, on EXIT, INT and TERM, boots it out and deletes its file.
  assert.match(text, /\ntrap '[^']*launchctl bootout "gui\/\$\(id -u\)\/\$CHECK_LABEL"[^']*rm -f "\$CHECK_FILE"[^']*' EXIT INT TERM\n/);
  assert.ok(text.indexOf("trap '") < text.indexOf('check_agent "$node" > "$CHECK_FILE"'));
});
it("--remove stops the check agent too", () => {
  const r = ask("--remove", "--print");
  assert.ok(r.out.includes("  com.thebrimm.claude-check, if a setup left it behind"));
});
it("says, before the wait, that it is asking Claude", () => {
  assert.ok(readFileSync(INSTALL, "utf8").includes('say "Asking Claude once from the background job (up to 90 seconds)…"'));
});
```

- [ ] **Step 2: Run, see them fail.** `cd tool && node --test tests/install.test.js`.
- [ ] **Step 3: Implement.** Before `check_agent … > "$CHECK_FILE"`: `trap 'launchctl bootout "gui/$(id -u)/$CHECK_LABEL" 2>/dev/null || true; rm -f "$CHECK_FILE"' EXIT INT TERM`; after the existing bootout and `rm`, `trap - EXIT INT TERM`. Say the "Asking Claude…" line before the loop. In the remove mode: print the line above under `--print`, and otherwise also `launchctl bootout "gui/$(id -u)/$CHECK_LABEL" 2>/dev/null || true; rm -f "$CHECK_FILE"`. The `--print` line "At the end:" names the agent: `one real call to Claude from the background job (a launch agent of its own, com.thebrimm.claude-check, taken away when it answers)`. README:273 says the same.
- [ ] **Step 4: Run** `node --test tests/install.test.js`, then `node --test`.
- [ ] **Step 5: Commit** `git commit -m "Installer: the one-shot check agent is taken away however the install ends, and --remove knows it"`.

### Task 2: `open` refuses a held episode first, and says when Dropbox undid its claim (findings 1.6, 1.2, 1.8)

**Files:** Modify `tool/edit.js` `open` (:405-460); Test `tool/tests/edit-claim.test.js`.

Today `open` checks still-arriving, `filesProblems` and `notHere` before the claim, so on the Mac that does not have an episode it starts a `bring` of every file (raw video too) and returns 0, and only a second `open` says who has it. After the 20-second wait, a claim that is gone (Dropbox undid it) is blamed on "The other Mac".

New order: `episodeFor` → `undone` (as today) → **held elsewhere and no `--take-over`: the held-elsewhere refusal, → 1** → still arriving (not on a take-over, as today) → `filesProblems` → `notHere` → the claim → wait → re-read. After the re-read: no record → its `why` (as today); `undone(again.record, ctx.home)` or `!again.record.editing` → `Dropbox undid this Mac's claim on <name>. Say "open <name>" again.` → 1; a claim by another Mac → the "it is theirs" text with its name (as today).

- [ ] **Step 1: Write the failing tests:**

```js
it("refuses at once, and brings nothing, when the other Mac has it and its files are not here", async () => {
  const t = setup();
  const found = episodeFor(t, { record: { editing: { by: "Sallie's laptop", since: "2026-10-20T14:00:00-05:00" } } });
  t.notWhole(found, "Pricing talk.mp4"); // the stand-in isWhole says no for the raw video
  const said = [];
  assert.equal(await editMain(["open", FOLDER], { ...t.ctx.deps, say: (l) => said.push(l) }), 1);
  assert.match(said.join("\n"), /Sallie's laptop has Pricing talk open, since 2026-10-20 14:00\./);
  assert.deepEqual(t.started, []); // no bring
  t.done();
});
it("refuses, and says nothing of still arriving, when the Mac that handed it over has opened it again", async () => {
  // released: { by: "Sallie's laptop", files: { <a missing copy>: 9 } } and editing: Sallie's laptop. → 1, the held-elsewhere text, no bring.
});
it("says Dropbox undid the claim when its own claim is gone after the wait", async () => {
  // The wait stand-in deletes this Mac's record/0002.json (its claim). → 1; "Dropbox undid this Mac's claim on Pricing talk"; never "The other Mac".
});
```

(Use the stand-ins `tests/episodes.js` already has for "not whole" and for started commands; add the smallest helper there if one is missing.) The existing still-arriving test (`released.by` the other Mac, `editing: null`) must still pass unchanged.

- [ ] **Step 2: Run, see them fail.**
- [ ] **Step 3: Implement** the order above. Keep the take-over path as it is (it skips still-arriving and goes by the record's own list).
- [ ] **Step 4: Run** `node --test tests/edit-claim.test.js tests/edit-two-macs.test.js tests/edit.test.js`, then `node --test`.
- [ ] **Step 5: Commit** `git commit -m "open: refuse an episode another Mac has before bringing anything, and say when Dropbox undid the claim"`. Then tell the lead: the Doc's two-Mac step can go back to "hers must say the Mac Studio has it" on the first open.

### Task 3: Words with `$`, a backtick or a backslash, in single quotes (finding 1.3)

**Files:** Modify `tool/studio.js` (`WORD`, :114-116), `tool/studio/SKILL.md`; Test `tool/tests/studio.test.js`.

The guard allows plain words and double-quoted words without `"`, `$`, backtick or backslash, so "Charge $99" cannot be passed at all. A single-quoted word is literal in zsh and bash alike: nothing inside it expands.

- [ ] **Step 1: Write the failing tests:**

```js
it("lets single-quoted words through, and they reach edit.js letter for letter in zsh and bash", () => {
  const words = ["title", "Pricing talk", "--words", "Charge $99 `now` \\ok"];
  const command = `${EDIT} title "Pricing talk" --words 'Charge $99 \`now\` \\ok'`;
  assert.equal(bash(command), "allow");
  // The same words after a printf stand-in for node and edit.js: each shell must give them back unchanged.
  const tail = command.slice(EDIT.length);
  for (const shell of ["/bin/zsh", "/bin/bash"]) {
    const out = spawnSync(shell, ["-c", `printf '%s\\n'${tail}`], { encoding: "utf8" }).stdout;
    assert.deepEqual(out.split("\n").slice(0, -1), words, shell);
  }
});
it("still refuses a single quote that is not a whole word", () => {
  for (const c of [`${EDIT} open 'a'b`, `${EDIT} open 'a`, `${EDIT} open 'a''b'`, `${EDIT} open 'a\nb'`, `${EDIT} open 'x' ; date`])
    assert.equal(bash(c), "deny", c);
});
```

And run every command the existing "lets edit.js run" test allows through the same printf check, so the grammar and the shells cannot drift apart.

- [ ] **Step 2: Run, see them fail.**
- [ ] **Step 3: Implement.** `WORD` gains a third form, `'[^'\r\n]*'`. Its comment says why it is safe (no expansion inside single quotes in zsh or bash; a `'` cannot appear inside). SKILL.md, under the command line: "Words with a `$`, a backtick or a backslash go in single quotes instead of double. Words with an apostrophe stay in double quotes. Words with both cannot be passed: ask her to say them another way (for example "99 dollars")."
- [ ] **Step 4: Run** `node --test tests/studio.test.js`, then `node --test`.
- [ ] **Step 5: Commit** `git commit -m "Her guard: single-quoted words, so a title can hold a dollar sign"`. The lead reviews the guard change; once her folder is rewritten (1.1), the lock-down check runs again on her laptop, and the Doc's "$ sign is refused" row goes.

### Task 4: A conflicted episode is found by its own name (finding 1.5)

**Files:** Modify `tool/edit.js` `findEpisode` (:138-148); Test `tool/tests/edit-resolve.test.js`.

While a conflicted copy is there, `readEpisode` gives no record, so `findEpisode` matches only the folder's name. `name` never renames the folder, so `resolve "know your costs"` says "No episode fits", and the guide's conflict step renames episodes on purpose.

- [ ] **Step 1: Write the failing test:**

```js
it("finds an episode with a conflicted copy by its own name, and shows the conflict", async () => {
  // episodeFor with name "Know your costs" (folder "Pricing talk"), plus record/0002 (Sallie's laptop's conflicted copy 2026-10-20).json.
  // resolve "know your costs" → 0 and shows A and B; open "know your costs" → 1 with the conflict's words, not "No episode fits".
});
```

- [ ] **Step 2: Run, see it fail.**
- [ ] **Step 3: Implement.** In `findEpisode`, for matching only: `const known = (e) => e.read.record || (e.read.code === "CONFLICTED" ? readEpisode(e.folder, { pastCopies: true }).record : null);` and use `known(e)` in `byId` and `byWords`. Return the entry with its `read` unchanged, so every command but `resolve` still refuses.
- [ ] **Step 4: Run** `node --test tests/edit-resolve.test.js tests/edit.test.js`, then `node --test`.
- [ ] **Step 5: Commit** `git commit -m "A conflicted episode is found by its own name, not only by its folder's"`.

### Task 5: `--rules-only` asks Claude nothing at setup (finding 1.7)

**Files:** Modify `tool/install.sh` (:306, :348, :366, :445); Test `tool/tests/install.test.js`.

- [ ] **Step 1: Write the failing test:** `--print --machine "Sallie's laptop" --rules-only <root>` (with the stand-ins of the other `--machine` tests) has no "At the end:" line and still says `nothing leaves this Mac`.
- [ ] **Step 2: Run, see it fail.**
- [ ] **Step 3: Implement.** `check_line` stays empty under `--rules-only`, and the check runs only when `[[ -n "$machine" && -z "$rules_only" ]]`.
- [ ] **Step 4: Run** `node --test tests/install.test.js`, then `node --test`.
- [ ] **Step 5: Commit** `git commit -m "Installer: with --rules-only, setup asks Claude nothing"`.

### Task 6: `release` copies only the parts it checked (deviation 2.1)

**Files:** Modify `tool/edit.js` `releaseEpisode` (:1187-1226); Test `tool/tests/edit-claim.test.js`.

The freshness rule runs for the parts in `mine` (this Mac made their newest push), but the Shares and exports of every pushed part are copied. A part the other Mac pushed last then arrives there with this Mac's older Share and a stale export that looks newer (a bundle's folder is made new), and finish may take it.

- [ ] **Step 1: Write the failing test:**

```js
it("copies nothing of a part the other Mac pushed last", async () => {
  // main pushed v2 on Mac Studio (mine); reel 1 pushed v1 on Mac Studio, then v2 on Sallie's laptop (not mine).
  // From Final Cut holds main's Share + newer export, and reel 1 v1's Share + an OLDER export.
  // release --no-hand-edits → 0; edit/from-final-cut/ has main's two files only; record.files lists no reel 1 copy.
});
```

- [ ] **Step 2: Run, see it fail** (today reel 1's pair is copied, exit 0).
- [ ] **Step 3: Implement.** Keep in `whole` and `exports` only files whose project's part key is in `mine`. Do not run the freshness rule on the other parts: an export-less Share of a part this Mac did not push last is not this Mac's to judge.
- [ ] **Step 4: Run** `node --test tests/edit-claim.test.js tests/edit-two-macs.test.js`, then `node --test`.
- [ ] **Step 5: Commit** `git commit -m "release: copy only the parts this Mac pushed last, the ones it checked"`.

### Task 7: One list of Dropbox's conflict names (deviation 2.3)

**Files:** Modify `tool/episode.js` (`CONFLICTED` :30-34, `OWN_WORDS` :158); Test `tool/tests/episode.test.js`.

Finding copies goes by `CONFLICTED`; `conflictedOf` strips by `OWN_WORDS`, a second pattern. Widened alone after the guide's conflict step, `CONFLICTED` would find a copy that `conflictedOf` cannot name.

- [ ] **Step 1: Write the failing test:** for each name in one table (Dropbox's forms, a Mac's name with brackets, a numbered second copy, a video's own "(managing conflict)"), `CONFLICTED.test(name)` is true exactly when `conflictedOf(name) !== name`. Export `CONFLICT_FORMS` and assert both patterns are built from it.
- [ ] **Step 2: Run, see it fail** (`CONFLICT_FORMS` does not exist).
- [ ] **Step 3: Implement.** `export const CONFLICT_FORMS = { copy: "conflicted copy", kinds: ["Case", "Unicode Encoding", "Selective Sync"] }`; build `CONFLICTED` and `OWN_WORDS` from it. The comment says: what the guide's conflict step learns goes here, once.
- [ ] **Step 4: Run** `node --test tests/episode.test.js tests/edit-resolve.test.js`, then `node --test`.
- [ ] **Step 5: Commit** `git commit -m "Dropbox's conflict names in one place, for finding copies and naming what they copy"`.

### Task 8: A test that only its own flag lifts the no-answer refusal (finding 3.1)

**Files:** Test `tool/tests/edit-claim.test.js` (:384-395).

The code is right (edit.js:586-591); no test would catch `--no-hand-edits` lifting the refusal after a take-over.

- [ ] **Step 1: Extend the take-over test:** after the refusal, push as her with `--no-hand-edits` → 1, rev unchanged; then with `--without-other-macs-changes` → 0, and the Reel's `pushed` gains v2 on "Sallie's laptop".
- [ ] **Step 2: Run, see it pass;** then let `--no-hand-edits` lift the refusal in edit.js on purpose, see the test fail, and put the code back.
- [ ] **Step 3: Commit** `git commit -m "Test: after a take-over, only --without-other-macs-changes lifts the push's refusal"`.

### Task 9: The documents (spec section 4 first)

**Files:** Modify the spec, `README.md`, `docs/requirements.md`, `docs/setup/sallies-laptop.md`, `tool/install.sh` (one line), and the plan 1b file (an "As built" note).

- [ ] **Step 1: Spec section 4, the read lock (4.1).** Replace spec:261's lock-down: deny rules (the editing and web tools, `mcp__*`, Monitor, RemoteTrigger, SendMessage) plus a PreToolUse guard on every tool, in exec form with `onFailure: "block"` (Claude Code 2.1.295 or later). The guard allows only `node "<checkout>/tool/edit.js"` with plain or quoted words, and the brimm-edit skill; it decides Read itself (her folder and the session's own tool-results and tasks folders, links followed); it denies Glob, Grep and everything else. Say in one sentence why `blockReadsOutsideWorkingDirectories` is not used: it took edit.js's own path as a read outside her folder and stopped every command.
- [ ] **Step 2: The rest of the spec.** :263 `show <episode> transcript|notes|plan` (4.9). :179 a take-over goes by the record's own list and says "not whole", not "still arriving" (4.4). :183 resolve's outcomes: it compares a record's copy with the record in force; with records written after the copy it keeps neither and says a conflict needs Jason; a copy above the newest waits for Dropbox; `--keep` acts on the copy shown last; nothing is lost (4.6). :351 finish claims an episode nobody has open for its run and lets it go when it ends or fails (4.2). Setup item 1: "macOS 26.6 or later (Final Cut 12.4's LSMinimumSystemVersion); an older macOS gets 12.3"; item 11: her folder is written only with Claude Code 2.1.295 or later, else the install says why and exits 1 (4.8).
- [ ] **Step 3: README.** :253 the claim paragraph: finish's claim (4.2); a Share with no export passes on "no changes" (4.3); a take-over does not wait for still arriving (4.4). :310 finish's claim (4.2). :3, :7 and the What-is-where rows: both Macs, Final Cut Pro on both, edit.js's new commands, `tool/studio.js` and `tool/studio/` (4.7). :273 matches Task 1. Name the lock check by its title, "Check that her Claude folder only runs BRIMM Video", not "step 9" (2.2); the installer's `--print` line (:365) the same.
- [ ] **Step 4: `docs/requirements.md` :20-22 (4.7).** Close the editor decision: Final Cut Pro on both Macs (Jason, 2026-10-14). requirements.md holds Jason's preferences: show him the change before it merges.
- [ ] **Step 5: The repo's guide.** Copy in the lead's Doc rev 40 changes (the two-Mac step expects "bringing its files down" on her first open until Task 2 lands; re-run a failing test file alone in the Mac Studio pull step (4.5); the "$ sign is refused, write 99 dollars" row until Task 3 lands; the lock check's title) and the Doc's "a conflict needs Jason" row (4.6).
- [ ] **Step 6: The plan 1b file.** Add an "As built (PR 21)" section under its header, one line each, rather than rewriting its tasks: the guard decides Read and denies Glob and Grep, exec-form hook with the folder argument, no `blockReadsOutsideWorkingDirectories` (4.10, ruling 10, Task 2); resolve's changed rules and `--over-later-records` out (4.11, Task 6, Review Focus 5); release of an unclaimed episode this Mac pushed last (4.12); a Share with no export passes on "no changes" (4.3, ruling 6); finish's claim (4.2, ruling 1); a take-over skips still arriving (4.4); a Reel's title was on main already, only `reels` and `ask` waited for PR 19 (2.4).
- [ ] **Step 7: Run** `cd tool && node --test` (the installer's text tests read install.sh). **Commit** `git commit -m "Documents: the spec's read lock and the rest of what PR 21 changed, the README, the requirements' editor, and the repo's guide"`.

## Self-review

- Every finding of the report is placed: bugs 1.2–1.8 in Tasks 1–5 (1.1 with Builder B); deviations 2.1 Task 6, 2.2 Task 9 Step 3 (the Doc part done by the lead), 2.3 Task 7, 2.4 Task 9 Step 6; 3.1 Task 8; 4.1–4.12 Task 9.
- Review Focus 1–5 each have their test: Tasks 2, 3, 1, 4, 6.
- Tasks 1 and 3 touch what needs Jason's yes or the lead's review to go live (the installer, the guard); none of their tests runs the installer for real or changes her laptop.
