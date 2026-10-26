// The gated places (design 2026-10-26, section 2, "The gated places"): the folders and files her chat may not read under the open
// lock, because each can hold a gated video's name or words, a session's, another chat's, or a secret. They are held three
// ways, each from this list: the sandbox's denyRead (macOS holds Bash and all it starts), Claude Code's Read() deny rules (its
// own file tools), and the guard, which compares a path by what it is, not how it is spelled.
//
// Every place is named by its real path (realOf): ~/Movies on the Mac Studio is a link into Dropbox, and a rule written for the
// link's spelling would miss the folder. Each is also spelled a second way, under /System/Volumes/Data (bothSpellings), as
// macOS lets a path be. `readRules` are the paths the Read() deny rules are written for (none for a place only the sandbox and
// the guard hold); `carve` marks a place the guard opens a part of to one call (its own words, its own tool results, its own
// tasks, Claude Code's own program); `readAllowed` is what the sandbox lets Bash read inside them, and nothing else.
//
// This file reads only whether folders are there and what their real paths are. It is given the home, BRIMM Video, the uid,
// Claude Code's temp folder and her folder, so that a test gives made-up ones and never reads this Mac's own.
import { existsSync, realpathSync } from "node:fs";
import { basename, dirname, join } from "node:path";

/** Claude Code's name for a folder, as it names the folder's own subfolders of ~/.claude/projects and of its temp folder: every
    character but a letter or a digit made a dash. */
export const claudeDirName = (path) => path.replace(/[^A-Za-z0-9]/g, "-");

/** The real path of `path`: that of the nearest folder of it that is there, with the rest of the path after it. */
export function realOf(path) {
  let at = path;
  const rest = [];
  for (;;) {
    try {
      return join(realpathSync.native(at), ...rest);
    } catch {
      const up = dirname(at);
      if (up === at) return path;
      rest.unshift(basename(at));
      at = up;
    }
  }
}

/** A path as it is, and as macOS also lets it be spelled, under /System/Volumes/Data. */
export const bothSpellings = (path) => [path, `/System/Volumes/Data${path}`];

/** Whether a path names a .env file, or one of its kin (.env.local): such a file is held wherever it is (R20). */
export function isEnvFile(path) {
  const name = basename(String(path));
  return name === ".env" || name.startsWith(".env.");
}

/** The first folder above BRIMM Video that holds Dropbox's cache, `.dropbox.cache` (Dropbox's root), or null when none does. */
function dropboxRoot(root) {
  for (let at = dirname(root); ; at = dirname(at)) {
    if (existsSync(join(at, ".dropbox.cache"))) return at;
    if (dirname(at) === at) return null;
  }
}

/** Every gated place of this Mac, by its real path: { path, readRules, kind, carve? }. `tmp` is Claude Code's temp folder
    (CLAUDE_CODE_TMPDIR, or /tmp, by its real path), `uid` this Mac user's id, and `zoomFolder` where Zoom keeps its recordings,
    by default Documents/Zoom in the home folder. */
export function gatedPlaces({ home, root, uid, tmp = "/private/tmp", zoomFolder = join(home, "Documents", "Zoom") }) {
  const AS = join(home, "Library", "Application Support");
  const BV = realOf(root);
  const DB = dropboxRoot(BV);
  const itself = (path, kind = "folder") => ({ path: realOf(path), readRules: [realOf(path)], kind });
  const carved = (path, carve) => ({ path: realOf(path), readRules: [], kind: "folder", carve });
  const containers = join(home, "Library", "Containers");
  return [
    { path: BV, readRules: ["Drop", "Episodes", "Unedited Video"].map((name) => join(BV, name)), kind: "folder" },
    itself(join(dirname(BV), "BRIMM VIDEO Transfer")),
    itself(zoomFolder),
    itself(join(home, "Movies", "Final Cut Backups")),
    itself(join(home, "BRIMM Video Work")),
    itself(join(AS, "BRIMM Video")),
    carved(join(AS, "BRIMM Video Words"), "words"),
    carved(join(home, ".claude"), "claude"),
    carved(join(tmp, `claude-${uid}`), "tmp"),
    carved(join(AS, "Claude"), "app"),
    itself(join(home, ".claude.json"), "file"),
    itself(join(AS, "com.apple.sharedfilelist")),
    itself(join(home, "Library", "Preferences", "com.apple.finder.plist"), "file"),
    itself(join(home, ".dropbox")),
    itself(join(AS, "Dropbox")),
    ...(DB ? [itself(join(DB, ".dropbox.cache"))] : []),
    itself(join(home, "Library", "Group Containers", "G7HH3F8CAK.com.getdropbox.dropbox.sync")),
    itself(join(containers, "com.getdropbox.dropbox.fileprovider")),
    itself(join(containers, "com.getdropbox.dropbox.TransferExtension")),
    itself(join(containers, "com.getdropbox.dropbox.garcon")),
    itself(join(home, "Library", "Logs", "brimm-video.log"), "file"),
    itself(join(home, "Library", "Logs", "brimm-video-claude-check.log"), "file"),
    itself(join(home, ".ssh")),
    itself(join(home, "Library", "Keychains")),
    itself(join(home, ".aws")),
    itself(join(home, ".config")),
    itself(join(home, ".netrc"), "file"),
    itself(join(home, ".git-credentials"), "file"),
    itself(join(home, ".npmrc"), "file"),
  ];
}

/** What the sandbox lets Bash read inside the gated places (its allowRead), and nothing else: BRIMM Video's Assets, and the three
    places Bash itself needs (C36): her folder's own subfolder of Claude Code's temp folder, its shell snapshots and Claude Code's
    own program in the app's data. */
export function readAllowed({ home, root, uid, tmp = "/private/tmp", folder }) {
  return [
    join(realOf(root), "Assets"),
    realOf(join(tmp, `claude-${uid}`, claudeDirName(folder))),
    realOf(join(home, ".claude", "shell-snapshots")),
    realOf(join(home, "Library", "Application Support", "Claude", "claude-code")),
  ];
}
