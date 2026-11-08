// The move script of the "Move to Studio" app (tool/move-app/move.zsh): it moves Sallie's laptop or Jason's MacBook from brimm-video
// to Studio, or sets up fresh, as Jason's MacBook, a Mac with no brimm-video, one asked step at a time. Every test runs it in a home folder made for the test, with stand-ins for ssh-keygen, ssh, claude, launchctl,
// brew, open, pbcopy, caffeinate, sw_vers, df and xcode-select first on its PATH, each writing `name args` into a `ran` file, so that
// no test runs the program of the Mac it runs on. The "GitHub" it clones from is a local repository made with real git.
// The environment is built from scratch (never process.env spread in), so that nothing of this test run, such as the variables
// `node --test` sets, reaches a node that the script starts.
// The tests need a Mac (zsh and plutil). Anywhere else they skip themselves and say why.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  notAMac,
  STOPPED_NOTHING,
  put,
  moveOn,
  NOT_INSTALLED,
  installCalls,
  rootOf,
  suggested,
  count,
  DROP_QUESTION,
  EXPORTS_QUESTION,
  EXPORTS_NOTE,
  sourced
} from "./move-app-harness.js";

describe("the move script, step 5's two questions, the chooser and the installer's options (2 of 3: the checks of a pick)", { skip: notAMac }, () => {
  // The installer's options for Sallie's laptop: --drop-folder unless it is kept (drop === ""), --exports-folder when given.
  const optionsOf = (home, drop = suggested(home), exports = "") => `--machine Sallie's laptop${drop ? ` --drop-folder ${drop}` : ""}${exports ? ` --exports-folder ${exports}` : ""} --import light --handoff 2`;
  const printed = (r, drop, exports) => `install.sh --print ${optionsOf(r.home, drop, exports)} ${rootOf(r.home)}`;
  const real = (r, drop, exports) => `install.sh --yes ${optionsOf(r.home, drop, exports)} ${rootOf(r.home)}`;



  describe("the app's own checks of a pick", () => {
    const LINE_WORDS = "A folder whose name holds a line break can't be used. Choose another.";
    const NOT_EMPTY_END = "Studio takes every video out of a drop folder, so choose an empty folder that only you drop into, or make one with New Folder.";
    const TERMINAL_WORDS = (folder) => `macOS did not let Terminal look in ${folder}. Allow Terminal in System Settings › Privacy & Security › Files and Folders, or choose another folder.`;
    const TRANSCRIPT_WORDS = (folder) => `${folder} is watched by the transcript tool, which takes each video put there. Choose another.`;
    const STUDIO_WORDS = (folder) => `Exports can't go in ${folder}: it is one of Studio's own folders, or a drop folder, where an export would be taken. Choose another.`;
    const TIDY_LINE = "Studio tidies only Downloads itself, so exports in this folder are never tidied.";
    const PRELUDE = `ROOT="$HOME/Dropbox/The BRIMM DB/BRIMM Video"; STUDIO="$HOME/none"; NODE=""; SETTINGS="$HOME/none.json"
trap 'chmod -R u+rwx "$HOME" 2>/dev/null || true' EXIT
show() { print -r -- "[$FAULT_KIND] [$FAULT_WORDS] [$FAULT_REASON] [\${EXPORTS_PASSED_OVER-}]"; }
`;
    /** Runs the checks sourced, with ROOT and the rest made: the output has the home folder as <HOME>. */
    const checks = (body, o) => {
      const r = sourced(PRELUDE + body, o);
      assert.equal(r.status, 0, r.out + r.err);
      return { ...r, lines: r.out.replaceAll(r.home, "<HOME>").trimEnd().split("\n"), errors: r.err };
    };
    // A made-up transcribe plist: the file ($1) and the folders it watches.
    const PLIST = `makeplist() { local f="$1"; shift; mkdir -p "\${f:h}"; plutil -create xml1 "$f"; plutil -insert WatchPaths -array "$f"; local w; for w in "$@"; do plutil -insert WatchPaths -string "$w" -append "$f"; done; }\n`;
    const LAUNCH = '"$HOME/Library/LaunchAgents/com.thebrimm.transcribe.plist"';

    it("same_or_nested is true both ways and same_or_inside one way, by real path, letter case folded, with missing parts as spelled", () => {
      const r = checks(`mkdir -p "$HOME/Real/Inner"; ln -s "$HOME/Real" "$HOME/Link"
t() { if "$@"; then print yes; else print no; fi; }
t same_or_nested "$HOME/Real" "$HOME/Real"
t same_or_nested "$HOME/Real/Inner" "$HOME/Real"
t same_or_nested "$HOME/Real" "$HOME/Real/Inner"
t same_or_nested "$HOME/Link/Inner" "$HOME/Real"
t same_or_nested "$HOME/REAL" "$HOME/real/inner"
t same_or_nested "$HOME/Real/Missing/Deeper" "$HOME/Real"
t same_or_nested "$HOME/Real" "$HOME/Realm"
t same_or_nested "$HOME/Elsewhere" "$HOME/Real"
t same_or_inside "$HOME/Real" "$HOME/Real"
t same_or_inside "$HOME/Real/Inner" "$HOME/Real"
t same_or_inside "$HOME/Real" "$HOME/Real/Inner"
t same_or_inside "$HOME/Link/Inner" "$HOME/Real"
t same_or_inside "$HOME/Real/Missing/Deeper" "$HOME/REAL"
t same_or_inside "$HOME/Realm" "$HOME/Real"`);
      assert.deepEqual(r.lines, ["yes", "yes", "yes", "yes", "yes", "yes", "no", "no", "yes", "yes", "no", "yes", "yes", "no"]);
    });

    it("count_entries counts all but .DS_Store and the marker, names nothing, and takes a missing folder as 0 only when the folder that holds it can be listed", () => {
      const r = checks(`mkdir -p "$HOME/full" "$HOME/empty" "$HOME/locked" "$HOME/plain/locked2"; touch "$HOME/full/Client Name.mov" "$HOME/full/b" "$HOME/full/.hidden" "$HOME/full/.DS_Store" "$HOME/full/.brimm-watched-by" "$HOME/empty/.DS_Store"
chmod 000 "$HOME/locked" "$HOME/plain/locked2"
c() { local out rc=0; out="$(count_entries "$1")" || rc=$?; print -r -- "[$out] rc=$rc"; }
c "$HOME/full"
c "$HOME/empty"
c "$HOME/missing"
c "$HOME/locked"
c "$HOME/locked/inner"
c "$HOME/plain/locked2"
c "$HOME/plain/locked2/deeper"
c "$HOME/nothing/at/all"
c "$HOME/gone/parent/Last Time"
c "$HOME/plain/locked2/deeper/more/parts"`);
      // A missing folder is 0 when the nearest folder above it that is there can be listed; 2 when that one cannot.
      assert.deepEqual(r.lines, ["[3] rc=0", "[0] rc=0", "[0] rc=0", "[] rc=2", "[] rc=2", "[] rc=2", "[] rc=2", "[0] rc=0", "[0] rc=0", "[] rc=2"]);
      assert.ok(!r.out.includes("Client Name"), "nothing is named");
    });

    it("plist_watch_paths and transcript_folders read the paths whole, as install.sh reads them, and the .plist.off only for exports", () => {
      const r = checks(`${PLIST}makeplist ${LAUNCH} "$HOME/Watched One" "$HOME/it's, \\"quoted\\" one" "relative/folder"
makeplist "$HOME/Library/LaunchAgents/com.thebrimm.transcribe.plist.off" "$HOME/Off Folder" "also/relative"
print -r -- "--plist"; plist_watch_paths ${LAUNCH}
print -r -- "--missing"; plist_watch_paths "$HOME/no such file"
print -r -- "--drop"; transcript_folders drop
print -r -- "--exports"; transcript_folders exports`);
      assert.deepEqual(r.lines, [
        "--plist", "<HOME>/Watched One", `<HOME>/it's, "quoted" one`, "relative/folder",
        "--missing",
        "--drop", "<HOME>/Dropbox/The BRIMM DB/BRIMM VIDEO Transfer", "<HOME>/Dropbox/The BRIMM DB/BRIMM VIDEO MacBook", "<HOME>/Watched One", `<HOME>/it's, "quoted" one`,
        "--exports", "<HOME>/Dropbox/The BRIMM DB/BRIMM VIDEO Transfer", "<HOME>/Dropbox/The BRIMM DB/BRIMM VIDEO MacBook", "<HOME>/Watched One", `<HOME>/it's, "quoted" one`, "<HOME>/Off Folder"
      ]);
    });

    it("in_downloads is true for Downloads and anything inside it, by real path", () => {
      const r = checks(`mkdir -p "$HOME/Downloads/Sub" "$HOME/Elsewhere"; ln -s "$HOME/Downloads" "$HOME/dl"
t() { if "$@"; then print yes; else print no; fi; }
t in_downloads "$HOME/Downloads"; t in_downloads "$HOME/Downloads/Sub"; t in_downloads "$HOME/dl"; t in_downloads "$HOME/dl/Sub"; t in_downloads "$HOME/Downloads/Missing/x"; t in_downloads "$HOME/Elsewhere"; t in_downloads "$HOME"; t in_downloads "$HOME/Downloads2"`);
      assert.deepEqual(r.lines, ["yes", "yes", "yes", "yes", "yes", "no", "no", "no"]);
    });

    describe("the drop folder", () => {
      const drop = (body, o) => checks(`d() { drop_folder_fault "$1" "\${2-picked}"; show; }\n${body}`, o);

      it("refuses a line break, in the spec's words", () => {
        const r = drop(`d "$HOME/two"$'\\n'"lines"`);
        assert.deepEqual(r.lines, [`[linebreak] [${LINE_WORDS}] [its name holds a line break] []`]);
      });

      it("counts a full folder and never names a file in it, and takes a missing folder, and an empty one, as empty", () => {
        const r = drop(`mkdir -p "$HOME/full" "$HOME/one" "$HOME/empty"; touch "$HOME/full/Client Name.mov" "$HOME/full/b.mov" "$HOME/one/a.mov" "$HOME/empty/.DS_Store" "$HOME/empty/.brimm-watched-by"
d "$HOME/full"; d "$HOME/one"; d "$HOME/empty"; d "$HOME/missing"`);
        assert.deepEqual(r.lines, [
          `[not-empty] [<HOME>/full holds 2 files or folders. ${NOT_EMPTY_END}] [it is not empty] []`,
          `[not-empty] [<HOME>/one holds 1 file or folder. ${NOT_EMPTY_END}] [it is not empty] []`,
          "[] [] [] []", "[] [] [] []"
        ]);
        assert.ok(!r.out.includes("Client Name"));
      });

      it("holds the last-time and suggested folders to the empty check, and the settings' own not", () => {
        const r = drop(`mkdir -p "$HOME/held"; touch "$HOME/held/a.mov"
d "$HOME/held" last; d "$HOME/held" suggested; d "$HOME/held" picked; d "$HOME/held" settings`);
        assert.deepEqual(r.lines.map((l) => l.split("]")[0]), ["[not-empty", "[not-empty", "[not-empty", "["]);
        assert.equal(r.lines[3], "[] [] [] []");
      });

      it("refuses a folder Terminal cannot look in as cannot-look, never as empty, and a pick inside one too", () => {
        const r = drop(`mkdir -p "$HOME/locked" "$HOME/outer/inner"; chmod 000 "$HOME/locked" "$HOME/outer"
d "$HOME/locked"; d "$HOME/outer/inner"; d "$HOME/locked" settings`);
        const want = (folder) => `[cannot-look] [${TERMINAL_WORDS(folder)}] [macOS did not let Terminal look in it] []`;
        assert.deepEqual(r.lines, [want("<HOME>/locked"), want("<HOME>/outer/inner"), want("<HOME>/locked")]);
      });

      it("takes the suggested folder as empty when BRIMM Video Work is not there yet", () => {
        const r = drop(`d "$HOME/BRIMM Video Work/Drop" suggested; mkdir -p "$HOME/BRIMM Video Work/Drop"; touch "$HOME/BRIMM Video Work/Drop/a"; d "$HOME/BRIMM Video Work/Drop" suggested`);
        assert.equal(r.lines[0], "[] [] [] []");
        assert.match(r.lines[1], /^\[not-empty\]/);
      });

      it("refuses what the transcript tool watches, in either list's spelling, and a folder that holds one of its folders", () => {
        const r = drop(`${PLIST}mkdir -p "$HOME/Dropbox/The BRIMM DB/BRIMM VIDEO Transfer" "$HOME/Dropbox/The BRIMM DB/BRIMM VIDEO MacBook" "$HOME/Dropbox/The BRIMM DB/BRIMM VIDEO Transfer/inside" "$HOME/it's, \\"quoted\\" one" "$HOME/Off Only" "$HOME/Free"
makeplist ${LAUNCH} "$HOME/it's, \\"quoted\\" one"
makeplist "$HOME/Library/LaunchAgents/com.thebrimm.transcribe.plist.off" "$HOME/Off Only"
d "$HOME/Dropbox/The BRIMM DB/BRIMM VIDEO Transfer"; d "$HOME/Dropbox/The BRIMM DB/BRIMM VIDEO Transfer/inside"; d "$HOME/Dropbox/The BRIMM DB/BRIMM VIDEO MacBook"
d "$HOME/it's, \\"quoted\\" one"; d "$HOME/Dropbox/The BRIMM DB"; d "$HOME/Off Only"; d "$HOME/Free"`);
        const want = (folder) => `[transcript] [${TRANSCRIPT_WORDS(folder)}] [the transcript tool watches it] []`;
        assert.deepEqual(r.lines, [
          want("<HOME>/Dropbox/The BRIMM DB/BRIMM VIDEO Transfer"), want("<HOME>/Dropbox/The BRIMM DB/BRIMM VIDEO Transfer/inside"), want("<HOME>/Dropbox/The BRIMM DB/BRIMM VIDEO MacBook"),
          want(`<HOME>/it's, "quoted" one`), want("<HOME>/Dropbox/The BRIMM DB"),
          "[] [] [] []", "[] [] [] []"
        ]);
      });
    });

    describe("the drop folder, in Downloads", () => {
      it("is never read: at mode 000, a pick of Downloads or in it gives no refusal of the app's and no error", () => {
        const r = checks(`mkdir -p "$HOME/Downloads/X"; chmod 000 "$HOME/Downloads"
for f in "$HOME/Downloads" "$HOME/Downloads/X" "$HOME/Downloads/Missing"; do drop_folder_fault "$f" picked; show; done`);
        assert.deepEqual(r.lines, Array(3).fill("[] [] [] []"));
        assert.equal(r.errors, "");
      });
    });

    describe("the exports folder", () => {
      const exp = (body, o) => checks(`e() { exports_folder_fault "$1"; show; }\n${body}`, o);

      it("refuses a line break and the transcript tool's folders, for any folder", () => {
        const r = exp(`${PLIST}mkdir -p "$HOME/Dropbox/The BRIMM DB/BRIMM VIDEO Transfer" "$HOME/Dropbox/The BRIMM DB/BRIMM VIDEO MacBook" "$HOME/Watched" "$HOME/Off Only"
makeplist ${LAUNCH} "$HOME/Watched"
makeplist "$HOME/Library/LaunchAgents/com.thebrimm.transcribe.plist.off" "$HOME/Off Only"
e "$HOME/a"$'\\n'"b"; e "$HOME/Dropbox/The BRIMM DB/BRIMM VIDEO Transfer"; e "$HOME/Dropbox/The BRIMM DB/BRIMM VIDEO MacBook"; e "$HOME/Watched/sub"; e "$HOME/Off Only"; e "$HOME/Dropbox/The BRIMM DB"`);
        const want = (folder) => `[transcript] [${TRANSCRIPT_WORDS(folder)}] [the transcript tool watches it] []`;
        assert.deepEqual(r.lines, [
          `[linebreak] [${LINE_WORDS}] [its name holds a line break] []`,
          want("<HOME>/Dropbox/The BRIMM DB/BRIMM VIDEO Transfer"), want("<HOME>/Dropbox/The BRIMM DB/BRIMM VIDEO MacBook"), want("<HOME>/Watched/sub"), want("<HOME>/Off Only"),
          "[] [] [] []"
        ]);
      });

      it("refuses Studio's folders, the workshop, Zoom's folder and a marked folder, and what is inside them", () => {
        const r = exp(`mkdir -p "$HOME/Dropbox/The BRIMM DB/BRIMM Video/Episodes/One" "$HOME/Dropbox/The BRIMM DB/BRIMM Video/Drop" "$HOME/Dropbox/The BRIMM DB/BRIMM Video/Unedited Video" "$HOME/Dropbox/The BRIMM DB/BRIMM Video/References" "$HOME/BRIMM Video Work/Episodes" "$HOME/Library/Application Support/BRIMM Video" "$HOME/BRIMM Video Workshop" "$HOME/BRIMM Video Studio" "$HOME/Documents/Zoom/Call" "$HOME/Zoomies" "$HOME/Cloud/Exports"
touch "$HOME/Cloud/.brimm-watched-by"
print -r -- '{"zoomFolder": "'"$HOME"'/Zoomies"}' > "$SETTINGS"
e "$ROOT/Episodes"; e "$ROOT/Episodes/One"; e "$ROOT/Drop"; e "$ROOT/Unedited Video"; e "$ROOT/References"
e "$HOME/BRIMM Video Work"; e "$HOME/BRIMM Video Work/Episodes"; e "$HOME/brimm video work/episodes"
e "$HOME/Library/Application Support/BRIMM Video"; e "$HOME/BRIMM Video Workshop"; e "$HOME/BRIMM Video Studio"
e "$HOME/Zoomies"; e "$HOME/Zoomies/new"; e "$HOME/Documents/Zoom/Call"
e "$HOME/Cloud"; e "$HOME/Cloud/Exports"; e "$HOME/Cloud/Exports/deeper/still"`);
        const want = (folder) => `[studio] [${STUDIO_WORDS(folder)}] [it is one of Studio's own folders, or a drop folder] []`;
        const refused = [
          "<HOME>/Dropbox/The BRIMM DB/BRIMM Video/Episodes", "<HOME>/Dropbox/The BRIMM DB/BRIMM Video/Episodes/One", "<HOME>/Dropbox/The BRIMM DB/BRIMM Video/Drop",
          "<HOME>/Dropbox/The BRIMM DB/BRIMM Video/Unedited Video", "<HOME>/Dropbox/The BRIMM DB/BRIMM Video/References",
          "<HOME>/BRIMM Video Work", "<HOME>/BRIMM Video Work/Episodes", "<HOME>/brimm video work/episodes",
          "<HOME>/Library/Application Support/BRIMM Video", "<HOME>/BRIMM Video Workshop", "<HOME>/BRIMM Video Studio",
          "<HOME>/Zoomies", "<HOME>/Zoomies/new"
        ].map(want);
        // Zoom's folder is the settings' own, so ~/Documents/Zoom is then an ordinary folder; marked folders are refused.
        assert.deepEqual(r.lines, [...refused, "[] [] [] []", want("<HOME>/Cloud"), want("<HOME>/Cloud/Exports"), want("<HOME>/Cloud/Exports/deeper/still")]);
      });

      it("takes ~/Documents/Zoom as Zoom's folder when the settings name none", () => {
        const r = exp(`mkdir -p "$HOME/Documents/Zoom/Call"; e "$HOME/Documents/Zoom"; e "$HOME/Documents/Zoom/Call"; e "$HOME/Documents"`);
        assert.match(r.lines[0], /^\[studio\]/);
        assert.match(r.lines[1], /^\[studio\]/);
        assert.equal(r.lines[2], "[] [] [] []", "a folder that holds Zoom's will do");
      });

      it("takes a folder that holds BRIMM Video, or Studio's folders, lower down", () => {
        const r = exp(`mkdir -p "$ROOT/Episodes" "$HOME/BRIMM Video Work/Drop"
e "$HOME/Dropbox/The BRIMM DB"; e "$HOME/Dropbox"; e "$ROOT"; e "$ROOT/Assets"; e "$HOME"`);
        assert.deepEqual(r.lines.slice(0, 4), ["[] [] [] []", "[] [] [] []", "[] [] [] []", "[] [] [] []"]);
      });

      it("never looks at Zoom's folder under a Documents Terminal cannot read, for a pick outside Documents", () => {
        const r = exp(`mkdir -p "$HOME/Documents/Zoom" "$HOME/Exports"; chmod 000 "$HOME/Documents"
e "$HOME/Exports"; e "$HOME/Elsewhere/New"`);
        assert.deepEqual(r.lines, ["[] [] [] []", "[] [] [] []"]);
        assert.equal(r.errors, "", "no error from the unreadable folder");
      });

      it("does not compare a pick outside Documents with Zoom's folder under Documents (a link to the pick would refuse it)", () => {
        const r = exp(`mkdir -p "$HOME/Documents" "$HOME/Exports"; ln -s "$HOME/Exports" "$HOME/Documents/Zoom"
e "$HOME/Exports"`);
        assert.deepEqual(r.lines, ["[] [] [] []"]);
      });

      it("builds Finder's words (node) only when it refuses", () => {
        const r = exp(`mkdir -p "$HOME/st/tool" "$HOME/Exports" "$HOME/BRIMM Video Work"; touch "$HOME/st/tool/settings.js"
print -r -- '#!/bin/sh\necho called >> "'"$HOME"'/node-log"' > "$HOME/nodestub"; chmod +x "$HOME/nodestub"
NODE="$HOME/nodestub"; STUDIO="$HOME/st"
e "$HOME/Exports"; e "$HOME/Downloads"
print -r -- "log:[$(cat "$HOME/node-log" 2>/dev/null)]"
e "$HOME/BRIMM Video Work"
print -r -- "log:[$(wc -l < "$HOME/node-log" | tr -d ' ')]"`);
        assert.equal(r.lines[2], "log:[]", "a passing pick brings no node");
        assert.equal(r.lines[4], "log:[1]");
      });

      it("asks about Zoom's folder when the pick could be in Documents, by real path or as spelled", () => {
        const r = exp(`mkdir -p "$HOME/Documents/Zoom/Call" "$HOME/Documents/Other"; ln -s "$HOME/Documents" "$HOME/Docs"
e "$HOME/Documents/Zoom/Call"; e "$HOME/Docs/Zoom/Call"; e "$HOME/Documents/Other"`);
        assert.match(r.lines[0], /^\[studio\]/);
        assert.match(r.lines[1], /^\[studio\]/);
        assert.equal(r.lines[2], "[] [] [] []");
      });

      it("passes over a place above the folder that Terminal cannot look in, and says so", () => {
        const r = exp(`mkdir -p "$HOME/Locked/Exports" "$HOME/Open/Exports"; chmod 000 "$HOME/Locked"
e "$HOME/Locked/Exports"; e "$HOME/Open/Exports"`);
        assert.deepEqual(r.lines, ["[] [] [] [yes]", "[] [] [] []"]);
      });

      it("reads nothing in or under Downloads: at mode 000, a pick there passes with no error, a marker inside it is not looked for", () => {
        const r = exp(`mkdir -p "$HOME/Downloads/Sub"; touch "$HOME/Downloads/.brimm-watched-by"
e "$HOME/Downloads"; e "$HOME/Downloads/Sub"
chmod 000 "$HOME/Downloads"
e "$HOME/Downloads"; e "$HOME/Downloads/Sub"; e "$HOME/Downloads/Sub/Deeper"`);
        assert.deepEqual(r.lines, Array(5).fill("[] [] [] []"));
        assert.equal(r.errors, "");
      });

      it("still refuses a Downloads pick the transcribe plist names, and a line break in Downloads", () => {
        const r = exp(`${PLIST}mkdir -p "$HOME/Downloads/Sub"; makeplist ${LAUNCH} "$HOME/Downloads"
chmod 000 "$HOME/Downloads"
e "$HOME/Downloads"; e "$HOME/Downloads/Sub"; e "$HOME/Downloads/a"$'\\n'"b"`);
        const want = (folder) => `[transcript] [${TRANSCRIPT_WORDS(folder)}] [the transcript tool watches it] []`;
        assert.deepEqual(r.lines.slice(0, 2), [want("<HOME>/Downloads"), want("<HOME>/Downloads/Sub")]);
        assert.match(r.lines[2], /^\[linebreak\]/);
      });
    });

    it("says the note for a folder in Downloads, and none for Downloads, also when Downloads is a link", () => {
      const r = checks(`mkdir -p "$HOME/RealDL/Sub" "$HOME/Other"; ln -s "$HOME/RealDL" "$HOME/Downloads"
for f in "$HOME/Downloads" "$HOME/RealDL" "$HOME/Downloads/Sub" "$HOME/Other"; do print -r -- "== $f"; EXPORTS_FOLDER="$f"; say_exports_note; done`);
      const parts = r.lines.join("\n").split("== ").slice(1).map((x) => x.split("\n").slice(1).join("\n"));
      assert.equal(parts[0], "", "Downloads, by its link: no note");
      assert.equal(parts[1], "", "Downloads, by its real folder: no note");
      assert.ok(parts[2].includes(EXPORTS_NOTE) && parts[2].includes(TIDY_LINE), parts[2]);
      assert.ok(parts[3].includes(EXPORTS_NOTE) && !parts[3].includes(TIDY_LINE), parts[3]);
    });

    describe("whole runs", () => {
      it("a refused pick says why and asks again", () => {
        const r = moveOn({ marks: NOT_INSTALLED, folderFiles: { "<HOME>/Full": ["Client Name.mov", "b.mov"], "<HOME>/Empty": [] }, picks: ["<HOME>/Full", "<HOME>/Empty"], answers: "c\nc\ny\ny\n\n" });
        assert.equal(r.status, 0, r.out);
        assert.ok(r.out.includes(`Picked: Full, in your home folder\n  Full, in your home folder holds 2 files or folders. ${NOT_EMPTY_END}`), r.out);
        assert.equal(count(r.out, DROP_QUESTION[0]), 2, "asked again");
        assert.deepEqual(installCalls(r), [printed(r, `${r.home}/Empty`), real(r, `${r.home}/Empty`)], "the refused folder never reached the installer");
        for (const text of [r.out, r.log, r.err]) assert.ok(!text.includes("Client Name"), "counted and never listed");

        // The exports question the same way.
        const exp = moveOn({ marks: NOT_INSTALLED, folderFiles: { "<HOME>/BRIMM Video Work": [] }, picks: ["<HOME>/BRIMM Video Work", "<HOME>/Exports"], answers: "y\nc\nc\nn\n" });
        assert.equal(exp.status, 1, exp.out);
        assert.ok(exp.out.includes(`Picked: BRIMM Video Work, in your home folder\n  ${STUDIO_WORDS("BRIMM Video Work, in your home folder")}`), exp.out);
        assert.equal(count(exp.out, EXPORTS_QUESTION[0]), 2);
        assert.deepEqual(installCalls(exp), [printed(exp, undefined, `${exp.home}/Exports`)]);
      });

      it("the suggested drop folder, when it holds a file, is asked again with c alone; y then stops", () => {
        const files = { "<HOME>/BRIMM Video Work/Drop": ["a.mov"], "<HOME>/Empty": [] };
        const stop = moveOn({ marks: NOT_INSTALLED, folderFiles: files, answers: "y\ny\n" });
        assert.equal(stop.status, 1, stop.out);
        assert.ok(stop.out.includes(`BRIMM Video Work › Drop, in your home folder holds 1 file or folder. ${NOT_EMPTY_END}`), stop.out);
        assert.equal(count(stop.out, DROP_QUESTION[0]), 1, "the question is not printed again");
        assert.ok(stop.out.includes("Type c and press Return to choose another folder. Anything else stops:"), stop.out);
        assert.ok(!stop.ran.includes("chooser"), "y opens no chooser");
        assert.deepEqual(installCalls(stop), [], "stopped before the print");
        assert.ok(stop.out.endsWith(STOPPED_NOTHING), stop.out);

        const go = moveOn({ marks: NOT_INSTALLED, folderFiles: files, picks: ["<HOME>/Empty"], answers: "y\nc\ny\nn\n" });
        assert.equal(go.status, 1, go.out);
        assert.deepEqual(installCalls(go), [printed(go, `${go.home}/Empty`)]);
      });

      it("a refused pick that is the folder y gives makes the next ask c alone", () => {
        const r = moveOn({ marks: NOT_INSTALLED, folderFiles: { "<HOME>/BRIMM Video Work/Drop": ["a.mov"] }, picks: ["<HOME>/BRIMM Video Work/Drop"], answers: "c\ny\n" });
        assert.equal(r.status, 1, r.out);
        assert.equal(count(r.out, DROP_QUESTION[0]), 1, "the question is not asked whole again");
        assert.ok(r.out.includes("Type c and press Return to choose another folder. Anything else stops:"), r.out);
        assert.deepEqual(installCalls(r), []);
        assert.equal(r.ran.split("\n").filter((l) => l.startsWith("chooser ")).length, 1, "the y opened no chooser");
      });

      it("with c alone offered, and the chooser not shown, the run stops with the not-empty words; after a transcript refusal, with the Tell Jason words", () => {
        const held = moveOn({ marks: NOT_INSTALLED, folderFiles: { "<HOME>/BRIMM Video Work/Drop": ["a.mov"] }, picks: ["fail"], program: ["two"], answers: "y\nc\n" });
        assert.equal(held.status, 1, held.out);
        assert.ok(held.out.includes("The window to choose a folder could not be shown, and BRIMM Video Work › Drop, in your home folder is not empty. Empty it in Finder, or tell Jason, then double-click Move to Studio again."), held.out);
        assert.deepEqual(installCalls(held), []);

        const watched = moveOn({ marks: NOT_INSTALLED, transcribe: { on: ["<HOME>/BRIMM Video Work/Drop"] }, picks: ["fail"], program: ["two"], answers: "y\nc\n" });
        assert.equal(watched.status, 1, watched.out);
        assert.ok(watched.out.includes(TRANSCRIPT_WORDS("BRIMM Video Work › Drop, in your home folder")), watched.out);
        assert.ok(watched.out.includes("The window to choose a folder could not be shown, and BRIMM Video Work › Drop, in your home folder can't be used: the transcript tool watches it. Tell Jason, then double-click Move to Studio again."), watched.out);
        assert.ok(!watched.out.includes("Empty it in Finder"), watched.out);
        assert.deepEqual(installCalls(watched), []);
      });

      it("a drop folder Terminal cannot look in keeps its y", () => {
        const r = moveOn({ marks: "tests=SHA\ndrop=<HOME>/Locked\n", folderFiles: { "<HOME>/Locked": [] }, folderModes: { "<HOME>/Locked": 0o000 }, answers: "y\ny\nn\n" });
        assert.equal(r.status, 1, r.out);
        assert.equal(count(r.out, TERMINAL_WORDS("Locked, in your home folder")), 2, "refused each time y is given");
        assert.equal(count(r.out, "Last time, this folder was picked: Locked, in your home folder."), 3, "the question comes again whole, with its y");
        assert.ok(!r.out.includes("Type c and press Return to choose another folder."), "no c alone");
        assert.deepEqual(installCalls(r), []);
      });

      it("a folder inside Downloads, picked for exports, gets its note, and Downloads itself none; nothing in Downloads is read at mode 000", () => {
        const inside = moveOn({ marks: NOT_INSTALLED, folderFiles: { "<HOME>/Downloads/Exports": [] }, picks: ["<HOME>/Downloads/Exports"], folderModes: { "<HOME>/Downloads": 0o000 }, answers: "y\nc\nn\n" });
        assert.equal(inside.status, 1, inside.out);
        assert.ok(inside.out.includes(`${EXPORTS_NOTE}\n${TIDY_LINE}`), inside.out);
        assert.deepEqual(installCalls(inside), [printed(inside, undefined, `${inside.home}/Downloads/Exports`)]);
        assert.equal(inside.err, "");

        const plain = moveOn({ marks: NOT_INSTALLED, folderModes: { "<HOME>/Downloads": 0o000 }, answers: "y\ny\nn\n" });
        assert.equal(plain.status, 1, plain.out);
        assert.ok(!plain.out.includes(TIDY_LINE) && !plain.out.includes(EXPORTS_NOTE), plain.out);
        assert.deepEqual(installCalls(plain), [printed(plain)]);

        const other = moveOn({ marks: NOT_INSTALLED, picks: ["<HOME>/Exports"], answers: "y\nc\nn\n" });
        assert.ok(other.out.includes(EXPORTS_NOTE) && !other.out.includes(TIDY_LINE), "a folder outside Downloads has no tidy line");
      });
    });
  });


});
