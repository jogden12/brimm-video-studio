# The Macs

Which Macs run Studio, how each is set up, and where Sallie's steps live. Moved here from `CLAUDE.md` on 2026-11-10; the rules themselves stay in `CLAUDE.md`.

## Both Macs

Both Macs edit in the HyperFrames app. A0 installed it on the Mac Studio first; Sallie's laptop followed, on Jason's yes.

- **Each Mac picks its own drop folder and exports folder** (Phase 3, 6 November 2026; the default drop folder is `~/BRIMM Video Work/Drop`).
- **A video's own files stay on the Mac that took it in until its hand-off**, and its recordings then move into `Original files` in the episode's folder in Dropbox. Edits are not handed between Macs. Episodes from before the switch keep the old way.
- **Final Cut is retired from Studio** (6 November 2026, Jason: "Retire it now"). Final Cut can still open HyperFrames' MOV export by hand.

## The Mac Studio

- **Since 2026-11-03 its launch agent, `com.thebrimm.unedited`, runs from Studio's main checkout, `~/Claude Code/brimm-video-studio`** (check 40, Jason's "Yes, switch it"). Studio's installer kept that label and replaced brimm-video's agent in place, on Jason's yes. Its settings name that checkout, `"app": "hyperframes"` and the light import.
- **Its drop folder is `~/BRIMM Video Work/Drop`** and its exports go to `~/Downloads` (since check 93, 2026-11-07); the old Dropbox `Drop/Mac Studio` is no longer watched.
- **The HyperFrames app's own projects folder** is `HyperFrames`, in `BRIMM Video`, in The BRIMM DB in Dropbox (Jason, 2026-11-05; set in `~/Library/Application Support/HyperFrames/projects-folder.json`, which has the full path). It is not a watched folder. Projects started in the app live there. When Studio opens one of its projects in the app, the app puts a link to it in that folder, and the project's files stay in `~/BRIMM Video Work`. The app's old folder, `~/.hyperframes-studio`, keeps the links it held before the change.
- **The Mac app keeps it a git checkout** (`"mode": "dev"`); every other Mac will run the app's own copy.

## Sallie's laptop

- **Moved from brimm-video to Studio on 2026-11-08** with the Move to Studio app (checks 74 and 41 to 45, Jason driving it, Claude reading his pastes): drop folder `~/BRIMM Video Work/Drop`, exports to Downloads, the strict lock, HyperFrames on. Its old Dropbox drop folder, `Drop/Sallie's laptop`, is deleted. Left: checks 46 to 48 and the open boxes of 41 and 43 (`docs/memory/progress.md`).
- **Before the move** her laptop was set up on 2026-10-15 and ran brimm-video's light import from 2026-10-26, with its drop folder at `Drop/Sallie's laptop`, and its read-only deploy key was brimm-video's. Studio now has its own read-only deploy key for her laptop; deleting brimm-video's key on GitHub is check 48, on Jason's yes.
- **Her setup doc** is `docs/setup/sallies-laptop.md`, which still describes brimm-video until a later step updates it. The move itself is `docs/setup/move-to-studio-app.md`.

## Jason's MacBook

Moved to Studio on 2026-11-08 (check 80), set up fresh as "Jason's MacBook" by the Move to Studio app.

## Pages outside the repo

- **The Studio By-Hand Checks page:** https://claude.ai/artifact/TmFpCY7GfR1KWw9hcftzrT. Every by-hand step for Jason is a numbered check there. Moving her laptop to Studio is checks 40 to 48 (the Mac Studio's own move, check 40, was done on 2026-11-03).
- **Her guide is the BRIMM Ops guide:** https://claude.ai/artifact/Vu5JmADhftiEsPz4KYN4e4. The BRIMM Video Guide it replaced was retired on 2026-11-03: its link points to the BRIMM Ops guide.
