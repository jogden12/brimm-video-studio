**Can a script write a Final Cut Pro project? Yes. Findings as of 2026-10-13.**

Nothing was installed or changed. The sample files I wrote are in the session scratchpad only. No generated file has been opened in Final Cut Pro yet, so "validates" below means it passes the DTD, not that it imports.

## On this Mac (JCO mac studio, macOS 27.0.1)

- **Installed:** Final Cut Pro 12.4, Motion 6.4, Compressor 5.4, iMovie 10.4.5, Logic Pro 12.4.
- **Not installed:** DaVinci Resolve, CapCut, Premiere. Creative Cloud holds only Photoshop, Lightroom Classic, Bridge and Acrobat.
- **Tools present:** `/usr/bin/xmllint`, `/opt/homebrew/bin/ffprobe`, and `whisper-cli`, which has word-timing flags (`-ml`, `-sow`, `-ojf`, `-dtw`). The `opentimelineio` Python module is absent.

## FCPXML version and readers

- **Current version is 1.14**, introduced by Final Cut Pro 12.0 on 2026-01-28. Earlier: 1.13 with 11.0, 1.12 with 10.8, 1.10 with 10.6, 1.9 with 10.4.9. The release for 1.11 is not verified. (https://support.apple.com/102825, https://developer.apple.com/documentation/professional-video-applications/fcpxml-reference)
- **12.4 carries DTDs 1.0 to 1.14** in `/Applications/Final Cut Pro.app/Contents/Frameworks/Interchange.framework/Versions/A/Resources/`. That suggests it reads all of them; not verified by import. An older Final Cut Pro rejects a newer version.
- **Nothing we need is newer than 1.10.** I diffed the DTDs: 1.11 to 1.14 add voice isolation, colour conform, stereo 3D and transcript/visual search rules. Captions arrive in 1.8 and `media-rep` in 1.9. Writing 1.10 to 1.13 keeps older copies of Final Cut Pro able to open the file.
- **Both `.fcpxml` and `.fcpxmld` are registered document types.** Import is File > Import > XML, a double-click, or a drag onto the app icon. (https://support.apple.com/guide/final-cut-pro/verdbd66ae/mac)
- **A script can send the file** with `tell application "Final Cut Pro" to open POSIX file "…"`. Final Cut Pro then asks which library, unless the file names one. (https://developer.apple.com/documentation/professional-video-applications/sending-data-programmatically-to-final-cut-pro)
- **Import options** are `copy assets`, `library location`, `suppress warnings` and `base url`. (https://developer.apple.com/documentation/professional-video-applications/import-options)

## Smallest file: one video cut into three kept pieces

This passes the 1.14 DTD on this Mac. It assumes 29.97 fps, where every time is N × 1001/30000 s.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.14">
  <resources>
    <format id="r1" name="FFVideoFormat1080p2997" frameDuration="1001/30000s" width="1920" height="1080" colorSpace="1-1-1 (Rec. 709)"/>
    <asset id="r2" name="episode-raw" start="0s" duration="1801800/30000s" hasVideo="1" format="r1" hasAudio="1" videoSources="1" audioSources="1" audioChannels="2" audioRate="48000">
      <media-rep kind="original-media" src="file:///Users/example/Movies/BRIMM/episode-raw.mov"/>
    </asset>
  </resources>
  <event name="Claude rough cuts">
    <project name="Episode rough cut">
      <sequence format="r1" duration="1051050/30000s" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
        <spine>
          <asset-clip ref="r2" offset="0s" name="Keep 1" start="0s" duration="300300/30000s" audioRole="dialogue"/>
          <asset-clip ref="r2" offset="300300/30000s" name="Keep 2" start="450450/30000s" duration="450450/30000s" audioRole="dialogue"/>
          <asset-clip ref="r2" offset="750750/30000s" name="Keep 3" start="1201200/30000s" duration="300300/30000s" audioRole="dialogue"/>
        </spine>
      </sequence>
    </project>
  </event>
</fcpxml>
```

- `offset` is the position on the parent's timeline, `start` is the in-point in the source, and `duration` is the length. All are rational seconds with a 64-bit numerator and 32-bit denominator. (https://developer.apple.com/documentation/professional-video-applications/timing-attributes)
- `src` is a percent-encoded `file://` URL, or a URL relative to the FCPXML file itself. (https://developer.apple.com/documentation/professional-video-applications/media-rep)

## What else the file can hold (all checked against the 1.14 DTD)

- **Captions:** a `caption` element cannot sit directly in the spine. It is anchored to a clip or gap with a `lane`, and its `role` carries the format and language. A real export shows `role="iTT?captionFormat=ITT.en"` with a `text` child. (https://github.com/orchetect/swift-fcpxml, `Annotations.fcpxml`)
  - Apple documents ITT and CEA608 as format values. The SRT form (`SRT?captionFormat=SRT.en`) is not verified. (https://developer.apple.com/documentation/professional-video-applications/roles-attribute)
  - The other route is File > Import > Captions for `.srt`, `.itt` or `.scc`, which is a manual menu step. (https://support.apple.com/guide/final-cut-pro/ver4185ef95a/mac)
  - 12.3 added Generate Captions with styling, U.S. English only. It is a click and cannot be triggered from a file.
- **Titles and lower thirds:** `<title ref="…">` points to an `effect` resource whose `uid` is a Motion template path. A real export shows `.../Titles.localized/Bumper:Opener.localized/Basic Title.localized/Basic Title.moti`. Text goes in `text` / `text-style` (font, size, colour, stroke, shadow, alignment).
  - The app bundle ships 495 title templates (357 + 138), including 36 in Lower Thirds, 11 "… Lower Third" in Simple, and Basic Lower Third.
  - The Basic Lower Third uid is inferred from the same pattern, not confirmed from an export.
  - `~/Movies/Motion Templates.localized` holds no custom templates. The uid form for a custom template is not verified.
- **Markers and keywords:** `marker` (a `completed` attribute makes it a to-do), `chapter-marker`, `keyword` (comma list over a range) and `rating` (`favorite` or `reject` over a range).
- **Retakes:** `audition` holds one active take plus alternates.
- **B-roll:** an `asset-clip` with `lane="1"` nested inside the primary clip, with `srcEnable="video"`. Its `offset` is in the parent's source time, not timeline time.
- **Music:** an audio asset as `asset-clip lane="-1"` with `audioRole="music"` and `<adjust-volume amount="-18dB"/>`. Keyframes allow ducking.
- **Transitions:** a `transition` between spine items with a `filter-video` reference. Cross Dissolve exports as uid `FxPlug:4731E73A-8DAC-4113-9A30-AE85B1761265`. The clips on each side need spare media beyond the cut, so a dissolve over a removed retake shows the retake.
- **Vertical:** a custom `format` with `width="1080" height="1920"` and a `frameDuration`; attributes override the name. `<adjust-conform type="fill"/>` and `adjust-transform` reframe each clip. Smart Conform's face analysis is a menu command only. No `1080x1920` preset name appears in the app binary's strings. (https://developer.apple.com/documentation/professional-video-applications/format)

## What makes an import fail

These messages are Final Cut Pro 12.4's own, read from its string table.

- **"DTD validation failed."** A file that does not match the DTD is rejected whole. Typical causes are wrong child order (anchored items must come before markers and keywords), a caption in the spine, or a dangling or duplicate id. (https://developer.apple.com/documentation/professional-video-applications/document-type-definition)
- **"The item is not on an edit frame boundary."** Times must be multiples of the timeline's frame duration. Otherwise Final Cut Pro inserts a gap and warns. Whisper's millisecond times must be snapped to frames.
- **"Invalid edit with no respective media."** A clip range runs outside the asset's duration. Take the duration and frame rate from ffprobe.
- **"The effect ID is invalid." / "Missing Effect".** The template uid is not installed on that Mac.
- **"The media already exists in the library with a different unique identifier."** Leave `uid` off assets.
- **Missing media path.** The clip imports offline and can be relinked.
- **Sandbox:** Final Cut Pro is sandboxed but holds a read-write exception for `/`, so a hand-written file needs no `bookmark` element. macOS may still ask for permission on cloud-synced folders, and online-only Dropbox files must be downloaded first. That last point is my inference, not verified.
- **Other traps:** spine offsets start at the sequence's `tcStart`, and titles and captions carry their own `start="3600s"`.

## Checking without opening the program

```
xmllint --noout --dtdvalid "file:///Applications/Final%20Cut%20Pro.app/Contents/Frameworks/Interchange.framework/Versions/A/Resources/FCPXMLv1_14.dtd" file.fcpxml
```

- The DTD path must be a `file://` URL with `%20`. The plain path with spaces fails with "Could not parse DTD".
- A richer sample passed with exit 0. It has three cuts, a lower third, a caption, a marker, a keyword, b-roll, music, a dissolve and a chapter marker.
- Three broken variants were caught with exit 3: a caption in the spine, a marker before anchored items, and an unknown `ref`.
- Off-frame times passed the DTD. Frame alignment, clip ranges, file existence and template existence need our own checks.
- Samples: `/private/tmp/claude-501/-Users-jasonogden-Claude-Code-BRIMM-operations/d2df8116-6adb-4d04-a170-d3efb5b797a7/scratchpad/fcpxml-check/`

## Libraries that write it

| Library | State today | Fit |
|---|---|---|
| OpenTimelineIO core | 0.18.1, 2025-11-09 (https://github.com/AcademySoftwareFoundation/OpenTimelineIO/releases) | Core only |
| `otio-fcpx-xml-adapter` | 1.0.0, July 2023; last push 2024-06-25; not in the OpenTimelineIO-Plugins bundle (https://pypi.org/project/otio-fcpx-xml-adapter) | Poor: writes FCPXML 1.8, no titles, captions, transitions or effects |
| `swift-fcpxml` | Swift, MIT, pushed 2026-08-15 (https://github.com/orchetect/swift-fcpxml) | Mostly a reader; its test exports are useful references |
| OpenFCPXMLKit, SwiftSecuencia | Swift, experimental (https://fcp.cafe/developers/fcpxml/) | Unproven |
| `fcp-mcp-server` | Python, MIT, alpha 0.26.0; reads 1.8 to 1.14, writes 1.13 (https://pypi.org/project/fcp-mcp-server/) | Closest, but alpha |
| auto-editor | Cuts silence, `--export final-cut-pro` / `premiere` / `resolve` (https://github.com/WyattBlue/auto-editor) | Cuts only |

The subset we need is small. A writer of our own in Node, tested with the DTD and a frame check, fits the repo's no-packages rule better than any of these.

## The other programs

- **CapCut:** I found no official project format or API. CapCut's help documents only SRT/TXT subtitle import on desktop and web. (https://www.capcut.com/help/how-to-import-subtitles)
  - Community tools reverse-engineer `draft_content.json` under `~/Movies/CapCut/User Data/Projects/com.lveditor.draft/`. They report plain JSON through CapCut 8.x, 9.x untested, JianYing 6+ encrypted, and mobile and web stored differently. (https://github.com/GuanYixuan/pyCapCut, https://cdn.jsdelivr.net/npm/capcut-cli-david@2.5.0/COMPATIBILITY.md)
  - This is fragile. For CapCut, hand over an `.srt` and a cut list.
- **DaVinci Resolve:** version 21 shipped 2026-06-02 and 21.1 in September. (https://www.newsshooter.com/2026/06/02/davinci-resolve-21-final-release/)
  - The scripting README (updated 2026-07-24) lists timeline import from AAF, EDL, XML, FCPXML, DRT, ADL and OTIO. It also covers appending clips by frame range, markers, auto subtitles, titles and render jobs. (https://gist.github.com/X-Raym/2f2bf453fc481b9cca624d7ca0e19de8)
  - Resolve is the only one of the three where a script can also render the final video.
  - Resolve 21 beta 4 added Final Cut Pro 12 FCPXML import and export, per a secondary source. (https://www.motionmedia.com/mm-blog/davinci-resolve-21-beta-4-fcpxml-ai-updates)
  - Forum posts say external scripts need Studio ($295), and that timelines imported by script can arrive unlinked. Neither is verified on 21. (https://forum.blackmagicdesign.com/viewtopic.php?p=670352, https://forum.blackmagicdesign.com/viewtopic.php?p=1152861)
- **Premiere:** it reads Final Cut Pro 7 XML directly but not `.fcpxml`; Adobe points to the XtoCC converter. OpenTimelineIO import and export arrived in 26.0, January 2026. A script would write FCP 7 XML or `.otio`. (https://helpx.adobe.com/premiere/desktop/organize-media/import-files/migrate-from-final-cut-pro-x.html, https://helpx.adobe.com/premiere-pro/kb/fixed-issues.html)

## Verdict

**Realistic.** "Claude writes a Final Cut Pro project that opens with the cuts, captions and titles in place" uses only first-class FCPXML elements, the programs are already on the Mac Studio, and structure can be tested without opening the app. The open risk is that nothing has been imported yet.

**First small proof** (needs Jason's yes, since it opens Final Cut Pro and makes a test library):
1. Take one already-transcribed video as a local file and read its frame rate and duration with ffprobe.
2. Write a file with three kept ranges snapped to frames, three ITT captions, one Basic Title and one marker per removed retake.
3. Run xmllint plus a frame check, then File > Import > XML.
4. It passes if there is no warning dialog, the media is online, the cuts land on the right words, and the captions and title show.
5. Then export that project back out once to capture the true strings for SRT roles, a vertical format and a lower third.

**What the file cannot express at all:**
- **Exporting the finished video.** There is no render or share element, and the AppleScript dictionary has only `get` plus library, event, project, sequence and item. Posting-ready output stays a human click.
- **Running any analysis.** Generate Captions, Smart Conform, transcript search and beat detection cannot be requested.
- **The inside of a graphic.** Titles, transitions and effects are references to templates on that Mac, with opaque parameters. A branded lower third must be built once in Motion.
- **The media itself.** B-roll, music, images and fonts must already exist as files.
- **Judgement.** Which take looks better is not something Claude can see.

Apple itself says FCPXML covers some but not all of a project and is not a substitute for a library. Which program Sallie's editor uses is still unknown, and it decides whether FCPXML, OTIO or an `.srt` plus cut list is the right hand-off.