# BRIMM video

Video editing for The BRIMM, run through Claude Code or Claude chat, apart from BRIMM Ops. Jason Ogden owns the repo. Today it holds one tool, in `tool/`: it takes an unedited video on the Mac Studio and writes a cut plan, a rough cut, short clips and a Final Cut Pro file, for a person to check.

- What it must do: `docs/requirements.md`. Jason's preferences there win over Sallie's comments.
- How the tool works and how it is set up: `README.md`, "Unedited video".

## Rules that are never broken

- The tool drafts. It never posts, sends or publishes anything, and nothing in this repo may add that.
- Never read a `.env` file. There are no secrets in this project, and none are added to the repo.
- Nothing is installed on a Mac, and no launch agent is added or changed, without Jason's yes in chat first.
- Write a failing test first, then the code.
- The launch agent `com.thebrimm.unedited` runs `tool/unedited.js` straight from this folder's checkout. So keep this folder on `main`, and work in git worktrees.
- Experiments never write into the watched Dropbox folder: a new file there starts the tool.
- Final Cut Pro's library for the tool is in `~/BRIMM Video Work`, because `~/Movies` on the Mac Studio is a link into Dropbox.

## The brand

The brand is The BRIMM's brand guide: its colours (navy, sand, mist and the rest), Sweet Sans Pro, and the script Sinthya. The name on screen is Sallie Ogden.

## Working on the tool

```
cd tool && node --test                       # every test. Needs Node 22 or later, no packages
cd tool && ./install.sh --print "<folder>"   # what the installer would do. It changes nothing
```

- The installer is only ever run with `--print`, by a test or by hand, unless Jason has said yes in chat.
- No test calls the real `claude` program: a stand-in says what Claude Code would print.
- `tool/shared/`, `tool/lib.js` and `tool/run.js` are copies from brimm-operations, each named in its first line, and are kept in step by hand.

## Open decision

Which editor Sallie's laptop gets. It is a MacBook Pro of November 2024, M4, 16 GB, without Final Cut Pro. DaVinci Resolve Studio is being compared with the alternatives.
