#!/bin/zsh
# Builds "Move to Studio.app" and its zip, for Sallie's laptop. Run on a Mac with the Xcode command line tools:
#   zsh tool/move-app/build-app.sh --out <folder> [--sign] [--any-commit]
# It makes <folder>/Move to Studio.app and <folder>/Move to Studio.zip, replacing only those two from an earlier build. Beyond
# <folder> it writes only a temporary folder (swiftc's module cache), which it takes away.
#   --sign        signs the app with the one "Developer ID Application" identity in the keychain, found by name (nothing secret
#                 is in any file), with the hardened runtime and a secure timestamp. codesign --timestamp asks Apple's timestamp
#                 server for the time, which signing for notarization needs; that is all it sends.
#   --any-commit  builds at a commit that is not yet on origin/main (the default refuses, so what Sallie gets is what was merged).
# It always refuses when the app's own files have changes that are not committed: the commit written into the app must be the
# code inside it. Notarizing sends the app to Apple, so this script never does it: it prints the commands for the by-hand step.

set -u

here=${0:A:h}
repo=${here:h:h}
out=
sign=0
any_commit=0

while (( $# )); do
  case $1 in
    --out) (( $# >= 2 )) || { print "--out needs a folder."; exit 2 }; out=$2; shift 2 ;;
    --sign) sign=1; shift ;;
    --any-commit) any_commit=1; shift ;;
    *) print "Not an option this builder knows: $1"; exit 2 ;;
  esac
done
[[ -n $out ]] || { print "Say where to build: --out and a folder."; exit 2 }

if [[ -n $(git -C $repo status --porcelain -- tool/move-app) ]]; then
  print "The app's files in tool/move-app have changes that are not committed. Commit them first."
  exit 1
fi
commit=$(git -C $repo rev-parse HEAD) || { print "This is not a git checkout."; exit 1 }
if (( ! any_commit )) && ! git -C $repo merge-base --is-ancestor HEAD refs/remotes/origin/main 2>/dev/null; then
  print "This commit (${commit[1,7]}) is not on origin/main. Merge it first, or use --any-commit."
  exit 1
fi

identity=
if (( sign )); then
  found=("${(@f)$(security find-identity -v -p codesigning | grep 'Developer ID Application')}")
  found=(${found:#})
  if (( ${#found} != 1 )); then
    print "Signing needs exactly one Developer ID Application identity in the keychain, and this Mac found ${#found} Developer ID Application identities."
    exit 1
  fi
  identity=${found[1]#*\"}
  identity=${identity%\"*}
fi

mkdir -p $out || exit 1
out=${out:A}
app=$out/"Move to Studio.app"
zip=$out/"Move to Studio.zip"
work=$(mktemp -d "${TMPDIR:-/tmp}/move-app-build.XXXXXX") || exit 1
trap 'rm -rf $work' EXIT

rm -rf $app $zip
mkdir -p $app/Contents/MacOS $app/Contents/Resources || exit 1

cat > $app/Contents/Info.plist <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key><string>Move to Studio</string>
  <key>CFBundleIdentifier</key><string>com.thebrimm.move-to-studio</string>
  <key>CFBundleName</key><string>Move to Studio</string>
  <key>CFBundleDisplayName</key><string>Move to Studio</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
PLIST
plutil -lint $app/Contents/Info.plist >/dev/null || { print "The Info.plist did not pass plutil."; exit 1 }

swiftc -O -target arm64-apple-macos13.0 -module-cache-path $work/modules -o $app/Contents/MacOS/"Move to Studio" $here/launcher.swift || { print "The launcher did not compile."; exit 1 }
chmod 755 $app/Contents/MacOS/"Move to Studio"

cp -X $here/move.zsh $here/open-in-terminal.zsh $app/Contents/Resources/ || exit 1
chmod 755 $app/Contents/Resources/move.zsh $app/Contents/Resources/open-in-terminal.zsh
print -r -- $commit > $app/Contents/Resources/commit.txt

if (( sign )); then
  codesign --force --options runtime --timestamp --sign $identity $app || { print "Signing failed."; exit 1 }
  codesign --verify --strict --verbose=2 $app || { print "The signature did not check."; exit 1 }
fi

ditto -c -k --keepParent $app $zip || { print "The zip could not be made."; exit 1 }

print "Made $app"
print "Made $zip"
print "At commit $commit"
if (( sign )); then
  print "Signed as $identity."
  print ""
  print "Not notarized yet. That sends the app to Apple, so it is a by-hand step, on Jason's yes. The commands:"
  print "  xcrun notarytool submit \"$zip\" --keychain-profile \"BRIMM notary\" --wait"
  print "  xcrun stapler staple \"$app\""
  print "  ditto -c -k --keepParent \"$app\" \"$zip\""
else
  print "Not signed: this copy opens on this Mac only. Use --sign for the copy that goes to Sallie."
fi
