# Shared by build-vendor.sh and build-app.sh (Phase 6), and fetch-sparkle.sh (Phase 7). Sourced, never run: it defines functions and
# does nothing else.
# It names `security` and the other programs it calls by their bare names, so a test can put a stand-in first on PATH.

say() { print -r -- "$@" }

# Says its words and ends the script with 1.
stop() {
  print -r -- "$@"
  exit 1
}

# The SHA-256 of a file: the first 64 characters of what shasum prints.
sha256_of() { shasum -a 256 "$1" | cut -c1-64 }

# Ends the script with 1, before anything is written, when a folder given is, or is inside: a folder the launch agent watches
# (com.thebrimm.unedited's WatchPaths, read with plutil, which only reads); the default drop folder; the cloud storage folder; or a
# Dropbox folder in the home folder. Folders are compared by their real paths, with the letter case folded, so a link into one of
# them is caught. It reads only $HOME.
refuse_watched() {
  local home=${HOME:A} plist=$HOME/Library/LaunchAgents/com.thebrimm.unedited.plist n=0 entry folder watched hit
  local -a guarded
  guarded=("$HOME/BRIMM Video Work/Drop" "$HOME/Library/CloudStorage")
  if [[ -f $plist ]]; then
    while entry=$(plutil -extract WatchPaths.$n raw -o - "$plist" 2>/dev/null); do
      [[ -n $entry ]] && guarded+=("$entry")
      (( n++ ))
    done
  fi
  for folder in "$@"; do
    folder=${(L)folder:A}
    hit=0
    for watched in "${guarded[@]}"; do
      watched=${(L)watched:A}
      if [[ $folder == $watched || $folder == $watched/* ]]; then hit=1; fi
    done
    if [[ $folder == ${(L)home}/dropbox* ]]; then hit=1; fi
    (( hit )) && stop "That folder is watched or is in Dropbox, and a build never writes there."
  done
  return 0
}

# The one Developer ID Application identity in the keychain, found by name as tool/move-app/build-app.sh finds it, so that nothing
# secret is in any file. Sets `identity` (its name, for the words) and `identity_hash` (the certificate's SHA-1, the 40 hexadecimal
# characters before the name), or stops. codesign is given the hash: after a renewal the expired certificate stays in the keychain
# under the same name, and codesign calls the name ambiguous. The hash is a fingerprint, not a secret.
find_identity() {
  local -a found words
  found=("${(@f)$(security find-identity -v -p codesigning | grep 'Developer ID Application')}")
  found=(${found:#})
  if (( ${#found} != 1 )); then
    stop "Signing needs exactly one Developer ID Application identity in the keychain, and this Mac found ${#found} Developer ID Application identities."
  fi
  identity=${found[1]#*\"}
  identity=${identity%\"*}
  words=(${=found[1]})
  identity_hash=${words[2]-}
  [[ $identity_hash =~ '^[0-9A-Fa-f]{40}$' ]] || stop "The Developer ID Application identity's line does not start with its SHA-1, so it cannot be named for codesign."
}

# Says, for each program given, every library it loads that is not macOS's own (anything outside /usr/lib/ and /System/), and
# returns 1 when there is one. It returns 1 too when otool fails or lists no library, since then nothing has been checked.
only_system() {
  local program lib listed bad=0 n
  for program in "$@"; do
    if ! listed=$(otool -L "$program"); then
      say "  otool could not read ${program:t}, so what it loads is not known."
      bad=1
      continue
    fi
    n=0
    for lib in "${(@f)$(print -r -- "$listed" | tail -n +2 | sed -E 's/^[[:space:]]+//; s/ \(compatibility.*$//')}"; do
      [[ -n $lib ]] || continue
      (( n++ ))
      if [[ $lib != /usr/lib/* && $lib != /System/* ]]; then
        say "  ${program:t} loads $lib, which is not one of macOS's own libraries."
        bad=1
      fi
    done
    if (( n == 0 )); then
      say "  otool lists no library for ${program:t}, so what it loads is not known."
      bad=1
    fi
  done
  return $bad
}

# The oldest macOS a program says it runs on (otool -l's LC_BUILD_VERSION, minos).
min_macos() { otool -l "$1" | awk '/LC_BUILD_VERSION/ { f = 1 } f && $1 == "minos" { print $2; exit }' }

# Whether a file is a program or library of Apple silicon's (Mach-O), as `file` says.
is_macho() { [[ $(file -b "$1") == Mach-O* ]] }

# Unpacks Sparkle's archive into a folder that is there, but only once sparkle.js says the archive is the pinned one, and stops unless
# the framework and the two programs the release needs came out of it. The archive has no folder of its own at its top, so its parts
# land in the folder itself. sparkle.js is found by `here`, which each script that sources this file sets to its own folder first.
unpack_sparkle() {
  local archive=$1 folder=$2
  node "$here/sparkle.js" check "$archive" || exit 1
  tar -xJf "$archive" -C "$folder" || stop "Sparkle's archive could not be unpacked."
  [[ -f $folder/Sparkle.framework/Versions/B/Sparkle && -f $folder/bin/generate_appcast && -f $folder/bin/generate_keys ]] ||
    stop "Sparkle's archive does not hold Sparkle.framework, generate_appcast and generate_keys, so it is not used."
}
