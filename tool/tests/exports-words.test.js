// The words of finish from HyperFrames' exports (plan PR 7, group H1). Everything finish says goes into Sallie's chat, so every sentence the
// groups above give is walked here, for the made-up episode and for one named with an accent and a quote: none holds a path (no slash but
// the folder name final/, no tilde), a flag (no two dashes), a command's name (no edit.js, no node) or the word "Studio" but in a Mac's
// name; each file name in them is the name of a project or of an export that was made; and the lines are the same for both names, but
// for what the name changes. A session, and a video not yet answered, are refused at once whatever Downloads holds, naming nothing in it.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { editMain, finishEpisode } from "../edit.js";
import { finishNow } from "../finish.js";
import { exportNameOf } from "../exports.js";
import { nextFor } from "../guide.js";
import { LATE_CHECK_MS } from "../dropbox.js";
import { PIN } from "../hyperframes.js";
import { EDITED, FOLDER, NAME, NOT_YET, PROJECT, SRT, reread } from "./episodes.js";
import { EPISODE } from "./phase4.js";
import { MAIN, REEL2, ZONE, changeAt, clipWorld, entry, exportOf, fw, namesFor, probeFor } from "./exports-world.js";

const ACCENTED = 'Café "prix": quoi?';
const NAMES = [NAME, ACCENTED];
const DEFAULT = namesFor(NAME);
/** The made-up episode with its name, which is the made-up one unless another is given. */
const W = (name, opts = {}) => keep(fw({ ...opts, ...(name === NAME ? {} : { name }) }));
/** Every world a test makes has a folder of its own in the temporary directory, which goes when the tests do. */
const worlds = [];
function keep(w) {
  worlds.push(w);
  return w;
}
after(() => {
  for (const w of worlds) w.t.done();
});
const linesOf = (text) => (text === "" ? [] : text.split("\n"));
/** The names of the exports a test made, and of the files she names in it: the names her lines may hold, though the finish took them away. */
const made = new Set();
function exported(w, key, opts) {
  const got = exportOf(w, key, opts);
  made.add(got.name);
  return got;
}

/** Every name a line may hold: the projects', the files of the made-up Downloads and of what the other Mac released, and a project's renders. */
function namesIn(w) {
  const files = (dir) => {
    try {
      return readdirSync(dir);
    } catch (e) {
      return [];
    }
  };
  return new Set([
    ...made, "nothing.mp4", ...Object.values(w.names), ...files(w.downloads), ...files(join(w.found.folder, "edit", "from-hyperframes")),
    ...Object.values(w.names).flatMap((project) => files(join(w.work, project, "renders"))), ...Object.values(PROJECT), `${PROJECT.main}.fcpxmld`, `${PROJECT.main}.mp4`
  ]);
}

/** What is wrong with the words of lines, each as a problem: a path, a flag, a command, the word Studio outside a Mac's name, or a file
    name that is no project's or export's. */
function problemsIn(lines, names) {
  const longest = [...names].filter(Boolean).sort((a, b) => b.length - a.length);
  const problems = [];
  for (const line of lines) {
    let rest = line;
    for (const name of longest) rest = rest.split(name).join("(a name)");
    rest = rest.replace(/\bfinal\//g, "final");
    const checks = [
      [/\//, "a path"], [/~/, "a path"], [/--/, "a flag"], [/\bedit\.js\b/, "a command"], [/\bnode\b/, "a command"], [/\bnpx\b/, "a command"],
      [/\.(mp4|mov|m4v|webm|json|srt|txt|fcpxmld?|xml)\b/i, "a file name that is no project's or export's"]
    ];
    for (const [pattern, what] of checks) if (pattern.test(rest)) problems.push(`${what} in: ${line}`);
    if (/\bStudio\b/.test(rest.replace(/Mac Studio/g, ""))) problems.push(`the word Studio in: ${line}`);
  }
  return problems;
}

/** The lines the quick part says now, with the episode as the disk holds it. */
async function quick(w, answers = {}) {
  const had = linesOf(w.t.said()).length;
  await finishEpisode(w.t.ctx, { ...w.found, record: reread(w.found) }, answers);
  return linesOf(w.t.said()).slice(had);
}
/** The lines a whole finish says: the quick part's, and what the detached part failed at and offers. */
async function whole(w, answers = {}, deps = {}) {
  const lines = await quick(w, { yes: true, ...answers });
  if (!w.t.started.length) return lines;
  const result = await finishNow(w.t.ctx, { ...w.found, record: reread(w.found) }, deps);
  return [...lines, ...result.failed, ...(result.next ? [result.next] : [])];
}
const touch = (file, at) => utimesSync(file, new Date(at), new Date(at));
/** A finish asked with a yes and then run, as the line of what it failed at. */
async function ran(w, deps = {}) {
  await quick(w, { yes: true });
  return finishNow(w.t.ctx, { ...w.found, record: reread(w.found) }, deps);
}

/** The scenarios, each from an episode's name to { w, lines }: the world to look the names up in, and what was said. */
const SCENARIOS = {
  "the exports it found": async (name) => {
    const w = W(name);
    exported(w, "main");
    exported(w, "reel 2");
    return { w, lines: await quick(w) };
  },
  "the start": async (name) => {
    const w = W(name);
    exported(w, "main");
    exported(w, "reel 2");
    return { w, lines: await quick(w, { yes: true }) };
  },
  "an export older than the last change, and the word that it is final": async (name) => {
    const w = W(name, { projects: ["main"], over: { reels: [] } });
    exported(w, "main", { start: [13, 56, 40] });
    changeAt(w, "main", [14, 30, 0]);
    return { w, lines: [...(await quick(w)), ...(await quick(w, { final: ["main"] }))] };
  },
  "two exports begun in one minute, and a file she names that is none": async (name) => {
    const w = W(name, { projects: ["main"], over: { reels: [] } });
    exported(w, "main", { start: [13, 56, 5], ending: "mp4" });
    exported(w, "main", { start: [13, 56, 40], ending: "mov", record: false });
    return { w, lines: [...(await quick(w)), ...(await quick(w, { take: { main: "nothing.mp4" } })), ...(await quick(w, { take: { main: "this Mac" } }))] };
  },
  "a Reel with no export, and a main video with none": async (name) => {
    const w = W(name);
    exported(w, "main");
    const none = W(name);
    return { w, lines: [...(await quick(w)), ...(await quick(none)), ...(await quick(none, { yes: true }))] };
  },
  "a WebM, and a render that is no export": async (name) => {
    const w = W(name, { projects: ["main"], over: { reels: [] } });
    exported(w, "main");
    exported(w, "main", { start: [13, 58, 0], ending: "webm", record: false });
    const render = join(w.dirOf("main"), "renders", `${w.names.main}_2026-10-20_13-59-02.mp4`);
    writeFileSync(render, "a render");
    touch(render, w.t.now() - 3600000);
    return { w, lines: await quick(w) };
  },
  "a Reel picked with no project, a Reel with no title, and a project with no Reel": async (name) => {
    const left = W(name, { projects: ["main"] });
    exported(left, "main");
    const untitled = W(name, { over: { reels: EPISODE.record.reels.map((r) => (r.n === 2 ? { ...r, title: "" } : r)) } });
    exported(untitled, "main");
    exported(untitled, "reel 2");
    const orphan = W(name, { over: { reels: [] } });
    exported(orphan, "main");
    exported(orphan, "reel 2");
    return { w: left, lines: [...(await quick(left)), ...(await quick(untitled)), ...(await quick(orphan, { yes: true }))] };
  },
  "a project on the other Mac": async (name) => {
    const record = (names) => ({ reels: [], app: { toolchain: PIN.version, projects: [entry("main", { on: "Sallie's laptop" }, names)] } });
    const w = W(name, { projects: ["main"], over: record(name === NAME ? DEFAULT : namesFor(name)) });
    rmSync(w.dirOf("main"), { recursive: true });
    exported(w, "main", { folder: join(w.found.folder, "edit", "from-hyperframes"), record: false });
    const stopped = W(name, { projects: ["main"], over: record(name === NAME ? DEFAULT : namesFor(name)) });
    rmSync(stopped.dirOf("main"), { recursive: true });
    return { w, lines: [...(await quick(w)), ...(await quick(stopped))] };
  },
  "this Mac will not let it look in Downloads, and a video never opened": async (name) => {
    const w = W(name);
    w.t.ctx.deps.readdir = (dir, ...more) => {
      if (dir === w.downloads) throw Object.assign(new Error("EPERM: operation not permitted"), { code: "EPERM" });
      return readdirSync(dir, ...more);
    };
    const never = W(name, { projects: null });
    return { w, lines: [...(await quick(w)), ...(await quick(never, { yes: true }))] };
  },
  "an episode finished already, kept, and a project changed since": async (name) => {
    const w = W(name);
    exported(w, "main");
    exported(w, "reel 2");
    const first = await whole(w);
    const kept = await quick(w);
    changeAt(w, "main", [23, 0, 0]);
    return { w, lines: [...first, ...kept, ...(await quick(w))] };
  },
  "an episode edited in Final Cut beside a Reel from HyperFrames": async (name) => {
    const pushes = [{ v: 5, at: "2026-10-20T10:00:00-05:00", on: "Mac Studio", file: "edit/x.v5.mac-studio.fcpxml", project: PROJECT.main }];
    const w = W(name, { projects: ["reel 2"], over: { main: { ...EDITED.main, pushed: pushes } } });
    w.t.shared(`${PROJECT.main}.mp4`, 2000);
    w.t.shared(`${PROJECT.main}.fcpxmld`, 3000);
    exported(w, "reel 2");
    return { w, lines: await whole(w) };
  },
  "a finish that went well": async (name) => {
    const w = W(name);
    exported(w, "main");
    exported(w, "reel 2");
    return { w, lines: await whole(w) };
  },
  "an export still being written, and one Dropbox could not bring": async (name) => {
    const w = W(name);
    const main = exported(w, "main");
    exported(w, "reel 2");
    const wait = w.t.ctx.deps.wait;
    w.t.ctx.deps.wait = async (ms) => {
      w.t.grow(main.path, 1000);
      return wait(ms);
    };
    const growing = await ran(w);
    const other = W(name);
    exported(other, "main");
    const placeholder = exported(other, "reel 2");
    other.t.ctx.isWhole = (path) => path !== placeholder.path;
    other.t.ctx.deps.readAll = async () => {
      throw new Error("Dropbox sent nothing of it for 5 minutes, so it was given up");
    };
    const brought = await ran(other);
    return { w, lines: [...growing.failed, ...brought.failed] };
  },
  "the checks: shape, sound and colour": async (name) => {
    const shape = W(name, { programs: { FFPROBE: probeFor((file) => (file.includes("reel 2") ? { picture: { width: 1920, height: 1080 } } : file.includes("main") ? { picture: { width: 1080, height: 1920 } } : {})) } });
    exported(shape, "main");
    exported(shape, "reel 2");
    const silent = W(name, { programs: { FFPROBE: probeFor(() => ({ sound: null })) } });
    exported(silent, "main");
    exported(silent, "reel 2");
    const tagged = W(name, { programs: { FFPROBE: probeFor((file) => (file.includes("main") ? { picture: { width: 1280, height: 720, color_primaries: "bt2020", color_transfer: "smpte2084" } } : { picture: { width: 1080, height: 1920 } })) } });
    exported(tagged, "main");
    exported(tagged, "reel 2");
    return { w: shape, lines: [...(await whole(shape)), ...(await whole(silent)), ...(await whole(tagged))] };
  },
  "a Reel that does not start as its suggestion does, and an export that changed": async (name) => {
    const w = W(name, { captions: { "reel 2": SRT["reel 2"] } });
    exported(w, "main");
    exported(w, "reel 2");
    const first = await whole(w);
    const changing = W(name);
    const main = exported(changing, "main");
    exported(changing, "reel 2");
    const run = changing.t.ctx.deps.run;
    let once = true;
    changing.t.ctx.deps.run = async (cmd, args, more) => {
      if (once && cmd === "WHISPER") {
        once = false;
        writeFileSync(main.path, "an export made again");
        touch(main.path, changing.t.now() + 60000);
      }
      return run(cmd, args, more);
    };
    const result = await ran(changing);
    return { w, lines: [...first, ...result.failed] };
  },
  "a copy not whole at the late check, and a file changed after it was taken": async (name) => {
    const w = W(name);
    exported(w, "main");
    exported(w, "reel 2");
    const bad = await ran(w, { lateCheck: () => ["A copy is not whole in final (it is missing)."] });
    const later = W(name);
    exported(later, "main");
    const reel = exported(later, "reel 2");
    const waited = later.t.ctx.deps.wait;
    later.t.ctx.deps.wait = async (ms) => {
      if (ms === LATE_CHECK_MS) {
        writeFileSync(reel.path, "made again");
        touch(reel.path, later.t.now() + 60000);
      }
      return waited(ms);
    };
    const changed = await ran(later);
    return { w, lines: [...(bad.next ? [bad.next] : []), ...(changed.next ? [changed.next] : [])] };
  },
  "an iPhone clip: asked, written already, waiting for version 2, spellings not answered": async () => {
    const lines = [];
    const run = async (clip, ...argv) => {
      const said = [];
      await editMain(argv, { ...clip.t.ctx.deps, say: (line) => said.push(line) });
      lines.push(...said);
    };
    const asked = keep(clipWorld({ answer: ["Ogdin"] }));
    await run(asked, "finish", FOLDER);
    await run(asked, "finish", FOLDER, "--as-it-is");
    await run(asked, "finish", FOLDER);
    await run(keep(clipWorld({ version: 1, answer: ["Ogdin"] })), "finish", FOLDER);
    const unanswered = keep(clipWorld());
    await run(unanswered, "finish", FOLDER);
    await run(unanswered, "spell", FOLDER, "offers", "1");
    return { w: { names: DEFAULT, downloads: "", found: asked.found, work: "" }, lines };
  },
  "the guide's next step for an iPhone clip": async () => {
    const facts = { name: "Pricing talk", id: "e-20261020-3fa9c1", aliases: [], at: 0, mac: "", drop: null, conflicted: false, kind: "short video", waiting: false, heldAsSession: false, elsewhere: false, readingsOff: false, reading: "done", readsAt: "", roughAt: "", offersAnswered: true, v2: true, placeholder: false, shownInFinalCut: false, finishRunning: false, shownSinceFinish: false, session: null, handoff: null, source: null };
    return { w: { names: DEFAULT, downloads: "", found: { folder: "" }, work: "" }, lines: [nextFor(facts, { version: 1, handoffs: {}, finished: {} }, 0).text] };
  }
};

describe("H1. the words of finish from HyperFrames' exports", () => {
  for (const [label, scenario] of Object.entries(SCENARIOS)) {
    it(`says ${label} in plain words, for an episode named with an accent and a quote too`, async () => {
      const lines = {};
      for (const name of NAMES) {
        const got = await scenario(name);
        lines[name] = got.lines;
        assert.ok(got.lines.length > 0 && got.lines.every((line) => line.length > 0), `${name}: no lines`);
        const problems = problemsIn(got.lines, new Set([...namesIn(got.w), name]));
        assert.deepEqual(problems, [], `${name}: ${problems.join("\n")}`);
      }
      // The same lines for both names, but for what the name changes: the episode's name and its projects' names.
      const swapped = lines[NAME].map((line) => {
        let out = line;
        for (const key of Object.keys(DEFAULT)) out = out.split(DEFAULT[key]).join(namesFor(ACCENTED)[key]);
        return out.split(NAME).join(ACCENTED);
      });
      assert.deepEqual(lines[ACCENTED], swapped);
    });
  }
  it("names in its lines about an export only the export the app made: a project's name, a day and a time", async () => {
    const w = W(NAME);
    const main = exported(w, "main");
    const reel = exported(w, "reel 2");
    const said = (await quick(w)).join("\n");
    assert.ok(said.includes(main.name) && said.includes(reel.name));
    assert.deepEqual([exportNameOf(main.name).project, exportNameOf(reel.name).project, ZONE.text(main.began)], [MAIN, REEL2, "2026-10-20 13:56"]);
    w.t.done();
  });
});

describe("H1. a session and a video not yet answered are refused at once, whatever Downloads holds", () => {
  for (const [what, fields, refusal, shown] of NOT_YET) {
    it(`says only that ${what} cannot be finished, naming nothing in Downloads, with or without a yes`, async () => {
      const w = keep(fw({ over: fields }));
      const secret = "Jane Doe coaching call main 3fa9c1 2026-10-20 13.56.mp4";
      mkdirSync(w.downloads, { recursive: true });
      writeFileSync(join(w.downloads, secret), "a client's export");
      for (const answers of [{}, { yes: true }]) {
        const lines = await quick(w, answers);
        assert.deepEqual(lines, [refusal(shown(w.found.record.label))], what);
        assert.ok(!lines.join("\n").includes("Jane"));
      }
      assert.deepEqual([w.t.started, existsSync(join(w.work, "finish.asked.json")), reread(w.found).rev], [[], false, w.found.record.rev]);
      w.t.done();
    });
  }
});
