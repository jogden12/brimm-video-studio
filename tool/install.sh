#!/bin/zsh
# Sets the unedited-video tool up on this Mac, which is meant to be the Mac Studio.
#
#   ./install.sh "/path/to/folder"   watch that folder for unedited video: unedited.js works on what lands there
#   ./install.sh "/path/to/folder" "/path/to/another"
#                                    watch more than one folder. Name every folder each time: the list replaces the last one
#   ./install.sh "/path/to/folder" --rules-only
#                                    the same, and Claude is never asked to read a cut plan: each plan is the rules' alone
#   ./install.sh --print "/path/to/folder"
#                                    show what would be done and change nothing. With --remove, show what would be stopped
#   ./install.sh --yes "/path/to/folder"
#                                    the same as without --yes, but it goes ahead without asking first
#   ./install.sh --remove            stop watching for unedited video. The folders, the model, the programs and the
#                                    transcript tool's own launch agent stay
#   ./install.sh --machine "Mac Studio" "/path/to/The BRIMM DB/BRIMM Video"
#                                    set this Mac up for episodes: it watches its own drop folder, BRIMM Video/Unedited
#                                    Video/<this Mac>, which is made, with a marker that names this Mac, and each video
#                                    dropped there is imported into BRIMM Video/Episodes. This Mac's settings are written in
#                                    ~/Library/Application Support/BRIMM Video/settings.json. With --print, nothing is made
#
# It installs ffmpeg, whisper-cpp and Node with Homebrew when they are missing, downloads the transcriber's model once (about
# 1.6 GB) when it is not here, and has the Mac run unedited.js whenever something lands in a watched folder. It asks before it
# installs or downloads. The model is the transcript tool's own, in the same place, so a Mac that has that tool has it
# already. A finished video is moved, with what was made of it, into a new folder named for the day, in the folder it was
# put in. It does not install Claude Code. A folder that the transcript tool's launch agent watches already is refused:
# whichever of the two tools looked first would file the video away. The launch agent is com.thebrimm.unedited, so a run
# replaces the one an earlier installer gave this Mac under that name, and what it does is in ~/Library/Logs/brimm-video.log.
# Nothing here needs a password or a key. No video and no sound ever leaves the Mac. Claude is asked to read each cut plan:
# the words of the transcript with their times and the rules' plan are then sent to Claude through Claude Code, on the
# Claude account signed in on this Mac, with the video's file name and its length. With --rules-only nothing leaves the Mac.
set -euo pipefail

LABEL="com.thebrimm.unedited"
AGENT_FILE="$HOME/Library/LaunchAgents/$LABEL.plist"
# The transcript tool's launch agent. Its file is only ever read here, for the folders it watches.
TRANSCRIBE_LABEL="com.thebrimm.transcribe"
# Where the launch agent looks for the programs. /usr/bin is on it for swift, which finds the faces for the upright version.
# A test names other folders in BRIMM_AGENT_PATH: on a Mac that has Claude Code where Homebrew puts programs, that is the one
# way to see where else it is looked for.
AGENT_PATH="${BRIMM_AGENT_PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin}"
HERE="${0:A:h}"
LOG="$HOME/Library/Logs/brimm-video.log"
MODEL_DIR="$HOME/Library/Application Support/BRIMM Transcribe"
MODEL="$MODEL_DIR/ggml-large-v3-turbo.bin"
MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin"

say() { print -r -- "$@"; }

# --print is kept apart from what is asked for, so that with it nothing is ever changed, wherever in the line it comes.
mode="install"
print="no"
yes="no"
folders=()
rules_only=""
# With --machine, this Mac's name: the Mac is set up for episodes, and the one folder named is BRIMM Video.
machine=""
machined="no"
# What came after --machine when it was an option and not a name, such as --print: refused below, so a print run is never
# taken for an install of a Mac of that name.
machine_option=""
while (( $# )); do
  arg="$1"
  shift
  case "$arg" in
    --print) print="yes" ;;
    --remove) mode="remove" ;;
    --rules-only) rules_only="$arg" ;;
    --yes) yes="yes" ;;
    --machine)
      machined="yes"
      if [[ "${1-}" == -* ]]; then machine_option="$1"; else machine="${1-}"; (( $# )) && shift; fi ;;
    # The help is the comment this file opens with, down to the line before the script begins.
    -h|--help) sed -n '2,/^set -euo pipefail$/p' "$0" | sed -e '$d' -e 's/^# \{0,1\}//'; exit 0 ;;
    -*) say "Not an option this script knows: $arg"; exit 2 ;;
    *) folders+=("${arg:A}") ;;
  esac
done
# There is no folder it would watch without being told. Stopping the watching needs none.
if [[ ${#folders[@]} -eq 0 && "$mode" != "remove" && "$machined" != "yes" ]]; then
  say 'Name the folder to watch for unedited video: ./install.sh "<folder>"'
  exit 2
fi

xml() { print -rn -- "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }
find_program() {
  local name dir
  for name in "$@"; do
    for dir in ${(s.:.)PATH} /opt/homebrew/bin /usr/local/bin; do
      if [[ -x "$dir/$name" ]]; then print -r -- "$dir/$name"; return 0; fi
    done
  done
  return 1
}
# Claude Code, where unedited.js finds it when a launch agent runs it: along the agent's own PATH, and then in .local/bin in
# the home folder, where Claude Code's own installer puts it. This shell's PATH may lead to one the agent never sees.
find_claude() {
  local dir
  for dir in ${(s.:.)AGENT_PATH} "$HOME/.local/bin"; do
    if [[ -x "$dir/claude" ]]; then print -r -- "$dir/claude"; return 0; fi
  done
  return 1
}

# What unedited.js is told in the plist: --rules-only, when that was asked for here, and then each watched folder after its
# own --watch. So each watched folder is in the plist twice: here, for the tool, and in WatchPaths, for the Mac.
tool_arguments() {
  local f
  [[ -z "$rules_only" ]] || print -r -- "    <string>$(xml "$rules_only")</string>"
  for f in "${folders[@]}"; do
    print -r -- "    <string>--watch</string>"
    print -r -- "    <string>$(xml "$f")</string>"
  done
}
watch_paths() {
  local f
  for f in "${folders[@]}"; do print -r -- "    <string>$(xml "$f")</string>"; done
}

# The launch agent: under its label the Mac runs unedited.js with node, on the folders named, whenever one of those folders
# changes and once when the agent is loaded. $1 is the node it is run with. --print shows this and the Mac is given this, so
# the two cannot differ.
agent() {
  cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(xml "$1")</string>
    <string>$(xml "$HERE/unedited.js")</string>
$(tool_arguments)
  </array>
  <key>WatchPaths</key>
  <array>
$(watch_paths)
  </array>
  <key>RunAtLoad</key><true/>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$AGENT_PATH</string></dict>
  <key>StandardOutPath</key><string>$(xml "$LOG")</string>
  <key>StandardErrorPath</key><string>$(xml "$LOG")</string>
</dict>
</plist>
EOF
}

# The folders that a launch agent on this Mac watches already, one to a line. None when there is no such agent, or its file
# cannot be read.
watched() {
  local file="$HOME/Library/LaunchAgents/$1.plist" count i
  count="$(plutil -extract WatchPaths raw -o - "$file" 2>/dev/null)" || return 0
  [[ "$count" == <-> ]] || return 0
  for (( i = 0; i < count; i++ )); do plutil -extract "WatchPaths.$i" raw -o - "$file" 2>/dev/null || true; done
}

if [[ "$(uname -s)" != "Darwin" ]]; then say "This is for a Mac."; exit 1; fi

if [[ "$mode" == "remove" ]]; then
  if [[ "$print" == "yes" ]]; then
    say "This is what would be stopped:"
    say "  $LABEL, and its file $AGENT_FILE"
    say ""
    say "Nothing was changed."
    exit 0
  fi
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$AGENT_FILE"
  say "Stopped watching for unedited video. The folders, the model, the programs and the transcript tool's own launch agent are still here."
  exit 0
fi

# For one of the two Macs (--machine): the one folder named is BRIMM Video, in The BRIMM DB in Dropbox, and the folder watched
# is this Mac's own drop folder in it. BRIMM Video sits beside BRIMM VIDEO Transfer, and never inside a folder the transcript
# tool's launch agent watches: launchd would wake that agent at every change an editing session makes.
root=""
drop=""
marker=""
if [[ "$machined" == "yes" ]]; then
  if [[ -n "$machine_option" ]]; then say "Name this Mac after --machine, as --machine \"Mac Studio\": $machine_option is an option, not a name."; exit 2; fi
  if [[ -z "$machine" ]]; then say "Name this Mac: --machine \"Mac Studio\" or --machine \"Sallie's laptop\"."; exit 2; fi
  if [[ ${#folders[@]} -ne 1 ]]; then say 'With --machine, name the one folder BRIMM Video: ./install.sh --machine "Mac Studio" "<path to BRIMM Video>"'; exit 2; fi
  # The rules for a Mac's name are settings.js's machineFault: a name a folder in Dropbox can carry, of 40 characters at most.
  if (( ${#machine} > 40 )) || [[ "$machine" == *[/\\:*?\"\<\>\|]* || "$machine" == *[[:cntrl:]]* || "$machine" == [[:space:].]* || "$machine" == *[[:space:]] ]]; then
    say "A Mac's name cannot hold any of / \\ : * ? \" < > |, a control character, or a space or a dot at its start, and can be 40 characters long at most: $machine"
    exit 2
  fi
  root="${folders[1]}"
  if [[ "${root:t}" != "BRIMM Video" ]]; then say "The folder for --machine is BRIMM Video, in The BRIMM DB in Dropbox, and this is not: $root"; exit 2; fi
  for w in "${(@f)$(watched "$TRANSCRIBE_LABEL")}"; do
    [[ -n "$w" ]] || continue
    if [[ "$root" == "$w" || "$root" == "$w"/* ]]; then
      say "BRIMM Video must not be inside a folder the transcript tool watches: $root is inside $w, which $TRANSCRIBE_LABEL watches. Put it beside BRIMM VIDEO Transfer."
      exit 2
    fi
  done
  drop="$root/Unedited Video/$machine"
  marker="$drop/.brimm-watched-by"
  if [[ -f "$marker" ]]; then
    owner="$(head -n 1 "$marker")"
    if [[ "$owner" != "$machine" ]]; then say "The folder $drop is watched by $owner already. A drop folder is watched by one Mac only."; exit 2; fi
  fi
  folders=("$drop")
fi

# The transcript tool's launch agent goes on watching its folders, and whichever tool looked first in a folder would file the
# video away. So a folder it watches already is refused.
already=("${(@f)$(watched "$TRANSCRIBE_LABEL")}")
for f in "${folders[@]}"; do
  if (( ${already[(Ie)$f]} )); then
    say "A folder is for transcripts or for unedited video, and not for both: $f is watched for transcripts already, by $TRANSCRIBE_LABEL. Take it off the transcript tool's list first, or name another folder."
    exit 2
  fi
done

brew="$(find_program brew || true)"
ffmpeg="$(find_program ffmpeg || true)"
whisper="$(find_program whisper-cli whisper-cpp || true)"
node="$(find_program node || true)"
need=()
[[ -n "$ffmpeg" ]] || need+=(ffmpeg)
[[ -n "$whisper" ]] || need+=(whisper-cpp)
[[ -n "$node" ]] || need+=(node)

# This Mac's settings for episodes, as JSON: settings.js writes them, and this is what it is told.
json() { print -rn -- "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }
SETTINGS_FILE="$HOME/Library/Application Support/BRIMM Video/settings.json"
WORK="$HOME/BRIMM Video Work"
CHECKOUT="${HERE:h}"
settings_json() {
  print -r -- "{"
  print -r -- "  \"version\": 1,"
  print -r -- "  \"machine\": \"$(json "$machine")\","
  print -r -- "  \"root\": \"$(json "$root")\","
  print -r -- "  \"checkout\": \"$(json "$CHECKOUT")\""
  print -r -- "}"
}

say "The unedited-video tool"
if [[ -n "$machine" ]]; then
  say "  This Mac:  $machine"
  say "  BRIMM Video:  $root"
  say "  Its drop folder, to make in Dropbox and watch:  $drop"
  say "  Its marker there, $marker, saying:  $machine"
  say "  Episodes, to make in Dropbox:  $root/Episodes"
  say "  The import status files, to make in Dropbox:  $root/Episodes/.importing"
  say "  On this Mac:  $WORK/From Final Cut"
  say "  Once, in Finder:  Control-click $drop and choose Make available offline, so that a video dropped there from another device is brought down at once"
  say "  This Mac's settings, in $SETTINGS_FILE:"
  settings_json
else
  for f in "${folders[@]}"; do say "  Folder to watch for unedited video:  $f"; done
fi
# swift finds the speaker's face for the upright version. It comes with Xcode's command line tools, and nothing here installs it.
say "  Swift, to find the speaker's face:  $(xcode-select -p >/dev/null 2>&1 && echo "here already" || echo "not here, so the upright version is cropped at the centre. To get it: xcode-select --install")"
# Claude reads each cut plan, through Claude Code. Nothing here installs that or signs in to it. When Claude is going to be
# asked, this says what is sent to it, before anything is changed.
if [[ -n "$rules_only" ]]; then
  say "  Claude, to read each cut plan:  not asked (--rules-only), so each cut plan is the rules' alone and nothing leaves this Mac"
elif claude="$(find_claude)"; then
  say "  Claude Code, to read each cut plan:  here already, at $claude"
  say "  Sent to Claude for each cut plan:  the words of the transcript with their times, the rules' plan, and the video's file name and length, on the Claude account signed in on this Mac. The video and its sound never leave it. To send nothing: --rules-only"
  say "  Claude model, named in unedited.js:  $(sed -n 's/^export const CLAUDE_MODEL = "\(.*\)";$/\1/p' "$HERE/unedited.js")"
else
  say "  Claude Code, to read each cut plan:  not here, so each cut plan is the rules' alone and nothing leaves this Mac. To have Claude read it: install Claude Code and sign in to it on this Mac"
fi
say "  Programs to install with Homebrew:  ${need[*]:-none, they are all here}"
say "  Model:  $([[ -f "$MODEL" ]] && echo "here already" || echo "to download, about 1.6 GB, to $MODEL")"
say "  Log:  $LOG"

if [[ "$print" == "yes" ]]; then
  say ""
  say "This is what the Mac would be given, at $AGENT_FILE:"
  say ""
  agent "${node:-/opt/homebrew/bin/node}"
  say ""
  say "Nothing was changed."
  exit 0
fi

if [[ ${#need[@]} -gt 0 && -z "$brew" ]]; then
  say ""
  say "Homebrew is not installed, and it is how the programs are installed. Get it from https://brew.sh, then run this again."
  exit 1
fi
if [[ "$yes" != "yes" ]]; then
  say ""
  read -q "go?Go ahead? [y/N] " || { say ""; say "Nothing was changed."; exit 0; }
  say ""
fi

if [[ ${#need[@]} -gt 0 ]]; then "$brew" install "${need[@]}"; fi
ffmpeg="$(find_program ffmpeg)"
whisper="$(find_program whisper-cli whisper-cpp)"
node="$(find_program node)"
if ! "$node" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; then
  say "Node here is $("$node" --version), and the tool needs 22 or later. Run: brew upgrade node"
  exit 1
fi

if [[ ! -f "$MODEL" ]]; then
  mkdir -p "$MODEL_DIR"
  say "Downloading the model. This is done once."
  curl -L --fail --progress-bar -o "$MODEL.part" "$MODEL_URL"
  if [[ "$(stat -f %z "$MODEL.part")" -lt 1000000000 ]]; then
    rm -f "$MODEL.part"
    say "The model did not download whole. Run this again."
    exit 1
  fi
  mv "$MODEL.part" "$MODEL"
fi

# Give the Mac the launch agent: write its file, check it, stop the agent of that name if one is running, and start this one.
mkdir -p "${folders[@]}" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
# For one of the two Macs: Episodes and its status files in Dropbox, the marker by the rule for writing into Dropbox, this
# Mac's settings, and its folders for Final Cut's work.
if [[ -n "$machine" ]]; then
  mkdir -p "$root/Episodes/.importing" "$WORK/From Final Cut"
  "$node" "$HERE/settings.js" marker "$drop" "$machine"
  "$node" "$HERE/settings.js" write --machine "$machine" --root "$root" --checkout "$CHECKOUT"
fi

agent "$node" > "$AGENT_FILE"
plutil -lint "$AGENT_FILE" >/dev/null
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$AGENT_FILE"

if [[ -n "$machine" ]]; then
  say ""
  say "Done. Drop a video in:"
  say "  $drop"
  say "Once, in Finder: Control-click that folder and choose Make available offline, so that a video dropped there from"
  say "another device is brought down at once. Dropbox offers no command for it."
  say "It is imported into $root/Episodes, in a folder of its own named for the day, the video and this Mac. Its files are"
  say "copied into Dropbox and checked again 15 minutes later, and only then is the video taken out of the drop folder. Then,"
  say "in Claude, say \"open\" and the video's name. What the tool did is in $LOG"
  exit 0
fi
say ""
say "Done. Put an unedited video in:"
for f in "${folders[@]}"; do say "  $f"; done
say "It is moved, with what is made of it, into a new folder there named for the day: its transcript, <name>.cut-plan.txt,"
say "which says what is suggested to cut, <name>.rough-cut.mp4 to watch, <name>.rough-cut.vertical.mp4 for Instagram when"
say "the video is wider than it is tall, and <name>.fcpxml to open in Final Cut Pro. Final Cut Pro keeps that project in the"
say "library BRIMM rough cuts, in the folder BRIMM Video Work in your home folder. The first lines of <name>.cut-plan.txt"
say "say what could not be made. What the tool did is in $LOG"
if [[ -z "$rules_only" ]]; then
  say "When Claude has read the cut plan there are also <name>.edit-notes.txt, its notes for the editor, and the short clips"
  say "it picked: <name>.reel-1.mp4 and so on, each with its captions. A clip that could not be cut is named in the log and"
  say "at the end of the notes, and not in <name>.cut-plan.txt. When Claude cannot be asked the plan is the rules' alone,"
  say "and its first lines say so."
fi
