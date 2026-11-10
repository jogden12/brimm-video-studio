# Gotchas

Mistakes made or nearly made on Studio, and how not to repeat them. Seeded on 2026-11-10 from Jason's project memory.

## The live Mac Studio

- **The Mac Studio's import runs from its main checkout.** Never `cd` into it or switch its branch: work in a worktree, and run that checkout's scripts by absolute path. Pull it (`git pull --ff-only`) only on Jason's yes, and only while no import or run is at work (check `status` and the pending folder first). After a pull that changes her folder's files, re-write it with `node tool/settings.js studio --node /opt/homebrew/bin/node`.
- **A new file in a drop folder starts the tool.** Never save test footage or originals in a drop folder (the default is `~/BRIMM Video Work/Drop`).
- **A dropped copy of the same recording becomes a new episode.** Studio has no delete command.
- **`brew upgrade node` loses macOS's Files and Folders answer**: Homebrew's node is ad-hoc signed, so its identity is its cdhash and its path is the versioned Cellar path. The launch agent then stopped importing with no word to anyone; #48 added the notice. Check it at the next upgrade (B1).
- **A folder written by older code is "out of date", not "changed"**: nothing changes until `settings.js studio` re-writes it, and a chat already open keeps its old settings.
- **A user-scope MCP server (`~/.mcp.json`) makes any Claude Code session under `~` write `.claude/settings.local.json`**, which Studio's strict-lock check flags. Add one only with `claude mcp add --scope local` in a project.
- **The HyperFrames app updates itself about six times a day**; its "Automatic updates" switch gates installing while away.

## The HyperFrames app

- **It never loads a project's `.claude/settings.json`**: only the project's notes, the app's own `--disallowedTools` and the user's `~/.claude/settings.json` apply there.
- **It transcribes every video it opens, in the cloud** (ElevenLabs' `scribe-v2`, in `.hyperframes/transcripts/`), even when `transcript.json` is there. A session clip must not be opened in the app.
- **Its agent may move the recording**: adding a 3-second title card, it set the a-roll to `data-start="3"`. Read the a-roll's placement from `index.html`; never assume the recording's clock is the timeline's.
- **Storyboard first**: the agent may put a change on its Storyboard and leave `index.html` alone until "Build the video", so an export before that lacks the change.
- **Going back**: asked to go back, the agent may remove a change with a new forward change, so `history --json` marks nothing undone. The project's rules point it to `hyperframes history undo --who claude`.
- **Its transcript says "Brim"**: the house spellings belong in `brimm/spellings.json` too.
- **Its exports land in `~/Downloads`**, which on the Mac Studio is a link into Dropbox.
- **The HeyGen command line never reads the app's sign-in**: only `HEYGEN_API_KEY`, `HYPERFRAMES_API_KEY`, `HEYGEN_ACCESS_TOKEN` or `~/.heygen/credentials`. The app needs a HeyGen sign-in on first run (spike S6).

## Pictures, sound and fonts

- **The Mac Studio's ffmpeg has no `zscale`.** HDR goes through VideoToolbox; frames from it skip ffmpeg's autorotate, so the chain must rotate after `hwdownload`. The frames leave labelled `bt2020nc` and match Apple's only through what ffmpeg does at the encoder: check any chain change against Apple's own still.
- **A working copy's key is the raw's size and time**, so copies made before a change to the look keep the old picture until they are taken away and made again.
- **fontsource's Josefin Sans woff2 files name their family "Josefin Sans Thin"**: use the Google Fonts TTFs wherever the app reads a font file itself (a brand kit).
- **The first caption can start at 0:00 in a silent lead-in**; `lib.js`'s silence finder only sees 5 s or more (fixed in #23 so captions never start in a silence).
- **Changing `normalWords` (`tool/handoff.js`) breaks every stored fingerprint** (`versions.js` `fingerprintOf`).

## Dropbox and Finder

- **Dropbox may bring back part of a trashed folder minutes later**: check a minute or two after a move to the Trash that the folder stays gone.
- **Free space**: the Move to Studio app's look under-counts (purgeable space); HyperFrames' doctor and Studio's guide said about twice as much.
- **On this macOS, `cp -X` and `ditto --noqtn` keep the quarantine flag**; only a redirect copy drops it. Zip with `ditto --norsrc --noextattr`, or `._` files get in.

## Signing and the Mac app

- **Signing on the Mac Studio (Command Line Tools, no Xcode) needed Apple's Developer ID G2 intermediate imported by hand.** Open Keychain Access from Apps; importing with iCloud selected hangs it (-25294).
- **The Move to Studio app clones Studio at the commit it was built from**: a code fix means rebuilding the app.
- **The Code tab's `/status` shows no version** (Claude takes it as a question). The installer's print shows Claude Code's version.

## Git, CI and pull requests

- **CI runs that "fail" in about 50 s with 0 jobs are GitHub not starting them**: re-run.
- **Stacked PRs must be retargeted to `main` after each merge**; branches are not deleted on merge.
- **Each merge of main into a PR branch** regenerates `tool/tests/fixtures/today-says.json` (`cd tool && UPDATE_TODAY=1 node --test tests/edit-labels.test.js`, help-only) and updates the architecture spec's Status line.
- **The repo is public**: committed docs leave out the Dropbox account label, absolute local paths, client names, keys and tokens.

## Writing by-hand checks

- **Placeholders broke nearly every step** (2026-11-02): write each command whole, one action per step, with the exact output to expect or each possible output and what to do next.
- **Every command starts with the `cd` into Studio's `tool` folder**: `node edit.js` fails from the repo's top folder.
- **Say where output appears**: Studio's notices are Mac notifications titled "BRIMM unedited video" (hidden if Script Editor's notifications are off), never Terminal output; `guide "<video>" tell` waits in Terminal instead.
- **A video opened straight in HyperFrames is not an episode**: a check that needs one says how to make it from the drop folder.
- **Several sessions publish the By-Hand Checks page**: change only your own group, and re-read the live page before each publish. Subagents report their steps to the coordinator and never publish the page.
