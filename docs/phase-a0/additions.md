# A0, additions: what the Studio architecture needs from the same sitting

For Jason, on the Mac Studio, **after step 11 of `docs/phase-a0/checklist.md`** (until it is merged, that file is on the branch `claude/zealous-bell-esuqck` of brimm-video, or `claude/design-2026-10-27` of brimm-video-studio). They add about 50 minutes and answer what `docs/superpowers/specs/2026-10-27-brimm-video-studio-architecture.md` (section 15) cannot decide without the app. Each says what it changes.

**The rules are A0's:**

- Your own recording only: never one of Sallie's episodes, and never a session.
- Everything stays in `~/BRIMM Video Work/A0 app test/`. Nothing is written into a watched folder or into Dropbox.
- Never press Share, and never choose Render in the cloud.
- The agent has **Auto** access, never **Full access**.
- Install nothing. Steps 15 and 16 below use `--help` forms on purpose, so that if a rule fails to block a command, the command only prints its help and installs nothing.
- Keep the same Terminal window as A0 (it has `$A0` and `$P`). If you open another, run A0's step 2 part 1 again.

**Record** what each step asks in `results.md`, under a heading "Additions". Paste what Terminal prints.

Steps marked **must** are the ones the first build steps wait for.

---

## Step 12. Open from a plain Terminal, not from Claude Code (10 minutes) — must

Studio will open the app from its own program, which is not a Claude Code conversation. This shows what the app does then. *It decides whether Sallie's chat is ever handed over (decision D3).*

1. Quit HyperFrames (Command-Q).
2. Open a **new Terminal window**, one not started from Claude Code. Check:

   ```
   echo "[${CLAUDE_CODE_SESSION_ID:-nothing}]"
   ```

   It should print `[nothing]`. If it prints an id, this window came from Claude Code: open another.
3. Run A0's step 2 part 1 again in it (the names `$A0` and `$P`), then:

   ```
   cd "$P"
   npx hyperframes open --json
   ```

4. In the app's chat for the project, ask: `What are this project's rules?` Then ask for one small change, for example `Add a one-second title that says Test.`
5. Back in Terminal:

   ```
   ls -a "$P/.hyperframes"
   tail -n 3 "$P/.hyperframes/app-history.jsonl"
   npx hyperframes catch-up --json
   ```

**Record:**
- what `open --json` printed;
- whether the app opened the project and started a fresh chat, or showed an earlier conversation;
- whether the assistant listed BRIMM's rules from `brief.md`;
- whether `app-history.jsonl` exists and has a line for the request;
- what `catch-up --json` said.

---

## Step 13. The exports (5 minutes) — must

*Decides how Studio finds an export (spec 8.1).*

1. After A0's step 11, list the newest files, and check that Downloads is a plain local folder (on this Mac `~/Movies` is a link into Dropbox, so look at this one too):

   ```
   ls -lt "$HOME/Downloads" | head -6
   ls -ld "$HOME/Downloads"
   ```

   A link shows `->` in the second line.

2. In the app's export screen, look for a way to choose the folder. If there is one, choose `"$A0/exports"` (make the folder first) and export the main video again.

**Record:** each export's exact file name, with the date and time as the app wrote them, for the main video and for the Reel; whether Downloads is a plain local folder or a link; whether a folder can be chosen; whether the app remembers it for the next export of the same project.

---

## Step 14. Where "Make Reel 2" puts its project (5 minutes) — must

*Decides how Studio finds a Reel's project and its export (spec 4.1 step 10, 8.1).*

After A0's step 9:

```
find "$HOME/BRIMM Video Work" -maxdepth 3 -name hyperframes.json
ls -la "$A0"
```

**Record:** where the Reel's project is, if it is a project of its own, and its folder name; or that it is a part of the main project, and which file.

---

## Step 15. The rules, harder (10 minutes)

*Shows whether the app's assistant keeps a project's deny rules, and whether the widened list works (spec 5.5).*

1. Add the commands A0's `settings.json` leaves out:

   ```
   node -e '
   const fs = require("fs"), f = process.argv[1], s = JSON.parse(fs.readFileSync(f, "utf8"));
   for (const c of ["tts","capture","add","catalog","skills","models","browser","upgrade","present","transcribe","init","benchmark"]) s.permissions.deny.push(`Bash(npx hyperframes ${c}:*)`);
   fs.writeFileSync(f, JSON.stringify(s, null, 2) + "\n");
   ' "$P/.claude/settings.json"
   ```

2. In the app's chat, one at a time, ask it to run each of these (they are `--help` forms, so they only print help if they run):

   - `Run npx hyperframes tts --help`
   - `Run npx hyperframes capture --help`
   - `Run npx hyperframes add --help`
   - `Run npx hyperframes skills --help`

**Record:** for each, whether a permission block stopped it, the assistant refused in words, or it ran and printed help. If any ran, the project's settings are not being kept by the app's assistant, which matters for every rule.

---

## Step 16. BRIMM's own files in the project (10 minutes)

*Shows whether the assistant uses what Studio will put in `brimm/`, and whether the brand needs the brand kit (spec 5.8, decision D4).*

1. Make two files from the recording's own transcript:

   ```
   mkdir -p "$P/brimm"
   node -e '
   const fs = require("fs"), w = JSON.parse(fs.readFileSync(process.argv[1], "utf8")), a = w[10], b = w[24];
   fs.writeFileSync(process.argv[2], JSON.stringify({ version: 1, clock: "recording", suggestions: [{ n: 1, from: a.id, to: b.id, start: a.start, end: b.end, kind: "retake", why: "test: cut this stretch", by: "rules" }] }, null, 2) + "\n");
   ' "$P/transcript.json" "$P/brimm/cut-suggestions.json"
   cp "$A0/brief.md" "$P/brimm/brand.md"
   ```

2. In the project, set **Brand kit for this project** to none.
3. In the app's chat: `Cut the retakes.` Then: `Add a title that says Test, in the brand.`

**Record:** whether the assistant found and used `brimm/cut-suggestions.json` (did it propose the stretch from `w10` to `w24`?); whether the title came out in Josefin Sans and navy with no brand kit picked, or needed the kit.

---

## Step 17. What the app's history costs on disk (2 minutes)

*Sets the size limit and the clean-up (spec 7.3, 7.4).*

```
du -sh "$HOME/.cache/hyperframes" 2>/dev/null
du -sh "$P/.hyperframes"
find "$HOME/.cache/hyperframes/history" -type f -size +10M 2>/dev/null | head
```

**Record:** the sizes, and whether any file over 10 MB is there (a copy of the recording would be).

---

## Step 18. Where the HeyGen sign-in is kept (2 minutes)

*Shows whether the command line's `publish` could use the app's sign-in (spec F6).*

```
ls -la "$HOME/.hyperframes" 2>&1 | head -20
ls -la "$HOME/Library/Application Support/HyperFrames" 2>&1 | head -20
```

List names only. Do not open, print or paste any file in those folders: one of them may hold a sign-in.

**Record:** the names you see, and whether either folder has a file whose name suggests credentials or a token.

---

## Step 19. The machine (1 minute)

```
cd "$P"
npx hyperframes doctor
```

**Record:** what it prints.

---

## Step 20. The history from Terminal, while the app has the project open (3 minutes)

*Shows whether Studio can list the versions while Sallie has the project open, and whether an agent outside the app can wrap its turns (spec 4.6, F7).*

With the project still open in HyperFrames:

```
cd "$P"
npx hyperframes history --json
npx hyperframes history begin --who Test --label "terminal test"
npx hyperframes history end
```

**Record:** what each printed. In particular, whether any of them refused because the project is open in another app.

---

## Later, when the code exists

- **A0b** (spec section 15, item 8): when the project maker's first output exists (build plan, PR 2), Jason opens the sample project it writes, with no `hyperframes init`, and records whether the app opens it, shows the Script panel from `transcript.json`, previews and exports.
- **An iPhone HDR clip** (item 11): when the working copy's converter exists (PR 3), a real clip is converted and looked at in the app and in the export.
