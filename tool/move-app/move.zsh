#!/bin/zsh
# Moves Sallie's laptop or Jason's MacBook from brimm-video to Studio (or sets a Mac that has no brimm-video up fresh, as Jason's
# MacBook), one asked step at a time, in a Terminal window. It is the heart of the small Mac app "Move to Studio", which hands
# this script to Terminal.
#
#   zsh move.zsh --commit <40 characters>
#                                    do the move. --commit is the commit of Studio that this app was made at: the code that is
#                                    cloned is that commit and no other
#   zsh move.zsh --commit <40 characters> --print
#                                    look, say what it would do in order, and change nothing: no log, no report, no key, no
#                                    clone, and no question. A look that would stop the real run stops this one too
#
# Each step looks first, says what it will change, and asks before it changes it. Answer y and press Return to go ahead. Step 5's two
# questions (the drop folder, the exports folder) also take c: it opens macOS's own window to choose the folder.
# Anything else, an empty line, or the end of input is no: the run stops, says what it changed (nothing, before the first
# change), and runs again from where it stopped when it is started again. Control-C stops it the same way.
# Nothing here prints, logs or writes the private half of Studio's key, the Claude account's email or organisation, or the name
# of a file in the drop folder. What it says is also kept in ~/Library/Logs/brimm-video-studio-move.log.
# Exit: 0 finished (or --print done); 1 stopped; 2 refused before anything (an option, not a Mac, not one of the two MacBooks).
set -euo pipefail

# The values this app works from, each set once, here.
# The two Macs this app is for, named once. A Mac with no brimm-video settings is set up fresh as FRESH_MACHINE.
MACHINES=("Sallie's laptop" "Jason's MacBook")
FRESH_MACHINE="Jason's MacBook"
# Set once the Mac is known (which_mac): its name and Studio's key comment. The installer's options are set by set_install_options,
# once step 5 has asked its two questions.
MACHINE="" KEY_COMMENT="" INSTALL_OPTIONS=()
FRESH=""             # set by which_mac on a Mac with no brimm-video settings
SET_UP_FRESH=""      # yes on a Mac set up fresh: FRESH on its first run, and on a later run (the settings are there) the mark fresh=yes
STUDIO_URL="${BRIMM_STUDIO_REPO:-git@github-brimm-video-studio:jogden12/brimm-video-studio.git}"
HOST_ALIAS="github-brimm-video-studio"
KEY="$HOME/.ssh/brimm_video_studio_deploy"
OLD_KEY="$HOME/.ssh/brimm_video_deploy"
GITHUB_HOST_KEY="github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl"
GITHUB_FINGERPRINT="SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU"
STUDIO="$HOME/Claude Code/brimm-video-studio"
PARTIAL="$STUDIO.partial"
OLD_CHECKOUT="$HOME/Claude Code/BRIMM video"
SETTINGS="$HOME/Library/Application Support/BRIMM Video/settings.json"
LOG="$HOME/Library/Logs/brimm-video-studio-move.log"
REPORT="$HOME/Desktop/Studio move report.txt"
PUBLIC_COPY="$HOME/Desktop/Studio key (public half).txt"
MARKS="$STUDIO/.git/move-to-studio"
# The installer's options are written in set_install_options and nowhere else, so that a later round changes one line.
HF_APP="${BRIMM_HYPERFRAMES_APP:-/Applications/HyperFrames.app}"
HF_PAGE="https://hyperframes.dev/studio"
CHECK_FILE="$HOME/Library/LaunchAgents/com.thebrimm.claude-check.plist"
AGENT_FILE="$HOME/Library/LaunchAgents/com.thebrimm.unedited.plist"
# Where programs are looked for after PATH: Homebrew's two folders. A test names none.
HOMEBREW_DIRS="${BRIMM_HOMEBREW_DIRS-/opt/homebrew/bin:/usr/local/bin}"
# ssh and git always use her own files, never the ones of the home folder the passwd database names (a Terminal can be started
# with another HOME). StrictHostKeyChecking=yes with her known_hosts, so that a host that is not GitHub's is never trusted.
SSH_OPTS=(-F "$HOME/.ssh/config" -o "UserKnownHostsFile=$HOME/.ssh/known_hosts" -o StrictHostKeyChecking=yes -o HostKeyAlgorithms=ssh-ed25519 -o BatchMode=yes)
# Given to the clone alone (not exported), so that Studio's tests, the installer, brew and npm do not inherit it. Not named GIT_SSH,
# git's own variable: a GIT_SSH her shell exports would be overwritten for every program started after.
CLONE_SSH="ssh ${(j: :)${(@q)SSH_OPTS}}"

SELF="${(%):-%x}"
# The small helper app that shows macOS's folder chooser, inside this app. BRIMM_CHOOSER_APP is only for tests. CHOOSER_ROUTE names
# which way of showing it goes first: app (started the way Finder starts an app) or program (its program run directly).
CHOOSER_APP="${BRIMM_CHOOSER_APP:-${SELF:A:h}/Choose a Folder.app}"
CHOOSER_ROUTE=app
# State of the run.
PRINT_ONLY=""        # set by --print: nothing is changed, written or asked
LOGGING=""           # set once the run is a real one that has been let through: what is said is also kept in $LOG
COMMIT=""
changed=()           # each change this run made, in words, for the stop summary
made_partial=""      # set when this run made $PARTIAL, so that a Ctrl-C takes it away again
R_MACOS="" R_DISK="" R_SETTINGS="" R_COUNT="" R_PLAN=""   # the report's lines for check 41, in the By-Hand page's own words
R48="not asked yet"  # the report's line for check 48: what happened to brimm-video's old key
R42_COMMIT="" R42_TESTS=""   # the report's lines for the code: the commit (short sha and subject), and the tests' ℹ summary lines
R42_KEY="" R42_SSH=""   # the report's lines for check 42: whether the key is on GitHub and how, and what ssh -T printed
ROOT="" DROP="" CHECKOUT_NOW="" NODE="" CLAUDE=""
R43_VERSION=""       # the report's line for check 43: the HyperFrames app's version
R44_PRINT="" R44_RAN="" R44_AGENT="" R44_APP=""   # the report's lines for check 44: the print's lines that matter, the install's last lines, the one-shot check, and turning HyperFrames on
CAND="" CAND_FROM="" QUESTION_LINES="" QUESTION_PROMPT=""   # what y gives for a question, and the question's words
THROWN=0             # keys typed while a chooser was open, thrown away
CHOSEN=""            # the folder the chooser gave, made whole
ANSWER=""            # y or c, from ask_y_or_c
EXPORTS_PASSED_OVER=""   # yes when the exports check passed over a place Terminal could not look in
FAULT_KIND="" FAULT_WORDS="" FAULT_REASON=""   # why a folder will not do (empty when it will), set by the checks of a pick: the refusal in the app's words, and its reason alone as a clause
DROP_FOLDER="" EXPORTS_FOLDER=""   # the folders step 5 gives the installer, whole paths
DROP_KEPT="" EXPORTS_KEPT=""       # yes when the settings' own folder is kept
DROP_FROM="" EXPORTS_FROM=""       # where each came from: suggested, settings, last or picked
REFUSED=""                         # what a refused print sends back to: exports, drop, nested, or empty for a stop
CLOUD_OK_FOR=""                    # the real path of the drop folder that was answered y at the cloud question, for this run
R44_CLOUD=""                       # the report's Cloud warning line
R44_DROP="" R44_EXPORTS=""         # the report's Drop folder and Exports folder lines
INSTALL_STARTED=""                 # yes once the real installer has been started on this run (the marks are written just before)
BACKGROUND_SEEN=""                 # yes once the installer's output held its "From the background job:" line: the launch agent was started
START_DROP=""                      # the real path of the drop folder at the start of the run, when step 1 counts it (none on a Mac set up fresh)

say() {
  print -r -- "$@" 2>/dev/null || true
  [[ -z "$LOGGING" ]] || print -r -- "$@" >> "$LOG"
  return 0
}
heading() { say ""; say "$1"; }
would() { [[ -z "$PRINT_ONLY" ]] || say "Would $1"; return 0; }
done_already() { say "Already done: $1"; }

# What this run changed, said the same way when it stops and when it is interrupted.
summary() {
  local new_drop=""
  local -a folders
  # After the installer started, where the drop folder is now: Studio's own settings say. Nothing here waits, asks or counts the old folder.
  if [[ -n "$INSTALL_STARTED" ]]; then
    folders=("${(@f)$(show_folders)}")
    new_drop="${folders[1]-}"
  fi
  if (( ${#changed[@]} == 0 )); then
    say "Stopped. This run changed nothing."
  else
    say "Stopped. This run changed:"
    local c
    for c in "${changed[@]}"; do say "  - $c"; done
  fi
  if [[ -n "$INSTALL_STARTED" ]]; then
    if [[ -z "$BACKGROUND_SEEN" ]]; then
      say "Move to Studio has not finished, so a video dropped now may not be imported. Drop no video until it has finished: double-click it again now."
    elif [[ -n "$new_drop" && "${new_drop:A}" != "$START_DROP" ]]; then
      say "This Mac's drop folder is now $(words_for "$new_drop")."
      if [[ -z "$SET_UP_FRESH" ]]; then say "Videos put in Drop › $MACHINE in Dropbox are no longer imported."; fi
    fi
  fi
  say "Double-click Move to Studio again to go on from here."
}
stop_here() {
  [[ -z "${1-}" ]] || say "$1"
  summary
  exit 1
}
# Ctrl-C, a kill, and closing the Terminal window (HUP): a clone this run was part way through is taken away, so the next run
# starts clean. That comes before the first word said, since after a closed window there may be nobody to say it to.
interrupted() {
  [[ -z "$made_partial" || -z "$PARTIAL" ]] || rm -rf "$PARTIAL"
  say ""
  summary
  exit $1
}
on_int() { interrupted 130; }
on_term() { interrupted 143; }
on_hup() { interrupted 129; }

# Asks to go ahead with what $1 says will change. One line is read from the terminal: y or yes, in any case, with spaces round
# it, goes ahead; anything else, an empty line, or the end of input stops. Under --print nothing is asked.
# Succeeds on a yes and fails on anything else, and stops nothing: for a question whose no is not a stop. $2 is the prompt.
ask_yes() {
  local line="" prompt="${2-Go ahead? Type y and press Return, or n to stop: }"
  say "$1"
  print -rn -- "$prompt"
  [[ -z "$LOGGING" ]] || print -rn -- "$prompt" >> "$LOG"
  IFS= read -r line || true
  # A line from a pipe has no Return of its own on screen. The log keeps the answer (a y or an n, never a secret) and ends the line.
  [[ -t 0 ]] || print -r -- ""
  [[ -z "$LOGGING" ]] || print -r -- "$line" >> "$LOG"
  [[ "${(L)line}" =~ '^[[:space:]]*(y|yes)[[:space:]]*$' ]]
}
ask() { ask_yes "$1" || stop_here; }
# Waits for something done by hand: an empty line goes on, anything else stops.
wait_for() {
  local line=""
  say "$1"
  print -rn -- "Press Return when that's done, or type n and press Return to stop: "
  [[ -z "$LOGGING" ]] || print -rn -- "Press Return when that's done, or type n and press Return to stop: " >> "$LOG"
  IFS= read -r line || line="${line:-n}"
  [[ -t 0 ]] || print -r -- ""
  [[ -z "$LOGGING" ]] || print -r -- "$line" >> "$LOG"
  [[ -z "${line//[[:space:]]/}" ]] || stop_here
}

# The words for a write to the Desktop that macOS refused.
desktop_stop() {
  stop_here "The Desktop could not be written to. macOS may have asked whether Terminal may write there, and the answer may have been no. Allow it in System Settings › Privacy & Security › Files and Folders, then run the app again."
}

# Programs, as install.sh finds them: along PATH, then Homebrew's folders.
find_program() {
  local name dir
  for name in "$@"; do
    for dir in ${(s.:.)PATH} ${(s.:.)HOMEBREW_DIRS}; do
      if [[ -x "$dir/$name" ]]; then print -r -- "$dir/$name"; return 0; fi
    done
  done
  return 1
}
# Claude Code, where the launch agent will find it: $BRIMM_CLAUDE (a test's stand-in), else along the agent's own PATH, then
# .local/bin in the home folder, where Claude Code's own installer puts it.
find_claude() {
  local dir
  if [[ -n "${BRIMM_CLAUDE-}" ]]; then print -r -- "$BRIMM_CLAUDE"; return 0; fi
  for dir in /opt/homebrew/bin /usr/local/bin /usr/bin /bin "$HOME/.local/bin"; do
    if [[ -x "$dir/claude" ]]; then print -r -- "$dir/claude"; return 0; fi
  done
  return 1
}
# One value from brimm-video's settings, or nothing.
setting() { plutil -extract "$1" raw -o - "$SETTINGS" 2>/dev/null || true; }

# The options. Anything wrong is refused before anything is looked at or changed.
read_options() {
  while (( $# )); do
    local arg="$1"
    shift
    case "$arg" in
      --print) PRINT_ONLY="yes" ;;
      --commit) COMMIT="${1-}"; (( $# )) && shift ;;
      -h|--help) sed -n '2,/^set -euo pipefail$/p' "$SELF" | sed -e '$d' -e 's/^# \{0,1\}//'; exit 0 ;;
      *) say "Not an option this app knows: $arg"; exit 2 ;;
    esac
  done
  if [[ ! "$COMMIT" =~ '^[0-9a-f]{40}$' ]]; then
    say "Say the commit this app was made at: --commit and its 40 characters."
    exit 2
  fi
}

# Which Mac this is, from its settings: Sallie's laptop or Jason's MacBook. A Mac with no brimm-video settings is set up fresh as
# Jason's MacBook (FRESH; the question comes in step 1). Refused (exit 2, nothing changed) if the settings name another Mac.
which_mac() {
  if [[ "$(uname -s)" != "Darwin" ]]; then say "This is for a Mac."; exit 2; fi
  if [[ -f "$SETTINGS" ]]; then
    local machine="$(setting machine)"
    if (( ! ${MACHINES[(Ie)$machine]} )); then
      say "This app is for ${MACHINES[1]} and ${MACHINES[2]}, and this Mac's settings say it is \"$machine\". Nothing was changed."
      exit 2
    fi
    MACHINE="$machine"
    # A Mac set up fresh on an earlier run has its settings now: the mark written right before that run's install says so.
    if [[ "$(mark_of fresh)" == yes ]]; then SET_UP_FRESH="yes"; fi
  else
    FRESH="yes"
    SET_UP_FRESH="yes"
    MACHINE="$FRESH_MACHINE"
  fi
  KEY_COMMENT="brimm-video-studio read-only, $MACHINE"
}

# The number of entries in a folder but .DS_Store and .brimm-watched-by, counted and never named. A folder that is not there is 0
# only when the nearest folder above it that is there can be listed (and the name is absent from it); the folder itself, or that
# one, that cannot be listed gives 2 (never 0, which would take a folder macOS did not let Terminal look in for an empty one).
count_entries() {
  local folder="$1" at
  local -a held
  if [[ -d "$folder" ]]; then
    ls -A -- "$folder" >/dev/null 2>&1 || return 2
    held=("$folder"/*(N) "$folder"/.*(N))
    held=(${held:#*/.}) held=(${held:#*/..}) held=(${held:#*/.DS_Store}) held=(${held:#*/.brimm-watched-by})
    print -r -- "${#held[@]}"
    return 0
  fi
  if [[ -e "$folder" || -L "$folder" ]]; then return 2; fi
  # Not there: the nearest folder above it that is there must be a folder that can be listed. Under a folder macOS does not let
  # Terminal look in, nothing is "there", and that folder is the nearest, so it is not taken for an empty place.
  at="${folder:h}"
  while [[ "$at" != / && ! -e "$at" && ! -L "$at" ]]; do at="${at:h}"; done
  [[ -d "$at" ]] || return 2
  ls -A -- "$at" >/dev/null 2>&1 || return 2
  print -r -- 0
}

# The drop folder and the exports folder this Mac's settings name now, one a line (the exports line is empty when settings.js show has
# none: brimm-video's has no exports line). Printed only, so it may be called inside $(...). Before the installer starts it asks the checkout the
# settings name (brimm-video's, or Studio's on a later run); once it has started, Studio's. It asks once, and nothing is said when it cannot be
# asked (no node, no settings, an error).
show_folders() {
  local js="" shown="" drop="" exports=""
  if [[ -n "$INSTALL_STARTED" ]]; then js="$STUDIO/tool/settings.js"
  elif [[ -n "$CHECKOUT_NOW" ]]; then js="$CHECKOUT_NOW/tool/settings.js"; fi
  if [[ -n "$js" && -f "$js" && -n "$NODE" && -f "$SETTINGS" ]]; then
    shown="$("$NODE" "$js" show 2>/dev/null || true)"
    drop="$(print -r -- "$shown" | sed -n 's/^  Its drop folder:  //p' | head -n 1 || true)"
    exports="$(print -r -- "$shown" | sed -n 's/^  Exports from HyperFrames, looked for in:  //p' | head -n 1 || true)"
  fi
  print -r -- "$drop"
  print -r -- "$exports"
  return 0
}
# Whether the unedited launch agent watches $1: macOS has the job loaded, and the agent's plist names the folder in its WatchPaths, by real
# path. It is decided from the job that is loaded, not from the file alone.
watched_by_agent() {
  local folder="$1" watched
  launchctl list com.thebrimm.unedited >/dev/null 2>&1 || return 1
  for watched in "${(@f)$(plist_watch_paths "$AGENT_FILE")}"; do
    if [[ -n "$watched" && "${watched:A}" == "${folder:A}" ]]; then return 0; fi
  done
  return 1
}
# "1 file or folder", "N files or folders".
files_or_folders() { if (( $1 == 1 )); then print -r -- "1 file or folder"; else print -r -- "$1 files or folders"; fi; }
# Counts $1 once, with count_entries, into COUNTED. A folder that cannot be read is not an empty one: it stops, without naming the cloud.
count_or_stop() {
  local rc=0
  COUNTED="$(count_entries "$1")" || rc=$?
  if (( rc != 0 )); then
    stop_here "The drop folder could not be read. macOS may have asked whether Terminal may read it, and the answer may have been no. Allow it in System Settings › Privacy & Security › Files and Folders, then run the app again."
  fi
}
COUNTED=""

# The two looks that must hold when anything is changed: no import is running, and the drop folders hold nothing to import. Step 1
# looks, and step 5 looks again right before the real install, because the installer checks the drop folder only when it switches
# the folder, and a Mac already on Drop would not look again itself. Same words, same stops each time.
look_at_import_and_drop() {
  # No import is running when every com.thebrimm job has no process id ("-") in the first column.
  local job
  for job in "${(@f)$(launchctl list 2>/dev/null | grep com.thebrimm || true)}"; do
    [[ -n "$job" ]] || continue
    if [[ "${job%%[[:space:]]*}" != "-" ]]; then
      stop_here "An import is running now. Wait until its window in the top right closes, then double-click Move to Studio again."
    fi
  done
  say "  No import is running."

  # A Mac set up fresh has no drop folder until the installer makes it. Otherwise it is the one this Mac's settings name. It is
  # counted and never listed: a file's name can be a client's.
  if [[ -n "$FRESH" ]]; then
    R_COUNT="none: this Mac had no drop folder before the install"
    return 0
  fi
  if [[ ! -f "$CHECKOUT_NOW/tool/settings.js" ]]; then
    stop_here "This Mac's checkout ($CHECKOUT_NOW) has no tool/settings.js to say where its drop folder is."
  fi
  local -a folders
  folders=("${(@f)$(show_folders)}")
  DROP="${folders[1]-}"
  if [[ -z "$DROP" ]]; then
    stop_here "The drop folder could not be found from this Mac's settings (settings.js show)."
  fi
  START_DROP="${DROP:A}"
  local old="$ROOT/Drop/$MACHINE" old_held="" new_held

  # Once the install has finished at this commit only step 7 and the end are left, and neither changes the drop folder: it is counted
  # for the report, and a video held there never blocks the run.
  if [[ "$(mark_of installed)" == "$COMMIT" ]]; then
    local rc=0
    new_held="$(count_entries "$DROP")" || rc=$?
    if (( rc != 0 )); then
      R_COUNT="could not be read, so it was not counted"
      say "  The drop folder could not be read, so it was not counted. The install has finished, so this does not stop the run."
    else
      R_COUNT="$new_held"
      if (( new_held > 0 )); then say "  The drop folder holds $(files_or_folders $new_held). The install has finished, so this does not stop the run."
      else say "  The drop folder is empty."; fi
    fi
    return 0
  fi

  # Drop › <Mac> in Dropbox, while it is there, on a Mac moved from brimm-video: any file in it stops the run.
  if [[ -z "$SET_UP_FRESH" && -d "$old" ]]; then
    count_or_stop "$old"
    old_held="$COUNTED"
    if (( old_held > 0 )); then
      if watched_by_agent "$old"; then
        stop_here "The drop folder holds $old_held file$([[ $old_held -eq 1 ]] || print -rn s) still to be imported."
      fi
      stop_here "$(files_or_folders $old_held) $([[ $old_held -eq 1 ]] && print -rn waits || print -rn wait) in the old drop folder, Drop › $MACHINE, and nothing imports $([[ $old_held -eq 1 ]] && print -rn it || print -rn them) now. Tell Jason."
    fi
  fi
  # The folder settings.js show names. It is the old folder when the settings name no other, and then it was counted already. A folder
  # that is not there yet counts as empty: the installer makes it.
  if [[ -n "$old_held" && "${DROP:A}" == "${old:A}" ]]; then
    new_held="$old_held"
  else
    count_or_stop "$DROP"
    new_held="$COUNTED"
    if (( new_held > 0 )); then
      if watched_by_agent "$DROP"; then
        stop_here "The drop folder holds $new_held file$([[ $new_held -eq 1 ]] || print -rn s) still to be imported."
      fi
      say "  $(files_or_folders $new_held) $([[ $new_held -eq 1 ]] && print -rn waits || print -rn wait) in $(words_for "$DROP"). Nothing watches it yet: the install starts the watching, and they are imported then."
    fi
  fi
  if (( new_held == 0 )); then say "  The drop folder is empty."; fi
  R_COUNT="$new_held"
  if [[ -n "$old_held" && "${DROP:A}" != "${old:A}" ]]; then R_COUNT="$new_held in the drop folder, $old_held in Drop › $MACHINE"; fi
}

# Step 1 on a Mac with no brimm-video settings: BRIMM Video is found in Dropbox, and setting the Mac up fresh is asked. Studio's
# installer makes the settings and the drop folder in step 5.
set_up_fresh() {
  local p
  local -a found
  # The BRIMM DB is at the top of a Dropbox, or a level deeper, in a team member's folder (as on the Mac Studio:
  # Dropbox-Ogden28.5/Jason Ogden/The BRIMM DB).
  for p in $HOME/Library/CloudStorage/Dropbox*/"The BRIMM DB/BRIMM Video"(N/) $HOME/Library/CloudStorage/Dropbox*/*/"The BRIMM DB/BRIMM Video"(N/) \
      $HOME/Dropbox*/"The BRIMM DB/BRIMM Video"(N/) $HOME/Dropbox*/*/"The BRIMM DB/BRIMM Video"(N/); do
    # Two paths that resolve to the same folder count once, and the first is kept as found.
    local same="" f
    for f in "${found[@]}"; do [[ "${f:A}" != "${p:A}" ]] || same=yes; done
    [[ -n "$same" ]] || found+=("$p")
  done
  if (( ${#found[@]} == 0 )); then
    stop_here "This Mac has no BRIMM Video folder in Dropbox (The BRIMM DB › BRIMM Video). Sign in to Dropbox, let The BRIMM DB sync, then run the app again."
  fi
  if (( ${#found[@]} > 1 )); then
    stop_here "This Mac has ${#found[@]} BRIMM Video folders in Dropbox: ${(j:, :)found}. Tell Jason which one is The BRIMM's."
  fi
  ROOT="${found[1]}"
  say "  brimm-video's settings:  none on this Mac"
  if [[ -n "$PRINT_ONLY" ]]; then
    would "ask to set this Mac up fresh as $MACHINE, with BRIMM Video at $ROOT"
  else
    ask "This Mac has no brimm-video settings (~/Library/Application Support/BRIMM Video/settings.json), so it is set up fresh, as $MACHINE: a drop folder picked in step 5 (suggested: BRIMM Video Work › Drop, on this Mac), the light import, hand-off version 2 and a BRIMM Video Studio folder for Claude, all made by Studio's installer in step 5. BRIMM Video is at $ROOT."
  fi
  R_SETTINGS="none: this Mac had no brimm-video settings, and is set up fresh as $MACHINE"
}

# Step 1, check 41: what this Mac has, and whether it is as the switch of 26 October left it. It changes nothing, except that
# Claude Code's sign-in is offered, and only on a y.
look_at_this_mac() {
  heading "1. Looking at this Mac (check 41). This changes nothing."
  local macos kb gb line brew version plan signed told claude_version

  macos="$(sw_vers -productVersion 2>/dev/null || true)"
  say "  macOS:  ${macos:-could not be read}"
  R_MACOS="${macos:-could not be read}"

  line="$(df -k / 2>/dev/null | tail -n 1 || true)"
  local -a cols
  cols=(${=line})
  kb="${cols[4]-}"
  if [[ "$kb" == <-> ]]; then
    gb=$(( kb / 1024 / 1024 ))
    if (( gb < 100 )); then
      say "  Free disk:  $gb GB, which is less than the 100 GB that video wants. This does not stop the move."
    else
      say "  Free disk:  $gb GB"
    fi
    R_DISK="$gb GB"
  else
    say "  Free disk:  could not be read"
    R_DISK="could not be read"
  fi

  if ! xcode-select -p >/dev/null 2>&1; then
    say "  Xcode's command line tools:  not here."
    stop_here "In Terminal, run: xcode-select --install, then run the app again."
  fi
  say "  Xcode's command line tools:  here"

  brew="$(find_program brew || true)"
  if [[ -z "$brew" ]]; then
    say "  Homebrew:  not here."
    stop_here 'In Terminal, run this (it asks for the password of this Mac, which its owner types): /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
  fi
  version="$("$brew" --version 2>/dev/null || true)"
  local -a said
  said=("${(@f)version}")
  version="${said[1]-}"
  say "  Homebrew:  ${version:-here}"

  NODE="$(find_program node || true)"
  if [[ -z "$NODE" ]]; then
    say "  Node:  not here."
    stop_here "Node is not on this Mac, and Studio needs 22 or later. Run: brew install node, then run the app again."
  fi
  version="$("$NODE" --version)"
  if ! "$NODE" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)'; then
    stop_here "Node here is $version, and Studio needs 22 or later. Run: brew upgrade node, then run the app again."
  fi
  say "  Node:  $version"

  if [[ -n "$FRESH" ]]; then
    set_up_fresh
  elif [[ -n "$SET_UP_FRESH" ]]; then
    # A Mac set up fresh on an earlier run: nothing is asked again, and BRIMM Video and the drop folder come from its settings.
    ROOT="$(setting root)"
    CHECKOUT_NOW="$(setting checkout)"
    say "  brimm-video's settings:  none: this Mac was set up fresh on an earlier run, and Studio's settings are there now"
    say "  BRIMM Video:  $ROOT"
    R_SETTINGS="nothing: this Mac was set up fresh on an earlier run, as $MACHINE"
  else
    # This Mac's settings, as the switch of 26 October left them. A checkout that is Studio's is as good as brimm-video's: a later run.
    ROOT="$(setting root)"
    CHECKOUT_NOW="$(setting checkout)"
    local import="$(setting import)" handoff="$(setting handoffVersion)" drop="$(setting drop)" own="$(setting dropPath)" shown
    shown="drop folder $drop"
    if [[ -n "$own" ]]; then shown="drop folder: its own, $own"; fi
    say "  brimm-video's settings:  import $import, hand-off version $handoff, $shown"
    [[ "$import" == light ]] || stop_here "This Mac's settings are not as the switch of 26 October left them: the import is \"$import\", and it should be \"light\"."
    # The installer keeps drop "Drop" on a Mac it switched, and gives a Mac it set up fresh a dropPath and no drop: either is expected.
    [[ "$drop" == Drop || -n "$own" ]] || stop_here "This Mac's settings are not as the switch of 26 October left them: the drop folder is \"$drop\", and it should be \"Drop\"."
    [[ "$handoff" == 2 ]] || stop_here "This Mac's settings are not as the switch of 26 October left them: the hand-off version is \"$handoff\", and it should be \"2\"."
    if [[ "$CHECKOUT_NOW" != "$OLD_CHECKOUT" && "$CHECKOUT_NOW" != "$STUDIO" ]]; then
      stop_here "This Mac's settings are not as the switch of 26 October left them: the checkout is \"$CHECKOUT_NOW\", and it should be brimm-video's ($OLD_CHECKOUT) or Studio's ($STUDIO)."
    fi
    R_SETTINGS="nothing: import $import, hand-off version $handoff, $shown, checkout as expected"
  fi

  look_at_import_and_drop

  # Claude Code: signed in or not, its plan and its version. Its email and its organisation are never read out.
  if ! CLAUDE="$(find_claude)"; then
    say "  Claude Code:  not here."
    stop_here "Claude Code is not on this Mac. Install it, then run the app again."
  fi
  told="$("$CLAUDE" auth status --json 2>/dev/null || true)"
  signed="$(print -rn -- "$told" | plutil -extract loggedIn raw -o - - 2>/dev/null || true)"
  if [[ "$signed" != true ]]; then
    say "  Claude Code:  not signed in."
    if [[ -n "$PRINT_ONLY" ]]; then
      would "ask to run claude auth login, which opens the browser to sign in to this Mac's own Claude account."
    else
      ask "Claude Code is not signed in. This will run claude auth login, which opens the browser; sign in there to this Mac's own Claude account (signing in to the Claude app does not sign in this command)."
      "$CLAUDE" auth login || true
      told="$("$CLAUDE" auth status --json 2>/dev/null || true)"
      signed="$(print -rn -- "$told" | plutil -extract loggedIn raw -o - - 2>/dev/null || true)"
      [[ "$signed" == true ]] || stop_here "Claude Code is still not signed in."
      changed+=("signed Claude Code in")
    fi
  fi
  plan="$(print -rn -- "$told" | plutil -extract subscriptionType raw -o - - 2>/dev/null || true)"
  version="$("$CLAUDE" --version 2>/dev/null || true)"
  claude_version="${version%%[[:space:]]*}"
  if [[ "$signed" == true ]]; then
    say "  Claude Code:  signed in${plan:+ ($plan)}, version ${claude_version:-that could not be read}"
    R_PLAN="${plan:-signed in, plan not shown}"
  else
    R_PLAN="not signed in"
  fi
}

# Step 2, check 42: Studio's own read-only key, its Host entry in ~/.ssh/config, GitHub's host key, and the check that GitHub
# knows the key. Only the public half is ever shown or copied; ssh-keygen alone touches the private half.
HOST_BLOCK=("Host $HOST_ALIAS" "  HostName github.com" "  User git" "  IdentityFile ~/.ssh/brimm_video_studio_deploy" "  IdentitiesOnly yes")

# Adds $2 as lines at the end of file $1 (made private if it is new), after a newline if the file does not end in one, and after
# a blank line when $3 is set. What is there stays byte for byte.
append_lines() {
  local file="$1" text="$2" blank="${3-}"
  if [[ ! -e "$file" ]]; then ( umask 077; : > "$file" ); fi
  if [[ -s "$file" ]]; then
    [[ -z "$(tail -c 1 "$file")" ]] || print -rn -- $'\n' >> "$file"
    [[ -z "$blank" ]] || print -rn -- $'\n' >> "$file"
  fi
  print -r -- "$text" >> "$file"
}

# Whether ~/.ssh/config has this app's Host entry: none, same, or different.
host_entry_state() {
  local config="$HOME/.ssh/config" line norm pat="^[[:space:]]*Host[[:space:]]+${HOST_ALIAS}[[:space:]]*\$"
  local in_block="" found=""
  local -a got want words
  [[ -f "$config" ]] || { print none; return 0; }
  for line in "${HOST_BLOCK[@]:1}"; do words=(${=line}); want+=("${words[*]}"); done
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ '^[[:space:]]*(Host|Match)[[:space:]]' ]]; then
      if [[ "$line" =~ $pat ]]; then in_block=yes; found=yes; continue; fi
      in_block=""
    fi
    [[ -n "$in_block" ]] || continue
    words=(${=line})
    (( ${#words} )) || continue
    [[ "${words[1]}" != \#* ]] || continue
    got+=("${words[*]}")
  done < "$config"
  if [[ -z "$found" ]]; then print none
  elif [[ "${(j:|:)got}" == "${(j:|:)want}" ]]; then print same
  else print different; fi
}

# Whether this Mac's known_hosts has GitHub's ed25519 key: none, same, or different.
host_key_state() {
  local file="$HOME/.ssh/known_hosts" found want="${GITHUB_HOST_KEY#github.com }"
  [[ -f "$file" ]] || { print none; return 0; }
  found="$(ssh-keygen -F github.com -f "$file" 2>/dev/null || true)"
  if [[ "$found" == *"$want"* ]]; then print same
  elif [[ "$found" == *ssh-ed25519* ]]; then print different
  else print none; fi
}

# Asks GitHub who the key is. Success is the text "Hi jogden12/brimm-video-studio!" (GitHub ends the call with 1 even then).
# Returns 0 for that, 1 for "Permission denied" (GitHub does not know the key yet); anything else stops, saying what ssh said.
check_with_github() {
  local told
  local -a lines
  # -n: ssh must not read the answers still to come from the terminal.
  told="$(ssh "${SSH_OPTS[@]}" -n -T "git@$HOST_ALIAS" 2>&1 || true)"
  lines=("${(@f)told}")
  # The report keeps the welcome (or the denial), not whatever line ssh happened to print first.
  R42_SSH="$(print -r -- "$told" | grep -m 1 -e '^Hi jogden12/' -e 'Permission denied' || true)"
  if [[ "$told" == *"Hi jogden12/brimm-video-studio!"* ]]; then
    say "  GitHub says: $R42_SSH"
    return 0
  fi
  if [[ "$told" == *"Permission denied"* ]]; then
    say "  GitHub does not know this key yet."
    return 1
  fi
  stop_here "ssh did not get GitHub's welcome for this key. It said:
${told:-nothing}"
}

make_the_key() {
  heading "2. Studio's key (check 42)"
  local pub comment state pending="" made="" via
  local -a words

  # The key. One of that name made earlier, with this comment, is kept; one with another comment is not touched.
  if [[ -e "$KEY" ]]; then
    [[ -f "$KEY.pub" ]] || stop_here "There is a file $KEY but no $KEY.pub beside it, and this app does not touch it."
    pub="$(<"$KEY.pub")"
    words=(${=pub})
    comment="${(j: :)words[3,-1]}"
    [[ "$comment" == "$KEY_COMMENT" ]] || stop_here "There is already a key at $KEY with another comment (\"$comment\"), so it is not Studio's. This app does not touch it."
    done_already "Studio's key is there ($KEY), made on an earlier run"
  else
    [[ ! -e "$KEY.pub" ]] || stop_here "There is a file $KEY.pub but no $KEY, and this app does not touch it."
    if [[ -n "$PRINT_ONLY" ]]; then
      would "make Studio's key, with: ssh-keygen -t ed25519 -f \"$KEY\" -N \"\" -C \"$KEY_COMMENT\""
      would "show its public half, copy it, and keep a copy of it at $PUBLIC_COPY"
      pending=yes
    else
      ask "Studio gets its own key, so that this laptop can read Studio's code and nothing else. This makes two files in ~/.ssh: $KEY (the private half, which stays on this Mac and is never shown) and $KEY.pub (the public half, which goes to GitHub), and puts a copy of the public half at $PUBLIC_COPY."
      [[ -d "$HOME/.ssh" ]] || mkdir -m 700 "$HOME/.ssh"
      ssh-keygen -t ed25519 -f "$KEY" -N "" -C "$KEY_COMMENT" >/dev/null 2>&1 || stop_here "The key could not be made."
      changed+=("made Studio's key ($KEY and $KEY.pub)")
      made=yes
      pub="$(<"$KEY.pub")"
    fi
  fi

  # Its public half: shown, copied, and kept on the Desktop.
  if [[ -n "$pub" ]]; then
    say "  Its public half (the part that goes to GitHub):"
    say "  $pub"
    if [[ -n "$PRINT_ONLY" ]]; then
      [[ "$(cat "$PUBLIC_COPY" 2>/dev/null || true)" == "$pub" ]] || would "keep a copy of it at $PUBLIC_COPY"
    else
      print -r -- "$pub" | pbcopy 2>/dev/null || true
      if [[ "$(cat "$PUBLIC_COPY" 2>/dev/null || true)" != "$pub" ]]; then
        { mkdir -p "${PUBLIC_COPY:h}" && print -r -- "$pub" > "$PUBLIC_COPY"; } 2>/dev/null || desktop_stop
        changed+=("kept a copy of the public half at $PUBLIC_COPY")
      fi
      say "  It is copied, and kept at $PUBLIC_COPY."
    fi
  fi

  # The Host entry that makes ssh use this key for Studio's repository.
  state="$(host_entry_state)"
  case "$state" in
    same) done_already "the Host entry for $HOST_ALIAS in ~/.ssh/config" ;;
    different) stop_here "~/.ssh/config already has a \"Host $HOST_ALIAS\" entry that is not the one Studio needs. This app does not change it." ;;
    none)
      if [[ -n "$PRINT_ONLY" ]]; then
        would "add this entry to ~/.ssh/config, after what is there:"
        local l; for l in "${HOST_BLOCK[@]}"; do say "    $l"; done
        pending=yes
      else
        ask "This adds an entry to ~/.ssh/config, after what is there (the rest stays as it is), so that Studio's repository uses Studio's key:
$(local l; for l in "${HOST_BLOCK[@]}"; do print -r -- "    $l"; done)"
        [[ -d "$HOME/.ssh" ]] || mkdir -m 700 "$HOME/.ssh"
        append_lines "$HOME/.ssh/config" "${(F)HOST_BLOCK}" yes
        changed+=("added the $HOST_ALIAS entry to ~/.ssh/config")
      fi ;;
  esac

  # GitHub's own host key, so that ssh knows it is talking to GitHub.
  state="$(host_key_state)"
  case "$state" in
    same) done_already "GitHub's host key is in ~/.ssh/known_hosts" ;;
    different) stop_here "GitHub's key on this Mac isn't the one GitHub publishes ($GITHUB_FINGERPRINT). Nothing is trusted until that is looked into: tell Jason." ;;
    none)
      if [[ -n "$PRINT_ONLY" ]]; then
        would "add GitHub's published host key (fingerprint $GITHUB_FINGERPRINT) to ~/.ssh/known_hosts"
        pending=yes
      else
        ask "This adds GitHub's published host key (fingerprint $GITHUB_FINGERPRINT) to ~/.ssh/known_hosts, so that ssh trusts GitHub and nothing else."
        [[ -d "$HOME/.ssh" ]] || mkdir -m 700 "$HOME/.ssh"
        append_lines "$HOME/.ssh/known_hosts" "$GITHUB_HOST_KEY"
        changed+=("added GitHub's host key to ~/.ssh/known_hosts")
      fi ;;
  esac

  # Whether GitHub knows the key. A key made just now cannot be there yet.
  if [[ -n "$PRINT_ONLY" ]]; then
    if [[ -n "$pending" ]]; then
      would "wait for the public half to be put on GitHub, then check it with ssh -T git@$HOST_ALIAS"
      R42_KEY="not checked: this was a print"
    elif check_with_github; then
      R42_KEY="yes: it is on GitHub, and the check of the key worked"
    else
      would "wait for the public half to be put on GitHub, then check it with ssh -T git@$HOST_ALIAS"
      R42_KEY="no: GitHub does not know the key yet"
    fi
    return 0
  fi
  if [[ -z "$made" ]] && check_with_github; then
    done_already "the key is on GitHub"
    R42_KEY="yes: it was on GitHub already, and the check of the key worked"
    return 0
  fi
  while true; do
    wait_for "Now the public half goes on GitHub, as a read-only deploy key: Jason does this at github.com, jogden12/brimm-video-studio, Settings, Deploy keys, Add deploy key. Title: $MACHINE. Key: the public half above (it is copied; or it is in $PUBLIC_COPY). Write access off. (Or give the public half to Claude on the Mac Studio, who does it.)"
    if check_with_github; then break; fi
  done
  if [[ -n "$made" ]]; then R42_KEY="yes: the check of the key worked"; else R42_KEY="yes: the key was made on an earlier run, and the check of it worked"; fi
}

# The steps after the key. Each is replaced by its own task; until then it says its heading and does nothing.
# Step 3, check 42: Studio's code, cloned over the key from GitHub, main put at the commit this app was made at, and Studio's
# own tests run there. The marks file holds key=value lines (tests=<commit>, and later installed=<commit>).
# Reads one key from the marks file.
mark_of() { [[ -f "$MARKS" ]] && sed -n "s/^$1=//p" "$MARKS" | head -n 1 || true; }
# Writes one key into the marks file: its own line is replaced and every other line is kept.
write_mark() {
  local key="$1" value="$2" kept=""
  [[ ! -f "$MARKS" ]] || kept="$(grep -v "^$key=" "$MARKS" || true)"
  { [[ -z "$kept" ]] || print -r -- "$kept"; print -r -- "$key=$value"; } > "$MARKS.new"
  mv "$MARKS.new" "$MARKS"
}
# The checkout that is already there: it must be Studio's, clean, and at the app's commit. Anything else stops, in words.
look_at_the_checkout() {
  local origin head short="${COMMIT[1,7]}"
  origin="$(git -C "$STUDIO" remote get-url origin 2>/dev/null || true)"
  if [[ -z "$origin" ]]; then
    stop_here "$STUDIO is there, but it isn't a copy of Studio's code (it has no origin). This app does not touch it."
  fi
  if [[ "$origin" != "$STUDIO_URL" ]]; then
    stop_here "$STUDIO is there, but it comes from $origin, not from Studio's repository ($STUDIO_URL). This app does not touch it."
  fi
  if [[ -n "$(GIT_OPTIONAL_LOCKS=0 git -C "$STUDIO" status --porcelain 2>/dev/null || true)" ]]; then
    stop_here "$STUDIO has changes that aren't saved. This app does not touch it; tell Jason."
  fi
  local branch="$(git -C "$STUDIO" symbolic-ref --short HEAD 2>/dev/null || true)"
  if [[ "$branch" != main ]]; then
    stop_here "$STUDIO isn't on main (${branch:+it is on $branch}${branch:-it is not on any branch}). This app does not touch it; tell Jason."
  fi
  head="$(git -C "$STUDIO" rev-parse HEAD 2>/dev/null || true)"
  if [[ "$head" != "$COMMIT" ]]; then
    stop_here "$STUDIO is at ${head[1,7]}, and this app was made at $short. This app does not move it; tell Jason."
  fi
  done_already "Studio's code is there ($STUDIO), at the app's commit $short"
}
# Takes a clone away that did not come out, so that nothing is left at the checkout's place or beside it.
drop_the_partial() { rm -rf "$PARTIAL"; made_partial=""; }
copy_the_code() {
  local short="${COMMIT[1,7]}" told
  local -a clone
  clone=(git clone --branch main "$STUDIO_URL" "$PARTIAL")
  if [[ -n "$PRINT_ONLY" ]]; then
    [[ ! -e "$PARTIAL" ]] || would "take away the half-made copy an earlier run left at $PARTIAL"
    would "clone Studio's code with: ${clone[*]}"
    would "put main at $short, the commit this app was made at, and rename $PARTIAL to $STUDIO"
    R42_COMMIT="$short (a print: not cloned)"
    return 0
  fi
  local also=""
  [[ ! -e "$PARTIAL" ]] || also=" A half-made copy from an earlier run, at $PARTIAL, is taken away first."
  ask "Studio's code is copied from GitHub, over Studio's key, to $STUDIO. It is cloned into $PARTIAL first, main is put at $short (the commit this app was made at), and only then is the folder renamed.$also This takes a minute. It writes only that folder."
  if [[ -e "$PARTIAL" ]]; then
    rm -rf "$PARTIAL"
    changed+=("took away a half-made copy of Studio's code ($PARTIAL)")
  fi
  made_partial=yes
  if ! told="$(GIT_SSH_COMMAND="$CLONE_SSH" "${clone[@]}" 2>&1)"; then
    drop_the_partial
    say "${told}"
    stop_here "Studio's code could not be copied from GitHub (the lines above say why)."
  fi
  if ! git -C "$PARTIAL" merge-base --is-ancestor "$COMMIT" origin/main >/dev/null 2>&1; then
    drop_the_partial
    stop_here "GitHub's main doesn't hold the commit this app was made at ($short). Tell Jason."
  fi
  if ! git -C "$PARTIAL" reset --hard "$COMMIT" >/dev/null 2>&1 || ! mv "$PARTIAL" "$STUDIO"; then
    drop_the_partial
    stop_here "Studio's code could not be put at the app's commit ($short)."
  fi
  made_partial=""
  changed+=("copied Studio's code to $STUDIO, at the app's commit $short")
  say "  Studio's code is at $STUDIO, at $short."
}
run_the_tests() {
  local short="${COMMIT[1,7]}" kept rc=0 line
  if [[ "$(mark_of tests)" == "$COMMIT" ]]; then
    done_already "Studio's tests passed at this commit ($short), on an earlier run"
    R42_TESTS="passed at $short on an earlier run"
    return 0
  fi
  if [[ -n "$PRINT_ONLY" ]]; then
    would "run Studio's tests in $STUDIO/tool (about three minutes; they change nothing), and mark them passed at $short"
    return 0
  fi
  say "  Now Studio's own tests run, in $STUDIO/tool. They take about three minutes and change nothing."
  kept="$(mktemp)"
  { (cd "$STUDIO/tool" && "$NODE" --test --test-reporter=spec) 2>&1 | while IFS= read -r line; do
      say "$line"
      print -r -- "$line" >> "$kept"
    done } || rc=$?
  R42_TESTS="$(grep '^ℹ' "$kept" || true)"
  rm -f "$kept"
  if (( rc != 0 )); then
    stop_here "Studio's tests did not pass at $short. Tell Jason; the lines above, from ℹ tests on, say how many failed."
  fi
  write_mark tests "$COMMIT"
  say "  Studio's tests passed."
}
get_the_code() {
  heading "3. Studio's code (check 42)"
  if [[ -e "$STUDIO" ]]; then
    look_at_the_checkout
    R42_COMMIT="${COMMIT[1,7]} $(git -C "$STUDIO" log -1 --format=%s 2>/dev/null || true)"
  else
    copy_the_code
    [[ -n "$PRINT_ONLY" ]] || R42_COMMIT="${COMMIT[1,7]} $(git -C "$STUDIO" log -1 --format=%s 2>/dev/null || true)"
  fi
  run_the_tests
}
# Step 4, check 43: the HyperFrames app is on this Mac. Its version is noted for the report; when it is not here, its page is
# opened in Safari to download it, and the app waits.
find_the_app() {
  heading "4. The HyperFrames app (check 43)"
  local version
  while true; do
    if [[ -d "$HF_APP" ]]; then
      version="$(plutil -extract CFBundleShortVersionString raw -o - "$HF_APP/Contents/Info.plist" 2>/dev/null || true)"
      say "  HyperFrames app:  version ${version:-that could not be read}, at $HF_APP"
      R43_VERSION="${version:-unreadable}"
      return 0
    fi
    say "  HyperFrames app:  not here ($HF_APP)."
    R43_VERSION="not here"
    if [[ -n "$PRINT_ONLY" ]]; then
      would "open the HyperFrames page in Safari ($HF_PAGE) with: open -a Safari $HF_PAGE, and wait for the app to be put in Applications"
      return 0
    fi
    open -a Safari "$HF_PAGE" || true
    wait_for "The HyperFrames page is open in Safari ($HF_PAGE). Download the app there, drag it into Applications, and open it once. Then, as check 43 says, sign in to HeyGen and choose Claude Code as the agent, on Auto."
  done
}

# Step 5's two questions: the drop folder, where videos are dropped, and the exports folder, where HyperFrames' exports go. Each is
# answered with y (the suggested folder, or the one kept) or c (macOS's own folder chooser, in the helper app). The installer's
# options are made from the answers (set_install_options) and nowhere else.

# y or c from one line: y or yes, c or choose, in any case, with spaces round them. Prints y, c, or nothing.
answer_of() {
  local line="${(L)1}"
  if [[ "$line" =~ '^[[:space:]]*(y|yes)[[:space:]]*$' ]]; then
    print y
  elif [[ "$line" =~ '^[[:space:]]*(c|choose)[[:space:]]*$' ]]; then
    print c
  fi
  return 0
}
# Says $1, reads one line as ask_yes does (the prompt $2, the answer kept in the log) and sets ANSWER to y or c. Anything else, an
# empty line or the end of input stops. With "c-only" in $3 a y stops too.
ask_y_or_c() {
  local line="" answer
  [[ -z "$1" ]] || say "$1"
  print -rn -- "$2"
  [[ -z "$LOGGING" ]] || print -rn -- "$2" >> "$LOG"
  IFS= read -r line || true
  [[ -t 0 ]] || print -r -- ""
  [[ -z "$LOGGING" ]] || print -r -- "$line" >> "$LOG"
  answer="$(answer_of "$line")"
  if [[ "${3-}" == c-only && "$answer" == y ]]; then answer=""; fi
  [[ -n "$answer" ]] || stop_here
  ANSWER="$answer"
}

# Keys typed into Terminal while the chooser was open are not answers: they are read and thrown away, but only from a keyboard, so a
# test's piped answers are kept. zsh's own terminal read, with no -u, leaves line mode for each key, so a y typed without Return goes
# too. Written with if, and with $(( )) assignments: either of && or (( )) alone would end the script under set -e at a 0.
throw_away_typed_keys() {
  local thrown=0 _key
  if [[ -t 0 ]]; then
    while read -t 0 -k 1 -s _key; do thrown=$(( thrown + 1 )); done
  fi
  THROWN=$(( THROWN + thrown ))
  if (( thrown > 0 )); then say "Keys typed while the window was open were not taken as answers."; fi
}

# The chooser's first way: the helper app started the way Finder starts an app, which brings it in front with the keyboard. It writes
# its answer into a file, whole or not at all. Gives 0 and CHOSEN for a pick, 1 for Cancel, 3 for a line break, 2 when it could not
# be shown (no file, and the helper gone).
chooser_app_way() {
  local message="$1" start="$2" folder result content first rest rc=0
  folder="$(mktemp -d 2>/dev/null)" || return 2
  result="$folder/result"
  open -n -W "$CHOOSER_APP" --args "$message" "$start" "$result" "$$" </dev/null 2>/dev/null || rc=$?
  # open's own status is not looked at while a result file is there. With none, the helper may still be up (open can give up on it
  # while its window is open): wait while its program runs, with no time limit. Control-C goes to the traps, and the helper ends with
  # this script through its process-id watch.
  if [[ ! -r "$result" ]]; then
    while pgrep -f "$CHOOSER_APP/Contents/MacOS/Choose a Folder" >/dev/null 2>&1; do sleep 0.5; done
  fi
  content=""
  if [[ -r "$result" ]]; then
    content="$(cat -- "$result" 2>/dev/null; print -rn x)" || content=""
    content="${content%x}"
  fi
  rm -rf "$folder"
  [[ -n "$content" ]] || return 2
  first="${content%%$'\n'*}"
  rest=""
  [[ "$content" != *$'\n'* ]] || rest="${content#*$'\n'}"
  case "$first" in
    cancel) return 1 ;;
    linebreak) return 3 ;;
    path)
      rest="${rest%$'\n'}"
      [[ -n "$rest" ]] || return 2
      CHOSEN="${rest:A}"
      return 0 ;;
    *) return 2 ;;
  esac
}
# The chooser's second way: the helper's program run directly. It prints the path and ends 0, ends 1 on Cancel, 3 on a line break,
# and 2 when it could not show the window. The same answers as the first way.
chooser_program_way() {
  local message="$1" start="$2" program="$CHOOSER_APP/Contents/MacOS/Choose a Folder" told="" rc=0
  [[ -x "$program" ]] || return 2
  told="$("$program" "$message" "$start" </dev/null 2>/dev/null)" || rc=$?
  case "$rc" in
    0)
      [[ -n "$told" ]] || return 2
      CHOSEN="${told:A}"
      return 0 ;;
    1) return 1 ;;
    3) return 3 ;;
    *) return 2 ;;
  esac
}
# Opens the chooser at $2 with the message $1: the first way of CHOOSER_ROUTE, and the other only when the first could not be shown.
# Gives 0 with CHOSEN (the pick, made whole), 1 on Cancel, 3 for a line break, 2 when neither way could be shown. Terminal is brought
# back to the front and the keys typed meanwhile are thrown away on every way back.
choose_folder() {
  local message="$1" start="$2" rc=0 way
  local -a ways
  CHOSEN=""
  say "A window to choose the folder is opening. If you don't see it, click the folder icon named Choose a Folder in the Dock. If no window comes at all, press Control-C; on the next run, y uses the suggested folder."
  if [[ "$CHOOSER_ROUTE" == program ]]; then ways=(program app); else ways=(app program); fi
  for way in "${ways[@]}"; do
    rc=0
    "chooser_${way}_way" "$message" "$start" || rc=$?
    if (( rc != 2 )); then break; fi
  done
  open -a Terminal || true
  throw_away_typed_keys
  return $rc
}

# A folder in Finder's words, which Studio's own folderWords gives. Studio's settings.js is imported (never run: its main guard would
# run it as a command when it is node's first argument), as install.sh's lock_facts does. When that cannot be asked (no node, no
# Studio checkout, an error: node's errors are kept off the screen) the whole path is said instead.
words_for() {
  local folder="$1" told=""
  if [[ -n "$NODE" && -f "$STUDIO/tool/settings.js" ]]; then
    told="$("$NODE" --input-type=module -e '
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const { folderWords } = await import(pathToFileURL(join(process.argv[1], "settings.js")).href);
process.stdout.write(folderWords(process.argv[2], process.argv[3]));
' "$STUDIO/tool" "$folder" "$HOME" 2>/dev/null)" || told=""
  fi
  print -r -- "${told:-$folder}"
}

# The app's own checks of a pick. They are never called inside $(...), which would lose what they set: FAULT_KIND (linebreak,
# transcript, cannot-look, not-empty or studio), FAULT_WORDS (the refusal in the app's words, empty when the folder will do) and
# FAULT_REASON (the reason alone, a clause that fits the stop "... and <folder> can't be used: <reason>."). The exports check also
# sets EXPORTS_PASSED_OVER to yes when it passed over a place Terminal could not look in.

# Whether $1 is $2 or inside it, by real path (a missing part as spelled), letter case folded.
same_or_inside() {
  local a="${(L)${1:A}}" b="${(L)${2:A}}"
  a="${a%/}" b="${b%/}"
  [[ "$a" == "$b" || "$a" == "$b"/* ]]
}
# Whether one is the other or inside it, either way.
same_or_nested() { same_or_inside "$1" "$2" || same_or_inside "$2" "$1"; }
# Whether $1 is $2 or inside it as spelled: whole paths, nothing resolved, letter case folded.
spelled_inside() {
  local a="${(L)${1:a}}" b="${(L)${2:a}}"
  a="${a%/}" b="${b%/}"
  [[ "$a" == "$b" || "$a" == "$b"/* ]]
}
# A plist's WatchPaths, one a line, read through plutil as install.sh reads them: no JSON, no node.
plist_watch_paths() {
  local file="$1" count i
  count="$(plutil -extract WatchPaths raw -o - "$file" 2>/dev/null)" || return 0
  [[ $count == <-> ]] || return 0
  for (( i = 0; i < count; i++ )); do
    plutil -extract "WatchPaths.$i" raw -o - "$file" 2>/dev/null || true
  done
  return 0
}
# The transcript tool's folders, one a line: the two beside BRIMM Video, and what its launch agent watches (for exports, what its
# turned-off file watches too, as L1c does).
transcript_folders() {
  if [[ -n "$ROOT" ]]; then
    print -r -- "${ROOT:A:h}/BRIMM VIDEO Transfer"
    print -r -- "${ROOT:A:h}/BRIMM VIDEO MacBook"
  fi
  local listed entry
  listed="$(plist_watch_paths "$HOME/Library/LaunchAgents/com.thebrimm.transcribe.plist")"
  if [[ "${1-}" == exports ]]; then listed+=$'\n'"$(plist_watch_paths "$HOME/Library/LaunchAgents/com.thebrimm.transcribe.plist.off")"; fi
  # Only whole paths, as Studio's transcriptFolders takes them.
  for entry in "${(@f)listed}"; do
    if [[ "$entry" == /* ]]; then print -r -- "$entry"; fi
  done
  return 0
}
# Whether $1 is Downloads or inside it, by real path. Nothing is looked at inside it.
in_downloads() { same_or_inside "$1" "$HOME/Downloads"; }

# Sets the three variables for one refusal: $1 the kind, $2 the words, $3 the reason.
refuse_with() { FAULT_KIND="$1" FAULT_WORDS="$2" FAULT_REASON="$3"; }

# Which of the transcript tool's folders refuses $1 ($2: drop or exports): for a drop folder one that is, holds or is inside it, for
# exports one it is, or is inside. Gives 0 when it is refused.
watched_by_transcripts() {
  local folder="$1" kind="$2" other
  local -a others
  others=("${(@f)$(transcript_folders "$kind")}")
  for other in "${others[@]}"; do
    [[ -n "$other" ]] || continue
    if [[ "$kind" == drop ]]; then
      if same_or_nested "$folder" "$other"; then return 0; fi
    else
      if same_or_inside "$folder" "$other"; then return 0; fi
    fi
  done
  return 1
}

# An exports folder that is one of Studio's own, or a drop folder. The words are built only when refusing.
refuse_studio() {
  refuse_with studio "Exports can't go in $(words_for "$1"): it is one of Studio's own folders, or a drop folder, where an export would be taken. Choose another." "it is one of Studio's own folders, or a drop folder"
}

# The drop folder: $1 the folder, $2 where it came from (settings, last, suggested or picked). The settings' own is not held to being empty.
drop_folder_fault() {
  local folder="$1" from="${2-}" held="" rc=0 shown
  FAULT_KIND="" FAULT_WORDS="" FAULT_REASON=""
  if [[ "$folder" == *$'\n'* ]]; then
    refuse_with linebreak "A folder whose name holds a line break can't be used. Choose another." "its name holds a line break"
    return 0
  fi
  if watched_by_transcripts "$folder" drop; then
    refuse_with transcript "$(words_for "$folder") is watched by the transcript tool, which takes each video put there. Choose another." "the transcript tool watches it"
    return 0
  fi
  # Downloads, and anything in it, is never looked in: Studio's installer refuses a drop folder there, and the question is asked again.
  if in_downloads "$folder"; then return 0; fi
  held="$(count_entries "$folder")" || rc=$?
  if (( rc != 0 )); then
    refuse_with cannot-look "macOS did not let Terminal look in $(words_for "$folder"). Allow Terminal in System Settings › Privacy & Security › Files and Folders, or choose another folder." "macOS did not let Terminal look in it"
    return 0
  fi
  if [[ "$from" != settings ]] && (( held > 0 )); then
    shown="$held files or folders"
    if (( held == 1 )); then shown="1 file or folder"; fi
    refuse_with not-empty "$(words_for "$folder") holds $shown. Studio takes every video out of a drop folder, so choose an empty folder that only you drop into, or make one with New Folder." "it is not empty"
  fi
  return 0
}

# Whether Zoom's recordings folder may be compared with the pick $1: when it is not under Documents, which macOS guards, or the pick
# is in or under Documents (by real path or as spelled), or the pick as spelled is inside Zoom's folder as spelled. Otherwise nothing
# under Documents is asked.
zoom_may_hold() {
  local folder="$1" zoom="$2" docs="${HOME:A}/Documents"
  if ! spelled_inside "$zoom" "$docs"; then return 0; fi
  if same_or_inside "$folder" "$docs" || spelled_inside "$folder" "$docs" || spelled_inside "$folder" "$zoom"; then return 0; fi
  return 1
}
# The exports folder: $1 the folder. Downloads is never looked in; every other folder is compared with Studio's folders, and the
# folder and each folder above it are looked in for .brimm-watched-by where Terminal can look.
exports_folder_fault() {
  local folder="$1" other zoom at
  local -a studio_folders
  FAULT_KIND="" FAULT_WORDS="" FAULT_REASON="" EXPORTS_PASSED_OVER=""
  if [[ "$folder" == *$'\n'* ]]; then
    refuse_with linebreak "A folder whose name holds a line break can't be used. Choose another." "its name holds a line break"
    return 0
  fi
  if watched_by_transcripts "$folder" exports; then
    refuse_with transcript "$(words_for "$folder") is watched by the transcript tool, which takes each video put there. Choose another." "the transcript tool watches it"
    return 0
  fi
  if in_downloads "$folder"; then return 0; fi
  studio_folders=("$ROOT/Drop" "$ROOT/Unedited Video" "$ROOT/Episodes" "$ROOT/References" "$HOME/BRIMM Video Work"
    "$HOME/Library/Application Support/BRIMM Video" "$HOME/BRIMM Video Studio" "$HOME/BRIMM Video Workshop")
  for other in "${studio_folders[@]}"; do
    if same_or_inside "$folder" "$other"; then refuse_studio "$folder"; return 0; fi
  done
  zoom="$(setting zoomFolder)"
  if [[ "$zoom" != /* ]]; then zoom="$HOME/Documents/Zoom"; fi
  if zoom_may_hold "$folder" "$zoom" && same_or_inside "$folder" "$zoom"; then
    refuse_studio "$folder"
    return 0
  fi
  # A folder a Mac has marked as its drop folder, or one inside it. A place that is there and that Terminal cannot look in is passed
  # over, and said; one that is not there (yet) is just not a place with a marker.
  at="${folder:A}"
  while true; do
    if [[ -e "$at/.brimm-watched-by" ]]; then
      refuse_studio "$folder"
      return 0
    fi
    if [[ -e "$at" ]] && ! ls -A -- "$at" >/dev/null 2>&1; then EXPORTS_PASSED_OVER=yes; fi
    if [[ "$at" == / ]]; then break; fi
    at="${at:h}"
  done
  return 0
}

# What y gives for a question: CAND, and CAND_FROM (settings, last or suggested). The settings' own folder is dropPath or exportsPath
# (exportsPath only when it is not Downloads by real path); the last-time folder is the mark drop= or exports=.
folder_candidate() {
  local kind="$1" suggested kept last
  if [[ "$kind" == drop ]]; then
    suggested="$HOME/BRIMM Video Work/Drop"
    kept="$(setting dropPath)"
  else
    suggested="$HOME/Downloads"
    kept="$(setting exportsPath)"
    if [[ -n "$kept" && "${kept:A}" == "${suggested:A}" ]]; then kept=""; fi
  fi
  last="$(mark_of "$kind")"
  if [[ -n "$kept" ]]; then CAND="$kept" CAND_FROM=settings
  elif [[ -n "$last" ]]; then CAND="$last" CAND_FROM=last
  else CAND="$suggested" CAND_FROM=suggested
  fi
}
# The question's words (QUESTION_LINES) and its last line, the prompt (QUESTION_PROMPT), for the folder y gives.
folder_question() {
  local kind="$1" from="$2" cand="$3"
  local -a lines
  case "$from" in
    settings)
      if [[ "$kind" == drop ]]; then lines=("This Mac's drop folder is $(words_for "$cand").")
      else lines=("HyperFrames' exports are looked for in $(words_for "$cand") and in Downloads."); fi
      QUESTION_PROMPT="Type y and press Return to keep it, or c and press Return to choose another. Anything else stops: " ;;
    last)
      lines=("Last time, this folder was picked: $(words_for "$cand").")
      QUESTION_PROMPT="Type y and press Return to use it again, or c and press Return to choose another. Anything else stops: " ;;
    *)
      if [[ "$kind" == drop ]]; then
        lines=("  Where videos are dropped for Studio: the drop folder."
          "  Studio takes every video out of this folder and files it. Use a new folder that only you drop into: never one shared with others, or one an app saves into."
          "  Suggested: BRIMM Video Work › Drop, in your home folder. It is on this Mac, the installer makes it, and macOS asks no questions about it."
          "  A folder in Dropbox, iCloud Drive or another cloud folder can be picked, but every video dropped there, a client session too, goes up to that cloud, and one still syncing can be imported late, or twice.")
        QUESTION_PROMPT="Type y and press Return to use the suggested folder, or c and press Return to choose another. Anything else stops: "
      else
        lines=("  Where HyperFrames' exports go: the exports folder."
          "  Suggested: Downloads, where HyperFrames saves an export unless its Export dialog is given another folder. Studio looks in Downloads in any case, and deletes each export it takes from there once its copy in the video's final folder in Dropbox is checked."
          "  A folder in Dropbox is fine, for instance to share the exports with other people.")
        QUESTION_PROMPT="Type y and press Return to use Downloads, or c and press Return to choose another. Anything else stops: "
      fi ;;
  esac
  # On a Mac moved from brimm-video, the drop folder it has today stops being watched.
  if [[ "$kind" == drop && -z "$SET_UP_FRESH" && "$from" != settings ]]; then
    lines=("Today the drop folder is Drop › $MACHINE in Dropbox. Once the install has run, it is no longer watched." "${lines[@]}")
  fi
  QUESTION_LINES="${(F)lines}"
}
# Records the answer: the folder, whether the settings' own is kept, and where it came from.
settle_folder() {
  if [[ "$1" == drop ]]; then DROP_FOLDER="$2" DROP_KEPT="$3" DROP_FROM="$4"
  else EXPORTS_FOLDER="$2" EXPORTS_KEPT="$3" EXPORTS_FROM="$4"
  fi
}
# A folder picked last time and not taken this time was left as it is: said in Finder's words with its count, never its files.
say_left_behind() {
  local folder="$1" held rc=0 how
  held="$(count_entries "$folder")" || rc=$?
  if (( rc != 0 )); then how="could not be looked in, so it was not counted"
  elif (( held == 0 )); then how="is empty"
  elif (( held == 1 )); then how="holds 1 file or folder"
  else how="holds $held files or folders"; fi
  say "The folder picked last time, $(words_for "$folder"), was left as it is, and $how. Jason checks it is empty, then deletes it by hand if it is not wanted."
}
# Asks one of the two questions ($1: drop or exports) until it is answered, and sets its folder (DROP_FOLDER or EXPORTS_FOLDER), whether
# the settings' own is kept, and where it came from. A pick is checked at once; a refused one is asked again, with c alone when y would
# give the same refused folder again (unless allowing Terminal cures it). When the chooser cannot be shown, y still takes the
# suggested folder; only c alone stops, with the words that fit the refusal. After the installer refused a folder, $2 is that folder, $3
# its FAULT_KIND and $4 its reason.
ask_folder() {
  local kind="$1" refused="${2-}" refused_kind="${3-}" refused_reason="${4-}" chosen_from own message c_only="" y_kind="" y_reason="" rc cand from started words
  if [[ "$kind" == drop ]]; then message="Move to Studio: choose the folder you will drop videos into, or make a new one with New Folder."
  else message="Move to Studio: choose the folder HyperFrames' exports will go into, or make a new one with New Folder."; fi
  folder_candidate "$kind"
  cand="$CAND" from="$CAND_FROM" started="$CAND_FROM"
  # Asked again after the installer refused $2: when y would give that folder again, only c is offered (unless allowing cures it).
  if [[ -n "$refused" && "$refused_kind" != cannot-look && "${cand:A}" == "${refused:A}" ]]; then c_only=yes y_kind="$refused_kind" y_reason="$refused_reason"; fi
  while true; do
    if [[ -n "$c_only" ]]; then
      ask_y_or_c "" "Type c and press Return to choose another folder. Anything else stops: " c-only
    else
      folder_question "$kind" "$from" "$cand"
      ask_y_or_c "$QUESTION_LINES" "$QUESTION_PROMPT"
    fi
    if [[ "$ANSWER" == y ]]; then
      folder_fault "$kind" "$cand" "$from"
      if [[ -n "$FAULT_WORDS" ]]; then
        say "  $FAULT_WORDS"
        if [[ "$FAULT_KIND" != cannot-look ]]; then c_only=yes y_kind="$FAULT_KIND" y_reason="$FAULT_REASON"; fi
        continue
      fi
      settle_folder "$kind" "$cand" "$([[ "$from" == settings ]] && print yes || true)" "$from"
      break
    fi
    rc=0
    choose_folder "$message" "$HOME" || rc=$?
    if (( rc == 1 )); then continue; fi
    if (( rc == 3 )); then
      say "A folder whose name holds a line break can't be used. Choose another."
      continue
    fi
    if (( rc != 0 )); then
      say "The window to choose a folder could not be shown."
      if [[ -n "$c_only" ]]; then
        words="$(words_for "$cand")"
        if [[ "$y_kind" == not-empty ]]; then
          stop_here "The window to choose a folder could not be shown, and $words is not empty. Empty it in Finder, or tell Jason, then double-click Move to Studio again."
        fi
        stop_here "The window to choose a folder could not be shown, and $words can't be used: $y_reason. Tell Jason, then double-click Move to Studio again."
      fi
      continue
    fi
    say "  Picked: $(words_for "$CHOSEN")"
    # A pick that is the settings' own drop folder (by real path) is that folder, kept: it is not held to being empty.
    chosen_from=picked
    if [[ "$kind" == drop ]]; then
      own="$(setting dropPath)"
      if [[ -n "$own" && "${CHOSEN:A}" == "${own:A}" ]]; then chosen_from=settings; fi
    fi
    folder_fault "$kind" "$CHOSEN" "$chosen_from"
    if [[ -n "$FAULT_WORDS" ]]; then
      say "  $FAULT_WORDS"
      # A refused pick that is the folder y gives: y would give it again, so c alone is offered.
      if [[ "$FAULT_KIND" != cannot-look && "${CHOSEN:A}" == "${cand:A}" ]]; then c_only=yes y_kind="$FAULT_KIND" y_reason="$FAULT_REASON"; fi
      continue
    fi
    settle_folder "$kind" "$CHOSEN" "$([[ "$chosen_from" == settings ]] && print yes || true)" "$chosen_from"
    if [[ "$kind" == drop && "$started" == last && "${CHOSEN:A}" != "${cand:A}" ]]; then say_left_behind "$cand"; fi
    break
  done
  if [[ "$kind" == exports ]]; then say_exports_note; fi
}
# Runs the check of a pick: $1 the kind, $2 the folder, $3 where it came from. FAULT_WORDS is empty when the folder will do.
folder_fault() {
  FAULT_KIND="" FAULT_WORDS="" FAULT_REASON=""
  if [[ "$1" == drop ]]; then drop_folder_fault "$2" "$3"; else exports_folder_fault "$2"; fi
}
# After an exports folder other than Downloads: where Studio looks, and that nothing is deleted from it.
say_exports_note() {
  local downloads="$HOME/Downloads"
  if [[ "${EXPORTS_FOLDER:A}" != "${downloads:A}" ]]; then
    say "Studio looks for exports there and in Downloads. It copies each one into its video's final folder in Dropbox, and leaves the one there as it is. When you export in HyperFrames, choose this folder in its Export dialog. Never export into the drop folder."
    if in_downloads "$EXPORTS_FOLDER"; then say "Studio tidies only Downloads itself, so exports in this folder are never tidied."; fi
  fi
}
ask_drop_folder() { ask_folder drop; }
ask_exports_folder() { ask_folder exports; }
# The folders a y would give, for a print, which asks nothing: the settings' own, else the last time's, else the suggested ones.
folders_a_y_gives() {
  folder_candidate drop
  settle_folder drop "$CAND" "$([[ "$CAND_FROM" == settings ]] && print yes || true)" "$CAND_FROM"
  folder_candidate exports
  settle_folder exports "$CAND" "$([[ "$CAND_FROM" == settings ]] && print yes || true)" "$CAND_FROM"
}
# The installer's options, written here and nowhere else: --drop-folder unless the settings' own drop folder is kept, and
# --exports-folder when the folder differs, by real path, from the one the settings name now (exportsPath, or Downloads when none).
set_install_options() {
  local now
  INSTALL_OPTIONS=(--machine "$MACHINE")
  if [[ -z "$DROP_KEPT" ]]; then INSTALL_OPTIONS+=(--drop-folder "$DROP_FOLDER"); fi
  now="$(setting exportsPath)"
  if [[ -z "$now" ]]; then now="$HOME/Downloads"; fi
  if [[ "${EXPORTS_FOLDER:A}" != "${now:A}" ]]; then INSTALL_OPTIONS+=(--exports-folder "$EXPORTS_FOLDER"); fi
  INSTALL_OPTIONS+=(--import light --handoff 2)
}

# Step 5, check 44: Studio's own installer, shown first with --print, then run for real on a y.
# The installer's options come from INSTALL_OPTIONS and nowhere else.
PRINT_TOLD="" PRINT_RC=0
# The installer's line as it is typed, for a would.
installer_line() {
  local word shown=""
  for word in "${INSTALL_OPTIONS[@]}"; do
    [[ "$word" == *[[:space:]\']* ]] && word="\"$word\""
    shown+=" $word"
  done
  print -r -- "zsh \"$STUDIO/tool/install.sh\" --print$shown \"$ROOT\""
}
# Runs the installer's own --print. Its text is kept in PRINT_TOLD and its status in PRINT_RC; the caller says it (a refused pick is
# said by its first line alone).
installer_print() {
  PRINT_RC=0
  PRINT_TOLD="$(zsh "$STUDIO/tool/install.sh" --print "${INSTALL_OPTIONS[@]}" "$ROOT" 2>&1)" || PRINT_RC=$?
}
print_has() { grep -q -- "$1" <<< "$PRINT_TOLD"; }
# The last lines of what the installer said, for a stop and for the report.
last_lines() { print -r -- "$1" | tail -n "${2:-8}"; }

# The Finder step's sentence for the drop folder $1, decided by Studio's cloudFolder of it and by whether this Mac was set up fresh. The
# folder is named in Finder's words, never by the Mac's name. Printed only.
finder_sentence() {
  local folder="$1" cloud words
  cloud="$(studio_says cloudFolder "$folder")"
  words="$(words_for "$folder")"
  if [[ "$cloud" == Dropbox ]]; then
    local node_too=""
    if [[ -n "$SET_UP_FRESH" ]]; then node_too=", and click Allow if macOS asks whether node may read the Dropbox folder"; fi
    print -r -- "The drop folder is shown in Finder: $words. In Finder, Control-click it, choose Make available offline$node_too."
  else
    print -r -- "This is the drop folder from now on: $words. Drag it into Finder's sidebar now, under Favorites, so it is one click away. To bring in a video that is in Dropbox, hold Option as you drag it, so that Dropbox keeps its copy. Never export into the drop folder."
  fi
}

turn_on_hyperframes() {
  local shown app drop out installed="${1-}"
  if [[ ! -f "$STUDIO/tool/settings.js" ]]; then
    stop_here "$STUDIO/tool/settings.js is not there, so the editing app cannot be looked at."
  fi
  shown="$("$NODE" "$STUDIO/tool/settings.js" show 2>/dev/null || true)"
  app="$(print -r -- "$shown" | sed -n 's/^  The editing app:  //p' | head -n 1 || true)"
  drop="$(print -r -- "$shown" | sed -n 's/^  Its drop folder:  //p' | head -n 1 || true)"
  if [[ "$app" == hyperframes ]]; then
    done_already "HyperFrames is on as the editing app"
    R44_APP="it was on already"
  elif [[ -n "$PRINT_ONLY" ]]; then
    would "ask to turn HyperFrames on as the editing app, with: node \"$STUDIO/tool/settings.js\" set --app hyperframes"
    R44_APP="not turned on: this was a print"
  else
    ask "This turns HyperFrames on as the editing app here (it is ${app:-off} now), with: node tool/settings.js set --app hyperframes, in Studio's code. Nothing else in this Mac's settings changes."
    out="$("$NODE" "$STUDIO/tool/settings.js" set --app hyperframes 2>&1)" || stop_here "HyperFrames could not be turned on. It said: $out"
    say "  $out"
    R44_APP="$out"
    changed+=("turned HyperFrames on as the editing app")
  fi
  # The drop folder, shown in Finder: when the install finished on this run, and on every later run until the step is done.
  if [[ -z "$installed" && "$(mark_of finder)" == "$COMMIT" ]]; then return 0; fi
  if [[ -n "$PRINT_ONLY" ]]; then
    would "show the drop folder in Finder with: open -R \"${drop:-the drop folder}\""
    return 0
  fi
  if [[ -z "$drop" ]]; then
    say "  The drop folder could not be read from Studio's settings, so it is not shown in Finder."
    return 0
  fi
  open -R "$drop" || true
  wait_for "$(finder_sentence "$drop")"
  write_mark finder "$COMMIT"
}

# Reads a print that was refused (its status was not 0): REFUSED is the question to ask again (exports, drop or nested), or empty for
# a stop. It reads the first line that starts "Not written:", "The folder " or "A folder is for" (node's own words can come ahead of it)
# and nothing after it: L1c's second line after an exports refusal is for a person at Terminal, and is never said. Like the app's own
# checks it is never called inside $(...): FAULT_KIND is cannot-look, not-empty or installer, FAULT_WORDS the line, FAULT_REASON its
# text after "Not written: " without the final period.
refused_pick() {
  local line
  REFUSED="" FAULT_KIND="" FAULT_WORDS="" FAULT_REASON=""
  line="$(print -r -- "$1" | grep -m 1 -E '^(Not written:|The folder |A folder is for)' || true)"
  [[ -n "$line" ]] || return 0
  case "$line" in
    "Not written: the drop folder cannot be the exports folder, or inside it, or hold it"*) REFUSED=nested ;;
    "Not written: the exports folder "*) REFUSED=exports ;;
    "Not written: the drop folder would change from "*) return 0 ;;
    "Not written: the drop folder "*|"Not written: the folder that is to hold the drop folder "*|"The folder "*" is watched by "*|"A folder is for"*) REFUSED=drop ;;
    *) return 0 ;;
  esac
  FAULT_KIND=installer
  case "$line" in
    "Not written: the drop folder could not be read"*) FAULT_KIND=cannot-look ;;
    "Not written: the drop folder holds"*) FAULT_KIND=not-empty ;;
  esac
  FAULT_WORDS="$line"
  FAULT_REASON="${${line#Not written: }%.}"
}
# The first Warning line of a drop folder in a cloud folder (both of L1c's forms start so) in the print $1, or nothing.
cloud_warning() { print -r -- "$1" | grep -m 1 '^Warning: this drop folder is in ' || true; }
# Studio's own answer ($1: cloudFolder or needsFilesAccess) for the folder $2: the cloud's name or nothing, or yes or no. Its settings.js
# is imported (never run), as words_for does, with node's errors kept off the screen. Nothing is said when it cannot be asked.
studio_says() {
  local told=""
  if [[ -n "$NODE" && -f "$STUDIO/tool/settings.js" ]]; then
    told="$("$NODE" --input-type=module -e '
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const studio = await import(pathToFileURL(join(process.argv[1], "settings.js")).href);
const [which, folder, home] = process.argv.slice(2);
if (which === "cloudFolder") process.stdout.write(studio.cloudFolder(folder, home) || "");
else process.stdout.write(studio.needsFilesAccess(folder, home) ? "yes" : "no");
' "$STUDIO/tool" "$1" "$2" "$HOME" 2>/dev/null)" || told=""
  fi
  print -r -- "$told"
}

# After a refusal refused_pick named ($REFUSED): says its line, asks the question again, and makes the options again. A nesting
# refusal asks the folder picked on this run, or the exports folder when both were or neither was.
ask_again_after_refusal() {
  local kind="$REFUSED" folder
  say "  $FAULT_WORDS"
  if [[ "$kind" == nested ]]; then
    if [[ "$DROP_FROM" == picked && "$EXPORTS_FROM" != picked ]]; then kind=drop; else kind=exports; fi
  fi
  if [[ "$kind" == drop ]]; then folder="$DROP_FOLDER"; else folder="$EXPORTS_FOLDER"; fi
  ask_folder "$kind" "$folder" "$FAULT_KIND" "$FAULT_REASON"
  set_install_options
}
# The cloud question, after a print that holds the Warning line for a drop folder the installer is given. A y holds for that folder
# (by real path) for the rest of the run and writes nothing. Gives 1 for a c (the drop question is asked again, and the print runs
# again), and 0 when the print goes on.
ask_about_the_cloud() {
  local warning
  [[ -z "$PRINT_ONLY" && -z "$DROP_KEPT" ]] || return 0
  warning="$(cloud_warning "$PRINT_TOLD")"
  [[ -n "$warning" && "$CLOUD_OK_FOR" != "${DROP_FOLDER:A}" ]] || return 0
  ask_y_or_c "$warning" "Type y and press Return to use it anyway, or c and press Return to choose another. Anything else stops: "
  if [[ "$ANSWER" == y ]]; then CLOUD_OK_FOR="${DROP_FOLDER:A}"; return 0; fi
  ask_drop_folder
  set_install_options
  return 1
}
# The report's three lines (Drop folder, Exports folder, Cloud warning), filled on every run that is not a print. They hold the folders
# Studio's settings.js show names: after the install it ran on this run, or on a later run the ones it left. $1 is yes when the install
# finished on an earlier run, so that the settings' own drop folder was kept on a y then. The cloud's name is Studio's cloudFolder of the
# drop folder.
note_the_folders() {
  local earlier="${1-}" name drop exports
  local -a folders
  folders=("${(@f)$(show_folders)}")
  drop="${folders[1]-}" exports="${folders[2]-}"
  if [[ -z "$drop" ]]; then drop="$DROP_FOLDER"; fi
  if [[ -z "$exports" ]]; then exports="$EXPORTS_FOLDER"; fi
  R44_DROP="${drop:-not named by Studio's settings}"
  R44_EXPORTS="${exports:-not named by Studio's settings}"
  name=""
  if [[ -n "$drop" ]]; then name="$(studio_says cloudFolder "$drop")"; fi
  if [[ -z "$name" ]]; then R44_CLOUD="none"
  elif [[ -n "$earlier" || -n "$DROP_KEPT" ]]; then R44_CLOUD="$name, kept on a y on an earlier run"
  else R44_CLOUD="$name, kept on a y"
  fi
}
# Whether macOS may ask about the folder $1, by Studio's own answers: a cloud folder gives yes (Dropbox only on a Mac set up fresh,
# since node and Claude Code read it already on a moved Mac), and otherwise needsFilesAccess. Nothing asked is no.
may_ask_about() {
  local cloud
  cloud="$(studio_says cloudFolder "$1")"
  if [[ "$cloud" == Dropbox ]]; then [[ -n "$SET_UP_FRESH" ]]; return; fi
  if [[ -n "$cloud" ]]; then return 0; fi
  [[ "$(studio_says needsFilesAccess "$1")" == yes ]]
}
# Before the real install's question: which questions macOS may still ask.
privacy_notes() {
  say "Studio looks in Downloads for exports, whatever is picked. macOS may ask once whether Claude Code may access files in your Downloads folder, the first time the chat on this Mac hands off a video and looks for its export. About 15 minutes after each hand-off, once the export's copies in Dropbox are checked, Studio's background job deletes the export from Downloads, and macOS may ask once whether node may. Choose Allow each time. If node was refused, allow it in System Settings › Privacy & Security › Files and Folders. Until then, exports stay in Downloads, to be deleted by hand."
  if may_ask_about "$DROP_FOLDER"; then
    say "macOS may also ask whether node may read $(words_for "$DROP_FOLDER"), at the first import, and whether Claude Code may, the first time the chat on this Mac looks there (\"what's waiting?\"). Choose Allow each time. A Don't Allow is undone in System Settings › Privacy & Security › Files and Folders, under that name. macOS may ask node again after Homebrew updates it, and until someone clicks Allow, Studio sees no video dropped there."
  fi
  if [[ -n "$EXPORTS_PASSED_OVER" ]] || may_ask_about "$EXPORTS_FOLDER"; then
    say "macOS may ask whether Claude Code may look in $(words_for "$EXPORTS_FOLDER"), at the first hand-off. Choose Allow."
  fi
}

run_the_installer() {
  heading "5. Studio's installer (check 44)"
  local tries=0 matter line
  local -a lines
  if [[ "$(mark_of installed)" == "$COMMIT" ]]; then
    done_already "Studio's installer finished at this commit (${COMMIT[1,7]}), on an earlier run"
    R44_RAN="finished at ${COMMIT[1,7]} on an earlier run"
    if [[ -z "$PRINT_ONLY" ]]; then note_the_folders yes; fi
    turn_on_hyperframes
    return 0
  fi
  # A print asks nothing and opens no chooser: it uses the folders a y would give.
  if [[ -n "$PRINT_ONLY" ]]; then
    would "ask where videos are dropped (suggested: BRIMM Video Work › Drop) and where HyperFrames' exports go (suggested: Downloads)"
    folders_a_y_gives
    set_install_options
  fi
  if [[ -n "$PRINT_ONLY" && ! -f "$STUDIO/tool/install.sh" ]]; then
    would "run Studio's installer with --print first (it changes nothing): $(installer_line)"
    would "ask, then run it for real with the same line and --yes in place of --print"
    R44_PRINT="not shown: Studio's code is not on this Mac yet"
    return 0
  fi
  [[ -f "$STUDIO/tool/install.sh" ]] || stop_here "$STUDIO/tool/install.sh is not there."

  # The two questions come before the print, and the options are made from their answers.
  if [[ -z "$PRINT_ONLY" ]]; then
    ask_drop_folder
    ask_exports_folder
    set_install_options
  fi

  # The print, again after a refused pick has been asked again, after the cloud question's c, and after Claude Code or the Claude app
  # has been brought up to date. Only the last two count as a try at updating.
  while true; do
    say "  Studio's installer, with --print first (this changes nothing):"
    installer_print
    if (( PRINT_RC != 0 )); then
      REFUSED=""
      if [[ -z "$PRINT_ONLY" ]]; then refused_pick "$PRINT_TOLD"; fi
      if [[ -n "$REFUSED" ]]; then
        ask_again_after_refusal
        continue
      fi
      say "$PRINT_TOLD"
      stop_here "Studio's installer refused (its words are above), so it was not run for real. Nothing it refused has been changed."
    fi
    say "$PRINT_TOLD"
    if ! ask_about_the_cloud; then continue; fi
    if print_has '^  Claude Code, signed in:  no'; then
      stop_here "Claude Code is not signed in. In Terminal, run: claude auth login (sign in to this Mac's own Claude account in the browser), then run the app again."
    fi
    if print_has "^  Claude Code's version:.*older than"; then
      if (( tries > 0 )); then
        stop_here "Claude Code is still older than the installer needs after claude update. Tell Jason."
      fi
      if [[ -n "$PRINT_ONLY" ]]; then
        would "ask to run claude update, because Claude Code in Terminal is older than the installer wants, and then print the installer again"
        break
      fi
      ask "Claude Code in Terminal is behind what Studio's installer wants. This runs claude update, which brings it up to date, and then the installer's print is shown again."
      "$CLAUDE" update || true
      changed+=("ran claude update")
      tries=$(( tries + 1 ))
      continue
    fi
    if print_has "^  The Claude app's own Claude Code:.*older than"; then
      if (( tries > 1 )); then
        stop_here "The Claude app's own Claude Code is still older than the installer wants. Tell Jason."
      fi
      if [[ -n "$PRINT_ONLY" ]]; then
        would "wait while the Claude app is brought up to date, and then print the installer again"
        break
      fi
      wait_for "The Claude app's own Claude Code is older than the installer wants. In the Claude app, choose Claude > Check for Updates, let it update, and open the app again."
      tries=$(( tries + 1 ))
      continue
    fi
    break
  done

  # The lines that matter, repeated, and kept for the report.
  matter="$(print -r -- "$PRINT_TOLD" | grep -E "^  (Claude Code, signed in:|Claude Code's version:|The Claude app's own Claude Code:|HDR video:|Her folder's lock:)" || true)"
  say ""
  say "The lines that matter:"
  [[ -z "$matter" ]] || say "$matter"
  R44_PRINT="$matter"

  if [[ -n "$PRINT_ONLY" ]]; then
    would "run Studio's installer for real, after asking, with the same line and --yes in place of --print"
    would "check that its last lines hold the background job's answer from Claude, and that the one-shot check agent ($CHECK_FILE) is gone"
    turn_on_hyperframes
    return 0
  fi

  privacy_notes
  ask "Studio's installer now runs for real, with the same options as its print above. It sets Studio up on this Mac, changes this Mac's brimm-video settings to run from Studio, and ends with one real call to Claude from the background job (up to 90 seconds). It can take a few minutes."
  look_at_import_and_drop
  # The marks, right before the install runs: the folders given to it on this run, and a Mac set up fresh. A pick kept as it is
  # (no option) writes none.
  if (( ${INSTALL_OPTIONS[(Ie)--drop-folder]} )); then write_mark drop "$DROP_FOLDER"; fi
  if (( ${INSTALL_OPTIONS[(Ie)--exports-folder]} )); then write_mark exports "$EXPORTS_FOLDER"; fi
  if [[ -n "$SET_UP_FRESH" ]]; then write_mark fresh yes; fi
  INSTALL_STARTED=yes
  local kept rc
  kept="$(mktemp)"
  # Written before the installer runs, in words that are true however far it gets; made plain once it has finished.
  changed+=("ran Studio's installer (if it stopped, its last lines say how far it got)")
  local installer_at=${#changed[@]}
  set +e
  zsh "$STUDIO/tool/install.sh" --yes "${INSTALL_OPTIONS[@]}" "$ROOT" 2>&1 | while IFS= read -r line; do
    say "$line"
    print -r -- "$line" >> "$kept"
    # Noted as it is read, before the status is looked at: the agent was started, even if the installer ends 1 after this.
    if [[ "$line" == "From the background job:"* ]]; then BACKGROUND_SEEN=yes; fi
  done
  rc=${pipestatus[1]}
  set -e
  R44_RAN="$(last_lines "$(<"$kept")" 8)"
  if (( rc != 0 )); then
    rm -f "$kept"
    stop_here "The installer stopped (it ended with $rc). Its last lines:
$R44_RAN"
  fi
  line="$(grep '^From the background job:' "$kept" | tail -n 1 || true)"
  rm -f "$kept"
  changed[installer_at]="ran Studio's installer"
  if [[ -z "$line" ]]; then
    stop_here "The setup stopped before its check of Claude (there is no \"From the background job:\" line in what it said). Its last lines:
$R44_RAN"
  fi
  if [[ "$line" != "From the background job: Claude answered from here"* ]]; then
    stop_here "The installer's check of Claude did not get an answer. It said:
$line
Tell Jason: Claude may not be reachable from the background job, which is where the imports run."
  fi
  if [[ -e "$CHECK_FILE" ]]; then
    stop_here "The one-shot check of Claude ($CHECK_FILE) is still there. Left there, launchd would run it at every login. Tell Jason."
  fi
  R44_AGENT="${line}; ${CHECK_FILE:t}: gone"
  write_mark installed "$COMMIT"
  say "  Studio's installer finished."
  note_the_folders
  turn_on_hyperframes yes
}
# Step 6: the report Jason carries to the Mac Studio, where each line is copied into the box the By-Hand page labels the same
# way. One heading a check, one line a box (a value of several lines is joined on one). It holds nothing of the Claude account,
# the key's private half or the drop folder's files. It shows the run's final state, so step 7 writes it again.
one_line() { local text="${1-}" fallback="${2-nothing was recorded on this run}"; [[ -n "$text" ]] || text="$fallback"; print -r -- "${(j: | :)${(@f)text}}"; }
# A print checks none of these, and claims nothing of an earlier run: the words for a line a print leaves empty.
unchecked() { if [[ -n "$PRINT_ONLY" ]]; then print -r -- "not checked: this was a print"; else print -r -- "$1"; fi; }
compose_report() {
  print -r -- "Studio move report: $MACHINE, $(date '+%Y-%m-%d %H:%M')"
  print -r -- ""
  print -r -- "41 Before you start"
  print -r -- "Her macOS: ${R_MACOS:-not read}"
  print -r -- "Free on her disk: ${R_DISK:-not read}"
  print -r -- "Anything unexpected in her settings: ${R_SETTINGS:-not read}"
  print -r -- "What the count printed: ${R_COUNT:-not read}"
  print -r -- "Her Claude account's plan: ${R_PLAN:-not read}"
  print -r -- ""
  print -r -- "42 Studio's code on her laptop"
  print -r -- "Whether the key is on GitHub, and how: $(one_line "$R42_KEY" "made on an earlier run; the check of the key worked")"
  print -r -- "What the check of the key printed: $(one_line "$R42_SSH" "$(unchecked "GitHub's welcome, as on the earlier run that checked it")")"
  print -r -- "The commit: $(one_line "$R42_COMMIT" "${COMMIT[1,7]}")"
  print -r -- "The tests' last lines: $(one_line "$R42_TESTS" "$(unchecked "passed at ${COMMIT[1,7]} on an earlier run")")"
  print -r -- ""
  print -r -- "43 The HyperFrames app on her laptop"
  print -r -- "The app's version on each Mac: $(one_line "$R43_VERSION" "not read") on $MACHINE (the Mac Studio's is read there)"
  print -r -- ""
  print -r -- "44 Studio's installer on her laptop"
  print -r -- "Anything in the print that surprised you, and its HDR line: $(one_line "$R44_PRINT" "not shown on this run (the installer finished on an earlier run)")"
  print -r -- "The installer's last lines: $(one_line "$R44_RAN")"
  print -r -- "What the look for the one-shot check printed: $(one_line "$R44_AGENT" "$(unchecked "the installer finished on an earlier run")")"
  print -r -- "What turning HyperFrames on printed: $(one_line "$R44_APP" "nothing: turning it on was not needed on this run")"
  print -r -- "Drop folder: $(one_line "$R44_DROP" "$(unchecked "not named by Studio's settings")")"
  print -r -- "Exports folder: $(one_line "$R44_EXPORTS" "$(unchecked "not named by Studio's settings")")"
  print -r -- "Cloud warning: $(one_line "$R44_CLOUD" "$(unchecked "not named by Studio's settings")")"
  print -r -- ""
  print -r -- "48 Afterwards"
  print -r -- "brimm-video's old key: $R48"
}
REPORT_WRITTEN=""
save_report() {
  { mkdir -p "${REPORT:h}" && compose_report > "$REPORT.new" && mv "$REPORT.new" "$REPORT"; } 2>/dev/null || desktop_stop
}
write_the_report() {
  heading "6. The report"
  if [[ -n "$PRINT_ONLY" ]]; then
    would "write this report on the Desktop ($REPORT) and show it in Finder:"
    compose_report | while IFS= read -r line; do say "  $line"; done
    return 0
  fi
  save_report
  REPORT_WRITTEN="yes"
  changed+=("wrote the report ($REPORT)")
  say "  The report is on the Desktop: Studio move report.txt"
  open -R "$REPORT" || true
}

# The last lines, on a Mac moved from brimm-video: said only right before "Done.", never on the way to a stop and never on a Mac set up
# fresh, while Drop › <Mac> is still in Dropbox. The folder is counted once, as step 1 counts a drop folder (nothing but .DS_Store and
# .brimm-watched-by, counted and never listed). Nothing here waits or asks, so nothing here can stop the run.
old_drop_lines() {
  local old="$ROOT/Drop/$MACHINE" held="" rc=0 new
  local -a folders
  if [[ -n "$SET_UP_FRESH" || -n "$PRINT_ONLY" || ! -d "$old" ]]; then return 0; fi
  held="$(count_entries "$old")" || rc=$?
  folders=("${(@f)$(show_folders)}")
  new="the new drop folder"
  if [[ -n "${folders[1]-}" ]]; then new="$(words_for "${folders[1]}")"; fi
  say ""
  if (( rc != 0 )); then
    say "The old drop folder, Drop › $MACHINE in Dropbox, could not be read, so it was not counted. Jason counts it from the Mac Studio before deleting it."
  elif (( held == 0 )); then
    say "The old drop folder, Drop › $MACHINE in Dropbox, is empty and no longer watched. Jason checks it is still empty, then deletes it by hand, and takes it out of Finder's sidebar."
  else
    say "The old drop folder, Drop › $MACHINE in Dropbox, holds $(files_or_folders $held) that nothing imports now. Drag each video in it into $new, with a plain drag, which moves it out of Dropbox, and it is imported there. Jason deletes the folder by hand once it is empty."
  fi
}

# Step 7, check 48: brimm-video's old key. Once the move is done and Jason has deleted the key on GitHub, its two files can go
# from this Mac. Asked only then; a no keeps them and does not stop the run.
retire_the_old_key() {
  heading "7. brimm-video's old key (check 48)"
  # A Mac set up fresh moved nothing from brimm-video, so its key, if there is one, is not this app's to take.
  if [[ -n "$SET_UP_FRESH" ]]; then
    R48="not asked: this Mac was set up fresh, so it is left as it is"
    if [[ -n "$PRINT_ONLY" ]]; then
      would "leave brimm-video's old key as it is, if there is one: this Mac is set up fresh"
    else
      say "  Not asked: this Mac was set up fresh, so brimm-video's old key, if there is one, is left as it is."
      if [[ -n "$REPORT_WRITTEN" ]]; then save_report; fi
    fi
    return 0
  fi
  if [[ "$(mark_of installed)" != "$COMMIT" ]]; then
    R48="not asked: the move is not finished yet"
    if [[ -n "$PRINT_ONLY" ]]; then would "ask about brimm-video's old key only once Studio's installer has finished at this commit"; fi
    return 0
  fi
  if [[ ! -e "$OLD_KEY" && ! -e "$OLD_KEY.pub" ]]; then
    R48="not on this Mac"
    done_already "brimm-video's old key is not on this Mac"
  elif [[ ! -e "$OLD_KEY" || ! -e "$OLD_KEY.pub" ]]; then
    R48="left alone: only one of its two files is here"
    say "  Only one of brimm-video's old key's two files is here, so they are left alone. Tell Jason."
  elif [[ -n "$PRINT_ONLY" ]]; then
    R48="not asked: this was a print"
    would "ask whether brimm-video's key has been deleted on GitHub (jogden12/brimm-video, Settings, Deploy keys), and on y delete $OLD_KEY and $OLD_KEY.pub"
  elif ask_yes "Has brimm-video's key been deleted on GitHub (jogden12/brimm-video › Settings › Deploy keys)? If it has, the two files of that key can be deleted from this Mac: $OLD_KEY and $OLD_KEY.pub. Nothing else in ~/.ssh is touched." "Delete them now? Type y and press Return, or n to keep them: "; then
    rm -f -- "$OLD_KEY" "$OLD_KEY.pub"
    changed+=("deleted brimm-video's old key from this Mac")
    R48="deleted from this Mac"
    say "  brimm-video's old key is deleted from this Mac."
  else
    R48="kept for now"
    say "  brimm-video's old key is kept for now. Double-click Move to Studio again to be asked once more."
  fi
  if [[ -n "$REPORT_WRITTEN" ]]; then save_report; fi
}

main() {
  read_options "$@"
  which_mac
  trap on_int INT
  trap on_term TERM
  trap on_hup HUP
  if [[ -z "$PRINT_ONLY" ]]; then
    mkdir -p "${LOG:h}"
    # One run at a time: a second one, in another Terminal window, would clone, install and write over the first. The lock is held
    # by this shell until it ends, and is not passed to the programs it starts. A print takes none.
    zmodload zsh/system
    : >> "$LOG.lock"   # zsystem flock locks a file that is there already
    if ! zsystem flock -t 0 -f LOCK_FD "$LOG.lock" 2>/dev/null; then
      say "Move to Studio is already running in another Terminal window. Use that one, or close it and double-click again."
      exit 1
    fi
    print -r -- "--- $(date '+%Y-%m-%d %H:%M:%S') ---" >> "$LOG"
    LOGGING="yes"
    # The Mac stays awake while this runs (a lid shut in the middle of a clone is the worst way to stop). It ends with this script.
    if command -v caffeinate >/dev/null 2>&1; then { caffeinate -i -w $$ </dev/null & } 2>/dev/null; fi
  fi
  look_at_this_mac
  make_the_key
  get_the_code
  find_the_app
  run_the_installer
  write_the_report
  retire_the_old_key
  old_drop_lines
  say ""
  if [[ -n "$PRINT_ONLY" ]]; then
    say "Nothing was changed."
  elif [[ "$MACHINE" == "Sallie's laptop" ]]; then
    # Her laptop's checks on screen come next: 45 to 47 are hers.
    say "Done. Next on the By-Hand page: checks 45 to 47, on screen."
  else
    say "Done. Next on the By-Hand page: the rest of the check for $MACHINE."
  fi
  exit 0
}

# Main runs only when this file is run, so that a test can source it and call one function alone.
if [[ $ZSH_EVAL_CONTEXT == toplevel ]]; then main "$@"; fi
