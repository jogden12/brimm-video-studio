// The names brimm-video makes from other names. A video's name, or an episode's, becomes part of a file's or a folder's name
// in its file-safe form. A new episode's folder is named for the day, the video and the Mac, and never takes a name already
// in Episodes, so that two Macs filing videos of the same name on the same day never pick the same folder. A Mac's name goes
// into the names of the files it pushes in a short form, as "mac-studio". A push names its project in Final Cut, and the
// timeline it keeps in the episode's folder, by the part, the version and the episode's short id.
// Nothing here touches a disk.

/** A name as Dropbox and Finder can carry it in a file's or a folder's name: each of / \ : * ? " < > |, which Dropbox calls
    incompatible, becomes a dash, a control character becomes a space, each run of white space becomes one space, and there is
    none at either end. "Pricing: what to charge?" becomes "Pricing- what to charge-". When nothing is left, it is "video". */
export function fileSafe(text) {
  const safe = String(text ?? "").replace(/[/\\:*?"<>|]/g, "-").replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim();
  return safe || "video";
}

/** A name as the Mac's disk and Dropbox compare it: whatever its case, and however its accents are written. */
const sameAs = (name) => String(name).normalize("NFC").toLowerCase();

/** The name of a new episode's folder, among the `names` already in Episodes: the day, the file-safe form of the video's name,
    and this Mac's name, as "2026-10-14 Pricing talk (Mac Studio)". The Mac's name is always there: two Macs importing at
    the same time cannot see each other's new folder in time. When the name is taken on this Mac, the first number from 2
    that is free goes after it, as "2026-10-14 Pricing talk (Mac Studio)-2". */
export function episodeFolderName(names, day, stem, machine) {
  const taken = new Set(names.map(sameAs));
  const first = `${day} ${fileSafe(stem)} (${machine})`;
  let name = first;
  for (let n = 2; taken.has(sameAs(name)); n++) name = `${first}-${n}`;
  return name;
}

/** A Mac's name as it goes into the names of the files that Mac pushes: in small letters, with no apostrophe, each run of
    anything but letters and digits as one dash, and no dash at either end. "Sallie's laptop" becomes "sallies-laptop". */
export const machineSlug = (machine) => String(machine ?? "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** The short id of an episode: the last six characters of its id, which go into the names of its projects in Final Cut, so
    that two episodes of one name are told apart. */
export const shortId = (id) => String(id).slice(-6);

/** The name of a part as it goes into a name: "main", or "reel 2". */
const partName = (part) => (part === "main" ? "main" : `reel ${part.reel}`);

/** The name a push gives its project in Final Cut, as "Pricing talk main v3 3fa9c1". Share and File > Export XML… name their
    files after the project, so the push records it and files are found by it, never by the episode's current name. */
export const projectName = ({ name, part, v, id }) => `${fileSafe(name)} ${partName(part)} v${v} ${shortId(id)}`;

/** Where a timeline is kept in an episode's folder, as a path from it: the import's own as "edit/main.v0.fcpxml", and a push
    as "edit/main.v3.mac-studio.fcpxml", with the Mac's short name, so the two Macs never write the same file. */
export function timelineFile({ part, v, machine }) {
  const kind = part === "main" ? "main" : `reel-${part.reel}`;
  return v === 0 ? `edit/${kind}.v0.fcpxml` : `edit/${kind}.v${v}.${machineSlug(machine)}.fcpxml`;
}

/** The Final Cut event every push of an episode puts its project in: the episode folder's name, for the main video and the
    Reels alike, never changed. Phase 0 on Final Cut Pro 12.4 (A4): a new project pushed into the same library and event
    asks nothing, and the video stays linked once. */
export const eventName = (folder) => String(folder);
