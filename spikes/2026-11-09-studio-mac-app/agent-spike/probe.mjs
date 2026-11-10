// The node child of "BRIMM Spike --agent" (spike only: S4; see ../README.md). It lists the folders Studio's background job reads: the
// Downloads folder, and any Dropbox folder this account has. For each it logs what macOS answered and how long that took: a box asking
// for permission holds the call until it is answered. It logs no file's name, only how many there are.
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const say = (line) => console.log(`${new Date().toISOString()} node: ${line}`);
const home = homedir();
say(`node ${process.version}, ${process.execPath}, process ${process.pid}, parent ${process.ppid}.`);

function look(label, dir) {
  const began = Date.now();
  try {
    const names = readdirSync(dir);
    say(`${label}: listed, ${names.length} ${names.length === 1 ? "entry" : "entries"}, after ${Date.now() - began} ms.`);
  } catch (e) {
    say(`${label}: not listed: ${e.code || e.message}, after ${Date.now() - began} ms.`);
  }
}

look("Downloads", join(home, "Downloads"));

// Dropbox keeps its folder in Library/CloudStorage on a Mac of today, and in ~/Dropbox on an older one.
const cloud = join(home, "Library", "CloudStorage");
const dropbox = [];
try {
  for (const name of readdirSync(cloud)) if (/^Dropbox/.test(name)) dropbox.push(join(cloud, name));
} catch (e) {
  say(`Library/CloudStorage: not listed: ${e.code || e.message}.`);
}
if (existsSync(join(home, "Dropbox"))) dropbox.push(join(home, "Dropbox"));
if (!dropbox.length) say("Dropbox: this account has no Dropbox folder.");
for (const dir of dropbox) look(`Dropbox (${dir.slice(home.length + 1)})`, dir);
