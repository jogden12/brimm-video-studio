// Phase 0, step B6: makes a copy of a Final Cut export as phase 5 would carry it to another Mac, so that it can be tried in a
// second library: every bookmark dropped, the uids on assets and on the project taken off, the library location replaced,
// and the project given a new name. Template uids (on effects) are kept. It writes one new file and changes nothing else.
//
//   node docs/phase-0/strip-export.mjs "<export .fcpxmld or .fcpxml>" "<new .fcpxml>" "<library .fcpbundle>"
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const [from, to, library] = process.argv.slice(2).map((p) => p && resolve(p));
if (!from || !to || !library || !library.endsWith(".fcpbundle")) {
  process.stderr.write('Give the export, the new file and the library: node docs/phase-0/strip-export.mjs "<export>" "<new .fcpxml>" "<library .fcpbundle>"\n');
  process.exit(2);
}
const file = statSync(from).isDirectory() ? join(from, "Info.fcpxml") : from;
const fileUrl = (path) => "file://" + path.split("/").map(encodeURIComponent).join("/");
let xml = readFileSync(file, "utf8");
const counted = (re) => (xml.match(re) || []).length;
const said = { bookmarks: counted(/<bookmark>[\s\S]*?<\/bookmark>/g), uids: counted(/<(?:asset|project)\b[^>]*\suid="/g), library: counted(/<library\b[^>]*\slocation="/g) };
xml = xml.replace(/\s*<bookmark>[\s\S]*?<\/bookmark>/g, "");
xml = xml.replace(/(<(?:asset|project)\b[^>]*?)\s+uid="[^"]*"/g, "$1");
xml = xml.replace(/(<library\b[^>]*?\slocation=")[^"]*(")/, `$1${fileUrl(library)}/$2`);
xml = xml.replace(/(<project\b[^>]*?\sname=")([^"]*)(")/, "$1$2 stripped$3");
writeFileSync(to, xml);
process.stdout.write(`Wrote ${to}: ${said.bookmarks} bookmark(s) dropped, ${said.uids} uid(s) taken off, ${said.library} library location(s) replaced.\n`);
