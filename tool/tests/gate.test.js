// The gate (gate.js): which commands may run for a video not yet answered, and for a client or group session whose mark is not
// cleared. It is pure: the command's name, the record and the command's words are all it is given, and it reads nothing.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UNSCOPED, UNANSWERED, SESSION, SESSION_TAUGHT, gateFor, printWhy, gated } from "../gate.js";
import { COMMAND_NAMES } from "../edit.js";

const AT = "2026-10-22T10:00:00-05:00";
const WAITING = "This video is waiting for its answer: say what it is first.";
const LEFT = "You said to leave this video: it is not for brimm-video. To have it read, say what it is.";
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
  it("is gated whatever its answer says, a video left alone ('not for brimm-video') included, which is refused in words of its own", () => {
    const left = { kind: null, answer: { state: "not for brimm-video" } };
    for (const name of ["open", "ask", "push", "finish", "reel", "teachings", "somethingNew"]) {
      assert.equal(gateFor(name, left, ON), LEFT, name);
      assert.equal(gateFor(name, left, OFF), LEFT, name);
    }
    for (const name of UNANSWERED) assert.equal(gateFor(name, left, ON), "", name);
    // Only an answer that says it was left is told so: a missing, unreadable or other answer is a video waiting.
    for (const answer of [undefined, null, "not for brimm-video", {}, { state: "needs your answer" }, { state: "answered" }]) {
      assert.equal(gateFor("open", { kind: null, answer }, ON), WAITING, JSON.stringify(answer));
    }
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
  it("says, when this Mac's gate was turned on 90 days ago or more, that it lapsed, in words of its own", () => {
    const LAPSED = "Teachings from sessions were turned on more than 90 days ago on this Mac: ask Jason to check the training setting again.";
    for (const name of ["teachings", "principles", "ideas", "finish", "read"]) {
      assert.equal(gateFor(name, session(), { teachingsOn: false, lapsed: true }), LAPSED, name);
      assert.equal(gateFor(name, session(), { teachingsOn: true, lapsed: true }), "", name);
    }
    assert.equal(gateFor("reel", session(), { teachingsOn: false, lapsed: true }, ["Session, 2026-10-22", "make", "1"]), LAPSED);
    assert.equal(gateFor("open", session(), { teachingsOn: false, lapsed: true }), NOT_FOR_SESSION);
  });
  it("lets teachings --transcript-only through with the gate off, since nothing of it goes to Claude, and teachings alone not", () => {
    for (const on of [OFF, {}, { teachingsOn: false, lapsed: true }, ON]) assert.equal(gateFor("teachings", session(), on, ["Session, 2026-10-22", "--transcript-only"]), "", JSON.stringify(on));
    assert.equal(gateFor("teachings", session(), OFF, ["Session, 2026-10-22"]), TEACHINGS_OFF);
    assert.equal(gateFor("principles", session(), OFF, ["Session, 2026-10-22", "--transcript-only"]), TEACHINGS_OFF);
    assert.equal(gateFor("teachings", unanswered, ON, ["Video of 22 Oct, 10:00 (Mac Studio)", "--transcript-only"]), WAITING);
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
  it("counts a mark as cleared only when it holds the dialog's confirmation: nothing else clears it", () => {
    for (const bad of ["no", "yes", true, 1, {}, { at: "x" }, { at: AT, on: "Mac Studio", to: "Sallie Ogden" }, { confirmed: "yes" }, { confirmed: true }, { confirmed: "Dialog" }, []]) {
      assert.equal(gateFor("open", session({ session: { marked: AT, cleared: bad } }), ON), NOT_FOR_SESSION, JSON.stringify(bad));
      assert.equal(gateFor("open", { kind: "episode", session: { marked: AT, cleared: bad } }, ON), NOT_FOR_SESSION, JSON.stringify(bad));
    }
    assert.equal(gateFor("open", session({ session: { marked: AT, cleared: { confirmed: "dialog" } } }), ON), "");
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
  const agreed = (...ns) => session({ session: { marked: AT, cleared: null, agreed: ns.map((n) => ({ n, at: AT.slice(0, 10) })) } });
  const LABEL = "Session, 2026-10-22";
  /** On, and asked to find the episode by what the first word says: the label, as findEpisode was asked it. */
  const TAUGHT = { teachingsOn: true, said: LABEL };
  it("passes reel only as 'make <n>' of a Reel recorded as agreed", () => {
    assert.equal(gateFor("reel", agreed(2), TAUGHT, [LABEL, "make", "2"]), "");
    assert.equal(gateFor("reel", agreed(1, 2), TAUGHT, [LABEL, "make", "1"]), "");
    assert.equal(gateFor("reel", agreed(2), TAUGHT, [LABEL, "make", "1"]), REEL_NOT_AGREED);
    assert.equal(gateFor("reel", agreed(), TAUGHT, [LABEL, "make", "1"]), REEL_NOT_AGREED);
  });
  it("passes reel as '<n> --client-agreed', the dialog's own, whether or not the Reel is recorded yet", () => {
    assert.equal(gateFor("reel", agreed(), TAUGHT, [LABEL, "2", "--client-agreed"]), "");
    assert.equal(gateFor("reel", session(), TAUGHT, [LABEL, "2", "--client-agreed"]), "");
  });
  it("passes render only as 'reel <n>' of a Reel recorded as agreed", () => {
    assert.equal(gateFor("render", agreed(3), TAUGHT, [LABEL, "reel", "3"]), "");
    assert.equal(gateFor("render", agreed(3), TAUGHT, [LABEL, "reel", "2"]), REEL_NOT_AGREED);
    assert.equal(gateFor("render", session(), TAUGHT, [LABEL, "reel", "3"]), REEL_NOT_AGREED);
  });
  it("counts the words only when the first is the very word the episode was asked for, never a verb of today's reel", () => {
    // `reel pick 14 --client-agreed` is today's reel, naming the episode "14": its first word, "pick", is not the label.
    assert.equal(gateFor("reel", session(), { teachingsOn: true, said: "14" }, ["pick", "14", "--client-agreed"]), REEL_NOT_AGREED);
    assert.equal(gateFor("reel", session(), { teachingsOn: true, said: "14" }, ["drop", "14", "--client-agreed"]), REEL_NOT_AGREED);
    assert.equal(gateFor("reel", agreed(2), { teachingsOn: true, said: "14" }, ["pick", "make", "2"]), REEL_NOT_AGREED);
    assert.equal(gateFor("reel", agreed(2), { teachingsOn: true, said: "other" }, [LABEL, "make", "2"]), REEL_NOT_AGREED);
    assert.equal(gateFor("render", agreed(2), { teachingsOn: true, said: "other" }, [LABEL, "reel", "2"]), REEL_NOT_AGREED);
  });
  it("counts no words at all when it is not told which episode was asked for: it errs toward refusing", () => {
    assert.equal(gateFor("reel", agreed(2), ON, [LABEL, "make", "2"]), REEL_NOT_AGREED);
    assert.equal(gateFor("reel", session(), ON, [LABEL, "2", "--client-agreed"]), REEL_NOT_AGREED);
    assert.equal(gateFor("render", agreed(2), ON, [LABEL, "reel", "2"]), REEL_NOT_AGREED);
    assert.equal(gateFor("reel", agreed(2), { teachingsOn: true, said: undefined }, [LABEL, "make", "2"]), REEL_NOT_AGREED);
  });
  it("refuses any other words: today's pick and drop, no words, extra words, a number that is not a whole one", () => {
    const words = [[], [LABEL], ["pick", LABEL, "2"], ["drop", LABEL, "2"], [LABEL, "pick", "2"], [LABEL, "make"], [LABEL, "make", "2", "3"], [LABEL, "make", "2", "--no-play"],
      [LABEL, "make", "0"], [LABEL, "make", "-1"], [LABEL, "make", "1.5"], [LABEL, "make", "two"], [LABEL, "2"], [LABEL, "--client-agreed", "2"], [LABEL, "2", "--client-agreed", "extra"],
      [LABEL, "2", "--client-agreed", "make", "1"], ["x", LABEL, "make", "2"], [LABEL, "make", "02"], [LABEL, "make", "2 "]];
    for (const these of words) assert.equal(gateFor("reel", agreed(2, 0, -1, 1), TAUGHT, these), REEL_NOT_AGREED, JSON.stringify(these));
    for (const these of [[], [LABEL], [LABEL, "2"], [LABEL, "reel"], [LABEL, "reel", "2", "3"], [LABEL, "make", "2"], [LABEL, "reel", "x"], [LABEL, "reel", "02"]]) {
      assert.equal(gateFor("render", agreed(2), TAUGHT, these), REEL_NOT_AGREED, JSON.stringify(these));
    }
  });
  it("takes an agreement only as a list of { n, at }: a missing list, or one that is not a list, agrees to nothing", () => {
    for (const bad of [undefined, null, "all", { n: 2 }, 2, [2], [null], ["2"], [{ at: AT.slice(0, 10) }], [{ n: "2" }]]) {
      assert.equal(gateFor("reel", session({ session: { marked: AT, cleared: null, agreed: bad } }), TAUGHT, [LABEL, "make", "2"]), REEL_NOT_AGREED, JSON.stringify(bad));
    }
    assert.equal(gateFor("reel", session({ session: undefined }), TAUGHT, [LABEL, "make", "2"]), REEL_NOT_AGREED, "a kind of session and no mark agrees to nothing");
  });
  it("reads a detached run's words as the command's, the episode's folder after --now standing for its label", () => {
    assert.equal(gateFor("reel", agreed(2), TAUGHT, ["--now", LABEL, "make", "2"]), "");
    assert.equal(gateFor("reel", agreed(2), TAUGHT, ["--now", LABEL, "make", "1"]), REEL_NOT_AGREED);
    assert.equal(gateFor("render", agreed(2), TAUGHT, ["--now", LABEL, "reel", "2"]), "");
    assert.equal(gateFor("render", agreed(2), TAUGHT, ["--now", LABEL]), REEL_NOT_AGREED);
    assert.equal(gateFor("reel", agreed(2), TAUGHT, ["--now"]), REEL_NOT_AGREED);
    assert.equal(gateFor("reel", agreed(2), { teachingsOn: true, said: "other" }, ["--now", LABEL, "make", "2"]), REEL_NOT_AGREED);
  });
  it("does not narrow the other commands by their words", () => {
    assert.equal(gateFor("finish", session(), TAUGHT, [LABEL, "--yes"]), "");
    assert.equal(gateFor("name", session(), TAUGHT, [LABEL, "anything at all"]), "");
    assert.equal(gateFor("reel", finished, OFF, ["pick", "x", "1"]), "", "a record that is not a session is not narrowed");
    assert.equal(gateFor("reel", unanswered, TAUGHT, [LABEL, "make", "2"]), WAITING, "nor does a Reel words let an unanswered video through");
  });
});

describe("printWhy, what `show` may not print into the chat", () => {
  it("refuses a video waiting for its answer, and one left alone (in words that say so), in words that name no episode", () => {
    assert.equal(printWhy(unanswered), "Its words are not shown in the chat while it waits for its answer.");
    assert.equal(printWhy({ kind: null, answer: { state: "not for brimm-video" } }), "Its words are not shown in the chat: you said to leave this video.");
    assert.equal(printWhy({}), "Its words are not shown in the chat while it waits for its answer.");
  });
  it("refuses a session whose mark is not cleared, whatever this Mac's training gate says", () => {
    assert.equal(printWhy(session()), "A client or group session's words are not shown in the chat.");
    assert.equal(printWhy({ kind: "session" }), "A client or group session's words are not shown in the chat.");
    assert.equal(printWhy({ kind: "episode", session: { marked: AT, cleared: "no" } }), "A client or group session's words are not shown in the chat.");
  });
  it("lets every other record's words be shown: a cleared session, a finished video, a record from before the switch", () => {
    assert.equal(printWhy(session({ session: { marked: AT, cleared: { confirmed: "dialog" } } })), "");
    for (const kind of ["finished", "raw", "short video", "episode"]) assert.equal(printWhy({ kind }), "", kind);
  });
});

describe("gated, which records are named by their label", () => {
  it("is a video with no kind, waiting or left alone, and a session whose mark is not cleared, as the gate takes them", () => {
    for (const record of [unanswered, { kind: null, answer: { state: "not for brimm-video" } }, {}, session(), { kind: "session" }, { kind: "episode", session: { marked: AT, cleared: "no" } }]) {
      assert.equal(gated(record), true, JSON.stringify(record));
    }
  });
  it("is no other record, and nothing that is not a record", () => {
    for (const record of [finished, session({ session: { marked: AT, cleared: { confirmed: "dialog" } } }), { kind: "episode" }, { kind: "short video" }, null, undefined, "x", []]) {
      assert.equal(gated(record), false, JSON.stringify(record));
    }
  });
});
