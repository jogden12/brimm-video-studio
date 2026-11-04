// The "Not gated" rule of the planned episode (PR H4; design 2026-11-03, section 5). This is safety code. A video with no kind is gated:
// its name is hidden and it is called "a video not yet answered", because it might be a client's session. A planned record is the one
// exception, since it was made in her chat from words she gave and never from a file, so it cannot be a session. But only a whole one is:
// a record is treated as answered and not a session only when its answer says "planned", its `planned` is whole, it has no video and it
// was written at layout 5. A record that only claims to be planned, failing any of those, is gated exactly as a video not yet answered
// is, and its title is hidden. Every record here that only claims to be planned is such a record, one failing one thing each.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COMMAND_NAMES, contextFor, editMain, findEpisode } from "../edit.js";
import { PLANNED, UNANSWERED, UNSCOPED, gateFor, gated, leftAlone, printWhy } from "../gate.js";
import { newPlannedEpisode, recordFile, recordText, shownName } from "../episode.js";
import { setup } from "./episodes.js";

const AT = "2026-11-04T09:12:00-05:00";
const ID = "e-20261104-3fa9c1";
const TITLE = "Too many SKUs";
const FOLDER = "2026-11-04 Too many SKUs (Mac Studio)";
const WRITER = { commit: "c709b57", on: "Mac Studio" };
const WAITING = "This video is waiting for its answer: say what it is first.";
const LEFT = "You said to leave this video: it is not for brimm-video. To have it read, say what it is.";
const NOT_PLANNED_YET = `"${TITLE}" is a planned video, and there's no footage for it yet.`;
const TO_DROP = `To drop a plan, say "drop the plan for ${TITLE}".`;

/** A whole planned record at rev 1, and the video it must not have. */
const planned = (over = {}) => ({ ...newPlannedEpisode({ id: ID, machine: "Mac Studio", at: AT, title: TITLE, route: "script", voice: null, writer: WRITER }), rev: 1, ...over });
const VIDEO = { file: "Too many SKUs.mp4", bytes: 1, seconds: 20, recorded: "2026-11-04", recordedFrom: "import" };
const ON = { teachingsOn: true };
const OFF = { teachingsOn: false };

/** Every record that only claims to be planned, each failing one of the four things (and the ones the rule adds), by what it fails. */
const CLAIMS = {
  "answer planned, with no `planned`": (() => { const { planned: _, ...rest } = planned(); return rest; })(),
  "answer planned, with a `planned` that is null": planned({ planned: null }),
  "answer planned, with a `planned` that is not whole": planned({ planned: { ...planned().planned, route: "podcast" } }),
  "answer planned, with a `planned` missing its lines": (() => { const { lines, ...rest } = planned().planned; return planned({ planned: rest }); })(),
  "answer planned, with a video": planned({ video: VIDEO }),
  "answer planned, at layout 4": planned({ version: 4 }),
  "answer planned, at layout 3": planned({ version: 3 }),
  "answer planned, at layout 6": planned({ version: 6 }),
  "answer planned, with no version": (() => { const { version, ...rest } = planned(); return rest; })(),
  "answer planned, with the video undefined": (() => { const { video, ...rest } = planned(); return rest; })(),
  "a `planned` with the answer \"needs your answer\"": planned({ answer: { state: "needs your answer", guess: "raw", seen: "wide, 2:00", came: "camera" } }),
  "a `planned` with the answer \"answered\"": planned({ answer: { state: "answered", guess: null, seen: "", came: "camera", by: "Sallie Ogden", on: "Mac Studio", at: AT, private: "no" } }),
  "a `planned` with the answer \"not for brimm-video\"": planned({ answer: { state: "not for brimm-video", guess: null, seen: "", came: "camera" } }),
  "a `planned` with no answer": (() => { const { answer, ...rest } = planned(); return rest; })(),
  "a `planned` with an answer that says \"Planned\"": planned({ answer: { ...planned().answer, state: "Planned" } }),
  "answer planned, with a guess": planned({ answer: { ...planned().answer, guess: "raw" } }),
  "answer planned, said to be private": planned({ answer: { ...planned().answer, private: "yes" } }),
  "answer planned, with a session mark": planned({ session: { marked: AT, on: "Mac Studio", teachings: null, cleared: null } }),
  "answer planned, with a session mark that is not an object": planned({ session: "yes" }),
  "answer planned, with a kind of session": planned({ kind: "session" })
};
const WITH_NO_KIND = Object.entries(CLAIMS).filter(([, r]) => r.kind === null || r.kind === undefined);
/** Those a conflicted copy can be, which the gate asks: it asks a record shaped as one, with an id and a layout number. */
const SHAPED = WITH_NO_KIND.filter(([, r]) => typeof r.id === "string" && Number.isInteger(r.version));
/** A whole record of a raw video imported before the switch, which a claim is the conflicted copy of in the tests below. */
const RAW = { ...planned(), kind: "episode", video: VIDEO, answer: undefined, planned: undefined, version: 1, name: { text: "Talk", placeholder: false } };

/** The made-up root of a test, with the planned episode (or any record) written into its Episodes as record 1, or as a conflicted copy. */
function folderWith(t, record, { name = FOLDER, rev = 1 } = {}) {
  const folder = join(t.root, "Episodes", name);
  mkdirSync(join(folder, "record"), { recursive: true });
  writeFileSync(recordFile(folder, rev), recordText({ ...record, rev }));
  return folder;
}
const put = (folder, file, record) => writeFileSync(join(folder, "record", file), recordText(record));
const COPY = "0001 (Sallie's laptop's conflicted copy 2026-11-04).json";

describe("gated, which records are named by their label (PR H4)", () => {
  it("is not a planned episode that is whole", () => {
    assert.equal(gated(planned()), false);
    assert.equal(leftAlone(planned()), false);
    for (const record of [planned({ files: { "video guide.md": 12 } }), planned({ planned: { ...planned().planned, route: "explainer", voice: "heygen" } }), planned({ archived: { at: AT } })]) assert.equal(gated(record), false);
  });
  it("is every record that only claims to be planned, as it is today: a record with no kind, which might be a client's session", () => {
    for (const [what, record] of WITH_NO_KIND) assert.equal(gated(record), true, what);
    for (const [what, record] of Object.entries(CLAIMS)) assert.equal(gated(record), true, what);
  });
  it("stays as it was for every other record: a video not yet answered or left alone, a session not cleared, and the answered kinds", () => {
    const unanswered = { kind: null, answer: { state: "needs your answer" } };
    for (const record of [unanswered, { kind: null, answer: { state: "not for brimm-video" } }, {}, null, undefined, "x", [], { kind: "session" }, { kind: "episode", session: { marked: AT, cleared: "no" } }]) {
      assert.equal(gated(record), record !== null && record !== undefined && typeof record === "object" && !Array.isArray(record), JSON.stringify(record));
    }
    for (const kind of ["finished", "raw", "short video", "episode"]) assert.equal(gated({ kind, answer: { state: "answered" } }), false, kind);
  });
});

describe("shownName, a planned record and a record that only claims to be one", () => {
  it("names a planned record by its title, and names none that only claims to be planned by it", () => {
    assert.equal(shownName(planned()), TITLE);
    for (const [what, record] of WITH_NO_KIND) {
      const name = shownName(record);
      assert.equal(name, `a video not yet answered (${ID.slice(-6)})`, what);
      assert.ok(!name.includes(TITLE), what);
    }
    // Its label, when it has one, as for any video not yet answered.
    assert.equal(shownName({ ...CLAIMS["answer planned, with a video"], label: "Video of 4 Nov, 09:12 (Mac Studio)" }), "Video of 4 Nov, 09:12 (Mac Studio)");
  });
});

describe("gateFor, a planned episode", () => {
  it("lets through the commands that name no episode, plan and name, and nothing else", () => {
    assert.deepEqual(PLANNED, ["plan", "name"]);
    for (const name of [...UNSCOPED, ...PLANNED]) for (const on of [ON, OFF]) assert.equal(gateFor(name, planned(), on), "", name);
  });
  it("says how to drop a plan to leave, and writes nothing", () => {
    for (const on of [ON, OFF]) assert.equal(gateFor("leave", planned(), on), TO_DROP);
  });
  it("refuses every other command in the same words, which name the title she gave and nothing else", () => {
    const others = COMMAND_NAMES.filter((name) => ![...UNSCOPED, ...PLANNED, "leave"].includes(name));
    assert.ok(others.length > 25, others.join(" "));
    for (const name of [...others, "somethingNew", "render", "read", "teachings"]) for (const on of [ON, OFF]) assert.equal(gateFor(name, planned(), on), NOT_PLANNED_YET, name);
  });
  it("names the plan by its name when she has given it another, as every line does", () => {
    const renamed = planned({ name: { text: "Why SKUs sink you", placeholder: false } });
    assert.equal(gateFor("open", renamed, ON), `"Why SKUs sink you" is a planned video, and there's no footage for it yet.`);
    assert.equal(gateFor("leave", renamed, ON), `To drop a plan, say "drop the plan for Why SKUs sink you".`);
  });
  it("gates a record that only claims to be planned as it gates a video with no kind: waiting for its answer, naming no title", () => {
    for (const [what, record] of WITH_NO_KIND) {
      const why = record.answer && record.answer.state === "not for brimm-video" ? LEFT : WAITING;
      for (const name of COMMAND_NAMES) {
        const got = gateFor(name, record, ON);
        const want = UNSCOPED.includes(name) || UNANSWERED.includes(name) ? "" : why;
        assert.equal(got, want, `${what}: ${name}`);
        assert.ok(!got.includes(TITLE), `${what}: ${name}`);
      }
    }
  });
  it("refuses `plan` and `name` to a record that only claims to be planned, as it refuses them to a video waiting for its answer", () => {
    for (const [what, record] of WITH_NO_KIND) for (const name of ["plan", "name"]) assert.equal(gateFor(name, record, ON), record.answer && record.answer.state === "not for brimm-video" ? LEFT : WAITING, `${what}: ${name}`);
  });
  it("walks every command: plan and name run for a plan, leave says how to drop it, and all the rest are refused", () => {
    for (const name of COMMAND_NAMES) {
      const got = gateFor(name, planned(), OFF);
      if (UNSCOPED.includes(name) || PLANNED.includes(name)) assert.equal(got, "", name);
      else assert.equal(got, name === "leave" ? TO_DROP : NOT_PLANNED_YET, name);
    }
  });
});

describe("printWhy, what `show` may not print", () => {
  it("is not reached by a planned episode, which the gate refuses show; a record that only claims to be planned is refused as a video not yet answered is", () => {
    for (const [what, record] of WITH_NO_KIND) {
      assert.match(printWhy(record), /^Its words are not shown in the chat/, what);
      assert.ok(!printWhy(record).includes(TITLE), what);
    }
  });
});

describe("findEpisode and the names a gated episode hides, with a planned episode in Episodes", () => {
  /** The context a command is run in, asked for `command`, as editMain makes it. */
  const asked = (t, command) => ({ ...contextFor({ ...t.ctx.deps, say: () => {} }), asked: { command, words: [] } });
  it("finds a planned episode by its title, whatever its case, by its words, by its id and by its folder, and shows its title", () => {
    const t = setup();
    try {
      folderWith(t, planned());
      for (const said of [TITLE, "too many skus", "  Too   many SKUs ", "skus", "many", ID, ID.slice(-6), FOLDER, `${TITLE} (${ID.slice(-6)})`]) {
        const found = findEpisode(asked(t, "plan"), said);
        assert.equal(found.name, FOLDER, said);
        assert.equal(found.why, undefined, said);
      }
      // Nothing of it is hidden from a line a command says, since it is no secret.
      const ctx = asked(t, "plan");
      findEpisode(ctx, TITLE);
      assert.deepEqual([ctx.hidden.names, ctx.hidden.keep], [[], []]);
    } finally {
      t.done();
    }
  });
  it("finds the planned episode by its title alone when another episode's words fit as well, since the whole title is its label", () => {
    const t = setup();
    try {
      folderWith(t, planned());
      folderWith(t, { ...RAW, id: "e-20261001-aaaaaa", name: { text: "Too many SKUs in stock", placeholder: false } }, { name: "2026-10-01 Too many SKUs in stock (Mac Studio)" });
      const found = findEpisode(asked(t, "plan"), TITLE);
      assert.equal(found.name, FOLDER);
      assert.match(findEpisode(asked(t, "plan"), "SKUs").why, /^More than one episode fits "SKUs"/);
    } finally {
      t.done();
    }
  });
  it("does not find a record that only claims to be planned by its title or its words, and hides its title and its folder", () => {
    for (const [what, claim] of SHAPED) {
      const t = setup();
      try {
        // A whole video's record in force, with the claim as the conflicted copy Dropbox kept of it: the gate asks every record it knows.
        const folder = folderWith(t, RAW);
        put(folder, COPY, { ...claim, rev: 1 });
        const ctx = asked(t, "open");
        const found = findEpisode(ctx, FOLDER);
        assert.ok([WAITING, LEFT].includes(found.why), `${what}: ${found.why}`);
        assert.ok(ctx.hidden.names.includes(FOLDER), what);
        assert.ok(ctx.hidden.names.some((n) => n.includes("Too many SKUs")), what);
        // By its title or its words it is not found: it is never tied to its label.
        assert.match(findEpisode(asked(t, "open"), TITLE).why, /^No episode fits/, what);
        assert.match(findEpisode(asked(t, "open"), "skus").why, /^No episode fits/, what);
      } finally {
        t.done();
      }
    }
  });
  it("hides the title of a plan that is only in the history of an episode that is gated now (its footage came, and it is a video not yet answered)", () => {
    const t = setup();
    try {
      const folder = folderWith(t, planned());
      writeFileSync(recordFile(folder, 2), recordText({ ...planned(), rev: 2, version: 3, kind: null, planned: undefined, video: VIDEO, answer: { state: "needs your answer", guess: "raw", seen: "wide, 2:00", came: "camera" }, label: "Video of 4 Nov, 09:12 (Mac Studio)", name: { text: "The footage's name", placeholder: true } }));
      const ctx = asked(t, "open");
      const found = findEpisode(ctx, "Video of 4 Nov, 09:12 (Mac Studio)");
      assert.equal(found.why, WAITING);
      for (const secret of [TITLE, "The footage's name", FOLDER]) assert.ok(ctx.hidden.names.includes(secret), `${secret}: ${JSON.stringify(ctx.hidden.names)}`);
      // By its old title it is not found: it is gated, and found by its label alone.
      assert.match(findEpisode(asked(t, "open"), TITLE).why, /^No episode fits/);
    } finally {
      t.done();
    }
  });
  it("says a record that only claims to be planned, in a conflicted copy, as `episodes` says a video not yet answered, with nothing of its title or folder", async () => {
    for (const [what, claim] of SHAPED) {
      const t = setup();
      try {
        const folder = folderWith(t, RAW);
        put(folder, COPY, { ...claim, rev: 1 });
        const said = [];
        const code = await editMain(["episodes"], { ...t.ctx.deps, say: (line) => said.push(line) });
        const text = said.join("\n");
        assert.equal(code, 0, what);
        assert.ok(!text.includes("Too many SKUs") && !text.includes(FOLDER), `${what}: ${text}`);
        assert.match(text, /a video not yet answered \(3fa9c1\)/, what);
      } finally {
        t.done();
      }
    }
  });
});

describe("a planned episode refused by the gate in a command, in the words of the design", () => {
  it("says the plan is a planned video with no footage, for a command that is not plan, name, episodes or guide, and writes nothing", async () => {
    const t = setup();
    try {
      folderWith(t, planned());
      for (const ask of [["open", TITLE], ["app", TITLE], ["push", TITLE], ["finish", TITLE], ["kind", TITLE, "raw", "--private", "no"], ["release", TITLE], ["show", TITLE, "transcript"], ["free", TITLE], ["reels", TITLE], ["ask", TITLE]]) {
        const said = [];
        const code = await editMain(ask, { ...t.ctx.deps, say: (line) => said.push(line) });
        assert.deepEqual([code, said], [1, [NOT_PLANNED_YET]], ask.join(" "));
      }
      const said = [];
      assert.equal(await editMain(["leave", TITLE], { ...t.ctx.deps, say: (line) => said.push(line) }), 1);
      assert.deepEqual(said, [TO_DROP]);
      assert.deepEqual(readdirSync(join(t.root, "Episodes", FOLDER, "record")), ["0001.json"], "only record 1 is there");
    } finally {
      t.done();
    }
  });
});
