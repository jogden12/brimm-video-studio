---
name: brimm-edit
description: Use for anything about The BRIMM's videos and episodes: what is waiting, opening an episode or taking it over from the other Mac, its name and title, Reels, showing it in Final Cut, finishing it, handing it over, conflicts, and how far something has got.
---

# brimm-edit

Run brimm-video's commands, and only these, exactly so: {{NODE}} "{{CHECKOUT}}/tool/edit.js" <command> …
Put the episode in quotes. Never show Sallie the command, a path or a flag: say what it did, in plain words.
Words with a `$`, a backtick, a backslash or a straight double quote go in single quotes instead of double. Words with an apostrophe stay in double quotes. Words with both cannot be passed: ask her to say them another way (for example "99 dollars").

## At the start of each session

Run `behind`. If this Mac is behind, tell her: "Jason has a newer brimm-video; ask him to update this Mac when it suits." If it says her folder for Claude is out of date, tell her: "Your Claude folder needs an update from Jason; ask him when it suits."

## What she says, and what to run

| She says | Run |
|---|---|
| "What's waiting?" | `episodes` |
| "Open the Pricing episode" | `open "<episode>"`. If it says another Mac has it, ask her whether to take it over; if yes, `open "<episode>" --take-over`. If that take-over says Dropbox undid the claim and to say "take it over" again, run `open "<episode>" --take-over` again without asking her again. If it is bringing files over first, wait until "how far is it?" says the bring has ended; if it then says to say "take it over" again, run `open "<episode>" --take-over` again without asking her again; if it says some files are not here, tell her why, in plain words, and try again only when she says to. Take it over again unasked only in the conversation in which she said yes, and only if she has not said not to since; in a later one, run `open "<episode>"` and ask her as above. Never take an episode over unasked otherwise. |
| "Call it …" | `name "<episode>" "<name>"` |
| "Use that title" / "Make the title …" | `title "<episode>" --approve` / `title "<episode>" --words "<words>" --approve` (an approved title changes only with `--change`; say BRIMM Ops may have it already) |
| "Reel 2's title is …" | `title "<episode>" reel 2 --words "<words>"` |
| "Show me the Reels" | `reels "<episode>"`: tell her each candidate in plain words; its preview opens in QuickTime Player |
| "Ask Claude again for Reels" | `ask "<episode>"`: it runs in the background, so say so, and that "how far is it?" shows how far it has got |
| "Finish Reels 1 and 3" / "Drop 2" | `reel pick "<episode>" 1 3` / `reel drop "<episode>" 2` |
| "Show it in Final Cut" / "Show reel 1 in Final Cut" | `push "<episode>"` / `push "<episode>" reel 1`, with the guard below |
| "Captions on Reel 2" / "No captions on Reel 2" | `captions "<episode>" reel 2 on` / `captions "<episode>" reel 2 off`. A Reel shows its captions unless they are turned off, and its title on screen whenever it has one |
| "It's Hormozi, not Hormozy" | `spell "<episode>" add "Hormozy" "Hormozi"`: the one word as the transcriber writes it, then how it is spelled. "What spellings are there?": `spell "<episode>"`. After a finish it may say the hand-off was made again: tell her to drop it on the BRIMM Ops page again; if it says a video's captions on screen, or the final transcripts, keep the old spelling, tell her that changes when that video is shown in Final Cut, Shared and finished again |
| "Logo on" / "Logo off" | `logo "<episode>" on` / `logo "<episode>" off`, on the main video. If it asks which picture is the logo, ask her its name in her Pictures folder, then `logo "<episode>" on --picture "<name>"` |
| "Put my name up at 0:03" | `text "<episode>" add lower-third --at 0:03 --line "Sallie Ogden" --line "<her role>"`; on a Reel, `text "<episode>" add lower-third reel 2 --at 0:03 …`. For a guest, ask the name and the role. A time is as she sees it on that timeline in Final Cut; when she gives words, not a time, use `--at-words "<her words>"` |
| "Show the pricing chart when I say three numbers" | `graphic "<episode>" add "<picture>" --at-words "three numbers"`, with `--place corner` or `--place lower` if she says so (full unless she does). Ask which picture in her Pictures folder. "Any ideas for graphics?": `graphic "<episode>" ideas` |
| "Make it Bright" / "Bold captions on Reel 2" / "It's a teaching clip" | `preset "<episode>" --look bright` / `preset "<episode>" reel 2 --captions bold` / `preset "<episode>" reel 2 --job "teaching clip"`. "What styles are there?": `preset "<episode>"`, and tell her the lists in plain words |
| "Cut the bit where I say …" / "Keep the Hormozi story at 12:30" | `cut "<episode>" remove --words "<her words>"` (or `--at` and `--to`, times on that timeline) / `cut "<episode>" keep --at 12:30` (the cut nearest that time on that timeline) or `cut "<episode>" keep --words "<words>"`. Say a cut on the main video does not change a Reel |
| "Show me the transcript / Claude's notes / the cut plan" | `show "<episode>" transcript` / `show "<episode>" notes` / `show "<episode>" plan` |
| "Finish the episode" | `finish "<episode>"`; answer its questions with her, then `finish "<episode>" --yes` and the answers it asks for |
| "How far is it?" | `status` |
| "Try it again" (an import that stopped) | `retry "<video>"` |
| "Hand it to Jason" / "I'm done with it for now" | `release "<episode>"`, with the release question below |
| "Sort out the conflict" | `resolve "<episode>"`; show her the two sides in plain words; then `resolve "<episode>" --keep A` or `resolve "<episode>" --keep B` as she picks. If it says a conflict needs Jason, or that Dropbox is still bringing a file over, tell her so and keep nothing. If it says that is not the version shown last, or that it was sorted out meanwhile, show her what it shows now and ask her again: never reuse her last answer |

In `--at-words` and `--words`, give her words without `$`, backticks, backslashes or double quotes, which are not matched, and keep apostrophes: "that's $100,000" is `--at-words "that's 100,000"`.

Times in the cut plan, in Claude's notes and inside a marker's words are the recording's, not her timeline's: never pass one as `--at`. To keep a cut found there, pass its words.

## The guard, before showing a timeline again

When a push answers that the timeline was shown before, ask her, in these words: "Did you change v<N> in Final Cut since it was shown?"
- If not: run the push again with `--no-hand-edits`.
- If yes: run it with `--hand-edits` and read her what it says: her changes stay in v<N>; brimm-video cannot build on them yet. Until it can, ask brimm-video for its changes first and make trims by hand last, or finish that timeline by hand.
- If the push says the changes are, or may be, on the other Mac: tell her so in plain words, and that whoever used it there can say. Run the push again with `--without-other-macs-changes` only if she says to go ahead without them. Never use `--no-hand-edits` for this: that is her answer about her own Final Cut.

`text`, `graphic` and `cut` ask it too, before they read a time or her words on a timeline shown before: ask her the same question, and answer in the same way.

## The release question

When `release "<episode>"` asks, ask her: "Did you change anything in Final Cut since it was last shown?" No: run it again with `--no-hand-edits`. Yes: run it again with `--hand-edits-stay`, and tell her the changes stay in this Mac's library. If it says an export is out of date, read her what to do in Final Cut, then try again. Afterwards tell her to keep the laptop open and online until Dropbox shows the folder is up to date.

## Not ready yet: say so, and what to do by hand

- A logo or a look on a Reel: "That comes with the brand templates, later. For now, do it by hand in Final Cut."
- Bringing in her hand edits: "That part of brimm-video isn't ready yet. Make your changes by hand last, after brimm-video's, or finish that timeline by hand in Final Cut."
- Archiving, checking the setup, freeing space: "That isn't ready yet; ask Jason." (For space: Final Cut's File > Delete Generated Library Files.)

## By hand in Final Cut, in this order (tell her at the right moment)

1. At the first open of an episode on this Mac: in Finder, Control-click the episode's folder and choose Make available offline (`open` says where).
2. To finish: for each part, Share it with Command-E (check the save dialog says From Final Cut), wait for Final Cut's notice that it is done, then click in that project's timeline and choose File > Export XML…, into From Final Cut, keeping the version it offers. Then say "finish".
3. When the finish is done: drop the hand-off file it shows in Finder onto the BRIMM Ops page.
4. Once the hand-off is on the page and Dropbox shows the folder is up to date: in Finder, Control-click the episode's folder and choose Make online-only, to free space on her laptop.
