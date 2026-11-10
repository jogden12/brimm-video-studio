// The BRIMM Video Studio Getting Started guide: the page the setup engine writes into BRIMM Video Work at the end of a setup,
// which the Mac app prints to a PDF beside it. This file is not tool/guide.js (the BRIMM Ops contract's) and imports nothing from it.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { REPAIR, UPDATE_SAY } from "../build.js";
import { dropFolderOf, exportsFolderOf, folderWords, workFolder } from "../settings.js";
import { studioFolder } from "../studio.js";

export const GUIDE_NAME = "BRIMM Video Studio Getting Started";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const NOTHING_TO_INSTALL = "Nothing: every app is here.";
const NO_SUPPORT = "the person who set up this Mac";
const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(HERE, "guide-template.html");
const FONTS = join(HERE, "..", "brand", "fonts");
const MIME = { woff2: "font/woff2", ttf: "font/ttf" };

/** The date as the guide spells it, in the Mac's own time: 9 November 2026. */
const spelled = (when) => `${when.getDate()} ${MONTHS[when.getMonth()]} ${when.getFullYear()}`;

/** Every value the template asks for. `missing` is the names of the apps still to install. */
export function guideData({ home, settings, build, missing = [], notes = [], now = new Date() }) {
  const names = missing.map((app) => (typeof app === "string" ? app : app?.name)).filter(Boolean);
  return {
    machine: settings.machine,
    drop: folderWords(dropFolderOf(settings, home), home),
    exports: folderWords(exportsFolderOf(settings, home), home),
    root: folderWords(settings.root, home),
    version: build?.version ?? "",
    build: build?.build ?? "",
    support: build?.support || NO_SUPPORT,
    studio: folderWords(studioFolder(home), home),
    toInstall: names.length ? names : [NOTHING_TO_INSTALL],
    notes: [...notes],
    update: UPDATE_SAY,
    repair: REPAIR,
    date: spelled(now),
  };
}

const escaped = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The page, whole: `{{key}}` is a value, `{{list:key}}` a list's lines as <li>, `{{font:<file>}}` a data: URI of a file in `fonts`.
    A `<section data-when="key">` is left out when the list `key` is empty, and is kept, without the mark, when it is not. */
export function fillGuide(template, data, { fonts = FONTS } = {}) {
  const shown = template.replace(/<section data-when="([^"]+)">([\s\S]*?<\/section>\n?)/g, (whole, key, rest) => (Array.isArray(data[key]) && data[key].length === 0 ? "" : `<section>${rest}`));
  return shown.replace(/\{\{(list:|font:)?([^{}]+?)\}\}/g, (mark, kind, key) => {
    if (kind === "font:") {
      const type = MIME[key.split(".").pop().toLowerCase()];
      if (!type || /[\\/]/.test(key)) throw new Error(`The guide cannot hold the font "${key}".`);
      let bytes;
      try {
        bytes = readFileSync(join(fonts, key));
      } catch {
        throw new Error(`The guide's font "${key}" is not in ${fonts}.`);
      }
      return `data:${type};base64,${bytes.toString("base64")}`;
    }
    if (!Object.hasOwn(data, key)) throw new Error(`The guide's template asks for "${key}", which it was not given.`);
    const value = data[key];
    if (kind === "list:") {
      if (!Array.isArray(value)) throw new Error(`The guide's template asks for "${key}" as a list, which it is not.`);
      return value.map((line) => `<li>${escaped(line)}</li>`).join("\n");
    }
    return escaped(value);
  });
}

/** Writes the guide into BRIMM Video Work and names where its PDF goes, which the app's shell prints. */
export function writeGuide({ home, data, template = readFileSync(TEMPLATE, "utf8"), fonts = FONTS }) {
  const folder = workFolder(home);
  mkdirSync(folder, { recursive: true });
  const html = join(folder, `${GUIDE_NAME}.html`);
  writeFileSync(html, fillGuide(template, data, { fonts }));
  return { html, pdf: join(folder, `${GUIDE_NAME}.pdf`) };
}
