#!/usr/bin/env node
// The command line for episodes, which a Claude Code session on this Mac runs for the person editing: it lists the episodes and
// what is waiting, opens one, opens its main video in the HyperFrames app, says what is running, and imports a video again. Each
// command is a function of a context, `ctx`, that holds this Mac's settings and the ways of doing things a test gives stand-ins for. Every file it puts into Dropbox goes
// by the rule (dropbox.js), and every change to an episode is a new record (episode.js). Long work is started detached and
// returns at once (detached.js).
//
//   node edit.js episodes                 the episodes, the videos waiting in the drop folders, the imports, and the
//                                         free space on this Mac's disk
//   node edit.js kind "<video>" finished|raw|clip|session --private yes|no
//                                         her answer to "what is this video?": claim it, record it, and start Claude's
//                                         reading (leave "<video>" and which "<video>" are its other two answers)
//   node edit.js open "<episode>"         check its files are here, bring over those that are not, and show what is
//                                         decided for it
//   node edit.js app "<episode>"          the same claim as open's, and then its main video in the HyperFrames app,
//                                         with its project made first (app.js)
//   node edit.js app "<episode>" reel <n> the same, for Reel n of the episode: its video cut from the recording, its project
//                                         made, and the Reel picked (app-reel.js)
//   node edit.js status ["<words>"]       what is running on this Mac, the imports, and what detached runs left
//   node edit.js retry "<video>"          import again a video in this Mac's drop folder whose import failed or stopped
//   node edit.js name, title, reel drop
//                                         the episode's name, its title, and its Reels
//   node edit.js finish "<episode>"       gather what HyperFrames exported, ask what it must, and then, detached,
//                                         transcribe again, copy into final/ and write the hand-off for BRIMM Ops
//   node edit.js finish "<episode>" reels the same for the Reels of a video her editor finished: the next revision of the
//                                         hand-off it has, with the Reels added (finish-reels.js)
//   node edit.js free "<episode>"         take the working copy and the renders of its HyperFrames projects away from this
//                                         Mac to give the room back, by named paths in BRIMM Video Work alone (free.js)
//   node edit.js refs [look "<name>" | use "<episode>" "<name>" [reel <n>]]
//                                         the reference folder (references.js): what is in it; a picture of it copied into her
//                                         Looking folder for Claude to look at; or copied into an episode's HyperFrames project
//                                         on this Mac to be followed as a style. Studio only reads the folder
//   node edit.js plan new "<title>" [--explainer [--voice sallie|heygen]]
//                                         plan a video before it is shot: an episode with no footage, filed in Episodes (plan.js)
//   node edit.js plan "<planned>" [set … | drop]
//                                         a planned video's package (its video guide, shot list and teleprompter script): said in
//                                         plain words, set whole in one record write, or dropped
//   node edit.js footage "<video>" "<planned>" talking|screen|b-roll --client yes|no [--shot <n>]
//   node edit.js footage "<video>" none   a video dropped for a planned video, answered as one of its parts (or taken back
//                                         until the plan is filmed): kept out of the lists, and out of any project while it
//                                         shows a client who has not agreed (footage.js)
//   node edit.js plan "<planned>" agreed "<video>"
//                                         a client's agreement to being shown in a part: noted from a dialog on this Mac that
//                                         only her click answers; who agreed stays on this Mac (footage.js)
//   node edit.js plan "<planned>" join ["<video>"…]
//                                         "that's all the footage": the plan's talking parts joined, in the order of its script,
//                                         into its video (join.js). The detached half, `join --now`, and the working copy's
//                                         `workcopy --now … --footage`, are runs of its own and in no help
//   node edit.js plan "<planned>" voice   "the HeyGen voice is done": the voice the app's agent made in a HeyGen explainer's
//                                         project taken in as the plan's video (explainer.js). `app` opens that project
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
import { homeRefusal, studioHome } from "./home.js";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stamp, localDay } from "./shared/text.js";
import { readEpisode, filesProblems, fileProblems, fileProblemWords, undone, writeEpisode, localStamp, acceptRev, shown as shownAt, claimed, heldElsewhere, heldText, conflictedCopies, conflictedOf, conflictedBy, recordFile, recordNumbers, otherNames, RECORD_DIR, isAnswered, isFromPlan, isPart, isPlannedRecord, shownName, currentReading, kindOf as recordKind } from "./episode.js";
import { appOf, effectiveLock, readSettings, teachingsOn, teachingsLapsed, lightImport, episodesFolder, workFolder, episodeWork, runsFolder, dropFolder, dropFolderOf, exportsFolderOf, exportsWords, folderWords, isLocal, studioAllowOf, importingFolderOf, statusFoldersOf } from "./settings.js";
import { MATCHED_SESSION, SESSION as SESSION_COMMANDS, SESSION_TAUGHT, UNSCOPED, gateFor, heldGateFor, printWhy, noFootageWhy, gated, leftAlone, sessionNotCleared, heldName, gatedName, gatedAsOf, withShortId } from "./gate.js";
import { isSeenLine, isZoomName, namesOf, sessionLabel, sizeText, spokenMac, unlabelled, withoutNames } from "./kinds.js";
import { aboutLeft, progressFolder, readRates, reporter } from "./progress.js";
import { startDetached, runDetached, runningCommand, runningRun, readResult, takeEpisodeLock, releaseEpisodeLock } from "./detached.js";
import { cloneIn, isWhole, onSameDisk, readThrough, replaceIn, textWriter, LATE_CHECK_MS } from "./dropbox.js";
import { fileSafe, timelineFile } from "./names.js";
import { REELS_FILE, readReels, reelsText, uncropped, notMadeWords } from "./reel-candidates.js";
import { readStatusesIn, importState, removeStatusIn, shownStep } from "./importing.js";
import { localSource, projectWaits, readingCheckAt, readingWaitsUntil, waitFacts } from "./late-wait.js";
import { fileId, heldBy, commitOf, thisCheckout, episodeHolding, holdingEpisode, readSeen, seenKey, readPendings, dueAt, statusReadFolders } from "./filing.js";
import { HAND_OFF_ASK, REELS_ASK, finishNow, finishFinished, finishSession, madeFromImport, importKind, whatIs, letGoClaim, cannotFinish, handoffTarget, writesV2For, numbersTakenWords, linksOf, matchedSession, handedOff, chainGap, chainGapWords, movedIdWords, ownHandoffs, handoffIdIn, reelsBase } from "./finish.js";
import { BRINGING, REEL_KEY, exportAgainWords, keepOldWords, nextHandoff, noReelWords, nothingNewWords, rawWords, reelsAsked, retitledReels } from "./finish-reels.js";
import { checkingNow, problemFlagged } from "./finish-check.js";
import { endedSinceYes, endedWithoutHandoff } from "./finish-ended.js";
import { handoffIn, videoSeconds } from "./finish-time.js";
import { DOWNLOADS_UNREADABLE, NEVER_OPENED, downloadsOnce, exportsFound, exportsUnreadable, lookForExports, readRegular } from "./exports.js";
import { mainWordsSaid, projectWordsIn, reelTitleAsk } from "./on-screen.js";
import { videoClock } from "./video-clock.js";
import { timelineAt } from "./clock.js";
import { spellingFault, withSpelling, respelledPart, respelledHandoff, respelledHandoffV2 } from "./spelling.js";
import { spelled } from "./final-transcript.js";
import { GRAPHIC_CUE_KINDS, SHOT_KINDS, graphicCuesOf, graphicCuesOfPlan, graphicCuesOfRecord, keptIndexes, keptPhraseSpans, placeGraphicCues } from "./graphic-cues.js";
import { handoffText, handoffFault } from "./handoff.js";
import { buildHandoffV2, handoffFaultV2, VERSION_2 } from "./handoff-v2.js";
import { findPrograms, askAgain, askBlocked, clockAt, facesIn, importHold, keptList, banner } from "./unedited.js";
import { readEpisodeNow, accountOf, askReelCues, READ_KINDS, READ_HOLD_MS, READ_LOOK_MS, rulesPlanKept } from "./reading.js";
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
import { NOT_SET_UP, OPS_PAGE, ZOOM_WORDS, WAIT_MS, POLL_MS, dropWords, dropUnreadable, noteAfter, nextFor, ordered, findIn, overviewLines, videoLines, signatureOf, readyIn, roughIn, copyIn, apart, COMING, TELL_MS, TELL_POLL_MS, trailOf, follow, told, stillLine } from "./guide.js";
import { readGuideNotes, writeGuideNotes } from "./guide-note.js";
import { NOT_SET_UP as APP_NOT_SET_UP, KEPT as PROJECT_KEPT, clipFolders, clipTrouble, copyAtWork, copyIsMade, footageFailed, guidanceOf, isMain as inUse, mediaOf, notWholeYet, openByItself, openInApp, plainName, projectOnAnotherMac, whenReadyLockOf } from "./app.js";
import { VOICEOVER, projectCues } from "./project.js";
import { openVoiceProject, voiceProjectWhy } from "./explainer.js";
import { REEL_COPY_KINDS, madeInApp, makeOneWords, notMadeYet, openReelInApp, openReelWords, reelAsked, reelNotWholeYet, reelStretch, reelWhy } from "./app-reel.js";
import { historyTail, mainProjectDir, toldTurns, turnTime, versionsOf, whatHappened } from "./app-history.js";
import { recordingPlacementsIn, timelineTranscript } from "./on-timeline.js";
import { freeEpisode } from "./free.js";
import { PIN, cliPath, toolchainDiffers, toolchainHolds, turnsOf } from "./hyperframes.js";
import { REEL_FACES_MS, WORK_COPY_COMMAND, WORK_COPY_STEP, WORK_COPY_WAIT_STEP, canNotBeUsed, makeFootageCopies, makeWorkCopy, requestWorkCopy, workCopyLimits, workCopyLockOf } from "./workcopy.js";
import { lookAt, referencesAsked, sayReferences, useIn } from "./references.js";
import { PLAN_FILE_NAMES, newPlan, planAsked, planFilesFrom, planFor, plannedLine, textArg } from "./plan.js";
import { HAND_EDITED, scriptHandEdited } from "./plan-script.js";
import { SHOT_SAID } from "./sentences.js";
import { footageAsked, footageCards, footageCounts, footageFor, labelOf as partLabelOf, partRefused, waitsForClient, partsOf as partsOfPlan, partsReader, planTitleOf } from "./footage.js";
import { afterJoin, joinRun } from "./join.js";
import { footageToUse, footageWithheld, planProject } from "./plan-project.js";
import { ON_OTHER_MAC, fileAt, filePlace, folderAt, keptOnAMac, onOtherMac, roleOf } from "./where.js";

/** The path of a file of the episode `found` (where.js fileAt): in its folder in Dropbox, or in its video/ folder on this Mac when its record keeps its own files there. */
const fileOf = (ctx, found, rel) => fileAt(ctx, { folder: found.folder, record: found.record ?? found.read?.record }, rel);

export const HELP = `The command line for episodes on this Mac. Claude runs it for the person editing.

  node edit.js episodes                 the episodes, the videos waiting in the drop folders, the imports, and the
                                        free space on this Mac's disk
  node edit.js guide ["<video>"]        the one next step for each video under way, in her words: a video waiting for her
                                        answer first, then the newest; this Mac's drop folder in Finder's words; and how
                                        many videos from before the switch are not guided. With a video, its next step,
                                        and for a step on the BRIMM Ops page the step after it. A raw video and an iPhone
                                        clip are followed through HyperFrames: while its video is made, how long is left;
                                        then to open it there; once it is open, when she last asked the app for something;
                                        and once it is exported, to hand it off. Once its finish has written the hand-off
                                        it gives the BRIMM Ops page's step, with a line of when Studio checks Dropbox's
                                        copies (a spelling and handing it off again wait until then),
                                        though the finish goes on checking them for a quarter of an hour. On a Mac
                                        that Jason has not set up for HyperFrames it says that this Mac is not set up,
                                        where it would say to open the video there or that its video is being made. A
                                        finished video whose hand-off is written is told to hand off the Reels once a Reel
                                        is exported from HyperFrames that the hand-off does not hold. A raw video that
                                        was edited in Final Cut before is told so, and to open it in HyperFrames, from the
                                        recording. A planned video (plan) is told
                                        to film it to its shot list, or for an explainer to record or choose its voice;
                                        once footage is in, what it has so far, and which part is waiting for a client's
                                        agreement. Only on a Mac that does the light import: on any other, every form says
                                        to ask Jason
  node edit.js guide drop [zoom] | page | wait
                                        open this Mac's drop folder in Finder (with zoom, Zoom Video Transfer), open the
                                        BRIMM Ops page in the default browser, or wait up to 90 seconds for a change in
                                        what the guide says: at once when no video is coming in, being imported, being
                                        read or having its video for HyperFrames made
  node edit.js guide "<video>" done <step> | finished | show | tell
                                        note on this Mac that she did its step on the BRIMM Ops page (only the step that
                                        comes next), that she is done with the video, or show in Finder what its step needs.
                                        With tell, wait up to 60 minutes for its next point (ready, read by Claude, its
                                        video for HyperFrames made, its finish's hand-off written, or an import, a reading
                                        or a finish that did not finish), then say it in one line. Her skill runs it in the
                                        background
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
  node edit.js leave "<video>"          leave a video that is not for BRIMM Video Studio: it is not asked about again
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
  node edit.js open "<episode>"         check its files are here, bring over those that are not, claim it for this
                                        Mac, and show what is decided for it. Another Mac's claim refuses it
  node edit.js app "<episode>"          open the episode's main video in HyperFrames, making its project first. Its
                                        files are checked and brought over, and it is claimed for this Mac, as open
                                        does; another Mac's claim refuses it. A project the other Mac made is not made
                                        again here: it is refused, and she carries on on that Mac. Only on a Mac that
                                        Jason has set up for HyperFrames
  node edit.js app "<episode>" reel <n>
                                        make Reel <n>, one of Claude's suggestions, a project of its own in HyperFrames,
                                        open it, and pick it. Its video, the suggestion's stretch of the recording, is
                                        made first: it is asked for, and the Reel is opened when it is said again. Its
                                        files are checked and brought over, and it is claimed for this Mac, as above.
                                        A Reel project the other Mac made is refused, as above. For a finished video
                                        too. Reels are made here, never by HyperFrames itself
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
                                        list the Reel candidates, and play an old preview in QuickTime Player where an
                                        older import left one; for a video she has answered, its Reel suggestions with times on the clock she is
                                        reading, and nothing opens; then how to make one in HyperFrames, on a Mac
                                        set up for it
  node edit.js ask "<episode>"          ask Claude again for Reel candidates, detached. Picked Reels stay as they are.
                                        A video she has answered is read again as its kind, as kind … --again does
  node edit.js finish "<episode>" [--yes] [--take "<part>=<file>"] [--final "<part>"]
                     [--without "reel <n>"] [--as-it-is]
                     [--on-screen "<words>"]… [--no-on-screen]
                                        find what HyperFrames exported of each part (in Downloads, in the exports folder
                                        this Mac picked, or where the export's own record says it went), and ask what it
                                        must; it stops, and says so, when this Mac will not let it look in either folder.
                                        --final says an export is the final one though the project changed after it. With
                                        --yes and nothing left to ask, it transcribes the finished videos again, copies them
                                        into final/ and writes the hand-off for BRIMM Ops, detached. It says when the
                                        hand-off will be ready, and returns once the run has begun (at most five seconds; it
                                        says so if none does). An iPhone clip she answered that was not opened in
                                        HyperFrames is asked about once; --as-it-is writes its hand-off from the import's
                                        captions. For a main video taken from an export it reads the words on its picture
                                        out of the HyperFrames project and asks if they are right (a --yes takes them only
                                        after a call has shown them), and a raw video's hand-off also holds the Reel
                                        suggestions that fall in it. --on-screen gives those words, once for each line in
                                        the order they appear, when she changes or drops one, and --no-on-screen says there
                                        are none. A Reel's title, when it has none, is asked with the Reel's first line
  node edit.js finish "<episode>" reels [--yes] [--take "reel <n>=<file>"] [--final "reel <n>"]
                     [--without "reel <n>"]
                                        for a video her editor finished: find the exports of the Reels made from it in
                                        HyperFrames (app … reel <n>), and ask what it must. With --yes and nothing left to
                                        ask, it transcribes them again, copies them into final/ and writes the next revision
                                        of the hand-off the video has already, under the same id: main, its suggestions and
                                        the Reels it holds as they were, with these Reels added, detached. It says when the
                                        hand-off will be ready, and returns once the run has begun (at most five seconds; it
                                        says so if none does). It never writes its first hand-off (the spellings do), and a
                                        Reel number is never given twice
  node edit.js show "<episode>" transcript|notes|plan
                                        print its transcript (a raw video's she has answered: its rough cut's, or, with a
                                        HyperFrames project in use, the recording's own), Claude's notes or its cut plan,
                                        whole. Of a video not yet answered, or a session, nothing is printed: a read-only
                                        copy of it opens in TextEdit on this Mac
  node edit.js behind                   whether Jason has a newer BRIMM Video Studio than this Mac's; and the copies show
                                        opened are cleared. It refuses, and says to ask Jason, when her folder's lock is
                                        changed on this Mac: a settings.local.json in it, or hooks turned off
  node edit.js resolve "<episode>" [--keep A|B]
                                        show the two sides of a conflicted copy Dropbox kept, and keep the one picked:
                                        the other is set aside in the episode's history/
  node edit.js free "<episode>"         take away, on this Mac, the video HyperFrames was given for the episode's main
                                        project and what it rendered for every project, to give the room back. Their projects
                                        and everything done in them stay, and app makes the main video again; a Reel's video
                                        and a kept project's stay, since nothing can make them again yet. It refuses while the
                                        other Mac has the episode, while HyperFrames is running or cannot be told, while
                                        something is at work on the episode, while a video HyperFrames rendered may be kept
                                        nowhere else (the episode is not handed off yet), and when the recording is not in the
                                        episode as the project was made from it: the video could not be made again. It takes
                                        no flag
  node edit.js spell "<episode>" [add "<as heard>" "<as spelled>" [add …]… | drop "<as heard>" | offers [all | none | <n> <n>…]]
                                        the episode's spellings; several pairs of
                                        add are one change; after a finish, the final transcripts too, and the hand-off is
                                        made again. offers shows the spellings Claude offered as one numbered card, or
                                        answers them (all, some or none), and a finished video's or an iPhone clip's
                                        hand-off is then written
  node edit.js graphic "<episode>" ideas [main | reel <n>]
                                        Claude's ideas for graphics, numbered, with their times on the video's own clock,
                                        the one HyperFrames shows. It changes nothing
  node edit.js refs                     what is in the reference folder: the pictures she can name as a style, and any
                                        other file in it, which Studio does not use. It writes nothing there
  node edit.js refs look "<name>"       copy the picture of that name from the reference folder into the Looking folder in
                                        her BRIMM Video Studio folder (a HEIC or TIFF picture as a JPEG), and say where it
                                        is, for Claude to look at. Her skill never repeats that to her
  node edit.js refs use "<episode>" "<name>" [reel <n>]
                                        copy the picture of that name from the reference folder into the episode's
                                        HyperFrames project on this Mac, the main video's or Reel n's, as a style to
                                        follow, and say what to say in HyperFrames to have it followed. The gate asks
                                        first, as for app; a finished video has no main project, a short video no Reels,
                                        and a project that is not on this Mac is to be opened first
  node edit.js plan new "<title>" [--explainer [--voice sallie|heygen]]
                                        plan a video before it is shot, from her script: an episode with no footage yet,
                                        filed in Episodes under the title she gives (at most 80 characters; a title already
                                        planned and not yet filmed is refused). With --explainer it is a video of graphics
                                        and words on screen alone, whose voice is hers or a HeyGen voice she picks in
                                        HyperFrames (--voice says which). Its guide, shot list and teleprompter script
                                        are made next, by plan … set
  node edit.js plan "<planned>" set [--cue "<kind> | <seconds> | <words> | <what to show>[ | <key>: <value>]…"]…
                     [--shot "<kind> | <what>"]… [--line "<paragraph>"]…
                                        replace the whole package of a planned video in one record write: its cues (kind
                                        graphic, words, b-roll or screen; seconds from 1 to 10; the words they go with;
                                        what they show; and the keys shot, ref, inspiration and link), its shots (talking,
                                        screen or b-roll) and the lines of its teleprompter script. A b-roll or screen cue
                                        names a shot of its own kind; an explainer has graphic and words cues and no
                                        shots; a ref is a picture in the reference folder. A double quote, a dollar sign,
                                        a percent sign, a backslash, a backtick or a pipe in a word is written %22, %24,
                                        %25, %5C, %60 or %7C, and a bare pipe splits a cue's parts. At most 60 cues, 40
                                        shots and 400 lines, of 2,000 characters at most. Every problem is said on its
                                        own line and nothing is saved. Saved, it makes video guide.md, shot list.md
                                        (none for an explainer) and teleprompter.txt in the plan's folder, each put in
                                        by the rule and the record last
  node edit.js plan "<planned>"         say a planned video's package in plain words: each cue, each shot and how long
                                        the teleprompter script is, and a line for each part of its footage
  node edit.js plan "<planned>" script  open the plan's teleprompter script in TextEdit as a copy to read, made on this
                                        Mac and read-only: changes to the script are told in the chat and saved with set
  node edit.js plan "<planned>" drop    drop a plan: it is archived, so that episodes and the guide no longer show it. A plan
                                        that has footage is dropped only once each piece is taken back, and one made from
                                        its footage already is not dropped
  node edit.js plan "<planned>" join ["<video>"…]
                                        for "that's all the footage": join the plan's talking parts, in the order of its
                                        script, into its video. With one talking part, or the parts named in the order she
                                        wants them, a detached run makes it (the parts joined by copying, the words read,
                                        the plan written as a raw video or an iPhone clip) and a notice comes when it is
                                        ready; with two or more and no order given, it says the order the script puts them
                                        in and starts nothing. Once they are joined no more talking parts can be added,
                                        but b-roll and screen recordings still can. An explainer has no footage to join:
                                        its voiceover, once answered, is taken in at once
  node edit.js plan "<planned>" voice   for "the HeyGen voice is done": take in the voice the app's agent made in a HeyGen
                                        explainer's project, once it plays one. A detached run copies it out, reads its
                                        words and makes the plan its video, a short video whose project is that one; a notice
                                        comes when it is ready
  node edit.js footage "<video>" "<planned>" talking|screen|b-roll --client yes|no [--shot <n>]
                                        answer a dropped video as footage for a planned video: talking to the camera, a
                                        screen recording or b-roll, and whether it shows a client, a client's name or their
                                        work. A screen recording or b-roll shows one shot of the plan's shot list, which is
                                        taken when the plan has one of its kind and otherwise named with --shot. It is
                                        answered on her two cards (the planned card and the part card), a receipt of each
                                        under Claude Code on a Mac whose lock is open, as kind is, and never for a Zoom
                                        download, a video that holds a client or group session's words, or one held beside a
                                        session. A part is kept out of episodes and the guide; it goes into no project while
                                        it shows a client who has not agreed
  node edit.js footage "<video>" "<planned>" voiceover [--not-a-session]
                                        answer a dropped recording of sound alone as the voiceover of an explainer in her
                                        voice, on the planned card and the not-a-session card: it is taken in at once as the
                                        plan's video
  node edit.js footage "<video>" none  take a video back from a planned video, until the plan is filmed: it waits for
                                        its answer again, with its cards
  node edit.js plan "<planned>" agreed "<video>"
                                        for footage that shows a client: notes, on a dialog on this Mac that only her click
                                        answers, that the client agreed to being shown in it. Who agreed stays on this Mac`;

/** The home folder commands work from: the one a test gives, else Studio's own (home.js: BRIMM_VIDEO_HOME, else HOME, else the Mac's own word for it). */
const homeOf = (deps) => deps.home || studioHome();

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
    // Where this Mac writes the statuses of its imports, and where every one is read (settings.js): its own folder and Episodes/.importing on a Mac
    // with a drop folder of its own, else Episodes/.importing alone.
    statuses: importingFolderOf(settings, home),
    statusFolders: statusFoldersOf(settings, home),
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
const newerName = (record) => `an episode a newer BRIMM Video Studio wrote (${record.id.slice(-6)})`;

/** Why a command ends at an episode written by a newer brimm-video, in the words it has always used: by its short id alone. */
const newerWhy = (record) => `That is ${newerName(record)}. Jason has a newer BRIMM Video Studio. Ask him to update this Mac.`;

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
      to a session or not answered: on every Mac, whatever its file says of the import (every import is light; Phase 3, L1d), it
      refuses every command.
    - An episode kept on another Mac (keptOn: a record it is known by holds `local` on another Mac, and none holds it on this one; Phase 3,
      L2, D3) is changed only there: every command is refused, in where.js ON_OTHER_MAC's one line, which names it as every line does and
      names that Mac, before anything else of it is asked or read, whatever this Mac's training gate says.
    - A conflicted episode is refused when any one of its records is, so that a copy not answered, or a session's, is not got round
      by the record in force. A copy that is not shaped as a record (recordShaped) is not asked.
    - A video held as a session (`e.held`: one of its other versions is a session not cleared) runs only what gate.js heldGateFor
      lets run, the commands of a video not yet answered. */
function gateOf(ctx, e, records, said, inForce) {
  if (!ctx.asked || UNSCOPED.includes(ctx.asked.command)) return null;
  const refused = (why, more = {}) => ({ why, name: e.name, folder: e.folder, gate: true, ...more });
  if (e.read.newer) return refused(newerWhy(e.read.record), { newer: true });
  if (inForce && recordNumbers(e.folder)[0] > inForce.rev) return refused(PENDING_WHY);
  const there = keptOn(ctx, e);
  if (there) return refused(ON_OTHER_MAC(isGated(e) ? gatedName(gatedRecord(e), e.held) : shownName(inForce ?? records.find(recordShaped)), there));
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

/** The Mac the episode `e` is kept on, when it is not this one (Phase 3, L2; D3): any record it is known by that holds `local` on another Mac
    (where.js onOtherMac) says so, a conflicted copy's too, as the gate asks every record; "" when none does. A copy that is not shaped as a
    record is not asked. Such an episode is changed only on that Mac: findEpisode's gate refuses every command that names it (gateOf), and
    `episodes` and the guide say it is there (episodeLines, guideFacts).
    But "" too when any of those records says it is kept on this Mac: a record and its conflicted copy that say two Macs (each Mac marked it
    its own at once) are sorted out on either, by `resolve`, as any conflicted copy is, and every other command is refused there by the
    conflict itself, as `episodes` and the guide say it is (review R0-F3); a Mac that none of them names refuses every command. */
const keptOn = (ctx, e) => {
  const shaped = e.records.filter(recordShaped);
  // A record kept on this Mac: its `local` names a Mac, and where.js onOtherMac says that Mac is not another.
  const here = (r) => r.local !== null && typeof r.local === "object" && typeof r.local.on === "string" && r.local.on !== "" && onOtherMac(ctx, r) === "";
  return shaped.some(here) ? "" : shaped.map((r) => onOtherMac(ctx, r)).find(Boolean) || "";
};

// isLabelled, heldName, gatedName and gatedAsOf, how a gated record or one held as a session is named, are gate.js's: the
// installer's check of the old drop folder (switch.js) names a video by them too.

/** How the record of the episode `found` (findEpisode's) is named in what a command says of it: as gatedName names it. */
const namedAs = (found, record) => gatedName(record, Boolean(found && found.held));

/** An episode whose record cannot be read at all, as it is named on every Mac: by the day and the Mac its
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
    (newerName); one with no record that can be read, on every Mac, by its day and Mac alone (unreadName; every import is light, Phase 3,
    L1d); and any other by its folder's name, as always. */
function listedAs(ctx, e) {
  if (e.newer) return newerName(e.newer);
  if (isGated(e)) {
    const r = gatedRecord(e);
    // A gated video, or one held as a session, with no label is named by its short id already: it is said once.
    return withShortId(gatedName(r, e.held), r);
  }
  if (!e.inForce) return unreadName(e.name);
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

/** The same, for a detached run that finds other episodes as it works, whose names are hidden only then (PR H5b: the join finds its parts, which
    the gate holds as videos with no kind, and hides them while it reads them): resultClean is asked when the run starts, when nothing of them is
    hidden yet, and would give nothing; this is asked for each line as the result is written, and takes out every name hidden by then. */
const lateClean = (ctx) => (text) => {
  const clean = resultClean(ctx);
  return clean ? clean(text) : text;
};

/** What is said of the episode `found` when its record cannot be gone on with, as `found.read` says why (a conflicted copy, a
    folder that cannot be read): "<said>: <why>.", as always, where `said` is the folder as the command was given it. But a
    gated episode is named by its label and short id, and its why names no file of its video; one a newer brimm-video wrote is
    named by its short id; and, on every Mac, one with no record that can be read at all is named by its
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
    so too, found by its label and short id, and `held` is true in what is given back. A planned episode (episode.js isPlannedRecord)
    is the one record with no kind that is not gated: it is found by its title, the whole of it, whatever its case and spacing (and by
    the title and short id as `episodes` could list it), and by words of its folder and its name, as any episode is; a plan she
    dropped is not found by its title, so that a new plan of that title is. A record that only claims to be planned is gated, and
    found by none of that.
    `plannedAs` is for a plan alone (`plan` and `leave`; episodeFor's `codes`): the word `said` with the codes of plan.js textArg
    turned, as `plan new` turned them in the title it was given, so that a plan is named by the string it was made with. It is tried
    only when `said` as it is fits no episode, and is taken only when it fits one episode alone and that one is a planned episode
    (episode.js isPlannedRecord of the record in force, a plan she dropped as well), which the gate then runs for as for any. What
    else it fits is not taken, and the word as given says what it says when it fits none. No other command gives it, so that no
    other command's word is turned.
    When it finds one episode for a command that editMain is running (`ctx.asked`), it gives that episode back only if the
    gate lets the command run for it (gateOf), and otherwise { why }, the gate's words, so that the command ends there, having
    read nothing but records. Without `ctx.asked`, as in a test or a helper, it is not gated. A gated episode it finds has every
    line the command says after hold nothing of its names (hideNames). */
export function findEpisode(ctx, said, { plannedAs } = {}) {
  // An import that has not finished has no whole record, and is not an episode yet. The versions of each are read once.
  const links = linksOf(ctx.root);
  const all = folders(ctx).map((name) => episodeAt(ctx, name, links)).filter((e) => e.read.code !== "NONE");
  const known = (e) => e.records;
  const nameOf = (r) => (r.name && typeof r.name.text === "string" ? r.name.text : "");
  // A label, and a label with the short id after it as the lists name a gated video ("<label> (3fa9c1)"). A planned episode's title is its
  // label too, the whole of it, so that "Too many SKUs" fits it alone when the words of another episode's name fit as well; a plan she
  // dropped is not found so, and a new plan of that title is.
  const labelled = (e, r) => {
    const labels = [typeof r.label === "string" ? r.label : "", gated(r) ? shownName(r) : e.held ? heldName(r) : isPlannedRecord(r) && !r.archived ? shownName(r) : ""].filter(Boolean);
    return typeof r.id === "string" ? [...labels, ...labels.map((label) => `${label} (${r.id.slice(-6)})`)] : labels;
  };
  // The episodes that fit what a person said, by the first way that fits any: its folder's name, a label, an id, then words.
  const fitting = (word) => {
    const words = plainly(word).split(/\s+/).filter(Boolean);
    const exact = all.filter((e) => plainly(e.name) === plainly(word));
    const byLabel = all.filter((e) => known(e).some((r) => labelled(e, r).some((label) => spaced(label) === spaced(word))));
    const byId = all.filter((e) => known(e).some((r) => typeof r.id === "string" && (r.id === word || r.id.slice(-6) === word)));
    // A gated video is never found by words of its folder or its name, which are its file's: words that fit would tie them to its
    // label. One a newer brimm-video wrote is found by them as always: it is named by its short id alone, and its kind cannot be
    // read here.
    const byWords = all.filter((e) => (e.newer || !isGated(e)) && words.length && words.every((w) => plainly(e.name).includes(w) || known(e).some((r) => plainly(nameOf(r)).includes(w))));
    return exact.length ? exact : byLabel.length ? byLabel : byId.length ? byId : byWords;
  };
  let fits = fitting(said);
  let named = said;
  // The word as it was given comes first. A plan's title written with codes, as `plan new` was given it, fits no episode as it is: with its
  // codes turned it may fit a plan, and a plan alone is taken (plannedAs).
  if (!fits.length && plannedAs !== undefined && plannedAs !== said) {
    const turned = fitting(plannedAs);
    if (turned.length === 1 && isPlannedRecord(turned[0].inForce)) {
      fits = turned;
      named = plannedAs;
    }
  }
  if (fits.length === 1) {
    const e = fits[0];
    hideNames(ctx, e);
    return gateOf(ctx, e, known(e), named, e.inForce) || holdWords(ctx, e) || { name: e.name, folder: e.folder, read: e.read, held: e.held };
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

/** A line for each import in Episodes/.importing/, from its status: running, stopped, failed, or with a problem found by its
    late check. Only those whose video `fits`, when it is given: by its label when it has one, and otherwise by its file's
    name, so that words of a file's name never tell which label is its. A video that is held in
    the drop folder, not imported, is no import: the list of the videos waiting says why it waits. A light import's status,
    which carries its video's label (Part L), is named by its label, and any other by what it is and its size, and why it failed or what its late check found is said
    with no path or name of its file in it (withoutNames). */
function importLines(ctx, fits = () => true) {
  return readStatusesIn(statusReadFolders(ctx), ctx.now()).filter((s) => s.status && fits(s.status.label || s.status.video) && importState(s.status, ctx.now()) !== "held").map(({ status }) => {
    const state = importState(status, ctx.now());
    // A status with no label is named by what it is and its size, never by its file, on every Mac (Phase 3, L1d).
    const who = status.label || capital(unlabelled(status.video, status.bytes));
    const plain = (text) => withoutNames(text, namesOf(status.video), status.label ? [status.label] : []);
    if (state === "failed") return `  ${who}: its import failed on ${status.machine}: ${plain(status.failed)}`;
    if (state === "problem") return `  ${who}: copied in on ${status.machine}. Dropbox found a problem with a copy of it: ${plain(status.problem)}`;
    if (state === "stopped") return `  ${who}: stopped on ${status.machine} at ${shownStep(status.step)}, ${ageText(ctx.now() - Date.parse(status.at))} ago`;
    return `  ${who}: being imported on ${status.machine}, at ${shownStep(status.step)}`;
  });
}

/** The drop folders of the Macs, each as { mac, folder }, this Mac's first and the others by name. This Mac's is the one its own
    settings name (Unedited Video, or Drop once the installer has switched it), and no other. Another Mac's settings are on that
    Mac, so which of its folders it watches is not known here, and both are listed, Drop/<Mac> and Unedited Video/<Mac>, whichever
    there are: a video is never hidden, though one left in a folder that Mac no longer watches shows as waiting. (A marker in
    Drop/<Mac> is no sign that it watches it: it stays after a switch back, and after a run that was refused once it was made.)
    The Macs are the folders in either parent. A Mac with a drop folder of its own (settings.js isLocal) lists only that folder. On any
    other Mac, this Mac's own folder comes first always, whether or not either parent can be read or its name is found in them: when
    macOS does not let this Mac's chat look in Dropbox it cannot read Drop either, and no folder would be looked at, and so none could
    be said to be shut (Phase 3, L1c). */
function dropFolders(ctx) {
  // A Mac with a drop folder of its own watches that one alone, which is on this Mac: another Mac's is not looked for here.
  if (isLocal(ctx.settings)) return [{ mac: ctx.machine, folder: dropFolderOf(ctx.settings, ctx.home) }];
  const inRoot = (parent) => {
    try {
      return readdirSync(join(ctx.root, parent)).filter((n) => !n.startsWith("."));
    } catch (e) {
      return [];
    }
  };
  const others = [...new Set([...inRoot("Unedited Video"), ...inRoot("Drop")])].filter((mac) => mac !== ctx.machine).sort((a, b) => a.localeCompare(b));
  return [{ mac: ctx.machine, folder: dropFolder(ctx.root, ctx.machine, ctx.settings.drop) }, ...others.flatMap((mac) => ["Drop", "Unedited Video"].map((parent) => ({ mac, folder: dropFolder(ctx.root, mac, parent) })))];
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
  // A version never spans two Macs (edits are not handed between Macs; Phase 3, D3): a video kept on another Mac is not offered as one to be a version of.
  const spans = match && links.setOf(links.firstOf(match.inForce)).members.some((one) => onOtherMac({ machine: match.machine }, one.record));
  if (match && !match.away && !spans && !match.inForce.archived && match.records.filter(recordShaped).every((r) => !gated(r) && recordKind(r) !== "session")
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
  // A plan waiting for footage is offered first (PR H5a): the planned card and the part card, before the card, unless the video came from
  // Zoom, has no picture, has a session's words in it (its Maybe line is a session's) or is held beside a session.
  const maybe = maybeOf(named, others, links);
  const blocked = Boolean((maybe && maybe.session) || links.sessionsBeside(named, null).length > 0);
  // A plan kept on another Mac (Phase 3, L4) is filmed there: this Mac's card never offers it.
  const lines = footageCards({ record: named, label, records: others.filter((e) => !e.away).map((e) => e.inForce).filter(Boolean), blocked });
  // A video with no sound has no card: it can be footage for a planned video, or be left, and takes no kind. Nothing Claude reads of it is said.
  if (named.video && named.video.sound === false) return [...lines, NO_SOUND];
  lines.push(`    Card: ${JSON.stringify(cardFor(named, label, others, links))}`);
  const came = answer.came === "zoom" || answer.came === "sound" ? answer.came : null;
  if (came || notASession) lines.push(`    Card if not a session: ${JSON.stringify(notSessionCardOf({ label, came }))}`);
  return lines;
}

/** What `episodes` says in place of the card under a video with no sound (PR H5a). */
const NO_SOUND = "    No sound: it can only be footage for a planned video.";
/** What `kind` says to a video with no sound, whatever it is answered as and on whatever Mac, before any receipt is looked at (PR H5a). */
const NO_SOUND_WHY = (name) => `${name} has no sound, so Claude can't read it: it can only be footage for a planned video. Or say "leave it".`;

/** What `episodes` says under an episode whose record cannot be read (review changes R4c), by why it cannot: a conflicted copy says
    what to say; a record not whole yet may be Dropbox still bringing it; a folder that cannot be read is tried again. */
export function readTrouble(read) {
  const why = String(read.why).replace(/\.$/, "");
  if (read.code === "CONFLICTED") return `${why}.`;
  if (read.code === "NONE") return `It is not ready: ${why}. Dropbox may still be bringing its record. Wait a few minutes and ask again. If it says this again, tell Jason.`;
  return `${capital(why)}. Ask again in a few minutes. If it says this again, tell Jason.`;
}

/** What is said of an episode with no record in force, named as listedAs names it (`named`, already capitalised): "ask Jason", except
    for a record that is not there at all, which Dropbox may still be bringing (final review M1). It names nothing of the video. */
export const unreadWords = (named, read) => (read && read.code === "NONE"
  ? `${named}: Dropbox may still be bringing its record. Wait a few minutes and ask again. If it says this again, tell Jason.`
  : `${named}: ask Jason.`);

/** The lines `episodes` says of an episode (episodeAt): its name, what it is, its length, its folder and short id, and below
    them who is editing it, its title, its finish, and what is not right with its
    files, as always. A gated one is named by its label (shownName), and the line says what it is: a video waiting for her
    answer, a client or group session, or a video left alone (`left`), with no folder; its title, which Claude may have made of
    its words, is not said; and no line of it names its video's files (cleanFor). Under the line of a video waiting for her
    answer, and not one left alone, are the lines of her card (cardLines), which look for the video a match names among `all`,
    the episodes `episodes` lists, and through `links` (finish.js linksOf, read once by `episodes`) the versions of that video. An
    episode whose record cannot be read is named as listedAs names it, and so is one a newer brimm-video wrote. A planned episode (PR H4)
    has no video to give a length, and is said by plan.js plannedLine: its title, the day it was planned, what it waits for and its id.
    An episode kept on another Mac (keptOn; Phase 3, L2, D3), one with a conflicted copy included, is said by its line as any episode is (a
    gated one by the record the gate names it by), and under it to be there: "It is on <Mac>.", with the guide's step "Carry on there." while
    that step is on that Mac (stepThere; review R1-F4); the lines of her card are not said of a video of it waiting for her answer, since every
    command that would answer it is refused here; and nothing of its files is said here, neither a conflicted copy, a script changed by hand
    nor a file not whole: that Mac says each and sorts it out, where the commands that would do it run (review R0-F6). On the Mac that keeps
    it, its own files are looked for in its video/ folder there (where.js folderAt), and its files in Dropbox in its folder there (episode.js
    fileProblems). */
function episodeLines(ctx, e, left, all, links) {
  const r = e.read.record;
  if (e.newer) return [`  ${capital(newerName(e.newer))}: Jason updates this Mac before it is changed here.`];
  const there = keptOn(ctx, e);
  if (!r && !there && listedAs(ctx, e) === e.name) return [`  ${e.name}`, `    ${readTrouble(e.read)}`];
  if (!e.inForce) return [`  ${unreadWords(capital(listedAs(ctx, e)), e.read)}`];
  const record = e.inForce;
  const lines = [];
  const clean = cleanFor(ctx, e);
  if (isGated(e)) {
    const named = gatedRecord(e);
    const held = e.held && !gated(named);
    const what = left ? "a video of" : recordKind(named) === null ? "a video waiting for your answer, of" : held ? "a version of a client or group session, of" : "a client or group session, of";
    // The record in force of a gated episode is a planned episode's when a conflicted copy of it only claims to be one: it has no video to give a length.
    const long = record.video ? ` ${stamp(record.video.seconds)}` : "";
    lines.push(`  ${gatedName(named, e.held)}: ${long ? what : what.replace(/, of$/, "")}${long}, id ${String(named.id).slice(-6)}`);
    if (!left && recordKind(named) === null && !there) lines.push(...cardLines(named, gatedName(named, e.held), all, links));
    if (!r && !there) lines.push(`    ${clean(readTrouble(e.read))}`);
  } else if (isPlannedRecord(record)) {
    // A planned episode (PR H4) has no video to give a length: it is said by its title and what it waits for.
    lines.push(`  ${plannedLine(record)}`);
  } else {
    const kind = record.kind === "short video" ? "a short video" : "an episode";
    lines.push(`  ${record.name.text}${record.name.placeholder ? " (a placeholder name)" : ""}: ${kind} of ${stamp(record.video.seconds)}, in ${e.name}, id ${record.id.slice(-6)}`);
  }
  if (there) lines.push(`    It is on ${spokenMac(there)}.${stepThere(e, left) ? " Carry on there." : ""}`);
  if (record.editing) lines.push(`    Editing: ${record.editing.by}, since ${shownAt(record.editing.since)}`);
  if (record.title && !isGated(e)) lines.push(`    Title: ${record.title.text}${record.title.approved ? "" : " (recommended)"}`);
  if (record.finished) lines.push(`    Finished: revision ${record.finished.revision}, on ${record.finished.on}`);
  if (there) return lines;
  // A script file changed outside the chat is said in its own plain line, not as "Not right" (plan-script.js; review changes R5).
  const handEdited = scriptHandEdited(e.folder, record);
  const looked = { machine: ctx.machine, localFolder: folderAt(ctx, { folder: e.folder, record }, "local") };
  for (const problem of fileProblems(e.folder, record, looked)) if (!(handEdited && problem.file === "teleprompter.txt")) lines.push(`    ${clean(fileProblemWords(problem))}`);
  if (handEdited) lines.push(`    ${HAND_EDITED(record)}`);
  return lines;
}

/** Whether the Mac an episode is kept on has steps of its own to take before the BRIMM Ops page's, which only it can take: a conflicted copy of
    its record is sorted out there, and a video held beside a session that is not cleared is settled there (guide.js nextFor puts both before the
    page's steps). Said by the records alone, so that the guide (guideFacts' `keeperFirst`) and `episodes` (stepThere) agree even once a hand-off is
    written (review R2-F1). */
const keeperFirst = (e) => e.read.code === "CONFLICTED" || Boolean(e.held && !gated(e.inForce));

/** Whether the guide's own step for the episode `e`, kept on another Mac, is on that Mac (guide.js videoNext and sessionNext, by `onOtherMac`),
    by its records alone, so that `episodes` says "Carry on there." under it only where the guide does (review R1-F4). Never for a video she left
    alone (`left`), which has no step; always for a video waiting for her answer, which is answered there; for a session, while its empty
    revision is owed, and otherwise until a hand-off of its own is written, unless her choice is its transcript only; for any other video and a
    plan, until its hand-off is written, after which the BRIMM Ops page's steps are hers on any Mac, except for an episode with a conflict or held beside a session (keeperFirst),
    which keeps "Carry on there." even after a hand-off. Her notes on this Mac are not read: while
    the page's step for a session's empty revision is still hers, the guide says that step first, and the session's own steps there after it. */
function stepThere(e, left) {
  if (left) return false;
  if (keeperFirst(e)) return true;
  const named = isGated(e) ? gatedRecord(e) : e.inForce;
  if (recordKind(named) === null && !isPlannedRecord(named)) return true;
  const r = e.inForce;
  const finished = r.finished !== null && typeof r.finished === "object" ? r.finished : null;
  if (recordKind(r) !== "session") return !finished;
  const session = r.session !== null && typeof r.session === "object" ? r.session : {};
  if (revisionOwed(r)) return true;
  if (finished && finished.revision !== session.emptyRevision) return false;
  return session.teachings !== "transcript only";
}

/** The episodes `episodes` lists (episodeAt), newest first: every folder in Episodes with a record, but an archived one, and but a part (PR H5a):
    a dropped video that is footage for a planned video is said with its plan (`plan "<planned>"`), and is listed nowhere else. An archived one
    is known by the record read whole, so that one with a conflicted copy is listed with its conflict, to be sorted out; but one kept on another
    Mac (keptOn), whose conflict is said and sorted out on that Mac alone, is left out by its record in force, as the guide leaves it out (review
    R1-F5). */
const listedEpisodes = (ctx, links) => folders(ctx).map((name) => episodeAt(ctx, name, links)).filter((e) => e.read.code !== "NONE" && !(e.read.record && e.read.record.archived) && !(e.inForce && e.inForce.archived && keptOn(ctx, e)) && !isPart(e.inForce)).map((e) => ({ ...e, away: keptOn(ctx, e), machine: ctx.machine }));

/** Whether an episode is a video she has left alone, not for brimm-video: its gated record says so. */
const isLeft = (e) => isGated(e) && recordKind(gatedRecord(e)) === null && Boolean(gatedRecord(e).answer) && gatedRecord(e).answer.state === "not for brimm-video";

/** `episodes`: each episode, newest first, with what a person needs to pick one up; the videos waiting in each drop folder,
    and for how long; the imports in Episodes/.importing; and the free space on this Mac's disk. An
    archived episode is left out, and one a newer brimm-video wrote is named by its short id alone (newerName). A video not
    yet answered, or a session, is named by its label (episodeLines), with the lines of her card under one not yet answered
    (cardLines), and one she has left alone is listed apart, under a heading of its own. A video waiting in a drop folder that
    a light import's status gives a label, or that a gated episode holds, is named by its label, or by what it is and its size,
    and why it waits holds no name of its file, on either Mac; on every Mac, whatever its file says of the import, every video
    waiting is. */
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
    say("Left alone, not for BRIMM Video Studio:");
    for (const e of left) for (const line of episodeLines(ctx, e, true, all, links)) say(line);
  }
  // The videos in each Mac's drop folder. Every Mac names them as the light import does, whatever its file says of the import: every
  // import is light, and a video waiting there may be a session, its file named for a client (Phase 3, L1d).
  const statuses = readStatusesIn(statusReadFolders(ctx), ctx.now());
  const waiting = [];
  // macOS's refusal of this Mac's own folder (EPERM, which System Settings can lift) is said; a folder its own permissions shut
  // (EACCES), one that is not there and another Mac's are passed over (Phase 3, L1c).
  let unreadable = false;
  for (const { mac, folder } of dropFolders(ctx)) {
    let names = [];
    try {
      names = readdirSync(folder).filter(isMedia).sort();
    } catch (e) {
      if (mac === ctx.machine && e.code === "EPERM") unreadable = true;
      continue;
    }
    for (const video of names) {
      const found = ctx.stat(join(folder, video));
      if (!found) continue;
      const held = heldBy({ root: ctx.root, statusFolders: statusReadFolders(ctx), video, bytes: found.size, now: ctx.now(), gatedAs: gatedAsOf(links) });
      // How long it has waited is from when this Mac's import first saw it (seen.json): the file's own dates are kept by a copy,
      // and macOS moves its birth time back with them. When this Mac has not seen it, as in the other Mac's drop folder, from
      // its ctime, when it came into the folder, which a tag or a preview set since then makes later.
      const noted = readSeen(ctx.home)[seenKey(video, found)];
      const came = noted && Number.isFinite(noted.at) ? noted.at : found.ctimeMs;
      // A video waiting here has not been answered. One a light import has a status of, with its label, or that a gated episode
      // holds, is named by its label, which retry takes, or by what it is and its size, whichever Mac this is; and so is every
      // other video, on every Mac.
      const label = labelIn(statuses, video, mac);
      const who = label || capital(unlabelled(video, found.size));
      waiting.push(`  ${who}, in ${spokenMac(mac)}'s drop folder, for ${ageText(ctx.now() - came)}${held ? `: ${withoutNames(held, namesOf(video), [label])}` : ""}`);
    }
  }
  if (waiting.length) {
    say("Waiting in the drop folders:");
    for (const line of waiting) say(line);
  }
  if (unreadable) say(dropUnreadable(dropWords(ctx.settings, ctx.machine, ctx.home)));
  // The imports, from their status files.
  const imports = importLines(ctx);
  if (imports.length) {
    say("Imports:");
    for (const line of imports) say(line);
  }
  // The space left on this Mac's disk.
  say("On this Mac:");
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
    command is to end, having said why. A record of a newer layout is shown as such and goes no further. `codes` is for `plan` and
    `leave` alone: what was said may be a plan's title as `plan new` was given it, with the codes of plan.js textArg in it, so that
    a plan is named by the string it was made with. What was said as it is comes first; with its codes turned it is tried for a
    plan alone (findEpisode's `plannedAs`). */
function episodeFor(ctx, rest, { newerEnds = 0, codes = false } = {}) {
  const said = rest.join(" ").trim();
  if (!said) {
    ctx.say(HELP);
    return { code: 2 };
  }
  const found = findEpisode(ctx, said, codes ? { plannedAs: textArg(said) } : undefined);
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

/** Say once on this Mac, at the first open of an episode that completes, how to keep the episode on this Mac: Dropbox
    offers no command for it. A marker in this Mac's folder for the episode says it was said. */
function offlineStep(ctx, found) {
  // An episode kept on this Mac has nothing in Dropbox to keep: its files are on this Mac already.
  if (found.read?.record?.local) return;
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

/** What fileProblems and filesProblems are given to look for a record's own files where they are (episode.js): this Mac, and the folder of its own files here. */
const lookedFor = (ctx, found, record) => ({ machine: ctx.machine, localFolder: folderAt(ctx, { folder: found.folder, record }, "local") });

/** What is wrong with an episode's files, in the words of the Mac that says it: `dropbox`, the lines for a file in Dropbox (filesProblems), and
    `mac`, the lines for a file kept on this Mac that is not whole in its video/ folder: "<name>'s <role> is not whole on this Mac. Ask Jason." */
function problemsOf(ctx, found, record) {
  const own = [];
  const dropbox = filesProblems(found.folder, record, { ...lookedFor(ctx, found, record), onMac: (file) => (own.push(file), null) }).filter((line) => line !== null);
  return { dropbox, mac: own.map((file) => `${shownName(record)}'s ${roleOf(file)} is not whole on this Mac. Ask Jason.`) };
}

/** The episode's files that are not whole on this Mac yet, as Dropbox brings them over: by the record's list. */
const notHere = (ctx, found, record) => Object.keys(record.files).filter((rel) => !ctx.isWhole(fileOf(ctx, found, rel)));

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

/** The files the record lists (the record's own folder apart) that are missing or not at their listed size, and that Dropbox has kept under no
    other name: what claimAndBring takes for a plain wait in the window of plan R1d. */
function plainShort(ctx, folder, record) {
  const out = [];
  for (const [rel, bytes] of Object.entries(record.files)) {
    if (rel.split("/")[0] === RECORD_DIR) continue;
    let size = null;
    try {
      size = statSync(fileAt(ctx, { folder, record }, rel)).size;
    } catch (e) {
      // Not there.
    }
    if (size !== bytes && !otherNames(folderAt(ctx, { folder, record }, filePlace(record, rel)), rel).length) out.push(rel);
  }
  return out;
}

/** The claim and the bring that `open` and `app` both begin with: check the episode's files against its record, and that each is
    whole on this Mac, and claim it for this Mac. `record` is the one `found` was read as (episodeFor). Resolves { record }, the
    episode's record with this Mac editing it (read again, when the claim was just written), once every file is here and the
    episode is this Mac's; or { code }, the code the command ends with, once a line has said why it cannot go on. `again` is what
    she says to try again, as the command that asked has it: `open Talk` for open, `open Talk in HyperFrames` for app. `notYet`, for
    `app` alone, gives the words of the wait in the window of plan R1d (a wait, with nothing written). `by` is the command that
    asked when it is not `open`, "app": the bring this starts is given it (`bring … --asked-by app`), so that what that bring says
    to say next, once it has run, is `again` as well, and not open's. In order:
    - a change Dropbox undid is said, and the record as it is now taken as this Mac's;
    - another Mac's claim refuses it at once: nothing is looked at or brought over first, since on the Mac that is not editing an
      episode its files are online-only, and bringing them, raw video and all, would be for nothing. One Mac edits a video from
      start to finish, so there is no way to take it over;
    - a file of the record missing or short refuses it; files not whole on this Mac yet are brought over;
    - the claim: the record is written with this Mac editing it, and after CLAIM_WAIT_MS it is read again: when Dropbox took
      the claim away, this Mac says so and stops; when the other Mac claimed it meanwhile, or both Macs wrote the same record
      and Dropbox kept a conflicted copy, this Mac stops, and it is theirs or for a person to sort out;
    - a warning when this Mac seems offline, since the other Mac then cannot see the claim. */
async function claimAndBring(ctx, found, record, { again, by = "", notYet = null }) {
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
  // Who has it is said before any file is looked at: the files of an episode another Mac has are not whole here.
  const held = claimHeld(ctx, record);
  if (held) {
    say(held);
    return { code: 1 };
  }
  const { dropbox: problems, mac: onThisMac } = problemsOf(ctx, found, record);
  // `app` and `app … reel` while the reading's own late check is still to come (plan R1d): when every problem is a listed file that is
  // missing or not at its listed size, with no other name Dropbox may have kept it under, it is a wait, not a refusal; nothing is
  // claimed or written. Judged by the record's list and the sizes, not by the words of the problems.
  if (problems.length && !onThisMac.length && notYet && projectWaits(ctx, { name: found.name, record }) === "verify" && plainShort(ctx, found.folder, record).length === problems.length) {
    say(notYet());
    return { code: 0 };
  }
  if (problems.length || onThisMac.length) {
    if (problems.length) say(`${found.name} is not whole in Dropbox:`);
    for (const problem of problems) say(`  ${problem}`);
    for (const line of onThisMac) say(line);
    say(`It is not opened. Say "what's waiting?" to see the episodes.`);
    return { code: 1 };
  }
  const coming = notHere(ctx, found, record);
  if (coming.length) {
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: askedBy });
    say(`Dropbox is bringing ${coming.length} file${coming.length === 1 ? "" : "s"} of ${name} over to this Mac. Say "${again}" again when it is done; "how far is it?" shows how far it has got.`);
    return { code: 0 };
  }
  if (!record.editing || record.editing.by !== ctx.machine) {
    if ((await save(ctx, { ...found, record }, claimed(record, ctx.machine, localStamp(new Date(ctx.now()))), "")) !== 0) return { code: 1 };
    // Another Mac never sees a video kept on this one (D3), so there is no claim of its to wait for (Phase 3, L7).
    if (!keptOnAMac(record)) await (ctx.deps.wait || ((ms) => new Promise((done) => setTimeout(done, ms))))(CLAIM_WAIT_MS);
    const after = readEpisode(found.folder);
    if (!after.record) {
      say(notRead(ctx, { ...found, read: after }));
      return { code: 1 };
    }
    // The record read again is older than the claim this Mac wrote, or has nobody editing it: Dropbox took the claim away.
    // That is said. The record as it is now is taken as this Mac's, so the next try goes through.
    const undid = undone(after.record, ctx.home);
    if (undid || !after.record.editing) {
      say(`Dropbox undid this Mac's claim on ${name}. Say "${again}" again.`);
      if (undid) acceptRev(ctx.home, after.record.id, after.record.rev);
      return { code: 1 };
    }
    if (after.record.editing.by !== ctx.machine) {
      say(`${after.record.editing.by} opened ${name} at the same time, and it is theirs. Carry on there.`);
      return { code: 1 };
    }
    record = after.record;
    if (!(await (ctx.deps.online || online)())) say("This Mac seems to be offline: the other Mac will not see that you have it until this one is back online.");
  }
  return { record };
}

/** `open "<episode>"`: check its files against its record, and that each is whole on this Mac, claim it for this
    Mac (claimAndBring), and show what is decided for it: the name, the title, Claude's notes and the Reel candidates. It says
    nothing of Final Cut. At the first open on this Mac it says how to keep the episode on this Mac. */
export async function open(ctx, rest) {
  const { words, flags } = flagsOf(rest, []);
  // No flag is open's: `--take-over` is none, and the help is said with nothing claimed.
  if (Object.keys(flags).length) {
    ctx.say(HELP);
    return 2;
  }
  const got = episodeFor(ctx, words, { newerEnds: 1 });
  if (!got.found) return got.code;
  const { found } = got;
  const { say } = ctx;
  const name = got.record.name.text;
  const claim = await claimAndBring(ctx, found, got.record, { again: `open ${name}` });
  if (claim.code !== undefined) return claim.code;
  const { record } = claim;
  const kind = record.kind === "short video" ? "a short video" : "an episode";
  say(`${name}${record.name.placeholder ? " (a placeholder name)" : ""}: ${kind} of ${stamp(record.video.seconds)}, in ${found.name}`);
  if (record.name.placeholder) say("The name is a placeholder: say what to call it.");
  say(record.title ? `Title: ${record.title.text}${record.title.approved ? "" : " (recommended by Claude)"}` : "No title yet.");
  const stem = basename(record.video.file, extname(record.video.file));
  const notes = fileOf(ctx, found, `${stem}.edit-notes.txt`);
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
    projectOnAnotherMac): everything done in it is on that Mac, so a new project here would drop it from the record. One Mac edits a
    video from start to finish. Named as app's other lines name the video; `of` is "Reel 2 of " for a Reel's project. */
const projectIsElsewhere = (name, on, of = "") => `The HyperFrames project of ${of}${name} is on ${spokenMac(on)}. Carry on there.`;

/** The refusal for a project of the record that is a session clip's folder on this Mac, however the record spells its name (PR 15's rule, as
    free.js has it; the review of PR 11, I4), or that cannot be told from one, or "": decided before anything is claimed or opened. `key` says
    which project ("main" or "reel 2"), and `of` how its words name it. Nothing of a session goes to HyperFrames by default. */
function clipWords(ctx, { found, record }, key, of) {
  const project = (record.app?.projects ?? []).find((p) => (key === "main" ? inUse(p) : p.key === key));
  if (!project || !plainName(project.name)) return "";
  const work = episodeWork(ctx.home, found.name);
  return clipTrouble(work, clipFolders(work, record), project.name) ? `The folder for ${of} on this Mac is not as it was made, so it wasn't opened. Ask Jason.` : "";
}

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

/** `app "<episode>"`: open the episode's main video in the HyperFrames app, making its project first (app.js
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
      projectOnAnotherMac): it ends with 1 before anything is claimed or brought, nothing is asked for or made, and no record is
      written, since a new project here would drop the other Mac's from the record. One Mac edits a video from start to finish. A
      project of this Mac's own whose folder is gone is made again, under its own name;
    - the claim and the bring, as `open` makes them (claimAndBring). What she is told to say again is "open <name> in
      HyperFrames";
    - openInApp, given the episode as the claim left it. It resolves the code this command ends with, and gives the record its
      project, which is written as every command writes a record (save). Whenever the app opened, the last line it says names the
      app's buttons that Studio cannot control (architecture 3.3 and 5.9); when the app did not open, it does not.
    `ctx.deps.app` holds what a test gives openInApp in place of its defaults (cli, node, guidance, chat, spawn, env).
    `app "<episode>" reel <n>` opens Reel `n` instead (appReel).
    `app "<episode>" what-happened` and `app "<episode>" versions` (plan PR 6) are questions about the project, not an opening of it:
    a word after the episode's, when another word comes before it (`app versions` alone names an episode called "versions"). They
    go through the same gate, the same words for a finished video and the same check that this Mac is set up, and then they are
    app-history.js's: they claim nothing, bring nothing, ask for no working copy and write no record, so no claim of another Mac
    refuses them. `versions` needs the pinned command line (NO_COMMAND_LINE); `what-happened` reads a
    file in the project and does not. `ctx.deps.app` holds what a test gives them too (cli, node, spawn, tz). */
export async function app(ctx, rest) {
  // The detached run `app` starts for a video kept on this Mac whose video for HyperFrames is being made: it is in no help, as `workcopy --now` is not.
  if (rest[0] === "--when-ready") return appWhenReady(ctx, rest);
  const { words, flags } = flagsOf(rest, []);
  // No flag is app's: `--take-over` is none, and the help is said with nothing claimed.
  if (Object.keys(flags).length) {
    ctx.say(HELP);
    return 2;
  }
  const reel = reelAsked(words);
  if (reel) return appReel(ctx, reel);
  const question = words.length > 1 && APP_QUESTIONS.includes(words[words.length - 1]) ? words[words.length - 1] : "";
  const got = episodeFor(ctx, question ? words.slice(0, -1) : words, { newerEnds: 1 });
  if (!got.found) return got.code;
  const { found } = got;
  if (recordKind(got.record) === "finished") return refuse(ctx, finishedHasNoProject(got.record.name.text));
  // A planned video (PR H6): only a HeyGen explainer has a project before it is a video, and no question or Reel is asked of a plan.
  const isPlan = isPlannedRecord(got.record);
  if (isPlan) {
    const why = question ? noFootageWhy(got.record) : voiceProjectWhy(ctx, got.record);
    if (why) return refuse(ctx, why);
  }
  if (!appOf(ctx.settings)) return refuse(ctx, APP_NOT_SET_UP);
  const cli = ctx.deps.app?.cli ?? cliPath(ctx.home);
  if (isPlan) {
    if (!existsSync(cli)) return refuse(ctx, NO_COMMAND_LINE);
    const kit = { cues: graphicCuesOf(got.record.planned.cues, { kinds: SHOT_KINDS }).cues };
    return openVoiceProject(ctx, { found, record: got.record }, {
      env: ctx.deps.env, ...ctx.deps.app, cli, guidance: ctx.deps.app?.guidance ?? guidanceOf(ctx.home), cues: kit.cues,
      save: (next) => save(ctx, { ...found, record: got.record }, next, "")
    });
  }
  if (question === "what-happened") return whatHappened(ctx, { found, record: got.record }, { ...ctx.deps.app });
  if (!existsSync(cli)) return refuse(ctx, NO_COMMAND_LINE);
  if (question === "versions") return versionsOf(ctx, { found, record: got.record }, { env: ctx.deps.env, ...ctx.deps.app, cli });
  const elsewhere = projectOnAnotherMac(ctx, { found, record: got.record });
  if (elsewhere) return refuse(ctx, projectIsElsewhere(got.record.name.text, elsewhere));
  const clip = clipWords(ctx, { found, record: got.record }, "main", got.record.name.text);
  if (clip) return refuse(ctx, clip);
  // A video kept on this Mac whose video for HyperFrames is being made opens by itself when it is done (Phase 3, L7): nothing is claimed or asked for.
  if (copyAtWork(ctx, { found, record: got.record })) return openByItself(ctx, { found, record: got.record });
  const claim = await claimAndBring(ctx, found, got.record, { again: openInAppWords(got.record.name.text), by: APP_ASKED, notYet: () => notWholeYet(got.record.name.text) });
  if (claim.code !== undefined) return claim.code;
  const { record } = claim;
  return openInApp(ctx, { found, record }, { env: ctx.deps.env, ...ctx.deps.app, cli, plan: (given) => planProject(ctx, given), save: (next) => save(ctx, { ...found, record }, next) });
}

/** How often `app --when-ready` looks at whether the video for HyperFrames is made, in milliseconds. */
const WHEN_READY_LOOK_MS = 2000;
/** The notice posted when the video for HyperFrames of a video kept on this Mac could not be made, so that nothing opened by itself. */
const couldntBeMade = (name) => `The video for HyperFrames of ${name} couldn't be made. Say "open ${name} in HyperFrames" to try again; if it says this again, ask Jason.`;

/** `app --when-ready "<episode folder>"`, the detached run `app` starts for a video kept on this Mac whose video for HyperFrames is being made (Phase 3,
    L7): it is in no help, as `workcopy --now` is not, and without a folder, or for any other video, it prints the help and ends 2. It takes a lock of
    its own (app.js whenReadyLockOf), never the episode's, and waits with it while the working copy's run, or another run on the episode, is at work (at
    most the copy's own limit, workcopy.js workCopyLimits), so that `free`, a move and all her other commands are not refused for it. Then, when the
    video for HyperFrames is made, it takes the episode's lock and does what `app` does (the project made, the app asked); when it is not (the copy
    failed, or took too long), it opens nothing and posts a notice. It claims nothing. Resolves 0 when it opened the project and 1 otherwise. */
async function appWhenReady(ctx, rest) {
  if (rest.length !== 2 || !rest[1]) {
    ctx.say(HELP);
    return 2;
  }
  const found = findEpisode(ctx, rest[1]);
  if (!found.read || !found.read.record) {
    ctx.say(found.why || notRead(ctx, found, rest[1]));
    return 1;
  }
  if (found.read.newer) {
    ctx.say(newerWhy(found.read.record));
    return 1;
  }
  if (!keptOnAMac(found.read.record)) {
    ctx.say(HELP);
    return 2;
  }
  const wait = ctx.deps.wait || ((ms) => new Promise((done) => setTimeout(done, ms)));
  const notify = ctx.deps.notify || banner;
  const keep = ctx.deps.keepAwake ? { keepAwake: ctx.deps.keepAwake } : {};
  const result = await runDetached({ home: ctx.home, folder: found.name, clean: resultClean(ctx), command: "when-ready", lock: whenReadyLockOf(ctx.home, found.name), alive: ctx.alive, ...keep }, async () => {
    const limit = workCopyLimits(found.read.record.video && found.read.record.video.seconds).limit;
    const began = ctx.now();
    const busy = () => runningCommand(ctx.home, found.name, ctx.alive, workCopyLockOf(ctx.home, found.name)) || runningCommand(ctx.home, found.name, ctx.alive);
    while (busy() && ctx.now() - began < limit) await wait(WHEN_READY_LOOK_MS);
    const now = readEpisode(found.folder);
    const record = now.record;
    const name = record ? record.name.text : found.read.record.name.text;
    if (!record || now.newer || !copyIsMade(ctx, { found: { folder: found.folder, name: found.name, record }, record })) {
      notify(couldntBeMade(name));
      return { ok: false, made: [], failed: ["The video for HyperFrames was not made, so it was not opened."], next: "" };
    }
    // The copy is made: the episode's lock is taken now, and what `app` does is done.
    const said = [];
    const opened = await runDetached({ home: ctx.home, folder: found.name, clean: resultClean(ctx), command: "app", alive: ctx.alive, ...keep }, async () => {
      const code = await app({ ...ctx, say: (line) => (said.push(line), ctx.say(line)) }, [found.name]);
      return { ok: code === 0, made: code === 0 ? ["the project, opened in HyperFrames"] : [], failed: code === 0 ? [] : said.slice(), next: "" };
    });
    if (opened.running || opened.taking) {
      notify(couldntBeMade(name));
      return { ok: false, made: [], failed: ["Another run was at work on it, so it was not opened."], next: "" };
    }
    if (!opened.ok) notify(said[0] || couldntBeMade(name));
    return { ok: opened.ok, made: opened.made, failed: opened.failed, next: "" };
  });
  if (result.taking || result.running) {
    ctx.say("It opens in HyperFrames by itself already.");
    return 1;
  }
  return result.ok ? 0 : 1;
}

/** `app "<episode>" reel <n>`: open Reel `n` of the episode in the HyperFrames app, making its project first (app-reel.js
    openReelInApp; plan PR 5; architecture 4.1 step 10 and 4.3). A Reel is made by Studio only: the app's agent is told to send her
    here. `reel` with no number after it is the help and 2. In order:
    - the gate, as for every command that names an episode (episodeFor), `app`'s own: a video not yet answered, a video left alone,
      a session not cleared and a video held beside a session are refused in the gate's words. It comes first, whether or not this
      Mac is set up;
    - an iPhone clip has no Reels (the words every command says of one), and ends with 1, claiming nothing. A finished video has
      them, though no main project: its Reels are the Reels of a video her editor finished (4.3);
    - this Mac must be set up for the app and have the pinned command line, or it says so and ends with 1, having claimed nothing;
    - a Reel neither the record's list nor its projects have, and a Reel finished already that has no project, are refused in words
      (app-reel.js reelWhy), before anything is claimed. While Claude's reading is at work and not yet in the record the list is not
      asked, since the reading is making it; once it is in, the record judges;
    - a Reel project made on another Mac and not on this one is refused (projectOnAnotherMac, with the Reel's key), before anything
      is claimed, brought or made;
    - the claim and the bring, as `open` and `app` make them (claimAndBring). What she is told to say again is "open Reel <n> of
      <name> in HyperFrames", and the bring it starts is told so (`bring … --asked-by "app reel <n>"`);
    - openReelInApp, given the episode as the claim left it. It resolves the code this command ends with, and gives the record the
      Reel's project and the Reel picked, in one write. */
async function appReel(ctx, asked) {
  if (asked.n === null) {
    ctx.say(HELP);
    return 2;
  }
  const got = episodeFor(ctx, asked.episode, { newerEnds: 1 });
  if (!got.found) return got.code;
  const { found } = got;
  const name = got.record.name.text;
  const { n } = asked;
  if (isPlannedRecord(got.record)) return refuse(ctx, noFootageWhy(got.record));
  if (recordKind(got.record) === "short video") return refuse(ctx, NO_REELS);
  if (!appOf(ctx.settings)) return refuse(ctx, APP_NOT_SET_UP);
  const cli = ctx.deps.app?.cli ?? cliPath(ctx.home);
  if (!existsSync(cli)) return refuse(ctx, NO_COMMAND_LINE);
  const why = reelWhy(ctx, found, got.record, n);
  if (why) return refuse(ctx, why);
  const elsewhere = projectOnAnotherMac(ctx, { found, record: got.record }, `reel ${n}`);
  if (elsewhere) return refuse(ctx, projectIsElsewhere(name, elsewhere, `Reel ${n} of `));
  const clip = clipWords(ctx, { found, record: got.record }, `reel ${n}`, `Reel ${n} of ${name}`);
  if (clip) return refuse(ctx, clip);
  const claim = await claimAndBring(ctx, found, got.record, { again: openReelWords(n, name), by: appReelAsked(n), notYet: () => reelNotWholeYet(n, name) });
  if (claim.code !== undefined) return claim.code;
  const { record } = claim;
  return openReelInApp(ctx, { found, record, n }, { env: ctx.deps.env, ...ctx.deps.app, cli, save: (next) => save(ctx, { ...found, record }, next) });
}

/** Open a file in an app on this Mac, as a double-click would: QuickTime Player, TextEdit and Finder, here. Throws,
    saying why in open's words, when the app could not be opened. `run` is how a program is run, for a test to give
    another. */
export function openApp(app, file, run = spawnSync) {
  const ran = run("/usr/bin/open", ["-a", app, file], { encoding: "utf8" });
  if (ran.status !== 0) throw new Error(`${app} could not be opened (${lastLine(ran.stderr)})`);
}

/** The launch agent that imports this Mac's drop folder. */
const AGENT = "com.thebrimm.unedited";

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

/** `bring --now "<episode folder>" [--asked-by app | "app reel <n>"]`, the detached run `open` and `app` start: each file
    of the episode that is not whole on this Mac is read to its end, so that Dropbox brings it over, and the result says which are
    whole now, and what to say next: to open it, or, when a file did not come, why, and to open it to try again. `--asked-by app`
    says that `app` started it (claimAndBring), and then what to say next is to open it in HyperFrames, `open <name> in HyperFrames`,
    which runs `app`; `--asked-by "app reel <n>"` that `app … reel <n>` did, and what to say next is to open that Reel, `open Reel
    <n> of <name> in HyperFrames`; a bring that was told nobody, or any other command, says `open <name>`, as it always did. */
export async function bring(ctx, rest) {
  // Given files after the folder (a Reel's clip), only those are brought over.
  const [now, folder, ...after] = rest;
  const askedAt = after.indexOf("--asked-by");
  const asker = askedAt === -1 ? "" : String(after[askedAt + 1] ?? "");
  const only = after.filter((word, i) => !(askedAt !== -1 && (i === askedAt || i === askedAt + 1)));
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
  const result = await runDetached({ home: ctx.home, folder: found.name, clean: resultClean(ctx), command: "bring", alive: ctx.alive, ...(ctx.deps.keepAwake ? { keepAwake: ctx.deps.keepAwake } : {}) }, async () => {
    const wanted = () => (only.length ? only.filter((rel) => !ctx.isWhole(fileOf(ctx, found, rel))) : notHere(ctx, found, record));
    const coming = wanted();
    const read = ctx.deps.readAll || readThrough;
    const failed = [];
    for (const rel of coming) {
      try {
        await read(fileOf(ctx, found, rel));
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
    return { ok: !failed.length, made, failed, next };
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

/** What a detached run's result `r` says of the episode `shown`, in one line: when it ended, what it made, what it could not do,
    and `next`, what to say next. Each of them as `clean` says it. `status` says it for every result, and `kind` for the reading
    it waited for. An early result (detached.js runDetached), which a reading writes once what it read is in the episode, says
    when it put that in, and that the late check of its copies is still to come while its run is at work (`live`), or that the
    run stopped before it was made. */
function ranLine(ctx, shown, r, clean, next, live = false, voicing = false) {
  const done = r.failed.length ? ` Not done: ${clean(r.failed.join(" ")).replace(/([^.])$/, "$1.")}` : "";
  const when = r.early
    ? `put in what it made ${ageText(ctx.now() - r.ended)} ago; ${live ? "Dropbox's check of its copies is still to come" : "it stopped before Dropbox's check of its copies was made"}`
    : `ended ${ageText(ctx.now() - r.ended)} ago`;
  return `${shown}: ${r.command === "join" && voicing ? VOICE_RUN_SAID : Object.hasOwn(RUN_SAID, r.command) ? RUN_SAID[r.command] : r.command} ${when}.${r.made.length ? ` Made: ${r.made.map(clean).join(", ")}.` : ""}${done}${next ? ` ${clean(next)}` : ""}`;
}

/** What `status` says while the working copy of an episode is made, in the words `app` uses for it. */
const WORK_COPY_RUNNING = "the video for HyperFrames is being made";
/** What `status` says while an explainer's voice is taken in (join.js), and how a result names that run: an explainer has no footage. */
const VOICE_RUNNING = "its voice is being taken in";
const VOICE_RUN_SAID = "taking in its voice";
/** How a result names the run that left it, where the name of its command is not a word a person says: the working copy's run
    (workcopy.js) is "making the video for HyperFrames", and the join's (join.js; PR H5b) "making the video from its footage". Every other
    command is named by its own word. */
const RUN_SAID = { [WORK_COPY_COMMAND]: "making the video for HyperFrames", join: "making the video from its footage", "when-ready": "waiting to open it in HyperFrames", app: "opening it in HyperFrames" };

/** `status ["<words>"]`: what is running on this Mac (each run's step, from the progress panel's files), the imports in
    Episodes/.importing/, and for each episode on this Mac the detached run at work on it and what each one left, with what to
    say next (nextOf). With words, only what they fit. An episode is named as listedAs names it: a video not yet answered, or a
    session, by its label and short id, and what its runs left with nothing of its video's names in it (cleanFor), a result
    left before it became one included, and with nothing said of what to say next. Words fit such an episode only when they
    are its label or its id, and a light import's status only by its label. A finish at work that has written its hand-off and only
    waits for its late check (finish-check.js) is said so, in place of that it is running: that the hand-off is written, and when
    Studio checks Dropbox's copies and then takes away the originals it took. */
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
    // A finish whose hand-off is written and shown only waits for its late check (finish-check.js): that is said in place of that it is
    // running, with when Studio checks Dropbox's copies and then takes away what it took.
    // An explainer's join run takes its voice in: it has no footage to join.
    const voicing = Boolean(e.inForce && e.inForce.planned && e.inForce.planned.route === "explainer");
    const checking = command === "finish" && e.inForce ? checkingNow(ctx.home, folder, e.inForce, ctx.alive) : null;
    if (checking) lines.push(`${shown}: the hand-off is written. ${checkSentence(checking)}`);
    else if (command === "join" && voicing) lines.push(`${shown}: ${VOICE_RUNNING}.`);
    else if (command) lines.push(`${shown}: ${command} is running.`);
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
      lines.push(ranLine(ctx, shown, r, clean, isGated(e) ? "" : r.next, own, voicing));
    }
    // A copy of footage the last run could not make (its result; none while a run of the copy is at work) is said once, with what to do first.
    // A gated video is named by its label alone, and is not told to open it, which the gate refuses.
    if (footageFailed(ctx, folder)) {
      lines.push(isGated(e) ? `Some of the footage for "${gatedName(gatedRecord(e), e.held)}" could not be made. Ask Jason.`
        : `Some of the footage for "${shown}" could not be made, and opening it again won't change that. Ask Jason.`);
    }
  }
  for (const line of lines.length ? lines : ["Nothing is running, and nothing is waiting."]) say(line);
  return 0;
}

/** retry of a video an episode holds already (`held` says which, in episodeHolding's words). It is not imported again. But
    when its import stopped on this Mac before its late check, that check holds the episode for ask on both
    Macs (unedited.js importHolds), and is made only at the import's next run: so the launch agent is asked to look, which
    makes it. When this Mac owes no late check of it, a stopped status of this Mac's own for it can never be cleared by a late
    check, and is taken away. Otherwise it is refused, as before. `who` is the video as retry names it (retry), and `plain`
    what a line about it is said as: for a light import's video, with no path or name of its file in it. */
function lateCheckOwed(ctx, video, held, who = video, plain = (text) => text) {
  const { say } = ctx;
  const owed = readPendings(ctx.home).find((p) => p.video === video && p.machine === ctx.machine && resolve(p.root) === resolve(ctx.root));
  const stopped = readStatusesIn(statusReadFolders(ctx), ctx.now()).filter((s) => s.status && s.status.video === video && s.status.machine === ctx.machine && importState(s.status, ctx.now()) === "stopped");
  // The episode is named as listedAs names it: a gated one by its label and short id, and never by its folder.
  const name = owed ? listedAs(ctx, episodeAt(ctx, owed.name)) : (/already imported as (.*?)\. It stays/.exec(held) || [])[1] || "an episode";
  if (!owed && !stopped.length) {
    say(`${who} is ${plain(held)}`);
    return 1;
  }
  if (!owed) {
    for (const { status, folder } of stopped) removeStatusIn(folder, video, ctx.machine, status.import || "");
    say(`${who} is imported, as ${name}. Its import stopped on this Mac, and has no check of its copies left to make here, so the status that held the episode is taken away.`);
    return 0;
  }
  const problem = owed.problem ? plain(String(owed.problem).replace(/\.$/, "")) : "";
  const due = dueAt(owed);
  const later = due > ctx.now() ? `when it is due, at ${clockAt(due)}` : "";
  // A run at work makes a due check within a minute, but makes a check that found a problem only once, at its start.
  if (ctx.agentRunning()) {
    if (problem) {
      say(`${who} is imported, as ${name}. Dropbox found a problem with a copy of it: ${problem}. The import at work now does not check it again: once the problem is put right and the panel shows that import has ended, say "try it again" again.`);
      return 1;
    }
    say(`${who} is imported, as ${name}. Dropbox's check of its copies is still to be made on this Mac: the import at work now makes it ${later ? `${later}, ` : ""}once it has finished any video it is importing. The panel shows how far it is.`);
    return 0;
  }
  try {
    ctx.kickstart();
  } catch (e) {
    say(`The launch agent ${AGENT} could not be asked to look (${String(e.message).replace(/\.$/, "")}). Jason runs install.sh --machine on this Mac.`);
    return 1;
  }
  if (problem) say(`${who} is imported, as ${name}. Dropbox found a problem with a copy of it before (${problem}): the Mac's import of its drop folder is asked to make it again now. The panel shows how far it is.`);
  else say(`${who} is imported, as ${name}. Dropbox's check of its copies is still to be made on this Mac: the Mac's import of its drop folder is asked to make it ${later || "now"}. The panel shows how far it is.`);
  return 0;
}

/** `retry "<video>"`: import again a video in this Mac's drop folder whose import failed or stopped. It is found by its
    file's name or its name without the ending, whatever their case, or by the label a light import's status of this Mac gives
    it (Part L), whatever its case and spacing. Refused when an episode holds it already (but see lateCheckOwed), and while its
    import is running. Its status files from this Mac are taken away, and the launch agent is asked to look (kickstart).
    A video with a label is named by it in every line, and why its import failed is said with no path or name of its file in
    it; on every Mac, a video with none is named by what it is and its size, and never by its file. */
export async function retry(ctx, rest) {
  const { say } = ctx;
  const said = rest.join(" ").trim();
  if (!said) {
    say(HELP);
    return 2;
  }
  const drop = dropFolderOf(ctx.settings, ctx.home);
  let videos = [];
  let refused = false;
  try {
    videos = readdirSync(drop).filter(isMedia).sort();
  } catch (e) {
    // The drop folder is not there, or cannot be read: it holds nothing that can be imported. But when macOS refuses it (EPERM) or
    // its own permissions do (EACCES), that is what is said, never that it is empty (Phase 3, L1c).
    refused = e.code === "EPERM" || e.code === "EACCES";
  }
  const statuses = readStatusesIn(statusReadFolders(ctx), ctx.now());
  const labelOf = (v) => labelIn(statuses, v, ctx.machine);
  const sizeOf = (v) => (statSync(join(drop, v), { throwIfNoEntry: false }) || { size: 0 }).size;
  // No video is named by its file, on any Mac, whatever its file says of the import (every import is light; Phase 3, L1d), as `episodes`
  // has it.
  // An episode a version of a session holds is held as a session too (episodeAt's `held`), and named so.
  const gatedAs = gatedAsOf(linksOf(ctx.root));
  const video = videos.find((v) => plainly(v) === plainly(said) || plainly(basename(v, extname(v))) === plainly(said)) || videos.find((v) => labelOf(v) && spaced(labelOf(v)) === spaced(said));
  if (!video && refused) {
    say(dropUnreadable(dropWords(ctx.settings, ctx.machine, ctx.home)));
    return 1;
  }
  if (!video) {
    const held = videos.map((v) => labelOf(v) || unlabelled(v, sizeOf(v)));
    say(`No video in this Mac's drop folder fits "${said}". ${videos.length ? `It holds: ${listed(held)}.` : "It is empty."}`);
    return 1;
  }
  const bytes = statSync(join(drop, video)).size;
  const label = labelOf(video);
  const who = label || `${capital(unlabelled(video, bytes))} in this Mac's drop folder`;
  const plain = (text) => withoutNames(text, namesOf(video), [label]);
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
    say(`${who} is being imported now, at ${shownStep(running.status.step)}. The panel shows how far it is.`);
    return 1;
  }
  for (const { status, folder } of again) removeStatusIn(folder, video, ctx.machine, status.import || "");
  const how = (status) => {
    const state = importState(status, ctx.now());
    if (state === "failed") return `which failed: ${plain(String(status.failed).replace(/\.$/, ""))}`;
    if (state === "problem") return "whose copies Dropbox found a problem with";
    if (state === "held") return "which was held, as another file";
    return `which stopped at ${shownStep(status.step)}`;
  };
  const items = again.map(({ status }) => `${status.import || "one with no id"}, ${how(status)}`);
  const which = items.length > 1 ? ` (its imports ${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]})` : "";
  // A run of the launch agent at work now takes the video when it next looks: it looks again each minute while it waits for
  // a late check, and once more before it ends. Asking the agent to start would do nothing while it runs.
  if (ctx.agentRunning()) {
    say(`${who} is imported again${which} by the import at work now, when it next looks in the drop folder: within a minute while it waits to check the copies, or once it has finished the video it is on. The panel shows how far it is.`);
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

/** Who writes a record from this Mac: the commit of the checkout this code is in (thisCheckout, not the one the settings name),
    for information only, and the Mac. */
const writerOf = (ctx) => ({ commit: ctx.deps.commit || commitOf(thisCheckout()), on: ctx.machine });

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
/** What a command says when the run at work on the episode stops it: `generic`, the words it has always said, unless that run is a finish
    whose hand-off is written and which only waits for its late check (finish-check.js checkingNow). She was told she need not wait for that
    check, so the stop says that the hand-off is written and when Studio checks Dropbox's copies, and `again`, what she does then, in the
    command's own words; `of` is " of <the video>" where the command names it. A stop that comes while the finish still copies is the
    generic one: nothing is written yet, and the finish is what she waits for. The same for a read run whose reading is in the record and
    which only waits for its own late check (late-wait.js readingCheckAt, from the run's early result): "Claude's reading<of> is written,
    and Studio checks Dropbox's copies at <time>. <again>"; with no early result of that run it is the generic one. `record` is the
    episode's record in force. */
function stoppedWords(ctx, found, record, { generic, again, of = "" }) {
  const checking = checkingNow(ctx.home, found.name, record, ctx.alive);
  if (checking) return `The hand-off${of} is written, and Studio checks Dropbox's copies at ${clockAt(checking.due)}. ${again}`;
  // A read run that has put its reading in the record and only waits for its own late check (late-wait.js readingCheckAt; plan R1d).
  const reads = readingCheckAt(ctx, { name: found.name, record });
  return reads === null ? generic : `Claude's reading${of} is written, and Studio checks Dropbox's copies at ${clockAt(reads)}. ${again}`;
}
const oneLine =(v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();

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
    that brimm-video cannot make it on this Mac (notMadeWords). */
async function reelTitle(ctx, found, n, words) {
  const reels = (found.record.reels || []).map((r) => ({ ...r }));
  const reel = reels.find((r) => r.n === n);
  if (!reel) return refuse(ctx, `There is no Reel ${n}.`);
  // A Reel a reading suggested is not made, and no Reel brimm-video makes would show its title: she is told how to make it.
  if (!madeInApp(found.record, n) && notMade(ctx, found, n)) return refuse(ctx, notMadeSaid(ctx, found.record, n));
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

/** Drop Reels, by their numbers: leave them out. A record only. A Reel is picked by making it, with `app … reel <n>`, which marks the
    Reel it opens picked in its own write (app-reel.js). */
export async function dropReels(ctx, found, ns) {
  const { record } = found;
  if (claimHeld(ctx, record)) return refuse(ctx, claimHeld(ctx, record));
  if (record.kind === "short video") return refuse(ctx, "A short video has no Reels.");
  if (!ns.length) return refuse(ctx, "Say which Reels, by their numbers.");
  const reels = (record.reels || []).map((reel) => ({ ...reel }));
  for (const n of ns) {
    const reel = reels.find((r) => r.n === n);
    if (!reel) return refuse(ctx, `There is no Reel ${n}. The Reels are ${reels.map((r) => r.n).join(", ") || "none"}.`);
    if (reel.status === "finished") return refuse(ctx, `Reel ${n} is finished: it is in the hand-off already.`);
    reel.status = "dropped";
  }
  return save(ctx, found, { ...record, reels }, ns.map((n) => `Reel ${n} is dropped.`).join(" "));
}

/** Whether Reel `n` of the episode `found` is one a reading suggested and nobody has made (reels.json version 2): its candidate
    has no crops, and no project of its own is listed. It is not made yet, whatever the
    record says of it: a Reel is made in HyperFrames (`app … reel <n>`). */
function notMade(ctx, found, n) {
  const { record } = found;
  if ((record.files && timelineFile({ part: { reel: n }, v: 0 }) in record.files) || !existsSync(fileOf(ctx, found, REELS_FILE))) return false;
  const listing = readReels(readFileSync(fileOf(ctx, found, REELS_FILE), "utf8"));
  const candidate = listing.reels ? listing.reels.candidates.find((c) => c.n === n) : null;
  return Boolean(candidate && uncropped(candidate));
}

/** What is said of a Reel a reading suggested that nobody has made, by every command that needs it made: on a Mac set up for
    HyperFrames how to make it, "Reel 3 isn't made yet. Say "open Reel 3 of <name> in HyperFrames" to make it." (app-reel.js
    notMadeYet), as `title` and `reels` say it; on any other Mac, which cannot make one, that brimm-video cannot make it on this Mac
    and she is to ask Jason (notMadeWords). */
const notMadeSaid = (ctx, record, n) => (appOf(ctx.settings) ? notMadeYet(n, shownName(record)) : notMadeWords(n));

const capital = (text) => text[0].toUpperCase() + text.slice(1);

/** Which way `finish` goes for a video, by its record (plan PR 7, item 1): "hyperframes" for a raw video that has a main project in
    use, and for an iPhone clip whose main project in use the app has opened, to be finished from the exports the app made of it
    (exports.js); "clip" for any other iPhone clip she answered, which is asked whether to hand it off as it is (finishClip); "finished"
    for a finished video, which is not edited here; and "unopened" for a raw video with no main project in use, which has nothing to
    finish yet and is told so in HyperFrames' words (the not-set-up words of app.js when the app is off on this Mac): an episode from the
    Final Cut days is a raw video not yet opened in HyperFrames, and `app` makes its project from the recording. A short video from before
    the switch, answered by no one, is finished the "hyperframes" way once its project is in use, as a raw video is. */
function finishWay(ctx, record) {
  const kind = recordKind(record);
  const projects = (record.app?.projects ?? []).filter((p) => p.state !== PROJECT_KEPT);
  if ((kind === "raw" || (kind === "short video" && hasFinalCut(record))) && projects.some(inUse)) return "hyperframes";
  if (isClip(record)) return projects.some((p) => inUse(p) && Array.isArray(p.opened) && p.opened.length > 0) ? "hyperframes" : "clip";
  if (!hasFinalCut(record)) return "finished";
  return "unopened";
}

/** The Reels of the record that `app … reel N` made a project for (plan PR 5): { reel: n } for each Reel project not kept for an earlier
    kind. Such a Reel is finished from its project's export, wherever the main video was edited. */
const reelProjectsOf = (record) => (record.app?.projects ?? []).filter((p) => p.state !== PROJECT_KEPT && /^reel [1-9]\d*$/.test(p.key)).map((p) => ({ reel: Number(p.key.slice(5)) }));

/** What `finish "<episode>" reels` needs before it looks for a Reel's export (plan PR 9; architecture 4.3 and 8.7), from the record and
    the hand-off on file: why it may not go on, { why }, in plain words; or { onFile, base }, the hand-off the next revision is made
    from and the place and revision it was read at (finish.js reelsBase). In this order: a short video has no Reels; a raw video's Reels
    are handed off with its main video; the hand-off is version 2 (a finished video's is written from its spellings, in version 2
    alone); the hand-off on file, which this never writes the first of, is there, whole on this Mac (otherwise Dropbox is asked to
    bring it over, once) and one that Reels can be added to; and the record has a Reel project. */
function reelsWhy(ctx, found, record) {
  const name = shownName(record);
  const kind = recordKind(record);
  if (kind === "short video") return { why: NO_REELS };
  if (kind === "raw") return { why: rawWords(name) };
  if (!writesV2For(ctx.settings, found.folder, record)) return { why: handoffFromSpellingsWaits(name) };
  const got = reelsBase(found.folder, record, { isWhole: ctx.isWhole });
  if (got.coming) {
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: [got.coming] });
    return { why: BRINGING };
  }
  if (got.why) return got;
  return reelProjectsOf(record).length ? got : { why: noReelWords(name) };
}

/** The words a Reel made from suggestion `n` is expected to start with: the suggestion's opening in reels.json (its `first`, else its
    words), its first twelve words. "" when it was made from times she gave, or the list cannot be read. */
function suggestionOpening(ctx, found, n) {
  if (!Number.isInteger(n)) return "";
  try {
    const candidate = (readReels(readFileSync(fileOf(ctx, found, REELS_FILE), "utf8")).reels?.candidates ?? []).find((c) => c.n === n);
    const text = (v) => (typeof v === "string" ? v.trim() : "");
    return candidate ? (text(candidate.first) || text(candidate.words)).split(/\s+/).filter(Boolean).slice(0, 12).join(" ") : "";
  } catch (e) {
    return "";
  }
}

/** The lines `finish` last showed her as the words on the main video's picture, kept on this Mac's own disk beside finish.asked.json
    (plan PR 8, review I1): a yes takes the words found only when they are these, so that no yes comes before she has seen them. It
    holds { version, at, lines }; `shownWords` gives the lines, or null when the file is not there or holds no list of lines. */
const SHOWN_WORDS = "finish.shown.json";
function shownWords(work) {
  try {
    const kept = JSON.parse(readFileSync(join(work, SHOWN_WORDS), "utf8"));
    return Array.isArray(kept?.lines) ? kept.lines : null;
  } catch (e) {
    return null;
  }
}
/** Keep the lines just shown, in place of any kept before. A file that cannot be written keeps nothing, which asks her again. */
function keepShownWords(work, lines, at) {
  try {
    mkdirSync(work, { recursive: true });
    writeFileSync(join(work, SHOWN_WORDS), JSON.stringify({ version: 1, at, lines }, null, 2) + "\n");
  } catch (e) {
    // Nothing is kept: her next yes shows them again, and nothing starts without it.
  }
}
const sameLines = (kept, lines) => Array.isArray(kept) && kept.length === lines.length && kept.every((line, i) => line === lines[i]);

/** What `finish` says when it starts the detached part: when the hand-off will be ready, as a clock time and in minutes, from the speed
    this Mac measured of the finishes before it (finish-time.js) and the seconds of video this one takes (`parts`, the record's own
    lengths), and that she can carry on meanwhile. With no speed measured yet, or no video to take, it names no time it cannot back. */
function startedWords(ctx, record, parts) {
  const seconds = handoffIn(readRates(progressFolder(ctx.home)), videoSeconds(record, parts));
  if (seconds === null) return "Started. This Mac has not timed a hand-off yet, so there is no time to give. You can carry on meanwhile; the panel shows how far it is.";
  return `Started. The hand-off is ready about ${clockAt(ctx.now() + seconds * 1000)}, in ${aboutLeft(seconds)}. You can carry on meanwhile.`;
}

/** finish, the quick part (spec section 5, steps 1 and 2): find what HyperFrames exported of each part (finishWay), say what each is
    taken for, and ask what it must. With `answers.yes` and nothing left to ask, it writes what
    it was told in finish.asked.json, on this Mac's own disk, starts the detached part (finishNow) and returns once that run holds the
    episode's lock, a moment later (runStarted): it says if the run did not begin in five seconds, or began and stopped at once.
    For a main video taken from a HyperFrames export it also says the words it found on the project's picture, and asks if they are right
    (plan PR 8, on-screen.js): `answers.onScreen` are the lines she gave instead, and `answers.noOnScreen` that there are none. A yes
    takes the words found only if they are the lines the last call showed (finish.shown.json); otherwise it shows them, and starts nothing. */
export async function finishEpisode(ctx, found, answers = {}) {
  const { record } = found;
  if (claimHeld(ctx, record)) return refuse(ctx, claimHeld(ctx, record));
  // A client or group session, and a video not yet answered, are not finished here, in either version of the hand-off: refused at
  // once, before any folder is looked in, so that no part line, no "Looked in" line and no file name is printed, and before any
  // claim is written.
  const notYet = cannotFinish(record);
  if (notYet) return refuse(ctx, notYet);
  // The Reels of a video her editor finished (`finish "<episode>" reels`; plan PR 9): added to the hand-off the video has, as its next
  // revision. What it needs of the record and of that hand-off is checked at once, before any export is looked for (reelsWhy).
  const forReels = Boolean(answers.reels);
  let based = null;
  if (forReels) {
    const got = reelsWhy(ctx, found, record);
    if (got.why) return refuse(ctx, got.why);
    based = got;
  }
  // A finished video is not edited here: its hand-off is written from its spellings (saveSpellings), as version 2, which a
  // version 1 hand-off could not hold. An iPhone clip she answered is edited in HyperFrames, if at all: not opened there, it is asked
  // about once (finishClip). A raw video not opened there is told to open it. Said at once too, before any part is looked for or
  // transcribed, and with no folder named.
  const way = forReels ? "reels" : finishWay(ctx, record);
  if (way === "finished") return refuse(ctx, notInFinalCut(ctx, found, record));
  if (way === "clip") return finishClip(ctx, found, answers);
  if (way === "unopened") return refuse(ctx, appOf(ctx.settings) ? NEVER_OPENED : APP_NOT_SET_UP);
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
  const { dropbox: problems, mac: onThisMac } = problemsOf(ctx, found, record);
  if (problems.length) stops.push(`${calledAs(ctx, found)} is not whole in Dropbox: ${problems.join(" ")}`);
  stops.push(...onThisMac);
  const running = runningCommand(ctx.home, found.name, ctx.alive);
  // What she says to hand it off, in the words of the way it goes: the Reels' or HyperFrames'.
  const sayIt = forReels ? '"hand off the Reels"' : '"hand it off"';
  if (running) stops.push(stoppedWords(ctx, found, record, { generic: `${running} is running for this episode. Say "how far is it?"`, again: `Say ${sayIt} again then.` }));
  // A finished Reel's title is the words in its picture, which BRIMM Ops is told: one that has none is asked for, never made up.
  /** What is said of each part, and then of what was passed over, before the stops and the asks. */
  const lines = [];
  // HyperFrames' exports, in Downloads and in the exports folder this Mac picked (exports.js), for the projects of the record.
  const seen = exportsFound({ home: ctx.home, exports: exportsFolderOf(ctx.settings, ctx.home), name: found.name, record, zone: ctx.deps.zone, readdir: ctx.deps.readdir });
  if (seen.unreadable) return refuse(ctx, DOWNLOADS_UNREADABLE);
  if (seen.exportsUnreadable) return refuse(ctx, exportsUnreadable(folderWords(exportsFolderOf(ctx.settings, ctx.home), ctx.home)));
  // A finished video has no main project, so no part is made for the main video and nothing asks for one.
  const looked = lookForExports(forReels ? { ...seen.input, parts: seen.input.parts.filter((part) => part.reel) } : seen.input, answers);
  // A Reel number another version of the video gave under the same id is never given again: said now, before any export is waited for,
  // in the words the detached part says it in (numbersTakenWords), of the hand-off as it would then be.
  if (forReels) {
    const again = numbersTakenWords(record, nextHandoff({ onFile: based.onFile, reels: looked.parts.filter((part) => !part.kept).map((part) => ({ n: part.reel })) }), target.taken);
    if (again) return refuse(ctx, again);
  }
  lines.push(...looked.parts.map((part) => part.line), ...looked.mentions);
  // A Reel picked that has no project cannot be exported from the app: it is left out, and said.
  const projects = record.app?.projects ?? [];
  for (const reel of (record.reels || []).filter((r) => r.status === "picked" && !projects.some((p) => p.key === `reel ${r.n}` && p.state !== PROJECT_KEPT))) {
    lines.push(`Reel ${reel.n} is picked but has no HyperFrames project, so it is left out. Say "make Reel ${reel.n}" to make one.`);
  }
  // The words on the main video's picture (plan PR 8; architecture 8.5): those the project holds, read for her to confirm with her yes, or the
  // ones she gives; with none found, she is asked. A main video kept as the last finish made it is not asked.
  let onPicture = null;
  // Whether this call showed her the words found for her to say they are right: her yes is to the words she was shown, so this call starts nothing.
  let showing = false;
  const work = episodeWork(ctx.home, found.name);
  const main = looked.parts.find((p) => p.key === "main");
  if (main && v2) {
    const read = main.video ? projectWordsIn(work, main.project) : { here: true, words: [] };
    const said = mainWordsSaid({ found: read.words, here: read.here, incomplete: read.incomplete, given: answers.onScreen, none: answers.noOnScreen, yes: answers.yes, taking: Boolean(main.video), shown: sameLines(shownWords(work), read.words.map((word) => word.text)) });
    if (said.refusal) return refuse(ctx, said.refusal);
    if (said.line) lines.push(said.line);
    if (said.ask) looked.asks.push(said.ask);
    if (said.shows) {
      showing = true;
      keepShownWords(work, said.shows, localStamp(new Date(ctx.now())));
    }
    onPicture = said.words;
  }
  // (A Reel of a finished video that is kept stays in the hand-off as it was, with the title it has there: none is asked for it.)
  for (const part of looked.parts.filter((p) => p.reel && !(forReels && p.kept))) {
    const reel = (record.reels || []).find((r) => r.n === part.reel);
    if (reel && String(reel.title || "").trim()) continue;
    // A Reel project must have its Reel in the record, whose title and numbers the hand-off takes; one finished another way is kept as it is.
    if (!reel) {
      if (part.project) stops.push(`The record has no Reel ${part.reel} for its HyperFrames project: ask Jason.`);
      continue;
    }
    const opening = suggestionOpening(ctx, found, part.fromSuggestion);
    // What the Reel's picture holds is a proposal for its title, which she confirms as she gives any title (plan PR 8).
    looked.asks.push(reelTitleAsk({ n: part.reel, found: part.project ? projectWordsIn(work, part.project).words : [], opening }));
  }
  for (const line of [...lines, ...looked.stops, ...stops, ...looked.asks]) ctx.say(line);
  // An explainer in a HeyGen voice (PR H6) is told what YouTube asks of it, ending what the finish found.
  if (isFromPlan(record) && record.planned.route === "explainer" && record.planned.voice === "heygen") ctx.say(HEYGEN_YOUTUBE);
  if (looked.stops.length || stops.length) {
    ctx.say(looked.looked);
    return 1;
  }
  // Reels that are all kept as the hand-off has them, or none: there is no revision to write (the questions come first, since an answer
  // may take an export).
  if (forReels && !looked.asks.length && !looked.parts.some((part) => !part.kept)) return refuse(ctx, nothingNewWords(shownName(record), based.base.revision, retitledReels(based.onFile.reels, record.reels)));
  if (looked.asks.length || !answers.yes || showing) {
    if (!looked.asks.length) ctx.say(`Hand-off question: ${forReels ? REELS_ASK : HAND_OFF_ASK}`);
    return 0;
  }
  // The finish holds the episode while it runs: an episode nobody has open is claimed for this Mac first, so the other Mac's
  // open is refused until the finish lets it go (the review of PR 21, finding 2).
  let rev = record.rev;
  if (!record.editing) {
    if ((await save(ctx, found, claimed(record, ctx.machine, localStamp(new Date(ctx.now()))), "")) !== 0) return 1;
    const again = readEpisode(found.folder);
    if (!again.record) return refuse(ctx, notRead(ctx, { ...found, read: again }));
    rev = again.record.rev;
  }
  // What finish was told, for the detached part. A part says its project, the suggestion it was made from and the words it is expected to
  // start with; its video is the export, with no export of the edit to go with it.
  const askedPart = (p) => ({
    key: p.key, label: p.label, ...(p.reel ? { reel: p.reel } : {}), projects: p.projects,
    project: p.project, fromSuggestion: p.fromSuggestion ?? null, expected: p.reel && !p.kept ? suggestionOpening(ctx, found, p.fromSuggestion) : "",
    ...(p.key === "main" && onPicture !== null ? { onPicture } : {}),
    video: p.video ? { name: p.video.name, dir: p.video.dir, where: p.video.where, bytes: p.video.bytes, mtimeMs: p.video.mtimeMs } : p.video,
    export: p.export, kept: p.kept, noHandEdits: false
  });
  const asked = { version: 1, source: "hyperframes", ...(forReels ? { base: based.base } : {}), at: localStamp(new Date(ctx.now())), rev, ...(rev !== record.rev ? { claimed: true } : {}), parts: looked.parts.map(askedPart) };
  mkdirSync(work, { recursive: true });
  writeFileSync(join(work, "finish.asked.json"), JSON.stringify(asked, null, 2) + "\n");
  // A finish that has started has used what it was shown: the next finish shows its words again.
  try {
    rmSync(join(work, SHOWN_WORDS), { force: true });
  } catch (e) {
    // Whatever stands in its place is not a file it kept: it is read as nothing shown.
  }
  startDetached(ctx, { command: "finish", folder: found.name });
  // It returns once the run it started has taken hold of the episode (its lock), so that what is asked of the guide next, `guide … tell`,
  // finds the finish at work and not the step from before it: the process takes a moment to begin.
  const up = await runStarted(ctx, found);
  if (up === "stopped") return refuse(ctx, STOPPED_AT_ONCE);
  if (up === "") return refuse(ctx, `The finish did not start: nothing is running for this episode after ${START_WAIT_MS / 1000} seconds. Say "how far is it?" to see, and say ${sayIt} again if nothing is.`);
  ctx.say(startedWords(ctx, record, looked.parts));
  return 0;
}

/** How long `finish … --yes` waits, at most, for the run it started to hold the episode's lock, and how often it looks. A test that
    gives `startWaitMs` waits that long instead, none at all with 0: its stand-in for the process starts nothing. */
const START_WAIT_MS = 5000;
const START_LOOK_MS = 100;
/** What `finish … --yes` says when the run it started began and ended before the first look, and wrote no hand-off: why is in the status. */
const STOPPED_AT_ONCE = 'The finish stopped as soon as it started, and wrote no hand-off. Say "how far is it?" to see why.';

/** Wait for the finish `startDetached` just started: "running" once the episode's lock is held by a finish run, "ended" once a run of
    this yes has begun and ended well already, "stopped" once one has ended without a hand-off, and "" when none has begun after the time
    to wait, which is START_WAIT_MS unless a test gives another (0 does not look: "running"). Looks every START_LOOK_MS, by the clock's
    wait. */
async function runStarted(ctx, found) {
  const within = ctx.deps.startWaitMs ?? START_WAIT_MS;
  if (within <= 0) return "running";
  const wait = sleepOf(ctx);
  const began = ctx.now();
  for (;;) {
    if (runningCommand(ctx.home, found.name, ctx.alive) === "finish") return "running";
    const ended = endedSinceYes(ctx.home, found.name);
    if (ended) return ended.result.ok === false ? "stopped" : "ended";
    const left = within - (ctx.now() - began);
    if (left <= 0) return "";
    await wait(Math.min(START_LOOK_MS, left));
  }
}

/** `finish "<episode>" [--yes] [--take "<part>=<file>"]… [--final "<part>"]…
    [--without "reel <n>"]… [--as-it-is]`, and the
    detached part it starts, `finish --now "<episode folder>"`, which runs finishNow holding the episode's lock. */
async function finish(ctx, rest) {
  const { words, flags } = flagsOf(rest, ["take", "without", "final", "on-screen"]);
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
    const result = await runDetached({ home: ctx.home, folder: found.name, clean: resultClean(ctx), command: "finish", alive: ctx.alive, ...(ctx.deps.keepAwake ? { keepAwake: ctx.deps.keepAwake } : {}) }, ({ nonce }) => finishNow(ctx, { folder: found.folder, name: found.name, record: found.read.record }, { progress, nonce, notify: ctx.deps.notify || banner }));
    if (result.taking || result.running) {
      ctx.say(result.taking ? `Another run is taking over ${calledAs(ctx, found)}'s lock. Say finish again in a moment.` : `${result.running} is running for ${calledAs(ctx, found)} already.`);
      // The finish never ran: a claim its quick part took for it is let go (the P1 check, T17).
      const gone = letGoClaim(ctx, { folder: found.folder, name: found.name });
      if (gone) ctx.say(gone);
      return 1;
    }
    return result.ok ? 0 : 1;
  }
  // The Reels of a video her editor finished (plan PR 9): the word `reels` after the episode's, when another word comes before it.
  const reels = reelsAsked(words);
  const got = episodeFor(ctx, reels ? reels.episode : words, { newerEnds: 1 });
  if (!got.found) return got.code;
  // A session's finish is its own: the hand-off of what she approved of its teachings. It has no Reels to hand off this way.
  if (taughtSession(got.record)) return reels ? refuse(ctx, cannotFinish(got.record)) : finishSessionCommand(ctx, { ...got.found, record: got.record });
  const take = Object.fromEntries((flags.take || []).map((given) => [given.slice(0, given.indexOf("=")).trim(), given.slice(given.indexOf("=") + 1).trim()]).filter(([part]) => part));
  return finishEpisode(ctx, { ...got.found, record: got.record }, { yes: Boolean(flags.yes), take, without: flags.without || [], final: flags.final || [], asItIs: Boolean(flags["as-it-is"]), onScreen: flags["on-screen"] || [], noOnScreen: Boolean(flags["no-on-screen"]), reels: Boolean(reels) });
}

/** Whether a file or folder name is one Dropbox never syncs: one starting with a dot, as Finder's .DS_Store, or Icon\r. */
const notSynced = (name) => name.startsWith(".") || name === "Icon\r";

/** Every file in a folder, at any depth, as paths from it, but for those Dropbox never syncs: a name starting with a dot, as
    Finder's .DS_Store, or Icon\r. Listed, the other Mac would wait for them for ever. */
const filesUnder = (dir) => readdirSync(dir, { recursive: true })
  .filter((rel) => !String(rel).split("/").some(notSynced) && statSync(join(dir, rel)).isFile()).sort();

/** What `show` prints, by the word for it: the file's ending after the video's own name, and what it is called. */
const SHOWN = { transcript: [".transcript.txt", "transcript"], notes: [".edit-notes.txt", "notes from Claude"], plan: [".cut-plan.txt", "cut plan"] };

/** `show "<episode>" transcript|notes|plan`: print the episode's transcript, Claude's notes or the cut plan, whole. Her session
    reads an episode's files only through this (spec section 4), and it takes no path. A file not whole on this Mac yet is
    brought over by a detached run, as open does. The transcript of a raw video she has answered is its rough cut's, with its
    times (spec 3, "Show me the transcript"), unless the record has a main HyperFrames project in use: then it is the recording's own,
    with the times of the project's timeline (plan PR 7, item 5). Those are the recording's captions where the project's index.html
    puts the recording, which is not the start when the app's agent has moved it for a title card (on-timeline.js); when the page, the
    recording in it or the captions cannot be read, the recording's own transcript is printed as it is, with its own times. A finished
    video's, a clip's with no main project and one from before the switch is the video's own. Of a video not yet answered, or a
    session whose mark is not cleared, it prints nothing into her chat (printWhy): it opens a read-only copy of the file on this Mac,
    in TextEdit (showCopy). */
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
  // are the project's timeline's where the page leaves the recording at its start; otherwise the rough cut's, which the reading still
  // makes (Jason kept it, 6 November 2026).
  const projectInUse = (record.app?.projects ?? []).some(inUse);
  const roughCut = kind === "transcript" && isAnswered(record) && recordKind(record) === "raw" && !projectInUse;
  const file = roughCut ? `${stem}.rough-cut.transcript.txt` : `${stem}${ending}`;
  const path = fileOf(ctx, found, file);
  /** A file not whole on this Mac yet is brought over by a detached run, unless one is at it already. */
  const bringing = (name) => {
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: [name] });
    return refuse(ctx, "Dropbox is still bringing it over; say it again when it is done.");
  };
  if (!existsSync(path)) return refuse(ctx, `${shownName(record)} has no ${what} yet.`);
  if (!ctx.isWhole(path)) return bringing(file);
  // The recording's own transcript has the recording's times. Where the project's page puts the recording is where they are on its timeline,
  // so the recording's captions are printed at those times when the page, the recording in it and the captions can be read (on-timeline.js).
  const placements = kind === "transcript" && projectInUse && !roughCut ? recordingPlacementsIn(mainProjectDir(ctx, { found, record })) : [];
  const captions = fileOf(ctx, found, `${stem}.srt`);
  if (placements.length && existsSync(captions)) {
    if (!ctx.isWhole(captions)) return bringing(`${stem}.srt`);
    let onTimeline = null;
    try {
      onTimeline = timelineTranscript(readFileSync(captions, "utf8"), placements);
    } catch (e) {
      // Captions that cannot be read are no captions: the recording's own transcript is printed, with its own times.
    }
    if (onTimeline === "") return refuse(ctx, `${shownName(record)} has no spoken words on its timeline.`);
    if (onTimeline !== null) {
      ctx.say(onTimeline.replace(/\n$/, ""));
      return 0;
    }
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
    (notes.js notesText), and Claude's own notes in them hold no empty line. An idea for a graphic is a graphic cue now (PR H1,
    graphic-cues.js), told under the same heading and, when it sits on words that are cut, in the same line. */
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

/** A read-only copy of `what` of the episode `found`, made in its shown folder (madeShownDir) by `fill(copy)`, which writes its content: the earlier copies
    `show` made go first, the copy is named by the video's name and listed by the folder's marker, and it is made read-only. Returns its path; throws when
    it cannot be made. `show` copies a file this way (showCopy), and `plan … script` (plan-script.js; review changes R5) writes the plan's own text. */
function madeShown(ctx, found, record, what, fill) {
  clearShownIn(madeShownDir(ctx, found, record), (listed) => listed.endsWith(".txt"));
  const dir = madeShownDir(ctx, found, record);
  const named = freeShownName(dir, `${fileSafe(namedAs(found, record))} ${what}`, ".txt");
  const copy = join(dir, named);
  addShown(dir, named);
  fill(copy);
  chmodSync(copy, 0o444);
  return copy;
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
  const from = fileOf(ctx, found, rel);
  if (!existsSync(from)) return refuse(ctx, `${name} has no ${what} yet.`);
  let copy = "";
  try {
    copy = madeShown(ctx, found, record, what, (to) => copyFileSync(from, to));
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
  const could = "Could not check for a newer BRIMM Video Studio. Is this Mac offline?";
  // Her folder is looked at whatever git answers: that needs no network.
  const stale = studioStale(ctx);
  const folderLine = () => {
    if (stale) ctx.say(`Her folder for Claude is out of date: an older BRIMM Video Studio wrote it. Ask Jason to update it when it suits. (Jason: in the checkout, run node tool/settings.js studio --node ${stale.node}, then start a new session in her Claude folder)`);
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
  else if (n === 0) ctx.say("This Mac has the newest BRIMM Video Studio.");
  else ctx.say(`Jason has a newer BRIMM Video Studio (${n} change${n === 1 ? "" : "s"}). Ask him to update this Mac when it suits.`);
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
  // A plan's own fields (`planned`), said as plain lines and never as JSON: the script's lines that differ, and a count for the cues and the shots.
  const cut = (t) => (t.length > 120 ? `${t.slice(0, 119)}…` : t);
  const count = (x, y) => `A has ${(x || []).length}, B has ${(y || []).length}`;
  const plain = (v) => (v === null || v === undefined ? "none" : typeof v === "string" ? `"${cut(v)}"` : null);
  const keysOf = (x, y, skip) => [...new Set([...Object.keys(x || {}), ...Object.keys(y || {})])].filter((k) => !skip.includes(k)).sort();
  const plannedRows = () => {
    const x = a.planned;
    const y = b.planned;
    if (!x && !y) return [];
    if (!x || !y) return [["The plan", "A", "B", ["Only one side is a plan."]]];
    const rows = [];
    const lines = [];
    const most = Math.max(x.lines.length, y.lines.length);
    for (let i = 0; i < most; i++) {
      if (x.lines[i] === y.lines[i]) continue;
      lines.push(`A: ${i < x.lines.length ? `"${cut(x.lines[i])}"` : "no such line"}`, `B: ${i < y.lines.length ? `"${cut(y.lines[i])}"` : "no such line"}`);
    }
    if (lines.length) rows.push(["The script", "A", "B", ["The script is different:", ...lines.slice(0, 12), ...(lines.length > 12 ? [`...and ${(lines.length - 12) / 2} more lines differ.`] : [])]]);
    if (JSON.stringify(x.cues) !== JSON.stringify(y.cues)) rows.push(["The graphic cues", "A", "B", [`The graphic cues are different: ${count(x.cues, y.cues)}.`]]);
    if (JSON.stringify(x.shots) !== JSON.stringify(y.shots)) rows.push(["The shots", "A", "B", [`The shots are different: ${count(x.shots, y.shots)}.`]]);
    if (x.title !== y.title) rows.push(["The title", "A", "B", [`The title is different: A says "${cut(x.title)}", B says "${cut(y.title)}".`]]);
    for (const k of keysOf(x, y, ["lines", "cues", "shots", "title"])) {
      if (JSON.stringify(x[k]) === JSON.stringify(y[k])) continue;
      const [p, q] = [plain(x[k]), plain(y[k])];
      rows.push([`The plan's ${k}`, "A", "B", [p !== null && q !== null ? `The plan's ${k} is different: A has ${p}, B has ${q}.` : `The plan's ${k} is different.`]]);
    }
    return rows;
  };
  const who = (r) => (r.editing ? r.editing.by : "nobody");
  // Where a side keeps the episode's files (Phase 3, L4), in plain words: the Mac its `local` names, else Dropbox.
  const keptWords = (r) => (r.local && typeof r.local.on === "string" && r.local.on !== "" ? spokenMac(r.local.on) : "Dropbox");
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
    ...fields(a, b, ["version", "rev", "writer", "editing", "name", "title", "reels", "main", "finished", "released", "files", "planned", "local"]).map((k) => [`${k[0].toUpperCase()}${k.slice(1)}`, as(k === "reading" ? reading(a) : a[k]), as(k === "reading" ? reading(b) : b[k])]),
    ...fields(a.main, b.main, ["pushed"]).map((k) => [`The main video's ${k}`, as(a.main && a.main[k]), as(b.main && b.main[k])]),
    ...ns.flatMap((n) => fields(reelOf(a, n), reelOf(b, n), ["n", "status", "pushed"]).map((k) => [`Reel ${n}'s ${k}`, as((reelOf(a, n) || {})[k]), as((reelOf(b, n) || {})[k])]))
  ];
  const rows = [
    ["Who has it open", who(a), who(b)],
    ["Name", `"${a.name && a.name.text}"`, `"${b.name && b.name.text}"`],
    ["Title", title(a), title(b)],
    ["Kept on", keptWords(a), keptWords(b)],
    ...plannedRows(),
    ...ns.map((n) => [`Reel ${n}`, reel(a, n), reel(b, n)]),
    ["The main video", shownIn(a.main && a.main.pushed), shownIn(b.main && b.main.pushed)],
    ["Finished", finished(a), finished(b)],
    ["Handed over", handed(a), handed(b)],
    ...others,
    ...sizes("File", a.files, b.files),
    ...sizes("Handed-over file", a.released && a.released.files, b.released && b.released.files)
  ].filter(([, x, y]) => x !== y);
  const names = gated(a) || gated(b) ? namesOf(a.video && a.video.file, b.video && b.video.file) : null;
  const shown = (what) => ["Who has it open", "Kept on", "Finished", "Handed over", "The main video"].includes(what) || what.startsWith("File ") || what.startsWith("Handed-over file ");
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

/** A JSON file, read only when it is a regular file, or null (a link, a pipe, a folder, a file that is not there, cannot be read or is not JSON):
    the guide only reads, and answers at once, so a pipe where a file should be is never waited for (exports.js readRegular). */
function regularJson(path) {
  const text = readRegular(path);
  try {
    return text === null ? null : JSON.parse(text);
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
  // A plan (the final review, fix 2) that one side has made into its video by the join: the other side is the plan as it was, and keeping it would unmake the video.
  if (recordKind(other) !== null && recordKind(kept) === null && isPlannedRecord(kept)) return `One side has "${shownName(kept)}" made from its footage: keep that side; a plan is made from its footage once.`;
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
  // Dropbox keeps a conflicted copy of a file in Dropbox only: the copy, and the file it is of, are looked for in the episode's folder there.
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
        for (const [what, x, y, said] of differ) {
          if (said) for (const line of said) ctx.say(line);
          else ctx.say(x === null ? `  ${what}: they differ.` : `  ${what}: A: ${x}; B: ${y}`);
        }
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
    // Sides that keep the episode's files in different places (Phase 3, L4): keeping either leaves the other's files behind. So when either side lists a
    // file kept on a Mac it is for Jason. A plan lists none of its own (its three files are in Dropbox): keeping either side is allowed, and the side kept
    // says which Mac it is filmed on, unless a part of it is kept on another Mac than that one, whose footage would then be left behind.
    const placeOf = (r) => (r.local && typeof r.local.on === "string" ? r.local.on : null);
    const listsLocal = (r) => Object.keys(r.files || {}).some((rel) => filePlace(r, rel) === "local");
    if (placeOf(record) !== placeOf(copyRecord)) {
      const kept = keep === "B" ? copyRecord : record;
      const keptMac = kept.local && typeof kept.local.on === "string" ? kept.local.on : null;
      const behind = (record.planned || copyRecord.planned) && partsOfPlan(ctx.root, record.id, { newer: true }).some((part) => part.record?.local?.on && part.record.local.on !== keptMac);
      if ([record, copyRecord].some(listsLocal) || behind) return refuse(ctx, `The two sides keep ${name}'s files in different places, so keeping ${keep} could leave files behind. ${NEEDS_JASON}`);
    }
  }
  const aHere = existsSync(at(of));
  if (!isRecord && keep === "A" && !aHere) return refuse(ctx, `A, ${of}, is not there, so it cannot be kept. Say B. If that is not what you want, tell Jason.`);
  // 1. Set aside, by the rule, every file this step replaces or deletes, and see each is whole there. A record copy kept as B,
  // or one in force already, sets the record of its number aside too; a record file itself is never deleted.
  const stamp = localStamp(new Date(ctx.now())).replace(/:/g, "-");
  const asideOf = (rel) => join(found.folder, "history", `${stamp} ${basename(rel)}`);
  for (const rel of keep === "A" ? [copy] : [...(aHere ? [of] : []), copy]) {
    try {
      mkdirSync(join(found.folder, "history"), { recursive: true });
      cloneIn(at(rel), asideOf(rel), ruleOpts(ctx));
    } catch (e) {
      return refuse(ctx, `${rel} could not be set aside in history/ (${basename(plainWhy(e).split(": ").pop())}). Nothing was deleted. Say "sort out the conflict" again in a minute. If it says this again, tell Jason.`);
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
  const chosen = isRecord ? (keep === "B" ? copyRecord : record) : sized(record, keptBytes);
  // A plan's files are made from the record kept: each that differs is written by the rule before the record (which lists their
  // sizes) is, and put back as it was when the record is refused. A file that already matches is left as it is.
  const planText = isRecord && chosen.planned ? planFilesFrom(chosen) : null;
  const planHad = {};
  for (const name of Object.keys(planText || {})) planHad[name] = existsSync(at(name)) ? readFileSync(at(name), "utf8") : null;
  const planNow = planText ? Object.entries(planText).filter(([name, text]) => planHad[name] !== text) : [];
  const next = planText
    ? { ...chosen, files: { ...Object.fromEntries(Object.entries(chosen.files).filter(([name]) => !PLAN_FILE_NAMES.includes(name))), ...Object.fromEntries(Object.entries(planText).map(([name, text]) => [name, Buffer.byteLength(text)])) } }
    : chosen;
  const putPlan = (entries) => {
    const putWork = join(runsFolder(ctx.home), `resolve-plan-${process.pid}-${ctx.now()}`);
    const put = textWriter({ work: putWork, ...ruleOpts(ctx) });
    const done = [];
    try {
      for (const [name, text] of entries) {
        done.push(name);
        put(at(name), text, { replace: true });
      }
    } catch (e) {
      for (const name of done) {
        try {
          if (planHad[name] === null) rmSync(at(name), { force: true });
          else put(at(name), planHad[name], { replace: true });
        } catch (back) {
          // The file could not be put back either: the late check of "episodes" names it.
        }
      }
      throw e;
    } finally {
      rmSync(putWork, { recursive: true, force: true });
    }
  };
  // The plan's files that are not as they were before this keep, by what is on the disk now.
  const planOff = () => planNow.map(([name]) => name).filter((name) => (existsSync(at(name)) ? readFileSync(at(name), "utf8") : null) !== planHad[name]);
  const unsure = (names, why) => `The record was not changed (${why}), but the plan's files may not match it: ${names.join(", ")}. The next "episodes" names any that is wrong. Say "sort out the conflict" again to put them right; if it still says a file is not whole, tell Jason the episode's name.`;
  let written = null;
  if (planNow.length) {
    // Each plan file that differs is set aside in history/ first, as step 1 sets aside the files it replaces: a script changed by hand lives
    // only in its file (final review M8). A file that was not there has nothing to set aside.
    for (const [name] of planNow) {
      if (planHad[name] === null) continue;
      try {
        mkdirSync(join(found.folder, "history"), { recursive: true });
        cloneIn(at(name), asideOf(name), ruleOpts(ctx));
      } catch (e) {
        return refuse(ctx, `${name} could not be set aside in history/ (${basename(plainWhy(e).split(": ").pop())}). Nothing was written, and nothing deleted. Say "sort out the conflict" again in a minute. If it says this again, tell Jason.`);
      }
    }
    try {
      putPlan(planNow);
    } catch (e) {
      const stuck = planOff();
      if (stuck.length) return refuse(ctx, unsure(stuck, `the plan's files could not be written: ${plainWhy(e)}`));
      return refuse(ctx, `Nothing was written, and nothing deleted: the plan's files could not be written (${plainWhy(e)}). Say "sort out the conflict" again in a minute. If it says this again, tell Jason.`);
    }
  }
  if (!inForce || JSON.stringify(next.files) !== JSON.stringify(record.files)) {
    try {
      written = write(next, record.rev);
    } catch (e) {
      try {
        putPlan(planNow.filter(([name]) => planHad[name] !== null).map(([name]) => [name, planHad[name]]));
        for (const [name] of planNow) if (planHad[name] === null) rmSync(at(name), { force: true });
      } catch (back) {
        // What is still not as it was is found below.
      }
      const stuck = planOff();
      if (stuck.length) return refuse(ctx, unsure(stuck, plainWhy(e)));
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
      return refuse(ctx, `B could not be put in place of ${of}: ${why}, and A could not be put back either. A is whole in history/${basename(asideOf(of))}, and B is still the copy, ${copy}.${recordNote} Say "sort out the conflict" again in a minute. If it says this again, tell Jason.`);
    }
  }
  rmSync(shownFile, { force: true });
  // After every keep, the files are checked against the record now in force: a file out of step is named, and never left for
  // both Macs to refuse in silence (round 2, D: W1, W8).
  const outOfStep = () => {
    const inForceNow = readEpisode(found.folder, { pastCopies: true }).record;
    const { dropbox, mac } = inForceNow ? problemsOf(ctx, found, inForceNow) : { dropbox: [], mac: [] };
    // resolve again would say there is no conflict: open is what says again whether a file is not whole (the final check). A file kept on
    // this Mac is not Dropbox's to bring: it is said in this Mac's words, on its own.
    return [
      ...(dropbox.length ? [`The files are not as the record now lists them: ${dropbox.join("; ")}. Once Dropbox has finished, say "open" again; if it still says a file is not whole, ${NEEDS_JASON[0].toLowerCase()}${NEEDS_JASON.slice(1)}`] : []),
      ...mac
    ].map((line) => `\n${line}`).join("");
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
  ctx.say(planText ? `Kept ${keep}. The plan's files are written from it. The other is set aside in history/.${caveat}${step}` : `Kept ${keep} of ${of}. The other is set aside in history/.${caveat}${step}`);
  return step ? 1 : 0;
}

/** `free "<episode>"`: take away an episode's working copy and the renders of its HyperFrames projects from this Mac, to give the room
    back (free.js; plan PR 15; architecture 6.1 and 7.4). The project, with everything done in it, stays, and `app` makes the video
    again. In order:
    - the old spelling, `free "<episode>" library` (with or without `--yes`), is no command now: it says the help and ends with 2,
      and takes nothing. It names no episode in what it says, so the gate does not ask;
    - it takes no flag, and with no words it says the help and ends with 2. A flag nobody built (`--dry-run`) is not taken for one
      that is, since this command deletes files;
    - the gate, as for every command that names an episode (episodeFor): `free` is in no gate list (architecture 6.2), so a video not
      yet answered, a video left alone, a session not cleared and a video held beside a session are refused in the gate's own words;
    - free.js freeEpisode, which refuses before it takes anything, takes named paths in this Mac's work folder (the video of the main
      project in use, the renders of every project but a session clip's, and the folder of copies), and writes no record.
      `ctx.deps.running` is how a test says whether HyperFrames is running; it asks pgrep otherwise. */
async function free(ctx, rest) {
  const { words, flags } = flagsOf(rest, []);
  if ((words.length >= 2 && words[words.length - 1] === "library") || Object.keys(flags).length) {
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
    let read = readTeachings(folderAt(ctx, { folder: found.folder, record: rec }, "local"), rec, ctx.isWhole);
    if (read.coming && !(await broughtOver(ctx, found, [read.coming])).length) read = readTeachings(folderAt(ctx, { folder: found.folder, record: rec }, "local"), rec, ctx.isWhole);
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
  // A short video she has answered has no Reels, and its reading writes no list of them: said as drop says it.
  if (isAnswered(record) && record.kind === "short video") return refuse(ctx, "A short video has no Reels.");
  const at = fileOf(ctx, found, REELS_FILE);
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
  // A video she has answered the card of is listed with its times on the video's own clock (video-clock.js), or on the recording's
  // own when that cannot be read now: a file is not whole yet, or the read fails. Nothing is brought from here, no preview is made
  // or opened, and asking Claude again is not offered (spec 3, "The Reel suggestions").
  if (isAnswered(record)) {
    let now = null;
    try {
      now = videoClock({ ...found, record }, ctx, "main");
    } catch (e) {
      now = null;
    }
    const clock = now && now.clock && now.clock.length ? now : null;
    ctx.say(reelsText(read.reels, record, "", clock));
    // She is told last how to make one: on a Mac set up for HyperFrames, `app … reel <n>` makes it (plan PR 5), and on any other
    // nothing makes a Reel from a suggestion, so she is told that brimm-video cannot make Reels on this Mac and to ask Jason, so that
    // no command sends her round in a circle (Sallie's walkthrough, 25 Oct). Not once she has dropped every one. The gate refuses a
    // session before this, and it is never said of one. Only of a suggestion still to make: not one she dropped, and not one
    // `app … reel <n>` has made, which has a project in the record (on this Mac or the other's) and is picked.
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
  const coming = previews.filter((rel) => !ctx.isWhole(fileOf(ctx, found, rel)));
  if (coming.length) {
    ctx.say(`Dropbox is still bringing ${coming.join(", ")} over to this Mac. Say "show me the Reels" again when it is done.`);
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: coming });
  }
  for (const rel of previews.filter((p) => !coming.includes(p))) ctx.openApp("QuickTime Player", fileOf(ctx, found, rel));
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
  if (running) return { why: stoppedWords(ctx, found, record, { generic: `${running} is running for ${calledAs(ctx, found)} already. Say it again when it has finished.`, again: "Say it again then.", of: ` of ${calledAs(ctx, found)}` }) };
  if (!(ctx.deps.tools || findPrograms()).claude) return { why: NO_CLAUDE_CODE };
  return askBlocked({ folder: found.folder, record, root: ctx.root, statusFolders: statusReadFolders(ctx), home: ctx.home, machine: ctx.machine, now: ctx.now(), whole: ctx.isWhole });
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
      ...ruleOpts(ctx), ...(ctx.deps.commit ? { commit: ctx.deps.commit } : {})
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
/** The same of a run that makes the copies of a plan's footage (`workcopy … --footage`, PR H5b) for a video that is not made from a plan. */
const NOT_FROM_PLAN = canNotBeUsed("it is not a video made from its footage");

/** Wait, as a raw reading does (reading.js readEpisodeNow), while the import's late check of the episode's video is still to come
    (unedited.js importHold): the working copy is made from the raw video as filed, whole and checked (architecture 2026-10-27, 5.7), or,
    while this Mac owes the check and holds the file the import came from, from that file (plan R1b), and that check may put the video in again. `kind` asks for the copy at once; the run does the waiting. Resolves { record }, the
    episode's record as it is once nothing holds the video, or { why }, in the words the reading uses, when the run must end:
    - a hold that clears by itself, an import of the video at work on either Mac, or this Mac's own late check of it before its time
      with no problem found, is waited for: it is looked at again every READ_LOOK_MS, for READ_HOLD_MS at most. The wait is a step of
      its own in the progress panel (WORK_COPY_WAIT_STEP), so that "how far is it?" says it, and it is ended before the copy begins;
    - a hold that does not, an import that failed or stopped, a late check that found a problem, or one this Mac owes past its time
      with no import at work to make it, ends the run at once with that hold's words (importHold's `why`), as the reading's ends;
    - a hold that waits, while this Mac owes the late check and holds the file the import came from (late-wait.js localSource), does not
      wait: the run goes on at once with `from`, the path of that file, which it reads in place of the video; the check is still made by
      the import, behind the run (plan R1b);
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
      const hold = importHold({ root: ctx.root, statusFolders: statusReadFolders(ctx), home: ctx.home, machine: ctx.machine, record, now: ctx.now() });
      if (!hold.why) return { record };
      if (!hold.waits) return { why: hold.why };
      // This Mac still owes the late check, and holds the file the import came from: the copy is read from it, now, and the check goes on
      // behind the run (plan R1b). The stops above (a failed import, a problem found, a stopped import) have won already.
      const local = localSource(ctx, record);
      if (local) {
        log(`${name}: the video for HyperFrames is made from the copy this Mac holds, while Dropbox's check of its copies goes on.`);
        return { record, from: local.path };
      }
      if (waited >= READ_HOLD_MS) return { why: hold.why };
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

/** The copies with no sound of the footage of the video made from the plan `record` (PR H5b), made one after the other (workcopy.js makeFootageCopies):
    of each b-roll and screen part that may go into its project (join.js footageToUse). Every part that gives nothing now is said in the log, with
    why: a conflict in its episode, a record a newer brimm-video wrote, a shot that is not of its kind any more, a client who has not agreed. The
    parts are read once, past any conflicted copy and with the newer ones (footage.js partsOf), so that one that must not be used is known and
    left out. Each is named in the panel and the log by the plan and what the part shows, "Too many SKUs, b-roll for shot 2". Resolves what
    makeFootageCopies does, { ok, made, failed, next }. */
async function planFootage(ctx, { found, record, deps }) {
  const parts = partsOfPlan(ctx.root, record.id, { newer: true });
  for (const { part, why } of footageWithheld(record, parts)) deps.log(`${partLabelOf(part)}: its footage is left out of the project: ${why}.`);
  const items = footageToUse(record, parts)
    .filter(({ part }) => typeof part.record.video?.file === "string")
    .map(({ part, as, shot }) => ({ video: fileAt(ctx, part, part.record.video.file), shot, name: `${shownName(record)}, ${SHOT_SAID[as]} for shot ${shot}` }));
  const done = await makeFootageCopies({ home: ctx.home, folder: found.name, items }, { ...deps, isWhole: ctx.isWhole, readAll: ctx.deps.readAll || readThrough });
  return { ...done, next: "" };
}

/** `workcopy --now "<episode folder>" [--4k | --reel <n> | --footage]`, the detached run `kind` and `app` start (workcopy.js requestWorkCopy): it
    makes the working copy of the episode's raw video, the video HyperFrames is given to edit (workcopy.js makeWorkCopy, which never
    throws), in this Mac's own folder for the episode. It is detached alone, like `read`: it is in no help, and without --now and a
    folder it prints the help and ends 2, as a command it does not know. The episode is found and gated as every command's is. `workcopy` is
    in no gate list (architecture 2026-10-27, 6.2), so a video not yet answered, a video left alone, a session not cleared and a
    video held beside a session are refused in the gate's own words, and the refusal is left as the run's result, as `read`'s is;
    one a newer brimm-video wrote is named by its short id, and nothing is made or written. Past the gate it runs for a raw video
    and an iPhone clip alone (WORK_COPY_KINDS): a video of any other kind leaves a result that says it can't be used, in words.
    Before it copies, it waits as a raw reading does while the import's late check of the video is still to come (waitForImport),
    since the copy is made from the video as filed, whole and checked (architecture 5.7), or from the file this Mac holds of it while it owes the check (plan R1b): the wait is a step in the progress
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
    faces looked for in it. For a Reel of a finished video, on a Mac whose readings are on and that has Claude Code, Claude is then
    asked once for the Reel's graphic cues, as a third step (reading.js askReelCues; PR H2): never for a raw video's Reel, which takes
    the cues of its cut plan, and never for a session, which this command refuses. It runs for a raw video and a finished one
    (REEL_COPY_KINDS), and for no other: a finished video has no working copy of its own, and an iPhone clip no Reels. It has the same
    lock, so that one copy of an episode is made at a time, a Reel's or the video's, waits for the import's late check as the working
    copy does, and says what it cannot make in words.
    The footage of a video made from a plan (PR H5b; join.js, episode.js isFromPlan) is copied with it: once the video's own working copy is
    made, or was before, a copy with no sound is made of each b-roll and screen part of the plan that may go into its project
    (join.js footageToUse: her client agreed to it or it shows none, and its episode is not held by a conflict or a newer record, and its
    shot is still a shot of its kind), each at the step of its own (workcopy.js makeFootageCopies). A part left out is said in the log, with
    why, and a copy that fails is said there too: neither costs the main copy anything, and the run's result is the main copy's.
    `--footage` makes these copies alone (and no other, so it is not given with --4k or --reel: the help and 2): for a video made from a plan
    only, and any other leaves a result that says it can't be used. It waits for no import: the plan's own video is not made, and each
    part's video is read through from Dropbox when it is not here (makeFootageCopies). Its result is the copies' own: a copy that fails
    is a failure of the run. */
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
  // `--footage` makes the footage's copies alone: it is not given with a Reel or with 4K.
  const footageOnly = flags.footage === true;
  if (footageOnly && (reel || flags["4k"])) {
    ctx.say(HELP);
    return 2;
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
    // The footage's copies alone (PR H5b): of a video made from a plan, and no wait for the import of its own video, which is not copied.
    if (footageOnly) return isFromPlan(record) ? planFootage(ctx, { found, record, deps }) : { ok: false, made: [], failed: [NOT_FROM_PLAN], next: "" };
    // `kind` asks for the copy at once; the video it is made from is whole and checked first, or is the file this Mac holds of it (plan R1b), which the check still goes on to look at (waitForImport).
    let held = await waitForImport(ctx, { found, record, wait, progress: deps.progress, log: deps.log, kinds, notFor });
    if (held.why) return { ok: false, made: [], failed: [held.why], next: "" };
    // The copy itself, from the video or from the file this Mac holds of it (`held.from`).
    const copyOf = async (held, deps) => {
      const video = fileOf(ctx, found, held.record.video.file);
      // The file this Mac holds of the video, when the run did not wait for the late check (waitForImport): read in place of the video, which stays its identity.
      const fromOf = (h) => (h.from ? { from: h.from } : {});
      if (!reel) {
        // An explainer in her voice (PR H6) is a sound alone: its copy is the voice made ready for the page, a copy of no 4K, and no footage is
        // made for it. An explainer in a HeyGen voice has its voice in its project, so it has nothing to copy.
        const media = mediaOf(held.record);
        if (media === null) return { ok: false, made: [], failed: [canNotBeUsed("its voice is made in its HyperFrames project")], next: "" };
        if (media === VOICEOVER) return makeWorkCopy({ home: ctx.home, folder: found.name, video, name: shownName(held.record), voice: true, ...fromOf(held) }, deps);
        const main = await makeWorkCopy({ home: ctx.home, folder: found.name, video, name: shownName(held.record), fourK: Boolean(flags["4k"]), ...fromOf(held) }, deps);
        if (!main.ok || !isFromPlan(held.record)) return main;
        // A video made from a plan has its footage copied after its own video, in the same run. A copy that fails is in the log and costs nothing.
        const footage = await planFootage(ctx, { found, record: held.record, deps });
        return { ...main, made: [...main.made, ...footage.made], ...(footage.failed?.length ? { footageFailed: footage.failed } : {}) };
      }
      // A Reel's video is the suggestion's stretch of the recording; the list is read once the video is whole and checked, or once the file this Mac holds of it is in hand (plan R1b).
      const got = reelStretch(dirname(fileOf(ctx, found, REELS_FILE)), reel);
      if (!got.stretch) {
        const why = got.gone ? `Reel ${reel} is not one of the suggestions any more` : got.nothing ? `Reel ${reel} has nothing to show: ${got.nothing}` : "the Reel suggestions cannot be read";
        deps.log(`${shownName(held.record)}: the video for Reel ${reel} could not be made: ${why}.`);
        return { ok: false, made: [], failed: [canNotBeUsed(why)], next: "" };
      }
      const faces = ctx.deps.faces || ((file, work) => facesIn(file, work, { run: deps.run, tools, limit: REEL_FACES_MS }));
      // A Reel of a video her editor finished is asked for its graphic cues as a third step (PR H2), and of no other kind: a raw video's
      // Reel takes the cues of its cut plan, and a session is never read. Only on a Mac whose readings are on, and that has Claude Code.
      const cues = recordKind(held.record) === "finished" && ctx.settings.readings !== false && tools.claude
        ? (stretch, work) => askReelCues({ ctx, found, record: held.record, stretch, work }, deps)
        : null;
      return makeWorkCopy({ home: ctx.home, folder: found.name, video, name: `${shownName(held.record)}, Reel ${reel}`, reel: got.stretch, ...fromOf(held) }, { ...deps, faces, ...(cues ? { cues } : {}) });
    };
    // The import's check may pass, and take the drop file away, in the second between the wait and ffprobe or ffmpeg opening it (final review
    // M5). That is not a broken recording: the file's identity is taken before the copy, and when the copy fails while the file is not the one
    // that was taken, or is gone, the run goes round once more, from the episode's own video in Dropbox, which the import has checked by then.
    const sameId = (a, b) => (a === null || b === null ? a === b : a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs);
    const again = () => waitForImport(ctx, { found, record: held.record, wait, progress: deps.progress, log: deps.log, kinds, notFor });
    let before = held.from ? fileId(held.from) : null;
    if (held.from && before === null) {
      held = await again();
      if (held.why) return { ok: false, made: [], failed: [held.why], next: "" };
      before = held.from ? fileId(held.from) : null;
    }
    // What a copy from the local file says in the log is kept back, and said only when the run does not go round again.
    const said = [];
    const made = await copyOf(held, held.from ? { ...deps, log: (line) => said.push(line) } : deps);
    if (held.from && !made.ok && !sameId(before, fileId(held.from))) {
      deps.log(`${shownName(held.record)}: the file this Mac held of the video went while it was being read, so the video for HyperFrames is made from the video in Dropbox.`);
      held = await again();
      if (held.why) return { ok: false, made: [], failed: [held.why], next: "" };
      return copyOf(held, deps);
    }
    for (const line of said) deps.log(line);
    return made;
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

/** The clock she reads on a timeline: { read } or { code }, `read` being what `reader` gives: videoClock's, the one-piece clock of the
    video's own times. A file Dropbox has not brought over yet is asked for (`bring`, unless one is running), and she is told
    to say it again when it is here. */
function clockRead(ctx, found, part, reader) {
  const read = reader(found, part, ctx);
  if (read.coming) {
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: read.bring });
    return { code: refuse(ctx, `Dropbox is still bringing ${read.coming} over to this Mac. Say it again when it is done.`) };
  }
  if (read.why) return { code: refuse(ctx, read.why) };
  return { read };
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

/** Why final/ may not be written yet because of a finish on the other Mac, in plain words, or "": its late check of its copies is still to
    come, and would put its own copies back over what is written now. `finished` is the record's. A finish on this Mac is not asked of
    here: its command is running (runningCommand), which refuses first. */
function lateCheckWaits(ctx, finished) {
  const checked = finished.on !== ctx.machine ? Date.parse(finished.at) + LATE_CHECK_MS + LATE_MARGIN_MS : 0;
  return checked > ctx.now() ? `The finish on ${finished.on} is still checking its copies in final/, until ${shownAfter(finished.at, LATE_CHECK_MS + LATE_MARGIN_MS)}. Say it again after that. Nothing was changed.` : "";
}

/** What is said when the hand-off waits for the switch, and when it is written. */
const HANDOFF_WAITS = "The hand-off is written once this Mac hands off version 2: ask Jason.";
/** What `finish` says of a video whose hand-off is written from its spellings (a finished video, an iPhone clip she answered) on a
    Mac that hands off version 1. */
const handoffFromSpellingsWaits = (name) => `${name}'s hand-off is written from its spellings once this Mac hands off version 2: ask Jason.`;
/** What `finish` says of a video that is not edited here (a finished video, or an iPhone clip she answered: not hasFinalCut), `found` with its `record`: on a Mac that hands off version 1,
    that its hand-off waits for version 2; once it is written, its revision; otherwise that it comes from the spellings card. */
function notInFinalCut(ctx, found, record) {
  const name = shownName(record);
  if (!writesV2For(ctx.settings, found.folder, record)) return handoffFromSpellingsWaits(name);
  // A finished video whose Reels were made in HyperFrames is told where they go (plan PR 9): `finish … reels` adds them to this hand-off.
  if (record.finished && Number.isInteger(record.finished.revision)) return `${name}'s hand-off is written already, as revision ${record.finished.revision}: a spelling changed writes its next revision.${recordKind(record) === "finished" && reelProjectsOf(record).length ? ' Its Reels are added after you export them from HyperFrames: say "hand off the Reels".' : ""}`;
  return `${name} is not edited here: its hand-off is written once its spellings are answered. Say "show me the spellings".`;
}
const handoffWritten = (revision, shown = true) => (shown ? `The hand-off is written as revision ${revision} and shown in Finder: drop it on the BRIMM Ops page.` : `The hand-off is written as revision ${revision}.`);
/** Whether a video is edited here (the name is from the Final Cut days): a finished video is not, nor is an iPhone clip of the switch, a
    record that holds her `answer`. Today's import makes short videos too, answered by no one, and they are edited as an episode is. */
const hasFinalCut = (record) => {
  const kind = recordKind(record);
  if (kind === "short video") return !(record.answer !== null && typeof record.answer === "object");
  return kind !== "finished";
};
/** Spellings as they are said in a row: "a" as "b", "c" as "d" and "e" as "f". */
const pairsSaid = (pairs) => listed(pairs.map(([heard, meant]) => `"${heard}" as "${meant}"`));

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
/** What `finish` says at the end of what it found for an explainer in a HeyGen voice, and what it says of any explainer handed off as it is (PR H6). */
const HEYGEN_YOUTUBE = "It has a HeyGen voice: when you upload it to YouTube, mark it as altered or synthetic content.";
const EXPLAINER_EXPORT = 'An explainer is made in HyperFrames: export it there, then say "hand it off".';
async function finishClip(ctx, found, answers) {
  const { record } = found;
  const name = shownName(record);
  const app = Boolean(appOf(ctx.settings));
  // An explainer (PR H6) is made in HyperFrames, and is never handed off as it is, whether she asked for it or not.
  if (isFromPlan(record) && record.planned.route === "explainer") return refuse(ctx, EXPLAINER_EXPORT);
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
    and what came of it, the Reels the hand-off holds among it: those the spelling reached are told that their captions on screen keep the old
    spelling, and those whose captions keep it are told in finish-reels.js keepOldWords' words. Version 1 of the hand-off waits for the switch:
    the record is kept, and nothing is put in final/. `unhanded` is what `spell` says of the Reel projects not handed off yet (unhandedWords; `finish` for an
    iPhone clip says none): it ends the line that says the hand-off is written, made again or waiting, after the Reels the spelling reached, and the line
    keepOldWords is on follows as it did. It is not said when the hand-off comes out as it was, nor when nothing is written. */
async function importHandoff(ctx, found, record, done, unhanded = "") {
  const wrote = await finishFinished(ctx, found, { record });
  if (wrote.waits) return save(ctx, found, record, `${done} ${HANDOFF_WAITS}${unhanded}`);
  if (wrote.coming) {
    if (runningCommand(ctx.home, found.name, ctx.alive) !== "bring") startDetached(ctx, { command: "bring", folder: found.name, args: wrote.coming });
    return refuse(ctx, `Dropbox is still bringing ${listed([...new Set(wrote.coming.map(whatIs))])} over: say it again in a minute.`);
  }
  if (wrote.why) return refuse(ctx, wrote.why);
  // A hand-off made again says, of the Reels the spelling reached, that the captions drawn into their pictures keep the old spelling, as it says of a raw
  // video's Reels (stillWords): all are made in HyperFrames, and are handed off by "hand off the Reels". A Reel whose captions keep a spelling is told below.
  const drawn = (wrote.drawn || []).map((n) => ({ name: `Reel ${n}`, app: true }));
  if (wrote.same) ctx.say(`${done} The final transcripts and the hand-off are as they were.`);
  else if (record.finished) ctx.say(`${done} The final transcripts are spelled so too, and the hand-off is made again as revision ${wrote.revision}: drop it on the BRIMM Ops page again.${stillWords(drawn, "hand off the Reels")}${unhanded}`);
  else ctx.say(`${done}${wrote.left.map((line) => ` ${line}`).join("")} ${handoffWritten(wrote.revision, wrote.shown !== false)}${unhanded}`);
  // A Reel whose captions keep the spelling they were made with (a spelling cannot be put into them, or taken out) says so, and the way back.
  if (Array.isArray(wrote.kept) && wrote.kept.length) ctx.say(keepOldWords(wrote.kept));
  // On an open-lock Mac a hand-off whose copy could not be made is not shown in Finder (reveal.js).
  if (wrote.shown === false) ctx.say(cantOpen(shownName(record)));
  return 0;
}

/** Whether any part of the record was ever shown in Final Cut: a push, an entry of `pushed` that was not rendered. A version brimm-video rendered
    (`how` "render", as the import's rough cut is) was never in Final Cut. */
const everShownInFinalCut = (record) => [record.main, ...(Array.isArray(record.reels) ? record.reels : [])].some((target) => Array.isArray(target?.pushed) && target.pushed.some((p) => p && p.how !== "render"));

/** Whether a video is edited in HyperFrames, by its record: `finish` goes the HyperFrames way for it (finishWay: a raw video with a main project in
    use, an iPhone clip whose main project the app has opened). What `spell` first says of such a video tells her what the app needs. A raw video with
    a project for a Reel alone, or for none, is not edited in the app by this: the record does not say it is. */
const editedInApp = (ctx, record) => finishWay(ctx, record) === "hyperframes";

/** What she is told of the captions already drawn into the pictures of a video edited in HyperFrames, when no sentence of the part that has them says it:
    a spelling is not pushed into a project, the app may be editing it (architecture 4.8). */
const ASK_ASSISTANT = " Ask the assistant in HyperFrames to fix any caption already drawn.";
/** What she is told before the first finish of a video edited in HyperFrames: its final transcripts are made, with the spellings, when it is handed off. */
const AT_HAND_OFF = " The final transcripts take the spellings when you hand it off.";

/** Whether a finished part (its entry in `finished.parts`) was made from an export of HyperFrames: the record says so with `project`. A part an older
    finish took from Final Cut names none. */
const partFromApp = (part) => typeof part.project === "string" && part.project !== "";

/** The parts (each { name, app, … }) by the way they were made: those made from an export of HyperFrames first (`app`), then those an older
    finish took from Final Cut, whose entry names no project. A way no part was made is left out. */
const byMaking = (parts) => [true, false].map((app) => ({ app, parts: parts.filter((part) => Boolean(part.app) === app) })).filter((group) => group.parts.length);

/** What she is told of a part an older finish took from Final Cut, which has no HyperFrames project: it is edited there from the recording, as the guide says. */
const openThere = (count) => `Say "open it in HyperFrames" to edit ${count === 1 ? "it" : "each"} there, from the recording.`;

/** What she is told of the final transcripts that keep a spelling taken back or changed: `keeping` is each part that does, { name, pairs }, its name as
    she hears it and the pairs it keeps, as `"a" as "b"`. They keep them until the parts are exported again from HyperFrames and handed off (finish-reels.js
    exportAgainWords has the words, as it has a finished video's Reels'). */
function keptWords(keeping) {
  const pairsOf = (parts) => listed([...new Set(parts.flatMap((part) => part.pairs))]);
  return byMaking(keeping).map(({ app, parts }, i) => {
    const begin = ` ${i === 0 ? "The final transcripts of" : "Those of"} ${listed(parts.map((part) => part.name))} keep ${pairsOf(parts)}`;
    return app ? `${begin} until ${exportAgainWords(parts.length, "hand it off")}.` : `${begin}. ${openThere(parts.length)}`;
  }).join("");
}

/** What she is told of the captions drawn into the picture of the parts in `drawn` ({ name, … }, the parts that may have any): they keep the old spelling.
    A spelling is not pushed into a project, so a second sentence says what changes it: the assistant in HyperFrames fixes the captions, then the part is
    exported again and handed off, in the words `handOff` ("hand it off" for a raw video and an iPhone clip, "hand off the Reels" for the Reels of a
    finished video). */
const stillWords = (drawn, handOff = "hand it off") => byMaking(drawn).map(({ app, parts }) => {
  const one = parts.length === 1;
  const keep = ` If ${listed(parts.map((part) => part.name))} ${one ? "shows" : "show"} captions on screen, they keep the old spelling.`;
  return app ? `${keep} Ask the assistant in HyperFrames to fix them, then export ${one ? "it" : "each"} again and say "${handOff}".` : `${keep} ${openThere(parts.length)}`;
}).join("");

/** Whether the main video of the record is a full episode, as its preset says, or, when it holds none, by its kind: a wide episode's main video is the
    full episode and has no captions drawn on it; a short video's is as filmed. */
const mainIsFullEpisode = (record) => (record.main?.preset?.job ?? (record.kind === "short video" ? "as-filmed" : "full-episode")) === "full-episode";

/** The Reels of the record that have a project (reelProjectsOf) and are not handed off yet, as their numbers in order, each once: `finished.parts` has no part
    for their key (`reel N`). A finish gives a part to every Reel it takes, so the sentences about parts above tell a Reel that has one (stillWords, keptWords, and
    finish-reels.js keepOldWords for a finished video's Reels), and a Reel project that is not exported and taken yet, as `app … reel N` leaves it, is told by
    unhandedWords. A project kept for an earlier kind is no Reel project (reelProjectsOf), and a Reel the record says is dropped after its project was made is no
    part of a finish (exports.js exportsFound, as the guide has it), so it is not one that is waited for. */
function unhandedReels(record) {
  const dropped = new Set((Array.isArray(record.reels) ? record.reels : []).filter((r) => r && r.status === "dropped").map((r) => r.n));
  return [...new Set(reelProjectsOf(record).map(({ reel }) => reel))].filter((n) => !dropped.has(n) && (record.finished?.parts ?? {})[`reel ${n}`] === undefined).sort((a, b) => a - b);
}

/** What she is told of the Reel projects not handed off yet (unhandedReels), when a spelling is saved: a spelling is not pushed into a project (architecture 4.8), so
    the captions already drawn in one keep the old spelling, and so do those of an export of it she has already (she may have just watched it and seen the word
    misspelt): the assistant in HyperFrames fixes them, then the Reel is exported, again if she has exported it. "Then export it" is right whether or not she has. It goes
    at the end of the line that says the spelling was saved, after every sentence about the parts handed off. "" when there is none. It is left out where the reply asks
    the assistant to fix any caption already drawn (ASK_ASSISTANT), which covers every project, where nothing is saved, and where a finished video's hand-off comes out
    as it was. */
function unhandedWords(record) {
  const names = unhandedReels(record).map((n) => `Reel ${n}`);
  if (!names.length) return "";
  const one = names.length === 1;
  return ` ${listed(names)} ${one ? "is" : "are"} not handed off yet. If ${one ? "it shows" : "they show"} captions on screen, they keep the old spelling: ask the assistant in HyperFrames to fix them, then export ${one ? "it" : "each"}.`;
}

/** Whether a command changes the episode's spellings: `after` is not `before`, a pair more, fewer or spelled another way, in any order. An answer to Claude's offers that
    applies none changes nothing, and no caption then keeps an old spelling. */
const spellingsChanged = (before, after) => before.length !== after.length || after.some(([heard, meant]) => !before.some(([h, m]) => h === heard && m === meant));

/** The record with its spellings, `spellings`; and after a finish (spec section 4, "spell applies to every timeline and to
    the final transcripts") the final transcripts with each spelling they do not hold yet, and the hand-off made again as its
    next revision, each file put in by the rule, and only when its words change. Each finished part's transcripts hold the
    spellings that changed them: its `spellings`, or, for a part no spelling has reached since a finish made it, the record's
    own. Only the others are applied to it, so none is applied twice, and a spelling taken back or changed leaves the part as
    it is, which is said, part by part, by the way each was made (keptWords, stillWords): a finish again makes a part's transcripts
    again only once its video is new, exported again from HyperFrames. Before reading them
    it checks they are here, whole (her folder may be online-only after a hand-off): if not, it starts bringing them over and
    stops. (`spell` has refused already while a finish runs, whose late check would put its own copies back.) When the record
    cannot be written, each final file is put back as it was, each on its own; one that cannot be is named, and she is told
    the episode needs Jason. `set` is what else the command changes in the record (the answer to Claude's offers), written in the
    same record, and `later` what is said at the end when no hand-off is written yet and none is due (a raw video's). `inApp` is whether the
    video is edited in HyperFrames (editedInApp): what is said
    after it tells her that the final transcripts take the spellings when she hands it off (before the first finish) and to ask the
    assistant in HyperFrames to fix any caption already drawn, unless a sentence about the captions of a part says so already. A spelling
    changed is also told of the Reel projects not handed off yet (unhandedWords), at the end of the line that says it was saved, after every
    sentence about the parts handed off, on each path that saves; not where that sentence to ask the assistant is said, which covers every
    project, nor where a finished video's hand-off comes out as it was, nor where no spelling changed. Resolves the save's code. */
async function saveSpellings(ctx, found, spellings, done, { set = {}, later = "", inApp = false } = {}) {
  const record = { ...found.record, ...set, spellings };
  const finished = record.finished;
  // The Reel projects not handed off yet, told once the spellings change: their captions already drawn keep the old spelling (unhandedWords).
  const unhanded = spellingsChanged(found.record.spellings || [], spellings) ? unhandedWords(record) : "";
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
    if (importKind(record) === recordKind(record)) {
      // A finish of the Reels (`finish "<episode>" reels`) on the other Mac has a late check of final/ to come, as a Final Cut finish has:
      // the hand-off written now would be put back over (plan PR 9, the review's C1). The first hand-off, and a revision with no Reel
      // in it, have none.
      const waits = Object.keys(finished.parts || {}).some((key) => REEL_KEY.test(key)) ? lateCheckWaits(ctx, finished) : "";
      if (waits) return refuse(ctx, waits);
      return importHandoff(ctx, found, record, done, unhanded);
    }
    return save(ctx, found, record, `${shownName(record)}: spelled. Its hand-off waits for its new reading.${unhanded}`);
  }
  if (!finished && handoffOwed(record)) return importHandoff(ctx, found, record, done, unhanded);
  if (!finished) return save(ctx, found, record, `${[done, later].filter(Boolean).join(" ")}${inApp ? `${AT_HAND_OFF}${ASK_ASSISTANT}` : unhanded}`);
  // A client or group session, and a video not yet answered, are refused at once, as finish refuses them (finish.js
  // cannotFinish), before any file in final/ is named or read, and nothing is written, the spelling included: none of a
  // session's transcripts may be in the shared folder, and an unanswered video has no kind to hand off as.
  const notYet = cannotFinish(record);
  if (notYet) return refuse(ctx, notYet);
  const meantOf = (list, heard) => (list.find(([h]) => h === heard) || [])[1];
  const parts = Object.entries(finished.parts || {}).map(([key, part]) => {
    const held = part.spellings || found.record.spellings || [];
    return { key, part, held, name: key === "main" ? "the main video" : capital(key), app: partFromApp(part), stem: `final/${basename(part.file, extname(part.file))}`, toApply: spellings.filter(([h]) => meantOf(held, h) === undefined) };
  });
  // Every part's own list is kept from now on, so a part a finish reuses keeps it, and one it makes again starts afresh.
  const withHeld = (held) => ({ ...finished, parts: Object.fromEntries(parts.map((p) => [p.key, { ...p.part, spellings: held[p.key] || p.held }])) });
  // What each part keeps: the pairs it holds that are taken back or changed now, which cannot be taken out of its words.
  const keeping = parts.map((p) => ({ name: p.name, app: p.app, pairs: p.held.filter(([h, m]) => meantOf(spellings, h) !== m).map(([h, m]) => `"${h}" as "${m}"`) })).filter((k) => k.pairs.length);
  const keptNote = keptWords(keeping);
  // A video edited in HyperFrames is told to ask the assistant to fix any caption already drawn where no sentence about the captions of a part says it.
  const ask = inApp ? ASK_ASSISTANT : "";
  // That sentence covers every project, so a reply that says it does not name the Reel projects not handed off yet.
  const unhandedAfterAsk = ask ? "" : unhanded;
  if (!parts.some((p) => p.toApply.length)) return save(ctx, found, { ...record, finished: withHeld({}) }, `${done}${ask}${keptNote}${unhandedAfterAsk}`);
  const finals = [...parts.flatMap((p) => [`${p.stem}.srt`, `${p.stem}.transcript.txt`, ...(p.part.words ? [p.part.words] : [])]), finished.handoff];
  const gone = finals.find((rel) => !existsSync(fileOf(ctx, found, rel)));
  if (gone) return refuse(ctx, `${gone} is not in the episode's folder, so the final transcripts cannot be spelled again. Nothing was changed. Say finish again.`);
  const coming = finals.filter((rel) => !ctx.isWhole(fileOf(ctx, found, rel)));
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
      put(fileOf(ctx, found, rel), text, { replace: true });
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
      const was = { srt: readFileSync(fileOf(ctx, found, `${p.stem}.srt`), "utf8"), words: p.part.words ? readFileSync(fileOf(ctx, found, p.part.words), "utf8") : null };
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
    if (!writes.length) return save(ctx, found, { ...record, finished: withHeld(held) }, `${done} The final transcripts do not have ${listed(toApply.map(([h]) => `"${h}"`))}, so they are as they were.${ask}${keptNote}${unhandedAfterAsk}`);
    // The hand-off is made again as version 2 once this Mac's settings say so, and when it is version 2 already: version 1 is
    // never written over it (spec 2026-10-22, section 8; finish.js writesV2For, which a finish asks too). Version 2 is under the
    // video's first version's id, above every revision written for that id on this Mac (finish.js nextRevision), and only when
    // the chain of the video's versions can be followed to its first: on a gap nothing is written, the spelling included.
    // Version 1 is under the episode's own id, and a revision is never used twice, even one a finish left in final/ without
    // writing its record (finish.js lastRevision). Which version, the id, the revision and a refusal are finish.js
    // handoffTarget's, as every hand-off writer asks them.
    const onFile = JSON.parse(readFileSync(fileOf(ctx, found, finished.handoff), "utf8"));
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
    const waits = lateCheckWaits(ctx, finished);
    if (waits) return refuse(ctx, waits);
    const files = {};
    for (const [rel, text] of writes) {
      before.push([rel, readFileSync(fileOf(ctx, found, rel), "utf8")]);
      files[rel] = put(fileOf(ctx, found, rel), text, { replace: true }).bytes;
    }
    // A finished part may have captions drawn into its picture (whether it has is not known here), which keep the old spelling
    // until it is made again (stillWords): a full episode's main video has none (the brief the app's agent is given says a wide main video has no
    // captions drawn on it). The assistant in HyperFrames is told to fix them; where no part is named, a video edited in HyperFrames is told so all the
    // same. The Reel projects no part is made for yet follow, unless that sentence is said.
    const drawn = parts.filter((p) => p.key !== "main" || !mainIsFullEpisode(record));
    const asked = drawn.length ? "" : ask;
    const still = `${stillWords(drawn)}${asked}`;
    const code = await save(ctx, found, { ...record, files: { ...record.files, ...files }, finished: { ...withHeld(held), revision, at, on: ctx.machine } }, `${done} The final transcripts are spelled so too, and the hand-off is made again as revision ${revision}: drop it on the BRIMM Ops page again.${still}${keptNote}${asked ? "" : unhanded}`);
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
  const done = `${applied.length ? `Spelled now: ${pairsSaid(applied.map((o) => [o.heard, o.spelled]))}.` : "No spelling applied."}${notKept.length ? ` Not kept: ${notKept.join(" ")}` : ""}`;
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
  if (running && running !== "bring" && !(running === "read" && currentReading(got.record))) return refuse(ctx, stoppedWords(ctx, found, got.record, { generic: `${running} is running for this episode. Say "how far is it?", and try again when it is done.`, again: "Try again then." }));
  const inApp = editedInApp(ctx, got.record);
  if (verb === "drop") {
    const heard = more[0];
    if (!spellings.some(([h]) => h === heard)) return refuse(ctx, `There is no spelling of "${heard}".`);
    return saveSpellings(ctx, found, spellings.filter(([h]) => h !== heard), `"${heard}" is as the transcriber writes it again.`, { inApp });
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
  const done = written.length === 1 ? `"${written[0][0]}" is spelled "${written[0][1]}" now.` : `Spelled now: ${pairsSaid(written)}.`;
  return saveSpellings(ctx, found, next, done, { inApp });
}

/** Where words of the recording, a stretch { start, end } in seconds of it, are on the timeline she is reading (`read` is clockRead's, the video's one-piece clock):
    { at: null } when they are cut now; else { at, for, start, end }: `at`, the second of the recording its kept words start at, and
    `for`, how long they take on the timeline now; `start` and `end`, their times on the clock she is reading (`read.on`), null
    when they are not on that clock. */
function wordsOnTimeline(read, { start: from, end: to }) {
  const kept = read.pieces.filter((r) => to > r.start && from < r.end);
  if (!kept.length) return { at: null };
  const at = Math.max(from, kept[0].start);
  const until = Math.min(to, kept[kept.length - 1].end);
  const shown = kept.reduce((sum, r) => sum + Math.max(0, Math.min(until, r.end) - Math.max(at, r.start)), 0);
  const [start, end] = [timelineAt(read.clock, at), timelineAt(read.clock, until)];
  const on = start !== null && end !== null;
  return { at, for: Math.round(shown * 1000) / 1000, start: on ? start : null, end: on ? end : null };
}
/** Claude's ideas for graphics on a timeline, as she reads them (spec 2026-10-22, section 3, "Times"), numbered so that no cut,
    version or Reel changes a number. Each is { n, idea, said, outside, missing, at, for, start, end }: `idea` is what it shows,
    `said` the words it goes with, `outside` when the timeline is a Reel whose stretch does not hold its words, and `at`, `for`,
    `start` and `end` as wordsOnTimeline gives them.
    - A plan the reading of PR H1 wrote holds `claude.graphicCues`: each is placed on the words of the recording (graphic-cues.js
      placeGraphicCues), spelled as the episode's words are (`spellings`), and keeps the number the cue has. It is first in its own
      phrase when that is kept, and else in kept words before any cut: one that names a phrase the plan cuts is placed as if it named
      none. A cue whose words are not found is `missing` (and `outside` on a Reel, whose stretch cannot be said to hold it). It stays
      for the seconds the cue says (`for`), from the moment its words start.
    - A plan made before it holds `claude.graphics`: each idea on a phrase of the plan, numbered in the order their words are said
      (Claude's order for two on one phrase); one that names no phrase of the plan is left out. It goes with the whole phrase, and
      stays for as long as the phrase takes. */
function graphicIdeas(read, spellings = []) {
  const claude = read.plan.claude || {};
  const phrases = read.plan.phrases || [];
  const outsideReel = (span) => Boolean(read.span) && !(span.end > read.span.from && span.start < read.span.to);
  if (Array.isArray(claude.graphicCues)) {
    const placed = placeGraphicCues(claude.graphicCues, read.words || [], { spans: keptPhraseSpans(phrases), kept: keptIndexes(phrases), spell: (text) => spelled(text, spellings) });
    return placed.map((g) => {
      const idea = { n: g.n, idea: g.show, said: g.words };
      if (!g.at) return read.span ? { ...idea, outside: true, at: null } : { ...idea, missing: true, at: null };
      if (outsideReel(g.at)) return { ...idea, outside: true, at: null };
      const on = wordsOnTimeline(read, g.at);
      return on.at === null ? { ...idea, ...on } : { ...idea, ...on, for: g.seconds };
    });
  }
  const byId = new Map(phrases.map((p) => [p.id, p]));
  const listed = (claude.graphics || []).map((g, i) => ({ idea: g.idea, phrase: byId.get(g.id), i })).filter(({ phrase }) => phrase);
  return listed.sort((a, b) => a.phrase.start - b.phrase.start || a.i - b.i).map(({ idea, phrase }, k) => {
    const n = k + 1;
    if (outsideReel(phrase)) return { n, idea, said: phrase.text, outside: true, at: null };
    return { n, idea, said: phrase.text, ...wordsOnTimeline(read, phrase) };
  });
}
/** The ideas a video lists as its graphics (graphic … ideas): a video made from a plan (PR H5b; episode.js isFromPlan) lists the cues
    of its video guide, planned.cues read again as a package's are, every kind of cue among them, since its project is made from those and from the
    reading's none; any other video lists the reading's (graphicIdeas). Each is placed on the words of the recording as the reading's are. */
function ideasFor(read, record) {
  // A video made from a plan is tested first, as app.js gives its project the plan's guide before the reading's (a plan's short video too).
  if (isFromPlan(record)) {
    const cues = graphicCuesOf(record.planned.cues, { kinds: GRAPHIC_CUE_KINDS }).cues;
    return graphicIdeas({ ...read, plan: { ...read.plan, claude: { ...(read.plan.claude || {}), graphicCues: cues } } }, record.spellings);
  }
  // An iPhone clip's are the ones its reading kept in its record (app.js), placed on its words with its cut plan's phrases as any main video's are.
  if (record.kind === "short video") return graphicIdeas({ ...read, plan: { ...read.plan, claude: { graphicCues: graphicCuesOfRecord(record) } } }, record.spellings);
  return graphicIdeas(read, record.spellings);
}
/** A time as HyperFrames shows it, the whole seconds passed (stamp), from the time taken to the thousandth first, as the project's files keep times, so that 15.9999999999 shows 0:16. */
const shownSecond = (seconds) => stamp(Math.round(seconds * 1000) / 1000);
/** Where an idea is on the clock she is reading, as its line says it: "0:04 to 0:07", "cut now", or, when its words are not on that
    clock, "not on <clock> (kept again since)". */
const ideaWhere = (idea, on) => (idea.at === null ? "cut now" : idea.start === null ? `not on ${on} (kept again since)` : `${shownSecond(idea.start)} to ${shownSecond(idea.end)}`);
/** An idea's words as a sentence: with a full stop, unless they end in one already. */
const ideaSaid = (idea) => (/[.!?…]"?$/.test(oneLine(idea)) ? oneLine(idea) : `${oneLine(idea)}.`);
/** An idea as the list says it: where it is, what it shows, and the words it goes with; or, for a graphic cue whose words were
    not found in the video (`missing`), what it shows and that. */
const ideaLine = (idea, on) => (idea.missing
  ? `Idea ${idea.n}: ${ideaSaid(idea.idea)} Its words, "${oneLine(idea.said)}", were not found in the video.`
  : `Idea ${idea.n}, ${ideaWhere(idea, on)}: ${ideaSaid(idea.idea)} Over "${oneLine(idea.said)}"`);
/** What is said of a finished video's ideas for graphics: Claude gives none for its main video (Jason, 22 Oct: "Reel suggestions
    and spellings, nothing more"). An iPhone clip's, and a plan's short video's, are listed as their projects are given them. */
const noIdeas = (record) => `${shownName(record)} has no ideas for graphics: Claude gives none for a finished video's main video.`;
/** What is said of a finished video's Reel: Claude reads it when it is made in HyperFrames, and its ideas for graphics go into its project
    there (app-reel.js), so nothing is listed here. */
const reelIdeasLater = (record, n) => `${shownName(record)}: Claude gives Reel ${n} its ideas for graphics when it is made in HyperFrames, in its project there.`;

/** What is said of a Reel that `graphic … ideas` is asked about, when it cannot be: one the record does not have. "" for any other. A
    Reel is not refused for being a suggestion, or for being made in HyperFrames: its cues are listed on the video's clock, which needs
    only the suggestion's place in reels.json (video-clock.js). */
// reels.json is not consulted for the refusal: videoClock says if the suggestion is not there.
const reelPartWhy = (record, n) => ((record.reels || []).some((r) => r.n === n) ? "" : `There is no Reel ${n}.`);

/** The ideas of a Reel: exactly the cues its own project holds, in the project's numbering and on the Reel's clock (project.js projectCues, which
    takes graphic-cues.js reelGraphicCues: wholly inside the Reel, at most REEL_CUES_MOST), from the cues app-reel.js gives that project.
    Each is as graphicIdeas gives one, with `at` the second of the recording its words start. */
function reelIdeas(record, { raw, plan, part, span }) {
  const graphicCues = isFromPlan(record) ? graphicCuesOf(record.planned.cues, { kinds: SHOT_KINDS }).cues : graphicCuesOfPlan(plan);
  const cues = projectCues({ kind: "reel", part, stretch: { start: span.from, end: span.to }, words: raw, plan, spellings: record.spellings, graphicCues });
  return cues.map((c) => (c.at ? { n: c.n, idea: c.show, said: c.words, at: c.at.start + span.from, for: c.seconds, start: c.at.start, end: c.at.end } : { n: c.n, idea: c.show, said: c.words, missing: true, at: null }));
}

/** `graphic "<episode>" ideas [main | reel <n>]`: Claude's ideas for graphics, each with its times on the video's own clock, the one HyperFrames
    shows (video-clock.js), so that they are the seconds the project's own cues give. Nothing of Final Cut, a rough cut or a version is read,
    and nothing is written. `words` are the episode's first word and what names the part. */
function ideasList(ctx, words) {
  const [said, ...rest] = words;
  const got = episodeFor(ctx, said === undefined ? [] : [said], { newerEnds: 1 });
  if (!got.found) return got.code;
  const found = { ...got.found, record: got.record };
  const { part, words: left } = partFrom(rest);
  if (left.length) return refuse(ctx, `"${left.join(" ")}" is not understood there: name the timeline last, as main or reel 2.`);
  if (part !== "main" && reelPartWhy(found.record, part.reel)) return refuse(ctx, reelPartWhy(found.record, part.reel));
  if (recordKind(found.record) === "finished") {
    ctx.say(part === "main" ? noIdeas(found.record) : reelIdeasLater(found.record, part.reel));
    return 0;
  }
  const reading = clockRead(ctx, found, part, (f, p, c) => videoClock(f, c, p));
  if (reading.code !== undefined) return reading.code;
  const { clock, on, words: said2, raw, plan, span } = reading.read;
  const read = { clock, on, words: said2, plan, pieces: clock.map((p) => ({ start: p.from, end: p.to })), ...(span ? { span } : {}) };
  const ideas = span ? reelIdeas(found.record, { raw, plan, part, span }) : ideasFor(read, found.record).filter((i) => !i.outside);
  // A video made from a plan lists its video guide's cues (PR H5b), under a head of their own.
  const guide = isFromPlan(found.record);
  if (!ideas.length) {
    ctx.say(guide ? "The graphics of its video guide: none." : `Claude gave no ideas for graphics on ${partLabel(part)}.`);
    return 0;
  }
  const head = guide ? `The graphics of its video guide: ${ideas.length}, with times on ${on}.` : `Claude's ideas for graphics on ${partLabel(part)}: ${ideas.length}, with times on ${on}.`;
  ctx.say([head, ...ideas.map((i) => ideaLine(i, on))].join("\n"));
  return 0;
}

/** `graphic "<episode>" ideas [main | reel <n>]` is all that is left of `graphic`: Claude's ideas for graphics, with their times (ideasList).
    Putting a picture up, taking one off and the list of pictures were Final Cut's, and are gone. */
async function graphic(ctx, rest) {
  const { words } = flagsOf(rest);
  const [said, verb, ...more] = words;
  if (verb === "ideas") return ideasList(ctx, [said, ...more].filter((w) => w !== undefined));
  ctx.say(HELP);
  return 2;
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

/** Why `kind` may not answer the episode `found` as `plan` says ({ stored, again, notASession, clearSession, versionOf, target })
    when its record is `record`, in plain words, or "". `kind` asks it when it has the record, again once the claim has waited, and
    `plan.target`, the video this is a new version of, is looked for the first time it is asked. In this order:
    - a part (PR H5a), which is footage for a planned video and is taken back first; and a video with no sound (`video.sound` is false), which
      takes no kind at all, a session included: it has nothing for Claude to read and no words to be a session's, so it is left alone or made
      footage. Both are met here, so before any receipt is looked at, on every Mac, whatever the answer and its flags;
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
  // A part (PR H5a) is footage for a planned video, and is taken back (`footage … none`) before it is answered as anything else.
  if (isPart(record)) return partRefused(name, planTitleOf(ctx.root, record.partOf.id));
  // A video with no sound (PR H5a) has nothing for Claude to read and no words to be a session's: it takes no kind, whatever it is answered as. It is
  // left alone or made footage (`footage`). This is met before the receipts (answerKind), so no Mac is asked for a card that was never printed for it.
  if (record.video && record.video.sound === false) return NO_SOUND_WHY(name);
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
    if (!plan.again || !(revisionOwed(record) || sweepOwed(ctx, found, record))) return `${name} is a client or group session already.`;
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
    // A version never spans two Macs: a video kept on another Mac is refused as the gate refuses its commands.
    const away = onOtherMac(ctx, picked.record);
    if (away) return ON_OTHER_MAC(shownName(picked.record), away);
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
    // Not any version of the target's either: a set of versions never spans two Macs.
    const away = links.setOf(links.firstOf(target)).members.map((one) => onOtherMac(ctx, one.record)).find(Boolean) || onOtherMac(ctx, target);
    if (away) return ON_OTHER_MAC(targetName, away);
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
  if (running) return stoppedWords(ctx, found, record, { generic: `${running} is running for ${calledAs(ctx, found)} already. Say it again when it has finished.`, again: "Say it again then.", of: ` of ${calledAs(ctx, found)}` });
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
  // A video kept on this Mac waits for no claim (Phase 3, L7), so no click is too late for one.
  return !holds && !keptOnAMac(record) && ctx.now() - began + CLAIM_WAIT_MS > COMMAND_BUDGET_MS ? TOO_LATE : "";
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
  if (stored === "raw" && !plan.here && ctx.settings.readings !== false && !ctx.isWhole(fileOf(ctx, found, record.video.file))) return refuse(ctx, notHereYet(ctx, record));
  // A video answered before is being corrected: what its earlier reading and its hand-off left in the shared folder is set aside
  // with the answer, and must be whole on this Mac first (read through when it is not), before she is asked anything or it is
  // claimed.
  const correcting = recordKind(record) !== null;
  if (correcting) {
    const earlier = earlierFiles(ctx, found, record, { session: stored === "session" }).rels;
    await broughtOver(ctx, found, earlier.filter((rel) => existsSync(fileOf(ctx, found, rel))));
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
  // A video kept on this Mac is answered on this Mac alone (D3), so no claim is written or waited for: the answer is the one write (Phase 3, L7).
  if (!keptOnAMac(record) && (!record.editing || record.editing.by !== ctx.machine)) {
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
  const listedAside = correcting ? earlierFiles(ctx, found, base, { session: stored === "session" }) : null;
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
      empty = emptyRevisionOf(ctx, found, { ...next, finished: base.finished }, at, { gone: readBefore(ctx, found, base, { rels: listedAside.rels, restored: aside.restore.length > 0 }) });
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
    const shown = !(empty && empty.handoff) || (await showInFinder(ctx, { record: next, label: next.name.text, path: fileOf(ctx, found, empty.handoff.rel) }));
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
  const holdsUntil = stored === "raw" ? readingWaitsUntil(ctx, wrote.record) : null;
  startDetached(ctx, { command: "read", folder: found.name, args: ["--kind", stored, "--rev", String(wrote.record.rev)] });
  // The video HyperFrames is given to edit is made beside the reading, once, for a raw video and an iPhone clip whose video is whole
  // on this Mac (architecture 2026-10-27, 5.7), when it will be used (copyWanted). It takes a lock of its own, so it does not wait
  // for the reading, and a request while a run of it is at work starts none. It is asked for at once, whether or not the import's
  // late check of the video is still to come: its run waits for that itself (waitForImport). A video not here yet is made into one by
  // `app`, which asks for it when it is not there.
  if (copyWanted(ctx, stored, wrote.record) && ctx.isWhole(fileOf(ctx, found, wrote.record.video.file))) requestWorkCopy(ctx, { folder: found.name });
  if (holdsUntil !== null) {
    // When its rough cut is ready too, as the guide says it (guideReading), once this Mac has measured the speeds of Claude's call and of
    // the rough cut.
    const rough = roughIn(readRates(progressFolder(ctx.home)), wrote.record.video && wrote.record.video.seconds);
    say(`Answered. Claude reads it at ${clockAt(holdsUntil)}, when the import has checked its copies.${rough === null ? "" : ` Its rough cut is ready about ${clockNear(holdsUntil + rough * 1000)}.`}`);
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
  if (existsSync(note)) return `${asideComing(name)} If it does not come, tell Jason.`;
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
const sweepOwed = (ctx, found, record) => record.session !== null && typeof record.session === "object" && !Array.isArray(record.session) && record.session.emptyRevision !== undefined
  && earlierFiles(ctx, found, record, { session: true, finalOnly: true }).rels.length > 0;

/** Whether a file, by its name or its path, is one a reading of Claude's writes: Claude's notes, the Reel suggestions (reels.json and
    the copy she reads) or a session's teachings. A set-aside copy in history/ ("<stamp> <name>") is one too. */
const readingFile = (rel) => /(?:^|[/ ])reels\.json$|\.(?:edit-notes|reel-suggestions)\.txt$|\.principles\.json$/.test(rel);

/** Whether Claude has read the video of `record`, in the episode's `folder`: its record holds a reading, or held one that a
    correction let go (null); or the files of one are among `rels` (those set aside now, and those owed: listed, and not here yet),
    or the record lists them, or they were set aside into its history/ before; or `restored` (the rules' plan put back, which a raw
    reading's plan had replaced). Only then do its words say they have gone to Claude. */
function readBefore(ctx, found, record, { rels = [], restored = false } = {}) {
  const listedFiles = record.files !== null && typeof record.files === "object" ? Object.keys(record.files) : [];
  if (record.reading !== undefined || restored || [...rels, ...listedFiles].some(readingFile)) return true;
  try {
    return readdirSync(join(folderAt(ctx, { folder: found.folder, record }, "local"), "history"), { recursive: true }).some((rel) => readingFile(String(rel)));
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
const notReady = (ctx, found, rels) => rels.filter((rel) => !existsSync(fileOf(ctx, found, rel)) || !ctx.isWhole(fileOf(ctx, found, rel)));

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
function earlierFiles(ctx, found, record, { session = false, finalOnly = false } = {}) {
  const { folder } = found;
  const own = folderAt(ctx, { folder, record }, "local");
  const stem = basename(record.video.file, extname(record.video.file));
  const listedFiles = record.files !== null && typeof record.files === "object" ? record.files : {};
  const there = (rel) => existsSync(fileAt(ctx, { folder, record }, rel));
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
    for (const name of [...new Set([...topFiles(own), ...Object.keys(listedFiles)])].filter(isTeachingsFile).sort()) add(name);
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
    const rules = rulesPlanKept(own, stem);
    const planRel = `${stem}.cut-plan.json`;
    if (rules && there(planRel) && readFileSync(fileAt(ctx, { folder, record }, planRel), "utf8") !== rules.text) {
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
      const read = readReels(readFileSync(fileAt(ctx, { folder, record }, REELS_FILE), "utf8"));
      for (const c of read.reels ? read.reels.candidates : []) reels.add(c.n);
    } catch (e) {
      // A list that cannot be read lets go no Reel of the record.
    }
  }
  return { rels, restore, reels };
}

/** A free name in the episode's history/ for the file `rel` set aside at `stamp`, as every set-aside names one: "<stamp> <name>",
    and "<stamp>-2 <name>" and on when that is taken, in the folder or by this set-aside (`taken`, which it is added to). */
function asideName(dir, stamp, rel, taken) {
  for (let n = 1; ; n++) {
    const name = `history/${stamp}${n > 1 ? `-${n}` : ""} ${basename(rel)}`;
    if (!taken.has(name) && !existsSync(join(dir, name))) {
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
  // A file of a record kept on this Mac that is set aside goes into video/history/ here, unlisted; one in Dropbox (final/) into history/ there, listed.
  const dirOf = (rel) => folderAt(ctx, { folder, record: base }, filePlace(base, rel));
  const pathOf = (rel) => fileAt(ctx, { folder, record: base }, rel);
  const own = folderAt(ctx, { folder, record: base }, "local");
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
    const at = pathOf(rel);
    const there = existsSync(at);
    replaced.push({ at, was: there ? readFileSync(at, "utf8") : null, ours: text });
    mkdirSync(dirname(at), { recursive: true });
    files[rel] = put(at, text, { replace: there }).bytes;
  };
  try {
    for (const rel of aside.rels) {
      mkdirSync(join(dirOf(rel), "history"), { recursive: true });
      const to = asideName(dirOf(rel), stamp, rel, taken);
      cloneIn(pathOf(rel), join(dirOf(rel), to), opts);
      copies.push(join(dirOf(rel), to));
      if (filePlace(base, rel) === "dropbox") files[to] = statSync(join(dirOf(rel), to)).size;
      if (!placed.has(rel)) delete files[rel];
    }
    for (const [rel, from] of aside.restore) putIn(rel, readFileSync(join(own, from), "utf8"));
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
      rmSync(pathOf(rel), { force: true });
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
  const aside = earlierFiles(ctx, found, record, { session: true, finalOnly: true });
  // An empty revision written already is not written again: only the sweep it still owes (sweepOwed) is made.
  const empty = revisionOwed(record) ? emptyRevisionOf(ctx, found, record, at, { gone: readBefore(ctx, found, record, { rels: aside.rels }) }) : null;
  if (!(empty && empty.handoff) && !aside.rels.length) return refuse(ctx, empty ? `${empty.words} ${OUT_OF_SHARED}` : `${label} is a client or group session already.`);
  await broughtOver(ctx, found, aside.rels.filter((rel) => existsSync(fileOf(ctx, found, rel))));
  if (notReady(ctx, found, aside.rels).length) return refuse(ctx, comingWhy(ctx, found, label));
  const handoff = empty && empty.handoff;
  const next = handoff ? { ...record, session: { ...record.session, emptyRevision: empty.revision }, finished: empty.finished } : record;
  const wrote = await setAsideWritten(ctx, found, record, next, aside, handoff, { quiet: true, session: true });
  if (wrote.code !== 0) return 1;
  forgetComing(ctx, found);
  const shown = !handoff || (await showInFinder(ctx, { record: next, label, path: fileOf(ctx, found, empty.handoff.rel) }));
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
  if ((await save(ctx, { ...found, record }, claimed(record, ctx.machine, localStamp(new Date(ctx.now()))), "")) !== 0) return { code: 1 };
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
  // A plan she is told to leave is named as `plan` names it, by the string its title was made with: the gate then says how a plan is dropped.
  const got = episodeFor(ctx, words, { newerEnds: 1, codes: true });
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
    // A part (PR H5a) is footage for a planned video: it is taken back before it is left.
    if (isPart(record)) return refuse(ctx, partRefused(name, planTitleOf(ctx.root, record.partOf.id)));
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
  const video = fileOf(ctx, found, record.video.file);
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
const nameHolds = (word) => `That name holds "${word}", a name BRIMM Video Studio can see in this session: give it another.`;
const FILES_NAME = "That is the name of the video's file: give the session another name.";
const NO_FILE_NAME = "That name cannot name the session's files: give it another.";
const NAME_TOO_LONG = `That name is longer than ${SESSION_NAME_MOST} characters: give a shorter one.`;
const editHolds = (word) => `Those words hold "${word}", a name BRIMM Video Studio can see in this session: say it another way.`;
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
  for (const rel of rels.filter((r) => !ctx.isWhole(fileOf(ctx, found, r)))) {
    try {
      await (ctx.deps.readAll || readThrough)(fileOf(ctx, found, rel));
    } catch (e) {
      // It is said by what is still not whole.
    }
  }
  return rels.filter((r) => !ctx.isWhole(fileOf(ctx, found, r)));
}

/** The names brimm-video can see in the session `found` (teachings.js sessionSeen), once what they are seen from is whole on this
    Mac, read through if need be: { names } or { why }, which fails closed. */
async function sessionNames(ctx, found) {
  const { record } = found;
  if ((await broughtOver(ctx, found, seenFrom(record))).length) return { why: WORDS_COMING };
  const seen = sessionSeen(folderAt(ctx, { folder: found.folder, record }, "local"), record, { host: ctx.settings.host });
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
  if (!keptOnAMac(record) && (!record.editing || record.editing.by !== ctx.machine)) {
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
  let read = readTeachings(folderAt(ctx, { folder: found.folder, record }, "local"), record, ctx.isWhole);
  if (read.coming && !(await broughtOver(ctx, found, [read.coming])).length) read = readTeachings(folderAt(ctx, { folder: found.folder, record }, "local"), record, ctx.isWhole);
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
    record when the session's own hand-off, a later revision, is written, since finish.js does not change it. The file is read as a regular file
    alone (regularJson): a pipe or a link where it should be is read as one that cannot be read, and the guide does not wait for it. */
function guideHandoff(ctx, e, r, links, v2) {
  const done = r.finished;
  if (done === null || typeof done !== "object") return null;
  const file = typeof done.handoff === "string" && done.handoff !== "" ? join(e.folder, done.handoff) : "";
  const h = file && ctx.isWhole(file) ? regularJson(file) : null;
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
  const due = kind === "raw" ? readingWaitsUntil(ctx, r) : null;
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
    the same lock, and the lock does not say whose the video is (a project here is the main video's, and `project` goes first), so the
    panel's file for the process says what it can (review I3): `usual` is said of a run that is making a copy of the main video's own shape,
    the step of the copy and it alone (`of` 1: a Reel's has a second step, and a recording's length is not its length), that has begun (it
    does not wait for the import to check its copies, WORK_COPY_WAIT_STEP) and that has told no time of its own that has run out (at its end
    its time is 0). With no panel file at all, as before the run has begun one, it is said. `wait` is what the copy must wait for (plan R1a;
    late-wait.js waitFacts): when Dropbox has checked its copies and when the copy will be ready after that, or null when it waits for nothing. */
function guideCopy(ctx, e, r, rates) {
  const run = runningRun(ctx.home, e.name, ctx.alive, workCopyLockOf(ctx.home, e.name));
  if (!run) return null;
  const panel = panelRuns(ctx).find((p) => p.pid === run.pid);
  const since = panel && Number.isFinite(panel.updated) ? Math.max(0, ctx.now() - panel.updated) / 1000 : 0;
  const fresh = (s) => (Number.isFinite(s) && s - since > 0 ? Math.round(s - since) : null);
  const left = panel ? readyIn({ left: fresh(panel.left), total: fresh(panel.total), n: panel.n, of: panel.of }) : null;
  const mainCopy = !panel || (panel.step === WORK_COPY_STEP && panel.of === 1);
  const toldTime = Boolean(panel) && (Number.isFinite(panel.left) || Number.isFinite(panel.total));
  return { left, usual: left === null && mainCopy && !toldTime ? copyIn(rates, r.video && r.video.seconds) : null, wait: waitFacts(ctx, r, copyIn(rates, r.video && r.video.seconds)) };
}

/** The episode's main project in use, for the guide (plan PR 10; guide.js VideoFacts `project`): { opened, last, exported, exportsWords }, or
    null when the record has none, or its folder is not on this Mac. `exportsWords` is the exports folder this Mac picked in Finder's words
    when it is not Downloads, and "" otherwise (settings.js exportsWords), which the in-app step names. `opened` is whether the record lists a time the app opened it; `last` the time
    of the newest turn that `what-happened` tells in the project's `.hyperframes/app-history.jsonl` (app-history.js toldTurns, so that it is
    the first time that gives), in words (turnTime, in the zone a test gives as `deps.app.tz`), "" when the app has kept none that can be
    read; `exported` whether it has an export that began after its last change, or two that began in one minute so that `finish` asks
    which is final (exports.js exportsFound and lookForExports, for the main video alone): in Downloads or the exports folder this Mac picked, by the app's own record in the
    project's renders/. A Downloads folder or picked exports folder this Mac will not let be read, or any trouble in reading, is
    no export seen: the guide only reads, and `finish` tells her what it needs. `downloads` is the pass's one listing of Downloads, and its
    `exports` that of the picked folder (guideItems). */
function guideProject(ctx, e, r, downloads) {
  const main = (r.app?.projects ?? []).find(inUse);
  if (!main || !plainName(main.name)) return null;
  const dir = join(episodeWork(ctx.home, e.name), main.name);
  try {
    if (!statSync(dir).isDirectory()) return null;
  } catch (err) {
    return null;
  }
  // The newest turn what-happened tells (app-history.js toldTurns): a later one with nothing in it is left out there, and so here.
  const [newest] = toldTurns(turnsOf(historyTail(dir)), { tz: ctx.deps.app?.tz }, 1);
  let exported = false;
  try {
    const seen = exportsFound({ home: ctx.home, exports: exportsFolderOf(ctx.settings, ctx.home), name: e.name, record: { ...r, app: { ...r.app, projects: [main] } }, zone: ctx.deps.zone, readdir: ctx.deps.readdir, listDownloads: downloads, listExports: downloads.exports });
    if (!seen.unreadable && !seen.exportsUnreadable) {
      // An export she is asked to choose between (two began in one minute) is an export waiting to be handed off: `finish` asks which.
      const looked = lookForExports(seen.input, {});
      exported = looked.parts.some((part) => part.key === "main" && part.video !== null) || looked.tied.includes("main");
    }
  } catch (err) {
    exported = false;
  }
  return { opened: Array.isArray(main.opened) && main.opened.length > 0, last: newest ? turnTime(newest.ms, { tz: ctx.deps.app?.tz, now: ctx.now() }) : "", exported, exportsWords: exportsWords(ctx.settings, ctx.home) };
}

/** The Reels of a finished video that were exported from HyperFrames and are not in its hand-off, for the guide (plan PR 16; guide.js VideoFacts
    `reelsExported`): their numbers, in order, or [] when there are none or when `finish "<episode>" reels` would go no further. It looks in
    this order and reads nothing more once a look says no, so that Downloads, and the exports folder this Mac picked, are listed only for a
    video that has a Reel project on this Mac and a hand-off that Reels can be added to: the record has a Reel project (not kept for an
    earlier kind, not of a Reel she dropped) whose folder is on this Mac and whose Reel it holds; the hand-off on file is one that Reels can
    be added to (finish.js reelsBase, which reads it as a regular file alone; one that is not whole on this Mac is the bring `finish` starts,
    so it stands); then the exports, as `finish` finds them
    (exports.js exportsFound and lookForExports, for those projects alone): the Reels with an export to take now that the last finish did not
    take, and those with two exports that began in one minute, which `finish` asks the final one of (as for the main video, plan PR 10, B13). An
    export of a Reel the record does not hold stops `finish`, so it stops this. A Downloads folder, or picked exports folder, this Mac will not
    let be read, or any trouble in reading, is no export seen: the guide only reads. `downloads` is the pass's one listing of Downloads, and
    its `exports` that of the picked folder (guideItems). */
function guideReels(ctx, e, r, downloads) {
  const work = episodeWork(ctx.home, e.name);
  const dropped = new Set((r.reels ?? []).filter((reel) => reel && reel.status === "dropped").map((reel) => `reel ${reel.n}`));
  const folderHere = (path) => {
    try {
      return statSync(path).isDirectory();
    } catch (err) {
      return false;
    }
  };
  const here = (r.app?.projects ?? []).filter((p) => p.state !== PROJECT_KEPT && REEL_KEY.test(p.key) && !dropped.has(p.key) && plainName(p.name) && folderHere(join(work, p.name)));
  if (!here.length) return [];
  const based = reelsBase(e.folder, r, { isWhole: ctx.isWhole, read: regularJson });
  if (!based.onFile && !based.coming) return [];
  try {
    const seen = exportsFound({ home: ctx.home, exports: exportsFolderOf(ctx.settings, ctx.home), name: e.name, record: { ...r, app: { ...r.app, projects: here } }, zone: ctx.deps.zone, readdir: ctx.deps.readdir, listDownloads: downloads, listExports: downloads.exports });
    if (seen.unreadable || seen.exportsUnreadable) return [];
    const looked = lookForExports(seen.input, {});
    const numberOf = (key) => Number(key.slice(5));
    const exported = [...new Set([...looked.parts.filter((part) => part.reel && !part.kept).map((part) => part.reel), ...looked.tied.filter((key) => REEL_KEY.test(key)).map(numberOf)])];
    return exported.some((n) => !(r.reels ?? []).some((reel) => reel && reel.n === n)) ? [] : exported.sort((a, b) => a - b);
  } catch (err) {
    return [];
  }
}

/** A session, as the guide reads it (guide.js VideoFacts `session`): her choice of what she wants from it, whether this Mac can
    read teachings now, how many of its items she has still to keep, drop or change, and whether its empty revision is still owed
    (revisionOwed). Its items are counted from its teachings file, read only when it is whole on this Mac: one that is not, or that
    cannot be read, counts as one undecided, so that the guide never says every item is decided of what it could not see. */
function guideSession(ctx, e, r) {
  const mark = r.session !== null && typeof r.session === "object" ? r.session : {};
  const got = readTeachings(folderAt(ctx, { folder: e.folder, record: r }, "local"), r, ctx.isWhole);
  const items = itemsOf(got.teachings, r.session);
  const undecided = got.coming !== undefined || got.why !== undefined ? 1 : ITEM_LISTS.reduce((n, [key]) => n + items[key].filter((item) => typeof item.approved !== "boolean").length, 0);
  return { choice: mark.teachings ?? null, teachingsOn: teachingsOn(ctx.settings, ctx.now()), undecided, emptyOwed: revisionOwed(r) };
}

/** What the guide reads of the answered video `e` (episodeAt's) in Episodes (guide.js VideoFacts), from its record in force and
    what this Mac holds of it, the speeds this Mac measured (`rates`, progress.js readRates) and her notes on this Mac (`notes`, guide-note.js,
    read once for the pass). A gated video is named as `episodes` names it (listedAs: by its label and short id), and is found
    only by its label, its id or short id, and the name it is listed by (gatedName, of gatedRecord); never by its folder or a name
    given to it, which may be its file's. Any other is named by its name and short id, and found by its folder's name too. `downloads` is
    the pass's one listing of Downloads, and its `exports` that of the exports folder this Mac picked (exports.js downloadsOnce, made by
    guideItems): the videos that look in them for an export are given it.
    `footageIn` is the pass's one look at the parts of the plans (footage.js partsReader, made by guideItems): a plan is given its parts by it.
    A planned episode (PR H4) has no video, no reading and no project to look at: it is named by its title and short id, found by those
    and by its folder, and its one fact is `planned`, { route, voice }, which gives it the guide's stage `film`.
    An episode kept on another Mac (keptOn; Phase 3, L2, D3) has `onOtherMac`, with that Mac in `mac`: it is changed only there, so the guide's
    step for it is there until a hand-off is written, whose steps on the BRIMM Ops page she takes on any Mac, unless it has a conflict or is held
    beside a session (`keeperFirst`): then its step stays there after a hand-off too. Nothing of its own files, which
    are on that Mac, is read here (its reading's teachings, its project, its copy, its parts), and it is not said to be waiting for her answer, in
    a conflict or held as a session here: each of those is said and sorted out on that Mac. */
function guideFacts(ctx, e, links, rates, notes, downloads, footageIn) {
  const r = e.inForce;
  const there = keptOn(ctx, e);
  if (isPlannedRecord(r)) {
    // Gated all the same when a conflicted copy of its record is a record that only claims to be planned: then it is named as any gated video is.
    const hidden = isGated(e);
    // Its footage (PR H5a): the parts it has, counted in words, and the labels of those that show a client and wait for the client's agreement.
    // Nothing of a part is read for a plan the gate holds (a conflicted copy that only claims to be planned), or for a plan kept on another Mac.
    const parts = hidden || there ? [] : footageIn(r.id);
    // Her "that's all the footage" (PR H5b): the run that makes the video is at work (`joining`), or its last end was a failure and the plan is a
    // plan still (`joinFailed`: a failure before the run at work now is its before, and the guide says the run at work first). Nothing is read for a plan the gate holds.
    const joining = !hidden && runningCommand(ctx.home, e.name, ctx.alive) === "join";
    const joinFailed = !hidden && !joining && readResult(ctx.home, e.name, "join")?.ok === false;
    return {
      name: hidden ? listedAs(ctx, e) : withShortId(shownName(r), r), id: r.id, aliases: [r.id, r.id.slice(-6), hidden ? gatedName(gatedRecord(e), e.held) : shownName(r), ...(hidden ? [] : [e.name])],
      at: Date.parse(r.imported.at), mac: there, drop: null, conflicted: !there && e.read.code === "CONFLICTED", kind: null, waiting: false, heldAsSession: false, elsewhere: false, onOtherMac: Boolean(there), handoff: null, source: null,
      planned: { route: r.planned.route, voice: r.planned.voice, footage: footageCounts(parts), waiting: parts.filter((part) => waitsForClient(part, r.planned)).map((part) => part.record.label || shownName(part.record)), joining, joinFailed, set: r.planned.set !== null, project: Boolean(r.planned.project) }
    };
  }
  const kind = recordKind(r);
  const hidden = isGated(e);
  const away = heldElsewhere(r, ctx.machine);
  const v2 = writesV2For(ctx.settings, e.folder, r);
  const running = runningCommand(ctx.home, e.name, ctx.alive);
  const handoff = guideHandoff(ctx, e, r, links, v2);
  // The way `finish` goes for a raw video and an iPhone clip (plan PR 10), so that the guide never sends one where `finish` will not take
  // it. What the HyperFrames way reads of the disk (the video being made, the
  // project, its history and exports) is read for those two kinds only, and the project's not once a hand-off is written. A video the
  // gate holds (a session not cleared whatever its kind, or one held beside a session) has no way, and nothing of it is read (review I2); nor
  // does a video kept on another Mac, whose project is there.
  const way = !hidden && !there && (kind === "raw" || kind === "short video") ? finishWay(ctx, r) : "";
  // A finished video's Reels (plan PR 16) are looked for only where `finish "<episode>" reels` would go on, so far as a look that costs no other
  // read can tell: the gate lets the video through, a hand-off is written, the other Mac does not have it open, no run is at work but a finish
  // (the stage of a finish at work is `finish-running`; a bring, a read or an ask is refused by `finish` in "<command> is running"), the chain of
  // its versions has no gap, and Dropbox did not undo this Mac's last change to its record (review F1, F2a and F2c); and she has not said the video
  // is finished: her word stands (guide.js nextFor), so what the Reels would say is never said, and looking for them on every pass, `guide wait`'s
  // every 5 seconds and `guide … tell`'s every 15 included, would be wasted (review F6; `notes` are hers, read once for the pass: guideItems). The
  // same holds of the project of a raw video or an iPhone clip, below (plan PR 17): nothing of a video she set aside is read.
  const looksForReels = !hidden && !there && kind === "finished" && handoff && !notes.finished[r.id] && !away && (running === "" || running === "finish") && !links.gapOf(r, e.folder) && !undone(r, ctx.home);
  // A finish at work that has written its hand-off and only waits for its late check (finish-check.js): she need not wait for it. It is
  // asked only of a finish at work, and of no video the gate holds. It is given the time of the check as this Mac's clock says it (`at`), for
  // the step of the Reels that wait for it.
  const checked = running === "finish" && !hidden ? checkingNow(ctx.home, e.name, r, ctx.alive) : null;
  const checking = checked ? { ...checked, at: clockAt(checked.due) } : null;
  // The late check of its last finish found a problem after she was told she could go on, and no later finish has ended well since (the
  // note finish.js leaves): asked only of a video with a hand-off that is not a session's, and of none the gate holds.
  const lateProblem = !hidden && Boolean(handoff) && kind !== "session" && problemFlagged(ctx.home, e.name);
  // The finish her last yes started has ended without a hand-off (finish-ended.js), which `guide … tell` says at its first look: asked only
  // when no finish is at work now, of no session and no video the gate holds.
  const finishFailed = !hidden && kind !== "session" && running !== "finish" && endedWithoutHandoff(ctx.home, e.name, handoff ? handoff.at : null);
  return {
    name: hidden ? listedAs(ctx, e) : withShortId(r.name.text, r),
    id: r.id,
    aliases: [typeof r.label === "string" ? r.label : "", r.id, r.id.slice(-6), hidden ? gatedName(gatedRecord(e), e.held) : shownName(r), ...(hidden ? [] : [r.name.text, e.name])].filter(Boolean),
    at: Date.parse(r.imported.at),
    mac: there || (away ? away.by : ""),
    drop: null,
    conflicted: !there && e.read.code === "CONFLICTED",
    kind,
    waiting: !there && kind === null && r.answer.state === "needs your answer",
    heldAsSession: !there && e.held && !gated(r),
    elsewhere: Boolean(away),
    onOtherMac: Boolean(there),
    keeperFirst: Boolean(there) && keeperFirst(e),
    local: Boolean(r.local),
    readingsOff: ctx.settings.readings === false,
    ...guideReading(ctx, e, r, kind, running, rates),
    offersAnswered: answerOf(r) !== null,
    v2,
    app: Boolean(appOf(ctx.settings)),
    placeholder: r.name.placeholder === true,
    explainer: isFromPlan(r) && r.planned.route === "explainer",
    editedInFinalCut: kind === "raw" && everShownInFinalCut(r),
    finishRunning: running === "finish",
    checking,
    lateProblem,
    finishFailed,
    gated: kind !== "session" && sessionNotCleared(r),
    way,
    copy: way ? guideCopy(ctx, e, r, rates) : null,
    project: way && !handoff && !notes.finished[r.id] ? guideProject(ctx, e, r, downloads) : null,
    reelsExported: looksForReels ? guideReels(ctx, e, r, downloads) : [],
    // A session kept on another Mac: its choice and whether its empty revision is owed are in its record; its teachings file is on that Mac, and is not
    // read here (an item it could not see counts as one undecided, as guideSession counts it).
    session: kind !== "session" ? null : there ? { choice: r.session?.teachings ?? null, teachingsOn: teachingsOn(ctx.settings, ctx.now()), undecided: 1, emptyOwed: revisionOwed(r) } : guideSession(ctx, e, r),
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
    minute (clockNear). Gives { videos, unreadable }: `unreadable` is whether macOS does not let this Mac's chat look in this Mac's own drop
    folder (EPERM: a folder its own permissions shut, EACCES, or one that is not there is passed over, as another Mac's is), which
    the overview says under the drop folder's line (Phase 3, L1c). */
function guideDrops(ctx) {
  const now = ctx.now();
  const statuses = readStatusesIn(statusReadFolders(ctx), now);
  const seen = readSeen(ctx.home);
  const runs = panelRuns(ctx);
  const videos = [];
  let unreadable = false;
  for (const { mac, folder } of dropFolders(ctx)) {
    let names = [];
    try {
      names = readdirSync(folder).filter(isMedia).sort();
    } catch (e) {
      if (mac === ctx.machine && e.code === "EPERM") unreadable = true;
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
      const drop = { here, state, step: state === "importing" ? shownStep(running.status.step) : "", left: times ? times.left : null, total: times ? times.total : null, readyAt: ready === null ? "" : clockNear(now + ready * 1000) };
      // `source` is for `guide tell` alone, which follows the video by it: never said.
      videos.push({ name: label || capital(unlabelled(video, found.size)), id: "", aliases: label ? [label] : [], at: noted && Number.isFinite(noted.at) ? noted.at : found.ctimeMs, mac: here ? "" : mac, drop, kind: null, handoff: null, source: { mac, file: video, bytes: found.size } });
    }
  }
  return { videos: apart(videos, clockAt), unreadable };
}

/** What Studio does at the late check of a finish, as one sentence: when it checks Dropbox's copies (`due`, ms, as this Mac's clock
    shows it) and then takes away the originals it took, from the place it took them (`took`: Downloads). A finish that
    took none says only when it checks. */
function checkSentence({ due, took }) {
  const out = took.map(() => "the export out of Downloads");
  return `Studio checks Dropbox's copies at ${clockAt(due)}${out.length ? `, and then takes ${listed(out)}` : ""}.`;
}

/** What is said after it, in the guide's answers: the check needs nothing of hers, but the commands that would write into the episode
    are stopped until it is made (stoppedWords): a spelling and handing the video off again. */
const ON_THE_CHECK = "You do not need to wait for it. A spelling and handing it off again wait until then.";

/** The videos the guide speaks of, from the drop folders (guideDrops) and Episodes: { items, old, unreadable }. Each item (guide.js Item) is a
    video in a drop folder, or an answered video, with what was read of it and its one next step, from her notes on this Mac
    (guide-note.js) and the time now. An episode with no record that can be read, one a newer brimm-video wrote, an archived one
    and one she left alone are passed over; one from before the switch, which has no answer, is counted in `old`, and not guided.
    Of the versions of a video handed off under one id, the BRIMM Ops page's step is said once, for the one with the newest
    hand-off: the highest revision, and of two at one revision the later written. Another is passed over when its own next step
    is that page's, or it has none; one whose step is brimm-video's or hers (held as a session, conflicted) stays. A video whose finish only waits for its late check (`facts.checking`) says after the guide's lines
    when Studio checks Dropbox's copies and what it then takes away, and that she need not wait for it (`also`). Her notes, the
    versions of every video and this Mac's measured speeds are read once. */
function guideItems(ctx) {
  const notes = readGuideNotes(ctx.home);
  const links = linksOf(ctx.root);
  const rates = readRates(progressFolder(ctx.home));
  // Downloads is listed once for the pass, by the first video that looks in it for an export, and given to every other (exports.js downloadsOnce;
  // plan PR 17, the review of PR 10, M5): a pass is one `guide`, one look of `guide wait` (every 5 seconds) or one of `guide … tell` (every 15), and a
  // listing costs 20 to 50 ms. A pass in which no video looks in it lists nothing. The exports folder this Mac picked, when it is not Downloads, is
  // listed the same way, once for the pass and only when a video looks in it (Phase 3, L1b).
  const downloads = downloadsOnce({ home: ctx.home, exports: exportsFolderOf(ctx.settings, ctx.home), readdir: ctx.deps.readdir });
  // The parts of the plans (PR H5a) are read from Episodes once for the pass too, by the first plan that has parts to count and then given to every
  // other, so that a pass costs the same whatever the number of plans (footage.js partsReader).
  const footageIn = partsReader(ctx.root);
  const drops = guideDrops(ctx);
  const items = drops.videos.map((facts) => ({ facts, next: nextFor(facts, notes, ctx.now()), folder: null, record: null }));
  let old = 0;
  for (const name of folders(ctx)) {
    const e = episodeAt(ctx, name, links);
    const r = e.inForce;
    // A part (PR H5a) is footage for a plan, which the guide says: it is guided nowhere on its own.
    if (!r || e.newer || r.archived || leftAlone(r) || isPart(r)) continue;
    if (r.answer === null || typeof r.answer !== "object") {
      old += 1;
      continue;
    }
    const facts = guideFacts(ctx, e, links, rates, notes, downloads, footageIn);
    // A plan that has a part which shows a client says, after its step, which are waiting for the client's agreement.
    const waiting = facts.planned && Array.isArray(facts.planned.waiting) ? facts.planned.waiting.map((label) => `${label} shows a client: it stays out until you say "the client agreed".`) : [];
    items.push({ facts, next: nextFor(facts, notes, ctx.now()), folder: e.folder, record: r, also: [...waiting, ...(facts.checking ? [`${checkSentence(facts.checking)} ${ON_THE_CHECK}`] : [])] });
  }
  const newest = new Map();
  for (const item of items) {
    const h = item.facts.handoff;
    const best = h ? newest.get(h.id) : undefined;
    if (h && (!best || h.revision > best.facts.handoff.revision || (h.revision === best.facts.handoff.revision && h.at > best.facts.handoff.at))) newest.set(h.id, item);
  }
  const own = (item) => !item.next.done && item.next.stage !== "ops";
  return { items: items.filter((item) => !item.facts.handoff || newest.get(item.facts.handoff.id) === item || own(item)), old, unreadable: drops.unreadable };
}

/** A folder opened in Finder for the guide, as `which` opens QuickTime Player, and said as `what` is, in Finder words (`words`).
    One not on this Mac is refused with `missing`. One Finder could not open is refused too, and why is never said: it may hold
    a path. */
function openFolder(ctx, folder, what, words, missing) {
  if (!ctx.stat(folder)) return refuse(ctx, missing);
  try {
    ctx.openApp("Finder", folder);
  } catch (e) {
    return refuse(ctx, `Finder could not open ${what}. Say it again. If it says this again, tell Jason.`);
  }
  ctx.say(`Opened ${what} in Finder: ${words}.`);
  return 0;
}

/** `guide page`: the BRIMM Ops page (OPS_PAGE), opened in her default browser through this Mac's program runner. */
async function openPage(ctx) {
  const ran = await (ctx.deps.run || runProgram)("/usr/bin/open", [OPS_PAGE]);
  if (ran.code !== 0) return refuse(ctx, "The BRIMM Ops page could not be opened. Say it again. If it says this again, tell Jason.");
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
  const path = where.every((part) => typeof part === "string" && part !== "") ? fileAt(ctx, { folder, record }, where.join("/")) : "";
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
    return refuse(ctx, `Not noted: this Mac's note could not be written (${(e && e.code) || "an error"}). Say it again. If it says this again, tell Jason.`);
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
function sayOverview(ctx, { items, old, unreadable = false }) {
  for (const line of overviewLines({ drop: dropWords(ctx.settings, ctx.machine, ctx.home), items, old, unreadable })) ctx.say(line);
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
    tool's run_in_background), and said in one line when it comes: it is ready, Claude has read it, its hand-off is ready, or its
    import or its reading did not finish, or its finish wrote no hand-off. What the guide says is read again every TELL_POLL_MS, for
    up to TELL_MS, following the video from its drop folder into Episodes (follow). A finish it was asked about while it ran is
    waited for until its hand-off is written, which is when the finish only waits for its late check, and not until that check is
    made; a finish her last yes started that ended without a hand-off before the first look (`finishFailed`) is said so at once, in place
    of the step from before it. A video with nothing on its way gets its next step at once, and one still on its way after TELL_MS gets that said, with
    its next step. Nothing is said before the end, and no notice is posted: the import, the reading and a finish's late check that
    fails post their own. */
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
  if (is("drop")) return openFolder(ctx, dropFolderOf(ctx.settings, ctx.home), "your drop folder", dropWords(ctx.settings, ctx.machine, ctx.home), "Your drop folder is not there: ask Jason.");
  if (is("drop", "zoom")) return openFolder(ctx, join(dirname(ctx.root), "BRIMM VIDEO Transfer", "Zoom Video Transfer"), "Zoom Video Transfer", ZOOM_WORDS, "Zoom Video Transfer is not on this Mac: ask Jason.");
  if (is("page")) return openPage(ctx);
  if (is("wait")) return waitForChange(ctx);
  // The form, after a video: "" for its next step, "show", "finished", "tell", or "done" with the step.
  const form = rest.length < 2 ? "" : rest.length === 2 && ["show", "finished", "tell"].includes(rest[1]) ? rest[1] : rest.length === 3 && rest[1] === "done" ? "done" : null;
  if (form === null) {
    ctx.say(HELP);
    return 2;
  }
  const read = guideItems(ctx);
  const { items } = read;
  if (!rest.length) return sayOverview(ctx, read);
  const found = findIn(items, rest[0]);
  if (found.why) return refuse(ctx, found.why);
  if (form === "show") return showForStep(ctx, found.item);
  if (form === "done") return noteDone(ctx, found.item, rest[2]);
  if (form === "finished") return noteFinished(ctx, found.item);
  if (form === "tell") return tellWhen(ctx, found.item);
  for (const line of videoLines(found.item)) ctx.say(line);
  return 0;
}

/** The project `refs use` copies a picture into: { dir, who } (its folder on this Mac, and how her words name it: "<episode>" or "Reel 2 of
    <episode>"), or { code } when there is none to copy into, having said why, in app's words and in app's order (the gate has asked
    already): a video her editor finished has no main project; an iPhone clip has no Reels; this Mac must be set up for HyperFrames; a
    project made on another Mac is that Mac's; a project of the record that is a session clip's folder is not used;
    and a project whose folder is not on this Mac is to be opened first, or a Reel the episode does not have is said as app says it.
    Nothing is claimed, brought or written, and no record is. */
function refsProject(ctx, { found, record }, reel) {
  const name = record.name.text;
  const key = reel === null ? "main" : `reel ${reel}`;
  const of = reel === null ? "" : `Reel ${reel} of `;
  const no = (why) => ({ code: refuse(ctx, why) });
  if (reel === null && recordKind(record) === "finished") return no(finishedHasNoProject(name));
  if (reel !== null && recordKind(record) === "short video") return no(NO_REELS);
  if (!appOf(ctx.settings)) return no(APP_NOT_SET_UP);
  const elsewhere = projectOnAnotherMac(ctx, { found, record }, key);
  if (elsewhere) return no(projectIsElsewhere(name, elsewhere, of));
  const clip = clipWords(ctx, { found, record }, key, `${of}${name}`);
  if (clip) return no(clip);
  const project = (record.app?.projects ?? []).find((p) => (reel === null ? inUse(p) : p.key === key));
  const dir = project && plainName(project.name) ? join(episodeWork(ctx.home, found.name), project.name) : "";
  if (dir && existsSync(dir)) return { dir, who: `${of}${name}` };
  return no((reel === null ? "" : reelWhy(ctx, found, record, reel)) || `Open it in HyperFrames first: say "${reel === null ? openInAppWords(name) : openReelWords(reel, name)}".`);
}

/** `refs`, `refs look "<name>"` and `refs use "<episode>" "<name>" [reel <n>]`: the reference folder (references.js; PR H3), edit.js being only the wiring.
    `refs` and `refs look` name no episode, so the gate is never asked of them and they run on any Mac that has the folder. `refs use` finds its
    episode as every command does, through the gate, and `refs` is in none of the gate's lists, so a video not yet answered, a video left alone,
    a session not cleared and a video held beside a session are refused in the gate's own words, as `app` refuses them. It then finds the
    project to copy into (refsProject) and gives it to references.js. It claims nothing, brings nothing and writes no record: the only file it
    makes is the picture, in a project's folder on this Mac or in Looking/, and nothing is written in the reference folder. */
async function refs(ctx, rest) {
  const asked = referencesAsked(rest);
  if (!asked) {
    ctx.say(HELP);
    return 2;
  }
  if (asked.form === "list") return sayReferences(ctx);
  if (asked.form === "look") return lookAt(ctx, asked.name);
  const got = episodeFor(ctx, [asked.episode], { newerEnds: 1 });
  if (!got.found) return got.code;
  const where = refsProject(ctx, got, asked.reel);
  if (where.code !== undefined) return where.code;
  return useIn(ctx, where, asked.name);
}

/** `plan new "<title>" [--explainer [--voice sallie|heygen]]` and `plan "<planned>" [set … | drop]`: the planned episode (plan.js; PR H4), edit.js being
    only the wiring. `plan new` names no episode, so the gate is never asked of it. The others find their episode as every command does, through
    the gate, which lets a planned episode through `plan` and `name` alone (gate.js PLANNED) and refuses a video not yet answered, a session and
    a video held beside a session in the gate's own words. */
async function plan(ctx, rest) {
  const { words, flags } = flagsOf(rest, ["cue", "shot", "line", "voice"]);
  const asked = planAsked(words, flags);
  if (!asked) {
    ctx.say(HELP);
    return 2;
  }
  if (asked.form === "new") return newPlan(ctx, asked);
  // A plan is named by the string `plan new` was given for its title, codes and all (episodeFor's `codes`).
  const got = episodeFor(ctx, [asked.episode], { newerEnds: 1, codes: true });
  if (!got.found) return got.code;
  if (asked.form !== "agreed") return planFor(ctx, { found: got.found, record: got.record }, asked, editKit(ctx));
  // A client's agreement is noted under the plan's answer lock, as a Reel's is under its session's: one dialog at a time for a plan, from before the
  // dialog to after the write, so that two runs cannot both be open, note twice, and tell her that Dropbox undid a change it did not.
  const lock = takeAnswerLock(ctx, got.found.name, "plan");
  if (!lock) return refuse(ctx, busyWhy(shownName(got.record)));
  try {
    return await planFor(ctx, { found: got.found, record: got.record }, asked, editKit(ctx));
  } finally {
    releaseEpisodeLock(lock.file, lock.text);
  }
}

/** What footage.js is given of edit.js's own (it imports no edit.js): how a record is saved, what a dialog asks and answers, the tool log, what is
    said of a record that cannot be read or is a newer brimm-video's, the words `kind` uses of a video being answered and of each kind, and the check
    that a video holds a session's words. Nothing here is a path or a program of its own. */
function editKit(ctx) {
  return {
    save: (found, record, done) => save(ctx, found, record, done),
    ask: (text, options) => askHere(ctx, text, options),
    log: (line, holds) => toolLog(ctx, line, holds),
    matchedSession,
    beingAnswered,
    kindSaid: KIND_SAID,
    notRead: (found, read) => notRead(ctx, { ...found, read }),
    newerWhy,
    pending: PENDING_WHY,
    hide: (name) => hideNames(ctx, episodeAt(ctx, name)),
    // A read-only copy of text in the episode's shown folder on this Mac, which `plan … script` opens (plan-script.js).
    shownCopy: (found, record, what, text) => madeShown(ctx, found, record, what, (to) => writeFileSync(to, text)),
    calledAs: (found) => calledAs(ctx, found),
    // What `kind` says of a recording that may be a session, before she has answered the not-a-session card: its words and its card (PR H6: the voiceover).
    askIfSession: (name, record) => refuseAnswer(ctx, name, record, ASK_IF_SESSION)
  };
}

/** `footage "<video>" "<planned>" talking|screen|b-roll --client yes|no [--shot <n>]` and `footage "<video>" none` (footage.js; PR H5a), edit.js
    being only the wiring: a dropped video is answered as footage for a planned video, or taken back. The video is found as every command finds its
    episode, through the gate, which lets `footage` run for a video with no kind (gate.js FOOTAGE) and for no other record. It holds the video's answer
    lock for the whole of its run, as `kind` and `leave` do, and claims nothing. */
async function footage(ctx, rest) {
  const { words, flags } = flagsOf(rest, ["client", "shot"]);
  const asked = footageAsked(words, flags);
  if (!asked) {
    ctx.say(HELP);
    return 2;
  }
  const got = episodeFor(ctx, [asked.video], { newerEnds: 1 });
  if (!got.found) return got.code;
  const lock = takeAnswerLock(ctx, got.found.name, "footage");
  if (!lock) return refuse(ctx, busyWhy(shownName(got.record)));
  try {
    return await footageFor(ctx, got, asked, editKit(ctx));
  } finally {
    releaseEpisodeLock(lock.file, lock.text);
  }
}

/** `join --now "<the plan's folder>" --parts <id>[,<id>…]`, the detached run `plan … join` starts (join.js; PR H5b): the plan's talking parts, in the
    order of the ids, joined into one video, which is filed as the plan's own video. It is a detached run's alone, like `read` and `workcopy`: it is in
    no help, and without --now and a folder, or without --parts and at least an id, it prints the help and ends 2, as a command it does not know. The
    plan is found and gated as every command's is: `join` is in the gate's list for a plan (gate.js PLANNED) and in none for a video waiting for its
    answer, one left alone, a part or a session, which are refused in the gate's own words, and the refusal is left as the run's result, as `read`'s and
    `workcopy`'s are. Past the gate it holds the plan's episode lock (detached.js runDetached), reads the plan again and does the work (join.js
    joinRun), whose result says why when it made no video. Once it has made the plan its video and let go of the lock it starts what follows (join.js
    afterJoin): Claude's reading, the working copy, the late check and the notice. What it needs of this Mac it takes from ctx.deps, as the other detached
    runs do, so that a test gives it stand-ins. Resolves 0 when the plan is its video, and 1 when it is not. */
async function joinCommand(ctx, rest) {
  const { flags } = flagsOf(rest.slice(2), ["parts"]);
  const ids = Array.isArray(flags.parts) && flags.parts.length === 1 ? flags.parts[0].split(",").map((id) => id.trim()) : [];
  // `--voice` (PR H6) takes a HeyGen voice in from the plan's project, and is given with no part.
  const voice = flags.voice === true && flags.parts === undefined;
  if (rest[0] !== "--now" || !rest[1] || (flags.voice !== undefined && !voice) || (!voice && !ids.length) || ids.some((id) => id === "")) {
    ctx.say(HELP);
    return 2;
  }
  const found = findEpisode(ctx, rest[1]);
  if (!found.read || !found.read.record) {
    ctx.say(found.why || notRead(ctx, found, rest[1]));
    if (found.gate) await leaveGateResult(ctx, found, "join");
    return 1;
  }
  if (found.read.newer) {
    ctx.say(newerWhy(found.read.record));
    return 1;
  }
  const tools = ctx.deps.tools || findPrograms();
  const deps = {
    run: ctx.deps.run || runProgram, tools, model: tools.model, home: ctx.home, settings: ctx.settings, now: () => new Date(ctx.now()), clock: ctx.now, checkout: thisCheckout(),
    log: (line) => ctx.say(line), wait: ctx.deps.wait || ((ms) => new Promise((done) => setTimeout(done, ms))), isWhole: ctx.isWhole,
    progress: ctx.deps.progress || reporter({ folder: progressFolder(ctx.home), swift: tools.swift }),
    ...(ctx.deps.readAll ? { readAll: ctx.deps.readAll } : {}), ...(ctx.deps.runGuarded ? { runGuarded: ctx.deps.runGuarded } : {}), ...ruleOpts(ctx), ...(ctx.deps.commit ? { commit: ctx.deps.commit } : {})
  };
  let started = null;
  // The result is cleaned late: the parts are hidden while the run reads them (joinRun, kit.hide), after this is made, and a reason that names a file of
  // one (the filing's, Dropbox's, ffmpeg's last words) must not reach the result, or `status`, which says it, with a name in it.
  const result = await runDetached({ home: ctx.home, folder: found.name, clean: lateClean(ctx), command: "join", alive: ctx.alive, ...(ctx.deps.keepAwake ? { keepAwake: ctx.deps.keepAwake } : {}) }, async () => {
    const done = await joinRun(ctx, { found }, voice ? { voice: true } : ids, deps, editKit(ctx));
    started = done.started ?? null;
    return done;
  });
  if (result.taking || result.running) {
    ctx.say(result.running ? `${result.running} is running for ${calledAs(ctx, found)} already.` : `Another run is taking over the lock of ${calledAs(ctx, found)}; try again in a few seconds.`);
    return 1;
  }
  if (result.ok && started) afterJoin(ctx, found, started, ctx.deps.notify || banner);
  return result.ok ? 0 : 1;
}

/** The commands, by the word a person's request is run with. `read` is a detached run's alone (`kind` and `teachings` start it),
    and so are `workcopy` (`kind` and `app` start it) and `join` (`plan … join` starts it): all three are in no help. */
const COMMANDS = { episodes: (ctx) => episodes(ctx), guide: guideCommand, kind: kindCommand, leave: leaveCommand, which: whichCommand, read, workcopy, join: joinCommand, open, app, bring, status, retry, name, title, reel, reels, ask, finish, show, behind: (ctx) => behind(ctx), resolve: resolveConflict, free, spell, graphic, teachings: teachingsCommand, principles, ideas, refs, plan, footage };
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
  // A BRIMM_VIDEO_HOME that is not a whole path is refused, never taken for the real home (home.js). A test's own home is not asked.
  const refusedHome = deps.home ? "" : homeRefusal();
  if (refusedHome) {
    say(refusedHome);
    return 2;
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
    // Something nobody foresaw stopped a command, on any Mac whatever its file says of the import (every import is light; Phase 3, L1d),
    // where any video's file may be named for a client: its error may name the video's file or folder, as a path does, so only its
    // code is said, through the filter, and the command ends there.
    ctx.say(`The work stopped (${(e && e.code) || "an error"}).`);
    code = 1;
  }
  // A session's words the command said on an open-lock Mac go into the chat's words file, and the chat is told the file.
  return handOverWords(ctx, code);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Inside Claude Code's sandbox nothing runs: it would fail partway through a command (sandboxed.js). The check is the open lock's:
  // a Mac whose lock in effect is strict runs edit.js as it did before the open lock was built, and never asks ps.
  const refusedHome = homeRefusal();
  const open = !refusedHome && effectiveLock(readSettings(homeOf({})).settings ?? null) === "open";
  const sandboxed = open ? sandboxedWhy({ env: process.env, pid: process.pid, spawn: spawnSync }) : "";
  if (refusedHome) {
    process.stdout.write(`${refusedHome}\n`);
    process.exitCode = 2;
  } else if (sandboxed) {
    process.stdout.write(`${sandboxed}\n`);
    process.exitCode = 1;
  } else {
    editMain(process.argv.slice(2)).then((code) => {
      process.exitCode = code;
    });
  }
}

