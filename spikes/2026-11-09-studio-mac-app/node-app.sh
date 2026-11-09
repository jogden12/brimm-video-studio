#!/bin/zsh
# S3 (spike only; see README.md): the official node for Apple silicon, re-signed with Jason's Developer ID inside a tiny test app,
# "BRIMM Node Spike.app", and zipped for notarizing. Run on the Mac Studio as jasonogden:
#   zsh node-app.sh --print     what it would do. It changes nothing and fetches nothing.
#   zsh node-app.sh --fetch     fetches node's tarball into App spikes/downloads and checks it against its pin. It is not pinned yet:
#                               the first fetch prints its SHA-256 beside nodejs.org's own, and stops.
#   zsh node-app.sh --build     builds and signs the app from what --fetch fetched, and fetches nothing:
#                                 - node's bin and lib (npm included) go into Contents/Resources/node, and S1's ffmpeg and ffprobe and
#                                   S2's whisper-cli into its bin beside node, when they are built: one folder, as the design has it;
#                                 - every program in it is signed with the hardened runtime and a timestamp, node also with
#                                   node-app/node.entitlements: allow-jit and allow-unsigned-executable-memory, which V8 needs, and
#                                   disable-library-validation, for native add-ons not signed by Jason's team (sharp, which the
#                                   HyperFrames command line loads);
#                                 - then the app, around them, and the zip.
#                               Notarizing sends the app to Apple, so this never does it: it prints the commands for the by-hand step.
# The signed node folder is also kept on its own, in App spikes/s3-node/node, for S4's app (agent-spike/build.sh) to carry.
set -u
source ${0:A:h}/common.zsh

S3=$WORK/s3-node
APP_NAME="BRIMM Node Spike"
APP=$S3/$APP_NAME.app
ZIP=$S3/$APP_NAME.zip
TREE=$S3/node
B=$BUILD_ROOT/s3
S1_OUT=$WORK/s1-ffmpeg/out
S2_OUT=$WORK/s2-whisper/out
ENTITLEMENTS=$SPIKE/node-app/node.entitlements
LAUNCHER=$SPIKE/node-app/launcher.swift
BUNDLE_ID=com.thebrimm.node-spike

usage() {
  say "Say what to do: --print, --fetch or --build."
  exit 2
}

# What the build takes from S1 and S2, said once for --print and --build.
extras() {
  local p
  for p in $S1_OUT/ffmpeg $S1_OUT/ffprobe $S2_OUT/whisper-cli; do
    if [[ -x $p ]]; then print -r -- "$p"; fi
  done
}

notary_steps() {
  say "Not notarized yet. That sends the app to Apple, so it is a by-hand step, on Jason's yes. The commands:"
  say "  xcrun notarytool submit \"$ZIP\" --keychain-profile \"BRIMM notary\" --wait --output-format json | tee \"$S3/notary.json\""
  say "  xcrun notarytool log \"\$(plutil -extract id raw \"$S3/notary.json\")\" --keychain-profile \"BRIMM notary\""
  say "  xcrun stapler staple \"$APP\" && ditto -c -k --norsrc --noextattr --keepParent \"$APP\" \"$ZIP\""
  say "  spctl --assess --type execute -vv \"$APP\""
}

print_plan() {
  say "S3: node, signed as the app's (spike only). --print changes nothing and fetches nothing."
  say ""
  say "--fetch fetches this into $DOWNLOADS, and checks it against its pin:"
  show_pin node
  say ""
  say "--build fetches nothing. It unpacks node in $B, and makes:"
  say "  $TREE: node's bin and lib, and LICENSE"
  local p
  local -a more
  more=("${(@f)$(extras)}")
  more=(${more:#})
  if (( ${#more} )); then
    for p in "${more[@]}"; do say "    with ${p:t} from $p"; done
  else
    say "    with nothing from S1 or S2: neither is built yet"
  fi
  say "  each program in it signed, inside-out: node with $ENTITLEMENTS, the others with the hardened runtime alone"
  say "  $APP: its program from $LAUNCHER (it runs node --version), bundle id $BUNDLE_ID, macOS 13 or later, with the folder above"
  say "    in Contents/Resources/node, and then the app signed around it"
  say "  $ZIP, made with ditto, as tool/move-app/build-app.sh makes its zip"
  say ""
  if security find-identity -v -p codesigning 2>/dev/null | grep -q 'Developer ID Application'; then
    say "Signing: the keychain has $(security find-identity -v -p codesigning | grep -c 'Developer ID Application') Developer ID Application identity (it must have exactly one)."
  else
    say "Signing: the keychain has no Developer ID Application identity, so --build would stop."
  fi
  refuse_watched $WORK $BUILD_ROOT
  say "None of these folders is in Dropbox or inside a folder the import watches."
  say ""
  notary_steps
  say ""
  say "Nothing was changed."
}

do_fetch() {
  refuse_watched $WORK
  fetch node || exit 3
}

do_build() {
  refuse_watched $WORK $BUILD_ROOT
  verified node
  [[ -x /usr/bin/swiftc ]] || stop "Stopped: building the app's program needs Xcode's command line tools (swiftc), and they are not here."
  find_identity
  export PATH=$SYSTEM_PATH
  rm -rf $B $TREE $APP $ZIP
  mkdir -p $B $TREE $S3 || stop "Stopped: the build's folders could not be made."

  tar -xzf $DOWNLOADS/${PIN_FILE[node]} -C $B || stop "Stopped: node's tarball could not be unpacked."
  local src=$B/$(top_of $DOWNLOADS/${PIN_FILE[node]})
  ditto $src/bin $TREE/bin && ditto $src/lib $TREE/lib && cp $src/LICENSE $TREE/LICENSE || stop "Stopped: node's files could not be copied."
  local p
  for p in "${(@f)$(extras)}"; do
    [[ -n $p ]] || continue
    cp $p $TREE/bin/ || stop "Stopped: $p could not be copied."
    say "With ${p:t}, from $p."
  done
  say "node $($TREE/bin/node --version), with npm $(PATH=$TREE/bin:$SYSTEM_PATH $TREE/bin/npm --version 2>/dev/null || print -r -- '(its version could not be read)')."

  # Inside-out: every program and library in the folder first, then the app around it.
  # Only files that can be programs or libraries are asked: npm's own thousands of JavaScript files are not.
  local f
  for f in "${(@f)$(find $TREE -type f \( -perm -u+x -o -name '*.dylib' -o -name '*.node' -o -name '*.so' \))}"; do
    [[ -n $f ]] && is_macho $f || continue
    if [[ $f == $TREE/bin/node ]]; then sign_one $f $ENTITLEMENTS; else sign_one $f; fi
    say "Signed ${f#$TREE/}."
  done

  mkdir -p $APP/Contents/MacOS $APP/Contents/Resources || stop "Stopped: the app's folders could not be made."
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
  <key>LSUIElement</key><true/>
</dict>
</plist>
PLIST
  plutil -lint $APP/Contents/Info.plist >/dev/null || stop "Stopped: the Info.plist did not pass plutil."
  swiftc -O -target arm64-apple-macos13.0 -module-cache-path $B/modules -o $APP/Contents/MacOS/$APP_NAME $LAUNCHER || stop "Stopped: the app's program did not compile."
  chmod 755 $APP/Contents/MacOS/$APP_NAME
  ditto $TREE $APP/Contents/Resources/node || stop "Stopped: the signed node folder could not be put in the app."
  sign_one $APP
  codesign --verify --strict --deep --verbose=2 $APP || stop "Stopped: the app's signature did not check."
  say "The app's signature checks."
  local held=$(codesign -d --entitlements - --xml $TREE/bin/node 2>/dev/null | grep -o 'com\.apple\.security\.[a-z.-]*' | paste -sd, -)
  say "node's entitlements: ${held:-none could be read}."
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
  --fetch) do_fetch ;;
  --build) do_build ;;
  *) usage ;;
esac
