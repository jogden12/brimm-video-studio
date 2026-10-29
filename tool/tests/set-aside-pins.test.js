// What pins the words about an older project folder being set aside and the project rebuilt (plan PR 18): the help, the README, both skills, the
// spec and the plan say it. They fail on purpose when the code, its help or its README rows change without the others, so that a change to one is a
// change to all in the same commit (architecture 6.4). The behaviour itself is edit-set-aside-app.test.js's, snapshot.test.js's and
// app-rebuilt.test.js's, and the words she reads are in the tests that run it.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HELP } from "../edit.js";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const readme = read("README.md");
const spec = read("docs/superpowers/specs/2026-10-27-brimm-video-studio-architecture.md");
const plan = read("docs/superpowers/plans/2026-10-27-brimm-video-studio-build-plan.md");
const skills = { strict: read("tool/studio/SKILL.md"), open: read("tool/studio/SKILL-open.md") };
const row = (text, start) => text.split("\n").find((line) => line.startsWith(start)) ?? "";
const section = (text, from, to) => text.slice(text.indexOf(from), text.indexOf(to));
/** HELP's usage of a command, as one line of text: the lines that start in column 40 after its head, joined. */
function usage(head) {
  const lines = HELP.split("\n");
  const at = lines.indexOf(head);
  assert.ok(at >= 0, head);
  let end = at + 1;
  while (end < lines.length && /^ {40}\S/.test(lines[end])) end++;
  const block = lines.slice(at + 1, end);
  assert.ok(block.length >= 5 && block.every((line) => line.length <= 122), block.join("\n"));
  return block.map((line) => line.trim()).join(" ");
}

describe("what pins the words about an older project being set aside (plan PR 18)", () => {
  it("has the help say that a project the other Mac worked on since is set aside, nothing deleted, and rebuilt, with its video kept when it fits and HyperFrames quit, for the main video and a Reel, from column 40", () => {
    const main = usage('  node edit.js app "<episode>" [--take-over]');
    for (const words of [
      "A project the other Mac made is rebuilt here from the snapshot it handed over, and its video made again",
      "One it has not handed over is refused.",
      "A project here that the other Mac has worked on since, which its marker and the newest snapshot show, is set aside with nothing deleted and rebuilt in its place from that snapshot, its video kept when it fits; HyperFrames must be quit, which is asked before anything is claimed.",
      "Only on a Mac that Jason has set up for HyperFrames"
    ]) assert.ok(main.includes(words), words);
    const reel = usage('  node edit.js app "<episode>" reel <n> [--take-over]');
    for (const words of ["A Reel project the other Mac made is rebuilt from its snapshot, as above, and one here that the other Mac has worked on since is set aside and rebuilt, as above.", "For a finished video too."]) assert.ok(reel.includes(words), words);
  });
  it("says in the README's row of app what is decided before the claim, what is set aside and where, in what order she is told, what happens to the video, what a failure leaves, and what is not set aside", () => {
    const app = row(readme, '| `app "<episode>" [--take-over]`');
    for (const words of [
      // What is refused before the claim.
      "Before it claims anything it refuses, in words, a project whose folder is a session clip's on the volume",
      "a project of this Mac's with no marker that is older than the newest snapshot by the times of its files (below)",
      "and, for a project whose marker says it is older (below), HyperFrames being open, or not to be told to be closed.",
      // The rule, whose it is, and what makes a project older.
      "**A project here that is older than the newest snapshot is set aside, and the project rebuilt from the snapshot in its place** (plan PR 18; Jason, 2026-10-29: \"have Studio move the older folder aside itself, deleting nothing, and rebuild from the newer snapshot\")",
      "when its marker (`.brimm-snapshot.json`) names a snapshot the record lists that is not the newest, or one the record lists no more that was named before every one it lists (the record keeps the two newest)",
      "A marker for a snapshot the record never listed, or that was named after one it lists, may be newer work (Dropbox can undo the record of a hand-over this Mac made, and the snapshot's files stay), so such a project is refused, as a project with no marker is (below).",
      // HyperFrames.
      "HyperFrames must be quit, since a project the app holds open must not be moved from under it: it is asked before the episode is claimed, in `release`'s and `free`'s words",
      "\"Quit HyperFrames first, so that the older project can be set aside, then say it again. Nothing was changed.\"",
      "\"I can't tell whether HyperFrames is open. Quit it if it is, then say it again. Nothing was changed.\"",
      "so that a refusal claims nothing, brings nothing, asks for no video and leaves the record, its claim and both folders as they were; it is asked again where the folder is moved",
      // The second look, once the episode is claimed: the review of PR 18, F5.
      "\"Quit HyperFrames first, so that the older project can be set aside, then say it again. The older project was left where it was.\"",
      "\"I can't tell whether HyperFrames is open. Quit it if it is, then say it again. The older project was left where it was.\"",
      // A recording that has changed is looked at before anything is moved: F3.
      "The recording must still be the one the project was made from, which is looked at before HyperFrames is asked about again (quitting it would not help) and before anything is moved",
      "\"The recording of <name> has changed since its HyperFrames project was made, so the older project was left where it was. Ask Jason.\"",
      // The order and the place.
      "the new project is built beside the older folder, whole or not at all; the older folder is moved, whole and as it is, by one rename (which copies and deletes nothing) into `set aside/<project name> <moment>/` in the episode's own folder in `~/BRIMM Video Work`, a folder that no command takes for a project",
      "the new project is renamed into the place the older one had. If that last rename fails the older folder is renamed back; the one thing removed is the project Studio had just built",
      // What she is told, in order.
      "\"The older HyperFrames project for <name> was set aside on this Mac, and nothing was deleted. Any changes made on this Mac that were not handed over are in the older project: ask Jason if you need them.\", the line that the project is rebuilt (above), the lines about the assets (below), and the video's.",
      // The older folder's own assets that were too big to hand over: F1.
      "**The older folder's own assets** that were too big to hand over come into the rebuilt project",
      "When the older folder's own `assets/` (the brand kit apart) weigh more than that, each of those files the rebuilt project lacks is moved into it by rename, once the project is in its place",
      "writing over nothing the snapshot brought: a file the other Mac put at the same path stays the other Mac's",
      "\"Assets of the older project (pictures, music and video) that were too big to hand over were kept, and they are in the project: 2 files.\"",
      "\"Assets of the older project (pictures, music and video) could not be moved into the project: 1 file. They are in the older project, set aside on this Mac. Ask Jason.\"",
      "\"The rest of its assets (pictures, music and video) were too big to hand over, so they are not in it.\" in place of the one it always had",
      "When the older folder's assets weigh 50 MB or less they were handed over, and a file the other Mac removed is not brought back.",
      // The video.
      "**The video** of the older folder is moved into the rebuilt project, not copied and not made again, when it passes the check every video put into a project passes",
      "the facts of the working copy are beside the others in the folder of copies and give the project's picture size and its length to a second, and the file is a plain file as large as they say",
      "\"The video for <name> was kept from the older project, and it is in the project.\"",
      "Otherwise it stays in the set-aside folder and the video is asked for as for any rebuilt project.",
      // What a failure leaves.
      "\"The snapshot of the HyperFrames project for <name> is not whole on this Mac, so the older project was left where it was. Ask Jason.\"",
      "\"The HyperFrames project for <name> could not be rebuilt on this Mac, so the older project was left where it was. Ask Jason.\"",
      "\"The older HyperFrames project for <name> was set aside on this Mac and nothing was deleted, but the rebuilt one could not be put in its place. Ask Jason.\"",
      "or `set aside` is a link or a file (a move into a link would follow it out of the episode's work folder, into Dropbox perhaps), the older folder stays where it was:",
      // What is not set aside, and what takes no notice of it.
      "**A project with no marker is not set aside**, whatever the times of its files say (a clock that is behind, a file dated in the future or a file only deleted fool them)",
      "\"The HyperFrames project for <name> on this Mac is older than the one the other Mac handed over, so it isn't opened. Ask Jason.\"",
      "`release` of an older folder is still refused (below).",
      "`free`, the guide, `episodes` and `status` find a project by its name in the record, and `plainName` refuses the folder's name to a record",
      "Nothing takes one away; Jason deletes one by hand when he is sure it is not wanted.",
      // How to get something back from one, and that it is not always small: F7.
      "To get something back from one, with HyperFrames quit, copy what is needed from the set-aside folder into the project in its place; renaming the folder back only sets it aside again, since its marker names an older snapshot.",
      "A set-aside folder keeps the older project's renders, history and caches, and its video when that was not kept, so it is not always small, and `free` takes none of it."
    ]) assert.ok(app.includes(words), words);
    assert.doesNotMatch(app, /\(setting it aside is Jason's call\)/);
  });
  it("says in the README's row of app … reel that a Reel project is set aside and rebuilt the same way, with the Reel's own start checked, and that one with no marker is refused", () => {
    const reel = row(readme, '| `app "<episode>" reel <n> [--take-over]`');
    for (const words of [
      "and one here whose marker says it is older than the newest snapshot is set aside and rebuilt in its place, as the main project is (see `app`), with HyperFrames quit",
      "its video kept when it passes the same check and starts where the project's `brimm/facts.json` says the Reel starts (to half a second), and otherwise asked for again",
      "one with no marker, older by the times of its files, is refused as it was"
    ]) assert.ok(reel.includes(words), words);
    assert.ok(!reel.includes("one here that is older than the newest snapshot is not opened"), "the refusal it was");
  });
  it("says in the README's paragraphs on handing a project over and on the claim that release leaves an older folder alone and app sets it aside", () => {
    const handing = row(readme, "**Handing a HyperFrames project over**");
    for (const words of [
      "a Mac that comes back to an episode after the other Mac worked on it holds an older folder (its marker names another snapshot than the newest): `release` leaves it alone and says so (\"… isn't handed over again. Nothing was handed over. Ask Jason.\")",
      "and `app` (and `app … reel <n>`) sets it aside, with HyperFrames quit and nothing deleted, and rebuilds the project from the newest snapshot in its place, keeping its video when it fits (see `app`; plan PR 18)",
      "`open` is unchanged"
    ]) assert.ok(handing.includes(words), words);
    assert.ok(!handing.includes("setting it aside is Jason's call"));
    const claim = row(readme, "**The claim.**");
    assert.ok(claim.includes("Once it has the claim and the files, `app` also sets an older project folder of this Mac's aside and rebuilds the project in its place, with HyperFrames quit (see `app`)."), "the claim's paragraph");
  });
  it("has both skills tell her what to say of a project set aside, of HyperFrames to be quit first and of an older project that is refused, in the same row, and offer the same for a Reel", () => {
    const OPEN_HER = '| "Open the Pricing episode in HyperFrames" / "Open it in HyperFrames" |';
    const REEL = '| "Make Reel 2" / "Open Reel 2 in HyperFrames" |';
    for (const [which, skill] of Object.entries(skills)) {
      const app = row(skill, OPEN_HER);
      for (const words of [
        "if it then says its video is being made, tell her so, and when \"how far is it?\" says it is done, run it again.",
        "If it says the older project was set aside, tell her so, and that nothing was deleted: the project is now the newest one that was handed over, and any changes made on this Mac that were not handed over are in the older project (she asks Jason if she needs them).",
        "If it says assets of the older project were kept, tell her so; if it says some could not be moved, tell her they are in the older project and to ask Jason.",
        "If it says to quit HyperFrames first, tell her so, and run `app \"<episode>\"` again when she has.",
        "If it says the recording has changed and the older project was left where it was, tell her so, and to ask Jason.",
        "If it says the project here is older than the one the other Mac handed over, tell her so, and that nothing was changed, and to ask Jason. |"
      ]) assert.ok(app.includes(words), `${which}: ${words}`);
      assert.ok(!app.includes("its video is then made again in the background"), `${which}: the video is made again only when it says so`);
      const reel = row(skill, REEL);
      assert.ok(reel.includes('If it says the older project was set aside, or to quit HyperFrames first, go on as for "Open the Pricing episode in HyperFrames", with `app "<episode>" reel 2`; when it says the video was kept from the older project, there is nothing to wait for.'), `${which}: the Reel's row`);
      assert.ok(reel.endsWith("never offer to make one here |"), `${which}: the Reel's row ends as it did`);
      assert.ok(skill.split("\n").length < 160, `${which}: ${skill.split("\n").length} lines`);
    }
    assert.equal(row(skills.open, OPEN_HER), row(skills.strict, OPEN_HER), "the two skills have one row for opening in HyperFrames");
    assert.equal(row(skills.open, REEL), row(skills.strict, REEL), "and one row for a Reel");
    const handoff = (skill) => {
      const at = skill.indexOf("## In HyperFrames, to hand it off");
      assert.ok(at >= 0, "the skill has the section");
      const next = skill.indexOf("\n## ", at + 1);
      return skill.slice(at, next < 0 ? undefined : next);
    };
    assert.equal(handoff(skills.open), handoff(skills.strict), "the hand-off sections of the two skills are the same");
    assert.ok(handoff(skills.strict).includes("On screen in the main video I found"));
    // `release` is as it was: an older folder is still refused, and she is told to ask Jason.
    for (const skill of Object.values(skills)) assert.ok(skill.includes("or is older than the one the other Mac handed over, tell her so in plain words and that nothing was handed over, and to ask Jason."));
  });
  it("says in the spec, at 4.7, 5.1, 5.6, 7.3, 7.4 and 3.2, that an older project is set aside and rebuilt, how, with what, and what is not", () => {
    const two = section(spec, "### 3.2 Where things live", "### 3.3 ");
    assert.ok(two.includes("and an older project's folder, set aside whole, in `set aside/` there (4.7)"), "3.2");
    const four = section(spec, "### 4.7 Two Macs", "### 4.8 ");
    for (const words of [
      "A project here that is older than the newest snapshot, because the other Mac worked on it since (its marker names another snapshot, 7.3), is not handed over again (`release` says so), and it is not gone on from: when this Mac comes back to the episode, `app` sets the older folder aside and rebuilds the project in its place from the newest snapshot (plan PR 18; Jason, 2026-10-29",
      "HyperFrames must be quit first, since a project the app holds open must not be moved from under it.",
      "The new project is built beside the older folder; the older folder is then moved, whole and as it is, by one rename (which copies and deletes nothing) into `set aside/<project name> <moment>/` in the episode's own work folder, a folder no command takes for a project; and the new project is renamed into the place the older one had, or the older folder is put back.",
      "Its video moves into the rebuilt project, and is not made again, when it passes the checks every working copy does (5.6).",
      "So do the older folder's own assets that were too big to hand over: a snapshot leaves out all of a project's `assets/` but the brand kit when they weigh more than 50 MB",
      "each such file it lacks is moved into it by rename once it is in its place, never over a path the snapshot brought (5.6)",
      "The recording must be the one the project was made from: that is looked at before anything is moved, so the older project stays where it was and is not set aside to be refused after.",
      "A set-aside folder that is a link or a file is not moved into, since a rename through a link would follow it out of the work folder.",
      "A project with no marker is not set aside, whatever the times of its files say: it is refused as it was. Nothing deletes a set-aside folder; Jason does, by hand, when he is sure."
    ]) assert.ok(four.includes(words), `${words} in 4.7`);
    assert.ok(!four.includes("is not built; Jason moves it away by hand"), "4.7 no longer says it is not built");
    const layout = section(spec, "### 5.1 Layout", "### 5.2 ");
    assert.ok(layout.includes('set aside/                            older project folders set aside whole, one per return (4.7): "<project name> <moment>"'), "5.1");
    const opening = section(spec, "### 5.6 Opening the app", "### 5.7 ");
    for (const words of [
      "| The project is here, and its marker names a snapshot the record lists that is not the newest, or one it lists no more that was named before every one it lists: the other Mac worked on it since |",
      "\"Quit HyperFrames first, so that the older project can be set aside, then say it again. Nothing was changed.\" while it is open",
      "\"I can't tell whether HyperFrames is open. Quit it if it is, then say it again. Nothing was changed.\" when that cannot be told",
      "HyperFrames is asked about again where the folder is moved (the claim waits, and the record it leaves may list a newer snapshot)",
      "\"The older HyperFrames project for `<name>` was set aside on this Mac, and nothing was deleted. Any changes made on this Mac that were not handed over are in the older project: ask Jason if you need them.\"",
      "\"Quit HyperFrames first, so that the older project can be set aside, then say it again. The older project was left where it was.\" or \"I can't tell whether HyperFrames is open. Quit it if it is, then say it again. The older project was left where it was.\"",
      "| ... and the recording has changed since the project was made | Looked at before HyperFrames is asked about again and before anything is moved: \"The recording of `<name>` has changed since its HyperFrames project was made, so the older project was left where it was. Ask Jason.\"",
      "| ... and the older folder's own `assets/` (the brand kit apart) weigh more than 50 MB, so a snapshot of it left them out | Once the rebuilt project is in its place each of those files it lacks is renamed into it from the set-aside folder, never over a path it has:",
      "\"Assets of the older project (pictures, music and video) that were too big to hand over were kept, and they are in the project: 2 files.\"",
      "\"Assets of the older project (pictures, music and video) could not be moved into the project: 1 file. They are in the older project, set aside on this Mac. Ask Jason.\"",
      "\"The rest of its assets (pictures, music and video) were too big to hand over, so they are not in it.\"",
      "When the snapshot is not whole here, a write fails, or `set aside` is a link or a file, the older folder stays where it was:",
      "\"The snapshot of the HyperFrames project for `<name>` is not whole on this Mac, so the older project was left where it was. Ask Jason.\"",
      "\"The HyperFrames project for `<name>` could not be rebuilt on this Mac, so the older project was left where it was. Ask Jason.\"",
      "\"The older HyperFrames project for `<name>` was set aside on this Mac and nothing was deleted, but the rebuilt one could not be put in its place. Ask Jason.\"",
      "| ... and the older folder's video passes the checks of any working copy |",
      "\"The video for `<name>` was kept from the older project, and it is in the project.\"",
      "| ... and it does not | It stays in the set-aside folder, and the video is asked for as for any rebuilt project",
      "| The project is here, and has no marker (or its marker names a snapshot the record never listed, or one named after a snapshot it lists, which may be newer work), and its newest file is more than 2 seconds older than the snapshot's (or, with such a marker, whatever its files' times) |",
      "It is not set aside: those times are fooled by a clock that is behind, a file dated in the future and a file only deleted."
    ]) assert.ok(opening.includes(words), `${words} in 5.6`);
    const snapshot = section(spec, "### 7.3 The snapshot", "### 7.4 ");
    assert.ok(snapshot.includes("`release` does not hand it over again, and `app` sets its folder aside and rebuilds the project from the newest snapshot in its place (4.7, 5.6). A marker for a snapshot the record lists that is not the newest, or one it lists no more that was named before every one it lists (it keeps the two newest), is older; one that names a snapshot the record never listed, or one named after a snapshot it lists, may be newer work (Dropbox can undo the record of a hand-over this Mac made, and the snapshot's files stay), and is refused and not set aside. A project with no marker, made here and never handed over, is judged by the times of its files, its newest file more than 2 seconds older than the snapshot's, and is refused and not set aside, since those times can be fooled."), "7.3");
    const retention = section(spec, "### 7.4 Retention", "- Nobody runs the command line's `clean`");
    assert.ok(retention.includes("A folder set aside for an older project (4.7) stays where it is, whole, until Jason deletes it by hand: `free` names its paths from the record and finds none by a listing, a set-aside folder is not in the record"), "7.4");
    // F7: it is not always small, `free` takes none of it, and how to get something back from one.
    assert.ok(retention.includes("it keeps the older project's renders, history and caches, and its video when that was not kept, so a set-aside folder is not always small, and `free` takes none of it."), "7.4: not always small");
    assert.ok(retention.includes("To get something back from one, with HyperFrames quit, copy what is needed into the project in its place; renaming the folder back only sets it aside again, since its marker names an older snapshot."), "7.4: getting something back");
    assert.ok(!retention.includes("so a set-aside folder is small in the usual case"), "7.4 no longer says it is small");
  });
  it("says in the spec's Status line that PR 17 (#20) is merged and that main is 840e0fc", () => {
    const status = spec.split("\n").find((line) => line.startsWith("- **Status:**")) ?? "";
    assert.ok(status.includes("PR 16 (#19, the guide's \"hand off the Reels\") and PR 17 (#20, the reviews' leftovers) are merged"), status);
    assert.ok(status.includes("main is 840e0fc."), status);
    assert.ok(!status.includes("0c042c6"), "the old commit");
  });
  it("says in the plan that PR 18 is a row of the order and has its block, and that PR 11's open item is done", () => {
    assert.ok(plan.includes("| 18 | An older project folder is set aside, and the project rebuilt from the newer snapshot (PR 11's open item, on Jason's yes of 2026-10-29) | 11, 15 | No |"), "the order's row");
    assert.ok(plan.includes("## PR 18. An older project folder is set aside, and the project rebuilt from the newer snapshot (PR 11's open item)"), "the block");
    assert.ok(plan.indexOf("## PR 18.") > plan.indexOf("## PR 17.") && plan.indexOf("## PR 18.") < plan.indexOf("## PR 15."), "after PR 17's block");
    assert.ok(plan.includes("9. An older project folder is set aside only on its marker's word"), "the review focus's item");
    const open = section(plan, "**Open items this leaves** (for the pull request to say):", "## PR 7 to PR 15, in outline");
    assert.ok(open.includes("**Done by PR 18** (Jason said yes on 2026-10-29): `app` and `app … reel N` set the older folder aside, with HyperFrames quit and nothing deleted"), "PR 11's first open item");
    assert.ok(plan.includes("setting an older folder aside automatically (Jason's call: done by PR 18, on his yes of 2026-10-29)."), "PR 11's deferred item");
    // The block's rulings are the ones the code keeps.
    for (const words of ["**A project with no marker is still refused, not set aside.**", "**The video moves with the project when it passes the checks `app` already makes, and is made again when it does not.**", "**`release` of an older folder keeps refusing,**", "**`free` leaves a set-aside folder alone.**", "**HyperFrames must be quit,**"]) assert.ok(plan.includes(words), words);
  });
});
