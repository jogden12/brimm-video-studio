/* ---- Phase 0 of the Mac app: the spikes, S1 to S7 (9 November). A draft for the Studio By-Hand Checks page: put the SPK_ constants with
   the page's other constants, APP_SPIKES_GROUP after MOVE_PASTE_GROUP at the end of GROUPS, and APP_SPIKES_STEP_OF's entries into STEP_OF.
   With the page as it is, the checks are numbered 103 to 110. ---- */

/* ---- constants ---- */
/* The spike scripts, in Claude's worktree of the app's branch (nothing there is merged), and what they keep, on the Mac Studio. */
const SPK_TREE = '$HOME/Claude Code/brimm-video-studio/.claude/worktrees/app-development-a4362a';
const SPK = `${SPK_TREE}/spikes/2026-11-09-studio-mac-app`;
const SPK_WORK = '$HOME/BRIMM Video Work/App spikes';
/* What the spare account reads: both accounts can read it, and only yours writes it. */
const SPK_SHARED = '/Users/Shared/BRIMM Studio spikes';
const SPK_CLIP = `${SPK_SHARED}/Spike clip.mov`;
/* A spike script on the Mac Studio, run by Claude in your own account. */
const SPK_RUN = (script, what) => `zsh "${SPK}/${script}" ${what}`;
/* A step in the spare account, run by you in its own Terminal. */
const SPK_HERE = (step) => `zsh "${SPK_SHARED}/in-test-account.zsh" ${step}`;
/* Where the spare account's own files are, as Terminal prints them there (its account name is studiotest, check 103). */
const SPK_HOME = '/Users/studiotest';
const SPK_BIN = `${SPK_HOME}/Applications/BRIMM Node Spike.app/Contents/Resources/node/bin`;
/* S7: the address updates come from (Jason, 9 November), the same as UPDATE_HOST in the spikes' common.zsh: change both together.
   And its R2 bucket, and its zone on Cloudflare (the address without its first part). */
const SPK_UPDATE_HOST = 'updates.thebrimminsights.com';
const SPK_BUCKET = 'brimm-studio-updates';
const SPK_ZONE = SPK_UPDATE_HOST.replace(/^[^.]*\./, '');
/* What S7 makes on the Mac Studio, and where Sparkle's own tools are once --key has unpacked it. */
const SPK_S7 = `${SPK_WORK}/s7-sparkle`;
const SPK_S7_SHOWN = '/Users/jasonogden/BRIMM Video Work/App spikes/s7-sparkle';
const SPK_SPARKLE_BIN = '$HOME/Library/Caches/brimm-studio-spikes/s7/sparkle-2.10.1/bin';
const SPK_KEYCHAIN = cases([
  ["If macOS asks whether codesign may use your key,", "type your login password and choose Always Allow."],
  ["If it says it found 0 or 2 Developer ID identities,", "check 72 isn't done, or there are two: tell Claude."]
]);
/* The four notarizing steps of an app the spikes made (S3's, S4's, and S7's two builds), as MOVE_PASTE_GROUP has them, with nothing
   to fill in: the submission's id is read from what submit wrote. `label` names it in the first step, when it is not the app's name. */
const SPK_NOTARY = (folder, app, label = app) => {
  const zip = `${SPK_WORK}/${folder}/${app}.zip`;
  const bundle = `${SPK_WORK}/${folder}/${app}.app`;
  const told = `${SPK_WORK}/${folder}/notary.json`;
  return [
    [`On your yes, Claude sends ${label} to Apple to be notarized, which scans it for malware. It takes a few minutes:`,
      code(`xcrun notarytool submit "${zip}" --keychain-profile "BRIMM notary" --wait --output-format json | tee "${told}"`),
      prints("…", '{"message":"Processing complete","id":"…","status":"Accepted"}'),
      note("The three may come in another order."),
      cases([["If the status is Invalid,", "go on to the next step: Apple's log says why."]])],
    ["Claude reads Apple's log for that submission:",
      code(`xcrun notarytool log "$(plutil -extract id raw "${told}")" --keychain-profile "BRIMM notary"`),
      prints("{", '  "logFormatVersion": 1,', '  "status": "Accepted",', '  "statusSummary": "Ready for distribution",', "  …", '  "issues": null', "}"),
      cases([["If it lists an issue,", "stop: Claude tells you which file it names and why. The spike fails there, and that is its answer."]])],
    ["Claude staples Apple's ticket to the app and zips it again, with the same flags as the build:",
      code(`xcrun stapler staple "${bundle}" && ditto -c -k --norsrc --noextattr --keepParent "${bundle}" "${zip}"`),
      prints("…", "The staple and validate action worked!")],
    ["Claude checks what Gatekeeper will say:", code(`spctl --assess --type execute -vv "${bundle}"`),
      prints(`…/${app}.app: accepted`, "source=Notarized Developer ID", "origin=Developer ID Application: Jason Ogden (…)")]
  ];
};

/* ---- the group ---- */
const APP_SPIKES_GROUP = {
    id: "app-spikes", title: "Phase 0 of the Mac app: the spikes", meta: "Added 9 November, for Phase 0 of BRIMM Video Studio as a Mac app (the design and build plan of 9 November; nothing is merged, and nothing here touches Sallie's laptop). Seven spikes, S1 to S7, each answering one question the app's design rests on. Their scripts are in Claude's worktree of the app's branch, in spikes/2026-11-09-studio-mac-app, and its README says what each decides. Claude runs every Terminal step on the Mac Studio, in your own account, each on your yes in chat; you do the steps in the spare account, Studio Test, which check 103 makes, and everything on screen. Nothing is installed in your own account, and nothing touches the import's launch agent or a drop folder: what the spikes make is kept in BRIMM Video Work › App spikes, and what Studio Test needs is put in /Users/Shared/BRIMM Studio spikes. Use only your own recordings, never Sallie's or a client's. Notarizing sends an app to Apple: each time is its own step, on your yes.",
    checks: [
      {
        id: "spike-account", title: "Make the spare account, Studio Test",
        why: "A client's Mac has no Homebrew, no Xcode tools and no node, and its person is often not an admin. A second account on the Mac Studio is the nearest thing to one: a standard account, Studio Test. Two things can't be taken away from one account, because they are there for the whole Mac: Homebrew, which macOS puts on every account's list of places to look for programs, and Xcode's command line tools. Step 5 takes Homebrew off that account's list and makes Xcode's tools answer there as if they were missing; each spike then says which program it ran, by its whole path. <strong>Claude does step 1, on your yes; the rest are yours.</strong> Keep the account until Phase 6: its first install from the zip wants a fresh account, and you'll make another one then.",
        warn: "Studio Test is a test account: sign in to no Apple Account there, and put nothing of Sallie's in it.",
        steps: [
          ["On your yes, Claude makes the shared folder and puts the spare account's helper in it, with a copy of Studio's code (tool/, as git archive makes it, without tests or move-app):", code(SPK_RUN("stage.sh", "helper")),
            prints(`Staged in ${SPK_SHARED}: in-test-account.zsh, test-account.mjs, s2-compare.mjs, and tool/ at … (without tests or move-app).`)],
          ["In your own account, open System Settings › Users & Groups and click Add User… (type your own password when it asks). Choose Standard, full name Studio Test, account name studiotest, and a password of your own, then click Create User.",
            expect("Studio Test is in the list, with Standard under its name.")],
          ["From your own account, switch to Studio Test with the account menu in the menu bar, and type its password.",
            expect("macOS sets the account up for the first time."),
            cases([["If there is no account menu in the menu bar,", "in System Settings, search for Fast User Switching and set it to show in the menu bar. Don't log out of your own account: switching keeps it running, with the import's background job."]])],
          ["In the Studio Test account, go through its first-time setup. Skip signing in with an Apple Account, and turn off sharing analytics wherever it asks.",
            expect("The Studio Test desktop.")],
          ["In the Studio Test account, open Terminal (Finder › Applications › Utilities › Terminal) and run:", code(SPK_HERE("setup")),
            prints(`Written: ${SPK_HOME}/.zprofile, with PATH set to ~/.local/bin and macOS's own folders, and DEVELOPER_DIR to an empty place.`, `Made: ${SPK_HOME}/Applications`, "Quit Terminal (Command-Q) and open it again, for this to take effect."),
            cases([["If it says studiotest is an admin account,", "stop. In your own account, in System Settings › Users & Groups, click the i beside Studio Test and turn off Allow user to administer this computer. Then run it again."]])],
          ["In the Studio Test account, quit Terminal (Command-Q) and open it again.", expect("A new Terminal window.")],
          ["In the Studio Test account's Terminal, run:", code(SPK_HERE("look")),
            prints("This account: studiotest, standard (not an admin).", `Its PATH: ${SPK_HOME}/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin`, "  node: not found", "  npm: not found", "  ffmpeg: not found", "  ffprobe: not found", "  whisper-cli: not found", "  whisper-cpp: not found", "  brew: not found", "  claude: not found", "  Xcode's tools (git): missing, as on a Mac without them.", "Homebrew is still on this Mac's disk, in /opt/homebrew: a program here that looks there by name would find it. Each spike says which program it ran, by its whole path."),
            cases([
              ["If a program shows a path in place of not found,", "write which in the answer: this account still finds it, and a spike could use it without your knowing. Tell Claude."],
              ["If Xcode's tools say they answer here,", "Terminal wasn't opened again after step 5: quit it, open it again, and run this again."]
            ])]
        ],
        questions: [
          { id: "staged", label: "What the staging printed" },
          { id: "account", label: "Studio Test's account name, and that it is Standard" },
          { id: "look", label: "What look printed" }
        ]
      },
      {
        id: "spike-ffmpeg", title: "S1: a static ffmpeg, checked with Studio's own code",
        why: "Studio needs ffmpeg and ffprobe for the import, the copy of a video made for HyperFrames (an iPhone's HDR clip is made standard on the Mac's own hardware, VideoToolbox, with its scale_vt filter), the Reels and the joins. Today they come from Homebrew. The app would carry its own: ffmpeg 9.0.2 (the Mac Studio's version), built here with x264 at the commit Homebrew uses, loading nothing but macOS's own libraries, for macOS 13 or later. It is checked with Studio's own code, and its copy of an HDR clip of yours is compared with Homebrew's. <strong>Decides</strong> whether the app can carry ffmpeg itself. <strong>Fails</strong> if a program it makes loads a library that isn't macOS's own, if something Studio uses is missing, or if its HDR copy differs from Homebrew's in its pictures. Steps 1 and 2 are yours; Claude runs the rest, each on your yes. <strong>Needs:</strong> check 103's step 1.",
        steps: [
          ["On your iPhone, pick the spike clip: an iPhone recording of your own (never Sallie's, never a client's), a minute or less, in which you talk, recorded with HDR on (the iPhone's default: Settings › Camera › Record Video › HDR Video). AirDrop it from your iPhone to the Mac Studio.",
            expect("It lands in Downloads.")],
          ["In your own account, in Finder, choose Go › Go to Folder…, type /Users/Shared/BRIMM Studio spikes, move the clip there from Downloads, and name it Spike clip.mov.",
            expect("Spike clip.mov in BRIMM Studio spikes. If Finder asks whether to change its ending to .mov, choose Use .mov.")],
          ["Claude checks that it is HDR, and how long it is:", code(`/opt/homebrew/bin/ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,color_transfer,color_primaries:format=duration -of default=noprint_wrappers=1 "${SPK_CLIP}"`),
            prints("codec_name=hevc", "color_transfer=arib-std-b67", "color_primaries=bt2020", "duration=…"),
            cases([
              ["If color_transfer is anything but arib-std-b67,", "it isn't HDR: pick another clip, recorded with HDR on, and do steps 1 to 3 again."],
              ["If duration is more than 60,", "pick a shorter one: the spikes transcribe it several times."]
            ])],
          ["Claude prints what the build would do. It changes nothing:", code(SPK_RUN("build-ffmpeg.sh", "--print")),
            prints("S1: a static ffmpeg and ffprobe (spike only). --print changes nothing and fetches nothing.", "…", "  None of these folders is in Dropbox or inside a folder the import watches.", "", "Nothing was changed."),
            note("It lists the three downloads, each with its SHA-256 and where that was read, and the exact lines each source is built with.")],
          ["On your yes, Claude downloads the three sources: ffmpeg-9.0.2.tar.xz from ffmpeg.org (about 11 MB); x264's source at the commit Homebrew's x264 uses, x264-b35605ace3ddf7c1a5d67a2eb553f034aef41d55.tar.bz2, from code.videolan.org (about 1 MB); and pkgconf-2.3.0.tar.xz from distfiles.ariadne.space (about 0.3 MB, used only to build):", code(SPK_RUN("build-ffmpeg.sh", "--fetch")),
            prints("Fetching ffmpeg-9.0.2.tar.xz, about 11 MB, from https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz", "ffmpeg: ffmpeg-9.0.2.tar.xz matches its pin.", "Fetching x264-b35605ace3ddf7c1a5d67a2eb553f034aef41d55.tar.bz2, about 1 MB, from https://code.videolan.org/…", "x264: x264-b35605ace3ddf7c1a5d67a2eb553f034aef41d55.tar.bz2 matches its pin.", "Fetching pkgconf-2.3.0.tar.xz, about 0.3 MB, from https://distfiles.ariadne.space/pkgconf/pkgconf-2.3.0.tar.xz", "pkgconf: pkgconf-2.3.0.tar.xz matches its pin.", "All three match their pins. Nothing was unpacked."),
            cases([
              ["If it says one does not match its pin,", "stop: that file is moved aside and never used. For x264, code.videolan.org may have made its archive of the commit again: Claude checks the source another way, and changes the pin only on your yes."],
              ["If one could not be fetched,", "check that the Mac is online, and Claude runs it again."]
            ])],
          ["On your yes, Claude builds them. It takes about ten minutes:", code(SPK_RUN("build-ffmpeg.sh", "--build")),
            prints("Building in /Users/jasonogden/Library/Caches/brimm-studio-spikes/s1, with … jobs at a time. It takes about ten minutes; each step's log is in …/s1-ffmpeg/logs.", "pkgconf 2.3.0: built, for the build alone.", "x264 at b35605a: built, as a static library.", "ffmpeg 9.0.2 and ffprobe: built, and copied into /Users/jasonogden/BRIMM Video Work/App spikes/s1-ffmpeg/out.", "The source zip: made.", "", "What they load, and where they run:", "  ffmpeg and ffprobe load only macOS's own libraries: otool -L names only /usr/lib/ and /System/.", "  ffmpeg: arm64, for macOS 13.0 or later.", "  ffprobe: arm64, for macOS 13.0 or later.", "  ffmpeg version 9.0.2 Copyright (c) 2000-… the FFmpeg developers", "Made …/s1-ffmpeg/out/ffmpeg", "Made …/s1-ffmpeg/out/ffprobe", "Made …/s1-ffmpeg/out/ffmpeg-9.0.2-x264-b35605a-source.zip"),
            cases([
              ["If a line says a program loads a library that is not one of macOS's own,", "S1 fails as it is built: Claude tells you which library, and what would change."],
              ["If it says a step failed,", "it prints the end of that step's log: Claude reads it and tells you."]
            ])],
          ["Claude checks the new ffmpeg with Studio's own code:", code(SPK_RUN("build-ffmpeg.sh", "--check")),
            prints("Filters: all 26 that Studio's code uses are there, by Studio's own hasFilters.", "Hardware decoding: videotoolbox is there, by Studio's own hasHwaccel.", "Encoders: all 4 there (libx264, aac, pcm_s16le, mjpeg).", "Muxers: all 5 there (mp4, mov, wav, image2, null).", "Demuxers: all 3 there (mov, concat, wav).", "Decoders: all 5 there (h264, hevc, prores, aac, pcm_s16le).", "Protocols: file and pipe are there.", "A test video made with Studio's settings (libx264 at 18, veryfast; AAC at 48 kHz) reads back as 2 s, 640×360, with sound; its sound was made into the transcriber's .wav and listened to for pauses.", "", "S1 check: everything Studio's code uses of ffmpeg is there."),
            cases([["If a line starts Missing,", "S1 fails as it is built: the line says what is missing and where Studio uses it. Claude tells you what would change."]])],
          ["Claude makes the copy for HyperFrames of the spike clip twice, with Studio's own job: once with Homebrew's ffmpeg, once with the new one. It takes about a minute:", code(SPK_RUN("build-ffmpeg.sh", "--hdr")),
            prints("The spike clip is HDR (bt2020, arib-std-b67).", "Homebrew's ffmpeg (/opt/homebrew/bin/ffmpeg): Done in … s.", "  …/s1-ffmpeg/out/hdr/homebrew/BRIMM Video Work/S1 HDR/working copy/….mp4", "The new ffmpeg (…/s1-ffmpeg/out/ffmpeg): Done in … s.", "  …/s1-ffmpeg/out/hdr/static/BRIMM Video Work/S1 HDR/working copy/….mp4", "Their facts are the same: {…}", "Their sizes: Homebrew's … bytes, the new one's … bytes.", "The two files are not the same byte for byte (…), so their pictures are compared:", "  SSIM All: 1.000000 (1.000000 is the same pictures)", "  PSNR average: inf dB (inf is the same pictures)", "", "S1 HDR: the new ffmpeg makes the same working copy as Homebrew's."),
            cases([
              ["If it says The two files are the same, byte for byte,", "that is a pass too: there is nothing to compare."],
              ["If SSIM is below 1.000000 but 0.999 or more,", "it still passes, and its last line says so: step 9 looks by eye."],
              ["If a copy could not be made, or its last line says the copies differ,", "S1 fails for HDR: Claude reads what it printed and tells you."]
            ])],
          ["Claude opens both copies in QuickTime Player:", code(`open -a "QuickTime Player" "${SPK_WORK}/s1-ffmpeg/out/hdr/homebrew/BRIMM Video Work/S1 HDR/working copy/"*.mp4 "${SPK_WORK}/s1-ffmpeg/out/hdr/static/BRIMM Video Work/S1 HDR/working copy/"*.mp4`),
            expect("Two windows of your clip, upright, with the same colours and the same mild look. Play a few seconds of each, side by side.")],
          ["Claude lists the source zip, which goes with any copy of this ffmpeg given to someone else (ffmpeg with libx264 is GPL software):", code(`unzip -l "${SPK_WORK}/s1-ffmpeg/out/ffmpeg-9.0.2-x264-b35605a-source.zip"`),
            prints("Archive:  …/ffmpeg-9.0.2-x264-b35605a-source.zip", "  Length      Date    Time    Name", "---------  ---------- -----   ----", "        0  …   ffmpeg-9.0.2-x264-b35605a-source/", "  …   ffmpeg-9.0.2-x264-b35605a-source/ffmpeg-9.0.2.tar.xz", "  …   ffmpeg-9.0.2-x264-b35605a-source/x264-b35605ace3ddf7c1a5d67a2eb553f034aef41d55.tar.bz2", "  …   ffmpeg-9.0.2-x264-b35605a-source/build-ffmpeg.sh", "  …   ffmpeg-9.0.2-x264-b35605a-source/common.zsh", "  …   ffmpeg-9.0.2-x264-b35605a-source/pins.zsh", "  …   ffmpeg-9.0.2-x264-b35605a-source/BUILD.txt", "---------                     -------", "  …                     7 files"),
            note("The files may come in another order. BUILD.txt holds the exact lines both were built with.")]
        ],
        questions: [
          { id: "clip", label: "What the clip check printed" },
          { id: "fetch", label: "What the fetch printed" },
          { id: "build", label: "What the build printed from What they load on" },
          { id: "check", label: "What the check printed" },
          { id: "hdr", label: "What the HDR comparison printed" },
          { id: "eye", label: "How the two copies looked, side by side" },
          { id: "zip", label: "What the source zip holds" }
        ]
      },
      {
        id: "spike-whisper", title: "S2: a static whisper-cli, compared with Homebrew's",
        why: "Studio transcribes with whisper-cli, today Homebrew's. The app would carry its own, built here from whisper.cpp 1.9.5 (Homebrew's version) with the Mac's GPU (Metal), its GPU code inside the program, and nothing but macOS's own libraries. Both are run on the spike clip with Studio's model and Studio's own arguments, and what they write is compared. <strong>Decides</strong> whether the app can carry its own transcriber. <strong>Fails</strong> if it loads a library that isn't macOS's own, doesn't use the GPU, or its subtitles say other words than Homebrew's. Small differences in times are your call: Homebrew's uses its own copy of ggml, the library underneath (0.26.0), and this one the copy inside whisper.cpp. Claude runs every step, each on your yes. <strong>Needs:</strong> check 104's steps 1 to 3 (the spike clip).",
        steps: [
          ["Claude prints what the build would do. It changes nothing:", code(SPK_RUN("build-whisper.sh", "--print")),
            prints("S2: a static whisper-cli (spike only). --print changes nothing and fetches nothing.", "…", "  None of these folders is in Dropbox or inside a folder the import watches.", "", "Nothing was changed.")],
          ["On your yes, Claude downloads whisper.cpp's source, whisper.cpp-1.9.5.tar.gz, from github.com (about 10 MB); CMake 4.0.3, cmake-4.0.3-macos-universal.tar.gz, from Kitware's own releases on github.com (about 80 MB, used only to build); and Kitware's list of the SHA-256s of its files, cmake-4.0.3-SHA-256.txt (a few KB):", code(SPK_RUN("build-whisper.sh", "--fetch")),
            prints("Fetching whisper.cpp-1.9.5.tar.gz, about 10 MB, from https://github.com/ggml-org/whisper.cpp/archive/refs/tags/v1.9.5.tar.gz", "whisper: whisper.cpp-1.9.5.tar.gz matches its pin.", "Fetching cmake-4.0.3-macos-universal.tar.gz, about 80 MB, from https://github.com/Kitware/CMake/releases/download/v4.0.3/cmake-4.0.3-macos-universal.tar.gz", "Not pinned yet: cmake. cmake-4.0.3-macos-universal.tar.gz was fetched from https://github.com/Kitware/CMake/releases/download/v4.0.3/cmake-4.0.3-macos-universal.tar.gz, and its SHA-256 is", "  …", "The maker's own list (https://github.com/Kitware/CMake/releases/download/v4.0.3/cmake-4.0.3-SHA-256.txt) says", "  …", "The two are the same.", "Nothing was unpacked. Once Jason says yes, Claude writes it into pins.zsh (PIN_SHA[cmake]) and runs this again."),
            cases([
              ["If it says The two are NOT the same,", "stop: it is not pinned. Claude tells you."],
              ["If CMake could not be fetched,", "Kitware may name that file otherwise: Claude finds Kitware's own file for 4.0.3, and changes its address in pins.zsh only on your yes."]
            ])],
          ["If the two were the same, say yes in chat. Claude writes CMake's SHA-256 into pins.zsh and fetches again:", code(SPK_RUN("build-whisper.sh", "--fetch")),
            prints("whisper: whisper.cpp-1.9.5.tar.gz matches its pin.", "cmake: cmake-4.0.3-macos-universal.tar.gz matches its pin.", "Both match their pins. Nothing was unpacked.")],
          ["On your yes, Claude builds whisper-cli. It takes a few minutes:", code(SPK_RUN("build-whisper.sh", "--build")),
            prints("Building in /Users/jasonogden/Library/Caches/brimm-studio-spikes/s2, with … jobs at a time. It takes a few minutes; the log is in …/s2-whisper/logs.", "CMake, for the build alone: cmake version 4.0.3.", "whisper.cpp 1.9.5, with its own copy of ggml, version ….", "whisper-cli: built, and copied into /Users/jasonogden/BRIMM Video Work/App spikes/s2-whisper/out.", "", "What it loads, and where it runs:", "  whisper-cli loads only macOS's own libraries: otool -L names only /usr/lib/ and /System/.", "  whisper-cli: arm64, for macOS 13.0 or later.", "  Its Metal shaders are inside it.", "Made /Users/jasonogden/BRIMM Video Work/App spikes/s2-whisper/out/whisper-cli"),
            cases([
              ["If a line says it loads a library that is not one of macOS's own,", "S2 fails as it is built: Claude tells you which, and what would change."],
              ["If it says its Metal shaders were not found inside it,", "it would need a file beside it, which the app wouldn't have: write it, and go on to the comparison."],
              ["If it says a step failed,", "it prints the end of the log: Claude reads it and tells you."]
            ])],
          ["Claude runs Homebrew's whisper-cli and the new one on the spike clip, with Studio's model and Studio's own arguments, and compares what they write. It takes a few minutes:", code(SPK_RUN("build-whisper.sh", "--compare")),
            prints("The model is the one Studio uses (its SHA-256 matches).", "The clip's sound (stream …) is made into the transcriber's .wav with Studio's ffmpegArgs, by /opt/homebrew/bin/ffmpeg.", "Homebrew, the import's wordArgs: … s, …/compare/Homebrew-import/captions.srt", "Homebrew, the final transcript's whisperArgs: … s, …/compare/Homebrew-final/captions.srt", "the new one, the import's wordArgs: … s, …/compare/the-new-one-import/captions.srt", "the new one, the final transcript's whisperArgs: … s, …/compare/the-new-one-final/captions.srt", "", "the import's wordArgs: the two .srt files are the same.", "  Word times: … and … segments, the same words, … and … tokens; the largest difference in a token's start is … ms, and in its DTW time … ms.", "the final transcript's whisperArgs: the two .srt files are the same.", "", "Homebrew's backends (its own words, first ten seconds):", "  …", "the new one's backends (its own words, first ten seconds):", "  …", "", "What they wrote is the same."),
            note("Under each backends line are whisper's own words: the new one's should name Metal and the Mac's GPU, as Homebrew's do. The times on the first four lines say how fast each one is."),
            cases([
              ["If it says the two .srt files differ,", "it prints the diff: paste it into the answer. A word or two at the edge of a phrase is your call; other words fail S2."],
              ["If the new one's backends say nothing of Metal,", "it isn't using the GPU: S2 fails as it is built. Claude tells you."],
              ["If a run failed,", "Claude reads what it printed and tells you."]
            ])]
        ],
        questions: [
          { id: "fetch", label: "What the first fetch printed, both SHA-256s" },
          { id: "pin", label: "What the second fetch printed" },
          { id: "build", label: "What the build printed" },
          { id: "compare", label: "What the comparison printed (with the diff, if there was one)" }
        ]
      },
      {
        id: "spike-node", title: "S3: node, signed as the app's, run in Studio Test",
        why: "The app carries node, with Studio's other programs beside it in one folder. Here the official node v26.11.1 (the Mac Studio's version) goes into a tiny test app, BRIMM Node Spike, with S1's ffmpeg and ffprobe and S2's whisper-cli beside it when they are built. Each program is signed with your Developer ID and the hardened runtime (node also with the three permissions its JavaScript engine and sharp, which the HyperFrames command line uses, need), and Apple notarizes the app. Then in Studio Test, with no Homebrew, that node installs the pinned HyperFrames command line and runs it, and the whisper-cli beside it transcribes the spike clip. <strong>Decides</strong> whether the app can carry node and its neighbours through notarization and run them on a client's Mac. <strong>Fails</strong> if Apple rejects it, Gatekeeper stops node, the command line won't install or run, sharp won't load, doctor can't find ffmpeg beside node, or whisper-cli can't use the GPU there. Claude runs steps 1 to 10 on the Mac Studio, each on your yes; you run the rest in Studio Test. <strong>Needs:</strong> check 103, and checks 104 and 105 first, so that their programs go in the app.",
        steps: [
          ["Claude prints what the build would do. It changes nothing:", code(SPK_RUN("node-app.sh", "--print")),
            prints("S3: node, signed as the app's (spike only). --print changes nothing and fetches nothing.", "…", "Signing: the keychain has 1 Developer ID Application identity (it must have exactly one).", "None of these folders is in Dropbox or inside a folder the import watches.", "", "Not notarized yet. …", "  …", "", "Nothing was changed."),
            note("Under --build it lists ffmpeg, ffprobe and whisper-cli, from S1 and S2, when they are built.")],
          ["On your yes, Claude downloads node, node-v26.11.1-darwin-arm64.tar.gz, from nodejs.org (about 50 MB), and nodejs.org's list of the SHA-256s of its files, SHASUMS256.txt (a few KB):", code(SPK_RUN("node-app.sh", "--fetch")),
            prints("Fetching node-v26.11.1-darwin-arm64.tar.gz, about 50 MB, from https://nodejs.org/dist/v26.11.1/node-v26.11.1-darwin-arm64.tar.gz", "Not pinned yet: node. node-v26.11.1-darwin-arm64.tar.gz was fetched from https://nodejs.org/dist/v26.11.1/node-v26.11.1-darwin-arm64.tar.gz, and its SHA-256 is", "  …", "The maker's own list (https://nodejs.org/dist/v26.11.1/SHASUMS256.txt) says", "  …", "The two are the same.", "Nothing was unpacked. Once Jason says yes, Claude writes it into pins.zsh (PIN_SHA[node]) and runs this again."),
            cases([["If it says The two are NOT the same,", "stop: it is not pinned. Claude tells you."]])],
          ["If the two were the same, say yes in chat. Claude writes node's SHA-256 into pins.zsh and fetches again:", code(SPK_RUN("node-app.sh", "--fetch")),
            prints("node: node-v26.11.1-darwin-arm64.tar.gz matches its pin.")],
          ["On your yes, Claude builds the test app and signs it:", code(SPK_RUN("node-app.sh", "--build")),
            prints("With ffmpeg, from /Users/jasonogden/BRIMM Video Work/App spikes/s1-ffmpeg/out/ffmpeg.", "With ffprobe, from /Users/jasonogden/BRIMM Video Work/App spikes/s1-ffmpeg/out/ffprobe.", "With whisper-cli, from /Users/jasonogden/BRIMM Video Work/App spikes/s2-whisper/out/whisper-cli.", "node v26.11.1, with npm ….", "…/bin/node: replacing existing signature", "Signed bin/node.", "…/bin/…: replacing existing signature", "Signed bin/….", "…", "…/BRIMM Node Spike.app: replacing existing signature", "…/BRIMM Node Spike.app: valid on disk", "…/BRIMM Node Spike.app: satisfies its Designated Requirement", "The app's signature checks.", "node's entitlements: com.apple.security.cs.allow-jit,com.apple.security.cs.allow-unsigned-executable-memory,com.apple.security.cs.disable-library-validation.", "Made /Users/jasonogden/BRIMM Video Work/App spikes/s3-node/BRIMM Node Spike.app", "Made /Users/jasonogden/BRIMM Video Work/App spikes/s3-node/BRIMM Node Spike.zip", "Signed as Developer ID Application: Jason Ogden (…).", "", "Not notarized yet. That sends the app to Apple, so it is a by-hand step, on Jason's yes. The commands:", "  …"),
            note("One Signed line for each program in node's folder: node, ffmpeg, ffprobe and whisper-cli, in any order. Replacing existing signature is expected before each, and before the app: nodejs.org signs node, and the build gives the others a local signature of their own; each is signed again as yours."),
            SPK_KEYCHAIN],
          ["Claude checks node's signature and its permissions:", code(`codesign -dvvv "${SPK_WORK}/s3-node/node/bin/node" 2>&1 | grep -e '^Identifier' -e '^CodeDirectory' -e '^Authority' -e '^Timestamp'\ncodesign -d --entitlements - "${SPK_WORK}/s3-node/node/bin/node"`),
            prints("Identifier=node", "CodeDirectory v=… flags=0x10000(runtime) …", "Authority=Developer ID Application: Jason Ogden (…)", "Authority=Developer ID Certification Authority", "Authority=Apple Root CA", "Timestamp=…", "Executable=…/s3-node/node/bin/node", "[Dict]", "\t[Key] com.apple.security.cs.allow-jit", "\t[Value]", "\t\t[Bool] true", "\t…"),
            note("The three keys are allow-jit, allow-unsigned-executable-memory and disable-library-validation, each true."),
            cases([["If there is no runtime flag or no Timestamp line,", "stop: the build is not right. Claude tells you."]])],
          ...SPK_NOTARY("s3-node", "BRIMM Node Spike"),
          ["Claude puts it, the model (a clone, which takes no room) and S2's subtitles where Studio Test can read them:", code(SPK_RUN("stage.sh", "s3")),
            prints(`Staged: ${SPK_SHARED}/S3/BRIMM Node Spike.zip`, `Staged: ${SPK_SHARED}/model/ggml-large-v3-turbo.bin (a clone of Studio's model)`, `Staged: ${SPK_SHARED}/S2/static-import.srt (what S2's new whisper-cli wrote of the spike clip)`)],
          ["In the Studio Test account's Terminal, run:", code(SPK_HERE("take s3")),
            prints(`Copied into Downloads, and marked as downloaded from the internet: ${SPK_HOME}/Downloads/BRIMM Node Spike.zip`, "Its mark: 0081;…;Safari;"),
            note("The mark is the one Safari puts on a download, so macOS treats the app as one from the internet, as a client's would be."),
            cases([["If macOS asks whether Terminal may access files in your Downloads folder,", "click Allow: that is Terminal asking, for this account's Terminal steps, and not a spike."]])],
          ["In the Studio Test account, in Finder, open Downloads and double-click BRIMM Node Spike.zip.", expect("BRIMM Node Spike appears beside it in Downloads.")],
          ["In the Studio Test account, drag BRIMM Node Spike from Downloads into the Applications folder in your home folder (Finder › Go › Home, then Applications).",
            expect("It is in that Applications folder, and no longer in Downloads.")],
          ["In the Studio Test account's Terminal, run:", code(SPK_HERE("node")),
            prints(`node: ${SPK_BIN}/node`, "Its version: v26.11.1", `It runs as: ${SPK_BIN}/node`, "The app is marked as downloaded from the internet: yes.", "What Gatekeeper says of the app:", `  ${SPK_HOME}/Applications/BRIMM Node Spike.app: accepted`, "  source=Notarized Developer ID", "  origin=Developer ID Application: Jason Ogden (…)", "Beside node: ffmpeg ffprobe node npm npx whisper-cli", "  ffmpeg version 9.0.2 Copyright (c) 2000-… the FFmpeg developers"),
            cases([
              ["If a macOS box says node can't be opened, or asks whether to open it,", "write its words exactly in the answer. Click Open if it offers it, otherwise Cancel, and tell Claude."],
              ["If Beside node lists fewer programs,", "S1 or S2 wasn't built when the app was made: steps 18 and 20 say what is missing."]
            ])],
          ["In the Studio Test account, only when you're ready: this downloads the HyperFrames command line 0.8.208, and the packages it needs, from the npm registry (registry.npmjs.org), about 100 MB once installed, into BRIMM Video Work in this account. In its Terminal, run:", code(SPK_HERE("cli")),
            prints(`Installing the HyperFrames command line 0.8.208 with ${SPK_BIN}/npm, from the npm registry. It takes a minute or two.`, "", "added … packages in …", `The HyperFrames command line 0.8.208 is installed in ${SPK_HOME}/BRIMM Video Work/.toolchain/hyperframes-0.8.208, and npm's lock file holds the pin's integrity string (Studio's own toolchainHolds).`),
            cases([
              ["If it says what is there is not the pin,", "stop: tell Claude what it says."],
              ["If npm could not install it,", "check that the Mac is online, and run it again. If it fails again, copy what npm said into the answer."]
            ])],
          ["In the Studio Test account's Terminal, run:", code(SPK_HERE("version")), prints("0.8.208")],
          ["In the Studio Test account, only when you're ready: this downloads the Chrome the command line renders with (the Chrome Headless Shell, from storage.googleapis.com, about 190 MB once unpacked) into ~/.cache/hyperframes/chrome in this account. In its Terminal, run:", code(SPK_HERE("chrome")),
            prints("…"),
            note("Its own words: it says where its Chrome is once it has it."),
            cases([["If it ends with an error,", "copy its last lines into the answer, and tell Claude."]])],
          ["In the Studio Test account's Terminal, run:", code(SPK_HERE("doctor")),
            prints("…"),
            note("A tick against Node.js (naming this app's node), FFmpeg, FFprobe, Chrome and Archive extractor is the pass. A cross against TTS, BGM, Docker or Docker running is expected, and so is one against Version when a newer command line is out, since the pin moves only by a pull request."),
            cases([["If FFmpeg or FFprobe has a cross,", "it didn't find them beside node: S3 fails for them. Copy the line into the answer."]])],
          ["In the Studio Test account's Terminal, run:", code(SPK_HERE("sharp")),
            prints(`sharp …, with libvips …, loads in ${SPK_BIN}/node, and made a picture of … bytes.`),
            cases([["If it says sharp did not load in this node,", "S3 fails for sharp: copy its words into the answer."]])],
          ["In the Studio Test account's Terminal, run (it takes a minute or two):", code(SPK_HERE("whisper")),
            prints("The model is the one Studio uses (its SHA-256 matches).", `The clip's sound (stream …) is made into the transcriber's .wav with Studio's ffmpegArgs, by ${SPK_BIN}/ffmpeg.`, `this app, the import's wordArgs: … s, ${SPK_HOME}/BRIMM Spike Out/whisper/this-app-import/captions.srt`, `this app, the final transcript's whisperArgs: … s, ${SPK_HOME}/BRIMM Spike Out/whisper/this-app-final/captions.srt`, "", "The import's .srt is the same as the Mac Studio's.", "", "this app's backends (its own words, first ten seconds):", "  …", "", "What they wrote is the same."),
            note("The backends lines should name Metal and the Mac's GPU, as they did on the Mac Studio in S2."),
            cases([
              ["If it says the import's .srt differs from the Mac Studio's,", "paste the diff into the answer."],
              ["If the backends lines say nothing of Metal, or a run failed,", "whisper-cli can't use the GPU there: copy what it printed into the answer."],
              ["If it stops because a program isn't beside node,", "S1 or S2 wasn't built when the app was made: write it."]
            ])]
        ],
        questions: [
          { id: "fetch", label: "What the first fetch printed, both SHA-256s" },
          { id: "pin", label: "What the second fetch printed" },
          { id: "build", label: "What the build printed" },
          { id: "signatures", label: "What the signature check printed" },
          { id: "notarized", label: "The notarizing's status" },
          { id: "log", label: "What Apple's log said" },
          { id: "gatekeeper", label: "What the Gatekeeper check printed" },
          { id: "node", label: "What node printed in Studio Test, and any box macOS showed" },
          { id: "cli", label: "What cli printed" },
          { id: "version", label: "What version printed" },
          { id: "chrome", label: "What chrome printed at its end" },
          { id: "doctor", label: "What doctor printed (its ticks and crosses)" },
          { id: "sharp", label: "What sharp printed" },
          { id: "whisper", label: "What whisper printed" }
        ]
      },
      {
        id: "spike-agent", title: "S4: the background job through the app, in Studio Test",
        why: "Today the import's background job runs Homebrew's node, so macOS's boxes asking for permission name node, and what you allowed is lost when node is updated. The design runs the job through the app instead: its launch agent starts the app's own program with --agent, which starts the node inside the app and waits for it. This spike asks which name macOS then shows: in the box that asks for Downloads, in Files and Folders, and in Login Items. BRIMM Spike carries S3's signed node. Its launch agent, com.thebrimm.spike-agent (never the import's), watches a test folder, BRIMM Spike Watch, in Studio Test's home. It is loaded only in Studio Test, by you, and step 20 takes it away. <strong>Decides</strong> whether the background job can run through the app (the design's section 4). <strong>Fails</strong> if the box or Files and Folders names node, or Login Items shows a bare program or the label in place of BRIMM Spike. Claude runs steps 1 to 7 on the Mac Studio, each on your yes; you run the rest in Studio Test. <strong>Needs:</strong> check 106 (its signed node).",
        warn: "Don't open BRIMM Spike from Finder until check 108: here macOS must meet it first through its launch agent.",
        steps: [
          ["Claude prints what the build would do. It changes nothing:", code(SPK_RUN("agent-spike/build.sh", "--print")),
            prints("S4 and S5: BRIMM Spike.app (spike only). --print changes nothing.", "…", "None of these folders is in Dropbox or inside a folder the import watches.", "", "Not notarized yet. …", "  …", "", "Nothing was changed."),
            note("It shows the launch agent Studio Test will load, before its home is filled in.")],
          ["On your yes, Claude builds BRIMM Spike, with S3's signed node inside it, and signs it:", code(SPK_RUN("agent-spike/build.sh", "--build")),
            prints("…/BRIMM Spike.app: replacing existing signature", "…/BRIMM Spike.app: valid on disk", "…/BRIMM Spike.app: satisfies its Designated Requirement", "The app's signature checks.", "Made /Users/jasonogden/BRIMM Video Work/App spikes/s4-agent/BRIMM Spike.app", "Made /Users/jasonogden/BRIMM Video Work/App spikes/s4-agent/BRIMM Spike.zip", "Signed as Developer ID Application: Jason Ogden (…).", "", "Not notarized yet. That sends the app to Apple, so it is a by-hand step, on Jason's yes. The commands:", "  …"),
            SPK_KEYCHAIN],
          ...SPK_NOTARY("s4-agent", "BRIMM Spike"),
          ["Claude puts it, and the launch agent's template, where Studio Test can read them:", code(SPK_RUN("stage.sh", "s4")),
            prints(`Staged: ${SPK_SHARED}/S4/BRIMM Spike.zip and ${SPK_SHARED}/S4/com.thebrimm.spike-agent.plist`)],
          ["In the Studio Test account's Terminal, run:", code(SPK_HERE("take s4")),
            prints(`Copied into Downloads, and marked as downloaded from the internet: ${SPK_HOME}/Downloads/BRIMM Spike.zip`, "Its mark: 0081;…;Safari;")],
          ["In the Studio Test account, in Finder, open Downloads and double-click BRIMM Spike.zip.", expect("BRIMM Spike appears beside it in Downloads.")],
          ["In the Studio Test account, drag BRIMM Spike from Downloads into the Applications folder in your home folder. Don't open it.",
            expect("It is in that Applications folder, beside BRIMM Node Spike.")],
          ["In the Studio Test account's Terminal, run:", code(SPK_HERE("agent-plist")),
            prints('<?xml version="1.0" encoding="UTF-8"?>', "…", "  <key>Label</key><string>com.thebrimm.spike-agent</string>", "  <key>ProgramArguments</key>", "  <array>", `    <string>${SPK_HOME}/Applications/BRIMM Spike.app/Contents/MacOS/BRIMM Spike</string>`, "    <string>--agent</string>", "  </array>", "  <key>AssociatedBundleIdentifiers</key>", "  <array>", "    <string>com.thebrimm.spike</string>", "  </array>", "  <key>WatchPaths</key>", "  <array>", `    <string>${SPK_HOME}/BRIMM Spike Watch</string>`, "  </array>", "…"),
            note("It only prints: the launch agent runs the app's own program with --agent, and names the app as its own (AssociatedBundleIdentifiers), which is what Login Items reads.")],
          ["In the Studio Test account's Terminal, run this, then watch the screen for a minute without clicking anything:", code(SPK_HERE("agent-load")),
            prints(`Loaded: com.thebrimm.spike-agent, from ${SPK_HOME}/Library/LaunchAgents/com.thebrimm.spike-agent.plist.`, `It runs now, once, and again whenever something in ${SPK_HOME}/BRIMM Spike Watch changes. Its log: ${SPK_HOME}/Library/Logs/BRIMM Spike agent.log`)],
          ["In the Studio Test account, write down, word for word, everything macOS showed in that minute, with the name and the icon each named: a notice in the top right (about a background item, perhaps), and any box asking whether something may open, or may access files in your Downloads folder.",
            expect("Perhaps a notice that a background item was added, and a box: “BRIMM Spike” would like to access files in your Downloads folder, with the app's own words under it. Any other name in its place is the answer too.")],
          ["In the Studio Test account, answer what macOS asked: Open, if a box asks whether to open BRIMM Spike, which was downloaded from the internet; Allow, if a box asks about the Downloads folder.",
            expect("The boxes close."),
            cases([["If no box came,", "go on to the next step."]])],
          ["In the Studio Test account's Terminal, run:", code(SPK_HERE("agent-log")),
            prints("com.thebrimm.spike-agent is loaded:", "  state = not running", "  runs = 1", "  last exit code = 0", `The end of its log, ${SPK_HOME}/Library/Logs/BRIMM Spike agent.log:`, `…Z BRIMM Spike: started as ${SPK_HOME}/Applications/BRIMM Spike.app/Contents/MacOS/BRIMM Spike, process …, parent 1, app com.thebrimm.spike.`, "…Z BRIMM Spike: node started as process …; waiting for it.", `…Z node: node v26.11.1, ${SPK_HOME}/Applications/BRIMM Spike.app/Contents/Resources/node/bin/node, process …, parent ….`, "…Z node: Downloads: listed, … entries, after … ms.", "…Z node: Dropbox: this account has no Dropbox folder.", "…Z BRIMM Spike: node ended with status 0."),
            note("node's lines may come before the line that says it started. The milliseconds on the Downloads line are how long macOS held the call while its box was up."),
            cases([
              ["If the Downloads line says not listed: EPERM,", "macOS refused: the box was answered Don't Allow, or none came. Write it."],
              ["If there is no log, or the first line is missing,", "the launch agent didn't start the app's program: copy what it printed into the answer."]
            ])],
          ["In the Studio Test account, in Finder, open BRIMM Spike Watch in your home folder, and make a new folder in it (File › New Folder).",
            expect("No box this time.")],
          ["In the Studio Test account's Terminal, run:", code(SPK_HERE("agent-log")),
            prints("com.thebrimm.spike-agent is loaded:", "  state = not running", "  runs = 2", "  last exit code = 0", `The end of its log, ${SPK_HOME}/Library/Logs/BRIMM Spike agent.log:`, "…", "…Z node: Downloads: listed, … entries, after … ms.", "…Z node: Dropbox: this account has no Dropbox folder.", "…Z BRIMM Spike: node ended with status 0."),
            note("The second run's Downloads line should take only a few milliseconds: nothing asked.")],
          ["In the Studio Test account, open System Settings › General › Login Items & Extensions, and look under Allow in the Background.",
            expect("An entry for the launch agent: write its name, its icon (BRIMM Spike's own, a blank app, or a plain document), and the words under it.")],
          ["In the Studio Test account, open System Settings › Privacy & Security › Files and Folders, and find the entry that holds the Downloads Folder switch.",
            expect("Its name (BRIMM Spike, node, or another), and whether its switch is on.")],
          ["In the Studio Test account's Terminal, run:", code(SPK_HERE("agent-remove")),
            prints(`Removed: com.thebrimm.spike-agent is not loaded, and ${SPK_HOME}/Library/LaunchAgents/com.thebrimm.spike-agent.plist is deleted.`),
            cases([["If it says It is still loaded,", "tell Claude."]])],
          ["In the Studio Test account, quit System Settings, open it again, and look at General › Login Items & Extensions once more.",
            expect("The entry is gone, or still listed: write which.")]
        ],
        questions: [
          { id: "build", label: "What the build printed" },
          { id: "notarized", label: "The notarizing's status" },
          { id: "log", label: "What Apple's log said" },
          { id: "gatekeeper", label: "What the Gatekeeper check printed" },
          { id: "plist", label: "What agent-plist printed" },
          { id: "shown", label: "Everything macOS showed in that minute, word for word, with each name and icon" },
          { id: "first", label: "What the first agent-log printed" },
          { id: "second", label: "What the second agent-log printed" },
          { id: "loginitems", label: "The Login Items entry: its name, icon and words" },
          { id: "files", label: "The Files and Folders entry: its name, and its switch" },
          { id: "removed", label: "What agent-remove printed" },
          { id: "after", label: "Whether Login Items still lists it" }
        ]
      },
      {
        id: "spike-login", title: "S5: signing in to Claude Code with no Terminal, in Studio Test",
        why: "Today a Mac's Claude Code is signed in by typing claude auth login in Terminal, and the setup assistant has no Terminal. Here BRIMM Spike, opened from Finder, runs claude auth login itself, in a hidden terminal of its own, shows what it prints, and opens the sign-in link in the browser. At the end it asks whether the account is signed in, and shows only yes or no and the plan, never your email address. Claude Code goes into Studio Test with its own installer, into ~/.local/bin, where Studio looks for it. <strong>Decides</strong> whether the setup can sign Claude Code in by itself, or must send the person to Terminal. <strong>Fails</strong> if sign-in never finishes in the window, needs something the window can't give, or Claude Code says afterwards that it isn't signed in. Every step is yours, in Studio Test. <strong>Needs:</strong> check 107 (BRIMM Spike in Studio Test's Applications).",
        warn: "You sign in with your own Claude account, typed by you in the browser. Step 11 signs Studio Test's Claude Code out again.",
        steps: [
          ["In the Studio Test account, only when you're ready: this downloads the Claude Code program from Anthropic, through its own installer at claude.ai, about 300 MB. In its Terminal, run:", code("curl -fsSL https://claude.ai/install.sh | bash"),
            prints("…", "Claude Code successfully installed!", "…", "  Location: ~/.local/bin/claude", "…"),
            note("Its words may differ a little: what matters is that it says it is installed, in ~/.local/bin/claude."),
            cases([["If it says ~/.local/bin is not on your PATH,", "that's fine: check 103 put it there, and Studio looks there by name."]])],
          ["In the Studio Test account's Terminal, run:", code(SPK_HERE("claude-status")),
            prints(`Claude Code: … (Claude Code), at ${SPK_HOME}/.local/bin/claude`, "Signed in: no."),
            note("Don't run claude itself here: it would sign in through Terminal, which this spike is to do without.")],
          ["In the Studio Test account, quit Terminal (Command-Q).", expect("No Terminal window is open, and Terminal is not running.")],
          ["In the Studio Test account, in Finder, open the Applications folder in your home folder and double-click BRIMM Spike.",
            expect("Perhaps a box saying BRIMM Spike was downloaded from the internet: click Open. Then the BRIMM Spike window, showing what claude auth login prints, and your browser opening a claude.ai page."),
            cases([
              ["If the window's last line says It could not start: Claude Code is not in ~/.local/bin,", "step 1 didn't install it there: tell Claude."],
              ["If no browser page opens within a minute,", "write what the window shows, and tell Claude."]
            ])],
          ["In the Studio Test account, in the browser, sign in to your own Claude account (you type it yourself) and allow Claude Code.",
            expect("The page says you can go back, or shows a code to paste.")],
          ["In the Studio Test account, back in the BRIMM Spike window, do what it asks:",
            cases([
              ["If its last line says claude auth login ended,", "go on to the next step."],
              ["If it asks you to paste a code,", "copy the code from the browser, click the box at the bottom of the window, press Command-V, then click Send."],
              ["If it shows a choice of ways to sign in,", "use the ↑ and ↓ buttons to pick your Claude account with a subscription, then click Return."],
              ["If it seems to wait with nothing asked,", "click Return once. If nothing changes, write what it shows (leave out your email address) and tell Claude."]
            ])],
          ["In the Studio Test account, read the line in bold at the bottom of the window.",
            expect("<code>claude auth login ended with 0. Signed in: yes (…), by …. Terminal: not running.</code>"),
            cases([
              ["If it says Signed in: no,", "sign-in didn't finish here: write the window's last lines (leave out your email address) and tell Claude."],
              ["If it says Terminal: running,", "write it: Terminal was open, or something opened it."]
            ])],
          ["In the Studio Test account, close the BRIMM Spike window.", expect("BRIMM Spike quits.")],
          ["In the Studio Test account, open Terminal.", expect("A Terminal window.")],
          ["In the Studio Test account's Terminal, run:", code(SPK_HERE("claude-status")),
            prints(`Claude Code: … (Claude Code), at ${SPK_HOME}/.local/bin/claude`, "Signed in: yes (…).")],
          ["In the Studio Test account's Terminal, sign its Claude Code out again, and check:", code(`"$HOME/.local/bin/claude" auth logout\n${SPK_HERE("claude-status")}`),
            prints("…", `Claude Code: … (Claude Code), at ${SPK_HOME}/.local/bin/claude`, "Signed in: no.")]
        ],
        questions: [
          { id: "installed", label: "What the installer printed at its end" },
          { id: "before", label: "What claude-status printed before" },
          { id: "window", label: "What the window showed when it opened, and any box macOS showed" },
          { id: "browser", label: "What the browser page said at the end" },
          { id: "asked", label: "What the window asked for, if anything, and what you did" },
          { id: "result", label: "The bold line at the bottom of the window" },
          { id: "status", label: "What claude-status printed after" },
          { id: "signedout", label: "What the sign-out printed" }
        ]
      },
      {
        id: "spike-hyperframes", title: "S6: the HyperFrames app with no Homebrew, in Studio Test",
        why: "The setup sends the person to HyperFrames' own page to install its app. This spike does that as a standard account would, then has the app open, play and export a test project, while it looks for any program running from Homebrew. The test project is written with Studio's own code (as Studio writes a HeyGen explainer's: upright, ten seconds, with no media), on S3's node, and handed to the app by the pinned command line's open, as Studio does. The HyperFrames app on the Mac Studio carries its own ffmpeg and fetches its own node and Chrome, so it should need nothing from Homebrew. <strong>Decides</strong> the words of the setup's “Apps to install” step: where a standard account puts the app, and whether anything must be installed first. <strong>Fails</strong> if the app needs a Homebrew program, or can't open or export the project in Studio Test. Every step is yours, in Studio Test. <strong>Needs:</strong> check 106 (the command line in Studio Test).",
        warn: "In HyperFrames: export on This Mac only, never in the cloud; share nothing; use no HeyGen avatar or voice and make nothing with HeyGen. If it asks how its agent may work, choose Auto, never Full. If it asks to share usage data, choose the answer that shares nothing.",
        steps: [
          ["In the Studio Test account's Terminal, run:", code(SPK_HERE("project")),
            prints(`Written: ${SPK_HOME}/BRIMM Video Work/Spike S6/Spike test main 5b1e70`)],
          ["In the Studio Test account's Terminal, run:", code(SPK_HERE("lint")),
            prints("…"),
            note("The command line's own words: no errors is the pass. Copy any warning into the answer, for Claude to read.")],
          ["In the Studio Test account, only when you're ready: in Safari, go to hyperframes.dev/studio/download (the page the pinned command line names for a Mac) and download HyperFrames for Mac, from HyperFrames (HeyGen).",
            expect("A download in Downloads, of a few hundred MB. If Safari asks whether to allow downloads from hyperframes.dev, click Allow. Write the file's name and size, as Safari's list of downloads shows them.")],
          ["In the Studio Test account, double-click the download in Downloads.",
            expect("A window with HyperFrames and a shortcut to Applications (a disk image), or HyperFrames itself.")],
          ["In the Studio Test account, drag HyperFrames onto the Applications shortcut in that window (or into Applications in Finder's sidebar, if there is no shortcut).",
            expect("macOS asks for an administrator's name and password, or says HyperFrames is there already (your own account installed it for the whole Mac)."),
            cases([["Whatever it says,", "write its words, then click Cancel or Stop: don't type your own password here. A client who isn't an admin would meet the same box."]])],
          ["In the Studio Test account, drag HyperFrames into the Applications folder in your home folder instead (Finder › Go › Home, then Applications).",
            expect("HyperFrames is there, beside BRIMM Node Spike and BRIMM Spike.")],
          ["In the Studio Test account, double-click HyperFrames in the Applications folder in your home folder.",
            expect("Perhaps a box saying HyperFrames was downloaded from the internet: click Open. Then its first screens.")],
          ["In the Studio Test account, go through its first screens: choose the answers that share nothing, and if it asks you to sign in to HeyGen, sign in with your own account (you type it yourself), or skip it if it lets you.",
            expect("Its start screen, with no project open. Write what each screen asked.")],
          ["In the Studio Test account's Terminal, run:", code(SPK_HERE("homebrew")),
            prints("This account's programs running from /opt/homebrew: none.", `HyperFrames runs from: ${SPK_HOME}/Applications/HyperFrames.app`),
            cases([
              ["If it lists a program,", "copy the lines into the answer: the app is using Homebrew's, which a client's Mac won't have. Tell Claude."],
              ["If HyperFrames runs from /Applications/HyperFrames.app, as well or instead,", "your own account's copy, which is there for the whole Mac, was opened: write it, and go on."]
            ])],
          ["In the Studio Test account's Terminal, run:", code(SPK_HERE("open-app")),
            prints("{", `  "project": "${SPK_HOME}/BRIMM Video Work/Spike S6/Spike test main 5b1e70",`, '  "opened": true,', '  "app": "the HyperFrames desktop app",', '  "handedOver": null', "}"),
            expect("HyperFrames shows the project: an upright page on the brand's mist."),
            cases([["If it says \"opened\": false,", "copy its reason into the answer, and tell Claude."]])],
          ["In the Studio Test account, in HyperFrames, play the project from the start.",
            expect("Ten seconds of the mist background, with no video and no voice, played to the end.")],
          ["In the Studio Test account, in HyperFrames, export it on This Mac (never the cloud), as an MP4, into Downloads, and start the export.",
            expect("After a moment, an .mp4 in Downloads.")],
          ["In the Studio Test account's Terminal, right after you start the export, run:", code(SPK_HERE("homebrew")),
            prints("This account's programs running from /opt/homebrew: none.", `HyperFrames runs from: ${SPK_HOME}/Applications/HyperFrames.app`),
            cases([["If it lists a program,", "copy the lines into the answer: the export used Homebrew's."]])],
          ["In the Studio Test account's Terminal, once the export is in Downloads, run:", code(SPK_HERE("exported")),
            prints("The newest video in Downloads: ….mp4, … bytes, made ….", "codec_name=h264|codec_type=video|width=1080|height=1920", "…", "duration=10.…"),
            note("There may be a sound line too, of a silent sound.")],
          ["In the Studio Test account's Terminal, run:", code(SPK_HERE("runtimes")),
            prints(`In ${SPK_HOME}/Library/Application Support/HyperFrames/runtimes:`, "  …"),
            note("What the app fetched for itself (its own node, ffmpeg, Chrome and others), each with its size: copy the list into the answer."),
            cases([["If it says there is no runtimes folder,", "write it: the app keeps them elsewhere, or fetched none."]])],
          ["In the Studio Test account, quit HyperFrames (Command-Q).", expect("It closes.")]
        ],
        questions: [
          { id: "project", label: "What project printed" },
          { id: "lint", label: "What lint printed" },
          { id: "download", label: "The download's file name and size" },
          { id: "applications", label: "What macOS said when you dragged it into Applications" },
          { id: "firstrun", label: "What its first screens asked, and what you chose" },
          { id: "homebrew", label: "What homebrew printed with the app open" },
          { id: "open", label: "What open-app printed, and what the app showed" },
          { id: "play", label: "Whether it played to the end" },
          { id: "export", label: "Whether the export finished, and where it went" },
          { id: "during", label: "What homebrew printed during the export" },
          { id: "exported", label: "What exported printed" },
          { id: "runtimes", label: "What runtimes printed" }
        ]
      },
      {
        id: "spike-sparkle", title: "S7: an update round trip, through Sparkle and Cloudflare R2",
        why: `The app is to offer its updates itself, through Sparkle 2, from a signed list of updates (an appcast) kept on Cloudflare R2 at your own address, ${SPK_UPDATE_HOST}. Here a tiny app, Sparkle Spike, is built twice, build 1 (1.0, “first”) and build 2 (1.1, “second”), and each is signed and notarized. Sparkle's own generate_appcast signs the list for build 2 with your Sparkle key, which you make and back up yourself, and which stays in your login keychain. You turn R2 on, make the bucket ${SPK_BUCKET}, attach ${SPK_UPDATE_HOST} to it, and publish the two files, with the cf command, yourself. Then in Studio Test, build 1 finds build 2, Sparkle checks its signature and who signed it, installs it on your click, and the app comes back as build 2. What you allowed it (its Downloads folder) is looked at again, and so is what you allowed BRIMM Spike in check 107. <strong>Decides</strong> whether updates can be offered inside the app from your own address (the design's section 5). <strong>Fails</strong> if Sparkle rejects the signed update, installs one signed by another team, or what you allowed doesn't survive the update. Claude runs steps 1 to 4, 7 to 19 and 27 to 29 on the Mac Studio, each on your yes; steps 5, 6 and 20 to 26 are yours on the Mac Studio, and the rest are yours in Studio Test. <strong>Needs:</strong> check 103 (Studio Test), and check 107 (BRIMM Spike's Downloads grant, looked at again).`,
        warn: "Your Sparkle key's private half is yours alone: never paste it, or its backup file, into chat, and never put either in the repo. Claude only ever reads its public half, which goes inside the app. Every cf command here is yours, in your own Terminal: Claude runs none of them.",
        steps: [
          ["Claude prints what the build would do. It changes nothing:", code(SPK_RUN("sparkle-spike/build.sh", "--print")),
            prints("S7: a Sparkle 2 update round trip from Cloudflare R2 (spike only). --print changes nothing and fetches nothing.", "", `Updates are offered from https://${SPK_UPDATE_HOST}/spike/ (UPDATE_HOST in common.zsh): the feed https://${SPK_UPDATE_HOST}/spike/appcast.xml,`, `kept in the R2 bucket ${SPK_BUCKET}.`, "…", "Signing: the keychain has 1 Developer ID Application identity (it must have exactly one).", "…", "None of these folders is in Dropbox or inside a folder the import watches.", "", "Build 1 is not notarized yet. …", "  …", "", "Build 2 is not notarized yet. …", "  …", "", "Nothing was changed."),
            note("Check the address on its third line: it is the one you decided.")],
          ["On your yes, Claude downloads Sparkle 2.10.1, Sparkle-2.10.1.tar.xz, from Sparkle's own releases on github.com (about 16 MB), and reads GitHub's own record of the file's SHA-256 (a few KB):", code(SPK_RUN("sparkle-spike/build.sh", "--fetch")),
            prints("Fetching Sparkle-2.10.1.tar.xz, about 16 MB, from https://github.com/sparkle-project/Sparkle/releases/download/2.10.1/Sparkle-2.10.1.tar.xz", "Not pinned yet: sparkle. Sparkle-2.10.1.tar.xz was fetched from https://github.com/sparkle-project/Sparkle/releases/download/2.10.1/Sparkle-2.10.1.tar.xz, and its SHA-256 is", "  …", "GitHub's own record of the release (https://api.github.com/repos/sparkle-project/Sparkle/releases/tags/2.10.1) gives its digest as", "  …", "The two are the same.", "Nothing was unpacked. Once Jason says yes, Claude writes it into pins.zsh (PIN_SHA[sparkle]) and runs this again."),
            note("On 9 November, GitHub's record gave 1a856d2a9edb8e628de88121d7be04cf0e2167f8641650b78fca00b14244cf27."),
            cases([["If it says The two are NOT the same, or that GitHub's record gives no digest,", "stop: it is not pinned. Claude tells you."]])],
          ["If the two were the same, say yes in chat. Claude writes Sparkle's SHA-256 into pins.zsh and fetches again:", code(SPK_RUN("sparkle-spike/build.sh", "--fetch")),
            prints("sparkle: Sparkle-2.10.1.tar.xz matches its pin.")],
          ["Claude unpacks Sparkle and looks for your Sparkle signing key:", code(SPK_RUN("sparkle-spike/build.sh", "--key")),
            prints("Unpacked Sparkle 2.10.1 in /Users/jasonogden/Library/Caches/brimm-studio-spikes/s7/sparkle-2.10.1.", "There is no Sparkle signing key in your login keychain yet (generate_keys -p said: No existing signing key found!).", "Jason makes it himself, once, in his own Terminal on the Mac Studio, with Sparkle's own tool. It keeps the private half in his", "login keychain and prints only the public half:", '  "/Users/jasonogden/Library/Caches/brimm-studio-spikes/s7/sparkle-2.10.1/bin/generate_keys"', "…", "Then run --key again."),
            cases([["If it prints The public half of the Sparkle signing key … instead,", "you made one before: skip step 5, and do step 6 if that key isn't backed up yet."]])],
          ["In your own account, open Terminal yourself and make the key there with Sparkle's own tool (Claude doesn't run this one). It keeps the private half in your login keychain and prints only the public half:", code(`"${SPK_SPARKLE_BIN}/generate_keys"`),
            prints("Generating a new signing key. This may take a moment, depending on your machine.", "A key has been generated and saved in your keychain. Add the `SUPublicEDKey` key to", "…", "    <key>SUPublicEDKey</key>", "    <string>…</string>"),
            note("What is between the string tags is the public half: it's safe to see, and it goes inside the app."),
            cases([
              ["If macOS asks whether generate_keys may save to your keychain,", "type your login password and click Allow."],
              ["If it says A pre-existing signing key was found,", "you have one already: that one is used. Go on to step 6."]
            ])],
          ["Still in your own Terminal, back the key up yourself, to a file of your own choosing that only you can reach: on a drive you keep safe, or to move into your password manager. Never in the repo, and never in chat: the file is the private key itself.", code(`"${SPK_SPARKLE_BIN}/generate_keys" -x "<a file of your choosing>"`),
            expect("It prints nothing, and the file is there. Where you keep it is yours alone: don't write it in the answer."),
            cases([
              ["If macOS asks whether generate_keys may use your keychain,", "type your login password and click Allow."],
              ["If it says private-key-file already exists,", "choose another name: it never writes over a file."]
            ])],
          ["Claude reads the key's public half, which goes into the app:", code(SPK_RUN("sparkle-spike/build.sh", "--key")),
            prints("The public half of the Sparkle signing key in your login keychain (SUPublicEDKey) is", "  …"),
            note("The same string as between the string tags in step 5."),
            cases([["If macOS asks whether generate_keys may use your keychain,", "type your login password and click Allow."]])],
          ["On your yes, Claude builds build 1 of Sparkle Spike, with Sparkle inside it, and signs it:", code(SPK_RUN("sparkle-spike/build.sh", "--build 1")),
            prints("Signed Contents/Frameworks/Sparkle.framework/Versions/B/XPCServices/Installer.xpc.", "Signed Contents/Frameworks/Sparkle.framework/Versions/B/XPCServices/Downloader.xpc.", "Signed Contents/Frameworks/Sparkle.framework/Versions/B/Autoupdate.", "Signed Contents/Frameworks/Sparkle.framework/Versions/B/Updater.app.", "Signed Contents/Frameworks/Sparkle.framework.", "…/Sparkle Spike.app: valid on disk", "…/Sparkle Spike.app: satisfies its Designated Requirement", "The app's signature checks.", `Made ${SPK_S7_SHOWN}/build-1/Sparkle Spike.app`, `  version 1.0 (1), "first", feed https://${SPK_UPDATE_HOST}/spike/appcast.xml, SUPublicEDKey …`, `Made ${SPK_S7_SHOWN}/build-1/Sparkle Spike.zip`, "Signed as Developer ID Application: Jason Ogden (…) (team …).", "", "Build 1 is not notarized yet. That sends the app to Apple, so it is a by-hand step, on Jason's yes. The commands:", "  …"),
            note("A replacing existing signature line before each Signed line is expected: Sparkle signs its own parts, and each is signed again as yours, in the order Sparkle's documentation gives."),
            SPK_KEYCHAIN],
          ...SPK_NOTARY("s7-sparkle/build-1", "Sparkle Spike", "build 1 of Sparkle Spike"),
          ["On your yes, Claude builds build 2, the same app with only its version and its word changed, and signs it:", code(SPK_RUN("sparkle-spike/build.sh", "--build 2")),
            prints("Signed Contents/Frameworks/Sparkle.framework/Versions/B/XPCServices/Installer.xpc.", "…", "The app's signature checks.", `Made ${SPK_S7_SHOWN}/build-2/Sparkle Spike.app`, `  version 1.1 (2), "second", feed https://${SPK_UPDATE_HOST}/spike/appcast.xml, SUPublicEDKey …`, `Made ${SPK_S7_SHOWN}/build-2/Sparkle Spike.zip`, "Signed as Developer ID Application: Jason Ogden (…) (team …).", "", "Build 2 is not notarized yet. …", "  …"),
            note("The same key and the same team as build 1's."),
            SPK_KEYCHAIN],
          ...SPK_NOTARY("s7-sparkle/build-2", "Sparkle Spike", "build 2 of Sparkle Spike"),
          ["On your yes, Claude has Sparkle's own generate_appcast write the list of updates for build 2 and sign it with your key, which stays in your keychain:", code(SPK_RUN("sparkle-spike/build.sh", "--appcast")),
            prints("generate_appcast is signing the update with the key in your login keychain. macOS may ask whether generate_appcast may use", "your confidential information in the keychain: Jason types his login password and clicks Allow.", "Wrote 1 new update, updated 0 existing updates, and removed 0 old updates in appcast.xml", "", `The appcast it wrote, ${SPK_S7_SHOWN}/appcast/appcast.xml:`, '  <?xml version="1.0" encoding="utf-8"?>', "  …", "  <sparkle:version>2</sparkle:version>", "  <sparkle:shortVersionString>1.1</sparkle:shortVersionString>", "  …", `  <enclosure url="https://${SPK_UPDATE_HOST}/spike/Sparkle-Spike-1.1.zip" length="…" type="application/octet-stream" sparkle:edSignature="…"/>`, "  …", "", "It holds an sparkle:edSignature.", "It has no channel tag.", `Its download is https://${SPK_UPDATE_HOST}/spike/Sparkle-Spike-1.1.zip.`, "Its item is build 2.", `In ${SPK_S7_SHOWN}/appcast: Sparkle-Spike-1.1.zip, appcast.xml`, "", "Next: --publish-print prints the commands Jason runs to publish them."),
            note("Its lines may be indented differently, and in another order."),
            cases([
              ["If macOS asks whether generate_appcast may use confidential information in your keychain,", "type your login password and click Allow. Claude waits for you."],
              ["If it says SUPublicEDKey in the app … does not match, or the appcast holds no sparkle:edSignature,", "stop: nothing is to be published. Claude tells you."]
            ])],
          ["Claude prints the Cloudflare commands for you. It runs none of them:", code(SPK_RUN("sparkle-spike/build.sh", "--publish-print")),
            prints("S7: the Cloudflare commands Jason runs himself, in his own Terminal, with the cf command (his rule for Cloudflare). This prints", "them and runs none of them; it changes nothing.", "…", "Nothing was changed."),
            note("Steps 20 to 26 are those commands, in that order.")],
          ["In your browser, sign in to the Cloudflare dashboard yourself, and open R2 Object Storage. If R2 isn't turned on for the account yet, turn it on.",
            expect("R2's overview, with its list of buckets (perhaps empty)."),
            note("If Cloudflare asks for a payment method, or to accept R2's terms, those are yours to decide: Claude does neither. The spike keeps two files of a few MB there.")],
          ["In your own Terminal, check that cf is signed in to your Cloudflare account:", code("cf auth whoami"),
            expect("Your account, signed in."),
            cases([["If it says you aren't signed in,", "run cf auth login, sign in in the browser yourself, and run this again."]])],
          ["In your own Terminal, make the bucket:", code(`cf r2 buckets create --name ${SPK_BUCKET}`),
            prints("…"),
            note(`cf's own words: the bucket's name, ${SPK_BUCKET}, in them is the pass.`),
            cases([["If it says R2 isn't turned on, or there is no subscription,", "do step 20 again, then this."]])],
          [`In your own Terminal, read the zone ID of ${SPK_ZONE}, which the next step needs:`, code(`cf zones list --name ${SPK_ZONE}`),
            expect(`One zone, ${SPK_ZONE}, with its id: 32 letters and digits. Copy the id.`)],
          [`In your own Terminal, attach ${SPK_UPDATE_HOST} to the bucket as its custom domain, open to the public, with TLS 1.2 or later. Put the id from step 23 in place of the words in angle brackets:`,
            code(`cf r2 buckets domains custom create ${SPK_BUCKET} --domain ${SPK_UPDATE_HOST} --zone-id <the id from step 23> --enabled --min-tls 1.2`),
            prints("…"),
            note(`cf's own words: ${SPK_UPDATE_HOST}, enabled, is the pass. It can take a few minutes to become active.`),
            cases([["If cf refuses it,", `copy its words into the answer, and attach it in the dashboard instead: R2 › ${SPK_BUCKET} › Settings › Custom Domains › Add, type ${SPK_UPDATE_HOST}, and confirm.`]])],
          ["In your own Terminal, publish build 2's zip:", code(`cf r2 objects put spike/Sparkle-Spike-1.1.zip --bucket-name ${SPK_BUCKET} --file "${SPK_S7}/appcast/Sparkle-Spike-1.1.zip" --content-type application/zip`),
            prints("…"),
            note("The zip goes first, so that the list never names a zip that isn't there yet.")],
          ["In your own Terminal, publish the list of updates:", code(`cf r2 objects put spike/appcast.xml --bucket-name ${SPK_BUCKET} --file "${SPK_S7}/appcast/appcast.xml" --content-type application/xml`),
            prints("…")],
          [`Claude checks that both answer at ${SPK_UPDATE_HOST}:`, code(`curl -sI https://${SPK_UPDATE_HOST}/spike/appcast.xml\ncurl -sI https://${SPK_UPDATE_HOST}/spike/Sparkle-Spike-1.1.zip`),
            prints("HTTP/2 200", "…", "content-type: application/xml", "…", "HTTP/2 200", "…", "content-type: application/zip", "…"),
            cases([
              ["If curl says it could not resolve the host,", "the custom domain isn't active yet: wait a few minutes, and Claude runs it again."],
              ["If either says 404,", `in your own Terminal, list the bucket with cf r2 objects list --bucket-name ${SPK_BUCKET} (it only reads) and copy the names into the answer. If they read spike%2F… in place of spike/…, cf kept the slash encoded (its preview of the command shows the address that way): tell Claude.`]
            ])],
          ["Claude puts the spare account's helper there again, so that it has S7's two steps (take s7 and sparkle-version):", code(SPK_RUN("stage.sh", "helper")),
            prints(`Staged in ${SPK_SHARED}: in-test-account.zsh, test-account.mjs, s2-compare.mjs, and tool/ at … (without tests or move-app).`)],
          ["Claude puts build 1 where Studio Test can read it (build 2 it fetches from your address):", code(SPK_RUN("stage.sh", "s7")),
            prints(`Staged: ${SPK_SHARED}/S7/Sparkle Spike.zip (build 1, version 1.0)`),
            cases([["If it says the zip holds no stapled app,", "the stapling step's zip wasn't made again: Claude makes it, and runs this again."]])],
          ["In the Studio Test account's Terminal, run:", code(SPK_HERE("take s7")),
            prints(`Copied into Downloads, and marked as downloaded from the internet: ${SPK_HOME}/Downloads/Sparkle Spike.zip`, "Its mark: 0081;…;Safari;")],
          ["In the Studio Test account, in Finder, open Downloads and double-click Sparkle Spike.zip.", expect("Sparkle Spike appears beside it in Downloads.")],
          ["In the Studio Test account, drag Sparkle Spike from Downloads into the Applications folder in your home folder.",
            expect("It is in that Applications folder, beside BRIMM Spike.")],
          ["In the Studio Test account, double-click Sparkle Spike in that Applications folder, and answer what macOS asks: Open, if a box says it was downloaded from the internet; Allow, if a box asks about your Downloads folder.",
            expect(`Its window: Sparkle Spike 1.0 (1), first, Updates from: https://${SPK_UPDATE_HOST}/spike/appcast.xml, and once you've allowed it, Downloads: listed, … entries, after … ms. Write down every box's words, and the name each one gave.`),
            cases([["If the Downloads line says not listed,", "write its words: macOS refused, or no box came."]])],
          ["In the Studio Test account's Terminal, run:", code(SPK_HERE("sparkle-version")),
            prints(`Sparkle Spike: version 1.0 (1), "first", at ${SPK_HOME}/Applications/Sparkle Spike.app`, "Signed by: Developer ID Application: Jason Ogden (…), team …", "Its signature checks: yes.", `Its feed: https://${SPK_UPDATE_HOST}/spike/appcast.xml`),
            note("Step 38 compares its team with this one.")],
          ["In the Studio Test account, in Sparkle Spike, choose Sparkle Spike › Check for Updates… in the menu bar.",
            expect("Sparkle's window: A new version of Sparkle Spike is available! Sparkle Spike 1.1 is now available—you have 1.0, with Skip This Version, Remind Me Later and Install Update. Write its words exactly."),
            cases([
              ["If it says you're up to date,", "it didn't see build 2: write its words, and tell Claude."],
              ["If it says an error occurred in retrieving update information,", "it couldn't read the list: write its words, and tell Claude."],
              ["If it says the update is improperly signed,", "S7 fails there: Sparkle rejected the signature. Write its words."]
            ])],
          ["In the Studio Test account, click Install Update. When Sparkle has it, click Install and Relaunch.",
            expect("Sparkle downloads it, says it is ready to install, and on your click quits Sparkle Spike."),
            cases([["If macOS asks for a name and password,", "write its words, then click Cancel and tell Claude: the Applications folder in your home folder should need none."]])],
          ["In the Studio Test account, wait for Sparkle Spike to open again by itself.",
            expect("Its window: Sparkle Spike 1.1 (2), second, and its Downloads line, with no box asking this time."),
            cases([
              ["If a box asks about your Downloads folder again,", "what you allowed didn't survive the update: write its words, then click Allow."],
              ["If it doesn't open again by itself within a minute,", "open it from the Applications folder in your home folder, and write that you had to."]
            ])],
          ["In the Studio Test account's Terminal, run:", code(SPK_HERE("sparkle-version")),
            prints(`Sparkle Spike: version 1.1 (2), "second", at ${SPK_HOME}/Applications/Sparkle Spike.app`, "Signed by: Developer ID Application: Jason Ogden (…), team …", "Its signature checks: yes.", `Its feed: https://${SPK_UPDATE_HOST}/spike/appcast.xml`),
            cases([["If the team differs from step 34's,", "S7 fails there: Sparkle installed an update signed by another team. Write both."]])],
          ["In the Studio Test account, open System Settings › Privacy & Security › Files and Folders.",
            expect("Sparkle Spike, with its Downloads Folder switch on, and BRIMM Spike, from check 107, with its switch as you left it. Write each entry's name and switch.")],
          ["In the Studio Test account, quit Sparkle Spike (Command-Q).", expect("It closes.")]
        ],
        questions: [
          { id: "fetch", label: "What the first fetch printed, both SHA-256s" },
          { id: "pin", label: "What the second fetch printed" },
          { id: "made", label: "That generate_keys made the key, or found one (its public half may be pasted, never its private half)" },
          { id: "backup", label: "That the backup is made (not where you keep it)" },
          { id: "key", label: "What the second --key printed" },
          { id: "build1", label: "What build 1's build printed" },
          { id: "notarized1", label: "Build 1's notarizing status" },
          { id: "log1", label: "What Apple's log said of build 1" },
          { id: "gatekeeper1", label: "What the Gatekeeper check printed for build 1" },
          { id: "build2", label: "What build 2's build printed" },
          { id: "notarized2", label: "Build 2's notarizing status" },
          { id: "log2", label: "What Apple's log said of build 2" },
          { id: "gatekeeper2", label: "What the Gatekeeper check printed for build 2" },
          { id: "appcast", label: "What --appcast printed, and any box macOS showed" },
          { id: "r2", label: "Whether R2 was on already, and what turning it on asked" },
          { id: "bucket", label: "What making the bucket printed" },
          { id: "domain", label: "What attaching the custom domain printed" },
          { id: "zip", label: "What publishing the zip printed" },
          { id: "list", label: "What publishing the list of updates printed" },
          { id: "answers", label: "What the two curl checks printed" },
          { id: "first", label: "Build 1's window, and every box macOS showed, word for word" },
          { id: "before", label: "What sparkle-version printed before the update" },
          { id: "offered", label: "Sparkle's window, word for word" },
          { id: "install", label: "What happened when you clicked Install Update and Install and Relaunch" },
          { id: "after", label: "Build 2's window after it opened again, and whether any box came" },
          { id: "version", label: "What sparkle-version printed after the update" },
          { id: "files", label: "The Files and Folders entries: Sparkle Spike's and BRIMM Spike's, each with its switch" }
        ]
      }
    ]
};
const APP_SPIKES_STEP_OF = {
  "spike-account": { staged: "Step 1", account: "Step 2", look: "Step 7" },
  "spike-ffmpeg": { clip: "Step 3", fetch: "Step 5", build: "Step 6", check: "Step 7", hdr: "Step 8", eye: "Step 9", zip: "Step 10" },
  "spike-whisper": { fetch: "Step 2", pin: "Step 3", build: "Step 4", compare: "Step 5" },
  "spike-node": { fetch: "Step 2", pin: "Step 3", build: "Step 4", signatures: "Step 5", notarized: "Step 6", log: "Step 7", gatekeeper: "Step 9", node: "Step 14", cli: "Step 15", version: "Step 16", chrome: "Step 17", doctor: "Step 18", sharp: "Step 19", whisper: "Step 20" },
  "spike-agent": { build: "Step 2", notarized: "Step 3", log: "Step 4", gatekeeper: "Step 6", plist: "Step 11", shown: "Step 13", first: "Step 15", second: "Step 17", loginitems: "Step 18", files: "Step 19", removed: "Step 20", after: "Step 21" },
  "spike-login": { installed: "Step 1", before: "Step 2", window: "Step 4", browser: "Step 5", asked: "Step 6", result: "Step 7", status: "Step 10", signedout: "Step 11" },
  "spike-hyperframes": { project: "Step 1", lint: "Step 2", download: "Step 3", applications: "Step 5", firstrun: "Step 8", homebrew: "Step 9", open: "Step 10", play: "Step 11", export: "Step 12", during: "Step 13", exported: "Step 14", runtimes: "Step 15" },
  "spike-sparkle": { fetch: "Step 2", pin: "Step 3", made: "Step 5", backup: "Step 6", key: "Step 7", build1: "Step 8", notarized1: "Step 9", log1: "Step 10", gatekeeper1: "Step 12", build2: "Step 13", notarized2: "Step 14", log2: "Step 15", gatekeeper2: "Step 17", appcast: "Step 18", r2: "Step 20", bucket: "Step 22", domain: "Step 24", zip: "Step 25", list: "Step 26", answers: "Step 27", first: "Step 33", before: "Step 34", offered: "Step 35", install: "Step 36", after: "Step 37", version: "Step 38", files: "Step 39" }
};
