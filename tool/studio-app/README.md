# tool/studio-app: BRIMM Video Studio.app and its build

This folder is the Mac app's own: the Swift shell, the stand-in engine for looking at its windows, and the two scripts that build it. It is never put in the app. What the app carries of Studio is the rest of `tool/`, taken from one commit.

- `Sources/` is the app (SwiftUI in one AppKit window). The files that import only Foundation hold every decision that can be wrong quietly; `Check/main.swift` builds them into `studio-check`, which the tests ask.
- `dev/fake-engine.mjs` is a stand-in engine that speaks the protocol and does nothing else.
- `build-info.js` writes `build.json` and `Info.plist`. `vendor.pin.json` and `vendor.js` say what is vendored, and seal and check the vendor folder. `common.zsh` holds what the two scripts share. `node.entitlements` is node's alone: the app itself has none.

## The two scripts

`build-vendor.sh` makes the programs the app carries that are not its own (node, ffmpeg, ffprobe, whisper-cli), once, into a sealed folder, with the GPL source zip:

```
zsh tool/studio-app/build-vendor.sh --out /Users/Shared/brimm-studio-vendor [--print | --fetch]
```

The folder is never in the home folder: ffmpeg keeps its configure line, paths and all, inside itself, and the source zip prints the same lines, so the path must name no person. It is empty, or one an earlier run made: the script deletes nothing in a folder it did not make.

`build-app.sh` makes `BRIMM Video Studio.app` and `BRIMM-Video-Studio-<version>.zip` in `<folder>`, from the commit that is checked out and that sealed folder, and replaces only those two:

```
zsh tool/studio-app/build-app.sh --out <folder> --version <semver> --build <n> --vendor <folder>
                                 [--channel stable|beta] [--sign] [--any-commit] [--print] [--fake-engine]
```

- `--channel` is `stable` when not given.
- `--sign` signs inside-out with the one Developer ID Application identity in the keychain, found by name and given to codesign by its SHA-1, so that an expired certificate of the same name is never taken for it. Without it every program is sealed ad hoc, for this Mac's tests only.
- `--any-commit` builds a commit that is not on `origin/main`. Changes in `tool/` that are not committed are always refused.
- `--print` says what it would do and does none of it.
- `--fake-engine` puts the stand-in engine in place of Studio's tool, for looking at the windows. Such a build holds no installer, sets up nothing and is never signed with the Developer ID.

Neither script writes into a folder the background job watches, the drop folder or Dropbox. Notarizing sends the app to Apple, so `build-app.sh` never does it: with `--sign` it prints the commands.

## Who runs them

Claude runs both scripts only with `--print`, or inside a test (`tool/tests/studio-app-build.test.js` and `studio-app-vendor.test.js`, with stand-ins for swiftc, codesign, security and xcrun). A real build, a vendor build, signing, notarizing and opening the app are by-hand steps, each on Jason's yes.

## A real build, in order

1. The vendor folder, once: `build-vendor.sh --out /Users/Shared/brimm-studio-vendor`. About fifteen minutes and 170 MB of downloads. It ends by naming the sealed folder and the source zip. A pin that moves makes the folder unusable, and it is built again.
2. The app, from a commit on `origin/main`: `build-app.sh --out <folder> --version <v> --build <n> --vendor /Users/Shared/brimm-studio-vendor/vendor`, with `--sign` for a copy that leaves the Mac Studio. The build number goes up by one with every such build.
3. With `--sign`, the notarizing commands it prints, then the zip again, after stapling.

## The by-hand checks

They are on the Mac App By-Hand Checks page (https://claude.ai/artifact/VQVsatRKKwwYpzKW3GZPdA), in the Phase 6 group, each with its commands and a place for its result.
