#!/bin/zsh
# S4 and S5 (spike only; see ../README.md): builds "BRIMM Spike.app" (bundle id com.thebrimm.spike), with S3's signed node inside it,
# signs it with Jason's Developer ID, and zips it for notarizing. Run on the Mac Studio as jasonogden:
#   zsh agent-spike/build.sh --print    what it would do. It changes nothing.
#   zsh agent-spike/build.sh --build    compiles BRIMMSpike.swift, puts probe.mjs and S3's signed node folder in the app's Resources,
#                                       signs the app around them, and makes the zip.
# Notarizing sends the app to Apple, so this never does it: it prints the commands for the by-hand step. The launch agent is not made
# or loaded here: in-test-account.zsh does that in the spare account, by Jason's own step, from com.thebrimm.spike-agent.plist.
set -u
source ${0:A:h:h}/common.zsh
HERE=${0:A:h}

S4=$WORK/s4-agent
APP_NAME="BRIMM Spike"
APP=$S4/$APP_NAME.app
ZIP=$S4/$APP_NAME.zip
TREE=$WORK/s3-node/node
B=$BUILD_ROOT/s4
BUNDLE_ID=com.thebrimm.spike

usage() {
  say "Say what to do: --print or --build."
  exit 2
}

# Whether S3's node folder is there and its node is signed with a Developer ID and the hardened runtime.
node_signed() {
  [[ -x $TREE/bin/node ]] || return 1
  local told=$(codesign -dv --verbose=2 $TREE/bin/node 2>&1)
  [[ $told == *"Authority=Developer ID Application"* && $told == *"(runtime)"* ]]
}

notary_steps() {
  say "Not notarized yet. That sends the app to Apple, so it is a by-hand step, on Jason's yes. The commands:"
  say "  xcrun notarytool submit \"$ZIP\" --keychain-profile \"BRIMM notary\" --wait --output-format json | tee \"$S4/notary.json\""
  say "  xcrun notarytool log \"\$(plutil -extract id raw \"$S4/notary.json\")\" --keychain-profile \"BRIMM notary\""
  say "  xcrun stapler staple \"$APP\" && ditto -c -k --norsrc --noextattr --keepParent \"$APP\" \"$ZIP\""
  say "  spctl --assess --type execute -vv \"$APP\""
}

print_plan() {
  say "S4 and S5: BRIMM Spike.app (spike only). --print changes nothing."
  say ""
  say "--build makes $APP:"
  say "  Contents/MacOS/$APP_NAME, compiled from $HERE/BRIMMSpike.swift for macOS 13 or later"
  say "  Contents/Resources/probe.mjs, from $HERE/probe.mjs"
  if node_signed; then
    say "  Contents/Resources/node, from $TREE (signed already, by S3)"
  else
    say "  Contents/Resources/node, from $TREE: not there or not signed yet, so --build would stop. Build S3 first."
  fi
  say "  Info.plist: bundle id $BUNDLE_ID, and the words macOS adds to its prompts for Downloads and Dropbox"
  say "then signs the app around them with the hardened runtime and a timestamp, and makes $ZIP."
  say ""
  say "The launch agent the spare account loads (in-test-account.zsh agent-load), from $HERE/com.thebrimm.spike-agent.plist:"
  sed 's/^/  /' $HERE/com.thebrimm.spike-agent.plist
  say ""
  refuse_watched $WORK $BUILD_ROOT
  say "None of these folders is in Dropbox or inside a folder the import watches."
  say ""
  notary_steps
  say ""
  say "Nothing was changed."
}

do_build() {
  refuse_watched $WORK $BUILD_ROOT
  node_signed || stop "Stopped: S3's signed node is not in $TREE. Build S3 first (node-app.sh --build)."
  [[ -x /usr/bin/swiftc ]] || stop "Stopped: building the app's program needs Xcode's command line tools (swiftc), and they are not here."
  find_identity
  export PATH=$SYSTEM_PATH
  rm -rf $B $APP $ZIP
  mkdir -p $B $APP/Contents/MacOS $APP/Contents/Resources || stop "Stopped: the app's folders could not be made."
  cat > $APP/Contents/Info.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key><string>$APP_NAME</string>
  <key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
  <key>CFBundleName</key><string>$APP_NAME</string>
  <key>CFBundleDisplayName</key><string>$APP_NAME</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleShortVersionString</key><string>0.1</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSDownloadsFolderUsageDescription</key><string>BRIMM Spike looks in your Downloads folder, to test which name macOS shows when it asks.</string>
  <key>NSFileProviderDomainUsageDescription</key><string>BRIMM Spike looks in your Dropbox folder, to test which name macOS shows when it asks.</string>
</dict>
</plist>
PLIST
  plutil -lint $APP/Contents/Info.plist >/dev/null || stop "Stopped: the Info.plist did not pass plutil."
  swiftc -O -target arm64-apple-macos13.0 -module-cache-path $B/modules -o $APP/Contents/MacOS/$APP_NAME $HERE/BRIMMSpike.swift || stop "Stopped: the app's program did not compile."
  chmod 755 $APP/Contents/MacOS/$APP_NAME
  cp $HERE/probe.mjs $APP/Contents/Resources/probe.mjs || stop "Stopped: probe.mjs could not be copied."
  ditto $TREE $APP/Contents/Resources/node || stop "Stopped: S3's node folder could not be put in the app."
  sign_one $APP
  codesign --verify --strict --deep --verbose=2 $APP || stop "Stopped: the app's signature did not check."
  say "The app's signature checks."
  ditto -c -k --norsrc --noextattr --keepParent $APP $ZIP || stop "Stopped: the zip could not be made."
  say "Made $APP"
  say "Made $ZIP"
  say "Signed as $identity."
  say ""
  notary_steps
}

(( $# >= 1 )) || usage
case $1 in
  --print) print_plan ;;
  --build) do_build ;;
  *) usage ;;
esac
