# R6a report

Worktree: /Users/jasonogden/Claude Code/brimm-video-studio/.claude/worktrees/agent-ae31956aafd6e283c, branch worktree-agent-ae31956aafd6e283c (reset to 34f52ff first; it began at 7a55486).

## Built
- `tool/plan.js`: `planFilesFrom(record)` (packageFiles of `planned`, headed by the record's name, `{}` when `planned.set` is null) and `PLAN_FILE_NAMES`.
- `tool/edit.js` `recordDifferences`: `planned` is no longer compared as JSON. It gives plain lines: the script (only differing lines, `A: "…"` / `B: "…"`, each cut to 120 characters with `…`), `The graphic cues are different: A has n, B has m.`, the same for shots, `The title is different: A says "…", B says "…".`, and other plan fields as plain lines. A row may carry a fourth element, the lines to say; `show()` prints them.
- `resolveIn` keep step: for a plan record, the files of `planFilesFrom(kept)` that differ from disk are written by the rule (textWriter, replace), then the record last, with the sizes of the three plan files listed. Files that already match are not written. A refused record write puts the old files back (and removes new ones); a failed file write puts back those written and leaves the record unchanged.

## Tests
- plan-conflict.test.js: "says a differing teleprompter line as two quoted lines, …", "says a difference of the cues, of the shots and of the title as one plain line each", "after --keep B the plan's files are what planFilesFrom(B) makes, …", "--keep A leaves the files that already match A as they are, with no write", "a refused record write leaves the files as they were". Two existing assertions updated for the new keep words.
- plan.test.js: "makes the plan's files from a record, …", "makes the explainer's files without a shot list, and nothing for a plan whose package was never set".

## Decisions the brief did not make
- Keep message for a plan: `Kept B. The plan's files are written from it. The other is set aside in history/.` (the brief's words with the history sentence kept); non-plan keeps are unchanged.
- The brief's two script formats differ ("The script is different:" then lines, versus "The script is different. A says…"). I followed the test list: header line, then `A: "…"` / `B: "…"` lines, unindented. More than 6 differing lines say how many more.
- "Title" means `planned.title`; the record's name and on-screen title rows keep their existing plain format.
- 120 characters = 119 plus `…`.
- Old plan files are not set aside in history/ (only kept in memory for the undo).

## Concerns
- (Fixed in round 1, below.) If putting the old files back also fails, the first version said nothing.

## Fix round 1
Change: in `tool/edit.js` the keep's rollback no longer stays silent. After a failed plan-file write or a refused record write, `planOff()` compares each plan file with what it was (by reading the disk). If any is not as it was, the refusal is `The record was not changed (<why>), but the plan's files may not match it: <names>. The next "episodes" names any that is wrong. Say "sort out the conflict" again to put them right; if it still says a file is not whole, ask Jason and tell him the episode's name.` and never says "Nothing was written". Otherwise the old words stay.
Test: plan-conflict.test.js "says so plainly when the files cannot be put back after a refused record write, and never claims nothing was written" (stand-in clone refuses every put-back of teleprompter.txt).
Commands: `node --test tests/plan-conflict.test.js tests/plan.test.js` -> pass 64, fail 0. `cd tool && node --test` -> tests 7287, pass 7287, fail 0.
