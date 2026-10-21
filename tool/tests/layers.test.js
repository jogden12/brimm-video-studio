// What brimm-video lays over a timeline's picture, from the record: captions, a Reel's title, texts, graphics and the logo.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { wordsOf } from "../cuts.js";
import { layersFor, ROLES, HOOK_SECONDS, TOP_BAND } from "../layers.js";
// Sizes and places are styles.js's (by-hand checks 1 and 3 may change them): these tests take them from there.
import { captionLook, titleLook } from "../styles.js";
import { TOLD } from "./fixtures.js";

const WORDS = wordsOf(TOLD);
const MAIN = [{ start: 5.87, end: 9.838 }, { start: 13.383, end: 16.53 }, { start: 19.214, end: 21.297 }];
const REEL = [{ start: 13.38, end: 16.516 }, { start: 19.219, end: 21.287 }];
const WIDE = { width: 1280, height: 720 };
const UPRIGHT = { width: 1080, height: 1920 };
const ID = "e-20261014-3fa9c1";
const main = (more = {}) => ({ preset: null, cuts: [], texts: [], graphics: [], logo: false, pushed: [], base: null, ...more });
const record = (more = {}) => ({ id: ID, kind: "episode", spellings: [], main: main(), reels: [{ n: 2, status: "picked", from: 13.38, to: 21.287, title: "Know your costs", pushed: [] }], ...more });
const CHART = { "media/chart.png": { width: 1600, height: 900 }, "media/logo.png": { width: 600, height: 300 } };

describe("the layers of the main video", () => {
  it("are none for an episode's main video as the import left it: a full episode draws no captions", () => {
    assert.deepEqual(layersFor({ record: record(), part: "main", frame: WIDE, ranges: MAIN, words: WORDS, face: "Varela" }), { titles: [], stills: [], look: null, told: [] });
  });
  it("are its name titles, on Final Cut's Basic Lower Third when wide, until the time asked, on the timeline's clock", () => {
    const r = record({ main: main({ texts: [{ id: "t1", kind: "lower-third", at: 15.3, for: 2, lines: ["Sallie Ogden", "Founder, The BRIMM"] }] }) });
    const { titles } = layersFor({ record: r, part: "main", frame: WIDE, ranges: MAIN, words: WORDS, face: "Varela" });
    assert.equal(titles.length, 1);
    const [t] = titles;
    const look = titleLook("name", { style: "file-only", frame: WIDE, face: "Varela" });
    assert.deepEqual([t.start, Math.round(t.end * 1000) / 1000, t.lane, t.role, t.name, t.template, t.lines.map((l) => [l.text, l.font, l.fontSize])], [15.3, 19.984, 5, ROLES.titles, "brimm text t1 3fa9c1", look.template, [["Sallie Ogden", "Varela", look.lines[0].fontSize], ["Founder, The BRIMM", "Varela", look.lines[1].fontSize]]]);
  });
  it("are its graphics, each its picture from media/ at its place, and the logo kept out of the way of a picture in its corner", () => {
    const r = record({ brand: { logo: "media/logo.png" }, main: main({ logo: true, graphics: [{ id: "g1", picture: "media/chart.png", at: 14.0, for: 2, place: "corner" }] }) });
    const { stills } = layersFor({ record: r, part: "main", frame: WIDE, ranges: MAIN, words: WORDS, face: "Varela", pictures: CHART });
    assert.deepEqual(stills.map((s) => [s.name, s.src, s.start, Math.round(s.end * 1000) / 1000, s.lane]), [
      ["brimm graphic g1 3fa9c1", "../media/chart.png", 14, 16, 2],
      ["brimm logo 3fa9c1", "../media/logo.png", 5.87, 14, 3],
      ["brimm logo 3fa9c1", "../media/logo.png", 16, 21.297, 3]
    ]);
  });
  it("say a text that is in what is cut now is not shown", () => {
    const r = record({ main: main({ texts: [{ id: "t1", kind: "lower-third", at: 11, for: 4, lines: ["Sallie Ogden"] }] }) });
    assert.deepEqual(layersFor({ record: r, part: "main", frame: WIDE, ranges: MAIN, words: WORDS, face: "Varela" }).told, ['The name title t1 ("Sallie Ogden") is in what is cut now, so it is not shown.']);
  });
});

describe("the layers of a Reel", () => {
  it("leave out a name title whose moment a cut took out, as the main video does, and never move it past the title on screen", () => {
    // 13.0 s was kept when the title was asked for; the Reel now starts at 13.38.
    const r = record({ reels: [{ n: 2, status: "picked", from: 13.38, to: 21.287, title: "Know your costs", pushed: [], texts: [{ id: "t1", kind: "lower-third", at: 13.0, for: 4, lines: ["Sallie Ogden"] }] }] });
    const { titles, told } = layersFor({ record: r, part: { reel: 2 }, frame: UPRIGHT, ranges: REEL, words: WORDS, face: "Varela" });
    assert.ok(!titles.some((x) => x.name === "brimm text t1 3fa9c1"), JSON.stringify(titles.map((x) => x.name)));
    assert.ok(told.includes('The name title t1 ("Sallie Ogden") is in what is cut now, so it is not shown.'), told.join("\n"));
    assert.ok(!told.some((x) => x.startsWith("The name title t1 starts once")), told.join("\n"));
  });
  it("are its running captions, Plain, spelled as the episode spells, and its title on screen for its first seconds", () => {
    const r = record({ spellings: [["Sallie", "Sallie Ogden"]] });
    const { titles, told } = layersFor({ record: r, part: { reel: 2 }, frame: UPRIGHT, ranges: REEL, words: WORDS, face: "Varela" });
    const captions = titles.filter((t) => t.role === ROLES.captions);
    assert.deepEqual(captions.map((c) => c.lines.map((l) => l.text).join(" / ")), ["So the first thing", "you need to do", "is know your costs.", "Thank you so much,", "Sallie Ogden."]);
    const look = captionLook({ style: "plain", job: "solo-clip", frame: UPRIGHT, face: "Varela" });
    assert.deepEqual([captions[0].name, captions[0].lane, captions[0].position, captions[0].lines[0].fontSize], ["brimm caption 1 3fa9c1", 4, look.position, look.fontSize]);
    const hook = titles.find((t) => t.name === "brimm hook 3fa9c1");
    assert.deepEqual([hook.start, Math.round(hook.end * 1000) / 1000, hook.lines.map((l) => l.text), hook.position], [13.38, 16.38, ["Know your", "costs"], titleLook("hook", { style: "plain", frame: UPRIGHT, face: "Varela" }).position]);
    assert.equal(HOOK_SECONDS, 3);
    // Its title sits at the top, where it can cover her face: said, since where the face is is not read yet (ruling 1).
    assert.deepEqual(told, ["1 caption still shows for under 0.83 s, and 1 still runs faster than 20 characters a second.", TOP_BAND]);
  });
  it("leave a Reel's logo and look for the brand templates, and say its look is recorded", () => {
    const r = record({ brand: { logo: "media/logo.png" }, reels: [{ ...record().reels[0], captions: false, title: "", logo: true, preset: { job: "solo-clip", captions: "plain", look: "warm" } }] });
    const made = layersFor({ record: r, part: { reel: 2 }, frame: UPRIGHT, ranges: REEL, words: WORDS, face: "Varela", pictures: CHART });
    assert.deepEqual([made.stills, made.look, made.told], [[], null, ["A Reel's look comes with the brand templates, later: warm is recorded for Reel 2."]]);
  });
  it("put words above pictures: graphics lowest, then the logo, the captions and the titles", () => {
    const r = record({ brand: { logo: "media/logo.png" }, main: main({ logo: true, preset: { job: "teaching-clip", captions: "plain", look: "natural" }, texts: [{ id: "t1", kind: "lower-third", at: 15.3, for: 2, lines: ["Sallie Ogden"] }], graphics: [{ id: "g1", picture: "media/chart.png", at: 14.0, for: 2, place: "full" }] }) });
    const { titles, stills } = layersFor({ record: r, part: "main", frame: WIDE, ranges: MAIN, words: WORDS, face: "Varela", pictures: CHART });
    const lane = (name) => [...titles, ...stills].find((x) => x.name.startsWith(name)).lane;
    assert.deepEqual(["brimm graphic", "brimm logo", "brimm caption", "brimm text"].map(lane), [2, 3, 4, 5]);
  });
  it("start a name title asked for while a Reel's title on screen shows once that title ends: both sit at the top", () => {
    const r = record({ reels: [{ ...record().reels[0], captions: false, texts: [{ id: "t1", kind: "lower-third", at: 14, for: 3, lines: ["Sallie Ogden"] }] }] });
    const { titles, told } = layersFor({ record: r, part: { reel: 2 }, frame: UPRIGHT, ranges: REEL, words: WORDS, face: "Varela" });
    assert.deepEqual(titles.map((t) => [t.name, Math.round(t.start * 1000) / 1000]), [["brimm hook 3fa9c1", 13.38], ["brimm text t1 3fa9c1", 16.38]]);
    assert.deepEqual(told, ["The name title t1 starts once Reel 2's title on screen ends, 3 seconds in: both sit at the top.", TOP_BAND]);
  });
  it("say once what Signature does not draw yet, for the captions and for the titles", () => {
    const r = record({ reels: [{ ...record().reels[0], preset: { job: "solo-clip", captions: "signature", look: "natural" }, texts: [{ id: "t1", kind: "lower-third", at: 19.5, for: 1, lines: ["Sallie Ogden"] }] }] });
    const { told } = layersFor({ record: r, part: { reel: 2 }, frame: UPRIGHT, ranges: REEL, words: WORDS, face: "Varela" });
    assert.deepEqual(told.filter((t) => t.startsWith("Signature")), ["Signature's captions fade in line by line, which is not drawn yet, so they are drawn Plain, without the fade.", "Signature's navy block behind a title is not drawn yet, so titles are drawn Plain."]);
  });
  it("draw no captions on a Reel whose captions are turned off", () => {
    const r = record({ reels: [{ ...record().reels[0], captions: false }] });
    assert.deepEqual(layersFor({ record: r, part: { reel: 2 }, frame: UPRIGHT, ranges: REEL, words: WORDS, face: "Varela" }).titles.map((t) => t.name), ["brimm hook 3fa9c1"]);
  });
  it("draw a title too wide for two lines smaller, and leave out one that does not fit even at 70%", () => {
    const long = (title) => record({ reels: [{ ...record().reels[0], captions: false, title }] });
    const drawn = layersFor({ record: long("Charge what your expertise is worth"), part: { reel: 2 }, frame: UPRIGHT, ranges: REEL, words: WORDS, face: "Varela" });
    const full = titleLook("hook", { style: "plain", frame: UPRIGHT, face: "Varela" }).lines[0].fontSize;
    assert.deepEqual([drawn.titles[0].lines.map((l) => l.text), drawn.titles[0].lines[0].fontSize, drawn.told], [["Charge what your", "expertise is worth"], Math.round(full * 0.7), ["The title on screen is drawn at 70% of its size to fit two lines.", TOP_BAND]]);
    const gone = layersFor({ record: long("Everything you were never told about pricing your consulting offers"), part: { reel: 2 }, frame: UPRIGHT, ranges: REEL, words: WORDS, face: "Varela" });
    const fit = Math.floor((titleLook("hook", { style: "plain", frame: UPRIGHT, face: "Varela" }).chars / 0.7) * 2);
    assert.deepEqual([gone.titles, gone.told], [[], [`No title on screen: "Everything you were never told about pricing your consulting offers" does not fit two lines, even at the smallest size. About ${fit} characters fit. Give a shorter one.`]]);
  });
});
