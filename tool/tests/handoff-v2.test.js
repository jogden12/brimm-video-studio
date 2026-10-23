// The hand-off file, version 2: what brimm-video gives BRIMM Ops for a finished video, a raw video, a session or an iPhone clip
// (spec section 8, as agreed with the page's own session). These tests, and the five fixtures made from the same builder, are
// the contract between the two: the page copies the fixtures, and refuses a session's hand-off for any key it does not know.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildHandoffV2, handoffFaultV2, suggestionsOnClock, VERSION_2 } from "../handoff-v2.js";
import { clockOfRanges } from "../clock.js";
import { FORMAT, handoffText } from "../handoff.js";
import { tidyTranscript } from "../shared/transcript.js";

const SRT = "1\n00:00:00,000 --> 00:00:03,250\n Welcome to the show.\n\n2\n00:00:03,250 --> 00:00:09,500\n Today we talk about pricing.\n\n";
const REEL_SRT = "1\n00:00:00,000 --> 00:00:04,780\n Know your costs.\n\n";

const record = (over) => ({ version: 3, id: "e-20261022-3fa9c1", rev: 4, video: { file: "Pricing talk.mov", bytes: 1823400112, seconds: 1834.27, recorded: "2026-10-22", recordedFrom: "video" }, name: { text: "Pricing talk", placeholder: false }, title: { text: "Price like you mean it", from: "person", approved: true }, ...over });
const FINISHED = record({ kind: "finished" });
const RAW = record({ kind: "raw" });
const SHORT = record({ kind: "short video", name: { text: "Know your costs", placeholder: false } });
const SESSION = record({ kind: "session", name: { text: "Session, 2026-10-22", placeholder: false } });

const GIVEN = { revision: 1, made: "2026-10-22T15:02:11-04:00", madeOn: "Sallie's laptop", commit: "c709b57", id: "e-20261022-3fa9c1" };
const MAIN = { file: "Pricing talk.mov", seconds: 1834.27, srt: SRT };
const SUGGESTION = { n: 2, start: 312.4, end: 354.5, stretches: [{ start: 312.4, end: 354.5 }], first: "Here's the thing about", last: "and that's why it works.", why: "It stands alone.", point: "Price says what the work is worth." };
const RAW_SUGGESTION = { n: 1, start: 120, end: 161.3, stretches: [{ start: 120, end: 140 }, { start: 142.5, end: 161.3 }], first: "Most people price", last: "what it's worth.", why: "It stands alone.", point: "Price is a message." };
const REEL = { n: 2, title: "Stop discounting your best work", file: "Pricing talk reel 2 v3 3fa9c1.mp4", seconds: 42.1, inMain: { start: 312.4, end: 354.5 }, srt: REEL_SRT, fromSuggestion: 2 };
const PRINCIPLE = { n: 1, name: "Price the outcome", category: "pricing", description: "Charge for what the work changes.", steps: ["Name the outcome", "Put a number on it"], red_flags: ["Pricing by the hour"], green_flags: ["A price that has a reason"], decision_criteria: ["Does the price say what it is worth?"], example_application: "A shop prices a month of care by what it saves the owner.", verbatim_key_phrases: ["What is it worth to them?"] };
const SESSION_BODY = { principles: [PRINCIPLE, { ...PRINCIPLE, n: 2, name: "Say the price first", verbatim_key_phrases: [] }], recurringPrinciples: [{ n: 1, text: "Price is a message." }], reelsToFilm: [{ n: 1, idea: "Why price is a message", words: "Your price tells people what to expect.", why: "It is the point she made most.", principle: 1 }, { n: 2, idea: "The first number", words: "Say the number first.", why: "It stands alone.", principle: null }] };
const AGREED = { n: 3, title: "Price is a message", file: "Session, 2026-10-22 reel 3 v1 3fa9c1.mp4", seconds: 38, srt: REEL_SRT, fromSuggestion: null, clientAgreed: "2026-10-23" };

const finished = () => buildHandoffV2({ ...GIVEN, record: FINISHED, main: MAIN, suggestions: [SUGGESTION], reels: [REEL] });
const raw = () => buildHandoffV2({ ...GIVEN, record: RAW, main: MAIN, onPicture: ["Pricing talk", "Sallie Ogden"], suggestions: [RAW_SUGGESTION], reels: [REEL] });
const short = () => buildHandoffV2({ ...GIVEN, record: SHORT, main: { ...MAIN, seconds: 9.5 }, onPicture: ["Know your costs"] });
const session = () => buildHandoffV2({ ...GIVEN, record: SESSION, session: SESSION_BODY, reels: [AGREED] });
/** A hand-off of the kind, changed by `change`, which is given a copy. */
const changed = (make, change) => {
  const h = JSON.parse(JSON.stringify(make()));
  change(h);
  return h;
};

describe("buildHandoffV2, per kind", () => {
  it("writes a finished video's hand-off in the spec's order, and it passes its own check", () => {
    const h = finished();
    assert.deepEqual(Object.keys(h), ["format", "version", "revision", "made", "madeOn", "madeBy", "video", "main", "suggestions", "reels", "session"]);
    assert.equal(h.format, FORMAT);
    assert.equal(h.version, VERSION_2);
    assert.equal(VERSION_2, 2);
    assert.equal(h.madeBy, "brimm-video c709b57");
    assert.deepEqual(h.video, { id: "e-20261022-3fa9c1", kind: "finished", name: "Pricing talk", recorded: "2026-10-22", recordedFrom: "video" });
    assert.deepEqual(Object.keys(h.main), ["file", "seconds", "srt"]);
    assert.deepEqual(Object.keys(h.suggestions[0]), ["n", "start", "end", "stretches", "first", "last", "why", "point"]);
    assert.deepEqual(Object.keys(h.reels[0]), ["n", "title", "file", "seconds", "inMain", "srt", "fromSuggestion"]);
    assert.equal(h.session, null);
    assert.equal(handoffFaultV2(h), "");
  });
  it("writes a raw video's hand-off: the words on its picture, and a suggestion made of two stretches", () => {
    const h = raw();
    assert.equal(h.video.kind, "raw");
    assert.deepEqual(h.main.onPicture, ["Pricing talk", "Sallie Ogden"]);
    assert.equal(h.suggestions[0].stretches.length, 2);
    assert.equal(h.session, null);
    assert.equal(handoffFaultV2(h), "");
  });
  it("writes a record kept as an episode as a raw video", () => {
    const h = buildHandoffV2({ ...GIVEN, record: record({ kind: "episode" }), main: MAIN });
    assert.equal(h.video.kind, "raw");
    assert.equal(handoffFaultV2(h), "");
  });
  it("writes an iPhone clip's hand-off: no suggestions, and no Reels key at all", () => {
    const h = short();
    assert.deepEqual(Object.keys(h), ["format", "version", "revision", "made", "madeOn", "madeBy", "video", "main", "session"]);
    assert.equal(h.video.kind, "short video");
    assert.deepEqual(h.main.onPicture, ["Know your costs"]);
    assert.equal(h.session, null);
    assert.equal(handoffFaultV2(h), "");
  });
  it("writes a session's hand-off: no main video, no suggestions, only Reels with the client's agreement, and the session's items", () => {
    const h = session();
    assert.deepEqual(Object.keys(h), ["format", "version", "revision", "made", "madeOn", "madeBy", "video", "reels", "session"]);
    assert.deepEqual(h.video, { id: "e-20261022-3fa9c1", kind: "session", name: "Session, 2026-10-22", recorded: "2026-10-22", recordedFrom: "video" });
    assert.deepEqual(Object.keys(h.reels[0]), ["n", "title", "file", "seconds", "srt", "fromSuggestion", "clientAgreed"]);
    assert.equal(h.reels[0].clientAgreed, "2026-10-23");
    assert.deepEqual(Object.keys(h.session), ["principles", "recurringPrinciples", "reelsToFilm"]);
    assert.deepEqual(Object.keys(h.session.principles[0]), ["n", "name", "category", "description", "steps", "red_flags", "green_flags", "decision_criteria", "example_application", "verbatim_key_phrases"]);
    assert.deepEqual(h.session.recurringPrinciples, [{ n: 1, text: "Price is a message." }]);
    assert.deepEqual(Object.keys(h.session.reelsToFilm[0]), ["n", "idea", "words", "why", "principle"]);
    assert.equal(handoffFaultV2(h), "");
  });
  it("writes a session that has nothing in it yet, the revision that withdraws an earlier kind's words", () => {
    const h = buildHandoffV2({ ...GIVEN, record: SESSION });
    assert.deepEqual(h.reels, []);
    assert.deepEqual(h.session, { principles: [], recurringPrinciples: [], reelsToFilm: [] });
    assert.equal(handoffFaultV2(h), "");
  });
  it("gives the id it is given, the first version's, and not the record's own", () => {
    const h = buildHandoffV2({ ...GIVEN, id: "e-20261001-aaaaaa", record: FINISHED, main: MAIN });
    assert.equal(h.video.id, "e-20261001-aaaaaa");
  });
  it("never puts a title under video, whatever the record holds", () => {
    for (const make of [finished, raw, short, session]) assert.equal("title" in make().video, false);
  });
  it("is the same text each time, set in by two spaces, as version 1's is", () => {
    assert.equal(handoffText(finished()), handoffText(finished()));
    assert.ok(handoffText(finished()).startsWith('{\n  "format": "brimm-video hand-off",\n  "version": 2,'));
  });
});

describe("what the writer leaves out", () => {
  it("leaves the main video, the suggestions and a Reel's place in the main out of a session, whatever it is given", () => {
    const h = buildHandoffV2({ ...GIVEN, record: SESSION, main: MAIN, onPicture: ["x"], suggestions: [SUGGESTION], session: SESSION_BODY, reels: [{ ...AGREED, inMain: { start: 1, end: 2 } }] });
    assert.equal("main" in h, false);
    assert.equal("suggestions" in h, false);
    assert.equal("inMain" in h.reels[0], false);
    assert.equal(handoffFaultV2(h), "");
  });
  it("writes the words on the picture only for a raw video and an iPhone clip, and not when none are drawn", () => {
    assert.equal("onPicture" in buildHandoffV2({ ...GIVEN, record: FINISHED, main: MAIN, onPicture: ["Pricing talk"] }).main, false);
    assert.equal("onPicture" in buildHandoffV2({ ...GIVEN, record: RAW, main: MAIN, onPicture: [] }).main, false);
    assert.equal("onPicture" in buildHandoffV2({ ...GIVEN, record: RAW, main: MAIN }).main, false);
    assert.equal("onPicture" in buildHandoffV2({ ...GIVEN, record: SHORT, main: MAIN, onPicture: [] }).main, false);
    assert.deepEqual(buildHandoffV2({ ...GIVEN, record: SHORT, main: MAIN, onPicture: ["A", "B"] }).main.onPicture, ["A", "B"]);
  });
  it("writes suggestions only for a finished or a raw video, and only when there are some", () => {
    assert.equal("suggestions" in buildHandoffV2({ ...GIVEN, record: SHORT, main: MAIN, suggestions: [SUGGESTION] }), false);
    assert.equal("suggestions" in buildHandoffV2({ ...GIVEN, record: FINISHED, main: MAIN, suggestions: [] }), false);
    assert.equal("suggestions" in buildHandoffV2({ ...GIVEN, record: RAW, main: MAIN }), false);
  });
  it("leaves out an iPhone clip's Reels, a finished video's agreement date, and the session's items from a video that is not one", () => {
    assert.equal("reels" in buildHandoffV2({ ...GIVEN, record: SHORT, main: MAIN, reels: [REEL] }), false);
    assert.equal("clientAgreed" in buildHandoffV2({ ...GIVEN, record: FINISHED, main: MAIN, reels: [{ ...REEL, clientAgreed: "2026-10-23" }] }).reels[0], false);
    assert.equal(buildHandoffV2({ ...GIVEN, record: FINISHED, main: MAIN, session: SESSION_BODY }).session, null);
  });
  it("writes a Reel's place in the main only when it was found, and a Reel made from times she gave with its suggestion null", () => {
    const { inMain, fromSuggestion, ...bare } = REEL;
    const h = buildHandoffV2({ ...GIVEN, record: FINISHED, main: MAIN, suggestions: [SUGGESTION], reels: [{ ...bare, n: 5, inMain: null, fromSuggestion: null }, { ...bare, n: 6, title: "", fromSuggestion: null }, REEL] });
    assert.equal("inMain" in h.reels[0], false);
    assert.equal(h.reels[0].fromSuggestion, null);
    assert.equal(h.reels[1].title, "");
    assert.deepEqual(h.reels[2].inMain, { start: 312.4, end: 354.5 });
    assert.equal(h.reels[2].fromSuggestion, 2);
    assert.equal(handoffFaultV2(h), "");
  });
  it("does not turn a Reel's missing fromSuggestion into null: the key is left out, and the check refuses it", () => {
    const { fromSuggestion, ...bare } = REEL;
    const h = buildHandoffV2({ ...GIVEN, record: FINISHED, main: MAIN, reels: [bare] });
    assert.equal("fromSuggestion" in h.reels[0], false);
    assert.match(handoffFaultV2(h), /Reel 2.*fromSuggestion/);
    const inSession = buildHandoffV2({ ...GIVEN, record: SESSION, reels: [{ ...AGREED, fromSuggestion: undefined }] });
    assert.equal("fromSuggestion" in inSession.reels[0], false);
    assert.match(handoffFaultV2(inSession), /Reel 3.*fromSuggestion/);
  });
  it("writes only the keys of the contract, whatever else the record's items carry", () => {
    const given = { ...GIVEN, record: SESSION, session: { principles: [{ ...PRINCIPLE, source_context: "A call with a client.", approved: true, status: "kept" }], recurringPrinciples: [{ n: 1, text: "Price is a message.", approved: true }], reelsToFilm: [{ ...SESSION_BODY.reelsToFilm[0], approved: true, times: [1, 2] }] }, reels: [{ ...AGREED, crops: [], status: "made", from: 1, to: 2 }] };
    const h = buildHandoffV2(given);
    assert.equal(handoffFaultV2(h), "");
    assert.deepEqual(Object.keys(h.session.principles[0]).sort(), Object.keys(PRINCIPLE).sort());
    assert.equal("source_context" in h.session.principles[0], false);
    assert.deepEqual(Object.keys(h.reels[0]), ["n", "title", "file", "seconds", "srt", "fromSuggestion", "clientAgreed"]);
    const finishedWith = buildHandoffV2({ ...GIVEN, record: FINISHED, main: { ...MAIN, extra: 1 }, suggestions: [{ ...SUGGESTION, crop: 1, stretches: [{ start: 312.4, end: 354.5, words: 9 }] }], reels: [{ ...REEL, status: "made" }] });
    assert.deepEqual(Object.keys(finishedWith.main), ["file", "seconds", "srt"]);
    assert.deepEqual(Object.keys(finishedWith.suggestions[0].stretches[0]), ["start", "end"]);
    assert.equal(handoffFaultV2(finishedWith), "");
  });
  it("holds no key outside the contract anywhere in a session's hand-off", () => {
    const CONTRACT = {
      top: ["format", "version", "revision", "made", "madeOn", "madeBy", "video", "reels", "session"],
      video: ["id", "kind", "name", "recorded", "recordedFrom"],
      reel: ["n", "title", "file", "seconds", "srt", "fromSuggestion", "clientAgreed"],
      session: ["principles", "recurringPrinciples", "reelsToFilm"],
      principle: ["n", "name", "category", "description", "steps", "red_flags", "green_flags", "decision_criteria", "example_application", "verbatim_key_phrases"],
      recurring: ["n", "text"],
      film: ["n", "idea", "words", "why", "principle"]
    };
    const h = JSON.parse(handoffText(session()));
    const keys = (o) => Object.keys(o).sort();
    assert.deepEqual(keys(h), [...CONTRACT.top].sort());
    assert.deepEqual(keys(h.video), [...CONTRACT.video].sort());
    for (const r of h.reels) assert.deepEqual(keys(r), [...CONTRACT.reel].sort());
    assert.deepEqual(keys(h.session), [...CONTRACT.session].sort());
    for (const p of h.session.principles) assert.deepEqual(keys(p), [...CONTRACT.principle].sort());
    for (const p of h.session.recurringPrinciples) assert.deepEqual(keys(p), [...CONTRACT.recurring].sort());
    for (const p of h.session.reelsToFilm) assert.deepEqual(keys(p), [...CONTRACT.film].sort());
  });
  it("holds no word of the dropped file's name in a session's hand-off, when the name is its label", () => {
    const dropped = record({ kind: "session", name: { text: "Session, 2026-10-22", placeholder: false }, video: { ...SESSION.video, file: "Coaching call Jane Doe.mov" } });
    assert.equal(/Jane|Coaching/.test(handoffText(buildHandoffV2({ ...GIVEN, record: dropped, session: SESSION_BODY, reels: [AGREED] }))), false);
  });
});

describe("handoffFaultV2, in plain words", () => {
  it("passes a hand-off of each kind", () => {
    for (const make of [finished, raw, short, session]) assert.equal(handoffFaultV2(make()), "");
  });
  it("passes a finished video with no suggestions and no Reels, and an empty list of suggestions", () => {
    assert.equal(handoffFaultV2(buildHandoffV2({ ...GIVEN, record: FINISHED, main: MAIN })), "");
    assert.equal(handoffFaultV2(changed(finished, (h) => { h.suggestions = []; })), "");
  });
  it("refuses what is not a hand-off, or not version 2, or has no whole revision", () => {
    assert.match(handoffFaultV2(null), /not a brimm-video hand-off/);
    assert.match(handoffFaultV2({ ...finished(), format: "other" }), /not a brimm-video hand-off/);
    assert.match(handoffFaultV2({ ...finished(), version: 1 }), /version 1.*version 2/);
    assert.match(handoffFaultV2({ ...finished(), revision: 0 }), /revision/);
    assert.match(handoffFaultV2({ ...finished(), revision: 1.5 }), /revision/);
    assert.match(handoffFaultV2({ ...finished(), revision: "1" }), /revision/);
  });
  it("refuses a time it was made that is not a local time with its offset, and a Mac or a commit that is missing", () => {
    assert.match(handoffFaultV2({ ...finished(), made: "2026-10-22 15:02" }), /made/);
    assert.match(handoffFaultV2({ ...finished(), madeOn: "" }), /Mac/);
    assert.match(handoffFaultV2({ ...finished(), madeBy: "brimm-video" }), /Mac/);
  });
  it("refuses a session with a main video", () => {
    const fault = handoffFaultV2({ ...session(), main: { file: "x.mov", seconds: 5, srt: SRT } });
    assert.match(fault, /session.*no main video/);
  });
  it("refuses a session with a suggestions key, even an empty or a null one", () => {
    assert.match(handoffFaultV2({ ...session(), suggestions: [SUGGESTION] }), /session.*no suggestions/);
    assert.match(handoffFaultV2({ ...session(), suggestions: [] }), /session.*no suggestions/);
    assert.match(handoffFaultV2({ ...session(), suggestions: null }), /session.*no suggestions/);
  });
  it("refuses a principle that holds source_context, which stays on the Mac", () => {
    const fault = handoffFaultV2(changed(session, (h) => { h.session.principles[0].source_context = "A call with a client."; }));
    assert.match(fault, /source_context/);
    assert.match(fault, /Principle 1/);
  });
  it("refuses a session's Reel with no clientAgreed", () => {
    const fault = handoffFaultV2(changed(session, (h) => { delete h.reels[0].clientAgreed; }));
    assert.match(fault, /Reel 3.*clientAgreed/);
  });
  it("refuses a clientAgreed that holds anything but a date", () => {
    for (const bad of ["Jane Doe", "2026-10-23T10:00:00", "23/10/2026", "2026-02-30", "2026-13-01", "", null, 20261023, true, { on: "2026-10-23" }, ["2026-10-23"]]) {
      assert.match(handoffFaultV2(changed(session, (h) => { h.reels[0].clientAgreed = bad; })), /Reel 3.*clientAgreed.*date/, JSON.stringify(bad));
    }
  });
  it("refuses clientAgreed on a Reel that is not a session's", () => {
    assert.match(handoffFaultV2(changed(finished, (h) => { h.reels[0].clientAgreed = "2026-10-23"; })), /Reel 2.*clientAgreed/);
  });
  it("refuses words on the picture of a finished video, and of a session", () => {
    assert.match(handoffFaultV2(changed(finished, (h) => { h.main.onPicture = ["Pricing talk"]; })), /finished video.*onPicture/);
    assert.match(handoffFaultV2(changed(session, (h) => { h.main = { file: "x.mov", seconds: 5, srt: SRT, onPicture: ["x"] }; })), /session.*no main video/);
  });
  it("refuses words on the picture that are not a list of words, or an empty list, which is left out instead", () => {
    assert.match(handoffFaultV2(changed(raw, (h) => { h.main.onPicture = []; })), /onPicture.*left out/);
    assert.match(handoffFaultV2(changed(raw, (h) => { h.main.onPicture = "Pricing talk"; })), /onPicture.*list/);
    assert.match(handoffFaultV2(changed(raw, (h) => { h.main.onPicture = ["Pricing talk", ""]; })), /onPicture.*list/);
    assert.match(handoffFaultV2(changed(short, (h) => { h.main.onPicture = [4]; })), /onPicture.*list/);
  });
  it("refuses an unknown key anywhere in a session's hand-off", () => {
    const at = (change) => handoffFaultV2(changed(session, change));
    assert.match(at((h) => { h.transcript = "words"; }), /"transcript".*contract does not name/);
    assert.match(at((h) => { h.video.file = "Coaching call.mov"; }), /"file".*contract does not name/);
    assert.match(at((h) => { h.reels[0].inMain = { start: 1, end: 2 }; }), /Reel 3.*"inMain".*contract does not name/);
    assert.match(at((h) => { h.session.notes = "x"; }), /"notes".*contract does not name/);
    assert.match(at((h) => { h.session.principles[1].approved = true; }), /Principle 2.*"approved".*contract does not name/);
    assert.match(at((h) => { h.session.recurringPrinciples[0].source = "x"; }), /"source".*contract does not name/);
    assert.match(at((h) => { h.session.reelsToFilm[0].times = [1, 2]; }), /"times".*contract does not name/);
  });
  it("refuses an unknown key in the other kinds' hand-offs too, since only this writer makes them", () => {
    assert.match(handoffFaultV2(changed(finished, (h) => { h.episode = {}; })), /"episode"/);
    assert.match(handoffFaultV2(changed(finished, (h) => { h.main.extra = 1; })), /"extra"/);
    assert.match(handoffFaultV2(changed(finished, (h) => { h.reels[0].crop = {}; })), /Reel 2.*"crop"/);
    assert.match(handoffFaultV2(changed(finished, (h) => { h.suggestions[0].angle = "x"; })), /Suggestion 2.*"angle"/);
  });
  it("refuses a title under video, for any kind, even a null one", () => {
    for (const make of [finished, raw, short, session]) {
      assert.match(handoffFaultV2(changed(make, (h) => { h.video.title = "Price like you mean it"; })), /no title.*page/, make.name);
      assert.match(handoffFaultV2(changed(make, (h) => { h.video.title = null; })), /no title.*page/, make.name);
    }
  });
  it("refuses a suggestion missing a part of it, each in its own words", () => {
    const seen = new Set();
    for (const part of ["point", "first", "last", "why"]) {
      const fault = handoffFaultV2(changed(finished, (h) => { delete h.suggestions[0][part]; }));
      assert.match(fault, /Suggestion 2/, part);
      seen.add(fault);
    }
    assert.match(handoffFaultV2(changed(finished, (h) => { delete h.suggestions[0].point; })), /Suggestion 2.*point/);
    assert.match(handoffFaultV2(changed(finished, (h) => { h.suggestions[0].why = "  "; })), /Suggestion 2.*reason|Suggestion 2.*why/);
    assert.equal(seen.size, 4);
    for (const part of ["n", "start", "end", "stretches"]) assert.notEqual(handoffFaultV2(changed(finished, (h) => { delete h.suggestions[0][part]; })), "", part);
  });
  it("refuses a suggestion whose times are not a stretch of the main video, or whose stretches do not make it", () => {
    const at = (change) => handoffFaultV2(changed(raw, change));
    assert.match(at((h) => { h.suggestions[0].end = 5000; h.suggestions[0].stretches[1].end = 5000; }), /Suggestion 1.*main video/);
    assert.match(at((h) => { h.suggestions[0].start = 170; }), /Suggestion 1/);
    assert.match(at((h) => { h.suggestions[0].start = -1; h.suggestions[0].stretches[0].start = -1; }), /Suggestion 1/);
    assert.match(at((h) => { h.suggestions[0].start = 121; }), /Suggestion 1.*stretches/);
    assert.match(at((h) => { h.suggestions[0].end = 160; }), /Suggestion 1.*stretches/);
    assert.match(at((h) => { h.suggestions[0].stretches = []; }), /Suggestion 1.*stretches/);
    assert.match(at((h) => { h.suggestions[0].stretches[1].start = 130; }), /Suggestion 1.*stretches/);
    assert.match(at((h) => { h.suggestions[0].stretches[0] = { start: 120, end: 119 }; }), /Suggestion 1.*stretches/);
    assert.match(at((h) => { h.suggestions[0].stretches[0].words = 9; }), /Suggestion 1.*"words"/);
  });
  it("holds a suggestion's times to the contract agreed with the page, clause by clause, each in its own words", () => {
    // Suggestion 1 of the raw fixture runs 120 to 161.3 in two stretches, 120 to 140 and 142.5 to 161.3; no Reel, so that the
    // main video's length can change under it.
    const bare = () => buildHandoffV2({ ...GIVEN, record: RAW, main: MAIN, suggestions: [RAW_SUGGESTION] });
    const at = (change) => handoffFaultV2(changed(bare, change));
    const times = /Suggestion 1's times are not a stretch of the main video/;
    const runs = /Suggestion 1's stretches do not run from its start to its end/;
    const kept = /Suggestion 1's stretches are not kept stretches of the main video, in order/;
    // 0 <= start < end <= main.seconds + 0.01
    assert.equal(at((h) => { h.suggestions[0].start = 0; h.suggestions[0].stretches[0].start = 0; }), "");
    assert.match(at((h) => { h.suggestions[0].start = -0.01; h.suggestions[0].stretches[0].start = -0.01; }), times);
    assert.match(at((h) => { h.suggestions[0].start = 161.3; h.suggestions[0].stretches = [{ start: 161.3, end: 161.3 }]; }), times);
    assert.match(at((h) => { h.suggestions[0].end = 100; h.suggestions[0].start = 120; }), times);
    assert.equal(at((h) => { h.main.seconds = 161.3; }), "");
    assert.equal(at((h) => { h.main.seconds = 161.295; }), "");
    assert.match(at((h) => { h.main.seconds = 161.28; }), times);
    assert.match(at((h) => { h.main.seconds = 130; }), times);
    // Each stretch lies inside start and end, and start and end are the first stretch's start and the last one's end.
    assert.match(at((h) => { h.suggestions[0].end = 150; }), runs);
    assert.match(at((h) => { h.suggestions[0].start = 130; }), runs);
    assert.match(at((h) => { h.suggestions[0].stretches[0].start = 119; }), runs);
    assert.match(at((h) => { h.suggestions[0].stretches[1].end = 162; }), runs);
    assert.match(at((h) => { h.suggestions[0].stretches[1].end = 160; }), runs);
    // Each stretch is a stretch of the main video, in order, with none over another.
    assert.match(at((h) => { h.suggestions[0].stretches[1].end = 5000; h.suggestions[0].end = 5000; }), times);
    assert.match(at((h) => { h.suggestions[0].stretches = [{ start: 120, end: 150 }, { start: 140, end: 161.3 }]; }), kept);
    assert.match(at((h) => { h.suggestions[0].stretches = [{ start: 120, end: 140 }, { start: 140, end: 140 }, { start: 140, end: 161.3 }]; }), kept);
    assert.equal(at((h) => { h.suggestions[0].stretches = [{ start: 120, end: 140 }, { start: 140, end: 161.3 }]; }), "");
    assert.match(at((h) => { h.suggestions[0].stretches[1].start = "142.5"; }), kept);
    assert.match(at((h) => { h.suggestions[0].start = null; }), times);
    assert.match(at((h) => { h.suggestions[0].end = Infinity; }), times);
  });
  it("refuses a finished video's suggestion of more than one stretch: nothing was cut", () => {
    assert.match(handoffFaultV2(changed(finished, (h) => { h.suggestions[0].stretches = [{ start: 312.4, end: 330 }, { start: 331, end: 354.5 }]; })), /finished video.*one stretch/);
  });
  it("refuses a suggestion in an iPhone clip's hand-off, and Reels in it, even an empty list", () => {
    assert.match(handoffFaultV2({ ...short(), suggestions: [SUGGESTION] }), /short video.*no suggestions/);
    assert.match(handoffFaultV2({ ...short(), reels: [] }), /short video.*no Reels/);
    assert.match(handoffFaultV2({ ...short(), reels: [REEL] }), /short video.*no Reels/);
  });
  it("refuses a number that repeats, in suggestions, Reels and each list of a session's items", () => {
    assert.match(handoffFaultV2(changed(finished, (h) => { h.suggestions.push({ ...h.suggestions[0] }); })), /Suggestion 2.*twice/);
    assert.match(handoffFaultV2(changed(finished, (h) => { h.reels.push({ ...h.reels[0] }); })), /Reel 2.*twice/);
    assert.match(handoffFaultV2(changed(session, (h) => { h.reels.push({ ...h.reels[0] }); })), /Reel 3.*twice/);
    assert.match(handoffFaultV2(changed(session, (h) => { h.session.principles[1].n = 1; })), /Principle 1.*twice/);
    assert.match(handoffFaultV2(changed(session, (h) => { h.session.recurringPrinciples.push({ n: 1, text: "Again." }); })), /recurring principle 1.*twice/i);
    assert.match(handoffFaultV2(changed(session, (h) => { h.session.reelsToFilm[1].n = 1; })), /Reel idea 1.*twice/i);
  });
  it("lets a Reel made from a suggestion take its number, even when that suggestion was later left out", () => {
    // Suggestion 2 is listed, and Reel 2 is made from it.
    assert.equal(handoffFaultV2(finished()), "");
    // Reel 7 was made from suggestion 7, which a later reading left out: no suggestion 7 is listed.
    assert.equal(handoffFaultV2(changed(finished, (h) => { h.reels[0].n = 7; h.reels[0].fromSuggestion = 7; })), "");
    // Nothing is listed at all, as for a video whose suggestions were all left out.
    assert.equal(handoffFaultV2(changed(finished, (h) => { delete h.suggestions; h.reels[0].n = 7; h.reels[0].fromSuggestion = 7; })), "");
  });
  it("lets a Reel made from times she gave have a fresh number and a null suggestion", () => {
    assert.equal(handoffFaultV2(changed(finished, (h) => { h.reels[0].n = 5; h.reels[0].fromSuggestion = null; })), "");
    assert.equal(handoffFaultV2(changed(raw, (h) => { h.reels[0].n = 5; h.reels[0].fromSuggestion = null; })), "");
  });
  it("refuses a Reel made from a suggestion whose number is not the suggestion's: it takes its number", () => {
    const fault = handoffFaultV2(changed(finished, (h) => { h.reels[0].fromSuggestion = 3; }));
    assert.match(fault, /Reel 2.*suggestion 3.*takes its number/);
    assert.match(handoffFaultV2(changed(finished, (h) => { h.reels[0].n = 4; })), /Reel 4.*suggestion 2.*takes its number/);
    // Even when the suggestion it names is listed.
    assert.match(handoffFaultV2(changed(finished, (h) => { h.suggestions.push({ ...h.suggestions[0], n: 3 }); h.reels[0].fromSuggestion = 3; })), /Reel 2.*suggestion 3.*takes its number/);
  });
  it("refuses a Reel made from times she gave that holds a listed suggestion's number: its number must be fresh", () => {
    const fault = handoffFaultV2(changed(finished, (h) => { h.reels[0].fromSuggestion = null; }));
    assert.match(fault, /Reel 2.*suggestion 2.*fresh number/);
    assert.match(handoffFaultV2(changed(raw, (h) => { h.reels[0].n = 1; h.reels[0].fromSuggestion = null; })), /Reel 1.*suggestion 1.*fresh number/);
  });
  it("refuses a number in a session Reel's fromSuggestion: a session has no suggestions", () => {
    for (const number of [3, 1, 2]) assert.match(handoffFaultV2(changed(session, (h) => { h.reels[0].fromSuggestion = number; })), /Reel 3.*fromSuggestion.*not null.*no suggestions/, String(number));
    assert.equal(handoffFaultV2(changed(session, (h) => { h.reels[0].fromSuggestion = null; })), "");
  });
  it("refuses a Reel whose suggestion is neither a number nor null, or is missing", () => {
    assert.match(handoffFaultV2(changed(finished, (h) => { h.reels[0].fromSuggestion = "2"; })), /Reel 2.*fromSuggestion/);
    assert.match(handoffFaultV2(changed(finished, (h) => { delete h.reels[0].fromSuggestion; })), /Reel 2.*fromSuggestion/);
    assert.match(handoffFaultV2(changed(finished, (h) => { h.reels[0].fromSuggestion = 0; })), /Reel 2.*fromSuggestion/);
  });
  it("lets a made Reel's title be empty, and refuses one that is not text", () => {
    assert.equal(handoffFaultV2(changed(finished, (h) => { h.reels[0].title = ""; })), "");
    assert.match(handoffFaultV2(changed(finished, (h) => { h.reels[0].title = null; })), /Reel 2.*title/);
    assert.match(handoffFaultV2(changed(finished, (h) => { delete h.reels[0].title; })), /Reel 2.*title/);
  });
  it("refuses a Reel with no file or length, or captions the page cannot read, in any kind that has them", () => {
    assert.match(handoffFaultV2(changed(finished, (h) => { h.reels[0].file = ""; })), /Reel 2.*file/);
    assert.match(handoffFaultV2(changed(finished, (h) => { h.reels[0].seconds = 0; })), /Reel 2.*length/);
    assert.match(handoffFaultV2(changed(finished, (h) => { h.reels[0].srt = "Hello"; })), /Reel 2.*captions/);
    assert.match(handoffFaultV2(changed(session, (h) => { h.reels[0].srt = ""; })), /Reel 3.*captions/);
    assert.match(handoffFaultV2(changed(finished, (h) => { h.reels[0].n = 0; })), /Reel.*number/);
  });
  it("refuses a Reel's place in the main that is not a stretch of it", () => {
    assert.match(handoffFaultV2(changed(finished, (h) => { h.reels[0].inMain = { start: 5, end: 4 }; })), /Reel 2.*main video/);
    assert.match(handoffFaultV2(changed(finished, (h) => { h.reels[0].inMain = { start: 1800, end: 1900 }; })), /Reel 2.*main video/);
  });
  it("refuses Reels that are not a list, in a kind that has them", () => {
    assert.match(handoffFaultV2({ ...finished(), reels: "none" }), /Reels.*list/);
    const noReels = finished();
    delete noReels.reels;
    assert.match(handoffFaultV2(noReels), /Reels.*list/);
  });
  it("refuses a main video with no file or length or readable captions, in a kind that has one", () => {
    assert.match(handoffFaultV2(changed(finished, (h) => { h.main.file = ""; })), /main video.*file/);
    assert.match(handoffFaultV2(changed(finished, (h) => { h.main.seconds = -1; })), /main video.*length/);
    assert.match(handoffFaultV2(changed(finished, (h) => { h.main.srt = "Hello"; })), /main video.*captions/);
    const none = finished();
    delete none.main;
    assert.match(handoffFaultV2(none), /main video/);
  });
  it("refuses the session's items in a video that is not a session, and a session with none", () => {
    assert.match(handoffFaultV2({ ...finished(), session: SESSION_BODY }), /only a session/i);
    assert.match(handoffFaultV2({ ...finished(), session: {} }), /only a session/i);
    const noSession = finished();
    delete noSession.session;
    assert.match(handoffFaultV2(noSession), /session/);
    assert.match(handoffFaultV2({ ...session(), session: null }), /session.*items/i);
  });
  it("refuses a video with an id brimm-video does not give, a kind that is not one of the four, no name, or no day", () => {
    assert.match(handoffFaultV2(changed(finished, (h) => { h.video.id = "pricing"; })), /id/);
    assert.match(handoffFaultV2(changed(finished, (h) => { h.video.kind = "episode"; })), /kind.*finished, raw, session or short video/);
    assert.match(handoffFaultV2(changed(finished, (h) => { h.video.kind = null; })), /kind/);
    assert.match(handoffFaultV2(changed(finished, (h) => { h.video.name = " "; })), /no name/);
    assert.match(handoffFaultV2(changed(finished, (h) => { h.video.recorded = "22 Oct"; })), /day/);
    assert.match(handoffFaultV2(changed(finished, (h) => { h.video.recordedFrom = "guess"; })), /day/);
    assert.match(handoffFaultV2({ ...finished(), video: undefined }), /video/);
  });
  it("refuses a principle with no name, or a field of the wrong kind", () => {
    assert.match(handoffFaultV2(changed(session, (h) => { h.session.principles[0].name = ""; })), /Principle 1.*name/);
    assert.match(handoffFaultV2(changed(session, (h) => { delete h.session.principles[0].description; })), /Principle 1.*description/);
    assert.match(handoffFaultV2(changed(session, (h) => { h.session.principles[0].steps = "one"; })), /Principle 1.*steps.*list/);
    assert.match(handoffFaultV2(changed(session, (h) => { h.session.principles[0].red_flags = [1]; })), /Principle 1.*red_flags.*list/);
    assert.match(handoffFaultV2(changed(session, (h) => { delete h.session.principles[0].verbatim_key_phrases; })), /Principle 1.*verbatim_key_phrases/);
    assert.match(handoffFaultV2(changed(session, (h) => { h.session.principles[0].n = 0; })), /number/);
  });
  it("lets a principle's key phrases and example be empty: names left out, or no words of hers", () => {
    assert.equal(handoffFaultV2(changed(session, (h) => { h.session.principles[0].verbatim_key_phrases = []; h.session.principles[0].example_application = ""; })), "");
  });
  it("refuses a recurring principle with no words, and a Reel idea with no idea or words, or naming a principle that is not there", () => {
    assert.match(handoffFaultV2(changed(session, (h) => { h.session.recurringPrinciples[0].text = ""; })), /Recurring principle 1.*text/);
    assert.match(handoffFaultV2(changed(session, (h) => { h.session.reelsToFilm[0].idea = ""; })), /Reel idea 1.*idea/);
    assert.match(handoffFaultV2(changed(session, (h) => { delete h.session.reelsToFilm[0].words; })), /Reel idea 1.*words/);
    assert.match(handoffFaultV2(changed(session, (h) => { delete h.session.reelsToFilm[0].why; })), /Reel idea 1.*why/);
    assert.match(handoffFaultV2(changed(session, (h) => { h.session.reelsToFilm[0].principle = 9; })), /Reel idea 1.*principle 9.*not in it/);
    assert.match(handoffFaultV2(changed(session, (h) => { h.session.reelsToFilm[0].principle = "1"; })), /Reel idea 1.*principle/);
    assert.match(handoffFaultV2(changed(session, (h) => { delete h.session.reelsToFilm[0].principle; })), /Reel idea 1.*principle/);
    assert.equal(handoffFaultV2(changed(session, (h) => { h.session.reelsToFilm[0].principle = null; })), "");
  });
  it("refuses a session whose lists are not lists", () => {
    assert.match(handoffFaultV2(changed(session, (h) => { h.session.principles = {}; })), /principles.*list/);
    assert.match(handoffFaultV2(changed(session, (h) => { delete h.session.recurringPrinciples; })), /recurringPrinciples.*list/);
    assert.match(handoffFaultV2(changed(session, (h) => { h.session.reelsToFilm = null; })), /reelsToFilm.*list/);
  });
  it("gives the first fault only, and each of the ten the plan names its own words", () => {
    const faults = [
      handoffFaultV2({ ...session(), main: { file: "x.mov", seconds: 5, srt: SRT } }),
      handoffFaultV2({ ...session(), suggestions: [] }),
      handoffFaultV2(changed(session, (h) => { h.session.principles[0].source_context = "x"; })),
      handoffFaultV2(changed(session, (h) => { delete h.reels[0].clientAgreed; })),
      handoffFaultV2(changed(session, (h) => { h.reels[0].clientAgreed = "Jane Doe"; })),
      handoffFaultV2(changed(raw, (h) => { h.main.onPicture = []; })),
      handoffFaultV2(changed(finished, (h) => { h.main.onPicture = ["x"]; })),
      handoffFaultV2(changed(session, (h) => { h.transcript = "x"; })),
      handoffFaultV2(changed(finished, (h) => { h.video.title = "x"; })),
      handoffFaultV2(changed(finished, (h) => { delete h.suggestions[0].point; })),
      handoffFaultV2({ ...finished(), revision: 0 })
    ];
    assert.ok(faults.every((f) => f !== ""));
    assert.equal(new Set(faults).size, faults.length);
  });
});

describe("suggestionsOnClock: a raw video's suggestions on the final main video's clock", () => {
  /** Ten one-second words, "one" to "ten", the first starting at `from` seconds of the raw video. */
  const ten = (from) => ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"].map((w, i) => ({ w, start: from + i, end: from + 1 + i }));
  /** A suggestion as it is stored, in seconds of the raw video, over the ten words from `from`. */
  const stored = (n, from) => ({ n, start: from, end: from + 10, stretches: [{ start: from, end: from + 10 }], first: "one two three", last: "eight nine ten", why: `Why ${n}.`, point: `Point ${n}.` });
  /** The words of the recording: two of them outside the suggestion at 120, one second either side of it. */
  const WORDS = [{ w: "before", start: 118, end: 119 }, ...ten(120), { w: "after", start: 131, end: 132 }];
  /** The final clock of kept pieces of the raw video, each [start, end] in seconds of it. */
  const clockOf = (...pieces) => clockOfRanges(pieces.map(([start, end]) => ({ start, end })));
  const on = (clock, suggestions = [stored(4, 120)], words = WORDS, more = {}) => suggestionsOnClock({ suggestions, words, clock, ...more });

  it("maps a suggestion with no word cut by the clock's offset, and changes none of its words, its number, its reason or its point", () => {
    // Raw 10 to 60 is the clock's first 50 seconds, and raw 100 to 200 the next 100: raw 120 is at 70.
    assert.deepEqual(on(clockOf([10, 60], [100, 200])), [{ n: 4, start: 70, end: 80, stretches: [{ start: 70, end: 80 }], first: "one two three", last: "eight nine ten", why: "Why 4.", point: "Point 4." }]);
  });
  it("keeps a suggestion with 3 of its 10 words cut, with its new start and its kept runs as stretches", () => {
    // Cut: "one" at the start and "five" and "six" in the middle. The words around the two cuts are two stretches.
    const [s] = on(clockOf([0, 50], [100, 120], [121, 124], [126, 200]));
    assert.equal(s.start, 70);
    assert.equal(s.end, 77);
    assert.deepEqual(s.stretches, [{ start: 70, end: 73 }, { start: 73, end: 77 }]);
    assert.equal(s.first, "two three four");
    assert.equal(s.last, "eight nine ten");
    assert.equal(s.n, 4);
  });
  it("leaves a suggestion out when 4 of its 10 words are cut: only 70 in 100 or more are kept", () => {
    assert.deepEqual(on(clockOf([0, 120], [124, 200])), []);
    assert.equal(on(clockOf([0, 120], [123, 200])).length, 1);
  });
  it("counts the words that end inside a stretch of the suggestion, and none of the words round it", () => {
    // Its 3 last words are cut, and so is the word before it: with that one counted, 7 in 11 are kept and it would be left out.
    const [s] = on(clockOf([0, 118], [119, 127], [130, 200]));
    assert.equal(s.first, "one two three");
    assert.equal(s.last, "five six seven");
    assert.deepEqual([s.start, s.end], [119, 126]);
    assert.deepEqual(s.stretches, [{ start: 119, end: 126 }]);
  });
  it("gives first and last as the final kept words, as many as the suggestion's own hold", () => {
    // Cut: "one", "two" and "ten". It had a first of two words and a last of three.
    const given = { ...stored(4, 120), first: "one two", last: "eight nine ten" };
    const [s] = on(clockOf([0, 120], [122, 129], [130, 200]), [given]);
    assert.equal(s.first, "three four");
    assert.equal(s.last, "seven eight nine");
    assert.deepEqual(s.stretches, [{ start: 120, end: 127 }]);
    // A suggestion with no first or last words given gets four of each.
    const bare = { ...stored(4, 120), first: undefined, last: "" };
    const [t] = on(clockOf([0, 200]), [bare]);
    assert.equal(t.first, "one two three four");
    assert.equal(t.last, "seven eight nine ten");
  });
  it("starts a word that starts in what is cut where its piece starts: it never overlaps the stretch before it", () => {
    // "seven" starts in the pause the cut leaves before it, at 125.4, and is said from 126, where its piece begins.
    const words = ten(120).map((w) => (w.w === "seven" ? { ...w, start: 125.4 } : w));
    const [s] = on(clockOf([0, 124], [126, 200]), [stored(4, 120)], words);
    assert.deepEqual(s.stretches, [{ start: 120, end: 124 }, { start: 124, end: 128 }]);
  });
  it("gives times to the hundredth of a second", () => {
    const words = ten(120).map((w, i) => (i === 0 ? { ...w, start: 120.126 } : i === 9 ? { ...w, end: 129.994 } : w));
    const [s] = on(clockOf([0, 200]), [stored(4, 120)], words);
    assert.deepEqual([s.start, s.end], [120.13, 129.99]);
    assert.deepEqual(s.stretches, [{ start: 120.13, end: 129.99 }]);
  });
  it("clamps its times to the main video as a Reel's place in it is clamped, when the file is shorter than the clock", () => {
    const [s] = on(clockOf([0, 200]), [stored(4, 120)], WORDS, { seconds: 129.5 });
    assert.deepEqual([s.start, s.end], [120, 129.5]);
    assert.deepEqual(s.stretches, [{ start: 120, end: 129.5 }]);
    assert.deepEqual(on(clockOf([0, 200]), [stored(4, 120)], WORDS, { seconds: 119 }), []);
    // With no length given, the clock's own is the main video's, and a word that ends past it is cut.
    const [t] = on(clockOf([0, 129.5]), [stored(4, 120)]);
    assert.equal(t.end, 129);
    assert.equal(t.last, "seven eight nine");
  });
  it("keeps the order and the numbers of the suggestions, and leaves out one with no word of its own in the video", () => {
    const given = [stored(7, 120), stored(3, 140), stored(12, 160)];
    const words = [...ten(120), ...ten(140), ...ten(160)];
    // The clock cuts 140 to 144: suggestion 3 has 4 of its 10 words cut, and the other two have all of theirs.
    const done = on(clockOf([0, 140], [144, 150], [160, 170]), given, words);
    assert.deepEqual(done.map((s) => s.n), [7, 12]);
    assert.deepEqual(done.map((s) => [s.why, s.point]), [["Why 7.", "Point 7."], ["Why 12.", "Point 12."]]);
    // A suggestion with no word in its stretches at all, as when none was timed there, cannot be placed.
    assert.deepEqual(on(clockOf([0, 200]), [stored(9, 500)]), []);
    assert.deepEqual(on(clockOf([0, 200]), []), []);
    assert.deepEqual(on(clockOf([0, 200]), [stored(4, 120)], []), []);
  });
  it("writes only the keys of the contract, in its order, whatever the stored suggestion holds besides", () => {
    const given = { ...stored(4, 120), ranges: [{ start: 120, end: 130 }], length: 10, hook: "x" };
    const [s] = on(clockOf([0, 200]), [given]);
    assert.deepEqual(Object.keys(s), ["n", "start", "end", "stretches", "first", "last", "why", "point"]);
  });
  it("takes a suggestion with no stretches as one stretch from its start to its end, and changes nothing it is given", () => {
    const given = stored(4, 120);
    delete given.stretches;
    const before = JSON.parse(JSON.stringify(given));
    const [s] = on(clockOf([10, 200]), [given]);
    assert.deepEqual(s.stretches, [{ start: 110, end: 120 }]);
    assert.deepEqual(given, before);
  });
  it("leaves out a suggestion one of whose stretches would have no length: the hand-off's check refuses such a stretch", () => {
    // "five" is a moment, said alone between two cut words, and a stretch of it would start where it ends.
    const words = ten(120).map((w) => (w.w === "five" ? { ...w, start: 124.5, end: 124.5 } : w));
    assert.deepEqual(on(clockOf([0, 123], [124, 125], [126, 200]), [stored(4, 120)], words), []);
  });
  it("gives suggestions that the hand-off's own check passes, as the writer puts them in a raw video's hand-off", () => {
    const suggestions = on(clockOf([0, 50], [100, 120], [121, 124], [126, 200]));
    const h = buildHandoffV2({ ...GIVEN, record: RAW, main: MAIN, suggestions });
    assert.equal(handoffFaultV2(h), "");
    assert.deepEqual(h.suggestions, suggestions);
  });
});

describe("the captions the page reads", () => {
  it("are the transcript tool's own captions, which the page's reader makes into timed lines", () => {
    for (const h of [finished(), raw(), short(), session()]) {
      for (const srt of [h.main && h.main.srt, ...(h.reels || []).map((r) => r.srt)].filter(Boolean)) {
        const lines = tidyTranscript(srt).split("\n");
        assert.ok(lines.length >= 1 && lines.every((line) => /^\[\d+:\d{2}\] \S/.test(line)), lines.join(" / "));
      }
    }
  });
});
