# Merge of main (e99f537, Phase 2) into af3d75a (Phase 3 L1)

Branch claude/lf-merge-p2. Suite: 6593 tests, 6593 pass, 0 fail (settings 184, install 117).

## Conflicted hunks
- tool/edit.js (imports): took main's episode.js import (no `released`); settings.js import = main's list plus L1's `dropFolderOf`, `isLocal`; dropped `pushedFolder`, `libraryFor`, `fromFinalCutFolder`.
- tool/filing.js (imports): main's names.js import (no `timelineFile`) plus L1's `dropFolderOf` in place of `dropFolder`.
- tool/settings.js, 4 hunks: usage comments and HELP lines (write, plan, set): L1's options (`--drop-folder`, `--exports-folder`, `--switch-back`) with `--import light|full` changed to `--import light`; plan help keeps L1's longer text (exports/cloud lines); `FULL_GONE` constant kept together with L1's `fieldsToldBy` doc ({ fields, dropFolder, switchBack }). Auto-merged parts: FULL_GONE checks in write/plan/set, and "The import will be" line (main's form) followed by L1's exports/cloud lines.
- tool/install.sh, 5 hunks:
  1. `light_import=""` removed (Phase 2 deleted its only use); L1's `switch_local` kept.
  2. Both kept: main's `--import full` refusal loop, then L1's `--switch-local` expansion.
  3. `planned="${(F)plan_lines[1,import_at-1]}"` (L1, needed for its extra plan lines); `light_import=1` dropped. L1 behaviour carried; main's `[1,-4]` is not usable with the extra lines.
  4. "On this Mac: From Final Cut" line deleted; L1's conditional "Once, in Finder" offline line kept.
  5. mkdir: `"$WORK/From Final Cut"` removed; L1's `[[ -n "$local_drop" ]] || mkdir -p .../.importing` kept.
- tool/tests/settings.test.js, 5 hunks: import list minus `fromFinalCutFolder`, `pushedFolder`, `libraryFor`; plan-line expectations take L1's exports line with "The import will be: light" and `--import light` in the JSON test; L1's describe block and main's "full import is gone" describe both kept (closing braces placed between them).
- tool/tests/install.test.js, 4 hunks: mkdir assertion (L1's local_drop form, no "From Final Cut", plus main's `!text.includes("From Final Cut")`); missing-value messages (`--import light.`, plus L1's `--drop-folder`/`--exports-folder` cases); the "switch options without --machine" loop (L1's extra options, `--import light`); L1's describe and main's describe both kept.

## L1 behaviour changed or dropped
None dropped. install.sh hunk 3 keeps L1's `import_at` slice rather than main's `[1,-4]`.

## Tests adapted (none dropped)
- settings.test.js "refuses a drop folder of its own with the full import, saying so" (L1): `write ... --import full ...` now returns 2 with the FULL_GONE line (main's rule), in two places; the case of a settings file that itself says `import: "full"` still returns 1 with L1's NEEDS_LIGHT text. Title extended.
- L1 plan/install expectations that said "The import will be: full" now say light (Phase 2's output); exports lines kept.

## Concerns
- README.md line 255 still says `--import light|full` (main left it too); not changed here.
