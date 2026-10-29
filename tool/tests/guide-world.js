// The made-up world the tests of the guide on the HyperFrames way share (edit-guide-app.test.js, and pipe-scenario.mjs, which that test runs in a
// child process): exports-world.js's episode, read by Claude and its spellings answered, and the deps of a guide run on it. Nothing here touches
// the real home, Downloads, Dropbox or a program: the home is a temporary folder.
import { AT, world } from "./exports-world.js";

export const READ = (kind) => ({ kind, model: "m", at: AT, on: "Mac Studio", account: "a", outcome: "read" });
export const OFFERS = { spellings: [], answered: { reading: AT, at: AT, on: "Mac Studio", applied: [], left: [] } };

/** The made-up episode of exports-world.js, read by Claude and its spellings answered, with the projects given on disk: just the main
    one, opened and last changed at 13:40, by default. `projects: null` is a record with no project at all. */
export const guideWorld = ({ kind = "raw", projects = ["main"], over = {}, ...rest } = {}) => world({ kind, projects, over: { reading: READ(kind), offers: OFFERS, ...over }, ...rest });

/** The deps of a guide run: this Mac on the light import, with the zone the made-up records are in (UTC-5, Chicago's in October). */
export const depsOf = (w, over = {}) => ({ ...w.t.ctx.deps, settings: { ...w.t.ctx.settings, import: "light", drop: "Drop", handoffVersion: 2 }, app: { tz: "America/Chicago" }, ...over });
