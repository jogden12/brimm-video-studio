// The gate (gate.js): which commands may run for a video not yet answered, and for a client or group session whose mark is not
// cleared. It is pure: the command's name, the record and the command's words are all it is given, and it reads nothing.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UNSCOPED, UNANSWERED, SESSION, SESSION_TAUGHT, gateFor } from "../gate.js";
import { COMMAND_NAMES } from "../edit.js";

const AT = "2026-10-22T10:00:00-05:00";
const WAITING = "This video is waiting for its answer: say what it is first.";
const NOT_FOR_SESSION = "This is a client or group session: that is not done for one.";
const TEACHINGS_OFF = "Teachings from sessions are not turned on for this Mac yet: ask Jason.";
const REEL_NOT_AGREED = "A Reel is cut from a session only once you have noted the client's agreement.";

const unanswered = { kind: null, answer: { state: "needs your answer" } };
const session = (over = {}) => ({ kind: "session", answer: { state: "answered" }, session: { marked: AT, cleared: null }, ...over });
const finished = { kind: "finished", answer: { state: "answered" } };
const ON = { teachingsOn: true };
const OFF = { teachingsOn: false };

describe("the gate's lists", () => {
  it("are the commands the design names, each list holding the one before it", () => {
    assert.deepEqual(UNSCOPED, ["episodes", "status", "behind", "retry"]);
    assert.deepEqual(UNANSWERED, ["kind", "leave", "which", "show", "release", "resolve"]);
    assert.deepEqual(SESSION, [...UNANSWERED, "name"]);
    assert.deepEqual(SESSION_TAUGHT, [...SESSION, "teachings", "principles", "ideas", "finish", "reel", "render", "read"]);
  });
  it("hold no command of the unscoped list, which name no episode", () => {
    for (const list of [UNANSWERED, SESSION, SESSION_TAUGHT]) for (const name of UNSCOPED) assert.ok(!list.includes(name), name);
  });
});

describe("gateFor, a video waiting for its answer", () => {
  it("lets through only the commands that answer it, leave it, show where it is, hand it over or sort out its files", () => {
    for (const name of ["kind", "leave", "which", "show", "release", "resolve"]) assert.equal(gateFor(name, unanswered, ON), "", name);
  });
  it("refuses every other command, with teachings on or off, in the same words, which name no episode", () => {
    for (const name of ["open", "push", "bring", "name", "title", "reel", "reels", "ask", "finish", "spell", "logo", "captions", "text", "graphic", "preset", "cut", "teachings", "principles", "ideas", "render", "read", "free"]) {
      assert.equal(gateFor(name, unanswered, ON), WAITING, name);
      assert.equal(gateFor(name, unanswered, OFF), WAITING, name);
    }
  });
  it("is gated whatever its answer says, a video left alone ('not for brimm-video') included", () => {
    const left = { kind: null, answer: { state: "not for brimm-video" } };
    assert.equal(gateFor("open", left, ON), WAITING);
    assert.equal(gateFor("leave", left, ON), "");
  });
  it("is gated though it holds no answer at all: a record with no kind is a record not answered", () => {
    assert.equal(gateFor("ask", { kind: null }, ON), WAITING);
    assert.equal(gateFor("ask", {}, ON), WAITING);
    assert.equal(gateFor("ask", null, ON), WAITING);
  });
  it("is gated by a kind this brimm-video does not know, which it cannot say is not an unanswered video", () => {
    assert.equal(gateFor("ask", { kind: "podcast" }, ON), WAITING);
  });
});

describe("the gate walks every command", () => {
  it("is in a list, or refused, for an unanswered and a session record", () => {
    for (const name of COMMAND_NAMES) {
      const scoped = !UNSCOPED.includes(name);
      if (!scoped) continue;
      const waiting = gateFor(name, { kind: null, answer: { state: "needs your answer" } }, { teachingsOn: true });
      assert.equal(waiting === "", UNANSWERED.includes(name), name);
      const marked = gateFor(name, { kind: "session", session: { marked: AT, cleared: null } }, { teachingsOn: false });
      assert.equal(marked === "", SESSION.includes(name), name);
    }
  });
  it("leaves the commands that name no episode alone, whatever the record", () => {
    for (const name of UNSCOPED) for (const record of [unanswered, session(), finished]) assert.equal(gateFor(name, record, OFF), "", name);
  });
  it("refuses a command added later and named in no list", () => {
    assert.notEqual(gateFor("somethingNew", { kind: null, answer: { state: "needs your answer" } }, {}), "");
    assert.equal(gateFor("somethingNew", session(), ON), NOT_FOR_SESSION);
  });
});

describe("gateFor, a client or group session whose mark is not cleared", () => {
  it("lets through the commands of the first list, and name, with teachings on or off", () => {
    for (const name of SESSION) for (const on of [ON, OFF, {}]) assert.equal(gateFor(name, session(), on), "", name);
  });
  it("refuses a command never run for one, whether teachings are on or off, and names no episode", () => {
    for (const name of ["open", "push", "bring", "title", "reels", "ask", "spell", "logo", "captions", "text", "graphic", "preset", "cut", "free", "somethingNew"]) {
      assert.equal(gateFor(name, session(), ON), NOT_FOR_SESSION, name);
      assert.equal(gateFor(name, session(), OFF), NOT_FOR_SESSION, name);
    }
  });
  it("refuses the commands that read it for its teachings until this Mac's gate is on", () => {
    for (const name of ["teachings", "principles", "ideas", "finish", "read"]) {
      assert.equal(gateFor(name, session(), OFF), TEACHINGS_OFF, name);
      assert.equal(gateFor(name, session(), {}), TEACHINGS_OFF, name);
      assert.equal(gateFor(name, session(), ON), "", name);
    }
  });
  it("refuses reel and render, with teachings off, in the words of the gate not being on", () => {
    assert.equal(gateFor("reel", session(), OFF, ["Session, 2026-10-22", "make", "1"]), TEACHINGS_OFF);
    assert.equal(gateFor("render", session(), OFF, ["Session, 2026-10-22", "reel", "1"]), TEACHINGS_OFF);
  });
  it("is gated by a mark without a kind of session, as a session is gated by a kind without a mark", () => {
    // A mark is what the record says, whatever kind it is in; a kind of session with no mark at all is a session not cleared.
    assert.equal(gateFor("open", { kind: "episode", session: { marked: AT, cleared: null } }, ON), NOT_FOR_SESSION);
    assert.equal(gateFor("open", { kind: "finished", session: { marked: AT } }, ON), NOT_FOR_SESSION);
    assert.equal(gateFor("open", { kind: "session" }, ON), NOT_FOR_SESSION);
    assert.equal(gateFor("open", { kind: "session", session: null }, ON), NOT_FOR_SESSION);
    assert.equal(gateFor("open", { kind: "session", session: "yes" }, ON), NOT_FOR_SESSION);
  });
});

describe("gateFor, a session whose mark is cleared, and the records of every other kind", () => {
  const cleared = { at: AT, on: "Mac Studio", to: "Sallie Ogden", confirmed: "dialog" };
  it("lets a cleared session through every command, as the kind it is", () => {
    for (const name of COMMAND_NAMES) assert.equal(gateFor(name, session({ session: { marked: AT, cleared } }), OFF), "", name);
    assert.equal(gateFor("open", { kind: "session", session: { marked: AT, cleared } }, OFF), "");
  });
  it("lets an answered record that is not a session through every command, teachings on or off", () => {
    for (const kind of ["finished", "raw", "short video", "episode"]) {
      for (const name of [...COMMAND_NAMES, "teachings", "render", "read", "somethingNew"]) {
        assert.equal(gateFor(name, { kind, answer: { state: "answered" } }, OFF), "", `${kind} ${name}`);
        assert.equal(gateFor(name, { kind }, OFF), "", `${kind} ${name}`);
      }
    }
  });
  it("keeps a record from before the switch, of kind 'episode' and no session, as it was", () => {
    for (const name of COMMAND_NAMES) assert.equal(gateFor(name, { kind: "episode", session: undefined }, OFF), "", name);
  });
});

describe("gateFor, a Reel cut from a session", () => {
  const agreed = (...ns) => session({ session: { marked: AT, cleared: null, agreed: ns.map((n) => ({ n, at: AT })) } });
  const LABEL = "Session, 2026-10-22";
  it("passes reel only as 'make <n>' of a Reel recorded as agreed", () => {
    assert.equal(gateFor("reel", agreed(2), ON, [LABEL, "make", "2"]), "");
    assert.equal(gateFor("reel", agreed(1, 2), ON, [LABEL, "make", "1"]), "");
    assert.equal(gateFor("reel", agreed(2), ON, [LABEL, "make", "1"]), REEL_NOT_AGREED);
    assert.equal(gateFor("reel", agreed(), ON, [LABEL, "make", "1"]), REEL_NOT_AGREED);
  });
  it("passes reel as '<n> --client-agreed', the dialog's own, whether or not the Reel is recorded yet", () => {
    assert.equal(gateFor("reel", agreed(), ON, [LABEL, "2", "--client-agreed"]), "");
    assert.equal(gateFor("reel", session(), ON, [LABEL, "2", "--client-agreed"]), "");
  });
  it("passes render only as 'reel <n>' of a Reel recorded as agreed", () => {
    assert.equal(gateFor("render", agreed(3), ON, [LABEL, "reel", "3"]), "");
    assert.equal(gateFor("render", agreed(3), ON, [LABEL, "reel", "2"]), REEL_NOT_AGREED);
    assert.equal(gateFor("render", session(), ON, [LABEL, "reel", "3"]), REEL_NOT_AGREED);
  });
  it("refuses any other words: today's pick and drop, no words, extra words, a number that is not a whole one", () => {
    const words = [[], [LABEL], ["pick", LABEL, "2"], ["drop", LABEL, "2"], [LABEL, "pick", "2"], [LABEL, "make"], [LABEL, "make", "2", "3"], [LABEL, "make", "2", "--no-play"],
      [LABEL, "make", "0"], [LABEL, "make", "-1"], [LABEL, "make", "1.5"], [LABEL, "make", "two"], [LABEL, "2"], [LABEL, "--client-agreed", "2"], [LABEL, "2", "--client-agreed", "extra"],
      [LABEL, "2", "--client-agreed", "make", "1"], ["x", LABEL, "make", "2"], [LABEL, "make", "02"], [LABEL, "make", "2 "]];
    for (const these of words) assert.equal(gateFor("reel", agreed(2, 0, -1, 1), ON, these), REEL_NOT_AGREED, JSON.stringify(these));
    for (const these of [[], [LABEL], [LABEL, "2"], [LABEL, "reel"], [LABEL, "reel", "2", "3"], [LABEL, "make", "2"], [LABEL, "reel", "x"], [LABEL, "reel", "02"]]) {
      assert.equal(gateFor("render", agreed(2), ON, these), REEL_NOT_AGREED, JSON.stringify(these));
    }
  });
  it("takes an agreement only as a list of { n, at }: a missing list, or one that is not a list, agrees to nothing", () => {
    for (const bad of [undefined, null, "all", { n: 2 }, 2, [2], [null], ["2"], [{ at: AT }], [{ n: "2" }]]) {
      assert.equal(gateFor("reel", session({ session: { marked: AT, cleared: null, agreed: bad } }), ON, [LABEL, "make", "2"]), REEL_NOT_AGREED, JSON.stringify(bad));
    }
    assert.equal(gateFor("reel", session({ session: undefined }), ON, [LABEL, "make", "2"]), REEL_NOT_AGREED, "a kind of session and no mark agrees to nothing");
  });
  it("reads a detached run's words as the command's, the episode's folder after --now standing for its label", () => {
    assert.equal(gateFor("reel", agreed(2), ON, ["--now", "Session, 2026-10-22", "make", "2"]), "");
    assert.equal(gateFor("reel", agreed(2), ON, ["--now", "Session, 2026-10-22", "make", "1"]), REEL_NOT_AGREED);
    assert.equal(gateFor("render", agreed(2), ON, ["--now", "Session, 2026-10-22", "reel", "2"]), "");
    assert.equal(gateFor("render", agreed(2), ON, ["--now", "Session, 2026-10-22"]), REEL_NOT_AGREED);
    assert.equal(gateFor("reel", agreed(2), ON, ["--now"]), REEL_NOT_AGREED);
  });
  it("does not narrow the other commands by their words", () => {
    assert.equal(gateFor("finish", session(), ON, [LABEL, "--yes"]), "");
    assert.equal(gateFor("name", session(), ON, [LABEL, "anything at all"]), "");
    assert.equal(gateFor("reel", finished, OFF, ["pick", "x", "1"]), "", "a record that is not a session is not narrowed");
    assert.equal(gateFor("reel", unanswered, ON, [LABEL, "make", "2"]), WAITING, "nor does a Reel words let an unanswered video through");
  });
});
