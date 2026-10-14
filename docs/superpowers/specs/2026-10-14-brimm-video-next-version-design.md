# brimm-video, the next version: design

Written 2026-10-14 for Jason Ogden to approve before anything is built. Design only. No code was changed, nothing was installed, and no launch agent or folder was touched on either Mac. Written against `main` at commit c709b57, which already has the size fix (videos written by x264 at a quality) and `--from-plan`.

## What this rests on

**Jason's decisions of 2026-10-14** (memory note `video-editing-direction`, brimm-operations' L7):

- Final Cut Pro stays the editor: "Let's stick with final cut pro for now." He will install it on Sallie's laptop (MacBook Pro, November 2024, M4, 16 GB). He has checked the first real outputs, two Zoom recordings of 2026-10-14: "they look great".
- brimm-video is "the app that takes raw unedited video, creates transcripts and other files needed for BRIMM Ops, and automatically creates Reels. from there, it should be able to add effects, editing presets, text and graphics, and then generate final, ready to post videos via final cut pro."
- The first Reels are lightweight: "some of those may not be utilized".
- It runs on both Macs: "so that Sallie can run the full workflow on her laptop OR send it to me to run on the mac studio when she's busy." Each Mac has one drop folder, watched by that Mac alone.
- At the end of an edit, one file goes to BRIMM Ops: the episode's final transcript, and each kept Reel with its transcript and its on-screen title. BRIMM Ops then writes the cascade, "preferably" without a trip back.
- The episode name is asked for at the start, and a placeholder is fine. brimm-video recommends the on-screen title, the user edits it once, and it does not change after that. Thumbnails are not brimm-video's job.
- The YouTube and Zoom transcript tool moves into brimm-video, as a phase of its own.
- The brand is the brand guide's, and the name on screen is Sallie Ogden. Jason pays for the typefaces chosen, and the logo stays an editable setting.

**Jason's answers in this session (2026-10-14):**

1. **The final transcript is made by transcribing the finished videos again**, not by re-timing from an Export XML. There is no Export XML step at the end.
2. **Hand edits: brimm-video layers on exports.** Claude's cut changes come before hand trimming. After hand edits, an Export XML (Cmd-E) is the new base. brimm-video adds or replaces only its own layers on it (titles, captions, the look, the logo) and never touches hand-made cuts. The same export carries an edit in progress to the other Mac.
3. **Sallie's laptop gets the code by a git clone with a read-only deploy key** made for that laptop alone.

**Assumed here, for Jason to correct:**

- The editing session is Claude Code in the Claude desktop app's Code tab, opened on brimm-video. A route through Claude chat would need a local MCP server, which is left for later (Phase 7 below).
- Claude never writes FCPXML or edits episode files itself. It runs brimm-video's commands, which are tested.
- Final Cut libraries stay on each Mac's own disk. Only the episode folder travels, through Dropbox.
- After the move, the transcript tool runs on the Mac Studio only, as it does today.
- Nothing in this design changes brimm-operations. The page's side of the hand-off is L7 there.

## The answer in brief

```
 Sallie's laptop                      Dropbox: The BRIMM DB/BRIMM VIDEO Transfer                     Mac Studio
 ───────────────                      ──────────────────────────────────────────                     ──────────
 launch agent ◀── watches ── Unedited Video/Sallie's laptop/     Unedited Video/Mac Studio/ ── watches ──▶ launch agent
      │                                                                                                    │
      └──── import (unattended) ──▶ Episodes/2026-10-14 Pricing talk/ ◀── import (unattended) ─────────────┘
                                         episode.json, transcript, cut plan, rough cuts,
                                         Reel previews, timelines, final videos, hand-off
                                                       ▲
 Claude Code session ⇄ local Final Cut library         │          local Final Cut library ⇄ Claude Code session
 (either Mac picks the episode up) ────────────────────┴──────────────────────────────────────────────────┘
                                                       │
                     Share from Final Cut ──▶ final/ ──▶ finish ──▶ <Episode>.brimm-ops.json ──▶ BRIMM Ops page
```

| # | What is settled | The recommendation |
|---|---|---|
| 1 | Drop folders and outputs | `BRIMM VIDEO Transfer/Unedited Video/Mac Studio/` and `.../Unedited Video/Sallie's laptop/`, each watched only by its own Mac. Every import files the video and what was made of it into `BRIMM VIDEO Transfer/Episodes/<date> <name>/`, which no Mac watches. Either Mac opens an episode from there. A soft claim in `episode.json` says who is editing |
| 2 | Paths across Macs | Timelines name the video by a path relative to the timeline file, so they need no rewriting. Exports from Final Cut, which hold absolute paths, are rewritten to this Mac's episode folder before import. The file in Dropbox never names a library. Each Mac keeps one local library per episode, in `~/BRIMM Video Work/` |
| 3 | Lightweight Reels | On import: candidates in `reels.json` and a 540x960 preview each. No full-size clip and no Story parts. A Reel she picks becomes an upright Final Cut project, which Final Cut renders when she Shares it |
| 4 | Editing session | Claude Code with a project skill, driving `node tool/edit.js` commands. Each change makes a new project version, pushed into Final Cut with `open`. Titles and captions name BRIMM Motion templates made once by hand. Build on this repo's `fcpxml.js`; do not adopt the FCPXML MCP server |
| 5 | Finish | She Shares the finished videos into `final/`. `finish` transcribes each one again and splits Story parts from finished Reels. It writes one hand-off file, `<Episode>.brimm-ops.json` (format below) |
| 6 | Sallie's laptop | Fourteen items (section 6). Jason gives a yes in chat for each install, after the installer has been run with `--print` |
| 7 | Phases | 0 Final Cut facts by hand; 1 episodes on two Macs; 2 finish and hand-off; 3 lightweight Reels; 4 the session's commands; 5 layering on exports; 6 brand presets; 7 chat route (later, maybe). The transcript tool's move is phase T, at any time after 1 |

---

## 1. The drop folders, the outputs, and picking an episode up

### Folders in Dropbox

```
The BRIMM DB/BRIMM VIDEO Transfer/        the transcript tool's main folder (Mac Studio), unchanged
  Zoom Video Transfer/                    the transcript tool (Mac Studio), unchanged
  Unedited Video/
    Mac Studio/                           drop a raw video here to have the Mac Studio import it
    Sallie's laptop/                      drop a raw video here to have her laptop import it
  Episodes/
    2026-10-14 Pricing talk/              one folder for each video imported. No Mac watches it
  Unedited Video Transfer/                today's drop folder: retired, left as it is
```

- **Why the names.** They are Jason's own examples. They say whose Mac does the work, so "send it to Jason" means "drop it in `Mac Studio`".
- **Why `Episodes/` is apart from the drop folders.** Episodes from both Macs land in one place, so either Mac finds every episode without knowing which Mac imported it. And a new file in a watched folder starts that Mac's tool (CLAUDE.md). An editing session writes many files: versions, exports, final videos. In a folder nobody watches, it can write them freely.
- **The transcript tool** looks only at what lies directly in its folders, so `Unedited Video/` and `Episodes/` inside its main folder are not taken for recordings. Today's `Unedited Video Transfer/` already sits there the same way. Phase T adds a test that says so.
- **Today's folder.** `Unedited Video Transfer/` stops being watched when phase 1 is installed on the Mac Studio. Its dated folders, among them the two real Zoom recordings of 2026-10-14, stay where they are. `edit.js adopt "<dated folder>"` turns one into an episode by moving it into `Episodes/`, but only when asked.
- **Dropbox must keep `BRIMM VIDEO Transfer` on disk** ("Available offline") on both Macs. A file left online-only stalls ffmpeg and Final Cut on their first read. This is a setup step (section 6).

### What each Mac watches

| Launch agent | Mac Studio | Sallie's laptop |
|---|---|---|
| `com.thebrimm.unedited` | `Unedited Video/Mac Studio/` | `Unedited Video/Sallie's laptop/` |
| `com.thebrimm.transcribe` (after phase T) | the main folder and `Zoom Video Transfer/`, as today | none |

The installer takes the Mac's name: `./install.sh --machine "Sallie's laptop" "<BRIMM VIDEO Transfer>"`. It derives the drop folder from that name and writes the Mac's settings to `~/Library/Application Support/BRIMM Video/settings.json`: the Mac's name, where `BRIMM VIDEO Transfer` is on this Mac, and the library folder. The editing commands read that file to find `Episodes/`. The two Macs' paths into Dropbox differ, and this file is the one place each Mac's path is kept.

**The guard against importing a video twice.** The installer leaves `.brimm-watched-by` in the drop folder it watches, holding the Mac's name. It refuses to watch a drop folder whose marker names another Mac. The marker is not a video, so the tool never takes it. Writing it wakes the launch agent once, which finds nothing waiting. (Each Mac's lock lives in its own temp folder, so locks cannot stop two Macs working one folder. Jason settled this on 2026-10-14: one folder for each Mac.)

### What the import writes, and where

The import is today's `unedited.js --watch` with three changes:

1. It files the video and everything made of it into `Episodes/<date> <video's name>/` instead of a dated folder inside the drop folder. The date is the day of the import. A second video of the same name and day gets `-2`, as today.
2. It writes `episode.json` (below), with the video's name as a placeholder for the episode's name.
3. The Reels are lightweight (section 3), and the Final Cut file names its video by a relative path and names no library (section 2).

Inside an episode folder:

```
2026-10-14 Pricing talk/
  episode.json                            the edit record: name, title, claim, presets, cuts, words on screen, Reels
  Pricing talk.mp4                        the raw video
  Pricing talk.srt, .transcript.txt, .words.json, .cut-plan.json, .cut-plan.txt, .edit-notes.txt
  Pricing talk.rough-cut.mp4, .rough-cut.srt, .rough-cut.transcript.txt, .rough-cut.vertical.mp4
  Pricing talk.fcpxml                     the rough cut as today, now portable
  reels.json                              the Reel candidates
  previews/  Pricing talk.reel-1.preview.mp4 …
  media/                                  brand files and anything added to a project, so they travel with it
  edit/      Pricing talk.main.v1.fcpxml, Pricing talk.reel-2.v1.fcpxml …   what brimm-video pushed
             from-final-cut/                                              Cmd-E exports go here
  final/     the videos Shared from Final Cut, the final transcripts, the hand-off file
```

The import's files keep today's names, so the code that makes them barely changes. Only `final/` holds what anyone outside brimm-video needs.

### `episode.json`, the edit record

It holds everything brimm-video has decided for the episode, so that either Mac can rebuild every timeline from it. It is written whole, to a temporary name that is then renamed, so Dropbox never syncs half a file.

```json
{
  "version": 1,
  "video": "Pricing talk.mp4",
  "imported": { "on": "Mac Studio", "at": "2026-10-14T09:12:00-05:00" },
  "name": { "text": "Pricing talk", "placeholder": true },
  "title": { "text": "Price like you mean it", "from": "claude", "approved": false },
  "editing": { "by": "Sallie's laptop", "since": "2026-10-14T13:40:00-05:00" },
  "spellings": [["Sally", "Sallie"]],
  "main": {
    "preset": { "job": "full-episode", "captions": "file-only", "look": "natural" },
    "cuts": [{ "from": 731.2, "to": 744.9, "keep": true, "why": "Sallie: keep the Hormozi story" }],
    "texts": [{ "id": "t1", "kind": "lower-third", "words": ["Sallie Ogden", "Founder, The BRIMM"], "at": 3.0, "for": 4 }],
    "logo": false,
    "pushed": [{ "v": 1, "at": "…", "file": "edit/Pricing talk.main.v1.fcpxml" }],
    "base": null
  },
  "reels": [{ "n": 2, "status": "picked", "from": 312.4, "to": 354.5, "title": { "text": "Stop discounting your best work", "approved": true }, "preset": { "job": "solo-clip", "captions": "plain", "look": "natural" }, "texts": [], "pushed": [], "base": null }],
  "finished": null
}
```

Every time is in seconds of the raw video. `base` is null while brimm-video builds the timeline from this record, and names the Final Cut export it layers on once one has been pulled (section 4).

### Picking an episode up

- `edit.js episodes` lists the folders in `Episodes/`: name, date, which Mac imported it, who is editing and since when, which Reels are picked, and whether it is finished.
- `edit.js open "<episode>"` claims it for this Mac (`editing` above). When another Mac holds the claim, it says which Mac and since when, and asks before taking it over. Taking over carries only what that Mac pushed or exported, so the skill asks whether a Cmd-E was done there.
- `edit.js release` lets the claim go. `finish` lets it go too.
- The claim is a courtesy, not a lock. Dropbox has no locks. When both Macs write `episode.json` at once, Dropbox keeps both as a "conflicted copy". Every command looks for such a copy first and stops, naming both files, until one is deleted by hand.

### The episode's name

The import uses the video's file name as the placeholder. Naming the file before it is dropped therefore names the episode. The first `open` of an episode whose name is still a placeholder asks for the name: "What is this episode called? For now it is 'Pricing talk'." `edit.js name "<episode>" "<name>"` records it and renames the episode folder once, to `<date> <name>`, refusing while another Mac holds the claim. After that the folder keeps its name. Projects, final videos and the hand-off are named by the episode's name.

## 2. Paths across Macs

**The problem.** Today's `.fcpxml` names the video by its absolute path on the Mac that made it. Each Mac's path into Dropbox is different: Jason's runs through `~/Library/CloudStorage/Dropbox-Ogden28.5/Jason Ogden/The BRIMM DB/`, and Sallie's will run through her own home folder. So on the other Mac the clips show as missing. The file also names its library by an absolute path in the home folder of the Mac that wrote it.

**The design, in three parts.**

1. **brimm-video writes media paths relative to the timeline file.** Apple's documentation says a `media-rep` `src` may be a URL relative to the FCPXML file itself (`report-fcp.md`, from Apple's `media-rep` page). A timeline in `edit/` names its video `../Pricing%20talk.mp4`. It then opens unchanged on either Mac and survives the episode folder's one rename. *Not confirmed in Final Cut Pro 12.4:* phase 0 tries it. If it fails, part 2 is used for every push as well, and nothing else changes.
2. **Exports from Final Cut are localised before import.** Final Cut always exports absolute paths, those of the Mac that exported. Before an export goes into Final Cut on this Mac, every `media-rep src` that points inside an episode folder (the part of the path up to `/Episodes/<episode folder>/`) is rewritten to this Mac's path to the same episode folder. A path outside the episode folder (music or b-roll from elsewhere) is left as it is, and `open` and `push` list it: "not in the episode folder, so the other Mac cannot find it: copy it into `media/`". This is a rewrite of one attribute and does not change the timeline in any other way.
3. **Brand files travel in the episode.** A logo picture or any other file brimm-video places is copied into the episode's `media/` first, so it is found through part 1. BRIMM's Motion templates are not files of the episode. A timeline names them by template, and each Mac has them installed (section 6).

**The library.** It is never in Dropbox and never travels. Final Cut cannot keep a library in a folder that syncs, and on the Mac Studio `~/Movies` is in Dropbox. Each Mac makes **one library for each episode**: `~/BRIMM Video Work/<episode folder>.fcpbundle`, holding one event named for the episode. The file in Dropbox never names a library. `push` adds this Mac's library to the copy it hands Final Cut, in `import-options`, so Final Cut imports with no question asked (today's tool does this, and the MCP server's author reports the same on 12.2). Why one library for each episode: its render files and optimised media for that episode are all in one place, and deleting the library after the hand-off frees that space and loses nothing, because the episode folder holds every timeline. Media are linked where they are, not copied into the library, which is what today's files do.

**Projects in the library.** Each push makes a new project, and nothing is written over: `Pricing talk main v3`, `Pricing talk reel 2 v1`. Earlier versions stay in the library to compare with. Importing a second file into the same library and event: *not confirmed* that Final Cut reuses the media it already has without asking. Phase 0 tries it. Today's tool leaves `uid` off assets, which is the documented way to avoid "media already exists with a different unique identifier".

## 3. Lightweight Reels on import

**Today** each of up to five clips is cut whole, upright at 1080x1920, with its `.srt`. A clip of over a minute is also cut into Story parts. The size fix brought a clip from a Zoom recording from 40–78 MB down to 3.5–6.8 MB. But every clip is still one full ffmpeg pass over the whole video, plus one for each Story part, for clips that will mostly be thrown away.

**On import, from now on:**

- Claude picks up to five candidates as today, with a hook for each (at most eight words), which becomes the Reel's recommended on-screen title.
- Each candidate is written into `reels.json`: its number, its times and kept ranges on the raw video's clock, the crop for each range found by the face finder, its recommended title, Claude's reason, its length and whether that fits a Reel, and its words as text to read.
- Each candidate gets one **preview**, `previews/<name>.reel-<n>.preview.mp4`: upright 540x960, cropped on the face as today, written by x264 at `-preset veryfast -crf 30` with sound at 96 kbit/s, no captions. It exists only for watching and choosing, on a phone in the Dropbox app if she likes. It has a quarter of a full clip's pixels and a faster setting. How much time and space that saves is *not measured*: phase 3 measures it on a 2026-10-14 recording.
- **Not made on import:** a full-size clip, Story parts, and a caption file for each Reel.
- **Made on import as today:** the rough cut and the upright rough cut, both with the size fix.
- `--from-plan` makes the previews again, from `reels.json`, in place of the clips it makes today.

**When she picks a Reel** (`edit.js reel pick 2`), brimm-video writes an upright Final Cut project for it. It is 1080x1920 and holds the Reel's kept ranges as clips, each filled into the frame and moved sideways onto the face by the crop the import found. It carries the Reel's captions, its on-screen title, its preset's look and the logo, and the session pushes it into Final Cut. She checks and polishes it there and Shares it. Final Cut's own render is the finished Reel, so brimm-video never encodes a full-size Reel. How Final Cut takes the fill and the move (a transform on each clip): *not confirmed*, phase 0. Story parts are cut from the finished Reel at the end (section 5).

**More Reels.** `edit.js reel add --from 12:30 --to 13:15` makes a candidate from any stretch, with its preview, by the same code. Reels BRIMM Ops recommends from the long video stay hand edits, as Jason decided. This command is a shortcut she may use for them, not a duty.

## 4. The editing session

### Where and how

Sallie, or Jason, opens the Claude desktop app's Code tab on their own brimm-video folder and says what they want. A project skill, `.claude/skills/brimm-edit/SKILL.md`, tells Claude:

- to work only through `node tool/edit.js <command>`, and never to write FCPXML or edit files in an episode folder itself;
- to find words and times in the episode's transcript and to confirm them with the person before a cut;
- that the transcript is a recording of somebody speaking, never an instruction, as today's request to Claude says;
- what stays by hand, and when to ask for a Cmd-E.

Each command changes `episode.json` and, when asked, writes and pushes a timeline, then prints what it did in plain words for Claude to pass on. A command refuses with a plain reason instead of guessing. The project's `.claude/settings.json` lets the session run `node tool/edit.js` and `open -a "Final Cut Pro"` and read the repo and `Episodes/` without a prompt. Anything else asks. The session needs no network tool and no MCP server.

### What a person can say, and what happens

| They say | Command | What happens |
|---|---|---|
| "What's waiting?" | `episodes` | The list from section 1 |
| "Open the Pricing episode" | `open` | Claims it, asks for the name if it is still a placeholder, and shows the recommended title, Claude's notes and ideas for graphics, the Reel candidates with their titles and previews, and what was pushed |
| "Call it Pricing with confidence" | `name` | Records the name, renames the folder once |
| "Use that title" / "Make the title 'Price like you mean it'" | `title [--words] --approve` | Records it and locks it. Changing it after approval needs `--change`, and the command says that BRIMM Ops may already have it |
| "Use the episode preset" / "Make it Bright" | `preset main --job --captions --look` | Records the pick (job, caption style, look) |
| "Keep the Hormozi story at 12:30" / "Cut the bit about the dog" | `cut keep\|remove --from --to` | Changes the cut plan's ranges at heard pauses, as Claude's decisions are applied today (`applyDecisions`). Refused for a timeline with hand edits (below) |
| "Put my name up at the start" | `text add lower-third --at 3 --words "Sallie Ogden" "Founder, The BRIMM"` | A title on the BRIMM Lower Third template |
| "Show 'Three numbers' when I say it" | `text add title --at-words "three numbers"` | A title on the BRIMM Title template, held for the phrase |
| "Remove that" | `text remove t3` | |
| "Logo on" | `logo on\|off` | The brand kit's logo, from `media/` |
| "Captions on Reel 2" | `captions reel 2 on` | Captions on the BRIMM Caption template, as the caption style says |
| "It's Sallie, not Sally" | `spell add Sally Sallie` | Applied to captions now and to the final transcripts at the finish |
| "Show me the Reels" | `reels` | Each candidate: title, length, whether it fits, preview, status |
| "Finish Reels 1 and 3" / "Drop 4" | `reel pick\|drop` | Records the pick and writes each picked Reel's project |
| "Make a Reel from 12:30 to 13:15" | `reel add` | A new candidate with a preview |
| "Show it in Final Cut" | `push main\|reel <n>` | Writes `edit/<name>.<main\|reel-n>.v<k>.fcpxml`, adds this Mac's library, and runs `open -a "Final Cut Pro" <file>`. Final Cut imports it as a new project |
| "I changed it by hand, and exported" | `pull` | Takes the newest export in `edit/from-final-cut/` as the base for that timeline (below) |
| "Hand it to Jason" | `release` | Lets the claim go and reminds them to Cmd-E first if anything was changed by hand |
| "Finish the episode" | `finish` | Section 5 |

### Hand edits: layering on exports (Jason's answer 2)

Each timeline (the main video, each picked Reel) is in one of two states:

- **brimm-video's own** (`base` is null). Every push rebuilds it from `episode.json`, and every command can change it.
- **Hand-edited** (`base` names an export). The person changed it in Final Cut and pressed Cmd-E into `edit/from-final-cut/`, and `pull` took that export as the base. From then on:
  - **Cut changes are refused** for that timeline: "Make that cut by hand in Final Cut, or start again from brimm-video's version 3 without the hand edits (`reset main`)."
  - **Layer changes are made on the export.** brimm-video reads it, leaves alone every element it does not own, and changes only its own. A text whose record has not changed since the export is left exactly as the export has it, so a title moved by hand stays where it was put. A changed text is replaced, a removed one is taken out, and a new one is added. Captions are made again from the words, through the export's clips, because hand trims change which words are heard. So a caption corrected by hand in Final Cut is lost at the next layering. The skill says to correct words with `spell` instead.
  - The result is pushed as a new version, like any other.

**What brimm-video owns** in a timeline: titles on a role of its own, `BRIMM titles` or `BRIMM captions`, with the record's id in the title's name ("t3 · Three numbers"); the look's filter, by its effect's name; the logo's still, on the `BRIMM titles` role. A side effect is that the person can switch all captions off or on by role in Final Cut's timeline index. How Final Cut writes a custom role on a title in an export: *not confirmed*, phase 0.

**Placing by the raw video's clock.** Every text, caption and word is kept in seconds of the raw video. To place one on a timeline, brimm-video reads that timeline's primary storyline: each clip of the raw video gives its start in the video, its length and where it sits on the timeline. A title is connected to the clip that holds its moment, at the moment's own time inside that clip, which is how FCPXML places a connected clip. So a hand trim carries titles with their clips. A word inside something brimm-video does not read (a compound clip, a multicam clip, a speed change, a transition) is left without a caption, and the command lists those stretches: "not captioned: 0:41–0:45, inside a compound clip".

**Passing everything else through.** The export is read into a tree of elements and attributes and written out again with everything brimm-video does not own unchanged, in order. The test (phase 5) is that an export layered with no changes comes out byte for byte the same apart from brimm-video's own elements. FCP 12.4 may export a `.fcpxmld` bundle (a folder holding `Info.fcpxml`) as well as a plain `.fcpxml`, and both are read.

**Carrying an edit to the other Mac.** Before `release`, press Cmd-E into `edit/from-final-cut/`. On the other Mac, `open` sees an export newer than the last push and offers to pull it. The paths are localised (section 2), and it is pushed into that Mac's library as `… v<k> (from Mac Studio)`. Hand edits travel this way. Without the export, only what brimm-video pushed travels.

### What brimm-video writes for Final Cut

- **Titles and captions name BRIMM Motion templates**, made once by hand in Motion. They are kept in the repo (`brand/final-cut/`) and installed on each Mac in `~/Movies/Motion Templates.localized/Titles.localized/BRIMM/`. The first four are BRIMM Caption (the Plain caption style), BRIMM Hook (the top-band headline of a Reel), BRIMM Lower Third (name and role) and BRIMM Title (a line of words on screen). Each publishes only its words. Its typeface, size, colours and place, upright and wide, are fixed in the template from the brand kit, so a template is a caption style made once. Bold, Boxed, Signature and the steps card come later, as in the presets research's order. Until the BRIMM templates exist, the same commands use Final Cut's built-in Basic Title, Basic Lower Third and Subtitle, so phase 4 does not wait on design work. How Final Cut names a custom template in a file (its `uid`): *not confirmed*, phase 0.
- **The caption route.** The presets research recommended captions drawn by the tool (a Swift script drawing caption pictures, which ffmpeg lays over) for the tool's own finished files, and Final Cut's captions by hand at first (its 4.2, routes 3 and 1). That suited a tool whose own files were the finished videos. Now Final Cut renders every finished video, so the words must be in the Final Cut project, and editable there. **Recommended: route 2, titles in the FCPXML, one for each caption, on the BRIMM Caption template.** Route 1 stays as a hand fallback. Route 3 is not built, the previews carry no captions, and ffmpeg-full is not needed. The research's caption builder is still built, to group words into captions under the caption style's limits, now with Final Cut titles as its output. The full episode has no captions drawn (its caption style is File only). Its `.srt` comes from the finish.
- **Looks.** An effect on each clip of the raw video that names one of Final Cut's Color Grading Presets with its Mix, as in the presets research (E4). The Mix written is the look's Mix times its strength times rule 6's share.
- **The logo.** The brand kit's logo picture, copied into `media/`, as a connected still in the brand kit's corner, size and place for the frame. Which mark is a setting in `brand/brand.json`, as Jason decided.
- **Graphics ideas** stay markers, as today.
- **Upright Reels** are a second format (1080x1920) and more than one project. The writer learns both, and so does its checker, which today reads only the first project in a file.

### How it reaches Final Cut

`push` runs `open -a "Final Cut Pro" <file>`, which is the same as double-clicking it. With the library named in `import-options`, Final Cut imports with no question. The first push on a Mac may bring up a macOS permission prompt. The unattended import never opens Final Cut. Only a person's push in a session does, so today's rule that the tool never opens Final Cut by itself stays true for the import.

### Build on `fcpxml.js`; do not adopt the FCPXML MCP server

`DareDev256/fcp-mcp-server` (MIT, read on 2026-10-14: version 0.26.0 of 2026-10-09, alpha by its own label, Python 3.10 or later, 102 operations, 124 stars, first published 2026-01-18) is a general toolbox for having Claude edit exported timelines. It is well tested by its own count and careful about safety. It is not the right base here:

- **brimm-video's work is narrow and its own:** BRIMM templates, presets, Reels from a cut plan, words on the raw video's clock, layering by role. The MCP server knows none of this, so the same code would be written anyway, on top of a second language and a second model of FCPXML.
- **It adds installs on both Macs:** Python, pip and the `mcp` SDK. The SDK's 2.0 release of 2026-07-28 removed the API the server was built on, and the server now works around that with a shim. It went from first release to 0.26 in nine months. This repo runs on Node with no packages, and every install needs Jason's yes.
- **Its surface is wide:** 102 operations in Sallie's session, including transcription through ElevenLabs and paid generative fill. Both send data off the Mac, though only when a key is set. brimm-video's rule is that the video never leaves the Mac.
- **Claude would edit timelines through general operations,** where brimm-video's commands are tested for its own cases and refuse what they do not understand.

**What to borrow from it:** its findings, that an Open Document push with a library location imports with no click and that no route exports a timeline from Final Cut; reading `.fcpxmld` bundles; a guard that refuses to write over a file that changed since it was read; and checking files against Apple's DTD before a push, on a Mac that has Final Cut (not in CI). Where the DTD is found on a Mac is *not confirmed*.

### What stays by hand

- **Share (render) from Final Cut** into the episode's `final/`. Apple offers no way to make Final Cut export a video.
- **Cmd-E (Export XML)** after hand edits, and before handing an edit in progress to the other Mac. It is not needed at the finish.
- **Checking every cut, caption and crop by eye.** Claude reads words and never sees the picture.
- Fine trims, b-roll, music, judging a look on her own footage, a speaker's name in an interview, thumbnails, and posting. The tool never posts.
- Deleting an episode's library once the hand-off is done.

## 5. The finish: from the final edit to the hand-off file

1. **She Shares the finished videos into `final/`.** Final Cut names a Shared file after its project by default, so the main video comes out as `Pricing with confidence main v5.mp4` and a Reel as `Pricing with confidence reel 2 v1.mp4`. *Not confirmed* that the default name is the project's, phase 0.
2. **`finish` lists what it found** and what each file is taken for: the main video, or Reel *n*. It reads each name's "main" or "reel *n*" and takes the newest version, and asks before going on. More than one file for one part, or a picked Reel with no file, is said in plain words. She can name a file for a part by hand.
3. **Each finished video is transcribed again on this Mac** (Jason's answer 1), with the transcriber and the word pass the import uses: the silence filter, the show's spellings and the episode's own `spellings`. This writes, in `final/`, `<Episode> main.srt`, `<Episode> main.transcript.txt` and `<Episode> main.words.json`, and the same for each Reel. The times are those of the finished file, so they match what is posted by construction, after any hand trim, and BRIMM Ops can write chapters from them. It costs one transcription per finished video. Not measured on an hour: the whole import of a 5.5-minute recording took 44 s on the Mac Studio, and her M4 is not measured at all.
4. **Checks**, each said and none refusing: the last word ends before the file does; the file's length is within a second of the length of the last version pushed for that part, which catches a file taken for the wrong part; a Reel outside 15 to 90 s is named.
5. **Story parts.** A finished Reel whose job goes to Stories is cut into parts of at most 60 s. Each cut falls on the last pause before the 60-second mark, found from the Reel's own new word times, by today's `storyParts`. The parts are written by x264 at quality 23 (`encodeArgs`). Their captions are already in the picture, drawn by Final Cut, and they get no caption file, because Stories take none.
6. **The hand-off file** `final/<Episode>.brimm-ops.json` is written (below).
7. The claim is let go, and `episode.json` records `finished` with the hand-off's name and time.

### The three transcript gaps the peer session raised (passed on at Jason's request)

1. **Story parts have no captions.** They do not need any of their own. A Story part is cut from a finished Reel whose captions Final Cut drew into the picture. If a caption file for a part is ever wanted, it is cut from the finished Reel's new word times, on the part's own clock, and never by squeezing the rough cut's captions.
2. **Word-by-word captions need word times on the edit's clock.** While editing, a word's time on a Reel's or the main video's timeline comes from `words.json`, mapped through that timeline's clips (section 4, "placing by the raw video's clock"). This is how brimm-video places the BRIMM Caption titles, and how a stressed word in Bold would be timed. It is as close as the transcriber's word times: a tenth to a third of a second, with phrase ends on heard pauses. After the finish, the hand-off uses the new transcription's own word times. Animated captions that light up one word at a time inside one title are not designed here. They would need a Motion template built for them.
3. **A video trimmed later in Final Cut makes its `.srt` stale.** Settled by item 3 above: every finished video, the main one and each Reel, is transcribed again from the file that is posted. No `.srt` from the import goes to BRIMM Ops.

### The hand-off file, version 1

One file, read by the BRIMM Ops page in one drop. JSON, UTF-8.

```json
{
  "format": "brimm-video hand-off",
  "version": 1,
  "made": "2026-10-20T15:02:11-05:00",
  "madeOn": "Sallie's laptop",
  "madeBy": "brimm-video c709b57",
  "episode": {
    "name": "Pricing with confidence",
    "recorded": "2026-10-14",
    "title": "Price like you mean it"
  },
  "main": {
    "file": "Pricing with confidence main v5.mp4",
    "seconds": 1834.27,
    "srt": "1\n00:00:00,000 --> 00:00:03,120\nToday we're talking about pricing.\n\n2\n…"
  },
  "reels": [
    {
      "n": 2,
      "title": "Stop discounting your best work",
      "file": "Pricing with confidence reel 2 v1.mp4",
      "seconds": 42.1,
      "inMain": { "start": 312.4, "end": 354.5 },
      "srt": "1\n00:00:00,000 --> 00:00:02,480\nStop discounting\n\n…"
    }
  ]
}
```

- `episode.title` is the approved on-screen title of the main video, and a Reel's `title` is its approved on-screen title. Both are what is shown in the picture, which BRIMM Ops does not change.
- `srt` is the whole caption file as text, in the form the transcript tool writes today (numbered blocks, `HH:MM:SS,mmm --> HH:MM:SS,mmm`, lines of up to 60 characters), so the page reads it with its own `tidyTranscript`, unchanged. Its times match the posted video: for the page that means "a transcript of the final cut" whose stamps "match the published video" (its `SOURCES.final_cut` and `STAMPS.published`).
- `seconds` is the finished file's length. `inMain` is where the Reel's words are in the finished main video, so BRIMM Ops can say "from 5:12 of the episode". It is found by matching the Reel's new words, in order, in the main video's new words. It is given only when the whole Reel is found there, and otherwise left out.
- `reels` holds only finished Reels, in number order, and may be empty.
- An hour's `.srt` is about 60,000 to 90,000 characters (arithmetic, at 150 words a minute, not measured). The page takes up to 200,000 for one transcript (`MAX_CHARS`).
- **The contract.** brimm-video keeps `tool/tests/fixtures/handoff-v1.json`, made from the made-up recording. One test writes it from fixtures and compares. Another reads each `srt` in it with `tool/shared/transcript.js`, the page's own code copied as today, and checks the captions it gives. brimm-operations copies the same fixture for its L7 test. A field may be added without a new version, and the page ignores what it does not know. Anything else is version 2, with a new fixture in both repos.

## 6. Setup on Sallie's laptop

Every item that installs something or changes the laptop is done only after Jason's yes in chat. The installer is first run with `--print`, which changes nothing, and its output is read with him. Jason does the setup with her, in person or by screen sharing.

| # | What | Why | How |
|---|---|---|---|
| 1 | macOS new enough for Final Cut Pro 12.4 | Final Cut asks for it | Apple's spec page says macOS 15.6 or later (not confirmed that this is 12.4's floor). Check before anything else |
| 2 | Final Cut Pro | The editor | Jason installs it (bought, or shared by Family Sharing) |
| 3 | Dropbox: `The BRIMM DB` shared with her, `BRIMM VIDEO Transfer` set to Available offline, room on the disk | The drop folder and the episodes | In Dropbox's own settings |
| 4 | Xcode command line tools | `git` for the code, `swift` for the face finder | `xcode-select --install` |
| 5 | Homebrew | Installs the programs below | Its own installer. It needs her password, which she types herself |
| 6 | Node 22 or later, ffmpeg, whisper-cpp | The tool | The installer, with Homebrew |
| 7 | The transcriber's model, about 1.6 GB | Transcripts | The installer downloads it once |
| 8 | Claude: the desktop app signed in to her account, and the `claude` command | The editing session, and the import's unattended read of the cut plan | Claude's own installers. The installer checks that `claude` is where the launch agent looks, and does not install it. Her plan pays for her use |
| 9 | brimm-video | The code | `git clone` with a read-only deploy key made for this laptop (Jason's answer 3), into `~/Claude Code/BRIMM video`, kept on `main`. Updates are `git pull`. The key can be revoked alone |
| 10 | The typefaces | The brand in titles and captions | Whatever Jason buys, licensed for two users (or Adobe Fonts on her own account). Until then, the stand-in the presets research names (Varela, then Lucida Grande) |
| 11 | BRIMM Motion templates | Titles and captions | The installer copies `brand/final-cut/` into `~/Movies/Motion Templates.localized/Titles.localized/BRIMM/` |
| 12 | The launch agent | Imports what she drops | `./install.sh --machine "Sallie's laptop" "<her path to BRIMM VIDEO Transfer>"` |
| 13 | macOS permissions | node must read the Dropbox folder, and the first push may ask about Final Cut | System Settings, Privacy & Security, when macOS asks |
| 14 | `~/BRIMM Video Work/` | The episodes' libraries | Made by the first push |

The Mac Studio needs items 11 and 12 too (with `--machine "Mac Studio"`), and later phase T. Each is again a yes from Jason.

**16 GB.** The transcriber and Final Cut together may be slow on her laptop. A drop that imports while she edits in Final Cut will compete with it. *Not measured.* Phase 1 measures one import on her laptop.

## 7. Phases, smallest useful first

Every phase follows CLAUDE.md: a failing test first, then the code. No test calls the real `claude`, and stand-ins answer for ffmpeg, the transcriber, `open` and Final Cut. The installer is only ever run with `--print` in a test. Nothing writes into a watched folder.

| Phase | What it builds | Why here | Tested by |
|---|---|---|---|
| **0. Final Cut facts** (by hand, about 30 minutes, on the Mac Studio) | Nothing in code. Jason builds the presets research's test project (its 4.5) and also tries: a media path relative to the file; a second import into the same library and event; a title from a throwaway template in a custom Motion folder; a custom role on a title; a still with a transform; an upright project of a wide clip filled and moved sideways; Cmd-E (plain file or bundle); the default name Share gives | Every "not confirmed" above is settled by one export. The writer copies what Final Cut itself writes | The exports, of a made-up clip only, are committed as fixtures, and the facts are recorded in this spec |
| **1. Episodes on two Macs** | `Episodes/`, `episode.json`, the claim, the per-Mac settings, a drop folder for each Mac with its marker, `install.sh --machine`, filing into episodes, relative paths and localising, a library per episode, `edit.js episodes\|open\|name\|push\|release\|adopt`, a first skill | The smallest thing that changes how they work: drop on either Mac, open the episode on either Mac, see it in Final Cut | Unit tests for filing, naming, the marker refusal, localising the phase 0 exports, library naming, the claim and conflicted copies; `install.sh --print` for each Mac's name, apostrophe included. Then the Mac Studio install (Jason's yes), Sallie's laptop setup (section 6), and one real recording dropped on each Mac |
| **2. Finish and hand-off** | `finish`, transcribing the videos in `final/` again, `spellings`, Story parts from finished Reels, `handoff-v1.json` and its contract | It needs no new editing: once the videos are edited by hand in Final Cut, BRIMM Ops gets final transcripts that match. It unblocks L7 | A stand-in transcriber; the fixture; `tidyTranscript` on every `srt`; matching files to parts; Story cuts at pauses |
| **3. Lightweight Reels** | `reels.json`, previews, no full encodes or Story parts on import, `reels`, `reel pick\|drop\|add`, the upright Reel project | Import gets lighter, and picked Reels are finished in Final Cut | Preview ffmpeg arguments; `reels.json`; a Reel project's shape against the phase 0 fixture; the checker on two projects and a second format; `--from-plan` making previews. Measured: preview time and size on a 2026-10-14 recording |
| **4. The session's commands** | `title` (recommended at import: one key added to the request to Claude), `cut`, `text`, `logo`, `captions` (built-in templates first), `spell`, `preset` with the caption builder, and the skill in full | Sallie directs edits in words | Each command on fixtures: what `episode.json` becomes, what the timeline holds, every refusal. One full session by hand on a made-up recording |
| **5. Layering on exports** | `pull`, the export reader and writer that passes everything through, ownership by role and id, captions through the export's clips, `reset`, carrying an edit between Macs | Hand edits and brimm-video's layers live together, which was Jason's answer 2 | The phase 0 exports layered with no change come out the same; owned elements replaced; cut commands refused; a word inside a compound clip listed |
| **6. Brand presets** | `brand/brand.json`, the four BRIMM templates (made by hand in Motion, by Jason or the editor Sallie hires), presets on the Final Cut route in the presets research's order, the looks, the logo | It waits on the typefaces Jason buys, the logo files, and design time in Motion | The research's rules as unit tests; the templates found on the Mac before a push; one Reel per preset checked by eye |
| **7. Claude chat** (later, maybe) | A local MCP server that offers the same `edit.js` commands to Claude chat | Only if the Code tab is not enough for Sallie | Not designed now |
| **T. The transcript tool moves in** (any time after 1) | `transcribe.js` moves to `tool/` beside `unedited.js`. The parts copied into `tool/lib.js` and `tool/run.js` become the originals again, and the copies' notes go. `localDay` comes from `tool/shared/text.js`. The agent `com.thebrimm.transcribe` keeps its label and its folders, on the Mac Studio only, and is pointed at this repo by its installer (Jason's yes). brimm-operations removes `transcribe/` in a session there | BRIMM Ops becomes the page alone, as Jason decided | Its own tests, moved and passing here. **A contract test on the `.srt`:** a fixture `.srt` the tool writes is read by `tool/shared/transcript.js` (the page's `tidyTranscript`, copied) and gives the expected lines. The same fixture goes into brimm-operations, and it replaces the code shared today. A test that the tool ignores `Unedited Video/` and `Episodes/`. `install.sh --print` shows the agent pointing here |

## Errors, in plain words

- **Import** fails as today: the cut plan's first lines say what was not made, and the episode is still filed.
- **A command refuses** rather than guessing. It refuses for a claim held elsewhere, a conflicted copy, a cut on a hand-edited timeline, a time outside the video, a missing template (looked for in the Motion Templates folder before a push, so Final Cut never shows "Missing Effect"), media outside the episode folder, and no export to pull.
- **Finish** asks before it acts when files are missing or more than one file fits a part. It says, but does not refuse, when a length differs from the last version pushed.

## Not designed here

- Which typefaces to buy, and where (still open).
- Whether the logo's `.png` files may be copied beside the tool (still open). Phase 6 needs them.
- Who makes the BRIMM Motion templates: Jason, or the editor Sallie hires.
- An outside editor working on a third Mac. The episode folder and a Cmd-E would carry the work, but nothing here sets that Mac up.
- The page's side of the hand-off (brimm-operations L7).
- `docs/requirements.md` and CLAUDE.md still say the editor is an open decision. Bring them up to date when this design is approved.
