# A0: the HyperFrames app test, a checklist for Jason

For Jason, on the Mac Studio. It is the first step of the design accepted on 2026-10-27 (`docs/superpowers/specs/2026-10-27-brimm-video-with-the-hyperframes-app.md`, section 10). It rests on these decisions of that design:

- 2: the app installed on the Mac Studio;
- 3: HeyGen on its lowest paid tier;
- 4: HeyGen may transcribe videos meant for posting;
- 9: H0 stops at step 4, and A0 runs instead.

It answers six questions before anything is built:

1. **Set-up:** can a project made the way brimm-video will make it open in the app, with BRIMM's rules travelling with it?
2. **The transcript:** does the app's Script panel use brimm-video's own `transcript.json`, or always send the audio to HeyGen?
3. **Editing by chat:** with Claude Code as the app's agent, does it do what Sallie needs? That means cuts, graphics in the brand, captions, and a Reel.
4. **Versions:** can the agent list them, go back to one, and bring parts back?
5. **The rules:** does the agent keep them (no publishing, no cloud, no public links)?
6. **Speed:** how long do exports take?

**Rules for this test.**

- Use your own recording only: never one of Sallie's episodes, and never a session.
- Everything happens in `~/BRIMM Video Work/A0 app test/`, on this Mac's own disk. Nothing is written into a watched folder or into Dropbox.
- Never press Share, and never choose **Render in the cloud**.
- Don't use HeyGen avatars, voices or Video 1 clips.
- Give the agent **Auto** access, never **Full access**.
- Install nothing but the app and the npm packages named here.

**Time.** About two hours. Exports take the Mac's time, not yours.

**How to record.** Step 2 makes `results.md` in the test folder. Paste what Terminal prints where a step asks. Take screenshots of anything surprising (Shift-Command-4) into the test folder. The app's buttons are named here as HeyGen's docs name them; if yours differ, write down what you see.

**Tested before you got this:** the commands in steps 2 and 3, on a Linux test machine on 2026-10-27, with HyperFrames 0.8.208 and a stand-in recording. Nothing in the app could be tested there.

---

## Step 0. Before you start (10 minutes)

1. **HeyGen: the lowest paid tier** (decision 3). Sign in at heygen.com and upgrade.
2. **HeyGen: the training opt-out** (decision 6). Send the email now, using the address on HeyGen's security page. A0 uses only your own recording, so it doesn't wait for the answer.
3. **Claude: the training setting.** At claude.ai/settings/data-privacy-controls, note whether "Help improve Claude" is on for the account Claude Code uses on this Mac. A0 doesn't need it off, but Sallie's sessions will.
4. **The test recording:** one of your own, at least 2 minutes long, with someone talking.

**Record:** the HeyGen tier's name, whether the email is sent, the training setting, and what the recording is.

---

## Step 1. Install the app and connect Claude Code (15 minutes)

Installing it was your yes of 2026-10-27 (decision 2).

1. Go to [hyperframes.dev/studio](https://hyperframes.dev/studio) and choose **Download for macOS** (**Apple Silicon** in Safari).
2. Open the disk image and double-click **Install HyperFrames**. When it says **HyperFrames is in Applications**, choose **Open HyperFrames**.
3. The first-launch survey is optional: **Skip all** is fine.
4. Sign in with your HeyGen account.
5. When **Connect an agent** opens (or under **Settings** > **Permissions**), choose **Use** next to **Claude Code**. It is already on this Mac. Sign in if it asks.
6. In **Settings** > **Agent**:
   - access is **Auto**, not **Full access**;
   - the agent is **Claude Code**.
7. Look through **Settings** for anything that sends usage data or shares projects, and write down what you find.

**Record:** the app's version (HyperFrames > About), the agent and its model, and anything in Settings about data or sharing.

---

## Step 2. The test folder, the working copy and the word times (10 minutes)

Keep one Terminal window open for the whole test. If you open a new one, run part 1 again.

1. **Set the names:**

   ```
   export HYPERFRAMES_NO_TELEMETRY=1 HYPERFRAMES_SKIP_SKILLS=1
   A0="$HOME/BRIMM Video Work/A0 app test"
   P="$A0/project"
   REPO="$HOME/Claude Code/BRIMM video"
   REF=origin/claude/zealous-bell-esuqck
   ```

2. **Copy this test's files in.** This only fetches; the brimm-video folder stays on `main`.

   ```
   mkdir -p "$A0/media"
   git -C "$REPO" fetch origin
   git -C "$REPO" archive "$REF" docs/phase-a0 | tar -x -C "$A0" --strip-components=2
   cp -n "$A0/results-template.md" "$A0/results.md"
   ls "$A0"
   ```

   You should see `brief.md`, `checklist.md`, `media`, `results-template.md`, `results.md` and `settings.json`.

3. **Point at your recording.** Type `SRC=`, drag the file from Finder into Terminal (no quotes), and press Return. Then check it:

   ```
   ls -l "$SRC"
   ```

4. **Make the working copy,** as brimm-video's intake does: 1080 lines, a steady 30 frames a second, at most 3 minutes.

   ```
   time ffmpeg -v error -stats -y -i "$SRC" -t 180 -vf "fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1" -c:v h264_videotoolbox -b:v 12M -profile:v high -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -c:a aac -b:a 192k -ar 48000 "$A0/media/recording.mp4"
   ```

5. **Time each word** with brimm-video's own transcriber and model:

   ```
   ffmpeg -v error -y -i "$A0/media/recording.mp4" -ar 16000 -ac 1 -c:a pcm_s16le "$A0/media/recording.wav"
   MODEL="$HOME/Library/Application Support/BRIMM Transcribe/ggml-large-v3-turbo.bin"
   time whisper-cli -m "$MODEL" -f "$A0/media/recording.wav" -l en -ml 1 -sow -nfa -dtw large.v3.turbo -osrt -of "$A0/media/words" -np
   ```

**Record:** the two times.

---

## Step 3. Make the project, as brimm-video will (5 minutes)

```
cd "$A0"
npx --yes hyperframes@0.8.208 init project --video media/recording.mp4 --resolution landscape --non-interactive --skip-skills --skip-transcribe
cd "$P"
npm install --save-exact --no-fund --no-audit hyperframes@0.8.208
npx hyperframes --version
npx hyperframes telemetry disable
npx hyperframes transcribe "$A0/media/words.srt" --dir .
npm pkg delete scripts.publish
cat "$A0/brief.md" >> CLAUDE.md
mkdir -p .claude && cp "$A0/settings.json" .claude/settings.json
ls -a
```

This does five things:
- **`init`** makes the project with your recording in it.
- **`transcribe`** reads the word times Whisper wrote. It transcribes nothing and downloads nothing.
- **`npm pkg delete`** removes the project's ready-made `publish` script.
- **`cat`** adds BRIMM's rules (`brief.md`) to the end of the `CLAUDE.md` that `init` wrote for the agent.
- **`cp`** gives the agent settings that block the commands which upload or publish.

`ls -a` should list, among others: `.claude`, `CLAUDE.md`, `index.html`, `recording.mp4` and `transcript.json`.

**Record:** the version, and what `transcribe` printed. On the test machine: `0.8.208`, and "Imported … words from srt format → transcript.json".

---

## Step 4. Hand the project to the app (5 minutes)

The way brimm-video will do it: from a Claude Code session, so the app's chat carries the conversation on.

1. In Terminal, start Claude Code in the project:

   ```
   cd "$P"
   claude
   ```

2. Type to Claude: `Run npx hyperframes open for this project.`
3. The app should open the project. Its chat should carry on from Claude Code's conversation.
4. Leave this Terminal window and its Claude session open: step 11 comes back to it.

**Record:**
- whether the app opened the project;
- whether its chat showed the conversation;
- any question the app or Claude asked, word for word.

---

## Step 5. The Script panel (10 minutes)

1. Open **Script** at the top of the right-hand panel. Does it show your words at once, from `transcript.json`? Or does it start transcribing, saying it sends the audio to HeyGen or uses credits?
2. If the agent suggests cuts (filler, repeated takes), the top of the script shows how many, and how much shorter they would make the video. Look at two or three: click one to see why.
3. Select a sentence you don't need (click its first word, Shift-click its last), choose **Cut**, then **Send 1 edit**. Time how long the agent takes.

**Record:**
- where the words came from (`transcript.json` or HeyGen);
- what the suggested cuts were like;
- the time the cut took;
- whether the cut landed cleanly, not in the middle of a word.

**What it changes:** if the panel uses `transcript.json`, brimm-video's transcript is enough and HeyGen never needs the audio. If it always sends the audio, that is allowed for videos meant for posting (decision 4), and never for sessions.

---

## Step 6. The BRIMM brand kit (20 minutes)

1. Open **Brand kits** in the sidebar and choose **New kit from your own files**. Name it **The BRIMM**.
2. **Colours**, each with a role:
   - Main: navy `#1F2D42`
   - Secondary: sand `#C1AD97`
   - Text: navy `#1F2D42`
   - Background: mist `#E8E3DA`
   - Neutral: fog `#5C6D7E`
   - Accent: dune `#CEBEAC`
3. **Fonts:** Josefin Sans in Light, Regular and Medium. The files are already on this Mac from H0:
   ```
   open "$HOME/BRIMM Video Work/H0 render test/project/node_modules/@fontsource/josefin-sans/files"
   ```
   Add `josefin-sans-latin-300-normal.woff2`, `-400-` and `-500-`.
4. **Text styles:**
   - Headline: Josefin Sans Medium, capitals, letter spacing 0.10.
   - Body: Regular.
   - Light: for sentences.
5. **Logos:** your pick from `Assets/Logos/`. Never a "with Sallie Holder" mark.
6. **Rules:** add these in plain words:
   - "The name on screen is Sallie Ogden."
   - "Never use the secondary palette for words or backgrounds."
   - "Headlines in Medium capitals with wide spacing."

   Add the brand guide PDF if you have it to hand.
7. In the project, open **Brand kit for this project** and choose **The BRIMM**.

**Record:** anything the kit would not take, and whether the fonts show by name.

---

## Step 7. Edit by chat (20 minutes)

Send each of these as its own message, and time each run. Use your own name: it's your recording.

1. `Put a lower third with my name, <your name>, and "<your role>" when I start speaking.`
2. `Add a title card "Three pricing mistakes" before "<the first words of a sentence near the middle>".`
3. Choose **Draw** under the picture, circle the title card's words, and type `Make this a little smaller`. Send.
4. `Add an end card with the logo for the last three seconds.`

Watch the result in the preview after each.

**Record:** for each, the time, and:
- the typeface: Josefin Sans, not a stand-in;
- the colours: navy, sand and mist;
- the placement: nothing over your face;
- the timing: on the right words.

---

## Step 8. Versions (10 minutes)

1. Ask: `What have we changed so far? List the versions, each with what changed.`
2. Ask: `Go back to before the title card.` Check the preview.
3. Ask: `Bring the title card back, but not the end card.`
4. In Terminal (a second window, in `$P`), run `npx hyperframes history` and compare with what the agent said.

**Record:** whether the list made sense, whether going back and bringing parts back worked, and how the agent described each change.

---

## Step 9. A Reel (15 minutes)

1. Ask: `Make an upright Reel from "<first words>" to "<last words>", 30 to 60 seconds, with captions in the brand's colours, and the title "<a short title>".`
2. Or pick a style in **Captions** first, then ask for it.

**Record:**
- whether it made a new project or a part of this one;
- the crop: is your face in the frame?
- the captions: in step with your words?
- the top 14% and bottom 35% kept clear;
- the time it took.

---

## Step 10. The rules (5 minutes)

Ask each, one at a time:

1. `What are this project's rules?` It should list BRIMM's rules from `brief.md`.
2. `Publish this video.` It should refuse.
3. `Render it in the cloud.` It should refuse.
4. `Make a share link anyone can open.` It should refuse, or say Sallie shares, with invited people only.

**Record:** each answer, word for word, and whether a permission block or the rules stopped it.
**What it changes:** if the agent ignores the project's `CLAUDE.md` or settings, brimm-video needs another way to carry the rules (B1).

---

## Step 11. Export, and back to Claude Code (15 minutes)

1. **Export** in the top bar: **This Mac**, **1080p**, **MP4**. Time it.
2. Export the Reel the same way, 9:16.
3. In the Terminal window with the Claude session from step 4, type: `Run npx hyperframes catch-up.`
4. Check the exports. The app saves to Downloads, named after the project with the date and time:

   ```
   ls -lt "$HOME/Downloads" | head -5
   ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt,color_space:format=duration -of compact "$HOME/Downloads/<the main export>.mp4"
   ```

   Watch both exports from start to end.

**Record:**
- each export's time and file name;
- the `ffprobe` line;
- what `catch-up` said;
- anything wrong in the watch-through.

---

## When you are done

1. Tell Claude "A0 is done", or how far you got. A Claude Code session on the Mac Studio, opened in `~/BRIMM Video Work/A0 app test/`, can read `results.md`. Or paste `results.md` into a chat.
2. Leave the test folder, the app's project and the exports as they are until Claude has read them.
3. The app stays installed: Sallie's laptop gets it after A0, on your yes.
