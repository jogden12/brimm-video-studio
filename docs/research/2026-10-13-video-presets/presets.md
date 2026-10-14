# Presets for Sallie's video: a job, a caption style and a look

Written 2026-10-13 for Jason Ogden, and corrected the same evening after a fourth check, against the tool on `main` at commit c9f5ff6. Brought to the brand guide later that night, on Jason's decision, and corrected once more after two checks of that version. Research only: no code was changed, and nothing was published or installed. Final Cut Pro, Motion and Compressor were not opened.

Jason's question: "can you research popular video editing styles and settings that could be grouped into different Presets?"
His decision on the draft: "make the presets combinable: job, caption style and look".

**The brand is the brand guide's.** When this was first written no brand files were at hand, so the brand was read from the website's markup. Jason then pointed to The BRIMM's brand guide, which gives a different brand, and decided on 2026-10-13: "the website should follow the brand guide but doesnt always." So every colour and typeface below is the guide's [B1]. The website's deep green, cream, lavender, Montserrat and Bodoni Moda are what the site shows. They are not brand values, and none is used below. `brand-guide.md` sets the two side by side.

## The answer in brief

A video is given one choice from each of three short lists. Under them sits one brand kit, which is not chosen. Any job goes with any caption style and any look: 5 x 5 x 4 = 100 picks, and ten rules keep every one of them valid. Two of the rules (2 and 9) make some picks come out as the same video, so the 100 picks give 80 different videos at most.

**The jobs.** What the video is and where it goes. A job owns the cut, the framing, which titles there are, the sound, and the shape, length and delivery.

| Job | What it is | Goes to | Its default caption style | Its default look |
|---|---|---|---|---|
| **Full episode** | The whole show in 16:9. Calm cuts, no captions drawn on the picture | YouTube; a podcast sound file if wanted | File only | Natural |
| **Solo clip** | A short upright clip of Sallie alone | Reels, Shorts, Stories, LinkedIn | Plain | Natural |
| **Interview clip** | A short upright clip cut from an interview | Reels, Shorts, LinkedIn | Plain | Natural |
| **Teaching clip** | An upright clip of a framework or a list, with its steps on screen | Reels, Shorts, LinkedIn | Plain | Natural |
| **As filmed** | A quick thought, trimmed and levelled. Nothing added but captions | Stories, LinkedIn | Plain | Natural |

**The caption styles.** How words in the picture look, captions and titles alike.

| Caption style | In one line |
|---|---|
| **File only** | No words drawn. The caption file (.srt) only |
| **Plain** | Small white words in sentence case, two to four at a time, soft shadow |
| **Boxed** | The same words in navy on a mist box with rounded corners, for a busy picture |
| **Bold** | Big white capitals, two to four words at a time on two lines, the stressed word in navy on a sand box |
| **Signature** | The guide's own headline: spaced white capitals on a navy block, a word or two in the script, with plain white captions under it |

**The looks.** The colour of the picture.

| Look | In one line |
|---|---|
| **Natural** | No change |
| **Bright** | A little lighter, and softer in contrast. The nearest a grade comes to the guide's "light and airy" |
| **Warm** | A touch warmer, with slightly darker corners |
| **Moody** | A little darker, a little warmer, a little less colour. A mild version only. It goes against the guide |

**The brand kit** is The BRIMM's brand guide [B1]. It holds the guide's eight colours by their own names (navy `#1F2D42`, fog `#5C6D7E`, light gray `#9EA9B2`, dew `#CED3D6`, sand `#C1AD97`, dune `#CEBEAC`, mist `#E8E3DA`, smoke `#F8F7F5`), its typefaces (Sweet Sans Pro for words, its Medium capitals with wide letter spacing for headlines, and the script Sinthya for a word or two), a logo and the one spelling of her name. The guide's secondary palette is recorded only so that it can be refused: the guide says never to use it for a background or for text. Caption styles and looks name the kit's parts ("navy", "text"), so one change to the kit changes every style. No style stores a number that rests on a face's width: how many characters fit an upright caption line is worked out for the face that is drawn (1.3, C6). Neither typeface is on this Mac and no font file is at hand. Until one is, Varela, the guide's own free alternate, is the stand-in recommended for real videos. Lucida Grande, which is on every Mac, comes after it (1.1).

**The rules, one line each.** The tool applies them itself and says so in the first lines of the cut plan.

1. When a caption is wider than its line, then it goes on two lines or is split in two. A single word that is still too wide is drawn as small as it needs.
2. When File only is picked for a place that takes no caption file (Reels, Stories), then Plain is drawn.
3. When a title in the top band would cover her face, then the title is left out. The caption stays.
4. When a caption would show for under 0.83 s or need reading faster than 20 characters a second, then it is joined to the next one or held longer.
5. When the recording is too small for a punch-in (under 2,074 lines for an upright frame at 108%), then there is no punch-in.
6. When a look is picked and the recording has under 1080 lines, then the look is applied at 75%, and under 720 lines at 50% with no vignette.
7. When the recording is HDR, then no look is applied, and the person is told every time that the colour is not converted. This holds for Natural too.
8. When a title is too wide for its lines or too tall for its place, then it is drawn smaller, down to 70% of its size. Past that it is left out.
9. When a drawn caption style is picked for a wide video that goes where a caption file is taken (Full episode, to YouTube), then no running captions are drawn. The style gives the titles their look.
10. When an upright crop must be enlarged more than 200% (a recording under 960 lines, such as a Zoom file), then nothing is changed, and the person is told the picture will be soft and what to do.

**The draft's eight presets, as picks.**

| Pick | Job | Caption style | Look |
|---|---|---|---|
| Clean | Solo clip | Plain | Natural |
| Full episode | Full episode | File only | Natural |
| Conversation | Interview clip | Boxed | Natural |
| Teaching | Teaching clip | Plain | Natural |
| Signature (the draft's Magazine) | Solo clip | Signature | Warm |
| Bold captions | Solo clip | Bold | Natural |
| Moody | Solo clip | Plain | Moody |
| As filmed | As filmed | Plain | Natural |

What each loses this way is in section 2.5.

**Build first**, in this order. Before any code: one test project made by hand in Final Cut Pro and exported as XML. Then (1) the four kinds of file, the code that reads them, and the job Full episode; (2) the caption style Plain on the job Solo clip; (3) the looks Bright and Moody; (4) the caption style Bold. After step 4 all three layers exist: two jobs, three caption styles and three looks. That is 18 picks and 9 different videos: the Full episode in three looks, and the Solo clip with Plain or with Bold in three looks. A look goes on both jobs. "Bold captions" go on the Solo clip: on the Full episode rule 9 draws no running captions, whatever style is picked. Part 5 says why.

**Five facts that shape everything below.**

1. **This month's frames are quiet.** In 29 still frames from 11 well-known business educators, one from each of 29 Shorts uploaded 24 Sep to 13 Oct 2026, lower or sentence case is the main look for 9. Small white text with no outline and no second colour is the main look for 7 (Alex Hormozi, Codie Sanchez, Mel Robbins, Amy Porterfield, Marie Forleo, The Diary of a CEO, Dan Martell). Leila Hormozi's four frames split two and two. Ali Abdaal's is dark two-tone text on a pale pill. Emma Grede's one frame is a single word in white serif capitals. Simon Sinek's is outlined capitals [O1]. This is one fortnight, not a trend line. Sallie's own Shorts use capitals, a black outline, neon green or red words and an emoji, in at least three variants in two weeks [O2].
2. **The market's tools already split a preset into layers.** Submagic's API takes a caption template in one field and zooms, b-roll, silence removal, clean sound and music in others; a saved preset bundles them [V2]. OpusClip's brand template holds the shape, layout, headline, captions, a logo or call-to-action overlay, an intro and an outro [V3]. The words and media of one video are never in a preset.
3. **The Final Cut file points at the original video, not at the rough cut** [R4]. A look, a loudness fix or a zoom made with ffmpeg never shows in Final Cut Pro. So every layer needs two recipes: one for the tool's own video files and one for the Final Cut file. They will be close, not identical.
4. **This Mac's ffmpeg can cut, zoom, colour and level sound. It cannot draw text** [M1]. Words in the picture have four routes (Part 4). One was tried on made-up video and works: caption pictures drawn by a short Swift script and laid over by ffmpeg [M6][M8].
5. **Most numbers for short video are tool makers' rules of thumb.** What is measured: the length of a pause in one small French study, about six minutes of attention for teaching video, and the 3 second and 30 second points the platforms count. What is official: upload settings, Meta's safe zone for ads, caption rules. The rest is marked.

**Limits.** No video was watched and no sound was heard by any researcher. Pace, caption movement and music are not observed for anyone. Caption sizes in the field are estimates from still frames; three were counted in pixels today [O3]. None of the tool's cuts, crops or files has met real footage [R1]. The face finder was shown a real face once, in a Zoom recording, and found it in all 60 stills; no crop has been checked against a real speaker [R1]. A drawn caption changes on a word's time, and the tool's word times are off by a tenth to a third of a second: only the start and end of a whole phrase sit on a pause that ffmpeg heard [R1][R2]. No width was measured in Sweet Sans Pro's own font file, which is not on this Mac [M7]. Widths below come two ways, and each says which: measured in Avenir, the stand-in for the tool's tests, and added up from the letter widths that the guide's PDF records for Sweet Sans Pro, with no kerning [M11]. Every number below is a starting value to try on one of Sallie's own recordings.

**How values are marked.**

| Mark | Meaning |
|---|---|
| today | What the tool on `main` does now (commit c9f5ff6, 2026-10-13 20:02). The Mac runs it. This includes Claude's read of the cut plan and the short clips, which were merged at 19:57 that day [R5] |
| official | A platform's, Apple's or a standards body's own page |
| guide | The BRIMM's brand guide, read on 2026-10-13 [B1] |
| measured | A study that says how it counted |
| seen | Observed in still frames, 24 Sep to 13 Oct 2026 |
| rule of thumb | A tool maker's or one creator's advice, not measured |
| guess | No source. A starting value to test |
| not confirmed | Looked for and not settled |

Sources are at the end, cited by key, like [P11].

---

## Part 1. What each layer holds

Fifty-nine settings. Each belongs to exactly one of four layers: the brand kit (6), the job (32), the caption style (17), the look (4). The last column of every table says which. The last version had sixty: Story parts are no longer a setting of their own (see the table below).

### 1.0 Where a setting seemed to belong to two layers, and how it was settled

| The case | Settled as | Why |
|---|---|---|
| A size or a place depends on the frame's shape | Every size and place of drawn words is given twice in the caption style: once for an upright frame, once for a wide one. That holds for titles as well as captions, and for how many lines a headline may take. The brand kit gives the logo's width and place, and the script's smallest size, twice in the same way. The job says which frame it is | The job owns the shape. The style owns how words look in each shape |
| A title (hook headline, name title, steps) | The job says that there is one, when, for how long, and for a hook the most words. The caption style says its typeface, size, colour, lines and place. Whether steps are a card or a panel is not chosen: a card on an upright frame, a panel on a wide one, and the caption style holds both looks. The words come with the video | A headline and the captions under it then always match |
| How long a hook can be | The job gives the most words (8). The caption style gives the size, the lines and the widest line. How many characters fit is worked out from the style for each video. Claude is asked for a hook that fits, and rule 8 deals with one that does not | They are two limits: one is an editor's, the other is room on the frame. A caption style never repeats the job's 8 words |
| How many characters fit an upright caption line | Not stored. The caption style gives the size and the widest line, the brand kit gives the face, and the tool works the number out for the face it draws and writes it into the settings file. The wide 42 is stored, because it is a caption standard's figure and not a fit | The last version stored 18, 17 and 9 in three caption styles. Each was a second copy of what two layers already say, and each had to be changed by hand when the kit's face changed |
| The step from one line of words to the next | The brand kit: a line step for each role, beside its letter spacing (K2) | It is part of how a face is set. Whether three headline lines fit the band rests on it |
| The headline's capitals, and the script's limits | Case is the caption style's (C4). The kit's headline role holds no case, and a style that uses that role in another case is refused. The script's three limits (how small, only on a plate, two words at most) are the kit's, held with its role | The last version said "capitals" in the kit and in the style, and held only one of the script's limits in a file |
| A zoom depends on how large the recording is | The job owns the zoom. Rule 5 leaves it out on a small recording | The size of the recording is a fact about the video, not a choice |
| A look's strength depends on how good the recording is | The look owns its recipe and its strength. Rule 6 lowers the strength on a small recording, by one table kept in the tool | Same reason. The table is the same for every look |
| Music and sound effects | The job | A music licence follows where the video is posted, and the job owns that. A look is colour only |
| The caption file and the drawn captions | The file belongs to the job (delivery). The drawn words belong to the caption style | A file's lines follow the platform's caption standard. A drawn line follows the style |
| The logo | The brand kit holds the mark's two files, its corner, and its width and place for each frame. The job says whether it shows | One logo for every style |
| Shortest time on screen and reading rate | For drawn captions, the caption style. For the caption file, the job | They are two different sets of words |
| Pause lengths for an episode and for its clips | The job. A recording made into an episode and into clips gets two cut plans, and each file's name carries the job | The draft's single file could not do this (Part 5) |
| Safe zones, bitrates, length limits | Not settings. They are platform facts, kept in the tool as one table (Part 3). The rules read them | Nobody picks them |
| Story parts | Not a setting. "Stories" in the job's "Goes to" (G4) turns them on. The 60 s a part is a platform fact (Part 3) | The last version had a switch for them as well, G3. For two jobs it said yes while "Goes to" said no |
| The podcast sound file | The job's "File" (G5) turns it on. Its -16 LUFS is a platform fact (Part 3). "Podcast" is not a place in "Goes to" | One switch. And one loudness setting (F1), which is the video's |
| A look's strength and Final Cut's Mix | The look has one strength (E2). It scales the tool's recipe and Final Cut's Mix alike. E4's Mix says how much of Apple's preset the look uses at full strength | The Mix that is written = E4's Mix x E2's strength x rule 6's share. The last version did not say how the two joined |
| The widest line, when there is a box behind the words | The caption style's widest line and lowest edge are measured on the box (a plate, or the box behind a stressed word), not on the words | The box is what must stay clear of the platform's buttons |
| Whether running captions are drawn | The caption style (C1). Two rules change it by where the video goes: rule 2 draws Plain where no caption file is taken, and rule 9 draws none on a wide video that goes where one is taken | Where a video goes is the job's. A rule is not a second setting |

### 1.1 The brand kit (one, never picked for a video)

Every value in this table is the brand guide's [B1]. Under the table: who sells the two typefaces, what a licence covers, and what stands in until the font files are at hand.

| # | Setting | Values it can take | Default | Where it comes from | Owner |
|---|---|---|---|---|---|
| K1 | Colours, by name | the guide's eight, with white and black | navy `#1F2D42`, fog `#5C6D7E`, lightGray `#9EA9B2`, dew `#CED3D6`, sand `#C1AD97`, dune `#CEBEAC`, mist `#E8E3DA`, smoke `#F8F7F5`; and white `#FFFFFF`, black `#000000`. Recorded so that it can be refused: the secondary palette, blush `#CCA497`, rose `#EDD6D3`, forest `#4E563D`, moss `#727A64`, sage `#979B8E`. No caption style and no title may name one of those five for words, a plate or a box | guide: its colour page and its swatch file [B1][B2]. The guide says the secondary palette is an accent, mainly in photographs, and is never a background colour and never text [B1]. White is the colour of the guide's light logo files. Black is only ever a shadow. Contrast by the WCAG formula [W1][M11]: white on navy 13.9 to 1; navy on smoke 13.0; navy on mist 10.9; navy on dew 9.2; navy on dune 7.7; navy on sand 6.4; navy on light gray 5.8; white on fog 5.3. Three pairs fail the 4.5 to 1 asked of small words: fog on mist 4.2, white on light gray 2.4, white on sand 2.2. The guide's own samples set pale words on a sand block and on a light gray one | Brand kit |
| K2 | Typefaces, by role, with a face name for each weight, the role's letter spacing and line step, and a role's own limits | any face that is licensed and at hand | **text**: Sweet Sans Pro in the guide's three weights, Light, Regular and Medium, with lines that step by 1.35 of the font size. **headline**: Sweet Sans Pro Medium, with letter spacing of 0.10 of the font size and the same line step. The guide sets it in capitals. Case is the caption style's to say (C4), and a style that uses this role in any other case is refused. **script**: Sinthya, which has one weight. Its three limits are held here: two words of a title at most; only on a plate; and never under a capital height of 2.5% on an upright frame or 3.3% on a wide one. Until the two are at hand: Varela in real videos, then Lucida Grande; Avenir in the tool's tests (under this table) | guide: its type page [B1]. The page shows a headline in Medium capitals, a line in Regular and a paragraph in Light, each with its weight's name under it. That these are headline, subhead and running text is read from the samples: the page does not say it in words, and it gives no rule for the script beyond showing two words in it. The letter spacing is read from the guide's PDF: 0.10 on the headline sample, 0.14 on every section heading and label [M11]. The line step is the guide's for its running text, 1.35 of the font size [M11]. Taking it for a stacked headline is a guess. The script's three limits: guess. Its strokes are thin, about 0.06 of the font size by the PDF's own rough record [M11]. That is 4.2 px at the upright floor. On a wide frame 2.5% would be a stroke of 2.4 px, so the wide floor is 3.3%, the upright one scaled as the running caption is, and a stroke of 3.1 px (arithmetic) | Brand kit |
| K3 | Logo: the mark, a file for dark footage and one for light, which of the two is used, the corner, and for each frame its width, top edge and side margin | none / two files of one mark | The stacked wordmark, THE over BRIMM. White over dark footage, navy over light; white to start, because her set's wall is dark [O2]. No file is beside the tool yet (question 4), so none is drawn. Top right. Upright: 15% of the frame's width (162 px), top edge 15% down (288 px), 6% in from the side (65 px). Wide: 8% of the width (154 px), top edge 5% down (54 px), 3% in from the side (58 px) | guide: its logo page shows six marks [B1]. The asset folder holds each as `.svg` and `.png` in navy, fog, mist, sand and white (`brand-guide.md`; the folder was not listed again for this version). Which mark: measured on the guide's page, the stacked wordmark's letters are 17% of its width, so 28 px tall at 162 px. The primary wordmark's are 10% of its width, so 16 px. The monogram's B would be 59 px, but the letters in its ring about 11 px, and the stamp has only the ring [M11]. So the stacked wordmark is the one mark whose words can be read at this width: my judgement, not seen on a phone. The two marks with her name say Holder and are left alone (K4). The tool does not look at the picture to choose white or navy: that is a later step. seen: a logo near the top in four peers [O1]. Amy Porterfield's is 16% of the width, 6 to 9% down [O3], which is above Meta's line [P11]. Our place: guess. The top edge is 15% now, not 14%, so that it is not above the 288 px line one reading gives for Shorts [P23]. A known exception: the top right corner is inside the 192 px strip which that same reading keeps clear on Shorts. A logo is not a caption: little is lost when a button covers it. If a phone shows it covered, move it to the top left, where the reading keeps only 48 px clear. The wide place is used by no job today: the Full episode shows no logo (D4) | Brand kit |
| K4 | Name on screen | one spelling | Sallie Ogden | Jason's decision of 2026-10-13. The show and the site say Sallie Ogden [O2]. The guide's two name logos say Sallie Holder, and one of its samples says "Sallie H." [B1], so those two logos are not used in a video. The guide's PDF was made in February 2022 [M11]. | Brand kit |
| K5 | Opening and closing card | none / a clip or a picture for each | none | OpusClip's template takes one intro and one outro, up to 1 minute each [V3]. YouTube allows a shared intro and outro [P7] | Brand kit |
| K6 | Call to action | none / a picture or a line of words | none | OpusClip's "Overlay" is a logo or a call-to-action picture [V3] | Brand kit |

**The typefaces: who sells them, and what a licence covers.** No font file is in the asset folder, and neither face is on this Mac [M7]. Someone held both in February 2022, when the guide was made in Adobe Illustrator [M11]. Who holds a licence today is question 1.

*Sweet Sans Pro.* Drawn by Mark van Bronkhorst in 2011 and published by MVB Fonts: nine weights from Hairline to Heavy, each with an italic [V28]. The guide's PDF carries its maker's line, Markanna Studios Inc. [M11]. It can be held three ways.

| Where | Kind of licence | Does it cover words set in a video | Cost |
|---|---|---|---|
| Adobe Fonts | It comes with a Creative Cloud subscription. The face is switched on through Adobe's app. No font file is handed over | Yes, by Adobe's page for the family: it lists video among the uses and says the whole library may be used for personal and commercial work [V29]. Adobe's page of licensing questions is said to name film, broadcast and online video too. That is from a search summary: the page itself returned an error, so not confirmed first-hand | Nothing beyond the subscription. This Mac has the Creative Cloud app and Photoshop 2026 in its Applications folder [M11]. Which plan that is, and whether it carries the font library, is not confirmed. A 2018 news report says every paid plan does, the Photography plan included (search summary) [V29] |
| MyFonts | A Desktop licence, priced by the number of users. The page says the licence is for the buyer only and cannot be shared in a team. Jason runs the tool and Sallie edits in Final Cut Pro, so the two may count as two users | Yes. Its Desktop licence lists videos and social posts. It does not cover digital ads, apps, websites, or passing the font to anyone else [V30] | From $79.00 a style, and $699.00 for the family of 12 styles, which holds the guide's three weights. Three styles at $79.00 would be $237 (arithmetic). The price in the cart for one user, or for two, was not seen: not confirmed [V30] |
| Type Network, where MVB's own "Buy" buttons lead | A desktop licence for each user | Yes. Its support page says a desktop licence covers video in any format, broadcast included. It asks for a server licence when a program sets text for more than one user, which the tool does not [V28] | Not confirmed. No price for Sweet Sans Pro was on the pages read [V28] |

MVB's own licence text was not found: not confirmed. The tool is a program that draws words into a picture for one person on one Mac. Whether a seller counts that as desktop use is for the seller to say: not confirmed.

*Sinthya.* By Sronstudio (Yusron Billah), 2019. The guide's PDF carries that name, so it is the same face [M11]. It is sold on Creative Market, where a Desktop licence is $25.00 a seat [V31]. Creative Market's Desktop licence for fonts allows unlimited commercial projects, social media and paid ads among them, so long as the font is turned into a picture in what is made. It does not name video: not confirmed, though words drawn into a video are a picture of the font and not the font. It says the font may be stored only where the licence holder alone controls it [V31]. A free copy is offered for personal use only. It is not for a business [V31].

*Varela*, the guide's alternate for sales pages. By Joe Prince (Admix Designs), on Google Fonts since 2011, under the SIL Open Font License [V32]. It has one weight, Regular. The line the guide labels "Varela Bold" is set in that same weight [M11]. The licence's own questions page names video titling among the uses that need no further permission, and lets the font file be kept with a program so long as its licence text goes with it [V32]. No cost.

*Lucida Grande*, the guide's alternate for emails, in Regular and Bold, and *Avenir*, in several weights, are on every Mac. Apple's licence for macOS lets its fonts be used to show and print content on the Mac, and does not name video [V33]. Not confirmed for a video that a business posts.

**What stands in until the font files are at hand.**

| For | Stand-in | Why | Its limits |
|---|---|---|---|
| The tool's tests | Avenir: Light, Roman and Medium | It is on every Mac, so a test needs no file, no download and no licence question. It has a face for each of the guide's three weights: Light, Roman for Regular, and Medium. There is no face called Avenir Regular, so the tests' own table from weight to face name gives `Avenir-Roman` for regular. Avenir Next has no Light [M7] | It is narrower than Sweet Sans Pro. At the same capital height its sentence-case lines are 0.87 as wide and its capitals 0.82 [M11]. So a test in Avenir proves the code, not the fit |
| Real videos | Varela | It is the guide's own alternate. Its licence is free, names video, and lets the file sit beside the tool. And it is close in width: 0.93 of Sweet Sans Pro in sentence case and 0.90 in spaced capitals, measured on the guide's own type page. Of the faces on this Mac only Verdana comes as close in sentence case (0.94), and its capitals are 0.84 [M11] | One weight, so Light, Regular and Medium all come out the same, and a headline is told apart only by its capitals and its spacing. The guide allows its alternates only where Sweet Sans cannot be used, and names Kartra: a video is a stretch of that, for Jason and Sallie to allow (question 2). It is not on this Mac: getting it is one download (question 6) |
| The script | Nothing, in real videos | Another script would be a new piece of the brand that nobody chose. Until Sinthya's file is at hand, a word marked for the script is drawn in the headline's capitals like the words beside it | In the tool's tests only: Snell Roundhand, which is on every Mac and is 1.07 as wide as Sinthya on the guide's two sample words [M11] |

Lucida Grande is second in the kit's list, after Varela. It is the guide's alternate for emails and it is on every Mac. So it is what is drawn when Varela's file is not there, which is the case today and stays the case if Jason says no to the download. It is not first: its capitals are narrower still (0.79 of Sweet Sans Pro's), it has no weight between Regular and Bold, and Apple's licence does not speak of video [M11][V33]. It is drawn in Regular for every weight, as Varela is: a guess, since the guide's page of alternates sets its headline line in Lucida Grande Bold [B1]. When no face of the list is found, no words are drawn, and the person is told (2.4).

### 1.2 The job

**A. Cut and pacing**

| # | Setting | Values it can take | Default | Where the range comes from | Owner |
|---|---|---|---|---|---|
| A1 | Mistakes taken out | each of three on or off: retakes, false starts, spoken cues | all three on | today [R1]. Which to leave in for an unpolished style: guess | Job |
| A2 | A pause counts as long from | 0.4 to 2.0 s. Must be more than twice A3 | 1.5 s | today [R2]. measured: pauses peak near 0.5 s and 1.6 s. The long group, centred near 1.6 s, is only 14% of unscripted pauses, and 2.8% of them pass 2 s. This is about one hour of French interviews with ten speakers, not English and not a coach to camera [S1]. rule of thumb: Submagic's three paces [V2]; 0.3 to 0.5 s for natural speech [V8] | Job |
| A3 | Silence kept each side of a cut | 0.1 to 0.3 s (so a long pause becomes 0.2 to 0.6 s) | 0.2 s (a pause becomes 0.4 s) | today [R2]. It is also the breath left beside every other cut. Floor: the tool's word times are off by a tenth to a third of a second [R1] | Job |
| A4 | What counts as silence | quieter than -30 to -35 dB, for 0.25 to 0.5 s | -35 dB for 0.3 s | today [R2]. rule of thumb from one vendor: -30 to -35 dB, start at -30 dB and 0.3 s [V4]. The tool's -35 dB is at the edge of that range | Job |
| A5 | The join | plain cut / Flow (6 frames, Final Cut only) / cross dissolve | plain cut | official: Apple's Flow is made for the join left when a pause is cut from an interview [A5] | Job |
| A6 | Speed | 100 to 110% | 100% | measured: little cost at 1.5 to 2 times, worse beyond 2 times; the experimenters set the speeds; the full paper could not be opened [S3]. 76% of edX sessions ran at normal speed [S2]. Pitch is kept by default in Final Cut [A8] | Job |
| A7 | Check markers | none / at 3 s / at 30 s | 3 s on clips, 30 s on an episode | official: Instagram counts who is still watching at 3 s [P15]; YouTube counts 30 s [P5] | Job |
| A8 | Idea markers (where words on screen, a graphic or a cutaway would help) | off / on, six at most for a video | on | today: Claude is asked for up to six ideas, each on a kept phrase, and each idea whose phrase is kept becomes a marker in the Final Cut file [R5]. rule of thumb: three to six cutaways in a 60 s clip [V3]. There is no b-roll to add, only a marker | Job |

**B. Framing and zooms**

| # | Setting | Values it can take | Default | Where the range comes from | Owner |
|---|---|---|---|---|---|
| B1 | Layout of the frame | as recorded / fill, with the larger face in the middle / split, by hand / fit with bars | fill for upright, as recorded for 16:9 | today [R3]. OpusClip's layouts [V3]. official: Instagram shows bordered Reels less [P13], so "fit with bars" is listed only to rule it out | Job |
| B2 | Base scale | 100 to 112% | 100% | computed: a 3840 x 2160 recording gives a crop 1214 px wide, shown at 89%. A 1920 x 1080 one gives 606 px, enlarged to 178% [R3] | Job |
| B3 | Zoom | none / punch-in on every other kept stretch / slow push | none | Kinds as AutoCut offers them [V8]; Apple's pan and zoom is the slow push [A6]. rule of thumb: change framing only at the start of a sentence [V10] | Job |
| B4 | Zoom amount | 104 to 112% | 108% where there is a zoom | rule of thumb: 110 to 115% [V9]. 108% is the audience report's proposal: guess. 112% is the most a 4K recording allows with no loss | Job |
| B5 | Shortest hold before the framing changes | 3 to 12 s | 5 s where there is a zoom | guess. One vendor's article advises breaking any hold over about 12 s in a podcast clip [V26] | Job |
| B6 | Split edit (sound leads or trails the picture) | 0 / 0.5 s / 2 s | 0 | rule of thumb [V11]. Needs two pictures and a person | Job |

**D. Which titles and graphics there are**

| # | Setting | Values it can take | Default | Where it comes from | Owner |
|---|---|---|---|---|---|
| D1 | Hook headline | none / when a line is given: from which second, for how many seconds, how many words at most | none on 16:9. On clips: when given, from 0 s, for 3 s, 8 words at most | official: Instagram says opening text in the first frame works as a headline [P14]. today: Claude drafts a hook of at most eight words for each clip [R5]. One vendor's count: a banner gone by about 5.5 s [V26]. 3 s: guess. Eight words is a ceiling. What fits two lines at a caption style's size is less: about 27 characters, which is 4 or 5 words (rule 8) | Job |
| D2 | Name title | none / when a guest's name and role are given, for some seconds | none | 4 s is a guess | Job |
| D3 | Steps | none / shown, when the steps are given | none | seen: Sallie's own side panel (8 Oct) [O2]; Ali Abdaal's and Dan Martell's layouts [O1]. Timings: guess. Card or panel is not the job's to say: the frame decides, and the caption style holds both looks (T3) | Job |
| D4 | Logo shown | no / yes | yes on an upright job, once the brand kit has a file. No on a wide one | seen in four peers [O1]. Nothing is drawn on the tool's 16:9 rough cut, so a logo has no route onto a wide job yet (4.1) | Job |
| D5 | Chapters | none / at each new topic | none on clips, on for an episode | official: YouTube takes chapters from times typed in the description: the first at 00:00, three at least, each 10 s or longer [P25]. measured: about 6 minutes of attention whatever the length [S2] | Job |
| D6 | Opening and closing card shown | no / yes, for some seconds | no | [V3]. Needs files and words from Sallie | Job |
| D7 | Call to action shown | no / yes: when, and for how long | no | [V3]. For a coach, the end of a clip is where it asks for the next step (my judgement) | Job |

**F. Sound**

| # | Setting | Values it can take | Default | Where the range comes from | Owner |
|---|---|---|---|---|---|
| F1 | Loudness | -14 LUFS with true peak -1 dB / -16 LUFS with true peak -1 dB | -14, -1 | official for sound platforms only: Spotify -14 and -1 [P24]; Apple Podcasts -16 give or take 1, and -1 [A19]. No video platform publishes a number [P9]. ffmpeg's loudnorm defaults to -24 and -2, so both are written out [M8] | Job |
| F2 | Voice clean-up | off / light / full | light | light: cut below 80 Hz, then level. full adds noise reduction, a de-esser, a compressor and a limiter: rule of thumb from one guide written for sung vocals [V12]. Zoom already suppresses noise by default [V27], so full would clean a Zoom voice twice | Job |
| F3 | Music | none / a bed, some dB under the voice | none | W3C's strictest level asks 20 dB under speech, for sound-only recordings. It is borrowed here as a careful start, not a rule for video [W2]. rule of thumb: 12 to 18 dB [V13]. Licences differ by platform [V15] | Job |
| F4 | Sound effects | off / up to 3 to 5 moments, at least 6 dB under the voice | off | rule of thumb [V14] | Job |

**G. Shape, length and delivery**

| # | Setting | Values it can take | Default | Where it comes from | Owner |
|---|---|---|---|---|---|
| G1 | Shape | 16:9 (1920 x 1080 at most) / 9:16 (1080 x 1920) / as recorded when upright, and 9:16 fill when wide | set by the job | official [P1][P10]. today: a 16:9 rough cut and an upright version [R1]. The rough cut never enlarges, so a 16:9 file made from a Zoom recording stays 1280 x 720 or 640 x 360 [R2]. An upright file is always made 1080 x 1920 [R3] | Job |
| G2 | Length | the least, a range to aim for, and a cap | least 15 s, aim 30 to 60 s, cap 90 s | official: Instagram says 15 to 60 s suits most formats [P14] and shows Reels up to 3 minutes to non-followers [P12]. measured on brand accounts: 45 to 60 s did best on Reels [S6]. The 90 s cap is the tool's own (`reframe.js` line 121). today: 15 to 90 s is asked of Claude and noted, not enforced. A clip outside it is still cut, and the notes say it does not fit a Reel [R5]. "A boosted Reel is 90 s at most" is not confirmed [P16] | Job |
| G4 | Goes to | Reels / Stories / Shorts / YouTube / LinkedIn | set by the job | The places Sallie posts. "Stories" in this list is what turns Story parts on. There is no separate switch, and so no G3. official: 60 s a Story through the API [P10]. today: every clip over a minute is also cut into parts of 60 s at most, on a pause, wherever it goes [R5]. measured: over 75% of viewers stay through 7 parts [S7] | Job |
| G5 | File | standard (Part 3) / standard plus a podcast sound file | standard | Part 3. The podcast file's -16 LUFS is a platform fact kept in the tool's table, not a second loudness setting [A19] | Job |
| G6 | Pieces | the whole cut, always / the whole cut when it is under the cap, and otherwise up to 5 clips | set by the job | today: the upright version of the whole cut is always made, whatever its length, and beside it up to five clips. Only Claude picks clips, so a run that does not ask Claude makes none [R5] | Job |
| G7 | Caption file | always written. Lines, characters a line, shortest and longest time, characters a second | 2 lines of 42 characters, 0.83 to 7 s, 20 characters a second | official: captions are needed for recorded video (WCAG 1.2.2) [W3]. Netflix: 42 characters, 2 lines, five sixths of a second to 7 s, 20 characters a second for adults [W4]. DCMP: 1.33 s to 6 s [W6]. today: lines of up to 60 characters [R2] | Job |
| G8 | Speaker names and sounds in the caption file | none / added by hand | none; by hand for an interview | official: captions carry who speaks and sounds that matter [W3]; Netflix asks for a name in square brackets when the picture does not show who speaks [W4]. The tool does not know who is talking [R3] | Job |

### 1.3 The caption style

Every size is the height of a capital letter as a share of the frame's height. That is what the eye sees, and it stays the same when the typeface changes. The tool works out the font size from the face's own shape. Sweet Sans Pro's capitals are 0.653 of its font size, by the record in the guide's PDF. By the same record Varela's are 0.698 and Sinthya's 0.680. Avenir's are 0.708, measured here [M11].

| # | Setting | Values it can take | Default | Where the range comes from | Owner |
|---|---|---|---|---|---|
| C1 | Running captions drawn | no / yes | yes on upright | seen: no long video in the field burns captions in [O1] | Caption style |
| C3 | Typeface role and weight | "text", "headline" or "script" from the brand kit, and one of that role's weights | text, Medium | guide: Sweet Sans Pro [B1]. The guide's weight for running text is Light, and it shows it as paragraphs on a flat pale page. A caption is a few words over a moving picture, so it takes Medium, the heaviest weight the type page names: my judgement, to be tried on a phone beside Regular. The guide's own samples set short sentence-case lines in a weight heavier than Light [B1] | Caption style |
| C4 | Case | sentence / lower / capitals | sentence | seen: lower or sentence case for 9 of 11 [O1]. official: mixed case (DCMP) [W5] | Caption style |
| C5 | Capital height, upright and wide | upright 1.8 to 3.6%; wide 2.5 to 4.5% | upright 2.5% (48 px on a 1920 frame; a font size of about 74 px in Sweet Sans Pro). wide 3.3% (36 px on a 1080 frame; a font size of about 55 px) | counted in pixels on three frames: whole letter height 2.8 to 3.6% of the frame, so capitals of about 2.0 to 2.6% [O3]. The draft's "3.6%" was a font size. Final Cut's Subtitle default is a font size of 4.6% [M3]; the wide 3.3% was worked from it with capitals at 0.71 of the size, which is Avenir's share, and is kept. rule of thumb: 2.5 to 3.1% [V3], 2.6 to 5.2% [V4]. For scale: the capitals of the guide's own running text are 2.0% of its page's height [M11] | Caption style |
| C6 | Words at once and lines, upright and wide, and on a wide frame the most characters a line | 1 to 8 words; 1 or 2 lines; a most number of characters, or none | upright: 2 to 4 words (1 when the phrase is one word), 1 line, and no number of characters: the line's width is the limit (C13). wide: up to 8 words, 1 line of 42 characters | seen: 1 to 4, mostly 2 or 3 [O1]. official for wide: 42 characters a line [W4]. That is a caption standard's figure and not a fit, so it is stored. Eight words are about 42 characters (arithmetic). How many characters fit the upright line is not stored. The tool works it out from the face it draws, the size and the widest line, and writes it into the settings file (5.3). In Sweet Sans Pro it comes to 18: by the letter widths the guide's PDF records, about 19 characters fit the 691 px line. Of twelve sample lines every one of 19 characters or fewer fits and neither of 20 does, and 18 leaves a margin of one. A count is an average: in a checker's own sample one line of 18 characters is 721 px, which is why rule 1 measures each caption [M12]. In Avenir, the tests' stand-in, 22 fit [M11]. In Varela about 21 would, by its 0.93: arithmetic, not measured. What the short line costs is under C7 | Caption style |
| C7 | Shortest time on screen | 0.83 to 1.33 s | 0.83 s | official: Netflix five sixths of a second [W4]; DCMP 40 frames, 1.33 s [W6]. At 160 words a minute one word lasts 0.375 s and two last 0.75 s (arithmetic). Both are under the floor. So a caption needs three words, or two and a pause, and rule 4 joins what is shorter. In Sweet Sans Pro that is hard to keep. A line of 18 characters only just holds three words of average length, so many captions come out as two. Her own two stored episodes run at 148 words a minute, so two words last 0.81 s. Their 6,746 words were grouped the way 4.2 describes, with a sentence end standing for a pause. One or two words with no comma or stop after them: 27% of Plain's captions by Sweet Sans Pro's recorded widths, against 10% in Avenir. Boxed: 34% against 17%. Bold: 29% against 12% [M12]. Inside a sentence rule 4 cannot mend these. So the house style breaks its own floor on about a quarter of its captions: an estimate from two transcripts, not a test on video. Two things to try on a phone, both guesses: Plain at 2.2% (about 22 characters a line; 13% in the same run), or two lines allowed on an upright frame (0% in the same run, at the cost of a taller caption) | Caption style |
| C15 | Reading rate | at most 20 characters a second | 20 | official: Netflix, adult programmes [W4] | Caption style |
| C8 | Fill colour | a brand colour, by name | white | seen: white, except where a box sits behind the words [O1]. official: white (DCMP) [W5] | Caption style |
| C9 | Edge | none / soft shadow / outline | soft shadow: black at 65%, blur 0.5% of the frame's height (10 px on 1920), no offset | seen: no outline except Simon Sinek's; a soft shadow is written down for three creators [O1]. The numbers: guess. Vendors differ [V4][V5] | Caption style |
| C10 | Plate (a box behind the words) | none / a brand colour, its opacity, corner and padding | none | guide: a rounded rectangle is one of its five shapes, and holding words is one of the three uses it gives them [B1]. seen: a white rounded box with dark text where the picture is busy or boxed [O1]. rule of thumb: black at 70 to 80% [V4]. The widest line and the lowest edge (C13) are measured on the plate, so a plate leaves less room for the words | Caption style |
| C11 | Accent on a word | none / the word in a colour / the word on a box, with the box's colour, corner and padding | none | seen: no second colour in a running caption but Ali Abdaal's [O1]. official: contrast 4.5 to 1, or 3 to 1 for large text [W1]. The box has a corner and a padding of its own, and the widest line is measured on it | Caption style |
| C12 | Movement | none / fade / scale / highlight / fill; by word, line or all | none | official: Final Cut's own names [A2]; no more than 3 flashes a second [W3]. Nobody's caption movement was observed | Caption style |
| C13 | Place, upright and wide: the lowest edge and the widest line | upright: lowest edge 50 to 65% down. wide: 80 to 92% down | upright: lowest edge 65% down, line no wider than 64% (691 px). wide: lowest edge 90% down, line no wider than 80% | official: Meta says keep clear of the bottom 35% and 6% each side (written for ads) [P11]. seen: 58 to 75% down [O1]. 64% is arithmetic: a centred line that clears every reading in Part 3. The wide values: guess. Both are measured on the outside of whatever is drawn: on the plate or the accent box when there is one | Caption style |
| C14 | Emoji | off / on | off | seen: none in the 11 peers' frames [O1] | Caption style |
| T1 | The top band, and the hook headline's look in it | The band: where it starts and ends and its widest line, upright and wide. The headline: face, weight, case, capital height upright and wide, fill, edge or plate, a word or two in a second face, lines upright and wide | The band: 15% to 30% down and lines up to 64% of the width when upright; 8% to 25% down and up to 80% when wide. The headline: text Medium, sentence case, capital height 3.5% upright and 4.5% wide, white with the caption's shadow, 2 lines at most on either frame | Meta's top 14% [P11]; one third-party reading keeps the top 15% clear on Shorts [P23]. The band's widest line is the caption's, for the same reason (C13). Sizes, and every wide value: guess. No job shows a hook on a wide frame today. The band is named once, and every title that sits in it uses it: the hook, the upright name title and the upright steps card | Caption style |
| T2 | The name title's look and place | the same parts, for a name and a role, upright and wide | name in text Medium over role in text Regular, sentence case, white with the caption's shadow. Upright: capital height 2.5% and 1.9%, in the top band. Wide: 3.3% and 2.5%, at lower left, lowest edge 85% down, 6% in from the left, line up to 40% of the width | guess. The wide sizes are the upright ones scaled as the running caption is (2.5% to 3.3%). The last version gave one size for both frames: on a wide frame that was a 27 px capital, smaller than a caption. A Basic Lower Third ships inside Final Cut Pro [M2] | Caption style |
| T3 | The steps' look: a card when upright, a panel when wide | the same parts, upright and wide | steps in text Regular with the number in text Medium, sentence case, white on a solid navy plate with a corner of 0.8% of the frame's height (15 px on 1920) and padding of 1.0% (19 px), the current step in sand. Upright: a card in the top band, capital height 2.5%. Wide: a panel at the right, a third of the width, capital height 3.3% | Her own layout of 8 October [O2], set in the guide's colours. A navy block that holds words is one of the guide's shapes [B1]. White on navy is 13.9 to 1 and sand on navy 6.4 to 1 [W1][M11]. Typeface, sizes, corner and padding: guess. The corner and the padding are those of Boxed's plate (C10). An upright card holds three steps at this size (rule 8) | Caption style |

### 1.4 The look

| # | Setting | Values it can take | Default | Where it comes from | Owner |
|---|---|---|---|---|---|
| E1 | Recipe: exposure, contrast, saturation, warmth | none / exposure -0.5 to +0.5 stop; contrast and saturation -10 to +10%; warmth none, or 5,500 to 6,500 K | none | The audience report's proposal for a mild Moody: guess. No page gives numbers for a look. Final Cut Pro 12.4 ships 71 Color Grading Presets, 20 Color Board presets and 9 Styles [M4]. Which looks are popular: no data found. "None" means no colour filter is run at all. No Kelvin figure stands for "no change": at its own default of 6,500 K, ffmpeg's filter still turns grey 128 into (128, 127, 125) [M9] | Look |
| E2 | Strength | 0 to 100% | 100% for a look with a recipe; 0 for a look with none | The one strength of a look. It scales every number of the recipe, the vignette and Final Cut's Mix alike. Rule 6 lowers it on a small recording. Exposure, contrast and saturation are multiplied by it. Warmth is scaled through the colour filter's own mix, which runs from 0 to 1: at 6,000 K grey 128 came out (128, 123, 118) at mix 1, (128, 125, 123) at mix 0.5 and unchanged at mix 0 [M9] | Look |
| E3 | Vignette (darker corners) | 0 to 15% | 0 | guess | Look |
| E4 | Final Cut's match: a built-in preset by name, and its Mix at the look's full strength | none / one of the 71 Color Grading Presets; Mix 0 to 1 | none | The names were read in the app's own folders, not seen on screen [M4]. Every one of the 71 publishes Mix and Exposure [M8]. The Mix written into a Final Cut file is this Mix x E2's strength x rule 6's share | Look |

---

## Part 2. The jobs, the caption styles and the looks

Nothing here is called rising or fading. The frames show one fortnight, and no source measured a direction.

### 2.1 The jobs

| Setting | Full episode | Solo clip | Interview clip | Teaching clip | As filmed |
|---|---|---|---|---|---|
| A1 Mistakes taken out | all three | all three | all three | all three | retakes and cues. False starts stay |
| A2 Pause counts as long from | 2.0 s | 1.5 s | 2.0 s | 1.5 s | 2.0 s |
| A3 Silence kept each side | 0.3 s (a pause becomes 0.6 s) | 0.2 s (0.4 s) | 0.3 s (0.6 s) | 0.2 s (0.4 s) | 0.3 s (0.6 s) |
| A4 Silence is | -35 dB for 0.3 s | same | same | same | same |
| A5 The join | plain cut. Flow in Final Cut later: not confirmed | plain cut | plain cut | plain cut | plain cut |
| A6 Speed | 100% | 100% | 100% | 100% | 100% |
| A7 Check marker | 30 s | 3 s | 3 s | 3 s | 3 s |
| A8 Idea markers | on | on | on | on | off |
| B1 Layout | as recorded | fill, larger face in the middle | fill, larger face in the middle. Split by hand when there are two camera pictures | fill | as recorded when upright; fill when wide |
| B2 Base scale | 100% | 100% | 100% | 100% | 100% |
| B3 Zoom | none | punch-in on every other kept stretch (rule 5) | none | none | none |
| B4 Zoom amount | not used | 108% | not used | not used | not used |
| B5 Shortest hold | not used | 5 s | not used | not used | not used |
| B6 Split edit | 0 | 0 | 0 (0.5 s by hand with two pictures) | 0 | 0 |
| D1 Hook headline | none | when given: from 0 s, for 3 s, 8 words at most | none | when given: the number and name of the framework, from 0 s, for 3 s, 8 words at most | none |
| D2 Name title | when a guest is named: 4 s, at the guest's first words | none | when a guest is named: 4 s, from the start | none | none |
| D3 Steps | shown, when steps are given (on this wide frame they come as a panel) | none | none | shown, when steps are given (on this upright frame they come as a card). Each step is placed by hand | none |
| D4 Logo shown | no: nothing is drawn on the 16:9 rough cut | yes | yes | yes | no |
| D5 Chapters | at each new topic | none | none | none | none |
| D6 Opening and closing card | no | no | no | no | no |
| D7 Call to action | no | no | no | no | no |
| F1 Loudness | -14 LUFS, peak -1 dB | -14, -1 | -14, -1 | -14, -1 | -14, -1 |
| F2 Voice clean-up | light | light | light | light | off (level only) |
| F3 Music | none | none | none | none | none |
| F4 Sound effects | off | off | off | off | off |
| G1 Shape | 16:9, 1920 x 1080 at most. A smaller recording keeps its own size | 9:16, 1080 x 1920 | 9:16 | 9:16 | 9:16: as recorded when upright, fill when wide |
| G2 Length | as recorded | least 15 s, aim 30 to 60 s, cap 90 s | least 15 s, aim 45 to 90 s, cap 90 s | least 15 s, aim 45 to 90 s, cap 90 s | least 3 s, aim 15 to 60 s, cap 120 s. A longer cut is still made, and the person is told |
| G4 Goes to | YouTube | Reels, Shorts, Stories, LinkedIn. So Story parts are made | Reels, Shorts, LinkedIn. No Story parts | Reels, Shorts, LinkedIn. No Story parts | Stories, LinkedIn. So Story parts are made |
| G5 File | standard. A podcast sound file as well once she asks for one: off to start | standard | standard | standard | standard |
| G6 Pieces | the whole cut, always | the whole cut when under the cap; otherwise up to 5 clips | same | same | the whole cut, always |
| G7 Caption file | 2 lines of 42 characters, 0.83 to 7 s, 20 characters a second | same | same | same | same |
| G8 Speaker names in the file | by hand, when there is a guest | none | by hand | none | none |
| Default caption style | File only | Plain | Plain | Plain | Plain |
| Default look | Natural | Natural | Natural | Natural | Natural |

Where the values come from.
- **A2, A3.** 1.5 s and 0.2 s are today [R2]. 2.0 s and 0.3 s are the pacing researcher's proposal for calm speech: guess. All untested on her speech.
- **A1 for As filmed.** Small stumbles are said to signal a real person [S10]. No source says which to leave in: guess.
- **B3, B4, B5.** The audience report's proposal: guess. On a 1080-line or Zoom recording rule 5 leaves the punch-in out, so a Solo clip is one still framing throughout.
- **D2.** Two surnames are in use. The show and the site say Ogden [O2]. The guide's two name logos say Holder [B1]. The brand kit holds one spelling, Sallie Ogden, by Jason's decision of 2026-10-13.
- **D4.** The last version said yes for the Full episode, and nothing could draw it: the logo's overlay is built where upright files are made, and nothing is drawn on the tool's own 16:9 rough cut (4.1, 4.2). So the Full episode's switch is no. It becomes yes when an overlay step exists in `roughCutArgs`, or when a Final Cut file is shown to carry a picture: not confirmed. On the three upright clip jobs it is yes once question 4 has a yes.
- **F2.** Light everywhere to start. Try "full" on one real interview and listen before making it a default. Leave noise reduction off for sound that came through Zoom, which suppresses noise by default [V27].
- **G2.** Reels: 45 to 60 s did best on brand accounts, and Instagram says 15 to 60 s suits most formats [S6][P14]. LinkedIn's own advice is under 2 minutes [P20]; 120 to 180 s did best on company pages [S6]. The vendor's Diary of a CEO clips ran 66 to 139 s [V26]. A Short over 1 minute with a Content ID claim is blocked, which matters only if music is ever added [P2]. For As filmed: 3 s is the platforms' own floor [P10][P17], 15 to 60 s is Instagram's advice [P14], and 120 s is LinkedIn's "under 2 minutes" [P20]. Which of them suits a quick thought: guess. A cut over the cap is not trimmed, because this job's piece is the whole cut.
- **G4 and Story parts.** Parts are made only for a job that goes to Stories: Solo clip and As filmed. A clip of 90 s is two parts. A cut of 120 s is two or three. The tool cuts a part on the last pause in the 15 seconds before the 60 second mark, so the first part is often under 60 s, and what is left can then be over 60 s. Tried: a 120 s cut with a pause at 50 to 51 s gives parts of 51, 60 and 9 s [R3][M10]. A cap of 105 s would always give two (arithmetic). The cap stays at 120 s, and a short last part is for the person to drop. The "7 parts" finding [S7] never limits anything here.
- **G5.** The podcast file is off until Sallie asks for one (question 23). "Podcast" was in the last version's "Goes to" for the Full episode. It is not a place a video goes, and "File" already said it.

**Full episode**
- **Pick it for:** the long YouTube episode, solo or interview.
- **Known for it:** video podcasts such as The Diary of a CEO and Mel Robbins's show [O1].
- **Evidence:** large. YouTube reported over 1 billion monthly viewers of podcast content as of January 2025, one figure with no direction [P8]. An informal talking head at a desk held viewers about twice as long as a studio recording (one pair of courses) [S2].
- **Risk:** viewers give a teaching video about 6 minutes whatever its length [S2], so the first 30 seconds and the chapters matter more than polish. The cut suggestions have never met real speech [R1].
- **Here.** Today: the 16:9 rough cut, its caption file, and a Final Cut project with a marker at each join and at each of Claude's ideas for a graphic [R5]. To build first: the job's pause numbers read from its file, loudness, the delivery fixes of Part 3, a 30 s marker, the chapter list as text. Later: a guest's name title, a Flow join, the steps panel, a podcast sound file. By hand: checking the plan, where a chapter starts, speaker names in the caption file, the export, the upload.

**Solo clip**
- **Pick it for:** everyday solo clips. When in doubt, this one.
- **Known for it:** with Plain captions, this is the most common look in this month's sample: Alex Hormozi, Amy Porterfield, Mel Robbins, The Diary of a CEO [O1].
- **Evidence:** 45 to 60 s did best on Reels on brand accounts [S6]. Two second-hand summaries say Hormozi cut effects that do not help the lesson in 2026 [S15]. MrBeast said in March 2024 that he had slowed his cutting. Tubefilter counted 38 cuts in one minute of a March 2023 video and 23 in one minute of his newest: one minute from each, not a yearly rate [S4].
- **Risk:** her crop is tight because the recording is: her face fills about half the frame's height, against a fifth to a third for her peers [O2]. From 1080 lines the crop is enlarged to 178% and is soft [R3].
- **Here.** Today: an upright version of the whole rough cut, cropped on the larger face, and up to five clips picked by Claude (`<name>.reel-<n>.mp4`). Each clip comes with its caption file (`<name>.reel-<n>.srt`), its Story parts when it runs over a minute (`<name>.reel-<n>.story-<k>.mp4`), and a draft hook in the notes [R5]. Claude is asked for clips of 15 to 90 s, and one outside that is still cut. With `--rules-only`, with Claude Code missing, or after two failed calls there are no clips at all. To build: words in the picture, the punch-in, loudness, the delivery fixes, the length range held to, an upright Final Cut project. By hand: approving the hook, checking the cuts, posting.

**Interview clip**
- **Pick it for:** a clip cut from an interview.
- **Known for it:** The Diary of a CEO, Mel Robbins [O1].
- **Evidence:** best described, not measured. One page counts three upright Diary of a CEO clips: a hard cut every 4.1 to 6.3 s, clips of 65.8 to 138.6 s, no music, a title banner gone by about 5.5 s. The page is by PandaStudio, which sells a video editor. It names no counting method, gives no dates for the clips, and does not say they come from the show's own channel [V26]. So it is a rule of thumb.
- **Risk:** that page describes the opposite of this job on framing: seven speaker switches in 115.6 s, cutaways of 1 to 1.5 s, an angle change about every 6 s. That look needs two cameras and a person who knows who is talking. "No zoom, one crop" is the audience report's proposal: guess. With pauses cut only from 2.0 s, a 45 to 90 s clip can hold one framing throughout. The tool crops on the larger face and does not know who is talking [R3]. A Zoom call is sent at 1280 x 720 at most and recorded at 640 x 360 in several common cases [V16]: the upright crop of 720 lines is 404 px wide and is enlarged 267%. This job has no zoom and its default look is Natural, so rules 5 and 6 say nothing about such a file. Rule 10 does.
- **Here.** As Solo clip, plus a name title, and with no Story parts. It waits on question 10 (how interviews are recorded). By hand: who is on screen, any split layout, speaker names in the caption file.

**Teaching clip**
- **Pick it for:** a framework or a list, like her "5 constraints" video.
- **Known for it:** Ali Abdaal, Dan Martell (speaker above, whiteboard below), Codie Sanchez's long videos [O1].
- **Evidence:** educational videos had the highest engagement across 13 million business videos [S8]. Buffer's writer says LinkedIn wants to surface knowledge and advice from experts; the staff quote it carries is softer [S12]. No trend data.
- **Risk:** the steps are content, written for each video. The card and the panel are designed once in Motion. On her framing today rule 3 leaves the card out, because her face fills about half the frame [O2]. So this job works only once the shot is framed looser, or with the steps placed by hand in Final Cut. And the card is small: with its plate it holds three steps at its size (285 px of the band's 288) and four at 72%. A list of five, like her "5 constraints", does not fit above 70%, and rule 8 leaves the card out (arithmetic) [M12]. A card that shows the steps a few at a time has to be designed.
- **Here.** As Solo clip with no zoom. The card and panel wait on design work.

**As filmed** (the market's words are "raw" or "lo-fi")
- **Pick it for:** a quick thought on a phone.
- **Known for it:** no single creator. The platforms promote it.
- **Evidence:** TikTok says lo-fi video does well and a phone is the right quality (2024) [P21]. LinkedIn says simple selfie-style video lifts engagement by 11% (its own figure, no method) [P20]. In a HubSpot survey 63% preferred relatable video to polished video, with Gen Z the other way at 52 to 48 [S9]. Hootsuite's 2026 trends report says over-editing is out [S10]. Advice and tips are the kind of video people most expect captions on (55% of 5,616 US adults, 2019) [S11], which is why this job draws Plain captions.
- **Risk:** the sound still has to be clear. Next to a premium brand it can look careless if it is the only style used.
- **Here.** It needs three things nothing else builds: a switch for each cut rule; a full-size file from an upright recording (today a 1080 x 1920 phone video comes out 608 x 1080, and no upright version is made for it) [M8]; and Story parts of a whole cut, which today are made only for a clip Claude picked [R5]. It never needs Claude to pick a clip, so it works with `--rules-only` too.

### 2.2 The caption styles

| Setting | File only | Plain | Boxed | Bold | Signature |
|---|---|---|---|---|---|
| C1 Running captions drawn | no | yes | yes | yes | yes |
| C3 Typeface | none | text, Medium | text, Medium | text, Medium | text, Medium |
| C4 Case | none | sentence | sentence | capitals, with no added letter spacing | sentence |
| C5 Capital height, upright / wide | none | 2.5% (48 px) / 3.3% (36 px) | 2.5% / 3.3% | 3.5% (67 px; a font size of about 103 px) / 4.5% (49 px) | 2.5% / 3.3% |
| C6 Words at once, upright | none | 2 to 4 words, 1 line. No number of characters is stored. In Sweet Sans Pro 18 fit | 2 to 4 words, 1 line. None stored. In Sweet Sans Pro 17 fit | 2 to 4 words, up to 2 lines. None stored. In Sweet Sans Pro about 9 fit a line | 2 to 4 words, 1 line. None stored. In Sweet Sans Pro 18 fit |
| C6 Words at once, wide | none | up to 8 words, 1 line of 42 characters | same | up to 3 words, 1 line, 20 characters | up to 8 words, 1 line of 42 characters |
| C7 Shortest time | none | 0.83 s | 0.83 s | 0.83 s | 0.83 s |
| C15 Reading rate | none | 20 characters a second | 20 | 20 | 20 |
| C8 Fill | none | white | navy | white | white |
| C9 Edge | none | soft shadow: black 65%, blur 0.5% of the height, no offset | none | soft shadow, same | soft shadow, same |
| C10 Plate | none | none | mist, solid, with the guide's rounded corners: corner 0.8% of the height (15 px on 1920), padding 1.0% (19 px). Navy on mist is 10.9 to 1 | none | none |
| C11 Accent | none | none | none | the one stressed word in navy on a sand box, when a word is given. The box: corner 0.8% of the height (15 px), padding 0.5% (10 px). Navy on sand is 6.4 to 1 | none |
| C12 Movement | none | none | none | none | fade, by line |
| C13 Place, upright | none | lowest edge 65% down, line up to 64% of the width (691 px) | same, measured on the plate. So the words are 653 px at most, 60% of the width | same, measured on the accent box when the stressed word starts or ends a line | same |
| C13 Place, wide | none | lowest edge 90% down, line up to 80% of the width | same, measured on the plate | same, measured on the accent box | same |
| C14 Emoji | off | off | off | off | off |
| T1 The top band, upright / wide | same as Plain | 15% to 30% down, lines up to 64% of the width / 8% to 25% down, lines up to 80% | same, measured on the plate | same | same, measured on the plate |
| T1 Hook headline: look | same as Plain | text Medium, sentence case, white, the caption's soft shadow, no plate | text Medium, sentence case, navy on a mist plate as C10, no shadow | text Medium, capitals, white, the caption's soft shadow | headline (Medium capitals, letter spacing 0.10), white on a solid navy plate, corner 0.8% of the height (15 px on 1920), padding 1.0% (19 px), no shadow. White on navy is 13.9 to 1. One or two words in the script, white, on a line of their own, when they are given |
| T1 Hook headline: capital height upright / wide, and lines upright / wide | same as Plain | 3.5% / 4.5%; 2 lines at most on either frame | same | same | capitals 2.5% / 3.3%, the script 3.0% / 4.0%; 3 lines at most upright and 2 wide, the script's line among them |
| T2 Name title: look | same as Plain | name in text Medium over role in text Regular, sentence case, white, soft shadow | the same in navy on a mist plate, no shadow | name in text Medium capitals over role in text Regular, sentence case; white, soft shadow | name in headline (Medium capitals, letter spacing 0.10) over role in text Regular, sentence case; white, soft shadow |
| T2 Name title: capital height of name and role, upright / wide | same as Plain | 2.5% and 1.9% / 3.3% and 2.5% | same | same | same |
| T2 Name title: place, upright / wide | same as Plain | the top band / lower left: lowest edge 85% down, 6% in from the left, line up to 40% of the width | same | same | same |
| T3 Steps: look | same as Plain | steps in text Regular, the number in text Medium, sentence case, white on a solid navy plate, corner 0.8% of the height (15 px on 1920), padding 1.0% (19 px), the current step in sand. White on navy is 13.9 to 1, sand on navy 6.4 to 1 | same | the same in capitals | the number in headline (Medium, letter spacing 0.10), the steps in text Regular; the same colours |
| T3 Steps: capital height and place, upright / wide | same as Plain | 2.5%, a card in the top band / 3.3%, a panel at the right, a third of the width | same | same | same |

"None" in the File only column is one value in its file: `running` is `null`, and that is what "no captions drawn" means there. "Same" in any cell means the same value, written out again in that style's own file. No file reads another, File only's titles included.

Where the values come from.
- **File only still has title looks.** A job may ask for a name title on a full episode, and it must be drawn in something. File only's own file holds title looks. Today they are the same values as Plain's.
- **On a Full episode a caption style changes only the titles.** Rule 9 draws no running captions there. So the wide values of C5, C6 and C13 are used by no job today. They are kept so that every style is whole for both frames, and for a wide job that may one day go where no caption file is taken.
- **C3 and C4.** Every style is in Medium, the heaviest of the three weights the guide's type page names. The family is sold in two heavier ones, Bold and Heavy [V28], and the guide's PDF itself sets one heading in Bold [M11]. The type page names neither, so no style uses them. Light, the guide's weight for running text, is in the kit and no style uses it yet: its strokes are the thinnest of the three, and every style here sits over a moving picture or is a short title. Bold's capitals are set close, with no added letter spacing. The guide's type page spaces its capitals wide, and one of its social samples sets them close [B1]. Spaced capitals at Bold's size would hold under 9 characters a line [M11].
- **C5.** Counted in pixels on three frames today: Alex Hormozi's letters with ascenders are 40 px tall (2.1% of the frame), Amy Porterfield's whole letter height is 59 px (3.1%), The Diary of a CEO's is 69 px (3.6%) [O3]. So the audience report's "3 to 4%" is the whole letter, which is close to a font size, and the capitals alone are about 2.0 to 2.6%. Plain's 2.5% is near the top of what was counted. To be tried on a phone.
- **C6 for Bold.** Sweet Sans Pro is a wide face. By the letter widths the guide's PDF records, at Bold's size (a font size of about 103 px) a capital with its share of spaces takes about 73 px, so about 9 fit in 691 px. "YOUR TEAM" is 656 px and "RAISE YOUR" 683 px. "PRICES NOW" is 719 px, and "BUSINESS GROWTH" is 1,114 px, wider than the frame. In Avenir Medium, the tests' stand-in, the same four lines measure 554, 550, 590 and 898 px, and about 11 capitals fit [M11]. Rule 1 catches what does not fit. The last version said "one or two words", and that broke the floor this report uses to leave out one word at a time. At 160 words a minute one word lasts 0.375 s and two last 0.75 s. Both are under 0.83 s, so every Bold caption would have tripped rule 4. Bold is now two to four words on two lines, shown for 0.83 s or more. Four words are about 23 characters and two lines hold about 18, so four fit only when they are short, and three is the usual most (arithmetic). At 3.0% about 11 capitals would fit a line: the size to try if too many words are drawn small.
- **C9.** The kind is seen [O1]. The numbers are the audience report's proposal: guess.
- **C10, C11.** Corner and padding: guess. The corner is close to the guide's own: on its shapes page the outlined box that holds words has a corner of 15% of its height, and a one-line caption plate with a 15 px corner comes to 18%, measured on its capitals [M11]. The guide pads its box more, by about one and a half capital heights. A caption plate padded like that would leave about 15 characters a line, so the padding stays at 19 px: a thing to try. Boxed is navy on mist and not white on navy because the guide asks for mist, smoke or dew behind a design, for its light and airy feel [B1], and running captions are on screen the whole time. Mist and not smoke, because Boxed is picked for a bright picture: against pure white, mist stands at 1.28 to 1 and smoke at 1.07, so a smoke box has almost no edge on a white wall [M11]. The pink box in one of Leila Hormozi's frames is the model for Bold's accent [O1]. Its colour is sand, with navy words at 6.4 to 1. Dune would give 7.7 to 1, but it is paler and nearer the white words beside it [M11]. The accent box has a corner and a padding of its own. Over the picture, sand is only ever a box behind navy words: as a colour for words it fails on a bright picture (2.2 to 1 against white) [W1]. On the navy plate of the steps it is the colour of the current step, at 6.4 to 1.
- **C13.** The draft's line of 70% of the width, centred, ran 30 px into the strip that one third-party reading keeps clear on Shorts [P23]. 64% (691 px) clears it. Arithmetic from the figures in Part 3, not a platform's number. With Boxed's plate the last version did not clear it: the plate adds 19 px each side, so a line of 691 px became a box of 730 px, 17 px past the strip on each side. The widest line is now measured on the box. Boxed's words are then 653 px at most, and its line holds 17 characters, not 18: by Sweet Sans Pro's recorded widths one 18-character line is 680 px, and three of 19 characters are 629, 650 and 655 px [M11]. Sallie's upright captions sit at about 78 to 83% down today, inside the zone Meta says to keep clear [O2].
- **T1, T2, T3.** All sizes and places: guess. A title's widest line is its place's: the top band's, or the wide name title's own. How many characters of a hook fit is in the notes on rule 8. Every wide size, the wide name title's left edge and widest line, and the steps' typeface and size are guesses too. Signature's headline is smaller than the others (2.5% against 3.5%) because the guide's headline is wide and not tall: with its letter spacing a capital takes about 57 px at 2.5%, and the guide's own samples stack three or four short lines of small spaced capitals [B1][M11]. Three such lines fit the upright band. They are 48 px of capitals and two line steps of 99 px, at the headline role's line step of 1.35 of the font size (K2), which is 246 px, and the plate's padding makes it 285 px of the band's 288 (arithmetic). The fit rests on that step: at 1.40 the three lines come to 292 px [M12]. The wide band is 184 px tall, and three lines of capitals at 3.3% come to 205 px with the plate. So on a wide frame the headline has two lines at most, which come to 131 px (arithmetic): a guess, as every wide value is. The steps are white on navy in every style, because on a mist plate only navy passes 4.5 to 1 and the current step would have no colour to take: fog on mist is 4.2 to 1 [M11]. Signature sets the number of a step in the headline role. A style's headline never says how many words: that is the job's (D1).

**File only**
- **Pick it for:** the long episode on YouTube.
- **Known for it:** every long video seen in the field: none burns captions in [O1].
- **Evidence:** YouTube takes an .srt [P4]. LinkedIn's page on attaching an .srt from a computer is marked "5 years ago", and its newer captions page describes only automatic captions: not confirmed as current, so try it once on a real post [P19]. A file upload for Shorts, Reels and Stories was not found.
- **Risk:** on a Reel or a Story a viewer with the sound off gets nothing. Rule 2 draws Plain there.
- **Here.** Today: `<name>.rough-cut.srt`, in lines of up to 60 characters. To build: lines of 42 characters and the reading-rate limit. By hand: checking the words; speaker names.

**Plain**
- **Pick it for:** everything, unless there is a reason not to. The house style.
- **Known for it:** small white text with no outline and no second colour is the main look for 7 of the 11: Alex Hormozi, Codie Sanchez, Mel Robbins, Amy Porterfield, Marie Forleo, The Diary of a CEO, Dan Martell [O1].
- **Evidence:** the most common look in this sample now; direction not measured. One tool maker's guide ties it to B2B, education and professional brands [V4][V5]. No independent test shows that any caption style holds viewers better than another [O1].
- **Risk:** small white text can vanish on a bright picture; the shadow has to do the work. In Sweet Sans Pro its line holds about 18 characters, so about a quarter of its captions come out as one or two words inside a sentence, under the 0.83 s floor, where rule 4 cannot join them: 27% in her two stored episodes, against 10% in Avenir. An estimate, not a test on video [M12]. Two things to try on a phone are under C7 in 1.3: 2.2%, or two lines. A caption changes on a word's time, and the tool's word times are off by a tenth to a third of a second, on a caption that lasts about a second [R1][R2]. Only the start and end of a whole phrase sit on a pause that ffmpeg heard. So try two to four words on real speech before fixing it, and break a caption at a heard pause where there is one.
- **Here.** To build: a caption builder and the drawing (Part 4, route 3). Drawing was tried on made-up video for outlined capitals, and once more with a soft shadow and a pale plate [M6][M8]. In Final Cut: route 1 by hand at first.

**Boxed**
- **Pick it for:** a busy or bright picture, where white words would not read.
- **Known for it:** Mel Robbins in 1 of her 4 frames, and that frame is a wide clip set in black bars. Codie Sanchez's stage clip. Ali Abdaal's pale pill. Dan Martell's title [O1]. Neither Mel Robbins nor The Diary of a CEO uses a box in their other 5 frames.
- **Evidence:** seen only. Navy on mist is 10.9 to 1, far over the 4.5 to 1 asked [W1]. The other way round, white on navy, is 13.9 to 1 and was not chosen: a navy box under every caption is the opposite of the light and airy feel the guide asks for [B1].
- **Risk:** a box hides more of the picture, and on her tight crop that is her chin or the microphone [O2]. Its line is shorter than Plain's, 17 characters in Sweet Sans Pro, so more of its captions are short: 34% come out as one or two words inside a sentence in the same run, against 17% in Avenir [M12].
- **Here.** Plain's drawing, plus the box. Final Cut's own Subtitle title has a background colour, an opacity and a corner radius [M3].

**Bold**
- **Pick it for:** testing a hook on people who do not know her: a trial Reel, or the first seconds of a clip. Then back to Plain.
- **Known for it:** Simon Sinek's outlined capitals, and half of Leila Hormozi's frames [O1]. Tool makers still sell the look under Alex Hormozi's name: Submagic's Hormozi 1 to 5, OpusClip's Mozi and Beasty [V2][V3]. His own four sampled frames do not use it [O1].
- **Evidence:** a minority in this sample now; vendors still sell it; direction not measured. One vendor calls the yellow-and-emoji version saturated and unfit for consulting: opinion, no study [V6].
- **Risk:** it can read as marketing-guru content [V6]. All capitals go against the caption rule of mixed case [W5]. Sweet Sans Pro's capitals are wide: about 9 fit a line, so a caption takes two lines, and many words have to be drawn smaller. By its recorded widths ACCOUNTABILITY has to be drawn at 69%, TRANSFORMATION at 65% and ENTREPRENEURSHIP at 58%. In Avenir, the tests' stand-in, the same words need 85%, 79% and 73% (rule 1) [M11]. In her two stored episodes 177 single words are wider than Bold's line by Sweet Sans Pro's recorded widths, against 43 in Avenir, and 29% of its captions come out as one or two words inside a sentence, against 12% [M12]. It is bold by its size and its capitals, not by its weight: Medium is the heaviest weight the guide names. Showing fewer words at once makes the word-time error matter more. On a Full episode Bold draws no captions (rule 9).
- **Here.** Plain's drawing, plus capitals and the accent box. The box was not tried. In Final Cut a second text run can change a word's colour, face and size, not give it a box [M8]. Sand is not used as a colour for words over the picture (2.2 to 1 against white). So in a Final Cut file the stressed word stays white, with no accent, until a title with a sand box is made once in Motion (4.2, C11). Which word is stressed is for a person, or a draft to approve.

**Signature** (the draft called it "Magazine", and the audience report "Editorial")
- **Pick it for:** signature pieces, show openers, a quote worth framing.
- **What it is now:** the guide's own headline. The draft's style was a serif headline in cream on deep green, which is the website's look, and the guide has no serif [B1]. So the headline is Sweet Sans Pro Medium in capitals with wide letter spacing, as on the guide's type page, with one or two words in the script. It sits on a navy block with rounded corners: one of the guide's five shapes, used as the guide says, to hold words [B1]. Navy and not fog, because white on navy is 13.9 to 1 and white on fog 5.3 [M11].
- **Known for it:** the guide's own social samples, which set short lines of spaced capitals beside a photograph [B1]. Among her peers, Codie Sanchez, Marie Forleo and Emma Grede set a second, contrasting face on their Shorts, a serif in their case [O1].
- **Evidence:** none for the style. No trend data. It has to be designed, not copied.
- **Risk:** spaced capitals are wide. About 11 fit a line at 2.5%, so a headline is three short lines [M11]. The script's strokes are thin, about 5 px at its size here, so it is drawn only on the plate, and never under 2.5% on an upright frame or 3.3% on a wide one [M11]. A navy block is the darkest thing in a design the guide wants light: it is one title for three seconds, not the running captions. The fade was not tried in the tool's own files.
- **What waits on the font files.** The headline can be drawn in Varela's capitals with the same spacing until Sweet Sans Pro is at hand, or in Lucida Grande's when Varela's file is not there. The script word cannot: nothing stands in for Sinthya, so until its file is there the word is drawn in the headline's capitals. Sinthya's widths, and how far its loops reach, are known only from the two words in the guide: their ink is 1.46 of the font size tall [M11].
- **What waits on design.** Where the script word sits against the capitals: on a line of its own, as here, or across them, as in the guide's logos. Its size against theirs: 3.0% against 2.5% is a guess. How two lines of capitals and a line of script share the band: stacked with no overlap they come to about 309 px against the band's 288 (arithmetic). Until that is designed, rule 8 draws the whole title at 92%, with capitals at 2.3% and the script at 2.76%, and then it fits [M12]. To hold the full size, the script has to overlap the capitals or the lines have to close up. Which word goes in the script is for a person, as Bold's stressed word is. The guide's other shapes, the arch, the oval and the circle, need more height than the top band has. A title on one of them is a card of its own, which no job asks for today (question 19).
- **Here.** Plain's drawing, plus letter spacing, a second face inside one title, and the plate. None of the three was tried. In Final Cut the navy plate, the script word and the fade are a title made once in Motion.

### 2.3 The looks

| Setting | Natural | Bright | Warm | Moody |
|---|---|---|---|---|
| E1 Recipe | none: no colour filter is run | exposure up a tenth of a stop, contrast down 8%, no change to saturation or warmth | warmth 5,800 K | exposure down a quarter stop, contrast up 6%, saturation down 8%, warmth 6,000 K |
| E2 Strength | 0 | 100% | 100% | 100% |
| E3 Vignette | 0 | 0 | 10% | 10% |
| E4 Final Cut's match, by name, and its Mix at full strength | none | "Clean Whites with Lifted Blacks", Mix 0.25: not confirmed | "Warm Dusk with Low Contrast" or "Desaturated Warmth", Mix 0.25 | "Warmer Vintage with Dark Blacks" or "Warm Dusk with Low Contrast", Mix 0.5 |

Where the values come from. Moody's recipe is the audience report's proposal: exposure down about a quarter stop, contrast up 5 to 8%, saturation down 5 to 10%, a slightly warm white balance, vignette 10 to 15%. The two Kelvin figures are mine: guess. No recipe has been judged on real footage. The Final Cut names were read in the app's folders and not seen on screen [M4]. The draft matched Moody to presets that are cool by their own names ("Low Exposure with Blue Hues", "Cool Blacks with Strong Contrast"), which would pull the Final Cut file the opposite way from the tool's file. They are replaced here by warm ones. Apple's presets are strong at full strength (Clean Neutral holds Exposure -69) [M4], which is why Mix starts low. On a grey frame of 128, ffmpeg's colour filter gave (128, 121, 116) at 5,800 K and (128, 123, 118) at 6,000 K [M9].

Bright is new in this version. The guide asks for a light and airy feel, and it says so of a design's background colours, not of footage [B1]. So Bright is my reading of it for video, and each of its numbers is a guess. Tried on made-up grey frames: ffmpeg's exposure step at a quarter stop up, the mirror of Moody's, turns every grey above 214 into pure white, so a white wall or a white shirt would lose its detail. At a tenth of a stop only greys above 238 do. With contrast down 8% after it, grey 16 comes out 26, grey 128 comes out 136, grey 215 comes out 221 and white comes out 246: the shadows lifted, the middle a little lighter, the light tones kept apart [M11]. Its Final Cut match is the nearest by name among the 71. That preset's own settings (Black Point 82, Exposure -95, Contrast 49, Saturation 53) are on scales Apple does not publish, so what it does to a picture is not confirmed [M4].

**One strength, two recipes.** A look's strength (E2) and rule 6's share are multiplied, and the product scales everything the look does.
- **In the tool's own file:** exposure, contrast and saturation are multiplied by it. Warmth keeps its Kelvin figure and is scaled through the colour filter's own mix. The vignette is multiplied by it too, and under 720 lines there is none.
- **In the Final Cut file:** the Mix written = E4's Mix x E2's strength x rule 6's share.
- **Worked, Moody on a 720-line recording.** Rule 6's share is 75%. The tool's file gets exposure down 0.19 stop, contrast up 4.5%, saturation down 6%, warmth 6,000 K at mix 0.75, and a vignette of 7.5%. The Final Cut file gets Mix 0.5 x 1.0 x 0.75 = 0.375. On a 360-line recording the share is 50%: half of each number, no vignette, and Mix 0.25.
- **Worked, Bright on the same recording.** At 75% the tool's file gets exposure up 0.075 stop and contrast down 6%: grey 16 comes out 23 and grey 128 comes out 134 [M11]. The Final Cut file gets Mix 0.25 x 1.0 x 0.75 = 0.19.
- **Natural has no recipe,** so no filter is run and no effect is written. That is on purpose: the colour filter is not neutral at its own default of 6,500 K (grey 128 comes out 128, 127, 125) [M9].
- **Against the draft.** The draft gave Moody a strength of 50% and Warm 25%. Here the mild recipe is applied in full in the tool's own file, and 0.5 and 0.25 are the Mix of Apple's stronger presets in the Final Cut file. If the draft's 50% was meant of the mild recipe, the tool's Moody file is now twice as strong as the draft's. Judge it by eye, and lower E2 if it is too much.

**Natural**
- **Pick it for:** everything, unless there is a reason not to.
- **Known for it:** her nearest peers are warm and neutral [O1].
- **With the guide:** it changes nothing, so it neither follows the guide nor goes against it. Her set does that by itself. Its wall is a deep green, which is the site's green and not one of the guide's colours, and the guide asks for neutral backgrounds in photographs [O2][B1]. No look changes a wall.
- **Risk:** none. It also asks nothing of the recording.
- **Here.** Nothing to build.

**Bright**
- **Pick it for:** a piece that should sit beside the guide's own graphics: a clip filmed in a pale room or by a window, or one made for a page laid out in mist and smoke.
- **Known for it and evidence:** the guide's own photographs are pale rooms in daylight [B1]. No data found on which looks are popular: guess.
- **With the guide:** the nearest a grade comes to "light and airy". But the guide's lightness is in the room, the clothes and the daylight. A grade lifts a picture. It does not make a dark wall pale.
- **Risk:** on her set as it is, a deep green wall in warm soft light [O2], the lift greys the green a little and can wash out skin. A lift also clips: tones already near white flatten, which is why the recipe is a tenth of a stop and not more [M11]. White captions are at their weakest on the pale picture this look is for: against a wall as pale as mist white words stand at 1.28 to 1, and against one as pale as smoke at 1.07, so only the shadow carries Plain's words [M11]. Try Boxed there. Judge it by eye on her footage.
- **Here.** To build: the colour step in the tool's two recipes, with two numbers. In the Final Cut file: a built-in preset by name, with its Mix. Not opened in Final Cut. Rules 6 and 7 hold for it as for the others: it is applied at 75% or 50% on a small recording, and not at all on an HDR one.

**Warm**
- **Pick it for:** a piece that should feel a little warmer than the room was.
- **Known for it and evidence:** no data found on which looks are popular. This is the audience report's proposal: guess.
- **With the guide:** half and half. A little warmth sits with the guide's sand, dune and mist. Its darker corners do not sit with light and airy. A Warm with no vignette is the one to try if she uses it: that is one number in its file.
- **Risk:** skin goes orange quickly. Judge it by eye on her footage.
- **Here.** To build: the same colour step as Moody, with two numbers: the warmth and the vignette. Bright's step uses neither. In the Final Cut file: a built-in preset by name, with its Mix. Not opened in Final Cut.

**Moody**
- **Pick it for:** a reflective or personal piece, now and then.
- **Known for it:** the dark sets of The Diary of a CEO and Mel Robbins [O1]. Tom Noske, as a vendor describes him [V1]. The Captions app's Film and Pulse styles [V7].
- **Evidence:** no trend data. Vendor descriptions only.
- **With the guide:** it goes against it. The guide asks for a design that is light in colour and minimal [B1], and Moody is darker, with darker corners. It stays in the list because Jason named it. It might still be chosen for a piece that is meant to stand apart from the regular posts, for a recording made in a dark room, where a brighter grade would look false, or for a one-off that Sallie wants quieter. As a house look it would pull every video away from the brand.
- **Risk:** the shows that look dark are dark in the room. A bright room graded dark looks false and is hard to see on a phone outdoors (the audience report's judgement). A strong grade falls apart on a small or soft recording, which is what rule 6 is for. Only the grade travels to any video: the full style needs filmed b-roll and a fast lens.
- **Here.** To build: the same colour step, with five numbers. The three ffmpeg filters ran here today on a made-up frame [M9].

### 2.4 The rules that keep every combination valid

Each rule is applied by the tool, and what it did is written in the first lines of the cut plan, in the log, and in the settings file beside the video (Part 5).

| # | When | Then | What the person is told |
|---|---|---|---|
| 1 | A running caption is wider than the caption style's widest line (691 px on an upright frame, measured on the box when the style draws one) | It goes on two lines if the style allows two. If not, it is split into two captions at a word. A single word that is still too wide is drawn as small as it needs to fit. A word cannot be split or left out, so there is no floor | "9 captions were split to fit the line. 2 single words were drawn smaller, the smallest at 65% of the style's size." |
| 2 | The caption style is File only, and the job goes to a place that takes no caption file: Reels or Stories, and Shorts until a file upload there is confirmed | Plain is drawn | "File only was picked, but a Reel or a Story takes no caption file, so Plain captions were drawn." |
| 3 | A title in the top band (hook headline, name title, steps card) and her face would overlap: the box the face finder draws, with a tenth of its height added all round, reaches above the band's lower edge, 30% down | That title is left out. The caption is never left out and never moved. When the face reaches below the caption's top, the person is told that too | "No hook headline: her face runs from A% to B% down the frame, and the headline band ends at 30%. Frame the shot looser." |
| 4 | A drawn caption would show for under the style's shortest time (0.83 s), or would need reading faster than 20 characters a second | It is joined to the next caption when the two fit the style's lines. If not, it is held into the pause that follows, when there is one. Inside a sentence there is none, and the caption stays as it is | Only when some remain, and both counts are given: "9 captions still show for under 0.83 s, and 6 still run faster than 20 characters a second." |
| 5 | The job has a punch-in, and the recording has fewer lines than the frame's height times the zoom: 2,074 lines for an upright frame at 108% | No punch-in | "No punch-in: the recording has 1080 lines, and a punch-in needs 2,074. A 4K recording has 2,160." |
| 6 | A look with a recipe is picked, and the recording has under 1080 lines | The look's strength is multiplied by 75%: its recipe, its vignette and Final Cut's Mix alike. Under 720 lines: by 50%, with no vignette | "Moody was applied at half strength with no vignette: the recording has 360 lines." |
| 7 | The recording is HDR (its colour is tagged BT.2020 with an HLG or PQ curve), whatever the look, Natural included | No look is applied, when one was picked. Nothing else is changed. The person is told every time | "This recording is HDR. The tool does not convert HDR colour yet, so its own files may show the wrong colour, and so may the brand colours drawn on them. Moody was not applied. Use the Final Cut file, or record with HDR Video off." |
| 8 | A title (hook headline, name title, a step) is wider than its lines allow at its size: the lines its style gives it for the frame, each no wider than the widest line of its place. Or a title that sits in the top band is taller than the band, with its plate: a headline's lines, or a card with all its steps | It is drawn smaller until it fits, down to 70% of its size, and with a word in the script never under the brand kit's smallest size for the script (2.5% upright, 3.3% wide). If it still does not fit, that title is left out | "The hook headline was drawn at 85% of its size to fit two lines." Or: "The hook headline was drawn at 92% of its size to fit the band." Or: "No hook headline: its 47 characters do not fit two lines, even at the smallest size. About 39 fit. Give a shorter line." Or: "No steps card: five steps do not fit the band, even at the smallest size. Four fit." |
| 9 | The frame is wide, every place the job goes to takes a caption file (today that is the Full episode, to YouTube), and the caption style draws running captions | No running captions are drawn. The caption file is written as always. The style still gives the titles their look | "Bold was picked, but a full episode goes to YouTube with its caption file, so no captions were drawn into the picture. Bold is used for the titles." |
| 10 | The frame is upright, the recording is wide, and the crop must be enlarged more than 200% to fill the frame: a crop under 540 px wide, which is any recording under 960 lines | Nothing is changed. The person is told the width, the percent, and what to do | "The upright picture will be soft: the crop is 404 px wide and is enlarged 267%. Record the camera on its own beside the call, or keep this one to 16:9." |

Notes on the rules.
- **The order.** Rules 2 and 9 run first, because they decide which words are drawn at all. Then rules 1 and 4 work on the captions, rules 8 and 3 on the titles, and rules 5, 6, 7 and 10 on the picture. No rule leans on another beyond that.
- **The look goes on the picture first, and words are drawn after.** So a look never changes the brand's colours in the text, and Boxed's mist stays mist under Moody.
- **Rule 3, the arithmetic.** The headline band ends at 30% down and a one-line caption starts near 61%. The space between is about a third of the frame's height. Her face fills about half of it today [O2], so on her recordings as they are, rule 3 leaves the headline out every time. Her peers' faces are a fifth to a third of the height, which is why a headline works for them. The face finder was shown a real face once, on 2026-10-13, in a Zoom recording, and found it in all 60 stills [R1]. No crop has been checked against a real speaker, and how much of a head its box covers is still not confirmed.
- **Rule 1, single words.** The last version stopped at 80% of the style's size, and that was not enough. At Bold's size (a capital height of 67 px), by the letter widths the guide's PDF records for Sweet Sans Pro: ACCOUNTABILITY is 997 px and needs 69%. TRANSFORMATION is 1,071 px and needs 65%. ENTREPRENEURSHIP is 1,202 px and needs 58%, which is a capital height of 2.0%, under Plain's size. Measured in Avenir Medium, the tests' stand-in, the same three are 809, 879 and 940 px and need 85%, 79% and 73% [M11]. These are a business coach's words. The captions are fitted to the line first, and rule 4 runs after, joining only what still fits. So the two rules cannot undo each other.
- **Rule 4, what it cannot mend.** A caption that is too short and cannot be joined is held into a pause. Inside a sentence there is no pause, so it stays under the floor. That is why the told line counts those captions too. With Bold it happens when two long words fill both lines. With Plain and Boxed it happens more often than the last version said, because Sweet Sans Pro's line is short: about a quarter of Plain's captions and a third of Boxed's, by an estimate from her two stored episodes (1.3, C7) [M12].
- **Rule 5, the arithmetic.** An upright frame is 1920 lines. At 108% the crop must hold 1920 x 1.08 = 2,074 lines to be shown without enlarging. A 4K recording has 2160. The told line no longer says "Record in 4K": for a Zoom file that is not on offer, and rule 10 says what is.
- **Rule 6's cut-offs are a guess.** A Zoom recording is 720 lines at most and often 360 [V16]. The share scales the whole look: section 2.3 works one through.
- **Rule 7 fires for every look, Natural included.** The last version fired only when a look was picked. But Natural is every job's default, and As filmed, the phone job, is the one most likely to meet HDR. With Natural there is no look to drop, and the person is still told.
- **Rule 7 is honest, not a fix.** Neither of the tool's recipes converts or tags colour today. Tried on a made-up 10-bit clip tagged BT.2020: both wrote an 8-bit file still tagged BT.2020 [M8]. Certain iPhones can record video in Dolby Vision HDR, switched in Settings, Camera, Record Video [A20]. Whether that is on by default is from a search summary only: not confirmed.
- **Rule 8, how much fits.** A hook of 8 words does not fit two lines at any style's size. On a 1080 px frame, with lines of 691 px, a hook of 7 words and 47 characters is 2,368 px in one line at Plain's size by Sweet Sans Pro's recorded widths, so 1,184 px a line on two. In Avenir Medium, the tests' stand-in, it is 2,043 px [M11]. What fits, by Sweet Sans Pro's recorded widths, with Avenir's measure after it:

  | Style's headline | At its size: characters a line, and in all its lines | At its smallest |
  |---|---|---|
  | Plain (text Medium, 3.5%, 2 lines) | about 13, so about 27: 4 or 5 words. Avenir: about 31 | about 39 at 2.45%. Avenir: about 45 |
  | Boxed (the same, on its plate) | about 12, so about 25. Avenir: about 29 | about 37. Avenir: about 42 |
  | Bold (text Medium capitals, 3.5%, 2 lines) | about 10, so about 20: 3 or 4 words. Avenir: about 25 | about 29 at 2.45%. Avenir: about 35 |
  | Signature (headline, spaced capitals, 2.5%, 3 lines on this upright frame, on its plate) | about 11, so about 34: 5 or 6 short words. With a word in the script, two lines of capitals: about 23. Avenir: about 41 | about 49 at 1.75%. With a word in the script the whole title stops at 83%, where the script reaches its floor: about 27 in two lines of capitals. Avenir: about 59 |

  No count was worked for Varela, the stand-in for real videos, or for Lucida Grande, which comes after it. Both are narrower than Sweet Sans Pro at the same capital height: Varela 0.93 as wide in sentence case and 0.90 in spaced capitals, Lucida Grande 0.92 and 0.79 [M11]. So a line that fits by Sweet Sans Pro's count fits in either.

  A third line does not fit the band at 3.5%: the band is 288 px tall. At Signature's 2.5% three lines of capitals do, on an upright frame. So the tool asks Claude for a hook that fits: at most the characters that fit at full size, and at most the job's words. Today it asks only for eight words (`notes.js` line 45). Rule 8 is for what still comes back too long, and for a line a person types. The 70% is a guess. A name in the headline role holds about 12 characters in the upright band at 2.5%, and about 17 at its smallest. So a long guest name is drawn smaller or, past 70%, left out. For a name that is a loss, and a second line for it is a thing to design. Sweet Sans Pro's own font file has not been measured: its figures here are its letter widths as the guide's PDF records them, added up with no kerning, which on one of the guide's own lines overstates the line by 0.3% [M11].
- **Rule 8 looks at height too.** The last version's rule 8 measured only width, and nothing caught a title that was too tall for the band. Three cases, each worked with the kit's line step of 1.35 [M12]. First, Signature's hook with a word in the script, on an upright frame: two lines of capitals, the script and the plate come to 309 px in a band of 288. At 92% they fit, with capitals at 2.3% and the script at 2.76%, which is over the script's floor of 2.5%. Second, Signature's hook on a wide frame: three lines of capitals at 3.3% come to 205 px with the plate, and the wide band is 184 px. So its lines are a pair, 3 upright and 2 wide. Two lines of capitals are 131 px, and one line with the script under it 150 px. Third, an upright steps card: three steps at 2.5% are 285 px with the plate. Four fit at 72%. Five do not fit above 70%, so the card is left out. The other styles' headlines are not touched: two lines at 3.5% are 206 px, and 245 px on Boxed's plate.
- **Rule 9, why a rule and not more code.** No long video seen in the field burns captions in [O1], and YouTube takes the caption file [P4]. Drawn captions would repeat it for anyone who turns captions on. Nothing in the tool draws on the 16:9 rough cut, and an hour of talk is about 3,200 caption pictures in one ffmpeg run, which was not tried. If a wide job ever goes where no caption file is taken, three things are needed first: an overlay step in `roughCutArgs`, that test, and a new place for the wide name title, whose lowest edge (85% down) meets the top of a one-line caption (about 84% down).
- **Rule 10, the arithmetic.** The crop is nine sixteenths of the recording's height: 606 px from 1080 lines (enlarged 178%, no warning), 404 px from 720 lines (267%), 202 px from 360 lines (535%) [R3][M10]. The 200% is a guess. Without this rule an Interview clip from a Zoom file trips nothing: it has no punch-in for rule 5 and its default look is Natural, so rule 6 is silent.
- **Six checks on a file, not on a pairing.** A job file is refused when A2 is not more than twice A3, because two kept edges would overlap. A caption style is refused when it asks for the script under the kit's smallest size for it on either frame (2.5% upright, 3.3% wide), or with no plate behind it. A caption style is refused when it names a colour of the secondary palette for words, a plate or a box. A caption style is refused when it uses the headline role in a case other than capitals. Any file is refused when it asks a role for a weight the role does not have. Any file is refused when it holds a setting that belongs to another layer. One more check is on a video's own words, not on a file: a note that marks more than two words of a title for the script is refused in plain words, as a wrong name in a note is (5.4).
- **What the rules do not cover.** A title whose words were not given is not drawn. With two people in the picture the tool takes the larger face. Neither is a clash between choices. Three more are facts about a run, and the person is told each time. A clip job made no clip, because Claude was not asked or could not be reached: "No clips: only Claude picks clips, and Claude was not asked in this run." A whole cut runs over its job's cap: "This cut is 2:30. LinkedIn's advice is under 2 minutes." A brand typeface is not on the Mac: "Sweet Sans Pro was not found, so the words were drawn in Varela." The kit lists what stands in, in order: Varela, then Lucida Grande. When Varela's file is not there either: "Sweet Sans Pro and Varela were not found, so the words were drawn in Lucida Grande." When no face of the list is found, no words are drawn at all, captions and titles alike: "No words were drawn: Sweet Sans Pro, Varela and Lucida Grande were not found on this Mac." Lucida Grande is on every Mac, so that last case should not happen. It is written down because the Mac does not say when a face is missing: asked for one it does not have, CoreText hands back Helvetica, and a tool that did not compare names would draw Helvetica and tell nobody [M12].
- **One overlap is left open.** A hook headline at its widest reaches 886 px across, and the logo starts at 853 px. They would overlap by about 32 px (arithmetic). The logo's place is a guess and no logo file is beside the tool yet, so this is settled when one is. At that width the stacked wordmark is 72 px tall, so it would sit in the band's first 72 px [M11].

### 2.5 The draft's eight presets, as picks

| Pick | Job + caption style + look | What of the old preset is lost |
|---|---|---|
| **Clean** | Solo clip + Plain + Natural | Its "up to 180 s for LinkedIn": the cap is 90 s now. It gains Stories, and with them Story parts for a clip over a minute |
| **Full episode** | Full episode + File only + Natural | Nothing. Its voice clean-up is "light" now, not "full", by the checkers' advice. It gains the steps panel, when steps are given |
| **Conversation** | Interview clip + Boxed + Natural | Its cream box with deep green words: the box is mist with navy words now. Its voice clean-up is "light" now, not "full", for the same reason. Note that the job's own default is Plain, not Boxed: the box was seen in 1 of 6 frames of the two shows named for it [O1] |
| **Teaching** | Teaching clip + Plain + Natural | Its slightly smaller captions (a font size of 3.4% against 3.6%): the size now belongs to the caption style. Its hook look, small capitals at 2.5% over one serif word at 6%: under Plain the hook is one face at 3.5%. Its 16:9 panel, which moved to the job Full episode. Its "up to 180 s for LinkedIn". YouTube as a place it goes |
| **Signature** (the draft's Magazine) | Solo clip + Signature + Warm | Its serif headline, its deep green plate and its cream captions: the guide has no serif, so the headline is the guide's own spaced capitals on navy, and the captions are white. Its pause of 0.5 s (now Solo clip's 0.4 s). Its one-word card every 20 s: a job would now have to ask for it (question 19). Its length of 15 to 60 s. Its strength of 25%: Warm's recipe is now applied in full, and 0.25 is only Final Cut's Mix. It gains LinkedIn, Stories with Story parts, and a punch-in on 4K. Warm's darker corners sit badly with the guide (2.3): whether Natural or Bright takes its place is for Sallie to say |
| **Bold captions** | Solo clip + Bold + Natural | Its faster pace (pauses from 0.8 s, cut to 0.3 s), its 112% punch-in with a 3 s hold, its length of 15 to 60 s, its two b-roll markers a minute. Its captions were "2 to 3 words on 1 line": they are 2 to 4 words on 2 lines now, at the same size. The old preset never drew a hook headline: now one is drawn when a line is given, so give none. Its lavender box: the stressed word is on a sand box now. It gains LinkedIn, and Stories with Story parts |
| **Moody** | Solo clip + Plain + Moody | Its "no zoom": Solo clip punches in on a 4K recording. Its three b-roll markers a minute, which pointed at b-roll that does not exist. Its music bed "once there is a track": music is the job's now, and no job has any. Its strength of 50%: the mild recipe is now applied in full, and 0.5 is only Final Cut's Mix (section 2.3). It gains a hook headline when a line is given, LinkedIn, and Stories with Story parts |
| **As filmed** | As filmed + Plain + Natural | Its "no words drawn", on purpose: a Story takes no caption file. Its "7 parts at most", which never limited anything |

Every one of the eight also loses its colours and typefaces. The draft took them from the website. As picks they are drawn in the guide's (1.1).

Most of the other losses and gains do not come from a checker's correction. They come from the new shape: a job's value now holds for every pick on that job, so a preset can no longer have its own pause, length or places.

What is gained. The 100 picks give 80 different videos at most, so 72 that the eight could not make, a bright teaching clip and a moody interview clip among them. The count: rule 2 turns the 16 picks of File only on an upright job into their Plain twin. On the Full episode rule 9 draws no running captions, so there File only and Plain are the same video (4 picks more), and Boxed, Bold and Signature differ from them only in the look of a name title or a steps panel. When an episode has neither, its 20 picks are 4 videos, one for each look, and the 100 picks are 68.

The pick the guide itself points to is none of the eight: Solo clip + Plain + Bright, or with Boxed where the room is pale. White words are weakest on a pale picture (2.3), and navy words on mist are what the guide's own samples show [B1].

### 2.6 Left out, and why

- **Captions whose fill or highlight follows the voice.** Ali Abdaal's two frames suggest it [O1]. It needs word times better than the tool's tenth to a third of a second [R1]. Final Cut's own Subtitle title may do it by route 1: not confirmed.
- **One word at a time.** Each word shows for about a third of a second, under every caption standard's floor [W4][W6]. Bold is held to the same floor: it shows two to four words, not one or two.
- **A speaker's colour in interview captions.** The tool does not know who is talking [R3]. One of the vendor's three clips has it (host yellow, guest white) [V26].
- **Fast cutting, a cut every 1 to 2 seconds.** Its best-known maker says he slowed down [S4]. Poor fit for a coach.
- **Headline bar** (video set in a padded frame with a title above). Instagram shows bordered Reels less [P13].
- **Documentary with b-roll and maps; typographic monochrome.** Described only in freelance listings: not confirmed.
- **Looks: Neutral, Film, Black and white, Punchy.** No source gives a recipe or says they are popular, and nothing about this speaker calls for them. Bright was in this list until the brand guide asked for a light and airy feel. The draft's look "Clean" (Final Cut's Clean Neutral) would be named Neutral, so that one word does not name two things.
- **A sixth job for hook tests, cut faster.** The lists stay short. Bold on Solo clip does it.

### 2.7 Where the sources disagree, and what was followed

| Point | The two sides | Followed | Why |
|---|---|---|---|
| What "Hormozi style" is | Vendor pages: capitals, yellow word, thick outline [V1][V2]. Frames of 11 to 13 Oct 2026: small white lower case [O1] | The frames | Dated and first-hand |
| Caption size | 2.5 to 3.1% [V3]; 2.6 to 5.2% and 7 to 10% [V4]; Final Cut's default 4.6% [M3]; frames 3 to 4% [O1] | Capital height 2.5% upright | The frames, counted in pixels today [O3]. Vendors do not say what they measure |
| Caption position | Vendors: 50 to 70% of the height [V4][V26]. Frames: 58 to 75% [O1]. Meta: nothing below 65% [P11] | Lowest edge 65% down | Meta's is the only published number. It is written for ads |
| Edge on a plain caption | One report: a 3 to 4 px outline [V4]. Frames: no outline but Simon Sinek's [O1] | Soft shadow | Seen. A shadow is written down for three creators only |
| Shortest time on screen | DCMP 1.33 s [W6]. Netflix 0.83 s [W4] | 0.83 s, with rule 4 | Two to four words do not last 1.33 s |
| Captions for interview clips | The vendor's page reports two looks: capitals with a heavy outline on two clips, small mixed case with a soft shadow on the third [V26]. Frames of the same show, Oct 2026: white lower case [O1] | Plain | They partly agree |
| Hook headline's place | One vendor page: the bottom third [V1]. Meta: keep the bottom 35% clear [P11] | 15% to 30% down | The bottom third is under the app's buttons |
| Music under the voice | 12 to 18 dB [V13]; 20 dB, W3C's strictest level, for sound-only recordings [W2] | 20 dB, if ever | A careful start, not a rule for video |
| LinkedIn's longest video | 10 minutes, on a page written for company Pages, marked "4 years ago" [P17]; 15 minutes, marked "2 years ago" [P18] | 15 minutes likely applies if she posts as herself | Neither limit is near her lengths |
| LinkedIn and MOV | The older page says MOV is no longer supported [P17]. The newer one lists MOV [P18] | MP4 | Both accept it |
| LinkedIn's best length | LinkedIn's advice: under 2 minutes [P20]. On company pages 120 to 180 s did best [S6] | Cap 120 s for As filmed, 90 s for the clip jobs | The advice is LinkedIn's own. The draft followed the measured figure and allowed up to 180 s on two presets. No job does now |
| Reels frame rate | Help Center text: 30 or more (search summary) [P16]. API page: 23 to 60 [P10] | Keep the recording's rate | 30 or 29.97 meets both |
| Punch-in size | 110 to 115% [V9]; 108% (audience report) | 108% | 112% is the no-loss ceiling for 4K [R3] |

---

## Part 3. Delivery by platform

The same for every job that goes to a place. One upright file fits every upright placement.

**The standard file.** MP4, H.264 High profile, 4:2:0, progressive, BT.709 colour (not HDR), the recording's own frame rate, sound AAC at 48 kHz stereo, the file's index at the front ("faststart"), loudness -14 LUFS with true peak -1 dB [P1][P10]. Meta's page also asks for a closed GOP and no edit lists [P10].

| Where | Shape and size | Frame rate | Length: the limit, and what to aim for | Video bitrate | Sound | Keep clear of text | Captions |
|---|---|---|---|---|---|---|---|
| YouTube, long | 16:9, 1920 x 1080 | as recorded | 15 minutes until the account is verified, then 12 hours or 256 GB [P3]. No best length stated; 8 minutes or more for mid-roll ads [P6] | 8 Mbps up to 30 fps; 12 Mbps at 48 to 60 fps [P1] | AAC 384 kbps [P1]. YouTube publishes no loudness number [P9] | nothing needed | Upload the .srt [P4]. Chapters are times typed in the description [P25] |
| YouTube Shorts | 9:16, 1080 x 1920 | as recorded | 3 minutes. A Short over 1 minute with a Content ID claim is blocked [P2]. Aim under 60 s | 8 or 12 Mbps as above | AAC 256 kbps | Google gives only a picture. One third-party reading: top 288, bottom 672, left 48, right 192 px [P23] | Words in the picture. A file upload for Shorts is not confirmed |
| Instagram Reels | 9:16, 1080 x 1920 | 23 to 60 [P10] | Through the API: 3 s to 15 minutes, 300 MB [P10]. Shown to non-followers up to 3 minutes since 21 Jan 2025; before that, up to 90 s [P12]. Aim 30 to 60 s [P14][S6] | 8 to 12 Mbps; 25 Mbps is the limit [P10] | AAC 256 kbps; Meta asks 128 kbps or more [P11] | top 14% (269 px), bottom 35% (672 px), 6% each side (65 px). Clear box 950 x 979 [P11] | Words in the picture. No file upload was found |
| Instagram Stories | 9:16, 1080 x 1920 | 23 to 60 [P10] | 3 to 60 s a part, 100 MB [P10] | 8 to 12 Mbps | same | same as Reels [P11] | Words in the picture, or Instagram's Captions sticker by hand |
| LinkedIn | 9:16 or 16:9 (anything from 1:2.4 to 2.4:1) | 10 to 60 [P17] | 3 s to 10 minutes on the Pages page [P17]; 15 minutes on the newer page, which likely applies if she posts as herself [P18]. Aim under 2 minutes [P20] | 192 kbps to 30 Mbps; 5 GB [P17] | AAC 256 kbps | No numbers published. LinkedIn says keep the edges free [P18] | An .srt from a computer: the page is marked "5 years ago" and the newer page names no upload. Not confirmed: try it once [P19] |
| TikTok (not asked for) | 9:16 | 23 to 60 | Every account can post at least 3 minutes; some get 5 or 10; the most through the API is 10 minutes [P21] | H.264 MP4, 4 GB at most [P21] | none published | TikTok gives only a picture. One reading: top 240, bottom 660, sides 120 px: not confirmed | Words in the picture |
| Podcast sound, if made | sound only | | | | -16 LUFS give or take 1, peak -1 dB [A19] | | |

Notes.
- **One caption box that clears every reading above** on 1080 x 1920: x from 192 to 888, y from 288 to 1248 (696 x 960). It misses only TikTok's wider strip at the lower right. Arithmetic from the figures above, not a platform's number. The caption styles' upright place (lowest edge 65% down, line up to 64% of the width) is inside it, and so is the top band. Both are measured on the box where a style draws one: Boxed's plate, Bold's accent box. With its plate, the last version's Boxed ran 17 px past the box on each side. The logo's corner is the one known exception (K3).
- **The 90 s cap is the tool's own** (`REEL_MAX`, `reframe.js` line 121). Today it is asked of Claude and noted, not held to: a clip over 90 s or under 15 s is still cut, and the notes say it does not fit a Reel [R5]. Instagram's confirmed line is 3 minutes. "A boosted Reel is 90 s at most" could not be confirmed: both Help Center pages returned only a heading [P16].
- **File size.** At 8 Mbps with 256 kbps sound a file is about 62 MB a minute. At 12 Mbps it is about 92 MB a minute, so a 3-minute Reel is about 276 MB, under Instagram's 300 MB (arithmetic).
- **MP4, not MOV.** Both of LinkedIn's pages accept MP4, and they disagree about MOV [P17][P18]. What file type Final Cut's own Social Platforms share writes is not confirmed: Apple's page names none [A13]. One export settles it.
- **Sound bitrate.** 256 kbps on upright files is my choice between Meta's "128 or more" and YouTube's 384.
- **Instagram cover.** 1080 x 1920, with the title in the middle 1080 x 1440, because the profile grid crops to 3:4 (third-party report) [P16].
- **What the tool's files lack today** [R2][R3][M8]: the index is at the end; no sound bitrate is set (128 kbps by default); no sample rate and no channel count are set, so a 44.1 kHz mono recording stays 44.1 kHz mono; there is no loudness step; a 50 or 60 fps recording still gets 8 Mbps; and there is no colour step at all. The picture is High profile already.

---

## Part 4. How each setting gets applied here

Six kinds of answer:

| Kind | Meaning |
|---|---|
| **Today** | The tool on `main` does it now (commit c9f5ff6). `main` is what the Mac runs. The last version marked some of these "branch". That branch, `unedited-claude`, was merged on 2026-10-13 at 19:57 (pull request 18), so they are "today" [R5] |
| **Small change** | A change to a named file in `transcribe/` |
| **Final Cut file** | The `.fcpxml` can carry it |
| **Once by hand** | Made once in Final Cut Pro or Motion, then reused |
| **Install or buy** | Needs something added to the Mac, or paid for |
| **Each time** | A person does it for every video |

Five facts sit behind the tables.
- **Line numbers are `main`'s, at commit c9f5ff6** (2026-10-13 20:02). The last version's were those of an older commit, 10c0ff8. The merge moved many of them in `cuts.js`, `unedited.js` and the README, and they are corrected here.
- **What `main` does since the merge** [R5]. Claude is asked once to read the rules' plan. It may change what is cut, writes notes for the editor, gives up to six ideas for a graphic, and picks up to five clips, with a hook of at most eight words for each. The tool cuts each clip as `<name>.reel-<n>.mp4` with `<name>.reel-<n>.srt`, and a clip over a minute also as `<name>.reel-<n>.story-<k>.mp4`. A new option, `--rules-only`, in `unedited.js` and in `install.sh`, never asks Claude: then there are no notes and no clips, and nothing leaves the Mac.
- **What the Final Cut file is today:** one `.fcpxml` for a recording, holding one project, in the recording's own shape, of the whole rough cut. Its captions are the transcriber's own, of the whole recording, in lines of up to 60 characters. It has a marker at each join, and one for each of Claude's ideas for a graphic. There is no upright project and no project for a clip [R4]. Four of the five jobs are upright, so their Final Cut recipe has no file to go into yet.
- **The format allows more than the tool writes.** In versions 1.10 and 1.14 these pass Final Cut's own format check: a transition that names an effect, a speed change, markers and chapter markers, scale on a clip, a pan crop, split edits, a styled title with two text runs, effects named by path with named settings, clip volume, voice clean-up, and two projects in one file, one of them 1080 x 1920 [M2][M8]. **Passing the check does not prove Final Cut Pro imports any of it as meant. None of these was opened.**
- **A Final Cut file can only name a title, effect or template.** Final Cut looks for it on the Mac.

### 4.1 The job's settings

| # | Setting | How it gets applied |
|---|---|---|
| A1 | Mistakes taken out | **Today** for all three. **Small change**: a switch for each rule in `cutPlan` (`cuts.js` line 291) |
| A2, A3 | Pause lengths | **Small change**, in three files. `LONG_PAUSE` and `KEPT_SIDE` (`cuts.js` lines 170 to 171) are used inside `rangesOf` (line 223), which `notes.js` also calls. `notes.js` imports `KEPT_SIDE` (line 11) to read silences back from a saved plan and to cut clips. So the two numbers are passed in, and saved in `<name>.cut-plan.json`, whose version goes from 1 to 2 |
| A4 | What counts as silence | **Small change**: `pauseArgs` (`cuts.js` line 61) |
| A5 | The join | **Today** for a plain cut. Flow: a `transition` passes the format check, but the tool's own checker reads it as a clip and reports an overlap, so no Final Cut file is written [M8]. It needs the writer and the checker changed, and the effect's name read from a file Final Cut exports: not confirmed |
| A6 | Speed | 100% everywhere, so nothing to do. If ever: `cuts.js` lines 456 to 457, `reframe.js` lines 103 to 111, and every caption time rescaled. **Final Cut file**: `timeMap`, pitch kept by default [M2] |
| A7 | Check marker | **Small change** to `fcpxml.js`, which already writes a marker at each join (line 157). A 3 s marker on a clip has nowhere to land until a project for the clip is written |
| A8 | Idea markers | **Today**: one marker for each of Claude's ideas that sits on a kept phrase, six at most for a video [R5] |
| B1 | Layout | **Today** for fill (`cropFor`, `reframe.js` line 30). Split is **each time** in Final Cut |
| B2 to B5 | Scale, zoom, amount, hold | **Small change** in three places. `cropFor` returns the full height and y 0, so it must also give a height and a y, and find where the face is top to bottom. Each punched-in stretch needs `scale=…,setsar=1` in its own branch: without it the join stops, because the pieces differ in size [M8]. And the rule that crops are one size (`reframe.js` lines 72 to 73) goes. The cost of a scaler in many branches is not measured; the file's own comment warns of a slow variant. **Final Cut file**: `scale` on alternate clips |
| B6 | Split edit | **Each time** in Final Cut |
| D1 | Hook headline | The words: **today**, as a draft. Claude writes a hook of at most eight words for each clip into `<name>.edit-notes.txt` [R5]. **Small change**: ask for a hook that fits, by characters as well as by words (`notes.js` line 45; rule 8). Sallie approves. Drawing it: the caption style's route (4.2) |
| D2 | Name title | **Final Cut file**: a `title` that names the built-in Basic Lower Third. The writer's header (`fcpxml.js` lines 3 to 5) and the README (line 224) say no title is written, on purpose. That decision has to be reversed and both texts reworded. On a Full episode a title goes into the Final Cut file only: nothing is drawn on the tool's own 16:9 rough cut. The name is **each time** |
| D3 | Steps | **Once by hand** in Motion, then placed and typed **each time** |
| D4 | Logo shown | **Small change**, on upright files only: ffmpeg's `overlay` is on this Mac [M1], and the logo is laid over in the same step as the caption pictures of route 3 (4.2), in `verticalArgs`. Needs the logo's file beside the tool (question 4). On a Full episode nothing is drawn on the 16:9 rough cut, so that job's switch is no. A logo there needs an overlay step in `roughCutArgs`, or a picture in the Final Cut file: not confirmed that the tool's file can carry one |
| D5 | Chapters | **Small change**: a list of chapter times on the finished cut's clock, as text for the description. The tool knows where each kept phrase lands (`keptSpans`, `cuts.js` line 410). The times hold only while the cut is not changed in Final Cut. A chapter marker in a Final Cut file is not a YouTube chapter [P25]. Where a topic changes is **each time**, or a draft to approve |
| D6, D7 | Cards, call to action | Need files and words from Sallie. Then a join and an overlay in ffmpeg |
| F1 | Loudness | **Small change**, and only the tool can do it: ffmpeg `loudnorm` in two passes, in `cuts.js` lines 457 to 458 and `reframe.js` line 111. Write the target and the true peak out, and `-ar 48000` after it: with nothing after it the sound came out at 96 kHz [M8]. Final Cut's Loudness is an amount and a uniformity, not a target [A12] |
| F2 | Voice clean-up | **Small change**: `highpass`, and for "full" `afftdn`, `deesser`, `acompressor`, `alimiter`, all on this Mac [M1]. **Final Cut file**: noise reduction, voice EQ and loudness inside the clip's sound pass the 1.10 check. Voice Isolation needs 1.11 or later |
| F3 | Music | **Buy**: a licence that covers YouTube, Instagram and LinkedIn at once is a paid library [V15]. Choosing the track is **each time** |
| F4 | Sound effects | Off |
| G1 | Shape | **Today**: the 16:9 rough cut and the upright version. Two gaps. The rough cut caps the height at 1080 lines and never enlarges (`cuts.js` line 456). So an upright phone video comes out 608 x 1080 [M8], and a 16:9 recording of 720 or 360 lines keeps that size. And an upright Final Cut project needs the writer to take a second format and more than one project, and to be handed the crop, which it never sees today. The crop would be a fill and a sideways position on each clip: not confirmed |
| G2 | Length | **Today**, in part. 15 to 90 s is written into the request to Claude (`notes.js` line 45), and `fitReel` (`reframe.js` lines 131 to 139, with the limits at lines 120 to 121) says whether a clip fits. It is asked and noted, not held to: a clip over 90 s or under 15 s is still cut, and the notes say it does not fit a Reel (`unedited.js` line 400; README line 206) [R5]. **Small change**: both read the job's range, and a clip outside it is left out, with its times kept in the notes so that a person can still cut it |
| G4 | Goes to | **Small change**: decides which files are written, Story parts among them. **Today** a clip Claude picked that runs over a minute gets its parts wherever it goes, and a whole cut gets none (`unedited.js` lines 421 to 425) [R5]. To build: parts only when the job goes to Stories, and parts of a whole cut, for As filmed. Posting is always a person's job. The tool never posts |
| G5 | File | **Small change**: `-movflags +faststart`, a sound bitrate, `-ar 48000 -ac 2`, and 12 Mbps for 50 or 60 fps (`cuts.js` line 458, `reframe.js` line 111). The podcast file is one more ffmpeg run, sound only, at the platform table's -16 LUFS. For exports from Final Cut, **once by hand**: a Compressor preset |
| G6 | Pieces | **Today**: the upright version of the whole cut is always made, whatever its length (`unedited.js` line 637), and beside it up to five clips. Clips come only from Claude: with `--rules-only`, with Claude Code missing, or after two failed calls there are none (`unedited.js` line 591; README lines 196 to 198) [R5]. **Small change**: make the whole cut only when it is under the job's cap, where the job says so, and tell the person when a clip job made no clip |
| G7 | Caption file | **Today**, in lines of up to 60 characters (`cuts.js` line 463), for the rough cut and for each clip. **Small change**: 42 characters, two lines, and the time and reading-rate limits. The file fits the tool's own cut only: once a cut is moved in Final Cut it no longer fits |
| G8 | Speaker names | **Each time**, by hand |

### 4.2 The caption style's settings: four routes for words in the picture

| Route | What it takes | State |
|---|---|---|
| 1. A person runs Edit > Closed Captions > Duplicate Captions to Subtitles on the file the tool writes, then picks a style | No code. **Each time**, about a minute | Not tried. Apple's page does not say which caption formats it takes [A3]. The file carries the whole recording's captions, so a caption beside a cut can hold cut words [R1] |
| 2. The tool writes each caption as a styled title that names Final Cut's built-in Subtitle or Basic Title | **Final Cut file**. A new caption builder (below), and changes at `fcpxml.js` lines 152 to 154 | A styled title passes the format check in 1.10 and 1.14 [M8]. Not opened. The tool's own checker (`checkFcpxml`, `fcpxml.js` lines 217 to 270) already holds a title to two things: every offset, start and duration in the file must be a whole number of frames, and every ref must name something in the file. So a title with `start="3600s"` is refused on a 29.97 recording, and then no Final Cut file is written: the writer must put a title's start on a whole frame. The checker does not check that the ref names an effect (a ref to the video passes), or that the title lies in its clip (a 10-minute title passes). It should learn both. It also reads only the first project in a file. Run today [M10] |
| 3. A Swift script draws each caption as a clear picture and ffmpeg lays them over | **Small change**, the most code to own: a new `captions.swift`, and an overlay step where an upright file is made: `verticalArgs` in `reframe.js`, which `cutPiece` in `unedited.js` (line 381) uses for each clip and each Story part. There is no overlay in `roughCutArgs`: nothing is drawn on the 16:9 rough cut (rule 9) | **Tried on made-up video and it works**: first for white outlined capitals [M6], then with a soft shadow and a pale plate [M8]. Not tried: the accent box, a fade, letter spacing, a second face inside one title, or either of the brand's own faces. No install: a font is used straight from a file [M8] |
| 4. ffmpeg-full, which can read styled caption files | **Install** (Homebrew; it sits beside today's ffmpeg and brings 47 other packages) [V17] | Not installed, not run. Needs Jason's yes |

Four things route 3 needs that the draft did not say.
- **The script measures before it draws.** Rules 1 and 8 need the width of each caption and each title in the real typeface, and a box's padding and a role's letter spacing count. CoreText gives the width, letter spacing included: every width measured for this report was measured that way [M10][M11].
- **One run draws every caption of a video.** Starting Swift costs 0.4 to 0.5 s; sixty pictures in one run took 1.45 s in all [M8]. At one run a picture, an hour of talk would spend over 20 minutes starting Swift.
- **Time the pictures on the file they go over.** The upright version runs a little longer than the rough cut on a phone or Zoom recording (0.4 s over 40 cuts) [R1], so captions timed like the rough cut's run ahead of it by the end. That is small on a short clip.
- **A fade is possible.** ffmpeg's `fade` filter with its alpha option is on this Mac [M1]. Not tried. A scale or a lit word would need a picture for each step.

**The caption builder, which routes 2 and 3 share.** Today the Final Cut file gets the transcriber's captions, not phrases, and the rough cut's caption writer works on the rough cut's clock. One new function groups the plan's kept words by the style's "words at once", breaks at a heard pause where there is one, applies rule 4, and gives each caption two times: on the video's clock for the Final Cut file, and on the cut's clock for the tool's own files.

| # | Setting | How it gets applied |
|---|---|---|
| C1 | Captions drawn | Routes above. Rules 2 and 9 |
| C3 | Typeface | A paid face is found on the Mac by its name: switched on through Adobe Fonts, or installed, which needs Jason's yes. Whether a program outside Adobe's own can use a face switched on that way was not tried: not confirmed. A font file kept beside the tool is only for a face whose licence allows it: Varela, with its licence text [V32]. A file can be used straight from a folder, with no install [M8]. A weight's name is not how a face is named: Final Cut wants a face such as "Medium" and Swift a name such as `SweetSansPro-Medium`, so the brand kit holds a table from weight to name. Sweet Sans Pro's three names and Sinthya's one are read from the guide's PDF [M11]. The script compares the name it got with the name it asked for: asked for a face this Mac does not have, CoreText reports no error and hands back Helvetica [M12]. Letter spacing and the line step are the role's, from the brand kit. In the tool's own files the spacing is CoreText's kerning value, used today to measure and not yet to draw [M11] |
| C4, C8, C9 | Case, fill, edge | Set where the words are drawn. In a Final Cut title they are `text-style` values: font, size, colour, stroke, shadow, and `kerning` for a role's letter spacing [M2]. The unit of `kerning` is not confirmed |
| C5 | Capital height | The drawing script asks the font for the height of its capitals and works out the font size. The unit of a font size in a Final Cut title is not documented: not confirmed |
| C6, C7, C15 | Words at once, shortest time, reading rate | The caption builder. Rules 1 and 4 |
| C10 | Plate | In the tool's own files the script draws the box. In Final Cut the Subtitle title has a background colour, an opacity and a corner radius [M3] |
| C11 | Accent | In the tool's own files the script can draw a box behind one word: not tried. In Final Cut a second text run changes the word's colour, not its background [M8]. A box there needs a title made by hand in Motion. Until one is made, the stressed word stays white in a Final Cut file: sand is never a colour for words over the picture (2.2). Which word: **each time**, or a draft |
| C12 | Movement | In Final Cut, the Subtitle title's animation [A2]. In the tool's own files, a fade only, not tried |
| C13 | Place | The lowest edge is the rule and the script works the centre out from it. Where there is a plate or an accent box, the lowest edge and the widest line are the box's. In Final Cut: a position on the title, or the Subtitle title's "Vertical Social Media Safe" [M3] |
| T1 to T3 | Title looks | Same routes, on upright files. Rule 8 needs each title measured, in width and in height, as rule 1 needs each caption. On a Full episode: the Final Cut file only. In Final Cut: the built-in Basic Title and Basic Lower Third with a `text-style`. The panel, Signature's navy plate and its word in the script: **once by hand** in Motion |

Bought add-ons exist for captions inside Final Cut (Subtitle Pop, shown at $39 with $49 also on the page; Caption Pop AI $59; Captionator $19.99) [V19]. Final Cut's own Subtitle title has the same settings [M3], so none is needed (my judgement).

### 4.3 The look's settings

| # | Setting | How it gets applied |
|---|---|---|
| E1, E2 | Recipe and strength | **Small change** for the tool's own files, in `cuts.js` line 456 and `reframe.js` lines 103 to 111. Either three ffmpeg filters built from the look's numbers (`exposure`, `eq`, `colortemperature`: all on this Mac, and run today on a made-up frame; a lower Kelvin figure is warmer) [M9], or one `.cube` file a look through `lut3d` (run on a made-up file) [M6]. Strength scales the numbers: exposure, contrast and saturation are multiplied, and warmth goes through the filter's own `mix` option, tried today [M9]. A look with no recipe runs no filter. How a `.cube` file would be scaled was not tried. A recipe assumes BT.709 going in (rule 7). A lift clips: at a quarter stop up, the `exposure` filter turned every grey above 214 into pure white, and at a tenth of a stop only greys above 238, which is why Bright's lift is small [M11] |
| E3 | Vignette | **Small change**: ffmpeg's `vignette`. Which angle gives "10%" is not worked out. **Final Cut file**: the built-in Vignette effect by name [M2] |
| E4 | Final Cut's match | **Final Cut file**: an effect on the clip that names one of the 71 built-in Color Grading Presets. Each is one Motion effect that publishes its settings by name: Exposure, Contrast, Brightness, Saturation, Highlights, Black Point, Shadows, Warmth, Tint and Mix (0 to 1). A sample that names a preset and sets Mix and Exposure passes 1.10 and 1.14 [M8]. So strength reaches Final Cut as Mix: the Mix written = E4's Mix x E2's strength x rule 6's share (section 2.3). And a BRIMM look may be writable as one preset plus our own numbers. Not confirmed: the scales are the preset's own, not stops or percent. Or **once by hand**: the same `.cube` through Final Cut's Custom LUT effect [A11] |

### 4.4 The brand kit's settings

| # | Setting | How it gets applied |
|---|---|---|
| K1 | Colours | Names are turned into values when the files are read (Part 5). A name from the secondary palette is refused |
| K2 | Typefaces | By name on the Mac for Sweet Sans Pro and Sinthya, once a licence is held (C3 in 4.2). Varela's file beside the tool, under the Open Font License, once Jason says yes to the download [V32]. A face that is not found gives way to the first face in the kit's list of stand-ins that is found, Varela and then Lucida Grande, and the person is told. When none is found, no words are drawn, and the person is told that (2.4) |
| K3 | Logo | Two `.png` files of the stacked wordmark, white and navy, copied from the asset folder to beside the tool once Jason says yes (question 4). ffmpeg's `overlay` lays one over the picture of an upright file [M1]. Whether this ffmpeg reads the `.svg` files was not checked |
| K4 to K6 | Name, cards, call to action | Words and files from Sallie |

### 4.5 One test settles most of the open points

Build one short upright project by hand in Final Cut Pro with: the Subtitle title with a changed font and wider letter spacing; a Basic Lower Third; one Color Grading Preset with its Mix and Exposure changed; a Custom LUT; Voice Isolation and Loudness on; a wide clip filled into the upright frame and moved sideways; a clip at 108%; a Flow transition; and one title made in Motion. Then File > Export XML, and one export through the Social Platforms share. The XML shows the true name and value of every line marked "not confirmed" above, and the tool copies what Final Cut itself wrote [A18]. About twenty minutes.

---

## Part 5. What to build first, and the files

### 5.1 The order, and why

With three layers, the first goal is one working choice in each layer, and then a second choice in each, so that swapping is proved.

| Step | Build | What it builds for the first time | Why here |
|---|---|---|---|
| 0 | The Final Cut test of 4.5 | Nothing in code | The test gives the true names for every Final Cut line. Nothing else waits. The branch the clip jobs stood on was merged on 2026-10-13, and `main` cuts the clips now [R5] |
| 1 | The four kinds of file and the code that reads them, with the job **Full episode** (File only, Natural) | The files, their checks, the merge, the settings file. Pause numbers passed in. Loudness. The delivery fixes. A 30 s marker. The chapter list | It needs no drawn text and no new program. It is her main output: three long videos in the two weeks to 10 October [O2]. This first build is only pauses, loudness, delivery and markers. The name title, the Flow join, the panel and the podcast file come later |
| 2 | The caption style **Plain**, on the job **Solo clip** | The caption builder, the measuring and drawing (route 3), rules 1, 2, 4, 9 and 10, the length range held to, the second job, the brand kit's table of typefaces with its list of stand-ins, and the logo's overlay, once question 4 has a yes | It forces the one hard decision, how words get into the picture, and every drawn style reuses the answer. The logo goes over the picture in the same overlay step. It replaces her three caption looks with one that follows the brand guide and matches this month's frames [B1][O1][O2]. It is drawn in the first stand-in the Mac has until Sweet Sans Pro is at hand. When it is, nothing changes but which face the Mac finds |
| 3 | The looks **Bright** and **Moody**, both mild | The colour step in both recipes, a named Final Cut preset with its Mix for each, rules 6 and 7 | Bright is the look the brand guide points to. Moody is Jason's first example, and costs three numbers more once the step exists. After steps 1 and 2 no look has ever been made, so the first one is not free: it is the whole third layer |
| 4 | The caption style **Bold** | Capitals on two lines, the accent box, rules 1 and 4 under load | Jason's second example. Cheap, because it reuses Plain's drawing |
| 5 | The job **As filmed** | A switch for each cut rule, a full-size file from an upright recording, Story parts of a whole cut | Three pieces nothing else builds |
| 6 | The look **Warm** and the caption style **Boxed** | One more set of numbers; the box | Cheap once 2 and 3 exist |
| 7 | The job **Interview clip** | The name title | It waits for the answer to question 10 |
| 8 | The caption style **Signature** and the job **Teaching clip** | The headline's letter spacing and its navy plate, the word in the script, the fade, the steps card and panel | They wait on design work in Motion, on Sinthya's licence and file, and on a looser shot |

After step 4 there are two jobs, three caption styles and three looks, and every layer has been swapped once. That is 18 picks and 9 different videos:

| Picks | What comes out |
|---|---|
| Full episode with File only, in Natural, Bright or Moody (3) | 3 videos |
| Full episode with Plain or Bold, in any of the three looks (6) | The same 3 videos: rule 9 draws no running captions, and the name title that would show the style comes later |
| Solo clip with Plain or Bold, in any of the three looks (6) | 6 videos |
| Solo clip with File only, in any of the three looks (3) | The 3 Plain videos again: rule 2 |

So a look goes on both jobs, and "bold captions" go on the Solo clip. Rules 3 and 8 are built with the first title that is drawn, which is the hook headline, once a note can carry its words (way B in 5.4). Rule 5 is built with the punch-in.

### 5.2 The files

Four kinds of file, and a list of named picks:

```
transcribe/presets/
  brand.json
  jobs/        full-episode.json  solo-clip.json  interview-clip.json  teaching-clip.json  as-filmed.json
  captions/    file-only.json  plain.json  boxed.json  bold.json  signature.json
  looks/       natural.json  bright.json  warm.json  moody.json
  picks.json   the eight named picks of section 2.5
  fonts/       only a font whose licence lets its file sit here: Varela, with its licence text
  logos/       the logo's two files, once Jason says they may be copied here
```

Five things hold for all of them.
- Every file of one kind has the same keys at every level, and gives a value for each. A whole part may be `null`, and then none of its keys is there: a job with no zoom has `"zoom": null`. The parts that may be `null` are named under each example. No file builds on another. A test checks it. The last version said "exactly the same keys", and the first files written from the tables broke that [M10].
- A file never holds a setting of another layer. A job file with a caption size in it is refused, by name.
- Sizes and places are shares of the frame, never pixels. One that depends on the frame's shape is a pair: `{ "upright": …, "wide": … }`.
- Colours and typefaces are the brand kit's names, never values. One more word stands for a value: a title's place may be `"topBand"`, which is the top band of that same file. There is no other name to look up.
- The words of one video (a hook line, a guest's name, the steps) are in none of them. They come with the video.

`brand.json`. Every value is the brand guide's [B1], as section 1.1 gives it. The four face names under `name` are read from the guide's PDF, and Varela's too [M11]. Lucida Grande's is the name this Mac gives it [M7]. The names Final Cut wants are to be read from the fonts once they are at hand: not confirmed.

```json
{
  "id": "brimm",
  "layout": 1,
  "colours": {
    "navy": "#1F2D42",
    "fog": "#5C6D7E",
    "lightGray": "#9EA9B2",
    "dew": "#CED3D6",
    "sand": "#C1AD97",
    "dune": "#CEBEAC",
    "mist": "#E8E3DA",
    "smoke": "#F8F7F5",
    "white": "#FFFFFF",
    "black": "#000000"
  },
  "secondary": {
    "blush": "#CCA497",
    "rose": "#EDD6D3",
    "forest": "#4E563D",
    "moss": "#727A64",
    "sage": "#979B8E"
  },
  "faces": {
    "text": {
      "family": "Sweet Sans Pro",
      "folder": null,
      "weights": {
        "light": { "name": "SweetSansPro-Light", "finalCut": "Light" },
        "regular": { "name": "SweetSansPro-Regular", "finalCut": "Regular" },
        "medium": { "name": "SweetSansPro-Medium", "finalCut": "Medium" }
      },
      "letterSpacing": 0,
      "lineStep": 1.35,
      "smallestCapitalHeight": null,
      "needsPlate": false,
      "mostWords": null
    },
    "headline": {
      "family": "Sweet Sans Pro",
      "folder": null,
      "weights": { "medium": { "name": "SweetSansPro-Medium", "finalCut": "Medium" } },
      "letterSpacing": 0.10,
      "lineStep": 1.35,
      "smallestCapitalHeight": null,
      "needsPlate": false,
      "mostWords": null
    },
    "script": {
      "family": "Sinthya",
      "folder": null,
      "weights": { "regular": { "name": "Sinthya", "finalCut": "Regular" } },
      "letterSpacing": 0,
      "lineStep": null,
      "smallestCapitalHeight": { "upright": 0.025, "wide": 0.033 },
      "needsPlate": true,
      "mostWords": 2
    }
  },
  "standIns": {
    "Sweet Sans Pro": [
      { "family": "Varela", "folder": "fonts/varela", "everyWeight": { "name": "Varela", "finalCut": "Regular" } },
      { "family": "Lucida Grande", "folder": null, "everyWeight": { "name": "LucidaGrande", "finalCut": "Regular" } }
    ],
    "Sinthya": []
  },
  "logo": {
    "mark": "stacked",
    "files": { "overDark": null, "overLight": null },
    "use": "overDark",
    "corner": "top-right",
    "place": {
      "upright": { "widthOfFrame": 0.15, "topEdge": 0.15, "sideMargin": 0.06 },
      "wide": { "widthOfFrame": 0.08, "topEdge": 0.05, "sideMargin": 0.03 }
    }
  },
  "nameOnScreen": "Sallie Ogden",
  "cards": { "opening": null, "closing": null },
  "callToAction": null
}
```

Six things about this file.
- **`folder`** is `null` for a face that the Mac finds by its name, and a folder's name for a face whose file is kept beside the tool. A paid face is never kept beside the tool.
- **`letterSpacing`** is a share of the font size, added after each letter but the last. It belongs to the role, so no caption style holds one.
- **`lineStep`** is the distance from one line to the next, as a share of the font size. It belongs to the role too. 1.35 is the guide's step for its running text, and the headline's is a guess taken from it [M11]. It is `null` for the script, which is never set on two lines.
- **A role's limits.** `smallestCapitalHeight` is a pair, because it depends on the frame's shape, or `null` for a role with no floor. `needsPlate` says the role is drawn only on a plate. `mostWords` is how many words of one title may be set in the role, or `null` for no limit of its own. All three are set for the script alone. A role holds no case: that is the caption style's.
- **`standIns`** is a list for each family, in order: what is drawn when the family is not found. Each entry is one face for every weight. The tool takes the first one the Mac has. An empty list means nothing stands in, and the word is drawn in the face of the words beside it. When a list is not empty and none of its faces is found, no words are drawn (2.4). The tool's tests give their own stand-ins, Avenir and Snell Roundhand, with their own table from weight to face name, and never read this part.
- **`secondary`** is there to be refused. No `fill`, `colour` or `current` may name one of its five.

`jobs/solo-clip.json`. Every value is the Solo clip column of section 2.1.

```json
{
  "id": "solo-clip",
  "name": "Solo clip",
  "layout": 1,
  "for": "A short upright clip of Sallie alone, for Reels, Shorts, Stories and LinkedIn.",
  "defaults": { "captions": "plain", "look": "natural" },
  "cut": {
    "mistakes": { "retakes": true, "falseStarts": true, "cues": true },
    "pauseLongFrom": 1.5,
    "keptEachSide": 0.2,
    "silence": { "quieterThanDb": -35, "forSeconds": 0.3 },
    "join": "cut",
    "speedPercent": 100,
    "checkMarkersAt": [3],
    "ideaMarkers": true
  },
  "framing": {
    "layout": "fill-on-face",
    "baseScalePercent": 100,
    "zoom": { "kind": "punch-in", "percent": 108, "holdSeconds": 5 },
    "splitEditSeconds": 0
  },
  "titles": {
    "hook": { "when": "given", "fromSecond": 0, "seconds": 3, "mostWords": 8 },
    "nameTitle": null,
    "steps": null,
    "logo": true,
    "chapters": false,
    "cards": { "opening": false, "closing": false },
    "callToAction": null
  },
  "sound": {
    "loudness": { "lufs": -14, "truePeakDb": -1 },
    "voice": "light",
    "music": null,
    "effects": false
  },
  "delivery": {
    "shape": "upright",
    "size": [1080, 1920],
    "seconds": { "least": 15, "aimFrom": 30, "aimTo": 60, "cap": 90 },
    "pieces": { "whole": "when-under-cap", "mostClips": 5 },
    "goesTo": ["reels", "shorts", "stories", "linkedin"],
    "file": "standard",
    "captionFile": {
      "lines": 2,
      "charactersALine": 42,
      "leastSeconds": 0.83,
      "mostSeconds": 7,
      "charactersASecond": 20,
      "speakerNames": "none"
    }
  }
}
```

`defaults` is the only place where a job names another layer, and it names a file, not a value.

What this file does not show, and the other four jobs need:
- **Parts that may be `null` in a job:** `framing.zoom`, `titles.hook`, `titles.nameTitle`, `titles.steps`, `titles.callToAction`, `sound.music`, `delivery.seconds`.
- **A name title, when there is one:** `"nameTitle": { "when": "given", "at": "start", "seconds": 4 }` for Interview clip. Full episode has `"at": "guest-first-words"`.
- **Steps, when they are shown:** `"steps": { "when": "given" }`. Nothing about card or panel: the frame decides.
- **Full episode:** `"zoom": null`, `"hook": null`, `"logo": false` (nothing is drawn on the 16:9 rough cut), `"seconds": null` (as recorded), `"pieces": { "whole": "always", "mostClips": 0 }`, `"shape": "wide"`, `"size": [1920, 1080]` (the most: a smaller recording keeps its size), `"goesTo": ["youtube"]`.
- **As filmed:** `"seconds": { "least": 3, "aimFrom": 15, "aimTo": 60, "cap": 120 }` and `"pieces": { "whole": "always", "mostClips": 0 }`.
- **There is no `storyParts` and no second loudness.** `"stories"` in `goesTo` turns Story parts on, and 60 s a part is in the platform table. `"file": "standard-and-podcast"` also writes the sound file, at the platform table's -16 LUFS. `sound.loudness` is the video's.
- **No job has music or a call to action yet,** so those two parts are `null` in all five files. Their keys are settled when a job first has one.

`captions/plain.json`. Every value is the Plain column of section 2.2.

```json
{
  "id": "plain",
  "name": "Plain",
  "layout": 1,
  "running": {
    "face": "text",
    "weight": "medium",
    "case": "sentence",
    "capitalHeight": { "upright": 0.025, "wide": 0.033 },
    "words": {
      "upright": { "most": 4, "lines": 1, "charactersALine": null },
      "wide": { "most": 8, "lines": 1, "charactersALine": 42 }
    },
    "leastSeconds": 0.83,
    "charactersASecond": 20,
    "fill": "white",
    "edge": { "kind": "shadow", "colour": "black", "opacity": 0.65, "blurOfHeight": 0.005, "offsetOfHeight": 0 },
    "plate": null,
    "accent": null,
    "movement": "none",
    "place": {
      "upright": { "lowestEdge": 0.65, "widestLine": 0.64 },
      "wide": { "lowestEdge": 0.90, "widestLine": 0.80 }
    },
    "emoji": false
  },
  "titles": {
    "topBand": {
      "upright": { "from": 0.15, "to": 0.30, "widestLine": 0.64 },
      "wide": { "from": 0.08, "to": 0.25, "widestLine": 0.80 }
    },
    "hook": {
      "face": "text",
      "weight": "medium",
      "case": "sentence",
      "capitalHeight": { "upright": 0.035, "wide": 0.045 },
      "fill": "white",
      "edge": { "kind": "shadow", "colour": "black", "opacity": 0.65, "blurOfHeight": 0.005, "offsetOfHeight": 0 },
      "plate": null,
      "accent": null,
      "lines": { "upright": 2, "wide": 2 },
      "place": "topBand"
    },
    "nameTitle": {
      "name": { "face": "text", "weight": "medium", "case": "sentence", "capitalHeight": { "upright": 0.025, "wide": 0.033 } },
      "role": { "face": "text", "weight": "regular", "case": "sentence", "capitalHeight": { "upright": 0.019, "wide": 0.025 } },
      "fill": "white",
      "edge": { "kind": "shadow", "colour": "black", "opacity": 0.65, "blurOfHeight": 0.005, "offsetOfHeight": 0 },
      "plate": null,
      "place": { "upright": "topBand", "wide": { "lowestEdge": 0.85, "leftEdge": 0.06, "widestLine": 0.40 } }
    },
    "steps": {
      "face": "text",
      "weight": "regular",
      "case": "sentence",
      "capitalHeight": { "upright": 0.025, "wide": 0.033 },
      "number": { "face": "text", "weight": "medium", "capitalHeight": { "upright": 0.025, "wide": 0.033 } },
      "fill": "white",
      "current": "sand",
      "edge": null,
      "plate": { "colour": "navy", "opacity": 1, "cornerOfHeight": 0.008, "paddingOfHeight": 0.010 },
      "place": { "upright": "topBand", "wide": { "side": "right", "widthOfFrame": 0.33 } }
    }
  }
}
```

There is no "from 2 words" in it: a phrase can be one word, and captions are built phrase by phrase. `"charactersALine": null` on the upright frame means that no number is stored: the widest line is the limit, and the tool works out how many characters fit it for the face it draws (18 for this style in Sweet Sans Pro) and writes the number into the settings file. On the wide frame 42 is the caption standard's figure. The lowest edge is the rule, and the centre is worked out from it. The draft gave both, and they disagreed by about 1% of the frame's height once a box was drawn [M8].

What changed in this file, and what the other four styles need:
- **No word stands for another value any more.** The last version wrote a title's edge as "as-running" and a place as "top-band", and did not say how either became a value. Each title's edge is now written out. The top band is given once, as `titles.topBand`, and a place that says `"topBand"` means that band.
- **Every size and place is a pair,** the name title's and the steps' included, and so is a headline's `lines`: how many lines fit the band depends on the frame's shape. Four values that the last version's file held and no table gave are in section 2.2 now: 8 words on a wide frame, the wide hook size, the wide band, and the name title's left edge.
- **There is no `drawn`.** File only has `"running": null`, and that is what "no captions drawn" is. Its `titles` are written out in full. Today they are the same values as this file's.
- **Parts that may be `null` in a caption style:** `running`; inside `running` or a title, `edge` and `plate`; and inside `running` or the hook, `accent`. One value may be `null` as well: `charactersALine`, where the line's width is the only limit.
- **A plate, when there is one** (Boxed): `"plate": { "colour": "mist", "opacity": 1, "cornerOfHeight": 0.008, "paddingOfHeight": 0.010 }`, with `"fill": "navy"` and no edge. Boxed's line comes to 17 characters in Sweet Sans Pro, because the widest line is measured on the plate. The 17 is worked out, not stored.
- **An accent in a running caption** (Bold): `"accent": { "when": "given", "kind": "box", "colour": "sand", "fill": "navy", "cornerOfHeight": 0.008, "paddingOfHeight": 0.005 }`. Bold also has `"case": "capitals"`, `"capitalHeight": { "upright": 0.035, "wide": 0.045 }` and `"words": { "upright": { "most": 4, "lines": 2, "charactersALine": null }, "wide": { "most": 3, "lines": 1, "charactersALine": 20 } }`. Its upright line comes to about 9 capitals in Sweet Sans Pro.
- **An accent in a title** (Signature's hook): the hook has `"face": "headline"`, `"case": "capitals"`, `"capitalHeight": { "upright": 0.025, "wide": 0.033 }`, `"lines": { "upright": 3, "wide": 2 }`, no edge, `"plate": { "colour": "navy", "opacity": 1, "cornerOfHeight": 0.008, "paddingOfHeight": 0.010 }`, and `"accent": { "when": "given", "kind": "script", "face": "script", "weight": "regular", "capitalHeight": { "upright": 0.030, "wide": 0.040 }, "fill": "white" }`. Signature's running captions have `"movement": "fade-by-line"`.
- **A weight is one of the role's names** in the brand kit: `"light"`, `"regular"` or `"medium"` for text, `"medium"` for the headline, `"regular"` for the script. A file that asks a role for a weight it does not have is refused. So is a caption style that uses the headline role with a `case` other than `"capitals"`.
- **A title has no "most words".** That is the job's (`titles.hook.mostWords`). A caption style's file would be refused if it held one.

`looks/moody.json`. Every value is the Moody column of section 2.3.

```json
{
  "id": "moody",
  "name": "Moody",
  "layout": 1,
  "recipe": { "exposureStops": -0.25, "contrastPercent": 6, "saturationPercent": -8, "temperatureKelvin": 6000 },
  "strengthPercent": 100,
  "vignettePercent": 10,
  "finalCut": { "preset": "Warmer Vintage with Dark Blacks", "mix": 0.5 }
}
```

`looks/bright.json`. Every value is the Bright column of section 2.3.

```json
{
  "id": "bright",
  "name": "Bright",
  "layout": 1,
  "recipe": { "exposureStops": 0.1, "contrastPercent": -8, "saturationPercent": 0, "temperatureKelvin": null },
  "strengthPercent": 100,
  "vignettePercent": 0,
  "finalCut": { "preset": "Clean Whites with Lifted Blacks", "mix": 0.25 }
}
```

`looks/natural.json` has `"recipe": null`, `"strengthPercent": 0`, `"vignettePercent": 0` and `"finalCut": null`. The two parts that may be `null` in a look are `recipe` and `finalCut`. A look with no recipe runs no filter. Inside a recipe, 0 means no change to exposure, contrast or saturation, and `"temperatureKelvin": null` means the warmth step is not run, because no Kelvin figure leaves grey alone [M9]. `strengthPercent` is the one number that rule 6 scales, and the Mix written into a Final Cut file is `finalCut.mix` times it (section 2.3).

One pick, as a note beside a video named `Pricing talk.mp4`. It asks for the episode with every default, and for clips with two changes:

```json
{
  "layout": 1,
  "picks": [
    { "job": "full-episode" },
    { "job": "solo-clip", "captions": "bold", "look": "moody" }
  ],
  "words": { "guest": null, "hooks": {}, "steps": [] }
}
```

A pick may also be one of the eight names: `{ "pick": "clean" }`.

### 5.3 How the files become the one set of settings the code works from

Nothing is ever overridden, because no two layers hold the same setting. So "merging" is putting four files side by side.

1. **Choose.** The job is the pick's. The caption style is the pick's, or else the job's `defaults.captions`. The look is the pick's, or else the job's `defaults.look`. The brand kit is always `brand.json`. Which pick is used, when a folder, a note and the command line each name one, is settled in 5.4.
2. **Check.** Each file has the keys of its kind at every level, or `null` for a whole part that may be `null`. A file that does not is refused, with its name and the key.
3. **Set side by side.** `settings = { brand, job, captions, look }`. The code reads `settings.job.cut.pauseLongFrom`, `settings.captions.running.fill`, `settings.look.recipe.exposureStops`. The first word of the path is the file the value came from.
4. **Fit to this video.** Four moves, in this order. First, the job's shape picks the upright or the wide value wherever a file gives a pair. Second, a place that says `"topBand"` becomes that caption style's own top band for the frame. Third, brand names become values: every `fill`, `colour` and `current` is a brand colour's name ("navy" becomes `#1F2D42`), and every `face` with its `weight` becomes a face name and the role's letter spacing ("text" at "medium" becomes `SweetSansPro-Medium` with no added spacing; "headline" at "medium" becomes the same face with 0.10), and takes the role's line step with it. When the Mac does not have that face, the first face it does have in the kit's list of stand-ins takes its place and the person is told. When it has none of them, no words are drawn, and the person is told that. Fourth, the ten rules run, with the facts ffprobe and the face finder give about the recording and the widths and heights the drawing script measures. The same measuring gives the number of characters that fit an upright caption line in the face that is drawn, which no file stores.
5. **Write it down.** The tool writes `<name>.<job>.settings.json` beside the video: the pick, where each of its three choices came from, the four files used, the settings after step 4, with the worked-out number of characters a line in place of the `null`, and each rule that fired with what it changed and what the person is told. For the clips of the pick above, from a 1920 x 1080 recording:

```json
{
  "video": "Pricing talk.mp4",
  "pick": { "job": "solo-clip", "captions": "bold", "look": "moody" },
  "pickFrom": { "job": "note", "captions": "note", "look": "note" },
  "from": {
    "brand": "brand.json",
    "job": "jobs/solo-clip.json",
    "captions": "captions/bold.json",
    "look": "looks/moody.json"
  },
  "recording": { "width": 1920, "height": 1080, "hdr": false },
  "frame": "upright",
  "rules": [
    {
      "rule": 5,
      "changed": "job.framing.zoom",
      "to": null,
      "told": "No punch-in: the recording has 1080 lines, and a punch-in needs 2,074. A 4K recording has 2,160."
    },
    {
      "rule": 1,
      "changed": "captions",
      "to": "9 split, 2 single words drawn smaller",
      "told": "9 captions were split to fit the line. 2 single words were drawn smaller, the smallest at 65% of the style's size."
    }
  ],
  "settings": { "brand": {}, "job": {}, "captions": {}, "look": {} }
}
```

(The four boxes under `settings` are shown empty here. In the real file they hold every value.)

`pickFrom` takes one of these words for each choice: "option" (the command line), "note", "folder", "tool" (the tool's own list, when nothing else names a job), or "job" (the job's own default, for a caption style or a look). At 1080 lines rule 10 does not fire: the crop is 606 px and is enlarged 178%.

So there is never a doubt where a value came from: the path says which layer, `from` says which file, `pickFrom` says who chose, and `rules` says what the tool changed and why.

### 5.4 How a person makes the three choices

| Way | What the person does | To build | To use |
|---|---|---|---|
| A. A watched folder for each kind of recording, with a `pick.json` in it | Drops the video into "Solo episode", "Interview" or "Phone video" | Small. `uneditedFolder` reads the folder's `pick.json`. The installer already takes more than one `--unedited` folder, and one launch agent watches them all [R4] | Nothing to type. One drop can give an episode and its clips, because the folder's file is a list of picks. A different caption style or look needs another way |
| B. A note beside the video, `<name>.pick.json` | Writes the note and drops it in first, then the video | Small, with three things to get right. A name that is not in the lists is refused in plain words. The note must be there before the video has settled; the tool looks every 5 s. And the note must be filed away with the video: today only the files the tool names are moved to the day's folder (`unedited.js` line 711), so a note left behind would be applied to the next video of that name | Typing exact names is where mistakes happen. But a note is needed anyway for a video's own words: a guest's name, an approved hook |
| C. Options on the command line | `node unedited.js --job solo-clip --captions bold --look moody "<file>"` | Smallest: three options in `parseArgs`, beside the four it takes today. The newest of the four, `--rules-only`, shows the whole way: read in `parseArgs`, carried by `depsFor`, and handed to the launch agent by `install.sh` [R4] | Jason only. It is also what the tests would use |
| D. The choice in the file's name | Renames the video "Pricing talk [bold, moody].mp4" | Small. No timing problem | Easy to mistype, and the tag stays in every file's name |
| E. Chosen on the BRIMM Ops page | Picks from three menus | The page cannot write into a folder on the Mac. It could hand over a note file to save, which is way B with one more step | Two steps |

**Recommended: A, with C from the first day and B when titles arrive.** A house style is the point: every clip should look like the same show [O2], so the caption style and the look change rarely and the job changes with what was recorded. Folders named for what Sallie recorded ask her nothing an editor would know. A starting set:

| Folder | Its `pick.json` |
|---|---|
| Solo episode | Full episode; Solo clip |
| Interview | Full episode; Interview clip |
| Phone video | As filmed |

C costs almost nothing and gives Jason every one of the 100 picks for a one-off. B waits until a title needs words that only the video's note can hold. D and E are not worth building.

**With three ways in, which one wins.** One order, so that the pick itself is never in doubt:

1. The list of picks comes from the first of these that has one: `--job` on the command line, which is one pick; the `picks` in the note beside the video; the folder's `pick.json`; and last the tool's own list, Full episode and Solo clip, which is close to what it makes of every video today.
2. Inside a pick, the caption style and the look each come from the first of these that names one: `--captions` or `--look` on the command line; the pick itself; the job's defaults.
3. A note that holds words and no `picks` (a guest's name, an approved hook) keeps the folder's picks and adds its words.
4. The settings file says where each of the three choices came from, in `pickFrom` (5.3).

### 5.5 What must change in the code

The draft's single preset file could not drive the code as it is laid out. These are the changes, by file. None was made.

1. **A way in** (`unedited.js`, `install.sh`). `parseArgs` (line 800) takes a file, `--watch`, `--out` and `--rules-only`. `depsFor` (line 843) carries `rulesOnly` and no pick. `uneditedFolders` (line 778) gives every folder the same settings. Add the three options beside those four, read a folder's `pick.json`, read a note beside the video, and hold to the order of 5.4. `--rules-only` is the pattern to copy: an option, carried by `depsFor`, and handed to the launch agent by `install.sh` (line 61). File the note away with the video (line 711).
2. **One recording, more than one pick** (`unedited.js`, `cuts.js`). Today one run makes one cut plan, and a second run on the same video writes over the first. The transcript and the word times are made once. Then each pick gets its own plan and its own files, and every file's name carries the job: `<name>.full-episode.rough-cut.mp4`, `<name>.solo-clip.reel-1.mp4`. `cutOutputs`, `clipOutputs`, `clipFiles` and `waitingToCut` (`cuts.js` lines 496 to 539) learn the names. Today a clip is `<name>.reel-<n>.mp4`, and a file named that way is never taken for a new video: the new names must keep that true. One file written after the last pick says the video is done. Claude is asked once for each pick to start with. Asking once for a recording and reusing its decisions is a later saving.
3. **The cut numbers are passed in** (`cuts.js`, `notes.js`). See A2 and A3 in 4.1. `KEPT_SIDE` is half of what a long pause is shortened to, and it is also the breath left beside every other cut, so changing it changes more than pauses. The plan file's version goes from 1 to 2 and holds the numbers it was made with.
4. **A switch for each cut rule** (`cutPlan`, `cuts.js` line 291).
5. **The length range is the job's, and it is held to** (the clips line of the request to Claude, `notes.js` line 45, in the request that `notesRequest` builds at line 51; `reframe.js` lines 120 to 139; `cutClips`, `unedited.js` lines 402 to 430). Today 15 to 90 s is asked of Claude, and a clip outside it is cut all the same, with a line in the notes. To build: the request and `fitReel` read the job's range. A clip outside it is left out, with its times kept in the notes. The whole upright cut is made only when it is under the cap, for a job that says so: today it is always made (line 637). And the person is told when a clip job made no clip because Claude was not asked (line 591). The same line of the request asks for a hook that fits: so many characters, worked out from the caption style (rule 8), as well as the job's words.
6. **An upright recording at full size, and Story parts by where the job goes** (`cuts.js` line 456; `reframe.js` lines 146 to 160; `unedited.js` lines 421 to 425 and 633). Today an upright recording gets no upright version (line 633), and Story parts are cut for every clip over a minute and for no whole cut. To build: parts only when the job goes to Stories, and parts of a whole cut, for As filmed.
7. **Delivery and loudness** (`cuts.js` lines 457 to 458; `reframe.js` line 111). See F1 and G5. The podcast sound file is a run of its own.
8. **Colour** (`factsOf` in `cuts.js`). Read the recording's colour tags, so that rule 7 can fire. A real conversion comes later: this ffmpeg has no `zscale`; it has `tonemap`, `colorspace` and `scale_vt`, none tried [M1].
9. **The caption builder** (new, shared by routes 2 and 3). See 4.2.
10. **The measuring and the drawing** (new `captions.swift`; `verticalArgs` in `reframe.js`; `cutPiece`, `unedited.js` line 381). The script measures each caption and each title before it draws, with a box's padding and a role's letter spacing counted, so that rules 1 and 8 can run. It measures a title's height as well, with the role's line step and the plate's padding, for rule 8. It asks the Mac for each face by name and compares the name it got with the name it asked for, because CoreText hands back Helvetica for a name it does not have and reports no error [M12]. When a face is not there it takes the first face the Mac has in the brand kit's list of stand-ins, and says so. When there is none, it draws no words, and says so. The logo is laid over an upright file in the same overlay step, from the brand kit's file and place, once question 4 has a yes. Nothing is drawn by `roughCutArgs`: on a wide job rule 9 leaves the running captions out, a Full episode's titles go into the Final Cut file, and the Full episode shows no logo.
11. **The look step** (`roughCutArgs`, `cuts.js` line 451; `verticalArgs`). Strength and rule 6's share are multiplied. Warmth goes through the filter's `mix`. A look with no recipe runs no filter at all.
12. **The punch-in** (`cropFor` and `verticalArgs`, `reframe.js` lines 30 to 40, 72 to 76, 103 to 109). Rule 10 reads the crop's width from `cropFor`.
13. **The Final Cut writer and its checker** (`fcpxml.js`). More than one project and a second format. The crop handed to the writer. Titles, which reverses "none is written here" in its header and the README. Effects with a Mix. Markers at 3 s and 30 s. The checker learns transitions, and every project in a file: today it reads only the first. Of a title it already checks two things: that its times are whole frames, and that its ref names something in the file (lines 228 to 241). It must also learn that the ref names an effect and that the title lies in its clip (line 259 looks only at captions and markers). And the writer must put a title's start on a whole frame, or the checker refuses the file [M10].
14. **New text files**: the chapter list, the settings file with `pickFrom` in it, and the told lines at the top of `<name>.cut-plan.txt`.
15. **The ten rules, as one new module.** Each rule is one small function that gives back what it changed and what the person is told. They run in the order given in 2.4. They need three facts the tool does not hand on today: the recording's colour tags (item 8), the crop's width (item 12) and the measured widths (item 10).

---

## Part 6. What stays manual, and the questions only Jason or Sallie can answer

### Stays manual every time

- **Checking the cut plan.** The cuts are suggestions and have only met made-up speech [R1].
- **The words of one video**: approving the hook line Claude drafts, picking the stressed word, the steps of a framework, a guest's name and role, where a chapter starts.
- **Checking the captions' words.** Automatic captions do not meet the need until someone has checked them [W3]. For an interview: name the speaker where the picture does not show who it is, and keep sounds such as [laughs] [W3][W4].
- **B-roll.** Filming it, choosing it, placing it. The tool can only mark the spot.
- **Music.** Choosing the track and holding the licence.
- **Colour between two cameras**, and fixing a badly lit recording. A soft background needs a mask picked by a person in Final Cut [A17].
- **Who is on screen in an interview**, and any split layout.
- **Exporting from Final Cut Pro.** No file can make Final Cut write a video [R1].
- **Posting**, attaching the .srt on YouTube, pasting the chapter list into the description. The tool never posts.
- **Covers and thumbnails.**
- **Judging a look by eye** on her own footage, once, before it is trusted.

### No choice can fix these: they belong in a note on how to record

- **The crop is tight because the recording is.** Frame the wide shot so her face is a quarter to a third of the picture's height [O2]. Until then rule 3 leaves every headline and steps card out.
- **The crop is soft because the recording is small.** From 1080 lines the upright crop is enlarged to 178%; from 2160 lines it is not enlarged at all [R3]. Record in 4K where the camera allows. Zoom does not: it sends 1280 x 720 at most [V16]. For a Zoom interview, record the camera on its own beside the call, or accept soft upright clips, or keep Zoom interviews to 16:9. Rule 10 says so each time.
- **The microphone sits where the captions land** [O2]. Lower it, or move it to the side.
- **Record with HDR Video off** on a phone (Settings, Camera, Record Video) [A20], until the tool converts HDR colour. Rule 7 says so each time, whatever the look.
- **The wall is the site's deep green** [O2]. The guide asks for neutral backgrounds in photographs and a light and airy feel [B1]. No look changes a wall, and none should try. Whether the set changes is Sallie's to say (question 25).

### Questions for Jason and Sallie

**Brand.** The guide answers what the colours and the typefaces are. It leaves these five.
1. Answered by Jason on 2026-10-14: he will pay for the typefaces chosen. Still open: which to buy and where. Sweet Sans Pro comes with Adobe Fonts on a Creative Cloud plan, or from MyFonts (from $79.00 a style, priced by the user, and Jason and Sallie may count as two). Sinthya is $25.00 a seat on Creative Market, whose licence does not name video: not confirmed.
2. Until then, may the guide's alternates stand in for Sweet Sans Pro in real videos: Varela first, and Lucida Grande when Varela's file is not there? Varela is free, and Lucida Grande is on every Mac. But the guide allows them only where Sweet Sans cannot be used, and names Kartra. If the answer is no, real videos wait for Sweet Sans Pro.
3. Answered by Jason on 2026-10-13 and 2026-10-14: the name on screen is Sallie Ogden, and anything that still says Sallie Holder is disregarded. So the guide's two name logos are not used, and are not to be remade for video.
4. Answered by Jason on 2026-10-14: either mark will do, and the logo stays an editable setting of the brand kit (K3), not something fixed in the tool. The stacked wordmark is the starting value. Still open: may its white and navy `.png` be copied from the asset folder to beside the tool?
5. Is this guide still the newest? Its PDF was made in February 2022. Its name logos say Holder where the show says Ogden, and one of its samples gives a web address the site does not use. The asset folder holds no later one. Every brand value in this report rests on it.

**Decisions that need Jason's yes**

6. May Varela's font file be downloaded and kept in the repo, beside the tool, with its licence text? Its licence allows that. A paid font's file is never put in the repo. Sweet Sans Pro and Sinthya would be switched on or installed on the Mac Studio, and an install needs his yes each time.
7. For words in the picture: caption pictures drawn by the tool (tried, no install), or ffmpeg-full (an install, less code, not tried)?
8. Will Jason build the one test project in Final Cut Pro and export its XML (4.5)?
9. Which way of picking (5.4)?

**How Sallie works**

10. How are interviews recorded: one camera on two people, two cameras, or Zoom? That decides what Interview clip can do.
11. Can she record in 4K, and a little wider?
12. Is HDR Video on, on the phone she records with?
13. Does she post on LinkedIn as herself or as a company Page? Does she want words in the picture there, or only the caption file?
14. Will some clips still go through OpusClip or CapCut? If so the house style has to be set up there too, as an OpusClip brand template [V3].
15. Is there any b-roll, or will there be? Generated b-roll is best avoided: 59% in one survey said hidden AI use lowers trust (a sponsored article, sample not given) [S13], and YouTube asks for a label on a realistic generated scene [P7].
16. Music: any at all? If yes, which paid library?
17. Are TikTok and Facebook in scope?
18. Who approves the hook line, and picks Bold's stressed word and Signature's word in the script? Is there a second run after she approves, or do titles go into Final Cut only?
19. Does she want the one-word card of the draft's Magazine preset? It could sit on one of the guide's shapes. Then Solo clip gets a switch for it.
20. Does she ever want an upright clip with no words drawn, to caption in another app? Then rule 2 becomes a warning. And does she ever want captions drawn into a 16:9 video? Then rule 9 becomes a warning too, and the 16:9 file needs an overlay step that was not tried. A logo on a full episode would need the same step.
21. An opening card, a closing card, a call to action: does she want any? Each needs a file or words from her.
22. Does her Final Cut Pro need a subscription for the Subtitle title? Apple's pages name none for Generate Captions, which does need Apple silicon and is U.S. English only [A2]. Not confirmed for her copy.
23. Does she want a podcast sound file of each episode? It is off to start (G5).
24. Is a Story part of a few seconds wanted? A 120 s phone video can come out as parts of 51, 60 and 9 s. If not, As filmed's cap becomes 105 s, which always gives two parts.
25. Is the set staying as it is? The guide asks for neutral backgrounds and a light and airy feel, and her wall is a deep green. That decides whether Bright is worth using on her everyday video, and whether the white logo or the navy one is the usual one.

---

## What was checked

**Read the first part of this section as a record.** Everything down to "The brand guide, 2026-10-13" is the checks made before the brand guide was taken as the brand. Their counts (75 picks, 60 videos, three looks) and their widths, which were measured in Avenir Next, are as they were then. That last part says what changed after.

**The three checkers.** They went over 234 claims of the draft: 67 on facts, 97 on whether each thing can be done here, 70 on what was missing. They raised 52 problems: 15 on facts, 16 on feasibility, 21 on what was missing. All 52 are applied. A later check drew twenty of them at random and found seventeen applied in full and three in part. Those three are finished in this version: the share of long pauses in the pause study (A2), the word-time limit on drawn captions (the Limits paragraph), and the full list of what each old preset loses (2.5). One of the 52 has been overtaken: it said that `main` made no clips, and `main` makes them now. The other 32 were not read again one by one.

**The fourth checker, who tried to break this version.** It built the files from the tables, merged all 75 picks, measured text in stand-in faces, ran the tool's own code, and read the repo's history. It raised 23 problems. I reproduced each one before changing anything, and all 23 were real. What changed:

| # | The problem | What was changed |
|---|---|---|
| 1 | The branch `unedited-claude` was merged at 19:57, twelve minutes before the last version was saved | Every "branch" is "today". The merge decision and its question are gone. `--rules-only` and the clip file names are in Part 4 |
| 2 | Line numbers were an older commit's | All brought to `main` at c9f5ff6 |
| 3 | `parseArgs` also takes `--rules-only` | 5.5 item 1 and 5.4 |
| 4 | The face finder has met one real face | The Limits paragraph and the note on rule 3 |
| 5 | The tool's checker does look at a title | 4.2 route 2 and 5.5 item 13 say what it checks and what it does not |
| 6 | A 120 s cut can be three Story parts, not two | The note on Story parts in 2.1, and question 24, as it is numbered now |
| 7 | 15 to 90 s is asked and noted, not held to. The whole upright cut is always made. Clips come only from Claude | G2 and G6 in Parts 1 and 4, and 5.5 item 5 |
| 8 | An 8-word hook does not fit two lines in any style | A widest line for the top band, rule 8, and a hook asked of Claude by characters |
| 9 | Bold's "one or two words" broke the 0.83 s floor | Bold is two to four words on two lines. Rule 4 counts what it cannot mend |
| 10 | A single long word is still too wide at 80% | Rule 1 draws it as small as it needs |
| 11 | Boxed's plate ran past the clear box | The widest line is measured on the box. Boxed holds 19 characters. Bold's accent box has a padding and a corner |
| 12 | Full episode with a drawn caption style had no recipe | Rule 9. The build-first count is 12 picks and 6 videos |
| 13 | An upright clip from a Zoom file tripped no rule with the look Natural | Rule 10. Rule 5 no longer says "Record in 4K". G1 says a small 16:9 recording keeps its size |
| 14 | Rule 7 was silent for Natural | It fires for every HDR recording |
| 15 | 75 picks are not 75 videos | 60 at most, 52 more than the eight (2.5) |
| 16 | Two settings had two owners: the hook's most words, and card or panel | The words are the job's alone. The frame picks card or panel |
| 17 | Four values that depend on the frame were given once, and "top-band" was defined nowhere | The name title, the steps and the logo have an upright and a wide value. The top band is named once. The logo's top edge is 15%, and its corner is a stated exception |
| 18 | A look had two strengths and no rule for joining them | Mix written = E4's Mix x E2's strength x rule 6's share. Natural runs no filter |
| 19 | Story parts were on for two jobs that do not go to Stories | G3 is gone. "Stories" in "Goes to" turns the parts on. Part 1 has 59 settings |
| 20 | The list of what each old preset loses was short | 2.5, in full |
| 21 | "Exactly the same keys" failed on the second file. Some values were words with no meaning given, and some were in no table | 5.2: a whole part may be null, no word is left to look up but brand names and `topBand`, and every value in the example files is in a table |
| 22 | With three ways to pick, nothing said which wins | 5.4 gives the order. The settings file has `pickFrom`. The note is filed with the video |
| 23 | "All 52 are applied" was not quite true | See the paragraph above |

Two further changes followed from these and were not asked for one by one. "Podcast" left the Full episode's "Goes to", because "File" already turns the sound file on and a second loudness in the job would have had two owners (problem 21 found the two loudness values). And `pieces` in a job file says `"whole": "always"` or `"when-under-cap"`, because the old yes-or-no could not say "always" (problem 7).

**The corrections that changed the answer.**
- The shape itself. Eight fixed presets mixed three kinds of thing. They are now a job, a caption style and a look, with one brand kit.
- "9 of 11" was the count for case only. Small white text with no outline and no second colour is the main look for 7. Every "rising", "fading" and "steady" is gone: the frames are one fortnight.
- The Diary of a CEO "study" is a page by a company that sells a video editor. It is a rule of thumb, and on framing it describes the opposite of the Interview clip.
- The box behind captions was seen in 1 of 6 frames of the two shows named for it. So Interview clip's default is Plain, and Boxed is a choice.
- As filmed now draws Plain captions. A Story takes no caption file.
- Bold's values could not all hold: capitals at that size run wider than the frame. It was first cut to one or two short words. That broke the 0.83 s floor, so it is now two to four words on two lines, and rule 1 catches the rest.
- A hook headline and a caption cannot both miss her face on today's recordings. Rule 3.
- Voice clean-up is "light" everywhere. "Full" came from one guide for sung vocals.
- The Moody look's Final Cut match was cool by name while its recipe is warm. Warm ones are named now.
- The short clips: when the draft was checked, `main` made none and an unmerged branch did. That branch was merged on 2026-10-13 at 19:57. So `main` makes them now: Claude picks them, drafts a hook for each and marks ideas for graphics [R5].
- A punch-in fails as the draft wrote it; it needs changes in three places. A Flow transition is refused by the tool's own checker. No upright Final Cut project exists. A box behind one word cannot be written into a Final Cut title. As filmed needs three things of its own.
- First to build: Conversation is no longer third. A mild look is, then Bold.
- Platform facts: TikTok's 3 minutes is a floor, not a limit. LinkedIn's two pages disagree on length and on MOV. LinkedIn's .srt upload, a 90 s limit on boosted Reels, and the file type of Final Cut's Social Platforms share are not confirmed. The 20 dB music figure is for sound-only recordings. YouTube chapters come from the description, not from markers in the file.
- The standard file gained colour: 4:2:0, progressive, BT.709. The tool has no colour step.
- Smaller ones: the pause study is French interviews with ten speakers; the speed study's experimenters set the speeds; the silence range is -30 to -35 dB from one vendor; MrBeast's counts are one minute from each of two videos; DCMP's figures are cited to the page that holds them; Subtitle Pop shows two prices; Buffer's sentence is its writer's.

**What the checkers confirmed.** The platform table against the platforms' own pages. Final Cut Pro 12.4 and its bundled titles, effects and presets. ffmpeg 9.0.2 with no text filter. Every repo line number, for the commit `main` was at then (10c0ff8): they are brought to c9f5ff6 in this version. The arithmetic: contrast, crop widths, safe-zone pixels, file sizes.

**What the fourth checker confirmed.** Part 1's count of settings and that each has one owner. That the three example files matched their tables value for value, and that the merge of 5.3 runs on them. That rules 2, 3, 5 and 6 catch what they claim. The arithmetic again. That Plain's 20 characters fit the 691 px line in the stand-in face (668 px), and Bold's 10 capitals do (about 630 px). That the eight picks give back the draft's presets in their main lines. That a Flow transition is refused by the tool's own checker, and that it reads only the first project.

**What I checked myself today, for this version.**
- Counted caption heights in pixels on three of the frames (video IDs `r-9RpAv1P9A`, `AjDwBBWEi8Q`, `eMnyT7e1F_8`), to settle what "3 to 4%" measures [O3].
- Read Submagic's project API and OpusClip's brand template page, for how the market splits a preset [V2][V3].
- Read YouTube's chapters page [P25], Zoom's resolution page [V16] and Apple's page on HDR video from an iPhone [A20].
- Ran three ffmpeg colour filters on a made-up frame, to see that a look's numbers can be applied without a `.cube` file and which way is warm [M9].
- Re-read the repo's code on `main` at c9f5ff6, after the merge, for every line cited in Parts 4 and 5, and read `git log` for when the branch went in [R5].
- Reproduced each of the fourth checker's 23 problems before changing anything: ran its scripts over the 75 picks, the merge, the Story parts, the crop sizes, the title check and the text widths [M10].
- Measured more widths in the stand-in faces: long single words at Bold's size, and how many characters of a hook fit two lines in each style [M10].
- Ran ffmpeg's colour filter on a grey frame at 5,800, 6,000 and 6,500 K, and at 6,000 K with its mix at 1, 0.75, 0.5 and 0 [M9].
- Read the saved text of the pause study for the share of long pauses [S1].
- Wrote the ten files this report does not show from its tables, and checked them with the report's own four examples, fourteen files in all: the same keys at every level but for a part that is null, no word left to look up but a brand name or `topBand`, every one of the 75 picks merging, and 60 different videos after rules 2 and 9 [M10].

**Three changes of my own, beyond the checkers.** The widest caption line is 64% of the width, not 70%: the draft's line ran into the strip its own "clear box" keeps free. Sizes are stored as capital heights, with the three pixel counts behind them. Rule 7 (HDR) was added, because a look on an unconverted HDR recording would make a wrong picture worse. It now fires for every look.

**The brand guide, 2026-10-13.** Jason decided that the brand guide is the brand, and that the website does not always follow it. What changed in this report:
- The brand kit is the guide's: eight colours by their own names, the secondary palette recorded so that it is refused, Sweet Sans Pro in three weights, a headline role with letter spacing, the script Sinthya, and a logo whose files exist (1.1).
- Boxed is navy on mist. Bold's accent is navy on sand. The steps are white on navy, with the current step in sand. The contrast of every pair is given (2.2).
- Magazine is gone, because the guide has no serif. In its place is Signature: the guide's own headline on a navy block, with a word in the script (2.2).
- There is a fourth look, Bright. Moody and Warm stay, each with a line on how it sits with the guide (2.3). So there are 100 picks and 80 different videos at most, not 75 and 60.
- Every count of characters is worked again for Sweet Sans Pro, which is a wider face than the stand-ins. Plain holds 18 characters a line and not 20, Boxed 17 and not 19, Bold about 9 capitals and not 10, and a hook about 27 characters in two lines and not 30 (rules 1 and 8).
- The build order takes Bright with Moody at step 3. The questions lose the one the guide answers and gain those it raises (Part 6).

What I did for it, on 2026-10-13:
- Read the guide's 11 pages and the two pictures beside it, and nothing else in that folder [B1][B2]. Nothing there was changed, copied or moved.
- Read the guide's PDF for what its pages do not show [M11]: when it was made (10 February 2022, in Adobe Illustrator; the file in the folder is dated 26 August 2024); the typefaces set in it and who made them; the size and letter spacing of every line of type; the letter widths it records for each face; the corners of its shapes; and the proportions of its logos. No font was taken out of the PDF or saved.
- Worked every contrast figure again by the WCAG formula, and five more pairs [M11].
- Asked this Mac for each typeface by name. Sweet Sans Pro, Sinthya and Varela are not on it. Lucida Grande, Avenir and Avenir Next are [M7].
- Measured every caption and title line again: in Avenir Medium with CoreText, and from Sweet Sans Pro's recorded letter widths, with the headline's letter spacing where it is used [M11].
- Read the sellers' pages for the two typefaces, Google's record for Varela, the Open Font License's questions page and Apple's licence for macOS ([V28] to [V33]).
- Ran ffmpeg's exposure and contrast steps on made-up grey frames, to set Bright's two numbers [M11].
- Listed Final Cut Pro's 71 Color Grading Presets again, and read the published settings of seven of them in the app's folder. The app was not opened [M4].
- Wrote the ten files this report does not show from its tables, and checked them with its five example files, fifteen in all: the same keys at every level but for a part that is null, no word left to look up but a brand name or `topBand`, every one of the 100 picks merging, and 80 different videos after rules 2 and 9 [M11].

Five things about the guide that the first reading missed:
- It is older than its file. The PDF was made in February 2022. That fits its name logos, which say Holder, and the web address in its samples, which the site does not use today.
- Its type page names three weights and shows them. It does not say in words what each is for, and it gives no rule for the script.
- Varela has one weight. The line the guide labels "Varela Bold" is set in the regular [M11][V32].
- Its own samples set pale words on sand and on light gray, pairs that fail the contrast asked of small words.
- In its social samples the second voice is an italic of Sweet Sans Pro, not the script. The script is in the logos and on the type page only.

**The two checks of that version, 2026-10-13.** Two checkers went over the version that was brought to the brand guide: one on the brand, one on the design. They raised 18 problems, 5 on the brand and 13 on the design. One clash was found by both, so there are 17 rows below. I looked at each for myself before changing anything, and all 18 were real. What changed:

| # | The problem | What was changed |
|---|---|---|
| 1 | MyFonts prices its Desktop licence by users, not by computers, and says it is for the buyer only | The MyFonts row in 1.1, and question 1. "Bought once" is gone too: the page does not say it |
| 2 | In a Final Cut file Bold's stressed word was a sand word over the picture, against the report's own rule that sand is only ever a box there. Found by both checkers | In a Final Cut file the stressed word stays white until a title with a sand box is made in Motion (2.2, and C11 in 4.2) |
| 3 | Avenir has no face called Regular, so "name for name" was wrong | The tests' table gives `Avenir-Roman` for regular (1.1, 5.2) |
| 4 | "The stand-in" meant two faces, Avenir and Varela, and the figures were Avenir's | Every such figure names Avenir. The note on rule 8 says that no count was worked for Varela or Lucida Grande, and why a line still fits in them |
| 5 | `brand-guide.md` gave three of the guide's four design tips | The fourth, subtle textured backgrounds, is added there |
| 6 | No rule looked at a title's height. Signature's hook with a script word, its three lines on a wide frame, and a steps card of five did not fit their band | Rule 8 looks at height. Signature's hook has 3 lines upright and 2 wide, and with a script word it is drawn at 92%. A steps card holds three steps, or four at 72% (2.4) |
| 7 | In Sweet Sans Pro about a quarter of Plain's captions come out under the 0.83 s floor, where rule 4 cannot join them | Said under C6 and C7, in the risks of Plain, Boxed and Bold, and in the note on rule 4, with two things to try |
| 8 | The characters that fit an upright line were stored in three caption styles, and had to be changed by hand when the kit's face changed | They are not stored. The tool works the number out for the face it draws (1.0, C6, 5.2, 5.3) |
| 9 | Nothing built the logo, and on the Full episode it had no route into the picture | The logo is in step 2 of 5.1 and in item 10 of 5.5. The Full episode's switch is no (2.1, 4.1) |
| 10 | The kit named one stand-in, which is not on this Mac, and the Mac hands back Helvetica for a face it does not have | The kit lists Varela and then Lucida Grande. With none found, no words are drawn. The script compares names (1.1, 2.4, 5.2, 5.5) |
| 11 | The line step, on which the fit of three headline lines rests, was in no table and no file | It is the role's, in the brand kit: `lineStep`, 1.35 (K2, 5.2) |
| 12 | The script's smallest size was one value for both frames | It is a pair: 2.5% upright, 3.3% wide |
| 13 | The headline's capitals were said by the kit and by the style. Two of the script's three limits were in no file | Case is the caption style's, with a check on the file. The script's three limits are in its role (K2, 5.2) |
| 14 | Signature's hook pointed at "C10's corner and padding", and C10 is "none" in its own column. The steps' plate had values in the example file that no table gave | The values are written into both cells (1.3, 2.2) |
| 15 | The pick "the guide points to" put white captions on the pale picture that Bright is for | 2.5 names Boxed for a pale room, and Bright's risk says why |
| 16 | Three counts were wrong | Five things hold for all files. Six checks on a file. Warm has two numbers, and its colour step is Moody's |
| 17 | `brand-guide.md` asked whether the guide is still the newest, and Part 6 did not | It is question 5. There are 25 questions |

Four changes followed from these and were not asked for one by one. A headline's `lines` is a pair in every caption style, because files of one kind have the same keys (row 6). A note that marks more than two words of a title for the script is refused, since that limit has to be checked somewhere (row 13). Question 2 names Lucida Grande beside Varela, and question 4 says where the logo shows (rows 9 and 10). And four told lines were added: two to rule 8, and two to the facts about a run in 2.4.

What I did for it, on 2026-10-13:
- Read the guide's 11 pages again [B1]. Page 8 has four design tips. Nothing else that this report says of the guide had to be corrected.
- Fetched MyFonts' page for Sweet Sans Pro again [V30].
- Asked this Mac for its faces, by family and by name [M12].
- Ran the design checker's three scripts again: the merge of every pick, the widths in Avenir and by Sweet Sans Pro's recorded letter widths, and the grouping of her two stored episodes into captions [M12].
- Worked the height of each title in its band with the kit's line step, on both frames [M12].
- Wrote the ten files this report does not show from its tables once more, and checked them with its five example files: the same keys at every level, every one of the 100 picks merging, 80 different videos after rules 2 and 9, four of the six checks on a file (the script's size and its plate, a secondary colour, the headline's case, a weight the role does not have), and the list of stand-ins with Varela there, with only Lucida Grande there, and with neither [M12].

**Still not confirmed.**
- **Opened in Final Cut Pro:** none of the sample files. Every Final Cut line above passed a format check only. The README records that one file the tool wrote, of a made-up recording, was opened there.
- **Real footage:** none. No look, pause length, zoom, caption size or face box has been judged on Sallie's video. The face finder met one real face, in a Zoom recording, and no crop was checked against it [R1].
- **The new rules' cut-offs:** 70% for a title (rule 8) and 200% for a crop (rule 10) are guesses, as rule 6's are.
- **Captions drawn on a 16:9 file:** about 3,200 pictures for an hour of talk in one ffmpeg run. Not tried. Rule 9 means it is not needed today.
- **Watched:** no video, by anyone. Pace, caption movement, music and sound effects are unobserved for every creator named.
- Her Instagram and LinkedIn were not opened. Jenna Kutcher's and Jasmine Star's video could not be seen.
- Whether any caption style holds viewers better than another. No independent test was found.
- A loudness figure published by YouTube, Instagram, TikTok or LinkedIn. Safe zones for ordinary Reels, Shorts, TikTok and LinkedIn. A caption file upload for Shorts, Reels and TikTok.
- LinkedIn's .srt upload as it works now. A 90 s limit on boosted Reels. The file type of Final Cut's Social Platforms share.
- Whether an iPhone records HDR video by default.
- Sweet Sans Pro's and Sinthya's own font files: neither is on this Mac. Sweet Sans Pro's figures here are the letter widths the guide's PDF records, added up with no kerning. The PDF records no small letters for Medium, so Light's stand for them: on the letters two weights share, their widths differ by under 1% on average [M11]. Sinthya's widths are known for the nine letters of the guide's two sample words only. Varela was measured on the guide's own page and nowhere else.
- Who holds a licence for either face today. MVB's own licence text. Type Network's price for Sweet Sans Pro. MyFonts' price for one user or for two, and whether Jason and Sallie count as two. What Adobe's page of licensing questions says, first-hand. Whether Creative Market's Desktop licence counts video. Whether Apple's licence covers a video that a business posts. Whether any seller counts the tool as desktop use.
- Whether a program outside Adobe's own can use a face switched on through Adobe Fonts.
- What the Final Cut preset named for Bright does to a picture. The unit of `kerning` in a Final Cut title.
- How many captions come out too short on real video. The quarter for Plain is an estimate from two transcripts whose times are by the line, not by the word [M12].
- Whether a Final Cut file the tool writes can carry the logo's picture, which is what a logo on a Full episode would need.
- Whether Lucida Grande should take its Bold for a headline, as the guide's page of alternates does.
- Whether the stacked wordmark reads at 162 px on a phone. Which file in the asset folder is which: the folder was not listed for this version.
- In Final Cut: the names it writes for a Subtitle title, a Flow transition, a Custom LUT and a Motion title; the unit of a title's font size; the scales of a Color Grading Preset's settings; how a wide clip is filled and moved in an upright project; whether captions that arrive through a file convert to subtitles.
- In the tool's own files: the accent box, a fade, an HDR conversion, the cost of a punch-in in many branches, the ffmpeg angle for a 10% vignette.
- How long the clips of a long recording take. Nobody has measured it [R5].

---

## Sources

Dates are the page's own where it shows one. "Read" means read on 2026-10-13.

**This repo and this Mac**
Every line number below is `main`'s at commit c9f5ff6 (2026-10-13 20:02:03), which is what the repo folder has checked out.
- [R1] `/Users/jasonogden/Claude Code/BRIMM operations/README.md`, section "Unedited video" (lines 122 to 257). What has and has not met real footage, and the one real face, are at line 246
- [R2] `transcribe/cuts.js` lines 61, 170 to 171, 223, 291, 410, 451 to 458, 463 to 490, 496 to 539
- [R3] `transcribe/reframe.js` lines 30 to 40, 72 to 76, 103 to 111, 116, 120 to 122, 131 to 139, 146 to 160
- [R4] `transcribe/fcpxml.js` lines 3 to 5, 61, 94, 152 to 159, 217 to 270; `transcribe/unedited.js` lines 47, 475 to 488, 553, 633, 711 to 712, 778 to 813, 843 to 845; `transcribe/notes.js` lines 11, 36 to 46, 51, 168; `transcribe/lib.js` line 84; `transcribe/install.sh` lines 47 to 69, 104, 160
- [R5] Claude's read of the cut plan and the short clips, on `main`. The branch `unedited-claude` (commit d66558a, 2026-10-13 17:49) was merged by pull request 18 at 19:57:12 (commit 48e3f81), with two more commits. Pull requests 19 and 20 followed. Read with `git log`. `README.md` lines 124 to 126, 141 to 145, 186 to 210 and 248 to 254; `transcribe/unedited.js` lines 10 to 17, 381 to 430, 464, 591, 637, 644, 656, 800 to 813; `transcribe/notes.js` lines 37 to 45; `transcribe/install.sh` lines 12, 61, 70 to 73
- [M1] ffmpeg 9.0.2 at `/opt/homebrew/bin/ffmpeg`: its filter, encoder and build lists, and test runs on made-up input
- [M2] Final Cut Pro 12.4's own format definitions: `/Applications/Final Cut Pro.app/Contents/Frameworks/Interchange.framework/Versions/A/Resources/FCPXMLv1_10.dtd` and `FCPXMLv1_14.dtd`
- [M3] The built-in Subtitle title: `/Applications/Final Cut Pro.app/Contents/PlugIns/MediaProviders/MotionEffect.fxp/Contents/Resources/METemplates.localized/Titles.localized/Subtitles.localized/Subtitle.localized/Subtitle.moti`
- [M4] Colour presets inside the app: `.../MotionEffect.fxp/Contents/Resources/METemplates.localized/Effects.localized/Color Grading Presets.localized/` (71; the names used here were listed again today), `.../Flexo.framework/Versions/A/Resources/Color Presets/` (20), `.../MotionEffect.fxp/Contents/Resources/Templates.localized/Effects.localized/Styles.localized/` (9)
- [M6] The first researcher's scratch tests: `/private/tmp/claude-501/-Users-jasonogden-Claude-Code-BRIMM-operations/d2df8116-6adb-4d04-a170-d3efb5b797a7/scratchpad/presets/samples` and `.../presets/captest`
- [M7] Typefaces in `/System/Library/Fonts`, `/System/Library/Fonts/Supplemental`, `/Library/Fonts`, `~/Library/Fonts`, and each face asked for by name through CoreText on 2026-10-13. On this Mac: Avenir, Avenir Next, Lucida Grande, Snell Roundhand. Not on it: Sweet Sans Pro, Sinthya and Varela, nor the two the website shows, Montserrat and Bodoni Moda. The faces of each family, as the Mac names them, are in [M12]
- [M8] The checkers' scratch tests: `.../scratchpad/presets/samples-check` (format-checked sample files, with ffmpeg tests in `ff` and caption drawing in `cap`) and `.../scratchpad/presets-check` (`width.swift` and three made-up clips)
- [M9] My tests today, on made-up frames only: `ffmpeg -filters` and `exposure`, `eq`, `colortemperature` run on a grey frame. Grey 128 came out (128, 119, 111) at 5,500 K and (115, 117, 128) at 7,500 K. Added for this version: (128, 121, 116) at 5,800 K, (128, 123, 118) at 6,000 K, and (128, 127, 125) at the filter's own default of 6,500 K. At 6,000 K with the filter's `mix` option: (128, 124, 121) at 0.75, (128, 125, 123) at 0.5, and unchanged at 0
- [M10] The fourth checker's scratch tests of this report, run again by me on 2026-10-13: `/private/tmp/claude-501/-Users-jasonogden-Claude-Code-BRIMM-operations/d2df8116-6adb-4d04-a170-d3efb5b797a7/scratchpad/presets/merge-check` (`extract.mjs`, `make-rest.mjs`, `merge.mjs`, `combos.mjs`, `small-checks.mjs`, `check-title2.mjs`, and `measure.swift`, which measures text with CoreText and draws nothing). And my own for this version, in `.../scratchpad/presets/final-check`: `widths.swift`, and `files-check.mjs`, which takes this report's four example files, writes the other ten from the tables, and merges the 75 picks. The faces measured then: Avenir Next Demi Bold, Bold and Heavy, Bodoni 72 Bold, and Verdana Bold as a wide face. They stood in for the two faces the website shows
- [M11] My tests for the brand guide, 2026-10-13, in `/private/tmp/claude-501/-Users-jasonogden-Claude-Code-BRIMM-operations/d2df8116-6adb-4d04-a170-d3efb5b797a7/scratchpad/brand-guide-check`. Six short Python scripts read the guide's PDF and write nothing: `pdf_fonts.py`, `pdf_spacing.py`, `pdf_names.py`, `pdf_trace.py`, `pdf_logos.py`, `pdf_ink.py`. What they found: the PDF was made on 2022-02-10 in Adobe Illustrator 26.0. Nine faces are set in it: Sweet Sans Pro Light, Regular, Medium and Bold (maker's line: Markanna Studios Inc., 2011), Sinthya (Sronstudio, 2019), Lucida Grande in two weights, one Varela, and one stray, PMN Caecilia Sans Text Bold. Capital heights, as a share of the font size: 0.653 for Sweet Sans Pro, 0.680 for Sinthya, 0.698 for Varela, 0.723 for Lucida Grande. Letter spacing: 0.10 on the headline sample, 0.14 on section headings and labels, none on running text, whose lines step by 1.35 of the font size. The outlined box that holds words is 591 x 168 pt with a corner of 25.8 pt. The script sample's ink is 1.46 of its font size tall. `compare.swift` and `widths.swift` measure with CoreText and draw nothing. At the same capital height, against Sweet Sans Pro's recorded widths: Avenir Medium is 0.87 as wide in sentence case and 0.82 in capitals, Lucida Grande 0.92 and 0.79, Verdana 0.94 and 0.84, Avenir Next Medium 0.88 and 0.82. `contrast.mjs` works the contrast pairs. `bright.mjs` runs ffmpeg 9.0.2 on made-up grey frames. `files-check.mjs` writes the files from this report's tables and merges the 100 picks. Also seen, and not opened: `/Applications` holds Adobe Creative Cloud and Adobe Photoshop 2026
- [M12] The checks of the version brought to the brand guide, 2026-10-13. The design checker's scripts, in `/private/tmp/claude-501/-Users-jasonogden-Claude-Code-BRIMM-operations/d2df8116-6adb-4d04-a170-d3efb5b797a7/scratchpad/rv3-design`, run again by me: `merge.mjs` (the merge of every pick, and the height of titles in the band), `measure.swift` (widths in Avenir with CoreText and by Sweet Sans Pro's recorded letter widths; its own sample of twenty caption lines), `group.swift` (the words of `app/tests/episodes/ep-KhZgHhShE7M.transcript.txt` and `ep-s2FWdoncagM.transcript.txt`, 6,746 words in 45.6 minutes, grouped into captions of up to four words that fit the line, with a sentence end standing for a pause; the transcripts' times are by the line, not by the word), and `faces.swift`. And my own, in `.../scratchpad/fix-check`: `members.swift` asks the Mac for the faces of a family and for faces by name, and draws nothing. Avenir's faces are Book, Roman, Light, Medium, Heavy and Black, each with an oblique. Avenir Next's are Ultra Light, Regular, Medium, Demi Bold, Bold and Heavy, each with an italic. Lucida Grande's are Regular (`LucidaGrande`) and Bold. Asked for `SweetSansPro-Medium`, `Sinthya`, `Varela` or `Avenir-Regular`, CoreText handed back Helvetica each time and reported no error. `files-check2.mjs` takes this report's seven JSON examples, builds the other ten files from its tables, and checks the keys, the 100 picks, the checks on a file, the list of stand-ins and the heights of titles. It writes nothing

**The brand**
- [B1] The BRIMM's brand guide: `brandguidelines.pdf`, 11 pages (logos, typography, colour, secondary palette, shapes, lines, design tips, and three pages of sample social graphics), in the brand asset folder in Dropbox, `The BRIMM DB/BRIMM DNA/The BRIMM Marketing and Media Share/Marketing Assets`. Made on 2022-02-10 by its own record; the file is dated 2024-08-26. Read on 2026-10-13. `brand-guide.md`, beside this report, says what else the folder holds
- [B2] In the same folder: `BRIMM color swatches.png`, the eight colours with their values, the same as the guide's colour page; and `Sinthya font sample.png`, two words in the script

**Seen in frames**
- [O1] Still frames of Shorts and long videos by 11 business educators, uploaded 24 Sep to 13 Oct 2026, at `https://i.ytimg.com/vi/<id>/oar2.jpg`. Video IDs are in section 3 of `/private/tmp/claude-501/-Users-jasonogden-Claude-Code-BRIMM-operations/d2df8116-6adb-4d04-a170-d3efb5b797a7/scratchpad/presets/report-audience.md`. Peers' sites: https://www.amyporterfield.com ; https://jasminestar.com ; https://jennakutcher.com
- [O2] Sallie's own pages: https://growwiththebrimm.com (markup) ; https://www.youtube.com/feeds/videos.xml?channel_id=UCidJ_bWtVFEP0iRuv_lXWcw ; frames of 11 Shorts and 3 long videos, IDs in section 2 of the same report
- [O3] Three of those frames, counted in pixels by me on 2026-10-13: https://i.ytimg.com/vi/r-9RpAv1P9A/oar2.jpg ("so when": white rows 1235 to 1274 of 1920, 275 px wide) ; https://i.ytimg.com/vi/AjDwBBWEi8Q/oar2.jpg ("had the money": rows 1260 to 1318, 620 px wide; logo at 836 to 1008 px across, 116 to 174 px down) ; https://i.ytimg.com/vi/eMnyT7e1F_8/oar2.jpg ("were not kept": rows 1246 to 1314, 452 px wide)

**Apple**
- [A2] https://support.apple.com/guide/final-cut-pro/generate-subtitles-automatically-verd6d52c4e8/mac ; release notes https://support.apple.com/en-us/102825 (12.3 on 30 Jun 2026, 12.4 on 29 Sep 2026)
- [A3] https://support.apple.com/guide/final-cut-pro/convert-closed-captions-to-subtitles-ver3a0f2a987/mac
- [A5] https://support.apple.com/guide/final-cut-pro/merge-jump-cuts-with-the-flow-transition-ver46d0179ac/12.4/mac/26.6
- [A6] https://support.apple.com/guide/final-cut-pro/pan-and-zoom-clips-verb8e5de9c/12.4/mac/26.6
- [A8] https://support.apple.com/guide/final-cut-pro/preserve-pitch-in-retimed-clips-verb6aca45d/12.4/mac/26.6
- [A11] https://support.apple.com/guide/final-cut-pro/apply-luts-ver24f966423/mac
- [A12] https://support.apple.com/guide/final-cut-pro/enhance-audio-verc1fab873/mac
- [A13] https://support.apple.com/guide/final-cut-pro/social-platforms-destination-ver1d41f8374/mac ; https://support.apple.com/guide/final-cut-pro/compressor-presets-destination-ver74e31fd6c/mac
- [A17] https://support.apple.com/guide/final-cut-pro/add-an-auto-mask-to-a-video-effect-ver722466c60/12.4/mac/26.6
- [A18] https://support.apple.com/guide/final-cut-pro/use-xml-to-transfer-projects-verdbd66ae/mac
- [A19] https://podcasters.apple.com/support/893-audio-requirements
- [A20] https://support.apple.com/en-us/102241 (2025-03-20; read by me)

**Platforms**
- [P1] https://support.google.com/youtube/answer/1722171
- [P2] https://support.google.com/youtube/answer/15424877
- [P3] https://support.google.com/youtube/answer/71673
- [P4] https://support.google.com/youtube/answer/2734698 ; https://support.google.com/youtube/answer/2734796
- [P5] https://support.google.com/youtube/answer/9314415 ; https://support.google.com/youtube/answer/12942217
- [P6] https://support.google.com/youtube/answer/6175006
- [P7] https://support.google.com/youtube/answer/1311392 ; https://support.google.com/youtube/answer/14328491
- [P8] https://blog.youtube/news-and-events/1-billion-monthly-podcast-users/ (2025-02-26; the figure is "as of January 2025")
- [P9] https://support.google.com/youtube/answer/14106294
- [P10] https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media
- [P11] https://www.facebook.com/business/ads-guide/update/video/instagram-reels ; https://www.facebook.com/business/ads-guide/update/video/instagram-story
- [P12] https://creators.instagram.com/blog/the-latest-with-instagram (2025-01-21) ; https://creators.instagram.com/faq
- [P13] https://about.instagram.com/blog/announcements/instagram-ranking-explained (2023-05-31)
- [P14] https://about.instagram.com/blog/tips-and-tricks/how-to-make-instagram-reels ; reported at https://www.socialmediatoday.com/news/instagram-shares-reels-creation-tips-in-new-guide/831551/ (2026-09-28)
- [P15] https://creators.instagram.com/blog/helping-creators-of-all-sizes-break-through (2025-02-26)
- [P16] Instagram Help Center, which returned only a heading when fetched: https://help.instagram.com/1038071743007909 ; https://help.instagram.com/2720958398006062 ; grid crop https://www.kapwing.com/resources/instagrams-new-grid-layout-size-and-dimensions-2025/ (2025-12-30)
- [P17] https://www.linkedin.com/help/linkedin/answer/a1311816 (marked "4 years ago"; written for company Pages)
- [P18] https://www.linkedin.com/help/linkedin/answer/a548372 (marked "2 years ago")
- [P19] https://www.linkedin.com/help/linkedin/answer/a552177 (marked "5 years ago") ; https://www.linkedin.com/help/linkedin/answer/a1327025 (marked "1 year ago")
- [P20] https://www.linkedin.com/business/marketing/blog/content-marketing/13-top-tips-for-compelling-b2b-video-content-on-linkedin (2025-06-05)
- [P21] https://ads.tiktok.com/business/en-US/blog/tiktok-content-production-for-smbs (2024-02-26) ; https://developers.tiktok.com/docs/en/content-posting-api-media-transfer-guide
- [P23] https://support.google.com/google-ads/answer/13547298 ; third-party reading https://adchecklab.com/articles/youtube-shorts-safe-area-dimensions (checked Sept 2026)
- [P24] https://support.spotify.com/us/artists/article/loudness-normalization/
- [P25] https://support.google.com/youtube/answer/9884579 (no date shown; read by me)

**Standards**
- [W1] https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- [W2] https://www.w3.org/WAI/WCAG22/Understanding/low-or-no-background-audio.html (WCAG 1.4.7, Level AAA, sound-only recordings)
- [W3] https://www.w3.org/WAI/media/av/captions/ ; https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html
- [W4] https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-Timed-Text-Style-Guide (change log 2025-12-19)
- [W5] https://dcmp.org/learn/597-captioning-key---text
- [W6] https://dcmp.org/captioningkey/print (shortest and longest time on screen)

**Studies and reports**
- [S1] Campione and Veronis, Speech Prosody 2002: https://mail.sprosig.org/sp2002/pdf/campione-veronis.pdf
- [S2] Guo, Kim and Rubin, 2014: https://up.csail.mit.edu/other-pubs/las2014-pguo-engagement.pdf
- [S3] Murphy, Hoover, Agadzhanyan, Kuehn and Castel, Applied Cognitive Psychology 36(1), online 2021-11-22. Abstract through https://api.crossref.org/works/10.1002/acp.3899
- [S4] https://tubefilter.com/2024/03/04/mrbeast-editing-style-number-of-cuts-per-video/ (2024-03-04)
- [S6] https://www.socialinsider.io/blog/instagram-reels-length/ (2026-07-14; the page gives two different sample sizes) ; https://www.socialinsider.io/social-media-benchmarks/social-media-video-statistics (2026-08-21)
- [S7] https://www.rivaliq.com/blog/instagram-stories-benchmark-report (2024-01-09)
- [S8] https://wistia.com/about/state-of-video (2026-04-22)
- [S9] https://blog.hubspot.com/marketing/how-video-consumption-is-changing (updated 2025-02-19)
- [S10] https://www.hootsuite.com/research/social-trends (2026; a trend report)
- [S11] Verizon Media and Publicis Media, reported at https://www.3playmedia.com/blog/verizon-media-and-publicis-media-find-viewers-want-captions/ (2019-07-19)
- [S12] https://buffer.com/resources/linkedin-algorithm/ (2025-12-19)
- [S13] https://www.socialmediatoday.com/spons/influencer-marketing-has-an-ai-trust-problem/831579/ (2026-10-05, sponsored)
- [S15] https://postiz.com/blog/hormozi-2026-audience-growth-playbook (2026-04-19) ; https://www.brief-tube.com/videos/Jmkq5RLjm0U (second-hand)

**Tool makers and guides (rules of thumb, not measured)**
- [V1] https://www.choppity.com/tools/recreate-video-editing-style/ and its pages for alex-hormozi, leila-hormozi, codie-sanchez, ali-abdaal, tom-noske (undated)
- [V2] https://docs.submagic.co/api-reference/create-project (read by me; no date on the page) ; https://docs.submagic.co/api-reference/update-preset.md ; https://docs.submagic.co/api-reference/templates ; https://www.submagic.co/blog/how-to-make-alex-hormozi-captions
- [V3] https://help.opus.pro/docs/article/how-to-add-a-brand-template.md (read by me; no date on the page) ; https://help.opus.pro/docs/article/layout-and-reframing ; https://www.opus.pro/blog/best-caption-presets-styles-boost-retention (2025-11-11, changed 2026-05-06) ; https://www.opus.pro/blog/ai-b-roll-generator (2026-07-21)
- [V4] https://blitzcutai.com/blog/best-caption-fonts-tiktok (2026-03-15, updated 2026-09-25) ; https://blitzcutai.com/blog/how-to-make-captions-look-professional (2026-05-25) ; https://blitzcutai.com/blog/how-to-remove-silence-youtube-shorts (2026-08-31)
- [V5] https://poko.video/blog/best-caption-styles-for-marketing-videos-2026-guide (2026-05-01)
- [V6] https://joyspace.ai/hormozi-editing-style-2026-analysis (2025-12-10; opinion)
- [V7] https://captions.ai/styles ; https://captions.ai/help/docs/captions/styles.md
- [V8] https://www.autocut.com/blogs/autocut-silences-parameters (2025-10-01) ; https://knowledge.autocut.com/en/article/what-are-the-autozooms-settings-11racdj/ (2026-03-12)
- [V9] https://firecut.ai/blog/how-to-zoom-in-on-premiere-pro-a-step-by-step-guide-for-beginners/ (2026-05-06)
- [V10] https://agent.vizard.ai/how-to/stop-the-punch-ins-cycling-too-fast-in-a-talking-head-edit.html (2026-10-10)
- [V11] https://filmdaft.com/the-l-cut-and-j-cut-how-film-editors-use-audio-to-control-time/ (2026-05-19)
- [V12] https://rysupaudio.com/blogs/news/best-vocal-chain-order (2026-03-13)
- [V13] https://tryuncle.com/learn/davinci-resolve/how-to-duck-background-music-under-dialogue-in-davinci-resolve (2026-07-30)
- [V14] https://esecut.com/blog/sound-effects-that-boost-engagement ; https://creatorsfx.in/blog/best-sound-effects-for-reels-and-shorts (2026-03-10)
- [V15] https://www.facebook.com/sound/collection/terms (2022-03-16) ; https://support.google.com/youtube/answer/3376882 ; https://www.epidemicsound.com/our-plans/
- [V16] https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0066421 (no date shown; read by me)
- [V17] https://formulae.brew.sh/formula/ffmpeg-full
- [V19] https://fxfactory.com/info/subtitlepop/ ; https://stupidraisins.com/titles/caption-pop-ai/ ; https://apps.apple.com/us/app/captionator-for-final-cut/id1627843786
- [V26] https://www.writepanda.ai/blog/how-diary-of-a-ceo-edits-podcast-clips/ (2026-07-04; by PandaStudio, which sells a video editor; three clips). The draft listed it as a study, [S5]
- [V27] https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0059985 (Zoom's background noise suppression; "Auto" is the default)
- [V28] MVB Fonts on Sweet Sans: https://www.mvbfonts.com/sweet_sans/ (2011; nine weights; its "Buy" buttons lead to https://typenetwork.com/type-foundries/mvb-fonts) ; what a Type Network desktop licence covers: https://typenetwork.com/support ; https://typenetwork.com/fonts/sweet-sans-pro showed no price when read
- [V29] https://fonts.adobe.com/fonts/sweet-sans-pro (read) ; Adobe's page of licensing questions, https://helpx.adobe.com/fonts/using/font-licensing.html, returned an error (403) on three tries, so what it says is from a search summary only ; a 2018 news report, https://techcrunch.com/2018/10/15/typekit-is-now-adobe-fonts-and-part-of-all-creative-cloud-plans/ (search summary only)
- [V30] https://www.myfonts.com/fonts/sweet/sans-pro (read, and fetched again for the corrections; prices in US dollars as shown on 2026-10-13. Its Desktop licence is "based on the number of users", is for the buyer only, and may not be shared in a team. The 12 styles are ExtraLight, Light, Regular, Medium, Bold and Heavy, each with an italic. The page does not say whether the licence is bought once. Its link to the full licence text opened with no text in it)
- [V31] https://creativemarket.com/Sronstudio/3897399-Sinthya-Casual-Script-Font (created 2019-06-28) ; https://creativemarket.com/licenses/fonts ; the free copy for personal use: https://www.fontspace.com/sinthya-font-f34832
- [V32] Google Fonts' record for Varela: https://raw.githubusercontent.com/google/fonts/main/ofl/varela/METADATA.pb (one font, Regular 400, licence OFL, added 2011-06-29) ; the licence's questions page: https://openfontlicense.org/ofl-faq/ (questions 1.1, 1.2 and 1.10)
- [V33] Apple's licence for macOS Tahoe 26, section 2E: https://www.apple.com/legal/sla/docs/macOSTahoe.pdf . This Mac runs macOS 27.0.1, whose licence was not read
