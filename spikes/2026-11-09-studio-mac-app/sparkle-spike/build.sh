#!/bin/zsh
# S7 (spike only; see ../README.md): a Sparkle 2 update round trip from Cloudflare R2. Builds "Sparkle Spike.app" (bundle id
# com.thebrimm.sparkle-spike) twice, with Sparkle's framework inside, each signed with Jason's Developer ID and zipped for notarizing;
# has Sparkle's own generate_appcast write the list of updates (the appcast) for build 2 and sign it with the key in Jason's login
# keychain; and prints the cf commands that publish it. Run on the Mac Studio as jasonogden:
#   zsh sparkle-spike/build.sh --print          what it would do. It changes nothing and fetches nothing.
#   zsh sparkle-spike/build.sh --fetch          fetches Sparkle's tarball into App spikes/downloads and checks it against its pin. It is
#                                               not pinned yet: the first fetch prints its SHA-256 beside GitHub's own, and stops.
#   zsh sparkle-spike/build.sh --key            unpacks Sparkle from the pinned tarball, and prints the public half of the Sparkle
#                                               signing key in the login keychain; or, when there is none yet, says so and prints the
#                                               command Jason makes it with himself, and stops.
#   zsh sparkle-spike/build.sh --build 1        build 1: version 1.0 (1), the word "first".
#   zsh sparkle-spike/build.sh --build 2        build 2: version 1.1 (2), the word "second". Nothing else differs.
#   zsh sparkle-spike/build.sh --appcast        runs generate_appcast on a folder holding only build 2's notarized, stapled zip, which
#                                               signs the update with the keychain's key, and checks what it wrote.
#   zsh sparkle-spike/build.sh --publish-print  prints the cf commands Jason runs himself: the bucket, its custom domain, and the two
#                                               files. It runs none of them.
# The key's private half never leaves the login keychain: this reads only its public half (generate_keys -p), and generate_appcast
# signs with the keychain's key itself. Nothing here prints the private half or writes it anywhere. Notarizing sends an app to Apple
# and publishing changes Cloudflare, so this never does either: it prints their commands for the by-hand steps.
set -u
source ${0:A:h:h}/common.zsh
HERE=${0:A:h}

S7=$WORK/s7-sparkle
APP_NAME="Sparkle Spike"
BUNDLE_ID=com.thebrimm.sparkle-spike
typeset -A VERSION_OF WORD_OF
VERSION_OF=(1 1.0 2 1.1)
WORD_OF=(1 first 2 second)
B=$BUILD_ROOT/s7
# Where Sparkle is unpacked: its tarball has no folder of its own at the top, so it gets one here.
SPARKLE=$B/sparkle-$SPARKLE_VERSION
GENERATE_KEYS=$SPARKLE/bin/generate_keys
GENERATE_APPCAST=$SPARKLE/bin/generate_appcast
# The feed and the folder the update is downloaded from, both on UPDATE_HOST (common.zsh), which nothing else spells.
FEED=https://$UPDATE_HOST/spike/appcast.xml
PREFIX=https://$UPDATE_HOST/spike/
# The zone the update host is in, which attaching the custom domain needs: the host without its first part.
ZONE=${UPDATE_HOST#*.}
# The folder generate_appcast is run on: build 2's zip alone, under the name the appcast gives it (no spaces, for its address), and
# the appcast it writes.
APPCAST_DIR=$S7/appcast
UPDATE_ZIP=Sparkle-Spike-${VERSION_OF[2]}.zip

usage() {
  say "Say what to do: --print, --fetch, --key, --build 1, --build 2, --appcast or --publish-print."
  exit 2
}

build_dir() { print -r -- "$S7/build-$1" }

# Whether a zip holds a stapled app: Apple's ticket is in the app's Contents/CodeResources, so a zip made before the stapling has none.
zip_stapled() { unzip -l "$1" 2>/dev/null | grep -q -F "$APP_NAME.app/Contents/CodeResources" }

notary_steps() {
  local dir=$(build_dir $1)
  say "Build $1 is not notarized yet. That sends the app to Apple, so it is a by-hand step, on Jason's yes. The commands:"
  say "  xcrun notarytool submit \"$dir/$APP_NAME.zip\" --keychain-profile \"BRIMM notary\" --wait --output-format json | tee \"$dir/notary.json\""
  say "  xcrun notarytool log \"\$(plutil -extract id raw \"$dir/notary.json\")\" --keychain-profile \"BRIMM notary\""
  say "  xcrun stapler staple \"$dir/$APP_NAME.app\" && ditto -c -k --norsrc --noextattr --keepParent \"$dir/$APP_NAME.app\" \"$dir/$APP_NAME.zip\""
  say "  spctl --assess --type execute -vv \"$dir/$APP_NAME.app\""
}

# --- Sparkle and its key ---

# Unpacks Sparkle from the pinned tarball into SPARKLE, unless it is there already, and checks that what the spike uses is in it.
unpack_sparkle() {
  verified sparkle
  if [[ ! -x $GENERATE_KEYS || ! -x $GENERATE_APPCAST || ! -d $SPARKLE/Sparkle.framework ]]; then
    rm -rf $SPARKLE
    mkdir -p $SPARKLE || stop "Stopped: $SPARKLE could not be made."
    tar -xJf $DOWNLOADS/${PIN_FILE[sparkle]} -C $SPARKLE || stop "Stopped: Sparkle's tarball could not be unpacked."
    say "Unpacked Sparkle $SPARKLE_VERSION in $SPARKLE."
  fi
  local p
  for p in $GENERATE_KEYS $GENERATE_APPCAST; do [[ -x $p ]] || stop "Stopped: Sparkle's tarball has no ${p:t} in bin/."; done
  [[ -d $SPARKLE/Sparkle.framework/Versions/B ]] || stop "Stopped: Sparkle's tarball has no Sparkle.framework/Versions/B."
}

# The public half of the Sparkle signing key in the login keychain, as Sparkle's own generate_keys -p reads it: it looks the key up
# and prints only its public half, and never makes one. Sets public_key and returns 0; or returns 1 and sets key_said to what
# generate_keys said instead. Its output is taken only when it has a public key's shape (44 characters of base64, 32 bytes), so that
# nothing else it might print is ever passed on.
read_public_key() {
  local out
  public_key=
  key_said=
  out=$("$GENERATE_KEYS" -p 2>&1)
  if (( $? == 0 )) && [[ $out =~ '^[A-Za-z0-9+/]{43}=$' ]]; then
    public_key=$out
    return 0
  fi
  if [[ $out == *ERROR:* ]]; then key_said=${${out#*ERROR: }%%$'\n'*}; else key_said="something that is not a public key, which is not shown"; fi
  return 1
}

# Said when there is no key: how Jason makes it, himself, with Sparkle's own tool, and backs it up.
no_key() {
  say "There is no Sparkle signing key in your login keychain yet (generate_keys -p said: $key_said)."
  say "Jason makes it himself, once, in his own Terminal on the Mac Studio, with Sparkle's own tool. It keeps the private half in his"
  say "login keychain and prints only the public half:"
  say "  \"$GENERATE_KEYS\""
  say "and backs it up himself, to a file of his own choosing, never in the repo and never in chat (that file is the private key):"
  say "  \"$GENERATE_KEYS\" -x \"<a file of your choosing>\""
  say "Then run --key again."
}

# --- What it does ---

print_plan() {
  say "S7: a Sparkle 2 update round trip from Cloudflare R2 (spike only). --print changes nothing and fetches nothing."
  say ""
  say "Updates are offered from https://$UPDATE_HOST/spike/ (UPDATE_HOST in common.zsh): the feed $FEED,"
  say "kept in the R2 bucket $UPDATE_BUCKET."
  say ""
  say "--fetch fetches this into $DOWNLOADS, and checks it against its pin:"
  show_pin sparkle
  say ""
  say "--key unpacks Sparkle in $SPARKLE, and prints the public half of the signing key in the login keychain, as"
  say "  \"$GENERATE_KEYS\" -p"
  say "reads it. When there is none yet, it says so, prints the command Jason makes it with himself, and stops."
  say ""
  local n
  for n in 1 2; do
    say "--build $n makes $(build_dir $n)/$APP_NAME.app, version ${VERSION_OF[$n]} ($n), with the word \"${WORD_OF[$n]}\" in its window:"
    say "  Contents/MacOS/$APP_NAME, compiled from $HERE/SparkleSpike.swift for arm64 and macOS 13 or later, against Sparkle's framework"
    say "  Contents/Frameworks/Sparkle.framework, from Sparkle $SPARKLE_VERSION"
    say "  Info.plist: bundle id $BUNDLE_ID; SUFeedURL $FEED;"
    say "    SUPublicEDKey, the public half --key reads (it will not build without it);"
    say "    SUEnableAutomaticChecks, SUAutomaticallyUpdate and SUEnableSystemProfiling, each false"
    say "  then $(build_dir $n)/$APP_NAME.zip, made with ditto -c -k --norsrc --noextattr --keepParent"
  done
  say "Each is signed inside-out with the hardened runtime and a timestamp, as Sparkle's documentation says to sign Sparkle for an app"
  say "signed outside Xcode (sparkle-project.org/documentation/sandboxing; this app is not sandboxed), and never with --deep:"
  say "  Contents/Frameworks/Sparkle.framework/Versions/B/XPCServices/Installer.xpc"
  say "  Contents/Frameworks/Sparkle.framework/Versions/B/XPCServices/Downloader.xpc, keeping its own entitlements"
  say "  Contents/Frameworks/Sparkle.framework/Versions/B/Autoupdate"
  say "  Contents/Frameworks/Sparkle.framework/Versions/B/Updater.app"
  say "  Contents/Frameworks/Sparkle.framework"
  say "  then the app around them."
  if security find-identity -v -p codesigning 2>/dev/null | grep -q 'Developer ID Application'; then
    say "Signing: the keychain has $(security find-identity -v -p codesigning | grep -c 'Developer ID Application') Developer ID Application identity (it must have exactly one)."
  else
    say "Signing: the keychain has no Developer ID Application identity, so --build would stop."
  fi
  say ""
  say "--appcast takes build 2 once it is notarized and stapled, puts its zip alone in $APPCAST_DIR as $UPDATE_ZIP, and runs"
  say "  \"$GENERATE_APPCAST\" --download-url-prefix \"$PREFIX\" -o \"$APPCAST_DIR/appcast.xml\" \"$APPCAST_DIR\""
  say "which signs the update with the key in the login keychain (macOS may ask Jason to allow generate_appcast to use it). The item"
  say "has no channel: stable items stay untagged. It prints the appcast, and checks that it holds an sparkle:edSignature."
  say ""
  say "--publish-print prints the cf commands Jason runs himself, to make the bucket, attach $UPDATE_HOST to it, and publish the"
  say "appcast and the zip. It runs none of them."
  say ""
  refuse_watched $WORK $BUILD_ROOT
  say "None of these folders is in Dropbox or inside a folder the import watches."
  say ""
  notary_steps 1
  say ""
  notary_steps 2
  say ""
  say "Nothing was changed."
}

do_fetch() {
  refuse_watched $WORK
  fetch sparkle || exit 3
}

do_key() {
  refuse_watched $BUILD_ROOT
  unpack_sparkle
  if read_public_key; then
    say "The public half of the Sparkle signing key in your login keychain (SUPublicEDKey) is"
    say "  $public_key"
  else
    no_key
    exit 1
  fi
}

do_build() {
  local n=${1-}
  [[ $n == 1 || $n == 2 ]] || usage
  refuse_watched $WORK $BUILD_ROOT
  [[ -x /usr/bin/swiftc ]] || stop "Stopped: building the app's program needs Xcode's command line tools (swiftc), and they are not here."
  unpack_sparkle
  if ! read_public_key; then
    say "Stopped: the app needs the public half of the Sparkle signing key (SUPublicEDKey), so nothing was built."
    no_key
    exit 1
  fi
  find_identity
  export PATH=$SYSTEM_PATH
  local dir=$(build_dir $n)
  local app=$dir/$APP_NAME.app zip=$dir/$APP_NAME.zip work=$B/build-$n
  local framework=$app/Contents/Frameworks/Sparkle.framework
  rm -rf $work $app $zip $dir/notary.json
  mkdir -p $work $app/Contents/MacOS $app/Contents/Frameworks $app/Contents/Resources || stop "Stopped: the app's folders could not be made."
  cat > $app/Contents/Info.plist <<PLIST
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
  <key>CFBundleShortVersionString</key><string>${VERSION_OF[$n]}</string>
  <key>CFBundleVersion</key><string>$n</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSDownloadsFolderUsageDescription</key><string>Sparkle Spike lists your Downloads folder, to test whether what you allow survives an update.</string>
  <key>BRIMMSpikeWord</key><string>${WORD_OF[$n]}</string>
  <key>SUFeedURL</key><string>$FEED</string>
  <key>SUPublicEDKey</key><string>$public_key</string>
  <key>SUEnableAutomaticChecks</key><false/>
  <key>SUAutomaticallyUpdate</key><false/>
  <key>SUEnableSystemProfiling</key><false/>
</dict>
</plist>
PLIST
  plutil -lint $app/Contents/Info.plist >/dev/null || stop "Stopped: the Info.plist did not pass plutil."
  swiftc -O -target arm64-apple-macos13.0 -module-cache-path $work/modules -F $SPARKLE -framework Sparkle \
    -Xlinker -rpath -Xlinker @executable_path/../Frameworks \
    -o $app/Contents/MacOS/$APP_NAME $HERE/SparkleSpike.swift || stop "Stopped: the app's program did not compile."
  chmod 755 $app/Contents/MacOS/$APP_NAME
  # ditto keeps the framework's links and the programs' permissions, which Sparkle's documentation asks of any copy of it.
  ditto $SPARKLE/Sparkle.framework $framework || stop "Stopped: Sparkle's framework could not be put in the app."

  # Inside-out, in the order and with the flags of Sparkle's own documentation (codesign -f -s … -o runtime, the Downloader service
  # with --preserve-metadata=entitlements), with the secure timestamp notarizing needs. The XPC services are signed although this
  # app is not sandboxed and Sparkle uses them only for a sandboxed app (SUEnableInstallerLauncherService and
  # SUEnableDownloaderService are not set): they are in Sparkle's framework as it ships, and Sparkle's documentation says they may be
  # taken out, which the spike does not do.
  local part
  for part in $framework/Versions/B/XPCServices/Installer.xpc $framework/Versions/B/XPCServices/Downloader.xpc; do
    if [[ ! -d $part ]]; then
      say "Sparkle $SPARKLE_VERSION has no ${part:t}: there is nothing to sign there."
      continue
    fi
    if [[ ${part:t} == Downloader.xpc ]]; then
      codesign --force --sign "$identity" --options runtime --timestamp --preserve-metadata=entitlements $part || stop "Stopped: signing ${part#$app/} failed."
    else
      codesign --force --sign "$identity" --options runtime --timestamp $part || stop "Stopped: signing ${part#$app/} failed."
    fi
    say "Signed ${part#$app/}."
  done
  for part in $framework/Versions/B/Autoupdate $framework/Versions/B/Updater.app $framework; do
    [[ -e $part ]] || stop "Stopped: Sparkle's framework has no ${part#$framework/}."
    codesign --force --sign "$identity" --options runtime --timestamp $part || stop "Stopped: signing ${part#$app/} failed."
    say "Signed ${part#$app/}."
  done
  sign_one $app
  codesign --verify --strict --deep --verbose=2 $app || stop "Stopped: the app's signature did not check."
  say "The app's signature checks."
  local team=$(codesign -dv --verbose=2 $app 2>&1 | sed -n 's/^TeamIdentifier=//p')
  ditto -c -k --norsrc --noextattr --keepParent $app $zip || stop "Stopped: the zip could not be made."
  say "Made $app"
  say "  version ${VERSION_OF[$n]} ($n), \"${WORD_OF[$n]}\", feed $FEED, SUPublicEDKey $public_key"
  say "Made $zip"
  say "Signed as $identity (team $team)."
  say ""
  notary_steps $n
}

do_appcast() {
  refuse_watched $WORK $BUILD_ROOT
  unpack_sparkle
  local dir=$(build_dir 2)
  local app=$dir/$APP_NAME.app zip=$dir/$APP_NAME.zip
  [[ -d $app && -f $zip ]] || stop "Stopped: build 2 is not made yet. Run --build 2 first."
  [[ $(plutil -extract CFBundleVersion raw -o - $app/Contents/Info.plist 2>/dev/null) == 2 ]] || stop "Stopped: the app in $dir is not build 2."
  [[ -f $app/Contents/CodeResources ]] || stop "Stopped: build 2 is not notarized and stapled yet. Do those steps first; nothing was changed."
  zip_stapled $zip || stop "Stopped: $zip holds no stapled app: it was made before the stapling. Make it again with the stapling step's ditto line."
  if ! read_public_key; then
    say "Stopped: generate_appcast signs with the key in your login keychain, and there is none, so nothing was changed."
    no_key
    exit 1
  fi
  [[ $(plutil -extract SUPublicEDKey raw -o - $app/Contents/Info.plist 2>/dev/null) == $public_key ]] ||
    stop "Stopped: build 2 was built with another key's public half than the one in your login keychain, so Sparkle would refuse the update. Build it again."
  rm -rf $APPCAST_DIR
  mkdir -p $APPCAST_DIR || stop "Stopped: $APPCAST_DIR could not be made."
  cp $zip $APPCAST_DIR/$UPDATE_ZIP || stop "Stopped: build 2's zip could not be copied."
  say "generate_appcast is signing the update with the key in your login keychain. macOS may ask whether generate_appcast may use"
  say "your confidential information in the keychain: Jason types his login password and clicks Allow."
  "$GENERATE_APPCAST" --download-url-prefix "$PREFIX" -o "$APPCAST_DIR/appcast.xml" "$APPCAST_DIR" || stop "Stopped: generate_appcast failed (what it said is above)."
  local cast=$APPCAST_DIR/appcast.xml
  [[ -f $cast ]] || stop "Stopped: generate_appcast wrote no $cast."
  say ""
  say "The appcast it wrote, $cast:"
  sed 's/^/  /' $cast
  say ""
  local bad=0
  if grep -q 'sparkle:edSignature="[^"]' $cast; then say "It holds an sparkle:edSignature."; else say "It holds no sparkle:edSignature: the update is not signed, and Sparkle would refuse it."; bad=1; fi
  if grep -q '<sparkle:channel>' $cast; then say "It has a channel tag, and stable items stay untagged."; bad=1; else say "It has no channel tag."; fi
  if grep -q -F "url=\"$PREFIX$UPDATE_ZIP\"" $cast; then say "Its download is $PREFIX$UPDATE_ZIP."; else say "Its download is not $PREFIX$UPDATE_ZIP."; bad=1; fi
  if grep -q '<sparkle:version>2</sparkle:version>' $cast; then say "Its item is build 2."; else say "Its item is not build 2."; bad=1; fi
  say "In $APPCAST_DIR: $(ls $APPCAST_DIR | paste -sd ',' - | sed 's/,/, /g')"
  (( bad == 0 )) || stop "Stopped: the appcast is not right (above). Nothing is to be published."
  say ""
  say "Next: --publish-print prints the commands Jason runs to publish them."
}

do_publish_print() {
  say "S7: the Cloudflare commands Jason runs himself, in his own Terminal, with the cf command (his rule for Cloudflare). This prints"
  say "them and runs none of them; it changes nothing."
  say ""
  say "Once, before the first publish:"
  say "  1. R2 is turned on for the Cloudflare account, in the Cloudflare dashboard (R2 Object Storage). There is no cf command for it."
  say "  2. cf is signed in:"
  say "       cf auth whoami"
  say "  3. The bucket is made:"
  say "       cf r2 buckets create --name $UPDATE_BUCKET"
  say "  4. The zone ID of $ZONE, which the next command needs, is read:"
  say "       cf zones list --name $ZONE"
  say "  5. $UPDATE_HOST is attached to the bucket as its custom domain, open to the public, with TLS 1.2 or later (<zone ID> is the"
  say "     id step 4 printed):"
  say "       cf r2 buckets domains custom create $UPDATE_BUCKET --domain $UPDATE_HOST --zone-id <zone ID> --enabled --min-tls 1.2"
  say ""
  say "Each publish, the zip first, so that the appcast never names a zip that is not there yet:"
  say "  6. cf r2 objects put spike/$UPDATE_ZIP --bucket-name $UPDATE_BUCKET --file \"$APPCAST_DIR/$UPDATE_ZIP\" --content-type application/zip"
  say "  7. cf r2 objects put spike/appcast.xml --bucket-name $UPDATE_BUCKET --file \"$APPCAST_DIR/appcast.xml\" --content-type application/xml"
  say ""
  say "Then Claude checks that both answer at $UPDATE_HOST:"
  say "  curl -sI $FEED"
  say "  curl -sI $PREFIX$UPDATE_ZIP"
  if [[ ! -f $APPCAST_DIR/appcast.xml || ! -f $APPCAST_DIR/$UPDATE_ZIP ]]; then
    say ""
    say "(--appcast has not been run yet, so the two files are not in $APPCAST_DIR.)"
  fi
  say ""
  say "Nothing was changed."
}

(( $# >= 1 )) || usage
case $1 in
  --print) print_plan ;;
  --fetch) do_fetch ;;
  --key) do_key ;;
  --build) do_build ${2-} ;;
  --appcast) do_appcast ;;
  --publish-print) do_publish_print ;;
  *) usage ;;
esac
