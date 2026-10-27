# H0: the render test, a checklist for Jason

**Stopped after step 4, on 2026-10-27** (Jason). Steps 5 to 8 test brimm-video's own renderer, which the accepted design of 2026-10-27 drops: the HyperFrames app renders instead. What steps 0 to 4 showed still stands: HyperFrames runs on the Mac Studio, and Josefin Sans works in it. The next test is A0, `docs/phase-a0/checklist.md`.

For Jason, on the Mac Studio. It is the gate of the architecture of 2026-10-26 (`docs/superpowers/specs/2026-10-26-claude-video-editing-architecture.md`, section 10, H0; section 11, decisions 1, 2 and 7). It answers four questions before anything is built:

1. **Colour:** does the brand's navy come out as navy once a graphic is laid over a video?
2. **Font:** does the renderer draw the brand typeface in its three weights? Sweet Sans Pro from Adobe Fonts was tried first and came back MISSING, so it is now Josefin Sans from Google Fonts (2026-10-26).
3. **Timing:** does a graphic start and end on exactly the frame it should?
4. **Speed:** how long do the renders take on this Mac?

If colour, timing or speed fail, the Swift drawer of the 2026-10-22 design comes back (decision 1).

**Rules for this test.**

- Use your own test recording only. Never one of Sallie's episodes, and never a client or group session.
- Everything happens in `~/BRIMM Video Work/H0 render test/`. That folder is on this Mac's own disk, not in Dropbox, and nothing watches it.
- Nothing is written into a watched folder or into Dropbox.
- The brimm-video folder stays on `main`. Step 1 only fetches from GitHub and copies files out of it.
- HyperFrames is installed in the test folder only, as you said yes to on 2026-10-26: version pinned, telemetry off, and its Claude skills skipped.
- Install nothing else:
  - `npx hyperframes doctor` suggests extras (Kokoro, MusicGen, Docker, whisper builds). Ignore them.
  - Never run these HyperFrames commands: `init`, `skills`, `auth`, `publish`, `cloud`, `lambda`, `cloudrun` or `feedback`. The test needs none of them, and `publish` and the cloud commands upload the project.

**Time.** About an hour and a half of your attention. The renders take the Mac's time, not yours.

**How to record.** Step 1 makes `results.md` in the test folder, with a place for each step. Paste what Terminal prints where a step asks for it. Pictures and videos stay in the test folder's `out/`, where Claude can look at them later.

**What was tested before you got this.** On 2026-10-26, every command in steps 2 and 4 to 9 ran on a Linux test machine with HyperFrames 0.8.206. That machine used a stand-in recording, a made-up word list, and `libx264` in place of this Mac's `h264_videotoolbox`. Its results are under each step, as "On the test machine", so you can tell a surprise from the expected.

Not tested there, because they need this Mac:

- the VideoToolbox encoder;
- `whisper-cli`;
- the 4K and Final Cut steps on macOS.

---

## Step 0. Before you start (5 minutes)

1. Choose the test recording: one of your own, at least 2 minutes long, with someone talking.
   - Best is one made with the OBSBOT camera the way Sallie's are, or a Zoom recording.
   - Not an iPhone clip in HDR. This test does not convert HDR colour.
2. Open Terminal and check what is already on this Mac:

   ```
   sw_vers -productVersion
   node --version
   ffmpeg -version | head -1
   which whisper-cli
   ls -l "$HOME/Library/Application Support/BRIMM Transcribe/ggml-large-v3-turbo.bin"
   ```

   - `node` must be 22 or later.
   - The other lines must each print something, not "not found". These are the programs brimm-video already uses.

**Record:** each line's answer, and what the test recording is.

---

## Step 1. Make the test folder and copy the files in (5 minutes)

Keep one Terminal window open for the whole test. If you open a new one, run the lines of step 1.1 again first.

1. Set the names the steps use, in Terminal:

   ```
   export HYPERFRAMES_NO_TELEMETRY=1 HYPERFRAMES_SKIP_SKILLS=1
   H0="$HOME/BRIMM Video Work/H0 render test"
   P="$H0/project"
   REPO="$HOME/Claude Code/BRIMM video"
   REF=origin/claude/zealous-bell-esuqck
   FAMILY="Josefin Sans"
   ```

   - **`REPO`** is the brimm-video folder the launch agent runs. Change it if yours is elsewhere.
   - **`REF`** is the branch these files are on. Use `origin/main` once the branch is merged.
   - **The first line** keeps HyperFrames from sending telemetry and from adding Claude skills anywhere.

2. Fetch the branch and copy its `docs/phase-h0/` folder into the test folder. This only fetches: the brimm-video folder stays on `main` and nothing in it changes.

   ```
   mkdir -p "$H0/out"
   git -C "$REPO" fetch origin
   git -C "$REPO" archive "$REF" docs/phase-h0 | tar -x -C "$H0" --strip-components=2
   cp -n "$H0/results-template.md" "$H0/results.md"
   ls "$H0" "$P" "$P/compositions"
   ```

   You should see the following:
   - in `$H0`: `checklist.md`, `out`, `project`, `results-template.md` and `results.md`;
   - in `project`: `brand.css`, `compositions` and `index.html`;
   - in `compositions`: `colour-check.html`, `font-check.html`, `lower-third.html`, `reel.html` and `title-card.html`.

**Record:** nothing, unless something went wrong.

---

## Step 2. Install HyperFrames in the test folder (10 minutes)

1. Install four packages, with their versions pinned, into `project/node_modules` (and nowhere else):
   - HyperFrames 0.8.206;
   - GSAP 3.14.2, which the graphics use to move;
   - Josefin Sans from Google Fonts, as Fontsource packs it: the brand typeface since 2026-10-26;
   - Varela from Google Fonts, the same way. It is the brand guide's own alternate and the control in step 3.

   ```
   cd "$P"
   npm init -y >/dev/null
   npm install --save-exact --no-fund --no-audit hyperframes@0.8.206 gsap@3.14.2 @fontsource/josefin-sans@5.3.0 @fontsource/varela@5.3.0
   npx hyperframes --version
   ```

   It should say `0.8.206`.

2. Turn telemetry off for good, and check it:

   ```
   npx hyperframes telemetry disable
   npx hyperframes telemetry status
   ```

   It should say "Telemetry disabled" and "Tracked commands: 0".

3. Let HyperFrames fetch the Chrome it renders with, then check the setup:

   ```
   npx hyperframes browser ensure
   npx hyperframes doctor
   ```

   - **`browser ensure`** downloads a Chrome for rendering into `~/.cache/hyperframes/chrome/`. It is HyperFrames' own copy, separate from any Chrome you use.
   - **`doctor`** should show ✓ for Version, Node.js, FFmpeg, FFprobe and Chrome. A ✗ on whisper-cpp, TTS, BGM or Docker is expected: this test does not use them through HyperFrames. Install nothing it suggests.

**Record:** the version, the telemetry status, and `doctor`'s lines that are not ✓.
**What it changes:** nothing yet. If `browser ensure` or `doctor` fails on Chrome, stop here and paste what it said into `results.md`.

**On the test machine:** `doctor` showed ✓ for all five; whisper-cpp, TTS, BGM and Docker showed ✗, as expected.

---

## Step 3. Does the renderer draw the brand typeface? (5 minutes)

On 2026-10-26 this step first tried Sweet Sans Pro from Adobe Fonts, and the font check said MISSING: the font never became active on this Mac, not even in TextEdit. You replaced it with **Josefin Sans** from Google Fonts, picked from a sheet of five faces set in the guide's three roles. Step 2 installed its files.

1. Render the font check and look at it:

   ```
   cd "$P"
   npx hyperframes render -c compositions/font-check.html --variables "{\"family\":\"$FAMILY\"}" --output "$H0/out/font-check.mp4"
   ffmpeg -v error -y -ss 1 -i "$H0/out/font-check.mp4" -frames:v 1 "$H0/out/font-check.png"
   open "$H0/out/font-check.png"
   ```

   - **The top line** should be green: "Josefin Sans: FOUND. Varela: FOUND."
   - **Under it,** Light, Regular and Medium should look like three different weights of Josefin Sans.
   - A family that was not found is drawn in a typewriter face on purpose, so it cannot pass for the right one.

**Record:** the top line, and whether the three weights look right.
**What it changes:** FOUND means the brand typeface comes from files the project names, which the renderer finds on any Mac. Sinthya, the guide's script, still needs a replacement, picked by eye the same way, from Google Fonts too.

**On the test machine:** "Josefin Sans: FOUND. Varela: FOUND.", with three distinct weights. With Sweet Sans Pro: "Sweet Sans Pro: MISSING. Varela: FOUND.", as on this Mac.

---

## Step 4. Render the graphics (10 minutes)

Each graphic is its own file, rendered as a ProRes 4444 `.mov` with a transparent background. That is how brimm-video would make them: once per graphic, then laid over the video by ffmpeg.

1. In Terminal:

   ```
   cd "$P"
   mkdir -p renders
   time npx hyperframes render -c compositions/lower-third.html --format mov --variables "{\"family\":\"$FAMILY\"}" --output renders/lower-third.mov
   time npx hyperframes render -c compositions/title-card.html --format mov --variables "{\"family\":\"$FAMILY\"}" --output renders/title-card.mov
   time npx hyperframes render -c compositions/colour-check.html --format mov --output renders/colour-check.mov
   ```

   zsh prints each render's time at the end of a line, before the word "total".

2. The same lower third with other words, the way Claude would fill one in:

   ```
   time npx hyperframes render -c compositions/lower-third.html --format mov --variables "{\"family\":\"$FAMILY\",\"name\":\"Jason Ogden\",\"role\":\"Test, not for use\"}" --output renders/lower-third-other.mov
   ```

3. Check the files and look at them over grey:

   ```
   ffprobe -v error -show_entries stream=codec_name,profile,pix_fmt,nb_frames,color_space -of compact renders/lower-third.mov
   for g in lower-third lower-third-other title-card; do
     ffmpeg -v error -y -f lavfi -i color=c=0x777777:s=1920x1080 -i renders/$g.mov -filter_complex "[0:v][1:v]overlay=shortest=1" -ss 3 -frames:v 1 "$H0/out/$g.png"
   done
   open "$H0/out/lower-third.png" "$H0/out/lower-third-other.png" "$H0/out/title-card.png"
   ```

   - **ffprobe** should say `prores`, `4444`, `yuva444p12le`, `180` frames and `bt709`. The "a" in `yuva` is the transparency.
   - **The pictures:**
     - the lower third: a navy panel, bottom left, with a sand edge, a name in capitals and a role under it;
     - the title card: navy, full frame, with "PART ONE", a sand rule and "THREE PRICING MISTAKES";
     - a small sand square in each top-left corner: the test mark, which step 7 reads.

**Record:**
- the four times;
- the `ffprobe` line;
- whether the words, typeface and layout look right, and whether anything is cut off;
- whether the second lower third shows the other name and role.

**What it changes:** if a 6-second graphic takes minutes, rendering graphics per change is too slow, and H1 must cache harder or render at preview size.

**On the test machine** (four slow cores, no graphics card):
- lower third 14 s;
- title card 12 s;
- colour check 7 s;
- `prores|profile=4444|pix_fmt=yuva444p12le|nb_frames=180|color_space=bt709`.

---

## Step 5. The test recording (5 minutes)

1. Point at your recording and read its facts. Either type its path in quotes, as below, or type `SRC=` and drag the file from Finder into Terminal. A dragged path comes already escaped, so add no quotes around it.

   ```
   SRC="/path/to/your test recording.mov"
   ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,avg_frame_rate,pix_fmt,color_space,color_transfer,color_primaries:format=duration -of compact "$SRC"
   ```

2. Make the working copy, the way brimm-video's intake would: 1080 lines, a constant 30 frames a second, BT.709, at most 3 minutes.

   ```
   mkdir -p "$P/media"
   time ffmpeg -v error -stats -y -i "$SRC" -t 180 -vf "fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1" -c:v h264_videotoolbox -b:v 12M -profile:v high -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -c:a aac -b:a 192k -ar 48000 "$P/media/recording.mp4"
   ```

**Record:** the `ffprobe` line of the original, and the time.
**What it changes:** a different `r_frame_rate` and `avg_frame_rate` mean the original has a variable frame rate. The real intake would then always make a working copy, as here.

---

## Step 6. Lay the graphics over the recording (10 minutes)

This is the renderer's path A in small: one ffmpeg pass that lays each graphic over the video at its time. It needs no `drawtext` or `libass`, which this Mac's ffmpeg lacks.

1. In Terminal (one command, over several lines):

   ```
   cd "$P"
   time ffmpeg -v error -stats -y -i media/recording.mp4 -i renders/lower-third.mov -i renders/title-card.mov -i renders/colour-check.mov \
     -filter_complex "[0:v]setpts=PTS-STARTPTS[base];[1:v]setpts=PTS-STARTPTS+2/TB[lt];[2:v]setpts=PTS-STARTPTS+10/TB[tc];[3:v]setpts=PTS-STARTPTS+16/TB[cc];[base][lt]overlay=eof_action=pass:format=auto[v1];[v1][tc]overlay=eof_action=pass:format=auto[v2];[v2][cc]overlay=eof_action=pass:format=auto,format=yuv420p[v]" \
     -map "[v]" -map 0:a -c:v h264_videotoolbox -b:v 12M -profile:v high -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -c:a copy "$H0/out/main-with-graphics.mp4"
   open "$H0/out/main-with-graphics.mp4"
   ```

2. Watch the first 20 seconds in QuickTime Player:
   - the lower third slides in at 0:02 and out before 0:08;
   - the title card covers the picture from 0:10 to 0:14;
   - three colour blocks (navy, sand, mist) fill the frame from 0:16 to 0:18;
   - the recording plays normally everywhere else, with its sound.

**Record:** the time, the recording's length, and anything wrong: a flash, a black edge, a jump, or sound out of step.
**What it changes:** this is the core of rendering with no one in Final Cut. If it works, H1 builds the render planner around it.

**On the test machine:** 37 s for a 90-second 1080p recording, with three graphics (libx264, four slow cores). VideoToolbox should be much faster.

---

## Step 7. The numbers: timing and colour (5 minutes)

A small command reads one pixel of one frame of the finished video and prints its colour as six letters and numbers, as the brand guide writes colours.

1. Define it:

   ```
   px() { ffmpeg -v error -i "$H0/out/main-with-graphics.mp4" -vf "select=eq(n\,$1),crop=2:2:$2:$3,scale=in_color_matrix=bt709:in_range=tv,format=rgb24" -frames:v 1 -f rawvideo - | od -An -tx1 -N3 | tr -d ' \n'; echo; }
   ```

2. **Timing.** Frame 60 is 2.000 seconds in, where the lower third starts. Its test mark should be absent on frame 59, sand (about `c1ad97`) on frames 60 to 239, and absent again on 240. The title card's mark should be sand on frames 300 to 419 only.

   ```
   px 59 8 8; px 60 8 8; px 239 8 8; px 240 8 8
   px 299 8 8; px 300 8 8; px 419 8 8; px 420 8 8
   ```

3. **Colour.** Frame 510 is inside the colour blocks. Frame 120 is the lower third's panel, fully in.

   ```
   px 510 320 540     # navy: the guide says 1f2d42
   px 510 960 540     # sand: c1ad97
   px 510 1600 540    # mist: e8e3da
   px 120 120 900     # the lower third's navy panel: 1f2d42
   ```

   Read each answer as three pairs (red, green, blue). Each pair should be within 3 of the guide's. For example, `1f2c43` against `1f2d42` is within 1.

**Record:** all twelve answers.

**What it changes:**
- **Timing:** marks on exactly these frames mean a graphic lands on the frame the planner asks for. One frame early or late means H1 must correct for it.
- **Colour:** within 3 means no colour conversion is needed. Further off means the overlay converts with the wrong matrix, and H1 states the matrix outright, as the 2026-10-22 design warned.

**On the test machine:**
- lower third's mark: `460805` (absent), `c0ab95`, `c0ab95`, `1d083f` (absent);
- title card's mark: `3d0000` (absent), `c0ab95`, `c0ab95`, `3d0000` (absent);
- navy `1f2c43`, sand `c0ab95`, mist `e8e2d8`;
- the panel `1e2b42`.

All are within 2, and on the exact frames.

---

## Step 8. A 60-second Reel (20 minutes)

The Reel is one HyperFrames composition:
- 60 seconds of the recording, cropped upright from its centre;
- captions timed to each word, with the word being said in sand;
- a title for the first 5 seconds;
- an end card for the last 3.

1. Cut the Reel's minute, from 0:20 of the working copy:

   ```
   cd "$P"
   ffmpeg -v error -stats -y -ss 20 -i media/recording.mp4 -t 60 -c:v h264_videotoolbox -b:v 12M -profile:v high -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -c:a aac -b:a 192k media/reel-source.mp4
   ```

2. Time each word with brimm-video's own transcriber and model, then hand the words to HyperFrames. The `transcribe` here only reads the file Whisper wrote; it transcribes nothing and downloads nothing.

   ```
   ffmpeg -v error -y -i media/reel-source.mp4 -ar 16000 -ac 1 -c:a pcm_s16le media/reel.wav
   MODEL="$HOME/Library/Application Support/BRIMM Transcribe/ggml-large-v3-turbo.bin"
   time whisper-cli -m "$MODEL" -f media/reel.wav -l en -ml 1 -sow -nfa -dtw large.v3.turbo -osrt -of media/reel-words -np
   npx hyperframes transcribe media/reel-words.srt --dir .
   npx hyperframes lint
   ```

   - `transcribe` should say it imported some number of words into `transcript.json`.
   - `lint` should end "0 errors, 0 warnings".

3. Render the Reel and watch it:

   ```
   time npx hyperframes render -c compositions/reel.html --variables "{\"family\":\"$FAMILY\"}" --output "$H0/out/reel.mp4"
   open "$H0/out/reel.mp4"
   ```

   Watch the whole minute:
   - Are the captions in step with the words? Each group should appear as its first word is said. Note whether they run early or late, and by about how much.
   - Is the crop sensible? It is the centre of the frame. To move it, add `,\"cropX\":\"35%\"` (or another value) inside the `--variables` and render again.
   - Is there sound?
   - Do the title and the end card look right?

**Record:** the two times, what `transcribe` and `lint` printed, and what you saw.
**What it changes:**
- **Speed:** the render time says whether a Reel can be re-rendered for each change asked for by chat, or only at preview size.
- **Captions:** captions in step say that word times from brimm-video's transcriber can drive the Reel's captions as they are.

**On the test machine:** 1 min 43 s to 1 min 52 s for the 60-second Reel, with no graphics card. `transcribe` imported 103 made-up words, and `lint` gave 0 errors, 0 warnings.

---

## Step 9 (optional). A graphic at 4K (5 minutes)

For a 4K recording, graphics are drawn at 4K. This times one.

```
cd "$P"
time npx hyperframes render -c compositions/lower-third.html --format mov --resolution landscape-4k --variables "{\"family\":\"$FAMILY\"}" --output renders/lower-third-4k.mov
ffprobe -v error -show_entries stream=width,height,nb_frames -of compact renders/lower-third-4k.mov
```

**Record:** the time; `ffprobe` should say `3840`, `2160` and `180`.
**On the test machine:** 44 s.

---

## Step 10 (optional). The graphic in Final Cut (5 minutes)

For the Final Cut path (architecture section 7), graphics would arrive in Final Cut as these transparent clips.

1. In Final Cut, make a new library in the test folder: File > New > Library, saved in `~/BRIMM Video Work/H0 render test/`.
2. Make a new project, 1080p 30.
3. Import `project/media/recording.mp4` and `project/renders/lower-third.mov`.
4. Put the recording in the timeline, and the lower third above it at 0:02.

**Record:** does the lower third show over the recording, with the recording seen all around it?
**What it changes:** yes means the FCPXML writer can place graphics as these clips (H5).

---

## When you are done

1. Tell Claude "H0 is done", or how far you got. A Claude Code session on the Mac Studio, opened in `~/BRIMM Video Work/H0 render test/`, can read `results.md` and look at `out/`. Or paste `results.md` into a chat.
2. Leave the test folder as it is until Claude has read it.
3. After that, if you want the space back:
   - delete `~/BRIMM Video Work/H0 render test/`;
   - run `npx hyperframes browser clear` from the test folder before you delete it, or delete `~/.cache/hyperframes/` afterwards;
   - delete `~/.hyperframes/`, where HyperFrames keeps its settings.

   Close the step 10 library in Final Cut first.
