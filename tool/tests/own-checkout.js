// The checkout the tests are in, and the commit it is at. A record or a hand-off made by this code names that commit, whatever
// checkout the settings of a Mac name (filing.js thisCheckout), so the tests that look for it take it from here: the folder is
// worked out from this file's place (tool/tests/), and the commit is asked of git, as the tests run. Nothing here writes anything.
// Git cannot always say: a copy of the checkout with no .git, or a checkout of another user's, which git will not look at. This file
// never stops for that. The commit is then null, and a test that needs it is skipped, with the reason (WITHOUT_COMMIT), so that
// every other test of its file still runs.
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** The checkout this code is in: the folder above tool/. */
export const OWN_CHECKOUT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/** The short commit it is at, as git says it, or null when git cannot say. */
export const OWN_COMMIT = (() => {
  const ran = spawnSync("git", ["-C", OWN_CHECKOUT, "rev-parse", "--short", "HEAD"], { encoding: "utf8" });
  const commit = ran.status === 0 ? String(ran.stdout).trim() : "";
  return /^[0-9a-f]{7,}$/.test(commit) ? commit : null;
})();

/** The `skip` option of a test that needs OWN_COMMIT: why it is skipped, in plain words, or false when git said the commit. */
export const WITHOUT_COMMIT = OWN_COMMIT === null ? "git can't say this checkout's commit" : false;
