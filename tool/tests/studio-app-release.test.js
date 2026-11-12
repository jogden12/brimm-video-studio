// A release of BRIMM Video Studio.app: tool/studio-app/release.js and release.sh (Phase 7, Task 11). release.js's tests need no Mac.
// The script's tests run copies of the scripts in a temporary tool/studio-app, with what they import one level up, beside a pin that
// names a made-up Sparkle archive and a made-up public key. The archive's generate_keys prints what $KEY_SAYS holds; its
// generate_appcast copies $APPCAST_SAYS to its -o path and makes an empty file for each line of $DELTAS_SAYS (a line at a time, since
// Sparkle names a delta after the app, whose name has spaces). Each writes its line into
// a `ran` file, as the stand-ins for xcrun and cf on PATH do. Nothing is signed, published or fetched, and the keychain is never asked.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { APPCAST_ITEM_MAX_CHARS, APPCAST_MAX_CHARS } from "../update-check.js";
import { FEED, buildJson, infoPlist } from "../studio-app/build-info.js";
import { sourceName, readPins } from "../studio-app/vendor.js";
import { BETA_CHANNEL, BUCKET, RELEASES_URL, TOO_LONG, checkFault, enclosureNames, factsOf, mayFault, newestBuild } from "../studio-app/release.js";

const TOOL = fileURLToPath(new URL("..", import.meta.url));
const STUDIO_APP = join(TOOL, "studio-app");
const notAMac = process.platform !== "darwin" || !existsSync("/bin/zsh") || !existsSync("/usr/bin/ditto") || !existsSync("/usr/bin/zipinfo") ? "a release is made on a Mac, which has zsh, ditto, zipinfo and plutil" : false;
const APP = "BRIMM Video Studio.app";
const KEY = `${"A1b2+/".repeat(7)}x=`;
const OTHER_KEY = `${"Z9y8+/".repeat(7)}q=`;
const SIG = `${"QUJD".repeat(21)}QU==`;
const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const FAKE_SOURCE = sourceName(readPins(join(STUDIO_APP, "vendor.pin.json")).pins);
const UNFINISHED = "Nothing is to be published. The releases folder is as it was left: unfinished-release.txt says how to put it right.";
const OTHER_KEY_SENTENCE = "This build carries another update key than the one in your login keychain, so no Mac would take the update. Nothing was written.";
const UNSTAPLED_SENTENCE = "That zip was made before the app was stapled. Make it again first.";
const WATCHED_SENTENCE = "That folder is watched or is in Dropbox, and a build never writes there.";
const PUBLISH_HEAD = "Publishing is a by-hand step, on Jason's yes. In this order, each only when the line before it answered:";
const NO_APPCAST_SENTENCE = (releases) => `There is no appcast in ${releases}. If this is the first release, say --first-release.`;
const FIRST_WITH_APPCAST_SENTENCE = (releases) => `--first-release was said, but ${releases} already has an appcast.`;
const KEPT_BEFORE_SENTENCE = "appcast.xml could not be kept as appcast.xml.before, so nothing was written. Nothing is to be published.";
const NOT_CHECKED_SENTENCE = "The appcast could not be checked.";
const CHECK_FEED = `Check that the live feed says the same before putting the appcast: curl -s ${FEED}`;
const NO_FEED_BEFORE = "There was no feed before this release.";
const strayBuild = (n) => `The appcast has an item for build ${n}, which this release did not make. Take that zip out of the releases folder first.`;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const zipOf = (version) => `BRIMM-Video-Studio-${version}.zip`;

/** One enclosure, under RELEASES_URL unless `url` is given. */
const enc = (name, { sig = SIG, url = `${RELEASES_URL}${name}` } = {}) => `<enclosure url="${url}" length="1" type="application/octet-stream"${sig === null ? "" : ` sparkle:edSignature="${sig}"`}/>`;
/** One item, as generate_appcast writes it: its zip's enclosure (or `main`), then its deltas. */
const item = ({ build, version, channel = "", main, deltas = [] }) =>
  `<item><title>${version}</title><sparkle:version>${build}</sparkle:version><sparkle:shortVersionString>${version}</sparkle:shortVersionString>${channel ? `<sparkle:channel>${channel}</sparkle:channel>` : ""}${main ?? enc(zipOf(version))}${deltas.length ? `<sparkle:deltas>${deltas.map((d) => (d.startsWith("<") ? d : enc(d))).join("")}</sparkle:deltas>` : ""}</item>`;
const appcast = (...items) => `<?xml version="1.0" standalone="yes"?>\n<rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle" version="2.0"><channel><title>BRIMM Video Studio</title>${items.map(item).join("")}</channel></rss>\n`;

const BETA2 = { version: "1.0.0-beta.2", build: 2, channel: "beta", zip: zipOf("1.0.0-beta.2") };
const STABLE = { version: "1.0.0", build: 5, channel: "stable", zip: zipOf("1.0.0") };

describe("release.js", () => {
  it("a build number that is not above every item's is refused, and so is a zip name the feed already has", () => {
    const feed = appcast({ build: 1, version: "1.0.0-beta.1", channel: "beta" }, { build: 3, version: "1.0.0-beta.3", channel: "beta" });
    assert.equal(mayFault(feed, BETA2), "Build 2 is not above the feed's newest, 3. A release needs a higher build number.");
    assert.equal(mayFault(feed, { ...BETA2, build: 3 }), "Build 3 is not above the feed's newest, 3. A release needs a higher build number.");
    assert.equal(mayFault(feed, { ...BETA2, build: 4 }), "");
    const sameVersion = appcast({ build: 1, version: "1.0.0-beta.2", channel: "beta" });
    assert.equal(mayFault(sameVersion, BETA2), "The feed already has 1.0.0-beta.2. A release needs a new version.");
    const sameZip = appcast({ build: 1, version: "1.0.0-beta.1", channel: "beta", main: enc(BETA2.zip) });
    assert.equal(mayFault(sameZip, BETA2), "The feed already has 1.0.0-beta.2. A release needs a new version.");
  });

  it("the first release needs no appcast", () => {
    assert.equal(mayFault(null, BETA2), "");
    assert.equal(mayFault(null, STABLE), "");
    const root = mkdtempSync(join(tmpdir(), "studio-release-may-"));
    try {
      const ran = spawnSync(process.execPath, [join(STUDIO_APP, "release.js"), "may", join(root, "appcast.xml"), BETA2.version, "2", "beta", BETA2.zip], { encoding: "utf8", timeout: 20000 });
      assert.equal(ran.status, 0, `${ran.stdout}${ran.stderr}`);
      assert.equal(ran.stdout, "");
      writeFileSync(join(root, "appcast.xml"), appcast({ build: 2, version: "1.0.0-beta.1", channel: "beta" }));
      const refused = spawnSync(process.execPath, [join(STUDIO_APP, "release.js"), "may", join(root, "appcast.xml"), BETA2.version, "2", "beta", BETA2.zip], { encoding: "utf8", timeout: 20000 });
      assert.equal(refused.status, 1);
      assert.equal(refused.stdout, "Build 2 is not above the feed's newest, 2. A release needs a higher build number.\n");
      const wrong = spawnSync(process.execPath, [join(STUDIO_APP, "release.js"), "may", join(root, "appcast.xml"), BETA2.version, "two", "beta", BETA2.zip], { encoding: "utf8", timeout: 20000 });
      assert.equal(wrong.status, 2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("a beta version on the stable channel is refused, and a stable one on beta", () => {
    assert.equal(mayFault(null, { ...BETA2, channel: "stable" }), BETA_CHANNEL);
    assert.equal(mayFault(null, { ...STABLE, channel: "beta" }), BETA_CHANNEL);
    assert.equal(BETA_CHANNEL, "A beta version goes on the beta channel, and only a beta version does. Build it again with the right --channel.");
  });

  it("a beta item is tagged beta and a stable one is not tagged", () => {
    assert.equal(checkFault(appcast({ build: 2, version: BETA2.version, channel: "beta" }), BETA2), "");
    const earlier = appcast({ build: 2, version: BETA2.version, channel: "beta" });
    assert.equal(checkFault(appcast({ build: 2, version: BETA2.version, channel: "beta" }, { build: 5, version: "1.0.0" }), STABLE, earlier), "");
    const untagged = checkFault(appcast({ build: 2, version: BETA2.version }), BETA2);
    assert.match(untagged, /build 2/);
    assert.match(untagged, /beta/);
    const tagged = checkFault(appcast({ build: 5, version: "1.0.0", channel: "beta" }), STABLE);
    assert.match(tagged, /build 5/);
    assert.match(tagged, /tagged beta/);
    for (const said of [untagged, tagged]) assert.ok(!said.includes("\n"), said);
  });

  it("the new item is one behind's reader gives back", () => {
    // The earlier appcast holds builds 1 and 3, so that an item for either is not taken for one this release did not make.
    const before = appcast({ build: 1, version: "1.0.0-beta.1", channel: "beta" }, { build: 3, version: "1.0.0-beta.3", channel: "beta" });
    const unsigned = (n) => `The appcast's item for build ${n} has a download without a whole EdDSA signature.`;
    const notOffered = `The appcast's item for build 2 does not offer ${RELEASES_URL}${BETA2.zip}.`;
    const refusals = [
      [appcast({ build: 2, version: "1.0.0-beta.9", channel: "beta" }), "The appcast's item for build 2 says version 1.0.0-beta.9, not 1.0.0-beta.2."],
      [appcast({ build: 2, version: BETA2.version, channel: "beta", main: enc(BETA2.zip, { sig: null }) }), unsigned(2)],
      [appcast({ build: 2, version: BETA2.version, channel: "beta", main: enc(BETA2.zip, { sig: SIG.slice(4) }) }), unsigned(2)],
      [appcast({ build: 2, version: BETA2.version, channel: "beta", main: enc(BETA2.zip, { url: `https://elsewhere.example.invalid/${BETA2.zip}` }) }), notOffered],
      [appcast({ build: 2, version: BETA2.version, channel: "beta", main: enc(BETA2.zip, { url: `${RELEASES_URL}other/${BETA2.zip}` }) }), notOffered],
      [appcast({ build: 2, version: BETA2.version, channel: "beta", deltas: [enc("x.delta", { sig: null })] }), unsigned(2)],
      [
        appcast({ build: 1, version: "1.0.0-beta.1", channel: "beta", main: enc("old.zip", { url: "https://elsewhere.example.invalid/old.zip" }) }, { build: 2, version: BETA2.version, channel: "beta" }),
        `The appcast's item for build 1 has a download that is not one file under ${RELEASES_URL}.`,
      ],
      [appcast({ build: 1, version: "1.0.0-beta.1", channel: "beta", main: enc(zipOf("1.0.0-beta.1"), { sig: null }) }, { build: 2, version: BETA2.version, channel: "beta" }), unsigned(1)],
      [appcast({ build: 3, version: "1.0.0-beta.3", channel: "beta" }), "The appcast has no item for build 2 that Studio can read."],
    ];
    for (const [i, [xml, sentence]] of refusals.entries()) assert.equal(checkFault(xml, BETA2, before), sentence, `case ${i}`);
    const long = appcast({ build: 2, version: BETA2.version, channel: "beta" }).replace("<channel>", `<channel>${" ".repeat(APPCAST_MAX_CHARS)}`);
    assert.equal(checkFault(long, BETA2), TOO_LONG);
    assert.equal(TOO_LONG, "The appcast is longer than Studio reads. Take its oldest items out first.");

    const withDeltas = appcast({ build: 1, version: "1.0.0-beta.1", channel: "beta" }, { build: 2, version: BETA2.version, channel: "beta", deltas: ["BRIMM%20Video%20Studio2-1.delta", "Studio2-0.delta"] });
    assert.equal(checkFault(withDeltas, BETA2, appcast({ build: 1, version: "1.0.0-beta.1", channel: "beta" })), "");
    assert.deepEqual(enclosureNames(withDeltas, 2), [BETA2.zip, "BRIMM Video Studio2-1.delta", "Studio2-0.delta"]);
    assert.deepEqual(enclosureNames(withDeltas, 1), [zipOf("1.0.0-beta.1")]);
  });

  it("an item this release did not make, and not in the earlier appcast, is refused", () => {
    const two = appcast({ build: 2, version: BETA2.version, channel: "beta" }, { build: 9, version: "1.0.0-beta.9", channel: "beta" });
    assert.equal(checkFault(two, BETA2, null), strayBuild(9));
    assert.equal(checkFault(two, BETA2, appcast({ build: 1, version: "1.0.0-beta.1", channel: "beta" })), strayBuild(9));
    assert.equal(checkFault(two, BETA2, appcast({ build: 9, version: "1.0.0-beta.9", channel: "beta" })), "");
    // It comes after the length's check.
    assert.equal(checkFault(two.replace("<channel>", `<channel>${" ".repeat(APPCAST_MAX_CHARS)}`), BETA2, null), TOO_LONG);
  });

  it("every enclosure in the appcast is checked, even one in an item Studio passes over, but not one in a comment", () => {
    const mine = appcast({ build: 2, version: BETA2.version, channel: "beta" });
    const add = (extra) => mine.replace("</channel>", `${extra}</channel>`);
    const notAVersion = `<item><sparkle:version>4</sparkle:version><sparkle:shortVersionString>beta</sparkle:shortVersionString>${enc("other.zip", { sig: null })}</item>`;
    assert.equal(checkFault(add(notAVersion), BETA2, null), "The appcast has a download without a whole EdDSA signature.");
    const longItem = `<item><sparkle:version>4</sparkle:version><sparkle:shortVersionString>1.0.0-beta.4</sparkle:shortVersionString><title>${"x".repeat(APPCAST_ITEM_MAX_CHARS)}</title>${enc("other.zip", { url: "https://elsewhere.example.invalid/other.zip" })}</item>`;
    assert.equal(checkFault(add(longItem), BETA2, null), `The appcast has a download that is not one file under ${RELEASES_URL}.`);
    const commented = `<!-- ${enc("other.zip", { url: "https://elsewhere.example.invalid/other.zip", sig: null })} -->`;
    assert.equal(checkFault(add(commented), BETA2, null), "");
  });

  it("newest says the appcast's newest build, and check and enclosures take what release.sh gives them", () => {
    const root = mkdtempSync(join(tmpdir(), "studio-release-cmd-"));
    const js = (...args) => spawnSync(process.execPath, [join(STUDIO_APP, "release.js"), ...args], { encoding: "utf8", timeout: 20000 });
    try {
      const file = join(root, "appcast.xml");
      const feed = appcast({ build: 1, version: "1.0.0-beta.1", channel: "beta" }, { build: 3, version: "1.0.0-beta.3", channel: "beta" });
      assert.equal(newestBuild(feed), 3);
      assert.equal(newestBuild(appcast()), 0);
      writeFileSync(file, feed);
      const newest = js("newest", file);
      assert.equal(newest.status, 0, said(newest));
      assert.equal(newest.stdout, "3\n");
      const missing = js("newest", join(root, "none.xml"));
      assert.equal(missing.status, 1);
      assert.equal(missing.stdout, "There is no appcast in the releases folder.\n");
      assert.equal(js("newest", file, "more").status, 2);

      // check takes the earlier appcast second, and a path that is not there is no earlier appcast.
      const withNine = appcast({ build: 2, version: BETA2.version, channel: "beta" }, { build: 9, version: "1.0.0-beta.9", channel: "beta" });
      writeFileSync(file, withNine);
      const stray = js("check", file, join(root, "none.xml"), BETA2.version, "2", "beta", BETA2.zip);
      assert.equal(stray.status, 1);
      assert.equal(stray.stdout, `${strayBuild(9)}\n`);
      writeFileSync(join(root, "before.xml"), appcast({ build: 9, version: "1.0.0-beta.9", channel: "beta" }));
      const passed = js("check", file, join(root, "before.xml"), BETA2.version, "2", "beta", BETA2.zip);
      assert.equal(passed.status, 0, said(passed));
      assert.equal(js("check", file, BETA2.version, "2", "beta", BETA2.zip).status, 2, "the old form, with no earlier appcast, is a fault");

      // enclosures says each file's name and its url as the appcast has it, a tab between.
      writeFileSync(file, appcast({ build: 2, version: BETA2.version, channel: "beta", deltas: ["BRIMM%20Video%20Studio2-1.delta", "Studio%2B2-0.delta"] }));
      const listed = js("enclosures", file, "2");
      assert.equal(listed.status, 0, said(listed));
      assert.equal(
        listed.stdout,
        [
          `${BETA2.zip}\t${RELEASES_URL}${BETA2.zip}`,
          `BRIMM Video Studio2-1.delta\t${RELEASES_URL}BRIMM%20Video%20Studio2-1.delta`,
          `Studio+2-0.delta\t${RELEASES_URL}Studio%2B2-0.delta`,
          "",
        ].join("\n"),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("facts reads the app's own build.json", () => {
    const root = mkdtempSync(join(tmpdir(), "studio-release-facts-"));
    try {
      const studio = join(root, APP, "Contents", "Resources", "Studio");
      mkdirSync(studio, { recursive: true });
      writeFileSync(join(studio, "build.json"), buildJson({ version: BETA2.version, build: 2, commit: COMMIT, channel: "beta" }).text);
      assert.deepEqual(factsOf(join(root, APP)), BETA2);
      const ran = spawnSync(process.execPath, [join(STUDIO_APP, "release.js"), "facts", join(root, APP)], { encoding: "utf8", timeout: 20000 });
      assert.equal(ran.status, 0, ran.stderr);
      assert.equal(ran.stdout, `${BETA2.version}\t2\tbeta\t${BETA2.zip}\n`);
      writeFileSync(join(studio, "build.json"), "{ not json");
      const broken = spawnSync(process.execPath, [join(STUDIO_APP, "release.js"), "facts", join(root, APP)], { encoding: "utf8", timeout: 20000 });
      assert.equal(broken.status, 1);
      assert.ok(broken.stdout.trim().length > 0);
      assert.equal(spawnSync(process.execPath, [join(STUDIO_APP, "release.js"), "facts", join(root, "none.app")], { encoding: "utf8", timeout: 20000 }).status, 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

/** A world for one script test. See the head of this file. */
function world() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "studio-release-")));
  const copy = join(root, "studio-app");
  const home = join(root, "home");
  const bin = join(root, "bin");
  const tmp = join(root, "tmp");
  const out = join(root, "out");
  const packed = join(root, "packed");
  for (const dir of [copy, home, bin, tmp, out]) mkdirSync(dir);
  for (const name of ["is-main.js", "build.js", "update-check.js"]) copyFileSync(join(TOOL, name), join(root, name));
  for (const name of ["release.sh", "release.js", "sparkle.js", "common.zsh", "build-info.js", "vendor.js", "vendor.pin.json"]) copyFileSync(join(STUDIO_APP, name), join(copy, name));

  mkdirSync(join(packed, "Sparkle.framework", "Versions", "B"), { recursive: true });
  mkdirSync(join(packed, "bin"));
  writeFileSync(join(packed, "Sparkle.framework", "Versions", "B", "Sparkle"), "a made-up Sparkle\n");
  writeFileSync(join(packed, "bin", "generate_keys"), `#!/bin/sh\necho "generate_keys $*" >> "$RAN"\nprintf '%s\\n' "$KEY_SAYS"\n`);
  writeFileSync(
    join(packed, "bin", "generate_appcast"),
    `#!/bin/sh
echo "generate_appcast $*" >> "$RAN"
out= last=
while [ $# -gt 0 ]; do
  case $1 in
    -o) out=$2; shift 2 ;;
    *) last=$1; shift ;;
  esac
done
cp "$APPCAST_SAYS" "$out"
printf '%s\\n' "$DELTAS_SAYS" | while IFS= read -r name; do if [ -n "$name" ]; then : > "$last/$name"; fi; done
`,
  );
  chmodSync(join(packed, "bin", "generate_keys"), 0o755);
  chmodSync(join(packed, "bin", "generate_appcast"), 0o755);
  const archive = join(root, "made-up.tar.xz");
  const packing = spawnSync("/usr/bin/tar", ["-cJf", archive, "-C", packed, "Sparkle.framework", "bin"], { encoding: "utf8" });
  assert.equal(packing.status, 0, packing.stderr);
  const realPin = JSON.parse(readFileSync(join(STUDIO_APP, "sparkle.pin.json"), "utf8"));
  writeFileSync(join(copy, "sparkle.pin.json"), `${JSON.stringify({ ...realPin, sha256: sha256(readFileSync(archive)), publicKey: KEY }, null, 2)}\n`);

  const ran = join(root, "ran");
  writeFileSync(ran, "");
  for (const name of ["xcrun", "cf", "notarytool"]) {
    writeFileSync(join(bin, name), `#!/bin/sh\necho "${name} $*" >> "$RAN"\n`);
    chmodSync(join(bin, name), 0o755);
  }
  const says = join(root, "appcast-says.xml");
  const releases = join(root, "releases");
  const app = join(out, APP);
  const zip = (version) => join(out, zipOf(version));

  /** The made-up app and its zip, made with ditto, for `version`, `build` and `channel`. A stapled one has Contents/CodeResources. */
  const makeApp = ({ version = BETA2.version, build = 2, channel = "beta", stapled = true, key = KEY } = {}) => {
    rmSync(app, { recursive: true, force: true });
    mkdirSync(join(app, "Contents", "Resources", "Studio"), { recursive: true });
    mkdirSync(join(app, "Contents", "_CodeSignature"));
    writeFileSync(join(app, "Contents", "Info.plist"), infoPlist({ version, build, icon: false, publicKey: key }));
    writeFileSync(join(app, "Contents", "Resources", "Studio", "build.json"), buildJson({ version, build, commit: COMMIT, channel }).text);
    writeFileSync(join(app, "Contents", "_CodeSignature", "CodeResources"), "a made-up seal\n");
    if (stapled) writeFileSync(join(app, "Contents", "CodeResources"), "a made-up ticket\n");
    rmSync(zip(version), { force: true });
    const zipped = spawnSync("/usr/bin/ditto", ["-c", "-k", "--norsrc", "--noextattr", "--keepParent", app, zip(version)], { encoding: "utf8" });
    assert.equal(zipped.status, 0, zipped.stderr);
  };
  const env = (more = {}) => ({ HOME: home, TMPDIR: tmp, RAN: ran, KEY_SAYS: KEY, APPCAST_SAYS: says, DELTAS_SAYS: "", PATH: `${bin}:/usr/bin:/bin:/usr/sbin:/sbin:${dirname(process.execPath)}`, ...more });
  const release = (args, more = {}) => spawnSync("/bin/zsh", [join(copy, "release.sh"), ...args], { encoding: "utf8", env: env(more), cwd: root, timeout: 60000 });
  const standard = (more = []) => ["--app", app, "--releases", releases, "--sparkle", archive, ...more];
  return {
    root,
    home,
    app,
    zip,
    archive,
    releases,
    makeApp,
    release,
    standard,
    says: (xml) => writeFileSync(says, xml),
    ranText: () => readFileSync(ran, "utf8"),
    clearRan: () => writeFileSync(ran, ""),
    tmpLeft: () => readdirSync(tmp),
    /** Puts in front of the copy's release.js one that, asked for `which`, says `words` on stderr and ends with 2, as a fault in the
        command does. Everything else it hands to the real one. */
    faultOn: (which, words) => {
      copyFileSync(join(copy, "release.js"), join(copy, "release-real.js"));
      writeFileSync(
        join(copy, "release.js"),
        `import { spawnSync } from "node:child_process";
if (process.argv[2] === ${JSON.stringify(which)}) {
  process.stderr.write(${JSON.stringify(words)});
  process.exit(2);
}
const r = spawnSync(process.execPath, [new URL("./release-real.js", import.meta.url).pathname, ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(r.status ?? 1);
`,
      );
    },
  };
}

const said = (r) => `${r.stdout}${r.stderr}`;

describe("release.sh", { skip: notAMac }, () => {
  it("the order of a release", () => {
    const w = world();
    try {
      w.makeApp();
      w.says(appcast({ build: 2, version: BETA2.version, channel: "beta" }));
      const made = w.release(w.standard(["--first-release"]));
      assert.equal(made.status, 0, said(made));
      const lines = w.ranText().trim().split("\n");
      assert.equal(lines.length, 3, w.ranText());
      assert.equal(lines[0], `xcrun stapler validate ${w.app}`);
      assert.equal(lines[1], "generate_keys -p");
      assert.equal(lines[2], `generate_appcast --download-url-prefix ${RELEASES_URL} --maximum-versions 0 --channel beta -o ${join(w.releases, "appcast.xml")} ${w.releases}`);
      assert.equal(/^(cf|notarytool) /m.test(w.ranText()), false);
      assert.equal(readFileSync(join(w.releases, BETA2.zip)).equals(readFileSync(w.zip(BETA2.version))), true);
      assert.deepEqual(w.tmpLeft(), []);

      // A stable build has no channel.
      w.clearRan();
      w.makeApp({ version: "1.0.0", build: 5, channel: "stable" });
      w.says(appcast({ build: 2, version: BETA2.version, channel: "beta" }, { build: 5, version: "1.0.0" }));
      const stable = w.release(w.standard());
      assert.equal(stable.status, 0, said(stable));
      assert.ok(w.ranText().includes(`generate_appcast --download-url-prefix ${RELEASES_URL} --maximum-versions 0 -o ${join(w.releases, "appcast.xml")} ${w.releases}\n`), w.ranText());
      assert.ok(stable.stdout.includes("The feed's newest build before this release was 2.\n"), stable.stdout);
    } finally {
      rmSync(w.root, { recursive: true, force: true });
    }
  });

  it("the publishing lines are printed in order and none is run", () => {
    const w = world();
    try {
      mkdirSync(w.releases);
      writeFileSync(join(w.releases, "Studio2-0.delta"), "made by an earlier run\n");
      const source = join(w.root, FAKE_SOURCE);
      writeFileSync(source, "the source\n");
      w.makeApp();
      w.says(appcast({ build: 2, version: BETA2.version, channel: "beta", deltas: ["Studio2-1.delta", "Studio2-0.delta"] }));
      const made = w.release(w.standard(["--source", source, "--first-release"]), { DELTAS_SAYS: "Studio2-1.delta" });
      assert.equal(made.status, 0, said(made));
      const lines = made.stdout.split("\n");
      const at = lines.indexOf(PUBLISH_HEAD);
      assert.ok(at >= 0, made.stdout);
      const put = (key, file, type) => `cf r2 objects put "${key}" --bucket-name ${BUCKET} --file "${file}" --content-type ${type}`;
      assert.deepEqual(lines.slice(at + 1).filter(Boolean), [
        put(`releases/${BETA2.zip}`, join(w.releases, BETA2.zip), "application/zip"),
        `curl -sI "${RELEASES_URL}${BETA2.zip}"`,
        put("releases/Studio2-1.delta", join(w.releases, "Studio2-1.delta"), "application/octet-stream"),
        `curl -sI "${RELEASES_URL}Studio2-1.delta"`,
        put("releases/Studio2-0.delta", join(w.releases, "Studio2-0.delta"), "application/octet-stream"),
        `curl -sI "${RELEASES_URL}Studio2-0.delta"`,
        put(`source/${FAKE_SOURCE}`, source, "application/zip"),
        `curl -sI "https://updates.thebrimminsights.com/source/${FAKE_SOURCE}"`,
        NO_FEED_BEFORE,
        CHECK_FEED,
        "Put the appcast only when each line above answered 200:",
        `cf r2 objects put appcast.xml --bucket-name ${BUCKET} --file "${join(w.releases, "appcast.xml")}" --content-type application/xml`,
        `curl -sI ${FEED}`,
      ]);
      assert.equal(/^(cf|curl) /m.test(w.ranText()), false, w.ranText());
    } finally {
      rmSync(w.root, { recursive: true, force: true });
    }
  });

  it("a file the appcast names that is not in the folder stops the run", () => {
    const w = world();
    try {
      w.makeApp();
      w.says(appcast({ build: 2, version: BETA2.version, channel: "beta", deltas: ["Studio2-1.delta"] }));
      const made = w.release(w.standard(["--first-release"]));
      assert.equal(made.status, 1, said(made));
      assert.match(made.stdout, /Studio2-1\.delta/);
      assert.equal(made.stdout.trim().split("\n").pop(), UNFINISHED);
      assert.equal(made.stdout.includes("cf r2"), false);
      assert.ok(existsSync(join(w.releases, "unfinished-release.txt")));
    } finally {
      rmSync(w.root, { recursive: true, force: true });
    }
  });

  it("--print runs neither generate_keys nor generate_appcast, and makes no folder", () => {
    const w = world();
    try {
      w.makeApp();
      w.says(appcast({ build: 2, version: BETA2.version, channel: "beta" }));
      const printed = w.release(w.standard(["--print", "--first-release"]));
      assert.equal(printed.status, 0, said(printed));
      assert.equal(printed.stdout.trim().split("\n").pop(), "Nothing was done.");
      assert.ok(printed.stdout.includes("the first release"), printed.stdout);
      assert.ok(printed.stdout.includes("--maximum-versions 0"), printed.stdout);
      assert.equal(w.ranText(), "");
      assert.equal(existsSync(w.releases), false);
      assert.deepEqual(w.tmpLeft(), []);
      for (const args of [["--bogus"], ["--app", w.app, "--releases", w.releases], ["--app"], [...w.standard(), "--source"]]) {
        const wrong = w.release(args);
        assert.equal(wrong.status, 2, `${args.join(" ")}: ${said(wrong)}`);
      }
      assert.equal(w.ranText(), "");
    } finally {
      rmSync(w.root, { recursive: true, force: true });
    }
  });

  it("what generate_keys prints is shown only when it is a public key", () => {
    const w = world();
    try {
      w.makeApp();
      w.says(appcast({ build: 2, version: BETA2.version, channel: "beta" }));
      const text = "PRIVATE-LOOKING-TEXT-0123456789";
      const made = w.release(w.standard(["--first-release"]), { KEY_SAYS: text });
      assert.equal(made.status, 1, said(made));
      assert.equal(said(made).includes(text), false, said(made));
      assert.equal(existsSync(w.releases), false);
      assert.equal(w.ranText().includes("generate_appcast"), false);
    } finally {
      rmSync(w.root, { recursive: true, force: true });
    }
  });

  it("a build with another key stops before anything is written", () => {
    const w = world();
    try {
      w.makeApp();
      w.says(appcast({ build: 2, version: BETA2.version, channel: "beta" }));
      const made = w.release(w.standard(["--first-release"]), { KEY_SAYS: OTHER_KEY });
      assert.equal(made.status, 1, said(made));
      assert.equal(made.stdout.trim().split("\n").pop(), OTHER_KEY_SENTENCE);
      assert.equal(existsSync(w.releases), false);
      assert.equal(w.ranText().includes("generate_appcast"), false);
      assert.deepEqual(w.tmpLeft(), []);
    } finally {
      rmSync(w.root, { recursive: true, force: true });
    }
  });

  it("a zip made before stapling, an app with another name, a source zip with another name, and a watched or Dropbox releases folder are each refused", () => {
    const w = world();
    try {
      w.says(appcast({ build: 2, version: BETA2.version, channel: "beta" }));
      w.makeApp({ stapled: false });
      for (const mode of [[], ["--print"]]) {
        const unstapled = w.release(w.standard(mode));
        assert.equal(unstapled.status, 1, said(unstapled));
        assert.equal(unstapled.stdout.trim(), UNSTAPLED_SENTENCE);
      }

      w.makeApp();
      const other = join(w.root, "out", "Other.app");
      cpSync(w.app, other, { recursive: true });
      const renamed = w.release(["--app", other, "--releases", w.releases, "--sparkle", w.archive, "--first-release"]);
      assert.equal(renamed.status, 1, said(renamed));
      assert.equal(renamed.stdout.trim(), `--app is not a folder named ${APP}: name the stapled app build-app.sh made.`);

      const source = join(w.root, "ffmpeg-other-source.zip");
      writeFileSync(source, "x\n");
      const wrongSource = w.release(w.standard(["--source", source, "--first-release"]));
      assert.equal(wrongSource.status, 1, said(wrongSource));
      assert.ok(wrongSource.stdout.includes(FAKE_SOURCE), wrongSource.stdout);

      mkdirSync(join(w.home, "Dropbox"));
      for (const folder of [join(w.home, "Dropbox", "releases"), join(w.home, "BRIMM Video Work", "Drop", "releases")]) {
        const watched = w.release(["--app", w.app, "--releases", folder, "--sparkle", w.archive]);
        assert.equal(watched.status, 1, said(watched));
        assert.equal(watched.stdout.trim(), WATCHED_SENTENCE);
        assert.equal(existsSync(folder), false);
      }
      assert.equal(existsSync(w.releases), false);
      assert.equal(w.ranText(), "");
    } finally {
      rmSync(w.root, { recursive: true, force: true });
    }
  });

  it("a release that did not finish stops the next", () => {
    const w = world();
    try {
      w.makeApp();
      const first = appcast({ build: 2, version: BETA2.version, channel: "beta" });
      w.says(first);
      const ok = w.release(w.standard(["--first-release"]));
      assert.equal(ok.status, 0, said(ok));
      assert.equal(existsSync(join(w.releases, "unfinished-release.txt")), false);
      assert.equal(existsSync(join(w.releases, "appcast.xml.before")), false);

      // The next build's appcast is one the check refuses: its item is not signed.
      w.makeApp({ version: "1.0.0-beta.3", build: 3 });
      w.says(appcast({ build: 2, version: BETA2.version, channel: "beta" }, { build: 3, version: "1.0.0-beta.3", channel: "beta", main: enc(zipOf("1.0.0-beta.3"), { sig: null }) }));
      const failed = w.release(w.standard());
      assert.equal(failed.status, 1, said(failed));
      assert.equal(failed.stdout.trim().split("\n").pop(), UNFINISHED);
      assert.equal(readFileSync(join(w.releases, "unfinished-release.txt"), "utf8").trim(), "1.0.0-beta.3");
      assert.equal(readFileSync(join(w.releases, "appcast.xml.before"), "utf8"), first);

      w.clearRan();
      const next = w.release(w.standard());
      assert.equal(next.status, 1, said(next));
      assert.ok(next.stdout.startsWith("An earlier release here did not finish (1.0.0-beta.3). Put the folder right first:"), next.stdout);
      assert.equal(w.ranText(), "");
      const printed = w.release(w.standard(["--print"]));
      assert.equal(printed.status, 1, said(printed));
    } finally {
      rmSync(w.root, { recursive: true, force: true });
    }
  });

  it("with no appcast in the folder the run needs --first-release, and with one it refuses it", () => {
    const w = world();
    try {
      w.makeApp();
      w.says(appcast({ build: 2, version: BETA2.version, channel: "beta" }));
      for (const mode of [[], ["--print"]]) {
        const made = w.release(w.standard(mode));
        assert.equal(made.status, 1, said(made));
        assert.equal(made.stdout.trim(), NO_APPCAST_SENTENCE(w.releases));
        assert.equal(w.ranText(), "", "nothing, generate_keys among it, was run");
        assert.equal(existsSync(w.releases), false);
      }
      mkdirSync(w.releases);
      writeFileSync(join(w.releases, "appcast.xml"), appcast({ build: 1, version: "1.0.0-beta.1", channel: "beta" }));
      for (const mode of [[], ["--print"]]) {
        const made = w.release(w.standard(["--first-release", ...mode]));
        assert.equal(made.status, 1, said(made));
        assert.equal(made.stdout.trim(), FIRST_WITH_APPCAST_SENTENCE(w.releases));
        assert.equal(w.ranText(), "");
      }
      const printed = w.release(w.standard(["--print"]));
      assert.equal(printed.status, 0, said(printed));
      assert.ok(printed.stdout.includes("after build 1"), printed.stdout);
    } finally {
      rmSync(w.root, { recursive: true, force: true });
    }
  });

  it("an item for a zip this release did not make stops the run", () => {
    const w = world();
    try {
      w.makeApp();
      w.says(appcast({ build: 2, version: BETA2.version, channel: "beta" }, { build: 9, version: "1.0.0-beta.9", channel: "beta" }));
      const made = w.release(w.standard(["--first-release"]));
      assert.equal(made.status, 1, said(made));
      const lines = made.stdout.trim().split("\n");
      assert.equal(lines.at(-2), strayBuild(9));
      assert.equal(lines.at(-1), UNFINISHED);
      assert.equal(made.stdout.includes("cf r2"), false);
      assert.ok(existsSync(join(w.releases, "unfinished-release.txt")));
    } finally {
      rmSync(w.root, { recursive: true, force: true });
    }
  });

  it("an appcast.xml that cannot be kept as appcast.xml.before stops the run before anything is written", () => {
    const w = world();
    const before = join(w.root, "releases", "appcast.xml.before");
    try {
      mkdirSync(w.releases);
      const earlier = appcast({ build: 1, version: "1.0.0-beta.1", channel: "beta" });
      writeFileSync(join(w.releases, "appcast.xml"), earlier);
      // A folder that cannot be written into, where appcast.xml.before would go.
      mkdirSync(before);
      chmodSync(before, 0o555);
      w.makeApp();
      w.says(appcast({ build: 1, version: "1.0.0-beta.1", channel: "beta" }, { build: 2, version: BETA2.version, channel: "beta" }));
      const made = w.release(w.standard());
      assert.equal(made.status, 1, said(made));
      assert.equal(made.stdout.trim().split("\n").pop(), KEPT_BEFORE_SENTENCE);
      assert.equal(existsSync(join(w.releases, "unfinished-release.txt")), false);
      assert.equal(readFileSync(join(w.releases, "appcast.xml"), "utf8"), earlier);
      assert.equal(w.ranText().includes("generate_appcast"), false, w.ranText());
      assert.equal(existsSync(join(w.releases, BETA2.zip)), false);
    } finally {
      try {
        chmodSync(before, 0o755);
      } catch {}
      rmSync(w.root, { recursive: true, force: true });
    }
  });

  it("a delta named after the app, with spaces, is published by its name and checked at its own address", () => {
    const w = world();
    try {
      w.makeApp();
      w.says(appcast({ build: 2, version: BETA2.version, channel: "beta", deltas: ["BRIMM%20Video%20Studio2-1.delta"] }));
      const made = w.release(w.standard(["--first-release"]), { DELTAS_SAYS: "BRIMM Video Studio2-1.delta" });
      assert.equal(made.status, 0, said(made));
      const lines = made.stdout.split("\n");
      assert.ok(lines.includes(`cf r2 objects put "releases/BRIMM Video Studio2-1.delta" --bucket-name ${BUCKET} --file "${join(w.releases, "BRIMM Video Studio2-1.delta")}" --content-type application/octet-stream`), made.stdout);
      assert.ok(lines.includes(`curl -sI "${RELEASES_URL}BRIMM%20Video%20Studio2-1.delta"`), made.stdout);
    } finally {
      rmSync(w.root, { recursive: true, force: true });
    }
  });

  it("a fault from release.js check or enclosures is said in its own words, or that the appcast could not be checked", () => {
    for (const which of ["check", "enclosures"]) {
      for (const [words, line] of [["A made-up fault.\n", "A made-up fault."], ["", NOT_CHECKED_SENTENCE]]) {
        const w = world();
        try {
          w.makeApp();
          w.says(appcast({ build: 2, version: BETA2.version, channel: "beta" }));
          w.faultOn(which, words);
          const made = w.release(w.standard(["--first-release"]));
          assert.equal(made.status, 1, said(made));
          const lines = made.stdout.trim().split("\n");
          assert.deepEqual(lines.slice(-2), [line, UNFINISHED], `${which} ${JSON.stringify(words)}: ${made.stdout}`);
        } finally {
          rmSync(w.root, { recursive: true, force: true });
        }
      }
    }
  });

  it("nothing else in the releases folder is deleted", () => {
    const w = world();
    try {
      mkdirSync(w.releases);
      writeFileSync(join(w.releases, zipOf("1.0.0-beta.1")), "an earlier zip\n");
      writeFileSync(join(w.releases, "notes.txt"), "Jason's notes\n");
      const earlier = appcast({ build: 1, version: "1.0.0-beta.1", channel: "beta" });
      writeFileSync(join(w.releases, "appcast.xml"), earlier);
      w.makeApp();
      w.says(appcast({ build: 1, version: "1.0.0-beta.1", channel: "beta" }, { build: 2, version: BETA2.version, channel: "beta" }));
      const made = w.release(w.standard());
      assert.equal(made.status, 0, said(made));
      assert.equal(readFileSync(join(w.releases, zipOf("1.0.0-beta.1")), "utf8"), "an earlier zip\n");
      assert.equal(readFileSync(join(w.releases, "notes.txt"), "utf8"), "Jason's notes\n");
      assert.deepEqual(readdirSync(w.releases).sort(), ["BRIMM-Video-Studio-1.0.0-beta.1.zip", BETA2.zip, "appcast.xml", "notes.txt"].sort());
      assert.ok(made.stdout.includes(`The feed's newest build before this release was 1.\n${CHECK_FEED}\n`), made.stdout);
    } finally {
      rmSync(w.root, { recursive: true, force: true });
    }
  });
});
