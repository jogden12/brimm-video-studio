// The made-up toolchain folders the tests of toolchainHolds and of `behind`'s check of the toolchain share (toolchain.test.js,
// behind-toolchain.test.js): a home of the test's own, with the folder of the pinned command line in it as the installer leaves it,
// changed as a test says. Nothing here touches a real home or runs a program; the program in it is a line of text.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PIN, cliPath, toolchainDir } from "../hyperframes.js";

/** An integrity string that is shaped as one and is not the pin's. */
export const OTHER_INTEGRITY = `sha512-${"A".repeat(86)}==`;

/** Put the toolchain folder of the pin into `home`, as the installer leaves it, changed by `over`: `version` (null for no
    package.json), `integrity` ("" for a lock file that has none, null for no lock file) and `program` (false for no program). */
export function putToolchain(home, over = {}) {
  const { version = PIN.version, integrity = PIN.integrity, program = true } = over;
  const dir = toolchainDir(home);
  const put = (path, text) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  };
  if (version !== null) put(join(dir, "node_modules", "hyperframes", "package.json"), JSON.stringify({ name: "hyperframes", version }));
  if (integrity !== null) put(join(dir, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "node_modules/hyperframes": { version: version ?? PIN.version, ...(integrity ? { integrity } : {}) } } }));
  if (program) put(cliPath(home), "// the pinned program\n");
  return dir;
}

/** A home of the test's own with the toolchain folder of the pin in it, changed by `over` (putToolchain). Gives { home, dir, done }. */
export function toolchainIn(over = {}) {
  const home = mkdtempSync(join(tmpdir(), "brimm-toolchain-"));
  const dir = putToolchain(home, over);
  return { home, dir, done: () => rmSync(home, { recursive: true, force: true }) };
}
