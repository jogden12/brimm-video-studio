// What may be released, and whether the appcast generate_appcast wrote is one Studio and Sparkle read as they should (Phase 7). It
// reads the appcast with the same reader `behind` uses (update-check.js appcastItems), so what passes here is what a Mac is told.
// Imports only what it needs, so the release script can run it on any computer. Nothing here fetches, signs or publishes anything.
//   node release.js facts <app>                                         version, build, channel and the zip's name, a tab between
//   node release.js may <appcast> <version> <build> <channel> <zip>      ends with 0, or with 1 and why; an appcast not there is the first release
//   node release.js check <appcast> <before> <version> <build> <channel> <zip>
//                                                                       ends with 0, or with 1 and why. <before> is the appcast as it
//                                                                       was before the run, or a path that is not there when there was none
//   node release.js enclosures <appcast> <build>                        for each enclosure of that build's item, the zip first: the file's
//                                                                       name and the enclosure's url as the appcast has it, a tab between
//   node release.js newest <appcast>                                    the newest build in the appcast (0 when it has no item Studio reads)
// A refusal is said on stdout. A fault in the command is said on stderr and ends with 2.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VERSION, buildOf, isInstalled } from "../build.js";
import { isMain } from "../is-main.js";
import { APPCAST_MAX_CHARS, appcastItems } from "../update-check.js";

/** Where the zips and deltas are published, and the bucket that serves them. */
export const RELEASES_URL = "https://updates.thebrimminsights.com/releases/";
export const BUCKET = "brimm-studio-updates";

/** An EdDSA signature as generate_appcast writes it: 64 bytes in base64, 88 characters. */
const SIGNATURE = /^[A-Za-z0-9+/]{86}==$/;
/** What may follow RELEASES_URL in an enclosure's url: one file name, percent-encoded, with no folder, query or hash. */
const URL_NAME = /^[A-Za-z0-9._~%+-]+$/;

export const BETA_CHANNEL = "A beta version goes on the beta channel, and only a beta version does. Build it again with the right --channel.";
export const TOO_LONG = "The appcast is longer than Studio reads. Take its oldest items out first.";

/** The zip build-app.sh makes for `version`. */
export const zipName = (version) => `BRIMM-Video-Studio-${version}.zip`;

/** The value of the attribute `name` on the tag `tag`, or undefined when it is not there. */
function attribute(tag, name) {
  const found = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(tag);
  return found ? (found[1] ?? found[2]).trim() : undefined;
}

/** The `<enclosure …>` tags of an item's text, each { url, signature }: those outside `<sparkle:deltas>` first, then the deltas'. */
function enclosuresOf(text) {
  const deltas = /<sparkle:deltas\b[^>]*>([\s\S]*?)<\/sparkle:deltas>/.exec(text);
  const main = deltas ? text.slice(0, deltas.index) + text.slice(deltas.index + deltas[0].length) : text;
  const tags = (part) => (part.match(/<enclosure\b[^>]*>/g) ?? []).map((tag) => ({ url: attribute(tag, "url") ?? "", signature: attribute(tag, "sparkle:edSignature") ?? "" }));
  return [...tags(main), ...(deltas ? tags(deltas[1]) : [])];
}

/** The file name an enclosure's url gives under RELEASES_URL, decoded, or "" when it is not one plain file there. A name that holds a
    slash, a quote, a backslash, a dollar sign, a backquote or a control character is not one, since it goes into printed commands. */
function fileNameOf(url) {
  if (!url.startsWith(RELEASES_URL)) return "";
  const rest = url.slice(RELEASES_URL.length);
  if (!URL_NAME.test(rest)) return "";
  let name;
  try {
    name = decodeURIComponent(rest);
  } catch {
    return "";
  }
  return name === "." || name === ".." || /[/\\"'`$\u0000-\u001f\u007f]/.test(name) ? "" : name;
}

/** `xml` without its comments, walked with indexOf as update-check.js walks it, so that the time taken follows the length of the text.
    A comment that is never closed takes the rest of the text with it. */
function withoutComments(xml) {
  let out = "";
  let at = 0;
  for (;;) {
    const open = xml.indexOf("<!--", at);
    if (open < 0) return out + xml.slice(at);
    out += xml.slice(at, open);
    const close = xml.indexOf("-->", open + 4);
    if (close < 0) return out;
    at = close + 3;
  }
}

/** The newest build among the items Studio reads in the appcast `xml`, or 0 when it has none. */
export function newestBuild(xml) {
  return Math.max(0, ...appcastItems(String(xml)).map((it) => it.build));
}

/** Whether `version` has a pre-release part, as 1.0.0-beta.2 does. */
const isBeta = (version) => version.includes("-");

/** Why the release of `version`, `build`, `channel` and `zip` may not go into the appcast `xml` (null when there is none yet), or "". */
export function mayFault(xml, { version, build, channel, zip }) {
  if (isBeta(version) !== (channel === "beta")) return BETA_CHANNEL;
  if (xml === null) return "";
  const items = appcastItems(xml);
  const newest = newestBuild(xml);
  if (newest >= build) return `Build ${build} is not above the feed's newest, ${newest}. A release needs a higher build number.`;
  // Every enclosure in the text counts, even one in an item Studio does not read, since the zip's name must be new to the folder too.
  const named = (String(xml).match(/<enclosure\b[^>]*>/g) ?? []).some((tag) => (attribute(tag, "url") ?? "").split("/").pop() === zip);
  if (items.some((it) => it.version === version) || named) return `The feed already has ${version}. A release needs a new version.`;
  return "";
}

/** Why the appcast `xml` that generate_appcast wrote is not one to publish for this release, in one sentence, or "". `beforeXml` is the
    appcast as it was before the run, or null when there was none: generate_appcast makes an item for every archive in the folder, so
    an item whose build is neither this release's nor an earlier one's comes from a zip this release did not make. */
export function checkFault(xml, { version, build, channel, zip }, beforeXml = null) {
  const text = String(xml);
  if (text.length > APPCAST_MAX_CHARS) return TOO_LONG;
  const items = appcastItems(text);
  const earlier = new Set(appcastItems(String(beforeXml ?? "")).map((it) => it.build));
  for (const it of items) {
    if (it.build !== build && !earlier.has(it.build)) return `The appcast has an item for build ${it.build}, which this release did not make. Take that zip out of the releases folder first.`;
  }
  const mine = items.filter((it) => it.build === build);
  if (mine.length === 0) return `The appcast has no item for build ${build} that Studio can read.`;
  for (const it of mine) {
    if (it.version !== version) return `The appcast's item for build ${build} says version ${it.version}, not ${version}.`;
    if (channel === "beta" && it.channel !== "beta") return `The appcast's item for build ${build} is not tagged beta, so stable Macs would be offered a beta.`;
    if (channel !== "beta" && it.channel !== "") return `The appcast's item for build ${build} is tagged ${it.channel}, so stable Macs would not be offered it.`;
    if (!enclosuresOf(it.text).some((e) => e.url === `${RELEASES_URL}${zip}`)) return `The appcast's item for build ${build} does not offer ${RELEASES_URL}${zip}.`;
  }
  for (const it of items) {
    for (const e of enclosuresOf(it.text)) {
      if (fileNameOf(e.url) === "") return `The appcast's item for build ${it.build} has a download that is not one file under ${RELEASES_URL}.`;
      if (!SIGNATURE.test(e.signature)) return `The appcast's item for build ${it.build} has a download without a whole EdDSA signature.`;
    }
  }
  // Every enclosure in the text, its comments taken out, is checked too: an item Studio's reader passes over (a version not in 1.2.3
  // form, an item too long) is still one Sparkle may read.
  for (const e of enclosuresOf(withoutComments(text))) {
    if (fileNameOf(e.url) === "") return `The appcast has a download that is not one file under ${RELEASES_URL}.`;
    if (!SIGNATURE.test(e.signature)) return "The appcast has a download without a whole EdDSA signature.";
  }
  return "";
}

/** The enclosures of `build`'s items in `xml`, the zip first and then its deltas, each { name, url }: the file's name and the
    enclosure's own url, as the appcast has it. */
export function enclosuresFor(xml, build) {
  const found = [];
  for (const it of appcastItems(String(xml))) {
    if (it.build !== build) continue;
    for (const e of enclosuresOf(it.text)) {
      const name = fileNameOf(e.url);
      if (name !== "" && !found.some((f) => f.name === name)) found.push({ name, url: e.url });
    }
  }
  return found;
}

/** The file names of the enclosures of `build`'s items in `xml`, the zip first and then its deltas. */
export const enclosureNames = (xml, build) => enclosuresFor(xml, build).map((e) => e.name);

/** The release's facts from the app's own build.json: { version, build, channel, zip }, or { refusal }. */
export function factsOf(app) {
  const build = buildOf(join(app, "Contents", "Resources", "Studio"));
  if (!isInstalled(build) || build.broken) return { refusal: "The app's build.json cannot be read, so what it would release is not known." };
  return { version: build.version, build: build.build, channel: build.channel, zip: zipName(build.version) };
}

/** The text of the file `file`, or null when it is not there. Any other failure throws. */
function readIfThere(file) {
  try {
    return readFileSync(file, "utf8");
  } catch (e) {
    if (e && e.code === "ENOENT") return null;
    throw e;
  }
}

/** The release named by `args` (version, build, channel, zip), or { fault }. */
function releaseOf([version, build, channel, zip]) {
  if (typeof version !== "string" || !VERSION.test(version)) return { fault: "The version is not one like 1.0.0 or 1.0.0-beta.1." };
  if (typeof build !== "string" || !/^\d+$/.test(build) || !Number.isSafeInteger(Number(build)) || Number(build) <= 0) return { fault: "The build is not a whole number above 0." };
  if (channel !== "stable" && channel !== "beta") return { fault: "The channel is not stable or beta." };
  if (zip !== zipName(version)) return { fault: "The zip's name is not the one build-app.sh gives this version." };
  return { version, build: Number(build), channel, zip };
}

/** Runs the command line `args`: { text, status } to print and end with, or { fault }. */
function command(args) {
  const [which, file, ...rest] = args;
  const counts = { facts: 0, may: 4, check: 5, enclosures: 1, newest: 0 };
  if (!(which in counts)) return { fault: "The first word is not facts, may, check, enclosures or newest." };
  if (typeof file !== "string" || rest.length !== counts[which]) return { fault: `${which} was not given what it takes.` };
  const said = (refusal) => ({ text: refusal ? `${refusal}\n` : "", status: refusal ? 1 : 0 });
  if (which === "facts") {
    const facts = factsOf(file);
    if (facts.refusal) return said(facts.refusal);
    return { text: `${[facts.version, facts.build, facts.channel, facts.zip].join("\t")}\n`, status: 0 };
  }
  let xml;
  try {
    xml = readIfThere(file);
  } catch {
    return said("The appcast in the releases folder cannot be read.");
  }
  if (which === "enclosures") {
    if (!/^\d+$/.test(rest[0])) return { fault: "The build is not a whole number above 0." };
    if (xml === null) return said("There is no appcast in the releases folder.");
    // A url from checkFault's appcast holds no tab or line end: URL_NAME allows neither.
    return { text: enclosuresFor(xml, Number(rest[0])).map(({ name, url }) => `${name}\t${url}\n`).join(""), status: 0 };
  }
  if (which === "newest") {
    if (xml === null) return said("There is no appcast in the releases folder.");
    return { text: `${newestBuild(xml)}\n`, status: 0 };
  }
  if (which === "may") {
    const release = releaseOf(rest);
    return release.fault ? release : said(mayFault(xml, release));
  }
  const [beforeFile, ...named] = rest;
  const release = releaseOf(named);
  if (release.fault) return release;
  if (xml === null) return said("There is no appcast in the releases folder.");
  let before;
  try {
    before = readIfThere(beforeFile);
  } catch {
    return said("The appcast as it was before this release cannot be read.");
  }
  return said(checkFault(xml, release, before));
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
