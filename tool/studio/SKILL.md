---
name: brimm-edit
description: Use for anything about The BRIMM's videos and episodes: what is waiting, what a new video is, what Claude found in it, client or group sessions and their teachings, opening an episode or taking it over from the other Mac, its name and title, Reels, showing it in Final Cut, finishing it, handing it over, conflicts, and how far something has got.
---

# brimm-edit

Run brimm-video's commands, and only these, exactly so: {{NODE}} "{{CHECKOUT}}/tool/edit.js" <command> …
Put the episode in quotes. Never show Sallie the command, a path or a flag: say what it did, in plain words.
Words with a `$`, a backtick, a backslash or a straight double quote go in single quotes instead of double. Words with an apostrophe stay in double quotes. Words with both cannot be passed: ask her to say them another way (for example "99 dollars").

## At the start of each session

Run `behind`. If this Mac is behind, tell her: "Jason has a newer brimm-video; ask him to update this Mac when it suits." If it says her folder for Claude is out of date, tell her: "Your Claude folder needs an update from Jason; ask him when it suits." Then run `episodes`, and show the card below for each video waiting for her answer.

## The card: what a video is

The card's words are a proposal, for Jason and Sallie to settle.

`episodes` names a video waiting for her answer by its label, as "<label>: a video waiting for your answer, of 42:10, id 1a2b3c", and may add under it lines that start "Seen:", "Came:", "Guess:" and "Maybe a new version of:". For each such video in turn, one `AskUserQuestion`, never two videos in one card, with two questions:
1. "What is <label>?", with these answers, in this order (a Maybe line wins over a Guess line):
   - Maybe a new version of a video finished by your editor or an iPhone clip: "A new version of <name>", "Finished by your editor", "Raw with retakes", "Client or group session"
   - Maybe a new version of a video raw with retakes: "A finished version of <name>", "Finished by your editor", "Raw with retakes", "Client or group session"
   - Guess finished by your editor: "Finished by your editor", "Raw with retakes", "iPhone clip", "Client or group session"
   - Guess raw with retakes: "Raw with retakes", "Finished by your editor", "iPhone clip", "Client or group session"
   - Guess an iPhone clip: "iPhone clip", "Finished by your editor", "Raw with retakes", "Client or group session"
   - No Guess line: "Finished by your editor", "Raw with retakes", "iPhone clip", "Client or group session"
2. "Is it a private session with a client or a group?": "Yes", "No"

Run `kind` only with both answers, and only when they agree: "Client or group session" with Yes, anything else with No. When they do not, ask her again and run nothing.

| She answers | Run |
|---|---|
| "Finished by your editor" / "Raw with retakes" / "iPhone clip", and No | `kind "<label>" finished --private no` / `kind "<label>" raw --private no` / `kind "<label>" clip --private no` |
| "A new version of <name>", and No | with the Maybe line's id: `kind "<label>" finished --private no --version-of <id>`, or, when that video is an iPhone clip, `kind "<label>" clip --private no --version-of <id>` |
| "A finished version of <name>", and No | `kind "<label>" finished --private no --version-of <id>` |
| "Raw with retakes", and No, when the Maybe line's video is raw | `kind "<label>" raw --private no --version-of <id>`: tell her it starts as a new raw video, and its edits begin again |
| "Client or group session", and Yes | `kind "<label>" session --private yes`, then "A client or group session", below |
| Other: "leave it" / "it's not for brimm-video" | `leave "<label>"`: it is not asked about again |
| Other: anything else ("not now", "it's a podcast") | Nothing |

When the Came line says it came as a Zoom download or as sound alone, or `kind` says to ask first whether it is a client or group session, ask her: "It came from Zoom (or: it is sound alone), which is often a client or group session. Is it really not one?" Only when she says clearly that it is not a session, run the same `kind` with `--not-a-session` added, as `kind "<label>" finished --private no --not-a-session`; if she says it is one, `kind "<label>" session --private yes`.

Then tell her what `kind` says, in plain words: when Claude reads it, or that a notice will come. When it says what Claude made, go on as for "What did Claude find?".

## What she says, and what to run

| She says | Run |
|---|---|
| "What's waiting?" | `episodes`, then the card for each video waiting for her answer |
| "Which one is it?" | `which "<label>"`: it opens in QuickTime Player on her Mac |
| "What did Claude find?" | `status "<video>"`: tell her what the reading made, or why not. Then, by what it is: finished by your editor, `reels "<video>"` (the Reel suggestions), then the spellings card; raw with retakes, `show "<video>" notes` (Claude's notes) and `reels "<video>"`, then the spellings card (its rough cut, version 0, is open in QuickTime Player already); an iPhone clip, the spellings card; a session, `principles "<label>"` and `ideas "<label>"` |
| The spellings card | `spell "<video>" offers`, then one `AskUserQuestion`: "All of them", "None", "Let me choose" (she then says their numbers): `spell "<video>" offers all` / `spell "<video>" offers none` / `spell "<video>" offers 1 3`. If it offers none, answer none. For a finished video or an iPhone clip the hand-off is then written and shown in Finder: tell her to drop it on the BRIMM Ops page |
| "It's actually raw" (or finished, or an iPhone clip) | `kind "<video>" raw --private no --again`, with finished or clip in place of raw. A session becomes another kind only by "Clear the session mark", below |
| "It was a session after all" | `kind "<video>" session --private yes --again`. Tell her its words have already gone to Claude: drop the new revision it shows in Finder on the BRIMM Ops page, and tell Jason |
| "Open the Pricing episode" | `open "<episode>"`. If it says another Mac has it, ask her whether to take it over; if yes, `open "<episode>" --take-over`. If that take-over says Dropbox undid the claim and to say "take it over" again, run `open "<episode>" --take-over` again without asking her again. If it is bringing files over first, wait until "how far is it?" says the bring has ended; if it then says to say "take it over" again, run `open "<episode>" --take-over` again without asking her again; if it says some files are not here, tell her why, in plain words, and try again only when she says to. Take it over again unasked only in the conversation in which she said yes, and only if she has not said not to since; in a later one, run `open "<episode>"` and ask her as above. Never take an episode over unasked otherwise. |
| "Call it …" | `name "<episode>" "<name>"` |
| "Use that title" / "Make the title …" | `title "<episode>" --approve` / `title "<episode>" --words "<words>" --approve` (an approved title changes only with `--change`; say BRIMM Ops may have it already) |
| "Reel 2's title is …" | `title "<episode>" reel 2 --words "<words>"` |
| "Show me the Reels" | `reels "<episode>"`: tell her each candidate in plain words; its preview, when it has one, opens in QuickTime Player |
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
| "Show me the transcript / Claude's notes / the cut plan" | `show "<episode>" transcript` / `show "<episode>" notes` / `show "<episode>" plan`. Of a session or a video not yet answered it prints nothing: it opens a read-only copy in TextEdit on her Mac, or says why not, which tell her. Never read, quote or ask her to paste such a file, and run nothing else that would print it |
| "Finish the episode" | `finish "<episode>"`; answer its questions with her, then `finish "<episode>" --yes` and the answers it asks for |
| "How far is it?" | `status` |
| "Try it again" (an import that stopped) | `retry "<video>"` |
| "Hand it to Jason" / "I'm done with it for now" | `release "<episode>"`, with the release question below |
| "Sort out the conflict" | `resolve "<episode>"`; show her the two sides in plain words; then `resolve "<episode>" --keep A` or `resolve "<episode>" --keep B` as she picks. If it says a conflict needs Jason, or that Dropbox is still bringing a file over, tell her so and keep nothing. If it says that is not the version shown last, or that it was sorted out meanwhile, show her what it shows now and ask her again: never reuse her last answer |

In `--at-words` and `--words`, give her words without `$`, backticks, backslashes or double quotes, which are not matched, and keep apostrophes: "that's $100,000" is `--at-words "that's 100,000"`.

Times in the cut plan, in Claude's notes and inside a marker's words are the recording's, not her timeline's: never pass one as `--at`. To keep a cut found there, pass its words.

## A client or group session

Once a session is marked, tell her: "Never rate, report or share a chat about a session: a thumbs rating or a report keeps the chat, whatever the settings say." Then ask her: "What do you want from it: its teachings (principles and Reel ideas), or the transcript only?"

| She says | Run |
|---|---|
| "Its teachings" / "Get the teachings of <label>" | `teachings "<label>"`. If it says teachings are not turned on for this Mac yet, were turned on more than 90 days ago, or that another account is signed in, tell her so plainly, and to ask Jason |
| "The transcript only" | `teachings "<label>" --transcript-only` |
| "Show me the principles" / "Show me the Reel ideas" | `principles "<label>"` / `ideas "<label>"`: tell her each in plain words, read her brimm-video's line about the names it took out, and ask her what to keep, change or drop |
| "Keep 1 and 3" / "Drop 2" / "Call 3 …" | `principles "<label>" keep 1 3` / `principles "<label>" drop 2` / `principles "<label>" edit 3 --name "<name>"`. A recurring principle: `principles "<label>" recurring keep 1`, and drop and edit so. A Reel idea: `ideas "<label>" keep 1`, and drop and edit so |
| "Done" | `finish "<label>"`. If it says something is not decided yet, ask her about it. Then tell her to drop the hand-off it shows in Finder on the BRIMM Ops page |
| "The client agreed to Reel 2" | `reel "<label>" 2 --client-agreed`: tell her a dialog is open on her Mac, where she types who agreed and when, then clicks "They agreed". Never ask who agreed in the chat |
| "Clear the session mark" | Ask her what it is instead: finished by your editor, raw with retakes or an iPhone clip, never a session. Then `kind "<label>" <kind> --private no --again --clear-session`, with finished, raw or clip for <kind>. Tell her a dialog is open on her Mac, and she clicks "Clear it" herself (Return presses Cancel): Claude cannot press it |

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
