#!/bin/zsh
# Sets the unedited-video tool up on this Mac, for the Mac Studio or Sallie's laptop.
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
#                                    Video/<this Mac>, or BRIMM Video/Drop/<this Mac> once its settings name Drop (--drop,
#                                    below), which is made, with a marker that names this Mac, and each video dropped there
#                                    is imported into BRIMM Video/Episodes. This Mac's settings are written in
#                                    ~/Library/Application Support/BRIMM Video/settings.json. With --print, nothing is made.
#                                    It says whether Xcode's command line tools, Homebrew, Final Cut Pro and Claude Code's
#                                    sign-in are here, and what Jason does by hand for any that is not
# ./install.sh --machine "Mac Studio" --drop Drop "/path/to/The BRIMM DB/BRIMM Video"
#                                    switch this Mac's drop folder to BRIMM Video/Drop/<this Mac>, or back with --drop "Unedited
#                                    Video". The Mac then watches the new folder, and the old one is no longer watched and is
#                                    left as it is, for Jason to delete by hand once it is empty. A run with no --drop keeps the
#                                    folder the settings name. It is refused, before anything is changed, while the old folder
#                                    still holds a video, or an import of this Mac failed or found a problem: it says which,
#                                    and to deal with each first. Run it with --print first
# ./install.sh --machine "Mac Studio" --import light --handoff 2 "/path/to/The BRIMM DB/BRIMM Video"
#                                    write the import (light or full) and the version of the hand-off (1 or 2) in this Mac's
#                                    settings, with --drop's own rules: a setting that is not named is left as it is. With
#                                    --machine, --rules-only also writes readings off. These three options are for --machine only
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
# Where programs are looked for after this shell's PATH: Homebrew's two folders. A test names none, for a Mac without Homebrew.
HOMEBREW_DIRS="${BRIMM_HOMEBREW_DIRS-/opt/homebrew/bin:/usr/local/bin}"
# Final Cut Pro, which this Mac is checked for. A test names a made-up one.
FINAL_CUT="${BRIMM_FINAL_CUT:-/Applications/Final Cut Pro.app}"
# The Final Cut Pro the tool was checked with, and the macOS it needs (its LSMinimumSystemVersion).
FINAL_CUT_CHECKED="12.4"
FINAL_CUT_MACOS="26.6"
# The Claude Code her folder's guard needs: from 2.1.295 a hook that cannot run blocks the call (onFailure) rather than
# letting it through.
GUARD_CLAUDE="2.1.295"
HERE="${0:A:h}"
LOG="$HOME/Library/Logs/brimm-video.log"
# The one-shot launch agent that checks, once, at the end of a Mac's setup, that Claude answers from a launch agent's context.
CHECK_LABEL="com.thebrimm.claude-check"
CHECK_FILE="$HOME/Library/LaunchAgents/$CHECK_LABEL.plist"
CHECK_LOG="$HOME/Library/Logs/brimm-video-claude-check.log"
MODEL_DIR="$HOME/Library/Application Support/BRIMM Transcribe"
MODEL="$MODEL_DIR/ggml-large-v3-turbo.bin"
MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin"
# This Mac's settings for episodes, which settings.js writes and checks (and reads here, to see what a run would change), the
# folder for its work in Final Cut, and the checkout this runs from.
SETTINGS_FILE="$HOME/Library/Application Support/BRIMM Video/settings.json"
WORK="$HOME/BRIMM Video Work"
CHECKOUT="${HERE:h}"

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
# The settings of the switch, with --machine: each of --drop, --import and --handoff, and the value after it, kept as they are
# said for settings.js to read and check. An option with no value after it is named in switch_missing, refused below.
switch_options=()
switch_missing=""
while (( $# )); do
  arg="$1"
  shift
  case "$arg" in
    --print) print="yes" ;;
    --remove) mode="remove" ;;
    --rules-only) rules_only="$arg" ;;
    --yes) yes="yes" ;;
    --drop|--import|--handoff)
      if (( $# )) && [[ "$1" != -* ]]; then switch_options+=("$arg" "$1"); shift; else switch_missing="${switch_missing:-$arg}"; fi ;;
    --machine)
      machined="yes"
      if [[ "${1-}" == -* ]]; then machine_option="$1"; else machine="${1-}"; (( $# )) && shift; fi ;;
    # The help is the comment this file opens with, down to the line before the script begins.
    -h|--help) sed -n '2,/^set -euo pipefail$/p' "$0" | sed -e '$d' -e 's/^# \{0,1\}//'; exit 0 ;;
    -*) say "Not an option this script knows: $arg"; exit 2 ;;
    *) folders+=("${arg:A}") ;;
  esac
done
# The switch's options are for a Mac set up with --machine, and each needs the word after it.
if [[ -n "$switch_missing" ]]; then
  case "$switch_missing" in
    --drop) say 'Say which folder after --drop, as --drop Drop or --drop "Unedited Video".' ;;
    --import) say "Say which import after --import, as --import light or --import full." ;;
    --handoff) say "Say which version after --handoff, as --handoff 1 or --handoff 2." ;;
  esac
  exit 2
fi
if [[ ${#switch_options[@]} -gt 0 && "$machined" != "yes" ]]; then
  say '--drop, --import and --handoff are for one of the two Macs, set up with --machine: ./install.sh --machine "Mac Studio" --drop Drop "<path to BRIMM Video>"'
  exit 2
fi
# There is no folder it would watch without being told. Stopping the watching needs none.
if [[ ${#folders[@]} -eq 0 && "$mode" != "remove" && "$machined" != "yes" ]]; then
  say 'Name the folder to watch for unedited video: ./install.sh "<folder>"'
  exit 2
fi

xml() { print -rn -- "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }
find_program() {
  local name dir
  for name in "$@"; do
    for dir in ${(s.:.)PATH} ${(s.:.)HOMEBREW_DIRS}; do
      if [[ -x "$dir/$name" ]]; then print -r -- "$dir/$name"; return 0; fi
    done
  done
  return 1
}
# The value of a setting at the top of the JSON that settings.js writes, read from the standard input: nothing when there is none.
json_field() { plutil -extract "$1" raw -o - - 2>/dev/null || true; }
# Claude Code, where unedited.js finds it when a launch agent runs it: along the agent's own PATH, and then in .local/bin in
# the home folder, where Claude Code's own installer puts it. This shell's PATH may lead to one the agent never sees. A test
# names a stand-in in BRIMM_CLAUDE, so that no test runs the Claude Code of the Mac it runs on.
find_claude() {
  local dir
  if [[ -n "${BRIMM_CLAUDE-}" ]]; then print -r -- "$BRIMM_CLAUDE"; return 0; fi
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

# The one-shot launch agent of the check of Claude: unedited.js --check-claude, run once when it is loaded, with the main
# agent's PATH, into a log of its own. $1 is the node it is run with. It watches nothing, and is taken away once it has run.
# $2 is the time, in seconds since 1970, after which it asks Claude nothing (--until). launchd runs one that a kill -9 or a
# power cut left behind at every login, and past that time it only says in its log that Claude was not asked.
check_agent() {
  cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$CHECK_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(xml "$1")</string>
    <string>$(xml "$HERE/unedited.js")</string>
    <string>--check-claude</string>
    <string>--until</string>
    <string>$(xml "$2")</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$AGENT_PATH</string></dict>
  <key>StandardOutPath</key><string>$(xml "$CHECK_LOG")</string>
  <key>StandardErrorPath</key><string>$(xml "$CHECK_LOG")</string>
</dict>
</plist>
EOF
}
# Takes the check's launch agent away: stops it, if it is loaded, and deletes its file. The check does this once Claude has
# answered or the wait is over, a trap does it however else the setup ends, and --remove does it too.
drop_check() {
  launchctl bootout "gui/$(id -u)/$CHECK_LABEL" 2>/dev/null || true
  rm -f "$CHECK_FILE"
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
    if [[ -e "$CHECK_FILE" ]]; then
      say "  $CHECK_LABEL, and its file $CHECK_FILE, which a setup left behind"
    else
      say "  $CHECK_LABEL, if a setup left it behind"
    fi
    say ""
    say "Nothing was changed."
    exit 0
  fi
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$AGENT_FILE"
  # The setup's one-shot check of Claude, in case a setup that was cut short left it behind: launchd would run it at every login.
  drop_check
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
  # Node reads and checks this Mac's settings, so it is needed before anything is changed, when there are settings to read or the
  # switch's options are given. A Mac with none, told none, is set up as it always was: Homebrew installs node, and the settings
  # are written once it is here.
  node="$(find_program node || true)"
  if [[ -z "$node" && ( ${#switch_options[@]} -gt 0 || -e "$SETTINGS_FILE" ) ]]; then
    say "Node is not on this Mac, and the installer needs it to read and check this Mac's settings before it changes anything. Install it with Homebrew (brew install node; Homebrew is at https://brew.sh), then run this again."
    say ""
    say "Nothing was changed."
    exit 2
  fi
  # What settings.js is told, besides the Mac, BRIMM Video and the checkout: the settings of the switch, as they are said, and
  # --rules-only as readings off. A setting that is not told is left as the file has it, so no --rules-only never turns
  # readings on.
  switch_args=()
  [[ -z "$rules_only" ]] || switch_args+=(--readings off)
  switch_args+=("${switch_options[@]}")
  # The one check, before anything changes, with --print and without: settings.js says what it would write, or why it refuses
  # (a value that will not do, what is not built yet, and a switch of the drop folder while the old folder holds work). Its
  # answer is the settings shown below, and the drop folder is the one they name: --drop, else the settings', else Unedited Video.
  planned=""
  if [[ -n "$node" ]]; then
    if ! "$node" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; then
      say "Node here is $("$node" --version), and the tool needs 22 or later. Run: brew upgrade node"
      say ""
      say "Nothing was changed."
      exit 2
    fi
    # What it says is its standard output alone, which is read below: anything node says on its standard error, a warning or why
    # it could not run, goes to this one's own output as it comes (fd 3), and is never taken for the settings.
    if ! { planned="$("$node" "$HERE/settings.js" plan --machine "$machine" --root "$root" --checkout "$CHECKOUT" "${switch_args[@]}" 2>&3)"; } 3>&1; then
      say "$planned"
      say ""
      say "Nothing was changed."
      exit 2
    fi
  fi
  drop_name="$(print -rn -- "$planned" | json_field drop)"
  drop_name="${drop_name:-Unedited Video}"
  # The folder the settings name now, from which this run would switch: its folder is left as it is.
  old_drop_name="$({ json_field drop < "$SETTINGS_FILE"; } 2>/dev/null || true)"
  old_drop_name="${old_drop_name:-Unedited Video}"
  drop="$root/$drop_name/$machine"
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

# This Mac's settings for episodes, as JSON: what settings.js said it would write. A Mac with no node here has none of its own, no
# settings yet and no switch to make, so what is written is this Mac, BRIMM Video and the checkout, and readings off for --rules-only.
json() { print -rn -- "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }
settings_json() {
  if [[ -n "$planned" ]]; then print -r -- "$planned"; return 0; fi
  print -r -- "{"
  print -r -- "  \"version\": 1,"
  print -r -- "  \"machine\": \"$(json "$machine")\","
  print -r -- "  \"root\": \"$(json "$root")\","
  if [[ -n "$rules_only" ]]; then
    print -r -- "  \"checkout\": \"$(json "$CHECKOUT")\","
    print -r -- "  \"readings\": false"
  else
    print -r -- "  \"checkout\": \"$(json "$CHECKOUT")\""
  fi
  print -r -- "}"
}

say "The unedited-video tool"
if [[ -n "$machine" ]]; then
  say "  This Mac:  $machine"
  say "  BRIMM Video:  $root"
  say "  Its drop folder, to make in Dropbox and watch:  $drop"
  say "  Its marker there, $marker, saying:  $machine"
  # When the drop folder is switched, the one it was is no longer watched, and is left as it is: nothing in Dropbox is deleted.
  if [[ "$drop_name" != "$old_drop_name" && -d "$root/$old_drop_name/$machine" ]]; then
    say "  The old drop folder:  $root/$old_drop_name/$machine, no longer watched once this is done, and left as it is, for Jason to delete by hand once it is empty"
  fi
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
# For one of the two Macs, what it has of what the tool needs, and what Jason does by hand when something is not here. Nothing
# here installs Xcode's command line tools, Homebrew, Final Cut Pro or Claude Code, or signs in to Claude.
autoload -Uz is-at-least
# Why her folder for Claude is not written, when it is not: "" when it is.
studio_why=""
# Whether the setup ends with the check of Claude from a launch agent's context: when Claude Code is here, and never with
# --rules-only, which asks Claude nothing.
check_line=""
if [[ -n "$machine" ]]; then
  say "  Xcode's command line tools (git, swift):  $(xcode-select -p >/dev/null 2>&1 && echo "here already" || echo "not here. Jason runs: xcode-select --install")"
  if [[ -n "$brew" ]]; then
    say "  Homebrew:  here already"
  else
    say '  Homebrew:  not here. In Terminal, Sallie runs this (it asks for her password, which she types herself): /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
  fi
  macos="$(sw_vers -productVersion 2>/dev/null || true)"
  old_macos=""
  if [[ -n "$macos" ]] && ! is-at-least "$FINAL_CUT_MACOS" "$macos"; then old_macos="yes"; fi
  if [[ -z "$macos" ]]; then
    say "  macOS:  could not be read"
  elif [[ -n "$old_macos" ]]; then
    say "  macOS:  $macos; Final Cut Pro $FINAL_CUT_CHECKED needs macOS $FINAL_CUT_MACOS or later (System Settings > General > Software Update)"
  else
    say "  macOS:  $macos"
  fi
  if [[ ! -d "$FINAL_CUT" ]]; then
    say "  Final Cut Pro:  not here. Install it from the App Store (on her Apple ID, or shared by Family Sharing) before the first push."
  else
    version="$(plutil -extract CFBundleShortVersionString raw -o - "$FINAL_CUT/Contents/Info.plist" 2>/dev/null || true)"
    update="update it in App Store > Updates"
    [[ -z "$old_macos" ]] || update="update macOS first, then App Store > Updates"
    if [[ -n "$version" ]] && is-at-least "$FINAL_CUT_CHECKED" "$version"; then
      say "  Final Cut Pro:  $version, here"
    else
      say "  Final Cut Pro:  ${version:-of a version that could not be read}, here; phase 0 was checked with $FINAL_CUT_CHECKED: $update"
    fi
  fi
  # Whether Claude Code is signed in, and on which plan. Its email and its organisation are never shown. And its version: her
  # folder's guard blocks a call when it cannot run only on Claude Code new enough for that (onFailure), so her folder is
  # written only then.
  if claude="$(find_claude)"; then
    told="$("$claude" auth status --json 2>/dev/null || true)"
    signed="$(print -rn -- "$told" | plutil -extract loggedIn raw -o - - 2>/dev/null || true)"
    plan="$(print -rn -- "$told" | plutil -extract subscriptionType raw -o - - 2>/dev/null || true)"
    case "$signed" in
      true) say "  Claude Code, signed in:  yes${plan:+ ($plan)}" ;;
      false) say "  Claude Code, signed in:  no. In Terminal, run: claude auth login (Sallie signs in to her own Claude account in the browser; signing in to the Claude app does not sign in this command), then run this again." ;;
      *) say "  Claude Code, signed in:  could not be checked (claude auth status said nothing that could be read)" ;;
    esac
    [[ -n "$rules_only" ]] || check_line="yes"
    printed="$("$claude" --version 2>/dev/null || true)"
    claude_version="${printed%%[[:space:]]*}"
    if [[ ! "$claude_version" =~ '^[0-9]+(\.[0-9]+)+$' ]]; then
      studio_why="Claude Code's version could not be read"
      say "  Claude Code's version:  could not be read (claude --version), so the install does not write her folder for Claude."
    elif ! is-at-least "$GUARD_CLAUDE" "$claude_version"; then
      studio_why="Claude Code here is $claude_version, older than the $GUARD_CLAUDE her folder's guard needs. In Terminal: claude update, then run this again"
      say "  Claude Code's version:  $claude_version, older than the $GUARD_CLAUDE her folder's guard needs: on it the guard could let a call through. In Terminal: claude update, then run this again. Until then the install does not write her folder for Claude."
    else
      say "  Claude Code's version:  $claude_version (her folder's guard needs $GUARD_CLAUDE or later)"
    fi
  else
    studio_why="Claude Code is not here. Install it, then run this again"
    say "  Claude Code's version:  not here, so the install does not write her folder for Claude until it is."
  fi
  say "  Sallie's folder for Claude:  ~/BRIMM Video Studio (its CLAUDE.md, its settings that allow only edit.js, its skill, and Pictures/)"
  say "  The Claude app's Code tab:  runs its own copy of Claude Code, updated with the app, so the setup guide's \"Check that her Claude folder only runs BRIMM Video\", in the Code tab, is what proves her folder is locked down there"
  [[ -z "$check_line" ]] || say "  At the end:  one real call to Claude from the background job (a launch agent of its own, $CHECK_LABEL, taken away when it answers or after 90 seconds), to prove its sign-in is seen there"
  say "  By hand afterwards:  the setup guide (docs/setup/sallies-laptop.md)"
fi
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
# A check of Claude that an earlier setup left behind, cut short before it could take it away: by an installer from before
# the traps below, or by a kill -9. launchd runs it at every login. Every setup that goes ahead takes it away first.
[[ ! -e "$CHECK_FILE" ]] || say "  Left behind by an earlier setup:  its check of Claude, $CHECK_LABEL, at $CHECK_FILE. launchd runs it at every login, so this setup takes it away first"

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

# A check of Claude an earlier setup left behind is taken away before anything else, whatever this setup goes on to do: with
# --rules-only, or with no Claude Code here, it makes no check of its own, and it may stop before it reaches the check.
drop_check

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
# Mac's settings, its folders for Final Cut's work, and the folder for Claude, ~/BRIMM Video Studio.
if [[ -n "$machine" ]]; then
  mkdir -p "$root/Episodes/.importing" "$WORK/From Final Cut"
  "$node" "$HERE/settings.js" marker "$drop" "$machine"
  "$node" "$HERE/settings.js" write --machine "$machine" --root "$root" --checkout "$CHECKOUT" "${switch_args[@]}"
  if [[ -z "$studio_why" ]]; then "$node" "$HERE/settings.js" studio --node "$node"; fi
fi

agent "$node" > "$AGENT_FILE"
plutil -lint "$AGENT_FILE" >/dev/null
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$AGENT_FILE"

# The check of Claude from the background job: one real call, made by a launch agent of its own, which runs as the import's
# does, so that a sign-in it cannot see shows now and not at the first import. It is taken away when Claude answers or after
# 90 seconds. That agent runs whenever it is loaded, at every login too, so it must never be left behind: until the check
# has taken it away itself, traps take it away however else the setup ends. A failure ends the setup as it would anyway. A
# Ctrl-C or a kill ends it there too, with 130 or 143 as a shell does: zsh would otherwise go back to the wait once its trap
# had run, wait out the 90 seconds, blame Claude and say "Done". A kill -9 or a power cut runs no trap, and leaves the agent's
# file, which launchd then runs at every login. So the agent is given a time three minutes on, well after it has run here,
# and past it the agent asks Claude nothing. The next setup, which names it first, or --remove takes it away. Only a real
# setup makes the agent: never --print, and never a test. With --rules-only nothing is asked of Claude, so there is no check.
if [[ -n "$machine" && -z "$rules_only" ]] && claude="$(find_claude)"; then
  rm -f "$CHECK_LOG"
  trap drop_check EXIT
  trap 'drop_check; exit 130' INT
  trap 'drop_check; exit 143' TERM
  check_agent "$node" "$(( $(date +%s) + 180 ))" > "$CHECK_FILE"
  plutil -lint "$CHECK_FILE" >/dev/null
  launchctl bootout "gui/$(id -u)/$CHECK_LABEL" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$CHECK_FILE"
  say "Asking Claude once from the background job (up to 90 seconds)…"
  answered=""
  for (( waited = 0; waited < 90; waited++ )); do
    answered="$(grep -h -m 1 -e '^Claude answered from here' -e '^Claude could not be asked from here' "$CHECK_LOG" 2>/dev/null || true)"
    [[ -z "$answered" ]] || break
    sleep 1
  done
  drop_check
  trap - EXIT INT TERM
  say "From the background job: ${answered:-Claude did not answer within 90 seconds. What it said is in $CHECK_LOG.}"
fi

if [[ -n "$machine" ]]; then
  say ""
  say "Done. Drop a video in:"
  say "  $drop"
  say "Once, in Finder: Control-click that folder and choose Make available offline, so that a video dropped there from"
  say "another device is brought down at once. Dropbox offers no command for it."
  say "It is imported into $root/Episodes, in a folder of its own named for the day, the video and this Mac. Its files are"
  say "copied into Dropbox and checked again 15 minutes later, and only then is the video taken out of the drop folder. Then,"
  say "in Claude, say \"open\" and the video's name. What the tool did is in $LOG"
  if [[ "$drop_name" != "$old_drop_name" && -d "$root/$old_drop_name/$machine" ]]; then
    say "The old drop folder, $root/$old_drop_name/$machine, is no longer watched, and is left as it is. Delete it by hand once it is empty."
  fi
  if [[ -n "$studio_why" ]]; then
    say "Her folder for Claude was not written: $studio_why."
    exit 1
  fi
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
