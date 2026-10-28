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
| 4 | `app` and `workcopy`: layout 4, settings, the commands, the skill, the README rows, `open` without its Final Cut lines, the installer's toolchain step (printed) | 1 to 3 | Items 1 and 2 (the handover's default) | Install the toolchain (Jason's yes); `app` on a recording of Jason's own |
| 5 | `app … reel N`: Reel projects; `title`, `reels` and `reel drop` made to work for them | 4 | Item 4 (where a Reel project lands) | One Reel opened |
| 6 | `app … what-happened`, `… versions` | 4 | Item 1 (the app writes its history without a handover) | After a few requests in the app |
| 7 | `exports.js` and `finish` for a raw video and an iPhone clip (B2a); an iPhone clip's hand-off no longer written from the import; `show transcript` for a raw video | 4 | Item 3 (export names and folder) | One real hand-off into BRIMM Ops |
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
run() { env -i PATH="$PATH" HOME="$SCRATCH/home" HYPERFRAMES_NO_TELEMETRY=1 HYPERFRAMES_SKIP_SKILLS=1 CI=1 NO_COLOR=1 node "$HF" "$@"; }
run --help > help.txt                     # 43 commands, 73 lines
run init p --non-interactive --skip-skills --skip-transcribe --resolution landscape
run history --dir p --json                # history-empty.json
run catch-up p --json                     # catch-up-empty.json
run open p --json                         # open-not-installed.json on Linux; exit 1
```

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
| `settingsFor("main")` holds the deny rules and four variables, and nothing else | `permissions` has `deny` only (no `allow`); `env` is exactly `HYPERFRAMES_NO_TELEMETRY=1`, `HYPERFRAMES_SKIP_SKILLS=1`, `DISABLE_FEEDBACK_COMMAND=1`, `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY=1` |
| `settingsFor("clip")` also denies `WebFetch` and `WebSearch` | Both present; absent for `main` |
| `childEnv` holds exactly these names | With a base holding `ANTHROPIC_API_KEY`, `HTTPS_PROXY`, `AWS_SECRET_ACCESS_KEY`, `GITHUB_TOKEN`, `CLAUDE_CODE_SESSION_ID`: the result has `PATH`, `HOME`, `LANG`, `HYPERFRAMES_NO_TELEMETRY`, `HYPERFRAMES_SKIP_SKILLS` and none of those |
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

**Files:** Create `tool/project.js`, `tool/tests/project.test.js`, `tool/brand/brand.md`, `tool/brand/fonts/` (Josefin Sans Light, Regular and Medium as `woff2`, from the `@fontsource/josefin-sans` package at a pinned version, with its licence text), `tool/vendor/gsap.min.js` (3.14.2, the version `init` writes), and golden fixtures in `tool/tests/fixtures/hyperframes-0.8.208/init/` (`hyperframes.json`, `meta.json`, `package.json`, `index.html`, `CLAUDE.md`, `words.srt`, `transcript.json`: what the pinned `init --video` and `transcribe` write). Modify `tool/hyperframes.pin.json` (GSAP's version and checksum).

The video is not made here. The writer is given the path of a finished working copy (PR 3, on the same disk) and moves it into `media/recording.mp4` last, by a rename, so a project never holds a half-written video.

- [ ] **Step 1: Capture the golden fixtures** as PR 1's step 1 does: `run init golden --video tiny.mp4 --resolution landscape --non-interactive --skip-skills --skip-transcribe`, then `run transcribe words.srt --dir golden`. `tiny.mp4` is six seconds made with `ffmpeg -f lavfi -i testsrc2=size=1920x1080:rate=30:duration=6 …`; nothing of Sallie's is used.
- [ ] **Step 2: Write the failing tests.** Names, with what each asserts:

| Test | Asserts |
|---|---|
| `index.html` loads no script and no stylesheet from the network | No `src=` or `href=` value starts with `http`; GSAP is `vendor/gsap.min.js` |
| `index.html` has the golden's structure | Same attribute names on the root and the `<video>`: `data-composition-id`, `data-start`, `data-duration`, `data-width`, `data-height`, `class="clip"`, `data-track-index`, `data-has-audio`; one `window.__timelines` registration under the root's id |
| `index.html` takes its size and length from the working copy's facts | 1920×1080, 6 s; and 1080×1920 for an upright clip |
| `hyperframes.json` has the golden's keys, and no registry on a moving branch | No value contains `raw.githubusercontent.com` (until A0b says the key is required: then it is `""`) |
| `package.json` has `dev`, `check` and `render` and no `publish` | Each runs `hyperframes <command>`; `name` is the project's |
| `meta.json` has `id`, `name`, `createdAt` | `name` is the project's name |
| `transcript.json` is the list the pinned `transcribe` writes | Same keys and ids as the golden for the same words; punctuation kept |
| `transcript.json` applies the episode's spellings | "Hormozy" becomes "Hormozi" in `text`; ids and times unchanged |
| `brimm/cut-suggestions.json` uses the transcript's ids | Every `from` and `to` is an id in `transcript.json`; `start` and `end` are those words' |
| `brimm/reel-suggestions.json` has stretches, ids, title, first and last words, and why | Present for a main project, absent for a Reel and a clip |
| The whole file list of a main project is exactly this | `index.html`, `meta.json`, `hyperframes.json`, `package.json`, `transcript.json`, `CLAUDE.md`, `AGENTS.md`, `.claude/settings.json`, `media/recording.mp4`, `vendor/gsap.min.js`, `assets/fonts/josefin-sans-latin-{300,400,500}-normal.woff2`, `assets/logos/<each chosen>`, `brimm/facts.json`, `brimm/cut-suggestions.json`, `brimm/reel-suggestions.json`, `brimm/spellings.json`, `brimm/brand.md`, and the link `node_modules/.bin/hyperframes` |
| The file list of a Reel project | The same, without `cut-suggestions.json` and `reel-suggestions.json` (its `media/recording.mp4` is the Reel's stretch, PR 5) |
| The file list of a session clip's project | `index.html`, `meta.json`, `hyperframes.json`, `package.json`, `transcript.json`, `CLAUDE.md`, `AGENTS.md`, `.claude/settings.json`, `media/recording.mp4` (the clip), `vendor/gsap.min.js`, the fonts, `brimm/facts.json`, `brimm/brand.md`, the link. **No** spellings, cut suggestions, Reel suggestions or logos |
| The video is moved in, not copied | After `writeProject` the source file is gone and `media/recording.mp4` holds its bytes; a failure at any step puts the video back where it was and leaves no folder |
| A session clip's name, folder, `meta.json` and `brimm/facts.json` hold no part of the file's name | Built from a file called "GMT20261013-142933_Recording_Jane Doe.mp4": neither "Jane", "Doe" nor the Zoom time appears anywhere in the file set |
| `CLAUDE.md` and `AGENTS.md` are the same text | Byte for byte |
| The BRIMM rules come first and say they come before everything below | The first heading is "The BRIMM: rules for this project"; the text "These rules come before everything below" follows it |
| The notes tell the agent never to run `skills update`, `publish`, `cloud`, `tts` or `add`, and to use `transcript.json` | Every denied command of PR 1's table is named in the rules |
| The vendored HyperFrames guidance has none of the lines that conflict | With the golden `CLAUDE.md` as input, the output has no `skills update`, no `publish`, no `npm run publish`, no `hyperframes.heygen.com` |
| A session clip's notes begin with its own rules | "This is a clip of a private client session" is above the BRIMM rules; no Share, no cloud render, no Script-panel transcription, no web |
| `projectName` for an episode's part | "Pricing talk main 3fa9c1" and "Pricing talk reel 2 3fa9c1": the file-safe name, the part, the short id; no version |
| `projectName` for a session's clip | "Session clip 3 3fa9c1": from a number and the short id, never the name |
| `writeProject` writes whole or not at all | A failure after the third file leaves no folder; a folder that exists is refused and left alone |
| No path in the set leaves the project, and none is a `.env` | `..`, an absolute path and `.env` are refused by `assertSafe` |

- [ ] **Step 3: Run, see them fail.**
- [ ] **Step 4: Write the module.** `projectName(part)`, `indexHtml(facts)`, `transcriptJson(words, spellings)`, `notesText({ kind })`, `cutSuggestions`, `reelSuggestions`, `projectFiles(input)` returning a `Map` of path to text (and, for fonts, logos and the GSAP file, a pointer to the file to copy), `assertSafe(files)`, `writeProject(dir, files, deps)` (made in the run's own folder, the working copy renamed into `media/` last, and the whole folder renamed into place). It reads `COMMANDS` from PR 1 so the notes' list of denied commands cannot drift from the settings.
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
| The job | ffmpeg runs under `runGuarded` (the memory and time limits the rough cut has) in the run's own folder; the file is renamed into the work folder only when ffmpeg exits 0 and ffprobe reads a length within a second of the source's; the steps are `["Making the video for HyperFrames"]`; a failure or a kill leaves nothing in the work folder; a copy for another key is replaced only after the new one is whole; a second request while one runs starts none (`runningCommand`) |
| The words | Nothing printed holds a path or a flag: "Making the video for HyperFrames", "Done", or "It can't be used: <reason in words>" |

- [ ] **Step 2: Run, see them fail. Step 3: write the module. Step 4: run, see them pass.**
- [ ] **Step 5: By hand.** On the Mac Studio: time one real five-minute clip, and look at one real HDR iPhone clip by eye in the app and in an export (risk 3 in the spec). The pull request says what was seen.
- [ ] **Step 6: Commit** "Studio B1: the working copy".

---

## PR 4. `app`: opening an episode in HyperFrames (the core of B1)

**Files:** Create `tool/app.js`, `tool/tests/app.test.js`, `tool/tests/stand-ins/hyperframes.mjs`. Modify:
- `tool/edit.js`, wiring only: `app` and `workcopy` join `COMMANDS` (`workcopy` is a detached run's alone, like `read`: `startDetached` runs `edit.js workcopy --now <folder>`, and it is in no help); `kind` starts the working copy after the reading; `open` and `app` both call `claimAndBring(ctx, found)`, today's claim and bring factored into one function; `open` stops printing its lines about showing the timeline in Final Cut.
- `tool/episode.js` (layout 4, the `app` field), `tool/settings.js` (`app`, `appHandover`), `tool/loosened.js` (`transcriptOf` is exported; what it does does not change), `tool/install.sh` (the toolchain step, shown by `--print`).
- `tool/studio/SKILL.md` and `SKILL-open.md`, `README.md` (the rows for `app`; none for `workcopy`), and the tests that pin them: `edit-gate.test.js` (`ASKED`), `edit-labels.test.js` (`TODAY_ASKED`, `walkWords`), `part-f-fixes.test.js`, `edit-kind.test.js`, and the `studio*.test.js` files.

`gate.js` does not change: `app` and `workcopy` are in no list (spec 6.2).

What it does, in order (spec 4.1, steps 6 and 7): the gate; the claim and bring; the working copy (wait for it, with "how far is it?", starting it if `kind` could not); the project (PR 2); the link into the toolchain; the pinned `open` with PR 1's environment; the record.

Tests, by group:

| Group | Tests |
|---|---|
| The record | Layout 4 is written only once `app` is there; a Mac that knows layout 3 refuses it and changes nothing; `app.projects[0]` has `key`, `name`, `madeAt`, `on`, `from`, `workingCopy`, `opened`, `handover`, `fromSuggestion`, `state` |
| The gate | `app` is in no gate list. It runs for an answered raw video, finished video and iPhone clip, and for a session whose mark was cleared; it is refused, in the gate's own words, for an unanswered video, for a video left alone, for a session not cleared ("This is a client or group session: that is not done for one."), and for a video held beside a session (`heldGateFor`); `gate.test.js` and `edit-gate.test.js` walk it |
| The settings | `app` is off unless this Mac's settings turn it on, and says "This Mac isn't set up for HyperFrames yet: ask Jason."; `appHandover` is off unless turned on; `node settings.js set --app hyperframes` and `--app-handover on` (or `off`) write and show them |
| The claim | Another Mac's claim refuses it in `open`'s words; `--take-over` takes the claim over as `open --take-over` does (the snapshot comes in PR 11); files online-only are brought first; `open` and `app` give the same answer for the same claim |
| `open` | It prints nothing about Final Cut, a timeline or a project in Final Cut; its claim and bring are unchanged |
| The working copy | `kind` for a raw video and for an iPhone clip starts `workcopy` once, after the reading, when the video is on this Mac; a finished video, a session, "leave it" and an online-only video start none; asking twice starts one (`runningCommand`); `app` starts it when `kind` could not, and waits; `workcopy` runs for an answered raw video or iPhone clip and is never started for a session |
| The chat | `app` finds the chat's transcript with `transcriptOf` (her folder, the id in its environment) and the `claude` process above it, as `markChat` does, and asks `chatHeld`; with no readable transcript the handover is refused, never guessed |
| The stand-in | `tests/stand-ins/hyperframes.mjs` answers `--version`, `open --json` (opened, not-installed, open-failed, from an environment variable the test sets), `catch-up --json`, `history --json`, from PR 1's fixtures; it records its argument list and environment names to a file |
| Opening | The stand-in is called with the absolute path, `open`, the project folder and `--json`, and no `npx`; the environment names are exactly PR 1's; the project exists before the call and is not removed when it fails |
| The handover | With the setting off the stand-in sees no `CLAUDE_CODE_SESSION_ID`; with it on, from a chat `chatHeld` does not hold, it does; from a held chat it does not, and the words say why |
| Failure | Not installed, failed to open: the words of PR 1; the record gets no `opened` time; the project is kept; a second `app` opens the same project and does not make another |
| Idempotence | Asking twice opens the one project and makes no second working copy. A raw video that changed since the project was made is said in words and a new project is offered; nothing is replaced under a project that may be open, and the earlier one is kept and marked (spec 4.8) |
| The words | Nothing printed holds a path, a flag or a command name; `behind` also reports a toolchain that is not the pin |
| The installer | `install.sh --print` names the toolchain step, the pin and the integrity check, says that Final Cut is optional, and changes nothing; no test runs the step |
| The skill | `SKILL.md` and `SKILL-open.md` get the "In HyperFrames" rows; every test that pins a sentence is updated |

- [ ] Steps: failing tests, run, module, run, whole suite.
- [ ] **By hand** (Jason's yes to install the toolchain first): on the Mac Studio, with a recording of Jason's own, say "open it in HyperFrames" in the chat; the app opens the project; try `app` again; try it from a chat that holds a session's words (made-up) and see the handover refused.
- [ ] **Commit** "Studio B1: opening an episode in HyperFrames".

---

## PR 5 to PR 15, in outline

Each gets its own detailed section, in the same shape as PR 1 to 4, when the one before it is merged and A0 has answered what it waits for.

**PR 5. Reel projects** (`app … reel N`). Tests: the stretch is cut from the working copy (a finished video: from the original) into the Reel project's `media/recording.mp4`, by a short ffmpeg job under `runGuarded`; `fromSuggestion` is the suggestion's number or `null` for times she gave; the project has no cut or Reel suggestions; the face positions go to `brimm/face-track.json` only when `faces.swift` found some; a suggestion that no longer exists is refused in words; `app … reel N` marks the candidate picked, which is what `reel pick` did and what `parts.js` and the hand-off read. The commands that met Reels made in Final Cut change with it: `title <episode> reel N` accepts a Reel that `app` made and still refuses one nobody made; `reels` prints the candidates with no previews and without the line that sends her to OpusClip for a candidate `app` can make; `reel pick` goes and `reel drop N` stays, in `HELP`, the skill, the README and every test that pins them.

**PR 6. `what-happened` and `versions`.** Tests: `turnsOf` over a real-shaped file in plain words, newest first, with no path; with no file it says nothing was done in the app yet; `versions` calls the pinned `history --json --limit 20 --dir`; a failing `history` says "I can't list the versions right now; HyperFrames shows its history" and exits 0.

**PR 7. B2a: `exports.js` and `finish` for a raw video and an iPhone clip.** Tests, in the shape of `parts.test.js` and `finish.test.js`: names matched composed (NFC) against recorded project names; the newest export after the project's last change; an older one asks; two equally new ask; a Reel project with no export asks to leave it out; the main video with none stops; a `renders/` file is mentioned and not taken; the checks of spec 8.2; `finalTranscript` per export; **the hand-off passes `handoffFaultV2` and `tidyTranscript` for a raw video and for an iPhone clip, and `contract.test.js` is unchanged**; the files go into `final/` by the rule with the hand-off last; the late check; nothing is deleted from Downloads unless it is unchanged since it was taken. The iPhone clip's path changes with it (spec 4.2): `handoffOwed` stops owing a hand-off for an iPhone clip, so `saveSpellings` writes none from the import; `hasFinalCut`, which today makes `finish` and `push` refuse an answered iPhone clip ("an iPhone clip is not edited here"), no longer does, and `finish` takes a short video and its export; if it was never opened in the app, `finish` asks once, "Hand it off as it is, or open it in HyperFrames first?", and `finishFinished`'s short-video branch is used only for "as it is". `show transcript` of a raw video prints the transcript the reading kept, since `<stem>.rough-cut.transcript.txt` is no longer made.

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

- A0, its additions (`docs/phase-a0/additions.md`) and A0b are not run. PRs 4 to 7 each name the answer they wait for.
- The Studio repo's `main` branch and its copy of the tag `brimm-video-v1` (Jason; see "Not here").
- The questions Q1 to Q3 and decisions D1 to D10 of the spec. Decision D5 (a session clip's hand-off) needs brimm-operations as well.
- Sallie's laptop is not on the light import, which PR 12 waits for (`docs/setup/sallies-laptop.md`).
- Whether the Mac's ffmpeg has the tone-mapping filter PR 3 needs (`ffmpeg -filters`). The installer's check should print it.
- The documentation site `hyperframes.heygen.com` could not be read from the session that wrote this (not on its allowed network list). Facts about the app's windows come from the design document's reading of 2026-10-26. A session on a machine that can reach it should read the app pages (`studio-app/`: `workspace`, `export`, `brand-kits`, `existing-project`) before PR 7 and compare them with the spec's section 8.1.

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
