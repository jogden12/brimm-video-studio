// The names of BRIMM Video Studio.app, and the text of the two files the build writes from them: build.json and Info.plist (Phase 6).
// Imports only what it needs to say whether it is the script node was started with, so the build's scripts can run it on any computer.
//   node build-info.js json --version <v> --build <n> --commit <40 hex> --channel <stable|beta>
//   node build-info.js plist --version <v> --build <n> --public-key <key> [--icon]
// Each prints the file's text and ends with 0, or says the fault on stderr and ends with 2.
import { VERSION } from "../build.js";
import { isMain } from "../is-main.js";
import { PUBLIC_KEY } from "./sparkle.js";

export const APP_NAME = "BRIMM Video Studio";
export const BUNDLE_ID = "com.thebrimm.video-studio";
export const URL_SCHEME = "brimm-video-studio";
export const FEED = "https://updates.thebrimminsights.com/appcast.xml";
export const SUPPORT = "admin@growwiththebrimm.com";
export const MIN_MACOS = "13.0";

/** The sentence every usage line of Info.plist says. */
const USAGE = `${APP_NAME} looks in this folder for new videos and for the videos HyperFrames exports.`;

/** The fault in a version or a build, as a sentence that names the option and never its value, or "". build.json and Info.plist
    both ask it, so the two refuse in the same words. */
function versionBuildFault(version, build) {
  if (typeof version !== "string" || !VERSION.test(version)) return "The version is not one like 1.0.0 or 1.0.0-beta.1.";
  if (!Number.isSafeInteger(build) || build <= 0) return "The build is not a whole number above 0.";
  return "";
}

/** Why a version and a channel do not go together. It names the option and never a value. */
const CHANNEL_FAULT = "A version with a pre-release part goes on the beta channel, and only such a version does (--channel).";

/** build.json's whole text for the build, or { fault } naming the first option that will not do (never its value). */
export function buildJson({ version, build, commit, channel }) {
  const fault = versionBuildFault(version, build);
  if (fault) return { fault };
  if (typeof commit !== "string" || !/^[0-9a-f]{40}$/.test(commit)) return { fault: "The commit is not 40 hexadecimal characters." };
  if (channel !== "stable" && channel !== "beta") return { fault: "The channel is not stable or beta." };
  // The same rule release.js keeps, asked here too so that build-app.sh refuses before anything is built, signed or notarized.
  if (version.includes("-") !== (channel === "beta")) return { fault: CHANNEL_FAULT };
  return { text: `${JSON.stringify({ version, build, commit, short: commit.slice(0, 7), feed: FEED, channel, support: SUPPORT }, null, 2)}\n` };
}

/** `text` as the content of a plist string. */
const escaped = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const str = (key, value) => `\t<key>${key}</key>\n\t<string>${escaped(value)}</string>\n`;

const bool = (key, value) => `\t<key>${key}</key>\n\t<${value ? "true" : "false"}/>\n`;

/** Info.plist's whole text, or { fault } naming the first of the version, the build and the update key's public half that will not
    do (never its value). CFBundleShortVersionString is the whole version and CFBundleVersion the build. Sparkle's switches leave it
    nothing to do by itself: it looks for an update only when it is asked, and checks an update's signature before it unpacks it. */
export function infoPlist({ version, build, icon, publicKey }) {
  const fault = versionBuildFault(version, build);
  if (fault) return { fault };
  if (typeof publicKey !== "string" || !PUBLIC_KEY.test(publicKey)) return { fault: "The update key's public half (--public-key) is not one that can be used." };
  return [
    `<?xml version="1.0" encoding="UTF-8"?>\n`,
    `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n`,
    `<plist version="1.0">\n<dict>\n`,
    str("CFBundleExecutable", APP_NAME),
    str("CFBundleName", APP_NAME),
    str("CFBundleDisplayName", APP_NAME),
    str("CFBundleIdentifier", BUNDLE_ID),
    str("CFBundlePackageType", "APPL"),
    str("CFBundleInfoDictionaryVersion", "6.0"),
    str("CFBundleShortVersionString", version),
    str("CFBundleVersion", String(build)),
    str("LSMinimumSystemVersion", MIN_MACOS),
    `\t<key>NSHighResolutionCapable</key>\n\t<true/>\n`,
    `\t<key>CFBundleURLTypes</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>CFBundleURLName</key>\n\t\t\t<string>${escaped(BUNDLE_ID)}</string>\n\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n\t\t\t\t<string>${escaped(URL_SCHEME)}</string>\n\t\t\t</array>\n\t\t</dict>\n\t</array>\n`,
    icon ? str("CFBundleIconFile", "AppIcon") : "",
    str("NSDownloadsFolderUsageDescription", USAGE),
    str("NSDesktopFolderUsageDescription", USAGE),
    str("NSDocumentsFolderUsageDescription", USAGE),
    str("NSFileProviderDomainUsageDescription", USAGE),
    str("SUFeedURL", FEED),
    str("SUPublicEDKey", publicKey),
    bool("SUEnableAutomaticChecks", false),
    bool("SUAutomaticallyUpdate", false),
    bool("SUAllowsAutomaticUpdates", false),
    bool("SUEnableSystemProfiling", false),
    bool("SUVerifyUpdateBeforeExtraction", true),
    `</dict>\n</plist>\n`,
  ].join("");
}

/** The command line's options, as an object of strings (a flag with no value is true), or { fault }. The fault never repeats what
    was typed: an unknown word may be a stray value. */
function optionsOf(args) {
  const given = {};
  for (let i = 0; i < args.length; i++) {
    const name = args[i];
    if (name === "--icon") given.icon = true;
    else if (["--version", "--build", "--commit", "--channel", "--public-key"].includes(name) && i + 1 < args.length) given[name === "--public-key" ? "publicKey" : name.slice(2)] = args[++i];
    else return { fault: "An option this command does not know was given, or an option has no value." };
  }
  return given;
}

/** Runs the command line `args`: { text } to print, or { fault }. */
function command(args) {
  const [which, ...rest] = args;
  if (which !== "json" && which !== "plist") return { fault: "The first word is not json or plist." };
  const given = optionsOf(rest);
  if (given.fault) return given;
  // A build number is a whole number written in digits; anything else becomes NaN and is refused by name below.
  const build = typeof given.build === "string" && /^\d+$/.test(given.build) ? Number(given.build) : NaN;
  if (which === "json") return buildJson({ version: given.version, build, commit: given.commit, channel: given.channel });
  const made = infoPlist({ version: given.version, build, icon: given.icon === true, publicKey: given.publicKey });
  return typeof made === "string" ? { text: made } : made;
}

if (isMain(import.meta.url)) {
  const made = command(process.argv.slice(2));
  if (made.fault) {
    process.stderr.write(`${made.fault}\n`);
    process.exitCode = 2;
  } else process.stdout.write(made.text);
}
