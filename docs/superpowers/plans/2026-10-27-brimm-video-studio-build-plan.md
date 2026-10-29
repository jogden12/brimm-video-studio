# BRIMM Video Studio: the build plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build BRIMM Video Studio from brimm-video as it stood at c666508 (the tag `brimm-video-v1` and the late-check groundwork merged after it): the HyperFrames project maker (B1), the finish from the app's exports (B2), the guide's new states, the two-Mac snapshot, the session reading and clips (S1, S2), and then the retirement of what the app does. Each step is a pull request that Jason merges, test first.

**Architecture:** `docs/superpowers/specs/2026-10-27-brimm-video-studio-architecture.md`. Two doors between Studio and the app: a project folder going in, exported files coming out. The BRIMM Ops hand-off is the same file, written by the same code.

**Tech Stack:** Node 22+ (ESM, `node:test`, no packages), zsh for the installer, Swift for the picture checks.

**Spec:** the architecture above; the accepted design `2026-10-27-brimm-video-with-the-hyperframes-app.md` (until it is merged, on `claude/zealous-bell-esuqck` of brimm-video, or `claude/design-2026-10-27` of brimm-video-studio); the handoff `docs/handoffs/2026-10-27-brimm-video-studio-full-handoff.md`.

**Not here:**
- A0 and A0b, the app tests (Jason, by hand). This plan says which pull request waits for which answer.
- The Studio repo's `main` branch and its copy of the tag `brimm-video-v1` (handoff Appendix A, section 6). brimm-video already has the tag, at 42a39a3. The Studio repo exists (Jason made it on 2026-10-28) and holds brimm-video's history up to c666508 on the branch `claude/seed-from-brimm-video`. A cloud session may push only `claude/*` branches, so Jason renames that branch to `main` and pushes the tag to the Studio repo from a clone that has both remotes.
- Switching Sallie's laptop to the light import (`docs/setup/sallies-laptop.md`).
- The contract change for a session clip with no client (decision D5, with brimm-operations).
- HeyGen's training opt-out (Jason's email).
- Installing anything on a Mac. The installer is shown with `--print` until Jason says yes.

**Where the code goes.** In `brimm-video-studio` (Jason made it on 2026-10-28). brimm-video keeps running for Sallie from its main checkout and gets no new code from this plan.

---

## The order

| PR | What | Needs | Waits for A0? | By hand, on a Mac |
|---|---|---|---|---|
| 1 | `hyperframes.js`: the pinned command line's rules (pure) | The Studio repo | No | None |
| 2 | `project.js`: a project's whole file set, and its writer | PR 1 (it reads PR 1's command table and pin file) | The notes' words (D4, D6) can change after A0; the structure does not | A0b: Jason opens a sample project this makes |
| 3 | `workcopy.js`: the working copy | None | No | Time one real 5-minute clip; an HDR clip by eye |
| 4 | `app` and `workcopy`: layout 4, settings, the commands, the skill, the README rows, `open` without its Final Cut lines, the installer's toolchain, Chrome and doctor steps (printed) | 1 to 3 | Items 1 and 2 (the handover's default): started before both were answered, on Jason's yes of 2026-10-28, with the handover off by default; A0 step 4 found the handed-over chat blank | Install the toolchain (Jason's yes); `app` on a recording of Jason's own |
| 5 | `app … reel N`: Reel projects; `title`, `reels` and `reel drop` made to work for them | 4 | Item 4 (where a Reel project lands) | One Reel opened |
| 6 | `app … what-happened`, `… versions` | 4 | Item 1 (the app writes its history without a handover) | After a few requests in the app |
| 7 | `exports.js` and `finish` for a raw video and an iPhone clip (B2a); an iPhone clip's hand-off no longer written from the import; `show transcript` for a raw video | 4 | Item 3 (export names and folder): answered on 2026-10-28 by A0 and the app's docs (spec 8.1) | One real hand-off into BRIMM Ops |
| 8 | The words on the picture; suggestions by `inMain` (B2b) | 7 | A0b fixtures | Compare with what is on screen |
| 9 | `finish … reels` for a finished video (B2c) | 5, 7 | No | One Reel of a finished video |
| 10 | The guide's new states and progress steps; its Final Cut stages go | 4, 7 | No | Ask "what's next?" at each stage |
| 11 | `release`'s snapshot, and the take-over | 4, 7 | No | Release on one Mac, take over on the other |
| 12 | S1: a Zoom download is a session; the reading at the drop; clip suggestions; the feedback switches; `heygenOptOut` | Sallie's laptop on the light import; 1 | No | Jason's own made-up call |
| 13 | S2: `clips` | 12, 4 | Items 2, 5 | A clip through to the app |
| 14 | S3: a session clip in the hand-off | D5 decided with brimm-operations | No | |
| 15 | `free`: built, to take a project's working copy and `renders/` away (today a stub) | 4 | No | Free one old episode |
| R1 to R6 | The retirement waves (spec section 10) | The wave before; Jason's yes each | No | Each says what to try |

PR 1 and PR 3 are independent of each other, so two sessions can build them side by side, each in its own worktree. PR 2 follows PR 1, since it reads PR 1's command table and pin file.

---

## Baseline: the suite on a cloud box

Measured on 2026-10-27 on this repo at c666508, in a Linux container (Node 22.22). GitHub Actions on the same commit passes (run 488, Ubuntu, Node 24), and the Mac's run was 3749 of 3749 at the handoff. The box is not the Mac, so a cloud session needs to know which failures are the box's.

| How it is run | Result |
|---|---|
| As root, in the checkout | 3677 tests: 3616 pass, **30 fail**, 31 skipped. Twenty-six make a file unreadable or unwritable and expect a refusal, which root is not given; the other four are the signal tests of the third row |
| As a user that does not own the checkout | 3642 pass, 5 fail, 30 skipped: the four of the third row, and one that asks `git` for the short commit of a checkout someone else owns ("is the short commit the checkout is at") |
| **As a non-root user that owns a copy of the checkout** | **3643 pass, 4 fail, 30 skipped.** The four are about signals and process groups: "stops what the program started too, since it runs in a group of its own" and "stops what it runs when this process is stopped by SIGTERM / SIGINT / SIGHUP, as launchctl stops the import" (a fifth line, "a program run under the watchdog", is the suite that holds them) |

The recipe that gives the third row, for a cloud session:

```
rm -rf /dev/shm/brimm-copy && mkdir -p /dev/shm/brimm-copy/tmp
cp -r <the checkout> /dev/shm/brimm-copy/repo
chown -R 65534:65534 /dev/shm/brimm-copy && chmod 700 /dev/shm/brimm-copy
cd /dev/shm/brimm-copy/repo/tool
setpriv --reuid=65534 --regid=65534 --clear-groups \
  env -i PATH="$PATH" HOME=/dev/shm/brimm-copy TMPDIR=/dev/shm/brimm-copy/tmp LANG=C.UTF-8 GIT_CONFIG_GLOBAL=/dev/null \
  node --test
rm -rf /dev/shm/brimm-copy
```

Those four are the box's, not the code's. A pull request is green when no other test fails there and CI is green. Nothing in this plan changes them.

---

## Global Constraints

- The tool drafts. It never posts, sends or publishes anything, and nothing here adds that.
- Never read a `.env` file. The one secret is the read-only deploy key on Sallie's laptop.
- Nothing is installed on a Mac, and no launch agent is added or changed, without Jason's yes in chat. The installer runs only with `--print`, by a test or by hand.
- Write a failing test first, then the code. `cd tool && node --test` passes whole (but for the box's four) before each commit.
- **No test calls the HyperFrames app, HeyGen, the real command line, or the real `claude`.** A stand-in answers, from fixtures captured from the pinned version.
- No launch agent runs from Studio's checkout yet: brimm-video's `com.thebrimm.unedited` still runs from brimm-video's own folder, and nothing here changes it. When Studio gets one (a new label, on Jason's yes), that checkout stays on `main`. Work in git worktrees either way. Experiments never write into the watched Dropbox folder.
- Projects live in `~/BRIMM Video Work`, never in Dropbox or a watched folder. Final Cut's library, where it still matters, is there too.
- Every file into Dropbox goes by the rule: made outside, cloned in under a new name, never over a file, the record last with `expectRev`.
- The hand-off and its contract do not change: `handoff.js`, `handoff-v2.js`, the five fixtures, `tool/shared/`, `lib.js`, `run.js`. `tests/contract.test.js` pins the fixtures' hashes.
- A session's words are never in a log line, a status line, a project name or a file name. Where a command does print them (the teachings, and a clip's point), the chat that is shown them is marked (`held.js`), as today.
- A new command lives in its own module and `edit.js` only wires it. In the same commit it gets an entry in `ASKED` (`edit-gate.test.js`), in `TODAY_ASKED` and `walkWords` (`edit-labels.test.js`), and a README row when its usage is in `HELP` (`part-f-fixes.test.js`). A gate list is a decision for each command (spec 6.2): a command in none is refused for a video not yet answered and for a session not cleared, so it is never put in a list to make a test pass.
- A change to the skill changes every test that pins its sentences in the same commit (spec 6.4).
- Merges are Jason's, one at a time, with a merge commit. Commit messages end with a blank line and the `Co-Authored-By:` and `Claude-Session:` lines the session's reminder gives.

## Review Focus

1. A project holds only files the maker chose: the file list of each kind is asserted whole (PR 2).
2. `CLAUDE_CODE_SESSION_ID` reaches the command line only when all five conditions of spec 5.6 hold (PR 1, PR 4).
3. Every command of the pinned command line is classified, and the pin cannot move without it (PR 1).
4. The contract fixtures' hashes are untouched (every PR).
5. `app` on a session refuses and `clips` is the only way a clip reaches the app (PR 4, 13).
6. Nothing a session's clip is called, or says, appears in a name, a log or a status (PR 12, 13).

## How each pull request is built

As the late-check work was (handoff, section 7): this plan's tasks, with test names and exact strings; one fresh subagent per task, never two on one worktree, each told never to touch the main checkout; a ledger file of commits and rulings; a read-only reviewer for each batch; and the controller reading every risky diff itself. The suite after every task, in the box's way above.

---

## PR 1. `hyperframes.js`: the pinned command line's rules

**Files:** Create `tool/hyperframes.js`, `tool/hyperframes.pin.json`, `tool/tests/hyperframes.test.js`, and the fixtures in `tool/tests/fixtures/hyperframes-0.8.208/`: `help.txt`, `open-not-installed.json`, `open-opened.json`, `open-opened-handed-over.json`, `catch-up-empty.json`, `history-empty.json`, `app-history.jsonl`.

Pure: it runs nothing and reads no disk but its fixtures. Everything it decides is data or a function of data.

- [ ] **Step 1: Capture the fixtures** from the pinned version, on any machine with network, in a scratch folder (not a Mac's real folders):

```
npm install --prefix "$SCRATCH/hf" --ignore-scripts --no-fund --no-audit --save-exact hyperframes@0.8.208
HF="$SCRATCH/hf/node_modules/hyperframes/bin/hyperframes.mjs"
run() { env -i PATH="$PATH" HOME="$SCRATCH/home" HYPERFRAMES_NO_TELEMETRY=1 HYPERFRAMES_SKIP_SKILLS=1 HYPERFRAMES_NO_UPDATE_CHECK=1 HYPERFRAMES_NO_AUTO_INSTALL=1 HYPERFRAMES_NO_OPTIONAL_INSTALL=1 CI=1 NO_COLOR=1 node "$HF" "$@"; }
run --help > help.txt                     # 43 commands, 73 lines
run init p --non-interactive --skip-skills --skip-transcribe --resolution landscape
run history --dir p --json                # history-empty.json
run catch-up p --json                     # catch-up-empty.json
run open p --json                         # open-not-installed.json on Linux; exit 1
```

`run` carries the same `HYPERFRAMES_` variables as `childEnv` (spec 5.5), so that a capture, at a pin move too, does not ask npm for a newer version or install anything.

Four of the seven fixtures are captures: `help.txt`, `history-empty.json` (`{"entries": [], "_meta": {"version", "updateAvailable"}}`), `catch-up-empty.json` (`{"project", "turns": [], "files": []}`) and `open-not-installed.json` (`{"project", "opened": false, "reason": "not-installed", "downloadUrl"}`). Two need the app and are written from the command line's own code (`dist/chunk-43MW4SY7.js`, `dist/open-*.js`), since only a Mac with the app can print them; A0b replaces them with captures. `open-opened.json` is `{"project": "<dir>", "opened": true, "app": "the HyperFrames desktop app", "handedOver": null}`, and `open-opened-handed-over.json` is the same with `"handedOver": {"engine": "claude", "sessionId": "…"}` and, last, `"catchUp": "npx hyperframes catch-up"`. The seventh, `app-history.jsonl`, is three lines of `{"at","engine","asked","did","files"}` made up for the test.

- [ ] **Step 2: Write the failing tests.** The first group:

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PIN, openArgs, commandsIn, unclassified, COMMANDS } from "../hyperframes.js";

const fixture = (name) => readFileSync(new URL(`./fixtures/hyperframes-0.8.208/${name}`, import.meta.url), "utf8");
const help = fixture("help.txt");
const HOME = "/Users/sallie";
const NODE = "/opt/homebrew/bin/node";

describe("the pinned command line", () => {
  it("is version 0.8.208, with the registry's integrity string", () => {
    assert.equal(PIN.version, "0.8.208");
    assert.match(PIN.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/);
  });
  it("is run by absolute path, never by npx", () => {
    const { file, args } = openArgs({ home: HOME, node: NODE, project: `${HOME}/BRIMM Video Work/E/P` });
    assert.equal(file, NODE);
    assert.deepEqual(args, [`${HOME}/BRIMM Video Work/.toolchain/hyperframes-0.8.208/node_modules/hyperframes/bin/hyperframes.mjs`, "open", `${HOME}/BRIMM Video Work/E/P`, "--json"]);
    assert.ok(!args.includes("npx"));
  });
});

describe("every command of the pinned help is classified", () => {
  it("finds the 43 commands in the help", () => assert.equal(commandsIn(help).length, 43));
  it("leaves none unclassified", () => assert.deepEqual(unclassified(help), []));
  it("reports one that no class names", () => assert.deepEqual(unclassified(`${help}\n  frobnicate         Does a thing\n`), ["frobnicate"]));
  it("has 20 the agent may run, 2 for edit.js only and 21 denied", () => {
    const count = (c) => Object.values(COMMANDS).filter((x) => x.class === c).length;
    assert.deepEqual([count("agent"), count("edit"), count("denied")], [20, 2, 21]);
  });
  it("puts no command in two classes, and gives each a reason", () => {
    for (const [name, c] of Object.entries(COMMANDS)) assert.ok(["agent", "edit", "denied"].includes(c.class) && c.why, name);
  });
});
```

The second group (names here; each is a few lines):

| Test | Asserts |
|---|---|
| `denyRules` has a rule for each command the agent may not run, in each spelling | For `publish`: `Bash(npx hyperframes publish:*)`, `Bash(npx --yes hyperframes@0.8.208 publish:*)`, `Bash(hyperframes publish:*)`; and `Bash(npm run publish:*)` is there. The same for `open` and `catch-up`, which only `edit.js` runs. None for a command the agent may run |
| `settingsFor("main")` holds the deny rules and ten variables, and nothing else | `permissions` has `deny` only (no `allow`); `env` is exactly `HYPERFRAMES_NO_TELEMETRY=1`, `HYPERFRAMES_SKIP_SKILLS=1`, `HYPERFRAMES_NO_UPDATE_CHECK=1`, `HYPERFRAMES_NO_AUTO_INSTALL=1`, `HYPERFRAMES_NO_OPTIONAL_INSTALL=1`, `DISABLE_FEEDBACK_COMMAND=1`, `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY=1`, and, blank, `HEYGEN_API_KEY=""`, `HYPERFRAMES_API_KEY=""` and `HEYGEN_ACCESS_TOKEN=""` (the three by which the command line takes a HeyGen key or token, spec 5.5) |
| `settingsFor("clip")` also denies `WebFetch` and `WebSearch` | Both present; absent for `main` |
| `childEnv` holds exactly these names | With a base holding `ANTHROPIC_API_KEY`, `HTTPS_PROXY`, `AWS_SECRET_ACCESS_KEY`, `GITHUB_TOKEN`, `CLAUDE_CODE_SESSION_ID`, `HEYGEN_API_KEY`, `HYPERFRAMES_API_KEY`, `HEYGEN_ACCESS_TOKEN`: the result has `PATH`, `HOME`, `LANG`, `HYPERFRAMES_NO_TELEMETRY`, `HYPERFRAMES_SKIP_SKILLS`, `HYPERFRAMES_NO_UPDATE_CHECK`, `HYPERFRAMES_NO_AUTO_INSTALL`, `HYPERFRAMES_NO_OPTIONAL_INSTALL` and none of those |
| `childEnv({ handover: true, sessionId })` adds `CLAUDE_CODE_SESSION_ID` and nothing else | Exactly one more name |
| `handoverAllowed` is refused for each of these, with its reason | The setting off ("off"); an id that is not a chat's ("no chat"); no id ("no chat"); a held chat ("held"); a session episode ("session"); an unanswered one ("unanswered"); a session clip ("clip"). Allowed only when none holds (a table, as spec 5.6) |
| `readOpen` says each outcome in her words | See the table below |
| `readOpen` takes what it cannot read as "wouldn't open" | Empty output, bad JSON, `opened` missing, exit 0 or 1 |
| `turnsOf` reads the app's history lines | The fixture's three lines; a line that is not JSON, and one with a date that is not a date, are passed over; a text is cut at 2,000 characters |
| `turnsOf` of nothing is `[]` | `""`, `null`, `undefined` |
| `plainTurns` says a turn in her words, newest first | "3:41 pm: you asked …; HyperFrames did …; changed index.html", with no path and no flag |

The words `readOpen` gives (proposed; they may change in review, the table is what the test pins):

| Outcome | `words` |
|---|---|
| `opened: true`, no handover | "It's open in HyperFrames." |
| `opened: true`, `handedOver` set | "It's open in HyperFrames, and it picks up this conversation." |
| `opened: true`, handover wanted but not made | "It's open in HyperFrames. It starts a new conversation." The reasons are `handoverAllowed`'s, so the caller adds the one that is true |
| `not-installed` | "HyperFrames isn't installed on this Mac: ask Jason." |
| `open-failed` | "HyperFrames wouldn't open. Try once more; if it still won't, ask Jason." |
| `unsupported-platform`, `handoff-unavailable` | "HyperFrames can't be opened from here: ask Jason." |
| Anything else | "HyperFrames wouldn't open. Try once more; if it still won't, ask Jason." |

- [ ] **Step 3: Run, see them fail** (`cd tool && node --test tests/hyperframes.test.js`: cannot find the module).
- [ ] **Step 4: Write the module.**
  - `PIN`: read from `hyperframes.pin.json` (`version`, `integrity`; `gsap` is added in PR 2).
  - `toolchainDir(home)` is `<home>/BRIMM Video Work/.toolchain/hyperframes-<version>`; `cliPath(home)` is `<that>/node_modules/hyperframes/bin/hyperframes.mjs`. Use `workFolder` from `settings.js`.
  - `COMMANDS` is a table `{ name: { class, why } }` for the 43 (spec 5.5): `agent` for the 20, `edit` for `open` and `catch-up`, `denied` for the other 21. Neither `clean` nor `remove-background` is run by anyone.
  - `commandsIn(help)` takes the lines from the first category header ("Getting Started:") to the end of the help that match `/^  ([a-z][a-z-]+) {2,}\S/`. The examples start with `$` and never match, and a command added after them is still found (the `frobnicate` test).
  - `unclassified(help)` is `commandsIn(help)` minus the keys of `COMMANDS`, in help order.
  - `denyRules()` and `settingsFor(kind)` as the table above. The rules are sorted so the file is the same every time.
  - `childEnv({ base, node, handover, sessionId })` builds the list; `PATH` is `dirname(node)`, `/usr/bin`, `/bin`.
  - `handoverAllowed({ setting, sessionId, held, episode, project })` returns `{ allowed, why }`, testing in the order of the table; `SESSION_ID` is imported from `scan.js`.
  - `openArgs`, `readOpen(stdout, code, { handoverWanted })`, `turnsOf(text)`, `plainTurns(turns, { tz })`.
- [ ] **Step 5: Run, see them pass,** then the whole suite.
- [ ] **Step 6: Commit** "Studio B1: the pinned HyperFrames command line's rules".

---

## PR 2. `project.js`: a project's whole file set

**Files:** Create `tool/project.js`, `tool/tests/project.test.js`, `tool/brand/brand.md`, `tool/brand/fonts/` (Josefin Sans Light, Regular, Regular Italic and Medium as `woff2`, the latin files of `@fontsource/josefin-sans` 5.3.0, and Allison, Google Fonts' own `Allison-Regular.ttf`, with their licence texts: the italic and Allison are Jason's decisions of 2026-10-28), `tool/vendor/gsap.min.js` (3.14.2, the version `init` writes), and golden fixtures in `tool/tests/fixtures/hyperframes-0.8.208/init/` (`hyperframes.json`, `meta.json`, `package.json`, `index.html`, `CLAUDE.md`, `words.srt`, `transcript.json`: what the pinned `init --video` and `transcribe` write). Modify `tool/hyperframes.pin.json` (GSAP's version and checksum) and `tool/names.js` (`partName` exported).

The video is not made here. The writer is given the path of a finished working copy (PR 3, on the same disk) and moves it into `media/recording.mp4` last, by a rename, so a project never holds a half-written video.

- [ ] **Step 1: Capture the golden fixtures** as PR 1's step 1 does: `run init golden --video tiny.mp4 --resolution landscape --non-interactive --skip-skills --skip-transcribe`, then `run transcribe words.srt --dir golden`. `tiny.mp4` is six seconds made with `ffmpeg -f lavfi -i testsrc2=size=1920x1080:rate=30:duration=6 …`; nothing of Sallie's is used. Captured on 2026-10-28 with the copy of 0.8.208 that A0 installed on the Mac Studio, in a scratch folder with a stand-in home, so nothing was installed for it.
- [ ] **Step 2: Write the failing tests.** Names, with what each asserts:

| Test | Asserts |
|---|---|
| `index.html` loads no script and no stylesheet from the network | No `src=` or `href=` value starts with `http`; GSAP is `vendor/gsap.min.js` |
| `index.html` has the golden's structure | Same attribute names on the root and the `<video>`: `data-composition-id`, `data-start`, `data-duration`, `data-width`, `data-height`, `class="clip"`, `data-track-index`, `data-has-audio`; one `window.__timelines` registration under the root's id |
| `index.html` takes its size and length from the working copy's facts | 1920×1080, 6 s; and 1080×1920 for an upright clip |
| `hyperframes.json` has the golden's keys, and no registry on a moving branch | The golden's keys but `registry`, which is left out, so no value contains `raw.githubusercontent.com` (until A0b says the key is required: then it is `""`) |
| `package.json` has `dev`, `check` and `render` and no `publish` | Each runs `hyperframes <command>`; `name` is the project's |
| `meta.json` has `id`, `name`, `createdAt` | `name` is the project's name |
| `transcript.json` is the list the pinned `transcribe` writes | Same keys and ids as the golden for the same words; punctuation kept |
| `transcript.json` applies the episode's spellings | "Hormozy" becomes "Hormozi" in `text`; ids and times unchanged |
| `brimm/cut-suggestions.json` uses the transcript's ids | Every `from` and `to` is an id in `transcript.json`; `start` and `end` are those words'. The ids go by the words' places in the plan's phrases, never by their times, which two words can share, and a plan that holds other words is refused |
| `brimm/reel-suggestions.json` has stretches, ids, title, first and last words, and why | Present for a main project, absent for a Reel and a clip |
| The whole file list of a main project is exactly this | `index.html`, `meta.json`, `hyperframes.json`, `package.json`, `transcript.json`, `CLAUDE.md`, `AGENTS.md`, `.claude/settings.json`, `media/recording.mp4`, `vendor/gsap.min.js`, `assets/fonts/josefin-sans-latin-{300,400,500}-normal.woff2`, `assets/fonts/josefin-sans-latin-400-italic.woff2`, `assets/fonts/Allison-Regular.ttf`, `assets/logos/<each chosen>`, `brimm/facts.json`, `brimm/cut-suggestions.json`, `brimm/reel-suggestions.json`, `brimm/spellings.json`, `brimm/brand.md`, and the link `node_modules/.bin/hyperframes` |
| The file list of a Reel project | The same, without `cut-suggestions.json` and `reel-suggestions.json` (its `media/recording.mp4` is the Reel's stretch, PR 5) |
| The file list of a session clip's project | `index.html`, `meta.json`, `hyperframes.json`, `package.json`, `transcript.json`, `CLAUDE.md`, `AGENTS.md`, `.claude/settings.json`, `media/recording.mp4` (the clip), `vendor/gsap.min.js`, the fonts, `brimm/facts.json`, `brimm/brand.md`, the link. **No** spellings, cut suggestions, Reel suggestions or logos |
| The video is moved in, not copied | After `writeProject` the source file is gone and `media/recording.mp4` holds its bytes; a failure at any step puts the video back where it was and leaves no folder |
| A session clip's name, folder, `meta.json` and `brimm/facts.json` hold no part of the file's name | Built from a file called "GMT20261013-142933_Recording_Jane Doe.mp4": neither "Jane", "Doe" nor the Zoom time appears anywhere in the file set |
| `CLAUDE.md` and `AGENTS.md` are the same text | Byte for byte |
| The BRIMM rules come first and say they come before everything below | The first heading is "The BRIMM: rules for this project"; the text "These rules come before everything below" follows it |
| The notes tell the agent never to run `skills update`, `publish`, `cloud`, `tts` or `add`, and to use `transcript.json` | Every denied command of PR 1's table is named in the rules |
| The vendored HyperFrames guidance has none of the lines that conflict | With the golden `CLAUDE.md` as input, the output has no `skills update`, no `publish`, no `npm run publish`, no `hyperframes.heygen.com`, and no `catch-up`, `upgrade` or `registry`: a paragraph that names a command the agent may not run goes whole, and in a list or a block of code its line goes |
| A session clip's notes begin with its own rules | "This is a clip of a private client session" is above the BRIMM rules; no Share, no cloud render, no Script-panel transcription, no web |
| `projectName` for an episode's part | "Pricing talk main 3fa9c1" and "Pricing talk reel 2 3fa9c1": the file-safe name, the part, the short id; no version |
| `projectName` for a session's clip | "Session clip 3 3fa9c1": from a number and the short id, never the name |
| `writeProject` writes whole or not at all | A failure after the third file leaves no folder; a folder that exists is refused and left alone |
| No path in the set leaves the project, and none is a `.env` | `..`, an absolute path and `.env` are refused by `assertSafe` |

- [ ] **Step 3: Run, see them fail.**
- [ ] **Step 4: Write the module.** `projectName(part)`, `indexHtml(facts)`, `transcriptJson(words, spellings)`, `notesText({ kind })`, `cutSuggestions`, `reelSuggestions`, `projectFiles(input)` returning a `Map` of path to text (and, for fonts, logos and the GSAP file, a pointer to the file to copy), `assertSafe(files)`, `writeProject(dir, files, deps)` (made beside the project's folder, never in a run's own folder, which its run removes when it ends; the working copy renamed into `media/` last, and the whole folder renamed into place). It reads `COMMANDS` from PR 1 so the notes' list of denied commands cannot drift from the settings.
- [ ] **Step 5: Run, see them pass,** then the whole suite.
- [ ] **Step 6: By hand (A0b).** A session with the Mac Studio writes one sample project with this module from Jason's own recording and puts its path in the pull request. Jason opens it in the app (15, item 8).
- [ ] **Step 7: Commit** "Studio B1: a project's whole file set".

---

## PR 3. `workcopy.js`: the working copy

**Files:** Create `tool/workcopy.js`, `tool/tests/workcopy.test.js`. Reuses `cuts.js` (`probeArgs`, `factsOf`, `colourOf`, `streamsOf`, `encodeArgs`), `guard.js` (`runGuarded`), `detached.js` and `progress.js`. The arguments and the words are functions of what ffprobe printed. The job takes ffmpeg, the disk check and the rename as dependencies, so no test runs ffmpeg. The command that starts it (`workcopy`, a detached run's alone) is wired in PR 4.

Where it goes: the job makes `<episode folder>/working copy/<key>.mp4` with `<key>.json` beside it (the facts: `seconds`, `fps`, `width`, `height`, `bytes`), in the episode's folder under `~/BRIMM Video Work`. PR 2's writer renames the video into a project's `media/recording.mp4`.

- [ ] **Step 1: Write the failing tests** (they assert arguments and words; ffmpeg is never run):

| Test | Asserts |
|---|---|
| A wide 4K 30 fps SDR video | Explicit maps for the picture and the sound `streamsOf` names; rate 30; the longer side scaled to at most 1920 and the other to an even number; H.264 High, 8-bit 4:2:0, BT.709 tags; AAC at 48 kHz (`encodeArgs`' settings); `+faststart`; the rough cut's clock handling (`fps=…:start_time=0`, `aresample=async=1:first_pts=0`), so a time in the cut plan is a time in the working copy; no `select`, nothing cut |
| `--4k` | The longer side at most 3840 |
| A 24 fps video whose `r_frame_rate` and `avg_frame_rate` agree | The rate is kept at 24, not made 30 |
| A phone or Zoom video whose two rates differ | The rate is 30 and the words say it was made constant. `rateOf(printed)` is new code: `roughRate` returns the file's rate, or 30 when it has none, and never tests whether it is constant |
| An upright iPhone clip (a rotation note) | Sized from the picture as shown (`factsOf` turns the sides), so 2160×3840 comes out 1080×1920 |
| An iPhone clip with APAC sound | The readable stream is mapped; `unreadable` is said in words, as the rough cut says it |
| An HDR clip (`bt2020` with `arib-std-b67` or `smpte2084`) | The arguments tone-map to BT.709 SDR and tag the output BT.709. The test pins that the chain is there and the tags are right, not how it looks (by eye, step 5) |
| A Mac whose ffmpeg lacks the tone-mapping filter | An HDR clip is refused in words (`ffmpeg -filters` is read once); an SDR clip is not affected |
| A clip that cannot be converted: no picture, only unreadable sound, no length | Refused in words; no arguments |
| The disk | Refused in words when free space is under twice the raw video's size |
| The key of the copy | The raw file's size and time; changing either changes it; the same file gives the same key |
| The job | ffmpeg runs under `runGuarded` (4 GB, or 8 GB for 4K, and five minutes plus twenty seconds for each second of video; the rough cut itself runs unguarded) in the run's own folder; the file is renamed into the work folder only when ffmpeg exits 0 and ffprobe reads a length within a second of the source's; the steps are `["Making the video for HyperFrames"]`; a failure or a kill leaves nothing in the work folder; a copy for another key is replaced only after the new one is whole; a second request while one runs starts none (`runningCommand`) |
| The words | Nothing printed holds a path or a flag: "Making the video for HyperFrames", "Done", or "It can't be used: <reason in words>" |

- [ ] **Step 2: Run, see them fail. Step 3: write the module. Step 4: run, see them pass.**
- [ ] **Step 5: By hand.** On the Mac Studio: time one real five-minute clip, and look at one real HDR iPhone clip by eye in the app and in an export (risk 3 in the spec). The pull request says what was seen.
- [ ] **Step 6: Commit** "Studio B1: the working copy".

---

## PR 4. `app`: opening an episode in HyperFrames (the core of B1)

**Files:** Create `tool/app.js`, `tool/tests/app.test.js`, `tool/tests/stand-ins/hyperframes.mjs`, and the tests of the commands: `tool/tests/edit-app.test.js`, `tool/tests/edit-workcopy.test.js` and `tool/tests/edit-status-workcopy.test.js`, with their helper `tool/tests/workcopy-world.js`. Modify:
- `tool/edit.js`: `app` and `workcopy` join `COMMANDS`. It holds `workcopy`'s detached run as it holds `read`'s (`workcopy` is a detached run's alone: `startDetached` runs `edit.js workcopy --now <folder>`, and it is in no help), but the copy's work is `workcopy.js`'s and the project's is `app.js`'s. It also holds `claimAndBring`, today's claim and bring factored into one function that `open` and `app` both call; it is told what she is to say again and which command started the bring. `kind` starts the working copy after the reading; `open` stops printing its lines about showing the timeline in Final Cut.
- `tool/episode.js` (layout 4, the `app` field, and `ofTheSwitch`, layout 3 or later, which the checks of the switch's layout ask: `gateOf` and `findEpisode` in `edit.js`, and `--from-plan` in `tool/unedited.js`), `tool/settings.js` (`app`, `appHandover`), `tool/detached.js` and `tool/workcopy.js` (the working copy's lock of its own), `tool/hyperframes.js` and its test (`childEnv` and `settingsFor` gain three variables, spec 5.5), `tool/loosened.js` (`transcriptOf` is exported; what it does does not change), `tool/install.sh` (the toolchain, Chrome and doctor steps, shown by `--print`).
- `tool/studio/SKILL.md` and `SKILL-open.md`, `README.md` (the rows for `app`; none for `workcopy`), and the tests that pin them: `edit-gate.test.js` (`ASKED`), `edit-labels.test.js` (`TODAY_ASKED`, `walkWords`), `part-f-fixes.test.js`, `edit-kind.test.js`, and the `studio*.test.js` files.

`gate.js` does not change: `app` and `workcopy` are in no list (spec 6.2).

What it does, in order (spec 4.1, steps 6 and 7): the gate; the claim and bring; the working copy (asked for if `kind` could not, with a line that says it is being made and tells her to say it again when it is done; "how far is it?" shows how far it has got); the project (PR 2); the link into the toolchain; the pinned `open` with PR 1's environment, run by a spawn of `app`'s own, since `run.js` takes no environment and is a brimm-operations copy that does not change; the record.

Tests, by group:

| Group | Tests |
|---|---|
| The record | Layout 4 is written only once `app` is there; a Mac that knows layout 3 refuses it and changes nothing; `app.projects[0]` has `key`, `name`, `madeAt`, `on`, `from`, `workingCopy` (`bytes`, `seconds`, and `fps`, which is a number or a fraction written n/d), `opened`, `handover`, `fromSuggestion`, `state`; the three checks of the switch's layout (`gateOf` and `findEpisode` in `edit.js`, `--from-plan` in `unedited.js`) take layout 3 or later (`ofTheSwitch`), so a record of layout 4 is still a switched record |
| The gate | `app` is in no gate list. It runs for an answered raw video and iPhone clip, and for a session whose mark was cleared; for a finished video it passes the gate and then says "`<name>` was finished by your editor, so it has no HyperFrames project: a finished video is not edited in HyperFrames." and stops, with no working copy and no project (spec 4.3); it is refused, in the gate's own words, for an unanswered video, for a video left alone, for a session not cleared ("This is a client or group session: that is not done for one."), and for a video held beside a session (`heldGateFor`); `gate.test.js` and `edit-gate.test.js` walk it |
| The settings | `app` is off unless this Mac's settings turn it on, and says "This Mac isn't set up for HyperFrames yet: ask Jason."; a Mac that is set up but has no pinned command line gets "HyperFrames' command line isn't on this Mac yet: ask Jason."; both claim nothing and end with 1; `appHandover` is off unless turned on; `node settings.js set --app hyperframes\|off` and `--app-handover on\|off` write and show them (`write` and `plan` take them too) |
| The claim | Another Mac's claim refuses it in `open`'s words; `--take-over` takes the claim over as `open --take-over` does (the snapshot comes in PR 11); files online-only are brought first; `open` and `app` give the same answer for the same claim, but for what she is told to say again: "open `<name>` in HyperFrames" for `app`, "open `<name>`" for `open`. A bring that `app` started ends by telling her the first (`bring … --asked-by app`); `open`'s own words are unchanged |
| `open` | It prints nothing about Final Cut, a timeline or a project in Final Cut; its claim and bring are unchanged |
| The working copy | `kind` for a raw video and for an iPhone clip starts `workcopy` once, beside the reading, when the video is on this Mac, this Mac's settings turn the app on, and the record `kind` wrote has no main project in use (`read` holds the episode's lock, so `workcopy` holds a lock of its own, `workcopy.lock`: it writes no record, and `status` looks for its run under that lock); a finished video, a session, "leave it", an online-only video, a Mac with the app off and a record with a main project in use start none; a change of kind that kept the project in the same answer starts one; asking twice starts one (`runningCommand`); `app` asks for it when `kind` could not, says it is being made, and tells her to say "open `<name>` in HyperFrames" again when it is done, and does not wait for it (a command has two minutes in the Code tab); `workcopy` runs for an answered raw video or iPhone clip and is never started for a session, and its run waits for the import's late check before it copies, as the reading does (spec 5.7: whole, checked; the wait is a progress step, and a check that found a problem ends the run with the reading's words); `app` looks in the project before it asks for a copy, since the writer moves the video in and leaves `<key>.json` behind |
| The chat | `app` finds the chat's transcript with `transcriptOf` (her folder, the id in its environment) and the `claude` process above it, as `markChat` does, and asks `chatHeld`; with no readable transcript the handover is refused, never guessed |
| The stand-in | `tests/stand-ins/hyperframes.mjs` answers `--version`, `open --json` (opened, not-installed, open-failed, as a file in its HOME that the test writes says: PR 1's environment carries none of a test's), `catch-up --json`, `history --json`, from PR 1's fixtures; it records its argument list and environment names to a file |
| Opening | The stand-in is called with the absolute path, `open`, the project folder and `--json`, and no `npx`; the environment names are exactly PR 1's; the project exists before the call and is not removed when it fails |
| The handover | With the setting off the stand-in sees no `CLAUDE_CODE_SESSION_ID`; with it on, from a chat `chatHeld` does not hold, it does; from a held chat it does not, and the words say why; a session whose mark was cleared hands over as the ordinary video it is; the chat decision (`chatOf`) is tested through `openInApp` itself, with a made-up transcript in a temporary home |
| Failure | Not installed, failed to open: the words of PR 1; the record gets no `opened` time; the project is kept; a second `app` opens the same project and does not make another |
| No words | The episode's words are not on this Mac yet: "The words of `<name>` are not on this Mac yet, so there is nothing for HyperFrames to start from. Ask Jason."; nothing is made or started, and it ends with 1 |
| A project the record does not list | A folder at the project's name that the record does not list, as a run leaves whose record was not written, is taken as the project it is and recorded (state "made", never opened, from the recording as it is): nothing is made or started for it, and neither the words nor a working copy are needed. If part of it cannot be read: "The HyperFrames project for `<name>` is on this Mac, but part of it can't be read, so it wasn't opened. Ask Jason.", nothing is opened, and it ends with 1. A folder the record does list is its own, whatever it is kept for: a project kept for an earlier kind is never taken for the main one |
| Idempotence | Asking twice opens the one project and makes no second working copy. A recording that changed since the project was made is said in words, and the project is opened as it was, with the recording it was made from: no second project is made in place, and nothing is replaced under a project that may be open (a new version is a new revision, made at the drop, with its own project; spec 4.8) |
| A kind corrected | `kind … --again` that changes the kind marks the main project "kept for an earlier kind": nothing on disk changes, and she is told so in one line. `app` makes a new main project the next time she asks, without offering it first, under the first name no project of the record has, "main 2", then "main 3"; a folder at that name that the record does not know is adopted, as a run's leftover is, and never written over. The kept one keeps its name, folder and entry (spec 4.8) |
| The reading | While Claude's reading is at work, `app` makes no new project: "Claude is still reading it. Say "open `<name>` in HyperFrames" again when it has finished; "how far is it?" shows how far it has got."; it ends with 0 and asks for the working copy if it is not there; a project made before is opened, and a folder the record does not know is taken, whatever the reading (`ask` rewriting `brimm/`, spec 4.8, stays with the PR that next changes `ask`) |
| Another Mac's project | A main project in use that was made on another Mac and is not on this one: "The HyperFrames project for `<name>` is on `<Mac>`, with everything done in it, so it can't be opened on this Mac yet. Ask Jason."; nothing is claimed, brought, asked for or made, and the record is not written, with or without `--take-over`, until PR 11's snapshot; this Mac's own project whose folder is gone is made again |
| The reminder | Whenever the app opened, a last line names the buttons Studio cannot control (spec 3.3, 5.9): "In HyperFrames, share only with people you invite, export on This Mac and never in the cloud, and use no HeyGen avatars or voices without Jason's yes."; nothing of them when it did not open |
| The words | Nothing printed holds a path, a flag or a command name; "how far is it?" says "`<name>`: the video for HyperFrames is being made." while the copy is made, and a result of it reads "`<name>`: making the video for HyperFrames ended … ago"; `behind`, on a Mac whose settings turn the app on, also says when the toolchain is not the pin: "HyperFrames' command line on this Mac is not the one Studio needs. Ask Jason to update it when it suits. (Jason: Studio is pinned to version `<pin>`, and this Mac has `<what>`; the installer puts the pinned one in place.)" |
| The installer | `install.sh --print` names the toolchain step, the pin and the integrity check; the Chrome step (the command line's own `browser ensure` finds or fetches Chrome Headless Shell, from storage.googleapis.com, into `~/.cache/hyperframes/chrome`; if it cannot be had, the setup stops before the drop folder, the settings and the launch agent); and the `doctor` check (its words are shown for Jason and not read, and it does not stop the setup); says that Final Cut is optional; and changes nothing. Its own runs of the command line (the Chrome and the check) carry the same `HYPERFRAMES_` variables as PR 1's environment (a test reads them from `childEnv`, so the two cannot drift), the three that stop it checking npm for a newer version or installing anything among them (spec 5.5). No test runs the steps |
| The skill | `SKILL.md` and `SKILL-open.md` get the "In HyperFrames" rows; every test that pins a sentence is updated |

- [ ] Steps: failing tests, run, module, run, whole suite.
- [ ] **By hand** (Jason's yes to install the toolchain first): on the Mac Studio, with a recording of Jason's own, say "open it in HyperFrames" in the chat; the app opens the project; try `app` again; try it from a chat that holds a session's words (made-up) and see the handover refused.
- [ ] **Commit** "Studio B1: opening an episode in HyperFrames".

---

## PR 7. `exports.js` and `finish` for a raw video and an iPhone clip (B2a)

**Files:** Create `tool/exports.js`, its tests `tool/tests/exports.test.js`, `tool/tests/edit-finish-app.test.js`, `tool/tests/finish-app.test.js`, `tool/tests/edit-finish-clip.test.js` and `tool/tests/exports-words.test.js`, their helper `tool/tests/exports-world.js` (a made-up episode with a HyperFrames project on disk, a Downloads folder in the test's own home, and the app's records), and the fixtures in `tool/tests/fixtures/hyperframes-0.8.208/exports/`: `main.meta.json`, `reel.meta.json`, `failed.meta.json` and `render-outputs.json`. They keep the shape of A0's own files (spec 8.1) with made-up names and values; `exportedTo` in them is `<DOWNLOADS>/…`, which the helper fills in. Modify:
- `tool/finish.js`: `finishNow` takes the parts of a finish from HyperFrames' exports beside Final Cut's (`finish.asked.json` says `"source": "hyperframes"`); the steps, the wait, the checks and the words that name Final Cut are chosen by the source. `finishFinished`, `suggestionsFrom`, `handoffTarget` and the rest do not change.
- `tool/edit.js`: `finish` (two new flags, `--final "<part>"` and `--as-it-is`), `finishEpisode` (the choice of way), `handoffOwed` and `answerOffers` (an iPhone clip's hand-off is no longer owed from its spellings), `show`, and `HELP`. `hasFinalCut` does not change: `push`, `spell` and `graphic … ideas` still use it, and an answered iPhone clip still has no timeline in Final Cut.
- `tool/parts.js` (`unkeptParts`: a part finished from an export keeps its edit in its project, so it is not an unkept part), `tool/settings.js` (`downloadsFolder`, the home's `Downloads`), `tool/guide.js` (one sentence, below).
- `tool/studio/SKILL.md` and `SKILL-open.md`, `README.md`, and every test that pins them: `edit-finish.test.js`, `edit-spellings.test.js`, `part-f-fixes.test.js`, `edit-show.test.js`, `guide.test.js`, `edit-guide.test.js`, `parts.test.js` and the `studio*.test.js` files.

The hand-off and its contract do not change: `handoff.js`, `handoff-v2.js`, the five fixtures, `shared/`, `lib.js`, `run.js`, and `contract.test.js` stay as they are. `gate.js` does not change: `finish` is in the lists where it was (spec 6.2). It relies on PR 4's record (`app.projects`, `isMain`) and, for a Reel project, on PR 5 making the Reel's entry in `record.reels` when it makes the project; until PR 5 is merged a Reel project exists only in a test's record.

What it does, in order (spec 4.1 steps 11 and 12, 4.2, and section 8):

1. **The way is chosen by the record,** in `finishEpisode`, after the checks it makes today (another Mac has it open, a session or a video not answered, a file of the episode not whole in Dropbox, a finish running). A main project in use in `app.projects` (`isMain`) takes the HyperFrames way, for a raw video, and for an iPhone clip once the app has opened it (`opened` is not empty). An iPhone clip she answered that has no project, or one the app never opened, takes the clip's way (item 4). Anything else goes as it goes today, in Final Cut, except that a raw video with neither a project nor a push, on a Mac whose settings turn the app on, is stopped in HyperFrames' words and not Final Cut's. The Final Cut way stays for the episodes already under way in it, until retirement wave 4.
2. **The HyperFrames way, the quick part.** `exportsFound` (in `exports.js`, the one function there that reads the disk) reads, for each part, the project's `renders/*.meta.json`, `~/Downloads`, `edit/from-hyperframes/` in the episode (what the other Mac released; PR 11 writes it, this PR only reads it) and the project's last change; `lookForExports` (pure; spec 8.1) chooses. The parts are the main project in use and each Reel project of the record, by the names it keeps. Like `lookFor`, it gives `parts`, `asks`, `stops` and `looked`, and adds `mentions` for what it passed over (a WebM, a render in `renders/`). The rest of `finishEpisode` is as it is: a line for each part, the Reel titles asked for, the claim an unclaimed episode is given, `finish.asked.json` on this Mac's own disk, and the detached part started once. The file now also says each part's `project`, its `fromSuggestion`, and the words it is expected to start with: the suggestion's first words for a Reel made from one, and none for the main video.
3. **The HyperFrames way, the detached part.** `finishNow` as it is, with these differences (spec 8.2): the wait for the file to be whole also brings a Dropbox placeholder over (`readAll`, as `bring` does it), for `~/Downloads` is a link into Dropbox on the Mac Studio; the checks add sound and colour; there is no export file to copy; the part's record has `project` and neither `export` nor `noHandEdits`; each project taken is `finished` in `app.projects`; and what it took from `~/Downloads`, and nothing else, is removed after the late check, if it is unchanged since it was taken and its name is an export's name for that project (a record in a project can be written by the app's agent, so a file it names that has no export's name is taken only if she says yes, and is left where it is).
4. **An iPhone clip** (spec 4.2). `handoffOwed` is true for a finished video alone, so answering a clip's spellings writes nothing, and `finish` is how its hand-off is made:
   - with a main project in use that the app has opened: the HyperFrames way (item 2), with kind "short video": `main` only;
   - otherwise it checks, in this order, a Mac that hands off version 1 ("waits for version 2"), a hand-off already made (below), and spellings not yet answered; then, with no hand-off yet, it asks once, "Hand it off as it is, or open it in HyperFrames first?", and starts nothing. `--as-it-is` runs `finishFinished`'s short-video branch, the code the spelling card ran before and its words, and only once the spellings are answered;
   - with a hand-off already made from the import (`madeFromImport`) and no project the app has opened: it says so, and that an edited version needs HyperFrames first. **A clip answered under today's rules keeps the hand-off it has** and the revision the page holds, and nothing is written or withdrawn for it. A later `spell` makes it again from the import's captions, as it does today. Once she has opened it in HyperFrames and exported it, `finish` writes the next revision from the export, under the same id, and `madeFromImport` is false from then on.
   - A clip answered under today's rules whose hand-off was not yet written (a Mac that handed off version 1 then, or a write that failed) is owed nothing now, and asked the same question.
   The guide's one sentence for an answered clip with no hand-off, "Say "show me the spellings" and answer them again", would send her to an answer that now writes nothing, so it says the new way.
5. **`show transcript` of a raw video** follows the record, as item 1 does. An episode whose record has a main HyperFrames project in use (`isMain`) prints `<stem>.transcript.txt`, the recording's own: its times are the project's timeline's, which is the recording's clock (spec 5.7). Any other raw video keeps today's answer, `<stem>.rough-cut.transcript.txt`: the reading still makes a rough cut until retirement wave 2, and an episode going the Final Cut way needs those times. When wave 2 stops the reading making one, the answer for those becomes the recording's own too, and that is wave 2's change. A finished video's, an iPhone clip's and one from before the switch are as they were.

Tests, by group (the made-up episode is `episodes.js`'s, "Pricing: what to charge?", id 3fa9c1; MAIN is its main project's name, "Pricing- what to charge- main 3fa9c1", and REEL2 is "Pricing- what to charge- reel 2 3fa9c1"; the times are zone-free: `exports.js` is given the zone, once as UTC-4 and once as UTC+9):

| Group | Tests |
|---|---|
| **A1. Export names** (`exports.test.js`) | `exportNameOf` reads "MAIN 2026-10-28 15.20.mp4" as the project MAIN, on 2026-10-28 at 15:20, an mp4; .mov, .m4v and .webm and capitals (".MP4") are read; "MAIN 2026-10-28 15.20 (1).mp4" is the same with a copy mark; none of these is a name: a colon in the time, seconds, no date, "….mp4.partial", "….crdownload", a name starting with a dot, "MAIN.mp4", and a Dropbox conflicted copy ("… (Jason Ogden's conflicted copy 2026-10-28).mp4") |
| **A2. Composed names** | A name written decomposed ("Café talk main 3fa9c1 2026-10-28 15.20.mp4") is the composed project "Café talk main 3fa9c1"; the project "X main 3fa9c1" never takes "X main 2 3fa9c1 2026-10-28 15.20.mp4", nor the other way round |
| **A3. The app's records** | `metaNameOf` reads "MAIN_2026-10-28_15-16-40.meta.json" as MAIN at 15:16:40 (from the last underscores, since a project's name may hold some); a name with no seconds, or another ending, is none; `metaOf` reads the fixtures: complete, `exportedTo`, "mp4", "landscape" (and "portrait" for the Reel); a `status` that is missing counts as complete, one that is "failed" or "running" or not text does not; an `exportedTo` that is missing, relative or not text gives none, and the file is then looked for by name; extra keys, a missing `settings` and any `fingerprint` change nothing (it is not used: it is not the file's SHA-256); text that is not JSON, or not an object, is none |
| **A4. When an export began** | `beganAt` gives a record's name to the second, and a file's name alone to the start of its minute, and says which it is; the zone is given, so the same name is one moment at UTC-4 and another at UTC+9, and no test depends on the Mac it runs on |
| **B1. The project's last change** (`exports.test.js`, a project folder made in the test's home) | `lastChangeOf` is the newest file change outside names that start with a dot, `node_modules`, `renders` and `snapshots`, at any depth: a file in `.hyperframes/`, in `renders/`, in `snapshots/` or in `node_modules/` counts for nothing, and a change to `index.html` or in `compositions/` counts; the last turn of `app-history.jsonl` (the fixture's, in UTC) counts when it is later than the files; a line that is not JSON, or has a date that is not a date, is passed over (`turnsOf`); no files and no turns is null; a project folder that is not on this Mac is null, which means unknown and not zero |
| **C1. Which export** (`exports.test.js`, `lookForExports`, plain data) | For the main project and Reel 2 it takes the newest export that began after the project's last change, asks nothing, and says "The main video: MAIN 2026-10-28 15.20.mp4, from Downloads, exported 2026-10-28 15:20." and "Reel 2: REEL2 2026-10-28 15.21.mp4, from Downloads, exported 2026-10-28 15:21."; of three exports after the change the one that began last is taken, by the record's seconds when it has them; a copy mark makes no difference |
| **C2. By the app's own record first** | An export whose name matches no project ("final.mp4") but whose `exportedTo` names it is found, in another folder too: "The main video: final.mp4, from another folder, exported 2026-10-28 15:16."; a record whose file is gone falls back to the name; a record that says it failed is passed over; a file found both ways is one |
| **C3. An export older than the last change** | "The main video's newest export, MAIN 2026-10-28 15.16.mp4, began at 2026-10-28 15:16, before you last changed it in HyperFrames, at 2026-10-28 15:30. Export it again from HyperFrames on This Mac, or say that export is the final one." and nothing is chosen for that part, the others are; a record's seconds decide (begun at 15:16:40, changed at 15:16:50: older), a name alone gets the benefit of its minute (the same change is not older), and a change in a later minute is; `final` takes it, saying "The main video: MAIN 2026-10-28 15.16.mp4, from Downloads, exported 2026-10-28 15:16. HyperFrames changed after it, and you said it is final." |
| **C4. Equally new, and named** | Two different files that began in one minute ask "For the main video there are two exports that began at 2026-10-28 15:20: MAIN 2026-10-28 15.20.mov, MAIN 2026-10-28 15.20.mp4. Which is the final one?", saying "on this Mac" and "from the other Mac" after a name that is in both places; `take` (a file's name, "this Mac" or "the other Mac") answers it; `take` names a file in Downloads, in the released folder or in the project's `renders/`, whatever it is called and however old, and a name that is none of them asks again: ""x.mp4" is not an export of the main video. The ones there are: A, B. Which is the final one?", or "There is none there." |
| **C5. No export** | A Reel project asks "Reel 2 has no export. Export it from HyperFrames on This Mac, or say to leave it out of this hand-off. If you exported it under another name, tell me its file name."; `without` leaves it out; a Reel the last finish finished stays in the hand-off when it is left out, as `lookFor` keeps one; the main video stops: "The main video has no export yet. Export it from HyperFrames on This Mac, as MP4, then say "hand it off" again. If HyperFrames is still exporting it, say it again when the export is done." and "Looked in Downloads and in what the other Mac released for exports of: MAIN, REEL2." |
| **C6. Passed over** | An empty file, a WebM, a file of another project, and a file of a project kept for an earlier kind are none of a part's; a WebM of the part with no MP4 or MOV says "MAIN 2026-10-28 15.20.webm is a WebM, which is not taken: export it again as MP4."; a file in the project's `renders/` that no record names says "The main video's project has a video that HyperFrames' own render made, MAIN_2026-10-28_15-18-02.mp4. It is not an export, so it is not taken. Export it from HyperFrames, or tell me its file name to use it.", and `take` of it takes it |
| **C7. Kept from the last finish** | A part the last finish took, whose export is the one it took (the same size and time) or is no longer there, is "The main video: kept as the last finish made it."; a newer export makes a new part; a project that changed after the last finish (`finished.at`) with no new export asks "The main video's project changed in HyperFrames, at 2026-10-28 15:30, after the last hand-off. Export it again from HyperFrames on This Mac, or say the last hand-off is final.", and `final` keeps it; a part the last finish took from Final Cut (its record has no `project`) is not kept, and needs an export |
| **C8. A project on the other Mac** | A project not on this Mac takes the newest released export without the older-than-change check, and says "The main video: MAIN 2026-10-28 15.20.mp4, from what the other Mac released. Its project is on Mac Studio, so the export could not be checked against it."; with nothing released it stops: "The main video's HyperFrames project is on Mac Studio, so its exports are there. Finish it on that Mac." |
| **D1. The way** (`edit-finish-app.test.js`, in `edit-finish.test.js`'s world) | A raw video with a main project in use goes the HyperFrames way and looks at nothing in From Final Cut; one with Final Cut pushes and no project goes as `edit-finish.test.js` has it, untouched; one with neither is stopped, on a Mac whose settings turn the app on, with "The main video was never opened in HyperFrames. Say "open it in HyperFrames" first, edit it there, export it on This Mac, then say "hand it off".", and on a Mac that does not turn it on, with Final Cut's words as today |
| **D2. What it says, and what it starts** | It says what it found for each part (the lines of C1 to C8), then each ask, stop and mention; with nothing left to ask and no yes: "Say "yes, hand it off" to start.", exit 0, nothing started. With a yes, `finish.asked.json` in this Mac's work folder holds `"source": "hyperframes"` and, for each part, `key`, `label`, `project`, `fromSuggestion`, `expected` (the suggestion's first words for a Reel made from one, "" for the main video), `video` (`name`, `dir`, `where`, `bytes`, `mtimeMs`), `export: null` and `kept`; the episode is claimed for this Mac when nobody had it (`asked.rev` is one above the record's); the detached part is started once; "Started. The panel shows how far it is." |
| **D3. Refusals, and Downloads** | The refusals keep their words: another Mac has it open; a placeholder name for a raw video ("Give the episode its name first: it is still called "…", from the video's file name."); a file of the episode not whole in Dropbox; "finish is running for this episode. Say "how far is it?""; a Reel with no title on screen is asked for, "Reel 2 has no title on screen. Say what it says: it starts "<the suggestion's first words>"."; a Downloads folder this Mac will not let the tool read (a stand-in that throws EPERM) stops it with "This Mac does not let brimm-video look in the Downloads folder, where HyperFrames puts its exports. Allow it in System Settings, under Privacy & Security, Files and Folders, then say "hand it off" again."; a home with no Downloads is an empty one |
| **D4. The Reel's entry** | A Reel project with no entry in `record.reels` is refused, "The record has no Reel 3 for its HyperFrames project: ask Jason."; a Reel picked that has no project is left out and said, "Reel 3 is picked but has no HyperFrames project, so it is left out. Say "make Reel 3" to make one." |
| **E1. It finishes, and the hand-off** (`finish-app.test.js`, in `finish.test.js`'s world) | A raw video from its exports: `final/` holds the main export, its `.srt`, `.transcript.txt` and `.words.json`, each Reel's, a Story part for a Reel over a minute, and the hand-off, last; each is a clone made by the stand-in that refuses to write over a file; no Final Cut export is there; the originals in Downloads are untouched until the late check. The hand-off passes `handoffFaultV2`, and `tidyTranscript` reads each caption file; it is kind raw, `main.file` is the export's name, each `reels[].fromSuggestion` is the Reel project's (a number, or `null` for times she gave), `inMain` is found for a Reel that falls in the main video, there are no `suggestions` and no `onPicture` (PR 8); its keys are the contract's raw fixture's, in the same order; for an iPhone clip they are the short-video fixture's, with no `reels`; `contract.test.js` passes unchanged |
| **E2. The record** | `finished.parts.main` holds `file`, `bytes`, `seconds`, `source`, `words` and `project`, and neither `export` nor `noHandEdits`; each project taken is `finished` in `app.projects` and the others are as they were; each Reel taken is `finished` with its `final`; the revision is one above `handoffTarget`'s; `unkeptParts` does not name a part that has a `project`; the claim is let go; the record is written last, with `expectRev` |
| **E3. It waits** | A file whose size grows is looked at again, and goes on when it settles; after ten minutes "MAIN 2026-10-28 15.20.mp4 is still being written. Say "hand it off" again when HyperFrames has finished exporting it."; a placeholder (the stand-in's `isWhole` false until it is read) is brought over by `readAll`, and when that fails "Dropbox could not bring MAIN 2026-10-28 15.20.mp4 over to this Mac (<why>). Say "hand it off" again." |
| **E4. The checks** | A Reel that is not upright ("… is wider than it is tall, and a Reel is upright."); a main video of another shape than the raw video's; no sound ("… has no sound. Export it again from HyperFrames with its sound."); no length; BT.709 says nothing; no colour tags says "… has no colour tags: check by eye that its colours look right." and goes on; HDR tags say "… is tagged as HDR colour, which most players show washed out: check it by eye, and export it again in standard colour if it looks wrong."; a Reel made from a suggestion is checked against the suggestion's first words, and a mismatch is named for her to look at ("Reel 2 starts with "…", where "…" was expected: check by eye that it is the right video.") and stops nothing; the main video's first words are not checked |
| **E5. Spellings, and a file that changes** | Each export is transcribed with the record's spellings, in the captions and in the word times; an export that changes in Downloads while finish works (the stand-in changes its size) stops it before anything is copied, "MAIN 2026-10-28 15.20.mp4 changed in Downloads while finish was working on it. Say "hand it off" again."; so does the other Mac taking the episode over, in today's words |
| **E6. The late check** | It waits `LATE_CHECK_MS` after the last copy; puts a copy Dropbox took away in again from its work copy; and only then removes, from Downloads, a file it took from there that is unchanged since (its size and time) and has an export's name for the project (a file named by `take`, or by a record, under another name is left where it is); one changed since is kept, "MAIN 2026-10-28 15.20.mp4 changed in Downloads after it was taken, so it is kept there."; a file it took from another folder, from `edit/from-hyperframes/` or from `renders/` is never removed; a copy that is not whole at the late check keeps every original, "The exports it took from Downloads are kept there, because a copy in final/ was not whole at the late check."; nothing else in Downloads is touched (other files, and an older export of the same project that was not taken, are there afterwards) |
| **E7. Again, and the run** | A second finish with no new export keeps every part and writes the next revision under the same id; a new export for the main video alone makes only the main again and keeps the Reels; the earlier export stays in `final/`, listed in the record; a finish that fails lets the claim go, as today. ffprobe, ffmpeg, the transcriber and `open` are stand-ins; the steps shown are "Waiting for HyperFrames' exports", "Checking the files", "Writing the transcripts", "Cutting the Story parts", "Copying into the episode" and "Checking the copies" |
| **F1. The spelling card** (`edit-finish-clip.test.js`; `edit-spellings.test.js`, `part-f-fixes.test.js` and `guide.test.js` changed) | Answering it for an answered clip records the answer and the spellings and writes no hand-off: "Spelled now, in every caption: "Ogdin" as "Ogden". Say "open it in HyperFrames" to edit it, or "hand it off" to hand it off as it is."; `final/` is not made and nothing is run; asked again it is answered already; a finished video's answer writes its hand-off as before |
| **F2. Asks once, and as it is** | `finish` on an answered clip with no project and no hand-off, its spellings answered, says "Pricing talk was not opened in HyperFrames. Hand it off as it is, or open it in HyperFrames first?", exit 0, and starts nothing, with or without `--yes`. `--as-it-is` writes the hand-off from the import's captions, as the card did (the assertions of the old `edit-spellings.test.js` test, moved here): "Handed off as it is. The hand-off is written as revision 1 and shown in Finder: drop it on the BRIMM Ops page."; kind `short video`, `main` only, no `reels`, passes `handoffFaultV2`, with the contract's short-video fixture's keys. With the spellings not answered: "Pricing talk's hand-off is written once its spellings are answered. Say "show me the spellings"." (exit 1); on a Mac that hands off version 1: "Pricing talk's hand-off is written from its spellings once this Mac hands off version 2: ask Jason." (exit 1) |
| **F3. Edited, and already made** | An answered clip with a main project in use that the app has opened, and an export, goes the HyperFrames way, with no question, and `main.file` is the export's; one whose project was made and never opened is asked the question of F2. For a clip whose hand-off was made from the import, as revision 1, `finish` says "Pricing talk's hand-off is written already, as revision 1, from the clip as it was filmed. To hand off an edited version, open it in HyperFrames first." (exit 1) and writes nothing; a later `spell` makes it again from the import's captions, as today; after its project is exported, `finish` writes revision 2 under the same id, `madeFromImport` is false, and a `spell` after that re-spells the final transcripts and the hand-off the way a finished raw video's are, not from the import |
| **F4. What does not change** | `push` of an answered clip still says "Pricing talk has no timeline to show in Final Cut: an iPhone clip is not edited here." (`part-f-fixes.test.js`'s first group, untouched) and `hasFinalCut` is false for it; a short video from before the switch, with no answer, goes the Final Cut way; a finished video's `finish` says what it said |
| **F5. The guide** | An answered clip whose spellings are answered and which has no hand-off is at the stage `clip-next`, "Open it in HyperFrames to edit it, then export it on This Mac and say "hand it off". Or say "hand it off" to hand it off as it is."; a finished video's stage `handoff-owed` and every other stage are as they were |
| **G. The transcript of a raw video** (`edit-show.test.js`) | The record picks the answer. With a main HyperFrames project in use (made, or opened), `show "<raw>" transcript` prints `<stem>.transcript.txt`, the recording's own, even when a `.rough-cut.transcript.txt` is beside it, and the same when only the import's files are there. Without one, an answered raw video still prints `<stem>.rough-cut.transcript.txt`, as today, whatever else is beside it, and a project kept for an earlier kind is no project in use (the rough cut's is printed). A finished video's, an iPhone clip's and one from before the switch are as before; a session or a video not answered still gets a read-only copy in TextEdit and nothing printed; a placeholder is brought over as today; `HELP` and the README's `show` row say both |
| **H1. The words** (`exports-words.test.js`) | Every sentence the groups above give is walked: none holds a path (no `/` but the folder name `final/`, no `~`), a flag (no `--`), a command name (no `edit.js`, no `node `) or the word "Studio" other than in a Mac's name; the file names in them are the exports' (a project's name, a date and a time); the same lines are said for an episode named with an accent and a quote; `edit-labels.test.js`'s walk of every command's output passes for `finish` with a made-up Downloads |
| **H2. What pins them** | `HELP` (the `finish` usage with its two flags, and `show`), the README's `finish`, `show` and `spell` rows and its section on finishing, the card's step 3, and the skill's rows in `SKILL.md` and `SKILL-open.md` (the spellings card; "Hand it off" with "Finish the episode"; "Show me the transcript"; and "By hand", which gains "In HyperFrames, to hand it off": Export on This Mac, as MP4, then say "hand it off") are changed in the commit of the group that changes the sentence they pin, and every test that pins one is changed with it |

- [ ] **Step 1: Make the fixtures and the world.** The three records and `render-outputs.json` are A0's files with the project's name, the dates and the fingerprint made up (spec 8.1 shows one); `exports-world.js` builds a project folder with its `renders/`, `.hyperframes/app-history.jsonl` (PR 1's fixture) and files whose times it sets, a Downloads folder in the test's home with exports in it, and the episode's record with `app.projects` for the main video and a Reel. It touches only a temporary folder, with HOME pointed at it; no test reads the real Downloads, Dropbox or `~/BRIMM Video Work`.
- [ ] **Step 2: Group by group, in the table's order (A and B together).** Write the group's failing tests; run them (`cd tool && node --test tests/<file>.test.js`) and see them fail; write the code; run them and see them pass; run the whole suite (`cd tool && node --test`); commit. HELP, the README, the skill and every test that pins a sentence that changed are in the commit of the group that changed it.
- [ ] **Step 3: The module (`exports.js`).** `exportNameOf(name)`, `metaNameOf(name)`, `metaOf(text)`, `beganAt(…, zone)`, `lastChangeOf({ files, turns })`, `lookForExports(parts, found, answers)` (answers: `take`, `final`, `without`), `shapeFault` (moved from `finish.js`, which imports it), `soundFault`, `colourNote`, and `exportsFound(ctx, found, record)`, which reads the disk and gives `lookForExports` its input. `downloadsFolder(home)` is in `settings.js`. `exports.js` is the one module that looks in these folders. A file is taken by `cp -c` into the run's own folder, as `takeCopy` does it, and nothing is written into Downloads.
- [ ] **Step 4: The whole suite, and the contract.** `cd tool && node --test` passes whole (but for the box's four); `git diff --stat main` shows none of the contract files; `tests/contract.test.js` is as it was and green.
- [ ] **By hand** (Jason, or a session on the Mac Studio, with a recording of Jason's own, never one of Sallie's): `app` a raw video, edit it in HyperFrames, export it on This Mac as MP4 (the Reel too), say "hand it off", answer what it asks, and say "yes, hand it off"; look at what is in `final/`, at the hand-off in Finder, and drop it on the BRIMM Ops page: that is the PR's one real hand-off into BRIMM Ops. Then: say "hand it off" while an export is still running, with its panel closed, and say what it did; after the late check see that Downloads lost exactly what was taken; macOS may ask once whether Claude may look in Downloads (the PR says whether it did); ask the app for a Reel on its own, export it, and see the Reel ask for its file name; with an iPhone clip, answer the spellings, say "hand it off", take "as it is", then open it in HyperFrames, export it and say "hand it off" again for revision 2. The pull request names the app's version (build number) these were seen on (spec, risk 14).
- [ ] **Commits,** one for each group that changes code, in the table's order, each with the suite passing: "Studio B2a: exports.js reads the app's export names and records" (A, B), "Studio B2a: exports.js chooses each part's export" (C), "Studio B2a: finish looks for HyperFrames' exports" (D), "Studio B2a: finish writes the hand-off from HyperFrames' exports" (E), "Studio B2a: an iPhone clip's hand-off waits for its export" (F), "Studio B2a: show transcript of a raw video follows the record" (G). Group H's words and pins are in those commits.

---

## PR 5 to PR 15, in outline

Each gets its own detailed section, in the same shape as PR 1 to 4, when the one before it is merged and A0 has answered what it waits for.

**PR 5. Reel projects** (`app … reel N`). Tests: the stretch is cut from the working copy (a finished video: from the original) into the Reel project's `media/recording.mp4`, by a short ffmpeg job under `runGuarded`; `fromSuggestion` is the suggestion's number or `null` for times she gave; the project has no cut or Reel suggestions; the face positions go to `brimm/face-track.json` only when `faces.swift` found some; a suggestion that no longer exists is refused in words; `app … reel N` marks the candidate picked, which is what `reel pick` did and what `parts.js` and the hand-off read. The commands that met Reels made in Final Cut change with it: `title <episode> reel N` accepts a Reel that `app` made and still refuses one nobody made; `reels` prints the candidates with no previews and without the line that sends her to OpusClip for a candidate `app` can make; `reel pick` goes and `reel drop N` stays, in `HELP`, the skill, the README and every test that pins them.

**PR 6. `what-happened` and `versions`.** Tests: `turnsOf` over a real-shaped file in plain words, newest first, with no path; with no file it says nothing was done in the app yet; `versions` calls the pinned `history --json --limit 20 --dir`; a failing `history` says "I can't list the versions right now; HyperFrames shows its history" and exits 0.

**PR 7.** Its section is above.

**PR 8. B2b.** Tests: the on-screen words found in fixture HTML from A0b's projects (an element with `data-start` and a duration, not in the captions composition), in order, shown for confirmation; a Reel's title proposed from the first; nothing found means asking; confirmed words become `onPicture` and `title`; `suggestionsInMain` uses `inMain`, keeps a suggestion whose words fall in one stretch, leaves out one that does not, and numbers and words are as the suggestion's.

**PR 9. B2c.** Tests: `finish … reels` writes revision n+1 under the same id, `main` and the earlier Reels as they were, new Reel numbers never reused (`numbersTakenWords`), and `fromSuggestion` as the Reel project says.

**PR 10. The guide.** Three new states: making the video for HyperFrames (the `workcopy` run's own step, whose speed `progress.js` learns like the others), in HyperFrames (with the time of the last turn in `app-history.jsonl`), exported and waiting for the hand-off. The Final Cut stages go (`show`, `finish-again`, "Trim it by hand in Final Cut…"), with the facts only they used (`shownInFinalCut`, `shownSinceFinish`). `READING_STEPS` keeps "Making the rough cut" until the retirement's wave 2 stops the reading making one. Tests: `guide.test.js` and `edit-guide.test.js` for each state's words and for the wait, with the Final Cut sentences taken out of what they pin.

**PR 11. Release and take-over.** Tests: `release` writes `app-snapshot/<time>/<project name>/` by the Dropbox rule with exactly the files of spec 7.3, refuses over the size cap in words, keeps the two newest, copies the newest exports; `open --take-over` on the other Mac rebuilds the project from the snapshot, makes the link for its own toolchain, makes the working copy again, and says the app's history stays behind.

**PR 12. S1.** First fixture: a real Zoom download of Jason's made-up call (loose files or a folder). Tests: a Zoom-named file is answered as a session at the drop with the mark not cleared, never asked, and `holdsZoom` no longer holds it; the files group by Zoom time into one episode; the reading runs at the drop under `teachingsWhy` and `accountWhy` and makes no `claude` call when either refuses; the request holds no speaker but Sallie and "Participant N"; clip suggestions have `start`, `end`, `title`, `point`, `who`; names are taken out of the new fields; her folder's settings hold `DISABLE_FEEDBACK_COMMAND=1` and `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY=1`; `settings.js sessions --heygen-opt-out confirmed|off` writes and shows the setting like the training gate's; the Swift Vision side builds (a test that only runs where `swift` is, as the faces one does).

**PR 13. S2: `clips`.** Tests: `make` mutes a name by its word times, blurs a Vision box by its time, takes the picture from the active-speaker file, and flags another face; `show` opens a copy; `send` refuses without the dialog's "yes" (cancel, no answer and timeout each leave no project), records `{clip, basis, day}` and never who, and needs a third plain confirmation for "shows someone else"; the project is `projectFiles` for a clip (PR 2) opened with no handover whatever the setting; the three reminder lines are in the answer until `heygenOptOut` is confirmed; `done` removes the project, the history folder named by `.hyperframes/history-id`, the "seen" mark, and the export copy; an export that changed since it was taken is left; no name, log line or status holds the file's name.

**PR 14. S3.** Waits for D5. The test list is written with brimm-operations when it is decided.

**PR 15. `free`.** Today a stub: it says that deleting a library "comes in a later version", and `freeLibrary` and `unkeptParts` cannot be reached. Tests: `free "<episode>"` removes the working copy (each project's `media/recording.mp4` and the episode's `working copy/` folder) and each project's `renders/`, by named paths and never by a pattern, and says how much room that gave back; the project's text files, `brimm/`, `.hyperframes/` and every export stay; every path removed is under `~/BRIMM Video Work`, none in Dropbox or in Downloads; it refuses while the other Mac holds the episode, and when the raw video it would be made again from is not in the episode (in words: it could not be made again); a session clip's project is not touched (`clips … done` is its way); and `app` afterwards makes the working copy again and opens the project (PR 4's idempotence, run after `free`).

---

## The retirement waves

Spec section 10 has the table and its reasons. Each wave is one pull request, Jason's yes first, and each runs the script in the appendix twice from the repo's top folder, pasting both outputs into the pull request's description. The script is a scratch tool and is not committed to `tool/`.

1. **Imports of deleted files:** `node imports.mjs deleted tool <the wave's modules>`. For every module the wave deletes it lists the files that still import it, and exits 1 if there are any. A deleted module's own test (`tests/x.test.js`) goes with it and is not listed. Today, for the eight modules the handoff would retire, it names `edit.js`, `reading.js`, `finish.js`, `unedited.js` and the shared test helper `tests/phase4.js`, which is why the waves are in the order they are.
2. **Exports nobody imports:** `node imports.mjs unused tool` lists every export that no other module imports, saying whether a test imports it or only its own module uses it. About 190 lines today, most of them exports that tests reach, so a wave compares the output with the one from before it and acts on the new lines only: each is kept for a reason said in the pull request, or removed in it.

The script reads `import` lines only. A module named in a string (a path in `install.sh`, a command in the launch agent's file, a sentence of the skill, the README) is not seen, so each wave also runs `grep -rn '<module stem>' tool README.md docs` for every module it deletes.

And the suite passes whole, with the tests of a deleted module deleted with it and no other test weakened.

---

## Open items

- A0's checklist was run on 2026-10-28, and its results are in `~/BRIMM Video Work/A0 app test/results.md`:
  - the handed-over chat was blank (step 4);
  - the app's agent listed the brand kit's rules and not the project's notes, so BRIMM's working rules now go into the kit as well (step 10);
  - exports go to `~/Downloads`, a link into Dropbox on the Mac Studio, and each leaves a note in the project's `renders/` (step 11).

  Its additions (`docs/phase-a0/additions.md`, items 1 and 8 among them) and A0b are being run. PRs 4 to 7 each name the answer they wait for.
- The Studio repo's `main` branch and its copy of the tag `brimm-video-v1` (Jason; see "Not here").
- The questions Q1 to Q3 and decisions D1 to D10 of the spec. Decision D5 (a session clip's hand-off) needs brimm-operations as well.
- Sallie's laptop is not on the light import, which PR 12 waits for (`docs/setup/sallies-laptop.md`).
- Whether the Mac's ffmpeg has the tone-mapping filter PR 3 needs (`ffmpeg -filters`). The installer's check should print it.
- The pin's integrity string covers the `hyperframes` package alone. Its dependencies float at install, since it ships no shrinkwrap. A lock file of the toolchain's own, installed with `npm ci`, would pin them too. Jason's call.
- **Done on 2026-10-28.** The documentation site `hyperframes.heygen.com` could not be read from the session that wrote this (not on its allowed network list). It was read on 2026-10-28 by a session that could reach it, and compared with the spec's section 8.1: the spec now says what the docs said about exports (where, the name, the choices, when the file appears, Cloud), about Share's default, the handover, Home, the app's usage recording and the download page, each marked "the docs" or "A0" where it is used (spec 3.3, 5.6, 5.9, 8.1, 15 and F8). What the docs do not say, A0 found: the record each export leaves in `renders/`. Both are open to change, since the app updates itself (spec, risk 14).

---

## Appendix. The import script the retirement waves run

Save it as `imports.mjs` outside the repo (a scratch folder) and run it from the repo's top folder. It needs Node 22 and no packages. On 2026-10-28 at c666508 it ran in under a second; `deleted` named exactly the importers spec F1 lists.

```js
// node imports.mjs deleted <tool dir> <module.js>...   who still imports a module that is about to be deleted
// node imports.mjs unused  <tool dir>                  exports that nothing imports, or only a test does
import { readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";

const [mode, root, ...gone] = process.argv.slice(2);
const sources = (dir) => readdirSync(join(root, dir)).filter((f) => /\.(m?js)$/.test(f)).map((f) => ({ file: join(dir, f), src: readFileSync(join(root, dir, f), "utf8"), test: dir === "tests" }));
const files = [...sources("."), ...sources("tests")];

// Every import of a sibling module: { from: file, to: module name, names: [...] or ["*", alias] }.
const IMPORT = /import\s*(?:(\*\s*as\s+\w+)|\{([^}]*)\}|(\w+))?\s*(?:,\s*\{([^}]*)\})?\s*(?:from\s*)?["']\.{1,2}\/([\w-]+\.m?js)["']|import\(\s*["']\.{1,2}\/([\w-]+\.m?js)["']\s*\)/g;
const imports = [];
for (const { file, src, test } of files) {
  for (const m of src.matchAll(IMPORT)) {
    const to = m[5] || m[6];
    const named = [m[2], m[4]].filter(Boolean).flatMap((l) => l.split(",").map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean));
    imports.push({ from: file, test, to, names: m[1] ? ["*", m[1].split(/\s+/).pop()] : m[3] ? ["default", ...named] : named });
  }
}

// A module that is deleted takes its own test file (`x.js` and `tests/x.test.js`) with it.
const goes = (f) => gone.includes(basename(f)) || gone.some((g) => basename(f) === g.replace(/\.m?js$/, ".test.js"));

if (mode === "deleted") {
  let left = 0;
  for (const g of gone) {
    const users = imports.filter((i) => i.to === g && !goes(i.from));
    left += users.length;
    console.log(`${g.padEnd(16)} ${users.length ? users.map((u) => u.from + (u.test ? " (test)" : "")).join(", ") : "no one"}`);
  }
  process.exit(left ? 1 : 0);
}

if (mode === "unused") {
  for (const { file, src } of files.filter((f) => !f.test)) {
    const names = [...src.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+(\w+)/gm)].map((m) => m[1]);
    for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) names.push(...m[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean));
    const here = imports.filter((i) => i.to === basename(file));
    const used = (n, inTests) => here.some((i) => i.test === inTests && (i.names.includes(n) || (i.names[0] === "*" && files.some((f) => f.test === inTests && f.file === i.from && new RegExp(`\\b${i.names[1]}\\.${n}\\b`).test(f.src)))));
    const own = (n) => (src.match(new RegExp(`\\b${n}\\b`, "g")) || []).length > 1;
    for (const n of names) {
      if (used(n, false)) continue;
      console.log(`${file.padEnd(22)} ${n.padEnd(28)} ${used(n, true) ? "tests only" : own(n) ? "its own module only" : "no one"}`);
    }
  }
}
```

Run on the eight modules the handoff would retire, `node imports.mjs deleted tool captions.js layers.js pictures.js styles.js timeline.js recut.js reel.js projects.js` prints:

```
captions.js      no one
layers.js        edit.js
pictures.js      edit.js
styles.js        edit.js
timeline.js      edit.js, reading.js
recut.js         edit.js, finish.js
reel.js          edit.js
projects.js      unedited.js, tests/phase4.js (test)
```

and exits 1. `captions.js` shows no importer only because `layers.js`, which imports it, is on the same list.
