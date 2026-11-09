#!/bin/zsh
# S1 (spike only; see README.md): a static ffmpeg and ffprobe for Apple silicon and macOS 13 or later, from pinned sources, with
# VideoToolbox, AudioToolbox, scale_vt and libx264, checked with Studio's own code. Run on the Mac Studio as jasonogden:
#   zsh build-ffmpeg.sh --print    what it would do. It changes nothing and fetches nothing.
#   zsh build-ffmpeg.sh --fetch    fetches the three sources into App spikes/downloads and checks each against its pin.
#   zsh build-ffmpeg.sh --build    builds from what --fetch fetched, and fetches nothing: pkgconf for the build alone, x264 as a
#                                  static library, then ffmpeg and ffprobe, and the matching source zip. It ends by checking that
#                                  the two programs load only macOS's own libraries and say macOS 13.0.
#   zsh build-ffmpeg.sh --check    asks the new ffmpeg for everything Studio's code uses of it, with Studio's own hasFilters and
#                                  hasHwaccel, and makes a two-second video with Studio's own settings.
#   zsh build-ffmpeg.sh --hdr [clip]   makes the working copy of the spike clip twice with Studio's own job, once with Homebrew's
#                                  ffmpeg and once with the new one, and compares them. The clip is /Users/Shared/BRIMM Studio
#                                  spikes/Spike clip.mov unless another is given.
# What is kept goes in ~/BRIMM Video Work/App spikes/s1-ffmpeg; the compiling happens in ~/Library/Caches/brimm-studio-spikes/s1.
set -u
source ${0:A:h}/common.zsh

S1=$WORK/s1-ffmpeg
OUT=$S1/out
LOGS=$S1/logs
B=$BUILD_ROOT/s1
PREFIX=$B/prefix
TOOLS=$B/tools
MIN=-mmacosx-version-min=13.0
FFMPEG_VERSION=9.0.2
ZIP_NAME=ffmpeg-$FFMPEG_VERSION-x264-${X264_COMMIT[1,7]}-source
NODE=${commands[node]:-/opt/homebrew/bin/node}
HOMEBREW_FFMPEG=/opt/homebrew/bin/ffmpeg
HOMEBREW_FFPROBE=/opt/homebrew/bin/ffprobe

# x264 as a static library only: no program of its own, no OpenCL, and none of the optional libraries it can read input with.
X264_CONFIGURE=(
  --prefix=$PREFIX --enable-static --disable-cli --enable-pic --disable-opencl --disable-lsmash --disable-swscale --disable-ffms
  --extra-cflags=$MIN --extra-ldflags=$MIN
)
# ffmpeg with nothing it finds by itself (--disable-autodetect), and then by name: VideoToolbox (the hardware decoder and scale_vt,
# which the HDR working copy needs), AudioToolbox, zlib and bzip2 (macOS's own, in /usr/lib), and libx264. GPL, for libx264. No
# network, and no devices but lavfi (test pictures and sounds, for --check). Static, with no ffplay, documents or debug symbols.
FFMPEG_CONFIGURE=(
  --prefix=$PREFIX --cc=/usr/bin/clang --pkg-config=$TOOLS/bin/pkgconf --pkg-config-flags=--static
  "--extra-cflags=$MIN -I$PREFIX/include" "--extra-ldflags=$MIN -L$PREFIX/lib"
  --enable-gpl --disable-autodetect
  --enable-videotoolbox --enable-audiotoolbox --enable-zlib --enable-bzlib --enable-libx264
  --enable-static --disable-shared --disable-doc --disable-ffplay --disable-debug
  --disable-network --disable-devices --enable-indev=lavfi
)

usage() {
  say "Say what to do: --print, --fetch, --build, --check or --hdr."
  exit 2
}

# Runs one step of the build in a folder, its output into a log. On failure it shows the end of the log and stops.
run_logged() {
  local log=$1 dir=$2
  shift 2
  if ! ( cd "$dir" && "$@" ) >>"$log" 2>&1; then
    say "This step failed: $*"
    say "The end of its log, $log:"
    tail -n 25 "$log"
    stop "Stopped. Nothing outside $B, $LOGS and $OUT was changed."
  fi
}

print_plan() {
  say "S1: a static ffmpeg and ffprobe (spike only). --print changes nothing and fetches nothing."
  say ""
  say "--fetch fetches these into $DOWNLOADS, and checks each against its pin:"
  show_pin ffmpeg
  show_pin x264
  show_pin pkgconf
  say ""
  say "--build fetches nothing. It compiles in $B, with PATH=$SYSTEM_PATH and no flags or search paths from elsewhere:"
  say "  1. pkgconf 2.3.0, for the build alone (it is in no program that is made): ./configure --prefix=$TOOLS --disable-shared"
  say "  2. x264 at ${X264_COMMIT[1,7]}, as a static library: ./configure ${X264_CONFIGURE[*]}"
  say "  3. ffmpeg $FFMPEG_VERSION and ffprobe, with PKG_CONFIG_PATH and PKG_CONFIG_LIBDIR set to $PREFIX/lib/pkgconfig alone:"
  say "     ./configure ${FFMPEG_CONFIGURE[*]}"
  say "  4. ffmpeg and ffprobe copied into $OUT"
  say "  5. the source zip, $OUT/$ZIP_NAME.zip: the two source archives, these scripts and the configure lines"
  say "  6. the check: otool -L must name only /usr/lib/ and /System/ for both programs, and otool -l macOS 13.0"
  say ""
  say "--check runs $SPIKE/s1-check.mjs with $NODE: Studio's hasFilters and hasHwaccel, the encoders, formats and decoders, and a"
  say "  two-second test video made with Studio's settings, in $OUT/check."
  say "--hdr runs Studio's makeWorkCopy on $CLIP, with $HOMEBREW_FFMPEG and with the new ffmpeg, in $OUT/hdr."
  say ""
  say "Here:"
  local p
  for p in /usr/bin/clang /usr/bin/make /usr/bin/otool $NODE $HOMEBREW_FFMPEG $HOMEBREW_FFPROBE; do
    if [[ -x $p ]]; then say "  $p: here"; else say "  $p: not here"; fi
  done
  if [[ -f $CLIP ]]; then say "  the spike clip: here"; else say "  the spike clip: not in $SHARED yet"; fi
  refuse_watched $WORK $BUILD_ROOT
  refuse_spaces
  say "  None of these folders is in Dropbox or inside a folder the import watches."
  say ""
  say "Nothing was changed."
}

do_fetch() {
  refuse_watched $WORK
  local n unpinned=0
  for n in ffmpeg x264 pkgconf; do
    fetch $n || unpinned=1
  done
  (( unpinned )) && exit 3
  say "All three match their pins. Nothing was unpacked."
}

do_build() {
  refuse_watched $WORK $BUILD_ROOT
  refuse_spaces
  local n
  for n in ffmpeg x264 pkgconf; do verified $n; done
  [[ -x /usr/bin/clang && -x /usr/bin/make ]] || stop "Stopped: building needs Xcode's command line tools (clang and make), and they are not here."
  local jobs=$(sysctl -n hw.ncpu)
  rm -rf $B
  mkdir -p $B/src $PREFIX $TOOLS $OUT $LOGS || stop "Stopped: the build's folders could not be made."
  rm -f $OUT/ffmpeg $OUT/ffprobe $LOGS/pkgconf.log $LOGS/x264.log $LOGS/ffmpeg.log
  # A clean environment: macOS's own folders, and no flags or search paths from elsewhere, so that nothing of Homebrew's is found.
  export PATH=$SYSTEM_PATH MACOSX_DEPLOYMENT_TARGET=13.0
  unset CPATH C_INCLUDE_PATH CPLUS_INCLUDE_PATH LIBRARY_PATH CFLAGS CPPFLAGS CXXFLAGS LDFLAGS PKG_CONFIG PKG_CONFIG_PATH PKG_CONFIG_LIBDIR PKG_CONFIG_SYSROOT_DIR
  say "Building in $B, with $jobs jobs at a time. It takes about ten minutes; each step's log is in $LOGS."

  tar -xf $DOWNLOADS/${PIN_FILE[pkgconf]} -C $B/src || stop "Stopped: pkgconf's archive could not be unpacked."
  local pk=$B/src/$(top_of $DOWNLOADS/${PIN_FILE[pkgconf]})
  run_logged $LOGS/pkgconf.log $pk ./configure --prefix=$TOOLS --disable-shared
  run_logged $LOGS/pkgconf.log $pk make -j$jobs
  run_logged $LOGS/pkgconf.log $pk make install
  [[ -x $TOOLS/bin/pkgconf ]] || stop "Stopped: pkgconf was built, but $TOOLS/bin/pkgconf is not there."
  say "pkgconf 2.3.0: built, for the build alone."

  tar -xf $DOWNLOADS/${PIN_FILE[x264]} -C $B/src || stop "Stopped: x264's archive could not be unpacked."
  local xd=$B/src/$(top_of $DOWNLOADS/${PIN_FILE[x264]})
  run_logged $LOGS/x264.log $xd ./configure "${X264_CONFIGURE[@]}"
  run_logged $LOGS/x264.log $xd make -j$jobs
  run_logged $LOGS/x264.log $xd make install-lib-static
  [[ -f $PREFIX/lib/libx264.a && -f $PREFIX/lib/pkgconfig/x264.pc ]] || stop "Stopped: x264 was built, but its library or its .pc file is not in $PREFIX/lib."
  say "x264 at ${X264_COMMIT[1,7]}: built, as a static library."

  tar -xf $DOWNLOADS/${PIN_FILE[ffmpeg]} -C $B/src || stop "Stopped: ffmpeg's archive could not be unpacked."
  local fd=$B/src/$(top_of $DOWNLOADS/${PIN_FILE[ffmpeg]})
  run_logged $LOGS/ffmpeg.log $fd env PKG_CONFIG_PATH=$PREFIX/lib/pkgconfig PKG_CONFIG_LIBDIR=$PREFIX/lib/pkgconfig ./configure "${FFMPEG_CONFIGURE[@]}"
  run_logged $LOGS/ffmpeg.log $fd make -j$jobs
  run_logged $LOGS/ffmpeg.log $fd make install
  cp $PREFIX/bin/ffmpeg $PREFIX/bin/ffprobe $OUT/ || stop "Stopped: ffmpeg was built, but its programs could not be copied into $OUT."
  say "ffmpeg $FFMPEG_VERSION and ffprobe: built, and copied into $OUT."

  make_source_zip
  say ""
  say "What they load, and where they run:"
  only_system $OUT/ffmpeg $OUT/ffprobe || stop "Stopped: S1 fails as it is built, since a program it made loads a library that is not macOS's own."
  say "  ffmpeg and ffprobe load only macOS's own libraries: otool -L names only /usr/lib/ and /System/."
  local p
  for p in ffmpeg ffprobe; do say "  $p: $(lipo -archs $OUT/$p), for macOS $(min_macos $OUT/$p) or later."; done
  say "  $($OUT/ffmpeg -hide_banner -version | head -1)"
  say "Made $OUT/ffmpeg"
  say "Made $OUT/ffprobe"
  say "Made $OUT/$ZIP_NAME.zip"
}

# The matching source, for the GPL: both source archives exactly as they were fetched, the scripts that built them, and the lines
# they were configured with.
make_source_zip() {
  local z=$OUT/$ZIP_NAME
  rm -rf $z $z.zip
  mkdir -p $z || stop "Stopped: $z could not be made."
  cp $DOWNLOADS/${PIN_FILE[ffmpeg]} $DOWNLOADS/${PIN_FILE[x264]} $SPIKE/build-ffmpeg.sh $SPIKE/common.zsh $SPIKE/pins.zsh $z/ || stop "Stopped: the source zip's files could not be copied."
  {
    print -r -- "How ffmpeg and ffprobe were built ($(date '+%Y-%m-%d'), for BRIMM Video Studio's Mac app spike)"
    print -r -- ""
    print -r -- "ffmpeg $FFMPEG_VERSION: ${PIN_FILE[ffmpeg]}, from ${PIN_URL[ffmpeg]}, SHA-256 ${PIN_SHA[ffmpeg]}"
    print -r -- "x264 at commit $X264_COMMIT: ${PIN_FILE[x264]}, from ${PIN_URL[x264]}, SHA-256 ${PIN_SHA[x264]}"
    print -r -- "Both are GPL software (ffmpeg built with --enable-gpl; x264 is GPL version 2 or later). build-ffmpeg.sh, common.zsh and"
    print -r -- "pins.zsh are the scripts that built them. pkgconf 2.3.0 was used to build, and is in neither program."
    print -r -- ""
    print -r -- "x264: ./configure ${X264_CONFIGURE[*]}"
    print -r -- "      make, then make install-lib-static"
    print -r -- "ffmpeg: PKG_CONFIG_PATH=<prefix>/lib/pkgconfig PKG_CONFIG_LIBDIR=<prefix>/lib/pkgconfig ./configure ${FFMPEG_CONFIGURE[*]}"
    print -r -- "        make, then make install"
    print -r -- "Built with PATH=$SYSTEM_PATH and MACOSX_DEPLOYMENT_TARGET=13.0, with Apple's clang."
  } > $z/BUILD.txt
  ( cd $OUT && ditto -c -k --keepParent $ZIP_NAME $ZIP_NAME.zip ) || stop "Stopped: the source zip could not be made."
  rm -rf $z
  say "The source zip: made."
}

need_built() {
  [[ -x $OUT/ffmpeg && -x $OUT/ffprobe ]] || stop "Stopped: the new ffmpeg is not built yet. Run --build first."
  [[ -x $NODE ]] || stop "Stopped: node is not here, and Studio's checks run on it."
}

(( $# >= 1 )) || usage
case $1 in
  --print) print_plan ;;
  --fetch) do_fetch ;;
  --build) do_build ;;
  --check)
    need_built
    refuse_watched $OUT
    "$NODE" $SPIKE/s1-check.mjs check --ffmpeg $OUT/ffmpeg --ffprobe $OUT/ffprobe --out $OUT/check
    ;;
  --hdr)
    need_built
    refuse_watched $OUT
    [[ -x $HOMEBREW_FFMPEG && -x $HOMEBREW_FFPROBE ]] || stop "Stopped: Homebrew's ffmpeg is not here to compare with."
    clip=${2:-$CLIP}
    [[ -f $clip ]] || stop "Stopped: the spike clip is not there: $clip"
    "$NODE" $SPIKE/s1-check.mjs hdr --clip "$clip" --ffmpeg $OUT/ffmpeg --ffprobe $OUT/ffprobe --homebrew-ffmpeg $HOMEBREW_FFMPEG --homebrew-ffprobe $HOMEBREW_FFPROBE --out $OUT/hdr
    ;;
  *) usage ;;
esac
