# Shared by the spike scripts that run on the Mac Studio, as jasonogden (spike only; see README.md). Sourced, never run.
# Where everything is; the one way a download is fetched and checked against its pin; the guard that keeps every script out of a
# watched folder; the check that a program loads only macOS's own libraries; and the signing identity, found by name.

SPIKE=${${(%):-%x}:A:h}
REPO=${SPIKE:h:h}
TOOL=$REPO/tool
# What the spikes keep: downloads, logs and what each one makes. On this Mac's own disk, never in Dropbox or a drop folder.
WORK="$HOME/BRIMM Video Work/App spikes"
DOWNLOADS=$WORK/downloads
# Where the sources are compiled: ffmpeg's, x264's and pkgconf's build scripts cannot take a folder whose name has a space in it,
# and WORK has two. Also this Mac's own disk.
BUILD_ROOT=$HOME/Library/Caches/brimm-studio-spikes
# What the spare account reads: both accounts can read it, and only this one writes it.
SHARED="/Users/Shared/BRIMM Studio spikes"
CLIP="$SHARED/Spike clip.mov"
# The transcriber's model, where Studio keeps it (run.js findTools), and its SHA-256 as Hugging Face lists it.
MODEL="$HOME/Library/Application Support/BRIMM Transcribe/ggml-large-v3-turbo.bin"
MODEL_SHA256=1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69
# The folders a build runs with: macOS's own, and none of Homebrew's.
SYSTEM_PATH=/usr/bin:/bin:/usr/sbin:/sbin
# The default drop folder (Phase 3). Never written in, whether or not a launch agent watches it now.
DROP_DEFAULT="$HOME/BRIMM Video Work/Drop"
# S7: the address updates are offered from (Jason, 9 November 2026). This is the one place the host is spelled: every script and
# every command a script prints reads it from here, so changing it here changes it everywhere.
UPDATE_HOST=updates.thebrimminsights.com
# S7: the Cloudflare R2 bucket that holds the updates, behind UPDATE_HOST (Jason, 9 November 2026).
UPDATE_BUCKET=brimm-studio-updates

source $SPIKE/pins.zsh

say() { print -r -- "$@" }
stop() { print -r -- "$@"; exit 1 }

# --- Folders that are never written in ---

# The folders this Mac's import watches: com.thebrimm.unedited's WatchPaths, read from its plist (it only reads). A new file in one
# of them starts the import.
watched_folders() {
  local plist="$HOME/Library/LaunchAgents/com.thebrimm.unedited.plist" n=0 p
  [[ -f $plist ]] || return 0
  while p=$(plutil -extract WatchPaths.$n raw -o - "$plist" 2>/dev/null); do
    print -r -- "$p"
    (( n++ ))
  done
}

# Stops, before anything is written, when one of the folders given is a watched folder or inside one, or inside the default drop
# folder, or inside Dropbox. Links are followed first: ~/Movies and ~/Downloads on the Mac Studio are links into Dropbox.
refuse_watched() {
  local f w
  local -a watched
  watched=("${(@f)$(watched_folders)}" "$DROP_DEFAULT")
  for f in "$@"; do
    for w in "${watched[@]}"; do
      [[ -n $w ]] || continue
      if [[ ${f:A} == ${w:A} || ${f:A} == ${w:A}/* ]]; then
        stop "Stopped: $f is inside $w, a folder the import watches. Nothing was changed."
      fi
    done
    if [[ ${f:A} == $HOME/Library/CloudStorage/* || ${f:A} == $HOME/Dropbox* ]]; then
      stop "Stopped: $f is in Dropbox. Nothing was changed."
    fi
  done
}

# Stops when BUILD_ROOT has a space in its name, which the build scripts cannot take.
refuse_spaces() {
  [[ $BUILD_ROOT != *[[:space:]]* ]] || stop "Stopped: $BUILD_ROOT has a space in its name, and ffmpeg's and x264's build scripts cannot take one. Nothing was changed."
}

# --- Downloads ---

# One line for --print: the file, where it comes from, its size, and its pin.
show_pin() {
  local name=$1
  say "  ${PIN_FILE[$name]}, about ${PIN_SIZE[$name]}, from ${PIN_URL[$name]}"
  if [[ -n ${PIN_SHA[$name]} ]]; then
    say "    SHA-256 ${PIN_SHA[$name]}, read from ${PIN_FROM[$name]-}"
  else
    say "    not pinned yet: --fetch fetches it, prints its SHA-256${PIN_SUMS[$name]:+ beside the one in ${PIN_SUMS[$name]}}${PIN_GITHUB[$name]:+ beside the digest GitHub's API gives for it in ${PIN_GITHUB[$name]}}, and stops"
  fi
  if [[ -f $DOWNLOADS/${PIN_FILE[$name]} ]]; then say "    (fetched already, in $DOWNLOADS)"; fi
}

# The SHA-256 of a file.
sha256_of() { shasum -a 256 "$1" | cut -c1-64 }

# The SHA-256 GitHub's API gives for one file of a release (the file's "digest", which GitHub works out itself when the file is
# uploaded), read from the release's record at the address given; or nothing, when the record has no digest for that file or could
# not be fetched. It is read with grep and awk, which every Mac has: the record's name and digest lines, in order, each file's digest
# coming after its name.
github_digest() {
  local api=$1 file=$2
  curl --fail --location --proto '=https' --proto-redir '=https' --silent --show-error -H 'Accept: application/vnd.github+json' "$api" |
    grep -o -E '"(name|digest)": ?"[^"]*"' |
    awk -v file="$file" -F'"' '$2 == "name" { n = $4 } $2 == "digest" && n == file && $4 ~ /^sha256:[0-9a-f]+$/ { print substr($4, 8); exit }'
}

# Fetches one pinned download into DOWNLOADS, unless it is there already, and checks it against its pin. Returns 0 when it matches.
# A download that is not pinned yet is fetched and its SHA-256 printed, with the maker's own line for it when the maker publishes a
# list, or the digest GitHub's API gives for it when it is a release file on GitHub, and it returns 3: nothing is unpacked, and
# Claude pins it in pins.zsh only after Jason's yes. One that does not match is moved aside (…rejected) and never used, and the
# script stops.
fetch() {
  local name=$1
  local file=$DOWNLOADS/${PIN_FILE[$name]} want=${PIN_SHA[$name]} have sums line digest
  mkdir -p $DOWNLOADS || stop "Stopped: $DOWNLOADS could not be made."
  if [[ ! -f $file ]]; then
    say "Fetching ${PIN_FILE[$name]}, about ${PIN_SIZE[$name]}, from ${PIN_URL[$name]}"
    if ! curl --fail --location --proto '=https' --proto-redir '=https' --silent --show-error --output "$file.part" "${PIN_URL[$name]}"; then
      rm -f "$file.part"
      stop "Stopped: ${PIN_FILE[$name]} could not be fetched (what curl said is above). Nothing else was changed."
    fi
    mv "$file.part" "$file"
  fi
  have=$(sha256_of "$file")
  if [[ -z $want ]]; then
    say "Not pinned yet: $name. ${PIN_FILE[$name]} was fetched from ${PIN_URL[$name]}, and its SHA-256 is"
    say "  $have"
    if [[ -n ${PIN_SUMS[$name]-} ]]; then
      sums=$DOWNLOADS/${PIN_FILE[$name]}.sums.txt
      if curl --fail --location --proto '=https' --proto-redir '=https' --silent --show-error --output "$sums" "${PIN_SUMS[$name]}"; then
        line=$(grep -F "  ${PIN_FILE[$name]}" "$sums" | head -1)
        if [[ -n $line ]]; then
          say "The maker's own list (${PIN_SUMS[$name]}) says"
          say "  ${line%% *}"
          if [[ ${line%% *} == $have ]]; then say "The two are the same."; else say "The two are NOT the same: do not pin it."; fi
        else
          say "The maker's own list (${PIN_SUMS[$name]}) has no line for ${PIN_FILE[$name]}."
        fi
      else
        say "The maker's own list could not be fetched from ${PIN_SUMS[$name]}."
      fi
    fi
    if [[ -n ${PIN_GITHUB[$name]-} ]]; then
      digest=$(github_digest "${PIN_GITHUB[$name]}" "${PIN_FILE[$name]}")
      if [[ -n $digest ]]; then
        say "GitHub's own record of the release (${PIN_GITHUB[$name]}) gives its digest as"
        say "  $digest"
        if [[ $digest == $have ]]; then say "The two are the same."; else say "The two are NOT the same: do not pin it."; fi
      else
        say "GitHub's own record of the release (${PIN_GITHUB[$name]}) gives no digest for ${PIN_FILE[$name]}, or could not be fetched."
      fi
    fi
    say "Nothing was unpacked. Once Jason says yes, Claude writes it into pins.zsh (PIN_SHA[$name]) and runs this again."
    return 3
  fi
  if [[ $have != $want ]]; then
    mv "$file" "$file.rejected"
    stop "Stopped: ${PIN_FILE[$name]} does not match its pin. Its SHA-256 is $have, and the pin says $want. It was moved aside, to $file.rejected, and is not used."
  fi
  say "$name: ${PIN_FILE[$name]} matches its pin."
}

# Whether a download is here and matches its pin, fetching nothing: what a build takes.
verified() {
  local name=$1 file=$DOWNLOADS/${PIN_FILE[$1]}
  [[ -n ${PIN_SHA[$name]} ]] || stop "Stopped: $name is not pinned yet. Run --fetch first."
  [[ -f $file ]] || stop "Stopped: ${PIN_FILE[$name]} is not in $DOWNLOADS. Run --fetch first."
  [[ $(sha256_of "$file") == ${PIN_SHA[$name]} ]] || stop "Stopped: ${PIN_FILE[$name]} in $DOWNLOADS does not match its pin. Delete it and run --fetch again."
}

# The one folder at the top of an archive.
top_of() { tar -tf "$1" | head -1 | cut -d/ -f1 }

# --- Programs that are made ---

# Says, for each program given, any library it loads that is not macOS's own (anything outside /usr/lib/ and /System/). Returns 1
# when there is one.
only_system() {
  local p lib bad=0
  for p in "$@"; do
    for lib in "${(@f)$(otool -L "$p" | tail -n +2 | sed -E 's/^[[:space:]]+//; s/ \(compatibility.*$//')}"; do
      [[ -n $lib ]] || continue
      if [[ $lib != /usr/lib/* && $lib != /System/* ]]; then
        say "  ${p:t} loads $lib, which is not one of macOS's own libraries."
        bad=1
      fi
    done
  done
  return $bad
}

# The oldest macOS a program says it runs on (otool -l's LC_BUILD_VERSION minos).
min_macos() { otool -l "$1" | awk '/LC_BUILD_VERSION/ { f = 1 } f && $1 == "minos" { print $2; exit }' }

# Whether a file is a program or library of Apple silicon's (Mach-O), as `file` says.
is_macho() { [[ $(file -b "$1") == Mach-O* ]] }

# --- Signing ---

# The one Developer ID Application identity in the keychain, found by name, as tool/move-app/build-app.sh finds it: nothing secret is
# in any file. Sets `identity`, or stops.
find_identity() {
  local -a found
  found=("${(@f)$(security find-identity -v -p codesigning | grep 'Developer ID Application')}")
  found=(${found:#})
  if (( ${#found} != 1 )); then
    stop "Stopped: signing needs exactly one Developer ID Application identity in the keychain, and this Mac found ${#found}."
  fi
  identity=${found[1]#*\"}
  identity=${identity%\"*}
}

# Signs one program, with the hardened runtime and a secure timestamp (codesign --timestamp asks Apple's timestamp server for the
# time, which notarizing needs; that is all it sends), and with the entitlements file given, if one is.
sign_one() {
  local file=$1 entitlements=${2-}
  if [[ -n $entitlements ]]; then
    codesign --force --options runtime --timestamp --entitlements "$entitlements" --sign "$identity" "$file" || stop "Stopped: signing $file failed."
  else
    codesign --force --options runtime --timestamp --sign "$identity" "$file" || stop "Stopped: signing $file failed."
  fi
}
