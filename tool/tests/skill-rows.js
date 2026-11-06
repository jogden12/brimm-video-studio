// How the tests read the skill's long rows (review changes R2): a row of "What she says, and what to run" is a short row, and the rest of
// what it said is a rule of its own under "More on these rows", each rule starting with the row it belongs to, as `- "Make Reel 2": …`.
// A test that pins a row's whole words reads the row and its rules together.

/** The line of the skill that starts with these words, or undefined. */
export const lineOf = (skill, start) => skill.split("\n").find((line) => line.startsWith(start));

/** The label a rule starts with, or null for a line that is no rule: `"Make Reel 2"` of `- "Make Reel 2": If it says …`. */
const labelOf = (line) => /^- ("[^"]*"|The spellings card): /.exec(line)?.[1] ?? null;

/** The rules that belong to a row (its trigger cell holds their label), without their label, in the order they are written. */
export const rulesOfRow = (skill, row) => {
  const trigger = row.slice(2).split(" | ")[0];
  return skill.split("\n").filter((line) => {
    const label = labelOf(line);
    return label !== null && trigger.includes(label);
  }).map((line) => line.slice(labelOf(line).length + 4));
};

/** The rules of a label, without it, in the order they are written. */
export const rulesOf = (skill, label) => skill.split("\n").filter((line) => line.startsWith(`- ${label}: `)).map((line) => line.slice(`- ${label}: `.length));

/** A row and its rules together, one space apart, without the row's closing bar: what the row said before it was split. */
export const withRules = (skill, row) => [row.replace(/ \|$/, ""), ...rulesOfRow(skill, row)].join(" ");

/** The row that starts with these words, with its rules, or undefined. */
export const rowWithRules = (skill, start) => {
  const row = lineOf(skill, start);
  return row === undefined ? undefined : withRules(skill, row);
};
