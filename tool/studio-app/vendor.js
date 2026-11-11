// What the app's build vendors (vendor.pin.json), and the seal of the folder that build-vendor.sh makes of it (Phase 6).
// Imports only what it needs, so the build's scripts can run it on any computer. Nothing here fetches anything.
//   node vendor.js pins                one line a pin: name, version, address, the address's last part, SHA-256, a tab between
//   node vendor.js source-name         the name of the GPL source zip
//   node vendor.js seal <folder>       writes <folder>/manifest.json
//   node vendor.js check <folder>      ends with 0 and nothing, or with 1 and the why on stdout
// A fault in the pin file or in the command is said on stderr and ends with 2.
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain } from "../is-main.js";

export const PIN_NAMES = ["node", "ffmpeg", "x264", "pkgconf", "whisper", "cmake"];
/** What the bundle cannot do without, as paths under the vendored folder. whisper-cli is the transcriber's only name. */
export const NEEDED = ["node/bin/node", "node/bin/npm", "node/bin/ffmpeg", "node/bin/ffprobe", "node/bin/whisper-cli"];
export const SEAL = "manifest.json";

const PIN_FILE = join(dirname(fileURLToPath(import.meta.url)), "vendor.pin.json");
const KEYS = ["version", "url", "sha256"];

/** The first fault in one pin, as a sentence, or "". */
function pinFault(name, pin) {
  if (pin === null || typeof pin !== "object" || Array.isArray(pin)) return `The pin ${name} is not an object.`;
  for (const key of Object.keys(pin)) if (!KEYS.includes(key)) return `The pin ${name} has a key it should not: ${key}.`;
  for (const key of KEYS) if (typeof pin[key] !== "string") return `The pin ${name} has no ${key}.`;
  if (pin.version === "" || /[\r\n]/.test(pin.version)) return `The pin ${name}'s version is not one line, or is empty.`;
  let address;
  try {
    address = new URL(pin.url);
  } catch {
    return `The pin ${name}'s address is not an address.`;
  }
  if (address.protocol !== "https:" || address.username || address.password || address.search || address.hash || pin.url.includes("?") || pin.url.includes("#")) {
    return `The pin ${name}'s address is not https, or has a user, a password, a query or a hash.`;
  }
  if (!/^[0-9a-f]{64}$/.test(pin.sha256)) return `The pin ${name}'s sha256 is not 64 lowercase hexadecimal characters.`;
  return "";
}

/** { pins } from the pin file `file`, or { fault } naming the first thing wrong. */
export function readPins(file) {
  let pins;
  try {
    pins = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return { fault: "The pin file cannot be read as JSON." };
  }
  if (pins === null || typeof pins !== "object" || Array.isArray(pins)) return { fault: "The pin file is not an object." };
  for (const name of Object.keys(pins)) if (!PIN_NAMES.includes(name)) return { fault: `The pin file has a pin it should not: ${name}.` };
  for (const name of PIN_NAMES) {
    if (!(name in pins)) return { fault: `The pin file has no pin ${name}.` };
    const fault = pinFault(name, pins[name]);
    if (fault) return { fault };
  }
  return { pins };
}

/** The name of the GPL source zip: ffmpeg's version and the first seven characters of x264's commit. */
export function sourceName(pins) {
  return `ffmpeg-${pins.ffmpeg.version}-x264-${pins.x264.version.slice(0, 7)}-source.zip`;
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Every file and link under `folder`/`top`, as { "<path under folder>": "<SHA-256>" | "link:<target>" }. */
function listing(folder, top) {
  const found = {};
  const walk = (relative) => {
    const path = join(folder, relative);
    let stat;
    try {
      stat = lstatSync(path);
    } catch {
      return;
    }
    if (stat.isSymbolicLink()) found[relative] = `link:${readlinkSync(path)}`;
    else if (stat.isDirectory()) for (const name of readdirSync(path)) walk(`${relative}/${name}`);
    else if (stat.isFile()) found[relative] = sha256(readFileSync(path));
  };
  walk(top);
  return found;
}

/** The files and links the seal covers, with the paths in sorted order. */
function sealedListing(folder) {
  const all = { ...listing(folder, "node"), ...listing(folder, "licenses") };
  return Object.fromEntries(Object.keys(all).sort().map((path) => [path, all[path]]));
}

/** Writes `folder`/manifest.json: the pin file's SHA-256 and the SHA-256 or the link of every file under node and licenses. */
export function seal(folder, pinFile) {
  const manifest = { version: 1, pins: sha256(readFileSync(pinFile)), files: sealedListing(folder) };
  writeFileSync(join(folder, SEAL), `${JSON.stringify(manifest, null, 2)}\n`);
}

/** "" when the folder is sealed under these pins and nothing in it has changed, or the sentence that says why not. */
export function sealFault(folder, pinFile) {
  const unsealed = "The vendored programs are not sealed: run build-vendor.sh.";
  if (!existsSync(join(folder, SEAL))) return unsealed;
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(folder, SEAL), "utf8"));
  } catch {
    return unsealed;
  }
  if (manifest === null || typeof manifest !== "object" || manifest.files === null || typeof manifest.files !== "object") return unsealed;
  let pins;
  try {
    pins = sha256(readFileSync(pinFile));
  } catch {
    return "The pin file cannot be read, so the vendored programs cannot be checked.";
  }
  if (manifest.pins !== pins) return "The vendored programs were built from other pins: run build-vendor.sh again.";
  for (const path of NEEDED) if (!existsSync(join(folder, path))) return `${path} is missing from the vendored programs.`;
  const now = sealedListing(folder);
  const paths = [...new Set([...Object.keys(manifest.files), ...Object.keys(now)])].sort();
  for (const path of paths) if (manifest.files[path] !== now[path]) return `${path} is not as it was sealed.`;
  return "";
}

/** Runs the command line `args`: { text, status } to print and end with. */
function command(args) {
  const [which, folder] = args;
  if (which === "seal" || which === "check") {
    if (args.length !== 2) return { fault: `${which} takes one folder.` };
  } else if (which === "pins" || which === "source-name") {
    if (args.length !== 1) return { fault: `${which} takes nothing more.` };
  } else return { fault: "The first word is not pins, source-name, seal or check." };
  const read = readPins(PIN_FILE);
  if (read.fault) return { fault: read.fault };
  if (which === "pins") {
    const lines = PIN_NAMES.map((name) => {
      const pin = read.pins[name];
      return [name, pin.version, pin.url, new URL(pin.url).pathname.split("/").pop(), pin.sha256].join("\t");
    });
    return { text: `${lines.join("\n")}\n`, status: 0 };
  }
  if (which === "source-name") return { text: `${sourceName(read.pins)}\n`, status: 0 };
  if (which === "seal") {
    try {
      seal(folder, PIN_FILE);
    } catch {
      return { fault: "The folder cannot be sealed: it is not there or cannot be written." };
    }
    return { text: "", status: 0 };
  }
  const why = sealFault(folder, PIN_FILE);
  return { text: why ? `${why}\n` : "", status: why ? 1 : 0 };
}

if (isMain(import.meta.url)) {
  const made = command(process.argv.slice(2));
  if (made.fault) {
    process.stderr.write(`${made.fault}\n`);
    process.exitCode = 2;
  } else {
    process.stdout.write(made.text);
    process.exitCode = made.status;
  }
}
