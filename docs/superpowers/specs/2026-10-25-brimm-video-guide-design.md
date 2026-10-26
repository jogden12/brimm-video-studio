# brimm-video: a guide in her Claude folder (design)

Written 2026-10-25 for Jason Ogden, from his answers that day. **Design only: nothing in it is built.** It adds to the 2026-10-22 design (`2026-10-22-brimm-video-light-import-and-fork-design.md`) and changes nothing it says about the import, the card, the reading, sessions or the hand-off.

## Why

Sallie will remember one thing: to open a Claude session in her folder, `~/BRIMM Video Studio`. With a video file on her laptop she will say something like "I have a video. What do I do with it?" Today her skill answers commands she already knows ("what's waiting?", "finish the episode"); nothing leads her from a file on her desktop to a posted episode. The walkthrough doc "One Video, Start to Finish" (https://claude.ai/artifact/3KkWHoRTibNrSbtUcFEmzx, 25 Oct) has every step, but she should not need to read it: Claude should walk her through it, in her chat.

Success: from "I have a video" to the last piece of the cascade copied out, Sallie never has to know a phrase, a folder or the next step. Claude tells her the next step, one at a time, waits for her, and picks up where she left off days later.

## What Jason decided (2026-10-25)

- **The start.** The only thing she remembers is to open Claude in her folder. She asks what to do with a video, and Claude takes the lead: one step at a time, one question at a time, never the whole list.
- **First steps.** Claude first checks whether something of hers is already waiting or under way. If not, it tells her where the video goes, in Finder words, and opens that folder in Finder for her, so she only drags the file in. Before she drags it, Claude asks whether it is a client or group session (if so, and the file's name holds the client, she renames it first); a Zoom download goes elsewhere. **The kind of video is asked on the existing card, after the import**, not before the drop: the card shows the Mac's guess and catches a new version of an earlier video, and asking twice would be worse.
- **While it imports**, Claude says it is working and roughly how long it has left; when it is ready, Claude shows the card and goes on.
- **After the card**, Claude follows her answer: raw (when Claude reads it, what it found, the rough cut, a name, changes, Final Cut, Share and Export XML, the finish, one at a time); finished by her editor or an iPhone clip (spellings card, then the hand-off); a session (the transcript only or its teachings, then Principles, with the usual warnings, never asking her to type anything about the client).
- **BRIMM Ops.** Claude cannot see or press anything on the page. It opens the page in her browser for her and talks her through each step (drag the hand-off onto Episodes, Take the hand-off, Write what's next, approve and copy each piece), taking her word when she says a step is done.
- **Posting and the cascade**, usually days later: when she comes back ("I posted it", "what's next?"), Claude picks up there: tick Posted, This is what is live, Write what's next, then the cascade one platform at a time (newsletter, Instagram, LinkedIn).
- **Her place.** Claude knows the brimm-video steps from the video itself. For the BRIMM Ops steps, which brimm-video cannot see, it keeps a small note **on her Mac** of where each video got to ("hand-off taken", "posted"), so she does not repeat herself.

## Goals

1. One phrase starts it: "I have a video", "what do I do?", "what's next?", "where was I?", "guide me", "help". Claude answers with the one next step for her, or a question.
2. The next step comes from brimm-video, not from Claude's memory or improvisation: a new command, `guide`, prints it, so it is the same every time and tested.
3. It covers every path the walkthrough covers, from the drop folder to the cascade, for each kind, including sessions and the other Mac.
4. It survives days: the brimm-video part is read from each video's record; the BRIMM Ops part from her note on this Mac.

## Non-goals

- Driving BRIMM Ops, reading it, or checking what she did there. Claude opens the page and talks; she presses.
- Moving or renaming her files. Claude opens folders; she drags and renames.
- Changing the import, the card, the reading, the finish, sessions or the hand-off.
- Asking the kind before the drop.
- A notice or reminder that she has not finished a video: the guide answers when she asks.
- Guiding Jason's own work on the Mac Studio (it works there too, but it is written for her).

## Anti-goals (a failure even if it works)

- A wall of steps, or a step she cannot do from where she is.
- A file name of a gated video (unanswered, or a session) in the chat, or anything about a client.
- Anything posted, sent or published. Opening a page is not posting; the page's link is a constant in code, with nothing of a video in it.
- Her note moved on without her saying the step is done.
- A loosened lock: no new tool, no new allow rule, no path shown to her (her folder's rule: "Never show her command names, paths or flags").

## The how

### `guide`, a new edit.js command

It names no episode by default, so it goes in `UNSCOPED` (`tool/gate.js`), and its step texts live in a new module, `tool/guide.js`, as pure functions tested on their own. Its forms (word subcommands, not flags):

- **`guide`**: the overview. First this Mac's drop folder, in Finder words (`Dropbox › The BRIMM DB › BRIMM Video › Drop › Sallie's laptop`, built from `settings.drop` and the machine, so it is right on a Mac still on `Unedited Video`). Then each video **under way**, newest first, each with its name as `episodes` gives it (`listedAs` for a gated one) and **the one next step**, in plain words, with what she says to do it. If none, it says so: "Nothing is under way. To start, put the video in your drop folder."
- **`guide "<video>"`**: the one next step for that video, and, for a BRIMM Ops step, the step after it.
- **`guide drop`**: opens this Mac's drop folder in Finder (`ctx.openApp("Finder", folder)`, as `which` opens QuickTime Player) and says its Finder words. **`guide drop zoom`**: opens `BRIMM VIDEO Transfer › Zoom Video Transfer`, beside `BRIMM Video` in The BRIMM DB, if it is there; if not, says to ask Jason.
- **`guide page`**: opens the BRIMM Ops page in her default browser (`/usr/bin/open <the page's link>`, through `ctx.deps.run`, so tests open nothing). The link is a constant: `https://claude.ai/artifact/GCUQPLnSFWZe3VghyaKNtX`.
- **`guide wait`**: waits up to 90 seconds (under the Code tab's two minutes) for a change in this Mac's drop folder or imports (a video seen, an import started, a step passed, Ready), then prints as `guide` does. For "I've dropped it" and "is it ready?".
- **`guide "<video>" done <step>`**: notes that she has done a BRIMM Ops step (below). Only a step that comes next for that video is taken; anything else is refused with the step that comes next.
- **`guide "<video>" finished`**: she says she is done with it: the video is no longer under way.
- **`guide "<video>" show`**: shows in Finder (`open -R`, as `showInFinder` does) what the next step needs: the newest hand-off for a BRIMM Ops step, and for `posted`, the finished video (a raw episode's Share in `final/`; a video finished by her editor, the copy of the video she dropped). Days later, or on the other Mac, this is how she finds them. Only Finder shows the file; the chat never names it, so this is safe for a session's hand-off too.

**A Mac still on the old import.** `guide` works only on a Mac on the light import (`lightImport(settings)`). On any other Mac every form says, and does nothing else: "This Mac isn't set up for the guide yet: ask Jason." On the old import Claude reads every video as it lands, a session's whole words too, so the guide must never send her to that drop folder. Her laptop's switch is a prerequisite of deploying the guide there.

### Stages and next steps

The stage is read, never stored, for the brimm-video part: from the drop folders and import statuses, then the record (`kind`, `answer`, `session`, `reading`, the offers' answer, `name`, `main.pushed`, `finished`, `editing`, `released`), as `episodes` and `status` read them today. The recon of 25 Oct (in the managing session's notes, `brimm-video-guide-recon-2026-10-25.md`) maps every stage, with its source lines; the table below is the plan's to fill from it, one row per stage, with the step text Sallie hears:

| Where it is | The next step (her words) |
|---|---|
| Nothing dropped | Is it a client or group session? (rename first if the file's name holds the client). Then `guide drop`, and drag it in. |
| Arriving or importing | Wait for "Ready"; about how long, when the panel's step is known. |
| Waiting for her answer | The card. |
| Being answered, or edited, on the other Mac | Carry on on that Mac, or open it here and take it over. |
| Failed, stopped, or a late-check problem | "Try it again", on the Mac whose drop folder holds it. |
| A Zoom download held in the drop folder | Move it to Zoom Video Transfer (`guide drop zoom`). |
| Answered, Claude reading | Wait for the "Claude has read it" notice (raw: at the time `kind` gave). |
| Read, spellings not answered | "What did Claude find?", then the spellings card. |
| Raw: a placeholder name / only version 0 shown / shown in Final Cut / finish running | "Call it …" / "Show it in Final Cut" / trim by hand, Share, Export XML, "finish the episode" / wait. |
| A session: no choice / teachings off / reading / items undecided / decided | Teachings or the transcript only / ask Jason / wait / keep, drop or change each / "done". |
| A hand-off written, BRIMM Ops not begun | `guide page`, then the BRIMM Ops steps below. |

**The BRIMM Ops steps** (her note keeps the last one done), by what the hand-off is:

- **A finished or raw episode:** `taken` (drag the hand-off onto Episodes, press **Take the hand-off**; for a raw video edited in Final Cut, then free the space: once Dropbox shows the episode's folder is up to date, Control-click it and choose **Make online-only**) → `kit` (press **Write what’s next**; read the **Brief**; go through **Before posting**: pick a title, a thumbnail idea and a subject line; approve and copy each piece) → `posted` (upload it to YouTube Studio with the title, description and chapters; tick **Not posted yet** so it says **Posted**) → `live` (correct the form, press **This is what is live**) → `cascade` (press **Write what’s next**; approve and copy the newsletter section, then the Instagram pieces, then the LinkedIn posts; the ideas for YouTube are suggestions for YouTube Studio; each **Clip to cut** is cut in OpusClip, then made a short video with **New short video from a clip** on the episode's **Reels** card, one line in the step, not a step of its own) → the video is done.
- **An iPhone clip (a short video):** `taken` → `posttext` (press **Write what’s next**; pick the hook and the YouTube Short title; approve and copy the caption, the Short's title and description, the LinkedIn post) → `posted` (post it in Instagram, and as a Short) → done.
- **A session:** `taken` (choose **Principles**, drop the hand-off, press **Take the session**) → `checked` (each **Check it** principle checked, then **Use in drafts**) → done. A session marked "transcript only" has no BRIMM Ops steps.

A revision of a hand-off already taken (a spelling added, finished again) brings `taken` back as the next step, with "drop the new one on the same episode"; the steps after it stay as noted. The button labels are the page's own (BRIMM Ops `origin/main`, as checked for the walkthrough on 25 Oct).

### Under way, done, and old

Under way: anything in a drop folder or an import; a record answered since the switch (it has an `answer`) that is not done; a hand-off whose BRIMM Ops steps are not all noted, for 60 days after it was written. Done: left alone, transcript only, `finished` by her word (`guide "<video>" finished`), or all its BRIMM Ops steps noted. Records from before the switch (no `answer`) are not listed; `guide` says how many there are in one line, only when there are any.

### Her note

`~/Library/Application Support/BRIMM Video/guide.json`, keyed by **the hand-off's id**, which is the id the hand-off goes out under (a new version's hand-off goes out under the first version's id, `tool/finish.js` `handoffTarget`): the kind of the hand-off noted (episode, short video or session), the last step done, the revision it was for, and when. Written whole, then renamed (the `noteWritten` pattern, `tool/episode.js`). It is this Mac's alone: on the other Mac, the guide starts that video's BRIMM Ops steps at the first, and she says "I've done that" to move on.

When the newest hand-off differs from the note:

- **Only its revision is higher** (a spelling, a new Share, a new version of the same kind): `taken` comes back as the next step ("drop the new one on the same episode"); the steps after it stay as noted.
- **Its kind changed** (it was a session after all; a session mark cleared): the note is set aside and the steps start again at `taken`, for the new kind. For "it was a session after all", the step is the privacy one: drop the empty session revision on **Principles** and press **Withdraw the words and take the session**, then delete old backups from **About**, and tell Jason. Nothing noted before can skip it.

### Her skill

A section of at most about 30 lines (the skill must stay under 160 lines, `tool/tests/studio.test.js`), "## Guide her", with:

- When she asks what to do, what is next, where she was, or for help: run `guide`. Say only one next step, then ask; never read the list out.
- **Which step first.** A video waiting for her answer comes first, whatever she said: it blocks nothing else, but it is the one thing only she can do. Then, when she said she has a (new) video, the new video: say in one line how many others are under way and that "what's next?" picks them up. When she asked what's next or where she was, the newest video under way, and the others in one line.
- A new video: one `AskUserQuestion`, "Is this video a private session with a client or a group?" ("Yes", "No", "It is a Zoom download"). Yes: tell her to rename the file if its name holds the client, before she drops it. Zoom: `guide drop zoom`. Then `guide drop`, tell her what opened and to drag the video in, and run `guide wait` when she says she has.
- Something waiting for her answer: the card, as the skill already shows it. If she said "Yes" above in this chat, tell her to choose "Client or group session" and "Yes".
- Each next step: say it in one or two sentences, offer to do the brimm-video part ("Shall I show it in Final Cut?"), and run it only on her yes. For a BRIMM Ops step: `guide page` the first time, say the step, then ask "Done?" on one `AskUserQuestion` ("Done", "Not yet", "Something's different"); on Done, `guide "<video>" done <step>`; on something different, ask what she sees, and if it is not in the walkthrough, tell her to ask Jason.
- The privacy lines stay as they are: a gated video only by its label, never a client's details in the chat.

The README gets a row for `guide`; her guide (the BRIMM Video Guide artifact) and the walkthrough doc get one line each: "Not sure what to do? Say 'I have a video' or 'what's next?'".

### Deploying

After the pull request is merged, on each Mac with her folder (her laptop, and the Mac Studio if Jason wants it there): `git pull`, then `node tool/settings.js studio --node <node>` (or the installer), then a new session in her folder. `behind` says her folder is out of date until then.

## Constraints

- Node 22, no packages; `cd tool && node --test` passes; a failing test first.
- The tests that walk every command (`COMMAND_NAMES`) are met: a HELP usage line, a README row, `UNSCOPED` and its pinned lists (`gate.test.js`, `part-f-fixes.test.js`), `TODAY_ASKED`, the client-name walk (`edit-labels.test.js`), and the skill's span runs (`studio.test.js`: each backticked span runs in the test world with no exit 2 and the same output twice).
- Nothing opens a real app or page in a test: `openApp` and `run` are stand-ins.
- Pull request #40 (her folder's lock) is open and touches `behind`, `tool/studio.js`, the README's `behind` row and setup steps 7, 9 and 5. The guide stays clear of those lines and is rebased on `main` once #40 merges.

## Left to the builder

- The exact step texts, within the table and the BRIMM Ops steps above; plain words, under 25 words a sentence, Finder words for places.
- How `guide wait` notices a change (polling the drop folder and the import statuses every few seconds is enough).
- How long each "about how long" is, from what the panel already knows (`tool/progress.js`), or none when it is not known.
- Whether `guide "<video>"` on a video that is done says so or gives its last step.

## My calls (for Jason to check)

- The command's name is `guide`; she never sees it.
- The pre-drop question has a third answer, "It is a Zoom download".
- 60 days before a hand-off with unfinished BRIMM Ops steps drops off the list.
- The note is per Mac, as you said; it does not follow a video to the other Mac.
- `guide wait` waits 90 seconds at most, then she asks again.
- Pre-switch episodes are not guided.
- On a Mac still on the old import, the guide only says to ask Jason; her laptop's switch comes before the guide reaches it.
- A video waiting for her answer always comes first; then the new video when she says she has one, or the newest under way when she asks what's next.
- `guide "<video>" show` finds the hand-off or the finished video in Finder later, on either Mac.
- The note is keyed by the hand-off's id, so a new version only brings back "drop the new one"; a change of kind starts the steps again, and "it was a session after all" always leads to the withdrawal on Principles.

The builder check (a fresh reader, 25 Oct) raised four questions; all four are answered above as my calls: the old-import Mac, which step comes first, finding the files later, and the note across versions and kinds. It also suggested the OpusClip line in the cascade step and the online-only line after `taken`, both added.
