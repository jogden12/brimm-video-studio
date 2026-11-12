#!/bin/zsh
# Builds BRIMM Video Studio.app and its zip from one commit and a sealed vendor folder (Phase 6). Run on a Mac with the Xcode command
# line tools:
#   zsh tool/studio-app/build-app.sh --out <folder> --version <semver> --build <n> --vendor <folder> --sparkle <archive>
#                                    [--channel stable|beta] [--sign] [--any-commit] [--print] [--fake-engine]
# It makes <folder>/BRIMM Video Studio.app and <folder>/BRIMM-Video-Studio-<version>.zip, replacing only those two from an earlier
# build. Everything is put together in a temporary folder, which it takes away, and the two are moved into <folder> only when every
# step has passed. Without --sign every program is sealed ad hoc (codesign --sign -), which is local and sends nothing.
#   --vendor       the folder build-vendor.sh made: node, ffmpeg, ffprobe and whisper-cli, sealed under this commit's pins.
#   --sparkle      Sparkle's archive, as fetch-sparkle.sh fetched it. It is used only when its SHA-256 is sparkle.pin.json's, and that
#                  file must hold the update key's public half, which goes into Info.plist.
#   --channel      stable (when not given) or beta, written into build.json.
#   --sign         signs inside-out with the one "Developer ID Application" identity in the keychain, found by name (nothing secret is
#                  in any file) and given to codesign by its SHA-1, with the hardened runtime and a secure timestamp. codesign --timestamp asks Apple's timestamp server
#                  for the time, which notarizing needs; that is all it sends.
#   --any-commit   builds at a commit that is not yet on origin/main (the default refuses, so what ships is what was merged).
#   --print        says what it would do, and does none of it.
#   --fake-engine  puts the stand-in engine (dev/fake-engine.mjs) in place of Studio's tool, for looking at the windows, with the real
#                  Getting Started guide's page beside it (sample-guide.js), filled with sample details. Such a build holds no
#                  installer, so it can set up, stop or run nothing, and it is never signed with the Developer ID.
# What goes into the bundle comes from the commit. This script's own helpers (build-info.js, vendor.js, sample-guide.js, common.zsh)
# are run from its own folder. Notarizing sends the app to Apple, so this script never does it: it prints the commands for the by-hand
# step.

set -u

here=${0:A:h}
repo=${here:h:h}
source $here/common.zsh

out= version= build= vendor= sparkle= channel=stable
sign=0 any_commit=0 print_only=0 fake=0

while (( $# )); do
  case $1 in
    --out|--version|--build|--vendor|--sparkle|--channel)
      (( $# >= 2 )) || { say "$1 needs a value."; exit 2 }
      case $1 in
        --out) out=$2 ;;
        --version) version=$2 ;;
        --build) build=$2 ;;
        --vendor) vendor=$2 ;;
        --sparkle) sparkle=$2 ;;
        --channel) channel=$2 ;;
      esac
      shift 2 ;;
    --sign) sign=1; shift ;;
    --any-commit) any_commit=1; shift ;;
    --print) print_only=1; shift ;;
    --fake-engine) fake=1; shift ;;
    *) say "Not an option this builder knows: $1"; exit 2 ;;
  esac
done
[[ -n $out ]] || { say "Say where to build: --out and a folder."; exit 2 }
[[ -n $version ]] || { say "Say which version this is: --version and one like 1.0.0 or 1.0.0-beta.1."; exit 2 }
[[ -n $build ]] || { say "Say which build this is: --build and a whole number above 0."; exit 2 }
[[ -n $vendor ]] || { say "Say where the vendored programs are: --vendor and the folder build-vendor.sh made."; exit 2 }
if (( fake && sign )); then
  say "A build with the stand-in engine is never signed with the Developer ID."
  exit 2
fi

commit=$(git -C $repo rev-parse HEAD 2>/dev/null) || stop "This is not a git checkout."

# build-info.js says the first fault in the version, the build or the channel; it is asked here, before anything is written.
fault=$(node $here/build-info.js json --version $version --build $build --commit $commit --channel $channel 2>&1 >/dev/null) || { say $fault; exit 2 }
[[ -n $sparkle ]] || { say "Say where Sparkle is: --sparkle and the archive fetch-sparkle.sh fetched."; exit 2 }

refuse_watched $out
if [[ -n $(git -C $repo status --porcelain -- tool) ]]; then
  stop "Studio's files in tool have changes that are not committed. Commit them first: the commit written into the app must be the code inside it."
fi
if (( ! any_commit )) && ! git -C $repo merge-base --is-ancestor $commit refs/remotes/origin/main 2>/dev/null; then
  stop "This commit (${commit[1,7]}) is not on origin/main. Run git fetch first, to see what GitHub has. If it still is not there, merge it first, or use --any-commit."
fi
why=$(node $here/vendor.js check $vendor 2>&1) || stop $why
vendor=${vendor:A}
# Sparkle's archive must be the pinned one, and the pin must hold the update key's public half. unpack_sparkle checks the archive
# again before it unpacks it.
why=$(node $here/sparkle.js check $sparkle 2>&1) || stop $why
sparkle=${sparkle:A}
public_key=$(node $here/sparkle.js key 2>&1) || stop $public_key
identity= identity_hash=
(( sign )) && find_identity

out=${out:A}
app=$out/"BRIMM Video Studio.app"
zip=$out/BRIMM-Video-Studio-$version.zip
source_name=$(node $here/vendor.js source-name) || stop "The name of ffmpeg's source zip could not be read."

if (( print_only )); then
  say "Would build BRIMM Video Studio $version, build $build, at commit $commit, with the vendored programs in $vendor and Sparkle from $sparkle."
  say "It would make:"
  say "  $app"
  say "  $zip"
  say "The steps, in a temporary folder:"
  say "  1. Studio's tool from the commit (git archive), without tests, move-app, studio-app or any .env file."
  say "  2. build.json, on the $channel channel."
  say "  3. node, ffmpeg, ffprobe and whisper-cli from the vendored programs, with their licences and the line naming $source_name."
  say "  4. Sparkle.framework from the pinned archive, checked again and unpacked, into Contents/Frameworks with its links, and its licence."
  say "  5. Studio's five helpers, compiled with swiftc into node's bin."
  say "  6. Info.plist, with the feed and the update key's public half, checked with plutil."
  say "  7. The app's program, compiled with swiftc from the commit's Sources and linked to Sparkle."
  if (( fake )); then say "  8. The stand-in engine in place of Studio's tool, with the real guide's page filled with sample details."; else say "  8. (No stand-in engine.)"; fi
  if (( sign )); then
    say "  9. Each program under node, then Sparkle's parts in Sparkle's own order, then the app, signed with the hardened runtime as $identity."
  else
    say "  9. Each program under node, then Sparkle's parts in Sparkle's own order, then the app, sealed ad hoc, for this Mac's tests only."
  fi
  say "  10. The signature checked with codesign --verify --deep --strict."
  say "  11. The zip, with ditto, without resource forks or extended attributes."
  say "Nothing was done."
  exit 0
fi

work=$(mktemp -d "${TMPDIR:-/tmp}/studio-app-build.XXXXXX") || stop "The temporary folder could not be made."
trap 'rm -rf $work' EXIT
built=$work/"BRIMM Video Studio.app"
res=$built/Contents/Resources
studio=$res/Studio
tool=$studio/tool
mkdir -p $built/Contents/MacOS $studio || stop "The bundle's folders could not be made."

# 1. Studio's tool, from the commit. tool/studio-app is kept aside, in the temporary folder, for the steps that need its files. The
# archive is written to a file first, so that a git archive that fails is not hidden by a tar that was given nothing.
git -C $repo archive --format=tar -o $work/tool.tar $commit tool || stop "The commit's tool could not be unpacked."
tar -xf $work/tool.tar -C $studio || stop "The commit's tool could not be unpacked."
rm -f $work/tool.tar || stop "The commit's tool could not be unpacked."
mv $tool/studio-app $work/studio-app || stop "The commit has no tool/studio-app."
rm -rf $tool/tests $tool/move-app || stop "The tests and move-app could not be taken out."
find $tool \( -name .env -o -name '.env.*' \) -prune -exec rm -rf {} + || stop "The .env files could not be taken out."
from=$work/studio-app

# 2. build.json.
node $here/build-info.js json --version $version --build $build --commit $commit --channel $channel > $studio/build.json || stop "build.json could not be written."

# 3. The vendored programs and their licences.
ditto $vendor/node $res/node || stop "The vendored programs could not be copied."
ditto $vendor/licenses $res/Licenses || stop "The licences could not be copied."
say "ffmpeg and x264 are free software under the GNU General Public License. The source this copy was built from, with the build's own script, is at https://updates.thebrimminsights.com/source/$source_name." > $res/Licenses/ffmpeg-source.txt || stop "ffmpeg-source.txt could not be written."

# 4. Sparkle's framework, from its archive, which unpack_sparkle checks against the pin again before it unpacks it. ditto keeps the
# framework's links (Versions/Current and those at its top), which codesign needs to find its parts. Only the framework and its
# licence go into the app: the archive's programs for making a release stay out.
mkdir -p $work/sparkle $built/Contents/Frameworks || stop "The folders for Sparkle could not be made."
unpack_sparkle $sparkle $work/sparkle
ditto $work/sparkle/Sparkle.framework $built/Contents/Frameworks/Sparkle.framework || stop "Sparkle's framework could not be copied."
cp -X $work/sparkle/LICENSE $res/Licenses/Sparkle-LICENSE || stop "Sparkle's licence could not be copied."

# 5. Studio's helpers, beside node.
node $tool/build-helpers.js $res/node/bin >/dev/null || stop "Studio's helpers did not compile."

# 6. Info.plist, with the icon when the commit has one, and the update key's public half from sparkle.pin.json.
icon=()
if [[ -f $from/AppIcon.icns ]]; then
  icon=(--icon)
  cp -X $from/AppIcon.icns $res/AppIcon.icns || stop "The icon could not be copied."
fi
node $here/build-info.js plist --version $version --build $build --public-key $public_key $icon > $built/Contents/Info.plist || stop "Info.plist could not be written."
plutil -lint $built/Contents/Info.plist >/dev/null || stop "The Info.plist did not pass plutil."

# 7. The app's program, linked to Sparkle and told to look for it in the bundle's Frameworks. The app's program is also the background
# job's, so a run path that is wrong stops both.
sources=($from/Sources/*.swift(N))
(( ${#sources} )) || stop "The commit has no Swift sources in tool/studio-app/Sources."
swiftc -O -swift-version 5 -target arm64-apple-macos13.0 -module-cache-path $work/modules -F $work/sparkle -framework Sparkle \
  -Xlinker -rpath -Xlinker @executable_path/../Frameworks -o $built/Contents/MacOS/"BRIMM Video Studio" ${(o)sources} || stop "The app did not compile."
chmod 755 $built/Contents/MacOS/"BRIMM Video Studio" || stop "The app's program could not be made runnable."

# 8. The stand-in engine, which leaves nothing of Studio's tool but package.json (it marks tool/ as modules), and beside it the real
# guide's page, filled with sample details by the commit's own setup/guide.js before that is taken away.
if (( fake )); then
  node $here/sample-guide.js $tool $version $build > $work/sample-guide.html || stop "The real guide's page could not be made with sample details."
  find $tool -mindepth 1 -maxdepth 1 ! -name package.json -exec rm -rf {} + || stop "Studio's tool could not be taken out."
  mkdir -p $tool/setup && cp -X $from/dev/fake-engine.mjs $tool/setup/engine.js || stop "The stand-in engine could not be copied."
  cp -X $work/sample-guide.html $tool/setup/sample-guide.html || stop "The real guide's page could not be copied."
  # FAKE-ENGINE.txt is what tells the app it is a stand-in, which turns off the move to Applications and Uninstall.
  say "This build's setup is a stand-in: it is for looking at the windows, and sets up nothing." > $res/FAKE-ENGINE.txt || stop "FAKE-ENGINE.txt could not be written."
fi

# 9. Signing, inside-out: every program and library under node first, sorted by path; then Sparkle's five parts, in the order
# Sparkle's own documentation signs them; then the app. Only files under node that can be programs or libraries are asked whether
# they are Mach-O, as the spike's node-app.sh asks: npm's own thousands of JavaScript files are not. Node alone is given its
# entitlements, and Sparkle's downloader alone keeps its own. Nothing is signed with --deep.
inside=()
for f in "${(@f)$(find $res/node -type f \( -perm -u+x -o -name '*.dylib' -o -name '*.node' -o -name '*.so' \))}"; do
  [[ -n $f ]] && is_macho $f && inside+=($f)
done
framework=$built/Contents/Frameworks/Sparkle.framework
downloader=$framework/Versions/B/XPCServices/Downloader.xpc
parts=($framework/Versions/B/XPCServices/Installer.xpc $downloader $framework/Versions/B/Autoupdate $framework/Versions/B/Updater.app $framework)
for f in $parts; do
  [[ -e $f ]] || stop "${f#$built/} is not in the bundle, so Sparkle's parts cannot be signed."
done
for f in ${(o)inside} $parts $built; do
  keep=() entitled=()
  [[ $f == $downloader ]] && keep=(--preserve-metadata=entitlements)
  [[ $f == $res/node/bin/node ]] && entitled=(--entitlements $from/node.entitlements)
  if (( sign )); then
    codesign --force --options runtime --timestamp --sign $identity_hash $keep $entitled $f || stop "Signing ${f#$built/} failed."
  else
    codesign --force --sign - --timestamp=none $keep $f || stop "${f#$built/} could not be sealed."
  fi
done

# 10. The whole bundle's signature.
codesign --verify --deep --strict --verbose=2 $built || stop "The signature did not check."

# 11. The zip.
ditto -c -k --norsrc --noextattr --keepParent $built $work/app.zip || stop "The zip could not be made."

# Into --out: both go in under hidden names first, then the earlier pair is moved aside, the new pair renamed, and the earlier pair
# taken away. A failure on the way takes the new ones out and puts the earlier ones back, so --out never holds a new app with an old
# zip, or an app with no zip. The hidden names are this script's own; one left by a run that was stopped is taken away first.
mkdir -p $out || stop "The out folder could not be made."
new_app=$out/".${app:t}.new" new_zip=$out/".${zip:t}.new" old_app=$out/".${app:t}.old" old_zip=$out/".${zip:t}.old"
swapped=0
put_back() {
  rm -rf $new_app $new_zip
  (( swapped )) && rm -rf $app $zip
  [[ -e $old_app && ! -e $app ]] && mv $old_app $app
  [[ -e $old_zip && ! -e $zip ]] && mv $old_zip $zip
  stop "The app and its zip could not be moved into $out."
}
rm -rf $new_app $new_zip $old_app $old_zip || stop "The app and its zip could not be moved into $out."
{ mv $built $new_app && mv $work/app.zip $new_zip } || put_back
if [[ -e $app ]]; then mv $app $old_app || put_back; fi
if [[ -e $zip ]]; then mv $zip $old_zip || put_back; fi
swapped=1
{ mv $new_app $app && mv $new_zip $zip } || put_back
rm -rf $old_app $old_zip || stop "The new app and zip are in $out, but the earlier ones could not be taken away from beside them."

say "Made $app"
say "Made $zip"
say "At commit $commit"
say "Version $version, build $build, on the $channel channel."
if (( sign )); then
  say "Signed as $identity."
  say ""
  say "Not notarized yet. That sends the app to Apple, so it is a by-hand step, on Jason's yes. The commands:"
  say "  xcrun notarytool submit \"$zip\" --keychain-profile \"BRIMM notary\" --wait"
  say "  xcrun stapler staple \"$app\""
  say "  ditto -c -k --norsrc --noextattr --keepParent \"$app\" \"$zip\""
  say "  spctl --assess --type execute -vv \"$app\""
  say "The zip is made again after stapling, since a zip made before it has no ticket."
  say "Then the release: zsh tool/studio-app/release.sh --app \"$app\" --releases <folder> --sparkle \"$sparkle\" --print"
else
  say "Not signed with the Developer ID: every program is sealed ad hoc, so this build is for this Mac's tests only."
fi
(( fake )) && say "This build's setup is a stand-in: it is for looking at the windows, and sets up nothing."
exit 0
