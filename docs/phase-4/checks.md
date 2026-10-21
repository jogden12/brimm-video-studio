# Phase 4: the by-hand checks

For Jason, on the Mac Studio, with made-up clips only. They settle what phase 4 writes for Final Cut before Sallie sees it: the titles' places and sizes, the looks' Color Grading Presets, and where pictures go. Task C9 of `docs/superpowers/plans/2026-10-15-phase-4-session-commands.md` applies what is written here.

To make the files, from the repository's folder:

```
node docs/phase-4/make-checks.mjs
```

It writes two made-up clips, two made-up pictures and six Final Cut files into `~/BRIMM Video Work/Phase 4 checks/`, outside Dropbox, checking each file before it is written. It runs ffmpeg under brimm-video's watchdog (`tool/guard.js`). Given a folder, it writes there instead, for a dry run.

What follows is the plan's "By-hand checks for Jason", word for word, with a line under each check for what was seen.

About 25 minutes, on made-up clips only. Task C8's script writes the files from brimm-video's own writer into `~/BRIMM Video Work/Phase 4 checks/`, outside Dropbox, and each imports into one library there, "Phase 4 checks". Install Varela with Font Book first (Jason's own yes). Open each file with `open -a "Final Cut Pro" "<file>"`. Write what is seen on the line under each check in `docs/phase-4/checks.md`, and send it to the lead: Task C9 applies it. In this order, because each unblocks more than the next:

1. **Titles** (it unblocks everything she sees: captions, a Reel's title, name titles). Times are on the timeline, as Final Cut shows them.
   - `1 titles upright.fcpxml`: the caption "So the first thing" in Varela with a soft shadow, its lowest edge about 65% down, its capitals about 48 px tall at 100%. The title "Know your / costs" on two lines, centred, in the top band (15% to 30% down), from 0:07 to 0:13; at the join at 0:09 it carries on, with no break and no second entry (ruling 8). The name "Sallie Ogden / Founder, The BRIMM" in the top band from 0:13, centred.
   - `1 titles upright lucida.fcpxml`: the same, in Lucida Grande, not Helvetica.
   - `1 titles wide.fcpxml`: the caption, centred, low. The Basic Lower Third "Sallie Ogden" over "Founder, The BRIMM", in Varela, flush left one over the other at the template's own place, lower left, wholly inside the frame, from 0:06 to 0:12; it stays up across the join at 0:09, with no second entry. Then, from 0:13, "Sallie Ogden" alone: nothing under it, not the template's own words.
   - `1 titles wide 720p.fcpxml`: the same at 1280 by 720. With the viewer at Fit, set beside the 1080 one: the name's capitals are the same share of the frame's height in both. Say "the same", or "smaller at 720p" and by about how much.

   If a place or a size is off, say what is seen: the capitals' height at 100%, and the lowest edge. If the title over the join enters again, or the name alone shows words under it, say so.

   **Seen, upright:** (Jason, 2026-10-21, with Varela installed) Every place is right, the sizes are not. The caption is in Varela, white, with its soft shadow, centred, 58% to 64% down: its lowest edge 64% down. But its capital S is 87 px tall at 100% (90 px with its edge), where 48 were asked for, about 1.8 times too big, and it spans 88% of the frame's width. "Know your / costs" is on two lines, centred, from 0:07 to 0:13, and carries on across the join at 0:09 with no flicker and no second entry; it runs 16% to 34% down, so its second line goes past the top band's 30%, only because of its size. "Sallie Ogden / Founder, The BRIMM" is centred in the top band, 18% to 30% down, from 0:13.

   **Seen, upright in Lucida Grande:** The same, in Lucida Grande, not Helvetica: its capital S 89 px at 100%, the same 1.8 times as Varela's.

   **Seen, wide:** All right, and at the size asked for: the name's capital S is 35 px at 100%, against 35.6 asked. The caption is centred and low. The Basic Lower Third has "Sallie Ogden" 82% to 87% down over "Founder, The BRIMM" 88% to 91% down, both from 9.3% across: flush left, lower left, wholly inside the frame, from 0:06 to 0:12, staying up across the join at 0:09 with no second entry. From 0:13, "Sallie Ogden" alone, with nothing under it.

   **Seen, wide at 720p (the same, or smaller, and by about how much):** Smaller at 720p, by about a third: the name's capital S is 16 px at 100%, against 23.7 asked (0.67 of it), and at Fit its capitals take about 3% of the frame's height, against 4.7% at 1080. Its places are right, and from 0:13 the name is alone. So Final Cut draws a title's font size as of a 1080-line frame whatever the frame's height: 1.78 times in an upright 1920-line frame, as is at 1080, two thirds at 720.
2. **Looks** (it unblocks applying a look). In the browser, duplicate the project "Phase 4, 1 titles wide" three times (Edit > Duplicate Project), and name the copies "look bright", "look warm" and "look moody". In each, select both clips of the video (not the titles), and from the Effects browser drag one Color Grading Preset onto them: Clean Whites with Lifted Blacks onto "look bright", Warm Dusk with Low Contrast onto "look warm", Warmer Vintage with Dark Blacks onto "look moody". Set its Mix to 0.25 (0.5 for moody), the strength brimm-video writes. Then File > Export XML… of each in turn, saved as "look bright.fcpxml", "look warm.fcpxml" and "look moody.fcpxml" into `~/BRIMM Video Work/Phase 4 checks/`. Send the three.

   **Sent:** look bright.fcpxml ☑  look warm.fcpxml ☑  look moody.fcpxml ☑ (Final Cut 12.4 writes each as a bundle, `look <look>.fcpxmld`, its Info.fcpxml inside). Each preset is Final Cut's "Color Adjustments" effect (uid FxPlug:7E2022A5-202B-4EEB-A311-AC2B585D01B0) carrying all its own settings, Exposure, Contrast and the rest, beside a param named Mix (key 99990): bright, Clean Whites with Lifted Blacks, at 0.25; warm, Warm Dusk with Low Contrast, at 0.25; moody, Warmer Vintage with Dark Blacks, at 0.5, each on both clips (moody's lower third over the join also holds an empty Color Adjustments, every setting 0, which changes nothing).

   **2b**, once C9 has the presets on its branch: run the script from that branch, which now writes `2 look <look>.fcpxml` for each look. Open each, and set it beside the "look <look>" project made by hand. Say, for each look, "the same colour" or what differs: a look is applied only once its 2b is the same colour.

   **Seen, bright:** (Jason, 2026-10-21) The same colour as "look bright", made by hand.

   **Seen, warm:** The same colour as "look warm".

   **Seen, moody:** The same colour as "look moody".
3. **Pictures** (it unblocks graphics and the logo). Open `3 pictures.fcpxml`, upright. See: the made-up logo, 600 by 300, top right, 15% of the frame's width; the made-up chart, 1600 by 900, filling the frame from 0:01 (full), at half size in the top right corner below the top band, about 31% down, from 0:06 (corner), and fitted into a box above the captions, about 41% to 60% down, from 0:11 (lower; ruling 13). If a picture is not fitted to the frame unless told to fill it, say so. Then File > Export XML… of that project, saved as "3 pictures export.fcpxml" into the same folder, and send it: C9 reads each picture's role there.

   **Seen:** All as asked. The logo is 14.7% of the frame's width, top right, its 2:1 kept, throughout. The chart fills the frame from 0:01, centred (its middle third shows). From 0:06 it is half size in the top right corner, 49.6% of the width, 31% to 47% down, its right edge in line with the logo's. From 0:11 it is fitted into a box above the captions, 59% of the width, centred, 41% to 60% down. Each picture keeps its own shape.

   **Sent:** 3 pictures export.fcpxml ☑ (as `3 pictures export.fcpxmld`: each picture a `<video>` on role "BRIMM titles.BRIMM titles-1", so "BRIMM titles" up to its first dot). Last, open `3 pictures bare.fcpxml`, the same pictures written without "suppress warnings", in an event of its own: say anything Final Cut says when it takes it in.

   **Final Cut said, for 3 pictures bare:** Nothing: no warning and no message.

Then, as the spec's phase 4 row asks: one session run by Sallie, on a real episode, on her laptop.
