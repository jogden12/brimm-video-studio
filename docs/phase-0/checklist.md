# Phase 0: Final Cut facts, a checklist for Jason

For Jason, on the Mac Studio, with Final Cut Pro 12.4. Made-up clips only: nothing here touches a real recording, and nothing is written into a watched folder. The design is `docs/superpowers/specs/2026-10-14-brimm-video-next-version-design.md`; its phase 0 table lists what this settles.

**Order.** Part A first: phase 1a, which is being built now, needs those answers. Part B serves later phases. If time runs out, stop after any step: every step stands on its own, and a half-done list is still worth handing in. Part C is for Sallie's laptop, later.

**Time.** Part A about 45 minutes, part B about 40.

**How to record.** Step 0 makes `~/BRIMM Video Work/Phase 0/results.md`, with a place for each step. Write what happened in plain words, copy any dialog's exact words, and put screenshots (Shift-Command-4) in `~/BRIMM Video Work/Phase 0/Screenshots/`, named by step (`A3 dialog.png`). Exports go into `~/BRIMM Video Work/From Final Cut/`, named by step as each step says. When you stop, tell Claude in the design session "phase 0 is done" (or how far you got). Claude reads `results.md`, the screenshots and the exports, writes the facts into the spec, and keeps the exports of made-up clips as test fixtures.

**What each step changes** is under each step, so you can see why it is asked.

---

## Step 0. Make the files (2 minutes)

1. Note Final Cut's import setting, to put it back at the end: Final Cut Pro > Settings > Import > Files: "Copy to library storage location" or "Leave files in place". Write it in `results.md`.
2. In Terminal, in the brimm-video checkout:

   ```
   node docs/phase-0/make-files.mjs
   ```

   It makes `~/BRIMM Video Work/Phase 0/` and `~/BRIMM Video Work/From Final Cut/`, on this Mac's own disk, and says "Every file passes Final Cut's definition of FCPXML 1.10." In `Phase 0/` there is now:
   - `2026-10-14 Phase test (Mac Studio)/`: a stand-in episode folder with three made-up clips of 20 seconds (`Phase test.mov`, wide; `Upright test.mov`; `Timecode test.mov`, which starts at 01:00:00:00), `media/Picture.png`, and `edit/` with the stored timelines A1, B1, B2 and B3.
   - `Moved/`: a copy of that episode folder in another parent folder.
   - `Elsewhere/A2 base url.fcpxml`, and `Pushed/` with A3, A4 and A4b: the local copies a push would hand to Final Cut.
   - `results.md` and `Screenshots/`.

---

## Part A: what phase 1a needs

### A1. A stored timeline with a relative path (5 minutes)

The design stores timelines in `edit/` with the video named by a path from the file's own folder (`../Phase%20test.mov`) and no library.

1. In Final Cut: File > Import > XML…, and pick `Phase 0/2026-10-14 Phase test (Mac Studio)/edit/A1 relative.fcpxml`.
2. If it asks for a library, make a new one: `~/BRIMM Video Work/Phase 0/Phase 0 relative.fcpbundle`.
3. Open the project "A1 relative". Does the clip play, or is it red (missing)? Select the clip in the browser, then File > Reveal in Finder: which file does it point at?
4. Now File > Import > XML… again, and pick the copy: `Phase 0/Moved/2026-10-14 Phase test (Mac Studio)/edit/A1 relative.fcpxml`, into a new library `~/BRIMM Video Work/Phase 0/Phase 0 moved.fcpbundle`. Reveal its clip in Finder: is it the file under `Moved/`?

**Record:** any dialog, word for word; plays or missing; the two paths Reveal in Finder showed.
**What it changes:** if both play and point at their own folder's video, a relative path is read from the file's own folder, and Sallie's Mac can open a stored timeline as it is. If not, nothing changes in phase 1a (a push always hands Final Cut a copy with this Mac's whole paths), but the README must say never to double-click a stored timeline.

### A2. Apple's "base url" option (3 minutes)

1. File > Import > XML…, pick `Phase 0/Elsewhere/A2 base url.fcpxml`, into the library "Phase 0 relative". This file names the video only as `Phase%20test.mov`, and gives the episode folder as the base url.
2. Does the clip play? Reveal in Finder: which file?

**Record:** plays or missing; the path; any dialog.
**What it changes:** the design keeps whichever of A1 and A2 works. If both work, the pushed copy keeps whole paths, the simplest.

### A3. The first push: the local copy and its import options (8 minutes)

The pushed copy names this Mac's library (`library location`), says `copy assets` 0 so the raw video is linked where it is and never copied into the library, and `suppress warnings`. Test it against the harder setting:

1. Set Final Cut Pro > Settings > Import > Files to **Copy to library storage location** (you noted the old setting in step 0).
2. Quit nothing. In Terminal, hand Final Cut the file the way phase 1a will:

   ```
   open -a "Final Cut Pro" "$HOME/BRIMM Video Work/Phase 0/Pushed/A3 first push.fcpxml"
   ```

3. Watch: does Final Cut make the library `Phase 0 pushes` with no question? Does any dialog appear? Does the project "Phase test main v1 0a0a0a" open in the timeline, or only appear in the browser?
4. Select the clip in the browser, File > Reveal in Finder: is it the file in the episode folder, or a copy inside the library? Also, in Terminal:

   ```
   du -sh "$HOME/BRIMM Video Work/Phase 0/Phase 0 pushes.fcpbundle"
   ```

   A few MB means nothing was copied in; about 5 MB more than that means the clip was.

**Record:** dialogs word for word; library made or not; project opened or only listed; the clip's path; the library's size.
**What it changes:** a library made with no question means a push can run unattended. If the clip was copied in although `copy assets` is 0, setup must set "Leave files in place" on both Macs and the push must check it. Whether the project opens tells the skill what to say after each push ("open the project … in the browser").

### A4. A second push into the same library and event (5 minutes)

1. In Terminal:

   ```
   open -a "Final Cut Pro" "$HOME/BRIMM Video Work/Phase 0/Pushed/A4 second push.fcpxml"
   ```

   Same video, same event "Phase test", a new project "Phase test main v2 0a0a0a".
2. Does Final Cut ask anything ("replace or keep both", or another)? What is in the event afterwards: both projects? One clip of the video, or two?
3. Then the variant with an event of its own:

   ```
   open -a "Final Cut Pro" "$HOME/BRIMM Video Work/Phase 0/Pushed/A4b own event.fcpxml"
   ```

   Any dialog this time?

**Record:** each dialog word for word, and which button you pressed; what the browser shows.
**What it changes:** no dialog means each push is a new project in one event. A dialog for A4 but not for A4b means each push gets its own event. A dialog for both means the skill must tell Sallie which button to press.

### A5. File > Export XML…: its form and its default name (5 minutes)

1. Open the project "Phase test main v1 0a0a0a". **Click in the timeline** (so the project is exported, not a clip in the browser).
2. File > Export XML…. Before saving, note: the name it offers in Save As; the folder the dialog opens on; the versions in the version menu, and which is chosen; anything else in the dialog.
3. Change the folder to `~/BRIMM Video Work/From Final Cut/`, keep the name it offered, and save.
4. In Terminal:

   ```
   ls -la "$HOME/BRIMM Video Work/From Final Cut/"
   ```

   Is it a `.fcpxmld` folder (bundle) or a `.fcpxml` file?

**Record:** the offered name, word for word; the dialog's first folder; the versions offered and the default; the file's name and form.
**What it changes:** `finish` and `pull` find an export by the project's name. If the offered name is not exactly the project's name, the matching rule follows what Final Cut does. The version decides what phase 5's reader reads.

### A6. Share, the BRIMM final destination, and where the dialogs open (10 minutes)

1. Final Cut Pro > Settings > Destinations: add an **Export File** destination, rename it "BRIMM final", set Format **Video and Audio** and Video Codec **H.264**, leave resolution as it is. Control-click it, Make Default.
2. Open "Phase test main v1 0a0a0a", press Command-E. Note the name it offers and the file type it will write. Click Next. **Which folder does the save dialog open on** (you saved an export into From Final Cut just before)? Save into `~/BRIMM Video Work/From Final Cut/` with the offered name.
3. While it renders, run this two or three times:

   ```
   ls -la "$HOME/BRIMM Video Work/From Final Cut/"
   ```

   Does the file appear under its final name at once, under another name, or only at the end?
4. When Final Cut says the Share is done: the file's name, extension and size.
5. Now File > Export XML… once more on the same project: which folder does that dialog open on, after the Share?

**Record:** the offered names, the extension (`.mov` or `.mp4`), what `ls` showed while it rendered, and the folder each dialog opened on.
**What it changes:** a temporary name while rendering tells `finish` how to tell a finished file from one still being written. The folders the dialogs open on tell Sallie's card whether she must pick From Final Cut each time.

### A7. A template through the linked Movies folder (10 minutes)

On the Mac Studio `~/Movies` is a link into your Dropbox (`Jason Ogden/Mac/Movies`, not The BRIMM DB). Motion saves templates there itself, so this step writes one small throwaway template into your Dropbox. Skip it if you would rather not; phase 6 then settles it.

1. Open Motion: File > New, choose **Final Cut Title**, any size. Type "Phase 0" in the text. File > Save As: name "Phase 0 Title", Category: new, "Phase 0 test". Save. Quit Motion.
2. In Final Cut, open the Titles browser: is "Phase 0 Title" under "Phase 0 test"? Put it on "Phase test main v1 0a0a0a" over the first seconds.
3. Click in the timeline, File > Export XML…, name it `A7 template`, save into `~/BRIMM Video Work/From Final Cut/`.
4. In Terminal, show the uid Final Cut wrote for the template:

   ```
   grep -ho 'uid="[^"]*Phase 0 Title[^"]*"' "$HOME/BRIMM Video Work/From Final Cut/A7 template.fcpxmld/Info.fcpxml" "$HOME/BRIMM Video Work/From Final Cut/A7 template.fcpxml" 2>/dev/null
   ```

5. Also put the template on the upright project of step B2 if you get there, and note whether its text sits where it should.

**Record:** whether Final Cut found the template; the uid, exactly; where the file is (`ls ~/Movies/"Motion Templates.localized"/Titles.localized/`).
**What it changes:** a uid that starts `~/Titles.localized/…` is the same on any Mac with the template in the same place, so exports carry between the Macs. A uid with the whole Dropbox path would differ on Sallie's laptop, and phase 6 must rewrite it.

---

## Part B: what later phases need

### B1. Built-in titles with words only, a custom role, a moved picture (8 minutes)

1. File > Import > XML…, `…/edit/B1 titles and a still.fcpxml`, into "Phase 0 relative". Open "B1 titles and a still".
2. At 1 s: a Basic Title written with words only (no font, no size). Does it look like a Basic Title added by hand (font, size, place)?
3. At 6 s: the same title with Helvetica 90 white given. Is that what shows?
4. At 11 s: a Basic Lower Third with two lines, words only. Are both lines there, in the template's places?
5. Timeline Index > Roles: is there a role "BRIMM titles"? Where (under Titles, or on its own)? Which clips have it?
6. At 15 s: the picture, given scale 0.5 and position "40 -20". Is it half size? Which way did it move, and how far? Select it and read the Inspector's Transform values.

**Record:** each answer; the Inspector's Position and Scale for the picture.
**What it changes:** words only keeping the template's look means brimm-video writes words only and the templates carry the brand. A custom role that holds tells phase 5 how to find brimm-video's own titles in an export. The picture's numbers settle the units of a graphic's place.

### B2. An upright project of the wide clip, filled and moved (6 minutes)

1. File > Import > XML…, `…/edit/B2 upright, filled.fcpxml`, into "Phase 0 relative". Open "B2 upright, filled".
2. Is the project 1080x1920? First half: the wide clip given `fill` and position "20 0". Does it fill the frame? Which way did it move, and by how much of the frame? Select it, read the Inspector's Transform Position and Scale, and the Spatial Conform setting.
3. Second half: `fill` only. Does it fill the frame, centred?
4. The title at 1 s: does it sit sensibly in the upright frame?

**Record:** the Inspector's numbers for both clips; a screenshot of each half (`B2 moved.png`, `B2 centred.png`).
**What it changes:** phase 3 builds the upright Reel projects this way. The numbers settle the unit of `position` (the builder's guess is percent of the frame's height). If `fill` is not kept, phase 3 sets the scale itself.

### B3. A start timecode, and an iPhone clip (8 minutes)

1. File > Import > XML…, `…/edit/B3 timecode.fcpxml`, into "Phase 0 relative". Open "B3 timecode". Select the clip: does the Inspector (Info) show a start of 01:00:00:00? Does the marker sit at 2 seconds into the clip?
2. Record five seconds on your iPhone, AirDrop it to this Mac, and import it into "Phase 0 relative" with File > Import > Media (leave in place). Put it in a new project "B3 iPhone". Click in the timeline, File > Export XML…, name `B3 iPhone`, into `~/BRIMM Video Work/From Final Cut/`.
3. In Terminal, the asset's start and the clip's timecode:

   ```
   grep -o '<asset [^>]*>' "$HOME/BRIMM Video Work/From Final Cut/B3 iPhone.fcpxmld/Info.fcpxml"
   ```

**Record:** the start Final Cut shows for each; the `<asset …>` line.
**What it changes:** the import reads a camera's start timecode and gives it to the asset, and the export reader subtracts it (spec section 2). A start of 0 on the iPhone clip would mean there is nothing to subtract for phones.

### B4. Library backups (3 minutes)

1. Select the library "Phase 0 pushes" in the sidebar. In the Inspector (Library Properties), Storage Locations > Modify Settings: where do Backups go now?
2. Look for any way to set it other than this dialog.
3. Set it to `~/BRIMM Video Work/Backups/` (make the folder if Final Cut needs one), and note whether it took.

**Record:** where they went by default; whether there is another way.
**What it changes:** if only this dialog sets it, the skill names the step at an episode's first push on each Mac.

### B5. Does a hand edit change the library's files? (3 minutes)

1. In Terminal:

   ```
   touch "$HOME/BRIMM Video Work/Phase 0/before-trim"
   ```

2. In "Phase test main v1 0a0a0a", trim a few frames off the clip's end. Wait ten seconds.
3. In Terminal:

   ```
   find "$HOME/BRIMM Video Work/Phase 0/Phase 0 pushes.fcpbundle" -type f -newer "$HOME/BRIMM Video Work/Phase 0/before-trim" | head -20
   ```

**Record:** what `find` listed (or nothing).
**What it changes:** if a trim changes a file there, brimm-video can tell by itself that a timeline was edited by hand since its push, and the push guard can ask less often.

### B6. An export carried to a second library (5 minutes; needs A5)

1. In Terminal, make the copy phase 5 would carry to the other Mac (bookmarks dropped, uids taken off, the library replaced, a new project name). Put your A5 export's name in place of `<A5 export>`:

   ```
   node docs/phase-0/strip-export.mjs "$HOME/BRIMM Video Work/From Final Cut/<A5 export>" "$HOME/BRIMM Video Work/Phase 0/A5 stripped.fcpxml" "$HOME/BRIMM Video Work/Phase 0/Phase 0 second.fcpbundle"
   ```

2. File > Import > XML…, `Phase 0/A5 stripped.fcpxml`. Does Final Cut make the library "Phase 0 second" or ask? Any dialog? Does the clip play?

**Record:** what the script said; each dialog; plays or not.
**What it changes:** if the stripped copy imports cleanly, phase 5's way of carrying an edit between the Macs holds.

### B7. A clip linked from inside Dropbox (5 minutes)

1. In Terminal, clone the wide clip into a test folder in The BRIMM DB (a clone, as brimm-video copies; not a watched folder):

   ```
   DB="$HOME/Library/CloudStorage/Dropbox-Ogden28.5/Jason Ogden/The BRIMM DB"
   mkdir "$DB/Phase 0 test (delete after)"
   cp -c "$HOME/BRIMM Video Work/Phase 0/2026-10-14 Phase test (Mac Studio)/Phase test.mov" "$DB/Phase 0 test (delete after)/"
   ```

2. In Final Cut: File > Import > Media, pick that file, **Leave files in place**, into "Phase 0 relative". Put it in a new project "B7 Dropbox" and play it.
3. An hour later, play it again.

**Record:** whether it imported and played, then and an hour later; any warning.
**What it changes:** the design links every raw video where it sits in Dropbox. If Final Cut balks at a linked file inside Dropbox, phase 1a must keep a local copy for Final Cut instead.

---

## Part C: on Sallie's laptop, later

Once macOS and Final Cut are on her laptop (setup items 1 and 2, with your yes), repeat there: step 0, A1, A3, A4, A5, A6, A7 (the template copied there by the rule, not made in Motion), and B7 with the same Dropbox test folder. Record the same things in her `results.md`.

---

## When you are done

1. Put Final Cut's import setting back as step 0 noted it.
2. Tell Claude in the design session "phase 0 is done", or how far you got. Leave `~/BRIMM Video Work/Phase 0/` and `From Final Cut/` as they are until Claude has read them.
3. After that: delete `The BRIMM DB/Phase 0 test (delete after)/`, the Phase 0 libraries, and, if you like, the Phase 0 Title template in `~/Movies/Motion Templates.localized/Titles.localized/Phase 0 test/`.
