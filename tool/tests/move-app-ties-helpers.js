// What move-app-ties.test.js needs to run Studio's real installer with --print in a made-up home: copies of askWith, box and the
// stand-ins from install.test.js (which is Phase 3's file and is not touched here). Nothing here runs without --print, and every
// program of the Mac that could be asked something (xcode-select, sw_vers, ffmpeg, claude, launchctl, brew, curl, npm) is a stand-in.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const INSTALL = fileURLToPath(new URL("../install.sh", import.meta.url));
export const HERE = dirname(INSTALL);
export const SIGNED_IN = '{"loggedIn":true,"authMethod":"claude.ai","subscriptionType":"max","email":"sallie@example.com","orgName":"The BRIMM"}';
/** Stand-ins for the programs that say what the Mac has: Xcode's command line tools there, and the Mac's macOS. */
export const XCODE_HERE = '[ "$1" = "-p" ] && echo /Library/Developer/CommandLineTools\n';
export const MACOS = (version) => `[ "$1" = "-productVersion" ] && echo ${version}\n`;
/** What the stand-in ffmpeg says, so that no ffmpeg of the Mac runs. */
export const FFMPEG_SAYS = {
  hwaccels: "Hardware acceleration methods:\nvideotoolbox\n",
  filters: "Filters:\n  T.. = Timeline support\n  .S. = Slice threading\n  A = Audio input/output\n  V = Video input/output\n  ------\n TS colorspace        V->V       Convert between colorspaces.\n .. scale_vt           V->V       Scale Videotoolbox frames\n .S tonemap           V->V       Conversion to/from different dynamic ranges.\n"
};
/** The stand-ins every run here has: nothing of the Mac's own is asked. */
export const STAND_INS = { "xcode-select": XCODE_HERE, sw_vers: MACOS("27.0.1") };

/** A folder's name as a plist holds it. */
export const xml = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
/** The transcript tool's launch agent as its own installer writes it, watching these folders. */
export const transcriptAgent = (folders) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.thebrimm.transcribe</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/node</string>
    <string>/Users/someone/Claude Code/BRIMM operations/transcribe/transcribe.js</string>
${folders.map((folder) => `    <string>--watch</string>\n    <string>${xml(folder)}</string>`).join("\n")}
  </array>
  <key>WatchPaths</key>
  <array>
${folders.map((folder) => `    <string>${xml(folder)}</string>`).join("\n")}
  </array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
`;

/** BRIMM Video in a made-up Dropbox, in a folder of its own apart from the home folder askWith makes. */
export function box() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "brimm-ties-")));
  const root = join(dir, "The BRIMM DB", "BRIMM Video");
  mkdirSync(root, { recursive: true });
  return { dir, root, mine: (more = {}) => ({ machine: "Mac Studio", root, checkout: dirname(HERE), ...more }), done: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Ask Studio's real installer what it would do (--print only), in a home folder made for the run that askWith deletes after.
    `installed` holds the text of the launch agents by label, `files` the files to put in the home (each a path, or [path, text]),
    `settings` this Mac's settings; an argument may be a function of the home. Gives { status, out, err, home, left, ran }. */
export function askWith({ installed = {}, files = [], onPath = STAND_INS, ffmpegSays = FFMPEG_SAYS, claude = SIGNED_IN, claudeVersion = "2.1.296 (Claude Code)", settings }, ...args) {
  assert.ok(args.includes("--print"), "the installer is only ever asked what it would do");
  const dir = mkdtempSync(join(tmpdir(), "brimm-install-"));
  try {
    const home = join(dir, "home");
    const bin = join(dir, "bin");
    mkdirSync(home);
    mkdirSync(bin);
    args = args.map((arg) => (typeof arg === "function" ? arg(home) : arg));
    const fileOf = (label) => join(home, "Library", "LaunchAgents", `${label}.plist`);
    for (const [label, text] of Object.entries(installed)) {
      mkdirSync(dirname(fileOf(label)), { recursive: true });
      writeFileSync(fileOf(label), text);
    }
    for (const file of files) {
      const [path, text] = Array.isArray(file) ? file : [file, "made for the test"];
      mkdirSync(dirname(join(home, path)), { recursive: true });
      writeFileSync(join(home, path), text);
    }
    const ran = join(dir, "ran");
    for (const name of ["launchctl", "brew", "curl", "npm"]) {
      writeFileSync(join(bin, name), `#!/bin/sh\necho "${name} $*" >> "${ran}"\n`);
      chmodSync(join(bin, name), 0o755);
    }
    const stands = {
      ...onPath,
      ffmpeg: `echo "$*" >> "${join(dir, "ffmpeg-asked")}"\ncase "$*" in\n  *-hwaccels*) printf '%s' '${ffmpegSays.hwaccels}' ;;\n  *-filters*) printf '%s' '${ffmpegSays.filters}' ;;\n  *-version*) echo 'ffmpeg version 9.0.2 Copyright (c) 2000-2026 the FFmpeg developers' ;;\n  *) echo "ffmpeg $*" >> "${ran}" ;;\nesac\n`,
      "claude-stand-in": `case "$*" in\n  "auth status --json") printf '%s' '${claude}'; exit 0 ;;\n  --version) echo '${claudeVersion}'; exit 0 ;;\n  *) echo "claude $*" >> "${ran}" ;;\nesac\n`
    };
    for (const [name, script] of Object.entries(stands)) {
      const logged = name === "xcode-select" ? `[ "$1" = "-p" ] || echo "xcode-select $*" >> "${ran}"\n` : "";
      writeFileSync(join(bin, name), `#!/bin/sh\n${logged}${script}`);
      chmodSync(join(bin, name), 0o755);
    }
    if (settings) {
      mkdirSync(join(home, "Library", "Application Support", "BRIMM Video"), { recursive: true });
      writeFileSync(join(home, "Library", "Application Support", "BRIMM Video", "settings.json"), JSON.stringify({ version: 1, ...settings }));
    }
    const env = { HOME: home, PATH: `${bin}:${process.env.PATH}:${dirname(process.execPath)}`, BRIMM_CLAUDE: join(bin, "claude-stand-in") };
    const r = spawnSync("/bin/zsh", [INSTALL, ...args], { encoding: "utf8", input: "", env });
    return { status: r.status, out: r.stdout, err: r.stderr, home, left: readdirSync(home, { recursive: true }).sort(), ran: existsSync(ran) ? readFileSync(ran, "utf8") : "" };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
