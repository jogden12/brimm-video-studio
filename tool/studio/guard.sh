#!/bin/sh
# Claude Code runs this before every tool call in Sallie's folder for Claude, as /bin/sh guard.sh "<node>" "<her folder>": it
# runs the guard with the node the installer found. If node cannot run, or the guard fails, the call is blocked: exit 2.
"$1" "$(dirname "$0")/guard.mjs" "$1" "$2" || { echo "brimm-video's guard could not check this. Ask Jason." >&2; exit 2; }
