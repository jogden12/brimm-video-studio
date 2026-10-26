#!/bin/sh
# Claude Code runs this after each card Claude asks in Sallie's folder for Claude (PostToolUse on AskUserQuestion), as
# /bin/sh receipt.sh "<node>" "<her folder>": it writes a receipt of her answers when the card is one of brimm-video's own
# (receipts.js). Nothing it does can block the chat: if node cannot run, no receipt is written, and kind asks for her click again.
"$1" "$(dirname "$0")/receipt.mjs" "$2" || exit 0
