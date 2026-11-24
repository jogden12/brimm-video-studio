// The storyboard link's hook (storyboard-opening.js recordPublished): after each Artifact call in her folder for Claude, the URL a staged
// storyboard's first publish gave, taken from the tool's result, recorded once in the registry. The home folder is the one above her folder,
// which settings.js wrote into the hook's args (R25), never HOME. It prints nothing; what it let go is a line in the log beside the registry.
import { readFileSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { logPublished, recordPublished } from "../storyboard-opening.js";

try {
  const folder = process.argv[2] || "";
  if (isAbsolute(folder)) {
    let input = null;
    try {
      input = JSON.parse(readFileSync(0, "utf8") || "{}");
    } catch {
      input = null;
    }
    const what = recordPublished(dirname(folder), input, { folder });
    if (what !== "input") logPublished(dirname(folder), what);
  }
} catch {
  // Nothing recorded: the next publish is a new page's.
}
