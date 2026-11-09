#!/bin/zsh
# Puts in /Users/Shared/BRIMM Studio spikes what the spare account needs (spike only; see README.md). Run on the Mac Studio as
# jasonogden. The folder is readable by every account on the Mac and written only by this one.
#   zsh stage.sh [--print] helper   the folder itself; in-test-account.zsh, test-account.mjs and s2-compare.mjs; and a copy of Studio's
#                                   tool/ at this checkout's commit, as git archive makes it, without tests or move-app (what the app
#                                   will carry), with the commit in tool-commit.txt.
#   zsh stage.sh [--print] s3       S3's notarized and stapled zip; the model (a clone, which on the same disk takes no room); and the
#                                   .srt S2's new whisper-cli wrote on the Mac Studio, for the spare account's whisper step to compare with.
#   zsh stage.sh [--print] s4       S4's notarized and stapled zip, and the launch agent's template.
# --print says what it would copy, and changes nothing.
set -u
source ${0:A:h}/common.zsh

APP3="$WORK/s3-node/BRIMM Node Spike.app"
ZIP3="$WORK/s3-node/BRIMM Node Spike.zip"
APP4="$WORK/s4-agent/BRIMM Spike.app"
ZIP4="$WORK/s4-agent/BRIMM Spike.zip"
S2_SRT="$WORK/s2-whisper/out/compare/the-new-one-import/captions.srt"
PRINT=0

would() {
  if (( PRINT )); then
    say "Would: $*"
    say "Nothing was changed."
    exit 0
  fi
}

# A stapled app carries Apple's ticket in Contents/CodeResources: only one that was notarized and stapled is staged.
need_stapled() {
  [[ -f "$1/Contents/CodeResources" ]] || stop "Stopped: $1 is not notarized and stapled yet. Do those steps first; nothing was staged."
}

stage_helper() {
  local commit=$(git -C $REPO rev-parse HEAD)
  would "make $SHARED (readable by every account), copy in-test-account.zsh, test-account.mjs and s2-compare.mjs into it, and put tool/ at ${commit[1,7]} in $SHARED/tool, without tests or move-app"
  refuse_watched $SHARED
  mkdir -p $SHARED || stop "Stopped: $SHARED could not be made."
  chmod 755 $SHARED
  cp $SPIKE/in-test-account.zsh $SPIKE/test-account.mjs $SPIKE/s2-compare.mjs $SHARED/ || stop "Stopped: the helper's files could not be copied."
  rm -rf $SHARED/tool
  git -C $REPO archive --format=tar HEAD tool | tar -x -C $SHARED || stop "Stopped: tool/ could not be copied."
  rm -rf $SHARED/tool/tests $SHARED/tool/move-app
  print -r -- $commit > $SHARED/tool-commit.txt
  chmod -R a+rX $SHARED
  say "Staged in $SHARED: in-test-account.zsh, test-account.mjs, s2-compare.mjs, and tool/ at ${commit[1,7]} (without tests or move-app)."
}

stage_s3() {
  would "copy $ZIP3 into $SHARED/S3, clone the model into $SHARED/model, and copy $S2_SRT to $SHARED/S2/static-import.srt"
  need_stapled $APP3
  [[ -f $ZIP3 ]] || stop "Stopped: $ZIP3 is not there."
  [[ -d $SHARED ]] || stop "Stopped: $SHARED is not there yet. Stage the helper first."
  mkdir -p $SHARED/S3 $SHARED/model $SHARED/S2 || stop "Stopped: the folders could not be made."
  cp $ZIP3 $SHARED/S3/ || stop "Stopped: the zip could not be copied."
  say "Staged: $SHARED/S3/${ZIP3:t}"
  if [[ ! -f $SHARED/model/ggml-large-v3-turbo.bin ]]; then
    [[ -f $MODEL ]] || stop "Stopped: the model is not at $MODEL."
    cp -c $MODEL $SHARED/model/ || stop "Stopped: the model could not be cloned."
  fi
  say "Staged: $SHARED/model/ggml-large-v3-turbo.bin (a clone of Studio's model)"
  if [[ -f $S2_SRT ]]; then
    cp $S2_SRT $SHARED/S2/static-import.srt
    say "Staged: $SHARED/S2/static-import.srt (what S2's new whisper-cli wrote of the spike clip)"
  else
    say "Not staged: S2's comparison has not been run, so the spare account's whisper step has nothing to compare with yet."
  fi
  chmod -R a+rX $SHARED
}

stage_s4() {
  would "copy $ZIP4 and the launch agent's template into $SHARED/S4"
  need_stapled $APP4
  [[ -f $ZIP4 ]] || stop "Stopped: $ZIP4 is not there."
  [[ -d $SHARED ]] || stop "Stopped: $SHARED is not there yet. Stage the helper first."
  mkdir -p $SHARED/S4 || stop "Stopped: $SHARED/S4 could not be made."
  cp $ZIP4 $SPIKE/agent-spike/com.thebrimm.spike-agent.plist $SHARED/S4/ || stop "Stopped: S4's files could not be copied."
  chmod -R a+rX $SHARED
  say "Staged: $SHARED/S4/${ZIP4:t} and $SHARED/S4/com.thebrimm.spike-agent.plist"
}

if [[ ${1-} == --print ]]; then
  PRINT=1
  shift
fi
case ${1-} in
  helper) stage_helper ;;
  s3) stage_s3 ;;
  s4) stage_s4 ;;
  *) stop "Say what to stage: helper, s3 or s4." ;;
esac
