#!/bin/sh
# Claude Code runs this before every tool call of the Reel Kit worker and its helper agents (the worker's settings, reel-kit-worker-tools.js
# workerSettings), as /bin/sh worker-guard.sh "<node>" "<project>" "<kit>" "<REEL_KIT_HOME>" "<tools/bin>": it runs the guard with Studio's
# node. If node cannot run, or the guard fails, the call is blocked: exit 2.
"$1" "$(dirname "$0")/worker-guard.mjs" "$2" "$3" "$4" "$5" || { echo "Studio's Reel Kit guard could not check this." >&2; exit 2; }
