**Report: what sound and a transcript of raw footage can give, and what each part needs (2026-10-13)**

Checked on this Mac: Mac Studio Mac13,1, M1 Max, 32 GB, macOS 27.0.1. All tests used synthetic speech (the Mac's built-in voice) and synthetic video (an ffmpeg test pattern), piped in memory, so real footage will differ. No file was created in the repo or anywhere else by me; the Swift interpreter may have written its usual compile cache. I did not open the landing page; it was not part of this question.

Four findings change the plan:
- **This Mac's ffmpeg cannot burn captions.** Homebrew ffmpeg 9.0.2 has no libass and no libfreetype, so the `subtitles`, `ass` and `drawtext` filters are absent.
- **Final Cut Pro 12.4, Motion 6.4 and Compressor 5.4 are installed here.** Final Cut already does animated word-by-word subtitles, vertical reframing and footage search.
- **whisper-cli's default word times are poor.** DTW fixes most of it, but only with one extra flag.
- **Apple's face detection runs here from a Swift script with nothing installed.**

**(a) A time for every word from whisper-cli 1.9.5**

- **Command that works here:** `whisper-cli -m <model> -f sound.wav -l en -ml 1 -sow -ojf -of <base>` writes `<base>.json`. With `-f -` it reads a WAV from stdin and writes the JSON to stdout.
- **JSON shape (seen here):** `transcription[]`, one entry per word, each with `offsets.from/to` in ms, `text`, and `tokens[]` carrying `text`, `offsets`, `id`, `p` (probability) and `t_dtw`.
- **One run can serve both uses.** `-ml 60 -sow -osrt -ojf` gave the same token times as `-ml 1`, so today's .srt and a word-level JSON can come from a single pass. Words are rebuilt from tokens (a token starting with a space starts a word).
- **Status upstream:** the README labels word-level timestamps experimental and makes no accuracy claim (https://github.com/ggml-org/whisper.cpp/blob/v1.9.5/README.md). The header marks token timestamps and DTW experimental, and describes `t_dtw` as roughly when the token was output (https://github.com/ggml-org/whisper.cpp/blob/v1.9.5/include/whisper.h).
- **DTW is silently dropped by default.** `-dtw large.v3.turbo` is accepted, but flash attention is on by default and the program prints "dtw_token_timestamps is not supported with flash_attn - disabling". It needs `-nfa` as well.
- **`-nfa` changes the text slightly.** That run gave 1,160 words against 1,172, and one sentence start was 6.7 s off.

Measured against known word onsets (384 s of synthetic speech, 1,168 words):

| Setting | Median error | 90th pct | Max | Within 0.1 s |
|---|---|---|---|---|
| Default token times, word start | 0.40 s | 0.83 s | 1.7 s | 9% |
| Today's caption-line starts (`-ml 60`) | 0.26 s | 0.45 s | 1.45 s | 30% |
| `-nfa -dtw`, previous word's `t_dtw` as this word's start | 0.07 s | 0.13 s | 1.09 s | 76% |

- **Default errors bunch after pauses.** The first words after a pause get zero length at the segment start.
- **DTW gives word ends, not starts.** `t_dtw` sits at the end of a word. Read as the word's own start it is a median 0.16 s late. In the DTW row, 95% of words were within 0.25 s.
- **Cost of DTW:** 28.7 s against 23.5 s for 384.8 s of audio, about 22% slower. By extrapolation the 72-minute video goes from about 3 minutes to under 4.
- **What else improves word times:**
  - Snap every cut to a real silence edge from `silencedetect`, which the tool already runs with d=5. A second pass with a short d (about 0.3 s) is exact to the audio.
  - VAD (`--vad -vm <file>`) needs the Silero model, an 864 KB download from huggingface.co/ggml-org/whisper-vad, per the README. Its effect on word times is not verified.
  - Forced alignment with WhisperX (wav2vec2, BSD-2, Python/PyTorch). Its README says Whisper's own times are utterance-level and can be seconds off, and that words with digits or symbols get no time (https://github.com/m-bain/whisperX).
  - stable-ts can align a known script to audio and write .ass, but the repository is archived (https://github.com/jianfch/stable-ts).
- **Automatic:** all of it.
- **Needs a person:** nothing.
- **Install:** nothing for word JSON and DTW. The VAD model and WhisperX are optional.

**(b) Retakes, false starts, fillers, pauses**

No reliability figure below is measured; I had no real footage. No independent accuracy data turned up for the commercial tools either.

- **Long pauses: reliable.** They come from the audio, not from whisper.
- **Spoken cues ("let me do that again", "sorry"): reliable when transcribed.** They were in the synthetic test.
- **A sentence said two or three times: reliable to detect.** Text similarity is enough; in the test each repeat was written each time.
  - Sallie records from a full script, so each transcript span can be matched to a script sentence. That makes "which lines have several takes" close to mechanical.
  - Which take to keep is a default (the last complete one) for a person to confirm.
- **False starts mid-sentence: medium.** Whisper may tidy or merge fragments, and Claude reading the transcript catches more than string matching.
- **Filler words: low to medium.**
  - OpenAI lists keeping filler words as a job for a prompt, which implies they can be dropped (https://developers.openai.com/api/docs/guides/speech-to-text). Its prompting guide calls prompting not especially reliable.
  - The tool's current prompt contains no fillers.
  - Cutting a filler inside flowing speech needs about ±50 ms, which DTW does not guarantee. Mark them and let a person cut.
  - CrisperWhisper targets verbatim fillers and claims about 30 to 40 ms word-boundary error, but its weights are non-commercial (https://github.com/nyrahealth/CrisperWhisper).
- **Known failure: deliberate repetition for emphasis read as a retake.** A third-party guide to Descript says this (https://chasejarvis.com/blog/descript-underlord-ai/).

Open tools:
- **auto-editor** cuts by audio loudness (default threshold 0.04) or motion, pads with `--margin` (0.2 s), takes explicit `--cut`/`--keep` ranges, and exports with `--export final-cut-pro`, `resolve` or `premiere`.
  - It is public domain, written in Nim, and installs with `brew install auto-editor` (31.7.2). Its three dependencies are already on this Mac.
  - It does not detect retakes or fillers. It has a `whisper` subcommand whose purpose is not verified.
  - Sources: https://github.com/WyattBlue/auto-editor, https://auto-editor.com/installing, https://auto-editor.com/ref/options.
- **video-use** (MIT, a Claude Code skill) sends audio to ElevenLabs Scribe for word times, packs the transcript into text, and lets the model pick retakes and fillers while reading. It renders with ffmpeg using 30 ms audio fades (https://github.com/browser-use/video-use).
  - It keeps an API key in a `.env` file, which conflicts with this project's rules.
- **ButterCut** uses Claude Code plus WhisperX to write Final Cut, Premiere and Resolve XML. It needs Ruby, Python and full ffmpeg, under a PolyForm Noncommercial licence with a commercial-output exception (https://github.com/barefootford/buttercut).
- **Descript and Gling** are commercial and work from the transcript.

- **Automatic:** pauses, cue phrases, repeat detection, script matching, a proposed keep list.
- **Needs a person:** confirming which take, every filler cut, intentional repeats.
- **Install:** nothing.

**(c) Rough cut from kept ranges with ffmpeg**

- **Frame-accurate single pass (works on this build):** `-vf "select='between(t,a,b)+between(t,c,d)',setpts=N/FRAME_RATE/TB,scale=-2:720" -af "aselect='…same…',asetpts=N/SR/TB" -c:v h264_videotoolbox -b:v 3M -c:a aac`. Filter reference: https://ffmpeg.org/ffmpeg-filters.html#select_002c-aselect.
- **Add a short audio fade at each join.** video-use uses 30 ms.
- **Stream copy is not frame-accurate.** The concat demuxer's `inpoint`/`outpoint` return extra frames around the points for ordinary camera codecs (https://ffmpeg.org/ffmpeg-formats.html#concat-1). I did not time it.

Measured, 5 minutes of source with 60% kept, then scaled linearly:

| Source and output | Speed | 10-min file | 60-min file |
|---|---|---|---|
| 1080p30 H.264 to 720p, hardware encoder | 22.5x | about 27 s | about 2.7 min |
| 1080p30 H.264 to 720p, libx264 veryfast | 19.3x | about 31 s | about 3.1 min |
| 1080p30 H.264 to full 1080p, 8 Mbit | 11.1x | about 54 s | about 5.4 min |
| 2160p30 HEVC 46 Mbit to 720p, hardware decode | 5.1x | about 2 min | about 12 min |
| 2160p30 HEVC 46 Mbit to 720p, software decode | 3.8x | about 2.6 min | about 16 min |

- For 1080p H.264, `-hwaccel videotoolbox` was slower (10.7x) than software decode.
- What Sallie's camera files are is not known.
- **Automatic:** all of it.
- **Needs a person:** watching the result.
- **Install:** nothing.

**(d) Captions**

- **ffmpeg as installed cannot burn in.** `ffmpeg -filters` shows no `subtitles`, `ass` or `drawtext`, and `-buildconf` shows no libass or libfreetype. The ffmpeg docs say these need `--enable-libass` and `--enable-libfreetype` (https://ffmpeg.org/ffmpeg-filters.html#subtitles-1); that requirement is from memory, not re-read today.
- **Why:** Homebrew slimmed the formula on 2026-01-14 (https://github.com/Homebrew/homebrew-core/pull/261303).
- **`ffmpeg-full` 9.0.2 has them.** It is keg-only, so it sits beside the current ffmpeg, and `brew info` lists libass, freetype, harfbuzz and fontconfig among its 47 dependencies.
- **whisper-cli's karaoke script (`-owts`) will not run here.** It relies on drawtext.
- **What this build can do with captions:** write .srt, .ass, WebVTT and a soft `mov_text` track. Social platforms do not show soft tracks.

Word-by-word captions through .ass, once libass is present:
- whisper-cli writes no .ass, so a small converter from the JSON is needed. It fits the repo's no-packages style.
- Either one Dialogue line per word state with a colour or scale override on the active word, or karaoke tags (`\k` instant, `\kf` sweep, durations in centiseconds).
- Possible styles: any installed font (289 system fonts here), size, fill, outline and shadow colours, outline width, blur or glow, letter spacing, position and alignment, fades, movement, rotation, animated scale "pop" with `\t`, two-to-three-word uppercase chunks (https://aegisub.org/docs/latest/ass_tags/).
- Hard or not possible (my reasoning, not verified): a rounded pill behind the active word, emoji or sticker animation, CapCut-style template packs.

No-install route, in Final Cut 12.4:
- **Generate Captions** makes subtitle title clips with animation styles None, Fade, Scale, Highlight and Fill, animated by character, word or line, with a 9:16 safe-area option. It needs Apple silicon and is U.S. English only (https://support.apple.com/guide/final-cut-pro/generate-subtitles-automatically-verd6d52c4e8/mac).
- **Our own .srt imports** via File > Import > Closed Captions, and can be duplicated to styleable subtitles (https://support.apple.com/guide/final-cut-pro/import-closed-captions-ver4185ef95a/mac).
- **Burn-in at export:** many share destinations offer it (https://support.apple.com/guide/final-cut-pro/export-captions-ver245c7581b/mac).

- **Automatic:** .srt and .ass files; burn-in only after `ffmpeg-full`.
- **Needs a person:** choosing the look once (font, colours, position), fixing misheard words, or operating Final Cut.
- **Install:** `ffmpeg-full` for automated burn-in; nothing for the Final Cut route.

**(e) What sound and words cannot judge, and how far stills go**

- **Cannot be judged:** which take looks better, framing, focus, lighting, eye line, gestures, something wrong in the shot, and delivery energy as seen.
- **Partial proxies from audio (all in this build):** loudness and dynamics (`ebur128`, `astats`), and pace as words per second from word times.
- **Numeric picture checks in this build:** `blurdetect`, `signalstats`, `scdet`, `freezedetect`, `blackdetect`, `thumbnail`, `tile` for contact sheets.
- **What a still closes:** framing, headroom, exposure, obvious blur, whether she faces the camera at that instant, background problems, and a side-by-side of one frame per take.
- **What a still does not close:** motion, a glance away between samples, performance. "Which take has more energy" stays with a person.
- **Precedent:** video-use shows the model a composite of filmstrip, waveform and word labels on request, not the video.

Claude's image limits (https://platform.claude.com/docs/en/build-with-claude/vision):
- Formats are JPEG, PNG, GIF and WebP, and only the first frame of an animation is used.
- Cost is ⌈w/28⌉×⌈h/28⌉ tokens: a 1280×720 still is 1,196, a 640×360 still is 299, and a 3×3 sheet at 1568×882 is 1,792.
- 20 images per message on claude.ai, and 100 or 600 per API request.
- Claude will not name people from faces, so "this is Sallie" comes from a file name or a person.

Where stills reach Claude:
- A Claude Code session on this Mac (`claude` 2.1.296 is installed).
- The BRIMM Ops page, only if republished with `sample: {images: true}`. Viewers are then asked again for consent, and each call is capped at 256 KiB of text. Source: `/private/tmp/claude-501/bundled-skills/2.1.295/c2e0ae6275dc712fb7de08d333c80a1f/artifact-capabilities/0.2.76/sample.d.ts`. Its image count and size caps are not verified.
- The page cannot read the Mac's disk, so a person would have to add the stills.

- **Automatic:** extracting stills and sheets, numeric checks, Claude's notes on them.
- **Needs a person:** the final take choice.
- **Install:** nothing.

**(f) Wide to vertical, following the speaker**

- **What it needs:** a face position per sampled frame, a smoothed crop path (dead zone, speed limit, reset at cuts), then a crop.
- **ffmpeg's crop can follow a path.** `ffmpeg -h filter=crop` shows x, y, w, h take expressions and runtime commands.
- **This Mac without an install: yes, by writing a Swift script.** Vision's `VNDetectFaceRectanglesRequest` (revision 3) ran from command-line Swift 6.4 at 6.5 ms per 1280×720 frame on a blank test frame. It is not tested on real footage.
  - At 5 samples a second, an hour is 18,000 frames, about 2 minutes plus decoding.
  - Human-rectangle and saliency requests also ran.
- **Not available here:** ffmpeg has no face or DNN filters, and Python has no OpenCV or MediaPipe.
- **Final Cut's Smart Conform** reframes clips for vertical or square by analysing faces and areas of interest, then leaves manual Transform adjustment (https://support.apple.com/guide/final-cut-pro/ver8bad7adc6/mac). Whether it moves within a clip or sets one position per clip is not stated.
- **Solo, seated speaker:** one fixed crop per kept range, from the median face position, is likely enough.
- **Two people:** it needs to know who is speaking (mouth movement or speaker labels). Google's AutoFlip authors name speaker detection as a gap (https://research.google/blog/autoflip-an-open-source-framework-for-intelligent-video-reframing/). Open skills that claim it (wjs-reframing-video with MediaPipe, AutoClip) are not verified beyond their listings.
- **Automatic:** detection, path and crop for a solo shot.
- **Needs a person:** checking framing, and interviews.
- **Install:** nothing for the Swift or Final Cut routes; MediaPipe or OpenCV only for the open tools.

**(g) B-roll folder searchable by content**

- **What it takes:** one index file (JSON or CSV) beside the clips, with one row per clip.
  - From ffprobe: path, duration, size, orientation, frame rate.
  - From Claude, once: a description and tags from 2 to 3 stills, about 1,200 tokens per 720p still, or about 600 for a three-frame strip.
  - By hand: who is in it, where, rights and source, usable in/out.
- **Search:** Claude reads the index as text and matches clips to transcript passages, or a plain keyword search does.
- **File names and a hand list alone work** for a small library. Stills described once scale better and cost one pass per new clip.
- **How a cut list points to a clip:** an entry such as `{over: [first words, last words, start, end], source: "broll/…mov", in, out, audio: "keep hers", why}`. Anchoring to words as well as times, as BRIMM Ops clips already do, survives a re-cut.
- **In an ffmpeg preview:** a cutaway is an `overlay` with `enable=between(t,…)`; the filter is in this build.
- **In Final Cut:** it would be a connected clip above the main storyline. The FCPXML details are not verified here.
- **Final Cut 12 has its own Visual Search and Transcript Search** on Apple silicon (https://support.apple.com/102825). One reviewer found them unreliable (https://larryjordan.com/articles/apples-improved-search-in-final-cut-pro-12-is-very-unreliable).
- **Automatic:** technical fields, stills, descriptions, suggested placements.
- **Needs a person:** shooting or collecting the clips, dropping them in the folder, naming people and places, clearing rights, approving each placement.
- **Install:** nothing.

**Installs, in one place**

Any install or launch-agent change needs Jason's yes under the project rules.
- **Nothing needed:** word-level JSON with DTW, silence passes, rough cuts, stills and sheets, face detection via Swift, the Final Cut routes.
- **`ffmpeg-full`:** only for automated burned-in or animated .ass captions.
- **Optional:** the VAD model (864 KB), auto-editor, WhisperX.