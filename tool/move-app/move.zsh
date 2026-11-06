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
# Each step looks first, says what it will change, and asks before it changes it. Answer y and press Return to go ahead.
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
# Set once the Mac is known (which_mac): its name, Studio's key comment, and the installer's options.
MACHINE="" KEY_COMMENT="" INSTALL_OPTIONS=()
FRESH=""             # set by which_mac on a Mac with no brimm-video settings
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
# The installer's options are written in which_mac and nowhere else, so that a later round changes one line.
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
  if (( ${#changed[@]} == 0 )); then
    say "Stopped. This run changed nothing."
  else
    say "Stopped. This run changed:"
    local c
    for c in "${changed[@]}"; do say "  - $c"; done
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
  else
    FRESH="yes"
    MACHINE="$FRESH_MACHINE"
  fi
  KEY_COMMENT="brimm-video-studio read-only, $MACHINE"
  INSTALL_OPTIONS=(--machine "$MACHINE" --drop Drop --import light --handoff 2)
}

# The two looks that must hold when anything is changed: no import is running, and the drop folder holds nothing to import. Step 1
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

  # A Mac set up fresh has no drop folder until the installer makes it. Otherwise it is the one this Mac's brimm-video names. It
  # is counted and never listed: a file's name can be a client's.
  if [[ -n "$FRESH" ]]; then
    R_COUNT="none: this Mac had no drop folder before the install"
    return 0
  fi
  if [[ ! -f "$CHECKOUT_NOW/tool/settings.js" ]]; then
    stop_here "This Mac's checkout ($CHECKOUT_NOW) has no tool/settings.js to say where its drop folder is."
  fi
  DROP="$("$NODE" "$CHECKOUT_NOW/tool/settings.js" show 2>/dev/null | sed -n 's/^  Its drop folder:  //p' | head -n 1 || true)"
  if [[ -z "$DROP" || ! -d "$DROP" ]]; then
    stop_here "The drop folder could not be found from this Mac's settings (settings.js show)."
  fi
  # A folder that cannot be listed is not an empty one: the glob below would swallow the failure and count nothing.
  if ! ls -A -- "$DROP" >/dev/null 2>&1; then
    stop_here "The drop folder could not be read. macOS may have asked whether Terminal may read Dropbox, and the answer may have been no. Allow it in System Settings › Privacy & Security › Files and Folders, then run the app again."
  fi
  local -a held
  held=("$DROP"/*(N) "$DROP"/.*(N))
  held=(${held:#*/.}) held=(${held:#*/..}) held=(${held:#*/.DS_Store}) held=(${held:#*/.brimm-watched-by})
  if (( ${#held[@]} > 0 )); then
    stop_here "The drop folder holds ${#held[@]} file$([[ ${#held[@]} -eq 1 ]] || print -rn s) still to be imported."
  fi
  say "  The drop folder is empty."
  R_COUNT="${#held[@]}"
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
    ask "This Mac has no brimm-video settings (~/Library/Application Support/BRIMM Video/settings.json), so it is set up fresh, as $MACHINE: its own drop folder (Drop › $MACHINE), the light import, hand-off version 2 and a BRIMM Video Studio folder for Claude, all made by Studio's installer in step 5. BRIMM Video is at $ROOT."
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
  else
    # This Mac's settings, as the switch of 26 October left them. A checkout that is Studio's is as good as brimm-video's: a later run.
    ROOT="$(setting root)"
    CHECKOUT_NOW="$(setting checkout)"
    local import="$(setting import)" handoff="$(setting handoffVersion)" drop="$(setting drop)"
    say "  brimm-video's settings:  import $import, hand-off version $handoff, drop folder $drop"
    [[ "$import" == light ]] || stop_here "This Mac's settings are not as the switch of 26 October left them: the import is \"$import\", and it should be \"light\"."
    [[ "$drop" == Drop ]] || stop_here "This Mac's settings are not as the switch of 26 October left them: the drop folder is \"$drop\", and it should be \"Drop\"."
    [[ "$handoff" == 2 ]] || stop_here "This Mac's settings are not as the switch of 26 October left them: the hand-off version is \"$handoff\", and it should be \"2\"."
    if [[ "$CHECKOUT_NOW" != "$OLD_CHECKOUT" && "$CHECKOUT_NOW" != "$STUDIO" ]]; then
      stop_here "This Mac's settings are not as the switch of 26 October left them: the checkout is \"$CHECKOUT_NOW\", and it should be brimm-video's ($OLD_CHECKOUT) or Studio's ($STUDIO)."
    fi
    R_SETTINGS="nothing: import $import, hand-off version $handoff, drop folder $drop, checkout as expected"
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
# Runs the installer's own --print and shows it. Its text is kept in PRINT_TOLD and its status in PRINT_RC.
installer_print() {
  PRINT_RC=0
  PRINT_TOLD="$(zsh "$STUDIO/tool/install.sh" --print "${INSTALL_OPTIONS[@]}" "$ROOT" 2>&1)" || PRINT_RC=$?
  say "$PRINT_TOLD"
}
print_has() { grep -q -- "$1" <<< "$PRINT_TOLD"; }
# The last lines of what the installer said, for a stop and for the report.
last_lines() { print -r -- "$1" | tail -n "${2:-8}"; }

turn_on_hyperframes() {
  local shown app drop out fresh="${1-}"
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
    fresh=yes
  fi
  # The drop folder, shown in Finder, where Dropbox is told to keep it on this Mac.
  [[ -n "$fresh" ]] || return 0
  if [[ -n "$PRINT_ONLY" ]]; then
    would "show the drop folder in Finder with: open -R \"${drop:-the drop folder}\""
    return 0
  fi
  if [[ -z "$drop" ]]; then
    say "  The drop folder could not be read from Studio's settings, so it is not shown in Finder."
    return 0
  fi
  open -R "$drop" || true
  wait_for "The drop folder, $MACHINE, is shown in Finder. In Finder, Control-click $MACHINE, choose Make available offline, and click Allow if macOS asks whether node may read the Dropbox folder."
}

run_the_installer() {
  heading "5. Studio's installer (check 44)"
  local tries=0 matter line
  local -a lines
  if [[ "$(mark_of installed)" == "$COMMIT" ]]; then
    done_already "Studio's installer finished at this commit (${COMMIT[1,7]}), on an earlier run"
    R44_RAN="finished at ${COMMIT[1,7]} on an earlier run"
    turn_on_hyperframes
    return 0
  fi
  if [[ -n "$PRINT_ONLY" && ! -f "$STUDIO/tool/install.sh" ]]; then
    would "run Studio's installer with --print first (it changes nothing): $(installer_line)"
    would "ask, then run it for real with the same line and --yes in place of --print"
    R44_PRINT="not shown: Studio's code is not on this Mac yet"
    return 0
  fi
  [[ -f "$STUDIO/tool/install.sh" ]] || stop_here "$STUDIO/tool/install.sh is not there."

  # The print, again after Claude Code or the Claude app has been brought up to date.
  while true; do
    tries=$(( tries + 1 ))
    say "  Studio's installer, with --print first (this changes nothing):"
    installer_print
    if (( PRINT_RC != 0 )); then
      stop_here "Studio's installer refused (its words are above), so it was not run for real. Nothing it refused has been changed."
    fi
    if print_has '^  Claude Code, signed in:  no'; then
      stop_here "Claude Code is not signed in. In Terminal, run: claude auth login (sign in to this Mac's own Claude account in the browser), then run the app again."
    fi
    if print_has "^  Claude Code's version:.*older than"; then
      if (( tries > 1 )); then
        stop_here "Claude Code is still older than the installer needs after claude update. Tell Jason."
      fi
      if [[ -n "$PRINT_ONLY" ]]; then
        would "ask to run claude update, because Claude Code in Terminal is older than the installer wants, and then print the installer again"
        break
      fi
      ask "Claude Code in Terminal is behind what Studio's installer wants. This runs claude update, which brings it up to date, and then the installer's print is shown again."
      "$CLAUDE" update || true
      changed+=("ran claude update")
      continue
    fi
    if print_has "^  The Claude app's own Claude Code:.*older than"; then
      if (( tries > 2 )); then
        stop_here "The Claude app's own Claude Code is still older than the installer wants. Tell Jason."
      fi
      if [[ -n "$PRINT_ONLY" ]]; then
        would "wait while the Claude app is brought up to date, and then print the installer again"
        break
      fi
      wait_for "The Claude app's own Claude Code is older than the installer wants. In the Claude app, choose Claude > Check for Updates, let it update, and open the app again."
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

  ask "Studio's installer now runs for real, with the same options as its print above. It sets Studio up on this Mac, changes this Mac's brimm-video settings to run from Studio, and ends with one real call to Claude from the background job (up to 90 seconds). It can take a few minutes."
  look_at_import_and_drop
  local kept rc
  kept="$(mktemp)"
  # Written before the installer runs, in words that are true however far it gets; made plain once it has finished.
  changed+=("ran Studio's installer (if it stopped, its last lines say how far it got)")
  local installer_at=${#changed[@]}
  set +e
  zsh "$STUDIO/tool/install.sh" --yes "${INSTALL_OPTIONS[@]}" "$ROOT" 2>&1 | while IFS= read -r line; do
    say "$line"
    print -r -- "$line" >> "$kept"
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

# Step 7, check 48: brimm-video's old key. Once the move is done and Jason has deleted the key on GitHub, its two files can go
# from this Mac. Asked only then; a no keeps them and does not stop the run.
retire_the_old_key() {
  heading "7. brimm-video's old key (check 48)"
  # A Mac set up fresh moved nothing from brimm-video, so its key, if there is one, is not this app's to take.
  if [[ -n "$FRESH" ]]; then
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
