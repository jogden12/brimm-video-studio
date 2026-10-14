# Phase 0 results

Fill in as you go (see docs/phase-0/checklist.md). Screenshots go in Screenshots/, exports in ~/BRIMM Video Work/From Final Cut/.

## Step 0

- Final Cut's import setting before (Copy to library storage location / Leave files in place): Copy to library storage location (Jason, 2026-10-14)
- Final Cut version (Final Cut Pro > About): 12.4 (read from the app, 2026-10-14)
- macOS version: 27.0.1

## A1. Relative path

- First try (2026-10-14): no dialogs, but no "Phase test" event appeared in either open library (BRIMM rough cuts, BRIMM Claude test), so the import did not happen. To redo with a new library selected first.
- Dialogs, word for word: none (second try, into a new library "Phase 0 relative" selected first)
- First import: imported. The library holds event "Phase test", project "A1 relative", and Original Media/Phase test.mov as a real copy (672 KB, not a link): the relative path was found, and with no copy-assets option the import followed the Import setting (Copy to library) and copied the clip in. (Read off the library on disk by Claude, 2026-10-14.)
- Moved copy: the clip under Moved/ was replaced by colour bars with a higher tone, so the picture shows which file was read. Plays bars or test pattern?
- Moved copy, first try (13:31): library "Phase 0 moved" got a copy of the ORIGINAL clip (md5 4084ed05…, 671 989 bytes), not the colour bars under Moved/ (249 158 bytes), with "Phase 0 relative" still open. Either Final Cut reused media it already knew, or it read the path from somewhere other than the file's folder. Second try: the original renamed out of the way (by Claude), both Phase 0 libraries closed, a third library "Phase 0 moved 2". Through File > Import > XML…: Missing File (the library's Original Media stayed empty); which file the dialog picked is not certain. Third try, by `open -a "Final Cut Pro" <the Moved A1 file>`: Final Cut asked "Which library do you want to import A1 relative.fcpxml into?" ("Select a library from the list of recent libraries. To import your XML into a different library, click Locate. To import your XML to a new library, choose New Library." Buttons: Locate…, New…, Cancel, Choose). So a file with no library location, handed over by open -a, makes Final Cut ask for a library. Then, after Keep Both, the new project played colour bars and the tone (Jason): the clip under Moved/ was read. RESULT A1: a relative src is read from the FCPXML file's own folder. The earlier Missing File was most likely the Import dialog opening on the original edit/ folder, where a file of the same name sits. The original clip's name was put back afterwards. A1 again (16:57), with the original clip in place, by open -a of the Moved file into a new library "Phase 0 moved 3" (Jason chose New… in the library question): it plays the colour bars, and the library's copy is the Moved clip (md5 0f6ba7a7…). A1 is confirmed: the relative path is read from the FCPXML file's own folder.

## A2. base url

- Plays or missing? Reveal in Finder path: plays the original clip (the moving test pattern with the counter and the rainbow bar, and the tone), read by open -a into a new library "Phase 0 base url" (Jason, 2026-10-14). On disk the library's copy is the original (md5 4084ed05…), found from Elsewhere/ only through the base url. RESULT A2: the "base url" import option works: a relative src is read from it.
- Dialogs: the library question of open -a only.

## A3. First push

- Dialogs, word for word: none (Jason, 2026-10-14; Import setting "Copy to library storage location")
- Library made with no question? Yes: ~/BRIMM Video Work/Phase 0/Phase 0 pushes.fcpbundle, made 13:51:25 by the open -a.
- Project opened in the timeline, or only listed in the browser? Opened in the timeline (Jason).
- The clip's path: not copied. The library's Original Media/Phase test.mov is a symbolic link to ~/BRIMM Video Work/Phase 0/2026-10-14 Phase test (Mac Studio)/Phase test.mov (read on disk by Claude).
- du -sh of the library: 584K.
- RESULT A3: a push handed over by open -a with library location, copy assets 0 and suppress warnings makes the library with no question, opens the project, and links the video where it is, even with the Import setting at "Copy".

## A4. Second push

- A4 (same event): dialogs, and the button pressed: (seen early, in A1's third try: the same file, with no suppress warnings, imported again into "Phase 0 moved 2" by open -a) Final Cut asked: 'Application "(null)" sent an XML document that is about to replace existing items with matching names in the library "Phase 0 moved 2". Do you want to replace them?' with a box "Do not ask again." and buttons Keep Both, Replace, Cancel. Jason pressed Keep Both, without the box. Keep Both renamed the new project "A1 relative 1" (Jason's screenshot): Final Cut adds " 1" to a project whose name is taken in that event, so a push's recorded project name must be unique in its event or the Share's file name will not match it.
- A4 (with suppress warnings, by open -a, 13:52): no dialog (Jason). The event "Phase test" holds both projects, "Phase test main v1 0a0a0a" and "Phase test main v2 0a0a0a"; on disk one media link only (Original Media/Phase test.mov), so the video was not taken in twice. Final Cut made and threw away two working events of its own during the import (__Trash/Phase test 2-…, __Trash/10-14-26-…). RESULT A4: suppress warnings stops the replace-or-keep-both question, and a second push lands as a new project in the same event.
- What the browser shows (projects, clips): the two projects (Jason's screenshot).
- A4b (own event): not run; A4 made it unneeded.
- A4c (asked by the reviewers: the A3 file pushed again, the same project name "Phase test main v1 0a0a0a" WITH suppress warnings, into Phase 0 pushes where v1 exists and carries A7's title): the replace-or-keep-both dialog CAME UP (Jason, 2026-10-14). RESULT A4c: suppress warnings does not stop that question when a project name clashes; Final Cut never replaced silently, it asked. So a push is unattended only while its project name is new. Jason pressed Keep Both: the new project is "Phase test main v1 0a0a0a 1", opened in the timeline; the old v1 (modified 2:14 PM, when A7's title went on) is kept beside it (screenshot "A4c keep both renamed v1 1").

## A5. Export XML

- Name offered in Save As, word for word: "Phase test main v1 0a0a0a", the project's name exactly (Jason, 2026-10-14)
- Folder the dialog opened on: Desktop (the first Export XML on this Mac in this test)
- Versions offered, and the default: 1.14 chosen; 1.13 and 1.12 offered (Jason)
- Saved as (name, .fcpxmld or .fcpxml): ~/BRIMM Video Work/From Final Cut/Phase test main v1 0a0a0a.fcpxmld, a bundle holding Info.fcpxml (4.5 KB). Read on disk by Claude: `<fcpxml version="1.14">`; no import-options; the asset carries uid="4143783927F6071F548CCE6E9DD17FD5" and its media-rep sig= the same value, the whole file:// path of the video, and one `<bookmark>`; the events sit in `<library location="file:///…/Phase%200%20pushes.fcpbundle/">`; the project carries uid and modDate. The same asset uid appeared in another library's event made from the same file, so it is a signature of the media, not of the library.
- RESULT A5: the export is a .fcpxmld bundle named exactly after the project, at version 1.14 unless she picks another.

## A6. Share

- The destination (Jason's screenshot, 2026-10-14): Export File with Format Video and Audio, Video Codec H.264, Resolution "Same as Source", Color Space Standard - Rec. 709, Audio Format AAC, Include chapter markers on, Action QuickTime Player (default), changed by Jason to "Save Only" (the setup's choice). There is no place for a folder in it: confirmed, the folder is chosen in the save dialog after Next.
- Name offered, and the file type: "Phase test main v1 0a0a0a", .mov (Jason)
- Folder the save dialog opened on: From Final Cut, the folder the Export XML had just saved into (Jason)
- What ls showed while it rendered (Claude's watcher, every 0.2 s, a6-watch.log): the file appeared at 14:06:37.9 under its FINAL name, "Phase test main v1 0a0a0a.mov", at 7 KB, and grew in place to 4 000 463 bytes by 14:06:40.0. No temporary name.
- Finished file: name, extension, size: Phase test main v1 0a0a0a.mov, 4.0 MB; ffprobe: H.264 1920x1080, AAC, a third track Final Cut writes, 20.000 s.
- Export XML's dialog after the Share opened on: From Final Cut (Jason)
- RESULT A6: a Share is named exactly after the project, as a .mov, and is written under its final name while it renders, so finish must wait for the size to settle and ffprobe to read it whole (as the spec says). Both dialogs open on the folder last used by either: once From Final Cut is chosen, it stays chosen.

## A7. Template

- Done or skipped: done (Jason, 2026-10-14). Made in Motion from Blank > Final Cut Pro > Final Cut Title, Broadcast HD 1080, 30 fps; saved as "Phase 0 Title" in the new category "Phase 0 test".
- Found in the Titles browser? Yes, and it shows on the video (Jason).
- The uid, exactly (A7 template.fcpxmld, read by Claude): uid="~/Titles.localized/Phase 0 test/Phase 0 Title/Phase 0 Title.moti", with src="file:///Users/jasonogden/Library/Containers/com.apple.FinalCut/Data/Movies/Motion%20Templates.localized/Titles.localized/Phase%200%20test/Phase%200%20Title/Phase%200%20Title.moti"
- Where the template file is: ~/Movies/Motion Templates.localized/Titles.localized/Phase 0 test/Phase 0 Title/ (Phase 0 Title.moti, large.png, small.png, Media/), which is in Dropbox: ~/Movies links to Dropbox-Ogden28.5/Jason Ogden/Mac/Movies. Motion wrote it there itself.
- RESULT A7: Final Cut finds a template through the linked ~/Movies, and its uid starts "~/Titles.localized/…", the same on any Mac with the template in the same place. The effect's src is a whole path through Final Cut's own container, with the user's name in it, so an export carried to Sallie's Mac has a src that is wrong there; phase 5 drops or rewrites it, and Sallie's laptop (part C) shows whether Final Cut goes by the uid.

## B1. Titles, role, picture

- Imported by open -a into a new library "Phase 0 part B" (Jason, 2026-10-14).
- Words-only Basic Title looks like one added by hand? NO: at 1 s nothing shows, only a tiny white mark mid-frame (Jason's screenshot at 2:09). A title written with words only and no text-style-def is not drawn as the template's own look.
- Styled title shows Helvetica 90 white? Yes (Jason).
- Lower third: both lines, in place? Yes, but the words are tiny (Jason).
- Role BRIMM titles: where, on which clips? The two titles given role="BRIMM titles" (1 s and 11 s) show in a colour of their own in the timeline, unlike "B1 with a style" (the usual Titles colour) (Jason's screenshot).
- Picture: half size? Moved which way? Yes, half size and moved (Jason). Numbers: from the B1 export. Inspector for the picture (position "40 -20", scale 0.5, in the 1920x1080 project; Jason's screenshot, 16:5x): Position X 432.0 px, Y −216.0 px; Scale 50%. 432 = 40% of 1080 and 216 = 20% of 1080, so adjust-transform position is in percent of the FRAME'S HEIGHT on both axes (not of the width: that would be 768), positive X right, negative Y down.
- The B1 export (From Final Cut/B1 export.fcpxmld, read by Claude): each words-only title came back with a text-style Final Cut filled in itself: font Helvetica, fontSize 6, fontFace Regular, white. That is why the Basic Title was a tiny mark and the lower third tiny: Final Cut does NOT take the template's own font and size for a title given words only; it uses Helvetica 6. The styled title kept Helvetica 90 white, centred. The role came back as role="BRIMM titles.BRIMM titles-1": Final Cut made a role "BRIMM titles" with a subrole "BRIMM titles-1". The lower third gained two Position params (the template's own places, "-764.941 -384" and "-763.7 -438"). The picture kept adjust-transform position="40 -20" scale="0.5 0.5" as given.
- RESULT B1: every title brimm-video writes must carry its own font, size and place (until a template with its own look is used, and even then a words-only title gets Helvetica 6); a custom role holds, as "<role>.<role>-1"; a still's transform is kept as written.

## B2. Upright, filled

- Import (open -a into "Phase 0 part B", Jason, 2026-10-14): Final Cut imported it with a warning: "Your XML was imported with the following warnings. Depending on the warnings, you may want to modify the XML, then import it again. B2 upright, filled.fcpxml: Encountered an unexpected value. (format="r3": /fcpxml[1]/event[1]/project[1]/sequence[1]/@format)". The upright format was written with width 1080, height 1920 and frameDuration 1/30s but no name.
- Project size: 1080x1920, 30 fps, as given, despite the warning (Jason's screenshots).
- B2b's import: no warning, as far as Jason recalls.
- First half (fill + position "20 0"): does NOT fill. The picture is smaller than the frame's width and moved to the right, cut by the right edge (screenshot at 4:22). Numbers: from the B2 export.
- Second half (fill only): does NOT fill: the picture spans the frame's width, centred, with black above and below, as "fit" would put it (screenshot at 12:12).
- Title in the upright frame: "A title, upright" shows, small, on the first clip (screenshot at 4:22).
- The file was imported twice: Final Cut named the second "B2 upright, filled 1".
- A project made by hand with File > New > Project… and custom settings came out 720 x 1280, 30 fps (Jason's screenshot). Set to 1080x1920 and exported (B2 hand-made upright.fcpxmld): Final Cut's own upright format has NO name either: <format frameDuration="100/3000s" width="1080" height="1920" colorSpace="1-1-1 (Rec. 709)"/>.
- The B2 export (B2 Export.fcpxmld, read by Claude) shows why fill failed: my file gave the clips no format, so they took the sequence's upright format, and Final Cut wrote format="r4" (1080x1920) on each asset-clip of the wide video. adjust-conform type="fill" and adjust-transform position="20 0" were kept as written. So B2 tested a wide video labelled upright, not fill. Made B2b ("B2b upright, filled, clip format given.fcpxml" in edit/): each asset-clip carries format="r1" (the wide format), and both formats carry colorSpace as Final Cut writes it.
- B2b, imported by open -a into Phase 0 part B (Jason, 14:44): both halves FILL the upright frame (screenshots "B2b first half…", "B2b second half…"). Measured on the screenshots (the frame is 540 px wide at 50%): in the second half (fill only) the blue|yellow edge of the test pattern sits at 50% of the frame's width, centred; in the first half (fill and position "20 0") it sits at 85.6%, so the picture moved RIGHT by 35.6% of the frame's width = 384 px of 1080 = 20% of the frame's HEIGHT (1920). RESULT B2: adjust-conform fill is honoured when each clip names its own (wide) format; adjust-transform position is in percent of the frame's height, positive X to the right (and, from B1's "40 -20" moving right and down, negative Y down).

## B3. Timecode

- B3 timecode: the Inspector shows the start 01:00:00:00, as the file gave it (asset start="3600s") (Jason, 2026-10-14). RESULT B3: an asset's start timecode written into the FCPXML is taken.
- iPhone clip (Jason, IMG_3642, about 5.8 s, imported into Phase 0 part B, copied into the library under the "Copy" setting; export "B3 iPhone.fcpxmld", read by Claude): <asset … start="0s" duration="3499/600s" format="r3">, so NO start timecode; its format is <format frameDuration="20/600s" width="1080" height="1920" colorSpace="9-18-9 (Rec. 2020 HLG)"/>: upright, 30 fps, and HDR (Rec. 2020 HLG), on a 600-a-second clock. (The project made for it by hand came out 720x1280 Rec. 709.)
- RESULT B3 (iPhone): this iPhone clip carries no start timecode, so there is nothing to subtract for it; it is HDR (HLG), so brimm-video's writer must give an iPhone asset its own colour space (from ffprobe), not Rec. 709.
- iPhone clip: start shown: see above (start 0).
- The <asset …> line from the export: see above.

## B4. Library backups

- Seen on disk by Claude, 14:20: Final Cut had already backed up "Phase 0 pushes" (the push-made library) and "Phase 0 base url" into ~/Movies/Final Cut Backups.localized/<library>/20261014_1414_EDT.fcpbundle, that is into Dropbox, about 23 minutes after they were made. The library's own Settings.plist holds only backupFolderName and libraryID, so the backup place is not in the library by default.
- Where backups went by default: seen in BRIMM rough cuts' Library Properties (Jason's screenshot, 2026-10-14): Backups "Final Cut Backups", that is ~/Movies/Final Cut Backups.localized, which is in Dropbox on the Mac Studio. Check the new Phase 0 libraries too.
- Phase 0 pushes, before: Library Properties > Storage Locations > Backups showed "Final Cut Backups" (Jason).
- Set to ~/BRIMM Video Work/Backups/: took (Jason, 14:55). On disk (Claude): the library's Settings.plist gained "backupLocation" (a macOS bookmark, 872 bytes) and "backupsEnabled" = true; before, it held only backupFolderName and libraryID. So the setting lives in the library's own Settings.plist, and a library with no backupLocation backs up to ~/Movies/Final Cut Backups (Dropbox on the Mac Studio), about 20 minutes after it is made.
- Seen on disk at 17:09 (Claude): since Backups was set to ~/BRIMM Video Work/Backups at 14:55, "Phase 0 pushes" has not been backed up anywhere: that folder is still empty, and its last backup in ~/Movies is from 14:52, though Jason trimmed one of its projects at 15:06. Libraries left on the default kept backing up into ~/Movies/Final Cut Backups.localized after their changes (Phase 0 part B at 14:34, 14:58, 15:13, 16:12, 16:50; Phase 0 dropbox and the Deploy test library at 16:49–16:50). "Phase 0 second" (backupLocation set, no backupsEnabled) has no backups anywhere. So setting the folder by hand has, so far, stopped the backups rather than moved them. Not known why (Final Cut's sandbox and that folder, or a backup only on some other event).
- Any other way to set it? Not by an import option. Possible but untried: brimm-video writing backupLocation into Settings.plist itself while Final Cut has the library closed (a bookmark is tied to this Mac). For now: the skill names the step at an episode's first push, and a push can read Settings.plist and warn while backupLocation is missing.

## B5. Hand edit and the library's files

- What find listed (Claude, after Jason's trim of "Phase test main v2 0a0a0a" at about 15:06; marker made 15:02): Phase test/Phase test main v2 0a0a0a/CurrentVersion.fcpevent and Phase test/CurrentVersion.fcpevent at 15:06:02 (the trim), and also "Phase test main v1 0a0a0a" and "Phase test main v1 0a0a0a 1" at 15:04:07, projects Jason only looked at (comparing the title's place), plus render and thumbnail files. RESULT B5: a trim changes the project's own CurrentVersion.fcpevent at once, but so does opening or viewing a project, so a file's time alone cannot tell a hand edit from a look; the guard keeps asking.

## B6. Stripped export

- Done with the A7 export instead of A5 (it has the template too), by Claude, with strip-export.mjs now also dropping the event's uid and the template's src: "1 bookmark(s) dropped, 3 uid(s) taken off, 1 template src(s) dropped, 1 library location(s) replaced." → Phase 0/A7 stripped.fcpxml (passes the 1.14 DTD).
- B6b (Claude made "A7 stripped, push form.fcpxml": the <library> element and smart collections taken out, import-options added with library location "Phase 0 second b", copy assets 0, suppress warnings 1): by open -a, NO dialog; Final Cut made "Phase 0 second b" itself; the video is a link (copy assets 0 honoured); the title is in the timeline (Jason). At Fit, Jason did not see the title's words. Both B6 libraries' Effects.map name the template file the same way (Movies/Motion Templates.localized/Titles.localized/Phase 0 test/Phase 0 Title/Phase 0 Title.moti), and the title and effect lines in the two files are identical, so this ties to the open A7 point (the title sat half out of the frame at the left in B6 too).
- Dialogs; library made or asked; plays? By open -a: Final Cut ASKED which library to import into (Jason): an export's <library location=…> element does not make Final Cut use or make that library, as import-options' "library location" does. Jason chose New… → "Phase 0 second". The project "Phase test main v1 0a0a0a stripped" plays, and the "Phase 0" title shows (the template's own text, part way through its move in from the left; screenshot "B6 stripped export, template by uid alone"). RESULT B6: an export with its bookmarks, its asset, event and project uids and its template's src taken off, and a new project name, imports cleanly into a second library, and Final Cut finds a custom template by its uid alone. The library location must be given as an import option, not by the export's <library> element. Jason saw the title half out of the frame on the left, low down, in the stripped copy AND now in the original v1 too, so stripping did not move it; but he says that is not where it sat when he first dropped it onto v1. The template's file (unchanged since 14:13) puts its text at Y −436 (low), and the A7 export carries no position for the title, only its words in Helvetica 48. Not explained: something moved the title in v1 between the drop (about 14:14) and now, with no edit by hand. Open point for phase 6 (real templates): check that a title stays where it was put after a push, an export and a re-import.

## B7. Clip linked in Dropbox

- Done by a push file instead of File > Import > Media (whose window did not show the Dropbox folders): Phase 0/Pushed/B7 Dropbox push.fcpxml, the A3 push file with its src pointing at the clip cloned (cp -c) into The BRIMM DB/Phase 0 test (delete after)/, library location Phase 0 dropbox.fcpbundle, copy assets 0, suppress warnings, project "B7 Dropbox main v1 0a0a0a".
- Imported and played? Yes, no dialog (Jason, about 16:15).
- An hour later: still plays (Jason, about 17:15; the library had been closed in Final Cut and was opened again). On disk the clip in Dropbox is whole (size 671 989, 1320 blocks), and the library still holds the link to it. RESULT B7: a push that links a raw video inside Dropbox works, and still works an hour later.
- Warnings: none.

## Anything else seen

-
