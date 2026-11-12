#!/bin/zsh
# Fetches Sparkle's pinned archive (sparkle.pin.json) and unpacks a copy of it (Phase 7). Run on a Mac:
#   zsh tool/studio-app/fetch-sparkle.sh [--out <folder>] [--print]
#   --out     the folder to fetch and unpack into. Without it, ~/Library/Caches/brimm-studio-app/sparkle.
#   --print   says what would be fetched and where. It changes nothing, fetches nothing and makes no folder.
# It leaves <folder>/Sparkle-<version>.tar.xz and the unpacked <folder>/Sparkle-<version>/. What is fetched is data until its SHA-256
# is the pin's: one that is not is set aside (.rejected) and never unpacked. An archive already there with the pin's SHA-256 is kept
# and not fetched again, and is checked again before each unpacking. <folder> is never a watched folder, a drop folder or Dropbox.
set -u
here=${0:A:h}
source $here/common.zsh

usage() {
  say "Say, if you like, where to fetch Sparkle into, and whether only to print: [--out <folder>] [--print]."
  exit 2
}

out=$HOME/Library/Caches/brimm-studio-app/sparkle
want_print=0
while (( $# )); do
  case $1 in
    --out) (( $# >= 2 )) || usage; out=$2; shift 2 ;;
    --print) want_print=1; shift ;;
    *) usage ;;
  esac
done
[[ $out == /* ]] || out=$PWD/$out
out=${out%/}
refuse_watched "$out"

# The pin, one line: version, address, the address's last part, SHA-256. node reads the pin file.
pin_text=$(node $here/sparkle.js pin) || stop "Sparkle's pin could not be read: what sparkle.js said is above."
IFS=$'\t' read -r version url file sha <<<"$pin_text"
archive=$out/$file
unpacked=$out/Sparkle-$version

if (( want_print )); then
  say "Sparkle for BRIMM Video Studio's build. --print changes nothing, fetches nothing and makes no folder."
  say ""
  say "It would fetch Sparkle $version from $url into $archive, unless it is there already with the pinned SHA-256, $sha."
  say "It would check it against that SHA-256, and unpack it into $unpacked."
  say ""
  say "Nothing was changed."
  exit 0
fi

mkdir -p "$out" || stop "$out could not be made."
if [[ -f $archive && $(sha256_of "$archive") == $sha ]]; then
  say "Sparkle $version: already fetched."
else
  say "Fetching Sparkle $version from $url"
  if ! curl --fail --location --proto '=https' --proto-redir '=https' --silent --show-error --output "$archive.part" "$url"; then
    rm -f "$archive.part"
    stop "Sparkle could not be fetched (what curl said is above), so nothing was unpacked."
  fi
  mv "$archive.part" "$archive" || stop "Sparkle's download could not be put in $out."
  if [[ $(sha256_of "$archive") != $sha ]]; then
    mv "$archive" "$archive.rejected"
    stop "Sparkle's download is not the pinned one, so it was set aside and nothing was unpacked."
  fi
  say "Sparkle $version: matches its pin."
fi

rm -rf "$unpacked"
mkdir "$unpacked" || stop "$unpacked could not be made."
unpack_sparkle "$archive" "$unpacked"
say "Made $unpacked"
