// The guard's cases, shared by studio.test.js (today's guard) and guard-open.test.js (the open guard), moved out of studio.test.js
// word for word: importing studio.test.js itself would run its whole suite again. The checkout and node are spelled as her folder's
// settings spell them on her laptop; nothing here is run.
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
