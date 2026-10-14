// Phase 0, step B7 (and any push to try by hand): writes a push file as phase 1a hands one to Final Cut, for a video
// anywhere on this Mac: the video by its whole path, and import options naming the library, copy assets 0 and suppress
// warnings. It writes one new file on this Mac's own disk and changes nothing else.
//
//   node docs/phase-0/push-file.mjs "<video>" "<library .fcpbundle>" "<project name>" "<new .fcpxml>"
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fcpxml } from "../../tool/fcpxml.js";

const [video, library, project, to] = process.argv.slice(2);
if (!video || !library || !project || !to || !library.endsWith(".fcpbundle")) {
  process.stderr.write('Give the video, the library, the project and the new file: node docs/phase-0/push-file.mjs "<video>" "<library .fcpbundle>" "<project name>" "<new .fcpxml>"\n');
  process.exit(2);
}
if (/\/Library\/CloudStorage\//.test(resolve(to))) {
  process.stderr.write("Write the push file on this Mac's own disk, not into a cloud drive.\n");
  process.exit(2);
}
const probe = ["/opt/homebrew/bin/ffprobe", "/usr/local/bin/ffprobe", "/usr/bin/ffprobe"].find(existsSync);
const r = spawnSync(probe, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", resolve(video)], { encoding: "utf8" });
if (r.status !== 0) {
  process.stderr.write(`ffprobe could not read ${video}: ${r.stderr}`);
  process.exit(1);
}
const said = JSON.parse(r.stdout);
const pic = said.streams.find((s) => s.codec_type === "video");
const sound = said.streams.find((s) => s.codec_type === "audio");
const facts = { duration: Number(said.format.duration), frameRate: pic.r_frame_rate, width: pic.width, height: pic.height, hasAudio: Boolean(sound), audioRate: sound ? Number(sound.sample_rate) : 0, audioChannels: sound ? sound.channels : 0 };
const fileUrl = (path) => "file://" + String(path).split("/").map(encodeURIComponent).join("/");
const options = [["library location", fileUrl(resolve(library))], ["copy assets", "0"], ["suppress warnings", "1"]];
const xml = fcpxml({ video: resolve(video), facts, ranges: [{ start: 0, end: facts.duration }], project, event: basename(resolve(video), ".mov") })
  .replace('<fcpxml version="1.10">', `<fcpxml version="1.10">\n  <import-options>\n${options.map(([k, v]) => `    <option key="${k}" value="${v}"/>`).join("\n")}\n  </import-options>`);
writeFileSync(resolve(to), xml);
process.stdout.write(`Wrote ${resolve(to)}. Hand it to Final Cut with: open -a "Final Cut Pro" "${resolve(to)}"\n`);
