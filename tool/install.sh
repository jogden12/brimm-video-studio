#!/bin/zsh
# Sets the unedited-video tool up on this Mac, for the Mac Studio or Sallie's laptop.
#
#   ./install.sh "/path/to/folder"   watch that folder for unedited video: unedited.js works on what lands there
#   ./install.sh "/path/to/folder" "/path/to/another"
#                                    watch more than one folder. Name every folder each time: the list replaces the last one
#   ./install.sh "/path/to/folder" --rules-only
#                                    the same (the import never asks Claude: each cut plan is the rules' alone; with --machine, her readings are also off)
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
#                                    It says whether Xcode's command line tools, Homebrew and
#                                    Claude Code's sign-in are here, what Jason does by hand for any that is not, and whether
#                                    the HyperFrames command line is here or would be installed, with what would then be done
#                                    about its Chrome and its doctor check
#   ./install.sh --machine "Mac Studio" --drop Drop "/path/to/The BRIMM DB/BRIMM Video"
#                                    switch this Mac's drop folder to BRIMM Video/Drop/<this Mac>, or back with --drop "Unedited
#                                    Video". The Mac then watches the new folder, and the old one is no longer watched and is
#                                    left as it is. The switch is refused while it holds a video; Jason checks it is still
#                                    empty, then deletes it by hand, so that none is dropped there by habit. A run with no
#                                    --drop keeps the folder the settings name. It is refused, before anything is changed, while the old folder
#                                    still holds a video, or an import of this Mac failed or found a problem: it says which,
#                                    and to deal with each first. Run it with --print first
#   ./install.sh --machine "Mac Studio" --drop-folder "/path/to/a/folder" [--exports-folder "/path/to/another"] "/path/to/The BRIMM DB/BRIMM Video"
#   ./install.sh --machine "Mac Studio" --switch-local "/path/to/The BRIMM DB/BRIMM Video"
#                                    switch this Mac to a drop folder of its own, on this Mac: the folder named (a whole path, made
#                                    when missing, whose parent is there), or with --switch-local the default, Drop in BRIMM Video
#                                    Work, whatever the settings say of the import (every import is light). It is marked as this
#                                    Mac's, and is watched in place of the folder in BRIMM Video, which is left as it is. It is
#                                    refused when it is, is inside or holds a folder of BRIMM Video, BRIMM VIDEO Transfer, BRIMM
#                                    VIDEO MacBook, BRIMM Video Work (but for Drop in it), her chat's folders, Zoom's, Downloads or
#                                    the exports folder; when it holds a video already, which would be imported at once, or cannot
#                                    be read, unless it is the folder this Mac watches now; when another Mac has marked it, or the
#                                    transcript tool's launch agent lists it; and, as for --drop, while the old folder holds a
#                                    video. A folder in Dropbox, iCloud Drive or another cloud folder is allowed with a warning:
#                                    every video dropped there goes up to that cloud. For a folder in a cloud folder, under Desktop
#                                    or Documents, or on another disk, macOS may ask whether node may read it, and again after node
#                                    is updated.
#                                    --exports-folder names where HyperFrames' exports are looked for besides Downloads (default
#                                    Downloads), a cloud folder too: never the drop folder, a folder inside it or one that holds
#                                    it, whether the drop folder is in Dropbox or on this Mac; and not Episodes, References, Drop
#                                    or Unedited Video in BRIMM Video, BRIMM Video Work, BRIMM VIDEO Transfer, BRIMM VIDEO MacBook,
#                                    a folder the transcript tool watches, her chat's folders, Zoom's, Studio's settings folder, or
#                                    a drop folder a Mac has marked as its own, nor a folder inside one. A Mac with a drop folder
#                                    of its own goes back to one in Dropbox only with --drop Drop (or "Unedited Video") and
#                                    --switch-back together. A run with no drop option keeps the folder the settings name. Run it
#                                    with --print first
#   ./install.sh --machine "Mac Studio" --import light --handoff 2 "/path/to/The BRIMM DB/BRIMM Video"
#                                    write the import (light; full is gone and refused) and the version of the hand-off (1 or 2) in this Mac's
#                                    settings, with --drop's own rules: a setting that is not named is left as it is. With
#                                    --machine, --rules-only also writes readings off. These three options are for --machine only
#   ./install.sh --machine "Sallie's laptop" --user-deny "/path/to/The BRIMM DB/BRIMM Video"
#                                    also add to her user settings, ~/.claude/settings.json, the Read deny rules for the places
#                                    her folder's open lock keeps from Claude, so that every Claude Code session on this Mac
#                                    takes them. Only where her folder gets the open lock, which --print says
#
# It installs ffmpeg, whisper-cpp and Node with Homebrew when they are missing, downloads the transcriber's model once (about
# 1.6 GB) when it is not here, and has the Mac run unedited.js whenever something lands in a watched folder. It asks before it
# installs or downloads. The model is the transcript tool's own, in the same place, so a Mac that has that tool has it
# already. With --machine it also installs the HyperFrames command line that tool/hyperframes.pin.json pins, with npm and none of
# the package's own scripts, into ~/BRIMM Video Work/.toolchain/hyperframes-<version>, unless that folder holds it already. It
# stops, and takes that folder away again, if the download's integrity string is not the pin's. It then has that command line
# find or fetch the Chrome it renders with, with its own browser ensure, into ~/.cache/hyperframes/chrome, and stops, before
# the Mac's drop folder, its settings and its launch agent are touched, if it cannot be had. Last it runs the command line's
# own doctor, whose words are shown for Jason and which does not stop the setup. A finished video is moved, with
# what was made of it, into a new folder named for the day, in the folder it was put in. It does not install Claude Code. A
# folder that the transcript tool's launch agent watches already is refused: whichever of the two tools looked first would
# file the video away. The launch agent is com.thebrimm.unedited, so a run replaces the one an earlier installer gave this Mac
# under that name, and what it does is in ~/Library/Logs/brimm-video.log.
# Nothing here needs a password or a key. No video and no sound ever leaves the Mac. The import is always the light one: nothing is
# sent to Claude when a video is dropped. Claude reads a video only once its person has said what it is, and never a session's file
# name; what is sent then is the words of the transcript with their times, the rules' plan, and the video's file name and length
# (never a session's), through Claude Code, on the Claude account signed in on this Mac. With --machine, --rules-only turns the
# readings off, so nothing leaves the Mac; in folder mode no reading is made.
set -euo pipefail

LABEL="com.thebrimm.unedited"
AGENT_FILE="$HOME/Library/LaunchAgents/$LABEL.plist"
# The transcript tool's launch agent. Its file, and that file turned off (.plist.off, by-hand check 88), are only ever read, for
# the folders they list: here (watched) and by settings.js transcriptFolders.
TRANSCRIBE_LABEL="com.thebrimm.transcribe"
# Where the launch agent looks for the programs. /usr/bin is on it for swift, which finds the faces for a Reel's crop.
# A test names other folders in BRIMM_AGENT_PATH: on a Mac that has Claude Code where Homebrew puts programs, that is the one
# way to see where else it is looked for.
AGENT_PATH="${BRIMM_AGENT_PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin}"
# Where programs are looked for after this shell's PATH: Homebrew's two folders. A test names none, for a Mac without Homebrew.
HOMEBREW_DIRS="${BRIMM_HOMEBREW_DIRS-/opt/homebrew/bin:/usr/local/bin}"
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
# work folder, and the checkout this runs from.
SETTINGS_FILE="$HOME/Library/Application Support/BRIMM Video/settings.json"
WORK="$HOME/BRIMM Video Work"
CHECKOUT="${HERE:h}"
# The Claude Code version her folder's open lock was checked on by hand in the Code tab, read from studio.js as the Claude model is
# from unedited.js: "" while it is null there. Until one is named every Mac's folder gets the strict lock, whatever its settings say
# (settings.js effectiveLock), and this says so.
OPEN_LOCK_CLAUDE="$(sed -n 's/^export const OPEN_LOCK_CLAUDE = "\([0-9][0-9.]*\)";$/\1/p' "$HERE/studio.js")"
# The HyperFrames command line this Mac is given (spec 5.3), as tool/hyperframes.pin.json pins it: its version, and the integrity
# string the npm registry gives that version. Read here with sed, as the line above is, so that a Mac with no node yet can say what it
# would install. Only the pin's own two lines are read: GSAP's, nested in the pin, are indented further. The folder is hyperframes.js's
# toolchainDir: one for each version, in the work folder, on this Mac's own disk and never in Dropbox. A pin that cannot be read is
# refused with --machine, before anything is changed.
HYPERFRAMES_VERSION="$(sed -n 's/^  "version": "\([^"]*\)",\{0,1\}$/\1/p' "$HERE/hyperframes.pin.json" 2>/dev/null || true)"
HYPERFRAMES_INTEGRITY="$(sed -n 's/^  "integrity": "\([^"]*\)",\{0,1\}$/\1/p' "$HERE/hyperframes.pin.json" 2>/dev/null || true)"
TOOLCHAIN="$WORK/.toolchain/hyperframes-$HYPERFRAMES_VERSION"
# The command line's program in that folder, the file node is given to run (hyperframes.js's cliPath): an absolute path, since the work
# folder is under the home folder. It is never reached through npx.
HYPERFRAMES_PROGRAM="$TOOLCHAIN/node_modules/hyperframes/bin/hyperframes.mjs"
# Where the command line keeps the Chrome it renders with: its own copy of a Chrome Headless Shell, in the home folder's cache, on this Mac's
# own disk and apart from any Chrome a person uses. The command line chooses it, and this only says so: it is read from the pinned package's
# code (its CACHE_DIR is the home folder's .cache/hyperframes/chrome), and the H0 render test also found it there by hand on the Mac
# Studio. Its `browser ensure` finds the Chrome there or fetches it there. When the pin moves, this is read again with the new package.
CHROME_DIR="$HOME/.cache/hyperframes/chrome"

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
# --switch-local: the drop folder on this Mac that is the default, Drop in BRIMM Video Work (expanded into --drop-folder below).
switch_local=""
# --user-deny: her user settings are given the Read deny rules of the places her folder's open lock keeps from Claude.
user_deny=""
# Set, with --machine, when her folder gets the open lock: the settings say open and a Claude Code is named for it.
open_lock=""
while (( $# )); do
  arg="$1"
  shift
  case "$arg" in
    --print) print="yes" ;;
    --remove) mode="remove" ;;
    --rules-only) rules_only="$arg" ;;
    --yes) yes="yes" ;;
    --user-deny) user_deny="yes" ;;
    --drop|--import|--handoff|--drop-folder|--exports-folder)
      if (( $# )) && [[ "$1" != -* ]]; then switch_options+=("$arg" "$1"); shift; else switch_missing="${switch_missing:-$arg}"; fi ;;
    # --switch-back goes with --drop, and --switch-local picks the default drop folder: both say what to do with no value.
    --switch-back) switch_options+=("$arg") ;;
    --switch-local) switch_local="yes" ;;
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
    --import) say "Say which import after --import, as --import light." ;;
    --handoff) say "Say which version after --handoff, as --handoff 1 or --handoff 2." ;;
    --drop-folder) say 'Say which folder after --drop-folder, as --drop-folder "<path>".' ;;
    --exports-folder) say 'Say which folder after --exports-folder, as --exports-folder "<path>".' ;;
  esac
  exit 2
fi
# The full import is gone (Phase 2, "Final Cut retired"): every import is the light one, so --import full is refused, whatever else
# is told, and nothing is changed.
for (( i = 1; i < ${#switch_options[@]}; i += 2 )); do
  if [[ "${switch_options[i]}" == "--import" && "${switch_options[i+1]}" == "full" ]]; then
    say "The full import is gone: this Mac imports lightly."
    exit 2
  fi
done
# --switch-local is the drop folder on this Mac that is the default, in BRIMM Video Work: it is --drop-folder with that path.
if [[ -n "$switch_local" ]]; then
  for o in "${switch_options[@]}"; do
    if [[ "$o" == (--drop|--drop-folder|--switch-back) ]]; then
      say "--switch-local picks the default drop folder on this Mac, so it does not go with --drop, --drop-folder or --switch-back."
      exit 2
    fi
  done
  switch_options+=(--drop-folder "$WORK/Drop")
fi
# --remove stops the watching and changes no settings: it takes none of them.
if [[ ${#switch_options[@]} -gt 0 && "$mode" == "remove" ]]; then
  say "--remove stops the watching and changes no settings, so it does not take --drop, --drop-folder, --exports-folder, --switch-back, --switch-local, --import or --handoff."
  exit 2
fi
if [[ ${#switch_options[@]} -gt 0 && "$machined" != "yes" ]]; then
  say '--drop, --drop-folder, --exports-folder, --switch-back, --switch-local, --import and --handoff are for one of the two Macs, set up with --machine: ./install.sh --machine "Mac Studio" --drop Drop "<path to BRIMM Video>"'
  exit 2
fi
# --user-deny changes her user settings, on one of the two Macs; --remove changes no settings.
if [[ -n "$user_deny" && "$mode" == "remove" ]]; then
  say "--remove stops the watching and changes no settings, so it does not take --user-deny."
  exit 2
fi
if [[ -n "$user_deny" && "$machined" != "yes" ]]; then
  say "--user-deny is for one of the two Macs, set up with --machine: ./install.sh --machine \"Sallie's laptop\" --user-deny \"<path to BRIMM Video>\""
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
# What settings.js says it would write, into $planned, asked of the node at $1: gives 0, or what it ends with, which is 1 when it
# refuses and then says why in $planned. What it says is its standard output alone, which is read; anything node says on its
# standard error, a warning or why it could not run, goes to this one's own output as it comes (fd 3), and is never taken for it.
settings_plan() {
  local code=0
  { planned="$("$1" "$HERE/settings.js" plan --machine "$machine" --root "$root" --checkout "$CHECKOUT" "${switch_args[@]}" 2>&3)" || code=$?; } 3>&1
  return $code
}
# What the settings settings.js would write ($planned) say of her folder's lock, a line each, as settings.js reads them (lockOf, webOf,
# proxyPortOf, zoomFolderOf): the lock, the web tools, the proxy port ("" for none), and last where Zoom keeps its recordings. Asked of
# the node at $1, which is given the tool's folder, never settings.js itself, which would then run as a command.
lock_facts() {
  print -r -- "$planned" | "$1" --input-type=module -e '
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const { lockOf, webOf, zoomFolderOf, proxyPortOf } = await import(pathToFileURL(join(process.argv[1], "settings.js")).href);
const s = JSON.parse(readFileSync(0, "utf8"));
process.stdout.write([lockOf(s), webOf(s), proxyPortOf(s) ?? "", zoomFolderOf(s, process.env.HOME)].join("\n") + "\n");
' "$HERE"
}
# Whether the node at $1 is older than 22, which the tool needs: gives 0 when it is, and with "say" as the second word says so too,
# as a refusal does. The one place its version is looked at.
node_old() {
  if "$1" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; then return 1; fi
  [[ "${2-}" != say ]] || say "Node here is $("$1" --version), and the tool needs 22 or later. Run: brew upgrade node"
  return 0
}
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

# What the folder $1 holds of the pinned HyperFrames command line, as the node at $2 reads it: the version installed, and the
# integrity string npm's lock file keeps for it, one to a line, each empty where there is none or what is there is not shaped as a
# version or an integrity string is. Nothing else a file holds is ever repeated. Nothing is written, and a node that is not here, or
# does not answer, says nothing.
toolchain_holds() {
  { [[ -x "$2" ]] && "$2" -e '
const { readFileSync } = require("node:fs");
const read = (file) => { try { return JSON.parse(readFileSync(process.argv[1] + "/" + file, "utf8")); } catch { return null; } };
const fit = (value, shape) => (typeof value === "string" && shape.test(value) ? value : "");
const installed = read("node_modules/hyperframes/package.json");
const locked = read("package-lock.json")?.packages?.["node_modules/hyperframes"];
console.log(fit(installed?.version, /^\d+\.\d+\.\d+$/) + "\n" + fit(locked?.integrity, /^sha512-[A-Za-z0-9+\/]{86}==$/));
' "$1" 2>/dev/null; } || true
}
# Whether the folder $1 holds the pinned command line: installed, at the pinned version, with its program, and with the pin's
# integrity string in npm's lock file, as the node at $2 reads them. Gives 0 when it does. The one place that is looked at: the
# summary says it, the real run leaves a folder that passes as it is, and checks what npm fetched with it before going on.
toolchain_here() {
  local -a held
  held=("${(@f)$(toolchain_holds "$1" "$2")}")
  [[ "${held[1]-}" == "$HYPERFRAMES_VERSION" && "${held[2]-}" == "$HYPERFRAMES_INTEGRITY" && -f "$1/node_modules/hyperframes/bin/hyperframes.mjs" ]]
}
# Takes the toolchain folder away again, after an install that failed or fetched what the pin does not name: that folder alone, the
# one for a version under .toolchain in the work folder, and nothing else, however $TOOLCHAIN came to be.
drop_toolchain() {
  [[ "$TOOLCHAIN" == "$WORK/.toolchain/hyperframes-"[0-9]* ]] || return 0
  rm -rf "$TOOLCHAIN"
}
# Runs the pinned HyperFrames command line with the arguments given, as the setup asks it twice (for its Chrome, and for its check):
# by node and the program's absolute path in the toolchain, never through npx, which would run whatever hyperframes it found first
# (spec 5.3). It is run in the variables hyperframes.js's childEnv gives it that never change, all that the command line does on its
# own off: telemetry, the skills download, its check for a newer version, its background install of one, and its install of a
# missing optional package (nothing is installed on a Mac but by this installer, on Jason's yes), as npm is run with telemetry off in
# the step that installs the command line; node's folder leads the PATH, so that it is the node that was checked. What it prints goes
# to the terminal as it comes, none of it is captured, and its exit status is this function's.
run_hyperframes() {
  env PATH="${node:h}:$PATH" HYPERFRAMES_NO_TELEMETRY=1 HYPERFRAMES_SKIP_SKILLS=1 HYPERFRAMES_NO_UPDATE_CHECK=1 HYPERFRAMES_NO_AUTO_INSTALL=1 HYPERFRAMES_NO_OPTIONAL_INSTALL=1 "$node" "$HYPERFRAMES_PROGRAM" "$@"
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

# The folders that a launch agent's file in this Mac's LaunchAgents lists, by the file's name ($1: the label and .plist, or .plist.off
# for one turned off), one to a line. None when there is no such file, or it cannot be read.
watched() {
  local file="$HOME/Library/LaunchAgents/$1" count i
  count="$(plutil -extract WatchPaths raw -o - "$file" 2>/dev/null)" || return 0
  [[ "$count" == <-> ]] || return 0
  for (( i = 0; i < count; i++ )); do plutil -extract "WatchPaths.$i" raw -o - "$file" 2>/dev/null || true; done
}

# Whether the folders $1 and $2 are one folder, however each is named: by their real paths (zsh's :A, as settings.js's
# realOf(resolve(...)): a link followed, `.` and `..` and a slash at the end taken away, a part not there yet kept as it is named),
# letter case folded, as dropFolderFault compares folders. The transcript tool's installer lists its folders by their real
# paths, and a drop folder picked with --drop-folder is kept as it was named, so the two are never compared as they are spelt.
same_folder() {
  local a="${1:A}" b="${2:A}"
  [[ "${(L)a}" == "${(L)b}" ]]
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
local_drop=""
exports_folder=""
cloud_name=""
files_access=""
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
  # The pin of the HyperFrames command line, read above, is looked at before anything is: a pin read as nothing would name no folder
  # and no version, and npm would be asked for hyperframes@, which is whichever version is newest.
  if [[ ! "$HYPERFRAMES_VERSION" =~ '^[0-9]+\.[0-9]+\.[0-9]+$' || ! "$HYPERFRAMES_INTEGRITY" =~ '^sha512-[A-Za-z0-9+/]{86}==$' ]]; then
    say "The pin of the HyperFrames command line, tool/hyperframes.pin.json, does not hold a version like 0.8.208 and the registry's integrity string for it, so the installer changed nothing."
    say ""
    say "Nothing was changed."
    exit 2
  fi
  for w in "${(@f)$(watched "$TRANSCRIBE_LABEL.plist")}"; do
    [[ -n "$w" ]] || continue
    if [[ "$root" == "$w" || "$root" == "$w"/* ]]; then
      say "BRIMM Video must not be inside a folder the transcript tool watches: $root is inside $w, which $TRANSCRIBE_LABEL watches. Put it beside BRIMM VIDEO Transfer."
      exit 2
    fi
  done
  # Node reads and checks this Mac's settings, so it is needed before anything is changed, when there are settings to read or the
  # switch's options are given. A node older than 22 cannot do it, and counts as none. A Mac with no settings, told none, is set
  # up as it always was: Homebrew installs node, or the real run refuses an old one, and the settings are written once it is here.
  node="$(find_program node || true)"
  settings_node="$node"
  if [[ -n "$node" ]] && node_old "$node"; then settings_node=""; fi
  if [[ -z "$settings_node" && ( ${#switch_options[@]} -gt 0 || -e "$SETTINGS_FILE" ) ]]; then
    if [[ -n "$node" ]]; then
      node_old "$node" say
    else
      say "Node is not on this Mac, and the installer needs it to read and check this Mac's settings before it changes anything. Install it with Homebrew (brew install node; Homebrew is at https://brew.sh), then run this again."
    fi
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
  # (a value that will not do, settings that will not do once written, and a switch of the drop folder while the old folder
  # holds work). Its answer is the settings shown below, and the drop folder is the one they name: --drop, else the settings',
  # else Unedited Video.
  planned=""
  if [[ -n "$settings_node" ]]; then
    if ! settings_plan "$settings_node"; then
      say "$planned"
      say ""
      say "Nothing was changed."
      exit 2
    fi
  fi
  # What settings.js says after the settings, a line each as it says them, read by their words and never as JSON: the import it will
  # be; the drop folder as it is now and as it will be (Drop, Unedited Video, or a whole path for a drop folder of this Mac's own);
  # the exports folder it will be, a whole path; then, each only when it applies and in this order, that the drop folder is in a
  # cloud folder (and which), that macOS may ask about reading it, and the whole path of the old drop folder, which it checked,
  # when the folder watched changes. What cannot be read refuses, and is never taken for today's import or Unedited Video. The
  # settings are the lines above. With no node, the settings written are today's. The old folder named below is that line's alone,
  # so that it is always the one checked: the folder of the Mac and BRIMM Video the settings name, not of those this run is told.
  old_drop_name="Unedited Video"
  drop_name="Unedited Video"
  exports_folder="$HOME/Downloads"
  cloud_name=""
  files_access=""
  old_folder=""
  if [[ -n "$settings_node" ]]; then
    plan_lines=("${(@f)planned}")
    import_at=0
    for (( i = 1; i <= ${#plan_lines[@]}; i++ )); do
      if [[ "${plan_lines[i]}" == "The import will be: "* ]]; then import_at=$i; break; fi
    done
    unreadable=""
    if (( import_at == 0 )); then
      unreadable="yes"
    else
      tail_lines=("${(@)plan_lines[import_at,-1]}")
      import_name="${tail_lines[1]#The import will be: }"
      old_drop_name="${tail_lines[2]-}"
      drop_name="${tail_lines[3]-}"
      exports_line="${tail_lines[4]-}"
      if [[ "$old_drop_name" != "The drop folder is now: "* || "$drop_name" != "The drop folder will be: "* || "$exports_line" != "The exports folder will be: "* ]]; then
        unreadable="yes"
      fi
      old_drop_name="${old_drop_name#The drop folder is now: }"
      drop_name="${drop_name#The drop folder will be: }"
      exports_folder="${exports_line#The exports folder will be: }"
      # The lines that follow, each at most once and in order: the cloud folder, Files and Folders access, the old drop folder.
      stage=0
      for line in "${(@)tail_lines[5,-1]}"; do
        if [[ "$line" == "The drop folder is in a cloud folder: "* && $stage -lt 1 ]]; then
          cloud_name="${line#The drop folder is in a cloud folder: }"
          stage=1
        elif [[ "$line" == "The drop folder needs Files and Folders access" && $stage -lt 2 ]]; then
          files_access="yes"
          stage=2
        elif [[ "$line" == "The old drop folder: "* && $stage -lt 3 ]]; then
          old_folder="${line#The old drop folder: }"
          stage=3
        else
          unreadable="yes"
        fi
      done
      if [[ "$import_name" != "light" || "$old_drop_name" != ("Drop"|"Unedited Video"|/*) || "$drop_name" != ("Drop"|"Unedited Video"|/*) ||
            "$exports_folder" != /* || ( -n "$old_folder" && "$old_folder" != /* ) || ( ( -n "$cloud_name" || -n "$files_access" ) && "$drop_name" != /* ) ]]; then
        unreadable="yes"
      fi
    fi
    if [[ -n "$unreadable" ]]; then
      say "The installer could not read what settings.js said of the import and the drop folder, so it changed nothing. It said:"
      say "$planned"
      say ""
      say "Nothing was changed."
      exit 2
    fi
    planned="${(F)plan_lines[1,import_at-1]}"
  fi
  # Her folder's lock, as the settings settings.js would write say it: open only when they say open and a Claude Code is named for the
  # open lock, as settings.js studio decides it. With no node, the settings are today's, which say nothing of it: strict.
  said_lock="strict"
  web_tools="held"
  proxy_port=""
  zoom_folder="$HOME/Documents/Zoom"
  if [[ -n "$planned" ]]; then
    lock_out="$(lock_facts "$settings_node")" || lock_out=""
    lock_lines=("${(@f)lock_out}")
    said_lock="${lock_lines[1]-}"
    web_tools="${lock_lines[2]-}"
    proxy_port="${lock_lines[3]-}"
    zoom_folder="${(F)lock_lines[4,-1]}"
    if [[ "$said_lock" != (strict|open) || "$web_tools" != (held|open) || ( -n "$proxy_port" && "$proxy_port" != <-> ) || "$zoom_folder" != /* ]]; then
      say "The installer could not read what settings.js said of her folder's lock, so it changed nothing."
      say ""
      say "Nothing was changed."
      exit 2
    fi
  fi
  [[ "$said_lock" != open || -z "$OPEN_LOCK_CLAUDE" ]] || open_lock="yes"
  zoom_shown="$zoom_folder"
  [[ "$zoom_folder" != "$HOME"/* ]] || zoom_shown="~/${zoom_folder#$HOME/}"
  # Her user settings' deny rules are those of the places the open lock keeps from Claude, so --user-deny is for the open lock alone.
  if [[ -n "$user_deny" && -z "$open_lock" ]]; then
    say "--user-deny adds deny rules for the places her folder's open lock keeps from Claude, and her folder gets the strict lock on this Mac, so it is not taken here."
    say ""
    say "Nothing was changed."
    exit 2
  fi
  # The folder watched: the whole path the settings name when the drop folder is this Mac's own, else this Mac's folder in BRIMM Video.
  local_drop=""
  if [[ "$drop_name" == /* ]]; then
    drop="$drop_name"
    local_drop="yes"
  else
    drop="$root/$drop_name/$machine"
  fi
  marker="$drop/.brimm-watched-by"
  if [[ -f "$marker" ]]; then
    owner="$(head -n 1 "$marker")"
    if [[ "$owner" != "$machine" ]]; then say "The folder $drop is watched by $owner already. A drop folder is watched by one Mac only."; exit 2; fi
  fi
  folders=("$drop")
fi

# The transcript tool's launch agent goes on watching its folders, and whichever tool looked first in a folder would file the
# video away. So a folder it watches already is refused, however either names it (same_folder): through a link, such as ~/Movies on
# the Mac Studio, with a slash at the end, or in other letter case. (A pick with a . or .. part never reaches this: settings.js
# refuses it first, and folder mode makes the pick real.) Only the comparison resolves paths: $folders, $drop, WatchPaths, --watch
# and dropPath keep the spelling they have. The agent's file turned off (.plist.off) is not read here: settings.js's count of what
# the folder holds speaks for it.
already=("${(@f)$(watched "$TRANSCRIBE_LABEL.plist")}")
for f in "${folders[@]}"; do
  for w in "${already[@]}"; do
    [[ -n "$w" ]] || continue
    if same_folder "$f" "$w"; then
      say "A folder is for transcripts or for unedited video, and not for both: $f is watched for transcripts already, by $TRANSCRIBE_LABEL. Take it off the transcript tool's list first, or name another folder."
      exit 2
    fi
  done
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

# What a drop folder in a cloud folder sends up to it, said in its warning in the summary and again after "Done" (Phase 3, L1c):
# every video dropped there, a session's recording too. A folder under Desktop or Documents is in iCloud Drive only while iCloud
# keeps Desktop & Documents, which a path cannot tell, so for it the sentence is an "if".
cloud_up="Every video dropped there goes up to that cloud, a client or group session's recording too."
if [[ "$cloud_name" == "iCloud Drive, if it keeps Desktop & Documents" ]]; then
  cloud_up="If it does, every video dropped there goes up to it, a client or group session's recording too."
fi

say "The unedited-video tool"
if [[ -n "$machine" ]]; then
  say "  This Mac:  $machine"
  say "  BRIMM Video:  $root"
  if [[ -n "$local_drop" ]]; then
    say "  Its drop folder, on this Mac:  $drop"
    [[ -z "$cloud_name" ]] || say "Warning: this drop folder is in $cloud_name. $cloud_up A video still syncing there can be imported late, or twice. A folder on this Mac is safer."
    [[ -z "$files_access" ]] || say "  Files and Folders:  macOS may ask whether node may read this folder, and again after node is updated: choose Allow each time (in System Settings, Privacy & Security, Files and Folders, if it was refused); it may ask the same of the app her chat runs in, the first time she asks what's waiting"
  else
    say "  Its drop folder, to make in Dropbox and watch:  $drop"
  fi
  say "  Exports from HyperFrames, looked for in:  $exports_folder"
  say "  Its marker there, $marker, saying:  $machine"
  # When the folder watched changes, the one it was is no longer watched, and is left as it is: nothing in Dropbox is deleted.
  if [[ -n "$old_folder" && -d "$old_folder" ]]; then
    say "  The old drop folder:  $old_folder, no longer watched once this is done, and left as it is. The check found no video in it now. Jason checks it is still empty, then deletes it by hand, so that no video is dropped there by habit: a video there is never imported"
  fi
  say "  Episodes, to make in Dropbox:  $root/Episodes"
  # A Mac with a drop folder of its own writes its status files on this Mac, so it makes none in Dropbox.
  [[ -n "$local_drop" ]] || say "  The import status files, to make in Dropbox:  $root/Episodes/.importing"
  say "  The reference folder, to make in Dropbox:  $root/References"
  if [[ -z "$local_drop" || "$cloud_name" == Dropbox ]]; then
    say "  Once, in Finder:  Control-click $drop and choose Make available offline, so that a video dropped there from another device is brought down at once"
  fi
  say "  This Mac's settings, in $SETTINGS_FILE:"
  settings_json
else
  for f in "${folders[@]}"; do say "  Folder to watch for unedited video:  $f"; done
fi
# swift finds the speaker's face for a Reel's crop. It comes with Xcode's command line tools, and nothing here installs it.
say "  Swift, to find the speaker's face:  $(xcode-select -p >/dev/null 2>&1 && echo "here already" || echo "not here, so a Reel is cropped at the centre of the picture. To get it: xcode-select --install")"
# For one of the two Macs, what it has of what the tool needs, and what Jason does by hand when something is not here. Nothing
# here installs Xcode's command line tools, Homebrew or Claude Code, or signs in to Claude.
autoload -Uz is-at-least
# Why her folder for Claude is not written, when it is not: "" when it is.
studio_why=""
# Set when her user settings were to be given the deny rules (--user-deny), and settings.js refused or could not.
user_deny_why=""
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
  if [[ -z "$macos" ]]; then
    say "  macOS:  could not be read"
  else
    say "  macOS:  $macos"
  fi
  # Whether this Mac's ffmpeg can make an HDR video standard, which the working copy of an iPhone's clip needs (an iPhone records HDR by
  # default): tool/workcopy.js has ffmpeg decode it with VideoToolbox (the videotoolbox hwaccel) and size it and make its colour BT.709
  # (the scale_vt filter), and refuses an HDR video on a Mac whose ffmpeg has either missing. It is said before the lines about the
  # HyperFrames command line, whose app the working copy is made for. ffmpeg is only asked for the two lists the working copy reads, which
  # change nothing, so --print asks them too; none of what ffmpeg says is repeated but its version. They are read as workcopy.js's
  # hasHwaccel and hasFilters read them (tests/install.test.js checks the two agree): a method is a line of its own, and a filter is a
  # name that follows the column of flags (two characters on ffmpeg 9.0.2, three before it, a few more allowed for) and has a V->V after
  # it, so that a word of a description or a name that only begins as scale_vt does is not it. A line of the legend is not a filter: its
  # name is "=".
  if [[ -z "$ffmpeg" ]]; then
    say "  HDR video:  ffmpeg is not here yet, so whether it can make an HDR video standard is looked at once it is installed: the working copy refuses an HDR video on a Mac whose ffmpeg cannot"
  else
    ffmpeg_hwaccels="$("$ffmpeg" -nostdin -hide_banner -hwaccels 2>/dev/null || true)"
    ffmpeg_filters="$("$ffmpeg" -nostdin -hide_banner -filters 2>/dev/null || true)"
    ffmpeg_said=("${(@f)$("$ffmpeg" -nostdin -hide_banner -version 2>/dev/null || true)}")
    ffmpeg_version="${ffmpeg_said[1]-}"
    ffmpeg_version="${ffmpeg_version%% Copyright*}"
    hwaccel_re=$'\n'"[[:space:]]*videotoolbox[[:space:]]*"$'\n'
    filter_re=$'\n'"[[:space:]]*[A-Za-z.]{2,5}[[:space:]]+scale_vt[[:space:]]+[^[:space:]]+->[^[:space:]]+"
    hdr_missing=()
    [[ $'\n'"$ffmpeg_hwaccels"$'\n' =~ $hwaccel_re ]] || hdr_missing+=("no videotoolbox hwaccel")
    [[ $'\n'"$ffmpeg_filters" =~ $filter_re ]] || hdr_missing+=("no scale_vt filter")
    hdr_whose="this Mac's ffmpeg${ffmpeg_version:+ ($ffmpeg_version)}"
    if (( ${#hdr_missing[@]} == 0 )); then
      say "  HDR video:  $hdr_whose can make an HDR video standard, which an iPhone's clip is by default: it has the videotoolbox hwaccel and the scale_vt filter that the working copy needs for it"
    else
      say "  HDR video:  $hdr_whose cannot make an HDR video standard, which an iPhone's clip is by default, so the working copy refuses every one: it has ${(j: and :)hdr_missing}. Jason: brew upgrade ffmpeg, which builds VideoToolbox in, or the clip is recorded in standard colour"
    fi
  fi
  # The pinned HyperFrames command line, in a folder of its own for its version: what would be installed there, and how the download
  # is checked, or that it is there already and kept. Only said here; the real run installs it (below), after node is in place. A
  # folder is "here already" by the one look the real run also takes (toolchain_here), so what is said is what is done.
  if toolchain_here "$TOOLCHAIN" "$node"; then
    say "  HyperFrames toolchain:  version $HYPERFRAMES_VERSION of its command line (not the app), here already in $TOOLCHAIN, and npm's lock file there holds the pin's integrity string, so it is left as it is"
  else
    say "  HyperFrames toolchain:  version $HYPERFRAMES_VERSION of its command line (not the app), to install in $TOOLCHAIN with npm, none of the package's own scripts run"
    say "  Its download is checked:  against the pin's integrity string, $HYPERFRAMES_INTEGRITY, in tool/hyperframes.pin.json. If they differ, the install stops, says so, and takes that folder away again"
  fi
  # The Chrome the command line renders with, and its own check of this Mac, once it is in place: said here, whether the command line is
  # here already or is to be installed, and run only by the real run (below), by the command line itself. This looks at neither: whether
  # the right Chrome is in its cache is for its own browser ensure to say, and a print runs nothing of the command line.
  say "  Its Chrome:  found, or fetched from storage.googleapis.com when it is not there, by the command line's own browser ensure, once the command line is in place: the Chrome Headless Shell it renders with, its own copy, kept in $CHROME_DIR (a Chrome you use is left alone). If it cannot be had, the setup stops there, before this Mac's drop folder, its settings and its launch agent are touched"
  say "  Its doctor check:  the command line's own doctor, run last, right after its Chrome. Its words are shown for Jason to read on each Mac, the installer reads none of them, and it does not stop the setup. It may say that a newer version of the command line is out: that is expected, since the pin moves only by a pull request. Nothing it suggests is installed here"
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
    elif [[ -n "$open_lock" ]] && ! is-at-least "$OPEN_LOCK_CLAUDE" "$claude_version"; then
      # The open lock was checked on that version by hand, and on none older.
      studio_why="Claude Code here is $claude_version, older than the $OPEN_LOCK_CLAUDE her folder's open lock was checked on. In Terminal: claude update, then run this again"
      say "  Claude Code's version:  $claude_version, older than the $OPEN_LOCK_CLAUDE her folder's open lock was checked on. In Terminal: claude update, then run this again. Until then the install does not write her folder for Claude."
    else
      say "  Claude Code's version:  $claude_version (her folder's guard needs $GUARD_CLAUDE or later${open_lock:+, and its open lock was checked on $OPEN_LOCK_CLAUDE})"
    fi
  else
    studio_why="Claude Code is not here. Install it, then run this again"
    say "  Claude Code's version:  not here, so the install does not write her folder for Claude until it is."
  fi
  # Which lock her folder gets, and for the open lock what it keeps from Claude, in Finder's words, and what it opens.
  if [[ -n "$open_lock" ]]; then
    say "  Sallie's folder for Claude:  ~/BRIMM Video Studio (its CLAUDE.md, its settings, its skill, and Pictures/)"
    say "  Her folder's lock:  open: Claude may help with anything but the never list, and its commands run in Claude Code's sandbox with no network"
    say "  The workshop, where Claude's commands write:  ~/BRIMM Video Workshop"
    say "  Kept from Claude in her folder:  BRIMM Video (all but Assets), BRIMM VIDEO Transfer, Zoom's recordings ($zoom_shown), Final Cut's backups, BRIMM Video Work, brimm-video's own settings, Claude's and the Claude app's own files, Dropbox's own files, brimm-video's logs, and the folders that hold secrets"
    if [[ "$web_tools" == open ]]; then
      say "  The web tools:  open"
    else
      say "  The web tools:  held (until node tool/settings.js studio --web open, on Jason's yes)"
    fi
    if [[ -n "$proxy_port" ]]; then
      say "  Her folder's proxy port:  $proxy_port, which nothing on this Mac may listen on"
    else
      say "  Her folder's proxy port:  picked when her folder is written"
    fi
    if [[ -n "$user_deny" ]]; then
      say "  Her user settings, ~/.claude/settings.json:  the Read deny rules for the places above, added (every Claude Code session on this Mac takes them; they hold Claude's file tools, not a script)"
    else
      say "  Her user settings:  left as they are (--user-deny adds deny rules for the places above)"
    fi
    say "  The Claude app's Code tab:  runs its own copy of Claude Code, updated with the app, so the setup guide's \"Check her Claude folder's open lock\", in the Code tab, is what proves her folder is locked down there"
  else
    say "  Sallie's folder for Claude:  ~/BRIMM Video Studio (its CLAUDE.md, its settings that allow only edit.js, its skill, and Pictures/)"
    say "  Her folder's lock:  strict (Claude runs only brimm-video's commands there)"
    [[ "$said_lock" != open ]] || say "  The open lock:  waits for the checks by hand in the Code tab (no Claude Code version is named for it yet), so her folder keeps the strict lock"
    say "  The Claude app's Code tab:  runs its own copy of Claude Code, updated with the app, so the setup guide's \"Check that her Claude folder only runs BRIMM Video\", in the Code tab, is what proves her folder is locked down there"
  fi
  # That copy: the app keeps each in a folder named for its version, and runs the newest. It is only said; the Terminal's version
  # above decides whether her folder is written, and /status in the Code tab says which copy runs.
  app_newest=""
  for v in "$HOME/Library/Application Support/Claude/claude-code/"*(N/:t); do
    [[ "$v" =~ '^[0-9]+(\.[0-9]+)+$' ]] || continue
    if [[ -z "$app_newest" ]] || is-at-least "$app_newest" "$v"; then app_newest="$v"; fi
  done
  if [[ -z "$app_newest" ]]; then
    say "  The Claude app's own Claude Code:  no copy found here (in ~/Library/Application Support/Claude/claude-code), so only /status in the Code tab can say its version"
  elif [[ -n "$open_lock" ]] && ! is-at-least "$OPEN_LOCK_CLAUDE" "$app_newest"; then
    # The Code tab runs that copy, and the open lock was checked on none older: her folder is not written with it.
    studio_why="${studio_why:-The Claude app's own Claude Code is $app_newest, older than the $OPEN_LOCK_CLAUDE her folder's open lock was checked on. In the app, choose Claude > Check for Updates, then run this again}"
    say "  The Claude app's own Claude Code:  $app_newest, the newest copy the app keeps here, older than the $OPEN_LOCK_CLAUDE her folder's open lock was checked on. In the app, choose Claude > Check for Updates, then run this again. Until then the install does not write her folder for Claude."
  elif ! is-at-least "$GUARD_CLAUDE" "$app_newest"; then
    say "  The Claude app's own Claude Code:  $app_newest, the newest copy the app keeps here, older than the $GUARD_CLAUDE her folder's guard needs: on it the guard could let a call through. In the app, choose Claude > Check for Updates, then check /status in the Code tab"
  else
    say "  The Claude app's own Claude Code:  $app_newest, the newest copy the app keeps here (her folder's guard needs $GUARD_CLAUDE or later; /status in the Code tab says which copy runs)"
  fi
  [[ -z "$check_line" ]] || say "  At the end:  one real call to Claude from the background job (a launch agent of its own, $CHECK_LABEL, taken away when it answers or after 90 seconds), to prove that the sign-in her readings use is seen there (the import itself never asks Claude)"
  say "  By hand afterwards:  the setup guide (docs/setup/sallies-laptop.md)"
fi
# Claude reads a video through Claude Code once its person has said what it is. Nothing here installs that or signs in to it. When
# Claude is going to be asked, this says what is sent to it, before anything is changed. The import itself sends nothing.
if [[ -n "$rules_only" ]]; then
  say "  Claude, to read a video once its person has said what it is:  not asked (--rules-only: no reading is made in folder mode, and with --machine readings are off), so nothing leaves this Mac"
elif claude="$(find_claude)"; then
  say "  Claude Code, to read a video once its person has said what it is:  here already, at $claude"
  say "  Sent to Claude:  nothing when a video is dropped, since this Mac's import is the light one. Claude reads a video only once its person has said what it is, on the Claude account signed in on this Mac, and never a session's file name. The video and its sound never leave it. To send nothing: --rules-only"
  say "  Claude model, named in unedited.js:  $(sed -n 's/^export const CLAUDE_MODEL = "\(.*\)";$/\1/p' "$HERE/unedited.js")"
else
  say "  Claude Code, to read a video once its person has said what it is:  not here, so nothing leaves this Mac. To have Claude read it: install Claude Code and sign in to it on this Mac"
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
if node_old "$node" say; then
  exit 1
fi

# For one of the two Macs, the pinned HyperFrames command line (tool/hyperframes.pin.json), in a folder of its own for its version on
# this Mac's disk, to be run by its path. npm fetches it with none of the package's own scripts run, and what it fetched must be the
# pinned version, carry the pin's integrity string and have its program, before anything is done with it: if it does not, that folder
# is taken away again and the setup stops here, before this Mac's drop folder, settings and launch agent are touched. A folder that
# holds all three already is left as it is, which --print says. A pin that cannot be read was refused at the start.
if [[ -n "$machine" ]] && ! toolchain_here "$TOOLCHAIN" "$node"; then
  npm="${node:h}/npm"
  [[ -x "$npm" ]] || npm="$(find_program npm || true)"
  if [[ -z "$npm" ]]; then
    say ""
    say "npm is not here, and it is what installs the HyperFrames command line. It comes with Node: run brew reinstall node, then run this again."
    exit 1
  fi
  say "Installing the HyperFrames command line $HYPERFRAMES_VERSION. This is done once."
  mkdir -p "$TOOLCHAIN"
  if ! env PATH="${node:h}:$PATH" HYPERFRAMES_NO_TELEMETRY=1 "$npm" install --prefix "$TOOLCHAIN" --ignore-scripts --no-fund --no-audit --save-exact "hyperframes@$HYPERFRAMES_VERSION"; then
    drop_toolchain
    say ""
    say "npm could not install the HyperFrames command line $HYPERFRAMES_VERSION (what it said is above), so $TOOLCHAIN was taken away again. Stopped before this Mac's drop folder, its settings and its launch agent were touched: they are as they were. What this run installed first stays. Check that this Mac is online, then run this again."
    exit 1
  fi
  if ! toolchain_here "$TOOLCHAIN" "$node"; then
    fetched=("${(@f)$(toolchain_holds "$TOOLCHAIN" "$node")}")
    program="there"
    [[ -f "$TOOLCHAIN/node_modules/hyperframes/bin/hyperframes.mjs" ]] || program="missing"
    drop_toolchain
    say ""
    say "What npm fetched is not the pinned HyperFrames command line (its version, the integrity string in npm's lock file and its program are each checked), so it was not kept, and $TOOLCHAIN was taken away again. The pin, tool/hyperframes.pin.json, says version $HYPERFRAMES_VERSION and $HYPERFRAMES_INTEGRITY. What npm left says version ${fetched[1]:-none that could be read} and ${fetched[2]:-no integrity string that could be read}, and its program, bin/hyperframes.mjs, is $program. None of the package's own scripts were run. Stopped before this Mac's drop folder, its settings and its launch agent were touched: they are as they were. What this run installed first stays. Jason looks at which registry npm used (npm config get registry), then runs this again."
    exit 1
  fi
  say "The HyperFrames command line $HYPERFRAMES_VERSION is installed in $TOOLCHAIN, and what npm fetched carries the pin's integrity string."
fi

# For one of the two Macs, with the pinned command line in place and checked (installed above, or here already): the Chrome it renders with,
# and then its own check of this Mac. Its `browser ensure` finds that Chrome in its own cache folder (CHROME_DIR) or fetches it there
# once, and never turns to a Chrome a person uses. When the Chrome cannot be had the setup stops here, before this Mac's drop folder,
# settings and launch agent are touched; the command line stays, installed and checked. Its `doctor` comes last and only shows what it
# says: its words are for Jason, who reads them on each Mac, and nothing is read from them (there is no capture of its output), so
# whatever status it ends with, the setup goes on. Both are run by run_hyperframes. Only a real run does this, on Jason's yes: a print
# and a test never run the command line.
if [[ -n "$machine" ]]; then
  say ""
  say "Having the HyperFrames command line find or fetch the Chrome it renders with. When it is not there already, it is fetched, once, from storage.googleapis.com into $CHROME_DIR."
  if ! run_hyperframes browser ensure; then
    say ""
    say "The HyperFrames command line could not find or fetch its Chrome (what it said is above). The command line $HYPERFRAMES_VERSION stays in $TOOLCHAIN: it is installed, and was checked against the pin. Stopped before this Mac's drop folder, its settings and its launch agent were touched: they are as they were. What this run installed first stays. Check that this Mac is online and has room for the download, then run this again: the command line is here, so only its Chrome is asked for again."
    exit 1
  fi
  say ""
  say "Its own check of this Mac, doctor. What it says is for Jason to read, and it does not stop the setup:"
  doctor_status=0
  run_hyperframes doctor || doctor_status=$?
  say ""
  if (( doctor_status != 0 )); then say "doctor ended with status $doctor_status (what it said is above). That does not stop the setup."; fi
  say "That is all doctor says. The setup reads none of it and installs nothing it suggests. Jason looks for a tick against Node.js, FFmpeg, FFprobe and Chrome; a cross against whisper-cpp, TTS, BGM or Docker is expected, and so is one against Version when a newer command line is out, since the pin moves only by a pull request."
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

# Things can change while the programs, the command line and the model are fetched, and the first check was made before the
# question: a video may have come into the old drop folder. So it is made again, right before the folders and the marker are made.
# Nothing of this Mac's drop folder, settings or launch agent has been touched yet.
if [[ -n "$machine" ]]; then
  if ! settings_plan "$node"; then
    say ""
    say "$planned"
    say ""
    say "Stopped before this Mac's drop folder, its settings and its launch agent were touched: they are as they were. What this run installed or downloaded first stays. Deal with what is said above, then run this again."
    exit 1
  fi
fi

# Give the Mac the launch agent: write its file, check it, stop the agent of that name if one is running, and start this one.
mkdir -p "${folders[@]}" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
# For one of the two Macs: Episodes and its status files in Dropbox, the reference folder (References: Studio only reads it), the
# marker by the rule for writing into Dropbox, this Mac's settings, and the folder for Claude,
# ~/BRIMM Video Studio.
if [[ -n "$machine" ]]; then
  mkdir -p "$root/Episodes" "$root/References"
  [[ -n "$local_drop" ]] || mkdir -p "$root/Episodes/.importing"
  "$node" "$HERE/settings.js" marker "$drop" "$machine"
  # It checks the old drop folder once more, and may still refuse: the marker is made, and the settings and the agent are not.
  if ! "$node" "$HERE/settings.js" write --machine "$machine" --root "$root" --checkout "$CHECKOUT" "${switch_args[@]}"; then
    say ""
    say "The settings were not written, so they and the launch agent are as they were. This run did make $drop and its marker, and the folders for Episodes and its status files and for the reference pictures, which a later run uses. Deal with what is said above, then run this again."
    exit 1
  fi
  if [[ -z "$studio_why" ]]; then "$node" "$HERE/settings.js" studio --node "$node"; fi
  # With --user-deny, her user settings' deny rules, added by settings.js, which refuses user settings it cannot read and then adds none.
  # Only when her folder was written: with studio_why set it was not, and the rules are those of the places its open lock keeps.
  if [[ -n "$user_deny" && -z "$studio_why" ]] && ! "$node" "$HERE/settings.js" user-deny; then user_deny_why="yes"; fi
fi

agent "$node" > "$AGENT_FILE"
plutil -lint "$AGENT_FILE" >/dev/null
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$AGENT_FILE"

# The check of Claude from the background job: one real call, made by a launch agent of its own, which runs as the readings'
# Claude does (the import never asks Claude now; her readings do), so that a sign-in it cannot see shows now and not at the first reading. It is taken away when Claude answers or after
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
  if [[ -z "$local_drop" || "$cloud_name" == Dropbox ]]; then
    say "Once, in Finder: Control-click that folder and choose Make available offline, so that a video dropped there from"
    say "another device is brought down at once. Dropbox offers no command for it."
  fi
  [[ -z "$cloud_name" ]] || say "Warning: this drop folder is in $cloud_name. $cloud_up A video still syncing there can be imported late, or twice. A folder on this Mac is safer."
  say "It is imported into $root/Episodes, in a folder of its own named for the day, the video and this Mac. Its files are"
  say "copied into Dropbox and checked again 15 minutes later, and only then is the video taken out of the drop folder. Then,"
  say "in Claude, say \"what's waiting?\". What the tool did is in $LOG"
  if [[ -n "$old_folder" && -d "$old_folder" ]]; then
    say "The old drop folder, $old_folder, is no longer watched. Jason checks it is still empty, then deletes it by hand, so that no video is dropped there by habit: a video there is never imported."
  fi
  if [[ -n "$user_deny_why" ]]; then
    say "Her user settings were not given the deny rules: settings.js said why, above."
    [[ -n "$studio_why" ]] || exit 1
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
say "which says what is suggested to cut, and <name>.rough-cut.srt, the captions of the video as it would be cut. No video is"
say "made, and Claude is not asked. What the tool did is in $LOG"
