// The never list (never.js): the tools her chat may never use under the open lock, by name, by kind and by word, whatever a
// setting says (design 2026-10-26, section 1, "The never list"). Each rule is run over the Code tab's real tool list, recorded on
// the Mac Studio (fixtures/code-tab-tools.json), so that a tool the app adds shows in the list of what is caught.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NEVER_WORDS, BUILT_IN_AGENTS, DRAWING, isConnector, isLocalExtension, neverCaught, neverDenyRules } from "../never.js";

describe("the never list", () => {
  it("holds the words, the built-in agents and the drawing tools the design names", () => {
    assert.deepEqual(NEVER_WORDS, ["send", "post", "publish", "share", "schedule", "upload", "forward", "reply", "invite", "delete", "trash", "remove"]);
    assert.deepEqual(BUILT_IN_AGENTS, ["general-purpose", "Explore", "Plan"]);
    assert.deepEqual(DRAWING, ["mcp__visualize__show_widget", "mcp__visualize__read_me"]);
  });
  it("refuses by name every tool the design puts on the never list", () => {
    for (const name of ["Artifact","ArtifactComments","ArtifactData","RemoteTrigger","EnterWorktree","ExitWorktree","SearchPlugins","SuggestPluginInstall","SuggestSkills","SendMessage","DesignSync","NotebookEdit","Monitor"]) assert.equal(neverCaught(name), true, name);
  });
  it("refuses the screen, the browser, the terminal, every local extension and every tool of the app's own, by kind, and never the drawing tools", () => {
    for (const name of ["mcp__computer-use__screenshot","mcp__Claude_Browser__navigate","mcp__claude-in-chrome__navigate","mcp__Control_Chrome__open_url","mcp__playwright__browser_click","mcp__terminal__run_in_terminal","mcp__PDF_Tools__fill_pdf","mcp__plugin_pdf-viewer_pdf__display_pdf","mcp__knowledge-mcp__kb_search","mcp__ccd_host__reveal_path","mcp__ccd_directory__change_directory","mcp__ccd_session__start_session","mcp__ccd_session_mgmt__send_message","mcp__ccd_settings__set_setting","mcp__ccd_connectors__reconnect_session_connector","mcp__scheduled-tasks__create_scheduled_task","mcp__mcp-registry__search_mcp_registry","mcp__a_server_added_later__anything"]) assert.equal(neverCaught(name), true, name);
    for (const name of DRAWING) assert.equal(neverCaught(name), false, name);
  });
  it("catches by word any connector tool that posts, sends, shares, schedules, uploads or deletes, a made-up one included", () => {
    const c = "mcp__4e8268a7-b354-4c23-ab7d-2076f0dc3000__";
    for (const tool of ["opusclip_create_post_task","opusclip_schedule_publish","opusclip_unschedule_publish","opusclip_share_project","opusclip_create_upload_link"]) assert.equal(neverCaught(c + tool), true, tool);
    assert.equal(neverCaught("mcp__1a59c906-04da-521d-bda7-7f71b9f9e01c__send_invoice"), true);
    assert.equal(neverCaught(c + "opusclip_list_clips"), false);
  });
  it("refuses the subagent tool sent elsewhere or of another kind, under either of its names", () => {
    for (const name of ["Agent","Task"]) {
      for (const input of [{ isolation: "remote" }, { isolation: "worktree" }, { cwd: "/tmp" }, { subagent_type: "code-review:reviewer" }]) assert.equal(neverCaught(name, input), true, `${name} ${JSON.stringify(input)}`);
      for (const input of [{}, { subagent_type: "general-purpose" }, { subagent_type: "Explore" }]) assert.equal(neverCaught(name, input), false);
    }
  });
  it("refuses a Bash call that asks to run outside the sandbox", () => {
    assert.equal(neverCaught("Bash", { command: "date", dangerouslyDisableSandbox: true }), true);
    assert.equal(neverCaught("Bash", { command: "date" }), false);
  });
  it("runs its rule over the Code tab's real tool list, and lists what it catches", (t) => {
    const { tools } = JSON.parse(readFileSync(new URL("./fixtures/code-tab-tools.json", import.meta.url), "utf8"));
    for (const must of ["Bash","Read","Write","Edit","WebFetch","WebSearch","SendUserFile","PushNotification","Skill", ...DRAWING]) assert.ok(tools.includes(must), must);
    assert.ok(tools.some((n) => n.startsWith("mcp__ccd_")));
    const caught = tools.filter((n) => neverCaught(n));
    for (const open of ["Bash","Read","Write","Edit","WebFetch","WebSearch","SendUserFile","PushNotification","Skill", ...DRAWING]) assert.ok(!caught.includes(open), open);
    for (const n of tools.filter((n) => /opusclip_(create_post_task|schedule_publish|share_project|create_upload_link)$/.test(n))) assert.ok(caught.includes(n), n);
    t.diagnostic(caught.join("\n"));
  });
  it("denies in the settings every local MCP server of the fixture and the never tools by name, never the drawing tools, and never all of mcp__", () => {
    const { tools } = JSON.parse(readFileSync(new URL("./fixtures/code-tab-tools.json", import.meta.url), "utf8"));
    const rules = neverDenyRules();
    for (const server of new Set(tools.filter(isLocalExtension).map((n) => n.split("__")[1]))) assert.ok(rules.includes(`mcp__${server}__*`), server);
    assert.ok(!rules.some((r) => r.startsWith("mcp__visualize__")) && !rules.includes("mcp__*"));
    assert.ok(rules.includes("CronCreate") && !neverDenyRules([{ type: "tool", name: "CronCreate" }]).includes("CronCreate"));
  });
  it("denies in the settings, by its exact name, every connector tool of the fixture that the never list's words catch, and no other connector tool", () => {
    const { tools } = JSON.parse(readFileSync(new URL("./fixtures/code-tab-tools.json", import.meta.url), "utf8"));
    const rules = neverDenyRules();
    const posting = tools.filter((n) => isConnector(n) && neverCaught(n));
    assert.ok(posting.length > 0);
    for (const n of posting) assert.ok(rules.includes(n), n);
    for (const n of tools.filter((n) => isConnector(n) && !neverCaught(n))) assert.ok(!rules.includes(n), n);
    assert.ok(!rules.some((r) => isConnector(r) && r.endsWith("*")));
  });
});
