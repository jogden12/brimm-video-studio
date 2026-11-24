// Her guide's next step for a Reel Kit edit (plan Task 20): the edit's storyboard, her go, and its way out (a headless render, or the
// HyperFrames app), before the hand-off; the BRIMM Ops page's steps after the hand-off stay as they are. None of it needs a disk or a program:
// the facts are given as edit.js would read them (reelKitEdits, from the record and a look at each edit's studio.json).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { OPS, nextFor, opsText, reelKitEdits, REEL_KIT_STATES } from "../guide.js";
import { KEPT } from "../app.js";
import { MAKER } from "../reel-kit-project.js";

const NONE = { version: 1, handoffs: {}, finished: {} };
const NOW = Date.parse("2026-10-25T12:00:00-05:00");
const HANDOFF = { id: "e-20261020-3fa9c1", revision: 1, kind: "finished", emptyAt: null, at: Date.parse("2026-10-20T13:00:00-05:00"), file: "Talk.mp4" };
const BASE = { name: "Pricing talk (3fa9c1)", id: "e-20261020-3fa9c1", aliases: [], at: 0, mac: "", drop: null, conflicted: false, kind: "raw", waiting: false, heldAsSession: false, elsewhere: false, readingsOff: false, reading: "done", readsAt: "", roughAt: "", offersAnswered: true, v2: true, app: true, placeholder: false, editedInFinalCut: false, finishRunning: false, session: null, handoff: null, source: null };
const shown = (n) => (n.done ? { done: true } : { stage: n.stage, text: n.text });
/** One Reel Kit edit as the guide reads it: its part and its state. */
const EDIT = (key, state, over = {}) => ({ key, state, step: "", usage: false, qa: false, ...over });
/** The main project in HyperFrames, exported: the main video is ready to be handed off, as far as it goes. */
const EXPORTED = { opened: true, last: "", exported: true, exportsWords: "" };

const FOLLOW = 'Say "how are the Reel Kit edits going?" to follow it.';
/** Her one next step for an edit of the part `key` in each state, by what she says to hand it off ("hand it off" for a raw video and an iPhone
    clip, "hand off the Reels" for a finished video's Reels) and whether this Mac's settings have the app on. */
function words(key, state, { handOff = "hand it off", app = true, usage = false, qa = false, step = "cut" } = {}) {
  const its = key === "main" ? "Its" : `Reel ${key.slice(5)}'s`;
  const edit = `${its} Reel Kit edit`;
  const lower = `${its === "Its" ? "its" : its} Reel Kit edit`;
  const at = step ? ` at ${step}` : "";
  return {
    queued: `${edit} is in the queue to be made. ${FOLLOW}`,
    working: `${edit} is being made. ${FOLLOW}`,
    rendering: `${edit} is being rendered. ${FOLLOW}`,
    stopped: usage ? `Your Claude usage ran out, so ${lower} stopped${at}. Once it's back, say "carry on with the edit".` : `${edit} stopped${at} before it was done. Say "carry on with the edit".`,
    storyboard: `${its} Reel Kit storyboard is ready. Say "show me the storyboard" to see it in the side panel and leave your notes there, then "make the changes", or "looks good, render it" if it is right.`,
    ready: app ? `${edit} is built. Say "render it", or "open it in HyperFrames" to change it there.` : `${edit} is built. Say "render it".`,
    opened: `${edit} is open in HyperFrames. When you are done there, export it on This Mac, as MP4, then say "${handOff}".`,
    refused: `${edit} isn't as Reel Kit left it, so it can't be rendered: ask Jason.`,
    "render-failed": `${edit} is built, but its last render ${qa ? "didn't pass Reel Kit's own checks" : "didn't finish"}, so nothing was kept: ask Jason.`,
    rendered: `${edit} is rendered. Say "${handOff}" and I will check it.`,
    failed: `${edit} couldn't be made: ask Jason.`,
    unread: `I can't read how ${lower} is doing on this Mac: ask Jason.`
  }[state];
}

/** A raw video, an iPhone clip and a finished video, each where a Reel Kit edit of its main video or of its Reel 2 is said: before the hand-off for
    the first two (their main video's edit, or their Reel's once the main video is exported), after it for the finished video, whose Reels come
    after its hand-off is written. `edits` is what the guide reads of its Reel Kit edits. */
const VIDEO = {
  raw: (part, edits, over = {}) => ({ ...BASE, kind: "raw", way: "hyperframes", project: part === "main" ? null : EXPORTED, reelKit: edits, ...over }),
  clip: (part, edits, over = {}) => ({ ...BASE, kind: "short video", way: "hyperframes", project: part === "main" ? null : EXPORTED, reelKit: edits, ...over }),
  finished: (part, edits, over = {}) => ({ ...BASE, kind: "finished", handoff: HANDOFF, reelsExported: [], reelKit: edits, ...over })
};
const KEY = { main: "main", reel: "reel 2" };
/** The states of a finished video's Reel Kit Reel that are hers to act on, which come before the BRIMM Ops page's steps after its hand-off. */
const ACTS_AFTER = ["queued", "working", "rendering", "stopped", "storyboard", "ready", "opened"];
const TAKEN = `On the BRIMM Ops page: ${opsText(HANDOFF, "taken", false, undefined)}`;

describe("her next step for a Reel Kit edit", () => {
  it("gives one next step for each Reel Kit state: storyboard, go, render or app", () => {
    const rows = [
      // The main video's edit of a raw video, before its hand-off: in place of HyperFrames' steps, which `app` refuses for a Reel Kit part.
      [VIDEO.raw("main", [EDIT("main", "queued")]), "reel-kit-queued", words("main", "queued")],
      [VIDEO.raw("main", [EDIT("main", "working")]), "reel-kit-working", words("main", "working")],
      [VIDEO.raw("main", [EDIT("main", "rendering")]), "reel-kit-rendering", words("main", "rendering")],
      [VIDEO.raw("main", [EDIT("main", "stopped", { step: "cut", usage: true })]), "reel-kit-stopped", words("main", "stopped", { usage: true })],
      [VIDEO.raw("main", [EDIT("main", "stopped", { step: "cut" })]), "reel-kit-stopped", words("main", "stopped")],
      [VIDEO.raw("main", [EDIT("main", "storyboard")]), "reel-kit-storyboard", words("main", "storyboard")],
      [VIDEO.raw("main", [EDIT("main", "ready")]), "reel-kit-ready", words("main", "ready")],
      // On a Mac whose settings have the app off, nothing opens a project: only the render is offered.
      [VIDEO.raw("main", [EDIT("main", "ready")], { app: false }), "reel-kit-ready", words("main", "ready", { app: false })],
      [VIDEO.raw("main", [EDIT("main", "opened")]), "reel-kit-opened", words("main", "opened")],
      [VIDEO.raw("main", [EDIT("main", "refused")]), "reel-kit-refused", words("main", "refused")],
      [VIDEO.raw("main", [EDIT("main", "render-failed", { qa: true })]), "reel-kit-render-failed", words("main", "render-failed", { qa: true })],
      [VIDEO.raw("main", [EDIT("main", "render-failed")]), "reel-kit-render-failed", words("main", "render-failed")],
      [VIDEO.raw("main", [EDIT("main", "rendered")]), "reel-kit-rendered", words("main", "rendered")],
      [VIDEO.raw("main", [EDIT("main", "failed")]), "reel-kit-failed", words("main", "failed")],
      [VIDEO.raw("main", [EDIT("main", "unread")]), "reel-kit-unread", words("main", "unread")],
      // Task 15's review: an iPhone clip whose main video is a Reel Kit edit is finished the HyperFrames way (edit.js finishWay) with no project in
      // HyperFrames; it is told its edit's step, never 'Say "open it in HyperFrames"', which `app` refuses for it.
      [VIDEO.clip("main", [EDIT("main", "storyboard")]), "reel-kit-storyboard", words("main", "storyboard")],
      [VIDEO.clip("main", [EDIT("main", "rendered")]), "reel-kit-rendered", words("main", "rendered")],
      [VIDEO.clip("main", [EDIT("main", "rendered")], { way: "clip" }), "reel-kit-rendered", words("main", "rendered")],
      // A Reel's edit of a raw video whose main video is exported from HyperFrames: settled before the hand-off, which takes the Reels with it.
      [VIDEO.raw("reel", [EDIT("reel 2", "storyboard")]), "reel-kit-storyboard", words("reel 2", "storyboard")],
      [VIDEO.raw("reel", [EDIT("reel 2", "opened")]), "reel-kit-opened", words("reel 2", "opened")],
      [VIDEO.raw("reel", [EDIT("reel 2", "rendered")]), "exported", 'You have exported it. Say "hand it off" and I will check what you exported.'],
      // Its main video still in HyperFrames: that comes first, as one step.
      [VIDEO.raw("reel", [EDIT("reel 2", "storyboard")], { project: { ...EXPORTED, exported: false } }), "in-app", 'Edit it in HyperFrames. When you are done, export it on This Mac, as MP4, then say "hand it off".'],
      // Both a Reel Kit main and a Reel: the main video's first, then the Reel's, then the hand-off.
      [VIDEO.raw("main", [EDIT("main", "ready"), EDIT("reel 2", "storyboard")]), "reel-kit-ready", words("main", "ready")],
      [VIDEO.raw("main", [EDIT("main", "rendered"), EDIT("reel 2", "storyboard")]), "reel-kit-storyboard", words("reel 2", "storyboard")],
      [VIDEO.raw("main", [EDIT("main", "rendered"), EDIT("reel 2", "rendered")]), "reel-kit-rendered", words("main", "rendered")],
      // A finished video's Reel, after its hand-off: ahead of the BRIMM Ops page's steps, and handed off with "hand off the Reels".
      [VIDEO.finished("reel", [EDIT("reel 2", "storyboard")]), "reel-kit-storyboard", words("reel 2", "storyboard")],
      [VIDEO.finished("reel", [EDIT("reel 2", "opened")]), "reel-kit-opened", words("reel 2", "opened", { handOff: "hand off the Reels" })],
      // Task 15's review: a Reel Kit render is rendered, not exported from HyperFrames.
      [VIDEO.finished("reel", [EDIT("reel 2", "rendered")], { reelsExported: [2] }), "reels-exported", 'Reel 2 is rendered. Say "hand off the Reels" to add it to the hand-off.'],
      [VIDEO.finished("reel", [EDIT("reel 2", "rendered"), EDIT("reel 3", "rendered")], { reelsExported: [2, 3] }), "reels-exported", 'Reel 2 and Reel 3 are rendered. Say "hand off the Reels" to add them to the hand-off.'],
      [VIDEO.finished("reel", [EDIT("reel 2", "rendered")], { reelsExported: [1, 2] }), "reels-exported", 'You have exported Reel 1 from HyperFrames, and Reel 2 is rendered. Say "hand off the Reels" to add them to the hand-off.'],
      // A Reel Kit edit opened in the app and exported from it is exported from HyperFrames, as it says.
      [VIDEO.finished("reel", [EDIT("reel 2", "opened")], { reelsExported: [2] }), "reels-exported", 'You have exported Reel 2 from HyperFrames. Say "hand off the Reels" to add it to the hand-off.'],
      [VIDEO.finished("reel", [EDIT("reel 2", "rendered")], { reelsExported: [2], checking: { at: "15:20" } }), "reels-exported", 'Reel 2 is rendered. Say "hand off the Reels" after 15:20 to add it to the hand-off.'],
      // Rendered and already in the hand-off: the page's steps.
      [VIDEO.finished("reel", [EDIT("reel 2", "rendered")]), "ops", TAKEN]
    ];
    for (const [facts, stage, text] of rows) assert.deepEqual(shown(nextFor(facts, NONE, NOW)), { stage, text }, JSON.stringify(facts.reelKit) + JSON.stringify({ kind: facts.kind, project: facts.project }));
  });

  it("walks every Reel Kit state of a raw video, an iPhone clip and a finished video, for its main video and a Reel, to exactly one true next step", () => {
    let walked = 0;
    for (const kind of ["raw", "clip", "finished"]) {
      for (const part of ["main", "reel"]) {
        for (const state of REEL_KIT_STATES) {
          for (const app of [true, false]) {
            for (const extra of [{}, { usage: true, step: "cut" }, { qa: true }]) {
              const key = KEY[part];
              const edit = EDIT(key, state, extra);
              const facts = VIDEO[kind](part, [edit], { app });
              const next = nextFor(facts, NONE, NOW);
              const what = `${kind} ${part} ${state} app ${app} ${JSON.stringify(extra)}`;
              walked++;
              assert.equal(next.done, false, what);
              assert.equal(typeof next.text, "string", what);
              assert.ok(next.text.length > 0, what);
              if (kind === "finished" && part === "main") {
                // A finished video's main video is not edited here: `finish` takes no edit of it. Its step is the one it has without the edit.
                assert.deepEqual(next, nextFor({ ...facts, reelKit: [] }, NONE, NOW), what);
                continue;
              }
              if (kind === "finished" && (state === "rendered" || !ACTS_AFTER.includes(state))) {
                // Rendered and in the hand-off already (no Reel waiting), or in a state that is not hers to act on (Jason's: failed, refused, a
                // render that failed, unread): the page's steps, as they are, so that her "done" on the page is never refused for it.
                assert.deepEqual(shown(next), { stage: "ops", text: TAKEN }, what);
                continue;
              }
              if (part === "reel" && state === "rendered") {
                // The Reel is done, and the main video is exported: the hand-off, as it is today.
                assert.equal(next.stage, "exported", what);
                continue;
              }
              const handOff = kind === "finished" ? "hand off the Reels" : "hand it off";
              assert.equal(next.stage, `reel-kit-${state}`, what);
              assert.equal(next.text, words(key, state, { handOff, app, usage: extra.usage === true, qa: extra.qa === true, step: extra.step ?? "" }), what);
              assert.equal(next.step, "", what);
              assert.ok(next.text.length <= 200, what);
              // Never a path, a flag or a command; HyperFrames offered only where the app opens it; a render never called an export from HyperFrames.
              assert.doesNotMatch(next.text, /\/|--|`|edit\.js|reelkit/, what);
              if (!(state === "ready" && app)) assert.doesNotMatch(next.text, /open it in HyperFrames/, what);
              assert.doesNotMatch(next.text, /exported .* from HyperFrames/, what);
              // One step: a single sentence telling her what to say, at most one place to say it from.
              assert.ok((next.text.match(/Say "|say "/g) ?? []).length <= 1, what);
            }
          }
        }
      }
    }
    assert.equal(walked, 3 * 2 * REEL_KIT_STATES.length * 2 * 3);
  });

  it("leaves the steps after the hand-off as they are", () => {
    // The page's own words, for every step of every kind, taken again or not, kept on a Mac or not, from every note: as they were before Reel Kit.
    const lines = [];
    for (const [kind, family] of [["finished", "episode"], ["raw", "episode"], ["short video", "short video"], ["session", "session"]]) {
      for (const step of OPS[family]) for (const again of [false, true]) for (const local of [false, true]) for (const noteStep of OPS[family]) {
        const h = { id: "e-1", revision: again ? 2 : 1, kind, emptyAt: null, at: Date.parse("2026-10-20T13:00:00-05:00"), file: "a.mp4" };
        lines.push(opsText(h, step, again, { kind: family, step: noteStep, revision: 1, at: "" }, local));
      }
    }
    assert.equal(lines.length, 252);
    assert.equal(createHash("sha256").update(lines.join("\n")).digest("hex"), "488658984b6453de82280a6bd4f2f57e202257fe3bd73bc17553c40de65f0184");
    // A raw video and an iPhone clip with their hand-off written: whatever state a Reel Kit edit of theirs is in, the next step is the one it was.
    // A finished video whose Reel Kit edits are all rendered and in its hand-off: the same.
    const noted = (step) => ({ ...NONE, handoffs: { [HANDOFF.id]: { kind: "episode", step, revision: 1, at: "2026-10-24T09:00:00-05:00" } } });
    const notedShort = (step) => ({ ...NONE, handoffs: { [HANDOFF.id]: { kind: "short video", step, revision: 1, at: "2026-10-24T09:00:00-05:00" } } });
    for (const [kind, notes] of [["raw", [NONE, ...OPS.episode.map(noted)]], ["short video", [NONE, ...OPS["short video"].map(notedShort)]]]) {
      for (const n of notes) for (const state of REEL_KIT_STATES) for (const key of ["main", "reel 2"]) {
        const facts = { ...BASE, kind, way: "hyperframes", handoff: { ...HANDOFF, kind }, project: null };
        assert.deepEqual(nextFor({ ...facts, reelKit: [EDIT(key, state)] }, n, NOW), nextFor(facts, n, NOW), `${kind} ${state} ${key}`);
      }
    }
    for (const n of [NONE, ...OPS.episode.map(noted)]) {
      const facts = { ...BASE, kind: "finished", handoff: HANDOFF, reelsExported: [] };
      assert.deepEqual(nextFor({ ...facts, reelKit: [EDIT("main", "storyboard"), EDIT("reel 2", "rendered"), EDIT("reel 3", "rendered")] }, n, NOW), nextFor(facts, n, NOW));
    }
    // Her word that a video is finished stands: nothing of its edits is said after it.
    const finished = { ...NONE, finished: { [BASE.id]: "2026-10-24T09:00:00-05:00" } };
    for (const kind of ["raw", "clip", "finished"]) for (const part of ["main", "reel"]) assert.deepEqual(nextFor(VIDEO[kind](part, [EDIT(KEY[part], "storyboard")]), finished, NOW), { done: true });
  });

  it("after `finish … reels` hands a Reel Kit Reel off, gives the page's steps, and each in turn once noted (final review C1)", () => {
    // What finish leaves: the Reel's entry finished, its project ready and opened in the app, its export in the hand-off.
    const entry = { key: "reel 2", name: "Talk reel 2 Reel Kit v1", maker: MAKER, mode: "lofi", version: 1, madeAt: "", on: "Mac Studio", opened: ["2026-10-20 14:10"], handover: false, state: "finished", fromSuggestion: 2 };
    const seen = { status: { state: "ready", step: "", needs: [], pid: null, why: "", minutesLeft: null }, state: { state: "ready" }, rendering: false, refused: "", opened: true };
    const edits = reelKitEdits({ id: "e-1", reels: [{ n: 2, status: "finished" }], app: { projects: [entry] } }, () => seen);
    assert.deepEqual(edits, []);
    const facts = { ...BASE, kind: "finished", handoff: HANDOFF, reelsExported: [], reelKit: edits };
    let notes = NONE;
    const walked = [];
    for (let i = 0; i < OPS.episode.length + 1; i++) {
      const next = nextFor(facts, notes, NOW);
      if (next.done) break;
      assert.equal(next.stage, "ops", JSON.stringify(next));
      walked.push(next.step);
      notes = { ...notes, handoffs: { [HANDOFF.id]: { kind: "episode", step: next.step, revision: 1, at: "2026-10-24T09:00:00-05:00" } } };
    }
    assert.deepEqual(walked, OPS.episode, "every step of the page, in turn, none blocked by the Reel");
    // A Reel she dropped from the list, and an edit of it, are no step of hers either.
    const dropped = reelKitEdits({ id: "e-1", reels: [{ n: 3, status: "dropped" }], app: { projects: [{ ...entry, key: "reel 3", name: "Talk reel 3 Reel Kit v1", state: "made", opened: [] }] } }, () => ({ ...seen, opened: false, status: { ...seen.status, state: "stopped", step: "cut" } }));
    assert.deepEqual(dropped, []);
  });

  it("says nothing of Reel Kit where the gate holds the video, the other Mac has it open, or a finish is at work", () => {
    const MARK = 'It is held as a client or group session. If it is not one, say "clear the session mark".';
    for (const kind of ["raw", "clip"]) {
      assert.deepEqual(shown(nextFor(VIDEO[kind]("main", [EDIT("main", "ready")], { gated: true }), NONE, NOW)), { stage: "session-mark", text: MARK });
      assert.deepEqual(shown(nextFor(VIDEO[kind]("main", [EDIT("main", "ready")], { elsewhere: true, mac: "Mac Studio" }), NONE, NOW)), { stage: "open-elsewhere", text: "It is open on the Mac Studio. Carry on there." });
      assert.equal(nextFor(VIDEO[kind]("main", [EDIT("main", "rendered")], { finishRunning: true }), NONE, NOW).stage, "finish-running");
    }
    // A finished video's Reel is not said while the gate holds it or the other Mac has it open: the page's steps, as they are.
    for (const over of [{ gated: true }, { elsewhere: true, mac: "Mac Studio" }]) assert.equal(nextFor(VIDEO.finished("reel", [EDIT("reel 2", "storyboard")], over), NONE, NOW).stage, "ops");
    // A raw video still to be named is named first.
    assert.equal(nextFor(VIDEO.raw("main", [EDIT("main", "ready")], { placeholder: true }), NONE, NOW).stage, "name");
    // Facts that are not a list, or edits not of a part, are no edits.
    for (const reelKit of [undefined, null, "x", [null], [{ key: "reel 0", state: "ready" }], [{ key: "main" }]]) {
      const facts = VIDEO.raw("main", reelKit, { way: "hyperframes" });
      const next = nextFor(facts, NONE, NOW);
      if (Array.isArray(reelKit) && reelKit[0] && reelKit[0].key === "main") assert.equal(next.stage, "reel-kit-unread");
      else assert.equal(next.stage, "open-app", JSON.stringify(reelKit));
    }
  });
});

describe("what the guide reads of a video's Reel Kit edits (reelKitEdits)", () => {
  const entry = (key, version, over = {}) => ({ key, name: `Talk ${key} Reel Kit v${version}`, maker: MAKER, mode: "hifi", version, madeAt: "", on: "Mac Studio", opened: [], handover: false, state: "made", fromSuggestion: null, ...over });
  const record = (projects) => ({ id: "e-1", app: { projects } });
  const look = (byName) => (e) => byName[e.name] ?? { status: null, state: null, rendering: false, refused: "" };
  const seen = (state, more = {}) => ({ status: { state, step: "", needs: [], pid: null, why: "", minutesLeft: null, ...more.status }, state: { state, ...more.state }, rendering: more.rendering === true, refused: more.refused ?? "" });

  it("reads the newest edit of each part, none kept for an earlier kind and no HyperFrames project, in the part's order", () => {
    assert.equal(KEPT, "kept for an earlier kind");
    const projects = [
      entry("reel 2", 1), entry("reel 2", 2), entry("main", 1, { state: KEPT }), entry("main", 2), entry("reel 10", 1),
      { key: "reel 3", name: "Talk Reel 3", opened: [], state: "made" }, entry("reel 4", 1, { state: KEPT }), null, "x", entry("odd", 1)
    ];
    const byName = { "Talk reel 2 Reel Kit v1": seen("failed"), "Talk reel 2 Reel Kit v2": seen("storyboard"), "Talk main Reel Kit v2": seen("ready"), "Talk reel 10 Reel Kit v1": seen("working") };
    assert.deepEqual(reelKitEdits(record(projects), look(byName)), [EDIT("main", "ready"), EDIT("reel 2", "storyboard"), EDIT("reel 10", "working")]);
    assert.deepEqual(reelKitEdits({}, look({})), []);
    assert.deepEqual(reelKitEdits(null, look({})), []);
  });

  it("reads each state as her step needs it", () => {
    const one = (s, over = {}) => reelKitEdits(record([entry("main", 1, over)]), () => s)[0];
    for (const state of ["queued", "working", "storyboard", "rendered", "failed"]) assert.deepEqual(one(seen(state)), EDIT("main", state));
    assert.deepEqual(one(seen("stopped", { status: { step: "cut", why: "usage" } })), EDIT("main", "stopped", { step: "cut", usage: true }));
    assert.deepEqual(one(seen("stopped", { status: { step: "beats", why: "died" } })), EDIT("main", "stopped", { step: "beats" }));
    // Ready: built and ready to render; refused by the render's own check; its last render failed (Reel Kit's checks, or not finished).
    assert.deepEqual(one(seen("ready")), EDIT("main", "ready"));
    assert.deepEqual(one(seen("ready", { refused: "This edit was changed in HyperFrames, so Reel Kit won't render it: export it from HyperFrames on This Mac." })), EDIT("main", "refused"));
    assert.deepEqual(one(seen("ready", { state: { lastRender: { qa: "failed", why: "exit" } } })), EDIT("main", "render-failed", { qa: true }));
    assert.deepEqual(one(seen("ready", { state: { lastRender: { qa: "", why: "error" } } })), EDIT("main", "render-failed"));
    assert.deepEqual(one(seen("ready", { state: { lastRender: { qa: "passed", why: "" } } })), EDIT("main", "ready"));
    // Opened in the app (Task 17): by the record's entry, or studio.json; ahead of ready, changed or not, but not of a render done.
    assert.deepEqual(one(seen("ready"), { state: "opened" }), EDIT("main", "opened"));
    assert.deepEqual(one(seen("ready", { refused: "changed" }), { opened: ["2026-11-20T10:00:00Z"] }), EDIT("main", "opened"));
    assert.deepEqual(one(seen("opened")), EDIT("main", "opened"));
    assert.deepEqual(one(seen("rendered"), { state: "opened" }), EDIT("main", "rendered"));
    // Rendered, then changed in the app (final review C2): it is the app's, to export there and hand off, not rendered again.
    assert.deepEqual(one(seen("rendered", { refused: "This edit was changed in HyperFrames, so Reel Kit won't render it: export it from HyperFrames on This Mac." }), { state: "opened" }), EDIT("main", "opened"));
    assert.deepEqual(one(seen("rendered", { refused: "changed" })), EDIT("main", "opened"));
    // Studio's own mark that it opened the project in the app (reel-kit-worker.js wasOpened), when the record's entry was not written after the open.
    assert.deepEqual(one({ ...seen("ready"), opened: true }), EDIT("main", "opened"));
    assert.deepEqual(one({ ...seen("ready", { refused: "changed" }), opened: true }), EDIT("main", "opened"));
    assert.deepEqual(one({ ...seen("rendered"), opened: true }), EDIT("main", "rendered"));
    assert.deepEqual(one({ ...seen("ready"), opened: "yes" }), EDIT("main", "ready"), "only a mark seen, true, is one");
    // Being rendered, whatever studio.json says.
    assert.deepEqual(one(seen("ready", { rendering: true })), EDIT("main", "rendering"));
    // Nothing to read, or a state that is not one of Reel Kit's.
    assert.deepEqual(one({ status: null, state: null, rendering: false, refused: "" }), EDIT("main", "unread"));
    assert.deepEqual(one(seen("later")), EDIT("main", "unread"));
    assert.deepEqual(one(undefined), EDIT("main", "unread"));
  });

  it("leaves out an edit finish took (its entry finished), and a Reel the record says she dropped", () => {
    const projects = [entry("reel 2", 1, { state: "finished" }), entry("reel 3", 1), entry("reel 4", 1), entry("main", 1, { state: "finished" })];
    const r = { id: "e-1", reels: [{ n: 3, status: "dropped" }, { n: 4, status: "picked" }], app: { projects } };
    assert.deepEqual(reelKitEdits(r, () => seen("ready")), [EDIT("reel 4", "ready")]);
    // A queued job of a dropped Reel is no edit of hers either.
    assert.deepEqual(reelKitEdits(r, () => seen("ready"), ["reel 3"]), [EDIT("reel 4", "ready")]);
  });

  it("counts a job queued for a part whose project is not made yet, in place of an older edit of it", () => {
    const projects = [entry("reel 2", 1)];
    assert.deepEqual(reelKitEdits(record(projects), () => seen("rendered"), ["reel 2", "main", "reel 0", "x"]), [EDIT("main", "queued"), EDIT("reel 2", "queued")]);
  });
});

describe("a Reel Kit main video on a Mac that hands off version 1 only", () => {
  it("says the wait for version 2 where it would say to hand off a rendered main video, as an iPhone clip handed off as it is waits", () => {
    const WAITS = "Its hand-off is written once this Mac hands off version 2: ask Jason.";
    for (const kind of ["raw", "clip"]) {
      const rendered = nextFor(VIDEO[kind]("main", [EDIT("main", "rendered")], { v2: false }), NONE, NOW);
      assert.deepEqual(shown(rendered), { stage: "waits-v2", text: WAITS }, kind);
      // With its Reels rendered too, the hand-off is still the wait.
      assert.equal(nextFor(VIDEO[kind]("main", [EDIT("main", "rendered"), EDIT("reel 2", "rendered")], { v2: false }), NONE, NOW).stage, "waits-v2", kind);
      // Before its render, and for a Reel not rendered, the edit's own step: nothing there is a hand-off.
      for (const state of ["storyboard", "ready", "opened"]) assert.equal(nextFor(VIDEO[kind]("main", [EDIT("main", state)], { v2: false }), NONE, NOW).stage, `reel-kit-${state}`, `${kind} ${state}`);
      assert.equal(nextFor(VIDEO[kind]("main", [EDIT("main", "rendered"), EDIT("reel 2", "ready")], { v2: false }), NONE, NOW).stage, "reel-kit-ready", kind);
      // On a Mac that hands off version 2, the hand-off.
      assert.equal(nextFor(VIDEO[kind]("main", [EDIT("main", "rendered")]), NONE, NOW).text, words("main", "rendered"), kind);
    }
  });
});
