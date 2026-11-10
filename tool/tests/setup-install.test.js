// The setup engine's staging of the transcription model, the HyperFrames tools and Chrome (tool/setup/install.js), on the made-up Mac.
// No test downloads anything or runs the real npm or curl: each stage is given a stand-in program or a recorder.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PIN, childEnv, cliPath, toolchainDir } from "../hyperframes.js";
import { PARTS } from "../setup/protocol.js";
import { LABELS, MODEL_BYTES, modelPath, modelPin, npmArgs, quiet, runProgram, sha256Of, stageChrome, stageCli, stageModel } from "../setup/install.js";
import { mac } from "./setup-harness.js";

const INSTALL = readFileSync(fileURLToPath(new URL("../install.sh", import.meta.url)), "utf8");
const RUN = readFileSync(fileURLToPath(new URL("../run.js", import.meta.url)), "utf8");
const BYTES = "model bytes";
const pinOf = (bytes) => ({ url: "https://example.invalid/model.bin", sha256: createHash("sha256").update(bytes).digest("hex") });

/** Runs `check` on a made-up Mac whose curl says `bytes`, with the events a stage sent, and takes the Mac away. */
async function withMac(check, { bytes = BYTES } = {}) {
  const m = mac();
  try {
    if (bytes !== null) writeFileSync(join(m.dir, "says", "curl"), bytes);
    const events = [];
    return await check(m, { progress: (e) => events.push(e), events });
  } finally {
    m.done();
  }
}
/** A `run` that records what it was given and ends with `code`. */
const recorder = (code = 0) => {
  const calls = [];
  const run = async (program, args, options) => {
    calls.push({ program, args, env: options.env });
    return { code };
  };
  return { calls, run };
};

describe("LABELS", () => {
  it("has a label for each part", () => {
    assert.deepEqual(Object.keys(LABELS), PARTS);
    assert.equal(LABELS.model, "Transcription model");
    assert.equal(LABELS.hyperframes, "HyperFrames tools");
    assert.equal(LABELS.chrome, "Chrome for HyperFrames");
  });
});

describe("the model's place and pin", () => {
  it("is the path run.js's own text names", () => {
    const name = /const MODEL_NAME = "([^"]+)";/.exec(RUN)[1];
    const parts = /join\(String\(env\.HOME \|\| ""\), ((?:"[^"]+", )+)MODEL_NAME\)/.exec(RUN)[1].match(/"([^"]+)"/g).map((p) => p.slice(1, -1));
    assert.equal(modelPath("/h"), join("/h", ...parts, name));
  });

  it("reads the pin's url and SHA-256 from tool/whisper-model.pin.json", () => {
    const tool = join(dirname(fileURLToPath(import.meta.url)), "..");
    const pin = modelPin(tool);
    assert.match(pin.url, /^https:\/\//);
    assert.match(pin.sha256, /^[0-9a-f]{64}$/);
    assert.equal(MODEL_BYTES, 1624555275);
  });

  it("reads a file's SHA-256 as a stream", async () => {
    await withMac(async (m) => {
      const file = join(m.dir, "x");
      writeFileSync(file, BYTES);
      assert.equal(await sha256Of(file), pinOf(BYTES).sha256);
    });
  });
});

describe("stageModel", () => {
  it("skips a model already there with the pin's SHA-256, and never runs curl", async () => {
    await withMac(async (m, { progress, events }) => {
      mkdirSync(dirname(modelPath(m.home)), { recursive: true });
      writeFileSync(modelPath(m.home), BYTES);
      assert.equal(await stageModel({ home: m.home, pin: pinOf(BYTES), programs: m.programs, progress }), "skipped");
      assert.ok(!/^curl /m.test(m.ran()));
      assert.deepEqual(events.map((e) => e.state), ["running", "skipped"]);
      assert.ok(events.every((e) => e.part === "model" && e.label === "Transcription model"));
    });
  });

  it("downloads to a .part file, checks it, and then gives it its name", async () => {
    await withMac(async (m, { progress, events }) => {
      const pin = pinOf(BYTES);
      assert.equal(await stageModel({ home: m.home, pin, programs: m.programs, progress, pollMs: 20 }), "done");
      assert.ok(m.ran().includes(`curl --fail --location --silent --show-error --output ${modelPath(m.home)}.part ${pin.url}`));
      assert.equal(readFileSync(modelPath(m.home), "utf8"), BYTES);
      assert.ok(!existsSync(`${modelPath(m.home)}.part`));
      assert.equal(events.at(-1).state, "done");
    });
  });

  it("takes away a model whose SHA-256 is not the pin's", async () => {
    await withMac(async (m, { progress, events }) => {
      await assert.rejects(stageModel({ home: m.home, pin: pinOf("other"), programs: m.programs, progress }), (e) => {
        assert.equal(e.code, "download");
        assert.equal(e.message, "The transcription model that was downloaded is not the one BRIMM Video Studio expects. Nothing of it was kept.");
        return true;
      });
      assert.deepEqual(readdirSync(dirname(modelPath(m.home))), []);
      assert.equal(events.at(-1).state, "failed");
    });
  });

  it("leaves no .part file after a curl that fails, and the fault names the model", async () => {
    await withMac(async (m, { progress }) => {
      writeFileSync(join(m.dir, "exits", "curl"), "22");
      await assert.rejects(stageModel({ home: m.home, pin: pinOf(BYTES), programs: m.programs, progress }), (e) => {
        assert.equal(e.code, "download");
        assert.equal(e.message, "The transcription model could not be downloaded (curl 22). Check this Mac's internet connection, then choose Repair.");
        return true;
      });
      assert.ok(!existsSync(`${modelPath(m.home)}.part`));
      assert.ok(!existsSync(modelPath(m.home)));
    });
  });

  it("takes away a .part file left from before", async () => {
    await withMac(async (m, { progress }) => {
      mkdirSync(dirname(modelPath(m.home)), { recursive: true });
      writeFileSync(`${modelPath(m.home)}.part`, "old and longer than the new bytes");
      await stageModel({ home: m.home, pin: pinOf(BYTES), programs: m.programs, progress });
      assert.equal(readFileSync(modelPath(m.home), "utf8"), BYTES);
    });
  });

  it("runs curl with an environment built from scratch", async () => {
    await withMac(async (m, { progress }) => {
      const env = join(m.dir, "env-seen");
      const curl = join(m.dir, "curl-env");
      writeFileSync(curl, `#!/bin/sh\nenv > "${env}"\nout=""; prev=""; for a in "$@"; do [ "$prev" = "--output" ] && out="$a"; prev="$a"; done\nprintf '%s' '${BYTES}' > "$out"\n`);
      chmodSync(curl, 0o755);
      process.env.BRIMM_TEST_LEAK = "leaked";
      try {
        await stageModel({ home: m.home, pin: pinOf(BYTES), programs: { curl }, progress });
      } finally {
        delete process.env.BRIMM_TEST_LEAK;
      }
      const seen = readFileSync(env, "utf8");
      assert.ok(seen.includes(`HOME=${m.home}`));
      assert.ok(seen.includes("LANG=en_US.UTF-8"));
      assert.ok(!seen.includes("BRIMM_TEST_LEAK"));
    });
  });

  it("never passes its total, and has none once the file is larger than expected", async () => {
    await withMac(async (m, { progress, events }) => {
      const slow = join(m.dir, "curl-slow");
      writeFileSync(slow, `#!/bin/sh\nout=""; prev=""; for a in "$@"; do [ "$prev" = "--output" ] && out="$a"; prev="$a"; done\nprintf '1234567890' > "$out"\nsleep 0.3\n`);
      chmodSync(slow, 0o755);
      const pin = pinOf("1234567890");
      await stageModel({ home: m.home, pin, programs: { curl: slow }, progress, bytes: 4, pollMs: 20 });
      assert.ok(events.length >= 3);
      for (const e of events) assert.ok(e.total === null || e.done <= e.total, JSON.stringify(e));
      assert.ok(events.some((e) => e.state === "running" && e.total === null && e.done === 10));
    });
  });

  it("ends curl and takes the .part file away on a stop", async () => {
    await withMac(async (m, { progress }) => {
      const hold = join(m.dir, "hold");
      writeFileSync(hold, "");
      const curl = join(m.dir, "curl-waits");
      writeFileSync(curl, `#!/bin/sh\nout=""; prev=""; for a in "$@"; do [ "$prev" = "--output" ] && out="$a"; prev="$a"; done\nprintf 'abc' > "$out"\nwhile [ -f "${hold}" ]; do sleep 0.05; done\n`);
      chmodSync(curl, 0o755);
      const stop = new AbortController();
      const part = `${modelPath(m.home)}.part`;
      const staged = stageModel({ home: m.home, pin: pinOf(BYTES), programs: { curl }, progress, signal: stop.signal, pollMs: 20 });
      for (let i = 0; i < 100 && !existsSync(part); i++) await new Promise((r) => setTimeout(r, 20));
      assert.ok(existsSync(part));
      stop.abort();
      await assert.rejects(staged, (e) => e.code === "stopped");
      rmSync(hold, { force: true });
      assert.ok(!existsSync(part));
      assert.ok(!existsSync(modelPath(m.home)));
    });
  });
});

describe("stageCli", () => {
  it("skips the HyperFrames CLI when it is already there and right, and never runs npm", async () => {
    await withMac(async (m, { progress, events }) => {
      const { calls, run } = recorder();
      assert.equal(await stageCli({ home: m.home, tools: m.tools, progress, run, differs: () => "" }), "skipped");
      assert.equal(calls.length, 0);
      assert.deepEqual(events.map((e) => e.state), ["running", "skipped"]);
      assert.ok(events.every((e) => e.part === "hyperframes"));
    });
  });

  it("gives npm install.sh's own arguments, with its update notice off", async () => {
    await withMac(async (m, { progress, events }) => {
      const { calls, run } = recorder();
      let looked = 0;
      const differs = () => (looked++ === 0 ? "none" : "");
      assert.equal(await stageCli({ home: m.home, tools: m.tools, progress, run, differs }), "done");
      assert.equal(calls.length, 1);
      assert.equal(calls[0].program, join(m.tools, "npm"));
      assert.deepEqual(calls[0].args, npmArgs(m.home));
      assert.deepEqual(calls[0].env, { HOME: m.home, PATH: `${m.tools}:/usr/bin:/bin`, LANG: "en_US.UTF-8", HYPERFRAMES_NO_TELEMETRY: "1", NPM_CONFIG_UPDATE_NOTIFIER: "false" });
      assert.equal(events.at(-1).state, "done");
    });
  });

  it("uses the arguments of install.sh's own npm line", () => {
    const line = INSTALL.split("\n").find((l) => l.includes('"$npm" install'));
    const words = line.slice(line.indexOf('"$npm" ') + '"$npm" '.length).split(";")[0].trim().split(" ").map((w) => w.replace(/^"|"$/g, ""));
    const home = "/h";
    const filled = words.map((w) => w.replace("$TOOLCHAIN", toolchainDir(home)).replace("$HYPERFRAMES_VERSION", PIN.version));
    assert.deepEqual(filled, npmArgs(home));
  });

  it("takes away a CLI that is not right after npm ran, and only its own folder", async () => {
    await withMac(async (m, { progress, events }) => {
      const dir = toolchainDir(m.home);
      const beside = join(dirname(dir), "keep-me");
      mkdirSync(dir, { recursive: true });
      mkdirSync(beside, { recursive: true });
      const { run } = recorder();
      await assert.rejects(stageCli({ home: m.home, tools: m.tools, progress, run, differs: () => "none" }), (e) => {
        assert.equal(e.code, "download");
        assert.equal(e.message, "The HyperFrames tools could not be fetched as BRIMM Video Studio expects them. Check this Mac's internet connection, then choose Repair.");
        return true;
      });
      assert.ok(!existsSync(dir));
      assert.ok(existsSync(beside));
      assert.equal(events.at(-1).state, "failed");
    });
  });

  it("takes the folder away when npm itself fails", async () => {
    await withMac(async (m, { progress }) => {
      const { run } = recorder(1);
      await assert.rejects(stageCli({ home: m.home, tools: m.tools, progress, run, differs: () => "none" }), (e) => e.code === "download");
      assert.ok(!existsSync(toolchainDir(m.home)));
    });
  });
});

describe("stageChrome", () => {
  it("is fetched by the pinned CLI's own browser ensure", async () => {
    await withMac(async (m, { progress, events }) => {
      const { calls, run } = recorder();
      assert.equal(await stageChrome({ home: m.home, tools: m.tools, progress, run }), "done");
      assert.equal(calls.length, 1);
      assert.equal(calls[0].program, join(m.tools, "node"));
      assert.deepEqual(calls[0].args, [cliPath(m.home), "browser", "ensure"]);
      assert.deepEqual(calls[0].env, childEnv({ base: { HOME: m.home }, node: join(m.tools, "node") }));
      assert.deepEqual(events.map((e) => e.state), ["running", "done"]);
      assert.ok(events.every((e) => e.part === "chrome"));
    });
  });

  it("fails with the line for Chrome when the CLI cannot fetch it", async () => {
    await withMac(async (m, { progress, events }) => {
      const { run } = recorder(1);
      await assert.rejects(stageChrome({ home: m.home, tools: m.tools, progress, run }), (e) => {
        assert.equal(e.code, "download");
        assert.equal(e.message, "HyperFrames could not fetch its copy of Chrome. Check this Mac's internet connection, then choose Repair.");
        return true;
      });
      assert.equal(events.at(-1).state, "failed");
    });
  });
});

describe("quiet", () => {
  it("drops docker's line, and keeps every other line as it was", () => {
    const text = ["one  ", "/bin/sh: docker: command not found", "/bin/sh: line 1: docker: command not found", "/bin/sh: line 2: docker: command not found!", "", "last"].join("\n");
    assert.equal(quiet(text), ["one  ", "/bin/sh: line 2: docker: command not found!", "", "last"].join("\n"));
  });
});

describe("runProgram", () => {
  /** A stand-in program in the test's own folder: prints docker's line and another, to stdout and stderr, then waits `wait` seconds. */
  const standIn = (m, wait) => {
    const file = join(m.dir, "prints");
    writeFileSync(file, `#!/bin/sh\necho hello\necho "/bin/sh: docker: command not found" >&2\necho $$ > "${join(m.dir, "pid")}"\nexec sleep ${wait}\n`);
    chmodSync(file, 0o755);
    return file;
  };
  const capture = () => {
    const chunks = [];
    return { chunks, errors: { write: (text) => chunks.push(String(text)) } };
  };

  it("writes what a program printed to the errors once, without docker's line, and resolves with its code", async () => {
    await withMac(async (m) => {
      const { chunks, errors } = capture();
      assert.deepEqual(await runProgram(standIn(m, 0), [], { env: { PATH: "/usr/bin:/bin" }, errors }), { code: 0 });
      assert.equal(chunks.join(""), "hello\n");
    });
  });

  it("writes it once when a stop ends the program, and resolves with no code", async () => {
    await withMac(async (m) => {
      const { chunks, errors } = capture();
      const stop = new AbortController();
      const ran = runProgram(standIn(m, 5), [], { env: { PATH: "/usr/bin:/bin" }, signal: stop.signal, errors });
      await new Promise((r) => setTimeout(r, 300));
      stop.abort();
      assert.deepEqual(await ran, { code: null });
      // The stand-in is its own sleep (exec), so a stop closes its pipes: wait until it is gone, and then for its close event to be handled.
      const pid = Number(readFileSync(join(m.dir, "pid"), "utf8"));
      const alive = () => {
        try {
          process.kill(pid, 0);
          return true;
        } catch {
          return false;
        }
      };
      for (let i = 0; i < 100 && alive(); i++) await new Promise((r) => setTimeout(r, 50));
      assert.ok(!alive());
      await new Promise((r) => setTimeout(r, 300));
      assert.equal(chunks.join(""), "hello\n");
    });
  });
});
