// The move script of the "Move to Studio" app (tool/move-app/move.zsh): it moves Sallie's laptop or Jason's MacBook from brimm-video
// to Studio, or sets up fresh, as Jason's MacBook, a Mac with no brimm-video, one asked step at a time. Every test runs it in a home folder made for the test, with stand-ins for ssh-keygen, ssh, claude, launchctl,
// brew, open, pbcopy, caffeinate, sw_vers, df and xcode-select first on its PATH, each writing `name args` into a `ran` file, so that
// no test runs the program of the Mac it runs on. The "GitHub" it clones from is a local repository made with real git.
// The environment is built from scratch (never process.env spread in), so that nothing of this test run, such as the variables
// `node --test` sets, reaches a node that the script starts.
// The tests need a Mac (zsh and plutil). Anywhere else they skip themselves and say why.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MOVE,
  notAMac,
  STOPPED_NOTHING,
  PRINT_LINES,
  printText,
  DEFAULT_PRINT,
  put,
  FAKE_STUDIO_SETTINGS_JS,
  dirsToClean,
  moveOn,
  NOT_INSTALLED,
  installCalls,
  rootOf,
  suggested,
  count,
  DROP_QUESTION,
  EXPORTS_QUESTION,
  sourced
} from "./move-app-harness.js";

describe("the move script, step 5's two questions, the chooser and the installer's options (3 of 3: the installer's print and the chooser's ways)", { skip: notAMac }, () => {
  // The installer's options for Sallie's laptop: --drop-folder unless it is kept (drop === ""), --exports-folder when given.
  const optionsOf = (home, drop = suggested(home), exports = "") => `--machine Sallie's laptop${drop ? ` --drop-folder ${drop}` : ""}${exports ? ` --exports-folder ${exports}` : ""} --import light --handoff 2`;
  const printed = (r, drop, exports) => `install.sh --print ${optionsOf(r.home, drop, exports)} ${rootOf(r.home)}`;
  const real = (r, drop, exports) => `install.sh --yes ${optionsOf(r.home, drop, exports)} ${rootOf(r.home)}`;



  describe("the installer's print: a refused pick, the cloud question, the privacy notes", () => {
    const WARN = "Warning: this drop folder is in Dropbox. Every video dropped there goes up to that cloud, a client or group session's recording too. A video still syncing there can be imported late, or twice. A folder on this Mac is safer.";
    const WARN_DESKTOP = "Warning: this drop folder is in iCloud Drive, if it keeps Desktop & Documents. If it does, every video dropped there goes up to it, a client or group session's recording too. A video still syncing there can be imported late, or twice. A folder on this Mac is safer.";
    const CLOUD_PROMPT = "Type y and press Return to use it anyway, or c and press Return to choose another. Anything else stops:";
    const C_ONLY = "Type c and press Return to choose another folder. Anything else stops:";
    const HOLDS = "Not written: the drop folder holds a video already, which would be imported as soon as the folder is watched. Pick a new, empty folder instead, or take the video out first.";
    const COULD_NOT_READ = "Not written: the drop folder could not be read (EACCES), so what it holds is not known. Make it readable (in System Settings, under Privacy & Security, Files and Folders, allow the app this runs in, if it was refused).";
    const ZOOM = "Not written: the exports folder cannot be Zoom's recordings, or inside it.";
    const SECOND = "The exports folder is /Users/x/Downloads, kept from before: name another with --exports-folder.";
    const NESTED = "Not written: the drop folder cannot be the exports folder, or inside it, or hold it.";
    const OLD_FOLDER = "Not written: the drop folder would change from Drop › Sallie's laptop to BRIMM Video Work › Drop, because 2 videos wait in it.";
    const DOWNLOADS_LINE = "Studio looks in Downloads for exports, whatever is picked. macOS may ask once whether Claude Code may access files in your Downloads folder, the first time the chat on this Mac hands off a video and looks for its export. About 15 minutes after each hand-off, once the export's copies in Dropbox are checked, Studio's background job deletes the export from Downloads, and macOS may ask once whether node may. Choose Allow each time. If node was refused, allow it in System Settings › Privacy & Security › Files and Folders. Until then, exports stay in Downloads, to be deleted by hand.";
    const dropLine = (folder) => `macOS may also ask whether node may read ${folder}, at the first import, and whether Claude Code may, the first time the chat on this Mac looks there ("what's waiting?"). Choose Allow each time. A Don't Allow is undone in System Settings › Privacy & Security › Files and Folders, under that name. macOS may ask node again after Homebrew updates it, and until someone clicks Allow, Studio sees no video dropped there.`;
    const exportsLine = (folder) => `macOS may ask whether Claude Code may look in ${folder}, at the first hand-off. Choose Allow.`;
    const DROP_MAY_ASK = "macOS may also ask whether node may read";
    const EXPORTS_MAY_ASK = "macOS may ask whether Claude Code may look in";
    const refusal = (...lines) => lines.join("\n") + "\n";
    const prints = (...texts) => ({ print: texts, printExit: texts.map((t) => (/^(Not written:|The folder |A folder is for)/.test(t) || t === "stop" ? 2 : 0)) });
    const FRESH_MAC = { settings: null, key: "brimm-video-studio read-only, Jason's MacBook", marks: NOT_INSTALLED };

    describe("refused_pick, sourced", () => {
      const read = (text) => {
        const r = sourced('refused_pick "$TEXT"; print -r -- "[$REFUSED] [$FAULT_KIND] [$FAULT_WORDS] [$FAULT_REASON]"', { env: { TEXT: text } });
        assert.equal(r.status, 0, r.out + r.err);
        assert.equal(r.err, "");
        return r.out.trimEnd();
      };
      const cases = [
        // [the first line of the print, REFUSED, FAULT_KIND]
        ["Not written: the exports folder cannot be Episodes, or inside it.", "exports", "installer"],
        ["Not written: the exports folder cannot be BRIMM VIDEO Transfer, or inside it.", "exports", "installer"],
        ["Not written: the exports folder cannot be a drop folder, and Sallie's laptop has marked /x/Drop as its own (a mark made on 3 November).", "exports", "installer"],
        ["Not written: the exports folder cannot be inside a drop folder, and Sallie's laptop has marked /x/Drop, which holds it, as its own (a mark).", "exports", "installer"],
        ["Not written: the exports folder must be named by a whole path with no . or .. in it.", "exports", "installer"],
        [NESTED, "nested", "installer"],
        [HOLDS, "drop", "not-empty"],
        ["Not written: the drop folder holds 3 videos already, which would be imported as soon as the folder is watched. Pick a new, empty folder instead, or take the videos out first.", "drop", "not-empty"],
        [COULD_NOT_READ, "drop", "cannot-look"],
        ["Not written: the drop folder cannot be BRIMM VIDEO Transfer, or inside it, or hold it.", "drop", "installer"],
        ["Not written: the drop folder cannot be BRIMM VIDEO MacBook, or inside it, or hold it.", "drop", "installer"],
        ["Not written: the drop folder must be named by a whole path with no . or .. in it.", "drop", "installer"],
        ["Not written: the folder that is to hold the drop folder is not there.", "drop", "installer"],
        ["The folder /x/Drop is watched by Sallie's laptop already. A drop folder is watched by one Mac only.", "drop", "installer"],
        ["A folder is for transcripts or for unedited video, and not for both: /x is watched for transcripts already, by com.thebrimm.transcribe. Take it off the transcript tool's list first, or name another folder.", "drop", "installer"]
      ];
      for (const [line, refused, kind] of cases) {
        it(`${refused}, ${kind}: ${line.slice(0, 60)}`, () => {
          const reason = line.replace(/^Not written: /, "").replace(/\.$/, "");
          assert.equal(read(line + "\n"), `[${refused}] [${kind}] [${line}] [${reason}]`);
        });
      }
      it("a stop gives nothing: the old folder's line, this Mac's drop folder, any other line, no line", () => {
        for (const text of ["The folder for --machine is BRIMM Video, where Dropbox keeps it, and this is not: /x/y\n", OLD_FOLDER + "\n", "Not written: this Mac's drop folder is /x, on this Mac. To go back to a drop folder in Dropbox, give --switch-back as well.\n", "Something else entirely.\n", "", "Not written: name the drop folder by --drop-folder or by --drop, not both.\n"]) {
          assert.equal(read(text), "[] [] [] []", text);
        }
      });
      it("reads the first refusal line only: the exports one's second line is never said, and node's stderr before it is passed over", () => {
        assert.equal(read(refusal(ZOOM, SECOND)), `[exports] [installer] [${ZOOM}] [the exports folder cannot be Zoom's recordings, or inside it]`);
        const withNoise = read(refusal("(node:123) ExperimentalWarning: something", "  Its drop folder:  /x", ZOOM, SECOND));
        assert.equal(withNoise, `[exports] [installer] [${ZOOM}] [the exports folder cannot be Zoom's recordings, or inside it]`);
        // The first refusal line decides, though a later one is another kind.
        assert.match(read(refusal(HOLDS, ZOOM)), /^\[drop\] \[not-empty\]/);
      });
    });

    describe("cloud_warning and studio_says, sourced", () => {
      it("cloud_warning gives the first Warning line of a drop folder in a cloud, or nothing", () => {
        const text = ["  Its drop folder, on this Mac:  /x", WARN, "  Files and Folders:  macOS may ask", "Done.", WARN_DESKTOP].join("\n");
        const r = sourced('cloud_warning "$TEXT"; print -r -- "--"; cloud_warning "$NONE"', { env: { TEXT: text, NONE: "  Its drop folder, on this Mac:  /x\nWarning: something else\n" } });
        assert.equal(r.out, `${WARN}\n--\n`);
        const desktop = sourced('cloud_warning "$TEXT"', { env: { TEXT: `x\n${WARN_DESKTOP}\n${WARN}\n` } });
        assert.equal(desktop.out, `${WARN_DESKTOP}\n`);
      });

      it("studio_says gives Studio's answer through node, and nothing on a failure, with node's errors kept off the screen", () => {
        const dir = realpathSync(mkdtempSync(join(tmpdir(), "brimm-says-")));
        dirsToClean.add(dir);
        put(join(dir, "good", "tool", "settings.js"), FAKE_STUDIO_SETTINGS_JS);
        put(join(dir, "broken", "tool", "settings.js"), 'throw new Error("not today");\n');
        const script = 'NODE="$NODE_BIN"; STUDIO="$GOOD"; '
          + 'print -r -- "[$(studio_says cloudFolder "$HOME/Dropbox/Videos")] [$(studio_says cloudFolder "$HOME/Videos")] [$(studio_says needsFilesAccess "$HOME/Desktop/x")] [$(studio_says needsFilesAccess "$HOME/Videos")]"; '
          + 'STUDIO="$BROKEN"; print -r -- "[$(studio_says cloudFolder "$HOME/Dropbox/Videos")] [$(studio_says needsFilesAccess "$HOME/Desktop/x")]"; '
          + 'NODE=""; print -r -- "[$(studio_says cloudFolder "$HOME/Dropbox/Videos")]"';
        const r = sourced(script, { env: { GOOD: join(dir, "good"), BROKEN: join(dir, "broken") } });
        assert.equal(r.status, 0, r.err);
        assert.equal(r.out, "[Dropbox] [] [yes] [no]\n[] []\n[]\n");
        assert.equal(r.err, "");
      });
    });

    describe("a refused pick, whole runs", () => {
      it("a refusal naming the drop folder asks the drop question again, and prints again with the new pick", () => {
        // y gave the suggested folder, so the next ask is c alone; the second print is of the new pick.
        const r = moveOn({ marks: NOT_INSTALLED, install: prints(refusal(HOLDS), DEFAULT_PRINT), picks: ["<HOME>/Other"], answers: "y\ny\nc\ny\n\n" });
        assert.equal(r.status, 0, r.out);
        assert.deepEqual(installCalls(r), [printed(r), printed(r, `${r.home}/Other`), real(r, `${r.home}/Other`)]);
        assert.equal(count(r.out, HOLDS), 1, "the refusal is said once");
        assert.equal(count(r.out, DROP_QUESTION[0]), 1, "y would give the refused folder again, so only c is offered");
        assert.ok(r.out.indexOf(HOLDS) < r.out.indexOf(C_ONLY) && r.out.indexOf(C_ONLY) < r.out.indexOf("Picked: Other"), r.out);

        // A pick the installer refuses is asked with the whole question, as y gives another folder.
        const picked = moveOn({ marks: NOT_INSTALLED, install: prints(refusal(HOLDS), DEFAULT_PRINT), picks: ["<HOME>/Chosen"], answers: "c\ny\ny\ny\n\n" });
        assert.equal(picked.status, 0, picked.out);
        assert.deepEqual(installCalls(picked), [printed(picked, `${picked.home}/Chosen`), printed(picked), real(picked)]);
        assert.equal(count(picked.out, DROP_QUESTION[0]), 2, "asked again whole: y gives the suggested folder");
        assert.ok(!picked.out.includes(C_ONLY));

        // Another line that means the drop folder: asked again the same way. And "could not be read" keeps its y.
        const unread = moveOn({ marks: NOT_INSTALLED, install: prints(refusal(COULD_NOT_READ), DEFAULT_PRINT), answers: "y\ny\ny\ny\n\n" });
        assert.equal(unread.status, 0, unread.out);
        assert.deepEqual(installCalls(unread), [printed(unread), printed(unread), real(unread)]);
        assert.equal(count(unread.out, DROP_QUESTION[0]), 2, "the question comes again with its y");
        assert.ok(!unread.out.includes(C_ONLY));
      });

      it("a chooser pick that is the settings' own drop folder is kept, and not held to being empty", () => {
        const r = moveOn({ marks: NOT_INSTALLED, settingsChange: { dropPath: "<HOME>/My Drop" }, folderFiles: { "<HOME>/My Drop": ["a.mov"] }, picks: ["<HOME>/My Drop"], answers: "c\ny\ny\n\n" });
        assert.equal(r.status, 0, r.out);
        assert.ok(!/holds \d+ files? or folders?/.test(r.out) && !r.out.includes(C_ONLY), r.out);
        assert.deepEqual(installCalls(r), [printed(r, ""), real(r, "")]);
      });

      it("a refused pick that is the folder y gives, when Terminal cannot look in it, keeps its y", () => {
        const r = moveOn({ marks: "tests=SHA\ndrop=<HOME>/Locked\n", folderFiles: { "<HOME>/Locked": [] }, folderModes: { "<HOME>/Locked": 0o000 }, picks: ["<HOME>/Locked"], answers: "c\nn\n" });
        assert.equal(r.status, 1, r.out);
        assert.equal(count(r.out, "Last time, this folder was picked: Locked, in your home folder."), 2, "the question comes again whole, with its y");
        assert.ok(!r.out.includes(C_ONLY), r.out);
      });

      it("an installer refusal, then a chooser that cannot be shown: 'Empty it in Finder' for a video held, the Tell Jason words for any other", () => {
        const held = moveOn({ marks: NOT_INSTALLED, install: prints(refusal(HOLDS)), picks: ["fail"], program: ["two"], answers: "y\ny\nc\n" });
        assert.equal(held.status, 1, held.out);
        assert.ok(held.out.includes("The window to choose a folder could not be shown, and BRIMM Video Work › Drop, in your home folder is not empty. Empty it in Finder, or tell Jason, then double-click Move to Studio again."), held.out);
        const other = moveOn({ marks: NOT_INSTALLED, install: prints(refusal("Not written: the drop folder cannot be BRIMM VIDEO Transfer, or inside it, or hold it.")), picks: ["fail"], program: ["two"], answers: "y\ny\nc\n" });
        assert.equal(other.status, 1, other.out);
        assert.ok(other.out.includes("The window to choose a folder could not be shown, and BRIMM Video Work › Drop, in your home folder can't be used: the drop folder cannot be BRIMM VIDEO Transfer, or inside it, or hold it. Tell Jason, then double-click Move to Studio again."), other.out);
        assert.ok(!other.out.includes("Empty it in Finder"));
      });

      it("a refusal naming the exports folder asks the exports question again, and never says the second line", () => {
        const r = moveOn({ marks: NOT_INSTALLED, install: prints(refusal(ZOOM, SECOND), DEFAULT_PRINT), picks: ["<HOME>/Exports"], answers: "y\nc\ny\ny\n\n" });
        assert.equal(r.status, 0, r.out);
        assert.deepEqual(installCalls(r), [printed(r, undefined, `${r.home}/Exports`), printed(r), real(r)]);
        assert.equal(count(r.out, EXPORTS_QUESTION[0]), 2);
        assert.equal(count(r.out, DROP_QUESTION[0]), 1, "the drop question is not asked again");
        assert.ok(r.out.includes(ZOOM) && !r.out.includes(SECOND) && !r.log.includes(SECOND), r.out);
        assert.ok(r.out.indexOf(ZOOM) > r.out.indexOf("Picked: Exports") && r.out.indexOf(ZOOM) < r.out.lastIndexOf(EXPORTS_QUESTION[0]), r.out);

        // Downloads refused, y would give it again: c alone.
        const same = moveOn({ marks: NOT_INSTALLED, install: prints(refusal(ZOOM), DEFAULT_PRINT), picks: ["<HOME>/Exports"], answers: "y\ny\nc\ny\n\n" });
        assert.equal(same.status, 0, same.out);
        assert.deepEqual(installCalls(same), [printed(same), printed(same, undefined, `${same.home}/Exports`), real(same, undefined, `${same.home}/Exports`)]);
        assert.equal(count(same.out, EXPORTS_QUESTION[0]), 1);
        assert.ok(same.out.includes(C_ONLY));
      });

      it("the nesting refusal asks again the folder picked on this run", () => {
        // Both picked on this run: the exports question.
        const both = moveOn({ marks: NOT_INSTALLED, install: prints(refusal(NESTED), DEFAULT_PRINT), picks: ["<HOME>/Dr", "<HOME>/Dr/Ex"], answers: "c\nc\ny\ny\n\n" });
        assert.equal(both.status, 0, both.out);
        assert.deepEqual(installCalls(both), [printed(both, `${both.home}/Dr`, `${both.home}/Dr/Ex`), printed(both, `${both.home}/Dr`), real(both, `${both.home}/Dr`)]);
        assert.equal(count(both.out, EXPORTS_QUESTION[0]), 2);
        assert.equal(count(both.out, DROP_QUESTION[0]), 1);

        // Only the drop folder picked: the drop question.
        const drop = moveOn({ marks: NOT_INSTALLED, install: prints(refusal(NESTED), DEFAULT_PRINT), picks: ["<HOME>/Dr"], answers: "c\ny\ny\ny\n\n" });
        assert.equal(drop.status, 0, drop.out);
        assert.deepEqual(installCalls(drop), [printed(drop, `${drop.home}/Dr`), printed(drop), real(drop)]);
        assert.equal(count(drop.out, DROP_QUESTION[0]), 2);
        assert.equal(count(drop.out, EXPORTS_QUESTION[0]), 1);

        // Only the exports folder picked: the exports question.
        const exp = moveOn({ marks: NOT_INSTALLED, install: prints(refusal(NESTED), DEFAULT_PRINT), picks: ["<HOME>/Ex"], answers: "y\nc\ny\ny\n\n" });
        assert.equal(exp.status, 0, exp.out);
        assert.equal(count(exp.out, EXPORTS_QUESTION[0]), 2);
        assert.equal(count(exp.out, DROP_QUESTION[0]), 1);

        // Neither picked on this run: the exports question, with c alone as y would give Downloads again.
        const none = moveOn({ marks: NOT_INSTALLED, install: prints(refusal(NESTED), DEFAULT_PRINT), picks: ["<HOME>/Ex"], answers: "y\ny\nc\ny\n\n" });
        assert.equal(none.status, 0, none.out);
        assert.deepEqual(installCalls(none), [printed(none), printed(none, undefined, `${none.home}/Ex`), real(none, undefined, `${none.home}/Ex`)]);
        assert.equal(count(none.out, EXPORTS_QUESTION[0]), 1);
        assert.ok(none.out.includes(C_ONLY));
        assert.equal(count(none.out, DROP_QUESTION[0]), 1);
      });

      it("the old folder's refusal stops, and runs nothing for real", () => {
        const r = moveOn({ marks: NOT_INSTALLED, install: prints(refusal(OLD_FOLDER, "  2 videos wait in Drop › Sallie's laptop.", "  Take them out first.")), answers: "y\ny\ny\n\n" });
        assert.equal(r.status, 1, r.out);
        assert.ok(r.out.includes(OLD_FOLDER) && r.out.includes("  Take them out first."), "the installer's words, all of them");
        assert.match(r.out, /Studio's installer refused/);
        assert.deepEqual(installCalls(r), [printed(r)]);
        assert.ok(!r.ran.includes("install.sh --yes"));
        assert.equal(count(r.out, DROP_QUESTION[0]), 1, "no question is asked again");
        assert.ok(r.out.endsWith(STOPPED_NOTHING), r.out);
      });

      it("under --print, a refused print stops with its words, and asks nothing", () => {
        const r = moveOn({ marks: NOT_INSTALLED, install: prints(refusal(HOLDS, "  More of its words.")) }, "--print");
        assert.equal(r.status, 1, r.out);
        assert.ok(r.out.includes(HOLDS) && r.out.includes("  More of its words."), r.out);
        assert.deepEqual(installCalls(r), [printed(r)]);
        assert.ok(!r.out.includes(DROP_QUESTION[0]) && !r.out.includes(C_ONLY) && !r.ran.includes("chooser"), "nothing is asked");
      });

      it("a print shown again after a refused pick, then an older Claude Code, still offers claude update", () => {
        const older = printText(PRINT_LINES.signed, PRINT_LINES.older, PRINT_LINES.hdr);
        const r = moveOn({ marks: NOT_INSTALLED, install: prints(refusal(HOLDS), older, DEFAULT_PRINT), picks: ["<HOME>/Other"], answers: "y\ny\nc\ny\ny\n\n" });
        assert.equal(r.status, 0, r.out);
        assert.ok(r.ran.split("\n").includes("claude update"), r.ran);
        assert.equal(installCalls(r).filter((c) => c.startsWith("install.sh --print")).length, 3);
        assert.ok(!r.out.includes("still older than the installer needs"), r.out);

        // And an update that did not help still stops, as before.
        const still = moveOn({ marks: NOT_INSTALLED, install: prints(refusal(HOLDS), older, older), picks: ["<HOME>/Other"], answers: "y\ny\nc\ny\ny\ny\n" });
        assert.equal(still.status, 1, still.out);
        assert.match(still.out, /still older than the installer needs after claude update/);
      });
    });

    describe("the cloud question", () => {
      const withWarning = (warn, ...more) => printText(PRINT_LINES.signed, PRINT_LINES.version, warn, PRINT_LINES.hdr, PRINT_LINES.lock, PRINT_LINES.app, ...more);

      it("says the Warning line as the print gives it, with nothing added, then asks; Dropbox's and Desktop's forms both", () => {
        const r = moveOn({ marks: NOT_INSTALLED, install: { print: withWarning(WARN) }, answers: "y\ny\ny\ny\n\n" });
        assert.equal(r.status, 0, r.out);
        assert.ok(r.out.includes(`${WARN}\n${CLOUD_PROMPT}`), r.out);
        assert.equal(count(r.out, CLOUD_PROMPT), 1);
        assert.deepEqual(installCalls(r), [printed(r), real(r)], "a y writes nothing and changes the line not at all");
        assert.ok(r.out.indexOf(CLOUD_PROMPT) < r.out.indexOf("The lines that matter:"), "it comes before Claude Code's lines");

        const desktop = moveOn({ marks: NOT_INSTALLED, install: { print: withWarning(WARN_DESKTOP) }, picks: ["<HOME>/Desktop/Drops"], answers: "c\ny\ny\ny\n\n" });
        assert.equal(desktop.status, 0, desktop.out);
        assert.ok(desktop.out.includes(`${WARN_DESKTOP}\n${CLOUD_PROMPT}`), desktop.out);
        assert.deepEqual(installCalls(desktop), [printed(desktop, `${desktop.home}/Desktop/Drops`), real(desktop, `${desktop.home}/Desktop/Drops`)]);

        // Anything else stops.
        const stop = moveOn({ marks: NOT_INSTALLED, install: { print: withWarning(WARN) }, answers: "y\ny\nn\n" });
        assert.equal(stop.status, 1, stop.out);
        assert.deepEqual(installCalls(stop), [printed(stop)]);
      });

      it("c asks the drop question again, and prints again", () => {
        const r = moveOn({ marks: NOT_INSTALLED, install: { print: [withWarning(WARN), DEFAULT_PRINT] }, picks: ["<HOME>/Local"], answers: "y\ny\nc\nc\ny\n\n" });
        assert.equal(r.status, 0, r.out);
        assert.deepEqual(installCalls(r), [printed(r), printed(r, `${r.home}/Local`), real(r, `${r.home}/Local`)]);
        assert.equal(count(r.out, DROP_QUESTION[0]), 2);
        assert.equal(count(r.out, CLOUD_PROMPT), 1);
      });

      it("a y holds when the print is shown again after claude update, and after a refused exports pick", () => {
        const older = printText(PRINT_LINES.signed, PRINT_LINES.older, WARN, PRINT_LINES.hdr);
        const r = moveOn({ marks: NOT_INSTALLED, install: prints(older, refusal(ZOOM), withWarning(WARN)), picks: ["<HOME>/Exports"], answers: "y\ny\ny\ny\nc\ny\n\n" });
        assert.equal(r.status, 0, r.out);
        assert.equal(installCalls(r).filter((c) => c.startsWith("install.sh --print")).length, 3);
        assert.ok(r.ran.split("\n").includes("claude update"), r.ran);
        assert.equal(count(r.out, CLOUD_PROMPT), 1, "asked once, though three prints held the Warning line");
      });

      it("after a c, a different cloud folder is asked about afresh", () => {
        const r = moveOn({ marks: NOT_INSTALLED, install: { print: [withWarning(WARN), withWarning(WARN)] }, picks: ["<HOME>/Dropbox/Elsewhere"], answers: "y\ny\nc\nc\ny\ny\n\n" });
        assert.equal(r.status, 0, r.out);
        assert.equal(count(r.out, CLOUD_PROMPT), 2);
        assert.equal(installCalls(r).filter((c) => c.startsWith("install.sh --print")).length, 2);
        assert.match(r.report, /^Cloud warning: Dropbox, kept on a y$/m);
      });

      it("a print whose Warning line comes twice asks once", () => {
        const r = moveOn({ marks: NOT_INSTALLED, install: { print: withWarning(WARN, WARN) }, answers: "y\ny\ny\ny\n\n" });
        assert.equal(r.status, 0, r.out);
        assert.equal(count(r.out, CLOUD_PROMPT), 1);
      });

      it("a Mac whose settings already name a Dropbox drop folder, kept by y, is not asked, and its report says so", () => {
        const r = moveOn({ marks: NOT_INSTALLED, settingsChange: { dropPath: "<HOME>/Dropbox/Drop" }, install: { print: withWarning(WARN) }, answers: "y\ny\ny\n\n" });
        assert.equal(r.status, 0, r.out);
        assert.ok(!r.out.includes(CLOUD_PROMPT), r.out);
        assert.deepEqual(installCalls(r), [printed(r, ""), real(r, "")]);
        assert.match(r.report, /^Cloud warning: Dropbox, kept on a y on an earlier run$/m);
      });

      it("the report says none for a drop folder in no cloud, and a print claims nothing", () => {
        const r = moveOn({ marks: NOT_INSTALLED, answers: "y\ny\ny\n\n" });
        assert.match(r.report, /^Cloud warning: none$/m);
        const p = moveOn({ marks: NOT_INSTALLED, install: { print: withWarning(WARN) } }, "--print");
        assert.equal(p.status, 0, p.out);
        assert.ok(!p.out.includes(CLOUD_PROMPT));
        assert.ok(p.out.includes("Cloud warning: not checked: this was a print"), p.out);
      });
    });

    describe("the privacy notes", () => {
      it("say the Downloads line on every run, before the real install's question", () => {
        const r = moveOn({ marks: NOT_INSTALLED, answers: "y\ny\ny\n\n" });
        assert.equal(r.status, 0, r.out);
        assert.equal(count(r.out, DOWNLOADS_LINE), 1);
        assert.ok(r.out.indexOf(DOWNLOADS_LINE) > r.out.indexOf("The lines that matter:") && r.out.indexOf(DOWNLOADS_LINE) < r.out.indexOf("Studio's installer now runs for real"), r.out);
        assert.ok(!r.out.includes(DROP_MAY_ASK) && !r.out.includes(EXPORTS_MAY_ASK), "the suggested folders bring no more");
        assert.ok(r.log.includes(DOWNLOADS_LINE));

        const fresh = moveOn({ ...FRESH_MAC, install: { writesSettings: true }, answers: "y\ny\ny\ny\ny\n\n" });
        assert.equal(fresh.status, 0, fresh.out);
        assert.equal(count(fresh.out, DOWNLOADS_LINE), 1);

        // Not under --print, which asks nothing and installs nothing.
        const p = moveOn({ marks: NOT_INSTALLED }, "--print");
        assert.ok(!p.out.includes(DOWNLOADS_LINE));
        // A Mac whose installer finished at this commit has no real install to ask about.
        const done = moveOn({});
        assert.ok(!done.out.includes(DOWNLOADS_LINE));
        // And it names Claude Code and node, and the setting for a refused node.
        for (const part of ["Claude Code", "node", "System Settings › Privacy & Security › Files and Folders"]) assert.ok(DOWNLOADS_LINE.includes(part));
      });

      it("say the drop folder's line for a pick under Desktop, and under iCloud Drive; none for the suggested folder", () => {
        const desktop = moveOn({ marks: NOT_INSTALLED, picks: ["<HOME>/Desktop/Drops"], answers: "c\ny\ny\n\n" });
        assert.equal(desktop.status, 0, desktop.out);
        assert.ok(desktop.out.includes(dropLine("Desktop › Drops, in your home folder")), desktop.out);
        assert.ok(desktop.out.indexOf(DOWNLOADS_LINE) < desktop.out.indexOf(DROP_MAY_ASK) && desktop.out.indexOf(DROP_MAY_ASK) < desktop.out.indexOf("Studio's installer now runs for real"));

        const icloud = moveOn({ marks: NOT_INSTALLED, picks: ["<HOME>/Library/Mobile Documents/Drops"], answers: "c\ny\ny\n\n" });
        assert.equal(icloud.status, 0, icloud.out);
        assert.ok(icloud.out.includes(DROP_MAY_ASK), icloud.out);

        const plain = moveOn({ marks: NOT_INSTALLED, answers: "y\ny\ny\n\n" });
        assert.ok(!plain.out.includes(DROP_MAY_ASK));
        // Nor for a local folder picked elsewhere.
        const local = moveOn({ marks: NOT_INSTALLED, picks: ["<HOME>/Videos to Drop"], answers: "c\ny\ny\n\n" });
        assert.ok(!local.out.includes(DROP_MAY_ASK));
      });

      it("say none for Dropbox on a moved Mac, and the line for it on one set up fresh", () => {
        const moved = moveOn({ marks: NOT_INSTALLED, picks: ["<HOME>/Dropbox/Videos"], answers: "c\ny\ny\n\n" });
        assert.equal(moved.status, 0, moved.out);
        assert.ok(!moved.out.includes(DROP_MAY_ASK), moved.out);
        assert.equal(count(moved.out, DOWNLOADS_LINE), 1);

        const fresh = moveOn({ ...FRESH_MAC, install: { writesSettings: true }, picks: ["<HOME>/Dropbox/Videos"], answers: "y\nc\ny\ny\ny\n\n" });
        assert.equal(fresh.status, 0, fresh.out);
        assert.ok(fresh.out.includes(dropLine("Dropbox › Videos, in your home folder")), fresh.out);
      });

      it("say the exports folder's line for a pick under Documents, and after a folder Terminal could not look in", () => {
        const docs = moveOn({ marks: NOT_INSTALLED, picks: ["<HOME>/Documents/Exports"], answers: "y\nc\ny\n\n" });
        assert.equal(docs.status, 0, docs.out);
        assert.ok(docs.out.includes(exportsLine("Documents › Exports, in your home folder")), docs.out);
        assert.ok(!docs.out.includes(DROP_MAY_ASK));

        const passed = moveOn({ marks: NOT_INSTALLED, folderFiles: { "<HOME>/Locked/Exports": [] }, folderModes: { "<HOME>/Locked": 0o000 }, picks: ["<HOME>/Locked/Exports"], answers: "y\nc\ny\n\n" });
        assert.equal(passed.status, 0, passed.out);
        assert.ok(passed.out.includes(exportsLine("Locked › Exports, in your home folder")), passed.out);

        const plain = moveOn({ marks: NOT_INSTALLED, picks: ["<HOME>/Exports"], answers: "y\nc\ny\n\n" });
        assert.ok(!plain.out.includes(EXPORTS_MAY_ASK));
        const downloads = moveOn({ marks: NOT_INSTALLED, answers: "y\ny\ny\n\n" });
        assert.ok(!downloads.out.includes(EXPORTS_MAY_ASK));
      });
    });
  });

  describe("the chooser's two ways, sourced", () => {
    const rcOf = (route, { picks, program }) => {
      const r = sourced(`CHOOSER_ROUTE=${route}; rc=0; choose_folder "a message" "$HOME" || rc=$?; print -r -- "rc=$rc CHOSEN=$CHOSEN"`, { picks, program });
      assert.equal(r.status, 0, r.out + r.err);
      return { ...r, rc: r.out.match(/rc=(\d+) CHOSEN=(.*)\n/)?.slice(1) };
    };

    it("the second way: a path; Cancel (1); a line break (3); 2 with a sentence; a missing program", () => {
      const path = rcOf("program", { program: ["<HOME>/Elsewhere"] });
      assert.deepEqual(path.rc, ["0", `${path.home}/Elsewhere`]);
      assert.ok(path.ran.includes(`program a message | ${path.home}`) && !path.ran.includes("chooser "), "the first way is not tried when the second answers:\n" + path.ran);
      assert.ok(path.ran.split("\n").includes("open -a Terminal"), "Terminal is brought back");

      assert.deepEqual(rcOf("program", { program: ["cancel"] }).rc, ["1", ""]);
      assert.deepEqual(rcOf("program", { program: ["linebreak"] }).rc, ["3", ""]);
      const two = rcOf("program", { program: ["two"], picks: ["fail"] });
      assert.deepEqual(two.rc, ["2", ""]);
      assert.ok(two.ran.includes("chooser "), "and then the other way is tried");
      assert.ok(!two.err.includes("could not be shown"), "the helper's sentence is kept off the screen");
      assert.deepEqual(rcOf("program", { program: ["missing"], picks: ["fail"] }).rc, ["2", ""]);
    });

    it("the first way first: a result, Cancel or a line break is final; no file tries the program", () => {
      const cancel = rcOf("app", { picks: ["cancel"], program: ["<HOME>/Elsewhere"] });
      assert.deepEqual(cancel.rc, ["1", ""]);
      assert.ok(!cancel.ran.includes("program "), "the second way is never tried after a Cancel");
      assert.deepEqual(rcOf("app", { picks: ["linebreak"] }).rc, ["3", ""]);
      const pick = rcOf("app", { picks: ["<HOME>/A Folder"] });
      assert.deepEqual(pick.rc, ["0", `${pick.home}/A Folder`]);
      const fallback = rcOf("app", { picks: ["nofile"], program: ["<HOME>/Elsewhere"] });
      assert.deepEqual(fallback.rc, ["0", `${fallback.home}/Elsewhere`]);
      assert.deepEqual(rcOf("app", { picks: ["fail"], program: ["two"] }).rc, ["2", ""]);
    });

    it("makes the pick whole: a link is followed", () => {
      const r = sourced('mkdir -p "$HOME/real"; ln -s "$HOME/real" "$HOME/link"; CHOOSER_ROUTE=app; rc=0; choose_folder "m" "$HOME" || rc=$?; print -r -- "rc=$rc CHOSEN=$CHOSEN"', { picks: ["<HOME>/link"] });
      assert.equal(r.out.trimEnd().split("\n").pop(), `rc=0 CHOSEN=${r.home}/real`);
    });
  });

  it("words_for gives Studio's folderWords through node, and the path itself when that cannot be asked", () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "brimm-words-")));
    dirsToClean.add(dir);
    const studio = join(dir, "studio");
    put(join(studio, "tool", "settings.js"), FAKE_STUDIO_SETTINGS_JS);
    const broken = join(dir, "broken");
    put(join(broken, "tool", "settings.js"), 'throw new Error("not today");\n');
    const home = join(dir, "home");
    mkdirSync(home);
    const script = 'NODE="$NODE_BIN"; STUDIO="$2"; words_for "$HOME/Videos to Drop"; STUDIO="$3"; words_for "$HOME/Videos to Drop"; NODE=""; STUDIO="$2"; words_for "$HOME/Videos to Drop"; NODE="$NODE_BIN"; STUDIO="$4"; words_for "$HOME/Videos to Drop"';
    const r = spawnSync("/bin/zsh", ["-c", `source "$1"\n${script}`, "move", MOVE, studio, broken, join(dir, "nothing")], { encoding: "utf8", env: { HOME: home, PATH: "/usr/bin:/bin", NODE_BIN: process.execPath } });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(r.stdout.trimEnd().split("\n"), ["Videos to Drop, in your home folder", `${home}/Videos to Drop`, `${home}/Videos to Drop`, `${home}/Videos to Drop`]);
    assert.equal(r.stderr, "", "node's errors are kept off the screen");
  });
});
