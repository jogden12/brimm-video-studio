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
import { CLAUDE_INSTALL_ARGS, LABELS, MODEL_BYTES, claudePin, installClaudeCode, modelPath, modelPin, npmArgs, quiet, runProgram, sha256Of, signIn, signInLinkOf, stageChrome, stageCli, stageModel } from "../setup/install.js";
import { claudeAt } from "../setup/checks.js";
import { signInQuestion } from "../setup/questions.js";
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

const FLOOR = "2.1.295";
const wholePin = { version: "2.1.300", url: "https://example.invalid/claude", sha256: "a".repeat(64) };
const INSTALLER = `#!/bin/sh
if [ "$1" = install ]; then
  mkdir -p "$HOME/.local/bin"
  printf '#!/bin/sh\\necho "2.1.300 (Claude Code)"\\n' > "$HOME/.local/bin/claude"
  chmod 755 "$HOME/.local/bin/claude"
fi
`;
const cachesOf = (home) => join(home, "Library", "Caches", "BRIMM Video Studio");

describe("claudePin", () => {
  it("is whole only with a version, an https address and a 64-digit SHA-256, and never below the floor", () => {
    const m = mac();
    try {
      const at = (pin) => {
        writeFileSync(join(m.checkout, "tool", "claude-code.pin.json"), JSON.stringify(pin));
        return claudePin(join(m.checkout, "tool"));
      };
      assert.deepEqual(at(wholePin), wholePin);
      assert.equal(at({ ...wholePin, url: "http://example.invalid/claude" }), null);
      assert.equal(at({ ...wholePin, sha256: "a".repeat(63) }), null);
      assert.equal(at({ ...wholePin, version: "2.0.0" }), null);
      assert.equal(at({ ...wholePin, version: "2.1" }), null);
      assert.equal(at({ ...wholePin, version: FLOOR }) !== null, true);
    } finally {
      m.done();
    }
  });

  it("no pin file, or one that is not whole, gives no pin", () => {
    const m = mac();
    try {
      assert.equal(claudePin(join(m.checkout, "tool")), null);
      writeFileSync(join(m.checkout, "tool", "claude-code.pin.json"), "{");
      assert.equal(claudePin(join(m.checkout, "tool")), null);
    } finally {
      m.done();
    }
  });
});

describe("installClaudeCode", () => {
  const withInstaller = async (check, { script = INSTALLER, exit } = {}) => {
    const m = mac({ claude: "none" });
    try {
      writeFileSync(join(m.dir, "says", "curl"), script);
      if (exit !== undefined) writeFileSync(join(m.dir, "exits", "curl"), String(exit));
      const said = [];
      const pin = { ...wholePin, sha256: createHash("sha256").update(script).digest("hex") };
      return await check(m, { pin, said, say: (line) => said.push(line) });
    } finally {
      m.done();
    }
  };
  const caches = (m) => (existsSync(cachesOf(m.home)) ? readdirSync(cachesOf(m.home)).filter((n) => n.startsWith("claude-")) : []);

  it("is run with `install`", () => assert.deepEqual(CLAUDE_INSTALL_ARGS, ["install"]));

  it("is downloaded, checked against the pin, installed by its own install step, and the download is taken away", async () => {
    await withInstaller(async (m, { pin, said, say }) => {
      const found = await installClaudeCode({ home: m.home, tools: m.tools, pin, programs: m.programs, say });
      assert.equal(found, join(m.home, ".local", "bin", "claude"));
      assert.equal(claudeAt({ home: m.home, tools: m.tools }), found);
      assert.deepEqual(said, ["Downloading Claude Code.", "Installing Claude Code."]);
      assert.deepEqual(caches(m), []);
      assert.match(m.ran(), new RegExp(`--output ${cachesOf(m.home).replaceAll(".", "\\.")}/claude-2\\.1\\.300\\.part https://example\\.invalid/claude`));
    });
  });

  it("a Claude Code download whose SHA-256 is not the pin's is never run", async () => {
    await withInstaller(async (m, { pin, say }) => {
      writeFileSync(join(m.dir, "says", "curl"), `#!/bin/sh\necho ran > "${join(m.dir, "was-run")}"\n`);
      await assert.rejects(installClaudeCode({ home: m.home, tools: m.tools, pin, programs: m.programs, say }), { message: "The copy of Claude Code that was downloaded is not the one BRIMM Video Studio expects. Nothing of it was kept." });
      assert.equal(existsSync(join(m.dir, "was-run")), false);
      assert.deepEqual(caches(m), []);
    });
  });

  it("a download that fails says so, and keeps nothing", async () => {
    await withInstaller(async (m, { pin, say }) => {
      await assert.rejects(installClaudeCode({ home: m.home, tools: m.tools, pin, programs: m.programs, say }), { message: "Claude Code could not be installed. Check this Mac's internet connection, then try again." });
      assert.deepEqual(caches(m), []);
    }, { exit: 22 });
  });

  it("an install that leaves no Claude Code behind fails, and keeps nothing", async () => {
    await withInstaller(async (m, { pin, say }) => {
      await assert.rejects(installClaudeCode({ home: m.home, tools: m.tools, pin, programs: m.programs, say }), { message: "Claude Code could not be installed. Check this Mac's internet connection, then try again." });
      assert.deepEqual(caches(m), []);
    }, { script: "#!/bin/sh\nexit 0\n" });
  });
});

describe("signInLinkOf", () => {
  it("passes a link on only when it is https and its host is claude.ai, claude.com or anthropic.com", () => {
    assert.equal(signInLinkOf("Open https://claude.ai/oauth/authorize?code=true to sign in"), "https://claude.ai/oauth/authorize?code=true");
    assert.equal(signInLinkOf("visit https://console.anthropic.com/x now"), "https://console.anthropic.com/x");
    assert.equal(signInLinkOf("https://claude.com/x"), "https://claude.com/x");
    for (const bad of ["http://claude.ai/x", "https://claude.ai.example.invalid/x", "https://example.invalid/?next=https://claude.ai/x", "https://user:pw@claude.ai/x", "https://notclaude.ai/x", "https://example.invalid/x"]) {
      assert.equal(signInLinkOf(bad), null, bad);
    }
  });

  it("gives the first link that passes, not the first link", () => {
    assert.equal(signInLinkOf("https://example.invalid/a then https://claude.ai/b"), "https://claude.ai/b");
  });

  it("colour codes around a link are taken off", () => {
    assert.equal(signInLinkOf("go to \u001b[4m\u001b[36mhttps://claude.ai/oauth/authorize?x=1\u001b[0m\u001b[39m please"), "https://claude.ai/oauth/authorize?x=1");
  });
});

describe("signIn", () => {
  const LINK = "https://claude.ai/oauth/authorize?code=true";
  const withLogin = async (check, { claude = "signed-in", login = `Open ${LINK}\nPaste the code here.\n` } = {}) => {
    const m = mac({ claude });
    try {
      writeFileSync(join(m.dir, "says", "claude-login"), login);
      const asked = [];
      return await check(m, { asked });
    } finally {
      m.done();
    }
  };
  const base = (m) => ({ home: m.home, tools: m.tools, claude: join(m.home, ".local", "bin", "claude"), programs: m.programs });
  const filesUnder = (dir) => readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));

  it("the pasted code reaches claude and nothing else", async () => {
    await withLogin(async (m, { asked }) => {
      const written = [];
      const real = process.stderr.write;
      process.stderr.write = (chunk, ...rest) => (written.push(String(chunk)), true);
      let result;
      try {
        result = await signIn({ ...base(m), linkWaitMs: 2000, settleMs: 2000, ask: async (q) => (asked.push(q), { code: "9f3a-code" }) });
      } finally {
        process.stderr.write = real;
      }
      assert.equal(readFileSync(join(m.dir, "claude-got"), "utf8"), "9f3a-code\n");
      assert.equal(asked[0].link, LINK);
      assert.equal(JSON.stringify([asked, result, written]).includes("9f3a-code"), false);
      assert.equal(m.ran().includes("9f3a-code"), false);
      for (const file of filesUnder(m.dir)) {
        if (file === join(m.dir, "claude-got")) continue;
        assert.equal(readFileSync(file).includes("9f3a-code"), false, file);
      }
      assert.deepEqual(result, { signedIn: true, plan: "max" });
    });
  });

  it("starts claude under script, with a terminal of its own", async () => {
    await withLogin(async (m) => {
      await signIn({ ...base(m), linkWaitMs: 2000, settleMs: 2000, ask: async () => ({ code: "x" }) });
      assert.match(m.ran(), new RegExp(`script -q /dev/null ${join(m.home, ".local", "bin", "claude").replaceAll(".", "\\.")} auth login`));
    });
  });

  it("asks without a link when none comes, then asks again with it when it does", async () => {
    await withLogin(async (m, { asked }) => {
      // Claude prints its link two seconds after it starts; the question is asked after 100 ms without one.
      const slow = join(m.home, ".local", "bin", "claude");
      writeFileSync(slow, `#!/bin/sh\ncase "$*" in\n  "auth login") sleep 0.6; echo "${LINK}"; read -r line; printf '%s\\n' "$line" > "${join(m.dir, "claude-got")}" ;;\n  "auth status --json") cat "${join(m.dir, "says", "claude-status")}" ;;\n  --version) cat "${join(m.dir, "says", "claude-version")}" ;;\nesac\n`);
      chmodSync(slow, 0o755);
      let answer;
      const answered = new Promise((r) => (answer = r));
      const ask = (q) => {
        asked.push(q);
        if (q.link) answer();
        return answered.then(() => ({}));
      };
      await signIn({ ...base(m), linkWaitMs: 100, settleMs: 20, ask });
      assert.equal(asked.length, 2);
      assert.equal(asked[0].link, undefined);
      assert.equal(asked[1].link, LINK);
      assert.equal(asked[1].kind, signInQuestion({ link: LINK }).kind);
    });
  });

  it("an empty answer writes nothing to claude, and claude is ended after the settling time", async () => {
    await withLogin(async (m) => {
      const mine = join(m.home, ".local", "bin", "claude");
      writeFileSync(mine, `#!/bin/sh\ncase "$*" in\n  "auth login") echo "${LINK}"; echo $$ > "${join(m.dir, "claude-pid")}"; read -r line; printf '%s\\n' "$line" > "${join(m.dir, "claude-got")}" ;;\n  "auth status --json") cat "${join(m.dir, "says", "claude-status")}" ;;\n  --version) cat "${join(m.dir, "says", "claude-version")}" ;;\nesac\n`);
      chmodSync(mine, 0o755);
      const result = await signIn({ ...base(m), linkWaitMs: 2000, settleMs: 20, ask: async () => ({}) });
      assert.equal(existsSync(join(m.dir, "claude-got")), false);
      await new Promise((r) => setTimeout(r, 200));
      assert.equal(existsSync(join(m.dir, "claude-got")), false);
      const pid = Number(readFileSync(join(m.dir, "claude-pid"), "utf8"));
      assert.throws(() => process.kill(pid, 0));
      assert.equal(result.signedIn, true);
    });
  });

  it("a back or a cancel ends claude without writing to it", async () => {
    for (const answer of ["back", "cancel"]) {
      await withLogin(async (m) => {
        await signIn({ ...base(m), linkWaitMs: 2000, settleMs: 2000, ask: async () => answer });
        await new Promise((r) => setTimeout(r, 200));
        assert.equal(existsSync(join(m.dir, "claude-got")), false);
      });
    }
  });

  it("goes on without an answer when claude ends by itself first", async () => {
    await withLogin(async (m) => {
      const mine = join(m.home, ".local", "bin", "claude");
      writeFileSync(mine, `#!/bin/sh\ncase "$*" in\n  "auth login") echo "${LINK}"; exit 0 ;;\n  "auth status --json") cat "${join(m.dir, "says", "claude-status")}" ;;\n  --version) cat "${join(m.dir, "says", "claude-version")}" ;;\nesac\n`);
      chmodSync(mine, 0o755);
      const result = await signIn({ ...base(m), linkWaitMs: 5000, settleMs: 2000, ask: () => new Promise(() => {}) });
      assert.deepEqual(result, { signedIn: true, plan: "max" });
    });
  });

  it("a sign-in that never ends is stopped after its time, and says so", async () => {
    await withLogin(async (m) => {
      const result = await signIn({ ...base(m), timeoutMs: 50, linkWaitMs: 2000, settleMs: 2000, ask: () => new Promise(() => {}) });
      assert.deepEqual(result, { signedIn: false, plan: null, fault: "Signing in took too long. Try again." });
    }, { claude: "signed-out" });
  });

  it("one that ends signed out says so", async () => {
    await withLogin(async (m) => {
      const result = await signIn({ ...base(m), linkWaitMs: 2000, settleMs: 20, ask: async () => ({}) });
      assert.deepEqual(result, { signedIn: false, plan: null, fault: "Claude Code is not signed in yet. Try again." });
    }, { claude: "signed-out" });
  });

  it("after signing in, only signed in and the plan are given back", async () => {
    await withLogin(async (m) => {
      const result = await signIn({ ...base(m), linkWaitMs: 2000, settleMs: 20, ask: async () => ({}) });
      const text = JSON.stringify(result);
      assert.equal(text.includes("jane@example.invalid"), false);
      assert.equal(text.includes("Example Org"), false);
      assert.deepEqual(result, { signedIn: true, plan: "max" });
    });
  });

  it("with pty false it starts nothing and only asks claude's state", async () => {
    await withLogin(async (m) => {
      const result = await signIn({ ...base(m), pty: false, ask: async () => assert.fail("nothing is asked") });
      assert.equal(m.ran().includes("script"), false);
      assert.deepEqual(result, { signedIn: true, plan: "max" });
    });
  });
});
