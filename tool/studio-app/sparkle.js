// Sparkle's own pin (sparkle.pin.json, Phase 7): the archive by its version, address and SHA-256, and the update key's public half.
// It is a file of its own so that vendor.pin.json, and with it the sealed vendor folder, does not change. Nothing here fetches anything.
//   node sparkle.js pin               one line: version, address, the address's last part, SHA-256, a tab between
//   node sparkle.js key               the update key's public half, or ends with 1 when it is not in the pin file yet
//   node sparkle.js check <archive>   ends with 0 and nothing, or with 1 when the archive's SHA-256 is not the pin's
// Each reads the sparkle.pin.json beside this file. A fault in the pin file or in the command is said on stderr and ends with 2.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain } from "../is-main.js";

/** The update key's public half, as Sparkle's generate_keys -p prints it: 32 bytes in base64. */
export const PUBLIC_KEY = /^[A-Za-z0-9+/]{43}=$/;

const PIN_FILE = join(dirname(fileURLToPath(import.meta.url)), "sparkle.pin.json");
const KEYS = ["version", "url", "sha256", "publicKey"];

/** The first fault in the pin, as a sentence that names the key and never its value, or "". */
function pinFault(pin) {
  if (pin === null || typeof pin !== "object" || Array.isArray(pin)) return "Sparkle's pin is not an object.";
  for (const key of Object.keys(pin)) if (!KEYS.includes(key)) return `Sparkle's pin has a key it should not have: ${key}.`;
  for (const key of KEYS) if (typeof pin[key] !== "string") return `Sparkle's pin has no ${key}.`;
  // The version names a folder fetch-sparkle.sh empties with rm -rf, so it holds no slash, no dot-dot, no tab and no space.
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z]+(\.[0-9A-Za-z]+)*)?$/.test(pin.version)) return "Sparkle's pin's version is not a version like 2.10.1.";
  let address;
  try {
    address = new URL(pin.url);
  } catch {
    return "Sparkle's pin's url is not an address.";
  }
  if (address.protocol !== "https:" || address.username || address.password || address.search || address.hash || pin.url.includes("?") || pin.url.includes("#")) {
    return "Sparkle's pin's url is not https, or has a user, a password, a query or a hash.";
  }
  // The url's last part is the archive's file name in the fetch folder, so it is one plain name ending .tar.xz.
  if (!/^[0-9A-Za-z][0-9A-Za-z._+-]*\.tar\.xz$/.test(address.pathname.split("/").pop())) return "Sparkle's pin's url does not end in a plain file name ending .tar.xz.";
  if (!/^[0-9a-f]{64}$/.test(pin.sha256)) return "Sparkle's pin's sha256 is not 64 lowercase hexadecimal characters.";
  if (pin.publicKey !== "" && !PUBLIC_KEY.test(pin.publicKey)) return "Sparkle's pin's publicKey is neither empty nor a public key.";
  return "";
}

/** { pin } from the pin file `file`, or { fault } naming the first thing wrong. */
export function readSparklePin(file) {
  let pin;
  try {
    pin = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return { fault: "Sparkle's pin file cannot be read as JSON." };
  }
  const fault = pinFault(pin);
  return fault ? { fault } : { pin };
}

/** Runs the command line `args`: { text, status } to print and end with, or { fault }. */
function command(args) {
  const [which, archive] = args;
  if (which === "check") {
    if (args.length !== 2) return { fault: "check takes one archive." };
  } else if (which === "pin" || which === "key") {
    if (args.length !== 1) return { fault: `${which} takes nothing more.` };
  } else return { fault: "The first word is not pin, key or check." };
  const read = readSparklePin(PIN_FILE);
  if (read.fault) return { fault: read.fault };
  const { pin } = read;
  if (which === "pin") {
    return { text: `${[pin.version, pin.url, new URL(pin.url).pathname.split("/").pop(), pin.sha256].join("\t")}\n`, status: 0 };
  }
  if (which === "key") {
    if (pin.publicKey === "") return { text: "The update key's public half is not in sparkle.pin.json yet. Reading it is a by-hand step.\n", status: 1 };
    return { text: `${pin.publicKey}\n`, status: 0 };
  }
  let found = "";
  try {
    found = createHash("sha256").update(readFileSync(archive)).digest("hex");
  } catch {
    found = "";
  }
  if (found !== pin.sha256) return { text: "That is not the pinned Sparkle archive, so it was not unpacked.\n", status: 1 };
  return { text: "", status: 0 };
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
