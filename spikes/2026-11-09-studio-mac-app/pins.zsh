# Every download the spikes make (spike only; see README.md). Sourced by common.zsh, never run.
# For each: the file, where it comes from, its rough size, its SHA-256, and where the SHA-256 was read. An empty SHA-256 is one that
# is not pinned yet: the script that needs it fetches it, prints the SHA-256 it found (beside the maker's own list, when the maker
# publishes one), and stops. Claude fills it in here only after Jason's yes. A file that does not match its pin is moved aside and
# never used.

typeset -gA PIN_URL PIN_FILE PIN_SIZE PIN_SHA PIN_FROM PIN_SUMS

# S1: ffmpeg's source, the release the Mac Studio's own ffmpeg is.
PIN_FILE[ffmpeg]=ffmpeg-9.0.2.tar.xz
PIN_URL[ffmpeg]=https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz
PIN_SIZE[ffmpeg]="11 MB"
PIN_SHA[ffmpeg]=8c3850283eb25fa026482078a04051e0be17347b09ef81a0849bec15a96e002e
PIN_FROM[ffmpeg]="Homebrew's ffmpeg 9.0.2 formula on the Mac Studio (/opt/homebrew/Cellar/ffmpeg/9.0.2_1/.brew/ffmpeg.rb)"

# S1: x264's source at the commit Homebrew's x264 r3222 is, the latest on x264's stable branch when Homebrew took it. x264 makes no
# releases: this is the archive code.videolan.org makes of that commit.
X264_COMMIT=b35605ace3ddf7c1a5d67a2eb553f034aef41d55
PIN_FILE[x264]=x264-$X264_COMMIT.tar.bz2
PIN_URL[x264]=https://code.videolan.org/videolan/x264/-/archive/$X264_COMMIT/x264-$X264_COMMIT.tar.bz2
PIN_SIZE[x264]="1 MB"
PIN_SHA[x264]=6eeb82934e69fd51e043bd8c5b0d152839638d1ce7aa4eea65a3fedcf83ff224
PIN_FROM[x264]="the commit from Homebrew's x264 r3222 formula on the Mac Studio (/opt/homebrew/Cellar/x264/r3222/.brew/x264.rb); the SHA-256 of this very archive from HeyGen's own record of its ffmpeg build, inside the HyperFrames app (Contents/Resources/app.asar.unpacked/vendor/ffmpeg/darwin-arm64/SOURCE.txt). If code.videolan.org has made the archive again since, it will not match, and the fetch stops"

# S1: pkgconf, which ffmpeg's configure needs to find x264. It is built for the build alone and is in no program that is made.
PIN_FILE[pkgconf]=pkgconf-2.3.0.tar.xz
PIN_URL[pkgconf]=https://distfiles.ariadne.space/pkgconf/pkgconf-2.3.0.tar.xz
PIN_SIZE[pkgconf]="0.3 MB"
PIN_SHA[pkgconf]=3a9080ac51d03615e7c1910a0a2a8df08424892b5f13b0628a204d3fcce0ea8b
PIN_FROM[pkgconf]="HeyGen's own record of its ffmpeg build, inside the HyperFrames app (vendor/ffmpeg/darwin-arm64/SOURCE.txt)"

# S2: whisper.cpp's source, the release the Mac Studio's own whisper-cli is.
PIN_FILE[whisper]=whisper.cpp-1.9.5.tar.gz
PIN_URL[whisper]=https://github.com/ggml-org/whisper.cpp/archive/refs/tags/v1.9.5.tar.gz
PIN_SIZE[whisper]="10 MB"
PIN_SHA[whisper]=ff1a9053feb509ff9d7729703355541ae9690073a6b1c40eb692c962e0dc1720
PIN_FROM[whisper]="Homebrew's whisper.cpp 1.9.5 formula on the Mac Studio (/opt/homebrew/Cellar/whisper.cpp/1.9.5/.brew/whisper.cpp.rb)"

# S2: CMake, which whisper.cpp builds with, Kitware's own build for macOS. It is used for the build alone. Not pinned yet: Kitware
# publishes the SHA-256 of each file in the list PIN_SUMS names, which the fetch prints beside the one it found.
PIN_FILE[cmake]=cmake-4.0.3-macos-universal.tar.gz
PIN_URL[cmake]=https://github.com/Kitware/CMake/releases/download/v4.0.3/cmake-4.0.3-macos-universal.tar.gz
PIN_SIZE[cmake]="80 MB"
PIN_SHA[cmake]=4e85de4daf1c3e82d7dc6b8ba5683972944b466343aeb9c327a742437bb3ce9a
PIN_FROM[cmake]="Kitware's own list of the SHA-256s of its 4.0.3 files (cmake-4.0.3-SHA-256.txt), which the file fetched on 2026-11-09 matched; pinned on Jason's yes"
PIN_SUMS[cmake]=https://github.com/Kitware/CMake/releases/download/v4.0.3/cmake-4.0.3-SHA-256.txt

# S3: node, the version `node --version` printed on the Mac Studio on 9 November 2026, as nodejs.org builds it. Not pinned yet:
# nodejs.org publishes the SHA-256 of each file in the list PIN_SUMS names, which the fetch prints beside the one it found.
NODE_VERSION=26.11.1
PIN_FILE[node]=node-v$NODE_VERSION-darwin-arm64.tar.gz
PIN_URL[node]=https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-darwin-arm64.tar.gz
PIN_SIZE[node]="50 MB"
PIN_SHA[node]=d916511b55965e91be7a88e17f88d895b6793ceaba3e6c9b194aefe51c2c65ac
PIN_FROM[node]="nodejs.org's own list of the SHA-256s of its v26.11.1 files (SHASUMS256.txt), which the file fetched on 2026-11-09 matched; pinned on Jason's yes"
PIN_SUMS[node]=https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt
