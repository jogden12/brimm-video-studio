#!/bin/zsh
# Move to Studio.app's helper: it opens Terminal on the move script, with this app's commit.
# The script is copied, with the .command that runs it, into a fresh temporary folder, and Terminal opens that: a copy made with
# cp -X carries no quarantine mark, so macOS runs it with no question, even when the app itself is running from a temporary place.
# If anything fails it says so in an alert and ends with 1.

here=${0:A:h}

alert() {
  osascript -e "display alert \"Move to Studio could not open Terminal.\" message \"$1\""
  exit 1
}

[[ -r $here/commit.txt ]] || alert "This copy of the app has no record of its version. Ask Jason for a new copy."
read -r commit < $here/commit.txt
[[ $commit =~ '^[0-9a-f]{40}$' ]] || alert "This copy of the app has no record of its version. Ask Jason for a new copy."
[[ -r $here/move.zsh ]] || alert "This copy of the app is missing a part. Ask Jason for a new copy."

folder=$(mktemp -d "${TMPDIR:-/tmp}/move-to-studio.XXXXXX") || alert "A temporary folder could not be made."
folder=${folder%/}
cp -X $here/move.zsh $folder/move.zsh || alert "A temporary copy could not be made."
xattr -c $folder/move.zsh 2>/dev/null   # cp -X is meant to leave marks behind, but a quarantine mark can still come across on some Macs
command_file=$folder/"Move to Studio.command"
move_file=$folder/move.zsh
printf '#!/bin/zsh\n/bin/zsh %s --commit %s\n' "${(qq)move_file}" $commit > $command_file || alert "A temporary file could not be written."
chmod 755 $command_file $folder/move.zsh
open -a Terminal $command_file || alert "Terminal did not open."
