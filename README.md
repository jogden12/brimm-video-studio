# BRIMM video

Video editing for The BRIMM, run through Claude Code or Claude chat. Since 2026-10-14 it is a project of its own, apart from BRIMM Ops, the page that writes Sallie's drafts. Today it holds one tool, for unedited video, which runs on the Mac Studio: for a raw recording it writes a transcript and a cut plan, has Claude read the plan, and makes a rough cut, an upright version for Instagram, short clips and a Final Cut Pro project file. Everything it makes is a draft for a person to check. It never posts, sends or publishes anything.

Since phase 1a of the design, a video for the Mac Studio is dropped in `The BRIMM DB/BRIMM Video/Unedited Video/Mac Studio/` in Dropbox, once the installer has been run there with `--machine`, and is imported into an episode of its own in `The BRIMM DB/BRIMM Video/Episodes/`. See "Episodes" below. Until then the Mac Studio watches `Unedited Video Transfer`, as it always has.

What the project must do, and the decision still open about the editor on Sallie's laptop, are in `docs/requirements.md`. The design of the next version is `docs/superpowers/specs/2026-10-14-brimm-video-next-version-design.md`.

## What is where

| Path | What it is |
|---|---|
| `docs/requirements.md` | What the project must do, and what is still to decide |
| `docs/research/` | The research behind the tool and its presets, written in brimm-operations |
| `tool/` | The unedited-video tool, its face finder and its installer |
| `tool/edit.js` | The command line for episodes, which Claude runs: `episodes`, `open`, `push`, `status`, `retry` |
| `tool/filing.js`, `tool/episode.js`, `tool/importing.js` | An episode's import, its record, and the status files of imports |
| `tool/dropbox.js` | The rule for writing into Dropbox: clones, never over a file, and the late check |
| `tool/settings.js`, `tool/names.js`, `tool/portable.js`, `tool/detached.js` | This Mac's settings, the names made from names, Final Cut files that read the same on either Mac, and long commands run detached |
| `tool/shared/` | Copies of BRIMM Ops modules the tool uses |
| `tool/tests/` | The tests and the made-up recording they use |

## Running the tests

Node 22 or later. There are no packages to install.

```
cd tool
node --test
```

GitHub Actions runs them on every push and every pull request.

## Copies kept in step by hand

The tool borrows from two places in brimm-operations, and keeps its own copies. Each copy's first line names the file it was copied from and the commit, 84a2f61.

- `tool/shared/text.js`, `tool/shared/answers.js` and `tool/shared/transcript.js` are BRIMM Ops' `app/src/` files of those names, unchanged. `transcript.js` is how BRIMM Ops reads an `.srt`, so the tool's `.transcript.txt` is the same text BRIMM Ops makes of its `.srt`.
- `tool/shared/show.js` holds the show's name and the host's, the two lines of BRIMM Ops' `app/src/instructions.js` that the request to Claude names.
- `tool/lib.js` is the part of the transcript tool's `transcribe/lib.js` that this tool uses: which files it takes, what it asks ffmpeg and the transcriber to do, and how it reads what they wrote. The parts about Zoom calls are left out.
- `tool/run.js` is the part of `transcribe/transcribe.js` that this tool uses: how a program is run, where the programs are, and the lock on a watched folder. The lock is named as the transcript tool names it, so the two tools never work on one folder at the same time.

When one of those files changes in brimm-operations, change its copy here by hand.

## Unedited video

A raw recording has retakes, false starts and long pauses in it. `tool/unedited.js` takes one and suggests what to cut, by rules. It then asks Claude to read that plan: Claude may change what is cut, writes notes for the person who edits the video, and picks short clips. From the plan the tool makes a rough cut, an upright version of the rough cut for Instagram, a Final Cut Pro project file with the cuts already made, and the short clips. It runs on the same Mac as the transcript tool, with the same programs and with ffprobe, which is installed with ffmpeg. Claude is asked through Claude Code (`claude`), which nothing here installs.

**What leaves the Mac.** The video and its sound never leave this Mac. When Claude is asked, the words of the transcript with their times and the rules' plan are sent to Claude through Claude Code, on the Claude account signed in on this Mac. The video's file name and its length go with them, and the folder it is in does not. With `--rules-only` Claude is never asked, and everything stays on the Mac. See "Claude's read" below.

What goes in: one unedited video. A sound file works too, and gets everything but the rough cut, the upright version, the Final Cut file and the clips.

What comes out, each file named after the video:

| File | What it is for |
|---|---|
| `<name>.srt`, `<name>.transcript.txt` | The transcript of the whole recording, retakes and all, on the recording's own timing. They are made as the transcript tool makes them, with its silence filter and its spelling |
| `<name>.words.json` | Every word with the second it starts and ends at, for whatever works on the recording next. The times are close and not exact: expect a tenth to a third of a second |
| `<name>.cut-plan.txt` | The cut plan to read. Its first lines say what could not be made, and whether Claude read the plan. A short clip that could not be cut is the one thing they do not name: the log and the end of the notes do. Then a line with the totals, and one line for each stretch that is kept or cut, with the reason for each cut. A cut of Claude's starts `CUT  Claude:` |
| `<name>.cut-plan.json` | The same plan to work from: the facts about the file, every phrase, and every range with its exact times, in seconds of the video. `by` says who made it: `rules`, or `rules and Claude`. When Claude read the plan it also holds `claude`: the decisions as Claude gave them, its ideas for graphics as they were read (kept since 2026-10-14, for later use: nothing reads them back yet), what was left out of its reply and why, and each clip with the names of the files made of it. When those decisions changed the plan it holds `changes` too, which lists what they changed. When Claude changed nothing there is no `changes`, and `by` is still `rules`. This file is written last, and is what says the video is done |
| `<name>.rough-cut.mp4` | The kept stretches joined, to watch. It is for judging the cuts and is not a final video: the picture 1080 lines at most. See "How the videos are written" below |
| `<name>.rough-cut.srt`, `<name>.rough-cut.transcript.txt` | The captions of the rough cut, and the same as plain text. This is the transcript of the video as it will be seen, without the retakes |
| `<name>.rough-cut.vertical.mp4` | The rough cut again, upright, for Instagram: 1080 by 1920, cropped on the speaker's face. Only a video that is wider than it is tall gets one. See "The upright version" below |
| `<name>.fcpxml` | A Final Cut Pro project file: the kept stretches cut together on a timeline, with the captions, a marker at each join, and a marker for each of Claude's ideas for a graphic. See "The Final Cut file" below |
| `<name>.edit-notes.txt` | Only when Claude read the plan. What Claude wrote for the editor: its notes, what it changed in the plan and why, its ideas for graphics, its clips, and at the end everything of its reply that could not be used |
| `<name>.reel-<n>.mp4` | Only when Claude picked clips. One short clip, whole, with what the plan cuts inside it left out. `<n>` is the clip's number in the notes. See "The short clips" below |
| `<name>.reel-<n>.srt` | The captions of that clip, on the clip's own clock |
| `<name>.reel-<n>.story-<k>.mp4` | Only for a clip of more than a minute: the clip again in parts of at most 60 seconds, for a Story |

One file by hand:

```
cd tool
node unedited.js "/path/to/raw video.mp4"
node unedited.js --rules-only "/path/to/raw video.mp4"    # never asks Claude
```

The files appear beside the video and nothing is moved. `--out "/another/folder"` writes them there. `node unedited.js --watch "/path/to/folder"` does every video directly in a folder that has no cut plan yet, and then files each one, with all of its files, in a new folder there named for the day, as the transcript tool files a video. A folder is for one of the two tools and not for both: whichever looks first files the video away. A video named `<something>.reel-<n>` or `<something>.reel-<n>.story-<k>` is taken for a clip the tool cut, as one named `<something>.rough-cut` is taken for a rough cut, and is never worked on. Doing a video again takes away the notes and the clips of the run before, with the rest of what that run made. Before 2026-10-14 a clip that a run was killed while writing was left beside the video under its name with `.writing` after it, and that is taken away too.

**How each file is written.** Every file is written whole in the run's own folder, among the Mac's temporary files, and only then moved where it belongs, under its own name, in one move. So a folder in Dropbox never sees a file half written, never uploads one, and never sees one renamed. Until 2026-10-14 the tool wrote each file beside the video under its name with `.writing` after it and renamed it when it was whole. Dropbox undid two of those renames that day, of videos of 387 and 70 MB it was most likely still uploading, and they stayed under their `.writing` names. On the Mac Studio the temporary files and Dropbox are on the same disk, so the move is one step. When they are not, as for `--out` on another disk, the file is copied there under its own name and deleted from the run's folder, and the log says so. After each move the tool looks for the file under its name, and the log says plainly when it is not there. That file then counts as not made.

- For one video, each file is moved beside the video, or into `--out`, as soon as it is whole. The cut plan comes last. With `--from-plan` only the videos are moved, each over the one made before.
- For a watched folder, the files are kept in the run's own folder until the video is done. Then the video is moved into the folder for the day, and each file goes straight in after it. The video is the one file renamed in the watched folder, and it has been there whole since before the run began. A run cut short leaves nothing in the watched folder but the video, which is done again the next time. When the video cannot be moved, its files go beside it. When a file cannot go into the folder for the day, it and the ones after it go into the watched folder instead, and the log says which.

Having the Mac watch a folder for unedited video: the installer sets that up. `<main>` is the main folder the transcript tool watches on the Mac Studio, in Dropbox:

```
cd tool
./install.sh --print "<main>/Unedited Video Transfer"    # shows what it would do and changes nothing
./install.sh "<main>/Unedited Video Transfer"
```

The Mac then runs `node unedited.js --watch` on that folder whenever something lands in it, under the launch agent `com.thebrimm.unedited`. That is the label the agent had when the tool was in brimm-operations, so a run of this installer replaces that agent in place. What it did is in `~/Library/Logs/brimm-video.log`. More than one folder can be named, and the list replaces the last one, so name every folder each time. The installer installs ffmpeg, whisper-cpp and Node with Homebrew when they are missing, and downloads the transcriber's model once (about 1.6 GB) when it is not in `~/Library/Application Support/BRIMM Transcribe/`, where the transcript tool keeps it. It asks first, and `--yes` goes ahead without asking. It refuses a folder that the transcript tool's launch agent, `com.thebrimm.transcribe`, watches already: whichever tool looked first would file the video away. It reads that agent's file for the folders and never writes, loads or stops it. `./install.sh --remove` stops `com.thebrimm.unedited` alone. The tool is run straight from this folder, so the branch checked out here is the tool: keep it on `main`, and work in a git worktree.

Add `--rules-only` to that line and the launch agent runs `node unedited.js --rules-only --watch`, so Claude is never asked. Without it, the installer's summary says whether it found Claude Code where the launch agent will look for it, and what is then sent to Claude. The installer does not install Claude Code and does not sign in to it. To have Claude asked again, run the line again without `--rules-only`.

**Progress.** While a video is worked on, a small window floats in the top right corner of the screen with a bar for each
video: the step it is at ("Making the upright version (step 7 of 8)"), how far that step has got when ffmpeg says so, and how
long is left. Once a video has been done on a Mac, it also says roughly how long is left in all, from what each step took
there, kept in `~/Library/Application Support/BRIMM Video/progress/rates.json`. It comes up for a run started by the launch
agent, by hand, or from a Claude session, and goes a few seconds after the last run ends. It is drawn by `tool/progress.swift`,
which swift runs, so nothing is installed. Without swift there is no window, and the log says so once. Each run writes a
small file in `~/Library/Application Support/BRIMM Video/progress/`, on the Mac's own disk and never in Dropbox. Closing the
window, or its failing to open, changes nothing about the work. A video dropped for the other Mac shows its window on that
Mac only.

**The cuts are suggestions, made by rules and then by Claude, and are for a person to check.** They have only been tested on made-up speech so far, spoken by the Mac's own voice. The recording is first split into phrases: a phrase ends at a pause, which is 0.3 seconds or more of quiet, or at the end of a sentence. Then the rules, which are in `tool/cuts.js`:

- **A retake** is a phrase, or several in a row, that is said again straight after it: what comes next opens with the same four words or more, or shares at least 70% of the words, in order. The earlier telling is cut and the last one is kept. The second telling starts within 90 seconds, with no more than a spoken cue and a few words ("Sorry. Where was I?") between the two. The same words said again after other things is a point made twice, and both are kept.
- **A false start** is a phrase of two to six words that does not end a sentence, and whose words begin the phrase after it. A single word said twice across a pause ("Never," and then "never give up") is kept: it may be said twice on purpose.
- **A cue** is a phrase that only says to start over: "let me do that again", "take two", "one more time". It is cut, and so is the phrase before it when that phrase is then said again.
- **A pause** of a second and a half or more between two kept phrases is shortened to 0.4 seconds. The silence before the first kept words and after the last is cut. Only what ffmpeg heard as silent is cut this way. A sound between two pauses that the transcriber wrote no word for is kept, and each of the two pauses is shortened on its own: the sound may be a word the transcriber missed.

A phrase is only ever cut whole, and a cut is only ever made in a pause, a fifth of a second from the words that are kept. ffmpeg hears where the pauses are exactly. The transcriber's time for a word is only close. So where somebody runs straight on with no pause, nothing is cut. And where no pause is heard before the first words or after the last, as when music plays under them, the recording is kept from its start or to its end.

What to look for when checking a plan:

- Two sentences built the same way, one straight after the other ("The first thing you need is a clear offer. The second thing you need is a clear price."), can pass for a retake, and the first would be cut.
- After a pause the transcriber sometimes writes a sentence twice that was said once. The rules know such a line by its having no time to be said in, and cut nothing for it. A doubled line that was given time of its own would pass for a retake.
- The transcriber writes the same broken-off words now as "So the..." and now as "So the." With the full stop they pass for a sentence, and the false start is kept.
- A kept line with no words on it is a sound the transcriber wrote no word for: a cough, a door, or a word it missed. Beside a phrase that is cut, such a sound is cut with the phrase.
- The captions come from the pass that times the words, which is not quite the pass the transcript tool makes. On one made-up recording of five minutes the two differed by one caption, and by a few hundredths of a second here and there. On another this pass wrote a capital on every word, and 118 captions where the transcript tool's wrote 84.

Claude's read: once the rules have made a plan, and before anything is made from it, the tool asks Claude once to read it. What it asks, how the reply is read and how the plan is changed are in `tool/notes.js`.

- What Claude is given: the file's name and length, and every phrase of the plan on a line of its own, with the time it starts, what the rules decided for it and why, and its words. It is told that the footage is for the show, and who the host is. Nothing else is sent.
- What Claude is asked for, as one JSON object: decisions, only where it disagrees with the rules (an abandoned take the rules kept, a sentence that trails off, or something the rules cut that is a repeat for emphasis); up to 200 words of notes for the editor; up to six ideas for a graphic, each on a kept phrase; and up to five clips of 15 to 90 seconds that would stand alone.
- What Claude cannot do: **it reads the words and never sees the picture or hears the sound.** It cannot tell which take looks or sounds better, and it is told so. The transcriber also mis-hears a word now and then. So every cut Claude adds, and every cut of the rules that it takes back, is for a person to check. Each is listed in `<name>.edit-notes.txt` with its reason, and `CUT  Claude:` marks its cuts in `<name>.cut-plan.txt`.
- What is done with its reply: a decision is only applied to a phrase the plan has, only at a pause, and never when it would leave nothing kept. Phrases with no pause between them are cut or kept together. The plan is then made again by the rules' own code, with the pauses ffmpeg heard, so a cut of Claude's falls where a cut of the rules would. That plan is the plan for everything after it: the rough cut and its captions, the upright version, the Final Cut file and the two plan files. What was left out of the reply, and why, is at the end of the notes and in `<name>.cut-plan.json`.
- How it is asked: the tool runs `claude -p --model claude-opus-5-5 --tools "" --strict-mcp-config --disable-slash-commands --no-session-persistence --setting-sources "" --output-format json`, in a new empty folder, with the request on its standard input. So Claude Code has none of its own tools and no skills, starts no tool server (MCP) that is set up for this user, reads no settings file and no project files, and saves no session. The words of a recording are a stranger’s text as far as Claude is concerned, so it is given nothing it could act with: all it can do is answer, and the tool reads that answer as data. It is given ten minutes. The tool looks for `claude` on the PATH, then in `/opt/homebrew/bin`, `/usr/local/bin` and `.local/bin` in the home folder.
- The model is named (`CLAUDE_MODEL` in `tool/unedited.js`), not left to the account's default, so that both Macs read a plan with the same one, and a change of default changes nothing. It was added on 2026-10-14; before that the account's default read every plan.
- That was asked once: on 2026-10-13, with these options, Claude was asked which tools it had and answered none. That is its own word and not a proof, which is why the options are given and not trusted to a default.
- What a call leaves on the Mac: Claude Code keeps a folder of its own for every folder it is run in, in `.claude/projects` in the home folder, named after that folder's path. Each call is run in a newly named folder, so each call leaves one more there, and a call that is tried twice leaves two. The one real run left `-private-var-folders-…-T-brimm-unedited-28031-1791927837336-claude-1`, with an empty folder named `memory` in it and nothing of the request or the reply. The tool takes away the folder it made for the call and leaves that one, because it deletes nothing under `.claude`. Such a folder holds nothing, and can be deleted by hand.
- What leaves the Mac: only that request, which is the words of the transcript with their times, the rules' plan, and the video's file name and length. So a name such as a client's, when it is in the file's name or is said on camera, is sent. It goes to Claude through Claude Code, on the Claude account signed in on this Mac, and counts against that account's use. The video and its sound never leave the Mac.
- When Claude cannot be reached: a call that ends badly, runs out of time, prints something that cannot be read, says it failed, or gives a reply nothing can be read from is tried once more, three seconds later. After two failures the rules' plan is used as it is. The log says why each try failed, the first lines of `<name>.cut-plan.txt` say `Claude could not be asked (the reason), so this plan is the rules' alone.`, and the banner says so. There are then no notes and no clips. This is not a failed run: everything else is made.
- When Claude Code is not on the Mac, Claude is not asked. The log says so once for the run, and the first lines of each `<name>.cut-plan.txt` say `Claude Code is not installed, so this plan is the rules' alone.`
- `--rules-only` never asks Claude. The log says so once for the run. Everything is then as the rules alone make it, and nothing leaves the Mac.
- Tried by hand on this Mac on 2026-10-13, before this was built: the call worked from a shell and from a launch agent, on the Claude account signed in here, with no key. The plan of a 58-second recording took 19 seconds. One call failed with "Failed to authenticate: OAuth session expired and could not be refreshed", and the next one worked. That is why a failed call is tried once more.

The short clips: for each clip Claude picked that can be cut from the plan, the tool cuts `<name>.reel-<n>.mp4`. It is the kept stretches from the clip's first phrase to its last, joined, with what the plan cuts between them left out.

- A clip of a video that is wider than it is tall is upright, 1080 by 1920, each stretch cropped on the speaker by the same stills and faces the upright version found. Without swift it is cropped at the centre of the picture, as the upright version is, and `<name>.cut-plan.txt` says so. A clip of a video that is upright or square already keeps its shape.
- **The clips have no captions burned into the picture.** The ffmpeg on this Mac has no filter that draws text (no `subtitles`, `ass` or `drawtext`). Each clip comes with `<name>.reel-<n>.srt` instead: its captions on the clip's own clock, to be added where the clip is posted or in an editor. The parts of a Story have no caption file of their own.
- A clip of more than a minute also comes as the parts of a Story, `<name>.reel-<n>.story-<k>.mp4`, each at most 60 seconds of what is kept. It is cut on the last pause in the 15 seconds before the 60 second mark, and at the mark itself when nobody pauses there. Each end of a part is moved to the nearest whole picture. A part that would then hold more pictures than 60 seconds do ends that many pictures sooner, and those pictures are in no part. Measured on 2026-10-13 with the real ffmpeg, on a test picture at 29.97 pictures a second: a part cut at the mark came out at 1799 pictures, 60.027 seconds, without this, and at 1798 pictures, 59.993 seconds, with it.
- A clip is cut whether or not it fits a Reel. One that is shorter than 15 seconds or longer than 90 has a line under it in the notes that says so. These are Instagram's limits as they were understood in October 2026.
- A clip is left out, and the notes say why, when it names a phrase the plan does not have, when nothing in it is kept, or when it takes a phrase a clip before it has. Five are made at most. A clip keeps the number of its place in Claude's reply, so the numbers in the file names can have gaps.
- A clip that starts or ends where there is no pause is cut on a word's own time, which is only close. The notes say to check its first or its last word.
- When one clip cannot be cut, the log and the notes say so and the others are cut all the same. The run then ends as one in which a file could not be made. `<name>.cut-plan.txt` and the banner do not name the clip.
- Each clip is one pass of ffmpeg over the whole video, as the upright version is, and so is each part of a Story. So the clips of a long recording can take several times as long as its upright version. Nobody has measured that on a long recording yet.

The Final Cut file: double-click `<name>.fcpxml`. Final Cut Pro opens it as a project named `<name> rough cut`, in an event named `Rough cuts`, in the library `BRIMM rough cuts`. That library is kept in the folder `BRIMM Video Work` in the home folder, because Final Cut Pro cannot keep a library in a folder that syncs to a cloud drive. On the Mac this was built on, the Movies folder is in Dropbox, and making a library there fails with "Select a local storage device". The file names its library, so Final Cut Pro asks nothing, and makes the library when it is not there. That was seen twice on 2026-10-13 with Final Cut Pro 12.4: of a file written by hand, and then of a file the tool wrote for a made-up recording, which made the library and put five pieces, their captions and a marker at each join on the timeline. The library is named as a `file://` address with no slash at its end. The tool makes the folder `BRIMM Video Work` when it is not there. It never opens Final Cut Pro.

What the file holds:

- The kept stretches of the plan as clips on a timeline, one after another, each end on a whole picture.
- The captions of the whole recording, from `<name>.srt`, each on the clip it is shown over.
- A marker on the first picture after each join. It says how much was taken out there and why, in the plan's own words: `Taken out, 6.9 seconds. Retake: said again at 0:10, the later one is kept`. So every cut can be checked where it was made. A cut of Claude's reads `Taken out, 2.7 seconds. Claude:` and then its reason.
- A marker for each of Claude's ideas for a graphic, at the start of the phrase the idea sits on: `Graphic idea: the three numbers on screen`. It is an idea and nothing more: no title or graphic is put on the timeline. An idea whose phrase is cut gets no marker, and the notes say what became of it.

What it cannot hold:

- The video. The file names the video by where it is on this Mac: beside the file, or for a watched folder in the dated folder the two are filed in. Once the video or that folder is moved or renamed, a file opened after that shows its clips as missing, until Final Cut Pro is told where the video is (File, Relink Files). And the file is for the Mac that made it: on another Mac the video is somewhere else.
- A title or a graphic. In such a file a title is only the name of a template on one Mac, so none is written.
- An export. It cannot make Final Cut Pro write a video.
- Captions cut to fit. They are the whole recording's captions. One that lies wholly in a cut is left out, and one that runs over a join is shortened to its clip, but its words are never changed. So a caption beside a cut can hold words that were cut. `<name>.rough-cut.srt` has the captions of the kept words alone.

The file is checked before it is written. One that does not pass is not written, and `<name>.cut-plan.txt` says why.

The upright version: for a video that is wider than it is tall, `<name>.rough-cut.vertical.mp4` is the kept stretches of the rough cut again, cropped to 9:16 and made 1080 by 1920. The tool takes a still of the video every two seconds and finds the faces in them, on this Mac (`tool/faces.swift`, with Apple's Vision framework). Each kept stretch then gets one crop, the full height of the picture, with the largest face in its middle. A video that is already upright or square gets no such file, and the log says it needs none.

Its limits:

- One fixed crop for each kept stretch. It suits one speaker who stays seated. It does not follow a speaker who moves, and with two people in the picture it takes the larger face and does not know who is talking.
- A small source comes out soft. The crop of a 640x360 Zoom video is 202 pixels wide, and is made 1080 wide: more than five times its size.
- A stretch no face was found in takes the crop of the whole video, and the log says how many such stretches there were.
- It matches the rough cut picture for picture only when the video's pictures come at an even rate and its sound starts with its picture. The rough cut puts every picture on an even grid and the sound on the video's clock, and the upright version keeps the video's own pictures and sound as they are. So of a video whose pictures come unevenly, as a phone or Zoom may write them, or whose sound starts late, the upright version comes out a little longer than the rough cut, and `<name>.rough-cut.srt` runs ahead of it by the end. Measured on 2026-10-13 on made-up videos of two minutes with 40 cuts: 0.4 seconds longer when two pictures in every nine were missing, and 0.2 when the sound started half a second after the picture. At that rate an hour of talk with 250 cuts ends more than a second apart.
- The faces are found with `swift`, which comes with Xcode's command line tools (`xcode-select --install`). When swift is missing or fails, or what it prints cannot be read, every stretch is cropped at the centre of the picture, and the log and `<name>.cut-plan.txt` say so.

How the videos are written: the rough cut, the upright version and the short clips are H.264, made by x264 at a quality (`-crf`) and not at a fixed bitrate, so each is only as large as its picture needs. The rough cut is written at 23, x264's own default. An upright file is enlarged to 1080 by 1920, and an enlarged picture has no more detail than its source, so it is written at 23 and 2 more for each doubling: 25 from 1080 lines, 26 from 720, 28 from a 360-line Zoom recording. The sound is AAC at 48 kHz, and each file has its index at the front, so it can play before all of it is read. Until 2026-10-14 every file was written at a fixed 8 Mbit by the Mac's own encoder, with sound at whatever rate the recording had and the index at the end. A Zoom recording of 32 minutes, 640x360 at 0.67 Mbit and 182 MB, then came out as a rough cut of 1.32 GB, an upright version of 1.79 GB and clips of 40 to 78 MB. Measured on 2026-10-14 on a made-up recording like it, which came out at the same sizes the old way: a rough cut of 45 MB, an upright version of 156 MB, and clips of 3.5 to 6.8 MB, with the same pictures as before, and sound within 3 ms of where it was. x264 is slower than the Mac's own encoder: at 1080 lines it writes about 5 seconds of video a second, against 13, and the upright version of the made-up recording took 3.5 minutes, against 2.

Making the videos again: `node unedited.js "/path/to/raw video.mp4" --from-plan` makes the rough cut, its upright version, and each clip and part of a Story that the plan names as made, again from the `<name>.cut-plan.json` an earlier run wrote, as the tool writes videos now. Use it when only the way videos are written has changed and the cuts and clips are to stay, as on 2026-10-14: a full run would make a new transcript and ask Claude again, and Claude might pick other clips. No transcript is made and Claude is not asked. The faces are looked for again. Every other file stays as it was, the Final Cut file too, which names the video and none of these. A video that cannot be made keeps the one made before, and the log says so. It makes nothing when there is no plan, when the plan cannot be read, or when it is of another video, by its name or by the length, size and frame rate ffprobe gives now. It is for one video, never for a watched folder, and it never moves the video. With `--out`, the plan is read from that folder.

When no transcript can be made, `<name>.failed.txt` says why, as the transcript tool's note does. When the transcript is made and the plan, the rough cut, the upright version, the Final Cut file or Claude's notes are not, what was made is kept, and the first lines of `<name>.cut-plan.txt` say what is missing and why, a line for each. When no plan can be made, Claude is not asked.

On some recordings the transcriber dies while it times the words, and does so every time that recording is tried. A review on 2026-10-13 saw it on one made-up recording of 62 minutes, out of about fifty tried. The transcript is then written by the transcript tool's own pass, which reads the same sound without trouble, and `<name>.cut-plan.txt` says that no cut plan could be made and why. Such a recording takes about twice as long.

On 2026-10-13 a made-up recording of five and a half minutes, 1080 lines, took 44 seconds from start to finish on the Mac this was built on. That was before the upright version and the Final Cut file were added. With them, a made-up recording of 21 seconds, 720 lines, took 11 seconds.

**None of this has been tried on real footage yet.** The cuts, the Final Cut file and the upright version have only met made-up recordings, spoken by the Mac's own voice. One file the tool wrote has been opened in Final Cut Pro, of a made-up recording, and no more. The upright version was made once with the real programs, of a test picture with no face in it: the face finder was shown a real face once, on 2026-10-13, in a Zoom recording, and found it in all 60 stills, but no crop this run makes has been checked against a real speaker. The installer, then in brimm-operations, was run with `--unedited` on 2026-10-13, and the launch agent it loaded has worked the watched folder (below). This repo's installer has only been run with `--print`. Try each on a real recording before relying on it.

The same goes for Claude's read, its notes and the clips. The whole of it has been run once with the real programs and the real Claude, on 2026-10-13, on a made-up recording of 48 seconds: the Mac's own voice over ffmpeg's test picture, 720 lines. It took 36 seconds from start to finish, of which Claude took 17. Claude changed nothing in the rules' plan, wrote its notes and six ideas for graphics, and picked two clips. The second overlapped the first and was left out, and the first was cut: upright, 1080 by 1920, 29 seconds, with 14 captions in its caption file. The test picture has no face in it, so the clip was cropped at the centre. In that run Claude's notes named phrases by their ids, such as p17. An id is in `<name>.cut-plan.json` only, so the notes and Claude's reasons now give the time of the words in its place.

A second run the same day, on a made-up recording of 58 seconds with planted retakes, took 36 seconds. Claude cut an abandoned take the rules had kept (two phrases, said again after "Sorry, one more time"), wrote its notes and five ideas for graphics, and picked one clip of 24 seconds, which was cut upright. A run with no `USER` in its environment could not ask Claude: Claude Code answered "Not logged in", twice, and the plan was left as the rules made it, with that reason at the top. A launch agent and a terminal both have `USER`.

The watched folder was tried the same day, with the launch agent installed: that recording, dropped into the folder, was filed 31 seconds later in a folder named for the day, with every file, Claude's changes and one clip. So the launch agent can ask Claude with no sign-in of its own.

That is one run, of made-up speech. Claude has never read the plan of a real recording, so nobody knows yet how good its decisions, its notes or its choice of clips are on real talk, how often its reply comes back in a form that cannot be used, or how long it takes over an hour of video. In that one run it made no decision, so no cut of Claude's has been made by the real programs. No clip has been cut from real footage, cropped on a real face, cut into the parts of a Story, or posted. No Final Cut file with a marker for a graphic idea has been opened in Final Cut Pro. And the tool has not been run with Claude from the launch agent: the call alone was tried from one.

Its tests: `cd tool && node --test`. The installer's tests only ever run it with `--print`. No test asks Claude anything: a stand-in says what Claude Code would print.

## Episodes

Phase 1a of the design, built on 2026-10-14: the Mac Studio alone. Sallie's laptop, the claim on an episode, `release` and `resolve` come in phase 1b; the title, picking Reels and `finish` in phase 2.

**The folders.** In Dropbox, `The BRIMM DB/BRIMM Video/` sits beside `BRIMM VIDEO Transfer/`, and never inside it: the transcript tool's launch agent watches that folder, and launchd would wake it at every change an editing session makes.

```
The BRIMM DB/BRIMM Video/
  Unedited Video/
    Mac Studio/            drop a video here to have the Mac Studio import it. Its .brimm-watched-by names the Mac
  Episodes/
    .importing/            a small status file for each import: which Mac, which video, the step it is at
    2026-10-14 Talk (Mac Studio)/
      record/0001.json …   the episode's record: a new file for each change, never written into
      Talk.mov             the raw video, and every file made of it, as for any video
      edit/main.v0.fcpxml  the import's own Final Cut timeline, naming its video ../Talk.mov and no library
      edit/main.v1.mac-studio.fcpxml …   each version shown in Final Cut
```

On the Mac's own disk: `~/BRIMM Video Work/<episode folder>/` holds the copies of timelines handed to Final Cut (`pushed/`), the episode's Final Cut library (`<episode folder>.fcpbundle`), and what detached runs left; `~/BRIMM Video Work/.runs/` holds an import's own folder until its late check; `~/Library/Application Support/BRIMM Video/` holds this Mac's `settings.json`, `written.json` (the last record this Mac wrote of each episode), `pending/` (the late checks still to make) and `seen.json` (when this Mac's import first saw each video in its drop folder).

**Writing into Dropbox: the rule.** Dropbox undid two renames on 2026-10-14, minutes after they had returned. So nothing in Dropbox is written into, renamed or moved. Every file is written whole on this Mac's own disk, then put into Dropbox under its final name as an APFS clone, by `/bin/cp -c`. `cp -c` makes a plain byte copy, without a word, when the two folders are on different disks (its manual says so), so the tool checks they are on one disk first, and where a clone cannot be made it stops and says why: nothing is copied byte by byte. A file already there is deleted first and the new one cloned in. Each file is looked at right after, and again at least 15 minutes after the import's last copy, the late check. A file missing or short then is put in again from its work copy. Only after the late check passes are the run's folder and the raw video in the drop folder deleted. Whether a clone into Dropbox's folder is safe where a rename was not has still to be seen by hand (the deployment note of the pull request that built this).

**A video arrives** when its size has settled and it is whole on this Mac: its blocks on the disk cover its size, or the disk does not mark it dataless. Dropbox can show a file at its full size before any of it is here, as it does for a video dropped from another device into a folder that is not kept offline, and ffprobe could then hang. Such a placeholder is read through once, which has Dropbox bring it down, and then looked at again. This holds for every watched folder. So that a video comes down at once, mark the drop folder once in Finder: Control-click it and choose Make available offline. The installer says so.

**What the import does**, for a video in this Mac's drop folder (`tool/filing.js`):

1. It leaves alone a video an episode already holds (by its name and size), and one whose import is running on either Mac (at that size), failed, or found a problem at its late check. The log says why, once. A held video is looked at again each minute, so one whose failed status is taken away (`retry`) is imported. A status file this Mac's stopped run left is taken away, and the video imported again, and so are the folders stopped runs left in `.runs`.
2. It writes a status file in `Episodes/.importing/` at the start, at each step and once a minute: a new file each time, `<video> (<Mac>) <import id> <n>.json`, the one before deleted. The import id keeps two imports of one name apart.
3. It makes everything as for any video, in its own folder in `~/BRIMM Video Work/.runs/`, and writes nothing beside the video in the drop folder: a file there of the video's name is a person's own. An upright, square or short recording (under 90 seconds) is a short video: it gets no upright version and no clips. A video replaced in the drop folder while it is worked on, as by a corrected export of the same name, stops that import before anything is filed, and the new file is imported on its own.
4. It files the episode into `Episodes/<day> <name> (<Mac>)/`: the raw video cloned in from the drop folder, each file cloned in, the Final Cut file as `edit/main.v0.fcpxml`, and the first record last. The banner says "Ready: Talk. In Claude, say "open Talk"." and the progress window closes.
5. It waits, kept awake by `caffeinate`, until the late check is due, looking in the drop folder once a minute for new videos, and writing each waiting video's status so the other Mac sees it is still at it. The late check deletes the raw video from the drop folder only when it is still the file that was imported. The log says when the check is due. A file still wrong at the late check keeps the raw video in the drop folder, puts the problem in the status file and in the first lines of the cut plan, and shows a banner. The next run checks it again. A run stopped before the late check leaves it for this Mac's next run, which makes it first.

**The record** (`tool/episode.js`) is `record/0001.json`, `0002.json` and on: the highest number that reads whole is the record. A command writes the next number only when no record above the one it read is there; otherwise it says the episode changed on the other Mac. A conflicted copy of any file stops every command, naming it. A record written by a newer brimm-video is read and never written. The record lists every file of the episode with its size, and each command checks the folder against it.

**From Claude** (`node tool/edit.js …`):

| Command | What it does |
|---|---|
| `episodes` | Each episode, newest first: its name, length, kind, short id, what was shown in Final Cut, and any file not right. The videos waiting in each drop folder, and for how long: from when this Mac's import first saw it, or, in the other Mac's drop folder, from when it came into the folder (a tag set on it since makes that later). The imports. This Mac's libraries and the free space |
| `open "<episode>"` | Checks the episode's files, starts a detached run to bring over those Dropbox has not brought yet, and shows the name, the title, Claude's notes, the Reel candidates and the next step. The first time on this Mac it says how to keep the episode on the Mac (Finder, Make available offline) |
| `push "<episode>" [main] [--no-hand-edits \| --hand-edits]` | Shows the main timeline in Final Cut Pro as a new version (below) |
| `status ["<words>"]` | What is running on this Mac, the imports, and what detached runs left |
| `retry "<video>"` | Imports again a video in this Mac's drop folder whose import failed or stopped: it takes the failed status away and asks the launch agent to look (`launchctl kickstart`), or, when the agent's run is at work, that run takes it when it next looks |

An episode is found by its folder's name, its id, the last six characters of its id (which `episodes` shows), or words that are all in its name. An import that has not finished is not an episode yet. The first open or push of an episode on a Mac says how to keep its folder on that Mac (Finder, Make available offline), once.

The lock that keeps one run at a time on this Mac's drop folder is in `~/BRIMM Video Work/.runs/`, not in the temp folder: the launch agent has no `TMPDIR`, so its temp folder is `/tmp`, and a run started by hand would otherwise not see its lock.

**Showing a timeline in Final Cut** (`push`). Each push is a new version, `edit/main.v<n>.<mac>.fcpxml`, kept in the episode by the rule, as a project named `<name> main v<n> <short id>`, recorded before Final Cut is asked. Then a copy is written on this Mac's disk, naming this Mac's paths, the episode's own library, `copy assets` 0 and `suppress warnings` 1, and handed to Final Cut. What phase 0 settled on 2026-10-14, with Final Cut Pro 12.4:

- A timeline kept in an episode reads its video from its own folder, so it opens as it is on either Mac. Opened by a double-click it asks which library to put it in, so open it through Claude.
- A file that names no library makes Final Cut ask which one, so the copy always names it.
- A project of a name the library has already makes Final Cut ask to replace it, and Keep Both renames it "<name> 1", whose Share would then have another name than the one recorded. So no name is ever handed over twice: each push uses up its version, even when Final Cut could not be opened. Each push is its own event, of the same name, until phase 0 says whether `suppress warnings` stops that question.
- A new library keeps its backups in `~/Movies/Final Cut Backups`, and on the Mac Studio `~/Movies` is in Dropbox. So at an episode's first push on a Mac, the tool says to set its backups to `BRIMM Video Work/Backups` (File > Library Properties, Modify Settings).
- Without `copy assets`, Final Cut follows its Import setting, which on the Mac Studio copies the video into the library. Whether `copy assets` 0 overrides that is still to be seen.

**The guard.** A timeline shown before is shown again only when the person says it was not changed in Final Cut since (`--no-hand-edits`). Changes made by hand in Final Cut cannot be built on yet (phase 5 reads Final Cut's exports), so a "yes" stops the push: ask for brimm-video's changes first and trim by hand last, or finish that timeline by hand.

**Setting a Mac up.** `./install.sh --print --machine "Mac Studio" "<path to The BRIMM DB/BRIMM Video>"` shows what it would do and changes nothing: the drop folder, `Episodes/` and `.importing/` to make in Dropbox, the marker, this Mac's settings, `BRIMM Video Work/Backups` and `From Final Cut`, and the launch agent watching the drop folder alone. It refuses a drop folder another Mac's marker names, and BRIMM Video inside a folder the transcript tool watches. Without `--print`, and with Jason's yes, it does it.

None of this has met a real recording yet: the tests run every step with stand-ins for the programs and for `cp -c`.

## Where this came from

The tool was moved here from brimm-operations, where it was `transcribe/`, at commit 84a2f61 on 2026-10-14, with its tests, its installer, the research and the requirements items L1, L5 and L6. That repo's git history keeps the earlier work: how each part was built and reviewed, and every change before the move. The transcript tool stays in brimm-operations.

Until `tool/install.sh` is run on the Mac Studio, the launch agent `com.thebrimm.unedited` there still runs `transcribe/unedited.js` from the brimm-operations folder, and writes to that tool's log.
