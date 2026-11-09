#!/bin/zsh
# The spikes' steps in the spare account, "Studio Test" (spike only; see README.md). stage.sh copies this file to
# /Users/Shared/BRIMM Studio spikes/, and Jason runs it there, in that account's own Terminal, one step at a time:
#   zsh "/Users/Shared/BRIMM Studio spikes/in-test-account.zsh" [--print] <step>
# --print says what the step would do, and changes nothing. The steps:
#   setup          takes Homebrew off this account's PATH and makes Xcode's tools answer as if they were missing (in ~/.zprofile),
#                  and makes ~/Applications. Terminal is then quit and opened again.
#   look           says which programs this account finds, and whether it is an admin.
#   take s3|s4|s7  copies S3's, S4's or S7's zip into ~/Downloads and marks it as downloaded from the internet, as Safari would.
#   node           S3: runs the node inside BRIMM Node Spike.app, and says what Gatekeeper says of the app.
#   cli            S3: that node's npm installs the pinned HyperFrames command line, as install.sh does, and Studio's own check of it.
#   version, chrome, doctor   S3: the command line's --version, browser ensure and doctor, run as Studio runs it.
#   sharp          S3: loads sharp, from the command line's folder, in the signed node.
#   whisper        S3: the whisper-cli inside the app transcribes the spike clip, compared with the Mac Studio's.
#   agent-plist, agent-load, agent-log, agent-remove   S4: the launch agent com.thebrimm.spike-agent, in this account only.
#   claude-status  S5: Claude Code's version, and whether it is signed in (never the email address).
#   project, lint, open-app   S6: the test project, written with Studio's own code; the command line's lint; its open.
#   homebrew       S6: any program of this account's running from /opt/homebrew, and where HyperFrames runs from.
#   exported       S6: the newest video in ~/Downloads, read by the app's own ffprobe.
#   runtimes       S6: what the HyperFrames app keeps in its runtimes folder.
#   sparkle-version   S7: the version, build and word of the Sparkle Spike in ~/Applications, and who signed it.
# It refuses every step that changes anything in an account that is an admin: it is for the standard Studio Test account alone.
set -u

SHARED="/Users/Shared/BRIMM Studio spikes"
TOOLCOPY="$SHARED/tool"
NODE_APP="$HOME/Applications/BRIMM Node Spike.app"
BIN="$NODE_APP/Contents/Resources/node/bin"
SPIKE_APP="$HOME/Applications/BRIMM Spike.app"
SPARKLE_APP="$HOME/Applications/Sparkle Spike.app"
LABEL=com.thebrimm.spike-agent
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
WATCH="$HOME/BRIMM Spike Watch"
AGENT_LOG="$HOME/Library/Logs/BRIMM Spike agent.log"
SPIKE_OUT="$HOME/BRIMM Spike Out"
CLAUDE="$HOME/.local/bin/claude"
PROJECTS="$HOME/BRIMM Video Work/Spike S6"
MODEL_SHA256=1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69
HF_VERSION=$(plutil -extract version raw -o - "$TOOLCOPY/hyperframes.pin.json" 2>/dev/null)
TOOLCHAIN="$HOME/BRIMM Video Work/.toolchain/hyperframes-$HF_VERSION"
HF="$TOOLCHAIN/node_modules/hyperframes/bin/hyperframes.mjs"
PRINT=0

say() { print -r -- "$@" }
stop() { print -r -- "$@"; exit 1 }
is_admin() { id -Gn | tr ' ' '\n' | grep -qx admin }

# Every step that changes anything starts here.
refuse_admin() {
  if is_admin; then stop "Stopped: $(id -un) is an admin account, and these steps are for the standard Studio Test account alone. Nothing was changed."; fi
  [[ $HOME != /Users/jasonogden ]] || stop "Stopped: this is your own account, and these steps are for the Studio Test account alone. Nothing was changed."
}

# For --print: says what the step would do, and ends it.
would() {
  if (( PRINT )); then
    say "Would: $*"
    say "Nothing was changed."
    exit 0
  fi
}

need_node() { [[ -x $BIN/node ]] || stop "Stopped: there is no BRIMM Node Spike.app in the Applications folder in your home folder ($BIN/node is not there). Do S3's steps first." }
need_cli() { [[ -f $HF ]] || stop "Stopped: the HyperFrames command line is not installed in this account yet ($HF). Run the cli step first." }

# The pinned command line, run as Studio runs it (hyperframes.js childEnv): only HOME, LANG and a PATH that starts with node's own
# folder, and everything it does on its own turned off. DEVELOPER_DIR is passed on, so that Xcode's tools still answer as missing.
run_hf() {
  local -a extra
  [[ -n ${DEVELOPER_DIR-} ]] && extra=(DEVELOPER_DIR=$DEVELOPER_DIR)
  env -i HOME="$HOME" LANG=en_US.UTF-8 PATH="$BIN:/usr/bin:/bin" "${extra[@]}" \
    HYPERFRAMES_NO_TELEMETRY=1 HYPERFRAMES_SKIP_SKILLS=1 HYPERFRAMES_NO_UPDATE_CHECK=1 HYPERFRAMES_NO_AUTO_INSTALL=1 HYPERFRAMES_NO_OPTIONAL_INSTALL=1 \
    "$BIN/node" "$HF" "$@"
}

# The one project the project step wrote.
project_dir() {
  local -a found
  found=("$PROJECTS"/*(N/))
  (( ${#found} == 1 )) || stop "Stopped: there should be one test project in $PROJECTS, and there are ${#found}. Run the project step first."
  print -r -- "${found[1]}"
}

# --- The account ---

step_setup() {
  would "add to ~/.zprofile the lines that set PATH to ~/.local/bin and macOS's own folders alone, and DEVELOPER_DIR to an empty place; make ~/Applications"
  refuse_admin
  local f="$HOME/.zprofile"
  [[ -f $f ]] && sed -i '' '/^# >>> BRIMM Studio spikes/,/^# <<< BRIMM Studio spikes/d' "$f"
  {
    print -r -- "# >>> BRIMM Studio spikes (spike only): this account is to look like a client's Mac, with no Homebrew and no Xcode tools."
    print -r -- 'export PATH="$HOME/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin"'
    print -r -- "export DEVELOPER_DIR=/var/empty/no-xcode-tools"
    print -r -- "# <<< BRIMM Studio spikes"
  } >> "$f"
  mkdir -p "$HOME/Applications" || stop "Stopped: ~/Applications could not be made."
  say "Written: $f, with PATH set to ~/.local/bin and macOS's own folders, and DEVELOPER_DIR to an empty place."
  say "Made: $HOME/Applications"
  say "Quit Terminal (Command-Q) and open it again, for this to take effect."
}

step_look() {
  would "say which programs this account finds, and whether it is an admin"
  say "This account: $(id -un), $(is_admin && print -r -- 'an admin' || print -r -- 'standard (not an admin)')."
  say "Its PATH: $PATH"
  local p found
  for p in node npm ffmpeg ffprobe whisper-cli whisper-cpp brew claude; do
    found=$(whence -p $p 2>/dev/null)
    say "  $p: ${found:-not found}"
  done
  found=$(/usr/bin/git --version 2>&1)
  if [[ $found == *DEVELOPER_DIR* || $found == *"developer tools"* || $found == *"xcode-select"* ]]; then
    say "  Xcode's tools (git): missing, as on a Mac without them."
  else
    say "  Xcode's tools (git): they answer here: $found"
  fi
  say "Homebrew is still on this Mac's disk, in /opt/homebrew: a program here that looks there by name would find it. Each spike says which program it ran, by its whole path."
}

step_take() {
  local which=${1-}
  local zip
  case $which in
    s3) zip="$SHARED/S3/BRIMM Node Spike.zip" ;;
    s4) zip="$SHARED/S4/BRIMM Spike.zip" ;;
    s7) zip="$SHARED/S7/Sparkle Spike.zip" ;;
    *) stop "Say which: take s3, take s4 or take s7." ;;
  esac
  would "copy $zip into ~/Downloads and mark it as downloaded from the internet, as Safari would (the com.apple.quarantine mark)"
  refuse_admin
  [[ -f $zip ]] || stop "Stopped: $zip is not there yet. Claude stages it first."
  local to="$HOME/Downloads/${zip:t}"
  cp "$zip" "$to" || stop "Stopped: it could not be copied into Downloads."
  xattr -w com.apple.quarantine "0081;$(printf '%x' $(date +%s));Safari;" "$to" || stop "Stopped: it could not be marked as downloaded."
  say "Copied into Downloads, and marked as downloaded from the internet: $to"
  say "Its mark: $(xattr -p com.apple.quarantine "$to")"
}

# --- S3 ---

step_node() {
  would "run $BIN/node --version and say where it is, whether the app is marked as downloaded, what Gatekeeper says of it, and what is beside node"
  need_node
  say "node: $BIN/node"
  local version
  version=$("$BIN/node" --version 2>&1) || say "It did not run: $version"
  say "Its version: $version"
  say "It runs as: $("$BIN/node" -p 'process.execPath' 2>&1)"
  if xattr -p com.apple.quarantine "$NODE_APP" >/dev/null 2>&1; then say "The app is marked as downloaded from the internet: yes."; else say "The app is marked as downloaded from the internet: no."; fi
  say "What Gatekeeper says of the app:"
  spctl --assess --type execute -vv "$NODE_APP" 2>&1 | sed 's/^/  /'
  say "Beside node: $(ls "$BIN" | paste -sd ' ' -)"
  if [[ -x $BIN/ffmpeg ]]; then say "  $("$BIN/ffmpeg" -hide_banner -version 2>&1 | head -1)"; fi
}

step_cli() {
  would "install the HyperFrames command line ${HF_VERSION:-(the version in $TOOLCOPY/hyperframes.pin.json, which is not staged yet)} into ${HOME}/BRIMM Video Work/.toolchain with the app's npm, from the npm registry (registry.npmjs.org, about 100 MB once installed), none of the package's own scripts run, as install.sh does; then check it with Studio's own toolchainHolds"
  refuse_admin
  need_node
  [[ -n $HF_VERSION ]] || stop "Stopped: the pin could not be read from $TOOLCOPY/hyperframes.pin.json."
  if [[ ! -f $HF ]]; then
    say "Installing the HyperFrames command line $HF_VERSION with $BIN/npm, from the npm registry. It takes a minute or two."
    mkdir -p "$TOOLCHAIN" || stop "Stopped: $TOOLCHAIN could not be made."
    if ! env PATH="$BIN:/usr/bin:/bin" HYPERFRAMES_NO_TELEMETRY=1 "$BIN/npm" install --prefix "$TOOLCHAIN" --ignore-scripts --no-fund --no-audit --save-exact "hyperframes@$HF_VERSION"; then
      stop "Stopped: npm could not install it (what it said is above)."
    fi
  else
    say "It is installed already, in $TOOLCHAIN."
  fi
  "$BIN/node" "$SHARED/test-account.mjs" toolchain
}

step_version() {
  would "run the command line's --version, as Studio runs it"
  need_node
  need_cli
  run_hf --version
}

step_chrome() {
  would "run the command line's browser ensure, as install.sh does: it fetches the Chrome Headless Shell it renders with from storage.googleapis.com (about 190 MB once unpacked) into ~/.cache/hyperframes/chrome, unless it is there"
  refuse_admin
  need_node
  need_cli
  run_hf browser ensure
}

step_doctor() {
  would "run the command line's doctor, as install.sh does"
  need_node
  need_cli
  run_hf doctor
}

step_sharp() {
  would "load sharp from the command line's folder in the app's signed node, and make a small picture with it"
  need_node
  need_cli
  "$BIN/node" "$SHARED/test-account.mjs" sharp
}

step_whisper() {
  would "make the spike clip's .wav with the app's ffmpeg, transcribe it with the app's whisper-cli and Studio's own arguments, and diff the .srt with the Mac Studio's"
  need_node
  local p
  for p in ffmpeg ffprobe whisper-cli; do [[ -x $BIN/$p ]] || stop "Stopped: there is no $p beside node in the app: S1 or S2 was not built when the app was made."; done
  [[ -f "$SHARED/model/ggml-large-v3-turbo.bin" ]] || stop "Stopped: the model is not in $SHARED/model yet. Claude stages it with S3."
  [[ -f "$SHARED/S2/static-import.srt" ]] || stop "Stopped: the Mac Studio's .srt is not in $SHARED/S2 yet. Claude stages it with S3."
  "$BIN/node" "$SHARED/s2-compare.mjs" --tool "$TOOLCOPY" --clip "$SHARED/Spike clip.mov" --ffmpeg "$BIN/ffmpeg" --ffprobe "$BIN/ffprobe" \
    --model "$SHARED/model/ggml-large-v3-turbo.bin" --model-sha $MODEL_SHA256 --whisper "this app=$BIN/whisper-cli" \
    --expect "the Mac Studio=$SHARED/S2/static-import.srt" --out "$SPIKE_OUT/whisper"
}

# --- S4 ---

# The launch agent, with this account's home in it.
agent_text() {
  local template="$SHARED/S4/com.thebrimm.spike-agent.plist" home
  [[ -f $template ]] || stop "Stopped: $template is not there yet. Claude stages it with S4."
  home=${HOME//&/&amp;}
  home=${home//</&lt;}
  home=${home//>/&gt;}
  sed "s|@HOME@|$home|g" "$template"
}

step_agent_plist() {
  would "print the launch agent agent-load would write, with this account's home in it"
  agent_text
}

step_agent_load() {
  would "write $PLIST, make $WATCH, and load it with launchctl bootstrap gui/$(id -u): it runs the app's own program with --agent, once now and again whenever something in $WATCH changes"
  refuse_admin
  [[ -x "$SPIKE_APP/Contents/MacOS/BRIMM Spike" ]] || stop "Stopped: there is no BRIMM Spike.app in the Applications folder in your home folder. Do S4's steps first."
  if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then stop "Stopped: $LABEL is loaded already. Run agent-remove first."; fi
  local text
  text=$(agent_text) || exit 1
  [[ $(print -r -- "$text" | plutil -extract Label raw -o - - 2>/dev/null) == $LABEL ]] || stop "Stopped: the launch agent's label is not $LABEL."
  [[ $text != *com.thebrimm.unedited* ]] || stop "Stopped: the launch agent names com.thebrimm.unedited, which is never touched here."
  mkdir -p "$WATCH" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs" || stop "Stopped: the folders could not be made."
  print -r -- "$text" > "$PLIST"
  plutil -lint "$PLIST" >/dev/null || stop "Stopped: $PLIST did not pass plutil."
  launchctl bootstrap "gui/$(id -u)" "$PLIST" || stop "Stopped: launchctl could not load it (what it said is above)."
  say "Loaded: $LABEL, from $PLIST."
  say "It runs now, once, and again whenever something in $WATCH changes. Its log: $AGENT_LOG"
}

step_agent_log() {
  would "say whether $LABEL is loaded, and show the end of its log"
  if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
    say "$LABEL is loaded:"
    launchctl print "gui/$(id -u)/$LABEL" | grep -E '^[[:space:]]*(state|runs|last exit code) =' | sed 's/^[[:space:]]*/  /'
  else
    say "$LABEL is not loaded."
  fi
  if [[ -f $AGENT_LOG ]]; then
    say "The end of its log, $AGENT_LOG:"
    tail -n 30 "$AGENT_LOG"
  else
    say "There is no log yet."
  fi
}

step_agent_remove() {
  would "stop $LABEL and delete $PLIST (the log, and $WATCH, are left)"
  refuse_admin
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null
  rm -f "$PLIST"
  if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then stop "It is still loaded: tell Claude."; fi
  say "Removed: $LABEL is not loaded, and $PLIST is deleted."
}

# --- S5 ---

step_claude_status() {
  would "say Claude Code's version and whether it is signed in, from claude auth status --json, never the email address"
  [[ -x $CLAUDE ]] || stop "Claude Code is not in ~/.local/bin."
  say "Claude Code: $("$CLAUDE" --version 2>&1 | head -1), at $CLAUDE"
  local told signed plan
  told=$("$CLAUDE" auth status --json 2>/dev/null)
  signed=$(print -rn -- "$told" | plutil -extract loggedIn raw -o - - 2>/dev/null)
  plan=$(print -rn -- "$told" | plutil -extract subscriptionType raw -o - - 2>/dev/null)
  case $signed in
    true) say "Signed in: yes${plan:+ ($plan)}." ;;
    false) say "Signed in: no." ;;
    *) say "Signed in: claude auth status said nothing that could be read." ;;
  esac
}

# --- S6 ---

step_project() {
  would "write a test project in $PROJECTS with Studio's own code (projectFiles and writeProject, as explainer.js writes a HeyGen explainer's), run on the app's node"
  refuse_admin
  need_node
  need_cli
  "$BIN/node" "$SHARED/test-account.mjs" project
}

step_lint() {
  would "run the command line's lint on the test project"
  need_node
  need_cli
  run_hf lint "$(project_dir)"
}

step_open_app() {
  would "hand the test project to the HyperFrames app with the command line's open … --json, as edit.js does"
  need_node
  need_cli
  run_hf open "$(project_dir)" --json
}

step_homebrew() {
  would "list this account's programs running from /opt/homebrew, and say where HyperFrames runs from"
  local -a lines
  lines=("${(@f)$(ps -U "$(id -u)" -o command= | grep -F /opt/homebrew | grep -v -F 'grep -F')}")
  lines=(${lines:#})
  if (( ${#lines} )); then
    say "This account's programs running from /opt/homebrew: ${#lines}"
    for l in "${lines[@]}"; do say "  ${l[1,200]}"; done
  else
    say "This account's programs running from /opt/homebrew: none."
  fi
  # Each copy of the app this account is running, by its folder: the one in ~/Applications, or the one in /Applications, or both.
  local -a apps
  apps=("${(@fu)$(ps -U "$(id -u)" -o command= | grep -F 'HyperFrames.app/Contents/MacOS/HyperFrames' | grep -v -F 'grep -F' | sed 's|/Contents/MacOS/.*||')}")
  apps=(${apps:#})
  if (( ${#apps} )); then
    for l in "${apps[@]}"; do say "HyperFrames runs from: $l"; done
  else
    say "HyperFrames runs from: (it is not running)"
  fi
}

step_exported() {
  would "read the newest .mp4 or .mov in ~/Downloads with the app's own ffprobe"
  local -a videos
  videos=("$HOME/Downloads"/*.(mp4|mov)(N.om))
  (( ${#videos} )) || stop "There is no .mp4 or .mov in Downloads."
  say "The newest video in Downloads: ${videos[1]:t}, $(stat -f %z "${videos[1]}") bytes, made $(stat -f %Sm "${videos[1]}")."
  if [[ -x $BIN/ffprobe ]]; then
    "$BIN/ffprobe" -v error -show_entries format=duration:stream=codec_type,codec_name,width,height -of compact=p=0 "${videos[1]}"
  else
    say "There is no ffprobe in the app to read it with (S1 was not built when it was made)."
  fi
}

step_runtimes() {
  would "list what the HyperFrames app keeps in ~/Library/Application Support/HyperFrames/runtimes, by name and size"
  local r="$HOME/Library/Application Support/HyperFrames/runtimes"
  [[ -d $r ]] || stop "There is no $r: the app has fetched none, or keeps them elsewhere."
  say "In $r:"
  du -sh "$r"/*(N) | sed "s|$r/||; s/^/  /"
}

# --- S7 ---

step_sparkle_version() {
  would "say the version, build and word of $SPARKLE_APP, the team that signed it, and whether its signature checks"
  [[ -d $SPARKLE_APP ]] || stop "Stopped: there is no Sparkle Spike.app in the Applications folder in your home folder. Do S7's steps first."
  local plist="$SPARKLE_APP/Contents/Info.plist" told
  say "Sparkle Spike: version $(plutil -extract CFBundleShortVersionString raw -o - "$plist" 2>/dev/null) ($(plutil -extract CFBundleVersion raw -o - "$plist" 2>/dev/null)), \"$(plutil -extract BRIMMSpikeWord raw -o - "$plist" 2>/dev/null)\", at $SPARKLE_APP"
  told=$(codesign -dv --verbose=2 "$SPARKLE_APP" 2>&1)
  say "Signed by: $(print -r -- "$told" | sed -n 's/^Authority=//p' | head -1), team $(print -r -- "$told" | sed -n 's/^TeamIdentifier=//p')"
  if codesign --verify --strict --deep "$SPARKLE_APP" 2>/dev/null; then say "Its signature checks: yes."; else say "Its signature checks: no."; fi
  say "Its feed: $(plutil -extract SUFeedURL raw -o - "$plist" 2>/dev/null)"
}

# --- Which step ---

if [[ ${1-} == --print ]]; then
  PRINT=1
  shift
fi
case ${1-} in
  setup) step_setup ;;
  look) step_look ;;
  take) step_take ${2-} ;;
  node) step_node ;;
  cli) step_cli ;;
  version) step_version ;;
  chrome) step_chrome ;;
  doctor) step_doctor ;;
  sharp) step_sharp ;;
  whisper) step_whisper ;;
  agent-plist) step_agent_plist ;;
  agent-load) step_agent_load ;;
  agent-log) step_agent_log ;;
  agent-remove) step_agent_remove ;;
  claude-status) step_claude_status ;;
  project) step_project ;;
  lint) step_lint ;;
  open-app) step_open_app ;;
  homebrew) step_homebrew ;;
  exported) step_exported ;;
  runtimes) step_runtimes ;;
  sparkle-version) step_sparkle_version ;;
  *) stop "Say which step: setup, look, take s3, take s4, take s7, node, cli, version, chrome, doctor, sharp, whisper, agent-plist, agent-load, agent-log, agent-remove, claude-status, project, lint, open-app, homebrew, exported, runtimes or sparkle-version." ;;
esac
