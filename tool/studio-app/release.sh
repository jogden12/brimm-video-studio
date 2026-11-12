#!/bin/zsh
# Makes a release of BRIMM Video Studio.app (Phase 7): it copies the stapled zip into the kept releases folder, has Sparkle's
# generate_appcast write the signed appcast there, checks that appcast as Studio reads it, and prints what to publish. Run on a Mac:
#   zsh tool/studio-app/release.sh --app <the stapled app> --releases <folder> --sparkle <archive> [--source <the GPL source zip>]
#                                  [--first-release] [--print]
#   --app            BRIMM Video Studio.app, notarized and stapled, with BRIMM-Video-Studio-<version>.zip, made again after stapling,
#                    beside it.
#   --releases       the folder kept from one release to the next: generate_appcast makes deltas from the zips in it and keeps its
#                    appcast there.
#   --sparkle        Sparkle's pinned archive, which holds generate_keys and generate_appcast.
#   --source         the GPL source zip build-vendor.sh made, to be published beside the release.
#   --first-release  says this is the first release, so the folder has no appcast yet. Without it a folder with no appcast is refused,
#                    so that a mistyped or lost folder is never taken for the first release; with it, a folder that has one is refused.
#   --print          says what it would do. It makes no folder and starts neither generate_keys, generate_appcast, xcrun nor cf.
# generate_appcast signs with the update key in the login keychain, so macOS may ask whether it may use the keychain. Of generate_keys
# only the public half is ever read, and only a line that is one is kept. The script never publishes: it prints the commands, which
# are a by-hand step. It deletes nothing in the releases folder but its own files, unfinished-release.txt, appcast.xml.before and
# appcast.xml.before.part, once a run has ended well. Every release stays in the feed and in the folder: generate_appcast is told to
# keep every version (--maximum-versions 0), so it drops no item and moves no zip into old_updates/, and the appcast's own length cap
# (release.js's TOO_LONG) is what bounds the feed. Programs are named bare, but for Sparkle's two, which are run from the unpacked
# archive.
set -u
here=${0:A:h}
source $here/common.zsh

# Kept the same as release.js's RELEASES_URL and BUCKET and build-info.js's FEED: the tests compare what is printed with those.
releases_url=https://updates.thebrimminsights.com/releases/
source_url=https://updates.thebrimminsights.com/source/
bucket=brimm-studio-updates
feed=https://updates.thebrimminsights.com/appcast.xml
app_name="BRIMM Video Studio.app"

usage() {
  say "Say which app to release, the releases folder and Sparkle's archive: --app <the stapled app> --releases <folder> --sparkle <archive> [--source <the GPL source zip>] [--first-release] [--print]."
  exit 2
}

app= releases= sparkle= source_zip=
want_print=0 first_release=0
while (( $# )); do
  case $1 in
    --app|--releases|--sparkle|--source)
      (( $# >= 2 )) || usage
      case $1 in
        --app) app=$2 ;;
        --releases) releases=$2 ;;
        --sparkle) sparkle=$2 ;;
        --source) source_zip=$2 ;;
      esac
      shift 2 ;;
    --print) want_print=1; shift ;;
    --first-release) first_release=1; shift ;;
    *) usage ;;
  esac
done
[[ -n $app && -n $releases && -n $sparkle ]] || usage
app=${app:A} releases=${releases:A} sparkle=${sparkle:A}
[[ -n $source_zip ]] && source_zip=${source_zip:A}

# 1. The releases folder is never a watched folder, a drop folder or Dropbox.
refuse_watched "$releases"

# 2. The app, and what its own build.json says.
[[ -d $app && ${app:t} == $app_name ]] || stop "--app is not a folder named $app_name: name the stapled app build-app.sh made."
facts=$(node $here/release.js facts "$app") || stop "$facts"
IFS=$'\t' read -r version build channel zip_name <<<"$facts"

# 3. The zip beside the app, made after stapling: only a stapled app has Contents/CodeResources.
zip=${app:h}/$zip_name
[[ -f $zip ]] || stop "There is no $zip_name beside the app. Make it again first."
zipinfo -1 "$zip" 2>/dev/null | grep -Fqx "$app_name/Contents/CodeResources" || stop "That zip was made before the app was stapled. Make it again first."

# 4. The source zip, when it is given, is the one the vendor pins name.
if [[ -n $source_zip ]]; then
  want_source=$(node $here/vendor.js source-name) || stop "The vendor pins could not be read, so the source zip's name is not known."
  [[ -f $source_zip && ${source_zip:t} == $want_source ]] || stop "--source is not $want_source, the GPL source zip of this build's vendor pins."
fi

# 5. An earlier release here that did not finish.
unfinished=$releases/unfinished-release.txt
appcast=$releases/appcast.xml
before=$releases/appcast.xml.before
if [[ -e $unfinished ]]; then
  stop "An earlier release here did not finish ($(<$unfinished)). Put the folder right first: take that release's zip and deltas out, put appcast.xml.before back as appcast.xml, or remove appcast.xml when there is no appcast.xml.before, then remove unfinished-release.txt."
fi

# 6. Whether this is the first release, as --first-release says, and the feed's newest build before it.
if [[ -e $appcast ]]; then
  (( first_release )) && stop "--first-release was said, but $releases already has an appcast."
  newest=$(node $here/release.js newest "$appcast") || stop "${newest:-The appcast in the releases folder cannot be read.}"
  after_words="after build $newest"
  newest_line="The feed's newest build before this release was $newest."
else
  (( first_release )) || stop "There is no appcast in $releases. If this is the first release, say --first-release."
  after_words="the first release"
  newest_line="There was no feed before this release."
fi

# 7. Whether this version and build may go into the feed.
node $here/release.js may "$appcast" "$version" "$build" "$channel" "$zip_name" || exit 1

# 8. Sparkle's archive is the pinned one.
node $here/sparkle.js check "$sparkle" || exit 1

channel_args=() channel_words=
if [[ $channel == beta ]]; then
  channel_args=(--channel beta)
  channel_words="--channel beta "
fi

if (( want_print )); then
  say "A release of BRIMM Video Studio $version, build $build, on the $channel channel, $after_words. --print makes no folder and starts nothing."
  say ""
  say "It would:"
  say "  1. Check the app's ticket: xcrun stapler validate \"$app\""
  say "  2. Unpack Sparkle's archive into a temporary folder, once its SHA-256 is the pin's."
  say "  3. Read the update key's public half from the login keychain with generate_keys -p, and stop unless it is the app's own."
  say "  4. Make $releases if it is not there, keep a copy of appcast.xml as appcast.xml.before, then write unfinished-release.txt, and copy $zip_name in."
  say "  5. Write the signed appcast, keeping every earlier release in it: generate_appcast --download-url-prefix $releases_url --maximum-versions 0 ${channel_words}-o \"$appcast\" \"$releases\""
  say "  6. Check the appcast as Studio reads it, and that each file it names is in the folder."
  say "  7. Take unfinished-release.txt and appcast.xml.before away."
  say "  8. Say the feed's newest build before this release, to be checked against the live feed before the appcast is put."
  say "  9. Print the commands that publish the release, which are a by-hand step."
  say ""
  say "Nothing was done."
  exit 0
fi

# The real run.
xcrun stapler validate "$app" || stop "The app is not stapled, so no Mac would open the update. Staple it and make the zip again first."

work=$(mktemp -d "${TMPDIR:-/tmp}/studio-release.XXXXXX") || stop "The temporary folder could not be made."
trap 'rm -rf $work' EXIT
mkdir $work/sparkle || stop "The temporary folder could not be made."
unpack_sparkle "$sparkle" "$work/sparkle"

# Only the public half is read, and nothing generate_keys prints is shown unless it is one.
key=$("$work/sparkle/bin/generate_keys" -p 2>/dev/null)
[[ $key =~ '^[A-Za-z0-9+/]{43}=$' ]] || key=
[[ -n $key ]] || stop "The login keychain did not give the update key's public half, so nothing was written."
app_key=$(plutil -extract SUPublicEDKey raw -o - "$app/Contents/Info.plist" 2>/dev/null)
[[ $key == $app_key ]] || stop "This build carries another update key than the one in your login keychain, so no Mac would take the update. Nothing was written."

mkdir -p "$releases" || stop "$releases could not be made."
# The appcast is kept first, by a copy renamed into place, so that unfinished-release.txt is only ever written beside a whole
# appcast.xml.before, and appcast.xml.before is there exactly when there was an appcast.
if [[ -f $appcast ]]; then
  if ! { cp "$appcast" "$before.part" && mv -f "$before.part" "$before" }; then
    rm -f "$before.part"
    stop "appcast.xml could not be kept as appcast.xml.before, so nothing was written. Nothing is to be published."
  fi
fi
print -r -- "$version" > "$unfinished" || stop "unfinished-release.txt could not be written, so nothing more was done."

# Says why, then that nothing is to be published, and ends with 1. The folder is left as it is, for unfinished-release.txt to explain.
unfinished_stop() {
  say "$1"
  stop "Nothing is to be published. The releases folder is as it was left: unfinished-release.txt says how to put it right."
}

cp "$zip" "$releases/$zip_name" || unfinished_stop "$zip_name could not be copied into the releases folder."
"$work/sparkle/bin/generate_appcast" --download-url-prefix "$releases_url" --maximum-versions 0 "${channel_args[@]}" -o "$appcast" "$releases" ||
  unfinished_stop "generate_appcast did not finish: what it said is above."

# What a release.js command that did not pass said: its refusal on stdout, or else its fault on stderr, or else that the appcast could
# not be checked.
not_checked() {
  local why=$1
  [[ -n $why ]] || why=$(<$work/release-js-said)
  unfinished_stop "${why:-The appcast could not be checked.}"
}
checked=$(node $here/release.js check "$appcast" "$before" "$version" "$build" "$channel" "$zip_name" 2>$work/release-js-said) || not_checked "$checked"
listed=$(node $here/release.js enclosures "$appcast" "$build" 2>$work/release-js-said) || not_checked "$listed"
# Each line is a file's name and its url as the appcast has it, a tab between.
listed_lines=("${(@f)listed}")
listed_lines=(${listed_lines:#})
names_list=() urls_list=()
for line in "${listed_lines[@]}"; do
  names_list+=("${line%%$'\t'*}")
  urls_list+=("${line#*$'\t'}")
done
for name in "${names_list[@]}"; do
  [[ -f $releases/$name ]] || unfinished_stop "The appcast names $name, which is not in the releases folder."
done

rm -f "$unfinished" "$before" "$before.part" || stop "The release is made, but unfinished-release.txt and appcast.xml.before could not be taken away."

say "Made $appcast for BRIMM Video Studio $version, build $build, on the $channel channel."
say ""
say "Publishing is a by-hand step, on Jason's yes. In this order, each only when the line before it answered:"
for (( i = 1; i <= ${#names_list}; i++ )); do
  name=${names_list[i]}
  type=application/octet-stream
  [[ $name == $zip_name ]] && type=application/zip
  say "cf r2 objects put \"releases/$name\" --bucket-name $bucket --file \"$releases/$name\" --content-type $type"
  say "curl -sI \"${urls_list[i]}\""
done
if [[ -n $source_zip ]]; then
  say "cf r2 objects put \"source/${source_zip:t}\" --bucket-name $bucket --file \"$source_zip\" --content-type application/zip"
  say "curl -sI \"$source_url${source_zip:t}\""
fi
say "$newest_line"
say "Check that the live feed says the same before putting the appcast: curl -s $feed"
say "Put the appcast only when each line above answered 200:"
say "cf r2 objects put appcast.xml --bucket-name $bucket --file \"$appcast\" --content-type application/xml"
say "curl -sI $feed"
exit 0
