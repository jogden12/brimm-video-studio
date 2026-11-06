# R3 report: one yes at hand-off

Worktree: /Users/jasonogden/Claude Code/brimm-video-studio/.claude/worktrees/agent-ae487c0e82efc7ed4, branch worktree-agent-ae487c0e82efc7ed4 (reset to 34f52ff first: the worktree started on 7a55486).

## Built
- `tool/finish.js`: exports `HAND_OFF_ASK` and `REELS_ASK`.
- `tool/edit.js` (finishEpisode): with exports found and no questions open, prints `Hand-off question: <ask>`; the Final Cut line `Say "yes, finish it" to start.` is kept.
- `tool/finish-reels.js`: `START` removed (replaced by `REELS_ASK`).
- `tool/guide.js`: `You have exported it. Say "hand it off" and I will check what you exported.`
- `tool/studio/SKILL.md` and `SKILL-open.md`: three short rules each under "Hand it off" and "Hand off the Reels" (run `finish` at once, ask the Hand-off question with Yes / Not yet, Yes runs `--yes`, never ask "Shall I hand it off?" first); the "Any other next step" bullet no longer offers the two hand-off questions and says to run `finish` at once; step 2 and 3 of "In HyperFrames, to hand it off" reworded (questions go back to `finish` without `--yes` until the Hand-off question is printed; the old "Never add `--yes`..." sentence stays).

## Tests
- New: `tests/one-yes-hand-off.test.js` (constants; per skill file: the Hand it off rules, the Reels rules, old --yes sentence and row/line caps).
- Updated pins: guide.test.js, edit-guide-{app,downloads,checking,reels}.test.js, finish-start-wait, finish-app, finish-on-screen, finish-reels, finish-reels-now, edit-finish-{app,clip,on-screen,reels,reels-app}, edit-take-over-app, studio.test.js, guide-reels-pins.test.js. edit-finish-app also asserts no `yes, hand it off`.

## Decisions the brief did not make
- Brief said constants next to `START` in finish.js; START lived in finish-reels.js. Both new constants are in finish.js; `START` removed from finish-reels.js.
- The printed prefix `Hand-off question: ` is added in edit.js, not part of the constants.
- Reels' guide line left unchanged (brief names only the main step).
- Historic docs/plans left as they were.

## Concerns
- Skills are now 264 / 260 lines (cap 270).
- Step 3 of the HyperFrames section now has the model run `finish` with flags and no `--yes` until the question prints.
