// Her script, to read (review changes R5; design: ux.md F3, h7-findings answer 3). `plan "<title>" script` opens a COPY of a planned video's teleprompter
// script in TextEdit, on this Mac's own disk, read-only, so that nothing she does in TextEdit can change the plan: a mark-up there made the plan "Not
// right" before. Changes to the script come through the chat, and Claude saves them with `plan … set`. This module imports no edit.js: edit.js gives it the
// one thing of its own it needs (the copy in the work folder, `kit.shownCopy`), and plan.js (planFor) finds the plan and tells her why when it is
// dropped, not made yet or no plan.
import { statSync } from "node:fs";
import { join } from "node:path";
import { shownName } from "./episode.js";
import { teleprompterText } from "./sentences.js";

/** The script's file in a plan's folder, as plan.js puts it there. */
const SCRIPT_FILE = "teleprompter.txt";

/** What episodes says when the script file is not the size the record lists: it was changed outside the chat. */
export const HAND_EDITED = (record) => `The script file of "${shownName(record)}" was changed outside the chat. Tell me the changes you want and I will save them to the plan.`;

/** Whether the script file in `folder` is there but not at the size the record lists for it. A file that is missing is another problem, and keeps its own
    line (filesProblems), so it is false here; so is a record that lists no size for it. */
export function scriptHandEdited(folder, record) {
  const listed = record && record.files ? record.files[SCRIPT_FILE] : undefined;
  if (!Number.isInteger(listed)) return false;
  let size = null;
  try {
    size = statSync(join(folder, SCRIPT_FILE)).size;
  } catch (e) {
    return false;
  }
  return size !== listed;
}

/** Open the plan's script as a copy to read: the text is the plan's own (teleprompterText of its lines, never the file's), written into the copy `kit.shownCopy`
    makes in this Mac's work folder (read-only; an earlier copy goes first), and opened in TextEdit. Says that it was, and that changes are told in the chat.
    Writes nothing into the plan. Ends with 0, or with 1, having said why. */
export function openScriptCopy(ctx, found, record, kit) {
  const title = `"${shownName(record)}"`;
  const lines = record.planned && Array.isArray(record.planned.lines) ? record.planned.lines : [];
  if (!lines.length) {
    ctx.say(`${title} has no script yet.`);
    return 1;
  }
  let copy = "";
  try {
    copy = kit.shownCopy(found, record, "script", teleprompterText(lines));
  } catch (e) {
    ctx.say(`The script of ${title} could not be copied on this Mac (${e.code || "an error"}).`);
    return 1;
  }
  try {
    ctx.openApp("TextEdit", copy);
  } catch (e) {
    ctx.say(`${title}: ${String(e.message).replace(/\.$/, "")}.`);
    return 1;
  }
  ctx.say(`Opened the script for ${title} in TextEdit. It is a copy to read. To change it, tell me the change here.`);
  return 0;
}
