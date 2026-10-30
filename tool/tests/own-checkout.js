// The checkout the tests are in, and the commit it is at. A record or a hand-off made by this code names that commit, whatever
// checkout the settings of a Mac name (filing.js thisCheckout), so the tests that look for it take it from here: the folder is
// worked out from this file's place (tool/tests/), and the commit is asked of git, as the tests run. Nothing here writes anything.
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** The checkout this code is in: the folder above tool/. */
export const OWN_CHECKOUT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/** The short commit it is at, as git says it. A test that needs it cannot tell which brimm-video wrote a record without it, so it
    stops here, saying why, when git cannot say. */
export const OWN_COMMIT = (() => {
  const ran = spawnSync("git", ["-C", OWN_CHECKOUT, "rev-parse", "--short", "HEAD"], { encoding: "utf8" });
  const commit = ran.status === 0 ? String(ran.stdout).trim() : "";
  if (!/^[0-9a-f]{7,}$/.test(commit)) throw new Error(`git could not say which commit ${OWN_CHECKOUT} is at, so a test cannot tell which brimm-video wrote a record.`);
  return commit;
})();
