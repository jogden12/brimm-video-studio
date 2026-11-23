# Studio's words for BRIMM Ops changed: what Sallie's guide must change with them

For a BRIMM Ops session. Written in BRIMM Video Studio on 2026-11-23, on the branch `claude/ops-is-an-app`. It takes effect on her Macs only once that branch is merged and a Mac pulls it.

## Why

Jason, 2026-11-23: "update any notes or references to BRIMM Ops in your BRIMM Video files so that they reflect current design or point to a source of truth in the BRIMM Ops repo/application. any references to Ops as an artifact need to be deleted or updated".

Studio's guide, its messages and Sallie's skill still talked about "the BRIMM Ops page". `guide page` still opened the old claude.ai page in her browser. They now name the app, in its own words, taken from your guide's "Taking it in BRIMM Ops" and from `app/src/views.js`.

Your guide (`docs/guide/brimm-ops-guide.html`) quotes Studio's old wording in two places, so it changes with this.

## What Studio says now

- **Each step starts `In BRIMM Ops:`** (it was `On the BRIMM Ops page:`).
- **The first take:** `Find the video under "Waiting from Studio" and press its button, such as "Add the episode and take the hand-off". For a video BRIMM Ops already holds, it is "Take the hand-off" or "Take revision N in place of revision M". Dropping the hand-off onto Episodes still works.`
- **A newer revision:** `Find the video under "Waiting from Studio" and press "Take revision 3 in place of revision 2".`, with the real numbers.
- **A session:** `Find the session under "Waiting from Studio", press "Open it in the Principles library", then "Take the session".` (a newer one: `Find the new revision under …`).
- **A withdrawal:** `Find the session under "Waiting from Studio", press "Open it in the Principles library", then "Withdraw the words and take the session". Then delete every backup you saved from "About" before now, and tell Jason.`
- **When a hand-off is written:** `… shown in Finder. It waits in BRIMM Ops, under "Waiting from Studio".` (it was `… drop it on the BRIMM Ops page.`).
- **Opening BRIMM Ops:** `guide page` is now `guide ops`. It runs `open -a "BRIMM Ops"`, and says `Opened BRIMM Ops.` If the app won't open, it says `BRIMM Ops could not be opened. Open it from your Applications folder. If it is not there, tell Jason.` Studio never opens the old page now.
- The steps after the take (`kit`, `posted`, `live`, `cascade`, `posttext`, `checked`) are unchanged.

## What your guide should change

1. **Line 536** ("Taking it in BRIMM Ops", step 1): delete "If Claude opens the old BRIMM Ops page in your browser, close it: it can no longer save." Studio no longer opens it.
2. **Line 539** (step 4's hint): "Claude says each step in BRIMM Ops in turn, starting `On the BRIMM Ops page:`. It still calls the app 'the BRIMM Ops page'." becomes "Claude says each step in BRIMM Ops in turn, starting `In BRIMM Ops:`." The rest of the hint stands.
3. Nothing else of yours quotes Studio's old words. Lines 906 and 947, about the kept page in a browser, are about the page itself and stay.

Until both are merged, her guide's two hints and Studio's words disagree on whichever Mac has one change and not the other. Merge them close together.

## Not changed

- The hand-off file and its fixtures (the contract). Only comments and two of the check's refusal messages in `tool/handoff-v2.js` changed wording ("titles live in BRIMM Ops", "BRIMM Ops refuses them"). No key, value or fixture changed, and `contract.test.js` still passes.
- The guide's step names in her note (`taken`, `kit`, …), so her notes on each Mac carry over.
