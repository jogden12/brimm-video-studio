# H0 results

Fill in as you go (see docs/phase-h0/checklist.md). Paste what Terminal printed where a step asks for it. A time is the number zsh
prints before the word "total". The pictures and videos stay in `out/`.

## Step 0

- macOS version (Apple menu > About This Mac):
- `node --version`:
- `ffmpeg -version | head -1`:
- `which whisper-cli`:
- The model file is there (yes / no):
- `swift --version | head -1`:
- Creative Cloud signed in, with Adobe Fonts (yes / no):
- The test recording: what it is (camera, app, length), never one of Sallie's:

## Step 2. HyperFrames installed

- `npx hyperframes --version`:
- `npx hyperframes telemetry status`:
- What `npx hyperframes doctor` printed (its last lines, and any line that is not "ok"):

## Step 3. Sweet Sans Pro

- What `swift families.swift sweet` printed:
- The family name used (FAMILY):
- The font check says (FOUND / MISSING), for the family and for Varela:
- Do Light, Regular and Medium look like three different weights? Do they look like the brand guide?
- Second run, if the name differed:

## Step 4. The graphics

- Time of each render: lower third, title card, colour check, lower third with other words:
- `ffprobe` of renders/lower-third.mov:
- `out/lower-third.png` and `out/title-card.png`: right words, right typeface, nothing cut off?
- `out/lower-third-other.png`: the other name and role, in the same design?

## Step 5. The test recording

- `ffprobe` of the original:
- Time of the working copy:

## Step 6. Graphics on the recording

- Time of the overlay pass, and the recording's length:
- Watched: the lower third at 0:02, the title card at 0:10, the colour blocks at 0:16. Anything wrong (a flash, a black edge, a jump)?

## Step 7. Timing and colour

- Lower third's mark, frames 59, 60, 239, 240:
- Title card's mark, frames 299, 300, 419, 420:
- Navy, sand, mist (frame 510), and the lower third's panel (frame 120):

## Step 8. The Reel

- Time of whisper-cli:
- What `hyperframes transcribe` printed:
- `npx hyperframes lint`:
- Time of the Reel's render:
- Watched: captions in step with the words (early, late, right)? The crop? The title and the end card? The sound?

## Step 9 (optional). 4K

- Time of the 4K lower third:

## Step 10 (optional). Final Cut

- Does the lower third show over the recording, with the recording seen around it?

## Anything else

- Anything that surprised you, or any message in Terminal you did not expect, word for word:
