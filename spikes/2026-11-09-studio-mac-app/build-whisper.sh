#!/bin/zsh
# S2 (spike only; see README.md): a static whisper-cli for Apple silicon and macOS 13 or later, from pinned whisper.cpp, with Metal and
# its library embedded in the program, and the comparison with Homebrew's whisper-cli. Run on the Mac Studio as jasonogden:
#   zsh build-whisper.sh --print     what it would do. It changes nothing and fetches nothing.
#   zsh build-whisper.sh --fetch     fetches whisper.cpp's source and Kitware's CMake (for the build alone) into App spikes/downloads,
#                                    and checks each against its pin. CMake is not pinned yet: the first fetch prints its SHA-256
#                                    beside Kitware's own, and stops.
#   zsh build-whisper.sh --build     builds whisper-cli from what --fetch fetched, and fetches nothing. It ends by checking that the
#                                    program loads only macOS's own libraries and says macOS 13.0.
#   zsh build-whisper.sh --compare [clip]   Homebrew's whisper-cli and the new one on the spike clip, with Studio's model and Studio's
#                                    own arguments, and a diff of what they write. The clip is /Users/Shared/BRIMM Studio
#                                    spikes/Spike clip.mov unless another is given.
# What is kept goes in ~/BRIMM Video Work/App spikes/s2-whisper; the compiling happens in ~/Library/Caches/brimm-studio-spikes/s2.
set -u
source ${0:A:h}/common.zsh

S2=$WORK/s2-whisper
OUT=$S2/out
LOGS=$S2/logs
B=$BUILD_ROOT/s2
NODE=${commands[node]:-/opt/homebrew/bin/node}
HOMEBREW_WHISPER=/opt/homebrew/bin/whisper-cli
HOMEBREW_FFMPEG=/opt/homebrew/bin/ffmpeg
HOMEBREW_FFPROBE=/opt/homebrew/bin/ffprobe

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

usage() {
  say "Say what to do: --print, --fetch, --build or --compare."
  exit 2
}

run_logged() {
  local log=$1
  shift
  if ! "$@" >>"$log" 2>&1; then
    say "This step failed: $*"
    say "The end of its log, $log:"
    tail -n 25 "$log"
    stop "Stopped. Nothing outside $B, $LOGS and $OUT was changed."
  fi
}

# The version of the copy of ggml inside whisper.cpp's source, from its CMakeLists.txt.
ggml_version() {
  local f=$1/ggml/CMakeLists.txt v
  v=$(grep -E '^set\(GGML_VERSION_(MAJOR|MINOR|PATCH) [0-9]+\)' "$f" 2>/dev/null | sed -E 's/.* ([0-9]+)\)/\1/' | paste -sd. -)
  print -r -- ${v:-not said in $f}
}

print_plan() {
  say "S2: a static whisper-cli (spike only). --print changes nothing and fetches nothing."
  say ""
  say "--fetch fetches these into $DOWNLOADS, and checks each against its pin:"
  show_pin whisper
  show_pin cmake
  say ""
  say "--build fetches nothing. It compiles in $B, with PATH=$SYSTEM_PATH and CMake from the download:"
  say "  cmake -S <whisper.cpp> -B <build> ${CMAKE_ARGS[*]}"
  say "  cmake --build <build> --target whisper-cli"
  say "  then whisper-cli is copied into $OUT, and otool -L must name only /usr/lib/ and /System/, and otool -l macOS 13.0"
  say ""
  say "--compare runs $SPIKE/s2-compare.mjs with $NODE on $CLIP:"
  say "  the model $MODEL, checked against its SHA-256 $MODEL_SHA256"
  say "  the .wav made by $HOMEBREW_FFMPEG with Studio's ffmpegArgs"
  say "  $HOMEBREW_WHISPER and $OUT/whisper-cli, each with Studio's wordArgs and whisperArgs, into $OUT/compare"
  say ""
  say "Here:"
  local p
  for p in /usr/bin/clang /usr/bin/clang++ /usr/bin/make /usr/bin/otool $NODE $HOMEBREW_WHISPER $HOMEBREW_FFMPEG $HOMEBREW_FFPROBE; do
    if [[ -x $p ]]; then say "  $p: here"; else say "  $p: not here"; fi
  done
  if [[ -f $MODEL ]]; then say "  the model: here"; else say "  the model: not here"; fi
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
  for n in whisper cmake; do
    fetch $n || unpinned=1
  done
  (( unpinned )) && exit 3
  say "Both match their pins. Nothing was unpacked."
}

do_build() {
  refuse_watched $WORK $BUILD_ROOT
  refuse_spaces
  verified whisper
  verified cmake
  [[ -x /usr/bin/clang && -x /usr/bin/make ]] || stop "Stopped: building needs Xcode's command line tools (clang and make), and they are not here."
  local jobs=$(sysctl -n hw.ncpu)
  rm -rf $B
  mkdir -p $B/src $B/cmake $OUT $LOGS || stop "Stopped: the build's folders could not be made."
  rm -f $OUT/whisper-cli $LOGS/cmake.log $LOGS/whisper.log
  export PATH=$SYSTEM_PATH MACOSX_DEPLOYMENT_TARGET=13.0
  unset CPATH C_INCLUDE_PATH CPLUS_INCLUDE_PATH LIBRARY_PATH CFLAGS CPPFLAGS CXXFLAGS LDFLAGS CMAKE_PREFIX_PATH PKG_CONFIG_PATH
  say "Building in $B, with $jobs jobs at a time. It takes a few minutes; the log is in $LOGS."

  tar -xf $DOWNLOADS/${PIN_FILE[cmake]} -C $B/cmake || stop "Stopped: CMake's archive could not be unpacked."
  local cmake=$(find $B/cmake -path '*/CMake.app/Contents/bin/cmake' -type f | head -1)
  [[ -x $cmake ]] || stop "Stopped: there is no CMake.app/Contents/bin/cmake in CMake's archive."
  say "CMake, for the build alone: $($cmake --version | head -1)."

  tar -xf $DOWNLOADS/${PIN_FILE[whisper]} -C $B/src || stop "Stopped: whisper.cpp's archive could not be unpacked."
  local src=$B/src/$(top_of $DOWNLOADS/${PIN_FILE[whisper]})
  say "whisper.cpp 1.9.5, with its own copy of ggml, version $(ggml_version $src)."
  run_logged $LOGS/whisper.log $cmake -S $src -B $B/build "${CMAKE_ARGS[@]}"
  run_logged $LOGS/whisper.log $cmake --build $B/build --target whisper-cli -j $jobs
  local made=$B/build/bin/whisper-cli
  [[ -x $made ]] || stop "Stopped: the build ended, but $made is not there."
  cp $made $OUT/whisper-cli || stop "Stopped: whisper-cli could not be copied into $OUT."
  say "whisper-cli: built, and copied into $OUT."

  say ""
  say "What it loads, and where it runs:"
  only_system $OUT/whisper-cli || stop "Stopped: S2 fails as it is built, since whisper-cli loads a library that is not macOS's own."
  say "  whisper-cli loads only macOS's own libraries: otool -L names only /usr/lib/ and /System/."
  say "  whisper-cli: $(lipo -archs $OUT/whisper-cli), for macOS $(min_macos $OUT/whisper-cli) or later."
  if strings $OUT/whisper-cli | grep -q 'kernel_mul_mm'; then
    say "  Its Metal shaders are inside it."
  else
    say "  Its Metal shaders were not found inside it: it may look for a library file beside it, which the app would not have."
  fi
  say "Made $OUT/whisper-cli"
}

(( $# >= 1 )) || usage
case $1 in
  --print) print_plan ;;
  --fetch) do_fetch ;;
  --build) do_build ;;
  --compare)
    [[ -x $OUT/whisper-cli ]] || stop "Stopped: the new whisper-cli is not built yet. Run --build first."
    for p in $NODE $HOMEBREW_WHISPER $HOMEBREW_FFMPEG $HOMEBREW_FFPROBE; do [[ -x $p ]] || stop "Stopped: $p is not here."; done
    [[ -f $MODEL ]] || stop "Stopped: the model is not at $MODEL."
    clip=${2:-$CLIP}
    [[ -f $clip ]] || stop "Stopped: the spike clip is not there: $clip"
    refuse_watched $OUT
    "$NODE" $SPIKE/s2-compare.mjs --tool $TOOL --clip "$clip" --ffmpeg $HOMEBREW_FFMPEG --ffprobe $HOMEBREW_FFPROBE \
      --model $MODEL --model-sha $MODEL_SHA256 --whisper "Homebrew=$HOMEBREW_WHISPER" --whisper "the new one=$OUT/whisper-cli" --out $OUT/compare
    ;;
  *) usage ;;
esac
