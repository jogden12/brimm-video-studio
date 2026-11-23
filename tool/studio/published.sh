#!/bin/sh
# Claude Code runs this after each Artifact call in Sallie's folder for Claude (PostToolUse on Artifact), as
# /bin/sh published.sh "<node>" "<her folder>": it records the URL a storyboard's first publish gave, from the tool's own result, when the
# call was exactly the publish BRIMM Video Studio printed for it (storyboard-opening.js recordPublished). Nothing it does can block the chat:
# if node cannot run, nothing is recorded, and the next publish is a new page's.
"$1" "$(dirname "$0")/published.mjs" "$2" || exit 0
