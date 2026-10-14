# Unedited video: the research

Written on 2026-10-13, before the unedited-video tool was built. Jason asked whether the product sold at paid.tenfoldmarketing.com/claude-creator-studio could be recreated here, and which parts would stay manual. These are the reports that answered him. They are kept as they were written. What has changed since is at the end of this page.

| File | What it is |
|---|---|
| `report-seller.md` | What Claude Creator Studio is, what it does and does not do, its price and its terms |
| `report-fcp.md` | Whether a Final Cut Pro project file can be written from here, and what such a file can hold |
| `report-cutting.md` | How retakes, false starts and pauses can be found from a transcript with a time for every word |
| `report-fit.md` | How the work fits this repo, the transcript tool and BRIMM Ops, and what it would cost in Claude usage |
| `answer-draft.md` | The answer drafted from the four reports: what can be recreated, capability by capability, and what stays manual |
| `skeptic-review.md` | A second reader's check of that draft. Read it beside the draft: it corrects several claims and names cheaper things to try first |

## What stays manual

From the draft and the skeptic's review, and still true after the build:

- Deciding the look. A style such as "moody" means something only after it is defined once: fonts, colours, the caption style, the logo, example videos she likes.
- B-roll. A folder of her own clips, each labelled with what it shows.
- Music, and the right to use it.
- Choosing a take by how it looks. Claude reads the words and never sees the picture.
- Titles and graphics. The tool gives ideas for them, each at a time in the video. Making them is done in Final Cut Pro, or with Motion templates made once.
- The final watch-through, and posting.

## What the skeptic said to try before building

- OpusClip's own connector for Claude, since she already uses OpusClip.
- Descript, which takes out retakes and filler from a transcript.
- The seller's pack itself, at $67, for a finished vertical reel from phone clips.

Jason chose to build. These are here in case the built tool does not earn its keep.

## What has changed since these were written

- The tool is built: `transcribe/unedited.js`, described in the README under "Unedited video".
- A Final Cut Pro project file the tool wrote was opened in Final Cut Pro 12.4 on the Mac Studio on 2026-10-13. The reports say this had not been tried.
- Final Cut Pro cannot keep a library in a folder that syncs, and on the Mac Studio the Movies folder is in Dropbox. The tool's file names a library in `BRIMM Video Work` in the home folder. The reports do not know this.
- The Mac Studio's ffmpeg has no caption filter, so no captions are burned into a video. The tool writes caption files instead.
- Asking Claude from the background tool works, with no key, on the Claude account signed in on the Mac. The fit report left this untested.
- None of it has met real unedited footage yet. Everything was tried on made-up recordings spoken by the Mac's own voice.
