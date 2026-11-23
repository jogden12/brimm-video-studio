# A/B tests: a section for the BRIMM Ops app

For a BRIMM Ops session. Written in BRIMM Video Studio on 2026-11-23. It describes a feature Jason wants in BRIMM Ops, and the one piece both repos must change together. Nothing of it is built in either repo.

## Why

Studio is adding Reel Kit (a pinned copy of Justyn Berkovits' MIT-licensed video kit). Reel Kit makes several versions of one Reel easily: a different hook, caption treatment, effect or first few seconds. Reel Kit's own Trials app posts the versions as Instagram Trial Reels and compares them. Jason decided that posting, and A/B testing as a whole, belong in BRIMM Ops, not in Studio:

> leave trials posting out; that should be handled in BRIMM Ops eventually.

> A/B testing should be its own section in BRIMM Ops. the page would show all content for each version with a link to the local video (or folder) so that each can be accessed easily. basic instructions for how to A/B test could be included with a dropdown so that they can be easily hidden if not needed. these are BRIMM Ops features

## What the section shows

One card per test, newest first, inside the episode it belongs to (or in a list of all tests; BRIMM Ops' call). Each test has two or more versions side by side (stacked on a phone). For each version:

- **Its label** (A, B, C…) and **what's different** about it, in a line ("hook: the question first", "captions: one word at a time").
- **The video**: where the file is on the Mac, with its folder. See "Links to local files" below.
- **All of its content**: the on-screen title, the words (from the final transcript), its length, and the post text BRIMM Ops writes for it, as for any Reel.
- **How it was made** when it came from Reel Kit: the mode (hi-fi, lo-fi or showcase) and the effects used. Shown small.
- **Results**, once there are any: views, reach, watch time, skip rate, shares, saves. Typed in by hand at first. Filled in by whatever posts the trials, later.
- **The pick**: which version won, and when it was chosen.

## The instructions dropdown

A closed-by-default "How to run an A/B test" under the section's heading, which opens to a short guide and closes again. Suggested points, to be put in BRIMM's own words:

- Change one thing per test, so the result says what made the difference.
- Post every version as an Instagram Trial Reel (shown to people who don't follow the account), a few minutes apart.
- Test before the Reel goes to the feed. Instagram shows a trial very little if it looks like something already posted.
- Compare the versions after the same time, 24 hours, not as soon as one pulls ahead.
- Don't run two tests of near-identical footage at the same time.
- Share the winner to followers from the Instagram app.
- Watch time and shares say more than views.

## Posting

Nothing goes out unless Sallie approved it, as for every post. Posting trial versions would go through the same route as other posts: a connector in her own Claude, each piece at its planned time. Reel Kit's Trials uses Zernio for this; whether BRIMM Ops uses Zernio, her scheduler or something else is BRIMM Ops' decision. Studio never posts.

## The piece both repos change together: the hand-off

Today a hand-off's Reels are independent. To know that Reels 2 and 3 are versions A and B of one test, the hand-off needs to say so. That is a contract change (`tool/handoff-v2.js` and its fixtures in Studio, their copies in brimm-operations), so it is designed and made in step. A suggestion for where to start: an optional key on each Reel, for example `test: { id, version, differs }`, absent on Reels that aren't in a test, so older hand-offs read as they do now. BRIMM Ops should say what it needs here before Studio changes anything.

Until then, Studio sends the versions as ordinary Reels of the episode.

## Links to local files

Jason wants "a link to the local video (or folder)". BRIMM Ops is a Mac app since 2026-11-14, so its window can do this directly: two buttons per version, **Play** (opens the video in QuickTime or the default player) and **Show in Finder** (reveals the file in its folder). Both go through the Swift window, since the web view alone can't open files on the Mac.

Where the files are: `finish` copies each finished video into the episode's `final/` folder in Dropbox, next to the hand-off, in the `BRIMM Video` folder the app already watches for "Waiting from Studio". So the app reaches them on either Mac. A video that Dropbox has made online-only opens once Dropbox brings it down. The app can say "Downloading from Dropbox…" instead of failing.

The kept page (Version 12, read-only) gets none of this.

## Open for BRIMM Ops (and Jason)

1. Where tests live in the app: inside each episode, a section of their own, or both.
2. The hand-off key for a test (above), agreed with Studio before either repo changes.
3. How results get in: typed by hand first, and later from what posts the trials.
4. Which posting route trial versions use, and whether Instagram Trial Reels are reachable through it.
5. Whether a test record needs a `LAYOUT_VERSION` raise and a backup first (BRIMM Ops' own rule for any change to the records' layout).
