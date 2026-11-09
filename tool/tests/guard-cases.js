// The guard's cases, shared by studio.test.js (today's guard) and guard-open.test.js (the open guard), moved out of studio.test.js
// word for word: importing studio.test.js itself would run its whole suite again. The checkout and node are spelled as her folder's
// settings spell them on her laptop; nothing here is run. It now also holds the cases for node's path in double quotes (design
// 2026-11-09, part 6).
import { dirname } from "node:path";
export const CHECKOUT = "/Users/sallie/Claude Code/BRIMM video";
export const NODE = "/opt/homebrew/bin/node";
export const EDIT = `${NODE} "${CHECKOUT}/tool/edit.js"`;
/** Commands the guard lets through, each with the words edit.js must be given, in zsh and in bash. */
export const ALLOWED = [
  [`${EDIT} episodes`, ["episodes"]],
  [`${EDIT} open "Pricing talk"`, ["open", "Pricing talk"]],
  [`node "${CHECKOUT}/tool/edit.js" open "Talk (Sallie's laptop)"`, ["open", "Talk (Sallie's laptop)"]],
  [`${EDIT} title "Pricing talk" --words "Price it right" --approve`, ["title", "Pricing talk", "--words", "Price it right", "--approve"]],
  [`${EDIT} finish "Pricing talk" --take "main=this Mac"`, ["finish", "Pricing talk", "--take", "main=this Mac"]],
  // Every letter a plain word may hold.
  [`${EDIT} open a_b.c,d:e+f=g@h%i/j-k9`, ["open", "a_b.c,d:e+f=g@h%i/j-k9"]],
  // Words in single quotes, with what would run something outside them: inside, each is only a letter.
  [`${EDIT} title "Pricing talk" --words 'Charge $99 \`now\` \\ok'`, ["title", "Pricing talk", "--words", "Charge $99 `now` \\ok"]],
  [`${EDIT} name "Pricing talk" '"Real" ~/x *? {a,b} (c) ; & | < > =d #e !f $(g) \${h}'`, ["name", "Pricing talk", `"Real" ~/x *? {a,b} (c) ; & | < > =d #e !f $(g) \${h}`]],
  [`${EDIT} name "Pricing talk" ''`, ["name", "Pricing talk", ""]]
];

/** The node in BRIMM Video Studio.app (design part 1), in /Applications and in ~/Applications for a person who is not an admin. */
export const APP_NODE = "/Applications/BRIMM Video Studio.app/Contents/Resources/bin/node";
export const HOME_APP_NODE = "/Users/sallie/Applications/BRIMM Video Studio.app/Contents/Resources/bin/node";
/** A node under a home folder whose name has an apostrophe. */
export const APOSTROPHE_NODE = "/Users/o'hara/.nvm/versions/node/v22.11.0/bin/node";
/** Node bare, as her folder was written before node was quoted. */
export const EDIT_BARE = `${NODE} "${CHECKOUT}/tool/edit.js"`;
/** A command that starts with `start` and runs the checkout's edit.js with `words`. */
const run = (start, words = "episodes", checkout = CHECKOUT) => `${start} "${checkout}/tool/edit.js" ${words}`;
/** What both guards refuse whatever this Mac's node is: other quotes, other paths, quotes that end early or hold more. */
const refusedFor = (node) => [
  run(`'${node}'`), run(`"${node}\\"`),
  run(`"${node}2"`), run(`"${dirname(node)}/nodejs"`), run('"/usr/local/bin/node"'),
  run(`"${node.replace("/bin/", '/bin"/"')}"`),
  run(`"${node}$(date)"`), run(`"$HOME${node}"`), run(`"${node}\`date\`"`),
  run(`"${dirname(node)}"/node`), run(`${dirname(node)}/"node"`),
  `"${node}" -e "1"`, `"${node}" "${CHECKOUT}/tool/unedited.js" --from-plan x`, `"${node}" "/other/tool/edit.js" episodes`,
  run(`"${node}"`, "episodes; date"), run(`"${node}"`, 'open "$(date)"'), ` ${run(`"${node}"`)}`, run(`"${node}" `)
];
/** For each node her folder may be written with: the commands both guards let through (node in double quotes, the open lock's one
    spelling), those only today's guard lets through, and those both refuse. Bare, a path with spaces would have the shells run
    /Applications/BRIMM with the rest as its words; Homebrew's node on a Mac with the app's is a chat begun before the takeover. */
export const NODE_CASES = [
  ...[APP_NODE, HOME_APP_NODE].map((node) => ({ node, both: [run(`"${node}"`), run(`"${node}"`, 'open "Pricing talk"')], strictOnly: [run("node")], refused: [run(node), run(NODE), run(`"${NODE}"`), ...refusedFor(node)] })),
  { node: NODE, both: [run(`"${NODE}"`), run(`"${NODE}"`, 'open "Pricing talk"')], strictOnly: [run("node"), run(NODE), run(NODE, 'open "Pricing talk"')], refused: [run(`"${APP_NODE}"`), ...refusedFor(NODE)] },
  { node: APOSTROPHE_NODE, both: [run(`"${APOSTROPHE_NODE}"`)], strictOnly: [run("node")], refused: [run(APOSTROPHE_NODE), ...refusedFor(APOSTROPHE_NODE)] }
];
/** Paths that cannot stand inside double quotes: her folder is never written with one, and no command is let through with one. */
export const UNQUOTABLE_NODES = ['/Users/sallie/odd"dir/bin/node', "/Users/sallie/$HOME/bin/node", "/Users/sallie/back`tick/bin/node", "/Users/sallie/back\\slash/bin/node", "/Users/sallie/line\nbreak/bin/node", "/Users/sallie/tab\tstop/bin/node"];
export const UNQUOTABLE_CHECKOUTS = ['/Users/sallie/Claude Code/BRIMM" video', "/Users/sallie/Claude Code/$BRIMM video"];
/** Every spelling of edit.js, for `node` and `checkout`. */
export const spellingsOf = (node, checkout = CHECKOUT) => [run(`"${node}"`, "episodes", checkout), run(node, "episodes", checkout), run("node", "episodes", checkout)];
