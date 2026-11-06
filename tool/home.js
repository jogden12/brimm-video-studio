// Studio's own home folder: where it keeps its settings, its work folder, the Downloads it looks in, its runs, pendings, progress
// and log. It is HOME, as for the launch agent and in a shell, unless BRIMM_VIDEO_HOME names another, which a by-hand check sets so
// that Studio runs as a Mac of its own (README, "A home of its own, for by-hand checks"). HOME itself stays the real one: changing
// it breaks the login keychain, so `claude` cannot keep a sign-in, and the transcription model is not found. So every program
// Studio starts is given the real HOME (programHome), and only Studio's own folders move.
//
// This file imports nothing of Studio's, so every entry point can use it. A BRIMM_VIDEO_HOME that is set but is not a whole path
// is refused, never quietly taken for the real home.
import { homedir } from "node:os";
import { isAbsolute } from "node:path";

/** Why `env`'s BRIMM_VIDEO_HOME cannot be Studio's home, in the words a command prints; "" when it can, or is not set. */
export function homeRefusal(env = process.env) {
  const given = env.BRIMM_VIDEO_HOME;
  if (given === undefined) return "";
  return typeof given === "string" && isAbsolute(given) ? "" : `BRIMM_VIDEO_HOME must be a whole path: ${given}.`;
}

/** Studio's own home: BRIMM_VIDEO_HOME when that is set, else HOME, else the Mac's own word for it. Throws, saying so in the words
    of homeRefusal, for a BRIMM_VIDEO_HOME that is set and is not a whole path. */
export function studioHome(env = process.env) {
  const why = homeRefusal(env);
  if (why) throw new Error(why);
  return env.BRIMM_VIDEO_HOME ?? (env.HOME || homedir());
}

/** The home folder a program Studio starts is given as HOME: the real one (HOME, else the Mac's own word for it) when
    BRIMM_VIDEO_HOME is set, and `home`, the one Studio works from, as it always was when it is not. */
export function programHome(home, env = process.env) {
  return env.BRIMM_VIDEO_HOME === undefined ? home : env.HOME || homedir();
}
