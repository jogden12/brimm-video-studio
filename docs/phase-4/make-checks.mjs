// The files for phase 4's by-hand checks (docs/phase-4/checks.md), from brimm-video's own writer: two made-up clips and two
// made-up pictures, and the Final Cut files, written into ~/BRIMM Video Work/Phase 4 checks/, which is outside Dropbox (or
// into the folder given, for a dry run). Each file imports into one library there, "Phase 4 checks".
// Run by hand: node docs/phase-4/make-checks.mjs [<folder>]. It needs ffmpeg, as docs/phase-0/make-files.mjs does.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fcpxml, fileUrl, checkFcpxml } from "../../tool/fcpxml.js";
import { captionLook, titleLook, placeOf, lookFor, LOOK_PRESETS } from "../../tool/styles.js";
import { runGuarded } from "../../tool/guard.js";

const INTO = process.argv[2] ? resolve(process.argv[2]) : join(homedir(), "BRIMM Video Work", "Phase 4 checks");
const LIBRARY = join(INTO, "Phase 4 checks.fcpbundle");
const FFMPEG = ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"].find(existsSync);
if (!FFMPEG) throw new Error("ffmpeg is not installed where brimm-video looks for it.");
mkdirSync(INTO, { recursive: true });
/** ffmpeg under the watchdog (tool/guard.js), as every ffmpeg brimm-video runs that could run away: its memory capped at 2 GB
    and its time at two minutes, and everything it started killed with it. */
const run = async (args) => {
  const ran = await runGuarded(FFMPEG, ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...args], { most: 2 * 1024 ** 3, limit: 120000 });
  if (ran.code !== 0) throw new Error(ran.stopped || ran.stderr);
};
// Two made-up clips of 20 seconds with a tone, 1920 by 1080 and 1280 by 720 (a Zoom recording's size), and a logo and a chart.
const clip = async (name, size) => {
  const path = join(INTO, name);
  await run(["-f", "lavfi", "-i", `testsrc=size=${size}:rate=30:duration=20`, "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=20", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ac", "2", "-shortest", path]);
  return path;
};
const HD = await clip("Phase 4 clip.mov", "1920x1080");
const SMALL = await clip("Phase 4 clip 720p.mov", "1280x720");
await run(["-f", "lavfi", "-i", "color=c=white:size=600x300", "-frames:v", "1", join(INTO, "logo.png")]);
await run(["-f", "lavfi", "-i", "testsrc2=size=1600x900", "-frames:v", "1", join(INTO, "chart.png")]);
const at = (width, height) => ({ duration: 20, frameRate: "30/1", width, height, hasAudio: true, audioRate: 48000, audioChannels: 2 });
const UPRIGHT = { width: 1080, height: 1920 };
const WIDE = { width: 1920, height: 1080 };
const SMALL_WIDE = { width: 1280, height: 720 };
// Two pieces with a join at 9 seconds of the timeline (9 to 11 of the clip is cut): a title over it is written once on each
// side of it (ruling 8), and check 1 sees whether it plays its build-in again there. Times below are the clip's; on the
// timeline, a time after the join is 2 seconds earlier.
const crop = { x: 657, y: 0, w: 606, h: 1080, found: true };
const joined = (cropped) => [{ start: 0, end: 9, ...(cropped ? { crop } : {}) }, { start: 11, end: 20, ...(cropped ? { crop } : {}) }];
const written = [];
// Each file goes into the checks' library without a question, unless `bare`: then Final Cut says what it would warn of.
const write = (name, text, facts, frame, { bare = false } = {}) => {
  const problems = checkFcpxml(text, facts, frame ? { frame } : {});
  if (problems.length) throw new Error(`${name}: ${problems.join(" ")}`);
  writeFileSync(join(INTO, name), text.replace("<resources>", `<import-options><option key="library location" value="${fileUrl(LIBRARY)}"/><option key="copy assets" value="0"/>${bare ? "" : '<option key="suppress warnings" value="1"/>'}</import-options>\n    <resources>`));
  written.push(name);
};
const line = (text, look, face) => ({ text, font: face, fontSize: look.fontSize, shadow: look.shadow, ...(look.alignment ? { alignment: look.alignment } : {}) });

// 1. Titles. Upright: a caption, a Reel's title over the join, and a name title in the top band; in Varela, and again in
// Lucida Grande, the stand-in on a Mac without Varela. Wide, at 1080 and at 720 lines: a caption, a name over a role on the
// Basic Lower Third over the join, and a name with no role.
const upright = (face, name) => {
  const caption = captionLook({ style: "plain", job: "solo-clip", frame: UPRIGHT, face });
  const hook = titleLook("hook", { style: "plain", frame: UPRIGHT, face });
  const named = titleLook("name", { style: "plain", frame: UPRIGHT, face });
  write(name, fcpxml({ video: HD, facts: at(1920, 1080), ranges: joined(true), frame: UPRIGHT, project: `Phase 4, ${name.replace(/\.fcpxml$/, "")}`, event: "Phase 4 checks", titles: [
    { start: 1, end: 5, lane: 4, name: "check caption", role: "BRIMM captions", lines: [line("So the first thing", caption, face)], position: caption.position },
    { start: 7, end: 15, lane: 5, name: "check title over a join", role: "BRIMM titles", lines: ["Know your", "costs"].map((text, i) => line(text, hook.lines[i], face)), position: hook.position },
    { start: 15, end: 19, lane: 5, name: "check upright name", role: "BRIMM titles", lines: ["Sallie Ogden", "Founder, The BRIMM"].map((text, i) => line(text, named.lines[i], face)), position: named.position }
  ] }), at(1920, 1080), UPRIGHT);
};
upright("Varela", "1 titles upright.fcpxml");
upright("Lucida Grande", "1 titles upright lucida.fcpxml");
const wide = (video, frame, name) => {
  const face = "Varela";
  const caption = captionLook({ style: "plain", job: "as-filmed", frame, face });
  const named = titleLook("name", { style: "plain", frame, face });
  const facts = at(frame.width, frame.height);
  write(name, fcpxml({ video, facts, ranges: joined(false), project: `Phase 4, ${name.replace(/\.fcpxml$/, "")}`, event: "Phase 4 checks", titles: [
    { start: 1, end: 4, lane: 4, name: "check wide caption", role: "BRIMM captions", lines: [line("So the first thing you need to do", caption, face)], position: caption.position },
    { start: 6, end: 14, lane: 5, name: "check lower third over a join", role: "BRIMM titles", template: "lower-third", lines: ["Sallie Ogden", "Founder, The BRIMM"].map((text, i) => line(text, named.lines[i], face)) },
    { start: 15, end: 19, lane: 5, name: "check name alone", role: "BRIMM titles", template: "lower-third", lines: [line("Sallie Ogden", named.lines[0], face)] }
  ] }), facts);
};
wide(HD, WIDE, "1 titles wide.fcpxml");
wide(SMALL, SMALL_WIDE, "1 titles wide 720p.fcpxml");

// 3. Pictures, upright: the logo, and the chart full, in the corner and in the lower place, each on the role BRIMM titles. The
// same again in an event of its own, without suppress warnings, so that Final Cut says anything it would warn of.
const logo = { width: 600, height: 300 };
const chart = { width: 1600, height: 900 };
const still = (src, size, place, start, end, lane) => ({ start, end, lane, name: `check ${place}`, role: "BRIMM titles", src: fileUrl(join(INTO, src)), width: size.width, height: size.height, ...placeOf(place, { frame: UPRIGHT, picture: size }) });
const pictures = [still("logo.png", logo, "logo", 0, 20, 3), still("chart.png", chart, "full", 1, 5, 2), still("chart.png", chart, "corner", 6, 10, 2), still("chart.png", chart, "lower", 11, 15, 2)];
write("3 pictures.fcpxml", fcpxml({ video: HD, facts: at(1920, 1080), ranges: [{ start: 0, end: 20, crop }], frame: UPRIGHT, project: "Phase 4, 3 pictures", event: "Phase 4 checks", stills: pictures }), at(1920, 1080), UPRIGHT);
write("3 pictures bare.fcpxml", fcpxml({ video: HD, facts: at(1920, 1080), ranges: [{ start: 0, end: 20, crop }], frame: UPRIGHT, project: "Phase 4, 3 pictures bare", event: "Phase 4 checks bare", stills: pictures }), at(1920, 1080), UPRIGHT, { bare: true });

// 2b. A look, once check 2's exports have given Final Cut's preset for it (styles.js LOOK_PRESETS): one project for each.
for (const look of Object.keys(LOOK_PRESETS)) {
  write(`2 look ${look}.fcpxml`, fcpxml({ video: HD, facts: at(1920, 1080), ranges: [{ start: 0, end: 20 }], project: `Phase 4, 2 look ${look}`, event: "Phase 4 checks", look: lookFor({ look, height: 1080, hdr: false }).effect }), at(1920, 1080));
}
console.log(`Written into ${INTO}: ${written.join(", ")}. Open each with: open -a "Final Cut Pro" "<file>". Then follow docs/phase-4/checks.md.`);
