// One of several runs racing for an episode's lock, for the stress test in detached.test.js. It is run as its own process:
//   node lock-racer.js <home> <episode folder> <folder for what it saw>
// The lock it finds was left by a run that died. Each look at whether a run is alive takes up to 30 ms, so that the runs'
// steps interleave. While it works it leaves working-<pid> in the folder for what it saw, writes overlap-<pid> when another
// run is at work too, and lost-<pid> when the lock is no longer its own. It prints what runDetached gave back.
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runDetached, lockOf } from "../detached.js";
import { isRunning } from "../run.js";

const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const [home, folder, seen] = process.argv.slice(2);
const mine = `working-${process.pid}`;
const alive = (pid) => {
  pause(Math.random() * 30);
  return isRunning(pid);
};
const got = await runDetached({ home, folder, command: `run-${process.pid}`, keepAwake: () => {}, alive }, async () => {
  writeFileSync(join(seen, mine), "");
  const others = readdirSync(seen).filter((n) => n.startsWith("working-") && n !== mine);
  if (others.length) writeFileSync(join(seen, `overlap-${process.pid}`), others.join(","));
  await new Promise((done) => setTimeout(done, 60));
  let held = null;
  try {
    held = JSON.parse(readFileSync(lockOf(home, folder), "utf8"));
  } catch (e) {
    // The lock is gone, which is lost too.
  }
  if (!held || held.pid !== process.pid) writeFileSync(join(seen, `lost-${process.pid}`), JSON.stringify(held));
  rmSync(join(seen, mine));
  return { ok: true, made: [], failed: [], next: "" };
});
process.stdout.write(JSON.stringify(got.running ? { running: got.running } : { ran: true }));
