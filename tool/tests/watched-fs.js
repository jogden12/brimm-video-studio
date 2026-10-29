// The file system's own functions, watched while a test runs (plan PR 17): `fs` is given a wrapper of each function named, and the bindings of
// the modules that imported them by name are brought up to date (syncBuiltinESMExports), so that code under test that calls `readFileSync` or
// `readdirSync` meets the wrapper. Each call given a path as text is written down, and `deny` may refuse it, as a Mac refuses a program that
// may not wait for a file Dropbox has not brought down (EDEADLK). Everything is put back when the run ends, however it ends. The test files
// run one by one, each in a process of its own, and the tests of a file one after the other, so nothing else is looking meanwhile.
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";

/** The error a read of a placeholder meets in a program that may not wait for Dropbox to bring the file down. */
export const deadlock = (path) => Object.assign(new Error(`EDEADLK: resource deadlock avoided, read '${path}'`), { code: "EDEADLK", path });

/** Run `run`, watching the functions `names` of `fs`: gives { result, calls }, `calls` being { name, path } for each call made with a path as
    text, in the order they were made. `deny(name, path)` gives an error to throw for a call, or nothing to let it go through. */
export async function watched(run, { names = ["readFileSync"], deny = () => null } = {}) {
  const real = Object.fromEntries(names.map((name) => [name, fs[name]]));
  const calls = [];
  for (const name of names) {
    fs[name] = function watching(...args) {
      if (typeof args[0] === "string") {
        calls.push({ name, path: args[0] });
        const refusal = deny(name, args[0]);
        if (refusal) throw refusal;
      }
      return real[name].apply(this, args);
    };
  }
  syncBuiltinESMExports();
  try {
    return { result: await run(), calls };
  } finally {
    Object.assign(fs, real);
    syncBuiltinESMExports();
  }
}
