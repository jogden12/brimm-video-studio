// A made-up copy of BRIMM Video Studio.app for the tests, and what goes with it. install.test.js had these, and the setup engine's
// tests need the same ones, so they are here for both. Not a test: node --test runs only *.test.js.
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HELPERS } from "../helpers.js";

/** The tool's folder, which holds install.sh. */
const HERE = dirname(fileURLToPath(new URL("../install.sh", import.meta.url)));

/** A folder's name as a plist holds it. */
export const xml = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
/** What a build of BRIMM Video Studio writes into build.json (Phase 3), as tests/build.test.js has it. */
export const WHOLE = { version: "1.4.2", build: 142, commit: "0123456789abcdef0123456789abcdef01234567", short: "0123456", feed: "https://updates.example.invalid/appcast.xml", channel: "stable", support: "help@example.invalid" };
/** The programs in the folder after --tools besides Studio's compiled helpers (HELPERS, each named brimm-<name>). */
export const TOOLS_PROGRAMS = ["node", "npm", "ffmpeg", "ffprobe", "whisper-cli"];
/** What the installer says of a copy of BRIMM Video Studio that is not whole. */
export const DAMAGED = "This copy of BRIMM Video Studio may be damaged: download it again, then open it and choose Repair.";
/** What the app's ffmpeg prints for the three calls --print asks of it: it can make an HDR video standard. */
export const HDR_LISTS = { hwaccels: "Hardware acceleration methods:\nvideotoolbox\n", filters: "Filters:\n .. scale_vt          V->V       Scale Videotoolbox frames\n", version: "ffmpeg version 9.0.2 Copyright (c) 2000-2026 the FFmpeg developers" };

/** A copy of BRIMM Video Studio.app as its build lays it out, in a folder made for the test, with stand-ins for every program: `app`,
    its `checkout` (Contents/Resources/Studio, which holds this checkout's tool without its tests, and beside it a build.json unless
    `build` is false), `tool`, `install` (the installer in that copy) and `tools` (Contents/Resources/node/bin). Each stand-in writes
    what it is given into `ran()` but node, which runs the real one (an old one with `oldNode`), and ffmpeg, which prints `lists` for
    -hwaccels, -filters and -version. */
export function appCopy({ under = "Applications", id = "com.thebrimm.video-studio", exe = "BRIMM Video Studio", build = true, lists = HDR_LISTS, oldNode = false, deadNode = false } = {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "brimm-app-")));
  const app = join(dir, under, "BRIMM Video Studio.app");
  const ranFile = join(dir, "ran");
  const stand = (file, script) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `#!/bin/sh\n${script}`);
    chmodSync(file, 0o755);
  };
  mkdirSync(join(app, "Contents"), { recursive: true });
  writeFileSync(join(app, "Contents", "Info.plist"), `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n  <key>CFBundleIdentifier</key><string>${xml(id)}</string>\n  <key>CFBundleExecutable</key><string>${xml(exe)}</string>\n  <key>CFBundleName</key><string>BRIMM Video Studio</string>\n</dict>\n</plist>\n`);
  stand(join(app, "Contents", "MacOS", exe), `echo "app $*" >> "${ranFile}"\n`);
  const checkout = join(app, "Contents", "Resources", "Studio");
  const tool = join(checkout, "tool");
  cpSync(HERE, tool, { recursive: true, filter: (src) => src !== join(HERE, "tests") });
  if (build) writeFileSync(join(checkout, "build.json"), JSON.stringify(WHOLE));
  const tools = join(app, "Contents", "Resources", "node", "bin");
  const old = oldNode ? `case "$1" in\n  --version) echo v20.11.0; exit 0 ;;\n  -e) case "$2" in *process.versions.node*) exit 1 ;; esac ;;\nesac\n` : "";
  stand(join(tools, "node"), deadNode ? "exit 1\n" : `${old}exec "${process.execPath}" "$@"\n`);
  for (const [name, text] of Object.entries(lists)) writeFileSync(join(dir, `ffmpeg-${name}`), text);
  stand(join(tools, "ffmpeg"), `case "$*" in\n  *-hwaccels*) cat "${join(dir, "ffmpeg-hwaccels")}" ;;\n  *-filters*) cat "${join(dir, "ffmpeg-filters")}" ;;\n  *-version*) cat "${join(dir, "ffmpeg-version")}" ;;\n  *) echo "$0 $*" >> "${ranFile}" ;;\nesac\n`);
  for (const name of ["npm", "ffprobe", "whisper-cli", ...HELPERS.map((h) => `brimm-${h}`)]) stand(join(tools, name), `echo "$0 $*" >> "${ranFile}"\n`);
  return { dir, app, tools, tool, checkout, install: join(tool, "install.sh"), ran: () => (existsSync(ranFile) ? readFileSync(ranFile, "utf8") : ""), done: () => rmSync(dir, { recursive: true, force: true }) };
}
