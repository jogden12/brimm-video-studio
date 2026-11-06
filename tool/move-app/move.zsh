#!/bin/zsh
# Moves Sallie's laptop from brimm-video to Studio, one asked step at a time, in a Terminal window. It is the heart of the
# small Mac app "Move to Studio", which hands this script to Terminal.
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
# of a file in her drop folder. What it says is also kept in ~/Library/Logs/brimm-video-studio-move.log.
# Exit: 0 finished (or --print done); 1 stopped; 2 refused before anything (an option, not a Mac, not her laptop).
set -euo pipefail

# The values this app works from, each set once, here.
MACHINE="Sallie's laptop"
STUDIO_URL="${BRIMM_STUDIO_REPO:-git@github-brimm-video-studio:jogden12/brimm-video-studio.git}"
HOST_ALIAS="github-brimm-video-studio"
KEY="$HOME/.ssh/brimm_video_studio_deploy"
KEY_COMMENT="brimm-video-studio read-only, Sallie's laptop"
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
# The installer's options, written here and nowhere else, so that a later round changes one line.
INSTALL_OPTIONS=(--machine "Sallie's laptop" --drop Drop --import light --handoff 2)
HF_APP="${BRIMM_HYPERFRAMES_APP:-/Applications/HyperFrames.app}"
HF_PAGE="https://hyperframes.dev/studio"
CHECK_FILE="$HOME/Library/LaunchAgents/com.thebrimm.claude-check.plist"
AGENT_FILE="$HOME/Library/LaunchAgents/com.thebrimm.unedited.plist"
# Where programs are looked for after PATH: Homebrew's two folders. A test names none.
HOMEBREW_DIRS="${BRIMM_HOMEBREW_DIRS-/opt/homebrew/bin:/usr/local/bin}"
# ssh and git always use her own files, never the ones of the home folder the passwd database names (a Terminal can be started
# with another HOME). StrictHostKeyChecking=yes with her known_hosts, so that a host that is not GitHub's is never trusted.
SSH_OPTS=(-F "$HOME/.ssh/config" -o "UserKnownHostsFile=$HOME/.ssh/known_hosts" -o StrictHostKeyChecking=yes -o HostKeyAlgorithms=ssh-ed25519 -o BatchMode=yes)
export GIT_SSH_COMMAND="ssh ${(j: :)${(@q)SSH_OPTS}}"

SELF="${(%):-%x}"
# State of the run.
PRINT_ONLY=""        # set by --print: nothing is changed, written or asked
LOGGING=""           # set once the run is a real one that has been let through: what is said is also kept in $LOG
COMMIT=""
changed=()           # each change this run made, in words, for the stop summary
made_partial=""      # set when this run made $PARTIAL, so that a Ctrl-C takes it away again
R41=()               # the report's lines for check 41
ROOT="" DROP="" CHECKOUT_NOW="" NODE="" CLAUDE=""

say() {
  print -r -- "$@"
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
# Ctrl-C and a kill: a clone this run was part way through is taken away, so the next run starts clean.
interrupted() {
  say ""
  [[ -z "$made_partial" || -z "$PARTIAL" ]] || rm -rf "$PARTIAL"
  summary
  exit $1
}
on_int() { interrupted 130; }
on_term() { interrupted 143; }

# Asks to go ahead with what $1 says will change. One line is read from the terminal: y or yes, in any case, with spaces round
# it, goes ahead; anything else, an empty line, or the end of input stops. Under --print nothing is asked.
ask() {
  local line=""
  say "$1"
  print -rn -- "Go ahead? Type y and press Return, or n to stop: "
  [[ -z "$LOGGING" ]] || print -rn -- "Go ahead? Type y and press Return, or n to stop: " >> "$LOG"
  IFS= read -r line || true
  # A line from a pipe has no Return of its own on screen.
  [[ -t 0 ]] || say ""
  [[ "${(L)line}" =~ '^[[:space:]]*(y|yes)[[:space:]]*$' ]] || stop_here
}
# Waits for something she does by hand: an empty line goes on, anything else stops.
wait_for() {
  local line=""
  say "$1"
  print -rn -- "Press Return when that's done, or type n and press Return to stop: "
  [[ -z "$LOGGING" ]] || print -rn -- "Press Return when that's done, or type n and press Return to stop: " >> "$LOG"
  IFS= read -r line || line="${line:-n}"
  [[ -t 0 ]] || say ""
  [[ -z "${line//[[:space:]]/}" ]] || stop_here
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
# One value from her brimm-video settings, or nothing.
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

# Whether this is her laptop, from its settings: refused (exit 2, nothing changed) if it is another Mac or has none.
refuse_unless_her_laptop() {
  if [[ "$(uname -s)" != "Darwin" ]]; then say "This is for a Mac."; exit 2; fi
  if [[ ! -f "$SETTINGS" ]]; then
    say "This Mac has no brimm-video settings (~/Library/Application Support/BRIMM Video/settings.json), so it isn't a laptop this app moves. Nothing was changed."
    exit 2
  fi
  local machine="$(setting machine)"
  if [[ "$machine" != "$MACHINE" ]]; then
    say "This app is for $MACHINE, and this Mac's settings say it is \"$machine\". Nothing was changed."
    exit 2
  fi
}

# Step 1, check 41: what this Mac has, and whether it is as the switch of 26 October left it. It changes nothing, except that
# Claude Code's sign-in is offered, and only on her y.
look_at_this_mac() {
  heading "1. Looking at this Mac (check 41). This changes nothing."
  local macos kb gb line brew version plan signed told claude_version

  macos="$(sw_vers -productVersion 2>/dev/null || true)"
  say "  macOS:  ${macos:-could not be read}"
  R41+=("macOS: ${macos:-could not be read}")

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
    R41+=("Free disk: $gb GB")
  else
    say "  Free disk:  could not be read"
    R41+=("Free disk: could not be read")
  fi

  if ! xcode-select -p >/dev/null 2>&1; then
    say "  Xcode's command line tools:  not here."
    stop_here "In Terminal, run: xcode-select --install, then run the app again."
  fi
  say "  Xcode's command line tools:  here"
  R41+=("Xcode's command line tools: here")

  brew="$(find_program brew || true)"
  if [[ -z "$brew" ]]; then
    say "  Homebrew:  not here."
    stop_here 'In Terminal, Sallie runs this (it asks for her password, which she types herself): /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
  fi
  version="$("$brew" --version 2>/dev/null || true)"
  local -a said
  said=("${(@f)version}")
  version="${said[1]-}"
  say "  Homebrew:  ${version:-here}"
  R41+=("Homebrew: ${version:-here}")

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
  R41+=("Node: $version")

  # Her settings, as the switch of 26 October left them. A checkout that is Studio's is as good as brimm-video's: a later run.
  ROOT="$(setting root)"
  CHECKOUT_NOW="$(setting checkout)"
  local import="$(setting import)" handoff="$(setting handoffVersion)" drop="$(setting drop)"
  say "  brimm-video's settings:  import $import, hand-off version $handoff, drop folder $drop"
  R41+=("brimm-video's settings: $MACHINE, import $import, hand-off version $handoff, drop folder $drop")
  [[ "$import" == light ]] || stop_here "Her settings are not as the switch of 26 October left them: the import is \"$import\", and it should be \"light\"."
  [[ "$drop" == Drop ]] || stop_here "Her settings are not as the switch of 26 October left them: the drop folder is \"$drop\", and it should be \"Drop\"."
  [[ "$handoff" == 2 ]] || stop_here "Her settings are not as the switch of 26 October left them: the hand-off version is \"$handoff\", and it should be \"2\"."
  if [[ "$CHECKOUT_NOW" != "$OLD_CHECKOUT" && "$CHECKOUT_NOW" != "$STUDIO" ]]; then
    stop_here "Her settings are not as the switch of 26 October left them: the checkout is \"$CHECKOUT_NOW\", and it should be brimm-video's ($OLD_CHECKOUT) or Studio's ($STUDIO)."
  fi

  # No import is running when every com.thebrimm job has no process id ("-") in the first column.
  local job
  for job in "${(@f)$(launchctl list 2>/dev/null | grep com.thebrimm || true)}"; do
    [[ -n "$job" ]] || continue
    if [[ "${job%%[[:space:]]*}" != "-" ]]; then
      stop_here "An import is running now. Wait until its window in the top right closes, then double-click Move to Studio again."
    fi
  done
  say "  No import is running."
  R41+=("No import running")

  # Her drop folder is the one her own brimm-video names. It is counted and never listed: a file's name can be a client's.
  if [[ ! -f "$CHECKOUT_NOW/tool/settings.js" ]]; then
    stop_here "Her checkout ($CHECKOUT_NOW) has no tool/settings.js to say where her drop folder is."
  fi
  DROP="$("$NODE" "$CHECKOUT_NOW/tool/settings.js" show 2>/dev/null | sed -n 's/^  Its drop folder:  //p' | head -n 1 || true)"
  if [[ -z "$DROP" || ! -d "$DROP" ]]; then
    stop_here "Her drop folder could not be found from her settings (settings.js show)."
  fi
  local -a held
  held=("$DROP"/*(N) "$DROP"/.*(N))
  held=(${held:#*/.}) held=(${held:#*/..}) held=(${held:#*/.DS_Store}) held=(${held:#*/.brimm-watched-by})
  if (( ${#held[@]} > 0 )); then
    stop_here "Her drop folder holds ${#held[@]} file$([[ ${#held[@]} -eq 1 ]] || print -rn s) still to be imported."
  fi
  say "  Her drop folder is empty."
  R41+=("Her drop folder is empty")

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
      would "ask to run claude auth login, which opens the browser for Sallie to sign in to her own Claude account."
    else
      ask "Claude Code is not signed in. This will run claude auth login, which opens the browser; Sallie signs in to her own Claude account there (signing in to the Claude app does not sign in this command)."
      "$CLAUDE" auth login || true
      changed+=("signed Claude Code in")
      told="$("$CLAUDE" auth status --json 2>/dev/null || true)"
      signed="$(print -rn -- "$told" | plutil -extract loggedIn raw -o - - 2>/dev/null || true)"
      [[ "$signed" == true ]] || stop_here "Claude Code is still not signed in."
    fi
  fi
  plan="$(print -rn -- "$told" | plutil -extract subscriptionType raw -o - - 2>/dev/null || true)"
  version="$("$CLAUDE" --version 2>/dev/null || true)"
  claude_version="${version%%[[:space:]]*}"
  if [[ "$signed" == true ]]; then
    say "  Claude Code:  signed in${plan:+ ($plan)}, version ${claude_version:-that could not be read}"
    R41+=("Claude Code: signed in${plan:+ ($plan)}, version ${claude_version:-unreadable}")
  else
    R41+=("Claude Code: not signed in, version ${claude_version:-unreadable}")
  fi
}

# The steps after the look. Each is replaced by its own task; until then it says its heading and does nothing.
make_the_key() { heading "2. Studio's key (check 42)"; }
get_the_code() { heading "3. Studio's code (check 42)"; }
find_the_app() { heading "4. The HyperFrames app (check 43)"; }
run_the_installer() { heading "5. Studio's installer (check 44)"; }
write_the_report() { heading "6. The report"; }
retire_the_old_key() { heading "7. brimm-video's old key (check 48)"; }

main() {
  read_options "$@"
  refuse_unless_her_laptop
  trap on_int INT
  trap on_term TERM
  if [[ -z "$PRINT_ONLY" ]]; then
    mkdir -p "${LOG:h}"
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
  else
    say "Done. Next on the By-Hand page: checks 45 to 47, on screen."
  fi
  exit 0
}

# Main runs only when this file is run, so that a test can source it and call one function alone.
if [[ $ZSH_EVAL_CONTEXT == toplevel ]]; then main "$@"; fi
