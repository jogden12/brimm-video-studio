// A made-up recording for the tests of the unedited-video workflow: 23 seconds of speech with a retake, a spoken cue to start
// over, a false start and a long pause in it. The Mac's own voice spoke it on 2026-10-13, and the words and the times here are
// what the real ffprobe, whisper.cpp and ffmpeg said about it. No test runs those programs.
//
// What was said: "Welcome to the show today we are" (pause) "let me do that again." (pause) "Welcome to the show. Today we are
// going to talk about pricing." (a long pause) "So the" (pause) "So the first thing you need to do is know your costs." (pause)
// "It is very, very important. Thank you so much, Sally."

/** What ffprobe writes about a file, cut down to what the tool reads. `picture` and `sound` are each a stream's own facts, or
    null for a file without one. */
export const probed = ({ picture = {}, sound = {}, duration = "23.423400" } = {}) => JSON.stringify({
  streams: [
    ...(picture ? [{ index: 0, codec_type: "video", width: 1280, height: 720, r_frame_rate: "30000/1001", avg_frame_rate: "30000/1001", start_time: "0.000000", disposition: { attached_pic: 0 }, ...picture }] : []),
    ...(sound ? [{ index: 1, codec_type: "audio", sample_rate: "22050", r_frame_rate: "0/0", avg_frame_rate: "0/0", start_time: "0.000000", ...sound }] : [])
  ],
  format: { format_name: "mov,mp4,m4a,3gp,3g2,mj2", start_time: "0.000000", duration }
});

/** What the transcriber writes with -ojf, from a short list. Each segment is [its start, its end, its tokens], the times in
    milliseconds. Each token is [its text, the moment it ends in hundredths of a second, its own end in milliseconds]. */
export const told = (segments) => ({
  transcription: segments.map(([from, to, tokens]) => ({
    offsets: { from, to },
    text: tokens.map(([text]) => text).filter((text) => !text.startsWith("[_")).join(""),
    tokens: tokens.map(([text, t_dtw, end = to]) => ({ text, offsets: { from, to: end }, t_dtw }))
  }))
});

export const TOLD = told([
  [0, 4780, [["[_BEG_]", -1, 0], [" Welcome", 140], [" to", 162], [" the", 174], [" show", 194], [".", 208], [" Today", 226], [" we", 244], [" are", 272], ["...", 290], [" Let", 384], [" me", 400], [" do", 420], [" that", 440], [" again", 476], [".", 554]]],
  [4780, 8900, [[" Welcome", 636], [" to", 658], [" the", 670], [" show", 704], [".", 738], [" Today", 762], [" we", 780], [" are", 798], [" going", 824], [" to", 846], [" talk", 872], [" about", 900]]],
  [8900, 9500, [[" pricing", 946], [".", 1042], ["[_TT_475]", -1]]],
  [12160, 14750, [[" So", 1266], [" the", 1286], ["...", 1320], [" So", 1376], [" the", 1392], [" first", 1420], [" thing", 1442], [" you", 1460], [" need", 1480], [" to", 1494], [" do", 1512], [" is", 1530], [" know", 1548], [" your", 1566]]],
  [14750, 20960, [[" costs", 1620], [".", 1674], [" It", 1734], [" is", 1748], [" very", 1778], [",", 1794], [" very", 1832], [" important", 1880], [".", 1934], [" Thank", 1954], [" you", 1972], [" so", 1994], [" much", 2036], [",", 2062], [" Sally", 2094], [".", 2094], ["[_TT_1048]", -1]]]
]);

/** The captions the transcriber wrote in the same pass. */
export const SRT = `1
00:00:00,000 --> 00:00:04,780
 Welcome to the show. Today we are... Let me do that again.

2
00:00:04,780 --> 00:00:08,900
 Welcome to the show. Today we are going to talk about

3
00:00:08,900 --> 00:00:09,500
 pricing.

4
00:00:12,160 --> 00:00:14,750
 So the... So the first thing you need to do is know your

5
00:00:14,750 --> 00:00:20,960
 costs. It is very, very important. Thank you so much, Sally.

`;

/** What ffmpeg prints when it is asked where the sound is quieter than -35 dB for 0.3 seconds or more, with silence put after
    the sound up to the end of the recording. The sound of this recording ended at 22.802, in a pause, 0.6 seconds before its
    picture: ffmpeg said "silence_end: 22.802 | silence_duration: 1.705313" of it as it was. The last line here is what the
    real ffmpeg printed for a made sound with the same last pause and the same length, once the silence was put after it. */
export const PAUSES = `[Parsed_silencedetect_1 @ 0x7969040900] silence_start: 0
[Parsed_silencedetect_1 @ 0x7969040900] silence_end: 1.111375 | silence_duration: 1.111375
[Parsed_silencedetect_1 @ 0x7969040900] silence_start: 2.788
[Parsed_silencedetect_1 @ 0x7969040900] silence_end: 3.695188 | silence_duration: 0.907188
[Parsed_silencedetect_1 @ 0x7969040900] silence_start: 4.843
[Parsed_silencedetect_1 @ 0x7969040900] silence_end: 6.07025 | silence_duration: 1.22725
[Parsed_silencedetect_1 @ 0x7969040900] silence_start: 9.638125
[Parsed_silencedetect_1 @ 0x7969040900] silence_end: 12.458875 | silence_duration: 2.82075
[Parsed_silencedetect_1 @ 0x7969040900] silence_start: 13.06
[Parsed_silencedetect_1 @ 0x7969040900] silence_end: 13.583125 | silence_duration: 0.523125
[Parsed_silencedetect_1 @ 0x7969040900] silence_start: 16.329625
[Parsed_silencedetect_1 @ 0x7969040900] silence_end: 17.246375 | silence_duration: 0.91675
[Parsed_silencedetect_1 @ 0x7969040900] silence_start: 19.02225
[Parsed_silencedetect_1 @ 0x7969040900] silence_end: 19.414313 | silence_duration: 0.392062
[Parsed_silencedetect_1 @ 0x7969040900] silence_start: 21.096688
[Parsed_silencedetect_1 @ 0x7969040900] silence_end: 23.423 | silence_duration: 2.326313
`;

/** A phone's JPEG: an EXIF part saying its orientation, as an iPhone writes it (big-endian), then `padding` bytes of XMP
    parts, then its frame. */
export const jpegOf = (width, height, { orientation = 1, padding = 0, little = false } = {}) => {
  const tiff = Buffer.alloc(26);
  tiff.write(little ? "II" : "MM", 0, "ascii");
  const u16 = (v, at) => (little ? tiff.writeUInt16LE(v, at) : tiff.writeUInt16BE(v, at));
  const u32 = (v, at) => (little ? tiff.writeUInt32LE(v, at) : tiff.writeUInt32BE(v, at));
  u16(42, 2);
  u32(8, 4);
  u16(1, 8);
  u16(0x0112, 10);
  u16(3, 12);
  u32(1, 14);
  u16(orientation, 18);
  const exif = Buffer.concat([Buffer.from("Exif\0\0", "ascii"), tiff]);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, (exif.length + 2) >> 8, (exif.length + 2) & 255]), exif]);
  const xmp = [];
  for (let left = padding; left > 0; left -= 60000) {
    const body = Buffer.alloc(Math.min(left, 60000));
    xmp.push(Buffer.from([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 255]), body);
  }
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, ...xmp, Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03]), Buffer.alloc(9)]);
};
