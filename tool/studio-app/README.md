# tool/studio-app: BRIMM Video Studio.app and its build

This folder is the Mac app's own: the Swift shell, the stand-in engine for looking at its windows, and the two scripts that build it. It is never put in the app. What the app carries of Studio is the rest of `tool/`, taken from one commit.

- `Sources/` is the app (SwiftUI in one AppKit window). The files that import only Foundation hold every decision that can be wrong quietly; `Check/main.swift` builds them into `studio-check`, which the tests ask.
- `dev/fake-engine.mjs` is a stand-in engine that speaks the protocol and does nothing else. `sample-guide.js` fills the real Getting Started guide with sample details, for the stand-in to hand over as its guide.
- `build-info.js` writes `build.json` and `Info.plist`. `vendor.pin.json` and `vendor.js` say what is vendored, and seal and check the vendor folder. `sparkle.pin.json` and `sparkle.js` say which Sparkle archive the app carries, by its SHA-256, and hold the update key's public half. `common.zsh` holds what the scripts share. `node.entitlements` is node's alone: the app itself has none.

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
- `--channel` is `stable` when not given.
- `--sign` signs inside-out with the one Developer ID Application identity in the keychain, found by name and given to codesign by its SHA-1, so that an expired certificate of the same name is never taken for it. Without it every program is sealed ad hoc, for this Mac's tests only.
- `--any-commit` builds a commit that is not on `origin/main`. Changes in `tool/` that are not committed are always refused.
- `--print` says what it would do and does none of it.
- `--fake-engine` puts the stand-in engine in place of Studio's tool, for looking at the windows, with the real guide's page beside it, made by `sample-guide.js` from the commit's own `setup/guide.js`. Such a build holds no installer, sets up nothing and is never signed with the Developer ID.

No script writes into a folder the background job watches, the drop folder or Dropbox. Notarizing sends the app to Apple, so `build-app.sh` never does it: with `--sign` it prints the commands, and after them the release's command line.

## Who runs them

Claude runs the scripts only with `--print`, or inside a test (`tool/tests/studio-app-build.test.js`, `studio-app-vendor.test.js` and `studio-app-sparkle.test.js`, with stand-ins for swiftc, codesign, security, xcrun and curl). A real build, a vendor build, a fetch of Sparkle, signing, notarizing and opening the app are by-hand steps, each on Jason's yes.

## A real build, in order

1. The vendor folder, once: `build-vendor.sh --out /Users/Shared/brimm-studio-vendor`. About fifteen minutes and 170 MB of downloads. It ends by naming the sealed folder and the source zip. A pin that moves makes the folder unusable, and it is built again.
2. Sparkle's archive, once for each pin: `fetch-sparkle.sh`.
3. The app, from a commit on `origin/main`: `build-app.sh --out <folder> --version <v> --build <n> --vendor /Users/Shared/brimm-studio-vendor/vendor --sparkle ~/Library/Caches/brimm-studio-app/sparkle/Sparkle-<version>.tar.xz`, with `--sign` for a copy that leaves the Mac Studio. The build number goes up by one with every such build.
4. With `--sign`, the notarizing commands it prints, then the zip again, after stapling.
5. Then the release, as the last line `build-app.sh --sign` prints. Its own lines go in the next part.

## A release

`release.sh`, which makes the appcast and prints the publishing commands, comes with Phase 7's last task, and its lines will be written here then.

## The by-hand checks

They are on the Mac App By-Hand Checks page (https://claude.ai/artifact/VQVsatRKKwwYpzKW3GZPdA), in the Phase 6 group, each with its commands and a place for its result.
