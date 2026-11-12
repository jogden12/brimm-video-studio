# tool/studio-app: BRIMM Video Studio.app and its build

This folder is the Mac app's own: the Swift shell, the stand-in engine for looking at its windows, and the scripts that build and release it: `build-vendor.sh`, `fetch-sparkle.sh`, `build-app.sh` and `release.sh`. It is never put in the app. What the app carries of Studio is the rest of `tool/`, taken from one commit.

- `Sources/` is the app (SwiftUI in one AppKit window). The files that import only Foundation hold every decision that can be wrong quietly; `Check/main.swift` builds them into `studio-check`, which the tests ask.
- `dev/fake-engine.mjs` is a stand-in engine that speaks the protocol and does nothing else. `sample-guide.js` fills the real Getting Started guide with sample details, for the stand-in to hand over as its guide.
- `build-info.js` writes `build.json` and `Info.plist`. `vendor.pin.json` and `vendor.js` say what is vendored, and seal and check the vendor folder. `sparkle.pin.json` and `sparkle.js` say which Sparkle archive the app carries, by its SHA-256, and hold the update key's public half. `release.js` says whether a build may be released and checks the appcast a release writes. `common.zsh` holds what the scripts share. `node.entitlements` is node's alone: the app itself has none.

## The scripts

`build-vendor.sh` makes the programs the app carries that are not its own (node, ffmpeg, ffprobe, whisper-cli), once, into a sealed folder, with the GPL source zip:

```
zsh tool/studio-app/build-vendor.sh --out /Users/Shared/brimm-studio-vendor [--print | --fetch]
```

The folder is never in the home folder: ffmpeg keeps its configure line, paths and all, inside itself, and the source zip prints the same lines, so the path must name no person. It is empty, or one an earlier run made: the script deletes nothing in a folder it did not make.

`fetch-sparkle.sh` fetches Sparkle's pinned archive and unpacks a copy of it beside it. What it fetches is data until its SHA-256 is the pin's: one that is not is set aside and never unpacked. An archive already there with the pin's SHA-256 is kept and not fetched again:

```
zsh tool/studio-app/fetch-sparkle.sh [--out <folder>] [--print]
```

Without `--out` it uses `~/Library/Caches/brimm-studio-app/sparkle`, and leaves `Sparkle-<version>.tar.xz` and the unpacked `Sparkle-<version>/` there.

`build-app.sh` makes `BRIMM Video Studio.app` and `BRIMM-Video-Studio-<version>.zip` in `<folder>`, from the commit that is checked out, that sealed folder and Sparkle's archive, and replaces only those two:

```
zsh tool/studio-app/build-app.sh --out <folder> --version <semver> --build <n> --vendor <folder> --sparkle <archive>
                                 [--channel stable|beta] [--sign] [--any-commit] [--print] [--fake-engine]
```

- `--sparkle` is the archive `fetch-sparkle.sh` fetched. The build refuses one whose SHA-256 is not `sparkle.pin.json`'s, and checks it again before it unpacks it. It also refuses while the pin has no update key's public half, which goes into `Info.plist`. The bundle gets `Contents/Frameworks/Sparkle.framework`, with its links, and `Contents/Resources/Licenses/Sparkle-LICENSE`. Sparkle's parts are signed after node's programs and before the app, in the order Sparkle's own documentation gives.
- `--channel` is `stable` when not given. A version with a pre-release part, as `1.0.0-beta.2` has, goes on `beta`, and only such a version does: the build refuses any other pairing before anything is written, so a beta is never signed and notarized for the stable channel.
- `--sign` signs inside-out with the one Developer ID Application identity in the keychain, found by name and given to codesign by its SHA-1, so that an expired certificate of the same name is never taken for it. Without it every program is sealed ad hoc, for this Mac's tests only.
- `--any-commit` builds a commit that is not on `origin/main`. Changes in `tool/` that are not committed are always refused.
- `--print` says what it would do and does none of it.
- `--fake-engine` puts the stand-in engine in place of Studio's tool, for looking at the windows, with the real guide's page beside it, made by `sample-guide.js` from the commit's own `setup/guide.js`. Such a build holds no installer, sets up nothing and is never signed with the Developer ID.

No script writes into a folder the background job watches, the drop folder or Dropbox. Notarizing sends the app to Apple, so `build-app.sh` never does it: with `--sign` it prints the commands, and after them the release's command line.

## Who runs them

Claude runs the scripts only with `--print`, or inside a test (`tool/tests/studio-app-build.test.js`, `studio-app-vendor.test.js`, `studio-app-sparkle.test.js` and `studio-app-release.test.js`, with stand-ins for swiftc, codesign, security, xcrun, curl, cf, generate_keys and generate_appcast). A real build, a vendor build, a fetch of Sparkle, signing, notarizing, a real release, publishing and opening the app are by-hand steps, each on Jason's yes.

The tests that typecheck the app's Swift against Sparkle need Sparkle's framework: `BRIMM_SPARKLE` set to a folder that holds `Sparkle.framework`, or else the copy `fetch-sparkle.sh` unpacked into `~/Library/Caches/brimm-studio-app/sparkle/Sparkle-<version>/`. With neither they skip themselves and say so, and such a run does not count as a run with Sparkle.

## A real build, in order

1. The vendor folder, once: `build-vendor.sh --out /Users/Shared/brimm-studio-vendor`. About fifteen minutes and 170 MB of downloads. It ends by naming the sealed folder and the source zip. A pin that moves makes the folder unusable, and it is built again.
2. Sparkle's archive, once for each pin: `fetch-sparkle.sh`.
3. The app, from a commit on `origin/main`: `build-app.sh --out <folder> --version 1.0.0-beta.2 --channel beta --build <n> --vendor /Users/Shared/brimm-studio-vendor/vendor --sparkle ~/Library/Caches/brimm-studio-app/sparkle/Sparkle-<version>.tar.xz`, with `--sign` for a copy that leaves the Mac Studio. A stable version, with no pre-release part, leaves out `--channel beta`. The build number goes up by one with every such build.
4. With `--sign`, the notarizing commands it prints, then the zip again, after stapling.
5. Then the release, as the last two lines `build-app.sh --sign` prints say, with `--first-release` for the first one. Its own lines go in the next part.

## A release

`release.sh` copies the stapled zip into the releases folder, has Sparkle's `generate_appcast` write the signed appcast there, checks it with the same reader `behind` uses (`release.js`), and prints what to publish. It never publishes:

```
zsh tool/studio-app/release.sh --app <the stapled app> --releases <folder> --sparkle <archive> [--source <the GPL source zip>]
                               [--first-release] [--print]
```

- `--app` is the notarized, stapled app, with its zip made again after stapling beside it.
- `--releases` is kept from one release to the next, never in the home's Dropbox or a watched folder: `generate_appcast` makes deltas from the earlier zips in it and keeps its own appcast there. Every release stays in the feed and in the folder: `generate_appcast` is run with `--maximum-versions 0`, so it drops no item and moves no zip into `old_updates/`, and the appcast's length cap is what bounds the feed. The script deletes nothing in the folder but its own files, `unfinished-release.txt`, `appcast.xml.before` and `appcast.xml.before.part`, once a run has ended well. It keeps the appcast as `appcast.xml.before` before it writes `unfinished-release.txt`. A run that stopped leaves them, and the next run stops until the folder is put right as `unfinished-release.txt`'s sentence says.
- `--sparkle` is Sparkle's pinned archive, as `fetch-sparkle.sh` fetched it: it holds `generate_keys` and `generate_appcast`.
- `--source` is the GPL source zip `build-vendor.sh` made, published beside the release.
- `--first-release` says the folder has no appcast yet. Without it, a folder with no `appcast.xml` is refused, so that a mistyped or lost folder is never taken for the first release; with it, a folder that has one is refused.
- After its run it checks the appcast as Studio reads it: this build's item, each download signed and under `releases/`, and no item for a build this release did not make and the earlier appcast did not have (a stray zip in the folder). It prints the feed's newest build before this release, to be checked against the live feed (`curl -s`) before the appcast is put.
- Before anything it refuses a beta version off the beta channel (or a stable one on it), a build number not above every item's in the feed, a version or zip the feed already has, a zip made before stapling, and an archive that is not Sparkle's pinned one.
- It reads only the update key's public half (`generate_keys -p`), and stops before writing anything when that is not the app's `SUPublicEDKey`. `generate_appcast` signs with the key in the login keychain, so macOS may ask whether it may use the keychain.
- `--print` says what it would do, makes no folder and starts neither `generate_keys`, `generate_appcast`, `xcrun` nor `cf`.

The order of a release:

1. The build: `build-app.sh --sign`, as above.
2. Notarizing and stapling, with the commands `build-app.sh --sign` prints, then the zip again.
3. `release.sh --print`, to see what it would do (with `--first-release` the first time only).
4. The real `release.sh`, on Jason's yes, with the same options.
5. Publishing: the `cf` and `curl` lines it prints, by hand and in their order, on Jason's yes: the zip and its deltas (and the source zip with `--source`) first, each only when the line before it answered; then the live feed checked against the newest build it names; and the appcast last, only when each answered 200.

## The by-hand checks

They are on the Mac App By-Hand Checks page (https://claude.ai/artifact/VQVsatRKKwwYpzKW3GZPdA), each with its commands and a place for its result: the build's in the Phase 6 group, and Sparkle's, the update's and the release's in the Phase 7 group on the same page.
