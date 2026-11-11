#!/bin/zsh
# Makes the programs BRIMM Video Studio.app carries that are not its own, once, into a sealed folder (Phase 6). Run on a Mac:
#   zsh tool/studio-app/build-vendor.sh --out <folder> [--print | --fetch]
#   --print   says what would be fetched and built. It changes nothing, fetches nothing and makes no folder.
#   --fetch   fetches each pinned download that is not already in <folder>/downloads with its pinned SHA-256, checks it, and stops.
#   (neither) fetches, then builds: pkgconf for the build alone, x264, ffmpeg and ffprobe, whisper-cli, and node's own files, all
#             into <folder>/vendor, with their licences, a seal (manifest.json) and, in <folder>/source, the GPL source zip.
# What is fetched is data until its SHA-256 is the pin's (vendor.pin.json). A whole run downloads about 170 MB and compiles for about
# fifteen minutes, so it is a by-hand step. <folder> is on this Mac's own disk: never a watched folder, a drop folder or Dropbox,
# and its path has no space, which ffmpeg's and x264's configure cannot take. It is not in the home folder either: ffmpeg keeps its
# configure line, paths and all, inside itself, so the path must name no person (/Users/Shared/brimm-studio-vendor will do). It is
# empty, or one an earlier run made: nothing is deleted in a folder this script did not make. Nothing is signed here: the app's
# build signs.
set -u
HERE=${0:A:h}
source $HERE/common.zsh

SYSTEM_PATH=/usr/bin:/bin:/usr/sbin:/sbin
MIN=-mmacosx-version-min=13.0

usage() {
  say "Say where to build and, if you like, what to do: --out <folder> [--print | --fetch]."
  exit 2
}

out=
want_print=0
want_fetch=0
while (( $# )); do
  case $1 in
    --out) (( $# >= 2 )) || usage; out=$2; shift 2 ;;
    --print) want_print=1; shift ;;
    --fetch) want_fetch=1; shift ;;
    *) usage ;;
  esac
done
[[ -n $out ]] && (( ! (want_print && want_fetch) )) || usage
[[ $out == /* ]] || out=$PWD/$out
out=${out%/}
if [[ $out == *[[:space:]]* ]]; then
  say "ffmpeg's and x264's configure cannot take a path with a space: pick a folder without one."
  exit 2
fi
refuse_watched "$out"
if [[ ${(L)out:A} == ${(L)HOME:A} || ${(L)out:A} == ${(L)HOME:A}/* ]]; then
  say "That folder is inside your home folder, and its path is written into ffmpeg and into the source zip, which are published: pick one that names no person, such as /Users/Shared/brimm-studio-vendor."
  exit 2
fi
# A folder that is there and holds something, but none of what this script makes, is someone else's: nothing in it is touched.
if [[ -d $out ]]; then
  inside=("$out"/*(DN))
  if (( ${#inside} )) && [[ ! -e $out/downloads && ! -e $out/build && ! -e $out/vendor && ! -e $out/source ]]; then
    say "That folder is not empty and is not one this script made, so nothing in it is touched: pick an empty folder, or one from an earlier run."
    exit 2
  fi
fi

# The pins, one line each: name, version, address, the address's last part, SHA-256. node reads the pin file.
pins_text=$(node $HERE/vendor.js pins) || stop "The pins could not be read: what vendor.js said is above."
typeset -A PIN_VERSION PIN_URL PIN_FILE PIN_SHA
typeset -a PIN_NAMES
while IFS=$'\t' read -r name version url file sha; do
  [[ -n $name ]] || continue
  PIN_NAMES+=($name)
  PIN_VERSION[$name]=$version PIN_URL[$name]=$url PIN_FILE[$name]=$file PIN_SHA[$name]=$sha
done <<<"$pins_text"
source_name=$(node $HERE/vendor.js source-name) || stop "The source zip's name could not be made: what vendor.js said is above."

downloads=$out/downloads
b=$out/build
vendor=$out/vendor
prefix=$b/prefix
tools=$b/tools
logs=$b/logs

# x264 as a static library only: no program of its own, no OpenCL, and none of the optional libraries it can read input with.
X264_CONFIGURE=(
  --prefix=$prefix --enable-static --disable-cli --enable-pic --disable-opencl --disable-lsmash --disable-swscale --disable-ffms
  --extra-cflags=$MIN --extra-ldflags=$MIN
)
# ffmpeg with nothing it finds by itself (--disable-autodetect), and then by name: VideoToolbox (the hardware decoder and scale_vt,
# which the HDR working copy needs), AudioToolbox, zlib and bzip2 (macOS's own, in /usr/lib), and libx264. GPL, for libx264. No
# network, and no devices but lavfi (test pictures and sounds). Static, with no ffplay, documents or debug symbols.
FFMPEG_CONFIGURE=(
  --prefix=$prefix --cc=/usr/bin/clang --pkg-config=$tools/bin/pkgconf --pkg-config-flags=--static
  "--extra-cflags=$MIN -I$prefix/include" "--extra-ldflags=$MIN -L$prefix/lib"
  --enable-gpl --disable-autodetect
  --enable-videotoolbox --enable-audiotoolbox --enable-zlib --enable-bzlib --enable-libx264
  --enable-static --disable-shared --disable-doc --disable-ffplay --disable-debug
  --disable-network --disable-devices --enable-indev=lavfi
)
# whisper.cpp and its own copy of ggml as static libraries, and the whisper-cli program alone. Metal, with its library embedded in the
# program (the Metal shaders' source goes inside it and is compiled when it first runs, so no Xcode is needed to build it and no file
# beside it to run it); Accelerate for BLAS, as Homebrew's ggml has it; no OpenMP, which only Homebrew's libomp would give; the CPU
# code for any Apple silicon, not only this Mac's chip; nothing found in /opt/homebrew or /usr/local.
CMAKE_ARGS=(
  -DCMAKE_BUILD_TYPE=Release -DCMAKE_OSX_ARCHITECTURES=arm64 -DCMAKE_OSX_DEPLOYMENT_TARGET=13.0
  -DCMAKE_C_COMPILER=/usr/bin/clang -DCMAKE_CXX_COMPILER=/usr/bin/clang++ "-DCMAKE_IGNORE_PREFIX_PATH=/opt/homebrew;/usr/local"
  -DBUILD_SHARED_LIBS=OFF
  -DWHISPER_BUILD_EXAMPLES=ON -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_SERVER=OFF
  -DWHISPER_SDL2=OFF -DWHISPER_CURL=OFF -DWHISPER_COREML=OFF -DWHISPER_OPENVINO=OFF -DWHISPER_FFMPEG=OFF
  -DGGML_METAL=ON -DGGML_METAL_EMBED_LIBRARY=ON -DGGML_BLAS=ON -DGGML_OPENMP=OFF -DGGML_NATIVE=OFF -DGGML_BACKEND_DL=OFF -DGGML_CCACHE=OFF
)

print_plan() {
  say "BRIMM Video Studio's vendored programs. --print changes nothing, fetches nothing and makes no folder."
  say ""
  say "It would fetch into $downloads, and check each against its pinned SHA-256:"
  local name
  for name in $PIN_NAMES; do say "  $name ${PIN_VERSION[$name]} ${PIN_URL[$name]}"; done
  say ""
  say "It would then build in $b, with PATH=$SYSTEM_PATH and MACOSX_DEPLOYMENT_TARGET=13.0:"
  say "  pkgconf, for the build alone"
  say "  x264, as a static library: ./configure ${X264_CONFIGURE[*]}"
  say "  ffmpeg and ffprobe: ./configure ${FFMPEG_CONFIGURE[*]}"
  say "  whisper-cli: cmake -S <whisper.cpp> -B <build> ${CMAKE_ARGS[*]}"
  say "  node's bin, lib and LICENSE, copied as they are"
  say "into $vendor/node (with ffmpeg, ffprobe and whisper-cli in its bin), $vendor/licenses and $vendor/manifest.json, and the GPL source zip $out/source/$source_name."
  say "Each of ffmpeg, ffprobe and whisper-cli must load only macOS's own libraries, be arm64 and say macOS 13.0."
  say ""
  say "Nothing was changed."
}

# Fetches one pinned download unless it is in downloads already with the right SHA-256, then checks it. One that is not the pinned
# one is set aside (.rejected), never unpacked, and ends the script.
fetch_pin() {
  local name=$1 file=$downloads/${PIN_FILE[$1]}
  if [[ -f $file && $(sha256_of "$file") == ${PIN_SHA[$name]} ]]; then
    say "$name ${PIN_VERSION[$name]}: already fetched."
    return 0
  fi
  say "Fetching $name ${PIN_VERSION[$name]} from ${PIN_URL[$name]}"
  if ! curl --fail --location --proto '=https' --proto-redir '=https' --silent --show-error --output "$file.part" "${PIN_URL[$name]}"; then
    rm -f "$file.part"
    stop "$name could not be fetched (what curl said is above), so nothing was unpacked."
  fi
  mv "$file.part" "$file" || stop "$name's download could not be put in $downloads."
  if [[ $(sha256_of "$file") != ${PIN_SHA[$name]} ]]; then
    mv "$file" "$file.rejected"
    stop "$name's download is not the pinned one, so it was set aside and nothing was unpacked."
  fi
  say "$name ${PIN_VERSION[$name]}: matches its pin."
}

do_fetch() {
  mkdir -p "$downloads" || stop "$downloads could not be made."
  local name
  for name in $PIN_NAMES; do fetch_pin $name; done
}

# The one folder at the top of an archive.
top_of() { tar -tf "$1" | head -1 | cut -d/ -f1 }

# Runs one step of the build in a folder, its output into a log. On failure it shows the end of the log and stops.
run_logged() {
  local log=$1 dir=$2
  shift 2
  if ! ( cd "$dir" && "$@" ) >>"$log" 2>&1; then
    say "This step failed: $*"
    say "The end of its log, $log:"
    tail -n 25 "$log"
    stop "Stopped. Nothing outside $out was changed."
  fi
}

# The matching source, for the GPL: both source archives exactly as they were fetched, the scripts that built them, and the lines
# they were configured with. The script and what it reads are laid out as in the repo (tool/studio-app/ and tool/is-main.js, which
# vendor.js imports), so it runs from the zip. The lines name the build folder <build>, never its path. ditto leaves out resource
# forks and extended attributes, so no ._ file is in it.
make_source_zip() {
  local base=${source_name%.zip} z=$out/source/${source_name%.zip}
  rm -rf $out/source
  mkdir -p $z/tool/studio-app || stop "$z could not be made."
  cp $downloads/${PIN_FILE[ffmpeg]} $downloads/${PIN_FILE[x264]} $z/ &&
    cp $HERE/build-vendor.sh $HERE/common.zsh $HERE/vendor.pin.json $HERE/vendor.js $z/tool/studio-app/ &&
    cp $HERE/../is-main.js $z/tool/ || stop "The source zip's files could not be copied."
  {
    print -r -- "How ffmpeg and ffprobe were built, for BRIMM Video Studio"
    print -r -- ""
    print -r -- "ffmpeg ${PIN_VERSION[ffmpeg]}: ${PIN_FILE[ffmpeg]}, from ${PIN_URL[ffmpeg]}, SHA-256 ${PIN_SHA[ffmpeg]}"
    print -r -- "x264 at commit ${PIN_VERSION[x264]}: ${PIN_FILE[x264]}, from ${PIN_URL[x264]}, SHA-256 ${PIN_SHA[x264]}"
    print -r -- "Both are GPL software (ffmpeg built with --enable-gpl; x264 is GPL version 2 or later). The script and the pins that built"
    print -r -- "them are in tool/studio-app: build-vendor.sh, with common.zsh, vendor.pin.json and vendor.js beside it, and tool/is-main.js,"
    print -r -- "which vendor.js imports. From this folder: zsh tool/studio-app/build-vendor.sh --out <folder>. pkgconf ${PIN_VERSION[pkgconf]} was used to"
    print -r -- "build, and is in neither program. <build> below is the build folder, <folder>/build."
    print -r -- ""
    print -r -- "x264: ./configure ${X264_CONFIGURE[*]//$b/<build>}"
    print -r -- "      make, then make install-lib-static"
    print -r -- "ffmpeg: PKG_CONFIG_PATH=<build>/prefix/lib/pkgconfig PKG_CONFIG_LIBDIR=<build>/prefix/lib/pkgconfig ./configure ${FFMPEG_CONFIGURE[*]//$b/<build>}"
    print -r -- "        make, then make install"
    print -r -- "Built with PATH=$SYSTEM_PATH and MACOSX_DEPLOYMENT_TARGET=13.0, with Apple's clang."
  } > $z/BUILD.txt
  ( cd $out/source && ditto -c -k --norsrc --noextattr --keepParent $base $source_name ) || stop "The source zip could not be made."
  rm -rf $z
}

do_build() {
  [[ -x /usr/bin/clang && -x /usr/bin/make ]] || stop "Building needs Xcode's command line tools (clang and make), and they are not here."
  local jobs=$(sysctl -n hw.ncpu) saved_path=$PATH
  rm -rf $b $vendor $out/source
  mkdir -p $b/src $prefix $tools $logs $vendor/node $vendor/licenses $out/source || stop "The build's folders could not be made."
  # A clean environment: macOS's own folders, and no flags or search paths from elsewhere, so that nothing of Homebrew's is found.
  export PATH=$SYSTEM_PATH MACOSX_DEPLOYMENT_TARGET=13.0
  unset CPATH C_INCLUDE_PATH CPLUS_INCLUDE_PATH LIBRARY_PATH CFLAGS CPPFLAGS CXXFLAGS LDFLAGS PKG_CONFIG PKG_CONFIG_PATH PKG_CONFIG_LIBDIR PKG_CONFIG_SYSROOT_DIR CMAKE_PREFIX_PATH
  say "Building in $b, with $jobs jobs at a time. It takes about fifteen minutes; each step's log is in $logs."

  tar -xf $downloads/${PIN_FILE[pkgconf]} -C $b/src || stop "pkgconf's archive could not be unpacked."
  local pk=$b/src/$(top_of $downloads/${PIN_FILE[pkgconf]})
  run_logged $logs/pkgconf.log $pk ./configure --prefix=$tools --disable-shared
  run_logged $logs/pkgconf.log $pk make -j$jobs
  run_logged $logs/pkgconf.log $pk make install
  [[ -x $tools/bin/pkgconf ]] || stop "pkgconf was built, but $tools/bin/pkgconf is not there."
  say "pkgconf ${PIN_VERSION[pkgconf]}: built, for the build alone."

  tar -xf $downloads/${PIN_FILE[x264]} -C $b/src || stop "x264's archive could not be unpacked."
  local xd=$b/src/$(top_of $downloads/${PIN_FILE[x264]})
  run_logged $logs/x264.log $xd ./configure "${X264_CONFIGURE[@]}"
  run_logged $logs/x264.log $xd make -j$jobs
  run_logged $logs/x264.log $xd make install-lib-static
  [[ -f $prefix/lib/libx264.a && -f $prefix/lib/pkgconfig/x264.pc ]] || stop "x264 was built, but its library or its .pc file is not in $prefix/lib."
  say "x264: built, as a static library."

  tar -xf $downloads/${PIN_FILE[ffmpeg]} -C $b/src || stop "ffmpeg's archive could not be unpacked."
  local fd=$b/src/$(top_of $downloads/${PIN_FILE[ffmpeg]})
  run_logged $logs/ffmpeg.log $fd env PKG_CONFIG_PATH=$prefix/lib/pkgconfig PKG_CONFIG_LIBDIR=$prefix/lib/pkgconfig ./configure "${FFMPEG_CONFIGURE[@]}"
  run_logged $logs/ffmpeg.log $fd make -j$jobs
  run_logged $logs/ffmpeg.log $fd make install
  say "ffmpeg ${PIN_VERSION[ffmpeg]} and ffprobe: built."

  mkdir -p $b/cmake || stop "$b/cmake could not be made."
  tar -xf $downloads/${PIN_FILE[cmake]} -C $b/cmake || stop "CMake's archive could not be unpacked."
  local cmake=$(find $b/cmake -path '*/CMake.app/Contents/bin/cmake' -type f | head -1)
  [[ -x $cmake ]] || stop "There is no CMake.app/Contents/bin/cmake in CMake's archive."
  tar -xf $downloads/${PIN_FILE[whisper]} -C $b/src || stop "whisper.cpp's archive could not be unpacked."
  local wd=$b/src/$(top_of $downloads/${PIN_FILE[whisper]})
  run_logged $logs/whisper.log $b $cmake -S $wd -B $b/whisper-build "${CMAKE_ARGS[@]}"
  run_logged $logs/whisper.log $b $cmake --build $b/whisper-build --target whisper-cli -j $jobs
  [[ -x $b/whisper-build/bin/whisper-cli ]] || stop "The build ended, but $b/whisper-build/bin/whisper-cli is not there."
  say "whisper-cli: built."

  mkdir -p $b/node || stop "$b/node could not be made."
  tar -xzf $downloads/${PIN_FILE[node]} -C $b/node || stop "node's tarball could not be unpacked."
  local nd=$b/node/$(top_of $downloads/${PIN_FILE[node]})
  ditto $nd/bin $vendor/node/bin && ditto $nd/lib $vendor/node/lib && ditto $nd/LICENSE $vendor/node/LICENSE || stop "node's files could not be copied."
  cp $prefix/bin/ffmpeg $prefix/bin/ffprobe $b/whisper-build/bin/whisper-cli $vendor/node/bin/ || stop "The built programs could not be copied into $vendor/node/bin."
  cp $fd/COPYING.GPLv3 $vendor/licenses/ffmpeg-COPYING.GPLv3 &&
    cp $xd/COPYING $vendor/licenses/x264-COPYING &&
    cp $wd/LICENSE $vendor/licenses/whisper.cpp-LICENSE &&
    cp $nd/LICENSE $vendor/licenses/node-LICENSE || stop "A licence could not be copied: it is not in the source it belongs to."
  say "node ${PIN_VERSION[node]}: its files are copied, with the programs beside them."

  say ""
  say "What they load, and where they run:"
  local program
  for program in ffmpeg ffprobe whisper-cli; do
    only_system $vendor/node/bin/$program || stop "$program loads a library that is not macOS's own, so this build is not used."
    [[ $(lipo -archs $vendor/node/bin/$program) == arm64 ]] || stop "$program is not arm64, so this build is not used."
    [[ $(min_macos $vendor/node/bin/$program) == 13.0 ]] || stop "$program does not say macOS 13.0, so this build is not used."
    say "  $program: arm64, macOS 13.0 or later, and only macOS's own libraries."
  done
  $vendor/node/bin/ffmpeg -hide_banner -hwaccels | grep -qx videotoolbox || stop "ffmpeg does not list the videotoolbox hardware decoder, so this build is not used."
  $vendor/node/bin/ffmpeg -hide_banner -filters | grep -q ' scale_vt ' || stop "ffmpeg does not list the scale_vt filter, so this build is not used."
  strings $vendor/node/bin/whisper-cli | grep -q 'kernel_mul_mm' || stop "whisper-cli does not hold its Metal shaders, so this build is not used."
  say "  ffmpeg has videotoolbox and scale_vt, and whisper-cli holds its Metal shaders."

  make_source_zip
  PATH=$saved_path
  node $HERE/vendor.js seal $vendor || stop "The vendored folder could not be sealed."
  say ""
  say "Made $vendor"
  say "Made $out/source/$source_name"
}

if (( want_print )); then
  print_plan
  exit 0
fi
do_fetch
(( want_fetch )) && exit 0
do_build
