# Presets for Sallie's video: styles, settings, and how each one gets applied (draft)

Written 2026-10-13 for Jason Ogden. Research only. Nothing in the repo was changed. Final Cut Pro, Motion and Compressor were not opened.

Jason's question: "can you research popular video editing styles and settings that could be grouped into different Presets?"

## Read this first

**The short answer.** Yes. The popular styles break down into the same 45 settings, in seven groups. Eight presets cover the styles that are popular now and that suit a business coach: **Clean, Full episode, Conversation, Teaching, Magazine, Bold captions, Moody, As filmed**. Build Clean, Full episode and Conversation first (Part 5).

**Five things the research turned up that shape everything below.**

1. **The field has left the loud caption look.** In still frames dated 1 to 13 October 2026, 9 of 11 business educators use small white captions in lower or sentence case, one to four words, soft shadow, no outline, no second colour. Alex Hormozi is one of the nine [O1]. Sallie's own Shorts still use capitals, a black outline, neon green or red words and an emoji, in at least three variants in two weeks [O2]. So "bold captions" is a preset here, but a quiet one, and not the default.
2. **A preset has three layers in every tool on the market**: a brand kit (colours, typefaces, logo), a named caption style, and a bundle that picks a caption style and switches other things on or off. The words and media of one video are never in the preset [V2][V3][V7]. The presets below keep that split.
3. **The Final Cut file points at the original video, not at the rough cut** [R4]. So a look, a loudness fix or a zoom the tool makes with ffmpeg never shows up in Final Cut Pro. Each preset needs two recipes: one for the tool's own video files and one for the Final Cut file. They will be close, not identical.
4. **This Mac's ffmpeg can cut, zoom, colour and level sound. It cannot draw text** [M1]. Words in the picture have four possible routes (Part 4). One was tried here on a made-up video and works: caption pictures drawn by a short Swift script and laid over by ffmpeg [M6].
5. **Most numbers for short video are tool makers' rules of thumb.** What is measured: the length of a natural pause, about six minutes of attention for teaching video, and the 3 second and 30 second points the platforms count. What is official: upload settings, Meta's safe zone for ads, broadcast caption rules. Everything else is marked below.

**Limits.** No video was watched and no sound was heard by any researcher, so pace, caption movement and music are not observed for anyone. Caption sizes and positions in the field are estimates from scaled still frames. None of the tool's cuts, crops or files has met real footage yet [R1]. Every number in a preset is a starting value to try on one of Sallie's own recordings.

**How values are marked.**

| Mark | Meaning |
|---|---|
| today | What the tool does now |
| official | A platform's, Apple's or a standards body's own page |
| measured | A study that says how it counted |
| seen | Observed in still frames, 1 to 13 October 2026 |
| rule of thumb | A tool maker's or one creator's advice, not measured |
| guess | No source. A starting value to test |

Sources are listed at the end and cited by key, like [P11].

**What I did for this draft.** Read the audience report in full and the other seven researchers' findings as they were passed on (their report files were never written). Re-read the cited lines of `transcribe/cuts.js`, `reframe.js`, `fcpxml.js` and the README. Re-worked the arithmetic (contrast, crop widths, safe-zone pixels, file sizes). Fetched four pages myself today: the two typeface licences [V18], Apple's page on turning captions into subtitles [A3], and LinkedIn's video specification page [P17].

---

## Part 1. What a preset holds

Seven groups, 45 settings. "Default" is the house default: the value a new preset starts from.

### A. Cut and pacing

| # | Setting | Values it can take | Default | Where the range comes from |
|---|---|---|---|---|
| A1 | Mistakes taken out | all (retakes, false starts, spoken cues) / retakes and cues only / none | all | today [R1]. No source says which to keep for a lo-fi style: that choice is a guess |
| A2 | A pause counts as long from | 0.4 to 2.0 s | 1.5 s | today [R2]. measured: a natural pause is about 0.5 s; long pauses cluster near 1.5 s; pauses over 2 s are 2.8% of unscripted pauses [S1]. rule of thumb: Submagic's three paces cut silences from 0.6 s, 0.2 s and 0.1 s [V2]; 0.25 to 0.4 s for Shorts [V4]; 0.3 to 0.5 s for natural speech [V8] |
| A3 | A long pause is shortened to | 0.2 to 0.6 s | 0.4 s (0.2 s kept each side) | today [R2]. measured: natural pause 0.45 to 0.5 s [S1]. rule of thumb: 0.1 to 0.2 s left for Shorts [V4]. Floor of 0.2 s: the tool's word times are off by a tenth to a third of a second [R1] |
| A4 | What counts as silence | quieter than -30 to -40 dB, for 0.25 to 0.5 s | -35 dB for 0.3 s | today [R2]. Inside the makers' ranges [V4][V8] |
| A5 | The join | plain cut / Flow transition (always 6 frames, Final Cut only) / cross dissolve | plain cut | official: Apple's Flow is made for the join left when a pause is cut from an interview [A5] |
| A6 | Speed | 100 to 110% | 100% | measured: students lost little at 1.5 to 2 times, but they chose the speed themselves [S3]; 76% of edX sessions ran at normal speed [S2]. Pitch is kept by default in Final Cut [A8]. "110 to 125% goes unnoticed" is a vendor claim from a search summary: not verified |
| A7 | Check markers | none / at 3 s / at 30 s / both | 3 s on clips, 30 s on episodes | official: Instagram counts who is still watching at 3 s [P15]; YouTube counts 30 s [P5] |
| A8 | B-roll markers a minute | 0 to 6 | 0 | rule of thumb: three to six cutaways of 2 to 4 s in a 60 s clip [V3]. The tool has no b-roll to add, only a marker |

### B. Framing and zooms

| # | Setting | Values it can take | Default | Where the range comes from |
|---|---|---|---|---|
| B1 | Layout of the frame | as recorded / fill, with the larger face in the middle / split (two pictures stacked) / fit with bars | fill for upright, as recorded for 16:9 | today [R3]. OpusClip's layouts are Fill, Fit, Split, Three, Four, Screenshare, Gameplay [V3]. official: Instagram shows bordered Reels less [P13], so "fit with bars" is listed only to rule it out |
| B2 | Base scale | 100 to 112% | 100% | computed from the tool's crop: a 3840 x 2160 source gives a crop 1214 px wide, shown at 89%, so up to 112% costs no sharpness. A 1920 x 1080 source gives 606 px, already blown up to 178% [R3] |
| B3 | Zoom | none / punch-in on every other kept stretch / slow push | none | Kinds as AutoCut offers them [V8]; Apple's pan and zoom is the slow push [A6]. rule of thumb: change framing only at the start of a sentence [V10] |
| B4 | Zoom amount | 104 to 120% | 108% where a zoom is used | rule of thumb: 110 to 115% [V9]; 10 to 20% in the old Hormozi look [V1]; 100 to 120% (Submagic, search summary only: not verified). 108% is the audience report's proposal: guess |
| B5 | Shortest hold before the framing changes | 3 to 12 s | 5 s where a zoom is used | no source for 3 s or 5 s: guess. One small study says break any hold over about 12 s in a podcast clip [S5] |
| B6 | Split edit (sound leads or trails the picture) | 0 / 0.5 s / 2 s | 0 | rule of thumb: 0.5 s in dialogue, about 2 s into a new section [V11]. Needs two pictures. The format carries it [M2] |

### C. Captions

| # | Setting | Values it can take | Default | Where the range comes from |
|---|---|---|---|---|
| C1 | Words in the picture | none / phrase / phrase on a plate / fill that follows the voice / bold chunk / one word | phrase on upright, none on 16:9 | The styles tools sell [A2][V3][V7]. seen: no long video in the field burns captions in [O1] |
| C2 | Caption file (.srt) | yes / no | yes, always | official: captions are required for recorded video (WCAG 1.2.2) [W3]; YouTube and LinkedIn take an .srt [P4][P19]. today: the tool writes `<name>.rough-cut.srt` [R1] |
| C3 | Typeface and weight | any face installed on the Mac | Montserrat SemiBold (600) | Her site's text face [O2]. Free under the SIL Open Font License 1.1 [V18]. Not on this Mac [M7], so it needs installing. Stand-in already on this Mac: Avenir Next Demi Bold (guess) |
| C4 | Case | sentence / lower / capitals | sentence | seen: 9 of 11 [O1]. official: mixed case, capitals only for shouting (DCMP) [W5] |
| C5 | Letter size, as a share of the frame's height | 2.5 to 10% | 3.6% (69 px on a 1920 frame) | The sources disagree by a factor of four: see "Where the reports disagree". seen: 3 to 4% [O1]. Final Cut's Subtitle default is 4.6% [M3]. rule of thumb: 2.5 to 3.1% [V3], 2.6 to 5.2% and 7 to 10% [V4] |
| C6 | Words at once, and lines | 1 to 8 words; 1 or 2 lines | 2 to 4 words, 1 line, 20 characters at most | seen: 1 to 4, mostly 2 or 3 [O1]. rule of thumb: 3 to 5 [V4], 5 to 8 [V3]. official for wide video: 42 characters a line, 2 lines [W4] |
| C7 | Shortest time on screen | 0.83 to 1.33 s | 0.83 s | official: Netflix five sixths of a second, 7 s at most [W4]; DCMP one and a third seconds [W5] |
| C8 | Fill colour | any | white `#FFFFFF` | seen: white, except where a box sits behind the words [O1]. official: white (DCMP) [W5] |
| C9 | Edge | none / soft shadow / outline | soft shadow: black at 65%, blur 10 px on a 1920 frame, no offset | seen: soft shadow; no outline in any frame but Simon Sinek's [O1]. The numbers are rules of thumb and differ: one vendor gives 2 px away, 40%, blur 4 px [V4][V5]; 1 to 3 px away at 30 to 50% [V4]; outline 3 to 4 px for white subtitles and 5 to 8 px for bold capitals [V4] |
| C10 | Plate (a box behind the words) | none / black at 70 to 80% / a solid brand box | none | rule of thumb: black at 70 to 80% [V4]. seen: a white rounded box with dark text where the picture is busy [O1]. Final Cut's Subtitle title has Background Color, Opacity and Corner Radius [M3] |
| C11 | Accent on a word | none / key word in a colour / key word on a box / spoken word lit | none | seen: no second colour in any running caption but Ali Abdaal's [O1]. rule of thumb: one key word a sentence, yellow `#F7C204` [V2][V4]. official: contrast 4.5 to 1, or 3 to 1 for large text [W1] |
| C12 | Movement | None / Fade / Scale / Highlight / Fill, by character, word, line or all | None | official: these are Final Cut's own names [A2]. official: no more than 3 flashes a second [W3]. A style that follows each word needs better word times than the tool has [R1] |
| C13 | Position on an upright frame | centre 50 to 65% of the way down; a line up to 70% of the width | centre 63% down, bottom edge no lower than 65%, line no wider than 70% | official: Meta says keep clear of the top 14%, bottom 35% and 6% each side (written for ads) [P11]. Final Cut's "Vertical Social Media Safe" holds text between 15% down and 35% up from the bottom [M3]. seen: 58 to 75% down [O1]. The 70% width is a working figure: guess |
| C14 | Emoji | off / on | off | seen: none in the 11 peers' frames [O1]. rule of thumb: at most one a line [V4] |

### D. Titles and graphics

| # | Setting | Values it can take | Default | Where the range comes from |
|---|---|---|---|---|
| D1 | Hook headline at the start | none / a line of text, with its face, size, seconds and place | none, unless a hook line is given for the video | official: Instagram says opening text in the first frame works as a headline [P14]. One small study: a title banner from 0 to about 5.5 s [S5]. Place: between 14% and 30% down, inside Meta's zone [P11]. Sizes of 5 to 6.5%: guess |
| D2 | Name title | none / name and role, for some seconds | none | No source for the seconds: 4 s is a guess. A Basic Lower Third title ships inside Final Cut Pro [M2] |
| D3 | Card or panel | none / one-word card / steps panel | none | seen: Sallie's own side panel (8 Oct) and lower title (28 Sep) [O2]; Ali Abdaal's and Dan Martell's layouts [O1]. All timings: guess |
| D4 | Logo | none / small, top right | none until there is a logo file | seen: Mel Robbins, Amy Porterfield, Emma Grede, Codie Sanchez [O1]. Inside Meta's zone [P11] |
| D5 | Chapter markers | none / at each new topic | none on clips, on for episodes | measured: about 6 minutes of attention whatever the length [S2]. The format has a chapter marker [M2]. Where a topic changes is for a person or the page to say |

### E. Look

| # | Setting | Values it can take | Default | Where the range comes from |
|---|---|---|---|---|
| E1 | Look | Natural / Clean / Bright / Warm / Moody / Film / Black and white / Punchy | Natural | Final Cut Pro 12.4 ships 20 Color Board presets, 71 Color Grading Presets and 9 Styles [M4]. Which looks are popular: no data found, not verified |
| E2 | Strength | 0 to 100% | 50% where a look is used | Apple's own preset values are strong (Clean Neutral holds Exposure -69 and Highlights -100) [M4], so start at part strength. A cap of 50% under 720 lines and 75% under 1080: guess. Zoom files are often 640 x 360 [V16] |
| E3 | Vignette (darker corners) | 0 to 15% | 0 | no source: guess |

The looks, and Final Cut's nearest ready-made match. The matches by name come from the app's own folders [M4]. They were read there, not seen on screen. No recipe below has been judged on real footage.

| Look | Final Cut's nearest | Starting recipe for the tool (all guess) |
|---|---|---|
| Natural | none | No change |
| Clean | Clean Neutral; Clean Whites with Lifted Blacks | no source |
| Bright | Brighten (Color Board); Fresh Light (Style) | no source |
| Warm | Warm (Color Board and Style); Desaturated Warmth; Warm Dusk with Low Contrast | A slightly warmer white balance. No numbers in any source |
| Moody | Low Exposure with Blue Hues; Deep Mids with High Contrast; Cool Blacks with Strong Contrast | Exposure down a quarter stop, contrast up 5 to 8%, saturation down 5 to 10%, slightly warm white balance (the audience report's proposal) |
| Film | Vintage Red with Soft Grain; Analog (Style) | no source |
| Black and white | B&W with High Contrast; Noir (Style) | no source |
| Punchy | Vibrant (Style); Contrast (Color Board) | no source |

### F. Sound

| # | Setting | Values it can take | Default | Where the range comes from |
|---|---|---|---|---|
| F1 | Loudness | -14 LUFS with true peak -1 dB / -16 LUFS with true peak -1 dB | -14, -1 | official for sound platforms only: Spotify -14 and -1 [P24]; Apple Podcasts -16 give or take 1, and -1 [A19]. No video platform publishes a number. YouTube's -14 is repeated by third parties [V25][P9]. ffmpeg's loudnorm defaults to -24, so the target must be written out; a two-pass run here measured -14.0 [M1] |
| F2 | Voice clean-up | off / light / full | light | light: cut below 80 Hz, then level. full adds noise reduction, a de-esser at 5 to 8 kHz, a compressor at 3:1 taking 2 to 4 dB off peaks, and a limiter at -1 dB. rule of thumb from one guide written for sung vocals [V12]. Final Cut's Voice Over Enhancement is the same chain [M5] |
| F3 | Music | none / a bed, some dB under the voice | none | official: at least 20 dB under speech (W3C, an accessibility floor) [W2]. rule of thumb: 12 to 18 dB [V13]. The best-measured style uses none [S5]. Licences differ by platform [V15] |
| F4 | Sound effects | off / up to 3 to 5 moments, at least 6 dB under the voice | off | rule of thumb [V14]. None in the measured podcast clips [S5] |

### G. Shape, length and delivery

| # | Setting | Values it can take | Default | Where the range comes from |
|---|---|---|---|---|
| G1 | Shape | 16:9 (1920 x 1080) / 9:16 (1080 x 1920) / as recorded | set by the preset | official [P1][P10]. today: the tool makes both [R1] |
| G2 | Length | a range to aim for, and a cap | aim 30 to 60 s, cap 90 s | official: Instagram says 15 to 60 s suits most formats [P14]; a boosted Reel is 90 s at most (search summary only) [P16]. measured on brand accounts: 45 to 60 s did best on Reels; 120 to 180 s did best on LinkedIn pages [S6]. today: 15 to 90 s [R3] |
| G3 | Story parts | off / parts of 60 s at most, 7 parts at most | off | official: 60 s a Story through the API [P10]. measured: over 75% of viewers stay through 7 parts [S7]. today: cut on a pause [R3] |
| G4 | Goes to | Reels / Stories / Shorts / YouTube / LinkedIn | set by the preset | The places Sallie posts |
| G5 | File | standard (Part 3) / standard plus a podcast sound file | standard | Part 3 |

---

## Part 2. The presets

### 2.1 At a glance

| Preset | In one line | Trend | Fit for Sallie |
|---|---|---|---|
| **Clean** | Small white captions in sentence case, natural colour, light cuts | Rising. The main look in her field this month | High. The house default |
| **Full episode** | The whole show in 16:9: calm cuts, a caption file, nothing drawn on the picture | Rising. Podcasts on YouTube | High |
| **Conversation** | An interview clip: calm, no zoom, captions on a plate | Rising. The best-measured style | High, with one limit: the tool does not know who is talking |
| **Teaching** | Numbered steps on screen while she explains | Steady | High. The graphics are made by hand |
| **Magazine** | A serif headline in her brand's green and cream | Steady, a premium niche | High once it is designed |
| **Bold captions** | Big capitals, one accent word, for the hook | Fading in her field. Still the default in tool guides | Medium. Only in a quiet form |
| **Moody** | Clean, with a darker and warmer grade | No trend data found | Medium. Only a mild version |
| **As filmed** | Trimmed and levelled, nothing added | Rising, by the platforms' own word | High for Stories and LinkedIn |

### 2.2 Each preset: what it is for, who is known for it, the evidence, the risk

**Clean** (the house default)
- **Pick it for:** everyday solo clips. When in doubt, this one.
- **Platforms:** Reels, Shorts, LinkedIn.
- **Known for it:** in October 2026 frames, Alex Hormozi, Amy Porterfield, Mel Robbins, The Diary of a CEO, and Leila Hormozi in half her frames [O1]. One tool maker's guide ties this look to B2B, education and professional brands [V4][V5].
- **Evidence and direction:** rising. 9 of 11 business educators in frames dated 1 to 13 October 2026 [O1]. Two second-hand summaries say Hormozi cut effects that do not help the lesson in 2026 [S15]. MrBeast said in March 2024 he had slowed his cutting; one count found 38 cuts a minute in 2023 and 23 in 2024 [S4].
- **Risk:** small white text can vanish on a bright picture; the shadow has to do the work. The sizes are estimates from frames. No independent test shows any caption style holds viewers better than another [O1].

**Full episode**
- **Pick it for:** the long YouTube episode, solo or interview.
- **Platforms:** YouTube. The same sound can become the podcast file.
- **Known for it:** video podcasts such as The Diary of a CEO and Mel Robbins's show [O1].
- **Evidence and direction:** rising. YouTube reported over 1 billion monthly viewers of podcast content as of January 2025 [P8]. No long video seen in the field burns captions in [O1]. An informal talking head at a desk held viewers about twice as long as a studio recording (one pair of courses) [S2].
- **Risk:** viewers give a teaching video about 6 minutes whatever its length [S2], so the first 30 seconds and the chapters matter more than polish. The cut suggestions have never met real speech [R1].

**Conversation**
- **Pick it for:** a clip cut from an interview.
- **Platforms:** Reels, Shorts, LinkedIn.
- **Known for it:** The Diary of a CEO, Mel Robbins.
- **Evidence and direction:** rising, and the best measured. A frame-by-frame study of three upright Diary of a CEO clips found a hard cut every 4.1 to 6.3 s, no music, no sound effects, and little or no b-roll [S5]. It is a third-party study of three clips.
- **Risk:** the tool crops on the larger face and does not know who is talking [R3]. A cut can land inside the guest's answer. That study's captions (capitals, heavy outline, a colour for each speaker) do not match this month's frames, so its numbers are not copied here.

**Teaching**
- **Pick it for:** a framework or a list, like her "5 constraints" video.
- **Platforms:** Reels, Shorts, LinkedIn, and sections of the YouTube episode.
- **Known for it:** Ali Abdaal, Dan Martell (speaker above, whiteboard below), Codie Sanchez's long videos [O1].
- **Evidence and direction:** steady. Educational videos had the highest engagement across 13 million business videos [S8]. LinkedIn staff say the feed favours expert advice (reported by Buffer) [S12].
- **Risk:** the steps on screen are content, written for each video. The panel and cards have to be designed once in Motion. Her crop is already tight, so a panel has little room on an upright frame [O2].

**Magazine** (the audience report calls it "Editorial")
- **Pick it for:** signature pieces, show openers, a quote worth framing.
- **Platforms:** Reels, Shorts.
- **Known for it:** Codie Sanchez, Marie Forleo and Emma Grede put serif type on their Shorts [O1]. The Captions app sells styles named Magazine, Byline and Elevate [V7].
- **Evidence and direction:** steady. Her nearest peers' sites use the same recipe she does: a high-contrast serif headline over a clean sans [O1]. No page gives numbers for the style, so it must be designed, not copied.
- **Risk:** Bodoni's thin strokes break up at small sizes on a phone. So the serif is for titles and single words at 5% of the frame's height or more, and Montserrat carries anything that runs.

**Bold captions**
- **Pick it for:** testing a hook on people who do not know her. Use it for the first 3 seconds, or for a whole trial Reel, then go back to Clean.
- **Platforms:** Reels, Shorts.
- **Known for it:** Alex Hormozi's earlier look, as tool makers still describe it [V1]. Tools still sell it by his name: Submagic's Hormozi 1 to 5, OpusClip's Mozi and Beasty [V2][V3]. Simon Sinek's clips still use capitals with an outline [O1].
- **Evidence and direction:** fading in her field. Word-by-word capitals are still the default in 2026 tool guides, but with one accent colour and less bounce [V4][V22]. One vendor calls the yellow-and-emoji look saturated and unfit for consulting (opinion, no study) [V6]. Hormozi's own four newest sampled Shorts do not use it [O1].
- **Risk:** it can read as marketing-guru content [V6]. All capitals go against the caption rule of mixed case [W5]. A word-by-word version needs word times better than the tool's tenth to a third of a second [R1], so this preset shows two or three words at a time and never one.

**Moody**
- **Pick it for:** a reflective or personal piece.
- **Platforms:** Reels, Shorts.
- **Known for it:** Tom Noske (as a vendor describes him) [V1]. The dark sets of The Diary of a CEO and Mel Robbins [O1]. The Captions app's Film and Pulse styles [V7].
- **Evidence and direction:** no trend data found. Vendor descriptions only.
- **Risk:** the shows that look dark are dark in the room. A bright room graded dark looks false and is hard to see on a phone outdoors (the audience report's judgement). A strong grade falls apart on a small or soft source. The full style needs filmed b-roll and a fast lens; only the grade travels to any video.

**As filmed** (the market's words are "raw" or "lo-fi")
- **Pick it for:** a quick thought on a phone.
- **Platforms:** Stories, LinkedIn.
- **Known for it:** no single creator. The platforms themselves promote it.
- **Evidence and direction:** rising. TikTok says lo-fi video does well and a phone is the right quality (2024) [P21]. LinkedIn says simple selfie-style video lifts engagement by 11% (its own figure, no method) [P20]. In a HubSpot survey 63% preferred relatable video to polished video, with Gen Z the other way at 52 to 48 [S9]. Hootsuite's 2026 trends report says over-editing is out [S10].
- **Risk:** the sound still has to be clear. With no words in the picture, a viewer with the sound off gets nothing unless the platform's own captions are switched on. Next to a premium brand it can look careless if it is the only style used.

### 2.3 The full rows

Every preset has a value for every setting. The notes under each table say where the values come from.

#### A. Cut and pacing

| Setting | Clean | Full episode | Conversation | Teaching | Magazine | Bold captions | Moody | As filmed |
|---|---|---|---|---|---|---|---|---|
| A1 Mistakes taken out | all | all | all | all | all | all | all | retakes and cues only |
| A2 Pause counts as long from | 1.5 s | 2.0 s | 2.0 s | 1.5 s | 1.5 s | 0.8 s | 1.5 s | 2.0 s |
| A3 Shortened to | 0.4 s | 0.6 s | 0.6 s | 0.4 s | 0.5 s | 0.3 s | 0.4 s | 0.6 s |
| A4 Silence is | -35 dB, 0.3 s | -35 dB, 0.3 s | -35 dB, 0.3 s | -35 dB, 0.3 s | -35 dB, 0.3 s | -35 dB, 0.3 s | -35 dB, 0.3 s | -35 dB, 0.3 s |
| A5 The join | plain cut | Flow in Final Cut; plain cut in the tool's own file | plain cut | plain cut | plain cut | plain cut | plain cut | plain cut |
| A6 Speed | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| A7 Check markers | 3 s | 30 s | 3 s | 3 s | 3 s | 3 s | 3 s | 3 s |
| A8 B-roll markers a minute | 0 | 0 | 0 | 0 | 0 | 2 | 3 | 0 |

- **A1.** "all" is today [R1]. "Retakes and cues only" for As filmed is a guess: small stumbles are said to signal a real person [S10], but no source says which to leave in.
- **A2, A3.** 1.5 s and 0.4 s are today [R2]. 2.0 s and 0.6 s are the pacing researcher's proposal for calm speech, leaning on measured pauses: natural is about 0.5 s and only 2.8% of unscripted pauses pass 2 s [S1]. 0.8 s and 0.3 s are the same researcher's "brisk" proposal; Submagic's natural pace cuts from 0.6 s [V2]. 0.5 s for Magazine is the measured natural pause [S1]. All untested on her speech.
- **A4.** today [R2].
- **A5.** Flow is Apple's own tool for interview joins [A5]. Whether Final Cut accepts a Flow transition written by hand in the file is not verified. The Diary of a CEO clips use hard cuts [S5].
- **A6.** No source ties a speed to a style. 100% is the safe value [S2].
- **A7.** [P15][P5].
- **A8.** 2 and 3 are below the rule of thumb of 3 to 6 [V3], chosen low because there is no b-roll library: guess.

#### B. Framing and zooms

| Setting | Clean | Full episode | Conversation | Teaching | Magazine | Bold captions | Moody | As filmed |
|---|---|---|---|---|---|---|---|---|
| B1 Layout | fill, larger face in the middle | as recorded | fill, larger face in the middle (split by hand when there are two camera pictures) | fill | fill | fill | fill | as recorded |
| B2 Base scale | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| B3 Zoom | punch-in on every other kept stretch, only when the source has 2160 lines or more | none | none | none | none | punch-in on every other kept stretch, same condition | none | none |
| B4 Zoom amount | 108% | not used | not used | not used | not used | 112% | not used | not used |
| B5 Shortest hold | 5 s | not used | not used | not used | not used | 3 s | not used | not used |
| B6 Split edit | 0 | 0 (0.5 s by hand in an interview) | 0.5 s, by hand, when there are two pictures | 0 | 0 | 0 | 0 | 0 |

- **B1.** today [R3]. Split is OpusClip's layout for two speakers [V3]; the tool cannot make it.
- **B2.** 100% everywhere, because her upright crop is already about twice as tight as the field's [O2]. One report proposed a tighter crop for Moody; see "Where the reports disagree".
- **B3, B4.** 108% is the audience report's proposal (guess). 112% is the most a 4K source allows with no loss, and sits inside the 110 to 115% rule of thumb [R3][V9]. The 2160-line condition is computed: from a 1080-line source the crop is already at 178% [R3].
- **B5.** guess. No source gives 3 s or 5 s.
- **B6.** 0.5 s is a rule of thumb [V11]. The tool does not know who is speaking [R3].

#### C. Captions

| Setting | Clean | Full episode | Conversation | Teaching | Magazine | Bold captions | Moody | As filmed |
|---|---|---|---|---|---|---|---|---|
| C1 Words in the picture | phrase | none | phrase on a plate | phrase | phrase | bold chunk | phrase | none |
| C2 Caption file | yes | yes | yes | yes | yes | yes | yes | yes |
| C3 Typeface | Montserrat SemiBold 600 | none drawn | Montserrat SemiBold 600 | Montserrat SemiBold 600 | Montserrat SemiBold 600 | Montserrat ExtraBold 800 | Montserrat SemiBold 600 | none drawn |
| C4 Case | sentence | not used | sentence | sentence | sentence | capitals | sentence | not used |
| C5 Letter size | 3.6% (69 px) | not used | 3.6% | 3.4% (65 px) | 3.6% | 5% (96 px) | 3.6% | not used |
| C6 Words and lines | 2 to 4 words, 1 line, 20 characters | file only: 2 lines of 42 characters | 2 to 4 words, 1 line | 2 to 4 words, 1 line | 2 to 4 words, 1 line | 2 to 3 words, 1 line | 2 to 4 words, 1 line | file only: 2 lines of 42 characters |
| C7 Shortest time | 0.83 s | 0.83 s in the file | 0.83 s | 0.83 s | 0.83 s | 0.83 s | 0.83 s | 0.83 s in the file |
| C8 Fill | white `#FFFFFF` | not used | deep green `#173B32` | white | cream `#F4EFE6` | white | white | not used |
| C9 Edge | soft shadow: black 65%, blur 10 px, no offset | not used | none | soft shadow, same | soft shadow, same | soft shadow, same | soft shadow, same | not used |
| C10 Plate | none | not used | solid cream `#F4EFE6`, rounded corners | none | none | none | none | not used |
| C11 Accent | none | not used | none | none | none | the one stressed word on a lavender `#B9A6D8` box with deep green text | none | not used |
| C12 Movement | None | not used | None | None | Fade, by line | None | None | not used |
| C13 Position | centre 63% down, bottom edge at 65% or higher, line 70% of the width at most | not used | same | same | same | same | same | not used |
| C14 Emoji | off | off | off | off | off | off | off | off |

- **C1.** Clean, Teaching, Magazine and Moody follow what the field shows [O1]. Full episode: no long video seen burns captions in [O1]. Conversation's plate follows Mel Robbins's frames [O1]. As filmed adds nothing; on Instagram the Captions sticker can be added by hand when posting [P16].
- **C3.** Her site's face [O2]. Weights 600 and 800 are the audience report's proposal: guess.
- **C5.** 3.6%, 3.4% and 5% are the audience report's proposals, inside what the frames show (3 to 4%) [O1]. To be tried on a phone.
- **C6.** seen [O1]. The 42 characters are Netflix's rule for a caption file [W4]. Today the tool writes lines of up to 60 characters [R2].
- **C7.** Netflix's floor [W4]. Three words at 160 words a minute last about 1.1 s (my arithmetic), so DCMP's one and a third seconds [W5] cannot be met by short phrases.
- **C8, C10, C11.** Brand colours from her site [O2]. Contrast, worked out with the WCAG formula and re-checked today: cream on deep green 10.7 to 1; lavender against deep green 5.6 to 1; lavender on white 2.2 to 1, which fails [W1]. So lavender is only ever a box behind dark text or an accent on a dark ground. The plate's corner radius and padding have no source: start at a 16 px radius and 20 px of padding on a 1080 x 1920 frame (guess).
- **C9.** The kind is seen [O1]. The numbers are the audience report's proposal: guess.
- **C11.** The pink box in one of Leila Hormozi's frames is the model for Bold [O1].
- **C12.** One vendor suggests fades for premium services (opinion) [V6]. Nobody's caption movement was observed.
- **C13.** Meta's line [P11]. Sallie's upright-capitals look sits at about 78 to 83% down today, inside the zone Meta says to keep clear [O2].

#### D. Titles and graphics

| Setting | Clean | Full episode | Conversation | Teaching | Magazine | Bold captions | Moody | As filmed |
|---|---|---|---|---|---|---|---|---|
| D1 Hook headline | only when a hook line is given: Montserrat Bold 700, 5%, 3 s, between 14% and 30% down | none | none | the number and name of the framework: small Montserrat capitals (2.5%) over one Bodoni Moda word (6%), 3 s, same place | Bodoni Moda SemiBold 600, 6%, 2 lines and 8 words at most, cream on a deep green band, 3 s, same place | none (the captions are the hook) | none | none |
| D2 Name title | none | the guest's name and role, 4 s, when there is a guest | the guest's name and role, Montserrat SemiBold over Regular, 4 s | none | none | none | none | none |
| D3 Card or panel | none | none | none | steps. On 16:9: a deep green panel a third of the width, steps in cream, the current step in lavender. On upright: a numbered card in the top band | one Bodoni Moda word in cream, alone on screen for under 1.5 s, one every 20 s at most | none | none | none |
| D4 Logo | small, top right, once there is a file | small, top corner, once there is a file | same as Clean | same as Clean | same as Clean | same as Clean | same as Clean | none |
| D5 Chapter markers | none | at each new topic | none | none | none | none | none | none |

- **D1.** Instagram's own advice [P14]. The Teaching title copies her own lower title of 28 September [O2]. All sizes and seconds are the audience report's proposals: guess. One report put a hook in the bottom third; see "Where the reports disagree".
- **D2.** 4 s is a guess. Two surnames are in public use, Holder and Ogden [O2]: the title needs one spelling.
- **D3.** Her own layout of 8 October, set in brand type [O2]. Timings: guess.
- **D4.** seen in four peers [O1].
- **D5.** A proposal from the 6-minute finding [S2].

#### E. Look

| Setting | Clean | Full episode | Conversation | Teaching | Magazine | Bold captions | Moody | As filmed |
|---|---|---|---|---|---|---|---|---|
| E1 Look | Natural | Natural | Natural (the two people matched by hand) | Natural | Warm | Natural | Moody | Natural |
| E2 Strength | 0 | 0 | 0 | 0 | 25% | 0 | 50% | 0 |
| E3 Vignette | 0 | 0 | 0 | 0 | 10% | 0 | 10% | 0 |

- **E1.** Her nearest peers are warm and neutral, and her set is already the brand's deep green [O1][O2]. So Natural is the default and only two presets grade at all.
- **E2, E3.** 25%, 50% and 10% are guesses. Apple's presets are strong at full strength [M4]. The mild Moody recipe in Part 1 is the audience report's proposal.

#### F. Sound

| Setting | Clean | Full episode | Conversation | Teaching | Magazine | Bold captions | Moody | As filmed |
|---|---|---|---|---|---|---|---|---|
| F1 Loudness | -14 LUFS, peak -1 dB | -14 LUFS, peak -1 dB; a podcast sound file at -16 | -14, -1 | -14, -1 | -14, -1 | -14, -1 | -14, -1 | -14, -1 |
| F2 Voice clean-up | light | full | full | light | light | light | light | off (level only) |
| F3 Music | none | none | none | none | none | none | none, until there is a licensed track; then a bed 20 dB under the voice | none |
| F4 Sound effects | off | off | off | off | off | off | off | off |

- **F1.** The working convention; no video platform publishes a number [P24][A19][V25].
- **F2.** Which level goes with which style has no source: guess. Two voices at different levels are the reason for "full" in interviews.
- **F3.** 20 dB is the one figure with a standard behind it [W2]. See "Where the reports disagree".
- **F4.** None in the measured podcast clips [S5]. None of the peers' frames can show sound.

#### G. Shape, length and delivery

| Setting | Clean | Full episode | Conversation | Teaching | Magazine | Bold captions | Moody | As filmed |
|---|---|---|---|---|---|---|---|---|
| G1 Shape | 9:16, 1080 x 1920 | 16:9, 1920 x 1080 | 9:16 | 9:16 clips; 16:9 for the panel | 9:16 | 9:16 | 9:16 | as recorded |
| G2 Length | aim 30 to 60 s, cap 90 s; up to 180 s for LinkedIn | as recorded; no set length | 45 to 90 s | 45 to 90 s; up to 180 s for LinkedIn | 15 to 60 s | 15 to 60 s | 30 to 60 s | Story parts of 60 s at most; 120 s at most for LinkedIn |
| G3 Story parts | off | off | off | off | off | off | off | on: parts of 60 s at most, 7 parts at most |
| G4 Goes to | Reels, Shorts, LinkedIn | YouTube; podcast | Reels, Shorts, LinkedIn | Reels, Shorts, LinkedIn, YouTube | Reels, Shorts | Reels, Shorts | Reels, Shorts | Stories, LinkedIn |
| G5 File | standard | standard, plus a podcast sound file if wanted | standard | standard | standard | standard | standard | standard |

- **G2.** Reels: 45 to 60 s did best on brand accounts, and Instagram says 15 to 60 s suits most formats [S6][P14]. LinkedIn: 120 to 180 s did best on company pages [S6]; LinkedIn's own advice is under 2 minutes [P20]. YouTube states no best length; mid-roll ads need 8 minutes [P6]. The measured Diary of a CEO clips ran 66 to 139 s [S5]. A Short over 60 s with a copyright claim is blocked, which matters only if music is ever added [P2].
- **G3.** [P10][S7][R3].

### 2.4 Styles left out, and why

- **Fast cutting with a cut every 1 to 2 seconds (the MrBeast school).** Its maker says he slowed down and asked others to drop it [S4]. Poor fit for a coach.
- **Documentary with b-roll and maps; typographic monochrome.** Described only in freelance listings. No measured trend found: not verified.
- **Headline bar (video set in a padded frame with a title above).** The only guide is from 2020, and Instagram shows bordered Reels less [P13].
- **One word at a time.** Each word shows for about a third of a second, under every caption standard's floor [W4][W5], and it needs exact word times.
- **A speaker's colour in interview captions.** The tool does not know who is talking [R3], and this month's frames show no second colour [O1].

### 2.5 Where the reports disagree, and what I followed

| Point | The two sides | Followed | Why |
|---|---|---|---|
| What "Hormozi style" is | Vendor pages: capitals, yellow word, thick outline, a cut every 1 to 3 s [V1][V2]. Frames of 11 to 13 Oct 2026: small white lower case [O1] | The frames | Dated and first-hand. All four "edit like X" pages checked disagreed with this month's frames on a main point |
| Leila Hormozi's captions | Vendor: none burned in [V1]. Frames: text in all four [O1] | The frames | Same reason |
| Caption size | 2.5 to 3.1% [V3]; 2.6 to 5.2% and 7 to 10% [V4]; 6 to 8% a line [V4][V22]; Final Cut's default 4.6% [M3]; frames 3 to 4% [O1] | 3.6% for running captions, 5% for Bold | The frames show what her peers do now. Still an estimate: try it on a phone |
| Caption position | Vendors: 50 to 65% or 60 to 70% of the height [V4][S5]. Frames: 58 to 75%, middle about 66% [O1]. Meta: nothing below 65% [P11] | Centre 63%, bottom edge at 65% | Meta's is the only published number. It is written for ads, and is the stricter |
| Edge on a clean caption | One report: a 3 to 4 px outline [V4]. Frames: soft shadow, no outline [O1] | Soft shadow | Seen in every peer's frames but Simon Sinek's |
| Shortest time on screen | DCMP 1.33 s [W5]. Netflix 0.83 s [W4] | 0.83 s | Two to four words do not last 1.33 s at normal speed |
| Captions for interview clips | One study: capitals, heavy outline, host yellow and guest white [S5]. Frames of the same show, Oct 2026: white lower case [O1] | The frames, and no speaker colours | Newer, and the tool cannot tell speakers apart |
| Hook headline's place | One vendor page: the bottom third [V1]. Meta: keep the bottom 35% clear [P11] | Between 14% and 30% down | The bottom third is under the app's buttons |
| A tighter crop for Moody | Style report: yes, a close face [V1]. Audience report: her crop is already twice as tight as the field's [O2] | No tighter | Observed on her own frames |
| Music level under the voice | 12 to 18 dB (guides) [V13]; 20 dB (W3C) [W2]; 28 dB (one report's proposal) | 20 dB | The only figure from a standard |
| LinkedIn's longest video | 10 minutes [P17]; 15 minutes [P18]. Both pages are LinkedIn's and both are old | 10 minutes | Build to the stricter page. Re-read today |
| LinkedIn's best length | LinkedIn's advice: under 2 minutes [P20]. Data on pages: 120 to 180 s did best [S6] | Aim 60 to 180 s | The data is measured, the advice is written for ads |
| Reels frame rate | Help Center text: 30 or more (search summary) [P16]. API page: 23 to 60 [P10] | Keep the source's rate | 30 or 29.97 meets both. A 24 or 25 fps source is not settled |
| Width of the upright crop from 1080 lines | 606 px and 608 px | 606 px | It is what `reframe.js` line 31 computes |
| Punch-in size | 110 to 115% [V9]; 108% (audience report) | 108% for Clean, 112% for Bold | 112% is the no-loss ceiling for a 4K source [R3] |
| Where Final Cut keeps a saved effects preset | Apple's page names a folder [A10]. On this Mac that folder is empty and Final Cut's own containers could not be read | Not settled | Save one preset and use Reveal in Finder |

---

## Part 3. Delivery by platform

The same for every preset. One upright file fits every upright placement.

**The standard file.** MP4, H.264 High profile, the recording's own frame rate, sound AAC at 48 kHz stereo, the file's index at the front ("faststart"), loudness -14 LUFS with true peak -1 dB [P1][P10].

| Where | Shape and size | Frame rate | Length: the limit, and what to aim for | Video bitrate | Sound | Loudness | Keep clear of text | Captions |
|---|---|---|---|---|---|---|---|---|
| YouTube, long | 16:9, 1920 x 1080 | as recorded | 15 minutes until the account is verified, then 12 hours [P3]. No best length stated; 8 minutes or more for mid-roll ads [P6] | 8 Mbps up to 30 fps; 12 Mbps at 48 to 60 fps [P1] | AAC 384 kbps [P1] | -14 LUFS, -1 dB. YouTube publishes no number [P9] | nothing needed | Upload the .srt. Burn nothing in [P4][O1] |
| YouTube Shorts | 9:16, 1080 x 1920 | as recorded | 3 minutes [P2]. Aim under 60 s | 8 or 12 Mbps as above | AAC 256 kbps | same | Google gives only a picture. One third-party reading: top 288, bottom 672, left 48, right 192 px [P23] | Words in the picture, and the .srt. A file upload for Shorts is not confirmed |
| Instagram Reels | 9:16, 1080 x 1920 | 23 to 60 [P10] | Through the API: 3 s to 15 minutes, 300 MB. Shown to non-followers up to 3 minutes [P12]. Aim 30 to 60 s; 90 s at most if it may be boosted [P16] | 8 to 12 Mbps; 25 Mbps is the limit [P10] | AAC 256 kbps; Meta asks 128 kbps or more [P11] | same; none published | top 14% (269 px), bottom 35% (672 px), 6% each side (65 px). Clear box 950 x 979 [P11] | Words in the picture. No file upload was found |
| Instagram Stories | 9:16, 1080 x 1920 | 23 to 60 [P10] | 3 to 60 s a part, 100 MB [P10]. 7 parts at most [S7] | 8 to 12 Mbps | same | same | same as Reels [P11] | Words in the picture, or Instagram's Captions sticker |
| LinkedIn | 9:16 or 16:9 (anything from 1:2.4 to 2.4:1) | 10 to 60 [P17] | 3 s to 10 minutes on the stricter page [P17]. Aim 60 to 180 s | 192 kbps to 30 Mbps; 5 GB [P17] | AAC 256 kbps | same; none published | No numbers published. LinkedIn says keep the edges free [P18] | Attach the .srt when posting from a computer [P19]. If words are in the picture, leave auto captions off (third-party advice) |
| TikTok (not asked for) | 9:16 | 23 to 60 | 3 minutes for every account [P21] | H.264 MP4, 4 GB at most [P21] | same | none published | TikTok gives only a picture. One reading: top 240, bottom 660, sides 120 px (not verified) | Words in the picture |
| Podcast sound, if made | sound only | | | | | -16 LUFS give or take 1, peak -1 dB [A19] | | |

Notes.
- **One caption box that clears every reading above** on 1080 x 1920: x from 192 to 888, y from 288 to 1248 (696 x 960). It misses only TikTok's wider strip at the lower right. This is arithmetic from the figures above, not a platform's number.
- **File size.** At 8 Mbps with 256 kbps sound a file is about 62 MB a minute. At 12 Mbps it is about 92 MB a minute, so a 3-minute Reel is about 276 MB, under Instagram's 300 MB (my arithmetic).
- **MP4, not MOV.** LinkedIn's specification page says it no longer supports MOV [P17]. Final Cut's own Social Platforms share writes .mov [A13].
- **Sound bitrate.** 256 kbps on upright files is my choice between Meta's "128 or more" and YouTube's 384.
- **Instagram cover.** 1080 x 1920, with the title in the middle 1080 x 1440, because the profile grid crops to 3:4 (third-party report) [P16].
- **What the tool's files lack today** [R2][R3]: the index is not moved to the front, no sound bitrate is set, there is no loudness step, and a 50 or 60 fps source still gets 8 Mbps.

---

## Part 4. How each setting gets applied here

Six kinds of answer:

| Kind | Meaning |
|---|---|
| **Today** | The tool does it now |
| **Small change** | A change to a named file in `transcribe/` |
| **Final Cut file** | The `.fcpxml` can carry it |
| **Once by hand** | Made once in Final Cut Pro or Motion, then reused |
| **Install or buy** | Needs something added to the Mac, or paid for |
| **Each time** | A person does it for every video |

Two facts sit behind this table.
- The tool writes format version 1.10. It already allows titles, zoom, crop, effects, voice clean-up and markers. Ten sample files passed or failed Final Cut's own format check as expected. **None was opened in Final Cut Pro** [M2][M6].
- A Final Cut file can only *name* a title, effect or template. Final Cut looks for it on the Mac. The format check cannot tell whether it exists [M2].

| # | Setting | How it gets applied |
|---|---|---|
| A1 | Mistakes taken out | **Today** for "all". **Small change**: a switch for each rule in `cuts.js` (`cutPlan`, line 291) |
| A2 | Pause counts as long from | **Small change**: `cuts.js` line 170 (`LONG_PAUSE = 1.5`) read from the preset |
| A3 | Shortened to | **Small change**: `cuts.js` line 171 (`KEPT_SIDE = 0.2`) read from the preset |
| A4 | What counts as silence | **Small change**: `cuts.js` line 61 (`silencedetect=noise=-35dB:d=0.3`) |
| A5 | The join | **Today** for a plain cut. **Final Cut file**: a `transition` between clips that names Final Cut's Flow effect. Its name must be read from a file Final Cut exports; a hand-written one is not verified |
| A6 | Speed | **Small change**: `cuts.js` line 451 and `reframe.js` lines 108 to 111, and every caption time rescaled with it. **Final Cut file**: `timeMap`, pitch kept by default [M2] |
| A7 | Check markers | **Small change** to `fcpxml.js` (it already writes a marker at each join, line 157): one more at 3 s or 30 s of the timeline |
| A8 | B-roll markers | **Small change** to `fcpxml.js`: a to-do marker. Which words need a picture is **each time** |
| B1 | Layout | **Today** for fill (`reframe.js`, `cropFor`). Split is **each time** in Final Cut: the tool does not know who is talking |
| B2 | Base scale | **Small change**: a narrower crop in `reframe.js` line 31. **Final Cut file**: `adjust-transform scale` on the clip (`fcpxml.js` line 159) |
| B3, B4 | Zoom and amount | **Small change**: in `reframe.js` each kept stretch already has its own branch (lines 103 to 107), so a narrower crop on every other one is the punch-in. The rough cut is one chain (`cuts.js` line 451) and is harder. **Final Cut file**: `scale="1.08 1.08"` on alternate clips. A slow push is a pan crop with a start and an end box [A6] |
| B5 | Shortest hold | **Small change** in the same two places: skip the punch-in on a stretch shorter than the hold |
| B6 | Split edit | **Each time** in Final Cut today. The format carries it (`audioStart`, `audioDuration`) once the tool knows who speaks |
| C1 | Words in the picture | Four routes; see below the table |
| C2 | Caption file | **Today** (`<name>.rough-cut.srt`) |
| C3 | Typeface | **Install**: Montserrat and Bodoni Moda are free (SIL Open Font License) [V18] and are not on this Mac [M7]. Installing needs Jason's yes. Bodoni 72 and Didot ship with macOS and could stand in for a first test [M7] |
| C4, C5, C8, C9 | Case, size, fill, edge | Set where the words are drawn (routes below). In a Final Cut title they are `text-style` values: font, size, colour, stroke, shadow [M2]. The unit of the size there is not documented |
| C6, C7 | Words at once, shortest time | **Small change**: `cuts.js` line 458 (`LINE = 60`) and the caption writer after it. A phrase is split on its own words' times |
| C10 | Plate | Final Cut's Subtitle title has it (Background Color, Opacity, Corner Radius) [M3]. In the tool's own files, the Swift script draws the box |
| C11 | Accent on a word | **Final Cut file**: a second `text-style` run inside one title [M2]. Which word is stressed is **each time**, or drafted by the page for Sallie to approve |
| C12 | Movement | Only in Final Cut (the Subtitle title's Animation Style) [A2], or with ffmpeg-full. Caption pictures do not move |
| C13 | Position | **Final Cut file**: `adjust-transform position` on the title, or the Subtitle title's "Vertical Social Media Safe" [M3]. In the tool's own files, a number in the drawing script |
| C14 | Emoji | Nothing to do: off |
| D1 | Hook headline | **Once by hand**: a BRIMM title made in Motion. Then **Final Cut file**: a `title` that names it. Or straight away with Final Cut's built-in Basic Title and a `text-style`. The words are **each time** |
| D2 | Name title | **Final Cut file**: a `title` that names the built-in Basic Lower Third [M2]. The name is **each time** |
| D3 | Card or panel | **Once by hand** in Motion, then placed and typed **each time** |
| D4 | Logo | **Small change**: ffmpeg's `overlay` is on this Mac [M1]; one step in `reframe.js` lines 108 to 111 and `cuts.js` line 451. Needs a logo file |
| D5 | Chapter markers | **Final Cut file**: `chapter-marker` [M2]. Where a topic changes is **each time**, or drafted by the page |
| E1, E2 | Look and strength | **Small change** for the tool's own files: one `.cube` file per look through ffmpeg's `lut3d` (run here on a made-up file) in `cuts.js` line 451 and `reframe.js` lines 108 to 111. The strength is mixed into the `.cube` when it is written. **Final Cut file**: a `filter-video` that names one of the 71 built-in Color Grading Presets (passes the format check, not opened). A grade made of our own numbers cannot be written into the file: it travels as a private block of data. So a BRIMM look is **once by hand**: saved as an effects preset, or loaded as the same `.cube` through Final Cut's Custom LUT effect [A11] |
| E3 | Vignette | **Small change**: ffmpeg's `vignette`. **Final Cut file**: the built-in Vignette effect by name [M2] |
| F1 | Loudness | **Small change**, and only the tool can do it: ffmpeg `loudnorm` in two passes, in `cuts.js` line 452 and `reframe.js` lines 108 to 111. Final Cut's Loudness is an amount and a uniformity, not a target [A12]. The tool could write the measured gain as the clip's volume in dB: untested |
| F2 | Voice clean-up | **Small change**: `highpass`, `afftdn`, `deesser`, `acompressor`, `alimiter`, all on this Mac [M1]. **Final Cut file**: `adjust-noiseReduction`, `adjust-EQ mode="voice_enhance"` and `adjust-loudness` inside `audio-channel-source` (passes the 1.10 check). Voice Isolation needs version 1.11 or later (`fcpxml.js` line 164 writes 1.10). The scale of the amounts is not verified |
| F3 | Music | **Buy**: a licence that covers YouTube, Instagram and LinkedIn at once is a paid library [V15]. Choosing the track is **each time**. Ducking under the voice ran here with ffmpeg on made-up input [M1] |
| F4 | Sound effects | Off. **Each time** if ever |
| G1 | Shape | **Today**: the 16:9 rough cut and the upright file. For Final Cut, an upright project can be written (passes the check, not opened), or made by hand with Duplicate Project As [A14] |
| G2 | Length | **Today** for 15 to 90 s (`reframe.js` lines 120 to 122). **Small change**: read the range from the preset |
| G3 | Story parts | **Today** (`storyParts` in `reframe.js`). **Small change**: a cap of 7 parts |
| G4 | Goes to | **Small change**: decides which files are written. Posting is always a person's job. The tool never posts |
| G5 | File | **Small change**: `-movflags +faststart`, a sound bitrate, and 12 Mbps for 50 or 60 fps sources (`cuts.js` line 453, `reframe.js` line 111). For exports from Final Cut, **once by hand**: a custom Compressor preset (MP4, 8 or 12 Mbps), used through the Compressor Presets share destination [A13] |

**The four routes for words in the picture** (C1 and every caption setting that depends on it).

| Route | What it takes | State |
|---|---|---|
| 1. A person runs Edit > Closed Captions > Duplicate Captions to Subtitles on the file the tool already writes, then picks a style | No code. **Each time**, about a minute | Not tried. Apple's page does not say which caption formats it takes [A3]. The Final Cut file carries the whole recording's captions, so a caption beside a cut can hold cut words [R1] |
| 2. The tool writes each caption as a styled title that names Final Cut's built-in Subtitle or Basic Title | **Final Cut file**. Changes at `fcpxml.js` lines 152 to 154, and its checker at line 210 must learn that a title points at an effect | Passes the format check in 1.10 and 1.14 [M6]. Not opened. A title's start must fall on a whole frame |
| 3. A Swift script draws each caption as a clear picture and ffmpeg lays them over | **Small change**, the most code to own: a new `captions.swift` and an overlay step in `reframe.js` | **Tried here on a made-up video and it works.** A picture took 0.7 s to draw. No install. No movement [M6] |
| 4. ffmpeg-full, which can read styled caption files | **Install** (Homebrew, sits beside today's ffmpeg). Changes at `transcribe.js` line 56 and `install.sh` | Not installed, not run. Needs Jason's yes [V17] |

Bought add-ons exist for the same job inside Final Cut (Subtitle Pop $39, Caption Pop AI $59, Captionator $19.99) [V19]. Final Cut's own Subtitle title already has the same settings [M3], so none is needed (my judgement).

**One test settles most of the open points.** Build one short upright project by hand in Final Cut Pro with: the Subtitle title with a changed font, a Basic Lower Third, one Color Grading Preset, a Custom LUT, Voice Isolation and Loudness on, a clip at 112%, a Flow transition, and one title made in Motion. Then File > Export XML. That file shows the true name and value of every line marked "not verified" above, and the tool copies what Final Cut itself wrote [A18].

---

## Part 5. Recommendation

### Build these three first

1. **Full episode.** It needs no new program and no drawn text. It is numbers the tool already owns (pause lengths), plus loudness, the delivery fixes of Part 3, and two kinds of marker. It also proves the preset file itself. And it is her main output: three long videos in the two weeks to 10 October [O2].
2. **Clean.** It replaces three caption looks with one that matches her brand and the field this month [O1][O2]. It forces the one hard decision, how words get into the picture, and every other upright preset then reuses the answer.
3. **Conversation.** She makes interviews. It differs from Clean in four places only: calmer pauses, no zoom, a plate behind the words, a name title. So it is cheap once Clean exists, and it tests that a preset really is a swap of parts.

**Why not Moody and Bold captions first**, when Jason named both. Each is one changed part of Clean: Moody is Clean plus a look, and Bold captions is Clean plus a caption style. They come almost free after Clean. The research also says to keep both mild: the bold look is fading in her field, and a strong dark grade suits a dark room, not hers.

**As filmed** needs nothing that Full episode does not already build. It is a row of "off" values.

**Teaching and Magazine** wait on design work in Motion.

**A suggested order of work.** (a) The one export test above. (b) A preset file and the code that reads it, for cut and sound: Full episode. (c) Words in the picture for the tool's own upright files by route 3, which is the only route tried here, needs no install and can draw the cream plate: Clean, then Conversation. (d) For the Final Cut file, route 1 by hand at first, then route 2 once the export test has given the names.

### The shape of a preset file

Two files, following the three layers every tool uses: a brand kit that every preset shares, and one file per preset. The words of one video (a hook line, a guest's name, the steps) are never in either.

`brand.json`. The values are read from her site's markup [O2] and are for Sallie to confirm:

```json
{
  "id": "brimm",
  "colours": { "deepGreen": "#173B32", "cream": "#F4EFE6", "lavender": "#B9A6D8", "white": "#FFFFFF" },
  "faces": { "text": "Montserrat", "headline": "Bodoni Moda", "standIn": "Avenir Next" },
  "logo": null,
  "nameOnScreen": null
}
```

`clean.json`. Every value is the Clean column of Part 2:

```json
{
  "id": "clean",
  "name": "Clean",
  "layout": 1,
  "brand": "brimm",
  "for": "Everyday solo clips for Reels, Shorts and LinkedIn. The house default.",
  "cut": {
    "mistakes": "all",
    "pauseLongFrom": 1.5,
    "pauseShortenTo": 0.4,
    "silence": { "quieterThanDb": -35, "forSeconds": 0.3 },
    "join": "cut",
    "speedPercent": 100,
    "checkMarkersAt": [3],
    "brollMarkersAMinute": 0
  },
  "framing": {
    "layout": "fill",
    "baseScalePercent": 100,
    "zoom": "punch-in",
    "zoomPercent": 108,
    "zoomNeedsLines": 2160,
    "holdSeconds": 5,
    "splitEditSeconds": 0
  },
  "captions": {
    "inPicture": "phrase",
    "file": true,
    "face": "Montserrat",
    "weight": 600,
    "case": "sentence",
    "sizeOfHeight": 0.036,
    "words": { "from": 2, "to": 4, "lines": 1, "characters": 20 },
    "shortestSeconds": 0.83,
    "fill": "#FFFFFF",
    "edge": { "kind": "shadow", "colour": "#000000", "opacity": 0.65, "blurOfHeight": 0.005, "offset": 0 },
    "plate": null,
    "accent": null,
    "movement": "none",
    "place": { "centreDown": 0.63, "lowestEdge": 0.65, "widestLine": 0.70 },
    "emoji": false
  },
  "titles": {
    "hook": { "onlyWhenGiven": true, "face": "Montserrat", "weight": 700, "sizeOfHeight": 0.05, "seconds": 3, "band": [0.14, 0.30] },
    "nameTitle": null,
    "card": null,
    "logo": { "place": "top-right", "onlyWhenGiven": true },
    "chapters": false
  },
  "look": { "name": "natural", "strengthPercent": 0, "vignettePercent": 0 },
  "sound": {
    "loudness": { "lufs": -14, "truePeakDb": -1 },
    "voice": "light",
    "music": null,
    "effects": false
  },
  "delivery": {
    "shape": "9:16",
    "size": [1080, 1920],
    "seconds": { "aimFrom": 30, "aimTo": 60, "cap": 90 },
    "storyParts": false,
    "goesTo": ["reels", "shorts", "linkedin"],
    "file": "standard"
  }
}
```

Notes on the shape.
- Sizes and places are shares of the frame (0.036 is 3.6% of the height), so one preset serves 1080 x 1920 and 1920 x 1080.
- `layout` is a version number for the file's own shape, as `LAYOUT_VERSION` is for the page's records.
- A second preset is mostly the same file. `conversation.json` changes `cut.pauseLongFrom` to 2.0, `cut.pauseShortenTo` to 0.6, `framing.zoom` to `"none"`, `captions.fill` to `"#173B32"`, `captions.edge` to `null`, `captions.plate` to `{ "colour": "#F4EFE6", "opacity": 1, "radiusPx": 16, "paddingPx": 20 }`, `titles.nameTitle` to `{ "seconds": 4 }`, and `sound.voice` to `"full"`.
- The file says what is wanted. It does not say how. The two recipes (ffmpeg, and the Final Cut file) live in the tool.

---

## Part 6. What stays manual, and the questions only Jason or Sallie can answer

### Stays manual every time

- **Checking the cut plan.** The cuts are suggestions made by rules and have only met made-up speech [R1].
- **The words of one video**: the hook line, the stressed word, the steps of a framework, a guest's name and role, where a chapter starts. The page could draft them. Sallie approves.
- **B-roll.** Filming it, choosing it, placing it. The tool can only mark the spot.
- **Music.** Choosing the track and holding the licence.
- **Colour between two cameras**, and fixing a badly lit recording. A soft background needs a mask picked by a person in Final Cut [A17].
- **Who is on screen in an interview**, and any split layout.
- **Exporting from Final Cut Pro.** No file can make Final Cut write a video [R1].
- **Posting**, attaching the .srt on YouTube and LinkedIn, and adding Instagram's Captions sticker to an As filmed Story. The tool never posts.
- **Covers and thumbnails.**
- **Checking the captions' words.** Automatic captions do not meet the need until someone has checked them [W3].

### No preset can fix these: they belong in a note on how to record

- **The crop is tight because the recording is.** Frame the wide shot so her face is a quarter to a third of the picture's height [O2].
- **The crop is soft because the source is small.** Record in 4K. From 1080 lines the upright crop is blown up to 178%; from 2160 lines it is not blown up at all [R3].
- **The microphone sits where the captions land** [O2]. Lower it, or move it to the side.

### Questions for Jason and Sallie

**Brand**
1. Are these the brand's colours and faces: deep green `#173B32`, cream `#F4EFE6`, lavender `#B9A6D8`, Bodoni Moda for headlines, Montserrat for text? They were read from the site's markup. Is there a brand guide from the site's designer?
2. Is there a logo file, and a small version for a corner?
3. Which name goes on screen: Sallie Ogden or Sallie Holder? Both are in public use.

**Decisions that need Jason's yes**
4. May Montserrat and Bodoni Moda be installed on the Mac Studio? Both are free.
5. For words in the picture: caption pictures drawn by the tool (tried, no install), or ffmpeg-full (an install, less code, not tried)?
6. Will Jason build the one test project in Final Cut Pro and export its XML? About twenty minutes, and it settles most of what is marked "not verified".
7. How does a person pick a preset: a word on the command line, a watched folder for each preset, or a small file beside the video?

**How Sallie works**
8. Can she record in 4K, and a little wider?
9. How are interviews recorded: one camera on two people, two cameras, or Zoom? That decides what Conversation can do.
10. Does she want words in the picture on LinkedIn, or only the caption file?
11. Will some clips still go through OpusClip or CapCut? If so the house style has to be set up there too, as an OpusClip brand template [V3].
12. Is there any b-roll, or will there be? Generated b-roll is best avoided: 59% in one survey said hidden AI use lowers trust (a sponsored article, sample not given) [S13], and YouTube asks for a label on a realistic generated scene [P7].
13. Music: any at all? If yes, which paid library?
14. Are TikTok and Facebook in scope?
15. How many Story parts is she happy to post from one clip?
16. Who writes the hook line and picks the stressed word: Sallie, or the page as a draft for her to approve?
17. Does her Final Cut Pro need the Creator Studio subscription for the Subtitle title? Not verified here.

---

## Not verified

- **Opened in Final Cut Pro:** nothing. Every Final Cut line above passed a format check only.
- **Real footage:** none. No look, pause length, zoom or caption size has been judged on Sallie's video.
- **Watched:** no video, by anyone. Pace, caption movement, music and sound effects are unobserved for every creator named.
- **Her Instagram and LinkedIn** were not opened.
- **Loudness:** no figure published by YouTube, Instagram, TikTok or LinkedIn was found.
- **Safe zones** for ordinary (not ad) Reels, for Shorts, TikTok and LinkedIn: no published numbers.
- **Caption file upload** for Shorts, Facebook Reels, Instagram and TikTok.
- **Whether any caption style holds viewers better than another.** No independent test found.
- **Popularity of colour looks**, and CapCut's preset contents.
- **Instagram's head on unpolished video** (end of 2025): read only through a news report [S14].
- **Final Cut details:** the names Final Cut writes for a Subtitle title, a Flow transition, a Custom LUT and a title made in Motion; the unit of a title's font size; the scale of the sound amounts; whether captions that arrived through a file convert to subtitles; where version 12.4 saves a new effects preset on this Mac; whether its word highlight follows real word times.
- **Seen in passing, in the repo:** on branch `unedited-claude` nothing in `unedited.js` calls `clipArgs` (`reframe.js` line 116) or `clipRanges` (`notes.js` line 310), so the short clips may not be wired in yet.
- The researchers' shared web-search allowance ran out part-way. A second pass could close several of these.

---

## Sources

Dates are the page's own where it shows one. "Read" means read on 2026-10-13.

**This repo and this Mac**
- [R1] `/Users/jasonogden/Claude Code/BRIMM operations/README.md`, section "Unedited video" (lines 122 to 212)
- [R2] `transcribe/cuts.js` lines 61, 170 to 171, 291, 451 to 453, 458
- [R3] `transcribe/reframe.js` lines 7 to 8, 31, 57 to 58, 103 to 111, 116, 120 to 122, 146
- [R4] `transcribe/fcpxml.js` lines 60 to 61, 152 to 159, 164, 168 to 169, 210; `transcribe/unedited.js`; `transcribe/notes.js` line 310; `transcribe/transcribe.js` line 56
- [M1] ffmpeg 9.0.2 at `/opt/homebrew/bin/ffmpeg`: its filter, encoder and build lists, and test runs on made-up input
- [M2] Final Cut Pro 12.4's own format definitions: `/Applications/Final Cut Pro.app/Contents/Frameworks/Interchange.framework/Versions/A/Resources/FCPXMLv1_10.dtd` and `FCPXMLv1_14.dtd`; template names in the app's program text
- [M3] The built-in Subtitle title: `/Applications/Final Cut Pro.app/Contents/PlugIns/MediaProviders/MotionEffect.fxp/Contents/Resources/METemplates.localized/Titles.localized/Subtitles.localized/Subtitle.localized/Subtitle.moti`
- [M4] Colour presets inside the app: `.../METemplates.localized/Effects.localized/Color Grading Presets.localized/` (71), `.../Flexo.framework/Versions/A/Resources/Color Presets/` (20), `.../Effects.localized/Styles.localized/` (9)
- [M5] `.../Flexo.framework/Versions/A/Resources/Effect Bundles/Voice Over Enhancement 2.Voice.audio.effectBundle`
- [M6] Scratch tests: `/private/tmp/claude-501/-Users-jasonogden-Claude-Code-BRIMM-operations/d2df8116-6adb-4d04-a170-d3efb5b797a7/scratchpad/presets/samples` (format-checked sample files) and `.../presets/captest` (caption pictures and overlay)
- [M7] Typefaces in `/System/Library/Fonts`, `/System/Library/Fonts/Supplemental`, `/Library/Fonts`, `~/Library/Fonts`

**Seen in frames**
- [O1] Still frames of Shorts and long videos by 11 business educators, uploaded 24 Sep to 13 Oct 2026, at `https://i.ytimg.com/vi/<id>/oar2.jpg`. Video IDs are in section 3 of `/private/tmp/claude-501/-Users-jasonogden-Claude-Code-BRIMM-operations/d2df8116-6adb-4d04-a170-d3efb5b797a7/scratchpad/presets/report-audience.md`. Peers' sites: https://www.amyporterfield.com ; https://jasminestar.com ; https://jennakutcher.com
- [O2] Sallie's own pages: https://growwiththebrimm.com (markup) ; https://www.youtube.com/feeds/videos.xml?channel_id=UCidJ_bWtVFEP0iRuv_lXWcw ; frames of 11 Shorts and 3 long videos, IDs in section 2 of the same report

**Apple**
- [A2] https://support.apple.com/guide/final-cut-pro/generate-subtitles-automatically-verd6d52c4e8/mac ; release notes https://support.apple.com/en-us/102825 (12.3 on 30 Jun 2026, 12.4 on 29 Sep 2026)
- [A3] https://support.apple.com/guide/final-cut-pro/convert-closed-captions-to-subtitles-ver3a0f2a987/mac (read by me)
- [A5] https://support.apple.com/guide/final-cut-pro/merge-jump-cuts-with-the-flow-transition-ver46d0179ac/12.4/mac/26.6
- [A6] https://support.apple.com/guide/final-cut-pro/pan-and-zoom-clips-verb8e5de9c/12.4/mac/26.6
- [A8] https://support.apple.com/guide/final-cut-pro/preserve-pitch-in-retimed-clips-verb6aca45d/12.4/mac/26.6
- [A10] https://support.apple.com/guide/final-cut-pro/save-video-effects-presets-ver462c2078f/mac
- [A11] https://support.apple.com/guide/final-cut-pro/apply-luts-ver24f966423/mac
- [A12] https://support.apple.com/guide/final-cut-pro/enhance-audio-verc1fab873/mac
- [A13] https://support.apple.com/guide/final-cut-pro/social-platforms-destination-ver1d41f8374/mac ; https://support.apple.com/guide/final-cut-pro/compressor-presets-destination-ver74e31fd6c/mac
- [A14] https://support.apple.com/guide/final-cut-pro/create-square-vertical-versions-a-project-ver8bad7adc6/mac
- [A17] https://support.apple.com/guide/final-cut-pro/add-an-auto-mask-to-a-video-effect-ver722466c60/12.4/mac/26.6
- [A18] https://support.apple.com/guide/final-cut-pro/use-xml-to-transfer-projects-verdbd66ae/mac
- [A19] https://podcasters.apple.com/support/893-audio-requirements

**Platforms**
- [P1] https://support.google.com/youtube/answer/1722171
- [P2] https://support.google.com/youtube/answer/15424877
- [P3] https://support.google.com/youtube/answer/71673
- [P4] https://support.google.com/youtube/answer/2734698 ; https://support.google.com/youtube/answer/2734796
- [P5] https://support.google.com/youtube/answer/9314415 ; https://support.google.com/youtube/answer/12942217
- [P6] https://support.google.com/youtube/answer/6175006
- [P7] https://support.google.com/youtube/answer/1311392 ; https://support.google.com/youtube/answer/14328491
- [P8] https://blog.youtube/news-and-events/1-billion-monthly-podcast-users/ (2025-02-26)
- [P9] https://support.google.com/youtube/answer/14106294
- [P10] https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media
- [P11] https://www.facebook.com/business/ads-guide/update/video/instagram-reels ; https://www.facebook.com/business/ads-guide/update/video/instagram-story
- [P12] https://creators.instagram.com/blog/the-latest-with-instagram (2025-01-21) ; https://creators.instagram.com/faq
- [P13] https://about.instagram.com/blog/announcements/instagram-ranking-explained (2023-05-31)
- [P14] https://about.instagram.com/blog/tips-and-tricks/how-to-make-instagram-reels ; reported at https://www.socialmediatoday.com/news/instagram-shares-reels-creation-tips-in-new-guide/831551/ (2026-09-28)
- [P15] https://creators.instagram.com/blog/helping-creators-of-all-sizes-break-through (2025-02-26)
- [P16] Instagram Help Center, as shown in search results only: https://help.instagram.com/1038071743007909 ; https://help.instagram.com/2720958398006062 ; grid crop https://www.kapwing.com/resources/instagrams-new-grid-layout-size-and-dimensions-2025/ (2025-12-30) ; captions sticker https://www.descript.com/blog/article/how-to-add-captions-to-reels (2026-07-29)
- [P17] https://www.linkedin.com/help/linkedin/answer/a1311816 (marked "4 years ago"; read by me)
- [P18] https://www.linkedin.com/help/linkedin/answer/a548372 (marked "2 years ago")
- [P19] https://www.linkedin.com/help/linkedin/answer/a552177 ; https://www.linkedin.com/help/linkedin/answer/a1327025
- [P20] https://www.linkedin.com/business/marketing/blog/content-marketing/13-top-tips-for-compelling-b2b-video-content-on-linkedin (2025-06-05)
- [P21] https://ads.tiktok.com/business/en-US/blog/tiktok-content-production-for-smbs (2024-02-26) ; https://developers.tiktok.com/docs/en/content-posting-api-media-transfer-guide
- [P23] https://support.google.com/google-ads/answer/13547298 ; third-party reading https://adchecklab.com/articles/youtube-shorts-safe-area-dimensions (checked Sept 2026)
- [P24] https://support.spotify.com/us/artists/article/loudness-normalization/

**Standards**
- [W1] https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- [W2] https://www.w3.org/WAI/WCAG22/Understanding/low-or-no-background-audio.html ; https://www.w3.org/WAI/WCAG21/Techniques/general/G56
- [W3] https://www.w3.org/WAI/media/av/captions/ ; https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html
- [W4] https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-Timed-Text-Style-Guide (change log 2025-12-19) ; https://partnerhelp.netflixstudios.com/hc/en-us/articles/215758617 (2022-10-07)
- [W5] https://dcmp.org/learn/597-captioning-key---text ; https://dcmp.org/learn/601-captioning-key---presentation-rate

**Studies and reports**
- [S1] Campione and Veronis, Speech Prosody 2002: https://mail.sprosig.org/sp2002/pdf/campione-veronis.pdf
- [S2] Guo, Kim and Rubin, 2014: https://up.csail.mit.edu/other-pubs/las2014-pguo-engagement.pdf
- [S3] Murphy and others, 2021: https://castel.psych.ucla.edu/wp-content/uploads/sites/111/2022/03/Applied-Cognitive-Psychology-2021-Murphy-Learning-in-double-time-The-effect-of-lecture-video-speed-on-immediate-and.pdf
- [S4] https://tubefilter.com/2024/03/04/mrbeast-editing-style-number-of-cuts-per-video/ (2024-03-04)
- [S5] https://www.writepanda.ai/blog/how-diary-of-a-ceo-edits-podcast-clips/ (2026-07-04; third party, three clips)
- [S6] https://www.socialinsider.io/blog/instagram-reels-length/ (2026-07-14; the page gives two different sample sizes) ; https://www.socialinsider.io/social-media-benchmarks/social-media-video-statistics (2026-08-21)
- [S7] https://www.rivaliq.com/blog/instagram-stories-benchmark-report (2024-01-09)
- [S8] https://wistia.com/about/state-of-video (2026-04-22)
- [S9] https://blog.hubspot.com/marketing/how-video-consumption-is-changing (updated 2025-02-19)
- [S10] https://www.hootsuite.com/research/social-trends (2026; a trend report)
- [S12] https://buffer.com/resources/linkedin-algorithm/ (2025-12-19)
- [S13] https://www.socialmediatoday.com/spons/influencer-marketing-has-an-ai-trust-problem/831579/ (2026-10-05, sponsored)
- [S14] https://www.engadget.com/social-media/instagram-chief-ai-is-so-ubiquitous-it-will-be-more-practical-to-fingerprint-real-media-than-fake-media-202620080.html (2025-12-31)
- [S15] https://postiz.com/blog/hormozi-2026-audience-growth-playbook (2026-04-19) ; https://www.brief-tube.com/videos/Jmkq5RLjm0U (second-hand)

**Tool makers and guides (rules of thumb, not measured)**
- [V1] https://www.choppity.com/tools/recreate-video-editing-style/ and its pages for alex-hormozi, leila-hormozi, codie-sanchez, ali-abdaal, tom-noske (undated)
- [V2] https://docs.submagic.co/api-reference/update-preset.md ; https://docs.submagic.co/api-reference/create-project ; https://docs.submagic.co/api-reference/templates ; https://www.submagic.co/blog/how-to-make-alex-hormozi-captions
- [V3] https://help.opus.pro/docs/article/how-to-add-a-brand-template.md ; https://help.opus.pro/api-reference/brand-template ; https://help.opus.pro/docs/article/layout-and-reframing ; https://www.opus.pro/blog/best-caption-presets-styles-boost-retention (2025-11-11, changed 2026-05-06) ; https://www.opus.pro/blog/instagram-reels-caption-subtitle-best-practices (2025-11-11) ; https://www.opus.pro/blog/ai-b-roll-generator (2026-07-21)
- [V4] https://blitzcutai.com/blog/best-caption-fonts-tiktok (2026-03-15, updated 2026-09-25) ; https://blitzcutai.com/blog/how-to-make-captions-look-professional (2026-05-25) ; https://blitzcutai.com/blog/best-caption-style-instagram-reels-2026 (2026-08-25) ; https://blitzcutai.com/blog/how-to-remove-silence-youtube-shorts (2026-08-31)
- [V5] https://poko.video/blog/best-caption-styles-for-marketing-videos-2026-guide (2026-05-01)
- [V6] https://joyspace.ai/hormozi-editing-style-2026-analysis (2025-12-10; opinion)
- [V7] https://captions.ai/styles ; https://captions.ai/help/docs/captions/styles.md ; https://captions.ai/help/docs/project/ai-edit
- [V8] https://www.autocut.com/blogs/autocut-silences-parameters (2025-10-01) ; https://knowledge.autocut.com/en/article/what-are-the-autozooms-settings-11racdj/ (2026-03-12)
- [V9] https://firecut.ai/blog/how-to-zoom-in-on-premiere-pro-a-step-by-step-guide-for-beginners/ (2026-05-06)
- [V10] https://agent.vizard.ai/how-to/stop-the-punch-ins-cycling-too-fast-in-a-talking-head-edit.html (2026-10-10)
- [V11] https://filmdaft.com/the-l-cut-and-j-cut-how-film-editors-use-audio-to-control-time/ (2026-05-19)
- [V12] https://rysupaudio.com/blogs/news/best-vocal-chain-order (2026-03-13)
- [V13] https://tryuncle.com/learn/davinci-resolve/how-to-duck-background-music-under-dialogue-in-davinci-resolve (2026-07-30)
- [V14] https://esecut.com/blog/sound-effects-that-boost-engagement ; https://creatorsfx.in/blog/best-sound-effects-for-reels-and-shorts (2026-03-10)
- [V15] https://www.facebook.com/sound/collection/terms (2022-03-16) ; https://support.google.com/youtube/answer/3376882 ; https://www.epidemicsound.com/our-plans/
- [V16] https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0066421
- [V17] https://formulae.brew.sh/formula/ffmpeg-full
- [V18] https://github.com/JulietaUla/Montserrat (SIL Open Font License 1.1; read by me) ; https://github.com/google/fonts/tree/main/ofl/bodonimoda (Bodoni Moda, in Google Fonts' folder of Open Font License faces, with its licence file; read by me)
- [V19] https://fxfactory.com/info/subtitlepop/ ; https://stupidraisins.com/titles/caption-pop-ai/ ; https://apps.apple.com/us/app/captionator-for-final-cut/id1627843786
- [V22] https://recapo.ai/blog/best-caption-styles-for-shorts/ (2026-07-30) ; https://riverside.com/blog/hormozi-style-videos (updated 2024-11-13)
- [V25] https://youlean.co/loudness-standards-full-comparison-table/ (2020-03-20) ; https://productionadvice.co.uk/stats-for-nerds/ (2017-09-29)
