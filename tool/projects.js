// The main video's Final Cut project, as the import writes it at the start (edit/main.v0.fcpxml) and as a push writes it
// again once the session has laid something over it or cut it again (phase 4): its kept pieces of the raw video, the whole
// recording's captions on their own timing, a note at each join and Claude's ideas for graphics, and what lies over it.
// Nothing here touches a disk or runs a program.
import { fcpxml, checkFcpxml } from "./fcpxml.js";
import { joinNotes, roughRate } from "./cuts.js";
import { captionsOf } from "./lib.js";
import { spelledCaptions } from "./final-transcript.js";

/** The main video's project: {text}, or {why} there is none. `video` is where the file names the raw video, `facts` what
    ffprobe said of it (as factsOf gives them) and `more` what else ffprobe says, for its asset ({ audioRate, audioChannels,
    colorSpace }). `ranges` are the recording's ranges, kept and cut, as a plan's are: the plan's own unless cuts were asked
    for since. `srt` is the whole recording's captions, which keep the sound's timing, so when the sound starts after the
    picture they are moved on as the words are; the episode's `spellings` are applied to them. `ideas` are notes too.
    `titles` and `stills` lie over the picture (layers.js). The text is checked before it is given back. */
export function mainProject({ video, facts, more = {}, plan, ranges = plan.ranges, srt = "", spellings = [], ideas = [], titles = [], stills = [], look = null, library, src, project, event, writer = fcpxml }) {
  if (!facts.height) return { why: "there is no picture in the file" };
  if (!ranges.some((r) => r.keep)) return { why: "the plan keeps nothing" };
  const said = { duration: facts.duration, frameRate: roughRate(facts), width: facts.width, height: facts.height, hasAudio: facts.sound, ...more };
  const shift = Math.max(0, facts.soundStart || 0);
  try {
    const captions = captionsOf(spellings.length ? spelledCaptions(srt, spellings) : srt).map((caption) => ({ ...caption, start: caption.start + shift, end: caption.end + shift }));
    const text = writer({ video, facts: said, ranges: ranges.filter((range) => range.keep), captions, markers: [...joinNotes(ranges), ...ideas], titles, stills, look, library: library || undefined, ...(src ? { src } : {}), ...(project ? { project } : {}), ...(event ? { event } : {}) });
    const wrong = checkFcpxml(text, said);
    return wrong.length ? { why: `it did not pass its own check (${wrong.join(" ").replace(/\.$/, "")})` } : { text };
  } catch (e) {
    return { why: `the writer refused it (${String(e.message).replace(/\.$/, "")})` };
  }
}
