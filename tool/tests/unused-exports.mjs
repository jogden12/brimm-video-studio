// Phase 2 ("Final Cut retired"): which exports of tool/*.js does no other module import? One line `<module>: <export>` for each,
// then `Imports of files that are not there: <n>` and one line for each such import. Tests are not counted as importers: an
// export only a test uses is unused here. The two scripts in tool/studio/ (.mjs) are counted as importers, since the guard and
// the receipt run from there. The modules of tool/setup/ are counted both ways: as modules (listed as `setup/<module>: <export>`) and
// as importers, of tool/*.js through "../" and of each other through "./". Run by hand: node tool/tests/unused-exports.mjs. It is not a test (`node --test` does not pick it up),
// reads only tool/*.js, tool/setup/*.js and tool/studio/*.mjs, and changes nothing.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TOOL = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modules = readdirSync(TOOL).filter((f) => f.endsWith(".js")).sort();
const setup = existsSync(join(TOOL, "setup")) ? readdirSync(join(TOOL, "setup")).filter((f) => f.endsWith(".js")).sort().map((f) => `setup/${f}`) : [];
const everyModule = [...modules, ...setup];
const studio = existsSync(join(TOOL, "studio")) ? readdirSync(join(TOOL, "studio")).filter((f) => f.endsWith(".mjs")).sort() : [];

/** The source without its comments and string-free of nothing else: a comment that names an import must not count as one. */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

/** The names a `{ a, b as c }` list brings in or sends out, as the names on the exporting side. */
const listed = (inside) => inside.split(",").map((x) => x.trim()).filter(Boolean).map((x) => x.split(/\s+as\s+/)[0].trim());

/** What a module exports: names. */
function exportsOf(text) {
  const names = new Set();
  for (const m of text.matchAll(/^export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of text.matchAll(/^export\s*\{([^}]*)\}/gm)) for (const x of inside(m[1])) names.add(x);
  if (/^export\s+default\b/m.test(text)) names.add("default");
  return names;
}
/** The names an export list gives out (the names others import them by): `a as b` is b. */
function inside(list) {
  return list.split(",").map((x) => x.trim()).filter(Boolean).map((x) => x.split(/\s+as\s+/).pop().trim());
}

const used = new Map(everyModule.map((m) => [m, new Set()]));
const missing = [];
const take = (from, spec, names) => {
  const file = spec.replace(/^\.\//, "");
  if (!existsSync(join(TOOL, file))) {
    if (!missing.some((x) => x.from === from && x.spec === spec)) missing.push({ from, spec });
    return;
  }
  const set = used.get(file);
  if (!set) return;
  for (const n of names) set.add(n);
};

// Each reader says which folders its imports may name, as a prefix of the specifier and the folder under tool/ it stands for.
const readers = [
  ...modules.map((m) => [m, join(TOOL, m), [["./", ""]]]),
  ...setup.map((m) => [m, join(TOOL, m), [["../", ""], ["./", "setup/"]]]),
  ...studio.map((m) => [`studio/${m}`, join(TOOL, "studio", m), [["../", ""]]]),
];
for (const [name, path, ways] of readers) {
  const text = code(readFileSync(path, "utf8"));
  const local = (spec) => {
    if (!spec.endsWith(".js")) return null;
    for (const [prefix, under] of ways) if (spec.startsWith(prefix) && !spec.slice(prefix.length).includes("/")) return under + spec.slice(prefix.length);
    return null;
  };
  const nameOf = (spec) => local(spec);
  // import { a, b as c } from "./x.js"; import x from; import * as x from; import "./x.js"; export { a } from "./x.js"
  for (const m of text.matchAll(/\b(?:import|export)\s+([^;"']*?)\s*from\s*["'](\.{1,2}\/[^"']+)["']/g)) {
    const target = nameOf(m[2]);
    if (target === null) continue;
    const clause = m[1];
    const names = [];
    const braces = clause.match(/\{([^}]*)\}/);
    if (braces) names.push(...listed(braces[1]));
    if (/\*\s*as\s+\w+/.test(clause) || /^\*$/.test(clause.trim())) names.push(...(existsSync(join(TOOL, target)) ? exportsOf(code(readFileSync(join(TOOL, target), "utf8"))) : []));
    const lead = clause.replace(/\{[^}]*\}/, "").replace(/\*\s*as\s+\w+/, "").replace(/,/g, "").trim();
    if (lead && lead !== "type") names.push("default");
    take(name, `./${target}`, names);
  }
  for (const m of text.matchAll(/\bimport\s*["'](\.{1,2}\/[^"']+)["']/g)) {
    const target = nameOf(m[1]);
    if (target !== null) take(name, `./${target}`, []);
  }
  // import("./x.js").then(({ a }) => …) names what it takes; any other dynamic import takes everything.
  for (const m of text.matchAll(/\bimport\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)(\s*\.then\(\s*\(\s*\{([^}]*)\}\s*\))?/g)) {
    const target = nameOf(m[1]);
    if (target === null) continue;
    const all = m[3] === undefined ? (existsSync(join(TOOL, target)) ? [...exportsOf(code(readFileSync(join(TOOL, target), "utf8")))] : []) : listed(m[3]);
    take(name, `./${target}`, all);
  }
}

const lines = [];
for (const m of everyModule) {
  for (const n of [...exportsOf(code(readFileSync(join(TOOL, m), "utf8")))].sort()) if (!used.get(m).has(n)) lines.push(`${m}: ${n}`);
}
console.log(lines.join("\n"));
console.log(`Imports of files that are not there: ${missing.length}`);
for (const x of missing) console.log(`  ${x.from} imports ${x.spec}`);
