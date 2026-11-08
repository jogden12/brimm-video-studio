#!/bin/zsh
# Move to Studio.app's helper: it opens Terminal on the move script, with this app's commit.
# The script is copied, with the .command that runs it, into a fresh temporary folder, and Terminal opens that. Terminal asks
# nothing because the .command is written fresh by printf here, so it carries no quarantine mark. cp -X keeps com.apple.quarantine
# on this macOS, so the copied script may carry the mark; zsh runs it whatever marks it carries.
# The folder chooser (Helpers/Choose a Folder.app) is recreated beside the move script the same way: each folder with mkdir -p, each
# file through cat into a redirect. On this macOS, cp -X and ditto --noqtn keep com.apple.quarantine, and a redirect does not. A
# chooser that carried the mark would ask Gatekeeper's question again when the move opens it.
# --try-chooser (then, optionally, --second-way) makes the .command run the move script's try of the folder questions instead of a
# move: no --commit. Any other argument is passed over.
# If anything fails it says so in an alert and ends with 1.

here=${0:A:h}

try=
second=
for arg in "$@"; do
  case $arg in
    --try-chooser) try=--try-chooser ;;
    --second-way) [[ -n $try ]] && second=--second-way ;;
  esac
done

alert() {
  osascript -e "display alert \"Move to Studio could not open Terminal.\" message \"$1\""
  exit 1
}

[[ -r $here/commit.txt ]] || alert "This copy of the app has no record of its version. Ask Jason for a new copy."
read -r commit < $here/commit.txt
[[ $commit =~ '^[0-9a-f]{40}$' ]] || alert "This copy of the app has no record of its version. Ask Jason for a new copy."
[[ -r $here/move.zsh ]] || alert "This copy of the app is missing a part. Ask Jason for a new copy."
chooser_src=${here:h}/Helpers/"Choose a Folder.app"
[[ -d $chooser_src ]] || alert "This copy of the app is missing a part. Ask Jason for a new copy."

folder=$(mktemp -d "${TMPDIR:-/tmp}/move-to-studio.XXXXXX") || alert "A temporary folder could not be made."
folder=${folder%/}
cp -X $here/move.zsh $folder/move.zsh || alert "A temporary copy could not be made."
chooser_dest=$folder/"Choose a Folder.app"
mkdir -p -- $chooser_dest || alert "A temporary copy could not be made."
for item in $chooser_src/**/*(DN/); do
  mkdir -p -- $chooser_dest/${item#$chooser_src/} || alert "A temporary copy could not be made."
done
for item in $chooser_src/**/*(DN.); do
  cat -- $item > $chooser_dest/${item#$chooser_src/} || alert "A temporary copy could not be made."
done
# The app's own place, for the try's stop words (it says how to start the try again). printf, so no mark is copied.
printf '%s\n' "${here:h:h}" > $folder/app.txt || alert "A temporary copy could not be made."
command_file=$folder/"Move to Studio.command"
move_file=$folder/move.zsh
if [[ -n $try ]]; then
  printf '#!/bin/zsh\n/bin/zsh %s %s\n' "${(qq)move_file}" "$try${second:+ $second}" > $command_file || alert "A temporary file could not be written."
else
  printf '#!/bin/zsh\n/bin/zsh %s --commit %s\n' "${(qq)move_file}" $commit > $command_file || alert "A temporary file could not be written."
fi
chmod 755 $command_file $folder/move.zsh $chooser_dest/Contents/MacOS/"Choose a Folder"
open -a Terminal $command_file || alert "Terminal did not open."
