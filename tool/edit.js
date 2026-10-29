#!/usr/bin/env node
// The command line for episodes, which a Claude Code session on this Mac runs for the person editing: it lists the episodes and
// what is waiting, opens one, opens its main video in the HyperFrames app, shows its main timeline in Final Cut Pro through a
// copy of its own on this Mac, says what is running, and imports a video again. Each command is a function of a context, `ctx`,
// that holds this Mac's settings and the ways of doing things a test gives stand-ins for. Every file it puts into Dropbox goes
// by the rule (dropbox.js), and every change to an episode is a new record (episode.js). Long work is started detached and
// returns at once (detached.js).
//
//   node edit.js episodes                 the episodes, the videos waiting in the drop folders, the imports, and this
//                                         Mac's libraries
//   node edit.js kind "<video>" finished|raw|clip|session --private yes|no
//                                         her answer to "what is this video?": claim it, record it, and start Claude's
//                                         reading (leave "<video>" and which "<video>" are its other two answers)
//   node edit.js open "<episode>"         check its files are here, bring over those that are not, and show what is
//                                         decided for it
//   node edit.js app "<episode>"          the same claim as open's, and then its main video in the HyperFrames app,
//                                         with its project made first (app.js)
//   node edit.js app "<episode>" reel <n> the same, for Reel n of the episode: its video cut from the recording, its project
//                                         made, and the Reel picked (app-reel.js)
//   node edit.js push "<episode>" [main] [--no-hand-edits | --hand-edits]
//                                         show the main timeline in Final Cut Pro, as a new version, in this Mac's
//                                         library for the episode
//   node edit.js status ["<words>"]       what is running on this Mac, the imports, and what detached runs left
//   node edit.js retry "<video>"          import again a video in this Mac's drop folder whose import failed or stopped
//   node edit.js name, title, reel drop, push … reel <n>
//                                         the episode's name, its title, its Reels, and a Reel shown in Final Cut Pro
//   node edit.js finish "<episode>"       gather what Final Cut Shared and exported, ask what it must, and then, detached,
//                                         transcribe again, copy into final/ and write the hand-off for BRIMM Ops
//   node edit.js free "<episode>"         take the working copy and the renders of its HyperFrames projects away from this
//                                         Mac to give the room back, by named paths in BRIMM Video Work alone (free.js)
//
// Everything it prints goes into Sallie's Claude chat. So a command that names an episode is checked first against the
// episode's record (gate.js, asked by findEpisode): for a video not yet answered, and for a client or group session, only a few
// commands run, and every other is refused before it reads a word. A command that says a session's words, under Claude Code, marks
// the chat first (held.js); on an open-lock Mac it says them into a file only that chat may read, and tells the chat the file.
//
// It never posts, sends or publishes anything.
import { spawnSync } from "node:child_process";
import { promises as dns } from "node:dns";
import { appendFileSync, chmodSync, constants as fsConstants, copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmdirSync, rmSync, statfsSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stamp, localDay } from "./shared/text.js";
import { readEpisode, filesProblems, undone, writeEpisode, localStamp, acceptRev, shown as shownAt, claimed, heldElsewhere, heldText, released, conflictedCopies, conflictedOf, conflictedBy, recordFile, recordNumbers, ofTheSwitch, isAnswered, shownName, kindOf as recordKind } from "./episode.js";
import { appOf, effectiveLock, readSettings, teachingsOn, teachingsLapsed, lightImport, episodesFolder, workFolder, episodeWork, pushedFolder, libraryFor, runsFolder, dropFolder, fromFinalCutFolder, studioAllowOf } from "./settings.js";
import { SESSION as SESSION_COMMANDS, SESSION_TAUGHT, UNSCOPED, gateFor, heldGateFor, printWhy, gated, leftAlone, sessionNotCleared, heldName, gatedName, gatedAsOf, withShortId } from "./gate.js";
import { isSeenLine, isZoomName, namesOf, sessionLabel, sizeText, spokenMac, unlabelled, withoutNames } from "./kinds.js";
import { progressFolder, readRates, reporter } from "./progress.js";
import { startDetached, runDetached, runningCommand, runningRun, readResult, takeEpisodeLock, releaseEpisodeLock } from "./detached.js";
import { cloneIn, isWhole, onSameDisk, readThrough, replaceIn, textWriter, LATE_CHECK_MS } from "./dropbox.js";
import { localMedia, retitle, withImportOptions, mediaIn } from "./portable.js";
import { eventName, fileSafe, projectName, timelineFile } from "./names.js";
import { REELS_FILE, readReels, reelsText, uncropped, notMadeWords } from "./reels.js";
import { readStatuses, importState, removeStatus } from "./importing.js";
import { heldBy, commitOf, episodeHolding, holdingEpisode, readSeen, seenKey, readPendings, dueAt } from "./filing.js";
import { reelTimeline } from "./reel.js";
import { partsOf, lookFor, unkeptParts, kindOf } from "./parts.js";
import { finishNow, finishFinished, finishSession, madeFromImport, importKind, whatIs, expectedWords, letGoClaim, cannotFinish, handoffTarget, writesV2For, numbersTakenWords, linksOf, handedOff, chainGap, chainGapWords, movedIdWords, ownHandoffs, handoffIdIn } from "./finish.js";
import { DOWNLOADS_UNREADABLE, NEVER_OPENED, exportsFound, lookForExports } from "./exports.js";
import { timelineFor, clockFor, piecesOf, askedOf, newestOf, newestIsRender } from "./timeline.js";
import { momentOf, cutNear, clockText, timelineAt, wordsAt, secondsOf, rawAt, lengthOf, FRAME_SLACK } from "./clock.js";
import { pictureNameFault, pictureSize } from "./pictures.js";
import { spellingFault, withSpelling, respelledPart, respelledHandoff, respelledHandoffV2 } from "./spelling.js";
import { handoffText, handoffFault } from "./handoff.js";
import { buildHandoffV2, handoffFaultV2, VERSION_2 } from "./handoff-v2.js";
import { presetOf } from "./layers.js";
import { JOBS, CAPTION_STYLES, LOOKS, defaultPreset, presetFault, nameOf, idOf } from "./styles.js";
import { cutSpan, cutPhrases, keptRanges } from "./recut.js";
import { REEL_FRAME } from "./reels.js";
import { findPrograms, askAgain, askBlocked, clockAt, facesIn, importHold, keptList, banner } from "./unedited.js";
import { readEpisodeNow, accountOf, READ_KINDS, READ_HOLD_MS, READ_LOOK_MS, rulesPlanKept } from "./reading.js";
import { approve, EDITS } from "./sessions.js";
import { ITEM_LISTS, CHECK_NAMES, SESSION_LABEL, SESSION_NAME_MOST, accountWhy, teachingsWhy, sessionReading, readTeachings, itemsOf, seenFrom, sessionSeen, herWordsName, isFilesName, isTeachingsName, isTeachingsFile, principleLines, recurringLine, ideaLines, takenLines } from "./teachings.js";
import { isMedia } from "./lib.js";
import { studioFiles, studioFolder } from "./studio.js";
import { LOCK_CHANGED, factsFor, lockFor, lockLoosened, trustWhy } from "./loosened.js";
import { sandboxedWhy } from "./sandboxed.js";
import { afterAllNoted, clearOldWords, markChat, noteAfterAll, writeWords } from "./held.js";
import { SESSION_ID } from "./scan.js";
import { processTable, readProcesses } from "./chain.js";
import { SHOWN_MARKER, addShown, cantOpen, clearShownIn, freeShownName, madeShownByIdFolder, revealed, shownByIdFolder } from "./reveal.js";
import { NO_RECEIPT, cardOf, expectedAnswers, notSessionCardOf, receiptWhy, sessionByFollowUp } from "./receipts.js";
import { isRunning, lastLine, runProgram } from "./run.js";
import { askDialog } from "./dialog.js";
import { NOT_SET_UP, OPS_PAGE, ZOOM_WORDS, WAIT_MS, POLL_MS, dropWords, noteAfter, nextFor, ordered, findIn, overviewLines, videoLines, signatureOf, readyIn, roughIn, copyIn, apart, COMING, TELL_MS, TELL_POLL_MS, trailOf, follow, told, stillLine } from "./guide.js";
import { readGuideNotes, writeGuideNotes } from "./guide-note.js";
import { NOT_SET_UP as APP_NOT_SET_UP, KEPT as PROJECT_KEPT, isMain as inUse, openInApp, plainName, projectOnAnotherMac } from "./app.js";
import { REEL_COPY_KINDS, madeInApp, makeOneWords, notMadeYet, openReelInApp, openReelWords, reelAsked, reelStretch, reelWhy } from "./app-reel.js";
import { historyTail, turnTime, versionsOf, whatHappened } from "./app-history.js";
import { freeEpisode } from "./free.js";
import { PIN, cliPath, toolchainDiffers, toolchainHolds, turnsOf } from "./hyperframes.js";
import { REEL_FACES_MS, WORK_COPY_COMMAND, WORK_COPY_WAIT_STEP, canNotBeUsed, makeWorkCopy, requestWorkCopy, workCopyLockOf } from "./workcopy.js";

export const HELP = `The command line for episodes on this Mac. Claude runs it for the person editing.

  node edit.js episodes                 the episodes, the videos waiting in the drop folders, the imports, and this
                                        Mac's libraries
  node edit.js guide ["<video>"]        the one next step for each video under way, in her words: a video waiting for her
                                        answer first, then the newest; this Mac's drop folder in Finder's words; and how
                                        many videos from before the switch are not guided. With a video, its next step,
                                        and for a step on the BRIMM Ops page the step after it. A raw video and an iPhone
                                        clip are followed through HyperFrames: while its video is made, how long is left;
                                        then to open it there; once it is open, when she last asked the app for something;
                                        and once it is exported, to hand it off. A raw video that goes the Final Cut way
                                        keeps its Final Cut steps. Only on a Mac that does the light import: on any other,
                                        every form says to ask Jason
  node edit.js guide drop [zoom] | page | wait
                                        open this Mac's drop folder in Finder (with zoom, Zoom Video Transfer), open the
                                        BRIMM Ops page in the default browser, or wait up to 90 seconds for a change in
                                        what the guide says: at once when no video is coming in, being imported, being
                                        read or having its video for HyperFrames made
  node edit.js guide "<video>" done <step> | finished | show | tell
                                        note on this Mac that she did its step on the BRIMM Ops page (only the step that
                                        comes next), that she is done with the video, or show in Finder what its step needs.
                                        With tell, wait up to 60 minutes for its next point (ready, read by Claude, its
                                        video for HyperFrames made, or an import or reading that did not finish), then say
                                        it in one line. Her skill runs it in the background
  node edit.js kind "<video>" finished|raw|clip|session --private yes|no [--version-of <id>|none] [--not-a-session]
                     [--again] [--clear-session] [--here]
                                        her answer to what a video is: both answers are needed, and they must agree (a
                                        session with yes, anything else with no). The video is claimed for this Mac, the
                                        answer is recorded, and Claude reads it, detached, unless it is a session: that is
                                        marked, named by its label, and read only when its teachings are asked for. An
                                        answered video is answered again only with --again, which sets its earlier
                                        reading's files and its hand-off aside in history/, and keeps the video it is a
                                        version of; answered again as a session, every file of final/ goes, and it is given
                                        at once an empty session revision of its hand-off. --version-of names the video this
                                        is a new version of, or none; --not-a-session says a Zoom download or sound alone is
                                        none; --clear-session, with --again and what the video really is, clears a session
                                        mark: it asks on a dialog on this Mac, and only her click clears it. A raw video not
                                        on this Mac yet is read here only with --here, which brings it all over first
  node edit.js leave "<video>"          leave a video that is not for brimm-video: it is not asked about again
  node edit.js which "<video>"          open the video in QuickTime Player on this Mac, to see which one it is
  node edit.js teachings "<session>" [--transcript-only]
                                        her answer for a client or group session: its teachings, which Claude reads once,
                                        detached, only once Jason has turned teachings on for this Mac; or with
                                        --transcript-only, its transcript alone, and nothing goes to Claude
  node edit.js principles "<session>" [recurring] [keep <n>… | drop <n>… | edit <n> --<what> "<words>"]
                                        the principles Claude read in a session, and what is decided of each: keep, drop or
                                        change them; with recurring, the principles said more than once
  node edit.js ideas "<session>" [keep <n>… | drop <n>… | edit <n> --<what> "<words>"]
                                        the Reel ideas Claude read in a session: keep, drop or change them
  node edit.js open "<episode>" [--take-over]
                                        check its files are here, bring over those that are not, claim it for this
                                        Mac, and show what is decided for it. Another Mac's claim refuses it, unless
                                        it is taken over
  node edit.js app "<episode>" [--take-over]
                                        open the episode's main video in HyperFrames, making its project first. Its
                                        files are checked and brought over, and it is claimed for this Mac, as open
                                        does; another Mac's claim refuses it, unless it is taken over. Only on a Mac
                                        that Jason has set up for HyperFrames
  node edit.js app "<episode>" reel <n> [--take-over]
                                        make Reel <n>, one of Claude's suggestions, a project of its own in HyperFrames,
                                        open it, and pick it. Its video, the suggestion's stretch of the recording, is
                                        made first: it is asked for, and the Reel is opened when it is said again. Its
                                        files are checked and brought over, and it is claimed for this Mac, as above.
                                        For a finished video too. Reels are made here, never by HyperFrames itself
  node edit.js app "<episode>" what-happened
                                        what was done in HyperFrames on the episode's main video, newest first, under
                                        the day it happened: what she asked, what the app said, and the files it
                                        changed, from the history the app keeps in the project. It looks at this Mac's
                                        project, and claims nothing, brings nothing and writes nothing. Only on a Mac
                                        that Jason has set up for HyperFrames
  node edit.js app "<episode>" versions
                                        the versions HyperFrames has kept of the episode's main video, newest first,
                                        under the day they were made: when, who, what each was called, and the files it
                                        changed, from the history the app keeps. It changes no history, claims nothing
                                        and writes nothing. Only on a Mac that Jason has set up for HyperFrames, with
                                        its command line
  node edit.js push "<episode>" [main] [v<n>] [--no-hand-edits | --hand-edits] [--without-other-macs-changes]
                                        show the main timeline in Final Cut Pro, as a new version, in this Mac's
                                        library for the episode; with v<n>, version n as it was stored. Shown last in
                                        Final Cut, it asks first whether it was changed there: --no-hand-edits says it
                                        was not, --hand-edits that it was (a version rendered last asks nothing). Shown
                                        last on the other Mac, it goes by what that Mac said when it handed the episode
                                        over; --without-other-macs-changes goes ahead from that version as brimm-video
                                        made it
  node edit.js status ["<words>"]       what is running on this Mac, the imports, and what detached runs left
  node edit.js retry "<video>"          import again a video in this Mac's drop folder whose import failed or stopped
  node edit.js name "<episode>" "<name>"
                                        give the episode its name. Nothing is renamed
  node edit.js title "<episode>" [--words "<words>"] [--approve] [--change]
                                        show its title, or set it and approve it. An approved title changes only with
                                        --change, since BRIMM Ops may already have it
  node edit.js title "<episode>" reel <n> [--words "<words>"]
                                        show or set the title on screen of a Reel: the words in its picture. A Reel
                                        HyperFrames has opened has one; one nobody has made is refused, and on a Mac
                                        set up for HyperFrames she is told how to make it
  node edit.js reel drop "<episode>" <n>…
                                        drop Reels: leave them out. A Reel is picked by making it, with app … reel <n>
  node edit.js reel "<label>" <n> --client-agreed
                                        for a client or group session: notes, on a dialog on this Mac that only her click
                                        answers, that the client agreed to a kept Reel idea being cut from it. Who agreed
                                        stays on this Mac
  node edit.js reels "<episode>" [--no-play]
                                        list the Reel candidates, and play their previews in QuickTime Player; for a
                                        video she has answered, its Reel suggestions with times on the clock she is
                                        reading, and nothing opens; then how to make one in HyperFrames, on a Mac
                                        set up for it
  node edit.js ask "<episode>"          ask Claude again for Reel candidates, detached. Picked Reels stay as they are.
                                        A video she has answered is read again as its kind, as kind … --again does
  node edit.js push "<episode>" reel <n> [v<k>] [--no-hand-edits | --hand-edits]
                                        show a picked Reel in Final Cut Pro, upright; with v<k>, its version k as it was
                                        stored
  node edit.js finish "<episode>" [--yes] [--take "<part>=<file | this Mac | the other Mac>"] [--final "<part>"]
                     [--no-hand-edits "<part>"] [--without "reel <n>"] [--as-it-is]
                                        find what HyperFrames exported of each part (in Downloads, or where the export's own
                                        record says it went), or for a video edited in Final Cut what Final Cut Shared and
                                        exported, and ask what it must. --final says an export is the final one though the
                                        project changed after it. With --yes and nothing left to ask, it transcribes the
                                        finished videos again, copies them into final/ and writes the hand-off for BRIMM Ops,
                                        detached. An iPhone clip she answered that was not opened in HyperFrames is asked
                                        about once; --as-it-is writes its hand-off from the import's captions
  node edit.js show "<episode>" transcript|notes|plan
                                        print its transcript (a raw video's she has answered: its rough cut's, or, with a
                                        HyperFrames project in use, the recording's own), Claude's notes or its cut plan,
                                        whole. Of a video not yet answered, or a session, nothing is printed: a read-only
                                        copy of it opens in TextEdit on this Mac
  node edit.js behind                   whether Jason has a newer brimm-video than this Mac's; and the copies show
                                        opened are cleared. It refuses, and says to ask Jason, when her folder's lock is
                                        changed on this Mac: a settings.local.json in it, or hooks turned off
  node edit.js resolve "<episode>" [--keep A|B]
                                        show the two sides of a conflicted copy Dropbox kept, and keep the one picked:
                                        the other is set aside in the episode's history/
  node edit.js release "<episode>" [--no-hand-edits | --hand-edits-stay]
                                        hand the episode over to the other Mac: copy this Mac's Shares and exports of it
                                        into its folder, and let it go. When this Mac pushed a part last, it asks first
                                        whether it was changed in Final Cut since: --no-hand-edits says it was not,
                                        --hand-edits-stay that the changes stay in this Mac's library
  node edit.js free "<episode>"         take away, on this Mac, the video HyperFrames was given for the episode's main
                                        project and what it rendered for every project, to give the room back. Their projects
                                        and everything done in them stay, and app makes the main video again; a Reel's video
                                        and a kept project's stay, since nothing can make them again yet. It refuses while the
                                        other Mac has the episode, while HyperFrames is running or cannot be told, while
                                        something is at work on the episode, while a video HyperFrames rendered may be kept
                                        nowhere else (the episode is not handed off yet), and when the recording is not in the
                                        episode as the project was made from it: the video could not be made again. It takes
                                        no flag. Deleting a Final Cut library by command is not built: free "<episode>"
                                        library says so
  node edit.js captions "<episode>" reel <n> on|off
                                        a Reel's running captions, in its caption style; its title on screen stays
  node edit.js spell "<episode>" [add "<as heard>" "<as spelled>" [add …]… | drop "<as heard>" | offers [all | none | <n> <n>…]]
                                        the episode's spellings, which every timeline's captions take; several pairs of
                                        add are one change; after a finish, the final transcripts too, and the hand-off is
                                        made again. offers shows the spellings Claude offered as one numbered card, or
                                        answers them (all, some or none), and a finished video's or an iPhone clip's
                                        hand-off is then written
  node edit.js logo "<episode>" on|off [--picture "<name>"]
                                        the logo on the main video, top right; its picture is named once, from the
                                        Pictures folder
  node edit.js text "<episode>" add lower-third [main | reel <n>] (--at <time> | --at-words "<words>") [--for <seconds>]
                     --line "<name>" [--line "<role>"] [--no-hand-edits]
                                        a name over a role, at a time on the timeline or the words said there; "drop
                                        <id>" takes one off, and with neither, the list
  node edit.js graphic "<episode>" add "<picture>" [main | reel <n>] (--at <time> | --at-words "<words>" | --idea <n>)
                     [--for <seconds>] [--place full|corner|lower] [--no-hand-edits]
                                        a picture from the Pictures folder over the timeline; "drop <id>" takes one off,
                                        "ideas" lists Claude's, numbered, with their times on the timeline, and with
                                        neither, the list. --idea <n> puts it at idea n's words, for as long as they take,
                                        in the corner or the lower third when the idea says so
  node edit.js preset "<episode>" [main | reel <n>] [--job "<job>"] [--captions "<style>"] [--look "<look>"]
                                        the timeline's job, caption style and look; with none, what it has and what
                                        there is
  node edit.js cut "<episode>" remove [main | reel <n>] (--words "<words>" | --at <time> --to <time>) [--no-hand-edits]
  node edit.js cut "<episode>" keep [main | reel <n>] (--words "<words>" | --at <time>) [--no-hand-edits]
                                        take whole phrases out, at a pause, as read on the timeline; or keep what was
                                        cut, by its words or at the join nearest a time on the timeline`;

/** The home folder commands work from: the one a test gives, else the one HOME names, else the Mac's own word for it. */
const homeOf = (deps) => deps.home || process.env.HOME || homedir();

/** The context every command is given: this Mac's settings and what it finds from them, and the ways of doing things,
    each the Mac's own unless a test gives another. {why} when this Mac has no settings for episodes. */
export function contextFor(deps = {}) {
  const home = homeOf(deps);
  const got = deps.settings ? { settings: deps.settings } : readSettings(home);
  if (!got.settings) return { why: "This Mac is not set up for episodes yet. Jason runs install.sh --machine on it." };
  const { settings } = got;
  // The names of a gated video that a command has found (findEpisode, hideNames), which no line it says after may hold.
  const hidden = { names: [], keep: [] };
  // A session's words the command says, once the chat is marked (holdWords): on an open-lock Mac every line from then on is kept
  // in `lines`, for editMain to write into the chat's words file (handOverWords), and none is said.
  const words = { marked: false, lines: null, session: null, label: "" };
  const say = deps.say || ((line) => process.stdout.write(`${line}\n`));
  return {
    settings,
    machine: settings.machine,
    root: settings.root,
    episodes: episodesFolder(settings.root),
    home,
    // Only the names are taken out: any other path in a line stays readable.
    say: (line) => {
      const shown = hidden.names.length ? withoutNames(line, hidden.names, hidden.keep, { paths: false }) : line;
      if (words.lines) words.lines.push(shown);
      else say(shown);
    },
    hidden,
    words,
    now: deps.now || Date.now,
    statfs: deps.statfs || statfsSync,
    stat: deps.stat || ((path) => statSync(path, { throwIfNoEntry: false })),
    alive: deps.alive || isRunning,
    isWhole: deps.isWhole || ((path) => isWhole(path)),
    start: deps.start || startProgram,
    openApp: deps.openApp || openApp,
    kickstart: deps.kickstart || kickstart,
    agentRunning: deps.agentRunning || agentRunning,
    readPlist: deps.readPlist || readPlist,
    deps
  };
}

/** The episodes' folders in Episodes, newest first by their names, which start with the day. */
function folders(ctx) {
  try {
    return readdirSync(ctx.episodes).filter((name) => !name.startsWith(".")).sort().reverse();
  } catch (e) {
    return [];
  }
}

/** A name as it is compared with what a person said: whatever its case, and however its accents are written. */
const plainly = (text) => String(text || "").normalize("NFC").toLowerCase();
/** A label as it is compared with what a person said: as plainly does, and whatever its spacing. */
const spaced = (text) => plainly(text).replace(/\s+/g, " ").trim();

/** Some things as they are said in a row: "a", "a and b", "a, b and c". */
const listed = (things) => (things.length < 2 ? things.join("") : `${things.slice(0, -1).join(", ")} and ${things[things.length - 1]}`);

/** An episode whose record a newer brimm-video wrote, as it is named: by its short id alone, "an episode a newer brimm-video
    wrote (3fa9c1)". Never by its folder, whose name may be a client's: that record may be a session or a video not yet
    answered, and this brimm-video cannot read the label a newer one names it by. */
const newerName = (record) => `an episode a newer brimm-video wrote (${record.id.slice(-6)})`;

/** Why a command ends at an episode written by a newer brimm-video, in the words it has always used: by its short id alone. */
const newerWhy = (record) => `That is ${newerName(record)}. Jason has a newer brimm-video. Ask him to update this Mac.`;

/** What the gate says when the record in force is not the newest file in the episode's record folder, for a record that may be a
    session: Dropbox is still bringing the newer one, or it is one this code rejects. */
const PENDING_WHY = "Dropbox is still bringing this episode's record over: say it again in a moment.";

/** Whether a conflicted copy is shaped as a record: an object with an id and a version. What is not (`{}`, a file by the name of
    a record) says nothing of the video and is not asked; what is, and says no kind, is asked, and is a video not answered. */
const recordShaped = (r) => typeof r.id === "string" && Number.isInteger(r.version);

/** Whether the gate (gate.js) refuses the command editMain is running (`ctx.asked`, with its words) for the episode `e`, whose
    records are `records` and whose record in force is `inForce`: { why, name, folder, gate: true }, in the gate's words (the
    name and folder are for the detached runs that leave a result, and are never said), or null when it may run. `said` is
    what the episode was asked for by. The records are all that findEpisode knows of an episode, and all that is read here
    (and the numbers of the files in its record folder). In this order:
    - A command that names no episode (UNSCOPED), and a call with no command on ctx, are not gated.
    - A record of a layout newer than this code is refused for every command that names an episode, in the words episodeFor has
      always used for it, with `newer: true`, so that episodeFor ends the command with the code that command gives such a record.
    - A record file numbered above the one read, which Dropbox is still bringing over or this code rejects, may be a video corrected
      to a session or not answered: on a Mac that does the light import, or when the record read is of the switch's layout (3), it
      refuses every command. With today's settings and records it is passed over, as it always was.
    - A conflicted episode is refused when any one of its records is, so that a copy not answered, or a session's, is not got round
      by the record in force. A copy that is not shaped as a record (recordShaped) is not asked.
    - A video held as a session (`e.held`: one of its other versions is a session not cleared) runs only what gate.js heldGateFor
      lets run, the commands of a video not yet answered. */
function gateOf(ctx, e, records, said, inForce) {
  if (!ctx.asked || UNSCOPED.includes(ctx.asked.command)) return null;
  const refused = (why, more = {}) => ({ why, name: e.name, folder: e.folder, gate: true, ...more });
  if (e.read.newer) return refused(newerWhy(e.read.record), { newer: true });
  if (inForce && (lightImport(ctx.settings) || ofTheSwitch(inForce)) && recordNumbers(e.folder)[0] > inForce.rev) return refused(PENDING_WHY);
  const on = teachingsOn(ctx.settings, ctx.now());
  const lapsed = teachingsLapsed(ctx.settings, ctx.now());
  for (const record of records.filter(recordShaped)) {
    const why = gateFor(ctx.asked.command, record, { teachingsOn: on, lapsed, said }, ctx.asked.words);
    if (why) return refused(why);
  }
  // A video one of whose other versions is a session not cleared is held as a session (episodeAt's `held`): fail closed.
  if (e.held) {
    const why = heldGateFor(ctx.asked.command);
    if (why) return refused(why);
  }
  return null;
}

/** A detached run (`bring`, `finish`, `ask`, `read` or `workcopy` with --now) that the gate ended before it began leaves a result
    in the gate's words, as a run that failed does, so that "how far is it?" says why and not that nothing is running. The words
    name no folder or file. A run already at work on the episode is left to leave its own. The working copy's run has a lock of
    its own, `lock` (workcopy.js workCopyLockOf), so that the reading, which holds the episode's, does not stop its result being
    left: every other run is left under the episode's. */
async function leaveGateResult(ctx, found, command, lock) {
  await runDetached({ home: ctx.home, folder: found.name, clean: resultClean(ctx), command, lock, alive: ctx.alive, keepAwake: () => {} }, async () => ({ ok: false, failed: [found.why] }));
}

/** An episode in Episodes by its folder's `name`, as findEpisode and the lists know it: { name, folder, read, inForce, records,
    newer }. `read` is what readEpisode gave; `inForce` is the record in force: the whole one, or for a conflicted episode the
    newest whole record past its copies; `records` are the records it is known by, and all that is read of it: that one, and for
    a conflicted episode each conflicted copy of a record, as it is, which may not be whole. `newer` is the record a newer
    brimm-video wrote, when one did, the one past the copies included; null otherwise. `held` is whether the episode is held as
    a session though none of its records is gated: one of them is answered, and one of its other versions (finish.js linksOf,
    sessionsBeside), in its record or a conflicted copy of it, is a session not cleared. It is read only when it is asked, through
    `links` when it is given (one reading of Episodes for every episode a command looks at), and is false for one a newer
    brimm-video wrote. */
function episodeAt(ctx, name, links = null) {
  const folder = join(ctx.episodes, name);
  const read = readEpisode(folder);
  const past = read.code === "CONFLICTED" ? readEpisode(folder, { pastCopies: true }) : null;
  const inForce = read.record || (past ? past.record : undefined);
  const copies = past ? conflictedCopies(folder).filter((c) => /^record\/\d{4}\.json$/.test(conflictedOf(c))).map((c) => recordAt(join(folder, c))) : [];
  const records = (read.record ? [read.record] : past ? [inForce, ...copies] : []).filter((r) => r !== null && typeof r === "object" && !Array.isArray(r));
  const newer = read.newer ? read.record : past && past.newer ? past.record : null;
  noteSessionsAfterAll(ctx, records);
  let held;
  return {
    name, folder, read, inForce, records, newer,
    get held() {
      if (held === undefined) {
        const shaped = records.filter(recordShaped);
        held = !newer && !shaped.some(gated) && shaped.some((r) => recordKind(r) !== null && (links || (links = linksOf(ctx.root))).sessionsBeside(r, folder).length > 0);
      }
      return held;
    }
  };
}

/** Note each of `records` that is a session after all (its `session.emptyRevision` is set: it was read as another kind, and answered
    a session since) the first time this Mac reads it at that revision, with the time it is read (held.js noteAfterAll; design
    2026-10-26, R9): every chat begun before then may hold its words, and is held. episodeAt reads every record so, for `episodes`,
    `status`, `guide` and findEpisode alike (`behind` reads no record, so it notes none), so the other Mac notes it at the start of
    her next chat. A note that cannot be written now is tried again at the next read, which notes a later time and so holds more
    chats, not fewer. */
function noteSessionsAfterAll(ctx, records) {
  for (const r of records) {
    const revision = r.session !== null && typeof r.session === "object" && !Array.isArray(r.session) ? r.session.emptyRevision : undefined;
    if (revision === undefined || revision === null || afterAllNoted(ctx.home, r.id, revision)) continue;
    try {
      noteAfterAll({ home: ctx.home, id: r.id, revision, at: new Date(ctx.now()).toISOString() });
    } catch (e) {
      // Tried again at the next read.
    }
  }
}

/** Whether an episode is gated (gate.js): any record it is known by is a video not yet answered or a session not cleared, so
    that a conflicted copy of one names it so, as the gate asks it; or it is held as a session (episodeAt's `held`). A copy not
    shaped as a record is not asked. */
const isGated = (e) => e.records.filter(recordShaped).some(gated) || e.held;

/** The record a gated episode is named by: the first of its records that is gated, or for one held as a session, its record in
    force. */
const gatedRecord = (e) => e.records.filter(recordShaped).find(gated) || (e.held ? e.inForce : undefined);

// isLabelled, heldName, gatedName and gatedAsOf, how a gated record or one held as a session is named, are gate.js's: the
// installer's check of the old drop folder (switch.js) names a video by them too.

/** How the record of the episode `found` (findEpisode's) is named in what a command says of it: as gatedName names it. */
const namedAs = (found, record) => gatedName(record, Boolean(found && found.held));

/** An episode whose record cannot be read at all, as it is named on a Mac that does the light import: by the day and the Mac its
    folder's name begins and ends with (names.js episodeFolderName), as "an episode of 2026-10-22 from the Mac Studio whose
    record cannot be read", and never by the rest, which is the video's file's name. */
function unreadName(name) {
  const m = FOLDER_NAME.exec(name);
  return `an episode${m ? ` of ${m[1]} from ${spokenMac(m[2])}` : ""} whose record cannot be read`;
}

/** An episode folder's name, as names.js episodeFolderName makes it: the day, the video's name and, in brackets, the Mac, with a
    number after it when the name was taken. */
const FOLDER_NAME = /^(\d{4}-\d{2}-\d{2}) .*\(([^()]+)\)(?:-\d+)?$/;

/** How an episode is named in a list of several, and wherever edit.js would name it by its folder: a gated one by its label and
    its short id, since two labels may be the same (shownName); one a newer brimm-video wrote by its short id alone
    (newerName); on a Mac that does the light import, one with no record that can be read by its day and Mac alone
    (unreadName); and any other by its folder's name, as always. */
function listedAs(ctx, e) {
  if (e.newer) return newerName(e.newer);
  if (isGated(e)) {
    const r = gatedRecord(e);
    // A gated video, or one held as a session, with no label is named by its short id already: it is said once.
    return withShortId(gatedName(r, e.held), r);
  }
  if (!e.inForce && lightImport(ctx.settings)) return unreadName(e.name);
  return e.name;
}

/** The episode `found` (findEpisode's), as a line names it where it would name its folder: as listedAs names it. */
const calledAs = (ctx, found) => listedAs(ctx, episodeAt(ctx, found.name));

/** What a line about the gated episode `e` must not hold, and what it keeps: { names, keep }. The names are its folder's, its
    video's file and what is named from it (namesOf), every name its records have given it and that in its file-safe form, and
    the name of every project it was pushed to Final Cut by, from the records in its record folder and its conflicted copies
    alike; a record there that is not whole on this Mac (`ctx.isWhole`) is not read, since Dropbox would have to bring it. What
    it keeps is how it is named now (shownName) and each label its records hold, but for a kept text that holds a name, or
    that a name holds: so that a session whose name is still its file's does not take the name out of what is hidden. */
function secretsOf(ctx, e) {
  const isRecord = (r) => r !== null && typeof r === "object" && !Array.isArray(r);
  const history = recordNumbers(e.folder).map((n) => recordFile(e.folder, n)).filter((file) => ctx.isWhole(file)).map(recordAt);
  const all = [...e.records, ...history].filter(isRecord);
  const labels = all.flatMap((r) => [typeof r.label === "string" ? r.label : "", gated(r) ? shownName(r) : e.held ? heldName(r) : ""]).filter(Boolean);
  const given = all.map((r) => (isRecord(r.name) && typeof r.name.text === "string" ? r.name.text : "")).filter((n) => n && !labels.includes(n));
  const parts = all.flatMap((r) => [r.main, ...(Array.isArray(r.reels) ? r.reels : [])]).filter(isRecord);
  const projects = parts.flatMap((part) => (Array.isArray(part.pushed) ? part.pushed : [])).map((p) => (isRecord(p) ? p.project : ""));
  const names = [...new Set([e.name, ...all.flatMap((r) => namesOf(r.video && r.video.file)), ...given, ...given.map(fileSafe), ...projects])].filter((n) => typeof n === "string" && n !== "");
  const lower = (text) => text.normalize("NFC").toLowerCase();
  const keep = [...new Set(labels)].filter((k) => !names.some((n) => lower(k).includes(lower(n)) || lower(n).includes(lower(k))));
  return { names, keep };
}

/** Text about the episode `e` with nothing in it of its video's names when it is gated (secretsOf), and as it is otherwise. Only
    the names are taken out: any other path in it stays readable. */
const cleanFor = (ctx, e) => {
  if (!isGated(e)) return (text) => text;
  const { names, keep } = secretsOf(ctx, e);
  return (text) => withoutNames(text, names, keep, { paths: false });
};

/** Have every line the command editMain is running says from here on hold nothing of the names of `e`, the gated episode it
    found (ctx.hidden, which contextFor's `say` reads): for a command that names an episode, since its own lines may name a file
    or a folder of it on the way, as an error does. A command of UNSCOPED names each episode as it is to be named, and is left
    alone. */
function hideNames(ctx, e) {
  if (!ctx.hidden || !ctx.asked || UNSCOPED.includes(ctx.asked.command) || !isGated(e)) return;
  const { names, keep } = secretsOf(ctx, e);
  ctx.hidden.names.push(...names);
  ctx.hidden.keep.push(...keep);
}

/** What a detached run writes into its result for an episode, by what the command found (ctx.hidden): nothing of a gated
    video's names. Undefined, so that runDetached writes it as it is, for any other. */
const resultClean = (ctx) => (ctx.hidden && ctx.hidden.names.length ? (text) => withoutNames(text, ctx.hidden.names, ctx.hidden.keep, { paths: false }) : undefined);

/** What is said of the episode `found` when its record cannot be gone on with, as `found.read` says why (a conflicted copy, a
    folder that cannot be read): "<said>: <why>.", as always, where `said` is the folder as the command was given it. But a
    gated episode is named by its label and short id, and its why names no file of its video; one a newer brimm-video wrote is
    named by its short id; and on a Mac that does the light import, one with no record that can be read at all is named by its
    day and Mac alone, and Jason is asked. */
function notRead(ctx, found, said = found.name) {
  const e = episodeAt(ctx, found.name);
  const shown = listedAs(ctx, e);
  if (shown === e.name) return `${said}: ${found.read.why}.`;
  if (!e.inForce) return `${capital(shown)}: ask Jason.`;
  const clean = e.newer ? (text) => withoutNames(text, [e.name, ...namesOf(e.newer.video && e.newer.video.file)], [], { paths: false }) : cleanFor(ctx, e);
  return `${capital(shown)}: ${clean(found.read.why)}.`;
}

/** What a command ends with when the chat it runs in cannot be marked as holding a session's words, or, on an open-lock Mac, when
    the chat's id is not one a words file can be named by: the words are shown nowhere. */
export const MARK_FAILED = "This chat could not be marked as holding a session's words, so they are not shown here: ask Jason.";

/** The one line a chat is told on an open-lock Mac in place of a session's words: the video's label, and the file they are in. */
export const wordsLine = (label, path) => `${label}: a session's words are in a file for this chat alone: ${path}`;

/** The commands that say a session's words (design 2026-10-26, R8): those a session runs once the training gate is on, beyond
    those it runs with the gate off (gate.js SESSION_TAUGHT beyond SESSION): `teachings`, `principles`, `ideas`, `finish`, `reel`
    and `render`. Not `read`, the reading's own detached run, which prints to no chat. */
const SAYS_WORDS = SESSION_TAUGHT.filter((command) => !SESSION_COMMANDS.includes(command) && command !== "read");

/** Once the gate lets a command run for the episode `e`: when the command is one that says a session's words (SAYS_WORDS), a record
    of `e` is a session not cleared, it runs under Claude Code (CLAUDECODE=1 in deps.env, else this process's) and her folder is on
    this Mac, mark the chat first (held.js markChat: its id, and the claude above this process in `ps`'s table, deps.ps and
    deps.pid being a test's), on a strict Mac as on an open one (R7). A detached run is not under Claude Code (spawnDetached), so it
    is never marked; nothing is decided by the word `--now`. Then, only where the lock in effect is open, every line the command
    says from here on is kept for the chat's words file (ctx.words; handOverWords). { why: MARK_FAILED } ends the command when the
    mark cannot be written, or, on an open-lock Mac, when the chat's id is not a chat's; null lets it go on. A command marks once. */
function holdWords(ctx, e) {
  if (!ctx.asked || !ctx.words || ctx.words.marked || !SAYS_WORDS.includes(ctx.asked.command)) return null;
  const session = e.records.filter(recordShaped).find(sessionNotCleared);
  if (!session) return null;
  const env = ctx.deps.env || process.env;
  if (env.CLAUDECODE !== "1" || !existsSync(studioFolder(ctx.home))) return null;
  try {
    const table = processTable((ctx.deps.ps || readProcesses)());
    markChat({ home: ctx.home, env, table, pid: ctx.deps.pid !== undefined ? ctx.deps.pid : process.pid, now: ctx.now() });
  } catch (err) {
    return { why: MARK_FAILED };
  }
  ctx.words.marked = true;
  if (lockFor(ctx.settings, ctx.deps) !== "open") return null;
  const id = env.CLAUDE_CODE_SESSION_ID;
  if (typeof id !== "string" || !SESSION_ID.test(id)) return { why: MARK_FAILED };
  Object.assign(ctx.words, { lines: [], session: id, label: shownName(session) });
  return null;
}

/** At the end of a command whose lines were kept for the chat's words file (holdWords): write them into a file of the chat's own
    (held.js writeWords, named for the command), and tell the chat its label and the file, and nothing else. A file that cannot
    be written ends the command with MARK_FAILED, the lines shown nowhere. Gives the command's code. */
function handOverWords(ctx, code) {
  const { words } = ctx;
  if (!words || !words.lines) return code;
  const lines = words.lines;
  words.lines = null;
  if (!lines.length) return code;
  let path;
  try {
    path = writeWords({ home: ctx.home, sessionId: words.session, label: words.label, what: ctx.asked.command, text: `${lines.join("\n")}\n`, now: ctx.now() });
  } catch (e) {
    ctx.say(MARK_FAILED);
    return 1;
  }
  ctx.say(wordsLine(words.label, path));
  return code;
}

/** The episode a person names, by what they `said`: its folder's name, its id or short id, or words that are all in its folder's
    name or its own name; and a gated one by its label (shownName), the whole of it, whatever its case and spacing, so that a
    label numbered " (2)" fits that video alone and the bare label the first, or by the label and short id its lists give it,
    "<label> (3fa9c1)", and never by words, which would tell its file's name. Gives back { folder, name, read }, where `read` is
    what readEpisode gave, or { why } when no episode fits or more than one does. An episode with a conflicted copy is found
    by its own name, label and id as well, since `name` never renames its folder: by the newest whole record past the copies,
    and by each conflicted copy of a record, since the Mac whose change became the copy knows the episode by the name it gave
    there. Its `read` still says it is conflicted, so every command but `resolve` refuses it. In the lists of episodes it says,
    each is named as listedAs names it: never a gated one by its folder. A video held as a session (episodeAt's `held`) is gated
    so too, found by its label and short id, and `held` is true in what is given back.
    When it finds one episode for a command that editMain is running (`ctx.asked`), it gives that episode back only if the
    gate lets the command run for it (gateOf), and otherwise { why }, the gate's words, so that the command ends there, having
    read nothing but records. Without `ctx.asked`, as in a test or a helper, it is not gated. A gated episode it finds has every
    line the command says after hold nothing of its names (hideNames). */
export function findEpisode(ctx, said) {
  // An import that has not finished has no whole record, and is not an episode yet. The versions of each are read once.
  const links = linksOf(ctx.root);
  const all = folders(ctx).map((name) => episodeAt(ctx, name, links)).filter((e) => e.read.code !== "NONE");
  const known = (e) => e.records;
  const nameOf = (r) => (r.name && typeof r.name.text === "string" ? r.name.text : "");
  const words = plainly(said).split(/\s+/).filter(Boolean);
  const exact = all.filter((e) => plainly(e.name) === plainly(said));
  // A label, and a label with the short id after it as the lists name a gated video ("<label> (3fa9c1)").
  const labelled = (e, r) => {
    const labels = [typeof r.label === "string" ? r.label : "", gated(r) ? shownName(r) : e.held ? heldName(r) : ""].filter(Boolean);
    return typeof r.id === "string" ? [...labels, ...labels.map((label) => `${label} (${r.id.slice(-6)})`)] : labels;
  };
  const byLabel = all.filter((e) => known(e).some((r) => labelled(e, r).some((label) => spaced(label) === spaced(said))));
  const byId = all.filter((e) => known(e).some((r) => typeof r.id === "string" && (r.id === said || r.id.slice(-6) === said)));
  // A gated video is never found by words of its folder or its name, which are its file's: words that fit would tie them to its
  // label. One a newer brimm-video wrote is found by them as always: it is named by its short id alone, and its kind cannot be
  // read here.
  const byWords = all.filter((e) => (e.newer || !isGated(e)) && words.length && words.every((w) => plainly(e.name).includes(w) || known(e).some((r) => plainly(nameOf(r)).includes(w))));
  const fits = exact.length ? exact : byLabel.length ? byLabel : byId.length ? byId : byWords;
  if (fits.length === 1) {
    const e = fits[0];
    hideNames(ctx, e);
    // A record of the switch's layout (3) or a later one may be a light import's, whose folder and file are named for a client:
    // an error nobody foresaw names none of it (editMain).
    if (ctx.hidden && e.records.some((r) => recordShaped(r) && ofTheSwitch(r))) ctx.hidden.switched = true;
    return gateOf(ctx, e, known(e), said, e.inForce) || holdWords(ctx, e) || { name: e.name, folder: e.folder, read: e.read, held: e.held };
  }
  if (fits.length > 1) return { why: `More than one episode fits "${said}": ${listed(fits.map((e) => listedAs(ctx, e)))}. Say which.` };
  // A detached run is given its episode's folder, which is named for the video's file: when it is gone, or has no whole record,
  // it is named by its day and Mac alone, as that run's log says it.
  const asked = ctx.asked && ctx.asked.words[0] === "--now" && FOLDER_NAME.test(said) ? unreadName(said) : `"${said}"`;
  return { why: all.length ? `No episode fits ${asked}. The episodes are: ${listed(all.map((e) => listedAs(ctx, e)))}.` : "There are no episodes yet." };
}

/** A size in bytes as a person reads it (kinds.js sizeText). */
export { sizeText };

/** A stretch of time as a person reads it: "25 minutes", "2 hours", "3 days". */
export function ageText(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${Math.round(hours / 24)} days`;
}

/** The size of the files in a folder, at any depth, without following a link: a Final Cut library holds .fcpcache, a link
    to itself, and links to media kept elsewhere, and neither is counted. */
function folderSize(folder) {
  let sum = 0;
  const walk = (dir) => {
    let names = [];
    try {
      names = readdirSync(dir);
    } catch (e) {
      return;
    }
    for (const name of names) {
      let found;
      try {
        found = lstatSync(join(dir, name));
      } catch (e) {
        continue;
      }
      if (found.isDirectory()) walk(join(dir, name));
      else if (found.isFile()) sum += found.size;
    }
  };
  walk(folder);
  return sum;
}

/** A line for each import in Episodes/.importing/, from its status: running, stopped, failed, or with a problem found by its
    late check. Only those whose video `fits`, when it is given: by its label when it has one, and otherwise by its file's
    name, so that words of a file's name never tell which label is its. A video that is held in
    the drop folder, not imported, is no import: the list of the videos waiting says why it waits. A light import's status,
    which carries its video's label (Part L), is named by its label, and why it failed or what its late check found is said
    with no path or name of its file in it (withoutNames). */
function importLines(ctx, fits = () => true) {
  return readStatuses(ctx.root, ctx.now()).filter((s) => s.status && fits(s.status.label || s.status.video) && importState(s.status, ctx.now()) !== "held").map(({ status }) => {
    const state = importState(status, ctx.now());
    const who = status.label || status.video;
    const plain = (text) => (status.label ? withoutNames(text, namesOf(status.video), [status.label]) : text);
    if (state === "failed") return `  ${who}: its import failed on ${status.machine}: ${plain(status.failed)}`;
    if (state === "problem") return `  ${who}: copied in on ${status.machine}, but the late check found a problem: ${plain(status.problem)}`;
    if (state === "stopped") return `  ${who}: stopped on ${status.machine} at ${status.step}, ${ageText(ctx.now() - Date.parse(status.at))} ago`;
    return `  ${who}: being imported on ${status.machine}, at ${status.step}`;
  });
}

/** The drop folders of the Macs, each as { mac, folder }, this Mac's first and the others by name. This Mac's is the one its own
    settings name (Unedited Video, or Drop once the installer has switched it), and no other. Another Mac's settings are on that
    Mac, so which of its folders it watches is not known here, and both are listed, Drop/<Mac> and Unedited Video/<Mac>, whichever
    there are: a video is never hidden, though one left in a folder that Mac no longer watches shows as waiting. (A marker in
    Drop/<Mac> is no sign that it watches it: it stays after a switch back, and after a run that was refused once it was made.)
    The Macs are the folders in either parent. */
function dropFolders(ctx) {
  const inRoot = (parent) => {
    try {
      return readdirSync(join(ctx.root, parent)).filter((n) => !n.startsWith("."));
    } catch (e) {
      return [];
    }
  };
  const macs = [...new Set([...inRoot("Unedited Video"), ...inRoot("Drop")])].sort((a, b) => (a === ctx.machine ? -1 : b === ctx.machine ? 1 : a.localeCompare(b)));
  return macs.flatMap((mac) => (mac === ctx.machine ? [dropFolder(ctx.root, mac, ctx.settings.drop)] : ["Drop", "Unedited Video"].map((parent) => dropFolder(ctx.root, mac, parent))).map((folder) => ({ mac, folder })));
}

/** The label a status of the Mac `machine` gives the video `video` in its drop folder, of a light import (Part L), or "". */
function labelIn(statuses, video, machine) {
  const labelled = statuses.find(({ status }) => status && status.video === video && status.machine === machine && status.label);
  return labelled ? labelled.status.label : "";
}

/** How a video came, in the words of her card (answer.came, as episode.js CAMES has them). */
const CAME_WORDS = { camera: "from a camera", phone: "from an iPhone", zoom: "as a Zoom download", sound: "as sound alone" };
/** The tool's guess at what a video is, in the words of her card: the values kinds.js guessKind stores, which are "finished", "raw"
    and "clip" (never "short video"). */
const GUESS_WORDS = { finished: "finished by your editor", raw: "raw with retakes", clip: "an iPhone clip" };

/** The lines of her card for the video not yet answered whose record is `named` (spec 2026-10-22, section 2, "The card"), below
    its line, each indented four spaces, which her skill reads word for word and in this order: what the import saw (answer.seen),
    how it came, the tool's guess, and the episode whose words it found in the video, as "Maybe a new version of: <its name> (id
    <short id>), <its kind>"; and last the card itself, called `label`, as JSON (cardLinesFor, R10). Each of the first four lines
    is left out when its fact is not given: no sight of it, or one not in the shape seenLine
    makes on one line (isSeenLine: a record may hold any text there, and a line break would forge the card's lines), no way it
    came, no guess, or a match that is none.
    The match (answer.match, an id) is looked for among `others`, the episodes `episodes` lists, by their records alone (episodeAt's
    inForce), and is offered only when `kind --version-of` would take it, so the whole line is left out unless the episode is
    known by that record, is not the video itself, is not archived, was not written by a newer brimm-video, and has every record
    it is known by, the one in force and each conflicted copy, answered and neither gated nor a session (gate.js gated, which
    reads a video not answered or left alone, and a session not cleared). An episode with one record that is not is named by its
    label in its own line, and would be given away by its name in this one. Nor is it offered when `kind --version-of` would refuse
    it for what links it: `links` (finish.js linksOf) is asked as answerWhy asks it, whether its chain of versions cannot be followed to
    its first (a gap: an episode not on this Mac; or a loop), whether that chain holds the waiting video itself, and whether one of
    the versions of the video it starts from, earlier, later and beside it, is a session not cleared (in the record or a conflicted
    copy). It is named as shownName names it, with its kind in the words `kind` says (KIND_SAID). A match that is itself a session not
    cleared, or one of whose versions is (matchedSession), gives the line "Maybe a new version of a client or group session." in its
    place, naming none: her skill then offers "Client or group session" first, and `kind` takes no other answer for it. */
function cardLines(named, label, others, links) {
  const answer = named.answer;
  if (answer === null || typeof answer !== "object" || answer.state !== "needs your answer") return [];
  const lines = [];
  if (isSeenLine(answer.seen)) lines.push(`    Seen: ${answer.seen}`);
  if (Object.hasOwn(CAME_WORDS, answer.came)) lines.push(`    Came: ${CAME_WORDS[answer.came]}`);
  if (Object.hasOwn(GUESS_WORDS, answer.guess)) lines.push(`    Guess: ${GUESS_WORDS[answer.guess]}`);
  // A match that is a session not cleared, or a version of one, is offered as such, naming none (edit.js answerWhy then takes only
  // a session for it).
  const maybe = maybeOf(named, others, links);
  if (maybe && maybe.session) lines.push("    Maybe a new version of a client or group session.");
  else if (maybe) lines.push(`    Maybe a new version of: ${shownName(maybe.record)} (id ${maybe.record.id.slice(-6)}), ${KIND_SAID[recordKind(maybe.record)]}`);
  return [...lines, ...cardLinesFor(named, label, others, links)];
}

/** The video the Maybe line of the card of `named` names, as cardLines says it: { session: true } for a match that is a session not
    cleared or a version of one, { record } for a match `kind --version-of` would take (its record in force), or null. */
function maybeOf(named, others, links) {
  const answer = named.answer;
  if (answer === null || typeof answer !== "object") return null;
  if (matchedSession(links, named)) return { session: true };
  const match = typeof answer.match === "string" && answer.match !== named.id ? others.find((e) => !e.newer && e.inForce && recordShaped(e.inForce) && e.inForce.id === answer.match) : undefined;
  if (match && !match.inForce.archived && match.records.filter(recordShaped).every((r) => !gated(r) && recordKind(r) !== "session")
    && !links.gapOf(match.inForce) && !links.chainOf(match.inForce).some((link) => link.record.id === named.id)
    && !links.setOf(links.firstOf(match.inForce)).members.some((one) => links.holdsSession(one))) {
    return { record: match.inForce };
  }
  return null;
}

/** Her card for the video with no kind whose record is `named`, called `label` (receipts.js cardOf): by its Guess line, and the Maybe
    line cardLines says. */
function cardFor(named, label, others, links) {
  const answer = named.answer !== null && typeof named.answer === "object" ? named.answer : {};
  const found = maybeOf(named, others, links);
  const maybe = !found ? null : found.session ? { session: true } : { name: shownName(found.record), kind: recordKind(found.record) };
  return cardOf({ label, guess: Object.hasOwn(GUESS_WORDS, answer.guess) ? answer.guess : null, maybe });
}

/** The card's own lines for the video with no kind whose record is `named`, called `label` (R10): "    Card: <JSON>", the card her
    skill asks with AskUserQuestion as it is (receipts.js cardOf, by its Guess line and the Maybe line cardLines says), and, when it
    came as a Zoom download or as sound alone, or `notASession` asks for it, "    Card if not a session: <JSON>" (notSessionCardOf,
    worded for how it came when the record says). A video she left alone has them too: `kind` prints them when it asks for her click
    first. `others` and `links` are as cardLines has them. */
export function cardLinesFor(named, label, others, links, { notASession = false } = {}) {
  const answer = named.answer !== null && typeof named.answer === "object" ? named.answer : {};
  const lines = [`    Card: ${JSON.stringify(cardFor(named, label, others, links))}`];
  const came = answer.came === "zoom" || answer.came === "sound" ? answer.came : null;
  if (came || notASession) lines.push(`    Card if not a session: ${JSON.stringify(notSessionCardOf({ label, came }))}`);
  return lines;
}

/** The lines `episodes` says of an episode (episodeAt): its name, what it is, its length, its folder and short id, and below
    them who is editing it, its title, how far it has been shown in Final Cut, its finish, and what is not right with its
    files, as always. A gated one is named by its label (shownName), and the line says what it is: a video waiting for her
    answer, a client or group session, or a video left alone (`left`), with no folder; its title, which Claude may have made of
    its words, is not said; and no line of it names its video's files (cleanFor). Under the line of a video waiting for her
    answer, and not one left alone, are the lines of her card (cardLines), which look for the video a match names among `all`,
    the episodes `episodes` lists, and through `links` (finish.js linksOf, read once by `episodes`) the versions of that video. An
    episode whose record cannot be read is named as listedAs names it, and so is one a newer brimm-video wrote. */
function episodeLines(ctx, e, left, all, links) {
  const r = e.read.record;
  if (e.newer) return [`  ${capital(newerName(e.newer))}: Jason updates this Mac before it is changed here.`];
  if (!r && listedAs(ctx, e) === e.name) return [`  ${e.name}`, `    Not right: ${e.read.why}.`];
  if (!e.inForce) return [`  ${capital(listedAs(ctx, e))}: ask Jason.`];
  const record = e.inForce;
  const lines = [];
  const clean = cleanFor(ctx, e);
  if (isGated(e)) {
    const named = gatedRecord(e);
    const held = e.held && !gated(named);
    const what = left ? "a video of" : recordKind(named) === null ? "a video waiting for your answer, of" : held ? "a version of a client or group session, of" : "a client or group session, of";
    lines.push(`  ${gatedName(named, e.held)}: ${what} ${stamp(record.video.seconds)}, id ${String(named.id).slice(-6)}`);
    if (!left && recordKind(named) === null) lines.push(...cardLines(named, gatedName(named, e.held), all, links));
    if (!r) lines.push(`    Not right: ${clean(e.read.why)}.`);
  } else {
    const kind = record.kind === "short video" ? "a short video" : "an episode";
    lines.push(`  ${record.name.text}${record.name.placeholder ? " (a placeholder name)" : ""}: ${kind} of ${stamp(record.video.seconds)}, in ${e.name}, id ${record.id.slice(-6)}`);
  }
  if (record.editing) lines.push(`    Editing: ${record.editing.by}, since ${shownAt(record.editing.since)}`);
  if (record.title && !isGated(e)) lines.push(`    Title: ${record.title.text}${record.title.approved ? "" : " (recommended)"}`);
  const pushed = record.main && Array.isArray(record.main.pushed) ? record.main.pushed : [];
  if (pushed.length) lines.push(`    ${shownLine(pushed)}`);
  if (record.finished) lines.push(`    Finished: revision ${record.finished.revision}, on ${record.finished.on}`);
  for (const problem of filesProblems(e.folder, record)) lines.push(`    Not right: ${clean(problem)}`);
  return lines;
}

/** How far a main video was shown, as `episodes` says it, of its list of versions `pushed` (not empty): the newest, and
    whether it was rendered or shown in Final Cut, "Shown: v3 (rendered), on Mac Studio" (spec 3, "One version model"). A list
    with no render in it, as every one before the switch, is said as it always was: its last version, "Shown in Final Cut: v3, on
    Mac Studio". */
function shownLine(pushed) {
  if (!pushed.some((p) => p && p.how === "render")) return `Shown in Final Cut: v${pushed[pushed.length - 1].v}, on ${pushed[pushed.length - 1].on}`;
  const top = newestOf(pushed);
  return `Shown: v${top.v} (${top.how === "render" ? "rendered" : "in Final Cut"}), on ${top.on}`;
}

/** The episodes `episodes` lists (episodeAt), newest first: every folder in Episodes with a record, but an archived one. */
const listedEpisodes = (ctx, links) => folders(ctx).map((name) => episodeAt(ctx, name, links)).filter((e) => e.read.code !== "NONE" && !(e.read.record && e.read.record.archived));

/** Whether an episode is a video she has left alone, not for brimm-video: its gated record says so. */
const isLeft = (e) => isGated(e) && recordKind(gatedRecord(e)) === null && Boolean(gatedRecord(e).answer) && gatedRecord(e).answer.state === "not for brimm-video";

/** `episodes`: each episode, newest first, with what a person needs to pick one up; the videos waiting in each drop folder,
    and for how long; the imports in Episodes/.importing; and this Mac's libraries, with the free space on its disk. An
    archived episode is left out, and one a newer brimm-video wrote is named by its short id alone (newerName). A video not
    yet answered, or a session, is named by its label (episodeLines), with the lines of her card under one not yet answered
    (cardLines), and one she has left alone is listed apart, under a heading of its own. A video waiting in a drop folder that
    a light import's status gives a label, or that a gated episode holds, is named by its label, or by what it is and its size,
    and why it waits holds no name of its file, on either Mac; on a Mac that does the light import, every video waiting is; any
    other, on a Mac that does not, as always. */
export async function episodes(ctx) {
  const { say } = ctx;
  // The versions of a video are read from Episodes once: for the episodes a version of a session holds, and the cards' matches.
  const links = linksOf(ctx.root);
  const all = listedEpisodes(ctx, links);
  const shown = all.filter((e) => !isLeft(e));
  const left = all.filter(isLeft);
  if (!shown.length && !left.length) say("No episodes yet.");
  else if (shown.length) {
    say("Episodes, newest first:");
    for (const e of shown) for (const line of episodeLines(ctx, e, false, all, links)) say(line);
  }
  if (left.length) {
    say("Left alone, not for brimm-video:");
    for (const e of left) for (const line of episodeLines(ctx, e, true, all, links)) say(line);
  }
  // The videos in each Mac's drop folder.
  const light = lightImport(ctx.settings);
  const statuses = readStatuses(ctx.root, ctx.now());
  const waiting = [];
  for (const { mac, folder } of dropFolders(ctx)) {
    let names = [];
    try {
      names = readdirSync(folder).filter(isMedia).sort();
    } catch (e) {
      continue;
    }
    for (const video of names) {
      const found = ctx.stat(join(folder, video));
      if (!found) continue;
      const held = heldBy({ root: ctx.root, video, bytes: found.size, now: ctx.now(), gatedAs: gatedAsOf(links) });
      // How long it has waited is from when this Mac's import first saw it (seen.json): the file's own dates are kept by a copy,
      // and macOS moves its birth time back with them. When this Mac has not seen it, as in the other Mac's drop folder, from
      // its ctime, when it came into the folder, which a tag or a preview set since then makes later.
      const noted = readSeen(ctx.home)[seenKey(video, found)];
      const came = noted && Number.isFinite(noted.at) ? noted.at : found.ctimeMs;
      // A video waiting here has not been answered. One a light import has a status of, with its label, or that a gated episode
      // holds, is named by its label, which retry takes, or by what it is and its size, whichever Mac this is; and so is every
      // video on a Mac that does the light import. Any other, on a Mac that does not, as always.
      const label = labelIn(statuses, video, mac);
      const holding = holdingEpisode({ root: ctx.root, video, bytes: found.size });
      if (!light && !label && !(holding && (holding.unknown || gatedAsOf(links)(holding.record)))) waiting.push(`  ${video}, in ${mac}'s, for ${ageText(ctx.now() - came)}${held ? `: ${held}` : ""}`);
      else {
        const who = label || capital(unlabelled(video, found.size));
        waiting.push(`  ${who}, in ${spokenMac(mac)}'s drop folder, for ${ageText(ctx.now() - came)}${held ? `: ${withoutNames(held, namesOf(video), [label])}` : ""}`);
      }
    }
  }
  if (waiting.length) {
    say("Waiting in the drop folders:");
    for (const line of waiting) say(line);
  }
  // The imports, from their status files.
  const imports = importLines(ctx);
  if (imports.length) {
    say("Imports:");
    for (const line of imports) say(line);
  }
  // This Mac's libraries, and the space left for them. A library of a gated episode is named as its episode is.
  say("On this Mac:");
  let work = [];
  try {
    work = readdirSync(workFolder(ctx.home)).filter((n) => !n.startsWith(".")).sort();
  } catch (e) {
    // There is no BRIMM Video Work yet.
  }
  for (const name of work) {
    const library = join(workFolder(ctx.home), name, `${name}.fcpbundle`);
    if (!statSync(library, { throwIfNoEntry: false })) continue;
    const named = listedAs(ctx, episodeAt(ctx, name, links));
    say(`  ${named === name ? `${name}.fcpbundle` : `The library of ${named}`}: ${sizeText(folderSize(library))}`);
  }
  try {
    const disk = ctx.statfs(ctx.home);
    say(`  Free on the disk: ${sizeText(Number(disk.bavail) * Number(disk.bsize))}`);
  } catch (e) {
    say("  Free on the disk: it could not be read.");
  }
  return 0;
}

/** Start a program detached from this one, and do not wait for it: what it prints goes into the tool's log. */
function startProgram(cmd, args) {
  import("./detached.js").then(({ spawnDetached }) => spawnDetached(cmd, args));
}

/** The episode a command is asked about, by what the person said, with its record: { found, record }, or { code } when the
    command is to end, having said why. A record of a newer layout is shown as such and goes no further. */
function episodeFor(ctx, rest, { newerEnds = 0 } = {}) {
  const said = rest.join(" ").trim();
  if (!said) {
    ctx.say(HELP);
    return { code: 2 };
  }
  const found = findEpisode(ctx, said);
  if (found.why) {
    ctx.say(found.why);
    return { code: found.newer ? newerEnds : 1 };
  }
  const { read } = found;
  if (!read.record) {
    ctx.say(notRead(ctx, found));
    return { code: 1 };
  }
  if (read.newer) {
    ctx.say(newerWhy(read.record));
    return { code: newerEnds };
  }
  return { found, record: read.record };
}

/** Say once on this Mac, at the first open or push of an episode that completes, how to keep the episode on this Mac: Dropbox
    offers no command for it. A marker in this Mac's folder for the episode says it was said. */
function offlineStep(ctx, found) {
  const said = join(episodeWork(ctx.home, found.name), "offline-step-said");
  if (existsSync(said)) return;
  ctx.say(`So that Dropbox keeps this episode on this Mac, Control-click its folder in Finder and choose Make available offline: ${found.folder}`);
  try {
    mkdirSync(episodeWork(ctx.home, found.name), { recursive: true });
    writeFileSync(said, "");
  } catch (e) {
    // It is said again the next time.
  }
}

/** Her yes to taking an episode over from another Mac, kept in this Mac's folder for the episode: the claim she said it of,
    { by, since }. A take-over keeps it; a plain open that refuses, which has her asked again, lets it go, since she may say no
    this time. "How far is it?" says to take it over again only while it is kept (nextOf). */
const yesFile = (home, folder) => join(episodeWork(home, folder), "take-over.yes.json");

/** Keep her yes to taking over the claim `held`. When it cannot be kept, "how far is it?" says to open the episode, and she is
    asked again, which is the safe way to go wrong. */
function keepYes(ctx, folder, held) {
  try {
    mkdirSync(episodeWork(ctx.home, folder), { recursive: true });
    writeFileSync(yesFile(ctx.home, folder), JSON.stringify({ by: held.by, since: held.since }) + "\n");
  } catch (e) {
    // She is asked again instead.
  }
}

/** Let her yes go: she is being asked again. */
function forgetYes(ctx, folder) {
  try {
    rmSync(yesFile(ctx.home, folder), { force: true });
  } catch (e) {
    // It stays, then. The skill still asks her again in any later conversation.
  }
}

/** Her yes, { by, since }, or null when none is kept or it cannot be read. */
function yesOf(ctx, folder) {
  try {
    return JSON.parse(readFileSync(yesFile(ctx.home, folder), "utf8"));
  } catch (e) {
    return null;
  }
}

/** The episode's files that are not whole on this Mac yet, as Dropbox brings them over: by the record's list. */
const notHere = (ctx, found, record) => Object.keys(record.files).filter((rel) => !ctx.isWhole(join(found.folder, rel)));

/** How long `open` waits after writing its claim before it reads the record again: Dropbox shows no sign of having taken a
    change across, so a fixed 20 seconds, in which the other Mac's claim made at the same time comes across too. */
export const CLAIM_WAIT_MS = 20000;

/** Whether this Mac seems to be online: Dropbox's own address is looked up, for at most 3 seconds. */
async function online() {
  const looked = dns.lookup("www.dropbox.com").then(() => true, () => false);
  return Promise.race([looked, new Promise((done) => setTimeout(() => done(false), 3000).unref())]);
}

/** Why a command that writes the record or pushes must not change the episode now, because another Mac has it open (spec
    section 1, "Picking an episode up"): "" when nobody does, or this Mac does. */
function claimHeld(ctx, record) {
  return heldText(record, ctx.machine);
}

/** The files the other Mac handed over that are not here yet: by the record's `released` list, each the record still lists
    at that size and not here at it, or not whole. A file changed since the release is the record's to judge (filesProblems,
    notHere), and is not waited for here: the list would otherwise hold open for ever. None when this Mac let it go last. */
function stillArriving(ctx, found, record) {
  const released = record.released;
  if (!released || !released.by || released.by === ctx.machine) return [];
  return Object.entries(released.files || {}).filter(([rel, bytes]) => {
    if (record.files[rel] !== bytes) return false;
    const here = ctx.stat(join(found.folder, rel));
    return !here || here.size !== bytes || !ctx.isWhole(join(found.folder, rel));
  }).map(([rel]) => rel);
}

/** The record claimed for the Mac `machine` at `at`. An answer about hand edits given for a part this Mac pushed last counts
    no more: its Final Cut may change that version again before it hands the episode over, when it is asked again. A take-over
    drops every answer: it carries none (ruling 7). */
function claimFor(record, machine, at, { takeOver = false } = {}) {
  const answers = record.released && record.released.answers;
  if (!answers) return claimed(record, machine, at);
  return claimed(takeOver ? { ...record, released: { ...record.released, answers: {} } } : withoutOwnAnswers(record, machine), machine, at);
}

/** The record with the answers dropped that were given for parts the Mac `machine` pushed last: its Final Cut may change those
    versions again. A claim drops them, and so does a push made with no claim (ruling 3), since it is that Mac at work on the
    episode again. */
function withoutOwnAnswers(record, machine) {
  const answers = record.released && record.released.answers;
  if (!answers) return record;
  const mine = new Set(newestPushes(record).filter((p) => p.last && p.last.on === machine).map((p) => p.key));
  return { ...record, released: { ...record.released, answers: Object.fromEntries(Object.entries(answers).filter(([key]) => !mine.has(key))) } };
}

/** The claim and the bring that `open` and `app` both begin with: check the episode's files against its record, and that each is
    whole on this Mac, and claim it for this Mac. `record` is the one `found` was read as (episodeFor). Resolves { record }, the
    episode's record with this Mac editing it (read again, when the claim was just written), once every file is here and the
    episode is this Mac's; or { code }, the code the command ends with, once a line has said why it cannot go on. `takeOver` is
    the flag `--take-over`. `again` is what she says to try again, as the command that asked has it: `open Talk` for open, `open
    Talk in HyperFrames` for app. `by` is the command that asked when it is not `open`, "app": the bring this starts is given it
    (`bring … --asked-by app`), so that what that bring says to say next, once it has run, is `again` as well, and not open's.
    The two give the same answer for the same claim but for that. In order:
    - a change Dropbox undid is said, and the record as it is now taken as this Mac's;
    - another Mac's claim refuses it at once, unless it is taken over (`--take-over`): nothing is looked at or brought over
      first, since on the Mac that is not editing an episode its files are online-only, and bringing them, raw video and all,
      would be for nothing until it is taken over. The refusal lets go of any yes she gave before to taking it over, since she
      is asked again; a take-over keeps her yes (keepYes);
    - files the other Mac handed over that are still on their way: a detached run brings them over (`bring`), and nothing is
      claimed until they are here (not on a take-over, which goes by the record's own list);
    - a file of the record missing or short refuses it; files not whole on this Mac yet are brought over, as above, and on a
      take-over what it says next is to take it over again, so that she is asked only once; so does the bring's result, but
      only when every file came, and only while the claim she said to take over stands and her yes is kept (nextOf);
    - the claim: the record is written with this Mac editing it, and after CLAIM_WAIT_MS it is read again: when Dropbox took
      the claim away, this Mac says so and stops; when the other Mac claimed it meanwhile, or both Macs wrote the same record
      and Dropbox kept a conflicted copy, this Mac stops, and it is theirs or for a person to sort out;
    - a warning when this Mac seems offline, since the other Mac then cannot see the claim. */
async function claimAndBring(ctx, found, record, { takeOver = false, again, by = "" }) {
  const { say } = ctx;
  // The bring it starts is told which command asked (`--asked-by`), when it is not `open`, so that what it says to say next, when
  // it is done, is that command's: a bring started by `app` ends by sending her back to app, and not to open.
  const askedBy = by ? ["--asked-by", by] : [];
  const gone = undone(record, ctx.home);
  if (gone) {
    say(gone);
    acceptRev(ctx.home, record.id, record.rev);
  }
  const name = record.name.text;
  // Who has it is said before any file is looked at: the files of an episode another Mac has are not whole here, and a Mac
  // that handed it over and opened it again still has its `released` list in the record, which is not still arriving.
  const held = heldElsewhere(record, ctx.machine);
  if (held && !takeOver) {
    // She is asked again whether to take it over, and may say no this time: a yes she gave before counts no more.
    forgetYes(ctx, found.name);
    say(`${held.by} has ${name} open, since ${shownAt(held.since)}. Say "take it over" to open it here; anything not handed over stays on ${held.by}.`);
    return { code: 1 };
  }
  if (held) keepYes(ctx, found.name, held);
  // The files the other Mac handed over are in the record's list too, so they are waited for before the list is checked. A
  // take-over does not wait: it goes by the record's own list. A take-over of a record nobody else has open is a plain open.
  const arriving = held ? [] : stillArriving(ctx, found, record);
  if (arriving.length) {
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: [...arriving, ...askedBy] });
    say(`Still arriving from ${record.released.by}: ${arriving.length} file${arriving.length === 1 ? "" : "s"}. Dropbox is bringing them over; say "${again}" again when it is done.`);
    return { code: 0 };
  }
  const problems = filesProblems(found.folder, record);
  if (problems.length) {
    say(`${found.name} is not whole in Dropbox:`);
    for (const problem of problems) say(`  ${problem}`);
    say(`It is not opened. Say "what's waiting?" to see the episodes.`);
    return { code: 1 };
  }
  // Past the refusal, another Mac's claim means this is a take-over. What is said next is then to take it over again, by this
  // command and by the bring it starts: a plain one would refuse, and she would be asked a second time.
  const sayNext = held ? `Say "take it over" again` : `Say "${again}" again`;
  const coming = notHere(ctx, found, record);
  if (coming.length) {
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: [...(held ? ["--take-over"] : []), ...askedBy] });
    say(`Dropbox is bringing ${coming.length} file${coming.length === 1 ? "" : "s"} of ${name} over to this Mac. ${sayNext} when it is done; "how far is it?" shows how far it has got.`);
    return { code: 0 };
  }
  if (!record.editing || record.editing.by !== ctx.machine) {
    const took = held ? `Taken over from ${held.by}, who had it since ${shownAt(held.since)}.` : "";
    if ((await save(ctx, { ...found, record }, claimFor(record, ctx.machine, localStamp(new Date(ctx.now())), { takeOver: Boolean(held) }), took)) !== 0) return { code: 1 };
    await (ctx.deps.wait || ((ms) => new Promise((done) => setTimeout(done, ms))))(CLAIM_WAIT_MS);
    const after = readEpisode(found.folder);
    if (!after.record) {
      say(notRead(ctx, { ...found, read: after }));
      return { code: 1 };
    }
    // The record read again is older than the claim this Mac wrote, or has nobody editing it: Dropbox took the claim away.
    // That is said, not that the other Mac opened it: a claim of theirs in a record older than this Mac's is the one this Mac
    // took over, not a new one. The record as it is now is taken as this Mac's, so the next try goes through. What is said
    // next goes by that record: to take it over again only while it still has the claim she said to take over, and otherwise
    // to try again, which waits for anything handed over meanwhile, or refuses a new claim, and she is asked.
    const undid = undone(after.record, ctx.home);
    if (undid || !after.record.editing) {
      const still = heldElsewhere(after.record, ctx.machine);
      const same = held && still && still.by === held.by && still.since === held.since;
      say(`Dropbox undid this Mac's claim on ${name}. ${same ? `Say "take it over" again` : `Say "${again}" again`}.`);
      if (undid) acceptRev(ctx.home, after.record.id, after.record.rev);
      return { code: 1 };
    }
    if (after.record.editing.by !== ctx.machine) {
      say(`${after.record.editing.by} opened ${name} at the same time, and it is theirs. Say "take it over" if they are done with it.`);
      return { code: 1 };
    }
    record = after.record;
    if (!(await (ctx.deps.online || online)())) say("This Mac seems to be offline: the other Mac will not see that you have it until this one is back online.");
  }
  return { record };
}

/** `open "<episode>" [--take-over]`: check its files against its record, and that each is whole on this Mac, claim it for this
    Mac (claimAndBring), and show what is decided for it: the name, the title, Claude's notes and the Reel candidates. It says
    nothing of Final Cut. At the first open on this Mac it says how to keep the episode on this Mac. */
export async function open(ctx, rest) {
  const { words, flags } = flagsOf(rest, []);
  const got = episodeFor(ctx, words, { newerEnds: 1 });
  if (!got.found) return got.code;
  const { found } = got;
  const { say } = ctx;
  const name = got.record.name.text;
  const claim = await claimAndBring(ctx, found, got.record, { takeOver: Boolean(flags["take-over"]), again: `open ${name}` });
  if (claim.code !== undefined) return claim.code;
  const { record } = claim;
  const kind = record.kind === "short video" ? "a short video" : "an episode";
  say(`${name}${record.name.placeholder ? " (a placeholder name)" : ""}: ${kind} of ${stamp(record.video.seconds)}, in ${found.name}`);
  if (record.name.placeholder) say("The name is a placeholder: say what to call it.");
  say(record.title ? `Title: ${record.title.text}${record.title.approved ? "" : " (recommended by Claude)"}` : "No title yet.");
  const stem = basename(record.video.file, extname(record.video.file));
  const notes = join(found.folder, `${stem}.edit-notes.txt`);
  if (existsSync(notes)) {
    say("Claude's notes, the first lines:");
    for (const line of notesForHer(readFileSync(notes, "utf8"), record).split("\n").filter((l) => l.trim()).slice(0, 12)) say(`  ${line}`);
  }
  const candidates = record.reels.filter((reel) => reel.status !== "dropped");
  if (candidates.length) {
    say("Reel candidates:");
    for (const reel of candidates) say(`  ${reel.n}. "${reel.title}", ${stamp(reel.to - reel.from)}.${reel.why ? ` ${reel.why}` : ""}`);
  }
  offlineStep(ctx, found);
  return 0;
}

/** What `app` says when the pinned command line is not on this Mac: the installer puts it in the toolchain's folder (hyperframes.js
    cliPath), once Jason has said yes to installing it. */
const NO_COMMAND_LINE = "HyperFrames' command line isn't on this Mac yet: ask Jason.";

/** What `app` says of a video answered as finished by her editor (architecture 2026-10-27, 4.3): it has no working copy and no
    project, so there is nothing to open. The gate lets `app` through for such a video (it is in no list), so these are `app`'s own
    words, named as its other lines name the video. */
const finishedHasNoProject = (name) => `${name} was finished by your editor, so it has no HyperFrames project: a finished video is not edited in HyperFrames.`;

/** What `app` says of an episode whose main project in use was made on another Mac and is not on this one (app.js
    projectOnAnotherMac): everything done in it is on that Mac, so a new project here would drop it from the record, and a take-over
    cannot rebuild it until the snapshot comes (plan PR 11). Named as app's other lines name the video. */
const projectIsElsewhere = (name, on, of = "") => `The HyperFrames project for ${of}${name} is on ${on}, with everything done in it, so it can't be opened on this Mac yet. Ask Jason.`;

/** What she says to open an episode in the app, which is what she is told to say again when the files are not here yet: `open
    <name> in HyperFrames`, the words that run `app`, and not `open <name>`, which runs open. */
const openInAppWords = (name) => `open ${name} in HyperFrames`;
/** Who `app` tells the bring it starts that it asked (`bring … --asked-by app`), so that the bring ends with `openInAppWords`. For a
    Reel it is "app reel <n>" (`appReelAsked`), and the bring ends with the words that open that Reel (app-reel.js openReelWords). */
const APP_ASKED = "app";
const appReelAsked = (n) => `${APP_ASKED} reel ${n}`;
/** What every command says of an iPhone clip's Reels. */
const NO_REELS = "A short video has no Reels.";
/** The Reel's number in what `app … reel <n>` told a bring it was asked by, or 0 when it was not that. */
const reelOfAsker = (asker) => Number(/^app reel ([1-9]\d*)$/.exec(asker)?.[1] ?? 0);
/** The words that follow an episode's in `app "<episode>" <question>`, by which `app` says what was done in the app on its project
    or what versions it has kept, instead of opening it (app-history.js). */
const APP_QUESTIONS = ["what-happened", "versions"];

/** `app "<episode>" [--take-over]`: open the episode's main video in the HyperFrames app, making its project first (app.js
    openInApp; architecture 2026-10-27, 4.1). In order:
    - the gate, as for every command that names an episode (episodeFor): a video not yet answered, a video left alone, a session
      not cleared and a video held beside a session are refused in the gate's own words. `app` is in no gate list. This comes
      first, whether or not this Mac is set up;
    - a video answered as finished by her editor has no HyperFrames project (architecture 4.3): `app` says so in its own words
      (finishedHasNoProject) and ends with 1, before it looks at this Mac's settings, since nothing about this Mac changes it.
      Nothing is claimed or brought, no working copy is asked for, and no record is written;
    - this Mac must be set up for the app (settings.js appOf), and must have the pinned command line (`cliPath`, or the program
      the deps give openInApp), or it says so and ends with 1, having claimed nothing;
    - an episode whose main project in use was made on another Mac, and is not on this one, is refused (projectIsElsewhere; app.js
      projectOnAnotherMac), with or without `--take-over`: it ends with 1 before anything is claimed or brought, nothing is asked
      for or made, and no record is written, since a new project here would drop the other Mac's from the record. A project of
      this Mac's own whose folder is gone is made again, as before;
    - the claim and the bring, as `open` makes them (claimAndBring). What she is told to say again is "open <name> in
      HyperFrames";
    - openInApp, given the episode as the claim left it. It resolves the code this command ends with, and gives the record its
      project, which is written as every command writes a record (save). Whenever the app opened, the last line it says names the
      app's buttons that Studio cannot control (architecture 3.3 and 5.9); when the app did not open, it does not.
    `ctx.deps.app` holds what a test gives openInApp in place of its defaults (cli, node, guidance, chat, spawn, env).
    `app "<episode>" reel <n> [--take-over]` opens Reel `n` instead (appReel).
    `app "<episode>" what-happened` and `app "<episode>" versions` (plan PR 6) are questions about the project, not an opening of it:
    a word after the episode's, when another word comes before it (`app versions` alone names an episode called "versions"). They
    go through the same gate, the same words for a finished video and the same check that this Mac is set up, and then they are
    app-history.js's: they claim nothing, bring nothing, ask for no working copy and write no record, so no claim of another Mac
    refuses them, and `--take-over` is not read. `versions` needs the pinned command line (NO_COMMAND_LINE); `what-happened` reads a
    file in the project and does not. `ctx.deps.app` holds what a test gives them too (cli, node, spawn, tz). */
export async function app(ctx, rest) {
  const { words, flags } = flagsOf(rest, []);
  const reel = reelAsked(words);
  if (reel) return appReel(ctx, reel, flags);
  const question = words.length > 1 && APP_QUESTIONS.includes(words[words.length - 1]) ? words[words.length - 1] : "";
  const got = episodeFor(ctx, question ? words.slice(0, -1) : words, { newerEnds: 1 });
  if (!got.found) return got.code;
  const { found } = got;
  if (recordKind(got.record) === "finished") return refuse(ctx, finishedHasNoProject(got.record.name.text));
  if (!appOf(ctx.settings)) return refuse(ctx, APP_NOT_SET_UP);
  const cli = ctx.deps.app?.cli ?? cliPath(ctx.home);
  if (question === "what-happened") return whatHappened(ctx, { found, record: got.record }, { ...ctx.deps.app });
  if (!existsSync(cli)) return refuse(ctx, NO_COMMAND_LINE);
  if (question === "versions") return versionsOf(ctx, { found, record: got.record }, { env: ctx.deps.env, ...ctx.deps.app, cli });
  const elsewhere = projectOnAnotherMac(ctx, { found, record: got.record });
  if (elsewhere) return refuse(ctx, projectIsElsewhere(got.record.name.text, elsewhere));
  const claim = await claimAndBring(ctx, found, got.record, { takeOver: Boolean(flags["take-over"]), again: openInAppWords(got.record.name.text), by: APP_ASKED });
  if (claim.code !== undefined) return claim.code;
  const { record } = claim;
  return openInApp(ctx, { found, record }, { env: ctx.deps.env, ...ctx.deps.app, cli, save: (next) => save(ctx, { ...found, record }, next) });
}

/** `app "<episode>" reel <n> [--take-over]`: open Reel `n` of the episode in the HyperFrames app, making its project first (app-reel.js
    openReelInApp; plan PR 5; architecture 4.1 step 10 and 4.3). A Reel is made by Studio only: the app's agent is told to send her
    here. `reel` with no number after it is the help and 2. In order:
    - the gate, as for every command that names an episode (episodeFor), `app`'s own: a video not yet answered, a video left alone,
      a session not cleared and a video held beside a session are refused in the gate's words. It comes first, whether or not this
      Mac is set up;
    - an iPhone clip has no Reels (the words every command says of one), and ends with 1, claiming nothing. A finished video has
      them, though no main project: its Reels are the Reels of a video her editor finished (4.3);
    - this Mac must be set up for the app and have the pinned command line, or it says so and ends with 1, having claimed nothing;
    - a Reel neither the record's list nor its projects have, and a Reel finished already that has no project, are refused in words
      (app-reel.js reelWhy), before anything is claimed. While Claude's reading is at work the list is not asked, since the reading
      is making it;
    - a Reel project made on another Mac and not on this one is refused (projectOnAnotherMac, with the Reel's key), with or without
      `--take-over`, before anything is claimed, brought or made;
    - the claim and the bring, as `open` and `app` make them (claimAndBring). What she is told to say again is "open Reel <n> of
      <name> in HyperFrames", and the bring it starts is told so (`bring … --asked-by "app reel <n>"`);
    - openReelInApp, given the episode as the claim left it. It resolves the code this command ends with, and gives the record the
      Reel's project and the Reel picked, in one write. */
async function appReel(ctx, asked, flags) {
  if (asked.n === null) {
    ctx.say(HELP);
    return 2;
  }
  const got = episodeFor(ctx, asked.episode, { newerEnds: 1 });
  if (!got.found) return got.code;
  const { found } = got;
  const name = got.record.name.text;
  const { n } = asked;
  if (recordKind(got.record) === "short video") return refuse(ctx, NO_REELS);
  if (!appOf(ctx.settings)) return refuse(ctx, APP_NOT_SET_UP);
  const cli = ctx.deps.app?.cli ?? cliPath(ctx.home);
  if (!existsSync(cli)) return refuse(ctx, NO_COMMAND_LINE);
  const why = reelWhy(ctx, found, got.record, n);
  if (why) return refuse(ctx, why);
  const elsewhere = projectOnAnotherMac(ctx, { found, record: got.record }, `reel ${n}`);
  if (elsewhere) return refuse(ctx, projectIsElsewhere(name, elsewhere, `Reel ${n} of `));
  const claim = await claimAndBring(ctx, found, got.record, { takeOver: Boolean(flags["take-over"]), again: openReelWords(n, name), by: appReelAsked(n) });
  if (claim.code !== undefined) return claim.code;
  const { record } = claim;
  return openReelInApp(ctx, { found, record, n }, { env: ctx.deps.env, ...ctx.deps.app, cli, save: (next) => save(ctx, { ...found, record }, next) });
}

/** Open a file in an app on this Mac, as a double-click would: Final Cut Pro, here, and a timeline handed to it. Throws,
    saying why in open's words, when the app could not be opened. `run` is how a program is run, for a test to give
    another. */
export function openApp(app, file, run = spawnSync) {
  const ran = run("/usr/bin/open", ["-a", app, file], { encoding: "utf8" });
  if (ran.status !== 0) throw new Error(`${app} could not be opened (${lastLine(ran.stderr)})`);
}

/** The launch agent that imports this Mac's drop folder. */
const AGENT = "com.thebrimm.unedited";

/** The keys a property list holds, as { key: true }, or null when it is not there or cannot be read. It is read as XML, since
    a library's Settings.plist holds bookmark data that JSON cannot carry. Nothing here writes it. Kept for later: a
    library's backups stay on Final Cut's default, by the lead's ruling of 2026-10-14 (phase 0, B4), since a library whose
    backups were set to BRIMM Video Work/Backups wrote none there in two hours, so nothing reads it now. */
export function readPlist(file) {
  if (!existsSync(file)) return null;
  const ran = spawnSync("/usr/bin/plutil", ["-convert", "xml1", "-o", "-", file], { encoding: "utf8" });
  if (ran.status !== 0) return null;
  return Object.fromEntries([...ran.stdout.matchAll(/<key>([^<]*)<\/key>/g)].map((m) => [m[1], true]));
}

/** Whether the launch agent's run is at work now: launchctl names its process while it runs. */
function agentRunning() {
  const ran = spawnSync("/bin/launchctl", ["print", `gui/${process.getuid()}/${AGENT}`], { encoding: "utf8" });
  return ran.status === 0 && /^\s*pid = \d+/m.test(ran.stdout);
}

/** Ask the launch agent to look in this Mac's drop folder now, as it does when something lands there: with its own
    arguments, its own environment and its own lock. When it is running already, nothing more is started, and its run
    looks again within a minute. Throws, saying why in launchctl's words, when it could not be asked. */
function kickstart() {
  const ran = spawnSync("/bin/launchctl", ["kickstart", `gui/${process.getuid()}/${AGENT}`], { encoding: "utf8" });
  if (ran.status !== 0) throw new Error(lastLine(ran.stderr));
}

/** The options the rule for writing into Dropbox is given: the clone and the check of one disk a test gives. */
const ruleOpts = (ctx) => ({ ...(ctx.deps.clone ? { clone: ctx.deps.clone } : {}), ...(ctx.deps.sameDisk ? { sameDisk: ctx.deps.sameDisk } : {}) });

/** Show a part of an episode in Final Cut Pro, as a new version: the main timeline, "main", or a Reel, { reel: n } (phase 2).
    `found` is { folder, name, record }; `xml` is the timeline to show, as it is kept in the episode's folder: its media named
    by paths from edit/, and no library. In order:
    - it refuses a file of the episode not whole on this Mac, and a change Dropbox undid;
    - the guard: a part shown before is shown again only when the person says it was not changed in Final Cut since
      (`noHandEdits`). A yes (`handEdits`) stops it: until brimm-video can read Final Cut's exports (phase 5), it cannot build
      on hand edits, and a new version would leave them behind;
    - the new version's project is named by projectName, in the episode's one event (eventName). Phase 0 (A4): a new project
      in that event asks nothing; a project of a name the library holds asks to replace it even with suppress warnings, and
      Keep Both renames it, so a name is never handed over twice (the version, below);
    - the timeline is kept in the episode's edit/ by the rule, the record lists the push and the file, and only then is a copy
      written on this Mac's own disk, with this Mac's paths, its library for the episode, copy assets 0 and suppress warnings
      1, and handed to Final Cut.
    Resolves 0 when Final Cut was asked to open it, and 1 when it refused, having said why. */
export async function pushPart(ctx, found, { part, xml, told = [], noHandEdits = false, handEdits = false, withoutOther = false }) {
  const { say } = ctx;
  const { record } = found;
  const held = claimHeld(ctx, record);
  if (held) return refuse(ctx, held);
  const target = part === "main" ? record.main : record.reels.find((reel) => reel.n === part.reel);
  if (!target) {
    say(`${record.name.text} has no Reel ${part.reel}.`);
    return 1;
  }
  // A push Dropbox took away is said once, and the record as it is now is taken as this Mac's: the push said again then goes
  // through, as a version of its own (below).
  const gone = undone(record, ctx.home);
  if (gone) {
    say(gone);
    acceptRev(ctx.home, record.id, record.rev);
    return 1;
  }
  const problems = filesProblems(found.folder, record);
  if (problems.length) {
    say(`${found.name} is not whole in Dropbox:`);
    for (const problem of problems) say(`  ${problem}`);
    return 1;
  }
  const guard = guardOf(ctx, found, part, { noHandEdits, handEdits, withoutOther });
  if (guard.why) return refuse(ctx, guard.why);
  const { last, answer } = guard;
  const pushed = Array.isArray(target.pushed) ? target.pushed : [];
  const v = last + 1;
  const project = projectName({ name: record.name.text, part, v, id: record.id });
  const file = timelineFile({ part, v, machine: ctx.machine });
  const kept = join(found.folder, file);
  const stored = retitle(xml, { event: eventName(found.name), project });
  // The copy handed to Final Cut names this Mac's paths: each medium must be in the episode's folder, and here, whole.
  const local = localMedia(stored, { from: kept, episode: found.folder });
  if (local.outside.length) {
    say(`${local.outside[0]} is outside the episode's folder. Copy it into its media folder first.`);
    return 1;
  }
  const media = [...local.xml.matchAll(/src="file:\/\/([^"]*)"/g)].map((m) => decodeURIComponent(m[1]));
  const coming = [...new Set(media)].filter((path) => !ctx.isWhole(path));
  if (coming.length) {
    say(`Dropbox is still bringing ${coming.map((path) => basename(path)).join(", ")} over to this Mac. Say "open ${record.name.text}" first.`);
    return 1;
  }
  const work = join(runsFolder(ctx.home), `push-${process.pid}-${ctx.now()}`);
  try {
    const opts = ruleOpts(ctx);
    mkdirSync(join(found.folder, "edit"), { recursive: true });
    // A timeline of this Mac's of this version that the record does not list was left by a push whose record was never
    // written: it is no one's, and a new one is put in its place. One the record lists is never written over.
    const entry = textWriter({ work, ...opts })(kept, stored, { replace: !(file in record.files) && existsSync(kept) });
    // What the session had asked for, so that a finish can tell when more was asked for since this version (askedOf).
    const push = { v, at: localStamp(new Date(ctx.now())), on: ctx.machine, file, project, asked: askedOf(record, part), ...(answer ? { answer } : {}) };
    const next = part === "main"
      ? { ...record, main: { ...record.main, pushed: [...pushed, push] } }
      : { ...record, reels: record.reels.map((reel) => (reel === target ? { ...reel, pushed: [...pushed, push] } : reel)) };
    const writer = { commit: ctx.deps.commit || commitOf(ctx.settings.checkout), on: ctx.machine };
    try {
      // This Mac at work on the episode again: answers it gave about parts it pushed last count no more (the P1 check, T15).
      writeEpisode(found.folder, withoutOwnAnswers({ ...next, libraries: { ...record.libraries, [ctx.machine]: `${found.name}.fcpbundle` }, files: { ...record.files, [file]: entry.bytes } }, ctx.machine), { expectRev: record.rev, writeText: textWriter({ work, ...opts }), writer, home: ctx.home });
    } catch (e) {
      say(e.code === "CHANGED" ? "This episode changed on the other Mac: open it again." : `${String(e.message).replace(/\.$/, "")}.`);
      return 1;
    }
    const copy = join(pushedFolder(ctx.home, found.name), basename(file));
    mkdirSync(pushedFolder(ctx.home, found.name), { recursive: true });
    writeFileSync(copy, withImportOptions(local.xml, { library: libraryFor(ctx.home, found.name) }));
    ctx.openApp("Final Cut Pro", copy);
    say(`Shown in Final Cut as "${project}", in the library ${found.name}.fcpbundle in BRIMM Video Work.`);
    // How the timeline was built, said once it is shown (phase 4): what stood in, and what a rule changed.
    for (const line of told) say(line);
    offlineStep(ctx, found);
    return 0;
  } catch (e) {
    say(`It could not be shown in Final Cut: ${String(e.message).replace(/\.$/, "")}.`);
    return 1;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** The guard, for a part shown in Final Cut before (spec section 4, "the guard"): asked before it is shown again, and before
    a command reads a time or quoted words on it (phase 4), only when its newest version was pushed: one rendered (newestIsRender)
    was never in Final Cut, and asks nothing. { last, answer }: the version it was last shown as on either
    Mac (0 when never), and what goes in the record of a push; or { why } it cannot go on. A yes to the guard (`handEdits`)
    always stops it. When the other Mac showed it last, only that Mac's answer, carried in the record when it handed the
    episode over, says whether it was changed there; `withoutOther` goes on from that version as brimm-video made it.
    `doing` is what "no changes" lets happen, in the question asked. */
function guardOf(ctx, found, part, { noHandEdits = false, handEdits = false, withoutOther = false } = {}, doing = "to show it again") {
  const { record } = found;
  const target = part === "main" ? record.main : record.reels.find((reel) => reel.n === part.reel);
  const pushed = Array.isArray(target.pushed) ? target.pushed : [];
  // The version is one more than any the record lists and any this Mac has handed Final Cut, whose copies are kept in
  // pushed/: a push whose record Dropbox took away has used up its version, and its project's name is never handed over twice.
  const kind = part === "main" ? "main" : `reel-${part.reel}`;
  let handed = [];
  try {
    handed = readdirSync(pushedFolder(ctx.home, found.name)).map((n) => new RegExp(`^${kind}\\.v(\\d+)\\.`).exec(n)).filter(Boolean).map((m) => Number(m[1]));
  } catch (e) {
    // Nothing has been handed to Final Cut on this Mac yet.
  }
  const last = Math.max(0, ...pushed.map((p) => p.v), ...handed);
  // The newest version was rendered, not pushed (spec 3, "One version model"): nothing of it was in Final Cut to be changed, so
  // nothing is asked. Unless this Mac handed Final Cut a newer one than the record lists (its copy is in pushed/): that one asks.
  if (newestIsRender(record, part) && newestOf(pushed).v === last) return { last, answer: null };
  // The newest push, when another Mac made it: what was done to it there is in that Mac's library, and only that Mac's answer,
  // carried in the record when it handed the episode over, says whether it was changed (spec section 4).
  const top = pushed.reduce((best, p) => (!best || p.v > best.v ? p : best), null);
  const other = top && top.v === last && top.on !== ctx.machine ? top.on : "";
  // A yes to the guard always stops it, whatever else is said with it.
  if (last && handEdits) return { why: `Your changes stay in v${last} in Final Cut. This version of brimm-video cannot build on them yet. Until it can: ask for brimm-video's changes first and make trims by hand last, or finish that timeline by hand in v${last}.` };
  if (other) {
    const key = part === "main" ? "main" : `reel ${part.reel}`;
    const named = part === "main" ? "the main video" : `reel ${part.reel}`;
    const carried = record.released && record.released.answers && record.released.answers[key];
    const said = carried && carried.v === last ? carried.said : "";
    // Her own "no changes" is about her own Final Cut, and never lifts this.
    if (said === "no changes") return { last, answer: `${other} said no changes since v${last}` };
    if (withoutOther) return { last, answer: `without ${other}'s changes since v${last}` };
    if (said) return { why: `The changes to v${last} of ${named} stay on ${other}, in its Final Cut library: ${other} said so when it handed this over. Finish that part on ${other}, or start again from v${last} without them (say "go ahead without ${other}'s changes").` };
    return { why: `v${last} of ${named} was shown on ${other}, and ${other} has not said whether it was changed there. Ask whoever used it on ${other}. If it was not changed, or to start again from v${last} without those changes, say "go ahead without ${other}'s changes".` };
  }
  if (last && !noHandEdits) return { why: `Did you change v${last} of ${record.name.text} in Final Cut since it was shown? Say "no changes" ${doing}. If you did change it, say so.` };
  return { last, answer: last ? `no hand edits since v${last}` : null };
}

/** `push "<episode>" [main | reel <n>] [--no-hand-edits | --hand-edits]`: show the main timeline in Final Cut Pro as a new
    version (pushPart): the import's own, edit/main.v0.fcpxml. A picked Reel is pushed by pushReel. */
export async function push(ctx, rest) {
  const flags = new Set(rest.filter((word) => word.startsWith("--")));
  const words = rest.filter((word) => !word.startsWith("--"));
  const answers = { noHandEdits: flags.has("--no-hand-edits"), handEdits: flags.has("--hand-edits"), withoutOther: flags.has("--without-other-macs-changes") };
  // `v<n>` last: that version as it was stored, shown again (pushVersion).
  const version = words.length >= 2 && /^v\d+$/i.test(words[words.length - 1]) ? Number(words.pop().slice(1)) : null;
  if (words.length >= 2 && words[words.length - 2] === "reel" && /^\d+$/.test(words[words.length - 1])) {
    const n = Number(words.pop());
    words.pop();
    const got = episodeFor(ctx, words, { newerEnds: 1 });
    if (!got.found) return got.code;
    if (claimHeld(ctx, got.record)) return refuse(ctx, claimHeld(ctx, got.record));
    if (version !== null) return pushVersion(ctx, { ...got.found, record: got.record }, { reel: n }, version, answers);
    return pushReel(ctx, { ...got.found, record: got.record }, n, answers);
  }
  if (words[words.length - 1] === "main") words.pop();
  const got = episodeFor(ctx, words, { newerEnds: 1 });
  if (!got.found) return got.code;
  const { found, record } = got;
  if (claimHeld(ctx, record)) return refuse(ctx, claimHeld(ctx, record));
  // A finished video, and an iPhone clip she answered, have no timeline of their own: nothing of them is edited here.
  if (!hasFinalCut(record)) return refuse(ctx, `${shownName(record)} has no timeline to show in Final Cut: ${recordKind(record) === "finished" ? "a finished video" : "an iPhone clip"} is not edited here.`);
  if (version !== null) return pushVersion(ctx, { ...found, record }, "main", version, answers);
  // The timeline as the session leaves it: the import's own until something is laid over it (phase 4).
  const made = await timelineFor({ ...found, record }, "main", ctx);
  if (made.coming) {
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: made.bring });
    return refuse(ctx, `Dropbox is still bringing ${made.coming} over to this Mac. Say "open ${record.name.text}" first.`);
  }
  if (made.why) return refuse(ctx, made.why);
  return pushPart(ctx, { ...found, record }, { part: "main", xml: made.xml, told: made.told, noHandEdits: flags.has("--no-hand-edits"), handEdits: flags.has("--hand-edits"), withoutOther: flags.has("--without-other-macs-changes") });
}

/** `push "<episode>" [main | reel <n>] v<k>`: show version k of a part in Final Cut again, as a new version, from the timeline that
    version stored (its entry's file in edit/), not the record as it is now (spec 3, "One version model": "push <version> hands
    Final Cut that version's stored FCPXML"). A rendered version's timeline is shown so too. It goes through the push every part
    shares (pushPart), with its guard. A version the part does not list is refused, and a stored file Dropbox has not brought over
    yet is brought, as push brings what it needs. */
async function pushVersion(ctx, found, part, v, answers) {
  const { record } = found;
  const target = part === "main" ? record.main : (record.reels || []).find((reel) => reel.n === part.reel);
  const named = part === "main" ? "the main video" : `Reel ${part.reel}`;
  if (!target) return refuse(ctx, `There is no Reel ${part.reel}.`);
  const entry = (Array.isArray(target.pushed) ? target.pushed : []).find((p) => p.v === v);
  if (!entry || typeof entry.file !== "string") return refuse(ctx, `There is no v${v} of ${named}.`);
  const at = join(found.folder, entry.file);
  if (!existsSync(at)) return refuse(ctx, `${entry.file} is not in the episode's folder.`);
  if (!ctx.isWhole(at)) {
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: [entry.file] });
    return refuse(ctx, `Dropbox is still bringing ${entry.file} over to this Mac. Say "open ${record.name.text}" first.`);
  }
  return pushPart(ctx, found, { part, xml: readFileSync(at, "utf8"), told: [`It is v${v} as it was stored, shown again as a new version.`], ...answers });
}

/** `bring --now "<episode folder>" [--take-over] [--asked-by app | "app reel <n>"]`, the detached run `open` and `app` start: each file
    of the episode that is not whole on this Mac is read to its end, so that Dropbox brings it over, and the result says which are
    whole now, and what to say next: to open it, or, when a file did not come, why, and to open it to try again. `--asked-by app`
    says that `app` started it (claimAndBring), and then what to say next is to open it in HyperFrames, `open <name> in HyperFrames`,
    which runs `app`; `--asked-by "app reel <n>"` that `app … reel <n>` did, and what to say next is to open that Reel, `open Reel
    <n> of <name> in HyperFrames`; a bring that was told nobody, or any other command, says `open <name>`, as it always did. The bring of a take-over
    (`--take-over`) that brought every file also keeps whose claim it was for, and that what to say next, while that claim stands
    and her yes to it is kept, is to take it over again: `status` says so only then (see nextOf). */
export async function bring(ctx, rest) {
  // Given files after the folder (a Reel's clip, from push reel), only those are brought over.
  const [now, folder, ...after] = rest;
  const takeOver = after.includes("--take-over");
  const askedAt = after.indexOf("--asked-by");
  const asker = askedAt === -1 ? "" : String(after[askedAt + 1] ?? "");
  const only = after.filter((word, i) => word !== "--take-over" && !(askedAt !== -1 && (i === askedAt || i === askedAt + 1)));
  if (now !== "--now" || !folder) {
    ctx.say(HELP);
    return 2;
  }
  const found = findEpisode(ctx, folder);
  if (!found.read || !found.read.record) {
    ctx.say(found.why || notRead(ctx, found, folder));
    if (found.gate) await leaveGateResult(ctx, found, "bring");
    return 1;
  }
  const { record } = found.read;
  const name = record.name.text;
  // The claim she said to take over, as the record has it when the bring starts: none when nobody else has it by then.
  const taking = takeOver ? heldElsewhere(record, ctx.machine) : null;
  const result = await runDetached({ home: ctx.home, folder: found.name, clean: resultClean(ctx), command: "bring", alive: ctx.alive, ...(ctx.deps.keepAwake ? { keepAwake: ctx.deps.keepAwake } : {}) }, async () => {
    const wanted = () => (only.length ? only.filter((rel) => !ctx.isWhole(join(found.folder, rel))) : notHere(ctx, found, record));
    const coming = wanted();
    const read = ctx.deps.readAll || readThrough;
    const failed = [];
    for (const rel of coming) {
      try {
        await read(join(found.folder, rel));
      } catch (e) {
        failed.push(`${rel} could not be read (${e.code || e.message})`);
      }
    }
    const still = wanted();
    const made = coming.filter((rel) => !still.includes(rel));
    for (const rel of still) if (!failed.some((f) => f.startsWith(`${rel} `))) failed.push(`${rel} is still not whole`);
    // What to say next is the words of the command that asked: `app` for the main video, `app … reel <n>` for a Reel, and open for any other.
    const again = asker === APP_ASKED ? openInAppWords(name) : reelOfAsker(asker) ? openReelWords(reelOfAsker(asker), name) : "";
    const next = again
      ? (failed.length ? `Some files of ${name} are not here yet. Say "${again}" to try again.` : `Every file of ${name} is here. Say "${again}" again.`)
      : (failed.length ? `Some files of ${name} are not here yet. Say "open ${name}" to try again.` : `Every file of ${name} is here. Say "open ${name}".`);
    // A bring that failed says why, and to open it, take-over or not: it would most likely fail again the same way (a full
    // disk, Dropbox paused, the Mac offline), and a take-over is run again without asking her only to finish what she said
    // yes to, never to try again what failed.
    if (!taking || failed.length) return { ok: !failed.length, made, failed, next };
    return { ok: true, made, failed, next, takeOver: { by: taking.by, since: taking.since, next: `Every file of ${name} is here. Say "take it over" again.` } };
  });
  if (result.taking) {
    ctx.say(`Another run is taking over the lock of ${calledAs(ctx, found)}; try again in a few seconds.`);
    return 1;
  }
  if (result.running) {
    ctx.say(`${result.running} is running for ${calledAs(ctx, found)} already.`);
    return 1;
  }
  return result.ok ? 0 : 1;
}

/** What a detached run's result `r`, for the episode in `folder`, says to say next. The bring of a take-over says to take it
    over again only while the claim she said to take over is still the record's, the same Mac since the same time, and her
    yes to it is still kept (yesOf): the skill then takes it over without asking her again. Once this Mac has it, or that Mac
    has let it go or opened it again since, or she has been asked again since, it says to open it, as any bring does: an open
    goes through, or, when another Mac has it, refuses, and she is asked. A record that cannot be read says to open it too. */
function nextOf(ctx, folder, r) {
  if (!r.takeOver) return r.next;
  const { record } = readEpisode(join(ctx.episodes, folder));
  const held = record && heldElsewhere(record, ctx.machine);
  const yes = yesOf(ctx, folder);
  const same = (claim) => Boolean(claim) && claim.by === r.takeOver.by && claim.since === r.takeOver.since;
  return same(held) && same(yes) ? r.takeOver.next : r.next;
}

/** What a detached run's result `r` says of the episode `shown`, in one line: when it ended, what it made, what it could not do,
    and `next`, what to say next. Each of them as `clean` says it. `status` says it for every result, and `kind` for the reading
    it waited for. An early result (detached.js runDetached), which a reading writes once what it read is in the episode, says
    when it put that in, and that the late check of its copies is still to come while its run is at work (`live`), or that the
    run stopped before it was made. */
function ranLine(ctx, shown, r, clean, next, live = false) {
  const done = r.failed.length ? ` Not done: ${clean(r.failed.join(" ")).replace(/([^.])$/, "$1.")}` : "";
  const when = r.early
    ? `put in what it made ${ageText(ctx.now() - r.ended)} ago; ${live ? "the late check of its copies is still to come" : "it stopped before the late check of its copies was made"}`
    : `ended ${ageText(ctx.now() - r.ended)} ago`;
  return `${shown}: ${Object.hasOwn(RUN_SAID, r.command) ? RUN_SAID[r.command] : r.command} ${when}.${r.made.length ? ` Made: ${r.made.map(clean).join(", ")}.` : ""}${done}${next ? ` ${clean(next)}` : ""}`;
}

/** What `status` says while the working copy of an episode is made, in the words `app` uses for it. */
const WORK_COPY_RUNNING = "the video for HyperFrames is being made";
/** How a result names the run that left it, where the name of its command is not a word a person says: the working copy's run
    (workcopy.js) is "making the video for HyperFrames". Every other command is named by its own word. */
const RUN_SAID = { [WORK_COPY_COMMAND]: "making the video for HyperFrames" };

/** `status ["<words>"]`: what is running on this Mac (each run's step, from the progress panel's files), the imports in
    Episodes/.importing/, and for each episode on this Mac the detached run at work on it and what each one left, with what to
    say next (nextOf). With words, only what they fit. An episode is named as listedAs names it: a video not yet answered, or a
    session, by its label and short id, and what its runs left with nothing of its video's names in it (cleanFor), a result
    left before it became one included, and with nothing said of what to say next. Words fit such an episode only when they
    are its label or its id, and a light import's status only by its label. */
export async function status(ctx, rest) {
  const { say } = ctx;
  const words = plainly(rest.join(" ")).split(/\s+/).filter(Boolean);
  const fits = (text) => words.every((w) => plainly(text).includes(w));
  const lines = [];
  const running = [];
  let progress = [];
  try {
    progress = readdirSync(progressFolder(ctx.home)).filter((n) => /^\d+\.json$/.test(n)).sort();
  } catch (e) {
    // Nothing has run on this Mac yet.
  }
  for (const name of progress) {
    try {
      const run = JSON.parse(readFileSync(join(progressFolder(ctx.home), name), "utf8"));
      if (ctx.alive(run.pid) && fits(run.video)) running.push(`  ${run.video}: ${run.detail}`);
    } catch (e) {
      // A run is writing it.
    }
  }
  if (running.length) lines.push("Running on this Mac:", ...running);
  const imports = importLines(ctx, fits);
  if (imports.length) lines.push("Imports:", ...imports);
  let local = [];
  // The versions of the episodes are read from Episodes once, for those held as sessions.
  const links = linksOf(ctx.root);
  try {
    // An episode is found by its folder's name, or by its own name as findEpisode finds it.
    const named = words.length ? findEpisode(ctx, rest.join(" ")) : {};
    // A gated episode is found by its label or its ids alone (findEpisode), never by words of its folder's name.
    local = readdirSync(workFolder(ctx.home)).filter((n) => {
      if (n.startsWith(".") || !(n === named.name || fits(n))) return false;
      const e = n === named.name || !words.length ? null : episodeAt(ctx, n, links);
      return !e || e.newer || !isGated(e);
    }).sort();
  } catch (e) {
    // There is no BRIMM Video Work yet.
  }
  for (const folder of local) {
    const e = episodeAt(ctx, folder, links);
    const shown = listedAs(ctx, e);
    const clean = cleanFor(ctx, e);
    const run = runningRun(ctx.home, folder, ctx.alive);
    const command = run ? run.command : "";
    // The working copy is made under a lock of its own, beside whatever holds the episode's (workcopy.js workCopyLockOf): its run
    // is looked for there, and its progress is in the panel's files with the others', by its process.
    const copying = runningRun(ctx.home, folder, ctx.alive, workCopyLockOf(ctx.home, folder)) !== null;
    if (command) lines.push(`${shown}: ${command} is running.`);
    if (copying) lines.push(`${shown}: ${WORK_COPY_RUNNING}.`);
    let results = [];
    try {
      results = readdirSync(episodeWork(ctx.home, folder)).filter((n) => n.endsWith(".result.json")).sort();
    } catch (e) {
      continue;
    }
    for (const file of results) {
      const r = readResult(ctx.home, folder, file.replace(/\.result\.json$/, ""));
      // The result of a command at work now is an older run's, and is not said; but the early result its own run wrote is. The
      // working copy's run is at work when its own lock says so, whatever holds the episode's.
      const own = Boolean(r) && r.early === true && Boolean(run) && r.command === command && r.pid === run.pid;
      const atWork = Boolean(r) && (r.command === command || (copying && r.command === WORK_COPY_COMMAND));
      if (!r || (atWork && !own)) continue;
      // What to say next names the episode as it was then, and says to open it, which the gate refuses now: for a gated one it is
      // left out.
      lines.push(ranLine(ctx, shown, r, clean, isGated(e) ? "" : nextOf(ctx, folder, r), own));
    }
  }
  for (const line of lines.length ? lines : ["Nothing is running, and nothing is waiting."]) say(line);
  return 0;
}

/** retry of a video an episode holds already (`held` says which, in episodeHolding's words). It is not imported again. But
    when its import stopped on this Mac before its late check, that check holds the episode for ask and --from-plan on both
    Macs (unedited.js importHolds), and is made only at the import's next run: so the launch agent is asked to look, which
    makes it. When this Mac owes no late check of it, a stopped status of this Mac's own for it can never be cleared by a late
    check, and is taken away. Otherwise it is refused, as before. `who` is the video as retry names it (retry), and `plain`
    what a line about it is said as: for a light import's video, with no path or name of its file in it. */
function lateCheckOwed(ctx, video, held, who = video, plain = (text) => text) {
  const { say } = ctx;
  const owed = readPendings(ctx.home).find((p) => p.video === video && p.machine === ctx.machine && resolve(p.root) === resolve(ctx.root));
  const stopped = readStatuses(ctx.root, ctx.now()).filter((s) => s.status && s.status.video === video && s.status.machine === ctx.machine && importState(s.status, ctx.now()) === "stopped");
  // The episode is named as listedAs names it: a gated one by its label and short id, and never by its folder.
  const name = owed ? listedAs(ctx, episodeAt(ctx, owed.name)) : (/already imported as (.*?)\. It stays/.exec(held) || [])[1] || "an episode";
  if (!owed && !stopped.length) {
    say(`${who} is ${plain(held)}`);
    return 1;
  }
  if (!owed) {
    for (const { status } of stopped) removeStatus(ctx.root, video, ctx.machine, status.import || "");
    say(`${who} is imported, as ${name}. Its import stopped on this Mac, and has no late check left to make here, so the status that held the episode is taken away.`);
    return 0;
  }
  const problem = owed.problem ? plain(String(owed.problem).replace(/\.$/, "")) : "";
  const due = dueAt(owed);
  const later = due > ctx.now() ? `when it is due, at ${clockAt(due)}` : "";
  // A run at work makes a due check within a minute, but makes a check that found a problem only once, at its start.
  if (ctx.agentRunning()) {
    if (problem) {
      say(`${who} is imported, as ${name}, and its late check found a problem: ${problem}. The import at work now does not make it again: once the problem is put right and the panel shows that import has ended, say "try it again" again.`);
      return 1;
    }
    say(`${who} is imported, as ${name}, and its late check is still to be made on this Mac: the import at work now makes it ${later ? `${later}, ` : ""}once it has finished any video it is importing. The panel shows how far it is.`);
    return 0;
  }
  try {
    ctx.kickstart();
  } catch (e) {
    say(`The launch agent ${AGENT} could not be asked to look (${String(e.message).replace(/\.$/, "")}). Jason runs install.sh --machine on this Mac.`);
    return 1;
  }
  if (problem) say(`${who} is imported, as ${name}, and its late check found a problem before (${problem}): the Mac's import of its drop folder is asked to make it again now. The panel shows how far it is.`);
  else say(`${who} is imported, as ${name}, and its late check is still to be made on this Mac: the Mac's import of its drop folder is asked to make it ${later || "now"}. The panel shows how far it is.`);
  return 0;
}

/** `retry "<video>"`: import again a video in this Mac's drop folder whose import failed or stopped. It is found by its
    file's name or its name without the ending, whatever their case, or by the label a light import's status of this Mac gives
    it (Part L), whatever its case and spacing. Refused when an episode holds it already (but see lateCheckOwed), and while its
    import is running. Its status files from this Mac are taken away, and the launch agent is asked to look (kickstart).
    A video with a label is named by it in every line, and why its import failed is said with no path or name of its file in
    it; on a Mac that does the light import, a video with none is named by what it is and its size, and never by its file. */
export async function retry(ctx, rest) {
  const { say } = ctx;
  const said = rest.join(" ").trim();
  if (!said) {
    say(HELP);
    return 2;
  }
  const drop = dropFolder(ctx.root, ctx.machine, ctx.settings.drop);
  let videos = [];
  try {
    videos = readdirSync(drop).filter(isMedia).sort();
  } catch (e) {
    // The drop folder is not there, or cannot be read: it holds nothing that can be imported.
  }
  const light = lightImport(ctx.settings);
  const statuses = readStatuses(ctx.root, ctx.now());
  const labelOf = (v) => labelIn(statuses, v, ctx.machine);
  const sizeOf = (v) => (statSync(join(drop, v), { throwIfNoEntry: false }) || { size: 0 }).size;
  // A video a light import has a status of, or that a gated episode holds, is never named by its file, whichever Mac this is;
  // and on a Mac that does the light import, none is.
  // An episode a version of a session holds is held as a session too (episodeAt's `held`), and named so.
  const gatedAs = gatedAsOf(linksOf(ctx.root));
  const quiet = (v) => {
    const holding = holdingEpisode({ root: ctx.root, video: v, bytes: sizeOf(v) });
    return light || Boolean(labelOf(v)) || Boolean(holding && (holding.unknown || gatedAs(holding.record)));
  };
  const video = videos.find((v) => plainly(v) === plainly(said) || plainly(basename(v, extname(v))) === plainly(said)) || videos.find((v) => labelOf(v) && spaced(labelOf(v)) === spaced(said));
  if (!video) {
    const held = videos.map((v) => labelOf(v) || (quiet(v) ? unlabelled(v, sizeOf(v)) : v));
    say(`No video in this Mac's drop folder fits "${said}". ${videos.length ? `It holds: ${listed(held)}.` : "It is empty."}`);
    return 1;
  }
  const bytes = statSync(join(drop, video)).size;
  const label = labelOf(video);
  const hush = quiet(video);
  const who = label || (hush ? `${capital(unlabelled(video, bytes))} in this Mac's drop folder` : video);
  const plain = (text) => (hush ? withoutNames(text, namesOf(video), [label]) : text);
  const held = episodeHolding({ root: ctx.root, video, bytes, gatedAs });
  if (held) return lateCheckOwed(ctx, video, held, who, plain);
  // Of this Mac's imports of the video, the ones to take again are those that failed, stopped, or found a problem at their
  // late check. One running now is left alone, and when it is the only one, nothing is done.
  const mine = statuses.filter((s) => s.status && s.status.video === video && s.status.machine === ctx.machine);
  // A video the import holds in the folder on purpose, a Zoom download, is held again however often it is tried: its status
  // says why, and what to do. The status of a held video that is another file now is of no use, and is taken away below.
  const left = mine.find((s) => importState(s.status, ctx.now()) === "held" && s.status.bytes === bytes);
  if (left) {
    say(`${who} is held: ${plain(left.status.held)}`);
    return 1;
  }
  const again = mine.filter((s) => importState(s.status, ctx.now()) !== "running");
  const running = mine.find((s) => importState(s.status, ctx.now()) === "running");
  if (!again.length && running) {
    say(`${who} is being imported now, at ${running.status.step}. The panel shows how far it is.`);
    return 1;
  }
  for (const { status } of again) removeStatus(ctx.root, video, ctx.machine, status.import || "");
  const how = (status) => {
    const state = importState(status, ctx.now());
    if (state === "failed") return `which failed: ${plain(String(status.failed).replace(/\.$/, ""))}`;
    if (state === "problem") return "whose late check found a problem";
    if (state === "held") return "which was held, as another file";
    return `which stopped at ${status.step}`;
  };
  const items = again.map(({ status }) => `${status.import || "one with no id"}, ${how(status)}`);
  const which = items.length > 1 ? ` (its imports ${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]})` : "";
  // A run of the launch agent at work now takes the video when it next looks: it looks again each minute while it waits for
  // a late check, and once more before it ends. Asking the agent to start would do nothing while it runs.
  if (ctx.agentRunning()) {
    say(`${who} is imported again${which} by the import at work now, when it next looks in the drop folder: within a minute while it waits for a late check, or once it has finished the video it is on. The panel shows how far it is.`);
    return 0;
  }
  // The launch agent is asked to look, and no run of its own is started here: the agent's run has its arguments, such as
  // --rules-only, its environment and its lock.
  try {
    ctx.kickstart();
  } catch (e) {
    say(`The launch agent ${AGENT} could not be asked to look (${String(e.message).replace(/\.$/, "")}). Jason runs install.sh --machine on this Mac.`);
    return 1;
  }
  say(`${who} is imported again${which}: the Mac's import of its drop folder is asked to look. The panel shows how far it is.`);
  return 0;
}

/** A command's words, and its flags: each `--name`, with the word after it as its value when `valued` names it. A flag given
    more than once keeps each of its values. */
function flagsOf(rest, valued = []) {
  const words = [];
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const word = rest[i];
    if (!word.startsWith("--")) words.push(word);
    else if (valued.includes(word.slice(2))) {
      flags[word.slice(2)] = [...(flags[word.slice(2)] || []), rest[i + 1] ?? ""];
      i += 1;
    } else flags[word.slice(2)] = true;
  }
  return { words, flags };
}

/** Who writes a record from this Mac: this checkout's commit, for information only, and the Mac. */
const writerOf = (ctx) => ({ commit: ctx.deps.commit || commitOf(ctx.settings.checkout), on: ctx.machine });

/** Write the episode's next record, `record`, and say `done`. When the other Mac wrote meanwhile, or Dropbox holds a conflicted
    copy, nothing is written and the person is told why. Resolves 0 when written, 1 when not. */
async function save(ctx, found, record, done) {
  // A change Dropbox took away is said, as 1a's commands say it, and never written over in silence.
  const gone = undone(found.record, ctx.home);
  if (gone) {
    ctx.say(`${gone} Nothing was written.`);
    acceptRev(ctx.home, found.record.id, found.record.rev);
    return 1;
  }
  const work = join(runsFolder(ctx.home), `record-${process.pid}-${ctx.now()}`);
  try {
    writeEpisode(found.folder, record, { expectRev: found.record.rev, writeText: textWriter({ work, ...ruleOpts(ctx) }), writer: writerOf(ctx), home: ctx.home });
  } catch (e) {
    ctx.say(e.code === "CHANGED" ? "Nothing was written: this episode changed on the other Mac: open it again." : `Nothing was written: ${String(e.message).replace(/\.$/, "")}.`);
    return 1;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  if (done) ctx.say(done);
  return 0;
}
const refuse = (ctx, why) => {
  ctx.say(why);
  return 1;
};
const oneLine = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();

/** Record the episode's name as it is given (spec section 1, "The episode's name"). Nothing is renamed: the folder keeps its
    name, and a project keeps the name it was pushed with. */
export async function nameEpisode(ctx, found, words) {
  if (claimHeld(ctx, found.record)) return refuse(ctx, claimHeld(ctx, found.record));
  const text = oneLine(words);
  if (!text) return refuse(ctx, "Say the name to give the episode.");
  return save(ctx, found, { ...found.record, name: { text, placeholder: false } }, `It is called "${text}" now. Nothing was renamed.`);
}

/** How many words a title on screen may have, when a person gives it. */
const TITLE_MOST = 12;

/** Show the episode's title, or set and approve it (spec section 4, `title`). Claude's recommended title is approved as it is,
    or a person's words take its place. An approved title is locked: changing it needs `change`, because BRIMM Ops may already
    have it. */
export async function titleEpisode(ctx, found, { words, approve = false, change = false, reel } = {}) {
  if (reel) return reelTitle(ctx, found, reel, words);
  const now = found.record.title;
  if (words == null && !approve) {
    ctx.say(now ? `The title is "${now.text}", ${now.from === "claude" ? "recommended by Claude" : "given by a person"}, ${now.approved ? "approved" : "not yet approved"}.` : "There is no title yet. Say the words to put on screen.");
    return 0;
  }
  if (claimHeld(ctx, found.record)) return refuse(ctx, claimHeld(ctx, found.record));
  if (now && now.approved && !change) return refuse(ctx, `The title "${now.text}" is approved already. To change it, say to change it (--change): BRIMM Ops may already have it.`);
  if (words != null && /[\r\n]/.test(words)) return refuse(ctx, "A title is one line.");
  const text = words == null ? (now ? now.text : "") : oneLine(words);
  if (!text) return refuse(ctx, "There is no title to approve. Say the words to put on screen.");
  const count = text.split(" ").length;
  if (count > TITLE_MOST) return refuse(ctx, `A title is at most ${TITLE_MOST} words, and that is ${count}.`);
  const title = { text, from: words == null ? now.from : "person", approved: approve };
  const changed = change && now && now.approved && now.text !== text ? " BRIMM Ops may already have the old title, so change it there too." : "";
  return save(ctx, found, { ...found.record, title }, `The title is "${text}", ${approve ? "approved" : "not yet approved"}.${changed}`);
}

/** Show or set a Reel's title on screen: the words in its picture, which the hand-off gives BRIMM Ops. A Reel's title is
    Claude's hook until a person says otherwise. A Reel `app … reel <n>` made has a title (plan PR 5; architecture 6.1 and 8.5). A Reel
    a reading suggested that nobody has made is refused: on a Mac set up for HyperFrames she is told how to make it, and on any other
    where she makes it for now (notMadeWords). */
async function reelTitle(ctx, found, n, words) {
  const reels = (found.record.reels || []).map((r) => ({ ...r }));
  const reel = reels.find((r) => r.n === n);
  if (!reel) return refuse(ctx, `There is no Reel ${n}.`);
  // A Reel a reading suggested is not made, and no Reel brimm-video makes would show its title: she is told how to make it.
  if (!madeInApp(found.record, n) && notMade(found, n)) return refuse(ctx, notMadeSaid(ctx, found.record, n));
  if (words == null) {
    ctx.say(reel.title ? `Reel ${n}'s title on screen is "${reel.title}".` : `Reel ${n} has no title on screen. Say what it says.`);
    return 0;
  }
  if (claimHeld(ctx, found.record)) return refuse(ctx, claimHeld(ctx, found.record));
  if (/[\r\n]/.test(words)) return refuse(ctx, "A title is one line.");
  const text = oneLine(words);
  if (!text) return refuse(ctx, `Say what Reel ${n}'s title on screen says.`);
  const count = text.split(" ").length;
  if (count > TITLE_MOST) return refuse(ctx, `A title is at most ${TITLE_MOST} words, and that is ${count}.`);
  reel.title = text;
  return save(ctx, found, { ...found.record, reels }, `Reel ${n}'s title on screen is "${text}".`);
}

/** Mark Reels picked or dropped, by their numbers. A record only: phase 3 also writes a picked Reel's project here. No command picks
    a Reel by this any more (plan PR 5): `reel pick` is gone, and `app … reel <n>` marks the Reel it opens picked in its own write
    (app-reel.js). `pickReels` stays for the Final Cut Reel path and its tests until the retirement's wave 5 takes that path away; `reel
    drop` is `dropReels`. */
async function markReels(ctx, found, ns, status) {
  const { record } = found;
  if (claimHeld(ctx, record)) return refuse(ctx, claimHeld(ctx, record));
  if (record.kind === "short video") return refuse(ctx, "A short video has no Reels.");
  if (!ns.length) return refuse(ctx, "Say which Reels, by their numbers.");
  const reels = (record.reels || []).map((reel) => ({ ...reel }));
  for (const n of ns) {
    const reel = reels.find((r) => r.n === n);
    if (!reel) return refuse(ctx, `There is no Reel ${n}. The Reels are ${reels.map((r) => r.n).join(", ") || "none"}.`);
    if (reel.status === "finished") return refuse(ctx, `Reel ${n} is finished: it is in the hand-off already.`);
    reel.status = status;
  }
  // A Reel picked in an episode with Reel candidates (phase 3) has its upright project written now, as edit/reel-<n>.v0.fcpxml,
  // by the rule, in the same record as its pick (design, section 3). A candidate with nothing to show is not picked. One whose
  // project cannot be written yet is picked all the same. A project already written and listed is kept as it is, and one
  // written now is taken away again when the record cannot be written, so no project is left that no record lists.
  const files = {};
  const written = new Set();
  const fresh = [];
  const later = [];
  const listing = existsSync(join(found.folder, REELS_FILE)) ? readReels(readFileSync(join(found.folder, REELS_FILE), "utf8")) : null;
  // Only a Reel whose project is still to be made from the list needs it: not one whose project is written and listed, nor a
  // clip the import cut before phase 3.
  const needList = ns.filter((n) => {
    const v0 = timelineFile({ part: { reel: n }, v: 0 });
    const reel = reels.find((r) => r.n === n);
    const clipped = (Array.isArray(reel.files) ? reel.files : []).some((f) => /\.reel-\d+\.mp4$/i.test(f));
    return !clipped && !(record.files && v0 in record.files && existsSync(join(found.folder, v0)));
  });
  if (status === "picked" && !listing && needList.length && record.files && REELS_FILE in record.files) return refuse(ctx, `${REELS_FILE} is missing from this episode, though its record lists it, so no Reel is picked: its project could not be made. ${keptOrWait(ctx, found, record)}`);
  if (status === "picked" && listing) {
    for (const n of ns) {
      const candidate = listing.reels ? listing.reels.candidates.find((c) => c.n === n) : null;
      if (candidate && !candidate.ranges.length) return refuse(ctx, `Reel ${n} has nothing to show: ${String(candidate.failed || "it has no stretch").replace(/\.$/, "")}.`);
    }
    // A candidate a reading suggested has no crops until it is made (reels.json version 2), and nothing makes one yet: none is
    // picked, and each such is named, with where she makes them for now.
    const unmade = listing.reels ? [...new Set(ns)].filter((n) => listing.reels.candidates.some((c) => c.n === n && uncropped(c))) : [];
    if (unmade.length) return refuse(ctx, notMadeWords(unmade));
    // A change Dropbox took away is said before anything is written, as save says it.
    const gone = undone(found.record, ctx.home);
    if (gone) {
      ctx.say(`${gone} Nothing was written.`);
      acceptRev(ctx.home, found.record.id, found.record.rev);
      return 1;
    }
    const work = join(runsFolder(ctx.home), `pick-${process.pid}-${ctx.now()}`);
    try {
      for (const n of ns) {
        const file = timelineFile({ part: { reel: n }, v: 0 });
        const at = join(found.folder, file);
        if (file in record.files && existsSync(at)) {
          written.add(n);
          continue;
        }
        const made = await reelTimeline(found, reels.find((r) => r.n === n), ctx);
        if (!made.xml) {
          later.push(made.coming ? `Reel ${n}'s project is written when it is shown: Dropbox is still bringing ${made.coming} over to this Mac.` : `Reel ${n}'s project could not be written: ${String(made.why).replace(/\.$/, "")}.`);
          continue;
        }
        mkdirSync(join(found.folder, "edit"), { recursive: true });
        const entry = textWriter({ work, ...ruleOpts(ctx) })(at, made.xml, { replace: existsSync(at) });
        files[file] = entry.bytes;
        written.add(n);
        fresh.push(at);
      }
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
  const said = ns.map((n) => (status === "picked" ? `Reel ${n} is picked.${written.has(n) ? " Its upright Final Cut project is written." : ""} Say "show reel ${n} in Final Cut" to have it pushed.` : `Reel ${n} is dropped.`));
  const saved = await save(ctx, found, { ...record, reels, files: { ...record.files, ...files } }, [...said, ...later].join(" "));
  if (saved !== 0) for (const at of fresh) rmSync(at, { force: true });
  return saved;
}
export const pickReels = (ctx, found, ns) => markReels(ctx, found, ns, "picked");
export const dropReels = (ctx, found, ns) => markReels(ctx, found, ns, "dropped");

/** Whether Reel `n` of the episode `found` is one a reading suggested and nobody has made (reels.json version 2): its candidate
    has no crops, and no project of its own is listed. There is nothing upright to show or change, whatever the record says of
    it, and nothing makes one yet (phase V). */
function notMade(found, n) {
  const { record } = found;
  if ((record.files && timelineFile({ part: { reel: n }, v: 0 }) in record.files) || !existsSync(join(found.folder, REELS_FILE))) return false;
  const listing = readReels(readFileSync(join(found.folder, REELS_FILE), "utf8"));
  const candidate = listing.reels ? listing.reels.candidates.find((c) => c.n === n) : null;
  return Boolean(candidate && uncropped(candidate));
}

/** What is said of a Reel a reading suggested that nobody has made, by every command that needs it made: on a Mac set up for
    HyperFrames how to make it, "Reel 3 isn't made yet. Say "open Reel 3 of <name> in HyperFrames" to make it." (app-reel.js
    notMadeYet), as `title` and `reels` say it; on any other Mac, which cannot make one, where she makes it for now (notMadeWords). */
const notMadeSaid = (ctx, record, n) => (appOf(ctx.settings) ? notMadeYet(n, shownName(record)) : notMadeWords(n));

/** What is said of a Reel `app … reel <n>` made, by the commands that work on a timeline in Final Cut (push, and the layers): it is
    a project in HyperFrames, and nothing writes a timeline for it in Final Cut, so she is not sent where a Reel nobody made is sent
    (OpusClip, which would be wrong of a Reel just made) and is not told it is not picked: she is sent back to HyperFrames. A Reel the
    Final Cut path wrote a project for before it was opened there keeps that project, and these commands work on it as before.
    "" for any other Reel. */
const inHyperFramesWords = (record, n) => (madeInApp(record, n) && !(record.files && timelineFile({ part: { reel: n }, v: 0 }) in record.files)
  ? `Reel ${n} is a project in HyperFrames, not in Final Cut: say "${openReelWords(n, shownName(record))}" to work on it there.`
  : "");

/** What is said of a Reel that is not picked, by the commands that need one picked: push, and the layers (captions, text, graphic,
    preset, cut). A Reel was picked once by `reel pick`, which plan PR 5 took away: opening it in HyperFrames picks it (app-reel.js).
    So on a Mac set up for the app she is told to open it, and on any other, where nothing picks a Reel any more, to ask Jason. */
const notPickedWords = (ctx, record, n) => `Reel ${n} is not picked. ${appOf(ctx.settings) ? `Opening it in HyperFrames picks it: say "${openReelWords(n, shownName(record))}".` : "Nothing on this Mac picks a Reel any more: ask Jason."}`;

/** Show a picked Reel in Final Cut Pro: its timeline (reelTimeline: the project written at its pick, its own project, or for an
    episode imported before phase 3 the clip the import cut), through the push every part shares, with its guard. A Reel a
    reading suggested and nobody has made yet (notMade) is refused first, with how to make it (notMadeSaid). */
export async function pushReel(ctx, found, n, { noHandEdits = false, handEdits = false, withoutOther = false } = {}) {
  const { record } = found;
  if (record.kind === "short video") return refuse(ctx, "A short video has no Reels.");
  const reel = (record.reels || []).find((r) => r.n === n);
  if (!reel) return refuse(ctx, `There is no Reel ${n}.`);
  if (inHyperFramesWords(record, n)) return refuse(ctx, inHyperFramesWords(record, n));
  if (notMade(found, n)) return refuse(ctx, notMadeSaid(ctx, record, n));
  if (reel.status !== "picked" && reel.status !== "finished") return refuse(ctx, notPickedWords(ctx, record, n));
  const made = await timelineFor(found, { reel: n }, ctx);
  if (made.coming) {
    // As open does: a detached run reads the Reel's own files to their end, so that Dropbox brings them over.
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: made.bring || (reel.files || []).filter((f) => f in found.record.files) });
    return refuse(ctx, `Dropbox is bringing ${made.coming} over to this Mac. Say "show reel ${n} in Final Cut" again when it is done.`);
  }
  if (made.why) return refuse(ctx, made.why);
  return pushPart(ctx, found, { part: { reel: n }, xml: made.xml, told: made.told, noHandEdits, handEdits, withoutOther });
}

/** The files of one folder, each {name, bytes, mtimeMs}: none when the folder is not there. An export bundle is a folder,
    and is as new as the later of its own time and its Info.fcpxml's: saving over a bundle of the same name may leave the
    folder's time as it was (phase 0, A5). */
function listing(dir) {
  try {
    return readdirSync(dir).map((file) => {
      const found = statSync(join(dir, file));
      if (!found.isDirectory()) return { name: file, bytes: found.size, mtimeMs: found.mtimeMs };
      const info = statSync(join(dir, file, "Info.fcpxml"), { throwIfNoEntry: false });
      return { name: file, bytes: 1, mtimeMs: Math.max(found.mtimeMs, info ? info.mtimeMs : 0) };
    });
  } catch (e) {
    return [];
  }
}
const capital = (text) => text[0].toUpperCase() + text.slice(1);

/** Which way `finish` goes for a video, by its record (plan PR 7, item 1): "hyperframes" for a raw video that has a main project in
    use, and for an iPhone clip whose main project in use the app has opened, to be finished from the exports the app made of it
    (exports.js); "clip" for any other iPhone clip she answered, which is asked whether to hand it off as it is (finishClip); "finished"
    for a finished video, which is not edited here; "unopened" for a raw video with neither a project nor a push, on a Mac whose settings
    turn the app on, which has nothing to finish yet and is told so in HyperFrames' words; and "final cut" for the rest, which go as they
    always went. The Final Cut way stays for the episodes already under way in it, until the retirement's wave 4. */
function finishWay(ctx, record) {
  const kind = recordKind(record);
  const projects = (record.app?.projects ?? []).filter((p) => p.state !== PROJECT_KEPT);
  if (kind === "raw" && projects.some(inUse)) return "hyperframes";
  if (isClip(record)) return projects.some((p) => inUse(p) && Array.isArray(p.opened) && p.opened.length > 0) ? "hyperframes" : "clip";
  if (!hasFinalCut(record)) return "finished";
  // A Reel project (plan PR 5) can be made before the main video is opened: the main video still has nothing to finish.
  if (kind === "raw" && !partsOf(record)[0].pushes.length && (appOf(ctx.settings) || projects.length > 0)) return "unopened";
  return "final cut";
}

/** The Reels of the record that `app … reel N` made a project for (plan PR 5): { reel: n } for each Reel project not kept for an earlier
    kind. Such a Reel is finished from its project's export, wherever the main video was edited. */
const reelProjectsOf = (record) => (record.app?.projects ?? []).filter((p) => p.state !== PROJECT_KEPT && /^reel [1-9]\d*$/.test(p.key)).map((p) => ({ reel: Number(p.key.slice(5)) }));

/** The words a Reel made from suggestion `n` is expected to start with: the suggestion's opening in reels.json (its `first`, else its
    words), its first twelve words. "" when it was made from times she gave, or the list cannot be read. */
function suggestionOpening(folder, n) {
  if (!Number.isInteger(n)) return "";
  try {
    const candidate = (readReels(readFileSync(join(folder, REELS_FILE), "utf8")).reels?.candidates ?? []).find((c) => c.n === n);
    const text = (v) => (typeof v === "string" ? v.trim() : "");
    return candidate ? (text(candidate.first) || text(candidate.words)).split(/\s+/).filter(Boolean).slice(0, 12).join(" ") : "";
  } catch (e) {
    return "";
  }
}

/** finish, the quick part (spec section 5, steps 1 and 2): find what Final Cut Shared and exported of each part, or what HyperFrames
    exported (finishWay), say what each is taken for, and ask what it must. With `answers.yes` and nothing left to ask, it writes what
    it was told in finish.asked.json, on this Mac's own disk, starts the detached part (finishNow) and returns at once. */
export async function finishEpisode(ctx, found, answers = {}) {
  const { record } = found;
  if (claimHeld(ctx, record)) return refuse(ctx, claimHeld(ctx, record));
  // A client or group session, and a video not yet answered, are not finished here, in either version of the hand-off: refused at
  // once, before any folder is looked in, so that no part line, no "Looked in" line and no file name is printed, and before any
  // claim is written.
  const notYet = cannotFinish(record);
  if (notYet) return refuse(ctx, notYet);
  // A finished video is not edited in Final Cut: its hand-off is written from its spellings (saveSpellings), as version 2, which a
  // version 1 hand-off could not hold. An iPhone clip she answered is edited in HyperFrames, if at all: not opened there, it is asked
  // about once (finishClip). Said at once too, before any part is looked for or transcribed, and with no folder named.
  const way = finishWay(ctx, record);
  if (way === "finished") return refuse(ctx, notInFinalCut(ctx, found, record));
  if (way === "clip") return finishClip(ctx, found, answers);
  if (way === "unopened") return refuse(ctx, NEVER_OPENED);
  const app = way === "hyperframes";
  // Where its hand-off goes (finish.js handoffTarget, which every hand-off writer asks), and why it cannot be written, if it
  // cannot: under version 2, a gap in the chain of its versions, or a version of it, earlier or later, that is a session not
  // cleared. That is refused at once too, as the detached part refuses it before anything is copied, and before any claim.
  const target = handoffTarget(ctx, { folder: found.folder, record });
  if (target.refusal) return refuse(ctx, target.refusal);
  const stops = [];
  const gone = undone(record, ctx.home);
  if (gone) {
    acceptRev(ctx.home, record.id, record.rev);
    stops.push(gone);
  }
  // What the hand-off needs, in the version it will be written in (spec 2026-10-22, section 8): the one this Mac's settings say,
  // or version 2 when the hand-off on file is version 2 already (writesV2For). Version 1 needs a name, and an approved title for
  // all but a short video. Version 2 has no title, and needs a name only for a raw video (a finished video's name is its file's).
  const { v2 } = target;
  if (record.name && record.name.placeholder && (!v2 || recordKind(record) === "raw")) stops.push(`Give the episode its name first: it is still called "${record.name.text}", from the video's file name.`);
  if (!v2 && record.kind !== "short video" && !(record.title && record.title.approved)) stops.push("Approve a title first.");
  const problems = filesProblems(found.folder, record);
  if (problems.length) stops.push(`${calledAs(ctx, found)} is not whole in Dropbox: ${problems.join(" ")}`);
  const running = runningCommand(ctx.home, found.name, ctx.alive);
  if (running) stops.push(`${running} is running for this episode. Say "how far is it?"`);
  const noHandEdits = answers.noHandEdits || [];
  // A finished Reel's title is the words in its picture, which BRIMM Ops is told: one that has none is asked for, never made up.
  const plan = (() => {
    try {
      return JSON.parse(readFileSync(join(found.folder, `${basename(record.video.file, extname(record.video.file))}.cut-plan.json`), "utf8"));
    } catch (e) {
      return null;
    }
  })();
  let looked;
  /** What is said of each part, and then of what was passed over, before the stops and the asks. */
  const lines = [];
  if (app) {
    // HyperFrames' exports, in Downloads and in what the other Mac released (exports.js), for the projects of the record.
    const seen = exportsFound({ home: ctx.home, name: found.name, folder: found.folder, record, zone: ctx.deps.zone, readdir: ctx.deps.readdir });
    if (seen.unreadable) return refuse(ctx, DOWNLOADS_UNREADABLE);
    looked = lookForExports(seen.input, answers);
    lines.push(...looked.parts.map((part) => part.line), ...looked.mentions);
    // A Reel picked that has no project cannot be exported from the app: it is left out, and said.
    const projects = record.app?.projects ?? [];
    for (const reel of (record.reels || []).filter((r) => r.status === "picked" && !projects.some((p) => p.key === `reel ${r.n}` && p.state !== PROJECT_KEPT))) {
      lines.push(`Reel ${reel.n} is picked but has no HyperFrames project, so it is left out. Say "make Reel ${reel.n}" to make one.`);
    }
  } else {
    const here = fromFinalCutFolder(ctx.home);
    mkdirSync(here, { recursive: true });
    const released = join(found.folder, "edit", "from-final-cut");
    // A Reel that `app … reel N` made a project for is finished from that project's export, wherever the main video was edited: it
    // is not asked for as a Reel picked with no Share (plan PR 5 marks it picked).
    const inApp = new Set(reelProjectsOf(record).map((p) => p.reel));
    looked = lookFor(partsOf(record).filter((part) => !(part.reel && inApp.has(part.reel))), { fromFinalCut: { dir: here, files: listing(here) }, released: { dir: released, files: listing(released) }, finished: record.finished }, answers);
    // A part whose Share is of a version shown before the session asked for more would finish without it: it is shown again
    // first. A version pushed before pushes kept what was asked for cannot be told, and is taken as it is.
    for (const part of looked.parts.filter((p) => p.video)) {
      const timeline = part.reel ? { reel: part.reel } : "main";
      const target = part.reel ? (record.reels || []).find((r) => r.n === part.reel) : record.main;
      const shown = ((target && target.pushed) || []).find((p) => p.project === part.video.name.replace(/\.[^.]*$/, ""));
      if (shown && shown.asked && shown.asked !== askedOf(record, timeline)) looked.asks.push(`${capital(part.label)} has changes asked for since v${shown.v} was shown in Final Cut: say "show it in Final Cut", Share it again, and then finish.`);
    }
    for (const part of looked.parts) {
      if (part.kept) lines.push(`${capital(part.label)}: kept as the last finish made it.`);
      else lines.push(`${capital(part.label)}: ${part.video.name}, from ${part.video.where}${part.export ? `, with its export ${part.export.name}` : noHandEdits.includes(part.key) ? ", with no hand edits" : ""}.`);
    }
    if (inApp.size) {
      const seen = exportsFound({ home: ctx.home, name: found.name, folder: found.folder, record, zone: ctx.deps.zone, readdir: ctx.deps.readdir });
      if (seen.unreadable) return refuse(ctx, DOWNLOADS_UNREADABLE);
      const reels = lookForExports(seen.input, answers, { rest: false });
      looked = { parts: [...looked.parts, ...reels.parts], asks: [...looked.asks, ...reels.asks], stops: [...looked.stops, ...reels.stops], looked: looked.looked };
      lines.push(...reels.parts.map((part) => part.line), ...reels.mentions);
    }
  }
  for (const part of looked.parts.filter((p) => p.reel)) {
    const reel = (record.reels || []).find((r) => r.n === part.reel);
    if (reel && String(reel.title || "").trim()) continue;
    // A Reel project must have its Reel in the record, whose title and numbers the hand-off takes; one finished another way is kept as it is.
    // Whether a Reel is HyperFrames' is the part's to say (it has a project), also in an episode whose main video went the Final Cut way.
    const mine = app || Boolean(part.project);
    if (mine && !reel) {
      if (part.project) stops.push(`The record has no Reel ${part.reel} for its HyperFrames project: ask Jason.`);
      continue;
    }
    const opening = mine ? suggestionOpening(found.folder, part.fromSuggestion) : expectedWords(part, record, plan);
    looked.asks.push(`Reel ${part.reel} has no title on screen. Say what it says${opening ? `: it starts "${opening}"` : ""}.`);
  }
  for (const line of [...lines, ...looked.stops, ...stops, ...looked.asks]) ctx.say(line);
  if (looked.stops.length || stops.length) {
    ctx.say(looked.looked);
    return 1;
  }
  if (looked.asks.length || !answers.yes) {
    if (!looked.asks.length) ctx.say(app ? 'Say "yes, hand it off" to start.' : 'Say "yes, finish it" to start.');
    return 0;
  }
  // The finish holds the episode while it runs: an episode nobody has open is claimed for this Mac first, so the other Mac's
  // open is refused until the finish lets it go (the review of PR 21, finding 2).
  let rev = record.rev;
  if (!record.editing) {
    if ((await save(ctx, found, claimFor(record, ctx.machine, localStamp(new Date(ctx.now()))), "")) !== 0) return 1;
    const again = readEpisode(found.folder);
    if (!again.record) return refuse(ctx, notRead(ctx, { ...found, read: again }));
    rev = again.record.rev;
  }
  // What finish was told, for the detached part. A part from HyperFrames says its project, the suggestion it was made from and the words
  // it is expected to start with; its video is the export, with no export of the edit to go with it.
  const askedPart = (p) => {
    const mine = app || Boolean(p.project);
    return {
      key: p.key, label: p.label, ...(p.reel ? { reel: p.reel } : {}), projects: p.projects,
      ...(mine ? { project: p.project, fromSuggestion: p.fromSuggestion ?? null, expected: p.reel && !p.kept ? suggestionOpening(found.folder, p.fromSuggestion) : "" } : {}),
      video: mine && p.video ? { name: p.video.name, dir: p.video.dir, where: p.video.where, bytes: p.video.bytes, mtimeMs: p.video.mtimeMs } : p.video,
      export: p.export, kept: p.kept, noHandEdits: mine ? false : noHandEdits.includes(p.key)
    };
  };
  const asked = { version: 1, ...(app ? { source: "hyperframes" } : {}), at: localStamp(new Date(ctx.now())), rev, ...(rev !== record.rev ? { claimed: true } : {}), parts: looked.parts.map(askedPart) };
  const work = episodeWork(ctx.home, found.name);
  mkdirSync(work, { recursive: true });
  writeFileSync(join(work, "finish.asked.json"), JSON.stringify(asked, null, 2) + "\n");
  startDetached(ctx, { command: "finish", folder: found.name });
  ctx.say("Started. The panel shows how far it is.");
  return 0;
}

/** `finish "<episode>" [--yes] [--take "<part>=<file | this Mac | the other Mac>"]… [--final "<part>"]…
    [--no-hand-edits "<part>"]… [--without "reel <n>"]… [--as-it-is]`, and the
    detached part it starts, `finish --now "<episode folder>"`, which runs finishNow holding the episode's lock. */
async function finish(ctx, rest) {
  const { words, flags } = flagsOf(rest, ["take", "no-hand-edits", "without", "final"]);
  if (flags.now) {
    const found = findEpisode(ctx, words.join(" "));
    if (!found.read || !found.read.record) {
      const why = found.why || notRead(ctx, found, words.join(" "));
      ctx.say(why);
      // The episode is there but its record cannot be read (a conflicted copy, say): the finish leaves a result that says
      // why, so that status shows it and not "nothing is running" (the P1 check, T6).
      if (found.read) await runDetached({ home: ctx.home, folder: found.name, clean: resultClean(ctx), command: "finish", alive: ctx.alive, keepAwake: () => {} }, async () => ({ ok: false, failed: [why] }));
      // The gate ended it: the same, in the gate's words, and the claim its quick part took for it is let go, as below.
      if (found.gate) {
        await leaveGateResult(ctx, found, "finish");
        const gone = letGoClaim(ctx, { folder: found.folder, name: found.name });
        if (gone) ctx.say(gone);
      }
      return 1;
    }
    // The progress panel shows the finish as it shows an import (phase P).
    const progress = ctx.deps.progress || reporter({ folder: progressFolder(ctx.home), swift: findPrograms().swift });
    const result = await runDetached({ home: ctx.home, folder: found.name, clean: resultClean(ctx), command: "finish", alive: ctx.alive, ...(ctx.deps.keepAwake ? { keepAwake: ctx.deps.keepAwake } : {}) }, () => finishNow(ctx, { folder: found.folder, name: found.name, record: found.read.record }, { progress }));
    if (result.taking || result.running) {
      ctx.say(result.taking ? `Another run is taking over ${calledAs(ctx, found)}'s lock. Say finish again in a moment.` : `${result.running} is running for ${calledAs(ctx, found)} already.`);
      // The finish never ran: a claim its quick part took for it is let go (the P1 check, T17).
      const gone = letGoClaim(ctx, { folder: found.folder, name: found.name });
      if (gone) ctx.say(gone);
      return 1;
    }
    return result.ok ? 0 : 1;
  }
  const got = episodeFor(ctx, words, { newerEnds: 1 });
  if (!got.found) return got.code;
  // A session's finish is its own: the hand-off of what she approved of its teachings.
  if (taughtSession(got.record)) return finishSessionCommand(ctx, { ...got.found, record: got.record });
  const take = Object.fromEntries((flags.take || []).map((given) => [given.slice(0, given.indexOf("=")).trim(), given.slice(given.indexOf("=") + 1).trim()]).filter(([part]) => part));
  return finishEpisode(ctx, { ...got.found, record: got.record }, { yes: Boolean(flags.yes), take, noHandEdits: flags["no-hand-edits"] || [], without: flags.without || [], final: flags.final || [], asItIs: Boolean(flags["as-it-is"]) });
}

/** Is a program running on this Mac, by its name, as pgrep finds it? */
const programRunning = async (name) => spawnSync("/usr/bin/pgrep", ["-x", name], { stdio: "ignore" }).status === 0;
/** The size of a library, as a person reads it. */
const librarySize = (folder) => sizeText(folderSize(folder));

/** Delete an episode's Final Cut library on this Mac, to free space (spec section 5, step 9). Only when the episode is
    finished; each part's edit is kept in an export copied into final/, or the part had no hand edits; every medium those
    exports name is inside the episode's folder; and Final Cut Pro is not running. Without `yes` it says what it would delete
    and how large it is. It deletes only inside this Mac's work folder for the episode. Render files alone are freed in
    Final Cut, with File > Delete Generated Library Files. */
export async function freeLibrary(ctx, found, { yes = false } = {}) {
  const { record } = found;
  const { finished } = record;
  if (!finished) return refuse(ctx, "It is not finished yet, so its library holds work kept nowhere else.");
  const work = resolve(episodeWork(ctx.home, found.name));
  const library = resolve(libraryFor(ctx.home, found.name));
  if (!library.startsWith(`${work}/`) || !work.startsWith(`${resolve(workFolder(ctx.home))}/`)) return refuse(ctx, "Its library is not in this Mac's work folder for the episode, so it is left alone.");
  const unkept = unkeptParts(record, ctx.machine);
  if (unkept.length) return refuse(ctx, `The hand work of ${listed(unkept)} is kept only in the library: finish it with its export, or say it had no hand edits, first.`);
  for (const [key, p] of Object.entries(finished.parts || {}).filter(([, part]) => part.export)) {
    const at = join(found.folder, p.export);
    const xml = existsSync(join(at, "Info.fcpxml")) ? join(at, "Info.fcpxml") : at;
    let media = [];
    try {
      media = mediaIn(readFileSync(xml, "utf8"), xml);
    } catch (e) {
      return refuse(ctx, `The export of ${key}, ${p.export}, cannot be read, so its library is kept.`);
    }
    const outside = media.filter((path) => !path.normalize("NFC").includes(`/Episodes/${found.name}/`.normalize("NFC")));
    if (outside.length) return refuse(ctx, `The export of ${key} uses media outside the episode folder (${outside[0]}). Copy it into media/ first.`);
  }
  if (await (ctx.deps.running || programRunning)("Final Cut Pro")) return refuse(ctx, "Quit Final Cut Pro first.");
  if (!existsSync(library)) return refuse(ctx, "There is no library of it on this Mac.");
  const size = librarySize(library);
  if (!yes) {
    ctx.say(`This deletes ${library}, ${size}. Its edits are kept in final/. Say yes to delete it.`);
    return 0;
  }
  rmSync(library, { recursive: true, force: true });
  // The record stops naming a library on this Mac, so the next push makes a new one and names it there.
  const { [ctx.machine]: gone, ...libraries } = record.libraries || {};
  return save(ctx, found, { ...record, libraries }, `Deleted its Final Cut library on this Mac, ${size}.`);
}

/** The newest push of each part of an episode, by its key ("main", "reel 2"): { key, label, last }, where `last` is the push
    with the highest version, or null when the part was never pushed. */
function newestPushes(record) {
  const all = [{ key: "main", label: "the main video", pushed: record.main && record.main.pushed }, ...(record.reels || []).map((r) => ({ key: `reel ${r.n}`, label: `Reel ${r.n}`, pushed: r.pushed }))];
  return all.map(({ key, label, pushed }) => ({ key, label, last: (Array.isArray(pushed) ? pushed : []).reduce((best, p) => (!best || p.v > best.v ? p : best), null) }));
}

/** A name without its ending, composed, as the project names recorded at each push are. */
const projectOf = (name) => basename(name, extname(name)).normalize("NFC");

/** Every file in a folder, at any depth, as paths from it, but for those Dropbox never syncs: a name starting with a dot, as
    Finder's .DS_Store, or Icon\r. Listed, the other Mac would wait for them for ever. */
const filesUnder = (dir) => readdirSync(dir, { recursive: true })
  .filter((rel) => !String(rel).split("/").some((part) => part.startsWith(".") || part === "Icon\r") && statSync(join(dir, rel)).isFile()).sort();

/** Hand an episode this Mac has open over to the other Mac (spec section 1, "Picking an episode up"). In order:
    - only the Mac that has it open hands it over;
    - when this Mac made the newest push of any part, it asks whether it was changed in Final Cut since, and goes on only
      with an answer: `answer` is "no changes" or "changes stay";
    - finish's rule, here: each such part's newest whole Share in this Mac's From Final Cut must have an export no older
      than it (or none, when nothing changed), since on the other Mac every copied export looks newer than its Share;
    - each Share whole (the same size across a few seconds) and the newest export of each of those parts' projects is
      copied into edit/from-final-cut/ by the rule, the Shares first; a Share still being written is left out and named.
      Nothing of a part the other Mac pushed last is copied: it is not this Mac's to check, nor to hand over;
    - the record is let go, with the files it lists now (its own and the copies) and the answers, each earlier answer
      carried on while its version is still the part's newest. A copy made here at an earlier hand-over that Dropbox has
      taken away, and that this release has not made again, is listed no more, and named.
    Resolves 0 when it was handed over, and 1 when it refused, having said why. */
export async function releaseEpisode(ctx, found, { answer = "" } = {}) {
  const { record } = found;
  if (claimHeld(ctx, record)) return refuse(ctx, claimHeld(ctx, record));
  const name = shownName(record);
  const newest = newestPushes(record);
  // The parts this Mac pushed last: a part whose newest version was rendered was never in Final Cut, and is neither asked about
  // nor copied (spec 3, "One version model").
  const mine = newest.filter((p) => p.last && p.last.on === ctx.machine && p.last.how !== "render");
  // An episode nobody has open may be changed without opening it, so one this Mac pushed last is handed over as well.
  if (record.editing ? record.editing.by !== ctx.machine : !mine.length) return refuse(ctx, `This Mac does not have ${name} open, so there is nothing to hand over.`);
  // A finish still running would go on writing into the episode after the hand-over (the review of PR 21, findings 4 and 7).
  const running = runningCommand(ctx.home, found.name, ctx.alive);
  if (running && running !== "bring") return refuse(ctx, `${running} is running for ${name}. Say "how far is it?", and hand it over when it is done. Nothing was handed over.`);
  // The Shares and exports of the episode in this Mac's From Final Cut, by the project names recorded at its pushes, of the
  // parts this Mac pushed last alone: those are the ones checked below. A part the other Mac pushed last is not this Mac's to
  // hand over, and an older Share and export of it copied from here would look newer there than that Mac's own.
  const here = fromFinalCutFolder(ctx.home);
  const projects = new Map(newest.flatMap((p) => {
    const part = p.key === "main" ? record.main : (record.reels || []).find((r) => `reel ${r.n}` === p.key);
    return (part.pushed || []).filter((q) => q.project).map((q) => [q.project.normalize("NFC"), { key: p.key, v: q.v }]);
  }));
  // This Mac's Shares and exports of the episode, of every part: a copy of one in edit/from-final-cut/ was made here.
  const own = listing(here).filter((f) => kindOf(f.name) && projects.has(projectOf(f.name)));
  const mineKeys = new Set(mine.map((p) => p.key));
  const ours = own.filter((f) => mineKeys.has(projects.get(projectOf(f.name)).key));
  const videos = ours.filter((f) => kindOf(f.name) === "video");
  // Of one project's exports, the newest alone is checked and copied: an older one copied too would look newest on the other
  // Mac, where a bundle's folder is made new.
  const exports = [...ours.filter((f) => kindOf(f.name) === "export").reduce((best, f) => {
    const was = best.get(projectOf(f.name));
    if (!was || f.mtimeMs > was.mtimeMs) best.set(projectOf(f.name), f);
    return best;
  }, new Map()).values()];
  // The other Mac waits for the files the record lists: one missing here would be waited for there for ever. A copy of
  // this Mac's own Shares and newest exports, which this release makes again from From Final Cut, is left out of that check
  // (the P1 check, T2). So is a copy made here at an earlier hand-over that Dropbox has taken away: one this release does
  // not make again, of a part the other Mac pushed last, of an older export, or of a Share still being written, is listed no
  // more when it is handed over. Kept in the list, it would be waited for on the other Mac for ever, and every check of the
  // files on either Mac would stop at it (the review of the plan, P1 and P7; PR 21's W15). Any other copy is checked as any
  // other file.
  const remade = new Set([...videos, ...exports].flatMap((f) => {
    const from = join(here, f.name);
    return statSync(from).isDirectory() ? filesUnder(from).map((rel) => `edit/from-final-cut/${f.name}/${rel}`) : [`edit/from-final-cut/${f.name}`];
  }));
  const at = (rel) => join(found.folder, rel);
  const ownNames = new Set(own.map((f) => f.name));
  /** The name in From Final Cut that a copy in edit/from-final-cut/ was made from: its Share's, or its export bundle's. */
  const copiedFrom = (rel) => (rel.startsWith("edit/from-final-cut/") ? rel.slice("edit/from-final-cut/".length).split("/")[0] : "");
  const goneCopy = (rel) => ownNames.has(copiedFrom(rel)) && !existsSync(at(rel));
  const broken = filesProblems(found.folder, { ...record, files: Object.fromEntries(Object.entries(record.files).filter(([rel]) => !remade.has(rel) && !goneCopy(rel))) });
  if (broken.length) return refuse(ctx, `${calledAs(ctx, found)} is not whole in Dropbox: ${broken.join(" ")}. Nothing was handed over.`);
  if (mine.length && !answer) return refuse(ctx, `Did you change anything in Final Cut since it was last shown (${listed(mine.map((p) => `${p.key} v${p.last.v}`))})? Say "no changes" to hand it over, or "hand it over anyway" if your changes should stay on this Mac.`);
  // A Share is whole when it reads whole and its size holds across a few seconds: Final Cut may still be writing it.
  let notYet = [];
  if (videos.length) {
    const before = new Map(videos.map((f) => [f.name, f.bytes]));
    await (ctx.deps.wait || ((ms) => new Promise((done) => setTimeout(done, ms))))(5000);
    notYet = videos.filter((f) => {
      const now = ctx.stat(join(here, f.name));
      return !now || now.size !== before.get(f.name) || !ctx.isWhole(join(here, f.name));
    }).map((f) => f.name);
  }
  const whole = videos.filter((f) => !notYet.includes(f.name));
  for (const part of mine) {
    const shares = whole.filter((f) => projects.get(projectOf(f.name)).key === part.key);
    if (!shares.length) continue;
    const video = shares.reduce((best, f) => {
      const v = projects.get(projectOf(f.name)).v;
      const bv = best ? projects.get(projectOf(best.name)).v : -1;
      return !best || v > bv || (v === bv && f.mtimeMs > best.mtimeMs) ? f : best;
    }, null);
    const project = projectOf(video.name);
    const exported = exports.filter((f) => projectOf(f.name) === project).reduce((best, f) => (!best || f.mtimeMs > best.mtimeMs ? f : best), null);
    const label = capital(part.label);
    const tail = " Then hand it over again. Nothing was handed over.";
    if (exported && exported.mtimeMs < video.mtimeMs) return refuse(ctx, `${label}'s export is older than its Shared video. Once Final Cut says its Share is done, click in its timeline, then File > Export XML… on "${project}", and save it into From Final Cut.${tail}`);
    if (!exported && answer !== "no changes") return refuse(ctx, `${label} was never exported. If you changed it by hand in Final Cut, then once Final Cut says its Share is done, click in its timeline, then File > Export XML… on "${project}", and save it into From Final Cut. If you made no hand edits since it was shown, say so.${tail}`);
  }
  // The copies, by the rule: each file of each Share and export (a bundle file by file), the Shares first. A copy already
  // there at the size the record lists, and no older than what it copies, is kept as it is: cp -c keeps a file's time, so
  // only a Share or an export made again is copied again. Its time may be put to the whole second, as Dropbox keeps it, so
  // a copy up to 2 seconds older still counts (the P1 check, T13). New copies are made first, and copies made again last.
  const wanted = [...whole, ...exports].flatMap((f) => {
    const from = join(here, f.name);
    return statSync(from).isDirectory() ? filesUnder(from).map((rel) => ({ name: f.name, from: join(from, rel), rel: `edit/from-final-cut/${f.name}/${rel}` })) : [{ name: f.name, from, rel: `edit/from-final-cut/${f.name}` }];
  });
  const kept = (c) => {
    const there = ctx.stat(at(c.rel));
    const source = statSync(c.from);
    return Boolean(there) && there.size === source.size && record.files[c.rel] === source.size && there.mtimeMs > source.mtimeMs - 2000;
  };
  const fresh = wanted.filter((c) => !existsSync(at(c.rel)));
  const again = wanted.filter((c) => existsSync(at(c.rel)) && !kept(c));
  const copies = {};
  const copied = [];
  for (const c of [...fresh, ...again]) {
    try {
      mkdirSync(dirname(at(c.rel)), { recursive: true });
      (existsSync(at(c.rel)) ? replaceIn : cloneIn)(c.from, at(c.rel), ruleOpts(ctx));
    } catch (e) {
      const why = String(e.message).replace(/ Nothing was copied\.$/, "").replace(/\.$/, "");
      // The record lists what is there now: each copy made so far at its size, and a copy whose old one replaceIn deleted
      // before its clone failed no more, so that neither Mac waits for a file that is gone and a release again goes through
      // (the P1 check, T7 and T14).
      const gone = c.rel in record.files && !existsSync(at(c.rel));
      const files = { ...record.files, ...copies };
      if (gone) delete files[c.rel];
      const changed = JSON.stringify(files) !== JSON.stringify(record.files);
      const saved = changed ? (await save(ctx, found, { ...record, files }, "")) === 0 : true;
      const listedNote = gone ? (saved ? `, and its old copy is gone, so the record lists it no more` : `, and its old copy is gone; the record could not be written to say so`) : "";
      return refuse(ctx, `${gone ? `${c.rel} could not be copied again${listedNote}` : `${name} could not be handed over`}: ${why}. Nothing was handed over: say hand it over again.`);
    }
    copies[c.rel] = statSync(at(c.rel)).size;
    if (!copied.includes(c.name)) copied.push(c.name);
  }
  // Each earlier answer is carried on while its version is still that part's newest; this Mac's own answers come after.
  const answers = {};
  for (const [key, a] of Object.entries((record.released && record.released.answers) || {})) {
    const part = newest.find((p) => p.key === key);
    if (part && part.last && a && part.last.v === a.v) answers[key] = a;
  }
  for (const part of mine) answers[part.key] = { v: part.last.v, said: answer === "no changes" ? "no changes" : `changes stay on ${ctx.machine}` };
  // The copies made here that are still gone, now that this release has made its own, are listed no more (see above).
  const unlisted = Object.keys(record.files).filter(goneCopy);
  const files = Object.fromEntries(Object.entries({ ...record.files, ...copies }).filter(([rel]) => !unlisted.includes(rel)));
  const later = notYet.length ? ` Not copied yet, still being written: ${listed(notYet)}.` : "";
  const lost = unlisted.length ? ` Gone from Dropbox, so no longer listed for the other Mac: ${listed([...new Set(unlisted.map(copiedFrom))])}.` : "";
  return save(ctx, found, released({ ...record, files }, files, { at: localStamp(new Date(ctx.now())), by: ctx.machine, answers }), `${name} is handed over. Copied for the other Mac: ${copied.length ? listed(copied) : "nothing"}.${later}${lost} Keep this Mac open and online until Dropbox shows the folder is up to date.`);
}

/** What `show` prints, by the word for it: the file's ending after the video's own name, and what it is called. */
const SHOWN = { transcript: [".transcript.txt", "transcript"], notes: [".edit-notes.txt", "notes from Claude"], plan: [".cut-plan.txt", "cut plan"] };

/** `show "<episode>" transcript|notes|plan`: print the episode's transcript, Claude's notes or the cut plan, whole. Her session
    reads an episode's files only through this (spec section 4), and it takes no path. A file not whole on this Mac yet is
    brought over by a detached run, as open does. The transcript of a raw video she has answered is its rough cut's, with its
    times (spec 3, "Show me the transcript"), unless the record has a main HyperFrames project in use: then it is the recording's own,
    with the times of the project's timeline (plan PR 7, item 5). A finished video's, a clip's and one from before the switch is the
    video's own. Of a video not yet answered, or a session whose mark is not cleared, it prints nothing into her chat (printWhy): it
    opens a read-only copy of the file on this Mac, in TextEdit (showCopy). */
async function show(ctx, rest) {
  const words = rest.slice();
  const kind = words.pop();
  if (!SHOWN[kind] || !words.length) {
    ctx.say(HELP);
    return 2;
  }
  const got = episodeFor(ctx, words);
  if (!got.found) return got.code;
  const { found, record } = got;
  const stem = basename(record.video.file, extname(record.video.file));
  const [ending, what] = SHOWN[kind];
  // What it prints goes into her chat: of a video not answered or a session, or one held as a session, nothing; a copy opens on this
  // Mac instead.
  if (printWhy(record) || found.held) return showCopy(ctx, found, record, `${stem}${ending}`, what);
  // The record picks a raw video's transcript (plan PR 7, item 5): with a main HyperFrames project in use, the recording's own, whose times
  // are the project's timeline's; otherwise the rough cut's, which the reading still makes and an episode going the Final Cut way needs.
  const roughCut = kind === "transcript" && isAnswered(record) && recordKind(record) === "raw" && !(record.app?.projects ?? []).some(inUse);
  const file = roughCut ? `${stem}.rough-cut.transcript.txt` : `${stem}${ending}`;
  const path = join(found.folder, file);
  if (!existsSync(path)) return refuse(ctx, `${shownName(record)} has no ${what} yet.`);
  if (!ctx.isWhole(path)) {
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: [file] });
    return refuse(ctx, "Dropbox is still bringing it over; say it again when it is done.");
  }
  const text = readFileSync(path, "utf8");
  ctx.say((kind === "notes" ? notesForHer(text, record) : text).replace(/\n$/, ""));
  return 0;
}

/** What is said in place of a raw video's ideas for graphics in Claude's notes: their times there are the recording's. */
const IDEAS_ELSEWHERE = 'Say "any ideas for graphics?" to see them, numbered, with their times on the version you are watching.';
/** Claude's notes as her chat shows them (show, open): of a raw video she has answered, with their ideas for graphics, whose
    times are the recording's and not her timeline's, left out and IDEAS_ELSEWHERE in their place (spec 2026-10-22, section 3,
    "Times"), and with each idea on words that are cut left out of what could not be used, and that heading too when nothing
    else is under it; any other video's as written. Each part of the notes is a heading and its lines, after an empty line
    (notes.js notesText), and Claude's own notes in them hold no empty line. */
function notesForHer(text, record) {
  if (!(isAnswered(record) && recordKind(record) === "raw")) return text;
  return text.split("\n\n").map((block) => {
    if (block.startsWith("Its ideas for graphics\n")) return `Its ideas for graphics\n${IDEAS_ELSEWHERE}`;
    if (!block.startsWith("What could not be used from its reply\n")) return block;
    // An idea on words that are cut is listed by "any ideas for graphics?" (cut now, with its number), not at the recording's time.
    const lines = block.split("\n").filter((line, i) => i === 0 || !line.startsWith("An idea for a graphic sits on words that are cut, at "));
    // The notes end with a new line, so the last part's last line is empty: it is no line under the heading.
    return lines.slice(1).some((line) => line.trim()) ? lines.join("\n") : null;
  }).filter((block) => block !== null).join("\n\n");
}

/** Where `show` copies a file of the episode in `folder` to open it: ~/BRIMM Video Work/<folder>/shown/, on this Mac's own disk. */
const shownFolder = (home, folder) => join(episodeWork(home, folder), "shown");

/** The file in a shown/ folder that lists what brimm-video put into it (reveal.js). */
export { SHOWN_MARKER };

/** The folder `show` and `which` copy a file of the episode `found`, whose record is `record`, into, made: on a Mac whose lock in
    effect is open, ~/BRIMM Video Work/shown/<its id>/, whose name is no file's and no client's (reveal.js, R12); on any other, the
    episode's own shown/ folder, as always. Throws when it cannot be made. */
function madeShownDir(ctx, found, record) {
  if (lockFor(ctx.settings, ctx.deps) !== "open") {
    const dir = shownFolder(ctx.home, found.name);
    mkdirSync(dir, { recursive: true });
    return dir;
  }
  const dir = shownByIdFolder(ctx.home, record.id);
  madeShownByIdFolder(dir);
  return dir;
}

/** Open the file `rel` of the episode `found` (whose record is `record`, one the gate holds: a video not yet answered, left alone,
    or a session not cleared) on this Mac, and print nothing of it (spec 2, "What else the mark stops"): it is copied into
    ~/BRIMM Video Work/<folder>/shown/ (on an open-lock Mac, ~/BRIMM Video Work/shown/<its id>/: madeShownDir), made read-only
    (TextEdit saves in place, and the file in Dropbox is never written into),
    and opened in TextEdit, and she is told only that it was, by the video's name. The copies `show` made before in that folder go
    first, and `behind`, at the next session start, clears them all: each is listed by the folder's marker (SHOWN_MARKER) before it
    is made, and only what the marker lists is ever taken away. The copy is named by the video's name, never its file's. A file
    Dropbox has not brought whole yet is copied all the same: reading it is what brings it, and it is small. */
function showCopy(ctx, found, record, rel, what) {
  const name = namedAs(found, record);
  const from = join(found.folder, rel);
  if (!existsSync(from)) return refuse(ctx, `${name} has no ${what} yet.`);
  let copy = "";
  try {
    clearShownIn(madeShownDir(ctx, found, record), (listed) => listed.endsWith(".txt"));
    const dir = madeShownDir(ctx, found, record);
    const named = freeShownName(dir, `${fileSafe(name)} ${what}`, ".txt");
    copy = join(dir, named);
    addShown(dir, named);
    copyFileSync(from, copy);
    chmodSync(copy, 0o444);
  } catch (e) {
    return refuse(ctx, `${name}'s ${what} could not be copied on this Mac (${e.code || "an error"}).`);
  }
  try {
    ctx.openApp("TextEdit", copy);
  } catch (e) {
    return refuse(ctx, `${name}: ${String(e.message).replace(/\.$/, "")}.`);
  }
  ctx.say(`Opened ${name}'s ${what} in TextEdit on this Mac.`);
  return 0;
}

/** Clear the copies `show` and `which` made, of every episode (showCopy, whichCommand): `behind` does it at every session's start.
    Only the files a shown/ folder's marker lists are taken away (clearShownIn): a shown/ with no marker, and anything else in BRIMM
    Video Work, is left as it is, and nothing is gone into but shown/ itself. One that cannot be taken away stays until the next.
    The copies by id in ~/BRIMM Video Work/shown/<id>/ (reveal.js, R12) are cleared the same way. */
function clearShown(ctx) {
  let names = [];
  try {
    names = readdirSync(workFolder(ctx.home));
  } catch (e) {
    return;
  }
  for (const name of names) {
    try {
      clearShownIn(shownFolder(ctx.home, name));
    } catch (e) {
      // It is cleared at the next session start.
    }
  }
  // And the copies by id an open-lock Mac makes (reveal.js), in ~/BRIMM Video Work/shown/<id>/, whatever this Mac's lock is now.
  const byId = join(workFolder(ctx.home), "shown");
  const at = lstatSync(byId, { throwIfNoEntry: false });
  if (!at || !at.isDirectory()) return;
  let ids = [];
  try {
    ids = readdirSync(byId);
  } catch (e) {
    return;
  }
  for (const id of ids) {
    try {
      clearShownIn(join(byId, id));
    } catch (e) {
      // It is cleared at the next session start.
    }
  }
  try {
    rmdirSync(byId);
  } catch (e) {
    // A copy, or something brimm-video did not put there, is in it still.
  }
}

/** How long `behind` gives git, each time: well inside the two minutes the Code tab gives a command. */
const BEHIND_MS = 20000;

/** What `behind` says first when the lock on her folder for Claude has been loosened on this Mac (loosened.js, which makes the check). */
export { LOCK_CHANGED } from "./loosened.js";

/** Say that her folder's lock is changed, and why, if it is (lockLoosened): 1 when it said so, else null. */
function refuseIfLoosened(lock, say) {
  const why = lockLoosened(lock);
  if (!why.length) return null;
  say(LOCK_CHANGED);
  for (const line of why) say(line);
  return 1;
}

/** `behind`: whether this Mac's checkout of brimm-video is behind main on GitHub, by git, in this Mac's checkout: it fetches
    main, and counts the changes there that this checkout has not. First it clears the copies `show` opened (clearShown), the one thing it
    writes. Then it looks at the lock on her folder for Claude (lockLoosened): when that is loosened it says so, to ask Jason, and
    ends with 1 without asking git, since she is not to go on (editMain asks it too when this Mac has no settings for episodes). On her laptop git reaches GitHub with the deploy key. It changes nothing in the
    checkout, and otherwise always ends with 0: a check that could not be made is said. With the open lock in effect on this Mac it
    also says, and goes on, when Claude Code has not trusted her folder yet (UNTRUSTED, first), and, after its other lines, the entries
    this Mac's settings add to what her folder allows, so that a change shows (design section 2). On a Mac whose settings turn the app
    on it also says, whatever git answered and before those entries, one line when the pinned HyperFrames command line is not the one
    in this Mac's toolchain folder (hyperframes.js toolchainHolds and toolchainDiffers: none, another version, or the pinned version not
    as the pin has it); it looks at a folder and runs nothing. It is not said when the lock refused first. */
async function behind(ctx) {
  // The skill runs it at every session's start: the copies show opened in the last one go (spec 2, "cleared at the next session start").
  clearShown(ctx);
  const refused = refuseIfLoosened({ home: ctx.home, checkout: ctx.settings.checkout, deps: ctx.deps }, ctx.say);
  if (refused !== null) return refused;
  const open = lockFor(ctx.settings, ctx.deps) === "open";
  if (open) {
    let folder = null;
    try {
      folder = realpathSync.native(studioFolder(ctx.home));
    } catch (e) {
      // She has no folder for Claude on this Mac, so it has nothing to trust.
    }
    const untrusted = trustWhy({ home: ctx.home, folder, env: ctx.deps.env || process.env });
    if (untrusted) ctx.say(untrusted);
  }
  const added = open ? studioAllowOf(ctx.settings) : [];
  const run = ctx.deps.run || runProgram;
  const git = (...args) => run("/usr/bin/git", ["-C", ctx.settings.checkout, ...args], { limit: BEHIND_MS, out: 100 });
  const could = "Could not check for a newer brimm-video. Is this Mac offline?";
  // Her folder is looked at whatever git answers: that needs no network.
  const stale = studioStale(ctx);
  const folderLine = () => {
    if (stale) ctx.say(`Her folder for Claude is out of date: an older brimm-video wrote it. Ask Jason to update it when it suits. (Jason: in the checkout, run node tool/settings.js studio --node ${stale.node}, then start a new session in her Claude folder)`);
    // On a Mac that opens episodes in the app, the pinned command line must be in its toolchain folder (architecture 6.1: `behind` also
    // checks the toolchain). This needs no network either, so it is said whatever git answered. It is not said when the lock refused first.
    const differs = appOf(ctx.settings) ? toolchainDiffers(toolchainHolds(ctx.home)) : "";
    if (differs) ctx.say(`HyperFrames' command line on this Mac is not the one Studio needs. Ask Jason to update it when it suits. (Jason: Studio is pinned to version ${PIN.version}, and this Mac has ${differs}; the installer puts the pinned one in place.)`);
    if (added.length) ctx.say(`(Jason: her folder also allows, on this Mac: ${added.map(({ type, name }) => `${type} ${name}`).join(", ")}.)`);
    return 0;
  };
  const fetched = await git("fetch", "-q", "origin", "main");
  if (fetched.code !== 0 || fetched.outOfTime) {
    ctx.say(could);
    return folderLine();
  }
  const counted = await git("rev-list", "--count", "HEAD..origin/main");
  const n = Number(String(counted.stdout || "").trim());
  if (counted.code !== 0 || counted.outOfTime || !/^\d+$/.test(String(counted.stdout || "").trim())) ctx.say(could);
  else if (n === 0) ctx.say("This Mac has the newest brimm-video.");
  else ctx.say(`Jason has a newer brimm-video (${n} change${n === 1 ? "" : "s"}). Ask him to update this Mac when it suits.`);
  return folderLine();
}

/** Whether her folder for Claude (studio.js), when this Mac has one, is not what this checkout would write now, as after a
    git pull, which never rewrites it: {node}, the node its settings name (or Homebrew's, when they cannot be read), for the
    command that writes it again; or null when it is as this checkout writes it, or there is none. It is compared with the folder
    of the lock in effect on this Mac (loosened.js lockFor), the open one for this Mac's facts, since the command it names writes
    that one again. */
function studioStale(ctx) {
  let folder;
  try {
    folder = realpathSync.native(studioFolder(ctx.home));
  } catch (e) {
    return null;
  }
  const read = (name) => {
    try {
      return readFileSync(join(folder, name), "utf8");
    } catch (e) {
      return null;
    }
  };
  let node = HOMEBREW_NODE;
  try {
    node = JSON.parse(read(".claude/settings.json")).hooks.PreToolUse[0].hooks[0].args[1] || node;
  } catch (e) {
    // Settings that cannot be read are out of date too, and Homebrew's node is the one the installer finds.
  }
  const lock = lockFor(ctx.settings, ctx.deps);
  const want = studioFiles({ checkout: ctx.settings.checkout, node, folder, lock, facts: lock === "open" ? factsFor(ctx.home, ctx.settings, ctx.deps) : undefined });
  return Object.entries(want).every(([name, text]) => read(name) === text) ? null : { node: nameableNode(node) };
}

/** Homebrew's node, which the installer finds, and which is named when her folder's settings name none that can be run. */
const HOMEBREW_NODE = "/opt/homebrew/bin/node";

/** The node `behind` tells Jason to rewrite her folder with, from what her folder's settings name (a file she may have changed, and
    Jason is told to run what is printed): only an absolute path that ends in /node, holds no control character and is there;
    otherwise Homebrew's. */
const nameableNode = (node) => (typeof node === "string" && isAbsolute(node) && basename(node) === "node" && !/[\u0000-\u001f\u007f]/.test(node) && existsSync(node) ? node : HOMEBREW_NODE);

/** How two sides of a record differ, in what a person reads of it: each [what, A's, B's] where they differ, the sizes of the
    files each lists and of the files each handed over among them, so that two sides that differ only there do not read the
    same. When either side is a video not yet answered, or a session (gate.js gated), only who has it open, its finish, its
    hand-over, how far its main video was shown and the sizes of its files are said, a file named without the video's name;
    every other field that differs is named alone, as [what, null, null], and what it holds is never said into the chat. The
    account a reading was made on (`reading.account`) is never said, whatever the record. */
function recordDifferences(a, b) {
  const who = (r) => (r.editing ? r.editing.by : "nobody");
  const title = (r) => (r.title ? `"${r.title.text}"${r.title.approved ? ", approved" : ", not approved"}` : "none");
  const shownIn = (pushed) => (Array.isArray(pushed) && pushed.length ? `shown ${pushed.map((p) => `v${p.v} on ${p.on}`).join(", ")}` : "not shown");
  const reel = (r, n) => {
    const it = (r.reels || []).find((x) => x.n === n);
    return it ? `${it.status}, ${shownIn(it.pushed)}` : "not there";
  };
  const finished = (r) => (r.finished ? `revision ${r.finished.revision}, on ${r.finished.on}` : "not finished");
  const ns = [...new Set([...(a.reels || []), ...(b.reels || [])].map((x) => x.n))].sort((x, y) => x - y);
  const sizes = (what, x, y) => [...new Set([...Object.keys(x || {}), ...Object.keys(y || {})])].sort()
    .map((key) => [`${what} ${key}`, key in (x || {}) ? `${x[key]} bytes` : "not listed", key in (y || {}) ? `${y[key]} bytes` : "not listed"]);
  const handed = (r) => (r.released ? `by ${r.released.by || "a Mac it does not name"}` : "not handed over");
  // Every other field, as it is, by where it is in the record: the main video's and each Reel's own (their layers, phase
  // 4's, among them) and the record's others. A field added later is compared too, so no change of one side's is hidden.
  const as = (v) => (v === undefined || v === null || (Array.isArray(v) && !v.length) ? "none" : JSON.stringify(v));
  const fields = (x, y, skip) => [...new Set([...Object.keys(x || {}), ...Object.keys(y || {})])].filter((k) => !skip.includes(k)).sort();
  const reelOf = (r, n) => (r.reels || []).find((x) => x.n === n);
  // Claude's reading, but for the account it was read on, which is never said into the chat.
  const reading = (r) => (r.reading !== null && typeof r.reading === "object" && !Array.isArray(r.reading) ? Object.fromEntries(Object.entries(r.reading).filter(([k]) => k !== "account")) : r.reading);
  const others = [
    ...fields(a, b, ["version", "rev", "writer", "editing", "name", "title", "reels", "main", "finished", "released", "files"]).map((k) => [`${k[0].toUpperCase()}${k.slice(1)}`, as(k === "reading" ? reading(a) : a[k]), as(k === "reading" ? reading(b) : b[k])]),
    ...fields(a.main, b.main, ["pushed"]).map((k) => [`The main video's ${k}`, as(a.main && a.main[k]), as(b.main && b.main[k])]),
    ...ns.flatMap((n) => fields(reelOf(a, n), reelOf(b, n), ["n", "status", "pushed"]).map((k) => [`Reel ${n}'s ${k}`, as((reelOf(a, n) || {})[k]), as((reelOf(b, n) || {})[k])]))
  ];
  const rows = [
    ["Who has it open", who(a), who(b)],
    ["Name", `"${a.name && a.name.text}"`, `"${b.name && b.name.text}"`],
    ["Title", title(a), title(b)],
    ...ns.map((n) => [`Reel ${n}`, reel(a, n), reel(b, n)]),
    ["The main video", shownIn(a.main && a.main.pushed), shownIn(b.main && b.main.pushed)],
    ["Finished", finished(a), finished(b)],
    ["Handed over", handed(a), handed(b)],
    ...others,
    ...sizes("File", a.files, b.files),
    ...sizes("Handed-over file", a.released && a.released.files, b.released && b.released.files)
  ].filter(([, x, y]) => x !== y);
  const names = gated(a) || gated(b) ? namesOf(a.video && a.video.file, b.video && b.video.file) : null;
  const shown = (what) => ["Who has it open", "Finished", "Handed over", "The main video"].includes(what) || what.startsWith("File ") || what.startsWith("Handed-over file ");
  // What each side is, and its session mark, in words of brimm-video's own that name nothing, so that she sees which side holds the
  // answer or the mark that keeping the other would drop (resolveIn refuses that).
  const kindWords = (r) => (recordKind(r) === null ? (leftAlone(r) ? "left alone" : "not answered yet") : KIND_SAID[recordKind(r)]);
  const markWords = (r) => (r.session === undefined || r.session === null ? "none" : sessionNotCleared(r) ? "marked, not cleared" : "cleared by her click");
  const gatedRow = ([what, x, y]) => {
    if (shown(what)) return [withoutNames(what, names, [], { paths: false }), x, y];
    if (what === "Kind") return ["What it is", kindWords(a), kindWords(b)];
    if (what === "Session") return ["Its session mark", markWords(a), markWords(b)];
    return [what, null, null];
  };
  const said = names ? rows.map(gatedRow).filter(([, x, y]) => x === null || x !== y) : rows;
  // Two sides are never said to hold the same unless they do, but for their rev and who wrote them.
  return said.length || sameRecord(a, b) ? said : [["The rest of the record", "as A holds it", "as B holds it"]];
}

/** A record file, or any other JSON file (a hand-off), read as it is, or null when it is not there or cannot be read. */
function recordAt(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return null;
  }
}

/** Whether two records hold the same, but for their rev and who wrote them: a record a keep wrote holds its side so. */
const sameRecord = (a, b) => Boolean(a && b) && JSON.stringify({ ...a, rev: 0, writer: null }) === JSON.stringify({ ...b, rev: 0, writer: null });

/** `resolve "<episode>" [--keep A|B]`: sort out the conflicted copies Dropbox kept in an episode, one at
    a time, the records' first. A is what the episode holds (for a record, the record in force), and B the copy. Without
    --keep it shows how the two differ, and which Mac each came from, and notes on this Mac what it showed: --keep acts on
    that alone, and shows again when anything of it changed since, as when the other Mac sorted it out meanwhile. A record's
    copy is kept only when it has the record in force's number: a copy above it waits for Dropbox, and one below it, with
    records written since, needs Jason, since keeping either side could lose a change: he sorts it out with Claude on the
    Mac Studio. With --keep, in order:
    1. every file the step replaces or deletes is set aside in history/ by the rule, and must be whole there;
    2. the record is written, past the copies still there: the side kept as the next record, or, for another file, the next
       record with the kept side's size wherever it lists the file. Every keep writes a record, so that two Macs keeping
       opposite sides at once collide in Dropbox as a conflict of the record, which is shown, and never merge quietly;
    3. only then is anything replaced or deleted. When B cannot be put in A's place, A is put back from history/ and the
       record back as it was, or it says plainly where each side is.
    It is not refused while another Mac has the episode: a conflict must be sortable at any time. */
async function resolveConflict(ctx, rest) {
  const { words, flags } = flagsOf(rest, ["keep"]);
  const keep = flags.keep ? String(flags.keep[flags.keep.length - 1]).toUpperCase() : "";
  // --over-later-records is taken out for now: it wrote sizes that did not match the files (round 2, C).
  if (!words.length || (flags.keep && keep !== "A" && keep !== "B") || "over-later-records" in flags) {
    ctx.say(HELP);
    return 2;
  }
  // findEpisode, not episodeFor, which refuses an episode with a conflicted copy: findEpisode finds it by its folder, or by its
  // own name or id as the newest whole record past the copies gives them, or as a record's conflicted copy gives them.
  const found = findEpisode(ctx, words.join(" "));
  if (found.why) return refuse(ctx, found.why);
  try {
    return await resolveIn(ctx, found, keep);
  } catch (e) {
    return refuse(ctx, `It could not be sorted out: ${plainWhy(e)}. ${NEEDS_JASON}`);
  }
}

/** What resolve says when keeping either side here could lose a change. */
const NEEDS_JASON = "A conflict needs Jason: tell him the episode's name.";

/** Why the side `kept` of a record's conflict may not be kept over the side `other`, in plain words, or "": `other` marks the video a
    client or group session not cleared (gate.js sessionNotCleared: kind session, or a mark not cleared by her click) and `kept` is
    not one, which would clear the mark with no dialog; or `other` holds her answer and `kept` is a video waiting for its answer,
    which would take the answer back. Each names the video as edit.js names it (shownName). */
function keptOverWhy(kept, other) {
  if (sessionNotCleared(other) && !sessionNotCleared(kept)) return `One side marks ${shownName(other)} a client or group session: keep that side; the mark is cleared only by her click (say "clear the session mark").`;
  if (recordKind(other) !== null && recordKind(kept) === null) return `One side has ${shownName(kept)} answered: keep that side; an answer is changed only by saying what it is again.`;
  return "";
}

/** An error's words for a person: the copy rule's own "Nothing was copied." and the closing full stop taken off. */
const plainWhy = (e) => String(e && e.message ? e.message : e).replace(/ Nothing was copied\.$/, "").replace(/\.$/, "");

async function resolveIn(ctx, found, keep) {
  const read = readEpisode(found.folder, { pastCopies: true });
  if (!read.record) return refuse(ctx, notRead(ctx, { ...found, read }));
  const { record } = read;
  const name = shownName(record);
  const shownFile = join(episodeWork(ctx.home, found.name), "resolve.shown.json");
  const pin = (() => {
    try {
      return JSON.parse(readFileSync(shownFile, "utf8"));
    } catch (e) {
      return null;
    }
  })();
  const copies = conflictedCopies(found.folder);
  const inOrder = [...copies.filter((c) => c.startsWith("record/")), ...copies.filter((c) => !c.startsWith("record/"))];
  if (!inOrder.length) {
    rmSync(shownFile, { force: true });
    if (keep && pin) return refuse(ctx, `The version shown was sorted out meanwhile, on this Mac or the other, so nothing was kept here. There is no conflict in ${name} now: say "open ${name}" to see it as it is.`);
    ctx.say(`There is no conflict in ${name}.`);
    return 0;
  }
  const copy = inOrder[0];
  const at = (rel) => join(found.folder, rel);
  const isRecord = copy.startsWith("record/");
  let of = conflictedOf(copy);
  // A Case Conflict's copy names its file in another case: the record's own name for it is the one kept.
  if (!isRecord && !(of in record.files)) of = Object.keys(record.files).find((key) => key.toLowerCase() === of.toLowerCase()) || of;
  // The Mac the copy came from, by Dropbox's words in its name, or "" when they name none.
  const fromMac = conflictedBy(copy);
  const here = (rel) => ctx.stat(at(rel));
  // Why neither side can be kept now: "" when one can.
  let blocked = "";
  let later = [];
  let copyRecord = null;
  if (here(copy) && here(copy).isDirectory()) blocked = `Dropbox kept a copy of a folder, ${copy}, which resolve cannot sort out. ${NEEDS_JASON}`;
  else if (isRecord) {
    copyRecord = recordAt(at(copy));
    const n = Number((/^record\/(\d{4})/.exec(copy) || [])[1] || 0);
    if (!n) blocked = `The copy ${copy} is not a record of this episode. ${NEEDS_JASON}`;
    else if (n > record.rev) blocked = `Dropbox is still bringing ${of} over to this Mac; say "sort out the conflict" again when it is done. If it is still not here later, ${NEEDS_JASON[0].toLowerCase()}${NEEDS_JASON.slice(1)}`;
    else if (n < record.rev) {
      later = Array.from({ length: record.rev - n }, (_, i) => n + 1 + i).map((k) => ({ k, on: ((recordAt(recordFile(found.folder, k)) || {}).writer || {}).on || "a Mac it does not name" }));
      // A keep whose record was written, and whose copy could not be deleted, left its side in force already.
      if (!sameRecord(record, copyRecord)) blocked = `Records were written after it: ${listed(later.map((r) => `record ${r.k}, on ${r.on}`))}. Keeping either side here could lose a change. ${NEEDS_JASON}`;
    }
  }
  const aStat = !isRecord ? here(of) : null;
  const bStat = here(copy);
  const now = { copy, rev: record.rev, aBytes: aStat ? aStat.size : null, aTime: aStat ? aStat.mtimeMs : null, bBytes: bStat ? bStat.size : null, bTime: bStat ? bStat.mtimeMs : null };
  const show = () => {
    ctx.say(`Dropbox kept two versions of ${of} in ${name}:`);
    if (isRecord) {
      const on = (r) => (r && r.writer && r.writer.on) || "a Mac it does not name";
      ctx.say(`A: the record in force (record ${record.rev}, written on ${on(record)})`);
      if (later.length) ctx.say(`   (record ${later[0].k - 1}, whose number the copy has, was written on ${on(recordAt(at(of)))})`);
      ctx.say(copyRecord ? `B: the copy written on ${on(copyRecord)}` : "B: the copy cannot be read, so it cannot be kept");
      if (copyRecord && sameRecord(record, copyRecord)) ctx.say("B is in force already: a keep wrote it, and its copy was not deleted then.");
      else if (copyRecord) {
        const differ = recordDifferences(record, copyRecord);
        ctx.say(differ.length ? "They differ in:" : "They hold the same.");
        for (const [what, x, y] of differ) ctx.say(x === null ? `  ${what}: they differ.` : `  ${what}: A: ${x}; B: ${y}`);
      }
    } else {
      const side = (s) => (s ? `${sizeText(s.size)}${s.size >= 1024 ? ` (${s.size} bytes)` : ""}, written ${shownAt(localStamp(new Date(s.mtimeMs)))}` : "not there");
      ctx.say(`A: ${of}, ${side(aStat)}${fromMac ? `, the version Dropbox kept under the file's own name` : ""}`);
      ctx.say(`B: the copy${fromMac ? ` from ${fromMac}` : ""}, ${side(bStat)}`);
      if (of in record.files) {
        const listedBytes = record.files[of];
        ctx.say(`The record in force lists ${aStat && listedBytes === aStat.size ? "A's size" : bStat && listedBytes === bStat.size ? "B's size" : `${listedBytes} bytes, neither side's size,`} for it.`);
      }
    }
    if (blocked) ctx.say(blocked);
    else {
      const more = inOrder.length - 1;
      ctx.say(`Say which to keep: A or B.${more ? ` ${more} more conflicted cop${more === 1 ? "y" : "ies"} after this one.` : ""}`);
    }
    // What was shown is noted only when a side can be kept from it.
    if (!blocked) {
      mkdirSync(dirname(shownFile), { recursive: true });
      writeFileSync(shownFile, JSON.stringify(now) + "\n");
    } else rmSync(shownFile, { force: true });
  };
  if (!keep) {
    show();
    return 0;
  }
  // --keep acts on what was shown last on this Mac: when the copy, A or the record in force changed since, as when the other
  // Mac sorted it out meanwhile, it shows again and keeps nothing.
  if (!pin || JSON.stringify(pin) !== JSON.stringify(now)) {
    ctx.say(pin && pin.copy !== copy && !existsSync(at(pin.copy)) ? "The version shown was sorted out meanwhile, on this Mac or the other, so nothing was kept. Here is what is left to sort out:" : "That is not the version shown last, so nothing was kept. Here is the one to sort out now:");
    show();
    return 1;
  }
  if (blocked) return refuse(ctx, blocked);
  if (isRecord && keep === "B" && !copyRecord) return refuse(ctx, "The copy cannot be read, so it cannot be kept. Keep A.");
  // A side is never kept over one that marks the video a session not cleared (only her click on the dialog clears a mark), nor
  // over one that holds her answer, which keeping the other would take back.
  if (isRecord && copyRecord && !sameRecord(record, copyRecord)) {
    const why = keptOverWhy(keep === "B" ? copyRecord : record, keep === "B" ? record : copyRecord);
    if (why) return refuse(ctx, why);
  }
  const aHere = existsSync(at(of));
  if (!isRecord && keep === "A" && !aHere) return refuse(ctx, `A, ${of}, is not there, so it cannot be kept. Say B, or ask Jason.`);
  // 1. Set aside, by the rule, every file this step replaces or deletes, and see each is whole there. A record copy kept as B,
  // or one in force already, sets the record of its number aside too; a record file itself is never deleted.
  const stamp = localStamp(new Date(ctx.now())).replace(/:/g, "-");
  const asideOf = (rel) => join(found.folder, "history", `${stamp} ${basename(rel)}`);
  for (const rel of keep === "A" ? [copy] : [...(aHere ? [of] : []), copy]) {
    try {
      mkdirSync(join(found.folder, "history"), { recursive: true });
      cloneIn(at(rel), asideOf(rel), ruleOpts(ctx));
    } catch (e) {
      return refuse(ctx, `${rel} could not be set aside in history/ (${basename(plainWhy(e).split(": ").pop())}). Nothing was deleted. Say "sort out the conflict" again in a minute, or ask Jason.`);
    }
  }
  // 2. The record, written past the copies still there. Every keep writes one.
  const work = join(runsFolder(ctx.home), `resolve-${process.pid}-${ctx.now()}`);
  const write = (next, expectRev) => {
    try {
      return writeEpisode(found.folder, next, { expectRev, writeText: textWriter({ work, ...ruleOpts(ctx) }), writer: writerOf(ctx), home: ctx.home, pastCopies: true });
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  };
  /** The record `r` with `bytes` as the file's size wherever it lists it, or with the file as `from` lists it. */
  const sizedLike = (r, from) => {
    const files = { ...r.files };
    if (of in from.files) files[of] = from.files[of];
    else delete files[of];
    let released = r.released;
    if (released && released.files) {
      const handed = { ...released.files };
      if (from.released && from.released.files && of in from.released.files) handed[of] = from.released.files[of];
      else delete handed[of];
      released = { ...released, files: handed };
    }
    return { ...r, files, ...(released ? { released } : {}) };
  };
  const sized = (r, bytes) => {
    const lists = of in r.files;
    const handed = r.released && r.released.files && of in r.released.files;
    return { ...r, files: lists ? { ...r.files, [of]: bytes } : r.files, ...(handed ? { released: { ...r.released, files: { ...r.released.files, [of]: bytes } } } : {}) };
  };
  const bBytes = statSync(at(copy)).size;
  const aBytes = aHere ? statSync(at(of)).size : null;
  const keptBytes = keep === "A" ? aBytes : bBytes;
  const inForce = isRecord && copyRecord && sameRecord(record, copyRecord);
  const next = isRecord ? (keep === "B" ? copyRecord : record) : sized(record, keptBytes);
  let written = null;
  if (!inForce) {
    try {
      written = write(next, record.rev);
    } catch (e) {
      return refuse(ctx, `Nothing was written, and nothing deleted: ${plainWhy(e)}. Say "sort out the conflict" again to see it as it is now.`);
    }
  }
  // 3. Only then is anything replaced or deleted. When B cannot be put in A's place, A comes back from history/, and the
  // record back to what it listed for the file; and when that cannot be done, it says where each side is.
  if (keep === "B" && !isRecord) {
    try {
      replaceIn(at(copy), at(of), ruleOpts(ctx));
    } catch (e) {
      const why = plainWhy(e);
      let back = !aHere || existsSync(at(of));
      if (!back) {
        try {
          cloneIn(asideOf(of), at(of), ruleOpts(ctx));
          back = true;
        } catch (put) {
          back = false;
        }
      }
      let recordNote = "";
      try {
        write(sizedLike(written || record, record), (written || record).rev);
      } catch (w) {
        recordNote = ` The record could not be set back (${plainWhy(w)}): it lists B's size for ${of}.`;
      }
      if (back) return refuse(ctx, `B could not be put in place of ${of}: ${why}. ${aHere ? "A is back as it was" : "A was not there"}, and nothing was deleted.${recordNote}`);
      return refuse(ctx, `B could not be put in place of ${of}: ${why}, and A could not be put back either. A is whole in history/${basename(asideOf(of))}, and B is still the copy, ${copy}.${recordNote} Say "sort out the conflict" again in a minute, or ask Jason.`);
    }
  }
  rmSync(shownFile, { force: true });
  // After every keep, the files are checked against the record now in force: a file out of step is named, and never left for
  // both Macs to refuse in silence (round 2, D: W1, W8).
  const outOfStep = () => {
    const inForceNow = readEpisode(found.folder, { pastCopies: true }).record;
    const problems = inForceNow ? filesProblems(found.folder, inForceNow) : [];
    if (!problems.length) return "";
    // resolve again would say there is no conflict: open is what says again whether a file is not whole (the final check).
    return `\nThe files are not as the record now lists them: ${problems.join("; ")}. Once Dropbox has finished, say "open" again; if it still says a file is not whole, ${NEEDS_JASON[0].toLowerCase()}${NEEDS_JASON.slice(1)}`;
  };
  try {
    rmSync(at(copy), { force: true });
  } catch (e) {
    ctx.say(`Kept ${keep} of ${of}: the record is written, but the copy could not be deleted yet (${e.code || plainWhy(e)}). Say "sort out the conflict" again to finish.${outOfStep()}`);
    return 1;
  }
  // A side kept of a file the record's finish names, when the record had listed the other side's size for it: the finish
  // was made from the other side's version, so it is said, and the way to make it again from this one.
  const listedBytes = !isRecord ? record.files[of] : undefined;
  const finishedFrom = record.finished && JSON.stringify(record.finished).includes(JSON.stringify(of).slice(1, -1));
  const caveat = finishedFrom && listedBytes !== undefined && listedBytes !== keptBytes ? ` The record's finish (revision ${record.finished.revision}, on ${record.finished.on}) was made from the other side's version of it: say "finish the episode" again to make the hand-off from this one.` : "";
  const step = outOfStep();
  ctx.say(`Kept ${keep} of ${of}. The other is set aside in history/.${caveat}${step}`);
  return step ? 1 : 0;
}

/** `release "<episode>" [--no-hand-edits | --hand-edits-stay]`. */
async function release(ctx, rest) {
  const { words, flags } = flagsOf(rest, []);
  if (flags["no-hand-edits"] && flags["hand-edits-stay"]) {
    ctx.say(HELP);
    return 2;
  }
  const got = episodeFor(ctx, words, { newerEnds: 1 });
  if (!got.found) return got.code;
  return releaseEpisode(ctx, { ...got.found, record: got.record }, { answer: flags["no-hand-edits"] ? "no changes" : flags["hand-edits-stay"] ? "changes stay" : "" });
}

/** What `free "<episode>" library` says: held back from this version (the lead's ruling, 2026-10-14). Deleting a Final Cut library by
    command needs the record of every version handed to Final Cut on this Mac, which phase 5 was to bring. freeLibrary and
    unkeptParts stay, with their tests, unreachable, until the Final Cut half is retired with parts.js (architecture 10, wave 4). */
const LIBRARY_HELD_BACK = "Deleting an episode's Final Cut library by command comes in a later version. To free space now, use Final Cut's File > Delete Generated Library Files.";

/** `free "<episode>"`: take away an episode's working copy and the renders of its HyperFrames projects from this Mac, to give the room
    back (free.js; plan PR 15; architecture 6.1 and 7.4). The project, with everything done in it, stays, and `app` makes the video
    again. In order:
    - the old spelling, `free "<episode>" library` (with or without `--yes`), is a Final Cut library, which is still held back: it
      says so (LIBRARY_HELD_BACK) and takes nothing. It names no episode in what it says, so the gate does not ask;
    - it takes no flag, and with no words it says the help and ends with 2. A flag nobody built (`--dry-run`) is not taken for one
      that is, since this command deletes files;
    - the gate, as for every command that names an episode (episodeFor): `free` is in no gate list (architecture 6.2), so a video not
      yet answered, a video left alone, a session not cleared and a video held beside a session are refused in the gate's own words;
    - free.js freeEpisode, which refuses before it takes anything, takes named paths in this Mac's work folder (the video of the main
      project in use, the renders of every project but a session clip's, and the folder of copies), and writes no record.
      `ctx.deps.running` is how a test says whether HyperFrames is running; it asks pgrep otherwise. */
async function free(ctx, rest) {
  const { words, flags } = flagsOf(rest, []);
  if (words.length >= 2 && words[words.length - 1] === "library") return refuse(ctx, LIBRARY_HELD_BACK);
  if (Object.keys(flags).length) {
    ctx.say(HELP);
    return 2;
  }
  const got = episodeFor(ctx, words, { newerEnds: 1 });
  if (!got.found) return got.code;
  return freeEpisode(ctx, { found: got.found, record: got.record }, { running: ctx.deps.running });
}

/** `name "<episode>" "<name>"`. For a client or group session, a name that holds a name brimm-video can see in it is refused
    (sessionNameWhy). */
async function name(ctx, rest) {
  const [said, ...words] = rest;
  const got = episodeFor(ctx, said ? [said] : [], { newerEnds: 1 });
  if (!got.found) return got.code;
  const found = { ...got.found, record: got.record };
  if (asSession(got.record)) {
    const why = await sessionNameWhy(ctx, found, words.join(" "));
    if (why) return refuse(ctx, why);
  }
  return nameEpisode(ctx, found, words.join(" "));
}

/** `title "<episode>" [reel <n>] [--words "<words>"] [--approve] [--change]`: the episode's title, or a Reel's. */
async function title(ctx, rest) {
  const { words, flags } = flagsOf(rest, ["words"]);
  let reel = 0;
  if (words.length >= 2 && words[words.length - 2] === "reel" && /^\d+$/.test(words[words.length - 1])) {
    reel = Number(words.pop());
    words.pop();
  }
  const got = episodeFor(ctx, words, { newerEnds: 1 });
  if (!got.found) return got.code;
  return titleEpisode(ctx, { ...got.found, record: got.record }, { words: flags.words ? flags.words.join(" ") : undefined, approve: Boolean(flags.approve), change: Boolean(flags.change), ...(reel ? { reel } : {}) });
}

/** `reel drop "<episode>" <n>…`, and `reel "<label>" <n> --client-agreed`, a client's agreement to a Reel cut from a session
    (clientAgreed), which is those three words and no other: `<n>` is digits, and `reel drop 14 --client-agreed` is still a drop in
    the episode "14". `reel pick` is gone (plan PR 5): a Reel is picked by opening it, `app … reel <n>`, which marks it picked. A
    use of it is the help and 2, as any verb this does not know is, and it stays out of the label's place, so that an old `reel pick
    14 --client-agreed` is never taken for a client's agreement to a Reel of a session called "pick". */
async function reel(ctx, rest) {
  if (rest.length === 3 && rest[0] !== "pick" && rest[0] !== "drop" && /^\d+$/.test(rest[1]) && rest[2] === "--client-agreed") return clientAgreed(ctx, rest[0], Number(rest[1]));
  const [what, said, ...numbers] = rest;
  if (what !== "drop" || !said) {
    ctx.say(HELP);
    return 2;
  }
  const got = episodeFor(ctx, [said], { newerEnds: 1 });
  if (!got.found) return got.code;
  const ns = numbers.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  return dropReels(ctx, { ...got.found, record: got.record }, ns);
}

/** What is said when a client's agreement is refused or does not happen: it was not noted. */
const NOT_NOTED = "Not noted:";
const NOT_AGREED = "The Reel is not agreed.";
const AGREEMENT_TIMED_OUT = `${NOT_NOTED} the dialog was not answered within a minute, so it was closed. ${NOT_AGREED}`;
const NOTE_NOT_WRITTEN = `${NOT_NOTED} the note could not be written on this Mac. ${NOT_AGREED}`;
const AGREEMENT_NOT_RECORDED = "The Reel is not agreed: the note of who agreed is on this Mac only. Say it again.";
/** What a person types in the agreement dialog, made one line: each line break and tab one space. */
const LINE_BREAKS = /[\r\n\t\v\f\u0085\u2028\u2029]/g;

/** `reel "<label>" <n> --client-agreed`: she notes, on a dialog Claude cannot press, that the client agreed to Reel idea `n` of the
    client or group session called `label` being cut from it (spec 2026-10-22, section 2). Before any dialog it refuses, writing
    nothing, in this order: a video that is no session, or whose mark is cleared; then (`checks`) this Mac's training gate off or
    lapsed; teachings Claude has not read, that Dropbox is still bringing, or that cannot be read; no such Reel idea; one to be
    filmed again, which needs no agreement; one she has not kept; one agreed already, which it says and ends well; and the other
    Mac's claim, or a run at work. Then it tells her to click, since Return presses Cancel, and shows the dialog (askHere, for
    DIALOG_MS at most), which names the video by its label and asks who agreed and when. Only her click on "They agreed", with
    something typed (a letter or a digit, not only spaces or invisible characters), goes on. Cancel, a dialog that gave no click, nothing typed and a dialog not answered in time each say so, in
    a line of their own, and write nothing. Her click may come long after the record was read, so it is read again, and must be
    the record she was asked about, and `checks` are made again (on this Mac's settings read again, for the gate), and so are the
    two refusals save would make after the note (a newer record file still coming over; a change Dropbox undid). All of it is under
    the answer lock of the episode, so that a second run is refused at once with `kind`'s words, before any dialog of its own. Then,
    in this order: one line, with the time and the Reel, in agreements.txt in this Mac's work folder for the episode, a file only she can
    read; and one write of the record, by the rule, holding that the agreement was noted and on which day. What she typed is in that
    note and nowhere else: not in a line said, the tool log, the record, a result, a file of the episode or the hand-off. The log
    says only that it was noted, by id and label. A note that cannot be written writes no record; a record that cannot be written
    leaves the note, and says the Reel is not agreed. */
async function clientAgreed(ctx, label, n) {
  const got = episodeFor(ctx, [label], { newerEnds: 1 });
  if (!got.found) return got.code;
  // One dialog at a time for an episode: the answer lock `kind` holds is held from before the dialog to after the write, so that
  // two runs cannot both be open, note twice, and tell her that Dropbox undid a change it did not.
  const lock = takeAnswerLock(ctx, got.found.name, "reel");
  if (!lock) return refuse(ctx, busyWhy(shownName(got.record)));
  try {
    return await noteAgreement(ctx, got.found, got.record, n);
  } finally {
    releaseEpisodeLock(lock.file, lock.text);
  }
}

/** What `reel … --client-agreed` does once it holds the answer lock of the episode `found`, whose record is `record`: see
    clientAgreed. */
async function noteAgreement(ctx, found, record, n) {
  const name = shownName(record);
  if (!taughtSession(record)) return refuse(ctx, `${name} is not a client or group session: a client's agreement is noted only for a Reel cut from one.`);
  // Why the agreement may not be noted on the record `rec` with `settings`: { why }, with `already` when it was agreed already.
  const checks = async (rec, settings) => {
    const gate = teachingsWhy(settings, ctx.now());
    if (gate) return { why: gate };
    let read = readTeachings(found.folder, rec, ctx.isWhole);
    if (read.coming && !(await broughtOver(ctx, found, [read.coming])).length) read = readTeachings(found.folder, rec, ctx.isWhole);
    if (read.none) return { why: `${name} has no teachings yet: Claude has not read it.` };
    if (read.coming) return { why: TEACHINGS_COMING };
    if (read.why) return { why: `${name}'s teachings cannot be read (${read.why}).` };
    const reelIdea = itemsOf(read.teachings, rec.session).reelIdeas.find((item) => item.n === n);
    if (!reelIdea) return { why: `${name} has no Reel idea ${n}.` };
    if (reelIdea.refilm === true) return { why: `Reel idea ${n} of ${name} is to be filmed again, not cut from the session: no client's agreement is needed.` };
    if (reelIdea.approved !== true) return { why: `Reel idea ${n} of ${name} is not kept: keep it first.` };
    const before = ((rec.session || {}).agreed || []).find((a) => a.n === n);
    if (before) return { why: `Reel idea ${n} of ${name} was agreed already, on ${before.at}.`, already: true };
    return { why: sessionBusy(ctx, found, rec, "nothing was noted") };
  };
  const first = await checks(record, ctx.settings);
  if (first.already) {
    ctx.say(first.why);
    return 0;
  }
  if (first.why) return refuse(ctx, first.why);
  ctx.say(`A dialog is open on this Mac for ${name}: type who agreed to Reel ${n} and when, then click "They agreed". Return presses Cancel.`);
  const { answer, outOfTime } = await askHere(ctx, `${name}\n\nWho agreed to Reel ${n} being cut from this session, and when?`, { buttons: ["Cancel", "They agreed"], answer: true });
  if (outOfTime) return refuse(ctx, AGREEMENT_TIMED_OUT);
  if (!answer || answer.button !== "They agreed") {
    const why = answer && answer.button === null && typeof answer.why === "string" ? answer.why : "";
    return refuse(ctx, why ? `${NOT_NOTED} ${why} ${NOT_AGREED}` : `${NOT_NOTED} the Reel is not agreed.`);
  }
  const typed = (typeof answer.text === "string" ? answer.text : "").replace(LINE_BREAKS, " ").trim();
  // Invisible characters, as a zero-width space, are not something typed: it holds a letter or a digit.
  if (!/[\p{L}\p{N}]/u.test(typed)) return refuse(ctx, `${NOT_NOTED} nothing was typed. ${NOT_AGREED}`);
  const stop = (why) => refuse(ctx, `${NOT_NOTED} ${why}`);
  // The record is read again, and must be the one she was asked about. This Mac's settings are read again too, unless a test
  // gave them: Jason may have turned the training gate off meanwhile.
  const now = readEpisode(found.folder);
  if (!now.record) return stop(notRead(ctx, { ...found, read: now }));
  if (now.newer) return stop(newerWhy(now.record));
  if (now.record.rev !== record.rev) return stop(`${name} changed on the other Mac meanwhile. Say it again.`);
  const again = await checks(now.record, ctx.deps.settings ? ctx.settings : readSettings(ctx.home).settings || {});
  if (again.why) return stop(again.why);
  // save refuses a newer record file that is still coming over, and a change Dropbox undid: no note is made before such a refusal.
  // As save does, it accepts the rev read when it refuses for the second, so that saying it again is not refused for ever.
  if (recordNumbers(found.folder)[0] > now.record.rev) return stop(PENDING_WHY);
  const gone = undone(now.record, ctx.home);
  if (gone) {
    acceptRev(ctx.home, now.record.id, now.record.rev);
    return stop(gone);
  }
  // The note first, on this Mac's own disk and never in Dropbox, then the record.
  const moment = new Date(ctx.now());
  const when = localStamp(moment);
  const day = localDay(moment);
  try {
    const folder = episodeWork(ctx.home, found.name);
    mkdirSync(folder, { recursive: true });
    const file = join(folder, "agreements.txt");
    appendFileSync(file, "", { mode: 0o600 });
    chmodSync(file, 0o600);
    appendFileSync(file, `${when} Reel ${n}: ${typed}\n`);
  } catch (e) {
    // Bare on purpose: nothing of the error is said, so that no message quotes the file's path or what she typed.
    return refuse(ctx, NOTE_NOT_WRITTEN);
  }
  const session = { ...now.record.session, agreed: [...((now.record.session || {}).agreed || []), { n, at: day }] };
  if ((await save(ctx, { ...found, record: now.record }, { ...now.record, session }, "")) !== 0) {
    ctx.say(AGREEMENT_NOT_RECORDED);
    return 1;
  }
  ctx.say(`${name}: Reel ${n}'s agreement is noted, on ${day}. Who agreed is kept on this Mac only.`);
  toolLog(ctx, `${when} ${now.record.id} (${name}): a client's agreement to Reel ${n} was noted by a click on this Mac's dialog.`, "the agreement");
  return 0;
}

/** `reels "<episode>" [--no-play]`: the list of the episode's Reel candidates (reels.json, phase 3), and each preview that is
    whole on this Mac opened in QuickTime Player, for the person to watch. A preview Dropbox is still bringing over is named
    and brought, as open brings files. With --no-play the list alone. For a video she has answered the card of, the list of its
    suggestions on the clock she is reading, and nothing opens. */
async function reels(ctx, rest) {
  const { words, flags } = flagsOf(rest, []);
  const got = episodeFor(ctx, words, { newerEnds: 1 });
  if (!got.found) return got.code;
  const { found, record } = { found: got.found, record: got.record };
  // A short video she has answered has no Reels, and its reading writes no list of them: said as drop and push say it.
  if (isAnswered(record) && record.kind === "short video") return refuse(ctx, "A short video has no Reels.");
  const at = join(found.folder, REELS_FILE);
  if (!existsSync(at) && record.files && REELS_FILE in record.files) return refuse(ctx, `${REELS_FILE} is missing from this episode, though its record lists it, so its Reel candidates cannot be shown. ${keptOrWait(ctx, found, record)}`);
  if (!existsSync(at)) {
    const ns = (record.reels || []).map((r) => `Reel ${r.n}`);
    return refuse(ctx, `This episode has no list of Reel candidates (reels.json).${ns.length ? ` Its Reels are the clips the import cut: ${listed(ns)}.` : ""}`);
  }
  const read = readReels(readFileSync(at, "utf8"));
  if (read.why) return refuse(ctx, `Its list of Reel candidates cannot be read: ${read.why.replace(/\.$/, "")}.`);
  // A list at another size than the record lists is not the one it lists: not shown as the candidates.
  const listedSize = record.files ? record.files[REELS_FILE] : undefined;
  const thereSize = statSync(at).size;
  if (Number.isInteger(listedSize) && thereSize !== listedSize) return refuse(ctx, `${REELS_FILE} in this episode is not the one its record lists (it is ${thereSize} bytes, and the record lists ${listedSize}), so its candidates are not shown. ${keptOrWait(ctx, found, record)}`);
  // A video she has answered the card of is listed with its times on the clock she is reading, or on the recording's own when that
  // cannot be read now: a file is not whole yet, the read fails, or the version's file holds no clip. Nothing is brought from here,
  // no preview is made or opened, and asking Claude again is not offered (spec 3, "The Reel suggestions"); when the other Mac has a
  // newer version rendered there, that is said, as every command that reads a time says it.
  if (isAnswered(record)) {
    let now = null;
    try {
      now = clockFor({ ...found, record }, "main", ctx);
    } catch (e) {
      now = null;
    }
    const clock = now && now.clock && now.clock.length ? now : null;
    ctx.say(reelsText(read.reels, record, "", clock));
    if (clock) sayElsewhere(ctx, clock);
    // She is told last how to make one: on a Mac set up for HyperFrames, `app … reel <n>` makes it (plan PR 5), and on any other
    // nothing makes a Reel from a suggestion, so she is told where she makes them for now, so that no command sends her round in a
    // circle (Sallie's walkthrough, 25 Oct). Not once she has dropped every one. The gate refuses a session before this, and it is
    // never said of one. Only of a suggestion still to make: not one she dropped, and not one `app … reel <n>` has made, which has a
    // project in the record (on this Mac or the other's) and is picked.
    const dropped = new Set((record.reels || []).filter((r) => r.status === "dropped").map((r) => r.n));
    const open = read.reels.candidates.filter((c) => uncropped(c) && !dropped.has(c.n) && !madeInApp(record, c.n)).map((c) => c.n);
    if (!gated(record) && open.length) ctx.say(appOf(ctx.settings) ? makeOneWords(open, shownName(record)) : notMadeWords());
    return 0;
  }
  // Whether Claude can be asked again is said as this Mac finds it now, in the words ask would refuse with (PR 19's review).
  // While a file is still coming, ask can be asked: it brings it.
  const blocked = askRefusal(ctx, found, record);
  // A listing changes nothing, so a refusal's "Nothing was changed." is not said here.
  ctx.say(reelsText(read.reels, record, blocked.bring ? "" : (blocked.why || "").replace(/ Nothing was changed\.$/, "")));
  if (flags["no-play"]) return 0;
  const previews = read.reels.candidates.filter((c) => c.preview).map((c) => c.preview);
  const coming = previews.filter((rel) => !ctx.isWhole(join(found.folder, rel)));
  if (coming.length) {
    ctx.say(`Dropbox is still bringing ${coming.join(", ")} over to this Mac. Say "show me the Reels" again when it is done.`);
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: coming });
  }
  for (const rel of previews.filter((p) => !coming.includes(p))) ctx.openApp("QuickTime Player", join(found.folder, rel));
  return 0;
}

/** Why `ask` would refuse the episode `found`, whose record is `record`, on this Mac now: {why}, with `bring` when files are
    still to be brought, or {} when it would start. In this order: a short video, the other Mac having it open (claimHeld), a
    command at work on the episode, no Claude Code on this Mac, and askBlocked. */
function askRefusal(ctx, found, record) {
  if (record.kind === "short video") return { why: "A short video gets no Reels." };
  if (claimHeld(ctx, record)) return { why: claimHeld(ctx, record) };
  const running = runningCommand(ctx.home, found.name, ctx.alive);
  if (running === "ask") return { why: 'Claude is being asked already. Say "how far is it?" to see how far it has got.' };
  if (running) return { why: `${running} is running for ${calledAs(ctx, found)} already. Say it again when it has finished.` };
  if (!(ctx.deps.tools || findPrograms()).claude) return { why: NO_CLAUDE_CODE };
  return askBlocked({ folder: found.folder, record, root: ctx.root, home: ctx.home, machine: ctx.machine, now: ctx.now(), whole: ctx.isWhole });
}

/** What to do about a reels.json the record lists that is gone: put back the copy this Mac kept of it (keptList), or wait for
    Dropbox to bring it. */
const keptOrWait = (ctx, found, record) => {
  const kept = keptList({ folder: found.folder, record, home: ctx.home });
  return kept ? `The one its record lists is kept at ${kept}: ask Jason to put it back.` : "Say this again once Dropbox has it back.";
};

/** Why Claude cannot be asked on a Mac without Claude Code, as `ask` says it. */
const NO_CLAUDE_CODE = "Claude Code is not installed on this Mac, so Claude cannot be asked.";
/** The word `kind` takes for each kind a record keeps, as `ask` answers a video again with it. */
const ASKED_AS = { finished: "finished", raw: "raw", "short video": "clip" };

/** `ask "<episode>"`: Claude asked again for the episode's Reel candidates, detached (`ask --now "<episode folder>"`, which
    askAgain does, in unedited.js), since it can take minutes. It refuses a short video, a Mac without Claude Code, an
    episode whose import went by the rules alone, and an episode another command is at work on; and what askBlocked says.
    Both parts refuse an episode a newer brimm-video wrote, by its short id alone. A video she has answered the card of (not a
    session) is read again as its kind instead: `kind <its kind> --again`, with its claim, what it sets aside and its reading
    (spec 2026-10-22, section 2, "ask changes too"); the gate refuses a video not yet answered and a session first. */
async function ask(ctx, rest) {
  if (rest[0] === "--now") {
    const found = findEpisode(ctx, rest[1] || "");
    if (!found.read || !found.read.record) {
      ctx.say(found.why || notRead(ctx, found, rest[1]));
      if (found.gate) await leaveGateResult(ctx, found, "ask");
      return 1;
    }
    // A record a newer brimm-video wrote may be a session or a video not yet answered, whose fields this one cannot read: it is
    // named by its short id alone, nothing is asked of Claude, and nothing is written, not even the result of a run.
    if (found.read.newer) {
      ctx.say(newerWhy(found.read.record));
      return 1;
    }
    const deps = {
      run: ctx.deps.run || runProgram, tools: ctx.deps.tools || findPrograms(), home: ctx.home, settings: ctx.settings, now: ctx.now,
      log: (line) => ctx.say(line), wait: ctx.deps.wait || ((ms) => new Promise((done) => setTimeout(done, ms))), isWhole: ctx.isWhole,
      ...ruleOpts(ctx), ...(ctx.deps.commit ? { commit: ctx.deps.commit } : {}), ...(ctx.deps.runGuarded ? { runGuarded: ctx.deps.runGuarded } : {})
    };
    const result = await runDetached({ home: ctx.home, folder: found.name, clean: resultClean(ctx), command: "ask", alive: ctx.alive, ...(ctx.deps.keepAwake ? { keepAwake: ctx.deps.keepAwake } : {}) }, () => askAgain({ folder: found.folder, record: found.read.record }, deps));
    if (result.taking || result.running) {
      ctx.say(result.running ? `${result.running} is running for ${calledAs(ctx, found)} already.` : `Another run is taking over the lock of ${calledAs(ctx, found)}; try again in a few seconds.`);
      return 1;
    }
    return result.ok ? 0 : 1;
  }
  const got = episodeFor(ctx, rest, { newerEnds: 1 });
  if (!got.found) return got.code;
  const { found, record } = { found: got.found, record: got.record };
  // A video she has answered the card of is read again as its kind: `kind <its kind> --again`, with its claim, what it sets aside
  // and its reading (spec 2, "ask changes too"). A video not yet answered, and a session, the gate refuses before this (and
  // askBlocked would too); a video from before the switch is asked for Reels as it always was.
  // What would stop the reading is said first, as ask always said it, so that nothing of the earlier reading is set aside for a
  // reading that cannot run.
  if (isAnswered(record) && recordKind(record) !== "session") {
    if (ctx.settings.readings === false) return refuse(ctx, READINGS_OFF);
    if (!(ctx.deps.tools || findPrograms()).claude) return refuse(ctx, NO_CLAUDE_CODE);
    return kindCommand(ctx, [...rest, ASKED_AS[recordKind(record)], "--private", "no", "--again", "--not-a-session"]);
  }
  const blocked = askRefusal(ctx, found, record);
  if (blocked.bring) startDetached(ctx, { command: "bring", folder: found.name, args: blocked.bring });
  if (blocked.why) return refuse(ctx, blocked.why);
  startDetached(ctx, { command: "ask", folder: found.name });
  ctx.say(`Started: Claude is asked for Reel candidates again. Say "how far is it?" to see how far it has got.`);
  return 0;
}

/** `read --now "<episode folder>" --kind <kind> --rev <rev>`: Claude's reading of the episode, the detached run `kind` starts once
    she has said what it is (spec 2026-10-22, section 2), with the kind the answer stored ("short video" is one word here, with
    its space) and the rev of the record that holds the answer. It is detached alone: it is in no help, and without --now, or
    without a kind it reads or a rev, it prints the help and ends 2, as a command it does not know. The episode is found and
    gated as every command's is (`read` runs for a session only once the training gate is on, and its run refuses it there);
    one a newer brimm-video wrote is named by its short id, and nothing is asked or written. The work is reading.js
    readEpisodeNow's, held under the episode's lock (runDetached), whose result names a gated video by its label alone. */
async function read(ctx, rest) {
  const { flags } = flagsOf(rest.slice(2), ["kind", "rev"]);
  const kind = Array.isArray(flags.kind) && flags.kind.length === 1 ? flags.kind[0] : "";
  const rev = Array.isArray(flags.rev) && flags.rev.length === 1 && /^\d+$/.test(flags.rev[0]) ? Number(flags.rev[0]) : NaN;
  if (rest[0] !== "--now" || !rest[1] || !READ_KINDS.includes(kind) || !Number.isInteger(rev)) {
    ctx.say(HELP);
    return 2;
  }
  const found = findEpisode(ctx, rest[1]);
  if (!found.read || !found.read.record) {
    ctx.say(found.why || notRead(ctx, found, rest[1]));
    if (found.gate) await leaveGateResult(ctx, found, "read");
    return 1;
  }
  if (found.read.newer) {
    ctx.say(newerWhy(found.read.record));
    return 1;
  }
  const deps = {
    run: ctx.deps.run || runProgram, tools: ctx.deps.tools || findPrograms(), home: ctx.home, settings: ctx.settings, now: ctx.now,
    log: (line) => ctx.say(line), wait: ctx.deps.wait || ((ms) => new Promise((done) => setTimeout(done, ms))), isWhole: ctx.isWhole,
    notify: ctx.deps.notify || banner, ...(ctx.deps.readAll ? { readAll: ctx.deps.readAll } : {}), ...(ctx.deps.progress ? { progress: ctx.deps.progress } : {}),
    ...ruleOpts(ctx), ...(ctx.deps.commit ? { commit: ctx.deps.commit } : {}), kind, rev
  };
  const result = await runDetached({ home: ctx.home, folder: found.name, clean: resultClean(ctx), command: "read", alive: ctx.alive, ...(ctx.deps.keepAwake ? { keepAwake: ctx.deps.keepAwake } : {}) }, ({ early }) => readEpisodeNow(ctx, { name: found.name, folder: found.folder, record: found.read.record }, { ...deps, early }));
  if (result.taking || result.running) {
    ctx.say(result.running ? `${result.running} is running for ${calledAs(ctx, found)} already.` : `Another run is taking over the lock of ${calledAs(ctx, found)}; try again in a few seconds.`);
    return 1;
  }
  return result.ok ? 0 : 1;
}

/** The kinds of video the working copy is made for: a raw video, and an iPhone clip. A finished video is edited by her editor, and a
    session's video reaches HyperFrames only as a clip of its own, never whole. */
const WORK_COPY_KINDS = ["raw", "short video"];
/** Whether `kind` asks for the working copy of a video it has just answered as `stored`, `record` being the record it wrote: only
    when the copy will be used. It is made for a raw video and an iPhone clip (WORK_COPY_KINDS), on a Mac whose settings turn the app
    on (settings.js appOf: on any other nothing opens a project, so the copy would never be used), and while the record holds no
    main project in use (app.js isMain): that project's writer moved the copy into it and left only its facts, so asking again
    would make a copy nobody opens. A project kept for the earlier kind in this very answer is not in use, so a change of kind asks
    for the copy the new project is made from. */
const copyWanted = (ctx, stored, record) => WORK_COPY_KINDS.includes(stored) && appOf(ctx.settings) !== "" && !(record.app?.projects ?? []).some(inUse);
/** What a run of `workcopy` for a video of another kind leaves for its result, in the words a copy that cannot be made is refused in. */
const NOT_RAW_OR_CLIP = canNotBeUsed("it is not a raw video or an iPhone clip");
/** The same of a run that makes a Reel's video (`workcopy … --reel <n>`, plan PR 5), which is made for a raw video and a finished one
    (app-reel.js REEL_COPY_KINDS) and never for an iPhone clip, which has no Reels. */
const NOT_RAW_OR_FINISHED = canNotBeUsed("it is not a raw or a finished video");

/** Wait, as a raw reading does (reading.js readEpisodeNow), while the import's late check of the episode's video is still to come
    (unedited.js importHold): the working copy is made from the raw video as filed, whole and checked (architecture 2026-10-27, 5.7),
    and that check may put the video in again. `kind` asks for the copy at once; the run does the waiting. Resolves { record }, the
    episode's record as it is once nothing holds the video, or { why }, in the words the reading uses, when the run must end:
    - a hold that clears by itself, an import of the video at work on either Mac, or this Mac's own late check of it before its time
      with no problem found, is waited for: it is looked at again every READ_LOOK_MS, for READ_HOLD_MS at most. The wait is a step of
      its own in the progress panel (WORK_COPY_WAIT_STEP), so that "how far is it?" says it, and it is ended before the copy begins;
    - a hold that does not, an import that failed or stopped, a late check that found a problem, or one this Mac owes past its time
      with no import at work to make it, ends the run at once with that hold's words (importHold's `why`), as the reading's ends;
    - a wait that has run out ends it with the words of what still holds the video;
    - after each wait the episode is found again, gate and all (findEpisode, as at the start of the run), since she may have said it is
      something else meanwhile, or a session: a video that is no longer a raw video or an iPhone clip, or that the gate now refuses,
      is made no copy of. The words are the gate's own, or `notFor` (NOT_RAW_OR_CLIP for the working copy, NOT_RAW_OR_FINISHED for a
      Reel's video), as `kinds` (the kinds it is made for) decide.
    Nothing is written meanwhile: the run writes no record. `wait` is how it waits, `progress` the panel's reporter and `log` the
    run's log. */
async function waitForImport(ctx, { found, record, wait, progress, log, kinds = WORK_COPY_KINDS, notFor = NOT_RAW_OR_CLIP }) {
  const name = shownName(record);
  let waited = 0;
  let shown = false;
  try {
    for (;;) {
      const hold = importHold({ root: ctx.root, home: ctx.home, machine: ctx.machine, record, now: ctx.now() });
      if (!hold.why) return { record };
      if (!hold.waits || waited >= READ_HOLD_MS) return { why: hold.why };
      if (!shown) {
        shown = true;
        log(`${name}: the video for HyperFrames is made once the import has checked its copies.`);
        progress.begin(name);
        progress.step(WORK_COPY_WAIT_STEP);
      }
      await wait(READ_LOOK_MS);
      waited += READ_LOOK_MS;
      const again = findEpisode(ctx, found.name);
      if (!again.read || !again.read.record) return { why: again.why || notRead(ctx, again, found.name) };
      if (again.read.newer) return { why: newerWhy(again.read.record) };
      if (!kinds.includes(recordKind(again.read.record))) return { why: notFor };
      record = again.read.record;
    }
  } finally {
    if (shown) progress.end(false);
  }
}

/** `workcopy --now "<episode folder>" [--4k | --reel <n>]`, the detached run `kind` and `app` start (workcopy.js requestWorkCopy): it
    makes the working copy of the episode's raw video, the video HyperFrames is given to edit (workcopy.js makeWorkCopy, which never
    throws), in this Mac's own folder for the episode. It is detached alone, like `read`: it is in no help, and without --now and a
    folder it prints the help and ends 2, as a command it does not know. The episode is found and gated as every command's is. `workcopy` is
    in no gate list (architecture 2026-10-27, 6.2), so a video not yet answered, a video left alone, a session not cleared and a
    video held beside a session are refused in the gate's own words, and the refusal is left as the run's result, as `read`'s is;
    one a newer brimm-video wrote is named by its short id, and nothing is made or written. Past the gate it runs for a raw video
    and an iPhone clip alone (WORK_COPY_KINDS): a video of any other kind leaves a result that says it can't be used, in words.
    Before it copies, it waits as a raw reading does while the import's late check of the video is still to come (waitForImport),
    since the copy is made from the video as filed, whole and checked (architecture 5.7): the wait is a step in the progress
    panel, and a hold that does not clear by itself ends the run with the reading's words for it.
    The run holds the working copy's own lock (workCopyLockOf), not the episode's, and writes no record, so that it runs beside
    the reading `kind` starts at the same moment. `--4k` makes a copy of 4K. What it needs of this Mac it takes from ctx.deps, as
    the other detached runs do, so that a test gives it stand-ins: `run` (for ffprobe), `tools` (ffmpeg and ffprobe, as
    findPrograms finds them), `runGuarded` (ffmpeg under the watchdog), `progress` (the panel's reporter, made as `finish`'s
    is when none is given) and `faces` (the face finder, unedited.js facesIn, for a Reel's video, each of its two programs given
    REEL_FACES_MS, so that one that hangs does not hold the working copy's lock for good). Resolves 0 when the copy is made,
    or was before, and 1 when it is not.
    `--reel <n>` (a whole number from 1; anything else is the help and 2) makes the video of Reel `n` instead (plan PR 5;
    architecture 4.3): the stretch of the recording as filed that the suggestion has in reels.json (app-reel.js reelStretch), from
    its first moment to its last, made with the working copy's own chain and checks (workcopy.js makeWorkCopy with `reel`), and the
    faces looked for in it. It runs for a raw video and a finished one (REEL_COPY_KINDS), and for no other: a finished video has no
    working copy of its own, and an iPhone clip no Reels. It has the same lock, so that one copy of an episode is made at a time, a
    Reel's or the video's, waits for the import's late check as the working copy does, and says what it cannot make in words. */
async function workcopy(ctx, rest) {
  if (rest[0] !== "--now" || !rest[1]) {
    ctx.say(HELP);
    return 2;
  }
  const { flags } = flagsOf(rest.slice(2), ["reel"]);
  // The Reel's number, as a whole number from 1 and once: any other use of the flag is not a use this run knows.
  let reel = 0;
  if (flags.reel !== undefined) {
    const given = Array.isArray(flags.reel) && flags.reel.length === 1 ? flags.reel[0] : "";
    if (!/^[1-9]\d*$/.test(given) || !Number.isSafeInteger(Number(given))) {
      ctx.say(HELP);
      return 2;
    }
    reel = Number(given);
  }
  const found = findEpisode(ctx, rest[1]);
  if (!found.read || !found.read.record) {
    ctx.say(found.why || notRead(ctx, found, rest[1]));
    if (found.gate) await leaveGateResult(ctx, found, WORK_COPY_COMMAND, workCopyLockOf(ctx.home, found.name));
    return 1;
  }
  if (found.read.newer) {
    ctx.say(newerWhy(found.read.record));
    return 1;
  }
  const { record } = found.read;
  const tools = ctx.deps.tools || findPrograms();
  const deps = {
    run: ctx.deps.run || runProgram, tools, now: ctx.now, log: (line) => ctx.say(line),
    progress: ctx.deps.progress || reporter({ folder: progressFolder(ctx.home), swift: tools.swift }),
    ...(ctx.deps.runGuarded ? { runGuarded: ctx.deps.runGuarded } : {})
  };
  const wait = ctx.deps.wait || ((ms) => new Promise((done) => setTimeout(done, ms)));
  const kinds = reel ? REEL_COPY_KINDS : WORK_COPY_KINDS;
  const notFor = reel ? NOT_RAW_OR_FINISHED : NOT_RAW_OR_CLIP;
  const result = await runDetached({ home: ctx.home, folder: found.name, clean: resultClean(ctx), command: WORK_COPY_COMMAND, lock: workCopyLockOf(ctx.home, found.name), alive: ctx.alive, ...(ctx.deps.keepAwake ? { keepAwake: ctx.deps.keepAwake } : {}) }, async () => {
    if (!kinds.includes(recordKind(record))) return { ok: false, made: [], failed: [notFor], next: "" };
    // `kind` asks for the copy at once; the video it is made from is whole and checked first (waitForImport).
    const held = await waitForImport(ctx, { found, record, wait, progress: deps.progress, log: deps.log, kinds, notFor });
    if (held.why) return { ok: false, made: [], failed: [held.why], next: "" };
    const video = join(found.folder, held.record.video.file);
    if (!reel) return makeWorkCopy({ home: ctx.home, folder: found.name, video, name: shownName(held.record), fourK: Boolean(flags["4k"]) }, deps);
    // A Reel's video is the suggestion's stretch of the recording; the list is read once the video is whole and checked.
    const got = reelStretch(found.folder, reel);
    if (!got.stretch) {
      const why = got.gone ? `Reel ${reel} is not one of the suggestions any more` : got.nothing ? `Reel ${reel} has nothing to show: ${got.nothing}` : "the Reel suggestions cannot be read";
      deps.log(`${shownName(held.record)}: the video for Reel ${reel} could not be made: ${why}.`);
      return { ok: false, made: [], failed: [canNotBeUsed(why)], next: "" };
    }
    const faces = ctx.deps.faces || ((file, work) => facesIn(file, work, { run: deps.run, tools, limit: REEL_FACES_MS }));
    return makeWorkCopy({ home: ctx.home, folder: found.name, video, name: `${shownName(held.record)}, Reel ${reel}`, reel: got.stretch }, { ...deps, faces });
  });
  if (result.taking || result.running) {
    ctx.say(result.running ? `The video for HyperFrames is being made for ${calledAs(ctx, found)} already.` : `Another run is taking over the lock of ${calledAs(ctx, found)}; try again in a few seconds.`);
    return 1;
  }
  return result.ok ? 0 : 1;
}

/** The timeline a command names after the episode: "main", the default, or "reel <n>", in any case; and the words left. */
function partFrom(words) {
  const at = words.findIndex((w, i) => String(w).toLowerCase() === "reel" && /^\d+$/.test(words[i + 1] || ""));
  if (at !== -1) return { part: { reel: Number(words[at + 1]) }, words: [...words.slice(0, at), ...words.slice(at + 2)] };
  return { part: "main", words: words.filter((w) => String(w).toLowerCase() !== "main") };
}
const partLabel = (part) => (part === "main" ? "the main video" : `Reel ${part.reel}`);
/** The record with one part's own entry changed. */
const withPart = (record, part, change) => (part === "main" ? { ...record, main: change(record.main) } : { ...record, reels: record.reels.map((r) => (r.n === part.reel ? change(r) : r)) });
/** The next id of a layer: its letter and one more than the highest of the part's. */
const nextId = (items, letter) => `${letter}${1 + Math.max(0, ...(items || []).map((x) => Number(String(x.id).slice(1)) || 0))}`;
/** Seconds as a person reads a length: "4 seconds", "1.5 seconds". */
const lengthText = (seconds) => `${Math.round(seconds * 10) / 10} second${seconds === 1 ? "" : "s"}`;
const SHOW_IT = 'Say "show it in Final Cut" to see it.';

/** What every command on a timeline's layers does first (phase 4): the episode, from its first word, and the timeline it
    names, a Reel picked. One that `writes` is refused while another Mac has the episode, while a detached run is at work on
    it (a finish's late check would put its own copies back), on a timeline changed by hand and taken in (phase 5), and on a
    Reel the import cut as a clip, before Reels had projects of their own, which nothing is laid over. Gives
    { found, part, target, words } or { code }. */
function layerStart(ctx, words, { writes = true } = {}) {
  const [said, ...rest] = words;
  const got = episodeFor(ctx, said === undefined ? [] : [said], { newerEnds: 1 });
  if (!got.found) return { code: got.code };
  const found = { ...got.found, record: got.record };
  const { part, words: left } = partFrom(rest);
  // Each command takes its own words first: what is left is not understood, and is never taken for the main video.
  if (left.length) return { code: refuse(ctx, `"${left.join(" ")}" is not understood there: name the timeline last, as main or reel 2.`) };
  const target = part === "main" ? got.record.main : (got.record.reels || []).find((r) => r.n === part.reel);
  if (!target) return { code: refuse(ctx, `There is no Reel ${part.reel}.`) };
  // A Reel `app … reel <n>` made is a project in HyperFrames, which these commands do not touch: she is sent back there. A Reel a
  // reading suggested that nobody has made cannot be picked in Final Cut, so she is not sent to pick it: she is told how to make it
  // (on a Mac set up for HyperFrames), or where she makes it for now.
  if (part !== "main" && inHyperFramesWords(got.record, part.reel)) return { code: refuse(ctx, inHyperFramesWords(got.record, part.reel)) };
  if (part !== "main" && notMade(found, part.reel)) return { code: refuse(ctx, notMadeSaid(ctx, got.record, part.reel)) };
  if (part !== "main" && target.status !== "picked" && target.status !== "finished") return { code: refuse(ctx, notPickedWords(ctx, got.record, part.reel)) };
  if (!writes) return { found, part, target, words: left };
  if (claimHeld(ctx, got.record)) return { code: refuse(ctx, claimHeld(ctx, got.record)) };
  const running = runningCommand(ctx.home, found.name, ctx.alive);
  if (running && running !== "bring") return { code: refuse(ctx, `${running} is running for this episode. Say "how far is it?", and try again when it is done.`) };
  if (target.base) return { code: refuse(ctx, "This timeline was changed by hand in Final Cut and taken in. brimm-video does not change a hand-edited timeline yet: make this change by hand in Final Cut.") };
  if (part !== "main" && piecesOf(found, part, ctx).old) return { code: refuse(ctx, `Reel ${part.reel} was cut as a clip before Reels had projects of their own, so brimm-video cannot change it: make this change by hand in Final Cut.`) };
  return { found, part, target, words: left };
}

/** The moment a command is given on a timeline, in seconds of the raw video: { at, for, on } or { code }. With `--at` a time,
    or `--at-words` quoted words, read on the newest version shown (clock.js), after the guard: a timeline shown before is
    read only when she says it was not changed in Final Cut since (`--no-hand-edits`). */
function momentFrom(ctx, found, part, flags, { needed = true } = {}) {
  const time = flags.at && flags.at[flags.at.length - 1];
  const quoted = flags["at-words"] && flags["at-words"][flags["at-words"].length - 1];
  if (!time && !quoted) return needed ? { code: refuse(ctx, "Say when: a time on the timeline (--at 0:03), or the words said there (--at-words \"three numbers\").") } : { none: true };
  const got = timelineRead(ctx, found, part, flags);
  if (got.code !== undefined) return got;
  const { read } = got;
  const moment = momentOf({ ...(quoted ? { quoted } : { time }), on: read.on, clock: read.clock, ranges: read.pieces, words: read.words });
  if (moment.why) return { code: refuse(ctx, moment.why) };
  return { ...moment, on: read.on, clock: read.clock, read };
}

/** The timeline she names, as she watched it, read for a time or words she gives: { read } (clockFor) or { code }. After the
    guard: a timeline shown before is read only when she says it was not changed in Final Cut since. */
function timelineRead(ctx, found, part, flags) {
  const guard = guardOf(ctx, found, part, { noHandEdits: Boolean(flags["no-hand-edits"]), handEdits: Boolean(flags["hand-edits"]), withoutOther: Boolean(flags["without-other-macs-changes"]) }, "to go on");
  if (guard.why) return { code: refuse(ctx, guard.why) };
  const got = clockRead(ctx, found, part);
  if (got.code === undefined) sayElsewhere(ctx, got.read);
  return got;
}

/** The clock she reads on a timeline (clockFor): { read } or { code }. A file Dropbox has not brought over yet is asked for
    (`bring`, unless one is running), and she is told to say it again when it is here. */
function clockRead(ctx, found, part) {
  const read = clockFor(found, part, ctx);
  if (read.coming) {
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: read.bring });
    return { code: refuse(ctx, `Dropbox is still bringing ${read.coming} over to this Mac. Say it again when it is done.`) };
  }
  if (read.why) return { code: refuse(ctx, read.why) };
  return { read };
}

/** Say, when the other Mac has rendered a newer version than the one a time was read on here (clockFor's `elsewhere`), that it is
    there and how to see it here: renders stay on the Mac that made them (spec 3, "Times"). */
function sayElsewhere(ctx, read) {
  if (read && read.elsewhere) ctx.say(`The other Mac has a newer version (v${read.elsewhere.v}, on ${read.elsewhere.on}): say "render it here" to see it.`);
}

/** How long a layer shows: `--for` seconds, else the quoted words' length, else `fallback`. { seconds } or { code }. */
function lengthFrom(ctx, flags, moment, fallback) {
  if (!flags.for) return { seconds: moment.for ? Math.max(moment.for, 1) : fallback };
  const seconds = Number(flags.for[flags.for.length - 1]);
  if (!(seconds > 0 && seconds <= 600)) return { code: refuse(ctx, "Say how long it shows in seconds, from 1 to 600 (--for 6).") };
  return { seconds };
}

/** A picture from her Pictures folder, by its name only, copied into the episode's media/ by the rule (spec section 4):
    { picture: "media/<name>", size, bytes, copied } or { code }. A link is refused: only a file of her own in the folder
    is taken. One already in media/ of that name is used when it is the same picture, byte for byte, and refused when it is
    another: nothing in Dropbox is written over. `copied` says this call put it there, so a command whose record cannot be
    written takes it out again. */
function pictureFrom(ctx, found, name) {
  const fault = pictureNameFault(name);
  if (fault) return { code: refuse(ctx, fault) };
  const from = join(studioFolder(ctx.home), "Pictures", name);
  let seen;
  try {
    seen = lstatSync(from);
  } catch (e) {
    return { code: refuse(ctx, `There is no picture called "${name}" in the Pictures folder (BRIMM Video Studio, Pictures). Put it there first.`) };
  }
  if (!seen.isFile()) return { code: refuse(ctx, `"${name}" in the Pictures folder is not a picture file of its own. Put the picture itself there.`) };
  const size = pictureSize(readFileSync(from));
  if (!size) return { code: refuse(ctx, `"${name}" cannot be read as a PNG or a JPEG picture.`) };
  const picture = `media/${name}`;
  const to = join(found.folder, picture);
  if (existsSync(to)) {
    if (!ctx.isWhole(to)) return { code: refuse(ctx, `Dropbox is still bringing ${picture} over to this Mac. Say it again when it is done.`) };
    if (!readFileSync(to).equals(readFileSync(from))) return { code: refuse(ctx, `Another picture called "${name}" is in this episode already. Give yours another name in the Pictures folder.`) };
    return { picture, size, bytes: seen.size, copied: false };
  }
  try {
    mkdirSync(join(found.folder, "media"), { recursive: true });
    cloneIn(from, to, ruleOpts(ctx));
  } catch (e) {
    return { code: refuse(ctx, `"${name}" could not be copied into the episode: ${String(e.message).replace(/\.$/, "")}.`) };
  }
  return { picture, size, bytes: seen.size, copied: true };
}

/** Save the record, and take a picture this command copied into media/ out again when the record cannot be written: the
    record never leaves a picture in the episode that it does not list. */
async function saveWithPicture(ctx, found, record, done, got) {
  const code = await save(ctx, found, record, done);
  if (code !== 0 && got && got.copied) rmSync(join(found.folder, got.picture), { force: true });
  return code;
}

/** How long past a finish's late check final/ is still taken as its: the check itself takes a while, and two Macs' clocks
    may differ a little. */
const LATE_MARGIN_MS = 2 * 60 * 1000;
/** A moment `ms` after a stamp of the record's, as the clock of the Mac that wrote it reads it, to the minute: "2026-10-20
    15:17". */
function shownAfter(stamp, ms) {
  const m = /([+-])(\d{2}):(\d{2})$/.exec(String(stamp));
  const offset = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) * 60000 : 0;
  return new Date(Date.parse(stamp) + ms + offset).toISOString().slice(0, 16).replace("T", " ");
}

/** What is said when the hand-off waits for the switch, and when it is written. */
const HANDOFF_WAITS = "The hand-off is written once this Mac hands off version 2: ask Jason.";
/** What `finish` says of a video whose hand-off is written from its spellings (a finished video, an iPhone clip she answered) on a
    Mac that hands off version 1. */
const handoffFromSpellingsWaits = (name) => `${name}'s hand-off is written from its spellings once this Mac hands off version 2: ask Jason.`;
/** What `finish` says of a video that has no Final Cut (hasFinalCut), `found` with its `record`: on a Mac that hands off version 1,
    that its hand-off waits for version 2; once it is written, its revision; otherwise that it comes from the spellings card. */
function notInFinalCut(ctx, found, record) {
  const name = shownName(record);
  if (!writesV2For(ctx.settings, found.folder, record)) return handoffFromSpellingsWaits(name);
  if (record.finished && Number.isInteger(record.finished.revision)) return `${name}'s hand-off is written already, as revision ${record.finished.revision}: a spelling changed writes its next revision.`;
  return `${name} is not edited in Final Cut: its hand-off is written once its spellings are answered. Say "show me the spellings".`;
}
const handoffWritten = (revision, shown = true) => (shown ? `The hand-off is written as revision ${revision} and shown in Finder: drop it on the BRIMM Ops page.` : `The hand-off is written as revision ${revision}.`);
/** A finished video has no Final Cut, and nothing of it is shown there; nor has an iPhone clip of the switch, a record that holds
    her `answer`. Today's import makes short videos too, answered by no one, and shows them in Final Cut as it shows an episode. */
const hasFinalCut = (record) => {
  const kind = recordKind(record);
  if (kind === "short video") return !(record.answer !== null && typeof record.answer === "object");
  return kind !== "finished";
};
/** Spellings as they are said in a row: "a" as "b", "c" as "d" and "e" as "f". */
const pairsSaid = (pairs) => listed(pairs.map(([heard, meant]) => `"${heard}" as "${meant}"`));

/** The reading the record holds when it is the current one, or null: one made after her answer (not before it), as the kind the
    video is now. `kind … --again` keeps the reading and its offers in the record while the new one is made, and a video answered
    again as another kind holds the old kind's: neither is a reading of this answer (the inverse of reading.js notAsAnswered). A
    time that cannot be read is not after. */
function currentReading(record) {
  const reading = record.reading;
  if (reading === null || typeof reading !== "object" || record.answer === null || typeof record.answer !== "object") return null;
  return Date.parse(reading.at) >= Date.parse(record.answer.at) && reading.kind === recordKind(record) ? reading : null;
}

/** The spellings Claude's reading offered, each { heard, spelled, why }, as the card numbers them (by their place in the record,
    so that a spelling added meanwhile changes no number); null when the video has not been read, by a reading that counts
    (currentReading). */
function offersOf(record) {
  if (!currentReading(record)) return null;
  const offered = record.offers && Array.isArray(record.offers.spellings) ? record.offers.spellings : [];
  return offered.map((o) => ({ heard: String((o && o.heard) ?? ""), spelled: String((o && o.spelled) ?? ""), why: typeof (o && o.why) === "string" ? o.why : "" }));
}

/** Her answer to the offers of the reading the record holds, { reading, at, on, applied, left }, or null while they are not
    answered. An answer is of one reading, the current one (currentReading): a reading made again (its `at` is another) has offers
    of its own. */
function answerOf(record) {
  const answer = record.offers && record.offers.answered;
  const reading = currentReading(record);
  return answer && reading && answer.reading === reading.at && Array.isArray(answer.applied) && Array.isArray(answer.left) ? answer : null;
}

/** An iPhone clip she answered: a short video that holds her `answer`. Its hand-off is not written from the spellings card (plan PR 7,
    item 4): `finish` makes it, from the export of its HyperFrames project or, asked, from the import's captions. */
const isClip = (record) => recordKind(record) === "short video" && !hasFinalCut(record);

/** Is the hand-off of a finished video written by the spellings card, and still owed: its offers are answered, and it is not written
    yet? A finished video's is. An iPhone clip's is not, and the card writes nothing for it (finishClip). */
const handoffOwed = (record) => !record.finished && recordKind(record) === "finished" && answerOf(record) !== null;

/** Is a hand-off of a finished video or an iPhone clip not written yet, though its offers are answered: what `spell … offers` says
    of a Mac that hands off version 1. */
const handoffPending = (record) => !record.finished && !hasFinalCut(record) && answerOf(record) !== null;

/** What is said of an iPhone clip whose spellings are answered and whose hand-off is not written: the ways to go on, by what this Mac can do
    (plan PR 7, F1; review, minor 2). A clip she opens in HyperFrames and exports is handed off in either version of the hand-off (a
    version 1 short-video hand-off on a Mac that has not switched); handing it off as it is waits for version 2. The offer of HyperFrames is
    left out when this Mac's settings have the app off, and with it nothing is left to offer on a Mac that hands off version 1. */
function clipNext(ctx, found, record) {
  const v2 = writesV2For(ctx.settings, found.folder, record);
  if (appOf(ctx.settings)) return v2 ? 'Say "open it in HyperFrames" to edit it, or "hand it off" to hand it off as it is.' : 'Say "open it in HyperFrames" to edit it. Handing it off as it is waits until this Mac hands off version 2: ask Jason.';
  return v2 ? 'Say "hand it off" to hand it off as it is.' : HANDOFF_WAITS;
}

/** What `finish` does for an iPhone clip the app has not opened (plan PR 7, item 4; architecture 4.2): it checks, in this order, a Mac that
    hands off version 1, a hand-off that is written already, and spellings not yet answered; then, with no hand-off yet, it asks once
    whether to hand the clip off as it is, and starts nothing. `--as-it-is` writes the hand-off from the import's captions, which is what
    the spellings card did before, in its words. A hand-off made already from the import is kept, with the revision the page holds: an
    edited version needs HyperFrames first. Every offer of HyperFrames in these words is left out where this Mac's settings have the app off,
    and on a Mac that hands off version 1 the way that is handed off now (a clip opened in HyperFrames and exported) is named beside the wait. */
async function finishClip(ctx, found, answers) {
  const { record } = found;
  const name = shownName(record);
  const app = Boolean(appOf(ctx.settings));
  if (!writesV2For(ctx.settings, found.folder, record)) return refuse(ctx, `${handoffFromSpellingsWaits(name)}${app ? ' Or open it in HyperFrames, export it on this Mac and say "hand it off".' : ""}`);
  if (record.finished && Number.isInteger(record.finished.revision)) {
    const how = madeFromImport(record) ? `, from the clip as it was filmed.${app ? " To hand off an edited version, open it in HyperFrames first." : ""}` : ": a spelling changed writes its next revision.";
    return refuse(ctx, `${name}'s hand-off is written already, as revision ${record.finished.revision}${how}`);
  }
  if (answerOf(record) === null) return refuse(ctx, `${name}'s hand-off is written once its spellings are answered. Say "show me the spellings".`);
  if (!answers.asItIs) {
    ctx.say(app ? `${name} was not opened in HyperFrames. Hand it off as it is, or open it in HyperFrames first?` : `Hand ${name} off as it is?`);
    return 0;
  }
  const running = runningCommand(ctx.home, found.name, ctx.alive);
  if (running) return refuse(ctx, `${running} is running for this episode. Say "how far is it?"`);
  return importHandoff(ctx, found, record, "Handed off as it is.");
}

/** Why an offer cannot be kept, in plain words, or "": the episode has a spelling of that word already, or it is not a spelling
    (spellingFault). */
function offerFault(record, offer) {
  const mine = (record.spellings || []).find(([heard]) => heard === offer.heard);
  if (mine && mine[1] !== offer.spelled) return `You have "${offer.heard}" spelled "${mine[1]}" already.`;
  return spellingFault(offer.heard, offer.spelled);
}

/** Write the hand-off of a finished video or an iPhone clip from the import's captions (finish.js finishFinished), the first
    one or the next revision of it, with the record `record` (its spellings and the answer to the offers in it), and say `done`
    and what came of it. Version 1 of the hand-off waits for the switch: the record is kept, and nothing is put in final/. */
async function importHandoff(ctx, found, record, done) {
  const wrote = await finishFinished(ctx, found, { record });
  if (wrote.waits) return save(ctx, found, record, `${done} ${HANDOFF_WAITS}`);
  if (wrote.coming) {
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: wrote.coming });
    return refuse(ctx, `Dropbox is still bringing ${listed([...new Set(wrote.coming.map(whatIs))])} over: say it again in a minute.`);
  }
  if (wrote.why) return refuse(ctx, wrote.why);
  if (wrote.same) ctx.say(`${done} The final transcripts and the hand-off are as they were.`);
  else if (record.finished) ctx.say(`${done} The final transcripts are spelled so too, and the hand-off is made again as revision ${wrote.revision}: drop it on the BRIMM Ops page again.`);
  else ctx.say(`${done}${wrote.left.map((line) => ` ${line}`).join("")} ${handoffWritten(wrote.revision, wrote.shown !== false)}`);
  // On an open-lock Mac a hand-off whose copy could not be made is not shown in Finder (reveal.js).
  if (wrote.shown === false) ctx.say(cantOpen(shownName(record)));
  return 0;
}

/** The record with its spellings, `spellings`; and after a finish (spec section 4, "spell applies to every timeline and to
    the final transcripts") the final transcripts with each spelling they do not hold yet, and the hand-off made again as its
    next revision, each file put in by the rule, and only when its words change. Each finished part's transcripts hold the
    spellings that changed them: its `spellings`, or, for a part no spelling has reached since a finish made it, the record's
    own. Only the others are applied to it, so none is applied twice, and a spelling taken back or changed leaves the part as
    it is, which is said: a finish again makes a part's transcripts again only once it is Shared again. Before reading them
    it checks they are here, whole (her folder may be online-only after a hand-off): if not, it starts bringing them over and
    stops. (`spell` has refused already while a finish runs, whose late check would put its own copies back.) When the record
    cannot be written, each final file is put back as it was, each on its own; one that cannot be is named, and she is told
    the episode needs Jason. `set` is what else the command changes in the record (the answer to Claude's offers), written in the
    same record, and `later` what is said at the end when no hand-off is written yet and none is due (a raw video's). Resolves the
    save's code. */
async function saveSpellings(ctx, found, spellings, done, { set = {}, later = "" } = {}) {
  const record = { ...found.record, ...set, spellings };
  const finished = record.finished;
  // The hand-off of a finished video or an iPhone clip is made from the import's own captions (finish.js finishFinished): it is
  // written at the first spell once its offers are answered, and made again from the captions at every one after, so that a
  // spelling dropped or changed is dropped or changed in it too. Which refusals apply is that function's.
  if (madeFromImport(record)) {
    // A client or group session, and a video not yet answered, are refused as finish refuses them, whatever the hand-off on file
    // was made as, before the spelling is kept (finish.js cannotFinish).
    const notYet = cannotFinish(record);
    if (notYet) return refuse(ctx, notYet);
    // Only while the video is the kind its hand-off was made as: answered again as another kind, the spelling is kept and the
    // hand-off waits for the new reading (`kind … --again` sets this one aside).
    if (importKind(record) === recordKind(record)) return importHandoff(ctx, found, record, done);
    return save(ctx, found, record, `${shownName(record)}: spelled. Its hand-off waits for its new reading.`);
  }
  if (!finished && handoffOwed(record)) return importHandoff(ctx, found, record, done);
  if (!finished) return save(ctx, found, record, [done, later].filter(Boolean).join(" "));
  // A client or group session, and a video not yet answered, are refused at once, as finish refuses them (finish.js
  // cannotFinish), before any file in final/ is named or read, and nothing is written, the spelling included: none of a
  // session's transcripts may be in the shared folder, and an unanswered video has no kind to hand off as.
  const notYet = cannotFinish(record);
  if (notYet) return refuse(ctx, notYet);
  const meantOf = (list, heard) => (list.find(([h]) => h === heard) || [])[1];
  const parts = Object.entries(finished.parts || {}).map(([key, part]) => {
    const held = part.spellings || found.record.spellings || [];
    return { key, part, held, stem: `final/${basename(part.file, extname(part.file))}`, toApply: spellings.filter(([h]) => meantOf(held, h) === undefined) };
  });
  // Every part's own list is kept from now on, so a part a finish reuses keeps it, and one it makes again starts afresh.
  const withHeld = (held) => ({ ...finished, parts: Object.fromEntries(parts.map((p) => [p.key, { ...p.part, spellings: held[p.key] || p.held }])) });
  const kept = [...new Set(parts.flatMap((p) => p.held.filter(([h, m]) => meantOf(spellings, h) !== m).map(([h, m]) => `"${h}" as "${m}"`)))];
  const keptNote = kept.length ? ` The final transcripts keep ${listed(kept)} until each part is shown in Final Cut, Shared and finished again.` : "";
  if (!parts.some((p) => p.toApply.length)) return save(ctx, found, { ...record, finished: withHeld({}) }, `${done}${keptNote}`);
  const finals = [...parts.flatMap((p) => [`${p.stem}.srt`, `${p.stem}.transcript.txt`, ...(p.part.words ? [p.part.words] : [])]), finished.handoff];
  const gone = finals.find((rel) => !existsSync(join(found.folder, rel)));
  if (gone) return refuse(ctx, `${gone} is not in the episode's folder, so the final transcripts cannot be spelled again. Nothing was changed. Say finish again.`);
  const coming = finals.filter((rel) => !ctx.isWhole(join(found.folder, rel)));
  if (coming.length) {
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: coming });
    return refuse(ctx, "Dropbox is bringing the final transcripts over to this Mac. Say it again when it is done. Nothing was changed.");
  }
  const work = join(runsFolder(ctx.home), `spell-${process.pid}-${ctx.now()}`);
  mkdirSync(work, { recursive: true });
  const put = textWriter({ work, ...ruleOpts(ctx) });
  const before = [];
  /** Each final file put back as it was, each on its own: the ones that could not be. */
  const putBack = () => before.filter(([rel, text]) => {
    try {
      put(join(found.folder, rel), text, { replace: true });
      return false;
    } catch (e) {
      return true;
    }
  }).map(([rel]) => rel);
  try {
    const srts = {};
    const writes = [];
    const held = {};
    // The pairs each part's captions are spelled with now, by its key.
    const spelledWith = {};
    for (const p of parts) {
      const was = { srt: readFileSync(join(found.folder, `${p.stem}.srt`), "utf8"), words: p.part.words ? readFileSync(join(found.folder, p.part.words), "utf8") : null };
      const sameWords = (made) => !made.words || JSON.stringify(JSON.parse(made.words).words) === JSON.stringify(JSON.parse(was.words).words);
      // A spelling is held by a part only once it has changed it: one whose word the part does not have is not.
      const changing = p.toApply.filter((pair) => {
        const made = respelledPart(was, [pair]);
        return made.srt !== was.srt || !sameWords(made);
      });
      held[p.key] = [...p.held, ...changing];
      spelledWith[p.key] = changing;
      const made = respelledPart(was, changing);
      srts[p.key] = made.srt;
      if (made.srt !== was.srt) writes.push([`${p.stem}.srt`, made.srt], [`${p.stem}.transcript.txt`, made.txt]);
      if (!sameWords(made)) writes.push([p.part.words, made.words]);
    }
    const toApply = [...new Map(parts.flatMap((p) => p.toApply).map(([h, m]) => [h, [h, m]])).values()];
    if (!writes.length) return save(ctx, found, { ...record, finished: withHeld(held) }, `${done} The final transcripts do not have ${listed(toApply.map(([h]) => `"${h}"`))}, so they are as they were.${keptNote}`);
    // The hand-off is made again as version 2 once this Mac's settings say so, and when it is version 2 already: version 1 is
    // never written over it (spec 2026-10-22, section 8; finish.js writesV2For, which a finish asks too). Version 2 is under the
    // video's first version's id, above every revision written for that id on this Mac (finish.js nextRevision), and only when
    // the chain of the video's versions can be followed to its first: on a gap nothing is written, the spelling included.
    // Version 1 is under the episode's own id, and a revision is never used twice, even one a finish left in final/ without
    // writing its record (finish.js lastRevision). Which version, the id, the revision and a refusal are finish.js
    // handoffTarget's, as every hand-off writer asks them.
    const onFile = JSON.parse(readFileSync(join(found.folder, finished.handoff), "utf8"));
    const target = handoffTarget(ctx, { folder: found.folder, record });
    if (target.refusal) return refuse(ctx, target.refusal);
    const { v2, revision } = target;
    const at = localStamp(new Date(ctx.now()));
    const given = { record, srts, revision, made: at, madeOn: ctx.machine, commit: writerOf(ctx).commit };
    const handoff = v2 ? respelledHandoffV2(onFile, { ...given, id: target.id, spellings: spelledWith.main || [] }) : respelledHandoff(onFile, given);
    const fault = v2 ? handoffFaultV2(handoff) : handoffFault(handoff);
    if (fault) return refuse(ctx, `The hand-off could not be made again (${fault.replace(/\.$/, "")}). Nothing was changed.`);
    // A number another version of the video gave already, under the same id, is never given again (spec section 8).
    const again = v2 ? numbersTakenWords(record, handoff, target.taken) : "";
    if (again) return refuse(ctx, again);
    writes.push([finished.handoff, handoffText(handoff)]);
    // Nothing is put into final/ that the record could not then take: a change Dropbox took away is said first, as save says
    // it, and a finish on the other Mac whose late check of final/ is still to come would put its own copies back over these.
    const gone = undone(found.record, ctx.home);
    if (gone) {
      ctx.say(`${gone} Nothing was written.`);
      acceptRev(ctx.home, found.record.id, found.record.rev);
      return 1;
    }
    const checked = finished.on !== ctx.machine ? Date.parse(finished.at) + LATE_CHECK_MS + LATE_MARGIN_MS : 0;
    if (checked > ctx.now()) return refuse(ctx, `The finish on ${finished.on} is still checking its copies in final/, until ${shownAfter(finished.at, LATE_CHECK_MS + LATE_MARGIN_MS)}. Say it again after that. Nothing was changed.`);
    const files = {};
    for (const [rel, text] of writes) {
      before.push([rel, readFileSync(join(found.folder, rel), "utf8")]);
      files[rel] = put(join(found.folder, rel), text, { replace: true }).bytes;
    }
    // A finished part may have captions drawn into its picture (whether it has is not known here), which keep the old spelling
    // until it is finished again: a full episode's main video has none.
    const drawn = parts.filter((p) => p.key !== "main" || presetOf(record, "main").job !== "full-episode").map((p) => (p.key === "main" ? "the main video" : capital(p.key)));
    const still = drawn.length ? ` If ${listed(drawn)} ${drawn.length === 1 ? "shows" : "show"} captions on screen, they keep the old spelling until ${drawn.length === 1 ? "it is" : "each is"} shown in Final Cut, Shared and finished again.` : "";
    const code = await save(ctx, found, { ...record, files: { ...record.files, ...files }, finished: { ...withHeld(held), revision, at, on: ctx.machine } }, `${done} The final transcripts are spelled so too, and the hand-off is made again as revision ${revision}: drop it on the BRIMM Ops page again.${still}${keptNote}`);
    if (code !== 0) {
      const lost = putBack();
      if (lost.length) ctx.say(`${listed(lost)} could not be put back as it was. Tell Jason: the episode needs him.`);
    }
    return code;
  } catch (e) {
    const lost = putBack();
    return refuse(ctx, `The final transcripts could not be spelled again (${e.code || "a file could not be read or put in"}). ${lost.length ? `${listed(lost)} could not be put back as it was. Tell Jason: the episode needs him.` : "Nothing was changed."}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** The pairs of `spell … add` after its first "add": "<as heard>" "<as spelled>", and more pairs after them, each of which may be
    started with "add" again, as the command line is written. { pairs }, or { odd } with the word that has no spelling after it.
    An "add" is passed over where a pair would start only when at least a pair follows it, so a word heard as "add" is still one
    when it is the last pair. */
function spellPairs(words) {
  const pairs = [];
  for (let i = 0; i < words.length; ) {
    if (words[i] === "add" && words.length - i >= 3) i += 1;
    if (i + 1 >= words.length) return { odd: words[i] };
    pairs.push([words[i].trim(), words[i + 1].trim()]);
    i += 2;
  }
  return { pairs };
}

/** What she is to say to answer Claude's offers. */
const ANSWER_WITH = 'Say which to apply: "all", "none", or their numbers, as in 1 3.';

/** `spell "<episode>" offers`: the spellings Claude's reading offered, as one numbered card, or, once she has answered them, what
    she answered. It reads only. */
function spellCard(ctx, found) {
  const { record } = found;
  const name = shownName(record);
  const offers = offersOf(record);
  if (!offers) return refuse(ctx, `Claude has not read ${name} yet, so it has offered no spellings.`);
  const answer = answerOf(record);
  if (answer) {
    ctx.say(`Claude's spellings for ${name} were answered on ${shownAt(answer.at)}:`);
    offers.forEach((o, i) => ctx.say(`${i + 1}. "${o.heard}" as "${o.spelled}": ${answer.applied.includes(o.heard) ? "applied" : "left"}.`));
    if (handoffPending(record) && !writesV2For(ctx.settings, found.folder, record)) ctx.say(isClip(record) ? clipNext(ctx, found, record) : HANDOFF_WAITS);
    return 0;
  }
  if (!offers.length) {
    ctx.say(`Claude offered no spellings for ${name}.`);
    ctx.say("Answer none to go on.");
    return 0;
  }
  ctx.say(`Claude offers these spellings for ${name}:`);
  offers.forEach((o, i) => {
    const fault = offerFault(record, o);
    ctx.say(fault ? `${i + 1}. "${o.heard}" as "${o.spelled}" cannot be kept. ${fault}` : `${i + 1}. "${o.heard}" as "${o.spelled}"${o.why ? `: ${o.why}` : ""}`);
  });
  ctx.say(ANSWER_WITH);
  return 0;
}

/** `spell "<episode>" offers all|none|<n> <n>…`: her answer to Claude's offers. The ones named are applied as the episode's
    spellings, in the card's order, together with the answer, in one record; and, for a finished video or an iPhone clip, the
    hand-off is then written (saveSpellings). "all" applies every offer that can be kept; a number whose offer cannot is refused.
    An offer for a word the episode spells already is not used: her own spelling stays. Nothing is written when it is refused. */
async function answerOffers(ctx, found, words) {
  const { record } = found;
  const name = shownName(record);
  const offers = offersOf(record);
  if (!offers) return refuse(ctx, `Claude has not read ${name} yet, so it has offered no spellings.`);
  if (answerOf(record)) {
    // Her answer stands. A hand-off still owed, because this Mac handed off version 1 when she gave it, is written now.
    if (handoffOwed(record) && writesV2For(ctx.settings, found.folder, record)) return saveSpellings(ctx, found, record.spellings || [], `The spellings Claude offered for ${name} were answered already.`);
    return refuse(ctx, `The spellings Claude offered for ${name} were answered already. To spell a word another way, say it with spell add; to take one back, spell drop.`);
  }
  const said = words.join(" ").split(/[\s,]+/).filter(Boolean);
  const numbers = said.length > 0 && said.every((w) => /^[1-9]\d*$/.test(w));
  if (said.length !== 1 && !numbers) return refuse(ctx, ANSWER_WITH);
  if (said.length === 1 && !numbers && !["all", "none"].includes(said[0])) return refuse(ctx, ANSWER_WITH);
  const faults = offers.map((o) => offerFault(record, o));
  let chosen = [];
  const notKept = [];
  if (said[0] === "all") {
    chosen = offers.map((_, i) => i).filter((i) => !faults[i]);
    notKept.push(...faults.filter(Boolean));
  } else if (numbers) {
    const asked = [...new Set(said.map(Number))].sort((a, b) => a - b);
    if (!offers.length) return refuse(ctx, `Claude offered no spellings for ${name}. Answer none to go on.`);
    const beyond = said.map(Number).find((n) => n > offers.length);
    if (beyond !== undefined) return refuse(ctx, `There is no offer ${beyond}: the offers are 1 to ${offers.length}.`);
    const bad = asked.find((n) => faults[n - 1]);
    if (bad !== undefined) return refuse(ctx, `Offer ${bad} cannot be kept. ${faults[bad - 1]} Nothing was written.`);
    chosen = asked.map((n) => n - 1);
  }
  const applied = chosen.map((i) => offers[i]);
  let next = record.spellings || [];
  for (const o of applied) next = withSpelling(next, o.heard, o.spelled);
  const answer = { reading: currentReading(record).at, at: localStamp(new Date(ctx.now())), on: ctx.machine, applied: applied.map((o) => o.heard), left: offers.filter((_, i) => !chosen.includes(i)).map((o) => o.heard) };
  const done = `${applied.length ? `Spelled now, in every caption: ${pairsSaid(applied.map((o) => [o.heard, o.spelled]))}.` : "No spelling applied."}${notKept.length ? ` Not kept: ${notKept.join(" ")}` : ""}`;
  // No hand-off is written yet and none is due from the card: a raw video's is made when it is finished, and an iPhone clip's when she
  // says "hand it off", edited in HyperFrames first or as it is (or, on a Mac that hands off version 1, once that Mac hands off version 2).
  const later = recordKind(record) === "raw" ? "Its hand-off is made when it is finished." : isClip(record) ? clipNext(ctx, found, record) : "";
  return saveSpellings(ctx, found, next, done, { set: { offers: { ...record.offers, answered: answer } }, later });
}

/** `spell "<episode>" [add "<as heard>" "<as spelled>" [add …]… | drop "<as heard>" | offers [all|none|<n> <n>…]]`: the
    episode's own spellings, which every timeline's captions and the final transcripts take. Several pairs are one change. */
async function spell(ctx, rest) {
  const [said, verb, ...more] = rest;
  const got = episodeFor(ctx, said === undefined ? [] : [said], { newerEnds: 1 });
  if (!got.found) return got.code;
  const found = { ...got.found, record: got.record };
  const spellings = got.record.spellings || [];
  if (verb === undefined) {
    ctx.say(spellings.length ? `The spellings: ${spellings.map(([h, m]) => `"${h}" as "${m}"`).join(", ")}.` : "There are no spellings for this episode yet.");
    return 0;
  }
  if (verb === "offers") {
    // A session, and a video not yet answered, are refused as finish refuses them, before any file is looked at.
    const notYet = cannotFinish(got.record);
    if (notYet) return refuse(ctx, notYet);
    if (more.length === 0) return spellCard(ctx, found);
  }
  if (claimHeld(ctx, got.record)) return refuse(ctx, claimHeld(ctx, got.record));
  // A finish's late check would put its own copies of final/ back, and its record would be refused after a change here. A
  // reading that has put in what it read is at its copies' late check only, which touches nothing a spelling writes; but only
  // once the record holds the current reading: one from before her answer is one a new reading is still to replace.
  const running = runningCommand(ctx.home, found.name, ctx.alive);
  if (running && running !== "bring" && !(running === "read" && currentReading(got.record))) return refuse(ctx, `${running} is running for this episode. Say "how far is it?", and try again when it is done.`);
  const fc = hasFinalCut(got.record);
  if (verb === "drop") {
    const heard = more[0];
    if (!spellings.some(([h]) => h === heard)) return refuse(ctx, `There is no spelling of "${heard}".`);
    return saveSpellings(ctx, found, spellings.filter(([h]) => h !== heard), `"${heard}" is as the transcriber writes it again.${fc ? ` ${SHOW_IT}` : ""}`);
  }
  if (verb === "offers") return answerOffers(ctx, found, more);
  if (verb !== "add") {
    ctx.say(HELP);
    return 2;
  }
  let pairs = [[more[0], more[1]]];
  if (more.length > 2) {
    const read = spellPairs(more);
    if (read.odd !== undefined) return refuse(ctx, spellingFault(read.odd, ""));
    pairs = read.pairs;
  }
  for (const [heard, meant] of pairs) {
    const fault = spellingFault(heard, meant);
    if (fault) return refuse(ctx, fault);
  }
  const written = [...new Map(pairs.map(([h, m]) => [h.trim(), [h.trim(), m.trim()]])).values()];
  const next = written.reduce((all, [h, m]) => withSpelling(all, h, m), spellings);
  const where = fc ? "in every timeline's captions" : "in every caption";
  const done = written.length === 1 ? `"${written[0][0]}" is spelled "${written[0][1]}" now, ${where}.` : `Spelled now, ${where}: ${pairsSaid(written)}.`;
  return saveSpellings(ctx, found, next, fc ? `${done} ${SHOW_IT}` : done);
}

/** `logo "<episode>" on|off [--picture "<name>"]`: the logo on the main video, top right (spec section 4). Its picture is
    named once, from the Pictures folder, and the episode keeps it. A Reel's logo comes with the brand templates (spec
    section 3). */
async function logo(ctx, rest) {
  const { words, flags } = flagsOf(rest, ["picture"]);
  const [said, verb, ...more] = words;
  if (partFrom(more).part !== "main") return refuse(ctx, "A Reel's logo comes with the brand templates, later. The logo is on the main video.");
  const start = layerStart(ctx, [said, ...more]);
  if (start.code !== undefined) return start.code;
  const { found, part } = start;
  if (verb !== "on" && verb !== "off") {
    ctx.say(HELP);
    return 2;
  }
  let record = found.record;
  let picked = null;
  if (verb === "on") {
    const named = flags.picture && flags.picture[flags.picture.length - 1];
    if (named) {
      const got = pictureFrom(ctx, found, named);
      if (got.code !== undefined) return got.code;
      picked = got;
      record = { ...record, brand: { ...(record.brand || {}), logo: got.picture }, files: { ...record.files, [got.picture]: got.bytes } };
    } else if (!(record.brand && record.brand.logo)) return refuse(ctx, 'Say which picture in the Pictures folder is the logo (--picture "<name>").');
  }
  return saveWithPicture(ctx, found, withPart(record, part, (t) => ({ ...t, logo: verb === "on" })), `The logo is ${verb} on ${partLabel(part)}. ${SHOW_IT}`, picked);
}

/** `captions "<episode>" reel <n> on|off`: a Reel's running captions, drawn in its preset's caption style. The main video's
    follow its preset alone. */
async function captions(ctx, rest) {
  const [said, ...more] = rest;
  const verb = more[more.length - 1];
  const start = layerStart(ctx, [said, ...more.slice(0, -1)]);
  if (start.code !== undefined) return start.code;
  const { found, part } = start;
  if (verb !== "on" && verb !== "off") {
    ctx.say(HELP);
    return 2;
  }
  if (part === "main") return refuse(ctx, "The main video's captions follow its caption style: say which (preset --captions).");
  return save(ctx, found, withPart(found.record, part, (t) => ({ ...t, captions: verb === "on" })), `Captions are ${verb} on Reel ${part.reel}. ${SHOW_IT}`);
}

/** `text "<episode>" add lower-third [main | reel <n>] (--at <time> | --at-words "<words>") [--for <seconds>] --line "<name>"
    [--line "<role>"]`, `text "<episode>" drop <id> [main | reel <n>]`, and with neither, the list: a name over a role on a
    timeline, from the moment given, for the seconds given (4 unless said). */
async function text(ctx, rest) {
  const { words, flags } = flagsOf(rest, ["at", "at-words", "for", "line"]);
  const [said, verb, kindOrId, ...more] = words;
  const start = layerStart(ctx, [said, ...(verb === "add" || verb === "drop" ? more : [verb, kindOrId, ...more].filter((w) => w !== undefined))], { writes: verb === "add" || verb === "drop" });
  if (start.code !== undefined) return start.code;
  const { found, part, target } = start;
  const texts = target.texts || [];
  if (verb === undefined || (verb !== "add" && verb !== "drop")) {
    ctx.say(texts.length ? texts.map((t) => `${t.id}: "${t.lines.join('", "')}" at ${t.at} s of the recording, for ${lengthText(t.for)}`).join("\n") : `There are no texts on ${partLabel(part)}.`);
    return 0;
  }
  if (verb === "drop") {
    if (!texts.some((t) => t.id === kindOrId)) return refuse(ctx, `There is no text ${kindOrId} on ${partLabel(part)}.`);
    return save(ctx, found, withPart(found.record, part, (t) => ({ ...t, texts: texts.filter((x) => x.id !== kindOrId) })), `Text ${kindOrId} is taken off ${partLabel(part)}. ${SHOW_IT}`);
  }
  if (kindOrId !== "lower-third") return refuse(ctx, "The kind of text there is so far is a lower third: a name over a role (add lower-third).");
  const lines = (flags.line || []).map((l) => oneLine(l)).filter(Boolean);
  if (!lines.length || lines.length > 2) return refuse(ctx, 'Say the name, and the role under it if there is one (--line "Sallie Ogden" --line "Founder, The BRIMM").');
  const moment = momentFrom(ctx, found, part, flags);
  if (moment.code !== undefined) return moment.code;
  const length = lengthFrom(ctx, flags, {}, 4);
  if (length.code !== undefined) return length.code;
  const id = nextId(texts, "t");
  const layer = { id, kind: "lower-third", at: moment.at, for: length.seconds, lines };
  return save(ctx, found, withPart(found.record, part, (t) => ({ ...t, texts: [...texts, layer] })), `Name title ${id} on ${moment.on} at ${clockText(timelineAt(moment.clock, moment.at) ?? 0)}, for ${lengthText(length.seconds)}: "${lines.join('", "')}". ${SHOW_IT}`);
}

/** Claude's ideas for graphics on a timeline, as she reads them (spec 2026-10-22, section 3, "Times"): each idea of the plan's
    `claude.graphics` on a phrase of the plan, numbered in the order their words are said (Claude's order for two on one
    phrase), so that no cut, version or Reel changes a number; one that names no phrase of the plan is left out. Each is
    { n, idea, phrase, outside, at, for, start, end }: `outside` when the timeline is a Reel whose stretch does not hold its
    words; `at`, the second of the recording its kept words start at, and `for`, how long they take on the timeline now, `at`
    null when its words are cut now; `start` and `end`, its times on the clock she is reading (`read.on`), null when its words
    are not on that version (kept again since it was made). `read` is clockFor's. */
function graphicIdeas(read) {
  const phrases = new Map((read.plan.phrases || []).map((p) => [p.id, p]));
  const listed = ((read.plan.claude && read.plan.claude.graphics) || []).map((g, i) => ({ idea: g.idea, phrase: phrases.get(g.id), i })).filter(({ phrase }) => phrase);
  return listed.sort((a, b) => a.phrase.start - b.phrase.start || a.i - b.i).map(({ idea, phrase }, k) => {
    const n = k + 1;
    if (read.span && !(phrase.end > read.span.from && phrase.start < read.span.to)) return { n, idea, phrase, outside: true, at: null };
    const kept = read.pieces.filter((r) => phrase.end > r.start && phrase.start < r.end);
    if (!kept.length) return { n, idea, phrase, at: null };
    const at = Math.max(phrase.start, kept[0].start);
    const to = Math.min(phrase.end, kept[kept.length - 1].end);
    const shown = kept.reduce((sum, r) => sum + Math.max(0, Math.min(to, r.end) - Math.max(at, r.start)), 0);
    const [start, end] = [timelineAt(read.clock, at), timelineAt(read.clock, to)];
    const on = start !== null && end !== null;
    return { n, idea, phrase, at, for: Math.round(shown * 1000) / 1000, start: on ? start : null, end: on ? end : null };
  });
}
/** Where an idea is on the clock she is reading, as its line says it: "0:04 to 0:07", "cut now", or "not on main v0 (kept again
    since)". */
const ideaWhere = (idea, on) => (idea.at === null ? "cut now" : idea.start === null ? `not on ${on} (kept again since)` : `${clockText(idea.start)} to ${clockText(idea.end)}`);
/** An idea's words as a sentence: with a full stop, unless they end in one already. */
const ideaSaid = (idea) => (/[.!?…]"?$/.test(oneLine(idea)) ? oneLine(idea) : `${oneLine(idea)}.`);
/** The place an idea says, when it says one: "corner" for a corner of the screen ("in the corner", "at the top right
    corner"), "lower" for a lower third; null otherwise. A corner the picture shows ("the street corner", "a corner shop") and a
    "lower price" are no place: Claude is not asked for a place, so the word alone says what is in the picture. */
const ideaPlace = (idea) => (/\b(?:in|into|at|to) (?:the |a )?(?:(?:top|bottom|upper|lower) )?(?:(?:left|right)(?:-hand)? )?corner\b/i.test(idea) ? "corner" : /\blower[- ]third\b/i.test(idea) ? "lower" : null);
/** What is said of a finished video's or an iPhone clip's ideas for graphics: Claude gives none (Jason, 22 Oct: "Reel suggestions
    and spellings, nothing more"). */
const noIdeas = (record) => `${shownName(record)} has no ideas for graphics: Claude gives none for ${recordKind(record) === "finished" ? "a finished video" : "an iPhone clip"}.`;
/** What the list of ideas says last, when one of them can be put up: `n`, the first listed that can be, is its example. */
const ideasAsk = (n) => `To put one up, say its number and a picture from your Pictures folder, as "put idea ${n} up with chart.png".`;

/** `graphic "<episode>" add "<picture>" [main | reel <n>] (--at <time> | --at-words "<words>" | --idea <n>) [--for <seconds>]
    [--place full|corner|lower]`, `graphic "<episode>" drop <id> [main | reel <n>]`, `graphic "<episode>" ideas
    [main | reel <n>]`, and with none, the list: a picture from her Pictures folder over a timeline (spec section 4). Claude's
    ideas are listed as she reads them (graphicIdeas), and `--idea` puts the picture at one's words (Sallie's note 8). */
async function graphic(ctx, rest) {
  const { words, flags } = flagsOf(rest, ["at", "at-words", "for", "place", "idea"]);
  const [said, verb, nameOrId, ...more] = words;
  const takes = verb === "add" || verb === "drop";
  const start = layerStart(ctx, [said, ...(takes ? more : [verb === "ideas" ? undefined : verb, nameOrId, ...more].filter((w) => w !== undefined))], { writes: takes });
  if (start.code !== undefined) return start.code;
  const { found, part, target } = start;
  const graphics = target.graphics || [];
  if (verb === "ideas" && !hasFinalCut(found.record)) {
    ctx.say(noIdeas(found.record));
    return 0;
  }
  // The other Mac's newer render is not said here (sayElsewhere): the list's first line names the version its times are on.
  if (verb === "ideas") {
    const got = clockRead(ctx, found, part);
    if (got.code !== undefined) return got.code;
    const { read } = got;
    const ideas = graphicIdeas(read).filter((i) => !i.outside);
    if (!ideas.length) {
      ctx.say(`Claude gave no ideas for graphics on ${partLabel(part)}.`);
      return 0;
    }
    const head = `Claude's ideas for graphics on ${partLabel(part)}: ${ideas.length}, with times on ${read.on}.`;
    const first = ideas.find((i) => i.at !== null);
    ctx.say([head, ...ideas.map((i) => `Idea ${i.n}, ${ideaWhere(i, read.on)}: ${ideaSaid(i.idea)} Over "${oneLine(i.phrase.text)}"`), ...(first ? [ideasAsk(first.n)] : [])].join("\n"));
    return 0;
  }
  if (!takes) {
    ctx.say(graphics.length ? graphics.map((g) => `${g.id}: ${g.picture.replace(/^media\//, "")}, ${g.place}, at ${g.at} s of the recording, for ${lengthText(g.for)}`).join("\n") : `There are no graphics on ${partLabel(part)}.`);
    return 0;
  }
  if (verb === "drop") {
    if (!graphics.some((g) => g.id === nameOrId)) return refuse(ctx, `There is no graphic ${nameOrId} on ${partLabel(part)}.`);
    return save(ctx, found, withPart(found.record, part, (t) => ({ ...t, graphics: graphics.filter((g) => g.id !== nameOrId) })), `Graphic ${nameOrId} is taken off ${partLabel(part)}. ${SHOW_IT}`);
  }
  const named = flags.place ? flags.place[flags.place.length - 1] : null;
  if (named !== null && !["full", "corner", "lower"].includes(named)) return refuse(ctx, `"${named}" is not a place. Say full, corner or lower.`);
  // By an idea's number, the moment is its words', from the plan: nothing is read off her timeline, so the guard is not asked.
  const asked = flags.idea ? flags.idea[flags.idea.length - 1] : undefined;
  let chosen = null;
  let moment;
  if (asked !== undefined) {
    if (!hasFinalCut(found.record)) return refuse(ctx, noIdeas(found.record));
    if (flags.at || flags["at-words"]) return refuse(ctx, "Say when by the idea (--idea 2), or by a time or words (--at, --at-words), not both.");
    const n = /^[1-9]\d*$/.test(asked) ? Number(asked) : null;
    if (n === null) return refuse(ctx, "Say which idea by its number (--idea 2).");
    const got = clockRead(ctx, found, part);
    if (got.code !== undefined) return got.code;
    const { read } = got;
    chosen = graphicIdeas(read).find((i) => i.n === n);
    if (!chosen) return refuse(ctx, `There is no idea ${n} for graphics. Say "any ideas for graphics?" to see them.`);
    if (chosen.outside) return refuse(ctx, `Idea ${n} is outside Reel ${part.reel}'s stretch of the recording.`);
    if (chosen.at === null) return refuse(ctx, `Idea ${n} is on words cut from ${partLabel(part)} now: "${oneLine(chosen.phrase.text)}" Keep them first, or pick another idea.`);
    moment = { at: chosen.at, for: chosen.for, on: read.on, clock: read.clock, read };
  } else {
    moment = momentFrom(ctx, found, part, flags);
    if (moment.code !== undefined) return moment.code;
  }
  const place = named || (chosen && ideaPlace(chosen.idea)) || "full";
  const length = lengthFrom(ctx, flags, moment, 4);
  if (length.code !== undefined) return length.code;
  const got = pictureFrom(ctx, found, nameOrId);
  if (got.code !== undefined) return got.code;
  const id = nextId(graphics, "g");
  const layer = { id, picture: got.picture, at: moment.at, for: length.seconds, place };
  // A picture shown full in another shape than the frame loses its edges: how much of it shows is said.
  const frame = part === "main" ? { width: moment.read.plan.facts.width, height: moment.read.plan.facts.height } : REEL_FRAME;
  const shown = Math.min(got.size.width / got.size.height / (frame.width / frame.height), (frame.width / frame.height) / (got.size.width / got.size.height));
  const cropped = place === "full" && shown < 0.67 ? ` The picture is another shape than the frame, so only about ${Math.round(shown * 100)}% of it shows: say --place lower to show it whole.` : "";
  const record = { ...found.record, files: { ...found.record.files, [got.picture]: got.bytes } };
  const where = !chosen ? `on ${moment.on} at ${clockText(timelineAt(moment.clock, moment.at) ?? 0)}` : `idea ${chosen.n}, ${chosen.start === null ? `not on ${moment.on} (kept again since)` : `on ${moment.on} at ${clockText(chosen.start)}`}`;
  return saveWithPicture(ctx, found, withPart(record, part, (t) => ({ ...t, graphics: [...graphics, layer] })), `Graphic ${id}, ${nameOrId}, ${place}, ${where}, for ${lengthText(length.seconds)}.${cropped} ${SHOW_IT}`, got);
}

/** `preset "<episode>" [main | reel <n>] [--job "<job>"] [--captions "<style>"] [--look "<look>"]`: the timeline's job,
    caption style and look, each from its list (styles.js); with none of them, what it has and what there is. */
async function preset(ctx, rest) {
  const { words, flags } = flagsOf(rest, ["job", "captions", "look"]);
  const start = layerStart(ctx, words, { writes: ["job", "captions", "look"].some((k) => flags[k]) });
  if (start.code !== undefined) return start.code;
  const { found, part, target } = start;
  const now = target.preset || defaultPreset(found.record.kind, part);
  // The record keeps each by its id ("full-episode"), as the spec's record does; a person names it either way.
  const given = Object.fromEntries(["job", "captions", "look"].filter((k) => flags[k]).map((k) => [k, idOf(flags[k][flags[k].length - 1])]));
  const describe = (p) => `${partLabel(part)[0].toUpperCase()}${partLabel(part).slice(1)} is a ${nameOf(p.job)}, with ${nameOf(p.captions)} captions and the ${nameOf(p.look)} look.`;
  if (!Object.keys(given).length) {
    ctx.say(`${describe(now)}${target.preset ? "" : " (Its default.)"}`);
    ctx.say(`Jobs: ${Object.keys(JOBS).map(nameOf).join(", ")}. Caption styles: ${Object.keys(CAPTION_STYLES).map(nameOf).join(", ")}. Looks: ${Object.keys(LOOKS).join(", ")}.`);
    return 0;
  }
  // A new job brings its own caption style and look, unless they are given too.
  const next = given.job && given.job !== now.job ? { job: given.job, captions: (JOBS[given.job] || {}).captions, look: (JOBS[given.job] || {}).look, ...given } : { ...now, ...given };
  const fault = presetFault(next);
  if (fault) return refuse(ctx, fault);
  return save(ctx, found, withPart(found.record, part, (t) => ({ ...t, preset: next })), `${describe(next)} ${SHOW_IT}`);
}

/** `cut "<episode>" remove [main | reel <n>] (--words "<words>" | --at <time> --to <time>)` and `cut "<episode>" keep
    [main | reel <n>] (--words "<words>" | --at <time>)`: whole phrases taken out of a timeline, or kept that were cut, always
    at a pause (recut.js). A time is read on the timeline she names, as she watched it (spec section 4, "Times a person
    gives"): what is taken out runs from --at to --to on it, and what is kept is what was cut at the join nearest --at
    ("keep the Hormozi story at 12:30"). Words to keep are found in what is cut. A cut that would keep nothing is refused. A
    cut on the main video does not reach a Reel over the same words, and is said so. */
async function cut(ctx, rest) {
  const { words, flags } = flagsOf(rest, ["words", "at", "to"]);
  const [said, verb, ...more] = words;
  const start = layerStart(ctx, [said, ...more]);
  if (start.code !== undefined) return start.code;
  const { found, part, target } = start;
  if (verb !== "keep" && verb !== "remove") {
    ctx.say(HELP);
    return 2;
  }
  const last = (k) => (flags[k] ? flags[k][flags[k].length - 1] : undefined);
  let from;
  let to;
  let read;
  const cuts = target.cuts || [];
  if (verb === "remove") {
    if (!flags.words && !flags.at) return refuse(ctx, 'Say what to take out: the words (--words "know your costs"), or where it starts and ends on the timeline (--at 0:04 --to 0:09).');
    if (!flags.words && !last("to")) return refuse(ctx, "Say where the cut ends too (--to 0:12).");
    const first = momentFrom(ctx, found, part, { ...flags, ...(flags.words ? { "at-words": flags.words } : {}) });
    if (first.code !== undefined) return first.code;
    read = first.read;
    from = first.at;
    to = first.to ?? first.at;
    if (!flags.words) {
      const end = momentOf({ time: last("to"), on: first.on, clock: first.clock, ranges: read.pieces, words: read.words, end: true });
      if (end.why) return refuse(ctx, end.why);
      if (!(end.at > from)) return refuse(ctx, `A cut ends after it starts: ${last("to")} is not after ${last("at")} on ${first.on}.`);
      to = end.at;
    }
  } else if (flags.words) {
    read = clockFor(found, part, ctx);
    if (read.why || read.coming) return refuse(ctx, read.why || `Dropbox is still bringing ${read.coming} over to this Mac.`);
    sayElsewhere(ctx, read);
    let places = wordsAt(read.words, [{ start: 0, end: read.plan.facts.duration }], last("words")).filter((p) => !read.pieces.some((r) => p.start < r.end && p.end > r.start));
    // On a Reel, only what is cut within its stretch counts: the same words said elsewhere in the recording are not meant.
    if (read.span) {
      const within = places.filter((p) => p.start >= read.span.from && p.end <= read.span.to);
      if (!within.length && places.length) return refuse(ctx, `That is outside Reel ${part.reel}'s stretch of the recording, ${clockText(read.span.from)} to ${clockText(read.span.to)}.`);
      places = within;
    }
    if (places.length !== 1) return refuse(ctx, places.length ? `"${last("words")}" is said ${places.length} times in what is cut. Say the time on ${read.on} where it was cut instead (--at 0:07).` : `"${last("words")}" is not in what is cut from ${partLabel(part)}.`);
    [from, to] = [places[0].start, places[0].end];
  } else {
    if (!flags.at) return refuse(ctx, 'Say what to keep: the words that were cut (--words "very important"), or the time on the timeline where they were cut (--at 12:30).');
    const got = timelineRead(ctx, found, part, flags);
    if (got.code !== undefined) return got.code;
    read = got.read;
    const t = secondsOf(last("at"));
    const raw = t === null || t > lengthOf(read.clock) + 1 ? null : rawAt(read.clock, Math.min(t, lengthOf(read.clock)));
    // A pushed file's clip starts on a frame, a little before its kept piece: a time on that frame is on the piece.
    if (raw !== null && !read.pieces.some((r) => raw >= r.start - FRAME_SLACK && raw <= r.end + 0.0005)) {
      // A time on what was kept when she watched it, and is cut now: the cut she asked for that took it out, the newest. A cut
      // takes the breath kept beside its phrases with it, so it is the one without which that time would be kept again.
      const tookOut = (c) => keptRanges({ plan: read.plan, cuts: cuts.filter((x) => x !== c), span: read.span }).some((r) => raw >= r.start - FRAME_SLACK && raw <= r.end + 0.0005);
      const since = [...cuts].reverse().find((c) => !c.keep && ((raw >= c.from && raw <= c.to) || tookOut(c)));
      if (!since) return refuse(ctx, momentOf({ time: last("at"), on: read.on, clock: read.clock, ranges: read.pieces, words: read.words }).why);
      [from, to] = [since.from, since.to];
    } else {
      // Otherwise the cut nearest it, by what is said there now: words cut, or kept again since.
      const now = cutPhrases(read.plan.phrases, cuts);
      const said = (c) => {
        const there = now.filter((p) => (p.start + p.end) / 2 > c.from && (p.start + p.end) / 2 < c.to);
        return { cut: there.filter((p) => !p.keep).map((p) => p.text).join(" "), kept: there.filter((p) => p.keep).map((p) => p.text).join(" ") };
      };
      const near = cutNear({ time: last("at"), on: read.on, clock: read.clock, edges: part === "main" ? { from: 0, to: read.plan.facts.duration } : read.span, said });
      if (near.why) return refuse(ctx, near.why);
      [from, to] = [near.cut.from, near.cut.to];
    }
  }
  if (read.span && (from < read.span.from || to > read.span.to)) return refuse(ctx, `That is outside Reel ${part.reel}'s stretch of the recording, ${clockText(read.span.from)} to ${clockText(read.span.to)}.`);
  const whole = cutSpan(read.plan.phrases, from, to);
  if (whole.why) return refuse(ctx, whole.why);
  const what = read.plan.phrases.filter((p) => whole.phrases.includes(p.id)).map((p) => p.text).join(" ");
  if (verb === "keep" && cutPhrases(read.plan.phrases, cuts).filter((p) => whole.phrases.includes(p.id)).every((p) => p.keep)) return refuse(ctx, `"${what}" is kept on ${partLabel(part)} already.`);
  const next = [...cuts, { id: nextId(cuts, "c"), keep: verb === "keep", from: whole.from, to: whole.to }];
  // A timeline that keeps nothing cannot be shown, and every time on it would be refused after: such a cut is refused.
  if (!keptRanges({ plan: read.plan, cuts: next, span: read.span }).length) return refuse(ctx, `That would take out all of ${partLabel(part)}. Say a shorter stretch.`);
  const reach = part === "main" ? " A cut on the main video does not reach a Reel over the same words." : "";
  return save(ctx, found, withPart(found.record, part, (t) => ({ ...t, cuts: next })), `${verb === "keep" ? "Kept in" : "Taken out of"} ${partLabel(part)}: "${what}" (${clockText(whole.from)} to ${clockText(whole.to)} of the recording, whole phrases, at a pause).${reach} ${SHOW_IT}`);
}

// --- Her answer to "what is this video?": kind, leave and which ---

/** How long `kind` waits in the foreground for the reading it started: Claude Code gives a command about two minutes, so a
    reading of under about 90 seconds is waited for, and a longer one posts a notice (spec 2026-10-22, section 2). */
export const READ_WAIT_MS = 90000;
/** How often `kind` looks for the reading's result while it waits. */
export const READ_POLL_MS = 1000;
/** The most a `kind` takes in the foreground, from the moment it starts: the wait for the claim and the wait for the reading
    together, so that a command that waited the claim's 20 seconds does not run into the two minutes Claude Code gives it. */
export const COMMAND_BUDGET_MS = 100000;

/** What she says a video is, and how the record keeps it: an iPhone clip is a "short video", as it always was, so that the
    places that test for one keep working. */
const ANSWER_KEPT = { finished: "finished", raw: "raw", clip: "short video", session: "session" };
/** What each kind is called to her, when she is told how a video is answered. */
const KIND_SAID = { finished: "finished by your editor", raw: "raw with retakes", "short video": "an iPhone clip", session: "a client or group session" };

/** What `kind` says when a correction keeps the HyperFrames project that was made for the kind `was` (architecture 4.8), by the kind
    `now` the video has become (as the record keeps it) and the video's `name`: the project is kept as it was; a raw video or an
    iPhone clip is told how to make a new one, a finished video that it is not edited in HyperFrames, and a session what happens to a
    project that holds its recording and its words. No path, flag or name of a command. */
function keptProjectWords(was, now, name) {
  const made = `Its HyperFrames project, made when it was answered as ${KIND_SAID[was]}, is kept as it was`;
  if (now === "finished") return `${made}. A finished video is not edited in HyperFrames.`;
  if (now === "session") return `${made}, and it holds the recording and its words: close it in HyperFrames, and ask Jason what to do with it.`;
  return `${made}. Say "${openInAppWords(name)}" to make a new one.`;
}

const BOTH_ANSWERS = "Say both answers: what it is, and whether it is a private session (--private yes or no).";
const ANSWERS_DISAGREE = "Those two answers disagree: say again whether it is a private session.";
const ASK_IF_SESSION = "Ask first whether it is a client or group session: it came from Zoom, or is sound alone. Then answer again with --not-a-session.";
/** Whether `kind` may answer the video called `name`, whose record is `record`, as `plan` says (R10, R11; design 2026-10-26, section
    5, "The card's receipt"): under Claude Code, on a Mac whose lock in effect is open, a video with no kind yet, waiting for her
    answer or left alone, is answered only when a receipt of the last hour holds her answers on the card (receipts.js), and with
    --not-a-session her answer on the not-a-session card too; a session, on her answer to either card. When it may not, it says
    NO_RECEIPT and the video's card, which her skill then asks, and nothing is written. In Terminal, on a strict Mac, and for a
    video answered already, no receipt is asked for. */
function receiptHeld(ctx, record, plan, name) {
  if ((ctx.deps.env || process.env).CLAUDECODE !== "1" || lockFor(ctx.settings, ctx.deps) !== "open" || recordKind(record) !== null) return true;
  const answer = record.answer !== null && typeof record.answer === "object" ? record.answer : {};
  const came = answer.came === "zoom" || answer.came === "sound" ? answer.came : null;
  const target = plan.target ? plan.target.record : null;
  const links = linksOf(ctx.root);
  const others = listedEpisodes(ctx, links);
  // The receipt is of the card this video's line prints, its first answer among it (Claude may word no part of it), and a new version
  // is only of the video its Maybe line offered, by its id: two videos may have one name, and the chat sees neither's (below).
  const card = cardFor(record, name, others, links);
  const maybe = maybeOf(record, others, links);
  const offeredTarget = !target || (maybe && maybe.record && maybe.record.id === target.id);
  // Her card names the video as `episodes` printed it, or as this command prints it, without the names of the video it found (ctx.say).
  const said = (text) => (ctx.hidden.names.length ? withoutNames(text, ctx.hidden.names, ctx.hidden.keep, { paths: false }) : text);
  const now = ctx.now();
  for (const spell of offeredTarget ? [(text) => text, said] : []) {
    const label = spell(name);
    const expected = expectedAnswers({ label, stored: plan.stored, maybeName: target ? spell(shownName(target)) : null, maybeKind: target ? recordKind(target) : null, notASession: plan.notASession, came, offered: spell(card.questions[0].options[0].label) });
    if (receiptWhy({ home: ctx.home, expected, now }) === "") return true;
    if (plan.stored === "session" && receiptWhy({ home: ctx.home, expected: sessionByFollowUp({ label, came }), now }) === "") return true;
  }
  ctx.say(NO_RECEIPT);
  for (const line of cardLinesFor(record, name, others, links, { notASession: plan.notASession })) ctx.say(line);
  return false;
}

/** Refuse `kind` for `why`, of the video called `name` whose record is `record`: when it says to ask first whether the video is a
    session, the card that asks it follows, by the video's label and how it came when the record says (R10). */
function refuseAnswer(ctx, name, record, why) {
  ctx.say(why);
  if (why === ASK_IF_SESSION) {
    const came = record.answer && typeof record.answer === "object" ? record.answer.came : null;
    ctx.say(`    Card if not a session: ${JSON.stringify(notSessionCardOf({ label: name, came: came === "zoom" || came === "sound" ? came : null }))}`);
  }
  return 1;
}
const MARK_STAYS = 'This was marked a client or group session. Clearing the mark needs your click on this Mac: say "clear the session mark".';
const SESSION_TARGET = "That video is a client or group session, so this new version is one too: answer it as a session.";
/** What `--clear-session` is refused in when the answer given is a session: a mark is cleared by saying what the video really is. */
const CLEAR_BY_KIND = "A session mark is cleared by answering what the video really is: finished, raw or clip.";
/** The sentence of the dialog that clears a session mark: its words are hers to read, and only her click on "Clear it" clears the
    mark. The dialog opens with the video's label on a line of its own and a blank line (clickedClear), so that she knows which. */
const CLEAR_DIALOG = "This was marked a client or group session. Clearing it lets Claude read its words and lets its transcript go to the BRIMM Ops page. Clear it?";
/** How long the dialog that clears a session mark stays open, in milliseconds: then it is closed and nothing is cleared. A person
    who never answers must not hold the command until Claude Code ends it, with the video claimed. */
export const DIALOG_MS = 60000;
/** What is said first when a clearing is refused or does not happen: the mark was not cleared. */
const NOT_CLEARED = "Not cleared:";
const DIALOG_TIMED_OUT = `${NOT_CLEARED} the dialog was not answered within a minute, so it was closed. The session mark stays.`;
const TOO_LATE = `${NOT_CLEARED} the dialog was open too long for this to finish in time. Say it again, and click within a minute.`;
/** What is said when this Mac's tool log cannot be written: the record holds what the line would have said (`holds`). */
const logNotWritten = (holds) => `The log on this Mac could not be written: the record holds ${holds}.`;
/** Why `--clear-session` has nothing to clear on the video `name`: it is no session, or its mark was cleared already. */
const noMarkToClear = (name) => `${name} has no session mark to clear.`;
/** Why a session not cleared cannot be cleared: its record holds no mark that can be read (the gate holds it all the same). */
const markUnreadable = (name) => `${name}'s session mark cannot be read: ask Jason.`;
/** Why a video whose import matched a session's words (matchedSession) is answered only as one. */
const MATCHED_SESSION = "This video holds most of the words of a client or group session: answer it as a session, or ask Jason.";
/** Whether the episode the import matched in the video of `record` (answer.match, an id, never the record's own) is a client or group
    session not cleared, or one of its other versions is, in its record or a conflicted copy (finish.js linksOf: holdsSession,
    sessionsBeside), as Episodes holds it now. The video of `record` is never counted among them: once it is a version of the match
    and marked a session itself, its own mark must not hold its clearing back (as sessionAmong leaves out the session being
    cleared). And for a clearing of its mark (`clearing`, with the video's own `folder`), a match among the video's own versions (the
    same first id) says nothing: each mark of a set is cleared by a click of its own, and the video cleared is then held as a session
    while another of them is marked (STILL_HELD). A match outside its own versions still counts. A match this Mac cannot read says
    nothing. */
function matchedSession(links, record, { clearing = false, folder = null } = {}) {
  const id = record.answer && typeof record.answer === "object" ? record.answer.match : null;
  if (typeof id !== "string" || id === record.id) return false;
  const match = links.find(id);
  if (!match) return false;
  if (clearing && links.firstOf(match.record, match.folder) === links.firstOf(record, folder)) return false;
  return links.holdsSession(match) || links.sessionsBeside(match.record, match.folder).some((one) => one.record.id !== record.id);
}
/** Why a video one of whose other versions is a client or group session not cleared is answered only as a session: `name` is the
    video being answered. */
const heldAnswer = (name) => `${name} is a version of a client or group session: answer it as a session too, or ask Jason. Nothing was written.`;
/** Why a video that is not a session cannot be a version of a video one of whose versions is (the whole set of versions, not only
    the one named): `name` is the video being answered. */
const sessionSet = (name) => `${name} would be a version of a client or group session: answer it as a session, or ask Jason. Nothing was written.`;
const ASK_FOR_TEACHINGS = "Ask her whether she wants its teachings (principles and Reel ideas) or the transcript only.";
/** What a clearing says when another version of the video is still a session not cleared: it is held as one meanwhile. */
const STILL_HELD = "Another version of it is still marked a client or group session, so it is held as one, and Claude reads nothing of it: once that mark is cleared too, say what it is again.";
const ONLINE_ONLY = "It is online-only on this Mac: Dropbox brings it over first, which may take a few minutes for a long video.";
const OFFLINE = "This Mac seems to be offline: the other Mac will not see that you have it until this one is back online.";

/** Why a raw video, `record`, is not read on this Mac without --here: its video is not here yet, and how large it is. The Mac to
    leave it for is the one that imported it, unless that is this one. */
function notHereYet(ctx, record) {
  const by = record.imported && typeof record.imported.on === "string" && record.imported.on && record.imported.on !== ctx.machine ? spokenMac(record.imported.on) : "the other Mac";
  return `${shownName(record)} is a raw video of ${sizeText(record.video.bytes)} that is not on this Mac yet: reading it here brings it all over first, which may take a while. Say "read it here" to go on, or leave it for ${by}.`;
}

/** Why the other Mac, `by`, stops `name` from being answered or left now. */
const beingAnswered = (name, by) => `${name} is being answered on ${by}. Nothing was changed.`;
/** What is said when the record changed under an answer that was being written: nothing more is done. */
const changedMeanwhile = (name) => `${name} changed meanwhile: say your answer again.`;

/** The lock `kind` and `leave` hold for an episode on this Mac, for the whole of their run: two answers for one video started
    on one Mac, the second inside the first's wait for Dropbox, would each find the claim this Mac wrote and go on. It is not
    the lock of a detached run (detached.js), which the reading it starts holds. */
const answerLockOf = (home, folder) => join(episodeWork(home, folder), "answer.lock");

/** Take the answer lock of the episode in `folder` for `command`: { file, text } to give back to releaseEpisodeLock, or null when
    another answer holds it. A lock whose run is gone (`ctx.alive`) is taken over; the lock of this very process is never gone. */
function takeAnswerLock(ctx, folder, command) {
  mkdirSync(episodeWork(ctx.home, folder), { recursive: true });
  const file = answerLockOf(ctx.home, folder);
  const took = takeEpisodeLock(file, command, (pid) => pid === process.pid || ctx.alive(pid));
  return took.taken ? { file, text: took.text } : null;
}

/** Why an answer cannot be written for the episode `name` now, as every command says it. */
const busyWhy = (name) => `Another answer for ${name} is being written on this Mac: say it again in a moment.`;

/** The episodes on this Mac, each { name, record }, by their records alone, as findEpisode knows them: the record in force, and
    none for an episode that has no whole record. */
function recordsHere(ctx) {
  return folders(ctx).map((name) => ({ name, record: episodeAt(ctx, name).inForce })).filter((e) => e.record && recordShaped(e.record));
}

/** When the import's late check will have been made of the episode with this `record`, in milliseconds, or null when nothing is
    holding it. This Mac owes the check (a pending one in its own folder, which has not found a problem): it is due at its time,
    or now when that has passed, since the import makes a check that is due within a minute. Or an import of the video is at
    work on either Mac, by its status: then the check is made at the latest LATE_CHECK_MS from now, since the video has been
    copied into its episode already. A check that found a problem, or an import that failed or stopped, does not clear by
    itself, and holds nothing here: the reading says why when it meets it. */
function lateCheckAt(ctx, record) {
  const now = ctx.now();
  const owed = readPendings(ctx.home).find((p) => p.id === record.id && p.machine === ctx.machine && resolve(String(p.root)) === resolve(ctx.root) && !p.problem);
  if (owed) return Math.max(dueAt(owed), now);
  const working = readStatuses(ctx.root, now).map((s) => s.status).find((s) => s && s.video === record.video.file && s.bytes === record.video.bytes && importState(s, now) === "running");
  return working ? now + LATE_CHECK_MS : null;
}

/** Why `kind` may not answer the episode `found` as `plan` says ({ stored, again, notASession, clearSession, versionOf, target })
    when its record is `record`, in plain words, or "". `kind` asks it when it has the record, again once the claim has waited, and
    `plan.target`, the video this is a new version of, is looked for the first time it is asked. In this order:
    - an answered video, without --again; a session not cleared, answered as anything but a session (which only --clear-session
      does, by her click on a dialog), or as one; and, with --clear-session, a video that has no session mark to clear (no session,
      or one whose mark is cleared already) or whose mark cannot be read. What the other Mac cleared after the record was read is
      met by the checks made again once she has clicked and once the claim has waited: a record written meanwhile is not the one she
      was asked about, and a clearing that reached the slot of this Mac's claim is met here, by "no session mark to clear";
    - a video that may be a session, answered as anything else without --not-a-session: one the import saw came from Zoom or is
      sound alone, a Zoom download by its file's name (a record from before the switch has no answer to say so), and one whose
      facts the import could not read, until she has answered it (her click on the dialog says it is not one);
    - a video held as a session (one of its other versions, as finish.js linksOf sessionsBeside reads them, is a session not
      cleared), answered as anything but a session, but by --clear-session of its own mark: it is answered only as a session;
    - --version-of: an answered video on this Mac that is not archived and is not this one, by id or short id (a short id two
      videos have is not taken for either); a session not cleared is a version of only by a session;
    - and, read from Episodes each time it is asked (finish.js linksOf), for that target, which is looked up again and checked as
      at first on a later call (it may be archived, unanswered or a session by then): it is not already a version of this video,
      directly or through others ("cannot be a version of"); its chain can be followed to its first (chainGapWords); and for an
      answer that is not a session, none of the versions of the video it starts from, earlier, later or beside it, and none of
      this video's own later versions, is a session not cleared (the gate's predicate, in the record or any conflicted copy of
      it); the version a handed-off video keeps is checked the same way. With --clear-session this video is left out of those
      sets: it is the session being cleared, and any other session in them still refuses a new link (--version-of); but the set the
      video is in already does not refuse a clearing, since each mark of it is cleared by a click of its own: the video cleared is
      then held as a session while another is marked (no reading starts, and no hand-off of it is written), until that mark is
      cleared too;
    - a video already handed off keeps the version it is of, and is given no other: the one it keeps may have been marked a session
      since, which a new answer that is not one cannot be a version of;
    - and a video that is not itself handed off, but that the chain of one handed off passes through, is given no other version
      (--version-of naming another video, or --again with none, which clears the one it has, as the walk follows it): that would
      move the id the handed-off video went to the page under, and is said of that video, the later one;
    - the other Mac's claim, and a detached run at work on the episode. */
function answerWhy(ctx, found, record, plan) {
  const name = namedAs(found, record);
  const { stored } = plan;
  const was = recordKind(record);
  if (was !== null && !plan.again) return `${name} is answered already: it is ${KIND_SAID[was]}. To change it, answer again with --again.`;
  // A video that has a kind and is gated is a session whose mark is not cleared. With --clear-session it has to be one, with a mark to
  // clear; without it, such a video can be answered only as a session (which it is) and never as another kind.
  if (plan.clearSession) {
    if (was === null || !gated(record)) return noMarkToClear(name);
    if (!record.session || typeof record.session !== "object" || Array.isArray(record.session)) return markUnreadable(name);
  } else if (was !== null && gated(record)) {
    if (stored !== "session") return MARK_STAYS;
    // A video answered as a session after it was read as another kind owes the BRIMM Ops page its empty session revision until it
    // is written (a gap in its versions, or this Mac handing off version 1, held it back): the same answer again writes it.
    if (!plan.again || !(revisionOwed(record) || sweepOwed(found.folder, record))) return `${name} is a client or group session already.`;
    // The same answer alone writes it: another link now would not be the one it is owed under.
    if (plan.versionOf || plan.unlink) return owedLinked(name);
    plan.owed = true;
  }
  const answer = record.answer;
  const came = answer ? answer.came : undefined;
  const maybe = came === "zoom" || came === "sound" || isZoomName(record.video.file) || (Boolean(answer) && came === null && answer.state !== "answered");
  if (maybe && stored !== "session" && !plan.notASession && !plan.clearSession) return ASK_IF_SESSION;
  // A target looked up by an earlier call is looked up again, and the same checks are made of it as Episodes holds it now: it may
  // have been archived, answered no more, or marked a session while the claim waited. Its spellings are then the ones it holds now.
  const earlier = Boolean(plan.target);
  if (plan.versionOf && !plan.target) {
    const id = plan.versionOf;
    const named = recordsHere(ctx).filter((e) => e.record.id === id || String(e.record.id).slice(-6) === id).filter((e) => recordKind(e.record) !== null && !e.record.archived);
    const exact = named.filter((e) => e.record.id === id);
    if (!exact.length && new Set(named.map((e) => e.record.id)).size > 1) return `More than one video on this Mac has the short id ${id}: say its whole id.`;
    const picked = exact[0] || named[0];
    if (picked && picked.record.id === record.id) return `${name} cannot be a version of itself.`;
    if (!picked) return `No answered video on this Mac has the id ${id}.`;
    if (stored !== "session" && gated(picked.record)) return SESSION_TARGET;
    plan.target = picked;
  }
  // What links the target to this video, and to a session, as Episodes holds it now: one reading, each time this is asked.
  const links = linksOf(ctx.root);
  // A video one of whose other versions is a session not cleared is held as one (spec 1 forbids writing into another version's
  // folder, so the mark cannot follow it there): it is answered only as a session itself, until that mark is cleared.
  if (stored !== "session" && !plan.clearSession && links.sessionsBeside(record, found.folder).length) return heldAnswer(name);
  // A video whose import found most of the words of a video since marked a session, or of a version of one, in it (answer.match)
  // holds that session's words: it is answered only as a session (her card says it may be one).
  // A clearing is let through for a match among the video's own versions only when it keeps the link it has: --version-of none, or
  // another video, would take it out of them, and its match's session would then hold it no more.
  if (stored !== "session" && matchedSession(links, record, { clearing: plan.clearSession && !plan.target && !plan.versionOf && !plan.unlink, folder: found.folder })) return MATCHED_SESSION;
  // Whether some episode among `members` is a client or group session not cleared, by its record or any conflicted copy of it. The
  // session being cleared is not counted among them, its conflicted copies included: it is the one that is being cleared.
  const sessionAmong = (members) => members.some((one) => !(plan.clearSession && one.record.id === record.id) && links.holdsSession(one));
  if (plan.target && earlier) {
    const now = links.find(plan.target.record.id);
    if (!now || recordKind(now.record) === null || now.record.archived) return `No answered video on this Mac has the id ${plan.versionOf}.`;
    if (stored !== "session" && gated(now.record)) return SESSION_TARGET;
    plan.target = { ...plan.target, record: now.record };
  }
  if (plan.target) {
    const target = (links.find(plan.target.record.id) || plan.target).record;
    const targetName = shownName(target);
    if (links.chainOf(target).some((link) => link.record.id === record.id)) return `${name} cannot be a version of ${targetName}: ${targetName} is already a version of it.`;
    // A chain that loops or runs to an episode not on this Mac cannot be read to its first, and what it holds is not known.
    const gap = links.gapOf(target);
    if (gap) return chainGapWords(target, gap);
    // The video joins the versions of the target's first, and so do its own later versions, if it has any.
    if (stored !== "session" && (sessionAmong(links.setOf(links.firstOf(target)).members) || sessionAmong(links.throughOf(record.id).filter((one) => one.record.id !== record.id)))) return sessionSet(name);
  }
  // The video it is a version of once this answer is written: the one --version-of names; none with --version-of none; and with
  // neither, the one an answered video has (it keeps it, and its set is checked again below), or none for a first answer.
  const linked = was !== null ? record.versionOf || null : null;
  const keeps = was !== null && !plan.target && !plan.unlink;
  const after = plan.target ? plan.target.record.id : keeps ? linked : null;
  // A video already handed off to the BRIMM Ops page keeps its place there: its id never changes across revisions (spec 8), so it
  // is given no other version, and none (--version-of none) is refused it too, unless it is a version of none already.
  const handed = handedOff(found.folder, record);
  if (handed && ((plan.unlink && record.versionOf) || (plan.target && plan.target.record.id !== (record.versionOf || null)))) {
    const older = recordsHere(ctx).find((e) => e.record.id === record.versionOf);
    const place = record.versionOf ? `a version of ${older ? shownName(older.record) : `an episode (${String(record.versionOf).slice(-6)})`}` : "a video of its own";
    return `${name} has already gone to the BRIMM Ops page as ${place}: ask Jason.`;
  }
  // The version it keeps is checked as a target is, for an answer that is not a session: the video it names is no session, its
  // versions do not name each other, none of the versions of the video it starts from is a session (the one being cleared left
  // out), and it did not go to the page under another id than its versions lead to now.
  if (keeps && linked && stored !== "session") {
    const kept = recordsHere(ctx).find((e) => e.record.id === linked);
    if (kept && gated(kept.record) && !plan.clearSession) return SESSION_TARGET;
    const gap = links.gapOf(record, found.folder);
    if (gap && gap.reason === "loop") return chainGapWords(record, gap);
    if (!plan.clearSession && sessionAmong(links.setOf(links.firstOf(record, found.folder)).members)) return sessionSet(name);
    const moved = movedIdWords(ctx.root, found.folder, record);
    if (moved) return moved;
  }
  if (!handed && after !== linked) {
    // So does every video that the chain of a handed-off video passes through, though it is not handed off itself: another version
    // for it, or none, moves the id that later video went to the page under. Only a link that changes is refused, the link the
    // walk follows (the link of an unanswered video is not followed).
    const through = links.handedOffThrough(record.id).find((one) => one.record.id !== record.id);
    if (through) return `${shownName(through.record)} has already gone to the BRIMM Ops page as a version of ${name}: ask Jason.`;
  }
  const held = heldElsewhere(record, ctx.machine);
  if (held) return beingAnswered(name, held.by);
  const running = runningCommand(ctx.home, found.name, ctx.alive);
  if (running) return `${running} is running for ${calledAs(ctx, found)} already. Say it again when it has finished.`;
  return "";
}

/** `kind "<video>" finished|raw|clip|session --private yes|no [--version-of <id>|none] [--not-a-session] [--again] [--clear-session]`:
    her answer to "what is this video?" (spec 2026-10-22, section 2). Both answers are needed, and they agree: a session with yes,
    anything else with no. It holds the answer lock of the episode for its whole run (takeAnswerLock), reads the record under it,
    and in order (answerWhy says why not):
    - the checks of answerWhy, which read the record and the Macs, and refuse an answered video, a session not cleared, a video
      that may be a session, a --version-of that names no video it can or a video that is already a version of this one, or
      one whose versions hold a session not cleared (unless this is one), a video already handed off that would be given
      another version, and one that the chain of a handed-off video passes through (the same), the other Mac's claim, and a
      run at work;
    - with --clear-session, which clears a session mark by saying what the video really is (never "session"), a dialog on this
      Mac, which Claude cannot press, naming the video: the video is claimed and written only if she clicks "Clear it", and Cancel,
      or any answer but that click, or none within DIALOG_MS, writes nothing (clickedClear). Her click may come long after the
      record was read, so the record is read again and the checks of answerWhy are made again before anything is written, and a
      click so late that the claim's wait would not finish within the command's time (COMMAND_BUDGET_MS) clears nothing
      (clearedAfterClick). Any refusal after her click says first that it was not cleared, and lets this Mac's claim go again if
      it had written one;
    - the video is claimed as `open` does: the claim is written, Dropbox is given CLAIM_WAIT_MS, and the record is read again,
      so that two Macs cannot answer it at once. It must be the claim this command wrote, no other record on top of it, and
      the checks are made again on it, right before the answer is written;
    - a video answered before is being corrected (spec 2, "Correcting a wrong answer"): what its earlier reading and its hand-off left
      in the shared folder (earlierFiles) must be on this Mac and whole first, read through when it is not, before she is asked
      anything or it is claimed, and again once the claim has waited; a file the record lists that Dropbox has not brought over yet
      holds it back until it has;
    - the answer is one write: its kind, who answered, where and when, whether it is private, the video it is a version of (and
      that video's spellings, which she confirmed there), and for a session its mark and its name, which is its label, so that
      nothing made from the name holds a client's. An answered video keeps the video it is a version of unless --version-of names
      another, or none (`--version-of none`, which a video handed off is refused unless it is a version of none already); a first
      answer with no --version-of is a version of none. A correction is the same write (setAsideWritten): the earlier reading's files,
      a session's teachings files and the hand-off with final/'s text files (every file of final/ for a session, but a session's own
      hand-off) are set aside into history/ by the rule, the rules' plan of a raw video put back, the reading and the finish let go;
      answered again as a session, the video is given at once its empty session revision (emptyRevisionOf), or it is owed, and the
      same answer again writes it (emptyRevisionAgain). The claim stays on the record, so that the reading runs under it, except a
      session's, which is let go in the same write: no reading runs under it, and the other Mac must not be kept from it. A
      mark cleared is the same write: the session mark as it was with `cleared` on it ({ at, on, to, confirmed: "dialog" }),
      and then one line in this Mac's tool log (toolLog);
    - the reading is started detached (`read`, given the kind and the rev the answer's record holds, so that its run can refuse
      a record that no longer says them), for every kind but a session, whose reading starts with its teachings, unless this
      Mac's settings say readings are off: the answer is kept, since the gate runs on it. The record is read once more first, and
      must still be the answer. A raw video's reading waits for the import's late check, so it is not waited for here; any other is
      waited for, up to READ_WAIT_MS and COMMAND_BUDGET_MS from when this began, and what it found is said as `status` says a
      result, or else a notice will come;
    - and right after the reading, for a raw video and an iPhone clip whose video is whole on this Mac, the working copy of the
      video is asked for (workcopy.js requestWorkCopy): its detached run, `workcopy`, which makes the video HyperFrames is given
      to edit. It has a lock of its own, so it runs beside the reading and is not waited for, and a request while a run of it is
      at work starts none. It is asked for at once, even while the reading waits for the import's late check: the run waits for
      that check itself (waitForImport), as the reading does, before it makes the copy. It is asked for only when it will be used
      (copyWanted): on a Mac whose settings turn the app on, and
      when the record this wrote has no main project in use, since that project's writer moved the copy into it. A project kept
      for the earlier kind in this very answer is not in use, so a change of kind asks for a new copy. A finished video, a
      session, a video not whole on this Mac, a Mac whose app is off and a Mac whose readings are off start none; `app` asks for
      the copy when `kind` could not. Nothing of it is said here: "how far is it?" says it.
    A video answered as anything but a session is no longer one whose names are kept from the chat. */
export async function kindCommand(ctx, rest) {
  const began = ctx.now();
  const { say } = ctx;
  const { words, flags } = flagsOf(rest, ["private", "version-of"]);
  const asked = String(words[words.length - 1] || "").toLowerCase();
  const given = Array.isArray(flags.private) && flags.private.length === 1 ? String(flags.private[0]).toLowerCase() : "";
  if (!Object.hasOwn(ANSWER_KEPT, asked) || !["yes", "no"].includes(given)) {
    say(BOTH_ANSWERS);
    return 2;
  }
  const clearSession = Boolean(flags["clear-session"]);
  if (clearSession && asked === "session") return refuse(ctx, CLEAR_BY_KIND);
  if ((asked === "session") !== (given === "yes")) return refuse(ctx, ANSWERS_DISAGREE);
  const versionOf = flags["version-of"];
  if (versionOf && (versionOf.length !== 1 || !versionOf[0].trim())) {
    say("Say the id of the video this is a new version of.");
    return 2;
  }
  // `--version-of none` says it is a version of no video: an answered video keeps the one it has otherwise.
  const unlink = Boolean(versionOf) && versionOf[0].trim().toLowerCase() === "none";
  const got = episodeFor(ctx, words.slice(0, -1), { newerEnds: 1 });
  if (!got.found) return got.code;
  const lock = takeAnswerLock(ctx, got.found.name, "kind");
  if (!lock) return refuse(ctx, busyWhy(shownName(got.record)));
  try {
    return await answerKind(ctx, got.found, { stored: ANSWER_KEPT[asked], given, again: Boolean(flags.again), notASession: Boolean(flags["not-a-session"]), clearSession, versionOf: versionOf && !unlink ? versionOf[0].trim() : "", unlink, here: Boolean(flags.here), target: null }, began);
  } finally {
    releaseEpisodeLock(lock.file, lock.text);
  }
}

/** Show the dialog `text` with `options` (dialog.js askDialog's) and wait for her, for DIALOG_MS at most: { answer, outOfTime }. The
    dialog is shown by this Mac's own `run`, as every program edit.js runs is: no flag or setting stands in for it. It is run
    with that limit, which kills osascript and so closes the dialog, and when the run says it was out of time `outOfTime` is true
    and nothing it printed counts, whatever `answer` makes of it. A person who never answers must not hold the command until
    Claude Code ends it. */
async function askHere(ctx, text, options) {
  let outOfTime = false;
  const run = async (cmd, args, opts) => {
    const done = await (ctx.deps.run || runProgram)(cmd, args, { ...opts, limit: DIALOG_MS });
    if (done && done.outOfTime === true) outOfTime = true;
    return done;
  };
  const answer = await askDialog(text, { ...options, run });
  return { answer, outOfTime };
}

/** Ask her, on a dialog Claude cannot press, to clear the session mark of the video called `label`, and say whether she did: true
    only for her click on "Clear it". The dialog and the line before it name the video by its label, so that two dialogs, or a
    label misread, cannot clear another. Cancel, Escape and a dialog that could not be shown or read are not a click (askDialog
    never says a button that was not clicked), and each is said as "Not cleared", with why when the dialog gave a reason. So is a
    dialog not answered within DIALOG_MS, which askHere closes. Every ending says a line of its own, after the first: the skill
    that tells her a dialog is about to open never passes that line on. She is told first to click, since Return presses Cancel. */
async function clickedClear(ctx, label) {
  ctx.say(`A dialog is open on this Mac for ${label}: click "Clear it" to clear its session mark, or Cancel.`);
  const { answer, outOfTime } = await askHere(ctx, `${label}\n\n${CLEAR_DIALOG}`, { buttons: ["Cancel", "Clear it"] });
  if (outOfTime) {
    ctx.say(DIALOG_TIMED_OUT);
    return false;
  }
  if (answer && answer.button === "Clear it") return true;
  const why = answer && answer.button === null && typeof answer.why === "string" ? answer.why : "";
  ctx.say(why ? `${NOT_CLEARED} ${why} The session mark stays.` : `${NOT_CLEARED} the session mark stays.`);
  return false;
}

/** Why a clearing may not go on once she has clicked "Clear it" on the record `record` that she was asked about, in plain words,
    or "": the record is read again, and must still be that one (a record written meanwhile, by the other Mac or by this one, is
    not the one she was asked about), and the checks of answerWhy are made again on it, since a run may have started, or a video
    this one is to be a version of may have been marked a session, while the dialog was open. A click so late that the claim's wait
    could not finish within the command's time (`began` is when it began) clears nothing, when this Mac must still claim. */
function clearedAfterClick(ctx, found, record, plan, began) {
  const now = readEpisode(found.folder);
  if (!now.record) return notRead(ctx, { ...found, read: now });
  if (now.newer) return newerWhy(now.record);
  if (now.record.rev !== record.rev) return changedMeanwhile(shownName(record));
  const why = answerWhy(ctx, found, now.record, plan);
  if (why) return why;
  const holds = record.editing && record.editing.by === ctx.machine;
  return !holds && ctx.now() - began + CLAIM_WAIT_MS > COMMAND_BUDGET_MS ? TOO_LATE : "";
}

/** Add `line` to this Mac's tool log, ~/Library/Logs/brimm-video.log, the file detached runs write to (spawnDetached); its folder
    is made when it is missing. A line names an episode by its id and its label, never by its file, and quotes no word of it. A log
    that cannot be written does not fail the command (the record holds what the line says as well, `holds` says what): she is
    told so, once. */
function toolLog(ctx, line, holds = "the clearing") {
  const file = join(ctx.home, "Library", "Logs", "brimm-video.log");
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${line}\n`, { flag: "a" });
  } catch (e) {
    ctx.say(logNotWritten(holds));
  }
}

/** Let go the claim this command wrote, when it must stop after her click: `claim` is the record as it stands, and the claim is let
    go only while it is this Mac's, in one write by the rule (as `kind` lets go a session's, `editing: null`), so that a clearing
    that did not happen leaves the session as it was, and nobody holding it. A write that fails says why, as every write does. */
async function letGoClaimWritten(ctx, found, claim) {
  if (!claim.editing || claim.editing.by !== ctx.machine) return;
  await save(ctx, { ...found, record: claim }, { ...claim, editing: null }, "");
}

/** What `kind` does once it holds the answer lock of the episode `found`: see kindCommand. */
async function answerKind(ctx, found, plan, began) {
  const { say } = ctx;
  const { stored, given } = plan;
  // Once she has clicked "Clear it", whatever stops the clearing says first that nothing was cleared.
  const stop = (why) => (plan.clearSession ? `${NOT_CLEARED} ${why}` : why);
  const read = readEpisode(found.folder);
  if (!read.record) {
    say(notRead(ctx, { ...found, read }));
    return 1;
  }
  if (read.newer) {
    say(newerWhy(read.record));
    return 1;
  }
  const { record } = read;
  const name = namedAs(found, record);
  const why = answerWhy(ctx, found, record, plan);
  if (why) return refuseAnswer(ctx, name, record, why);
  if (!receiptHeld(ctx, record, plan, name)) return 1;
  // A session that owes the BRIMM Ops page its empty revision: the same answer again writes it, and nothing else.
  if (plan.owed) return emptyRevisionAgain(ctx, found, record);
  // A raw reading needs the video itself for the rough cut. On a Mac it is not whole on (the one that did not import it), that
  // brings it all over first: only with --here, her "read it here". Otherwise nothing is written or claimed, so that the other Mac
  // may answer it (spec 2, "Which Mac reads it").
  if (stored === "raw" && !plan.here && ctx.settings.readings !== false && !ctx.isWhole(join(found.folder, record.video.file))) return refuse(ctx, notHereYet(ctx, record));
  // A video answered before is being corrected: what its earlier reading and its hand-off left in the shared folder is set aside
  // with the answer, and must be whole on this Mac first (read through when it is not), before she is asked anything or it is
  // claimed.
  const correcting = recordKind(record) !== null;
  if (correcting) {
    const earlier = earlierFiles(found.folder, record, { session: stored === "session" }).rels;
    await broughtOver(ctx, found, earlier.filter((rel) => existsSync(join(found.folder, rel))));
    // A correction to a session is written at once, so that the gate holds the video at once: what is not here yet is owed (below).
    if (stored !== "session" && notReady(ctx, found, earlier).length) return refuse(ctx, comingWhy(ctx, found, name));
  }
  // A session mark is cleared only by her click: asked after the checks and before the claim, so that Cancel writes nothing at all.
  // Her click may come long after the record was read: it is read again and checked again before the claim, or, when this Mac has
  // the claim already, before the write.
  if (plan.clearSession) {
    if (!(await clickedClear(ctx, name))) return 1;
    const late = clearedAfterClick(ctx, found, record, plan, began);
    if (late) return refuse(ctx, late === TOO_LATE ? late : stop(late));
  }
  // The claim, as open makes it. The record read again is the one the answer is written on. A clearing that stops here says first
  // that nothing was cleared, and lets go of the claim it wrote when a record was written on top of it.
  let base = record;
  if (!record.editing || record.editing.by !== ctx.machine) {
    const claim = await claimAndWait(ctx, found, record, { again: "Say your answer again.", held: (by) => beingAnswered(name, by), changed: changedMeanwhile(name), said: stop, ...(plan.clearSession ? { onChanged: (on) => letGoClaimWritten(ctx, found, on) } : {}) });
    if (!claim.record) return claim.code;
    base = claim.record;
    const late = answerWhy(ctx, found, base, plan);
    if (late) {
      if (plan.clearSession) await letGoClaimWritten(ctx, found, base);
      return refuseAnswer(ctx, name, base, stop(late));
    }
  }
  // What a correction sets aside, as the folder holds it now that the claim has waited: every file whole here still. To a session,
  // only what is here and whole: a file the record lists that is not stays listed, owed, and the same answer again sweeps it once
  // Dropbox has brought it (sweepOwed, emptyRevisionAgain).
  const listedAside = correcting ? earlierFiles(found.folder, base, { session: stored === "session" }) : null;
  const owed = listedAside && stored === "session" ? notReady(ctx, found, listedAside.rels) : [];
  const aside = listedAside ? { ...listedAside, rels: listedAside.rels.filter((rel) => !owed.includes(rel)) } : null;
  if (aside && notReady(ctx, found, aside.rels).length) {
    if (plan.clearSession) await letGoClaimWritten(ctx, found, base);
    return refuse(ctx, stop(comingWhy(ctx, found, name)));
  }
  const at = localStamp(new Date(ctx.now()));
  const answer = { guess: null, seen: "", came: null, ...base.answer, state: "answered", by: ctx.machine, on: ctx.machine, at, private: given };
  const next = { ...base, kind: stored, answer };
  // A correction that changes the kind keeps the HyperFrames project made for the earlier kind, in the record that changes it
  // (architecture 4.8): the main project in use is marked as made for that kind, so `app` no longer takes it for the main one and
  // makes a new one. Nothing on disk is moved or removed here, and the same kind again changes nothing.
  const kindWas = recordKind(base);
  const keeps = kindWas !== null && kindWas !== stored && (base.app?.projects ?? []).some(inUse);
  if (keeps) next.app = { ...base.app, projects: base.app.projects.map((p) => (inUse(p) ? { ...p, state: PROJECT_KEPT } : p)) };
  if (plan.clearSession) next.session = { ...base.session, cleared: { at, on: ctx.machine, to: stored, confirmed: "dialog" } };
  if (!handedOff(found.folder, base)) {
    // An answered video keeps the video it is a version of unless her answer names another, or none (--version-of none).
    next.versionOf = plan.target ? plan.target.record.id : correcting && !plan.unlink ? base.versionOf || null : null;
    if (plan.target) {
      const own = base.spellings || [];
      next.spellings = [...(plan.target.record.spellings || []).filter(([heard]) => !own.some(([h]) => h === heard)), ...own];
    }
  }
  // Corrected, the earlier reading and its hand-off are let go with their files: the reading, so that the new one may run (one
  // reading for each answer); the finish, whose hand-off is in history/ now, so that `spell` and `finish` do not act on it; the
  // Reel suggestions of the list set aside; and version 0, whose timeline is set aside (its render stays on this Mac).
  if (aside) {
    if (base.reading !== undefined) next.reading = null;
    next.finished = null;
    next.reels = (base.reels || []).filter((reel) => !(reel.status === "candidate" && aside.reels.has(reel.n)));
    next.main = { ...base.main, pushed: (Array.isArray(base.main.pushed) ? base.main.pushed : []).filter((p) => !(p.how === "render" && aside.rels.includes(p.file))) };
  }
  let empty = null;
  if (stored === "session") {
    const taken = recordsHere(ctx).filter((e) => e.record.id !== record.id && (e.record.kind === "session" || e.record.session)).map((e) => (e.record.name && e.record.name.text) || "");
    next.session = { marked: at, on: ctx.machine, teachings: null, cleared: null };
    next.name = { text: sessionLabel(record.video.recorded, taken), placeholder: false };
    next.editing = null;
    // A video read as another kind, answered now as a session: its words have gone to Claude, and the BRIMM Ops page is given at once
    // an empty session revision, which redacts what it had (spec 2, "A session answered as something else"). It is judged with the
    // record as it is to be written, its last finish still on it for the version of the hand-off on file.
    if (aside) {
      empty = emptyRevisionOf(ctx, found, { ...next, finished: base.finished }, at, { gone: readBefore(found.folder, base, { rels: listedAside.rels, restored: aside.restore.length > 0 }) });
      next.session.emptyRevision = empty.handoff ? empty.revision : "owed";
      if (empty.handoff) next.finished = empty.finished;
    }
  }
  // A session's words, and the words of a video becoming one, name no file and no folder even when its files cannot be set aside.
  // A clearing that cannot be written, after her click, says first that it was not cleared, and lets go the claim it holds, so that
  // the session stays as it was, held by nobody.
  const said = plan.clearSession ? { ...ctx, say: (line) => ctx.say(`${NOT_CLEARED} ${line.replace(/^Nothing was changed: /, "")}`) } : ctx;
  const written = aside ? await setAsideWritten(said, found, base, next, aside, empty && empty.handoff, { quiet: stored === "session" || gated(base), session: stored === "session" }) : { code: await save(said, { ...found, record: base }, next, ""), stayed: [] };
  if (written.code !== 0) {
    if (plan.clearSession) {
      const now = readEpisode(found.folder);
      if (now.record && now.record.rev === base.rev) await letGoClaimWritten(ctx, found, now.record);
    }
    return 1;
  }
  if (aside) forgetComing(ctx, found);
  if (stored === "session") {
    // A video read as another kind, answered now as a session, is a session after all: every chat begun before now may have been
    // shown its words, and is held (held.js; design 2026-10-26, R9). Noted with the time after the write; one that cannot be
    // written is noted at the next read of the record (noteSessionsAfterAll), later.
    if (next.session.emptyRevision !== undefined) {
      try {
        noteAfterAll({ home: ctx.home, id: next.id, revision: next.session.emptyRevision, at: new Date(ctx.now()).toISOString() });
      } catch (e) {
        // Noted at the next read.
      }
    }
    // It is a session from now on: nothing the command says after this holds the names it had. Its other versions are held as
    // sessions from now on too, and she is told which she must answer as one (sayVersionsToMark).
    hideNames(ctx, episodeAt(ctx, found.name));
    const shown = !(empty && empty.handoff) || (await showInFinder(ctx, { record: next, label: next.name.text, path: join(found.folder, empty.handoff.rel) }));
    say(`${next.name.text}: marked a client or group session. ${ASK_FOR_TEACHINGS}`);
    if (empty) sayEmpty(ctx, next.name.text, empty, written.stayed, shown);
    if (!shown) say(cantOpen(next.name.text));
    if (owed.length) say(owedWords(next.name.text));
    if (keeps) say(keptProjectWords(kindWas, stored, next.name.text));
    sayVersionsToMark(ctx, found, next);
    return 0;
  }
  if (plan.clearSession) {
    const becomes = KIND_SAID[stored];
    say(`${name}: the session mark is cleared, by your click. It is now ${becomes}.`);
    toolLog(ctx, `${at} ${base.id} (${name}): the session mark was cleared by a click on this Mac's dialog; it is now ${becomes}.`);
  }
  if (aside && aside.rels.some((rel) => rel.startsWith("final/") && rel.endsWith(".brimm-ops.json"))) say(handoffAside(name));
  if (written.stayed.length) say(stayedWords(name, whatsInFinal(written.stayed)));
  if (keeps) say(keptProjectWords(kindWas, stored, name));
  // A mark cleared while another of its versions is still marked: it is held as a session, its names stay out of the chat, and
  // Claude reads nothing of it.
  if (plan.clearSession && linksOf(ctx.root).sessionsBeside(next, found.folder).length) {
    say(STILL_HELD);
    return 0;
  }
  // Answered as anything else, its names are no longer kept from the chat: it is named by its folder and its files as any episode is.
  if (ctx.hidden) {
    ctx.hidden.names.length = 0;
    ctx.hidden.keep.length = 0;
  }
  if (ctx.settings.readings === false) {
    say(`${name}: answered. Readings are off on this Mac: ask Jason.`);
    return 0;
  }
  // Right before the reading is started the record is the answer written, and nothing is at work on the episode.
  const wrote = readEpisode(found.folder);
  if (!wrote.record || wrote.record.rev !== base.rev + 1 || wrote.record.kind !== stored) {
    say(changedMeanwhile(name));
    return 1;
  }
  const running = runningCommand(ctx.home, found.name, ctx.alive);
  if (running) {
    say(`${name}: answered, but ${running} is running for it, so Claude's reading was not started. Say your answer again with --again when it has finished.`);
    return 1;
  }
  const previous = readResult(ctx.home, found.name, "read");
  const holdsUntil = stored === "raw" ? lateCheckAt(ctx, wrote.record) : null;
  startDetached(ctx, { command: "read", folder: found.name, args: ["--kind", stored, "--rev", String(wrote.record.rev)] });
  // The video HyperFrames is given to edit is made beside the reading, once, for a raw video and an iPhone clip whose video is whole
  // on this Mac (architecture 2026-10-27, 5.7), when it will be used (copyWanted). It takes a lock of its own, so it does not wait
  // for the reading, and a request while a run of it is at work starts none. It is asked for at once, whether or not the import's
  // late check of the video is still to come: its run waits for that itself (waitForImport). A video not here yet is made into one by
  // `app`, which asks for it when it is not there.
  if (copyWanted(ctx, stored, wrote.record) && ctx.isWhole(join(found.folder, wrote.record.video.file))) requestWorkCopy(ctx, { folder: found.name });
  if (holdsUntil !== null) {
    say(`Answered. Claude reads it at ${clockAt(holdsUntil)}, when the import has checked its copies.`);
    return 0;
  }
  return waitForReading(ctx, found, name, previous, began);
}

// --- Correcting a wrong answer (spec 2026-10-22, section 2, "Correcting a wrong answer"; section 1, "Episodes imported before this
// design") ---

/** What is said while a file a correction sets aside is not on this Mac, or not whole, once it was read through. */
const asideComing = (name) => `Dropbox is still bringing ${name}'s earlier files over to this Mac: say your answer again in a minute. Nothing was changed.`;
/** What a correction to a session says of the files it owes: they were not here to set aside, and the same answer again does. */
const owedWords = (label) => `Dropbox is still bringing some of ${label}'s earlier files over to this Mac: say your answer again in a minute, and they are set aside too.`;
/** The note on this Mac that a correction of the episode `found` was refused once for a file not here (comingWhy). */
const comingNote = (ctx, found) => join(episodeWork(ctx.home, found.name), "aside-coming");

/** Why a correction of the video `name` waits for a file Dropbox has not brought (asideComing): after the first such refusal on this
    Mac, it says to ask Jason if it does not come, since a file gone for good never will. Which it is is noted on this Mac's own disk,
    never in the episode, and the note goes once a correction or a sweep is written (forgetComing). */
function comingWhy(ctx, found, name) {
  const note = comingNote(ctx, found);
  if (existsSync(note)) return `${asideComing(name)} Ask Jason if it does not come.`;
  try {
    mkdirSync(dirname(note), { recursive: true });
    writeFileSync(note, "");
  } catch (e) {
    // Said the first time again, next time.
  }
  return asideComing(name);
}

/** Forget that a correction of the episode `found` waited for a file (comingWhy): it is written. */
function forgetComing(ctx, found) {
  try {
    rmSync(comingNote(ctx, found), { force: true });
  } catch (e) {
    // It says to ask Jason a time early, next time.
  }
}
/** What is said when a correction set a hand-off aside from final/ (spec 2: "the next one written is the next revision"). */
const handoffAside = (name) => `${name}'s hand-off is set aside in history/: the next one written is its next revision.`;
/** What is said, naming no file and no folder, when a session's files could not be set aside: `code`, the error's. */
const asideFailed = (code) => `Nothing was changed: its earlier files could not be set aside in history/ (${code}).`;
/** What is said of the files that stayed in final/ after a correction, by what each is (`whats`), never by name. */
const stayedWords = (name, whats) => `${name}: ${listed(whats)} stayed in final/: ${whats.length === 1 ? "it" : "they"} could not be taken out. Tell Jason.`;
/** The spec's words to her when a video read as another kind is answered as a session. */
const WORDS_GONE = "Its words have already gone to Claude: drop the new revision on the BRIMM Ops page and tell Jason.";
/** Said after the words of an empty revision not written, when nothing stayed in final/. */
const OUT_OF_SHARED = "Its files are out of the shared folder.";
/** What is said of a session's empty revision (emptyRevisionOf), named by its label: written; waiting for an earlier version, or
    for versions that name each other (`gap`, as chainGap gives it); refused by handoffTarget for another reason (`why`, its words);
    held back by a hand-off of its own under another id (`id`); and on a Mac that hands off version 1. */
const emptyWritten = (label, n, gone = true, shown = true) => (shown
  ? `The empty session revision of ${label} is written as revision ${n} and shown in Finder${gone ? `. ${WORDS_GONE}` : ": drop it on the BRIMM Ops page."}`
  : `The empty session revision of ${label} is written as revision ${n}.${gone ? ` ${WORDS_GONE}` : ""}`);
const emptyWaits = (label, gap) => (gap.reason === "loop" ? `The empty session revision of ${label} waits: its versions name each other: tell Jason.` : `The empty session revision of ${label} waits for its earlier version (${gap.id}), which is not on this Mac yet: tell Jason.`);
const emptyRefused = (label, why) => `The empty session revision of ${label} is not written: ${String(why).replace(/ Nothing was written\.$/, "")}`;
const emptyElsewhere = (label, id) => `The empty session revision of ${label} is not written: ${label} went to the BRIMM Ops page under ${id} too: ask Jason.`;
const emptyV1 = (label) => `The empty session revision of ${label} is written once this Mac hands off version 2: ask Jason.`;
/** Why `--version-of` is refused on a session that owes its empty revision: the same answer alone writes it. */
const owedLinked = (label) => `The empty session revision of ${label} is still owed: say it again without --version-of.`;

/** Whether a session still owes the BRIMM Ops page its empty revision: `kind … session --again` marked it "owed" (session.emptyRevision)
    when it could not write it, and no hand-off has been written for it since (record.finished: its own finish writes a session
    revision too). */
const revisionOwed = (record) => record.session !== null && typeof record.session === "object" && record.session.emptyRevision === "owed" && !record.finished;

/** Whether a session answered so after it was read as another kind (it has `session.emptyRevision`) still owes a sweep of final/: a
    file its record lists there, or one there, that is no session's own hand-off (earlierFiles, finalOnly), as one that Dropbox had
    not brought when it was answered, or brought since. The same answer again sweeps it (emptyRevisionAgain). */
const sweepOwed = (folder, record) => record.session !== null && typeof record.session === "object" && !Array.isArray(record.session) && record.session.emptyRevision !== undefined
  && earlierFiles(folder, record, { session: true, finalOnly: true }).rels.length > 0;

/** Whether a file, by its name or its path, is one a reading of Claude's writes: Claude's notes, the Reel suggestions (reels.json and
    the copy she reads) or a session's teachings. A set-aside copy in history/ ("<stamp> <name>") is one too. */
const readingFile = (rel) => /(?:^|[/ ])reels\.json$|\.(?:edit-notes|reel-suggestions)\.txt$|\.principles\.json$/.test(rel);

/** Whether Claude has read the video of `record`, in the episode's `folder`: its record holds a reading, or held one that a
    correction let go (null); or the files of one are among `rels` (those set aside now, and those owed: listed, and not here yet),
    or the record lists them, or they were set aside into its history/ before; or `restored` (the rules' plan put back, which a raw
    reading's plan had replaced). Only then do its words say they have gone to Claude. */
function readBefore(folder, record, { rels = [], restored = false } = {}) {
  const listedFiles = record.files !== null && typeof record.files === "object" ? Object.keys(record.files) : [];
  if (record.reading !== undefined || restored || [...rels, ...listedFiles].some(readingFile)) return true;
  try {
    return readdirSync(join(folder, "history"), { recursive: true }).some((rel) => readingFile(String(rel)));
  } catch (e) {
    return false;
  }
}

/** The names of the files at the top of a folder, none when it cannot be read. */
function topFiles(folder) {
  try {
    return readdirSync(folder, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name);
  } catch (e) {
    return [];
  }
}

/** Whether a file of final/ (`rel`, a path from the episode's folder) is one a correction to a kind that is not a session sets
    aside: a hand-off or a text file (.json, .srt, .txt), and not one inside an export bundle. A finished video, a Story part and an
    export stay where they are, and stay listed (the next finish puts its own in their place, replacing them by the rule). */
const textInFinal = (rel) => /\.(json|srt|txt)$/i.test(rel) && !rel.split("/").slice(0, -1).some((part) => /\.fcpxmld$/i.test(part));

/** Whether the file of final/ at `rel` is a client or group session's own hand-off, which holds no word of it: a version 2 hand-off
    of kind session. One that is not here, or cannot be read, is not. */
function sessionHandoffIn(folder, rel) {
  if (!rel.endsWith(".brimm-ops.json")) return false;
  try {
    const h = JSON.parse(readFileSync(join(folder, rel), "utf8"));
    return h !== null && typeof h === "object" && h.version === 2 && Boolean(h.video) && h.video.kind === "session";
  } catch (e) {
    return false;
  }
}

/** What a file of final/ is, as she is told of one that stayed: never its name. */
function whatInFinal(rel) {
  if (rel.split("/").slice(1, -1).some((part) => /\.fcpxmld$/i.test(part))) return "an export";
  if (rel.endsWith(".brimm-ops.json")) return "a hand-off";
  if (rel.endsWith(".transcript.txt")) return "a transcript";
  if (rel.endsWith(".srt")) return "captions";
  if (rel.endsWith(".words.json")) return "word times";
  if (isMedia(basename(rel))) return "a video";
  return "a file";
}
/** What the files `rels` of final/ are, each said once, in their order. */
const whatsInFinal = (rels) => [...new Set([...rels].sort().map(whatInFinal))];

/** The files of `rels` (paths from the episode's folder) that are not on this Mac, or not whole on it. */
const notReady = (ctx, found, rels) => rels.filter((rel) => !existsSync(join(found.folder, rel)) || !ctx.isWhole(join(found.folder, rel)));

/** What `kind … --again` sets aside of the episode in `folder`, whose record is `record`, before a new reading (spec 2, "Correcting a
    wrong answer"): only the text files of the earlier reading, never the video, the import's own files, or a rough cut, upright
    version or preview, which stay where they are (spec 1, "Episodes imported before this design"), and the hand-off with what final/
    holds beside it. A file counts whether it is on this Mac or only the record lists it, as one Dropbox has not brought over yet:
    such a file is set aside once it is here, and the correction waits for it (notReady). That is { rels, restore, reels }:
    - `rels`, the paths from the folder of each file to set aside, each once: the Reel suggestions (reels.json, and the copy she
      reads) and Claude's notes; of a raw reading, the rough cut's captions and transcript it wrote, and the timeline version 0 was
      rendered from (its entry in main.pushed); a session's teachings files (teachings.js isTeachingsFile), by any name it had; the
      hand-off record.finished names; and of final/, every file in it or listed in it. Answered as a kind that is not a session,
      final/'s hand-offs and text files go (textInFinal), and its videos and exports stay; answered as a session (`session`), every
      file of final/ goes, but for a session's own hand-off. With `finalOnly`, final/ alone, as a session that owes its empty
      revision sweeps it again; and the plan Claude read, with its cut log, when a raw reading kept the rules' plan in history/;
    - `restore`, [path, from] for each file put back in its place from history/: the rules' plan and its cut log (reading.js
      rulesPlanKept), so that the next reading starts from the plan the import made, as a raw video's does. A plan in place that is
      that plan already is left alone, and set aside again never;
    - `reels`, the numbers of the Reel suggestions in the reels.json set aside, which the record lets go with it.
    This only reads. */
function earlierFiles(folder, record, { session = false, finalOnly = false } = {}) {
  const stem = basename(record.video.file, extname(record.video.file));
  const listedFiles = record.files !== null && typeof record.files === "object" ? record.files : {};
  const there = (rel) => existsSync(join(folder, rel));
  const rels = [];
  const add = (rel, always = false) => {
    if ((always || there(rel) || Object.hasOwn(listedFiles, rel)) && !rels.includes(rel)) rels.push(rel);
  };
  const restore = [];
  if (!finalOnly) {
    const reading = record.reading !== null && typeof record.reading === "object" ? record.reading : {};
    for (const rel of [REELS_FILE, `${stem}.reel-suggestions.txt`, `${stem}.edit-notes.txt`]) add(rel);
    if (reading.kind === "raw") for (const rel of [`${stem}.rough-cut.srt`, `${stem}.rough-cut.transcript.txt`]) add(rel);
    const v0 = (Array.isArray(record.main.pushed) ? record.main.pushed : []).find((p) => p.v === 0 && p.how === "render");
    if (v0 && typeof v0.file === "string") add(v0.file);
    for (const name of [...new Set([...topFiles(folder), ...Object.keys(listedFiles)])].filter(isTeachingsFile).sort()) add(name);
  }
  let finals = [];
  try {
    finals = filesUnder(join(folder, "final")).map((rel) => `final/${rel}`);
  } catch (e) {
    // There is no final/.
  }
  const handoff = record.finished && typeof record.finished.handoff === "string" && record.finished.handoff.startsWith("final/") ? [record.finished.handoff] : [];
  for (const rel of [...new Set([...finals, ...Object.keys(listedFiles).filter((key) => key.startsWith("final/")), ...handoff])].sort()) {
    if (session ? sessionHandoffIn(folder, rel) : !textInFinal(rel)) continue;
    add(rel, true);
  }
  if (!finalOnly) {
    const rules = rulesPlanKept(folder, stem);
    const planRel = `${stem}.cut-plan.json`;
    if (rules && there(planRel) && readFileSync(join(folder, planRel), "utf8") !== rules.text) {
      add(planRel);
      restore.push([planRel, rules.json]);
      if (rules.txt) {
        add(`${stem}.cut-plan.txt`);
        restore.push([`${stem}.cut-plan.txt`, rules.txt]);
      }
    }
  }
  const reels = new Set();
  if (rels.includes(REELS_FILE) && there(REELS_FILE)) {
    try {
      const read = readReels(readFileSync(join(folder, REELS_FILE), "utf8"));
      for (const c of read.reels ? read.reels.candidates : []) reels.add(c.n);
    } catch (e) {
      // A list that cannot be read lets go no Reel of the record.
    }
  }
  return { rels, restore, reels };
}

/** A free name in the episode's history/ for the file `rel` set aside at `stamp`, as every set-aside names one: "<stamp> <name>",
    and "<stamp>-2 <name>" and on when that is taken, in the folder or by this set-aside (`taken`, which it is added to). */
function asideName(folder, stamp, rel, taken) {
  for (let n = 1; ; n++) {
    const name = `history/${stamp}${n > 1 ? `-${n}` : ""} ${basename(rel)}`;
    if (!taken.has(name) && !existsSync(join(folder, name))) {
      taken.add(name);
      return name;
    }
  }
}

/** Write a correction (`kind … --again`) by the rule: the files `aside` (earlierFiles) of the episode `found` are cloned whole into
    history/ first, each listed there by the record; the rules' plan and its cut log are put back in their places; `handoff`, a
    session's empty revision ({ rel, text }), is put into final/; then `next` is written on `base` (expectRev), listing none of the
    files set aside; and only once it is written are they taken out of the episode. When the record cannot be written, what this put
    in is taken out again and what it replaced is put back, each only while it is still this call's, and nothing is deleted: she is
    told nothing was changed (or, when a file could not be put back, that the episode needs Jason; a copy of it is in history/).
    With `quiet`, for a session, those words name no file and no folder. Afterwards final/ is looked at again: what stayed in it that
    was to go (`session`: every file but a session's own hand-off and the one put in; otherwise the files set aside) is given back
    as `stayed`, for her to be told by what it is. Resolves { code: 0, stayed } when written, { code: 1 } having said why. */
async function setAsideWritten(ctx, found, base, next, aside, handoff = null, { quiet = false, session = false } = {}) {
  const { folder } = found;
  const gone = undone(base, ctx.home);
  if (gone) {
    ctx.say(`${gone} Nothing was changed.`);
    acceptRev(ctx.home, base.id, base.rev);
    return { code: 1 };
  }
  const opts = ruleOpts(ctx);
  const stamp = localStamp(new Date(ctx.now())).replace(/:/g, "-");
  const work = join(runsFolder(ctx.home), `again-${process.pid}-${ctx.now()}`);
  const put = textWriter({ work, ...opts });
  const files = { ...base.files };
  // The files put back in their places, and the hand-off put in: none of these is taken out after.
  const placed = new Set([...aside.restore.map(([rel]) => rel), ...(handoff ? [handoff.rel] : [])]);
  const copies = [];
  const replaced = [];
  const taken = new Set();
  /** Put `text` in at `rel` by the rule, keeping what was there to put back. */
  const putIn = (rel, text) => {
    const at = join(folder, rel);
    const there = existsSync(at);
    replaced.push({ at, was: there ? readFileSync(at, "utf8") : null, ours: text });
    mkdirSync(dirname(at), { recursive: true });
    files[rel] = put(at, text, { replace: there }).bytes;
  };
  try {
    if (aside.rels.length) mkdirSync(join(folder, "history"), { recursive: true });
    for (const rel of aside.rels) {
      const to = asideName(folder, stamp, rel, taken);
      cloneIn(join(folder, rel), join(folder, to), opts);
      copies.push(join(folder, to));
      files[to] = statSync(join(folder, to)).size;
      if (!placed.has(rel)) delete files[rel];
    }
    for (const [rel, from] of aside.restore) putIn(rel, readFileSync(join(folder, from), "utf8"));
    if (handoff) putIn(handoff.rel, handoff.text);
    writeEpisode(folder, { ...next, files }, { expectRev: base.rev, writeText: textWriter({ work: join(work, "record"), ...opts }), writer: writerOf(ctx), home: ctx.home });
  } catch (e) {
    let lost = false;
    for (const r of replaced.reverse()) {
      try {
        const now = existsSync(r.at) ? readFileSync(r.at, "utf8") : null;
        if (now === r.ours || (now === null && r.was !== null)) {
          if (r.was === null) rmSync(r.at, { force: true });
          else put(r.at, r.was, { replace: existsSync(r.at) });
        } else if (now !== r.was) lost = true;
      } catch (p) {
        lost = true;
      }
    }
    // The copies in history/ are taken out again, but when a file could not be put back: then they are what is left of it.
    if (!lost) for (const copy of copies) rmSync(copy, { force: true });
    const changed = e.code === "CHANGED";
    const why = changed ? "this episode changed on the other Mac: open it again" : plainWhy(e);
    if (lost) ctx.say(quiet ? "Its earlier files could not all be put back as they were; a copy of each is in history/. Tell Jason: the episode needs him." : `${capital(why)}. A file could not be put back as it was; a copy of it is in history/. Tell Jason: the episode needs him.`);
    else ctx.say(quiet && !changed ? asideFailed(e.code || "an error") : `Nothing was changed: ${why}.`);
    return { code: 1 };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  // Each file set aside, whole in history/ and listed there by the record, leaves the episode.
  for (const rel of aside.rels.filter((r) => !placed.has(r))) {
    try {
      rmSync(join(folder, rel), { force: true });
    } catch (e) {
      // The record lists it no more, and history/ holds it whole: what stayed in final/ is said below.
    }
  }
  let left = [];
  try {
    left = filesUnder(join(folder, "final")).map((rel) => `final/${rel}`);
  } catch (e) {
    // There is no final/ any more.
  }
  const stayed = session ? left.filter((rel) => !placed.has(rel) && !sessionHandoffIn(folder, rel)) : aside.rels.filter((rel) => rel.startsWith("final/") && !placed.has(rel) && left.includes(rel));
  return { code: 0, stayed };
}

/** A session's empty revision, for `record`, the session's record as it is to be written (with the last finish it had, for the
    version of the hand-off on file), made at `at`: { revision, handoff: { rel, text }, finished, words } when it is to be written,
    or { words } when it is not. It goes where handoffTarget says, with nothing in it: no principles, no Reels, no transcript (the
    contract's handoff-v2-session-replacing). It is version 2 when this Mac's settings say so, when the hand-off on file is (writesV2For),
    and when any hand-off of the episode's own, in its final/ or set aside in its history/, is. It is not written on a Mac that hands
    off version 1 otherwise; nor when handoffTarget refuses it (a gap in the video's versions, said in H4's words, or an id it went to
    the page under that its versions no longer lead to); nor when a hand-off of its own, of either version, went to the page under
    another id than the one it would go under, since the page would keep that id's words (said by the id alone). */
function emptyRevisionOf(ctx, found, record, at, { gone = true } = {}) {
  const label = shownName(record);
  const own = ownHandoffs(found.folder);
  if (!writesV2For(ctx.settings, found.folder, record) && !own.some((h) => h.version === 2)) return { words: emptyV1(label) };
  const target = handoffTarget({ root: ctx.root, settings: { ...ctx.settings, handoffVersion: 2 } }, { folder: found.folder, record });
  if (target.refusal) {
    const gap = chainGap(ctx.root, record);
    return { words: gap ? emptyWaits(label, gap) : emptyRefused(label, target.refusal) };
  }
  const elsewhere = own.map(handoffIdIn).find((id) => id && id !== target.id);
  if (elsewhere) return { words: emptyElsewhere(label, elsewhere) };
  const made = buildHandoffV2({ record, id: target.id, revision: target.revision, made: at, madeOn: ctx.machine, commit: writerOf(ctx).commit, reels: [], session: {} });
  const fault = handoffFaultV2(made);
  if (fault) return { words: emptyRefused(label, `the hand-off could not be made: ${fault}`) };
  const rel = `final/${fileSafe(record.name.text)}.brimm-ops.json`;
  return { revision: target.revision, handoff: { rel, text: handoffText(made) }, finished: { revision: target.revision, at, on: ctx.machine, handoff: rel, parts: {} }, words: emptyWritten(label, target.revision, gone), unshown: emptyWritten(label, target.revision, gone, false) };
}

/** What is said of a session's empty revision once its files are written (`empty`, emptyRevisionOf's; `stayed`, setAsideWritten's):
    its words, and when it was not written, that its files are out of the shared folder, unless some stayed in final/, which are
    said, by what they are. */
function sayEmpty(ctx, label, empty, stayed, shown = true) {
  const words = shown ? empty.words : empty.unshown;
  ctx.say(empty.handoff || stayed.length ? words : `${words} ${OUT_OF_SHARED}`);
  if (stayed.length) ctx.say(stayedWords(label, whatsInFinal(stayed)));
}

/** Show the file at `path`, of the video whose record is `record` and which is called `label`, in Finder, through this Mac's program
    runner: a hand-off for her to drop on the BRIMM Ops page, or a video to post, which `clone` copies. On an open-lock Mac a copy of
    it is shown (reveal.js revealed). False when that copy could not be made, and nothing was shown: the caller says cantOpen. */
async function showInFinder(ctx, { record, label, path, clone }) {
  try {
    return await revealed({ home: ctx.home, settings: ctx.settings, minimum: ctx.deps.minimum, run: ctx.deps.run || runProgram, record, label, path, clone });
  } catch (e) {
    // The file is there all the same.
    return true;
  }
}

/** The empty session revision a session still owes (revisionOwed), when `kind … session --again` is said again: it is written when
    it can be now, and final/ is swept again either way, by earlierFiles (every file but a session's own hand-off, listed or not, as a
    file the other Mac's finish put there that Dropbox brought over since), so that no word of it stays there. Nothing else of the
    record changes, and it is not claimed: the record is written on the one read, as finish writes a session's hand-off. When it
    still cannot be written and final/ holds nothing to set aside, it is refused, in the words of why, and nothing is written. */
async function emptyRevisionAgain(ctx, found, record) {
  const label = shownName(record);
  const at = localStamp(new Date(ctx.now()));
  const aside = earlierFiles(found.folder, record, { session: true, finalOnly: true });
  // An empty revision written already is not written again: only the sweep it still owes (sweepOwed) is made.
  const empty = revisionOwed(record) ? emptyRevisionOf(ctx, found, record, at, { gone: readBefore(found.folder, record, { rels: aside.rels }) }) : null;
  if (!(empty && empty.handoff) && !aside.rels.length) return refuse(ctx, empty ? `${empty.words} ${OUT_OF_SHARED}` : `${label} is a client or group session already.`);
  await broughtOver(ctx, found, aside.rels.filter((rel) => existsSync(join(found.folder, rel))));
  if (notReady(ctx, found, aside.rels).length) return refuse(ctx, comingWhy(ctx, found, label));
  const handoff = empty && empty.handoff;
  const next = handoff ? { ...record, session: { ...record.session, emptyRevision: empty.revision }, finished: empty.finished } : record;
  const wrote = await setAsideWritten(ctx, found, record, next, aside, handoff, { quiet: true, session: true });
  if (wrote.code !== 0) return 1;
  forgetComing(ctx, found);
  const shown = !handoff || (await showInFinder(ctx, { record: next, label, path: join(found.folder, empty.handoff.rel) }));
  if (empty) sayEmpty(ctx, label, empty, wrote.stayed, shown);
  else {
    ctx.say(`${label}: its earlier files are set aside in history/. ${OUT_OF_SHARED}`);
    if (wrote.stayed.length) ctx.say(stayedWords(label, whatsInFinal(wrote.stayed)));
  }
  if (!shown) ctx.say(cantOpen(label));
  sayVersionsToMark(ctx, found, next);
  return !empty || handoff ? 0 : 1;
}

/** Say which other versions of the video of `record` (a session now, in the episode `found`) she must answer as a session too, each
    by its label and short id, as the lists name it (listedAs), and never by a name or a file: every other version of it (finish.js
    linksOf, besideOf) that is not a session not cleared itself. Each is held as a session until it is answered as one, and its own
    `kind … session --again` sets its final/ aside: nothing is written into another version's folder from here (spec 1). Nothing is
    said when there is none. */
function sayVersionsToMark(ctx, found, record) {
  const links = linksOf(ctx.root);
  const seen = new Set([record.id]);
  const names = [];
  for (const one of links.besideOf(record, found.folder)) {
    if (seen.has(one.record.id) || links.holdsSession(one)) continue;
    seen.add(one.record.id);
    const r = one.record;
    const short = String(r.id).slice(-6);
    names.push(typeof r.label === "string" && r.label.trim() ? `${r.label} (${short})` : recordKind(r) === null ? shownName(r) : heldName(r));
  }
  if (names.length === 1) ctx.say(`${shownName(record)} has another version, held as a client or group session until it is answered as one: answer ${names[0]} as a session too.`);
  else if (names.length) ctx.say(`${shownName(record)} has other versions, each held as a client or group session until it is answered as one: answer ${listed(names)} as a session too.`);
}

/** Claim the episode `found`, whose record is `record`, for this Mac, as `open` does: the claim is written, Dropbox is given
    CLAIM_WAIT_MS, and the record is read again. It must be the claim this command wrote, with no other record on top of it, even
    one that keeps the claim. Resolves { record }, the record read again, or { code } once it has said why not: the record cannot
    be read; Dropbox undid the claim (`again`, what she is to do, follows); another Mac's claim came across (`held`, given that
    Mac); or a record was written on top of it (`changed`). It warns when this Mac seems to be offline. `kind` and `teachings`
    claim a video so before they write on it. Each line it says goes through `said` first (kind's clearing says first that nothing
    was cleared), and `onChanged`, when given, is waited for with the record on top before `changed` is said. */
async function claimAndWait(ctx, found, record, { again, held, changed, said = (line) => line, onChanged = null }) {
  const { say } = ctx;
  const name = shownName(record);
  const wait = ctx.deps.wait || ((ms) => new Promise((done) => setTimeout(done, ms)));
  if ((await save(ctx, { ...found, record }, claimFor(record, ctx.machine, localStamp(new Date(ctx.now()))), "")) !== 0) return { code: 1 };
  await wait(CLAIM_WAIT_MS);
  const read = readEpisode(found.folder);
  if (!read.record) {
    say(said(notRead(ctx, { ...found, read })));
    return { code: 1 };
  }
  const undid = undone(read.record, ctx.home);
  if (undid || !read.record.editing) {
    say(said(`Dropbox undid this Mac's claim on ${name}. ${again}`));
    if (undid) acceptRev(ctx.home, read.record.id, read.record.rev);
    return { code: 1 };
  }
  if (read.record.editing.by !== ctx.machine) {
    say(said(held(read.record.editing.by)));
    return { code: 1 };
  }
  // Nothing is written on a claim but what the command writes next: any record on top of it, even one that keeps the claim, is
  // not the claim this command wrote.
  if (read.record.rev !== record.rev + 1) {
    if (onChanged) await onChanged(read.record);
    say(said(changed));
    return { code: 1 };
  }
  if (!(await (ctx.deps.online || online)())) say(OFFLINE);
  return { record: read.record };
}

/** Wait in the foreground for the reading just started of the episode `found` (named `name`), within READ_WAIT_MS and what this
    command has left of COMMAND_BUDGET_MS from `began`, and say what it found as `status` says a result, or that a notice will
    come. The reading's result is the one this run left, not `previous`, an older one: a reading that was done before is told apart
    by when it ended. Resolves the command's code. */
async function waitForReading(ctx, found, name, previous, began) {
  const wait = ctx.deps.wait || ((ms) => new Promise((done) => setTimeout(done, ms)));
  const waitFrom = ctx.now();
  const budget = Math.min(READ_WAIT_MS, COMMAND_BUDGET_MS - (waitFrom - began));
  for (;;) {
    const result = readResult(ctx.home, found.name, "read");
    if (result && (!previous || result.ended !== previous.ended || result.started !== previous.started)) {
      ctx.say(ranLine(ctx, name, result, (text) => text, result.next, result.early === true && runningCommand(ctx.home, found.name, ctx.alive) === "read"));
      return result.ok ? 0 : 1;
    }
    if (ctx.now() - waitFrom >= budget) break;
    await wait(READ_POLL_MS);
  }
  ctx.say(`Claude is still reading ${name}. A notice will come on this Mac when it is done: then say "what did Claude find?"`);
  return 0;
}

/** `leave "<video>"`: a video still waiting for its answer is left alone, as not for brimm-video: it is listed apart and never
    asked about again. It can still be answered later by `kind`. It holds the answer lock of the episode while it writes, as `kind`
    does, and reads the record under it. An answered video is refused; so is a video the other Mac is answering, which `leave`
    does not claim. */
export async function leaveCommand(ctx, rest) {
  const { words } = flagsOf(rest, []);
  const got = episodeFor(ctx, words, { newerEnds: 1 });
  if (!got.found) return got.code;
  const { found } = got;
  const lock = takeAnswerLock(ctx, found.name, "leave");
  if (!lock) return refuse(ctx, busyWhy(shownName(got.record)));
  try {
    const read = readEpisode(found.folder);
    if (!read.record) {
      ctx.say(notRead(ctx, { ...found, read }));
      return 1;
    }
    if (read.newer) {
      ctx.say(newerWhy(read.record));
      return 1;
    }
    const { record } = read;
    const name = namedAs(found, record);
    if (recordKind(record) !== null) return refuse(ctx, `${name} is answered already: leave is for a video still waiting for its answer.`);
    if (record.answer && record.answer.state === "not for brimm-video") {
      ctx.say(`${name} is left already. It is not asked about again.`);
      return 0;
    }
    const held = heldElsewhere(record, ctx.machine);
    if (held) return refuse(ctx, beingAnswered(name, held.by));
    const answer = { ...record.answer, state: "not for brimm-video", by: ctx.machine, on: ctx.machine, at: localStamp(new Date(ctx.now())) };
    return await save(ctx, { ...found, record }, { ...record, answer }, `${name}: left. It is not asked about again.`);
  } finally {
    releaseEpisodeLock(lock.file, lock.text);
  }
}

/** Clone the file at `from` to `to` (copyFileSync with COPYFILE_FICLONE, which calls clonefile(2)), and never by copying its bytes:
    a clone is made only on one disk, so it throws when the two are on different disks, as onSameDisk tells (COPYFILE_FICLONE would
    copy a video of gigabytes byte by byte there; COPYFILE_FICLONE_FORCE is not there on macOS). `ctx.deps` may give stand-ins. */
function cloneWhole(ctx, from, to) {
  if (!(ctx.deps.sameDisk || onSameDisk)(from, dirname(to))) throw new Error("it is on another disk, where no clone can be made");
  (ctx.deps.cloneFile || ((a, b) => copyFileSync(a, b, fsConstants.COPYFILE_FICLONE)))(from, to);
}
/** What `which` says when it opened the video's own file, whose name QuickTime Player's title bar shows. */
const OWN_FILE = "Its copy could not be made, so it opened under its file's name, which QuickTime Player's title bar shows: share no screen while it is open.";

/** `which "<video>"`: open the episode's video in QuickTime Player on this Mac, so that she can see which video it is. QuickTime
    Player shows the name of the file it opens in its title bar, on a screen she may share: so it opens a clone of the video, named
    by how the video is named (its label, for a video not yet answered or a session), in ~/BRIMM Video Work/<folder>/shown/, listed
    by that folder's marker before it is made, as show's copies are, and taken away with them by `behind`. A clone takes no room and
    no time; it is made only of a video whole on this Mac, and only as a clone, on one disk (cloneWhole). When it
    cannot be made, or the video is not whole here (on the Mac that did not import it the file is online-only, and a clone would
    have Dropbox bring it all over first), the video's own file is opened, and she is told its name shows in the title bar; QuickTime
    Player then has Dropbox bring it over, which is said. It says nothing else of the video. On an open-lock Mac the clone is made in
    ~/BRIMM Video Work/shown/<its id>/ (madeShownDir), and a video the gate holds, or one held as a session, that it cannot clone is
    not opened at all: cantOpen (design 2026-10-26, section 1, "What brimm-video opens and shows"). */
export async function whichCommand(ctx, rest) {
  const { words } = flagsOf(rest, []);
  const got = episodeFor(ctx, words, { newerEnds: 1 });
  if (!got.found) return got.code;
  const { found, record } = got;
  const name = namedAs(found, record);
  const video = join(found.folder, record.video.file);
  const here = ctx.isWhole(video);
  let opened = "";
  if (here) {
    try {
      // The clone `which` made before goes first; the copies `show` made stay. On an open-lock Mac the copies Finder showed are in
      // the same folder, for her to drag: nothing in it is taken away until `behind`.
      if (lockFor(ctx.settings, ctx.deps) !== "open") clearShownIn(madeShownDir(ctx, found, record), (listed) => !listed.endsWith(".txt"));
      const dir = madeShownDir(ctx, found, record);
      const named = freeShownName(dir, fileSafe(name), extname(record.video.file));
      addShown(dir, named);
      cloneWhole(ctx, video, join(dir, named));
      opened = join(dir, named);
    } catch (e) {
      // The video itself is opened instead, and she is told so.
    }
  }
  // On an open-lock Mac a video the gate holds, or one held as a session, is never opened under its file's name (R12).
  if (!opened && lockFor(ctx.settings, ctx.deps) === "open" && (gated(record) || found.held)) return refuse(ctx, cantOpen(name));
  try {
    ctx.openApp("QuickTime Player", opened || video);
  } catch (e) {
    return refuse(ctx, `${name}: ${e.message}`);
  }
  ctx.say(`Opened ${name} in QuickTime Player on this Mac.${opened ? "" : ` ${OWN_FILE}`}${here ? "" : ` ${ONLINE_ONLY}`}`);
  return 0;
}

// --- A client or group session's teachings (spec 2026-10-22, sections 2, 3 and 8) ---

const READINGS_OFF = "Readings are off on this Mac: ask Jason.";
/** What `name` says of a name for a session that holds a name brimm-video can see in it (spec 8, "A session's name"), or that is
    its video file's name, and what an edit of hers says of words that hold one. */
const nameHolds = (word) => `That name holds "${word}", a name brimm-video can see in this session: give it another.`;
const FILES_NAME = "That is the name of the video's file: give the session another name.";
const NO_FILE_NAME = "That name cannot name the session's files: give it another.";
const NAME_TOO_LONG = `That name is longer than ${SESSION_NAME_MOST} characters: give a shorter one.`;
const editHolds = (word) => `Those words hold "${word}", a name brimm-video can see in this session: say it another way.`;
/** What is said while what a session's names are seen from is not whole on this Mac, after it was read through. */
const WORDS_COMING = "Dropbox is still bringing its words over to this Mac: say it again in a minute.";
/** What `finish` says of a session on a Mac that hands off version 1, which has no session kind. */
const SESSION_V1 = "A session's hand-off is written once this Mac hands off version 2: ask Jason.";
/** What is said while a session's teachings or the files its names are seen from are not whole on this Mac yet. */
const TEACHINGS_COMING = "Dropbox is still bringing its teachings over to this Mac: say it again in a minute.";

/** "1 thing", "2 things". */
const counted = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** Some items of one of a session's lists, by their numbers, as she reads of them: "principle 3", "Reel ideas 1 and 2". */
const itemsSaid = (key, ns) => {
  const [, one, many] = ITEM_LISTS.find(([k]) => k === key);
  return `${ns.length === 1 ? one : many} ${listed(ns.map(String))}`;
};

/** Whether a record is held back as a session: of kind session, or of another kind with a session mark not cleared. A video not
    yet answered is not one. */
const asSession = (record) => recordKind(record) === "session" || (recordKind(record) !== null && gated(record));
/** Whether a record is a client or group session whose teachings may be asked for, decided and handed off: of kind session, its
    mark not cleared. One whose mark she cleared by her click on the dialog is read as the kind she answered with it (F8). */
const taughtSession = (record) => recordKind(record) === "session" && gated(record);

/** The files `rels` of the episode `found` that are still not whole on this Mac once each one that was not has been read through
    (dropbox.js readThrough, as a reading reads its files), so that Dropbox brings it down: the gate refuses `bring` for a
    session, and a file online-only on this Mac would otherwise never come. */
async function broughtOver(ctx, found, rels) {
  for (const rel of rels.filter((r) => !ctx.isWhole(join(found.folder, r)))) {
    try {
      await (ctx.deps.readAll || readThrough)(join(found.folder, rel));
    } catch (e) {
      // It is said by what is still not whole.
    }
  }
  return rels.filter((r) => !ctx.isWhole(join(found.folder, r)));
}

/** The names brimm-video can see in the session `found` (teachings.js sessionSeen), once what they are seen from is whole on this
    Mac, read through if need be: { names } or { why }, which fails closed. */
async function sessionNames(ctx, found) {
  const { record } = found;
  if ((await broughtOver(ctx, found, seenFrom(record))).length) return { why: WORDS_COMING };
  const seen = sessionSeen(found.folder, record, { host: ctx.settings.host });
  return seen.why ? { why: `${shownName(record)}'s names cannot be checked now: ${seen.why}.` } : { names: seen.names, hers: seen.hers };
}

/** Why a session's record may not be written on by this Mac now, in plain words, or "": another Mac has it, or a run is at work
    on it. A `read` whose reading of the teachings asked for is in the record already is only making its late check, which
    replaces no record: it does not stop her decisions or the hand-off; and with `read`, no `read` at all stops what is written
    (her answer of the transcript only, which the reading refuses before its call once it is in the record). `what` says what
    was not done. */
function sessionBusy(ctx, found, record, what, { read = false } = {}) {
  const name = shownName(record);
  const held = heldElsewhere(record, ctx.machine);
  if (held) return `${held.by} has ${name} open, so ${what}. Say it again once it is let go there.`;
  const running = runningCommand(ctx.home, found.name, ctx.alive);
  if (!running || (read && running === "read")) return "";
  const reading = sessionReading(record);
  const asked = record.session && Date.parse(record.session.asked);
  if (running === "read" && reading && Date.parse(reading.at) >= asked) return "";
  return `${running} is running for ${calledAs(ctx, found)} already. Say it again when it has finished.`;
}

/** `teachings "<session>" [--transcript-only]`: her answer to "what do you want from it?" for a client or group session (spec 2,
    "The session mark"). With --transcript-only, her answer that its transcript stays on this Mac is recorded, and nothing goes
    to Claude: the gate lets that through with the training gate off. Otherwise the session's one reading is asked for, refused,
    with nothing asked or written, in this order: a video that is not a session; this Mac's training gate off, or lapsed, 90
    days or more after Jason turned it on (the gate says these first); the claude command on this Mac signed in to another
    account than the one Jason checked, or none it can say (`claude auth status`, reading.js accountOf); and this Mac's readings
    off. Then it holds the answer lock, claims the session as `kind` does (claimAndWait), records that its teachings were asked
    for, and when (`session.teachings` "asked", `session.asked`), and starts the reading detached (`read --kind session --rev
    <rev>`), which reads it once for this ask, and waits for it in the foreground as `kind` does. Asked again after a reading, it
    is read again: the earlier teachings are set aside, and its items numbered on. */
export async function teachingsCommand(ctx, rest) {
  const began = ctx.now();
  const { words, flags } = flagsOf(rest, []);
  if (Object.keys(flags).some((flag) => flag !== "transcript-only")) {
    ctx.say(HELP);
    return 2;
  }
  const got = episodeFor(ctx, words, { newerEnds: 1 });
  if (!got.found) return got.code;
  const { found, record } = got;
  const name = shownName(record);
  if (!taughtSession(record)) return refuse(ctx, `${name} is not a client or group session: teachings are read only from one.`);
  if (flags["transcript-only"]) return transcriptOnly(ctx, found, record);
  const gate = teachingsWhy(ctx.settings, ctx.now());
  if (gate) return refuse(ctx, gate);
  const tools = ctx.deps.tools || findPrograms();
  if (!tools.claude) return refuse(ctx, "Claude Code is not installed on this Mac, so Claude cannot read it.");
  const work = join(runsFolder(ctx.home), `teachings-${process.pid}-${ctx.now()}`);
  let account = "";
  try {
    account = await accountOf({ run: ctx.deps.run || runProgram, tools }, join(work, "account"));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  const other = accountWhy(account, ctx.settings);
  if (other) return refuse(ctx, other);
  if (ctx.settings.readings === false) return refuse(ctx, READINGS_OFF);
  const lock = takeAnswerLock(ctx, found.name, "teachings");
  if (!lock) return refuse(ctx, busyWhy(name));
  try {
    return await askTeachings(ctx, found, began);
  } finally {
    releaseEpisodeLock(lock.file, lock.text);
  }
}

/** `teachings "<session>" --transcript-only`: her answer recorded, the session's record and nothing else. */
async function transcriptOnly(ctx, found, record) {
  const name = shownName(record);
  const said = `${name}: its transcript stays on this Mac. Nothing goes to Claude.`;
  // Her answer is recorded while the reading of an earlier ask still waits: that reading refuses, before it asks Claude anything,
  // once the record no longer says her teachings are asked for.
  const busy = sessionBusy(ctx, found, record, "her answer was not recorded", { read: true });
  if (busy) return refuse(ctx, busy);
  if (record.session && record.session.teachings === "transcript only") {
    ctx.say(said);
    return 0;
  }
  return save(ctx, { ...found, record }, { ...record, session: { ...record.session, teachings: "transcript only" } }, said);
}

/** What `teachings` does once it holds the answer lock of the session `found`: see teachingsCommand. */
async function askTeachings(ctx, found, began) {
  const read = readEpisode(found.folder);
  if (!read.record) {
    ctx.say(notRead(ctx, { ...found, read }));
    return 1;
  }
  if (read.newer) {
    ctx.say(newerWhy(read.record));
    return 1;
  }
  const { record } = read;
  const name = shownName(record);
  const why = (r) => (!taughtSession(r) ? `${name} is not a client or group session: teachings are read only from one.` : sessionBusy(ctx, found, { ...r, reading: null }, "its teachings were not asked for"));
  const first = why(record);
  if (first) return refuse(ctx, first);
  let base = record;
  if (!record.editing || record.editing.by !== ctx.machine) {
    const claim = await claimAndWait(ctx, found, record, { again: "Say it again.", held: (by) => `${by} has ${name} open, so its teachings were not asked for. Say it again once it is let go there.`, changed: `${name} changed meanwhile: say it again.` });
    if (!claim.record) return claim.code;
    base = claim.record;
    const late = why(base);
    if (late) return refuse(ctx, late);
  }
  const at = localStamp(new Date(ctx.now()));
  if ((await save(ctx, { ...found, record: base }, { ...base, session: { ...base.session, teachings: "asked", asked: at } }, "")) !== 0) return 1;
  // Right before the reading is started the record is the ask written, and nothing is at work on the episode.
  const wrote = readEpisode(found.folder);
  if (!wrote.record || wrote.record.rev !== base.rev + 1 || recordKind(wrote.record) !== "session") {
    ctx.say(`${name} changed meanwhile: say it again.`);
    return 1;
  }
  const running = runningCommand(ctx.home, found.name, ctx.alive);
  if (running) {
    ctx.say(`${name}: its teachings are asked for, but ${running} is running for it, so Claude's reading was not started. Say it again when it has finished.`);
    return 1;
  }
  const previous = readResult(ctx.home, found.name, "read");
  startDetached(ctx, { command: "read", folder: found.name, args: ["--kind", "session", "--rev", String(wrote.record.rev)] });
  return waitForReading(ctx, found, name, previous, began);
}

/** `principles "<session>" [recurring] [keep <n>… | drop <n>… | edit <n> --<what> "<words>"]` and `ideas "<session>" [keep … |
    drop … | edit …]`: what Claude read in a client or group session, for her to decide item by item (spec 3, "Client or group
    session"). With no words, each item as she reads it (teachings.js: a principle's example and key phrases first, its
    source_context marked as hers only), with the line that brimm-video took out the names it could see, what it took out (by
    field and why, never the name), and what she has decided of each. With words, sessions.js approve keeps, drops or changes
    the items named, of the principles, the recurring principles (`recurring`) or the Reel ideas, and only the keys she may
    change (EDITS); her decision of each, and what she changed, go into the record in one write (`session.decided`,
    `session.edits`): the record alone marks an item approved, and only her command writes it (spec 8). Refused, writing nothing,
    for a video that is not a session, before Claude has read its teachings, while another Mac has it or a run is at work on it,
    and for what approve cannot do. */
async function principles(ctx, rest) {
  return sessionItems(ctx, rest, "principles");
}
async function ideas(ctx, rest) {
  return sessionItems(ctx, rest, "ideas");
}

async function sessionItems(ctx, rest, command) {
  const [said, ...words] = rest;
  const got = episodeFor(ctx, said ? [said] : [], { newerEnds: 1 });
  if (!got.found) return got.code;
  const { found, record } = got;
  const name = shownName(record);
  if (!taughtSession(record)) return refuse(ctx, `${name} is not a client or group session: it has no ${command === "ideas" ? "Reel ideas" : "principles"} of its own.`);
  const gate = teachingsWhy(ctx.settings, ctx.now());
  if (gate) return refuse(ctx, gate);
  let read = readTeachings(found.folder, record, ctx.isWhole);
  if (read.coming && !(await broughtOver(ctx, found, [read.coming])).length) read = readTeachings(found.folder, record, ctx.isWhole);
  if (read.none) return refuse(ctx, `${name} has no teachings yet: Claude has not read it.`);
  if (read.coming) return refuse(ctx, TEACHINGS_COMING);
  if (read.why) return refuse(ctx, `${name}'s teachings cannot be read (${read.why}).`);
  const items = itemsOf(read.teachings, record.session);
  const recurring = command === "principles" && String(words[0] || "").toLowerCase() === "recurring";
  const key = command === "ideas" ? "reelIdeas" : recurring ? "recurringPrinciples" : "principles";
  const asked = recurring ? words.slice(1) : words;
  if (!asked.length) return sayItems(ctx, name, record, read.teachings, items, command);
  const busy = sessionBusy(ctx, found, record, "nothing was decided");
  if (busy) return refuse(ctx, busy);
  const done = approve(items[key], asked, EDITS[key]);
  if (done.why) return refuse(ctx, done.why);
  // What she changes is checked now, as her words, against the names brimm-video can see (teachings.js herWordsName), and
  // refused when it holds one, saying which: the finish checks it again.
  const changedTexts = done.items.flatMap((item) => {
    const before = items[key].find((one) => one.n === item.n);
    return EDITS[key].filter((field) => item[field] !== before[field]).map((field) => item[field]);
  });
  if (changedTexts.length) {
    const seen = await sessionNames(ctx, { ...found, record });
    if (seen.why) return refuse(ctx, seen.why);
    const word = changedTexts.map((text) => herWordsName(text, seen.hers)).find(Boolean);
    if (word) return refuse(ctx, editHolds(word));
  }
  // Her decision of each item, and what she changed of one, by the item's number.
  const session = record.session;
  const decided = { ...(session.decided || {}), [key]: { ...((session.decided || {})[key] || {}) } };
  const edits = { ...(session.edits || {}) };
  for (const item of done.items) {
    const before = items[key].find((one) => one.n === item.n);
    if (typeof item.approved === "boolean") decided[key][String(item.n)] = item.approved ? "kept" : "dropped";
    const changed = EDITS[key].filter((field) => item[field] !== before[field]);
    if (changed.length) edits[key] = { ...(edits[key] || {}), [String(item.n)]: { ...((edits[key] || {})[String(item.n)] || {}), ...Object.fromEntries(changed.map((field) => [field, item[field]])) } };
  }
  const next = { ...session, decided, ...(Object.keys(edits).length ? { edits } : {}) };
  if ((await save(ctx, { ...found, record }, { ...record, session: next }, "")) !== 0) return 1;
  const verb = asked[0].toLowerCase();
  const end = asked.findIndex((w) => w.startsWith("--"));
  const ns = [...new Set(asked.slice(1, end === -1 ? undefined : end).flatMap((w) => w.split(",")).map((w) => w.trim()).filter(Boolean).map(Number))];
  ctx.say(`${name}: ${itemsSaid(key, ns)} ${verb === "keep" ? "kept" : verb === "drop" ? "dropped" : "changed and kept"}.`);
  // What is still to decide, of every list, as the items stand now.
  const now = itemsOf(read.teachings, next);
  const open = ITEM_LISTS.map(([k]) => [k, now[k].filter((item) => typeof item.approved !== "boolean").map((item) => item.n)]).filter(([, left]) => left.length);
  ctx.say(open.length ? `Still to decide: ${open.map(([k, left]) => itemsSaid(k, left)).join("; ")}.` : "Every item is decided: finish it to write its hand-off.");
  return 0;
}

/** Say a session's items as she reads them (see principles): the principles and recurring principles, or the Reel ideas. */
function sayItems(ctx, name, record, teachings, items, command) {
  const session = record.session || {};
  const status = (key, item) => {
    const decided = ((session.decided || {})[key] || {})[String(item.n)];
    const changed = Boolean(((session.edits || {})[key] || {})[String(item.n)]);
    return decided === "kept" ? (changed ? "Kept, as you changed it." : "Kept.") : decided === "dropped" ? "Dropped." : "Not decided yet.";
  };
  const day = String(teachings.made || (sessionReading(record) || {}).at || "").slice(0, 10);
  const skipped = teachings.skipped ? [teachings.skipped] : [];
  const lines = command === "ideas"
    ? [
        `${name}: ${counted(items.reelIdeas.length, "Reel idea")}, from Claude's reading of ${day}.`, CHECK_NAMES, ...takenLines(teachings.dropped, ["Reel idea"]), ...skipped,
        ...(items.reelIdeas.length ? items.reelIdeas.flatMap((r) => ideaLines(r, status("reelIdeas", r))) : ["Claude found no Reel ideas in it."]),
        'Say keep, drop or edit, then the numbers: keep 1 3, drop 2, edit 3 --words "…".'
      ]
    : [
        `${name}: ${counted(items.principles.length, "principle")} and ${counted(items.recurringPrinciples.length, "recurring principle")}, from Claude's reading of ${day}.`, CHECK_NAMES,
        ...takenLines(teachings.dropped, ["Principle", "Recurring principle"]), ...skipped,
        ...(items.principles.length ? items.principles.flatMap((p) => principleLines(p, status("principles", p))) : ["Claude found no principles in it."]),
        ...items.recurringPrinciples.map((r) => recurringLine(r, status("recurringPrinciples", r))),
        'Say keep, drop or edit, then the numbers: keep 1 3, drop 2, edit 3 --name "…". For a recurring principle, say recurring first: recurring keep 1.'
      ];
  for (const line of lines) ctx.say(line);
  return 0;
}

/** Why the name `words` cannot be given to the session `found`, in plain words, or "": it holds a name brimm-video can see in
    the session (sessions.js holdsName, against teachings.js sessionSeen), or what that is seen from is not whole on this Mac,
    or cannot be read, which fails closed (spec 8, "A session's name"). */
async function sessionNameWhy(ctx, found, words) {
  const { record } = found;
  const text = oneLine(words);
  if (!text) return "";
  // Its label is the session's own, and holds no one's name.
  if (SESSION_LABEL.test(text)) return "";
  if ([...text].length > SESSION_NAME_MOST) return NAME_TOO_LONG;
  if (isFilesName(text, record)) return FILES_NAME;
  // Its teachings files and its hand-off are named by it: a name that cannot name a file, as one that begins with a dot, is none.
  if (!isTeachingsName(`${fileSafe(text)}.principles.json`)) return NO_FILE_NAME;
  const seen = await sessionNames(ctx, found);
  if (seen.why) return seen.why;
  const word = herWordsName(text, seen.hers);
  return word ? nameHolds(word) : "";
}

/** `finish "<session>"` for a client or group session: its own hand-off, of what she approved (finish.js finishSession), never the
    Final Cut finish, which cannotFinish refuses for one. Refused while another Mac has it or a run is at work on it. */
async function finishSessionCommand(ctx, found) {
  const { record } = found;
  const name = shownName(record);
  const busy = sessionBusy(ctx, found, record, "its hand-off was not written");
  if (busy) return refuse(ctx, busy);
  let done = await finishSession(ctx, found, { host: ctx.settings.host });
  if (done.coming && !(await broughtOver(ctx, found, done.coming)).length) done = await finishSession(ctx, found, { host: ctx.settings.host });
  if (done.waits) return refuse(ctx, SESSION_V1);
  if (done.coming) return refuse(ctx, "Dropbox is still bringing its teachings, or the words they are checked against, over to this Mac: say it again in a minute.");
  if (done.why) {
    for (const line of done.why.split("\n")) ctx.say(line);
    return 1;
  }
  for (const d of done.dropped) ctx.say(`Taken out of the hand-off: ${d.field}: ${d.why}.`);
  const { principles: p, recurringPrinciples: r, reelsToFilm: f } = done.counts;
  ctx.say(`${name}: its hand-off is written, revision ${done.revision}, with ${listed([counted(p, "principle"), counted(r, "recurring principle"), counted(f, "Reel idea")])} to film.${done.shown === false ? "" : " It is shown in Finder: drop it on the BRIMM Ops page."}`);
  // On an open-lock Mac a hand-off whose copy could not be made is not shown in Finder (reveal.js).
  if (done.shown === false) ctx.say(cantOpen(name));
  return 0;
}

// The guide (spec 2026-10-25): the one next step for each video under way, in her words. guide.js says the steps, from what is
// read here of each video, as `episodes` and `status` read it.

/** A video's newest hand-off, as the guide reads it (guide.js, as opsNext takes it): { id, revision, kind, emptyAt, at, file }, or
    null while none is written. It is read from the file its finish wrote (`finished.handoff`), and only when that is whole on this
    Mac (`ctx.isWhole`), since Dropbox would otherwise have to bring it. One that is not, cannot be read, or names no id, revision
    or kind that brimm-video gives is read from the record: under the id its versions lead to when it is handed off as version 2
    (`v2`, finish.js linksOf firstOf), its own otherwise, at the revision and of the kind the record says. A version 1 hand-off
    says "episode" of a raw one. `emptyAt` is the empty revision of a video that was a session after all, for a session's hand-off: it stays on the
    record when the session's own hand-off, a later revision, is written, since finish.js does not change it. */
function guideHandoff(ctx, e, r, links, v2) {
  const done = r.finished;
  if (done === null || typeof done !== "object") return null;
  const file = typeof done.handoff === "string" && done.handoff !== "" ? join(e.folder, done.handoff) : "";
  const h = file && ctx.isWhole(file) ? recordAt(file) : null;
  const id = handoffIdIn(h);
  const kind = !id ? null : h.version === VERSION_2 ? h.video.kind : h.episode.kind === "episode" ? "raw" : h.episode.kind;
  const read = ["finished", "raw", "short video", "session"].includes(kind) && Number.isInteger(h.revision)
    ? { id, revision: h.revision, kind, file: h.main && typeof h.main.file === "string" ? h.main.file : "" }
    : { id: v2 ? links.firstOf(r, e.folder) : r.id, revision: done.revision, kind: recordKind(r), file: "" };
  const empty = r.session !== null && typeof r.session === "object" ? r.session.emptyRevision : undefined;
  return { ...read, emptyAt: Number.isInteger(empty) && read.kind === "session" ? empty : null, at: Date.parse(done.at) };
}

/** A time the guide works out, such as when a video should be ready, on this Mac's clock to the nearest minute, as aboutLeft
    rounds how long is left. A due time, such as when the late check is made, is said as the clock shows it (clockAt). */
const clockNear = (ms) => clockAt(Math.round(ms / 60000) * 60000);

/** Where Claude's reading of a video has got, for the guide: { reading, readsAt, roughAt }. "done" once the reading that counts is
    in the record (currentReading; a session's, sessionReading); "later" for a raw video whose reading waits for the import's late
    check, also while this Mac's reading of it runs but the check still holds it: Claude starts at the time the check is due
    (`readsAt`, on this Mac's clock), and its rough cut should be ready about `roughAt` (clockNear), by the speeds this Mac
    measured (`rates`, guide.js roughIn), "" while one is not known; "running" while this Mac's detached reading is at work on it (`running`, the
    command runningCommand says), with no time, since when the run began is not kept; "failed" when the reading this Mac last ran
    of it since her answer (a session's, since its teachings were asked for) did not end well; and "none" otherwise. A result's
    `started` is in milliseconds and the record's times are text: each is read as a time before they are compared. */
function guideReading(ctx, e, r, kind, running, rates) {
  if (kind === "session" ? sessionReading(r) : currentReading(r)) return { reading: "done" };
  const due = kind === "raw" ? lateCheckAt(ctx, r) : null;
  /** A raw reading that waits for the import's late check: when Claude starts, and when its rough cut should be ready. */
  const later = () => {
    const rough = roughIn(rates, r.video && r.video.seconds);
    return { reading: "later", readsAt: clockAt(due), roughAt: rough === null ? "" : clockNear(due + rough * 1000) };
  };
  if (running === "read") return due === null ? { reading: "running" } : later();
  const result = readResult(ctx.home, e.name, "read");
  const since = Date.parse(kind === "session" ? r.session && r.session.asked : r.answer.at);
  if (result && result.ok === false && result.started >= since) return { reading: "failed" };
  return due === null ? { reading: "none" } : later();
}

/** The working copy's run, for the guide (plan PR 10; guide.js VideoFacts `copy`): { left, usual } while this Mac's run makes the video for
    HyperFrames of the episode, that is while its lock (workcopy.js workCopyLockOf) is held by a live process, and null otherwise. `left`
    is the seconds left as the panel's file for that very process says (panelRuns), as of when the panel last wrote it, with the time
    since taken off; null when it says none, or the time has run out. `usual` is how long the step usually takes, by the speed this Mac
    measured for it (`rates`, guide.js copyIn) and the recording's length, null while either is not known. A Reel's video is made under
    the same lock, and is not told from the main video's. */
function guideCopy(ctx, e, r, rates) {
  const run = runningRun(ctx.home, e.name, ctx.alive, workCopyLockOf(ctx.home, e.name));
  if (!run) return null;
  const panel = panelRuns(ctx).find((p) => p.pid === run.pid);
  const since = panel && Number.isFinite(panel.updated) ? Math.max(0, ctx.now() - panel.updated) / 1000 : 0;
  const fresh = (s) => (Number.isFinite(s) && s - since > 0 ? Math.round(s - since) : null);
  const left = panel ? readyIn({ left: fresh(panel.left), total: fresh(panel.total), n: panel.n, of: panel.of }) : null;
  return { left, usual: copyIn(rates, r.video && r.video.seconds) };
}

/** The episode's main project in use, for the guide (plan PR 10; guide.js VideoFacts `project`): { opened, last, exported }, or null when
    the record has none, or its folder is not on this Mac. `opened` is whether the record lists a time the app opened it; `last` the time
    of the last turn in the project's `.hyperframes/app-history.jsonl` in words (app-history.js turnTime, in the zone a test gives as
    `deps.app.tz`), "" when the app has kept none that can be read; `exported` whether it has an export that began after its last change,
    as `finish` finds one (exports.js exportsFound and lookForExports, for the main video alone): in Downloads, by the app's own record in
    the project's renders/, or in what the other Mac released. A Downloads folder this Mac will not let be read, or any trouble in reading,
    is no export seen: the guide only reads, and `finish` tells her what it needs. */
function guideProject(ctx, e, r) {
  const main = (r.app?.projects ?? []).find(inUse);
  if (!main || !plainName(main.name)) return null;
  const dir = join(episodeWork(ctx.home, e.name), main.name);
  try {
    if (!statSync(dir).isDirectory()) return null;
  } catch (err) {
    return null;
  }
  const last = turnsOf(historyTail(dir)).reduce((latest, turn) => Math.max(latest, Date.parse(turn.at)), -Infinity);
  let exported = false;
  try {
    const seen = exportsFound({ home: ctx.home, name: e.name, folder: e.folder, record: { ...r, app: { ...r.app, projects: [main] } }, zone: ctx.deps.zone, readdir: ctx.deps.readdir });
    exported = !seen.unreadable && lookForExports(seen.input, {}, { rest: false }).parts.some((part) => part.key === "main" && part.video !== null);
  } catch (err) {
    exported = false;
  }
  return { opened: Array.isArray(main.opened) && main.opened.length > 0, last: Number.isFinite(last) ? turnTime(last, { tz: ctx.deps.app?.tz, now: ctx.now() }) : "", exported };
}

/** A session, as the guide reads it (guide.js VideoFacts `session`): her choice of what she wants from it, whether this Mac can
    read teachings now, how many of its items she has still to keep, drop or change, and whether its empty revision is still owed
    (revisionOwed). Its items are counted from its teachings file, read only when it is whole on this Mac: one that is not, or that
    cannot be read, counts as one undecided, so that the guide never says every item is decided of what it could not see. */
function guideSession(ctx, e, r) {
  const mark = r.session !== null && typeof r.session === "object" ? r.session : {};
  const got = readTeachings(e.folder, r, ctx.isWhole);
  const items = itemsOf(got.teachings, r.session);
  const undecided = got.coming !== undefined || got.why !== undefined ? 1 : ITEM_LISTS.reduce((n, [key]) => n + items[key].filter((item) => typeof item.approved !== "boolean").length, 0);
  return { choice: mark.teachings ?? null, teachingsOn: teachingsOn(ctx.settings, ctx.now()), undecided, emptyOwed: revisionOwed(r) };
}

/** What the guide reads of the answered video `e` (episodeAt's) in Episodes (guide.js VideoFacts), from its record in force and
    what this Mac holds of it, and the speeds this Mac measured (`rates`, progress.js readRates). A gated video is named as `episodes` names it (listedAs: by its label and short id), and is found
    only by its label, its id or short id, and the name it is listed by (gatedName, of gatedRecord); never by its folder or a name
    given to it, which may be its file's. Any other is named by its name and short id, and found by its folder's name too. */
function guideFacts(ctx, e, links, rates) {
  const r = e.inForce;
  const kind = recordKind(r);
  const hidden = isGated(e);
  const away = heldElsewhere(r, ctx.machine);
  const v2 = writesV2For(ctx.settings, e.folder, r);
  const running = runningCommand(ctx.home, e.name, ctx.alive);
  const pushed = r.main.pushed;
  const handoff = guideHandoff(ctx, e, r, links, v2);
  // The way `finish` goes for a raw video and an iPhone clip (plan PR 10), so that the guide never sends one where `finish` will not take
  // it: its Final Cut stages are for the Final Cut way alone. What the HyperFrames way reads of the disk (the video being made, the
  // project, its history and exports) is read for those two kinds only, and the project's not once a hand-off is written. A video the
  // gate holds (a session not cleared whatever its kind, or one held beside a session) has no way, and nothing of it is read (review I2).
  const way = !hidden && (kind === "raw" || kind === "short video") ? finishWay(ctx, r) : "";
  return {
    name: hidden ? listedAs(ctx, e) : withShortId(r.name.text, r),
    id: r.id,
    aliases: [typeof r.label === "string" ? r.label : "", r.id, r.id.slice(-6), hidden ? gatedName(gatedRecord(e), e.held) : shownName(r), ...(hidden ? [] : [r.name.text, e.name])].filter(Boolean),
    at: Date.parse(r.imported.at),
    mac: away ? away.by : "",
    drop: null,
    conflicted: e.read.code === "CONFLICTED",
    kind,
    waiting: kind === null && r.answer.state === "needs your answer",
    heldAsSession: e.held && !gated(r),
    elsewhere: Boolean(away),
    readingsOff: ctx.settings.readings === false,
    ...guideReading(ctx, e, r, kind, running, rates),
    offersAnswered: answerOf(r) !== null,
    v2,
    app: Boolean(appOf(ctx.settings)),
    placeholder: r.name.placeholder === true,
    shownInFinalCut: pushed.length > 0 && !newestIsRender(r, "main"),
    finishRunning: running === "finish",
    shownSinceFinish: Boolean(r.finished) && pushed.some((p) => p.how !== "render" && Date.parse(p.at) > Date.parse(r.finished.at)),
    gated: kind !== "session" && sessionNotCleared(r),
    way,
    copy: way ? guideCopy(ctx, e, r, rates) : null,
    project: way && !handoff ? guideProject(ctx, e, r) : null,
    session: kind === "session" ? guideSession(ctx, e, r) : null,
    handoff,
    // For `guide tell` alone, which follows a video from its drop folder into Episodes by it: never said.
    source: r.video && typeof r.video.file === "string" ? { mac: r.imported && r.imported.on, file: r.video.file, bytes: r.video.bytes } : null
  };
}

/** The runs this Mac's progress panel shows now (progress.js): each run's file in the panel's folder, whose process is alive. One
    being written, or that cannot be read, is passed over, as `status` passes it over. */
function panelRuns(ctx) {
  let names = [];
  try {
    names = readdirSync(progressFolder(ctx.home)).filter((n) => /^\d+\.json$/.test(n)).sort();
  } catch (e) {
    return [];
  }
  return names.flatMap((name) => {
    try {
      const run = JSON.parse(readFileSync(join(progressFolder(ctx.home), name), "utf8"));
      return run !== null && typeof run === "object" && ctx.alive(run.pid) ? [run] : [];
    } catch (e) {
      return [];
    }
  });
}

/** The videos in the drop folders of the Macs (dropFolders), as the guide reads them: guide.js VideoFacts, with `drop`, `id` ""
    and `kind` null. How far a video has got is read from the statuses of its Mac's imports of it, a running import and a hold
    only at the video's size, as heldBy takes them: one dropped again under the same name is another recording. Its import did
    not finish ("retry") when one failed, found a problem in its late check or stopped; it is a Zoom download held there ("zoom");
    it is being imported ("importing", at its status's step); or it is still coming in ("arriving"). A video an episode holds is
    imported, and the records say where it has got: it is left out, unless its import is to be tried again. Each is named by its
    label, else by what it is and its size, never by its file's name, which may be a client's: two of one size with no label yet
    are told apart by when they came (guide.js apart). It came when this Mac's import first saw it (seen.json), as `episodes`
    says, else at its ctime. How long is left comes from this Mac's panel, for this Mac's own video alone: a run there under the
    label of the other Mac's video is this Mac's, and says nothing of that one: as of when the panel last wrote the run, with the
    time since taken off. And when it should be Ready, from the same run (guide.js readyIn), on this Mac's clock to the nearest
    minute (clockNear). */
function guideDrops(ctx) {
  const now = ctx.now();
  const statuses = readStatuses(ctx.root, now);
  const seen = readSeen(ctx.home);
  const runs = panelRuns(ctx);
  const videos = [];
  for (const { mac, folder } of dropFolders(ctx)) {
    let names = [];
    try {
      names = readdirSync(folder).filter(isMedia).sort();
    } catch (e) {
      continue;
    }
    for (const video of names) {
      const found = ctx.stat(join(folder, video));
      if (!found) continue;
      const mine = statuses.filter(({ status }) => status && status.video === video && status.machine === mac && (!["running", "held"].includes(importState(status, now)) || status.bytes === found.size));
      const states = mine.map(({ status }) => importState(status, now));
      const running = mine.find(({ status }) => importState(status, now) === "running");
      const state = states.some((s) => ["failed", "problem", "stopped"].includes(s)) ? "retry" : states.includes("held") ? "zoom" : running ? "importing" : "arriving";
      if (state !== "retry") {
        const holding = holdingEpisode({ root: ctx.root, video, bytes: found.size });
        if (holding && !holding.unknown) continue;
      }
      const here = mac === ctx.machine;
      const label = labelIn(mine, video, mac);
      const run = here && label ? runs.find((r) => r.video === label) : undefined;
      const noted = here ? seen[seenKey(video, found)] : undefined;
      // The panel writes a run's times when a step starts and as its percent moves: they are as of `updated`, not now. What has
      // passed since is taken off, and a time that has run out is not said.
      const since = run && Number.isFinite(run.updated) ? Math.max(0, now - run.updated) / 1000 : 0;
      const fresh = (s) => (Number.isFinite(s) && s - since > 0 ? Math.round(s - since) : null);
      const times = run ? { left: fresh(run.left), total: fresh(run.total), n: run.n, of: run.of } : null;
      const ready = times ? readyIn(times) : null;
      const drop = { here, state, step: state === "importing" ? running.status.step : "", left: times ? times.left : null, total: times ? times.total : null, readyAt: ready === null ? "" : clockNear(now + ready * 1000) };
      // `source` is for `guide tell` alone, which follows the video by it: never said.
      videos.push({ name: label || capital(unlabelled(video, found.size)), id: "", aliases: label ? [label] : [], at: noted && Number.isFinite(noted.at) ? noted.at : found.ctimeMs, mac: here ? "" : mac, drop, kind: null, handoff: null, source: { mac, file: video, bytes: found.size } });
    }
  }
  return apart(videos, clockAt);
}

/** The videos the guide speaks of, from the drop folders (guideDrops) and Episodes: { items, old }. Each item (guide.js Item) is a
    video in a drop folder, or an answered video, with what was read of it and its one next step, from her notes on this Mac
    (guide-note.js) and the time now. An episode with no record that can be read, one a newer brimm-video wrote, an archived one
    and one she left alone are passed over; one from before the switch, which has no answer, is counted in `old`, and not guided.
    Of the versions of a video handed off under one id, the BRIMM Ops page's step is said once, for the one with the newest
    hand-off: the highest revision, and of two at one revision the later written. Another is passed over when its own next step
    is that page's, or it has none; one whose step is brimm-video's or hers (held as a session, conflicted, shown in Final Cut
    again since its finish) stays. Her notes, the versions of every video and this Mac's measured speeds are read once. */
function guideItems(ctx) {
  const notes = readGuideNotes(ctx.home);
  const links = linksOf(ctx.root);
  const rates = readRates(progressFolder(ctx.home));
  const items = guideDrops(ctx).map((facts) => ({ facts, next: nextFor(facts, notes, ctx.now()), folder: null, record: null }));
  let old = 0;
  for (const name of folders(ctx)) {
    const e = episodeAt(ctx, name, links);
    const r = e.inForce;
    if (!r || e.newer || r.archived || leftAlone(r)) continue;
    if (r.answer === null || typeof r.answer !== "object") {
      old += 1;
      continue;
    }
    const facts = guideFacts(ctx, e, links, rates);
    items.push({ facts, next: nextFor(facts, notes, ctx.now()), folder: e.folder, record: r });
  }
  const newest = new Map();
  for (const item of items) {
    const h = item.facts.handoff;
    const best = h ? newest.get(h.id) : undefined;
    if (h && (!best || h.revision > best.facts.handoff.revision || (h.revision === best.facts.handoff.revision && h.at > best.facts.handoff.at))) newest.set(h.id, item);
  }
  const own = (item) => !item.next.done && item.next.stage !== "ops";
  return { items: items.filter((item) => !item.facts.handoff || newest.get(item.facts.handoff.id) === item || own(item)), old };
}

/** A folder opened in Finder for the guide, as `which` opens QuickTime Player, and said as `what` is, in Finder words (`words`).
    One not on this Mac is refused with `missing`. One Finder could not open is refused too, and why is never said: it may hold
    a path. */
function openFolder(ctx, folder, what, words, missing) {
  if (!ctx.stat(folder)) return refuse(ctx, missing);
  try {
    ctx.openApp("Finder", folder);
  } catch (e) {
    return refuse(ctx, `Finder could not open ${what}: ask Jason.`);
  }
  ctx.say(`Opened ${what} in Finder: ${words}.`);
  return 0;
}

/** `guide page`: the BRIMM Ops page (OPS_PAGE), opened in her default browser through this Mac's program runner. */
async function openPage(ctx) {
  const ran = await (ctx.deps.run || runProgram)("/usr/bin/open", [OPS_PAGE]);
  if (ran.code !== 0) return refuse(ctx, "The BRIMM Ops page could not be opened: ask Jason.");
  ctx.say("Opened the BRIMM Ops page in your browser.");
  return 0;
}

/** `guide "<video>" show`: what the video's next step on the BRIMM Ops page needs, shown in Finder (showInFinder). For `posted`
    it is the video to post: a raw episode's Share in final/, which its hand-off names, and any other's the copy of the video she
    dropped. For any other step it is the hand-off. The chat is told only what it is, never its file's name, which may be a
    client's. A step that is not the page's has nothing to show; a file not on this Mac, or one its hand-off does not name, is
    refused. */
async function showForStep(ctx, { facts, next, folder, record }) {
  if (next.done || next.stage !== "ops") return refuse(ctx, `There is nothing to show in Finder for ${facts.name} now.`);
  const video = next.step === "posted";
  const where = !video ? [record.finished.handoff] : facts.handoff.kind === "raw" ? ["final", facts.handoff.file] : [record.video.file];
  const what = `the ${video ? "video" : "hand-off"} of ${facts.name}`;
  const path = where.every((part) => typeof part === "string" && part !== "") ? join(folder, ...where) : "";
  if (!path || !existsSync(path)) return refuse(ctx, `${capital(what)} is not on this Mac: ask Jason.`);
  // On an open-lock Mac the video to post is shown as a clone of it, made only of one whole on this Mac (cloneWhole, as `which`):
  // one that is not, Dropbox is had bring over first, as `show` does.
  if (video && lockFor(ctx.settings, ctx.deps) === "open" && !ctx.isWhole(path)) {
    const name = basename(folder);
    if (runningCommand(ctx.home, name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: name, args: [where.join("/")] });
    return refuse(ctx, "Dropbox is still bringing it over; say it again when it is done.");
  }
  const clone = video ? (from, to) => {
    if (!ctx.isWhole(from)) throw new Error("it is not whole on this Mac");
    cloneWhole(ctx, from, to);
  } : undefined;
  if (!(await showInFinder(ctx, { record, label: shownName(record), path, clone }))) return refuse(ctx, cantOpen(shownName(record)));
  ctx.say(`Shown in Finder: ${what}${video ? ", to post" : ""}.`);
  return 0;
}

/** Her notes on this Mac (guide-note.js), with `change` made to them, written whole: 0, or 1 when they could not be written, which
    is said by the error's code alone. */
function noteGuide(ctx, change) {
  try {
    writeGuideNotes(ctx.home, change(readGuideNotes(ctx.home)));
  } catch (e) {
    return refuse(ctx, `Not noted: this Mac's note could not be written (${(e && e.code) || "an error"}). Ask Jason.`);
  }
  return 0;
}

/** `guide "<video>" done <step>`: her word that she did the video's next step on the BRIMM Ops page, noted on this Mac by its
    hand-off's id (noteAfter). Only the step that comes next is taken: a video that is done, one whose next step is brimm-video's
    or hers, or another step is refused with the step that comes next, and her word is never said again. Once it is noted, the
    video is read again, and its next step said. */
function noteDone(ctx, { facts, next }, step) {
  if (next.done) return refuse(ctx, `Not noted: ${facts.name} is done: nothing is left to do for it.`);
  if (next.stage !== "ops") return refuse(ctx, `Not noted: ${facts.name} has no step on the BRIMM Ops page now. ${next.text}`);
  if (step !== next.step) return refuse(ctx, `Not noted: the next step for ${facts.name} is ${next.step}. ${next.text}`);
  const handoff = facts.handoff;
  const at = localStamp(new Date(ctx.now()));
  if (noteGuide(ctx, (notes) => ({ ...notes, handoffs: { ...notes.handoffs, [handoff.id]: noteAfter(handoff, notes.handoffs[handoff.id], step, at) } })) !== 0) return 1;
  ctx.say(`Noted: ${facts.name}, ${step}.`);
  // The version she noted has the newest hand-off under its id, and is read again; only a newer one come in since would take its
  // place, and then nothing more is said.
  const again = guideItems(ctx).items.find((item) => item.facts.id === facts.id);
  for (const line of again ? videoLines(again) : []) ctx.say(line);
  return 0;
}

/** `guide "<video>" finished`: her word that she is done with an answered video, noted on this Mac by its record's id, so that it
    is no longer under way. A video still in a drop folder has no record to note it by. A step that nothing noted can skip (guide.js
    nextFor: a conflict, her answer, a version held as a session, a session after all's withdrawal) is said instead, and nothing is
    noted. */
function noteFinished(ctx, { facts }) {
  if (facts.id === "") return refuse(ctx, `${facts.name} is not imported yet: there is nothing to set aside.`);
  const at = localStamp(new Date(ctx.now()));
  const notes = readGuideNotes(ctx.home);
  const then = nextFor(facts, { ...notes, finished: { ...notes.finished, [facts.id]: at } }, ctx.now());
  if (!then.done) return refuse(ctx, `Not noted: ${facts.name} cannot be set aside until this is done. ${then.text}`);
  if (noteGuide(ctx, (notes) => ({ ...notes, finished: { ...notes.finished, [facts.id]: at } })) !== 0) return 1;
  ctx.say(`${facts.name} is no longer under way.`);
  return 0;
}

/** The guide's overview of what guideItems read: this Mac's drop folder in Finder's words, each video under way with its one next
    step, and how many videos from before the switch it does not guide. */
function sayOverview(ctx, { items, old }) {
  for (const line of overviewLines({ drop: dropWords(ctx.settings.drop, ctx.machine), items, old })) ctx.say(line);
  return 0;
}

/** How the guide waits: the clock's stand-in in a test, else a timer. */
const sleepOf = (ctx) => ctx.deps.wait || ((ms) => new Promise((done) => setTimeout(done, ms)));

/** `guide wait`: what the guide says is read again every POLL_MS, for up to WAIT_MS, until it changes (signatureOf: a video come
    or gone, a stage passed, an import's next step), and then the overview is said. With no change in that time it says so, then
    the overview all the same. The time left, or a file still coming in, is no change. It answers at once when no video is
    coming in, being imported or being read (guide.js COMING). */
async function waitForChange(ctx) {
  const wait = sleepOf(ctx);
  const start = ctx.now();
  let read = guideItems(ctx);
  // Nothing is on its way, so nothing will change by itself: the guide answers at once.
  if (!read.items.some(({ next }) => !next.done && COMING.includes(next.stage))) return sayOverview(ctx, read);
  const was = signatureOf(read.items);
  while (ctx.now() - start < WAIT_MS) {
    await wait(Math.min(POLL_MS, WAIT_MS - (ctx.now() - start)));
    read = guideItems(ctx);
    if (signatureOf(read.items) !== was) return sayOverview(ctx, read);
  }
  ctx.say(`Nothing has changed in ${WAIT_MS / 1000} seconds.`);
  return sayOverview(ctx, read);
}

/** `guide "<video>" tell`: the video's next point (guide.js told), waited for in the background (her skill runs it with the Bash
    tool's run_in_background), and said in one line when it comes: it is ready, Claude has read it, or its import or its
    reading did not finish. What the guide says is read again every TELL_POLL_MS, for up to TELL_MS, following the video from its
    drop folder into Episodes (follow). A video with nothing on its way gets its next step at once, and one still on its way
    after TELL_MS gets that said, with its next step. Nothing is said before the end, and no notice is posted: the import and the
    reading post their own. */
async function tellWhen(ctx, item) {
  const wait = sleepOf(ctx);
  const start = ctx.now();
  let trail = trailOf(item.facts);
  let seen = item;
  let line = told(item, item, item);
  while (line === null && ctx.now() - start < TELL_MS) {
    await wait(Math.min(TELL_POLL_MS, TELL_MS - (ctx.now() - start)));
    const found = follow(trail, guideItems(ctx).items);
    line = told(item, seen, found ? found.item : null);
    if (found) ({ trail, item: seen } = found);
  }
  ctx.say(line ?? stillLine(seen));
  return 0;
}

/** `guide ["<video>" [show | finished | tell | done <step>]]`, `guide drop [zoom]`, `guide page` and `guide wait`: the guide, on a Mac
    that does the light import. On any other, every form says only to ask Jason (NOT_SET_UP), since there Claude reads every
    video as it lands. With no words, the overview: this Mac's drop folder in Finder's words, each video under way with its one
    next step, and how many videos from before the switch it does not guide. `drop` opens this Mac's drop folder in Finder, and
    `drop zoom` Zoom Video Transfer, beside BRIMM Video; `page` opens the BRIMM Ops page; `wait` waits up to 90 seconds for a
    change in what the guide says, then says the overview: at once when no video is coming in, being imported or being read. With a video, by its name, its label or its id, its next step, and for
    a step on the BRIMM Ops page the one after it; with `show`, what that step needs, in Finder; with `done <step>`, her note that
    she did that step, the one that comes next; with `finished`, her note that she is done with it; with `tell`, its next point,
    waited for up to 60 minutes and said in one line. Words that fit no video, or more than one, are refused, and never said
    again: they may hold a client's name. */
export async function guideCommand(ctx, rest) {
  if (!lightImport(ctx.settings)) return refuse(ctx, NOT_SET_UP);
  const is = (...words) => rest.length === words.length && words.every((word, i) => rest[i] === word);
  if (is("drop")) return openFolder(ctx, dropFolder(ctx.root, ctx.machine, ctx.settings.drop), "your drop folder", dropWords(ctx.settings.drop, ctx.machine), "Your drop folder is not there: ask Jason.");
  if (is("drop", "zoom")) return openFolder(ctx, join(dirname(ctx.root), "BRIMM VIDEO Transfer", "Zoom Video Transfer"), "Zoom Video Transfer", ZOOM_WORDS, "Zoom Video Transfer is not on this Mac: ask Jason.");
  if (is("page")) return openPage(ctx);
  if (is("wait")) return waitForChange(ctx);
  // The form, after a video: "" for its next step, "show", "finished", "tell", or "done" with the step.
  const form = rest.length < 2 ? "" : rest.length === 2 && ["show", "finished", "tell"].includes(rest[1]) ? rest[1] : rest.length === 3 && rest[1] === "done" ? "done" : null;
  if (form === null) {
    ctx.say(HELP);
    return 2;
  }
  const { items, old } = guideItems(ctx);
  if (!rest.length) return sayOverview(ctx, { items, old });
  const found = findIn(items, rest[0]);
  if (found.why) return refuse(ctx, found.why);
  if (form === "show") return showForStep(ctx, found.item);
  if (form === "done") return noteDone(ctx, found.item, rest[2]);
  if (form === "finished") return noteFinished(ctx, found.item);
  if (form === "tell") return tellWhen(ctx, found.item);
  for (const line of videoLines(found.item)) ctx.say(line);
  return 0;
}

/** The commands, by the word a person's request is run with. `read` is a detached run's alone (`kind` and `teachings` start it),
    and so is `workcopy` (`kind` and `app` start it): both are in no help. */
const COMMANDS = { episodes: (ctx) => episodes(ctx), guide: guideCommand, kind: kindCommand, leave: leaveCommand, which: whichCommand, read, workcopy, open, app, push, bring, status, retry, name, title, reel, reels, ask, finish, release, show, behind: (ctx) => behind(ctx), resolve: resolveConflict, free, spell, logo, captions, text, graphic, preset, cut, teachings: teachingsCommand, principles, ideas };
/** The commands' names. Sallie's skill runs only these (tests/studio.test.js). */
export const COMMAND_NAMES = Object.keys(COMMANDS);

/** What `node edit.js` does. Resolves 0 when it did what it was asked, 1 when it refused or something failed, and 2 when it
    was asked wrongly or this Mac is not set up. */
export async function editMain(argv, deps = {}) {
  const say = deps.say || ((line) => process.stdout.write(`${line}\n`));
  const [command, ...rest] = argv;
  if (command === "--help" || command === "-h") {
    say(HELP);
    return 0;
  }
  const made = contextFor({ ...deps, say });
  if (made.why) {
    // A Mac with no settings for episodes can still have her folder, and the lock on it is looked at all the same, for the checkout
    // this edit.js runs from.
    const refused = command === "behind" ? refuseIfLoosened({ home: homeOf(deps), checkout: dirname(dirname(fileURLToPath(import.meta.url))), deps }, say) : null;
    if (refused !== null) return refused;
    say(made.why);
    return 2;
  }
  // A command is one of COMMANDS' own names: a name every object has ("constructor", "toString") is no command.
  const run = typeof command === "string" && Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : null;
  if (!run) {
    say(HELP);
    return 2;
  }
  // The command and its words are on ctx, so that findEpisode, which every command finds its episode by, asks the gate (gate.js)
  // before the command goes on: the folder a detached run is given by `--now` is found by it too.
  const ctx = { ...made, asked: { command, words: rest } };
  // Under Claude Code, each command first takes away the words files a day old (held.js clearOldWords).
  if ((ctx.deps.env || process.env).CLAUDECODE === "1") clearOldWords(ctx.home, ctx.now());
  let code;
  try {
    code = await run(ctx, rest);
  } catch (e) {
    // Something nobody foresaw stopped a command that found a video not yet answered, or a session, or a record of the switch, or
    // any command on a Mac that does the light import, where any video's file may be named for a client: its error may name the
    // video's file or folder, as a path does, so only its code is said, through the filter, and the command ends there. Any other
    // is thrown as it always was.
    if (!ctx.hidden.names.length && !ctx.hidden.switched && !lightImport(ctx.settings)) throw e;
    ctx.say(`The work stopped (${(e && e.code) || "an error"}).`);
    code = 1;
  }
  // A session's words the command said on an open-lock Mac go into the chat's words file, and the chat is told the file.
  return handOverWords(ctx, code);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Inside Claude Code's sandbox nothing runs: it would fail partway through a command (sandboxed.js). The check is the open lock's:
  // a Mac whose lock in effect is strict runs edit.js as it did before the open lock was built, and never asks ps.
  const open = effectiveLock(readSettings(homeOf({})).settings ?? null) === "open";
  const sandboxed = open ? sandboxedWhy({ env: process.env, pid: process.pid, spawn: spawnSync }) : "";
  if (sandboxed) {
    process.stdout.write(`${sandboxed}\n`);
    process.exitCode = 1;
  } else {
    editMain(process.argv.slice(2)).then((code) => {
      process.exitCode = code;
    });
  }
}

