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
/** Nodes whose paths can stand in double quotes but are not plain words, so the strict guard refuses them bare. */
export const BRACE_NODE = "/Users/sallie/a{b,c}/bin/node";
export const STAR_NODE = "/Users/sallie/a*b/bin/node";
export const ACCENT_NODE = "/Users/sallie/Médias/bin/node";
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
  run(`"${node}"`, "episodes; date"), run(`"${node}"`, 'open "$(date)"'), ` ${run(`"${node}"`)}`, run(`"${node}" `),
  // Look-alikes: curly and fullwidth quotes, other spaces between the two quoted words, the word node quoted, a tilde, and
  // words glued to a closing quote.
  run(`\u201c${node}\u201d`), run(`\uff02${node}\uff02`), run('"node"'),
  ...["\u00a0", "\u3000", "\t", "\n"].map((space) => `"${node}"${space}"${CHECKOUT}/tool/edit.js" episodes`),
  run("~/Applications/BRIMM Video Studio.app/Contents/Resources/bin/node"), run('~/"Applications/BRIMM Video Studio.app/Contents/Resources/bin/node"'), run('"~/Applications/BRIMM Video Studio.app/Contents/Resources/bin/node"'),
  run(`"${node}"2`), run(`"${node}"''`), `"${node}" "${CHECKOUT}/tool/edit.js""x" episodes`
];
/** For each node her folder may be written with: the commands both guards let through (node in double quotes, the open lock's one
    spelling), those only today's guard lets through, and those both refuse. Bare, a path with spaces would have the shells run
    /Applications/BRIMM with the rest as its words; Homebrew's node on a Mac with the app's is a chat begun before the takeover. */
const quotableRow = (node) => ({ node, both: [run(`"${node}"`), run(`"${node}"`, 'open "Pricing talk"')], strictOnly: [run("node")], refused: [run(node), ...refusedFor(node)] });
export const NODE_CASES = [
  ...[[APP_NODE, HOME_APP_NODE], [HOME_APP_NODE, APP_NODE]].map(([node, other]) => ({ node, both: [run(`"${node}"`), run(`"${node}"`, 'open "Pricing talk"')], strictOnly: [run("node")], refused: [run(node), run(NODE), run(`"${NODE}"`), run(`"${other}"`), ...refusedFor(node)] })),
  { node: NODE, both: [run(`"${NODE}"`), run(`"${NODE}"`, 'open "Pricing talk"')], strictOnly: [run("node"), run(NODE), run(NODE, 'open "Pricing talk"')], refused: [run(`"${APP_NODE}"`), run(`"${HOME_APP_NODE}"`), ...refusedFor(NODE)] },
  { node: APOSTROPHE_NODE, both: [run(`"${APOSTROPHE_NODE}"`)], strictOnly: [run("node")], refused: [run(APOSTROPHE_NODE), ...refusedFor(APOSTROPHE_NODE)] },
  quotableRow(BRACE_NODE), quotableRow(STAR_NODE), quotableRow(ACCENT_NODE)
];
/** Paths that cannot stand inside double quotes: her folder is never written with one, and no command is let through with one. */
export const UNQUOTABLE_NODES = ['/Users/sallie/odd"dir/bin/node', "/Users/sallie/$HOME/bin/node", "/Users/sallie/back`tick/bin/node", "/Users/sallie/back\\slash/bin/node", "/Users/sallie/line\nbreak/bin/node", "/Users/sallie/tab\tstop/bin/node",
  "/Users/sallie/carriage\rreturn/bin/node", "/Users/sallie/nul\u0000byte/bin/node", "/Users/sallie/unit\u001fsep/bin/node", "/Users/sallie/del\u007fchar/bin/node", "bin/node"];
export const UNQUOTABLE_CHECKOUTS = ['/Users/sallie/Claude Code/BRIMM" video', "/Users/sallie/Claude Code/$BRIMM video", "/Users/sallie/Claude Code/BRIMM`video", "/Users/sallie/Claude Code/BRIMM\\video", "/Users/sallie/Claude Code/BRIMM\nvideo", "Claude Code/BRIMM video"];
/** What a guard answers to a command it lets through (the strict guard's reason) and to one it refuses. */
export const OWN = { decision: "allow", reason: "BRIMM Video Studio's own command" };
export const REFUSED = { decision: "deny", reason: "In this folder Claude runs only BRIMM Video Studio's own commands. Ask Jason for anything else." };
/** What the studio command and writeStudio say when node or the checkout cannot stand inside double quotes (pinned text). */
export const NODE_FAULT = 'the path to node holds a letter that cannot go inside double quotes (", $, `, \\ or a control character)';
export const CHECKOUT_FAULT = 'the path to the checkout of BRIMM Video Studio holds a letter that cannot go inside double quotes (", $, `, \\ or a control character)';
/** The starts of an edit.js command the strict guard lets through for `node`: node in double quotes, the word node, and node bare when its path is a plain word. */
export const strictStartsOf = (node) => [`"${node}"`, "node", ...(/^\/[A-Za-z0-9_.,:+=@%/-]*$/.test(node) ? [node] : [])];
/** The one start the open guard lets through. */
export const openStartsOf = (node) => [`"${node}"`];
/** Commands that begin with, or run, `edit` (a start and the checkout's edit.js) and that no guard lets through: whatever follows could run more, or runs in front. */
export const tailRefusals = (edit) => [
  `${edit} open x; cat /etc/hosts`, `${edit} open x && date`, `${edit} open x | sh`, `${edit} open x &`, `${edit} open $(date)`, `${edit} open "$(cat ~/.ssh/id_ed25519)"`, `${edit} open "\`date\`"`,
  `${edit} open x > /tmp/y`, `${edit} open < /etc/hosts`, `${edit} episodes|sh`, `${edit} episodes||date`, `${edit} episodes&&date`, `${edit} episodes&`, `${edit} open x>/tmp/y`, `${edit} open x<y`,
  `${edit} open x\ndate`, `${edit} open "a\nb"`, ` ${edit} episodes`, `${edit}  episodes`, `${edit} episodes `, `${edit} episodes\n`, `${edit} `,
  ...["nice", "env -u SANDBOX_RUNTIME", "env", "timeout 60", "nohup", "time", "stdbuf -o0", "xargs", "sudo", "command", "exec", "A=1", "cd /tmp &&"].map((before) => `${before} ${edit} episodes`)
];
/** Every spelling of edit.js, for `node` and `checkout`. */
export const spellingsOf = (node, checkout = CHECKOUT) => [run(`"${node}"`, "episodes", checkout), run(node, "episodes", checkout), run("node", "episodes", checkout)];
