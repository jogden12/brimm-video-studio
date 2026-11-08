// The import's note of each look at a folder (access.js): what it writes, when it judges that macOS is stopping the import, and the
// words it says. Each test has a home folder of its own, made for it and removed after: nothing here touches this Mac's own settings,
// Dropbox or a watched folder, and none calls launchctl, osascript or macOS's privacy control (watched-fs.js refuses a read as macOS does).
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { seenFile, settingsFile } from "../settings.js";
import {
  ASKING_MS, UNSEEN_MS, BANNER_AGAIN_MS, DOWNLOADS_SAY_MS, accessFile, accessBanner, accessLine, accessLog, blocksDrop, bracket, findingOf, lookAt, lookLog, noteState,
  placeWordsOf, postIfDue, postNewNodeIfDue, readAccess, saysInEpisodes, saysInOverview, setupLine, stepLine, switchFor, writeAccess,
} from "../access.js";
import { watched } from "./watched-fs.js";

const NODE = "/opt/homebrew/Cellar/node/26.11.1/bin/node";
const NODE2 = "/opt/homebrew/Cellar/node/26.12.0/bin/node";
const refusal = (code) => Object.assign(new Error(`${code}: refused`), { code });

let home;
beforeEach(() => {
  home = realpathSync(mkdtempSync(join(tmpdir(), "brimm-access-")));
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

describe("the note", () => {
  it("is beside seen.json, and is empty when there is none or it cannot be read", () => {
    assert.equal(accessFile(home), join(dirname(seenFile(home)), "access.json"));
    assert.deepEqual(readAccess(home), { version: 1, places: {}, looking: null, told: {} });
    mkdirSync(dirname(accessFile(home)), { recursive: true });
    writeFileSync(accessFile(home), "{ not json");
    assert.deepEqual(readAccess(home), { version: 1, places: {}, looking: null, told: {} });
  });

  it("is written whole and read back, with no half-written file left", () => {
    const note = { version: 1, places: {}, looking: null, told: { drop: { key: "refused|x", at: 5 } } };
    writeAccess(home, note);
    assert.deepEqual(readAccess(home), note);
    assert.equal(JSON.parse(readFileSync(accessFile(home), "utf8")).told.drop.at, 5);
    assert.throws(() => readFileSync(`${accessFile(home)}.writing`));
  });

  it("passes over a write that fails", () => {
    mkdirSync(join(home, "Library"), { recursive: true });
    writeFileSync(join(home, "Library", "Application Support"), "a file, not a folder");
    assert.doesNotThrow(() => writeAccess(home, { version: 1, places: {}, looking: null, told: {} }));
  });
});

describe("bracket", () => {
  it("is set while fn runs, gives fn's result, and is cleared when fn is done", () => {
    let inside;
    const result = bracket("drop", () => {
      inside = readAccess(home).looking;
      return 42;
    }, { home, clock: () => 1000, pid: 4242 });
    assert.equal(result, 42);
    assert.deepEqual(inside, { place: "drop", pid: 4242, at: 1000 });
    assert.equal(readAccess(home).looking, null);
  });

  it("is cleared when fn throws, and the throw goes on", () => {
    assert.throws(() => bracket("drop", () => { throw new Error("boom"); }, { home, clock: () => 1, pid: 1 }), /boom/);
    assert.equal(readAccess(home).looking, null);
  });

  it("keeps what fn wrote to the note", () => {
    bracket("drop", () => noteState("drop", home, null, { home, clock: () => 7, node: NODE }), { home, clock: () => 1, pid: 1 });
    assert.equal(readAccess(home).places.drop.state, "ok");
  });
});

describe("the options are optional", () => {
  it("bracket, noteState and lookAt go on with no options, passing over a note they cannot write", () => {
    assert.equal(bracket("drop", () => 7), 7);
    assert.equal(noteState("drop", join(home, "Drop"), null), "ok");
    assert.deepEqual(lookAt("drop", join(home, "Nowhere")), { state: "missing", code: "ENOENT" });
  });
});

describe("lookAt", () => {
  it("lists the folder, notes ok, and leaves no looking", () => {
    const folder = join(home, "Drop");
    mkdirSync(folder);
    writeFileSync(join(folder, "a.mov"), "x");
    const got = lookAt("drop", folder, { home, clock: () => 10, node: NODE });
    assert.deepEqual(got, { names: ["a.mov"] });
    const note = readAccess(home);
    assert.equal(note.places.drop.state, "ok");
    assert.equal(note.places.drop.okNode, NODE);
    assert.equal(note.places.drop.folder, folder);
    assert.equal(note.looking, null);
  });

  it("notes a refusal as refused with its code, and says so", async () => {
    const folder = join(home, "Drop");
    mkdirSync(folder);
    const { result } = await watched(
      () => lookAt("drop", folder, { home, clock: () => 10, node: NODE }),
      { names: ["readdirSync"], deny: (name, path) => (path === folder ? refusal("EPERM") : null) },
    );
    assert.deepEqual(result, { state: "refused", code: "EPERM" });
    assert.equal(readAccess(home).places.drop.state, "refused");
    assert.equal(readAccess(home).looking, null);
  });

  it("says missing for a folder that is not there", () => {
    assert.deepEqual(lookAt("drop", join(home, "Nowhere"), { home, clock: () => 1, node: NODE }), { state: "missing", code: "ENOENT" });
  });

  it("goes on when the note cannot be written", () => {
    mkdirSync(join(home, "Library"), { recursive: true });
    writeFileSync(join(home, "Library", "Application Support"), "a file, not a folder");
    const folder = join(home, "Drop");
    mkdirSync(folder);
    writeFileSync(join(folder, "b.mov"), "x");
    assert.deepEqual(lookAt("drop", folder, { home, node: NODE }), { names: ["b.mov"] });
  });
});

describe("noteState", () => {
  it("gives back the state it wrote", () => {
    const folder = join(home, "Drop");
    assert.equal(noteState("drop", folder, null, { home, clock: () => 1, node: NODE }), "ok");
    assert.equal(noteState("drop", folder, refusal("EPERM"), { home, clock: () => 2, node: NODE }), "refused");
    assert.equal(noteState("drop", folder, refusal("EACCES"), { home, clock: () => 3, node: NODE }), "locked");
  });

  it("keeps since and okNode while the state is the same, and starts a new since when it changes", () => {
    const folder = join(home, "Drop");
    noteState("drop", folder, null, { home, clock: () => 1, node: NODE });
    noteState("drop", folder, refusal("EPERM"), { home, clock: () => 2, node: NODE2 });
    noteState("drop", folder, refusal("EPERM"), { home, clock: () => 3, node: NODE2 });
    let drop = readAccess(home).places.drop;
    assert.equal(drop.state, "refused");
    assert.equal(drop.code, "EPERM");
    assert.equal(drop.since, 2);
    assert.equal(drop.at, 3);
    assert.equal(drop.node, NODE2);
    assert.equal(drop.okNode, NODE);
    noteState("drop", folder, refusal("EACCES"), { home, clock: () => 4, node: NODE2 });
    drop = readAccess(home).places.drop;
    assert.equal(drop.state, "locked");
    assert.equal(drop.since, 4);
    assert.equal(drop.okNode, NODE);
  });

  it("leaves okNode out until a first ok look, and gives the other states their names", () => {
    const folder = join(home, "Drop");
    noteState("drop", folder, refusal("EPERM"), { home, clock: () => 1, node: NODE });
    assert.equal("okNode" in readAccess(home).places.drop, false);
    noteState("drop", folder, refusal("ENOENT"), { home, clock: () => 2, node: NODE });
    assert.equal(readAccess(home).places.drop.state, "missing");
    noteState("drop", folder, refusal("EIO"), { home, clock: () => 3, node: NODE });
    assert.equal(readAccess(home).places.drop.state, "error");
    assert.equal(readAccess(home).places.drop.code, "EIO");
    noteState("drop", folder, null, { home, clock: () => 4, node: NODE });
    const drop = readAccess(home).places.drop;
    assert.equal(drop.state, "ok");
    assert.equal(drop.code, "");
    assert.equal(drop.okNode, NODE);
  });
});

describe("findingOf", () => {
  const places = { drop: "/drop", episodes: "/episodes" };
  const place = (state, extra = {}) => ({ state, code: { refused: "EPERM", locked: "EACCES", error: "EIO" }[state] || "", at: 1, since: 1, folder: "/drop", node: NODE, ...extra });
  const base = { now: 1_000_000, places, agentPid: 4242 };
  const note = (placesNoted = {}, looking = null) => ({ version: 1, places: placesNoted, looking, told: {} });

  it("is null when there is nothing to say", () => {
    assert.equal(findingOf({ ...base, note: note({ drop: place("ok") }) }), null);
  });

  it("says asking when the agent's own look is more than a minute old", () => {
    const looking = { place: "episodes", pid: 4242, at: base.now - ASKING_MS - 1 };
    assert.deepEqual(findingOf({ ...base, note: note({}, looking) }), { kind: "asking", place: "episodes" });
  });

  it("does not say asking for a look of a minute or less, or of another pid", () => {
    assert.equal(findingOf({ ...base, note: note({}, { place: "drop", pid: 4242, at: base.now - ASKING_MS }) }), null);
    assert.equal(findingOf({ ...base, note: note({}, { place: "drop", pid: 999, at: base.now - ASKING_MS - 1 }) }), null);
  });

  it("says asking before refused", () => {
    const looking = { place: "drop", pid: 4242, at: 0 };
    assert.equal(findingOf({ ...base, note: note({ drop: place("refused") }, looking) }).kind, "asking");
  });

  it("says refused, locked and error with the place and the code", () => {
    assert.deepEqual(findingOf({ ...base, note: note({ drop: place("refused") }) }), { kind: "refused", place: "drop", code: "EPERM" });
    assert.deepEqual(findingOf({ ...base, note: note({ drop: place("locked") }) }), { kind: "locked", place: "drop", code: "EACCES" });
    assert.deepEqual(findingOf({ ...base, note: note({ drop: place("error") }) }), { kind: "error", place: "drop", code: "EIO" });
  });

  it("takes the first noted place in the order drop, episodes, downloads", () => {
    const noted = { downloads: place("refused", { folder: "/downloads" }), episodes: place("locked", { folder: "/episodes" }) };
    const where = { ...places, downloads: "/downloads" };
    assert.deepEqual(findingOf({ ...base, places: where, note: note(noted) }), { kind: "locked", place: "episodes", code: "EACCES" });
    assert.deepEqual(findingOf({ ...base, places: where, note: note({ ...noted, drop: place("refused") }) }).place, "drop");
  });

  it("says episodes refused when drop is ok", () => {
    const noted = { drop: place("ok"), episodes: place("refused", { folder: "/episodes" }) };
    assert.deepEqual(findingOf({ ...base, note: note(noted) }), { kind: "refused", place: "episodes", code: "EPERM" });
  });

  it("passes over a note about a folder that is not where the place is now", () => {
    assert.equal(findingOf({ ...base, places: { drop: "/new" }, note: note({ drop: place("refused", { folder: "/old" }) }) }), null);
  });

  it("says missing when the caller says the drop folder is not there", () => {
    assert.deepEqual(findingOf({ ...base, missing: true, note: note() }), { kind: "missing", place: "drop" });
  });

  it("says unseen with the caller's videos, when there are some", () => {
    assert.deepEqual(findingOf({ ...base, unseen: ["a", "b"], note: note() }), { kind: "unseen", videos: ["a", "b"] });
    assert.equal(findingOf({ ...base, unseen: [], note: note() }), null);
  });

  it("keeps the order refused, missing, unseen, newNode", () => {
    const all = { ...base, missing: true, unseen: ["a"], needsAccess: ["drop"], agentNode: NODE2 };
    const noted = note({ drop: place("ok", { okNode: NODE }) });
    assert.equal(findingOf({ ...all, note: noted }).kind, "missing");
    assert.equal(findingOf({ ...all, missing: false, note: noted }).kind, "unseen");
    assert.equal(findingOf({ ...all, missing: false, unseen: [], note: noted }).kind, "newNode");
    assert.equal(findingOf({ ...all, note: note({ drop: place("refused", { okNode: NODE }) }) }).kind, "refused");
  });

  it("says newNode when a place that needs access was let in by another node", () => {
    const noted = note({ drop: place("ok", { okNode: NODE }) });
    assert.deepEqual(findingOf({ ...base, note: noted, needsAccess: ["drop"], agentNode: NODE2 }), { kind: "newNode" });
    assert.equal(findingOf({ ...base, note: noted, needsAccess: ["drop"], agentNode: NODE }), null);
    assert.equal(findingOf({ ...base, note: noted, needsAccess: [], agentNode: NODE2 }), null);
    assert.equal(findingOf({ ...base, note: noted, agentNode: NODE2 }), null);
    assert.equal(findingOf({ ...base, note: noted, needsAccess: ["drop"], agentNode: "" }), null);
  });

  it("judges newNode by the places that need access, not by any place", () => {
    const noted = note({ drop: place("ok", { okNode: NODE2 }), episodes: place("ok", { okNode: NODE, folder: "/episodes" }) });
    assert.deepEqual(findingOf({ ...base, note: noted, needsAccess: ["episodes"], agentNode: NODE2 }), { kind: "newNode" });
    assert.equal(findingOf({ ...base, note: noted, needsAccess: ["drop"], agentNode: NODE2 }), null);
  });

  it("never gives newNode for downloads", () => {
    const noted = note({ downloads: place("ok", { okNode: NODE, folder: "/downloads" }) });
    assert.equal(findingOf({ ...base, note: noted, needsAccess: ["downloads"], agentNode: NODE2 }), null);
  });

  it("says no newNode when the places that need access have no okNode", () => {
    assert.equal(findingOf({ ...base, note: note({ drop: place("ok") }), needsAccess: ["drop"], agentNode: NODE2 }), null);
    assert.equal(findingOf({ ...base, note: note({}), needsAccess: ["drop"], agentNode: NODE2 }), null);
  });

  it("passes over a noted place whose folder is not text", () => {
    assert.equal(findingOf({ ...base, note: note({ drop: place("refused", { folder: undefined }), episodes: place("refused", { folder: 5 }) }) }), null);
  });

  it("keeps the constants", () => {
    assert.equal(ASKING_MS, 60_000);
    assert.equal(UNSEEN_MS, 180_000);
    assert.equal(BANNER_AGAIN_MS, 3_600_000);
    assert.equal(DOWNLOADS_SAY_MS, 86_400_000);
  });
});

describe("the words are the design's", () => {
  const drop = "your drop folder, Dropbox › BRIMM Video › Drop";
  const dl = "the Downloads folder";
  const sw = "the switch for Dropbox";

  it("accessLine", () => {
    assert.equal(
      accessLine({ kind: "asking", place: "drop" }, { placeWords: drop }),
      `The import has waited more than a minute to look in ${drop}. If a box on this Mac's screen asks whether "node" may look in it, choose Allow, and the import goes on.`,
    );
    assert.equal(
      accessLine({ kind: "refused", place: "drop", code: "EPERM" }, { placeWords: drop, switchName: sw }),
      `This Mac does not let the import look in ${drop}, so the videos you drop wait. In System Settings, under Privacy & Security, Files and Folders, turn on ${sw} under each "node" listed. Then say "look again".`,
    );
    assert.equal(
      accessLine({ kind: "refused", place: "downloads", code: "EPERM" }, { placeWords: dl, switchName: "Downloads Folder" }),
      `This Mac does not let the import look in ${dl}, so the exports HyperFrames put there stay there. In System Settings, under Privacy & Security, Files and Folders, turn on Downloads Folder under each "node" listed. Then say "look again".`,
    );
    assert.equal(
      accessLine({ kind: "locked", place: "drop", code: "EACCES" }, { placeWords: drop }),
      `The import cannot open ${drop}: the folder's own permissions shut it. Ask Jason. (Jason: node gets EACCES there; see Get Info, Sharing & Permissions.)`,
    );
    assert.equal(
      accessLine({ kind: "error", place: "drop", code: "EIO" }, { placeWords: drop }),
      `The import could not look in ${drop} (EIO). Ask Jason. (Jason: see ~/Library/Logs/brimm-video.log.)`,
    );
    assert.equal(
      accessLine({ kind: "error", place: "drop" }, { placeWords: drop, code: "EBUSY" }),
      `The import could not look in ${drop} (EBUSY). Ask Jason. (Jason: see ~/Library/Logs/brimm-video.log.)`,
    );
    assert.equal(
      accessLine({ kind: "missing", place: "drop" }, { placeWords: drop }),
      'Your drop folder, Dropbox › BRIMM Video › Drop, is not there now. If it is on another disk, connect the disk, then say "look again".',
    );
    assert.equal(
      accessLine({ kind: "newNode" }, {}),
      "node was updated on this Mac, so macOS may ask whether node may look in your drop folder or in Dropbox. If a box asks, choose Allow.",
    );
  });

  it("accessLine for unseen, for one video and for two", () => {
    assert.equal(
      accessLine({ kind: "unseen", videos: ["x"] }, {}),
      'The import has not taken 1 video in your drop folder, and no import is running. Say "look again". If it still waits, ask Jason. (Jason: see ~/Library/Logs/brimm-video.log, and launchctl print gui/$(id -u)/com.thebrimm.unedited.)',
    );
    assert.equal(
      accessLine({ kind: "unseen", videos: ["x", "y"] }, {}),
      'The import has not taken 2 videos in your drop folder, and no import is running. Say "look again". If they still wait, ask Jason. (Jason: see ~/Library/Logs/brimm-video.log, and launchctl print gui/$(id -u)/com.thebrimm.unedited.)',
    );
  });

  it("stepLine", () => {
    assert.equal(
      stepLine({ kind: "unseen", videos: ["x"] }, {}),
      'The import has not taken it, and no import is running. Say "look again". If it still waits, ask Jason.',
    );
    for (const finding of [{ kind: "asking", place: "drop" }, { kind: "refused", place: "drop", code: "EPERM" }, { kind: "locked", place: "drop", code: "EACCES" }, { kind: "error", place: "drop", code: "EIO" }]) {
      const opts = { placeWords: drop, switchName: sw };
      assert.equal(stepLine(finding, opts), accessLine(finding, opts));
    }
  });

  it("stepLine says nothing for Downloads", () => {
    assert.equal(stepLine({ kind: "refused", place: "downloads", code: "EPERM" }, { placeWords: "the Downloads folder", switchName: "Downloads Folder" }), "");
    assert.equal(stepLine({ kind: "asking", place: "downloads" }, { placeWords: "the Downloads folder" }), "");
  });

  it("accessBanner", () => {
    assert.equal(accessBanner("refused", drop), `This Mac does not let node look in ${drop}. Allow it in System Settings › Privacy & Security › Files and Folders.`);
    assert.equal(accessBanner("locked", drop), `The import cannot open ${drop}. Ask Jason.`);
    assert.equal(accessBanner("newNode", ""), "node was updated. If macOS asks whether node may look in a folder, choose Allow.");
  });

  it("accessLog", () => {
    assert.equal(
      accessLog("refused", "EPERM", NODE, drop),
      `macOS does not let node (${NODE}) look in ${drop} (EPERM). Allow node in System Settings, Privacy & Security, Files and Folders; then say "look again" in her chat, or drop the video again.`,
    );
    assert.equal(
      accessLog("locked", "EACCES", NODE, drop),
      `The folder's own permissions do not let node look in ${drop} (EACCES). Jason checks them in Finder, Get Info, Sharing & Permissions.`,
    );
  });

  it("lookLog gives accessLog's line for a look that was refused or locked, in the place's words, and nothing for the others", () => {
    const folder = join(home, "Drop");
    assert.equal(lookLog("drop", folder, { state: "refused", code: "EPERM" }, home, NODE), accessLog("refused", "EPERM", NODE, placeWordsOf("drop", folder, home)));
    assert.equal(lookLog("episodes", folder, { state: "locked", code: "EACCES" }, home, NODE), accessLog("locked", "EACCES", NODE, "BRIMM Video in Dropbox"));
    assert.equal(lookLog("drop", folder, { state: "error", code: "EIO" }, home, NODE), `node (${NODE}) could not look in ${placeWordsOf("drop", folder, home)} (EIO).`);
    for (const look of [{ names: [] }, { state: "missing", code: "ENOENT" }]) assert.equal(lookLog("drop", folder, look, home, NODE), "");
  });

  describe("setupLine", () => {
    const LEAD = "  Files and Folders, at the end:  ";
    const at = { state: "ok", code: "", at: 1, since: 1, node: NODE, okNode: NODE };
    const drops = () => join(home, "Drop");
    const ok = () => ({ version: 1, looking: null, told: {}, places: { drop: { ...at, folder: drops() }, episodes: { ...at, folder: join(home, "Episodes") } } });
    const withPlace = (note, place, extra) => ({ ...note, places: { ...note.places, [place]: { ...note.places[place], ...extra } } });
    const dead = () => false;
    const live = () => true;
    const opts = (extra = {}) => ({ home, now: 100_000, alive: dead, ...extra });
    const words = "your drop folder, Drop, in your home folder";

    it("says ok when drop and episodes are both ok", () => {
      assert.equal(setupLine(ok(), opts()), `${LEAD}node may look in the drop folder and in Dropbox.`);
    });

    it("says not looked yet for no places, or for drop ok with episodes not noted", () => {
      assert.equal(setupLine(readAccess(home), opts()), `${LEAD}the import has not looked yet.`);
      assert.equal(setupLine({ ...ok(), places: { drop: ok().places.drop } }, opts()), `${LEAD}the import has not looked yet.`);
    });

    it("says still looking for a live look under a minute old", () => {
      const note = { ...ok(), looking: { place: "episodes", pid: 5, at: 100_000 - ASKING_MS + 1 } };
      assert.equal(setupLine(note, opts({ alive: live })), `${LEAD}the import is still looking; if a box asks whether "node" may look in a folder, choose Allow.`);
    });

    it("says asking for a live look a minute old or more", () => {
      const note = { ...ok(), looking: { place: "episodes", pid: 5, at: 100_000 - ASKING_MS } };
      assert.equal(
        setupLine(note, opts({ alive: live })),
        `${LEAD}The import has waited more than a minute to look in BRIMM Video in Dropbox. If a box on this Mac's screen asks whether "node" may look in it, choose Allow, and the import goes on.`,
      );
    });

    it("passes over a look whose process is not alive, and asks it with the pid", () => {
      const note = { ...ok(), looking: { place: "episodes", pid: 5, at: 1 } };
      assert.equal(setupLine(note, opts()), `${LEAD}node may look in the drop folder and in Dropbox.`);
      let asked;
      setupLine(note, opts({ alive: (pid) => { asked = pid; return false; } }));
      assert.equal(asked, 5);
    });

    it("checks the process with kill 0 by default, an unknown pid being not alive and this one alive", () => {
      const note = (pid) => ({ ...ok(), looking: { place: "drop", pid, at: 99_999 } });
      assert.equal(setupLine(note(2 ** 22 + 12345), { home, now: 100_000 }), `${LEAD}node may look in the drop folder and in Dropbox.`);
      assert.match(setupLine(note(process.pid), { home, now: 100_000 }), /still looking/);
    });

    it("passes over a downloads note older than a day, and says a newer one", () => {
      const down = (age) => withPlace(ok(), "downloads", { state: "refused", code: "EPERM", folder: join(home, "Downloads"), at: 100_000 + DOWNLOADS_SAY_MS - age });
      assert.equal(setupLine(down(DOWNLOADS_SAY_MS + 1), opts({ now: 100_000 + DOWNLOADS_SAY_MS })), `${LEAD}node may look in the drop folder and in Dropbox.`);
      assert.match(setupLine(down(DOWNLOADS_SAY_MS - 1), opts({ now: 100_000 + DOWNLOADS_SAY_MS })), /Downloads/);
    });

    it("says refused and locked with the chat line and the switch", () => {
      const refused = withPlace(ok(), "drop", { state: "refused", code: "EPERM" });
      assert.equal(
        setupLine(refused, opts()),
        `${LEAD}This Mac does not let the import look in ${words}, so the videos you drop wait. In System Settings, under Privacy & Security, Files and Folders, turn on its switches under each "node" listed. Then say "look again".`,
      );
      const locked = withPlace(ok(), "episodes", { state: "locked", code: "EACCES" });
      assert.equal(
        setupLine(locked, opts()),
        `${LEAD}The import cannot open BRIMM Video in Dropbox: the folder's own permissions shut it. Ask Jason. (Jason: node gets EACCES there; see Get Info, Sharing & Permissions.)`,
      );
    });

    it("says error for any place", () => {
      const note = withPlace(ok(), "episodes", { state: "error", code: "EIO" });
      assert.equal(setupLine(note, opts()), `${LEAD}The import could not look in BRIMM Video in Dropbox (EIO). Ask Jason. (Jason: see ~/Library/Logs/brimm-video.log.)`);
    });

    it("says missing for the drop folder only", () => {
      const note = withPlace(ok(), "drop", { state: "missing", code: "ENOENT" });
      assert.equal(setupLine(note, opts()), `${LEAD}Your drop folder, Drop, in your home folder, is not there now. If it is on another disk, connect the disk, then say "look again".`);
      assert.equal(setupLine(withPlace(ok(), "downloads", { ...at, state: "missing", folder: join(home, "Downloads") }), opts()), `${LEAD}node may look in the drop folder and in Dropbox.`);
    });

    it("says not looked yet for drop ok with episodes missing, and never sends episodes to the drop sentence", () => {
      const note = withPlace(ok(), "episodes", { state: "missing", code: "ENOENT" });
      assert.equal(setupLine(note, opts()), `${LEAD}the import has not looked yet.`);
    });

    it("names a place that has no noted folder by where it is now, on a first look", () => {
      const note = { version: 1, places: {}, told: {}, looking: { place: "drop", pid: 5, at: 1 } };
      assert.equal(
        setupLine(note, opts({ alive: live, places: { drop: drops() } })),
        `${LEAD}The import has waited more than a minute to look in ${words}. If a box on this Mac's screen asks whether "node" may look in it, choose Allow, and the import goes on.`,
      );
    });

    it("never names a place by an empty path", () => {
      const note = { version: 1, places: {}, told: {}, looking: { place: "drop", pid: 5, at: 1 } };
      const line = setupLine(note, opts({ alive: live }));
      assert.doesNotMatch(line, /›|in your home folder/);
      assert.match(line, /look in your drop folder\./);
    });
  });

  it("switchFor, by the folder's real path", () => {
    for (const [dir, name] of [["Desktop", "Desktop Folder"], ["Documents", "Documents Folder"], ["Downloads", "Downloads Folder"]]) {
      mkdirSync(join(home, dir, "x"), { recursive: true });
      assert.equal(switchFor(join(home, dir, "x"), home), name);
    }
    const dropbox = join(home, "Library", "CloudStorage", "Dropbox-x", "The BRIMM DB");
    mkdirSync(dropbox, { recursive: true });
    assert.equal(switchFor(dropbox, home), "the switch for Dropbox");
    rmSync(join(home, "Downloads"), { recursive: true });
    symlinkSync(dropbox, join(home, "Downloads"));
    assert.equal(switchFor(join(home, "Downloads"), home), "the switch for Dropbox");
    const icloud = join(home, "Library", "Mobile Documents", "com~apple~CloudDocs", "Drop");
    mkdirSync(icloud, { recursive: true });
    assert.equal(switchFor(icloud, home), "the switch for iCloud Drive");
    const other = join(home, "BRIMM Video Work", "Drop");
    mkdirSync(other, { recursive: true });
    assert.equal(switchFor(other, home), "its switches");
    assert.equal(switchFor("/Volumes/Backup/Drop", home), "Removable Volumes");
  });
});

describe("postIfDue and postNewNodeIfDue (A3)", () => {
  const refusedNote = (place = "drop") => ({ version: 1, places: { [place]: { state: "refused", code: "EPERM" } }, looking: null, told: {} });
  const T0 = 1_000_000;

  it("postIfDue posts for a refused place and writes told to home, so a later read finds it", () => {
    const said = [];
    const note = refusedNote();
    writeAccess(home, note);
    assert.equal(postIfDue("drop", note, { notify: (t) => said.push(t), clock: () => T0, node: NODE, placeWords: "your drop folder", home }), true);
    assert.deepEqual(said, [accessBanner("refused", "your drop folder")]);
    assert.deepEqual(readAccess(home).told.drop, { key: `refused|${NODE}`, at: T0 });
  });

  it("postIfDue does not post exactly BANNER_AGAIN_MS later, and does one ms more", () => {
    const said = [];
    const note = refusedNote();
    const opts = (at) => ({ notify: (t) => said.push(t), clock: () => at, node: NODE, placeWords: "w", home });
    assert.equal(postIfDue("drop", note, opts(T0)), true);
    assert.equal(postIfDue("drop", readAccess(home), opts(T0 + BANNER_AGAIN_MS)), false);
    assert.equal(postIfDue("drop", readAccess(home), opts(T0 + BANNER_AGAIN_MS + 1)), true);
    assert.equal(said.length, 2);
  });

  it("postIfDue with a notify that throws leaves told unwritten and does not throw", () => {
    const note = refusedNote();
    writeAccess(home, note);
    assert.equal(postIfDue("drop", note, { notify: () => { throw new Error("no notifier"); }, clock: () => T0, node: NODE, placeWords: "w", home }), false);
    assert.deepEqual(readAccess(home).told || {}, {});
    assert.equal("drop" in note.told, false);
  });

  it("postIfDue clears told[place] on an ok look, a missing one and an error", () => {
    for (const state of ["ok", "missing", "error"]) {
      const note = { version: 1, places: { drop: { state } }, looking: null, told: { drop: { key: `refused|${NODE}`, at: T0 } } };
      writeAccess(home, note);
      assert.equal(postIfDue("drop", note, { notify: () => assert.fail("no banner"), clock: () => T0, node: NODE, home }), false, state);
      assert.equal("drop" in readAccess(home).told, false, state);
    }
  });

  it("postNewNodeIfDue posts once per node when called twice on the same note", () => {
    const said = [];
    const note = { version: 1, places: { episodes: { state: "ok", okNode: NODE } }, looking: null, told: {} };
    const opts = { notify: (t) => said.push(t), clock: () => T0, node: NODE2, needs: ["episodes"], home };
    assert.equal(postNewNodeIfDue(note, opts), true);
    assert.equal(postNewNodeIfDue(note, opts), false);
    assert.equal(said.length, 1);
    assert.deepEqual(note.told.newNode, { node: NODE2, at: T0 });
    assert.deepEqual(readAccess(home).told.newNode, { node: NODE2, at: T0 });
  });
});

describe("which findings the guide and episodes say (A5)", () => {
  const F = (kind, place) => ({ kind, ...(place ? { place } : {}) });
  it("blocksDrop: asking, refused, locked and error in the drop folder or Episodes, and unseen; nothing else", () => {
    for (const kind of ["asking", "refused", "locked", "error"]) {
      assert.equal(blocksDrop(F(kind, "drop")), true, kind);
      assert.equal(blocksDrop(F(kind, "episodes")), true, kind);
      assert.equal(blocksDrop(F(kind, "downloads")), false, kind);
    }
    assert.equal(blocksDrop({ kind: "unseen", videos: ["a.mov"] }), true);
    assert.equal(blocksDrop(F("missing", "drop")), false);
    assert.equal(blocksDrop(F("newNode")), false);
  });
  it("saysInOverview: every finding but a new node and Downloads", () => {
    for (const kind of ["asking", "refused", "locked", "error", "missing"]) assert.equal(saysInOverview(F(kind, "drop")), true, kind);
    assert.equal(saysInOverview({ kind: "unseen", videos: ["a.mov"] }), true);
    assert.equal(saysInOverview(F("refused", "downloads")), false);
    assert.equal(saysInOverview(F("newNode")), false);
  });
  it("saysInEpisodes: every finding but a new node, Downloads included", () => {
    for (const kind of ["asking", "refused", "locked", "error", "missing"]) assert.equal(saysInEpisodes(F(kind, "drop")), true, kind);
    assert.equal(saysInEpisodes(F("refused", "downloads")), true);
    assert.equal(saysInEpisodes({ kind: "unseen", videos: ["a.mov"] }), true);
    assert.equal(saysInEpisodes(F("newNode")), false);
  });
});

describe("node access.js --setup-line", () => {
  const ACCESS_JS = fileURLToPath(new URL("../access.js", import.meta.url));
  const LEAD = "  Files and Folders, at the end:  ";
  const at = { state: "ok", code: "", at: 1, since: 1, node: NODE, okNode: NODE };
  const run = (note, args = ["--setup-line"]) => {
    if (note) writeAccess(home, note);
    const r = spawnSync(process.execPath, [ACCESS_JS, ...args], { env: { ...process.env, BRIMM_VIDEO_HOME: home }, encoding: "utf8" });
    return r;
  };
  const noted = (extra = {}) => ({ version: 1, looking: null, told: {}, places: { drop: { ...at, folder: join(home, "Drop") }, episodes: { ...at, folder: join(home, "Episodes") } }, ...extra });

  it("prints the ok line when both places are ok", () => {
    const r = run(noted());
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, `${LEAD}node may look in the drop folder and in Dropbox.\n`);
  });

  it("prints the refused line when episodes is refused", () => {
    const note = noted();
    note.places.episodes = { ...note.places.episodes, state: "refused", code: "EPERM" };
    const r = run(note);
    assert.match(r.stdout, /^  Files and Folders, at the end:  This Mac does not let the import look in BRIMM Video in Dropbox/);
  });

  it("prints still looking for a live pid under a minute old, and asking for an older one", () => {
    const fresh = run(noted({ looking: { place: "drop", pid: process.pid, at: Date.now() } }));
    assert.match(fresh.stdout, /the import is still looking/);
    const old = run(noted({ looking: { place: "drop", pid: process.pid, at: Date.now() - ASKING_MS - 5000 } }));
    assert.match(old.stdout, /The import has waited more than a minute/);
  });

  it("passes over a look whose pid is not alive", () => {
    const r = run(noted({ looking: { place: "drop", pid: 2 ** 22 + 12345, at: Date.now() } }));
    assert.equal(r.stdout, `${LEAD}node may look in the drop folder and in Dropbox.\n`);
  });

  it("says not looked yet when there is no note", () => {
    const r = run(null);
    assert.equal(r.stdout, `${LEAD}the import has not looked yet.\n`);
  });

  it("names the drop folder from this Mac's settings for a first look", () => {
    mkdirSync(dirname(settingsFile(home)), { recursive: true });
    const drop = join(home, "Desktop", "Drop");
    writeFileSync(settingsFile(home), JSON.stringify({ version: 1, machine: "Mac", root: join(home, "Root"), checkout: "/c", drop: "Drop", dropPath: drop }));
    const r = run({ version: 1, looking: { place: "drop", pid: process.pid, at: Date.now() - ASKING_MS - 5000 }, told: {}, places: {} });
    assert.match(r.stdout, /Desktop/);
    assert.doesNotMatch(r.stdout, /your drop folder\./);
  });

  it("prints nothing and exits 0 with another argument", () => {
    const r = run(noted(), []);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "");
  });
});
