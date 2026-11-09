# BRIMM Video Studio as a Mac app: the build plan

9 November 2026. Jason approved it on 2026-11-09. The design is
`docs/superpowers/specs/2026-11-09-studio-mac-app-design.md`.

Each phase gets its own task-level plan in this folder (`2026-11-09-studio-mac-app-phase-<n>-plan.md`), written before it is
built, and is built test first. The work is on the branch `app-development`, cut from `origin/main` (c7bb35a). Push, pull
requests and merges wait for Jason's yes.

## Build phases (each one its own PR, failing tests first)

| # | Phase | Main files |
|---|---|---|
| 0 | **Spikes**, on a spare user account. The by-hand steps go on the Studio By-Hand Checks page. S1: static ffmpeg, checked with `hasHwaccel` and `hasFilters` and an iPhone HDR clip. S2: static whisper-cli, compared with Homebrew's subtitles. S3: notarized node with its entitlements (allow-jit, allow-unsigned-executable-memory, disable-library-validation for sharp), plus the HyperFrames CLI and doctor. S4: the agent run through the app's `--agent`, and how the prompts are named. S5: `claude auth login` with no Terminal, under a pseudo-terminal. S6: the HyperFrames app with no Homebrew. S7: a Sparkle round trip on R2. | spike notes only |
| 1 | **Studio runs without git or Xcode's tools.** Ships to the current Macs by an ordinary pull. | `filing.js`, `dropbox.js`, `unedited.js`, `progress.js`, `originals.js`, new compiled helpers; tests in `filing`, `dropbox`, `progress`, `unedited` |
| 2 | **Quote `{{NODE}}`** (security review) | `studio.js`, `open-lock.js`, `studio/SKILL*.md`, `tests/guard-cases.js` |
| 3 | **The two modes and the update check** | new `build.js`, `update-check.js`; `edit.js` (`behind`, `update`, `studioStale`), `access.js`, skills; new `update-check.test.js`, `behind-installed.test.js`, `edit-update.test.js` |
| 4 | **install.sh in installed mode:** `--tools <bin>` and `--app <bundle>` (the agent through `--agent`, never brew), `idleWhy()`, the model's revision and SHA-256 pinned | `install.sh`, `install.test.js` (`--print` only) |
| 5 | **The setup engine** | new `tool/setup/` (`engine.js`, `checks.js`, `questions.js`, `summary.js`, `install.js`, `guide.js` data, `guide-template.html`); `setup-*.test.js` |
| 6 | **The app and its build:** SwiftUI setup and status windows, `--agent`, the URL scheme, moving itself, repair on a moved path, Uninstall, the PDF. `build-app.sh` uses `git archive`, `build.json`, `vendor.pin.json`, signs inside-out and prints the notarizing steps. | new `tool/studio-app/`; `studio-app-build.test.js` (stand-ins for swiftc and codesign) |
| 7 | **Sparkle and safe updates:** the `updating.json` marker, the wait, the repair afterwards. `release.sh --print`: builds the appcast and signs it with EdDSA; Jason does notarizing and publishing by hand. | `tool/studio-app/`, new `release.sh`, `busy.js`; tests for the marker, its expiry and the release order |
| 8 | **Rollout:** Jason's MacBook on the beta channel, then Sallie's laptop. Delete both Studio deploy keys and brimm-video's key 167644050. Retire `tool/move-app/` and its ten `move-app-*` tests. Docs: `docs/setup/studio-app.md` replaces `move-to-studio-app.md` and `sallies-laptop.md`; README; CLAUDE.md. | docs, CLAUDE.md; deletions |

Phases 1 to 3 are useful on their own: they make the current Macs independent of git and Xcode's tools. Phase 0 comes first, because a failed S1 or S2 (portable ffmpeg or whisper) would change what goes in the bundle.

## Decided by Jason (9 November 2026)
- The update address: `updates.thebrimminsights.com`. thebrimminsights.com is already a zone on Jason's Cloudflare account, so its DNS needs no move. The spikes spell it in one place, `UPDATE_HOST` in `spikes/2026-11-09-studio-mac-app/common.zsh`.
- The R2 bucket: `brimm-studio-updates`.
- The support contact shown in the app and the PDF: `admin@growwiththebrimm.com`.
- The Sparkle EdDSA key: Jason makes it himself on the Mac Studio with Sparkle's own `generate_keys`, which keeps the private half in his login keychain, and backs it up himself (`generate_keys -x` to a file of his choosing). The private half never appears in chat, in a file in the repo, or in anything a script prints: scripts read only the public half (`generate_keys -p`), and `generate_appcast` signs with the keychain's key itself.

## Still open, for Jason in the build session
- The bundle ID: suggested `com.thebrimm.video-studio`.
- R2 must be turned on in the Cloudflare dashboard.
- ffmpeg with libx264 is GPL software. Shipping it to third parties means offering its source; the build keeps the matching source zip on R2.
- One-time by-hand steps: the R2 bucket, its custom domain and the `cf` sign-in (S7 does the bucket and the domain).

## Verification
- **Every phase:** `cd tool && node --test` passes, including `contract.test.js` with unchanged hashes. Installer tests stay `--print` only. No test calls the real claude, HyperFrames or HeyGen.
- **Engine:** the setup harness runs a fresh setup, a takeover, a repair and an update with stand-ins, and checks the JSON-lines events and the install.sh arguments.
- **Build:** an unsigned build is checked for its layout, `build.json`, the Info.plist keys and the signing order (stand-in codesign), and that no `.env` or tests are inside.
- **By hand** (Studio By-Hand Checks page, Jason or Sallie at the Mac):
  1. A first install from the zip on a clean, non-admin account, with no Terminal opened.
  2. Prompts and Login Items show the app's name.
  3. The Getting Started PDF has the right folders.
  4. Starting a Code tab session shows the update line once a newer build is on the beta feed.
  5. "Update Studio" opens Sparkle, and the update waits for a stand-in import.
  6. Permissions survive the update.
  7. Each takeover keeps its settings and drop folder.
