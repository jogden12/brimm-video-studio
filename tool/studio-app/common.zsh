# Shared by build-vendor.sh and build-app.sh (Phase 6). Sourced, never run: it defines functions and does nothing else.
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
# secret is in any file. Sets `identity`, or stops.
find_identity() {
  local -a found
  found=("${(@f)$(security find-identity -v -p codesigning | grep 'Developer ID Application')}")
  found=(${found:#})
  if (( ${#found} != 1 )); then
    stop "Signing needs exactly one Developer ID Application identity in the keychain, and this Mac found ${#found} Developer ID Application identities."
  fi
  identity=${found[1]#*\"}
  identity=${identity%\"*}
}

# Says, for each program given, every library it loads that is not macOS's own (anything outside /usr/lib/ and /System/), and
# returns 1 when there is one.
only_system() {
  local program lib bad=0
  for program in "$@"; do
    for lib in "${(@f)$(otool -L "$program" | tail -n +2 | sed -E 's/^[[:space:]]+//; s/ \(compatibility.*$//')}"; do
      [[ -n $lib ]] || continue
      if [[ $lib != /usr/lib/* && $lib != /System/* ]]; then
        say "  ${program:t} loads $lib, which is not one of macOS's own libraries."
        bad=1
      fi
    done
  done
  return $bad
}

# The oldest macOS a program says it runs on (otool -l's LC_BUILD_VERSION, minos).
min_macos() { otool -l "$1" | awk '/LC_BUILD_VERSION/ { f = 1 } f && $1 == "minos" { print $2; exit }' }

# Whether a file is a program or library of Apple silicon's (Mach-O), as `file` says.
is_macho() { [[ $(file -b "$1") == Mach-O* ]] }
