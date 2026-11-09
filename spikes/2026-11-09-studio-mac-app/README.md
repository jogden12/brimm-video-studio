# Phase 0 of the Mac app: the spikes

9 November 2026. The design is `docs/superpowers/specs/2026-11-09-studio-mac-app-design.md` and the build plan is
`docs/superpowers/plans/2026-11-09-studio-mac-app-build-plan.md` (Phase 0's row lists S1 to S7).

**These are spikes, and only spikes.** Each one answers a question the app's design rests on, on the Mac Studio and in a spare
standard account on it, and is then thrown away. Nothing here is tested, nothing here is shipped, and nothing here is imported by
Studio. Phase 6 builds again, test first, whatever the spikes show is worth keeping. They sit at the top of the repo, not under
`tool/`, so that the app's `git archive` of `tool/` never carries them.

The by-hand steps are the group "Phase 0 of the Mac app: the spikes" on the Studio By-Hand Checks page, drafted in
`page-group.js`. Claude runs the Terminal steps on the Mac Studio as jasonogden, each on Jason's yes; Jason does the steps in the
spare account and everything on screen.

## Where things are

| What | Where |
|---|---|
| The spike scripts | this folder |
| Downloads, each checked against its pin | `~/BRIMM Video Work/App spikes/downloads/` |
| What each spike makes | `~/BRIMM Video Work/App spikes/s1-ffmpeg/`, `s2-whisper/`, `s3-node/`, `s4-agent/` |
| Where the sources are compiled | `~/Library/Caches/brimm-studio-spikes/` (see below) |
| What the spare account reads | `/Users/Shared/BRIMM Studio spikes/` (readable by both accounts; `stage.sh` puts things there) |
| The spike clip | `/Users/Shared/BRIMM Studio spikes/Spike clip.mov`: an iPhone recording of Jason's own, a minute or less, in which he talks, recorded in HDR (the iPhone's default) |

Nothing is ever written in Dropbox or in a drop folder: every script refuses to write inside a folder that
`com.thebrimm.unedited` watches, and inside `~/BRIMM Video Work/Drop`. ffmpeg's, x264's and pkgconf's build scripts cannot take a
folder whose name has a space in it, and "BRIMM Video Work/App spikes" has two, so the compiling happens in
`~/Library/Caches/brimm-studio-spikes/` (this Mac's own disk) and only what is made is kept in App spikes.

**The spare account** ("Studio Test", a standard account, not an admin) is what a client's Mac looks like. Two things on the Mac
Studio are there for every account and can't be taken away from one: Homebrew (`/etc/paths.d/homebrew` puts `/opt/homebrew/bin` on
every account's PATH) and Xcode's command line tools. `in-test-account.zsh setup` takes Homebrew off that account's PATH, and sets
`DEVELOPER_DIR` to an empty place, so that git, swift, python3 and the other tools' stand-ins in `/usr/bin` fail there as they
would on a Mac without the tools. Two limits stay: a program that looks in `/opt/homebrew/bin` by name still finds it there, and
`xcode-select -p` still succeeds (it prints the empty place). So each spike says which program it ran by its whole path, and S6
looks for any program of that account running from `/opt/homebrew`.

## The files

- `pins.zsh`: every download, by its URL and SHA-256, its rough size, and where each SHA-256 was read. An empty SHA-256 is one
  that is not pinned yet: the script that needs it fetches it, prints the SHA-256 it found (beside the one the maker publishes, when
  the maker publishes one), and stops. Claude fills it in only after Jason's yes.
- `common.zsh`: the shared paths, the one way a download is fetched and checked, the guard against watched folders, the check that
  a program loads only macOS's own libraries, and the signing identity, found by name as `tool/move-app/build-app.sh` finds it.
- `build-ffmpeg.sh` (S1), with `s1-check.mjs`.
- `build-whisper.sh` (S2), with `s2-compare.mjs`.
- `node-app.sh` (S3), with `node-app/launcher.swift` and `node-app/node.entitlements`.
- `agent-spike/` (S4 and S5): `BRIMMSpike.swift`, `probe.mjs`, `build.sh`, and the launch agent's template
  `com.thebrimm.spike-agent.plist`.
- `in-test-account.zsh`: the steps run in the spare account, each by name (`setup`, `look`, `node`, `cli`, `doctor`, …), with
  `test-account.mjs`. It refuses to run in an admin account.
- `stage.sh`: puts in `/Users/Shared/BRIMM Studio spikes/` what the spare account needs: the helper, a copy of Studio's `tool/`
  (as `git archive` makes it, without tests or move-app), the model (a clone, which takes no room), and the notarized zips.
- `page-group.js`: the draft of the checks, as the page's own group object.

Every script has `--print`, which prints what it would do and changes nothing. Nothing here notarizes, installs or loads a launch
agent on the Mac Studio: notarizing sends an app to Apple, so the scripts only print its commands, and the page runs them, each on
Jason's yes. The launch agent goes only in the spare account, by Jason's own step there, and a last step takes it away.

## The spikes, and what each decides

### S1: a static ffmpeg (`build-ffmpeg.sh`)
Builds ffmpeg 9.0.2 (the version the Mac Studio's Homebrew ffmpeg is) and ffprobe for arm64 and macOS 13 or later, with x264 at
the commit Homebrew's x264 r3222 is (b35605a), as a static library. `--enable-gpl`, `--disable-autodetect`, then VideoToolbox,
AudioToolbox, zlib, bzip2 and libx264 by name; no network, no devices but lavfi. pkgconf is built first, for the build alone, and
`PKG_CONFIG_PATH` and `PKG_CONFIG_LIBDIR` name only the build's own folder. It ends by checking with `otool -L` that both programs
load only `/usr/lib/` and `/System/`, and that `otool -l` says macOS 13.0. It also makes the matching source zip (both source
archives, the build scripts and the exact configure lines), since ffmpeg with libx264 is GPL software and shipping it means offering
its source.

`--check` asks the new ffmpeg, with Studio's own `hasFilters` and `hasHwaccel` (workcopy.js), for every filter Studio's code gives
it (grep `-vf`, `-af`, `-filter_complex` in `tool/*.js`), and for the hardware decoder; then for the encoders, formats and decoders
one by one; then makes a two-second video with Studio's own settings and reads it back. `--hdr` makes the working copy of the spike
clip with Studio's own job (`makeWorkCopy`), once with Homebrew's ffmpeg and once with the new one, and compares the two.

- **Decides** whether the app can carry its own ffmpeg and ffprobe, or needs another way to get them.
- **Fails** if either program loads a library that is not macOS's own; if a filter, encoder or format Studio uses is missing; if
  `makeWorkCopy` refuses the HDR clip with the new ffmpeg; or if its copy differs from Homebrew's by more than the encoder's
  version string (x264 built from an archive has no git, so its version has no revision number, where Homebrew's says r3222:
  the files differ in those bytes, and the pictures should be the same).

### S2: a static whisper-cli (`build-whisper.sh`)
Builds whisper.cpp 1.9.5 (Homebrew's version) with its own copy of ggml, statically, with Metal and its library embedded in the
program (`GGML_METAL_EMBED_LIBRARY`, so no Xcode is needed to build it and no file beside it is needed to run it), Accelerate, and
no OpenMP. It needs CMake, which this Mac doesn't have: Kitware's own build is fetched for the build alone. `--compare` turns the
spike clip into the transcriber's .wav with Studio's own `ffmpegArgs`, then runs Homebrew's whisper-cli and the new one on it with
the same model and Studio's own arguments (the import's `wordArgs`, and the final transcript's `whisperArgs`), and diffs the .srt
files and compares the word times in the .json.

- **Decides** whether the app can carry its own transcriber.
- **Fails** if the program loads a library that is not macOS's own, if it does not use Metal, or if its subtitles differ from
  Homebrew's in their words. Small differences in times are for Jason to judge: Homebrew's whisper-cli uses ggml 0.26.0 from its
  own formula, with OpenMP, and this one uses the copy of ggml inside whisper.cpp 1.9.5, without.

### S3: node, signed as the app's (`node-app.sh`)
Takes the official node darwin-arm64 tarball, v26.11.1 (what `node --version` prints on the Mac Studio today), and puts its `bin`
and `lib` in a tiny test app, `BRIMM Node Spike.app`, at `Contents/Resources/node/`. S1's ffmpeg and ffprobe and S2's whisper-cli
go in its `bin` beside node, when they are built: that one folder is the design's (`dirname(process.execPath)`). Every program in it
is signed inside-out with Jason's Developer ID, the hardened runtime and a timestamp; node also gets allow-jit,
allow-unsigned-executable-memory and disable-library-validation (for sharp, which the HyperFrames command line loads). It is zipped
for notarizing; the notarizing and stapling commands are printed, never run. Then in the spare account, with no Homebrew, that node
and its npm install the pinned HyperFrames command line, run its `--version`, its `browser ensure` and its `doctor`, load sharp, and
the whisper-cli beside it transcribes the spike clip and is compared with the Mac Studio's.

- **Decides** whether the app can carry node (and the programs beside it) through notarization, and whether they then run on a
  client's Mac as they are.
- **Fails** if Apple's notary service rejects it, if Gatekeeper stops node in the spare account, if npm cannot install the pinned
  command line, if sharp will not load in the signed node, if doctor cannot find ffmpeg beside node, or if whisper-cli under the
  hardened runtime cannot use Metal.

### S4: the background job through the app (`agent-spike/`, `--agent`)
`BRIMM Spike.app` (bundle id `com.thebrimm.spike`), with S3's signed node inside. Run with `--agent`, its own program starts that
node as its child on `probe.mjs`, which lists the Downloads folder and any Dropbox folder the account has and logs what macOS
answered and how long it took, then waits for it. The launch agent `com.thebrimm.spike-agent` (never `com.thebrimm.unedited`) runs
the app's own executable with `--agent`, with `WatchPaths` on `~/BRIMM Spike Watch` and `AssociatedBundleIdentifiers` naming the
app. It is loaded only in the spare account, by Jason, and taken away at the end.

- **Decides** design section 4: whether the background job can run through the app, so that macOS's privacy prompts, its Files and
  Folders list and Login Items all show "BRIMM Spike" (later "BRIMM Video Studio"), not "node".
- **Fails** if the prompt or the Files and Folders entry names node, or Login Items shows the label or a bare program in place of
  the app's name.

### S5: signing in to Claude Code with no Terminal (`agent-spike/`, opened from Finder)
The same app, opened from Finder (or with `--login`), runs `claude auth login` under a pseudo-terminal (`forkpty`), with Claude
Code installed in the spare account by its own native installer into `~/.local/bin`. It shows what claude prints in a small window,
opens in the browser the sign-in link it prints (only a link to claude.ai, claude.com or anthropic.com), has a box and keys for
anything claude asks, and when claude ends it asks `claude auth status --json`, showing only whether the account is signed in and
on which plan, never its email address or organisation. It also says whether Terminal was running.

- **Decides** whether the setup assistant can sign Claude Code in itself (step 3 of the design's setup), or must send the person to
  Terminal for it.
- **Fails** if sign-in never finishes in the window, needs something the window can't give, or `auth status` says not signed in
  afterwards.

### S6: the HyperFrames app with no Homebrew (no script of its own)
Steps only: in the spare account, download the HyperFrames app from its own page (`https://hyperframes.dev/studio/download`, the
page the pinned command line names for macOS), try to put it in Applications as a standard account would, put it in the
Applications folder in the account's home instead, and open a test project. The test project is written with Studio's own code
(`projectFiles` and `writeProject`, as `explainer.js` writes a HeyGen explainer's, so it holds no media), run on S3's node, with its
`node_modules/.bin/hyperframes` link to the pinned command line S3 installed; the pinned command line checks it (`lint`) and hands it
to the app (`open … --json`, as `edit.js` does). The spike does not use the command line's `init`, which Studio denies (it loads
code from the network and carries a publish script). The app is then asked to play and export the project on This Mac, while the
account's running programs are looked at for anything from `/opt/homebrew`.

The HyperFrames app on the Mac Studio (0.1.0) carries its own static ffmpeg (`vendor/ffmpeg/darwin-arm64`, FFmpeg 8.1.2) and a list
of runtime packs it fetches (node, npm, ffmpeg, sharp, its command line, a Chrome), so the expectation is that it needs nothing
from Homebrew.

- **Decides** the words of the setup's "Apps to install" step: where a standard account puts the app, and whether it needs anything
  installed first.
- **Fails** if the app needs a Homebrew program, or cannot open or export the project, in the spare account.

### S7: a Sparkle update round trip on Cloudflare R2 (waits)
It needs three things Jason has not given yet: the update domain (for example `updates.<his domain>`), the R2 bucket, and the
Sparkle EdDSA key, which he makes and backs up himself (its private half never goes into chat or into a file in the repo). Until
then there is no script and no command. The outline, for when they are given:
1. Sparkle 2, pinned by URL and SHA-256 like everything here, goes into a build 1 of the spike app, with `SUFeedURL` on the
   update domain, `SUPublicEDKey`, automatic installs off and no system profile.
2. A build 2 of the same app (only its version and a word in its window change) is signed, notarized and stapled like S4's.
3. Sparkle's own `generate_appcast` signs an appcast for build 2 with the EdDSA key, in Jason's keychain, on the Mac Studio.
4. Jason publishes the appcast and the build 2 zip to the bucket with the `cf` CLI (his global rule), by his own step.
5. In the spare account, build 1's "Check for Updates…" finds build 2, checks its EdDSA signature and its team, installs it on his
   click, and relaunches; the privacy grant S4 made is looked at again (it should survive, as the design says it does).

- **Decides** design section 5: whether updates can be offered in the app from Jason's own domain.
- **Fails** if Sparkle rejects the signed update, installs one signed by another team, or the grants do not survive.
