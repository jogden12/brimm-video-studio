// The shipped BRIMM style pack for Reel Kit (tool/brand/reel-kit/; spec 2026-11-23 Reel Kit in Studio; plan Task 7).
// Its colours are read from brand.md, never typed a second time here.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BRAND = join(dirname(fileURLToPath(import.meta.url)), "..", "brand");
const PACK = join(BRAND, "reel-kit");
const read = (p) => readFileSync(p, "utf8");
const brand = read(join(BRAND, "brand.md"));
const style = JSON.parse(read(join(PACK, "style.json")));
const css = read(join(PACK, "brand.css"));
const md = read(join(PACK, "STYLE.md"));
const board = read(join(PACK, "board", "index.html"));

/** The hex in brand.md's colour table row for a name. */
const row = (name) => {
  const m = brand.match(new RegExp(`^\\| ${name} \\| \`(#[0-9A-Fa-f]{6})\``, "m"));
  assert.ok(m, `brand.md has no row for ${name}`);
  return m[1].toUpperCase();
};
const sandOnLight = () => {
  const m = brand.match(/Sand on light[^`\n]*`(#[0-9A-Fa-f]{6})`/);
  assert.ok(m, "brand.md has no 'Sand on light' line");
  return m[1].toUpperCase();
};
const files = (dir) =>
  readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)).map((x) => join(f, x)) : [f]));
const upper = (s) => s.toUpperCase();

describe("the shipped Reel Kit style pack", () => {
  it("uses brand.md's colours: Smoke, Navy, Sand, and Sand on light", () => {
    const c = style.colors;
    assert.equal(upper(c.light), row("Smoke"));
    assert.equal(upper(c.dark), row("Navy"));
    assert.equal(upper(c.ink), row("Navy"));
    assert.equal(upper(c.accent), row("Sand"));
    assert.equal(upper(c.accent_on_light), sandOnLight());
    assert.equal(upper(c.hair_light), row("Dune"));
    assert.equal(upper(c.muted_light), row("Fog"));
    assert.equal(upper(c.muted_dark), row("Light gray"));
    for (const [name, hex] of [["Smoke", row("Smoke")], ["Navy", row("Navy")], ["Sand", row("Sand")], ["Sand on light", sandOnLight()]]) {
      assert.ok(md.toUpperCase().includes(hex), `STYLE.md omits ${name} ${hex}`);
      assert.ok(css.toUpperCase().includes(hex), `brand.css omits ${name} ${hex}`);
    }
  });

  it("sets Josefin Sans in every role, and Allison only as a hand-built word", () => {
    for (const role of ["display", "text", "mono", "caption"]) assert.equal(style.fonts[role].family, "Josefin Sans", role);
    assert.ok(!/allison/i.test(JSON.stringify(style)), "style.json names Allison");
    assert.ok(!/allison/i.test(css), "brand.css names Allison");
    const lines = md.split("\n").filter((l) => /allison/i.test(l));
    assert.ok(lines.length > 0);
    assert.ok(lines.some((l) => /hand-built/i.test(l)), "STYLE.md does not say Allison is hand-built");
    for (const f of css.match(/font-family:\s*'[^']+'/g) ?? []) assert.match(f, /Josefin Sans/);
  });

  it("names only fonts that tool/brand/fonts holds", () => {
    const held = new Set(readdirSync(join(BRAND, "fonts")));
    const named = [...css.matchAll(/url\('fonts\/([^']+)'\)/g)].map((m) => m[1]);
    assert.ok(named.length >= 4);
    for (const n of named) assert.ok(held.has(n), `${n} is not in tool/brand/fonts`);
    const listed = JSON.parse(read(join(PACK, "board", "files.json")));
    for (const f of listed.filter((x) => x.startsWith("fonts/"))) assert.ok(held.has(f.slice(6)), `${f} is not in tool/brand/fonts`);
    for (const f of listed.filter((x) => !x.startsWith("fonts/"))) assert.ok(existsSync(join(PACK, "board", f)), `${f} is missing`);
    assert.ok(!existsSync(join(PACK, "fonts")) && !existsSync(join(PACK, "board", "fonts")), "fonts are copied in by Task 8, not committed");
  });

  it("names the creator Sallie Ogden, the show The BRIMM, and never Sallie Holder", () => {
    assert.equal(style.creator.name, "Sallie Ogden");
    assert.match(md, /Sallie Ogden/);
    assert.match(md, /The BRIMM/);
    for (const f of files(PACK).filter((x) => /\.(md|json|css|html)$/.test(x))) {
      const t = read(join(PACK, f));
      for (const m of t.matchAll(/Sallie Holder/g)) {
        const around = t.slice(Math.max(0, m.index - 20), m.index);
        assert.match(around, /["“]$|Never |no /i, `${f} uses Sallie Holder as a name`);
      }
    }
  });

  it("says calm motion, light sound and no music", () => {
    assert.equal(style.motion, "calm");
    assert.equal(style.sound.sfx, "light");
    assert.equal(style.sound.music, "none");
    assert.match(md, /^## Motion\n+Calm/m);
    assert.match(md, /^## Sound\n+Light[^\n]*No music/m);
  });

  it("holds no absolute path or Dropbox label", () => {
    for (const f of files(PACK).filter((x) => /\.(md|json|css|html)$/.test(x))) {
      const t = read(join(PACK, f));
      assert.ok(!/\/Users\/|\/home\/|file:\/\/|[A-Z]:\\|Dropbox|~\//.test(t), `${f} holds a local path or a Dropbox label`);
    }
    assert.ok(board.length > 0);
  });
});
