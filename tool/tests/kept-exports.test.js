// Phase 2 ("Final Cut retired"), F1: what the kept modules take from the modules that stay is pinned here, so that a later task
// that retires a Final Cut part cannot take one of these out from under them. Each name is imported by name: a name that is not
// exported makes this file fail at load. No assertion changes when a name moves: only the module it is imported from.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { REELS_FILE, previewPath, readReels, reelsFile, reelEntries, mergeCandidates, reelCandidates, reelsText, uncropped, notMadeWords } from "../reel-candidates.js";
import { firstWordsMatch } from "../exports.js";
import { keptWords, lengthOf, timelineAt, clockText } from "../clock.js";
import { graphicCuesOf, graphicCuesOfPlan, graphicCuesOfRecord, graphicCuesAsk, graphicCuesInPlan, graphicCuesInReply, graphicCuesJson, reelGraphicCues, placeGraphicCues, keptIndexes, keptPhraseSpans, phraseSpans, cueTokens, GRAPHIC_CUE_KINDS, SHOT_KINDS, REEL_CUES_MOST, CLIP_CUES_MOST, REEL_EDGE_SLACK } from "../graphic-cues.js";
import { createdOf, waitingToCut, captionTime, wordArgs, wordsOf, probeArgs, factsOf, colourOf, pauseArgs, pausesOf, framesASecond, streamsOf, soundStream, rangesOf, KEPT, KEPT_SIDE, keptSpans, roughRate, roughCaptions, planText, encodeArgs, QUALITY, phrasesOf, cutPlan, joinNotes, roughCutArgs, cutOutputs, clipOutputs, clipFiles } from "../cuts.js";
import { clipArgs, storyCuts, STORY_MAX, REEL_MIN, REEL_MAX, fitReel, storyParts, stretchesOf, cropsFor, stillsArgs, verticalArgs, UPRIGHT, shownWidth, speakerPlace, uprightPosition, STILL_EVERY } from "../reframe.js";

describe("reel-candidates.js", () => {
  // The Reel candidates: moved out of reels.js, which keeps the previews and the Reel's project.
  it("still exports what the kept modules import", () => {
    // previewPath: readReels reads an old reels.json's preview names.
    const names = { REELS_FILE, previewPath, readReels, reelsFile, reelEntries, mergeCandidates, reelCandidates, reelsText, uncropped, notMadeWords };
    for (const [name, value] of Object.entries(names)) assert.notEqual(value, undefined, `${name} is exported`);
  });
});

describe("exports.js", () => {
  // The first-words check of a HyperFrames part: moved out of parts.js.
  it("still exports what the kept modules import", () => {
    const names = { firstWordsMatch };
    for (const [name, value] of Object.entries(names)) assert.notEqual(value, undefined, `${name} is exported`);
  });
});

describe("clock.js", () => {
  // The clock: what the kept modules use of it.
  it("still exports what the kept modules import", () => {
    const names = { keptWords, lengthOf, timelineAt, clockText };
    for (const [name, value] of Object.entries(names)) assert.notEqual(value, undefined, `${name} is exported`);
  });
});

describe("graphic-cues.js", () => {
  // Claude's graphic cues: every name a kept module imports (app-reel, app, edit, join, plan, plan-project, readings, notes, project).
  it("still exports what the kept modules import", () => {
    const names = { graphicCuesOf, graphicCuesOfPlan, graphicCuesOfRecord, graphicCuesAsk, graphicCuesInPlan, graphicCuesInReply, graphicCuesJson, reelGraphicCues, placeGraphicCues, keptIndexes, keptPhraseSpans, phraseSpans, cueTokens, GRAPHIC_CUE_KINDS, SHOT_KINDS, REEL_CUES_MOST, CLIP_CUES_MOST, REEL_EDGE_SLACK };
    for (const [name, value] of Object.entries(names)) assert.notEqual(value, undefined, `${name} is exported`);
  });
});

describe("cuts.js", () => {
  // The cuts: every name filing, final-transcript, finish, join, on-timeline, notes, reading, reframe, workcopy, unedited and closing import.
  it("still exports what the kept modules import", () => {
    const names = { createdOf, waitingToCut, captionTime, wordArgs, wordsOf, probeArgs, factsOf, colourOf, pauseArgs, pausesOf, framesASecond, streamsOf, soundStream, rangesOf, KEPT, KEPT_SIDE, keptSpans, roughRate, roughCaptions, planText, encodeArgs, QUALITY, phrasesOf, cutPlan, joinNotes, roughCutArgs, cutOutputs, clipOutputs, clipFiles };
    for (const [name, value] of Object.entries(names)) assert.notEqual(value, undefined, `${name} is exported`);
  });
});

describe("reframe.js", () => {
  // The upright frame: every name finish, notes, reading, readings, reel-candidates, unedited, project and workcopy import, except needsReframe.
  it("still exports what the kept modules import", () => {
    const names = { clipArgs, storyCuts, STORY_MAX, REEL_MIN, REEL_MAX, fitReel, storyParts, stretchesOf, cropsFor, stillsArgs, verticalArgs, UPRIGHT, shownWidth, speakerPlace, uprightPosition, STILL_EVERY };
    for (const [name, value] of Object.entries(names)) assert.notEqual(value, undefined, `${name} is exported`);
  });
});
