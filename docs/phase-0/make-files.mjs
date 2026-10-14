// Makes the made-up clips and Final Cut files for phase 0 (docs/phase-0-checklist.md), on this Mac's own disk.
// Nothing here is part of brimm-video. It writes only into the folder it is given, by default ~/BRIMM Video Work/Phase 0,
// and refuses a folder inside a cloud drive: nothing here is ever written into Dropbox.
//
//   node docs/phase-0/make-files.mjs                 makes ~/BRIMM Video Work/Phase 0
//   node docs/phase-0/make-files.mjs "<folder>"      makes it there instead
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fcpxml } from "../../tool/fcpxml.js";

const HOME = homedir();
const WORK = join(HOME, "BRIMM Video Work");
const INTO = resolve(process.argv[2] || join(WORK, "Phase 0"));
const DAY = "2026-10-14";
const MAC = "Mac Studio";
const NAME = "Phase test";
const SHORT = "0a0a0a";
const EPISODE = join(INTO, `${DAY} ${NAME} (${MAC})`);
const DTD = "/Applications/Final Cut Pro.app/Contents/Frameworks/Interchange.framework/Versions/A/Resources/FCPXMLv1_10.dtd";
const TITLE = ".../Titles.localized/Bumper:Opener.localized/Basic Title.localized/Basic Title.moti";
const LOWER = ".../Titles.localized/Lower Thirds.localized/Basic Lower Third.localized/Basic Lower Third.moti";

const stop = (why) => {
  process.stderr.write(`${why}\n`);
  process.exit(1);
};

/** The nearest folder that is there, followed through any link, so that a link into Dropbox is seen for what it is. */
function realOf(path) {
  let at = path;
  while (!existsSync(at)) at = dirname(at);
  return join(realpathSync(at), path.slice(at.length));
}

if (/\/Library\/CloudStorage\/|\/Dropbox/i.test(realOf(INTO))) stop(`${INTO} is inside a cloud drive (${realOf(INTO)}). Name a folder on this Mac's own disk.`);
if (existsSync(INTO) && readdirSync(INTO).length) stop(`${INTO} is there already and not empty. Delete it, or name another folder.`);

const program = (name) => ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"].map((dir) => join(dir, name)).find(existsSync) || stop(`${name} was not found.`);
const FFMPEG = program("ffmpeg");
const FFPROBE = program("ffprobe");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.status !== 0) stop(`${cmd} ${args.join(" ")}\n${r.stderr}`);
  return r.stdout;
}

/** A clip of 20 seconds: a moving test pattern with a frame counter, and a tone. */
function clip(file, size, extra = []) {
  run(FFMPEG, ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", `testsrc=size=${size}:rate=30:duration=20`, "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=20", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ac", "1", "-shortest", ...extra, file]);
}

/** What fcpxml() needs to know of a clip, from ffprobe. */
function factsOf(file) {
  const said = JSON.parse(run(FFPROBE, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]));
  const video = said.streams.find((s) => s.codec_type === "video");
  const sound = said.streams.find((s) => s.codec_type === "audio");
  return { duration: Number(said.format.duration), frameRate: video.r_frame_rate, width: video.width, height: video.height, hasAudio: Boolean(sound), audioRate: sound ? Number(sound.sample_rate) : 0, audioChannels: sound ? sound.channels : 0, timecode: (said.format.tags || {}).timecode || video.tags?.timecode || "" };
}

const fileUrl = (path) => "file://" + String(path).split("/").map(encodeURIComponent).join("/");
const relUrl = (path) => String(path).split("/").map(encodeURIComponent).join("/");
const frames = (facts) => Math.floor(facts.duration * 30 + 0.001);
const t = (count) => (count % 30 === 0 ? `${count / 30}s` : `${count}/30s`);
const escaped = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Puts import options at the start of a file that has none. */
const withOptions = (xml, options) => xml.replace("<fcpxml version=\"1.10\">", `<fcpxml version="1.10">\n  <import-options>\n${options.map(([key, value]) => `    <option key="${escaped(key)}" value="${escaped(value)}"/>`).join("\n")}\n  </import-options>`);

/** The video's src as written by fcpxml(), made into another. */
const withSrc = (xml, video, src) => {
  const was = `src="${fileUrl(video)}"`;
  if (!xml.includes(was)) stop("The writer's src was not found in its own file.");
  return xml.replace(was, `src="${src}"`);
};

const files = [];
function write(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  files.push(path);
}

// The clips, as a recording would come in: in an episode folder named as phase 1a names one.
mkdirSync(join(EPISODE, "media"), { recursive: true });
const wide = join(EPISODE, `${NAME}.mov`);
const upright = join(EPISODE, "Upright test.mov");
const timed = join(EPISODE, "Timecode test.mov");
const picture = join(EPISODE, "media", "Picture.png");
clip(wide, "1920x1080");
clip(upright, "1080x1920");
clip(timed, "1920x1080", ["-timecode", "01:00:00:00"]);
run(FFMPEG, ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "smptebars=size=1920x1080", "-frames:v", "1", picture]);
const facts = factsOf(wide);
const timedFacts = factsOf(timed);
const all = frames(facts);

const base = (project, event, video = wide, said = facts) => fcpxml({ video, facts: said, ranges: [{ start: 0, end: said.duration }], markers: [{ at: 2, text: "A marker at 2 seconds" }], project, event });
const library = join(INTO, "Phase 0 pushes.fcpbundle");
const pushOptions = [["library location", fileUrl(library)], ["copy assets", "0"], ["suppress warnings", "1"]];

// A1: a stored timeline, as phase 1a stores one: the video named by a path from the file's own folder, and no library.
write(join(EPISODE, "edit", "A1 relative.fcpxml"), withSrc(base("A1 relative", NAME), wide, `../${relUrl(`${NAME}.mov`)}`));
// A2: the same, read through Apple's base url option from a folder where the relative path alone would find nothing.
write(join(INTO, "Elsewhere", "A2 base url.fcpxml"), withOptions(withSrc(base("A2 base url", NAME), wide, relUrl(`${NAME}.mov`)), [["base url", fileUrl(EPISODE) + "/"]]));
// A3, A4, A4b: the local copies a push hands to Final Cut, with this Mac's paths and the push's import options.
write(join(INTO, "Pushed", "A3 first push.fcpxml"), withOptions(base(`${NAME} main v1 ${SHORT}`, NAME), pushOptions));
write(join(INTO, "Pushed", "A4 second push.fcpxml"), withOptions(base(`${NAME} main v2 ${SHORT}`, NAME), pushOptions));
write(join(INTO, "Pushed", "A4b own event.fcpxml"), withOptions(base(`${NAME} main v3 ${SHORT}`, `${NAME} main v3 ${SHORT}`), pushOptions));

// B1: built-in titles with words only and with a style, a custom role, and a still moved and made smaller.
const titles = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>

<fcpxml version="1.10">
  <resources>
    <format id="r1" name="FFVideoFormat1080p30" frameDuration="1/30s" width="1920" height="1080"/>
    <asset id="r2" name="${NAME}" start="0s" duration="${t(all)}" hasVideo="1" format="r1" videoSources="1" hasAudio="1" audioSources="1" audioChannels="1" audioRate="48000">
      <media-rep kind="original-media" src="../${relUrl(`${NAME}.mov`)}"/>
    </asset>
    <effect id="r3" name="Basic Title" uid="${TITLE}"/>
    <effect id="r4" name="Basic Lower Third" uid="${LOWER}"/>
    <format id="r5" name="FFVideoFormatRateUndefined" width="1920" height="1080"/>
    <asset id="r6" name="Picture" start="0s" duration="0s" hasVideo="1" format="r5" videoSources="1">
      <media-rep kind="original-media" src="../media/Picture.png"/>
    </asset>
  </resources>
  <event name="${NAME}">
    <project name="B1 titles and a still">
      <sequence format="r1" duration="${t(all)}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
        <spine>
          <asset-clip ref="r2" offset="0s" name="${NAME}" start="0s" duration="${t(all)}">
            <title ref="r3" lane="1" offset="1s" name="B1 words only" duration="4s" role="BRIMM titles">
              <text>
                <text-style>Words only, no style</text-style>
              </text>
            </title>
            <title ref="r3" lane="1" offset="6s" name="B1 with a style" duration="4s">
              <text>
                <text-style ref="ts1">Helvetica, 90, white</text-style>
              </text>
              <text-style-def id="ts1">
                <text-style font="Helvetica" fontSize="90" fontColor="1 1 1 1" alignment="center"/>
              </text-style-def>
            </title>
            <title ref="r4" lane="1" offset="11s" name="B1 lower third, words only" duration="4s" role="BRIMM titles">
              <text>
                <text-style>Sallie Ogden</text-style>
              </text>
              <text>
                <text-style>Founder, The BRIMM</text-style>
              </text>
            </title>
            <video ref="r6" lane="2" offset="15s" name="B1 picture, half size, moved" duration="4s">
              <adjust-transform position="40 -20" scale="0.5 0.5"/>
            </video>
          </asset-clip>
        </spine>
      </sequence>
    </project>
  </event>
</fcpxml>
`;
write(join(EPISODE, "edit", "B1 titles and a still.fcpxml"), titles);

// B2: an upright project of the wide clip: filled and moved, then filled only, with a built-in title on it. Each clip names
// its own wide format: without it, a clip takes the upright format of the project (phase 0, B2).
const half = Math.floor(all / 2);
const uprightProject = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>

<fcpxml version="1.10">
  <resources>
    <format id="r1" name="FFVideoFormat1080p30" frameDuration="1/30s" width="1920" height="1080" colorSpace="1-1-1 (Rec. 709)"/>
    <asset id="r2" name="${NAME}" start="0s" duration="${t(all)}" hasVideo="1" format="r1" videoSources="1" hasAudio="1" audioSources="1" audioChannels="1" audioRate="48000">
      <media-rep kind="original-media" src="../${relUrl(`${NAME}.mov`)}"/>
    </asset>
    <!-- An upright format has no name, as Final Cut writes its own (phase 0, B2). -->
    <format id="r3" frameDuration="100/3000s" width="1080" height="1920" colorSpace="1-1-1 (Rec. 709)"/>
    <effect id="r4" name="Basic Title" uid="${TITLE}"/>
  </resources>
  <event name="${NAME}">
    <project name="B2 upright, filled">
      <sequence format="r3" duration="${t(all)}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
        <spine>
          <asset-clip ref="r2" offset="0s" name="B2 filled and moved" format="r1" start="0s" duration="${t(half)}">
            <adjust-conform type="fill"/>
            <adjust-transform position="20 0"/>
            <title ref="r4" lane="1" offset="1s" name="B2 title in an upright project" duration="4s">
              <text>
                <text-style>A title, upright</text-style>
              </text>
            </title>
          </asset-clip>
          <asset-clip ref="r2" offset="${t(half)}" name="B2 filled only" format="r1" start="${t(half)}" duration="${t(all - half)}">
            <adjust-conform type="fill"/>
          </asset-clip>
        </spine>
      </sequence>
    </project>
  </event>
</fcpxml>
`;
write(join(EPISODE, "edit", "B2 upright, filled.fcpxml"), uprightProject);

// B3: a clip with a start timecode, as a camera writes one, with the asset starting at that time.
const startAt = 3600 * 30;
const timedAll = frames(timedFacts);
const timedXml = withSrc(base("B3 timecode", NAME, timed, timedFacts), timed, relUrl("../Timecode test.mov"))
  .replace(`<asset id="r2" name="Timecode test" start="0s"`, `<asset id="r2" name="Timecode test" start="${t(startAt)}"`)
  .replace(/(<asset-clip ref="r2" offset="0s" name="Timecode test" start=")0s(")/, `$1${t(startAt)}$2`)
  .replace(`<marker start="${t(60)}"`, `<marker start="${t(startAt + 60)}"`);
if (!timedXml.includes(`start="${t(startAt)}"`)) stop("The timecode file could not be made.");
write(join(EPISODE, "edit", "B3 timecode.fcpxml"), timedXml);

// The episode folder copied to another parent folder, as a clone, for the relative path to be read from there.
mkdirSync(join(INTO, "Moved"), { recursive: true });
run("/bin/cp", ["-c", "-R", EPISODE, join(INTO, "Moved")]);
// In the copy the video is colour bars with a higher tone, so the picture shows which folder Final Cut read it from (A1).
const moved = join(INTO, "Moved", basename(EPISODE), `${NAME}.mov`);
rmSync(moved);
run(FFMPEG, ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "smptehdbars=size=1920x1080:rate=30:duration=20", "-f", "lavfi", "-i", "sine=frequency=880:sample_rate=48000:duration=20", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ac", "1", "-shortest", moved]);
mkdirSync(join(INTO, "Screenshots"), { recursive: true });
// The folder the checklist saves Shares and exports into, made only for the run the checklist names.
if (!process.argv[2]) mkdirSync(join(WORK, "From Final Cut"), { recursive: true });
writeFileSync(join(INTO, "results.md"), readFileSync(new URL("./results-template.md", import.meta.url), "utf8"));

// Each file checked against Final Cut's own definition of the format, when Final Cut is on this Mac.
let failed = 0;
for (const file of files) {
  if (!existsSync(DTD)) break;
  // xmllint takes the definition as an address, and a path with spaces in it is not one.
  const r = spawnSync("/usr/bin/xmllint", ["--noout", "--dtdvalid", fileUrl(DTD), file], { encoding: "utf8" });
  if (r.status !== 0) {
    failed++;
    process.stderr.write(`${file} does not pass Final Cut's definition of FCPXML 1.10:\n${r.stderr}\n`);
  }
}
process.stdout.write(`Made ${INTO}\n${files.map((f) => `  ${f.slice(INTO.length + 1)}`).join("\n")}\n`);
process.stdout.write(timedFacts.timecode ? `The timecode clip starts at ${timedFacts.timecode}.\n` : "The timecode clip has no start timecode: B3 tests nothing.\n");
process.stdout.write(failed ? `${failed} file(s) failed the check.\n` : existsSync(DTD) ? "Every file passes Final Cut's definition of FCPXML 1.10.\n" : "Final Cut is not on this Mac, so the files were not checked.\n");
process.exit(failed ? 1 : 0);
