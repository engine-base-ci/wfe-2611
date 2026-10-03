// 規約で自動操作が禁止のサービスと銀行を PC の上で止める（D-107・T-B-24）。
//   判定（どの道具のどの宛先を止めるか）・Claude Code に渡す引数・フックを本物の node で動かしたときの終わり方と書き残し
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { blockedHit, guardArgs, HOOK_SOURCE, hostsIn, pageGuard, pagesIn, readGuardLog, writeHook, type Blocked, type Pages } from "../src/guard";
import { buildArgs } from "../src/runner";

const LIST: Blocked[] = [
  { domain: "mizuhobank.co.jp", service: "みずほ銀行" },
  { domain: "x.com", service: "X" },
];

describe("宛先の判定（D-107.3）", () => {
  it("URL・user@host・素のドメインから宛先を抜き出す", () => {
    expect(hostsIn("curl -s https://www.MizuhoBank.co.jp/login && ssh me@host.example.org && ping x.com")).toEqual(["www.mizuhobank.co.jp", "host.example.org", "x.com"]);
  });
  it("Bash のコマンド・WebFetch の url・ブラウザ（MCP）の url 系の欄を止める。下の階層も止める", () => {
    expect(blockedHit("Bash", { command: "curl -s https://www.mizuhobank.co.jp/login" }, LIST)).toMatchObject({ domain: "mizuhobank.co.jp", service: "みずほ銀行" });
    expect(blockedHit("WebFetch", { url: "https://x.com/home", prompt: "読む" }, LIST)).toMatchObject({ domain: "x.com" });
    expect(blockedHit("mcp__playwright__browser_navigate", { url: "https://direct.mizuhobank.co.jp/" }, LIST)).toMatchObject({ domain: "mizuhobank.co.jp" });
    expect(blockedHit("mcp__chrome__open", { args: { target: "https://x.com" } }, LIST)).toMatchObject({ domain: "x.com" });
  });
  it("似た名前・別のドメイン・書くだけの道具・一覧が空なら止めない", () => {
    expect(blockedHit("Bash", { command: "curl https://notmizuhobank.co.jp" }, LIST)).toBeNull();
    expect(blockedHit("Bash", { command: "curl https://freee.co.jp/api" }, LIST)).toBeNull();
    expect(blockedHit("Write", { file_path: "/w/メモ.md", content: "口座は mizuhobank.co.jp で見る" }, LIST), "書くだけでは外に出ない").toBeNull();
    expect(blockedHit("Bash", { command: "curl https://x.com" }, [])).toBeNull();
  });
});

describe("Claude Code に渡す引数（D-107.2）", () => {
  it("使わない道具（WebFetch のドメイン）とフックを渡す。一覧が空なら何も足さない", () => {
    const a = guardArgs(LIST, "/tmp/h.cjs", "/usr/bin/node");
    expect(a.slice(0, 3)).toEqual(["--disallowedTools", "WebFetch(domain:mizuhobank.co.jp)", "WebFetch(domain:x.com)"]);
    expect(a[3]).toBe("--settings");
    const s = JSON.parse(a[4]!) as { hooks: Record<"PreToolUse" | "PostToolUse", { matcher: string; hooks: { command: string }[] }[]> };
    expect(s.hooks.PreToolUse[0]!.matcher).toBe("*");
    expect(s.hooks.PostToolUse[0]!.matcher, "開いた後はブラウザ等の MCP の道具だけ（D-119.5）").toBe("mcp__.*");
    expect(s.hooks.PostToolUse[0]!.hooks[0]!.command).toBe('"/usr/bin/node" "/tmp/h.cjs"');
    expect(s.hooks.PreToolUse[0]!.hooks[0]!.command).toBe('"/usr/bin/node" "/tmp/h.cjs"');
    expect(guardArgs([], "/tmp/h.cjs", "/usr/bin/node")).toEqual([]);
  });
  it("全部許可の仕事にも付き、可変長の --allowedTools は最後のまま（--disallowedTools の後ろは --settings）", () => {
    const args = buildArgs(
      { job_id: "j", prompt: "p", agent_session_id: null, conversation_id: "c", permission_mode: "bypassPermissions", allowed_tools: ["Bash(git status)"], blocked: LIST },
      [],
      { hookPath: "/tmp/h.cjs", log: "/tmp/l", nodeBin: "/usr/bin/node" },
    );
    expect(args).toContain("bypassPermissions");
    const i = args.indexOf("--disallowedTools");
    expect(i).toBeGreaterThan(0);
    expect(args[i + 3]).toBe("--settings");
    expect(args.indexOf("--allowedTools")).toBeGreaterThan(i);
    expect(args.at(-1)).toBe("Bash(git status)");
    expect(buildArgs({ job_id: "j", prompt: "p", agent_session_id: null, conversation_id: "c", blocked: LIST }, []), "フックの置き場が無ければ付けない").not.toContain("--settings");
  });
  it("渡すのはドメインとサービスの名前だけ（資格情報は渡らない・D-107.7）", () => {
    const a = guardArgs([{ domain: "mizuhobank.co.jp", service: "みずほ銀行", verdict: "bank" }], "/tmp/h.cjs", "/usr/bin/node").join(" ");
    expect(a).not.toMatch(/vault|secret|password|token/i);
  });
});

describe("フックを本物の node で動かす（D-107.3・D-107.4）", () => {
  const dir = mkdtempSync(join(tmpdir(), "kaname-guard-test-"));
  const hook = writeHook(dir);
  const log = join(dir, "job.log");
  const run = (ev: unknown) =>
    spawnSync(process.execPath, [hook], {
      input: JSON.stringify(ev),
      env: { ...process.env, KANAME_BLOCKED: JSON.stringify(LIST), KANAME_GUARD_LOG: log },
      encoding: "utf8",
    });
  it("BRG-04-001 禁止の宛先は終了コード 2 と理由で止め、1 行書き残す。そうでなければ 0 で通す", () => {
    const ok = run({ tool_name: "Bash", tool_input: { command: "ls -la" } });
    expect(ok.status).toBe(0);
    const ng = run({ tool_name: "Bash", tool_input: { command: "curl -s https://www.mizuhobank.co.jp/login" } });
    expect(ng.status).toBe(2);
    expect(ng.stderr).toContain("みずほ銀行（mizuhobank.co.jp）は規約で自動操作が禁止のため、Kaname が止めました");
    expect(ng.stderr).toContain("正規の連携");
    const r = readGuardLog(log, 0);
    expect(r.hits).toEqual([{ tool: "Bash", domain: "mizuhobank.co.jp", service: "みずほ銀行", target: "curl -s https://www.mizuhobank.co.jp/login" }]);
    // 続きから読む
    run({ tool_name: "WebFetch", tool_input: { url: "https://x.com" } });
    const r2 = readGuardLog(log, r.next);
    expect(r2.hits.map((h) => h.domain)).toEqual(["x.com"]);
    expect(readFileSync(log, "utf8").trim().split("\n")).toHaveLength(2);
  });
  it("壊れた入力・一覧が無いときは通す（Claude Code を止めない）", () => {
    const bad = spawnSync(process.execPath, [hook], { input: "not json", env: { ...process.env, KANAME_BLOCKED: JSON.stringify(LIST) }, encoding: "utf8" });
    expect(bad.status).toBe(0);
    const none = spawnSync(process.execPath, [hook], { input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "curl https://x.com" } }), env: { ...process.env, KANAME_BLOCKED: "" }, encoding: "utf8" });
    expect(none.status).toBe(0);
  });
  it("フックの中身が同じなら書き直さない", () => {
    expect(writeHook(dir)).toBe(hook);
  });
});

// ---- 開いた後の見張り（D-119.5）。返り値の形は 2026-09-30 に本物の Claude Code 2.1.283 で取ったもの
const BL: Blocked[] = [{ domain: "iana.org", service: "（試験）IANA" }];
const chromeRes = (text: string, active = 697799946, url = "https://example.com/") => [
  { type: "text", text },
  { type: "text", text: `\n\nTab Context:\n- Executed on tabId: ${active}\n- Available tabs:\n  • tabId 697799945: "新しいタブ" ("chrome://newtab/")\n  • tabId ${active}: "Example Domain" ("${url}")` },
  { type: "text", text: "<system-reminder>You used a single tool call this turn.</system-reminder>" },
];
const pwRes = (url: string) => [{ type: "text", text: `### Ran Playwright code\n\`\`\`js\nawait page.getByRole('link', { name: 'Learn more' }).click();\n\`\`\`\n### Page\n- Page URL: ${url}\n- Page Title: Example Domains\n### Snapshot\n- [Snapshot](out/page.yml)` }];
const EMPTY: Pages = { tabs: {}, active: null };

describe("開いているページを読む（D-119.5）", () => {
  it("CHT-37-007 Claude in Chrome は Tab Context の全部のタブと動いたタブ、Playwright MCP は Page URL を読む。読めなければ null", () => {
    expect(pagesIn("mcp__claude-in-chrome__navigate", chromeRes("Navigated to https://example.com"))).toEqual({
      tabs: { "697799945": "chrome://newtab/", "697799946": "https://example.com/" },
      active: "697799946",
    });
    expect(pagesIn("mcp__playwright__browser_click", pwRes("https://www.iana.org/help/example-domains"))).toEqual({ tabs: { pw: "https://www.iana.org/help/example-domains" }, active: "pw" });
    expect(pagesIn("mcp__playwright__browser_close", [{ type: "text", text: "### Result\nNo open tabs. Navigate to a URL to create one." }])).toEqual({ tabs: {}, active: null });
    expect(pagesIn("mcp__claude-in-chrome__read_page", [{ type: "text", text: "link \"Learn more\" [ref_21] href=\"https://iana.org/help/example-domains\"" }]), "ページの中のリンクは開いているページではない").toBeNull();
    expect(pagesIn("mcp__kaname__remember", [{ type: "text", text: "Page URL: https://iana.org" }]), "ブラウザでない道具は読まない").toBeNull();
  });
});

describe("開いた後の判定（D-119.5）", () => {
  it("CHT-37-007 リンクを押して禁止の宛先に着いたら止め、そのタブでは読む・押すを止める。閉じる・タブを見る・別の宛先へ移るは通す", () => {
    const landed = pageGuard({ hook_event_name: "PostToolUse", tool_name: "mcp__claude-in-chrome__tabs_context_mcp", tool_response: chromeRes("{}", 697799946, "https://www.iana.org/help/example-domains") }, BL, EMPTY);
    expect(landed.hit).toMatchObject({ domain: "iana.org", service: "（試験）IANA", target: "https://www.iana.org/help/example-domains" });
    const pre = (tool: string, input: unknown) => pageGuard({ hook_event_name: "PreToolUse", tool_name: tool, tool_input: input }, BL, landed.pages).hit;
    expect(pre("mcp__claude-in-chrome__read_page", { tabId: 697799946 })).toMatchObject({ domain: "iana.org" });
    expect(pre("mcp__claude-in-chrome__computer", { action: "left_click", tabId: 697799946, ref: "ref_3" })).toMatchObject({ domain: "iana.org" });
    expect(pre("mcp__claude-in-chrome__browser_batch", { actions: [{ name: "computer", input: { action: "screenshot", tabId: 697799946 } }] }), "まとめて動かす道具の中の tabId も見る").toMatchObject({ domain: "iana.org" });
    expect(pre("mcp__claude-in-chrome__read_page", { tabId: 697799945 }), "別のタブは止めない").toBeNull();
    expect(pre("mcp__claude-in-chrome__tabs_close_mcp", { tabId: 697799946 })).toBeNull();
    expect(pre("mcp__claude-in-chrome__tabs_context_mcp", {})).toBeNull();
    expect(pre("mcp__claude-in-chrome__navigate", { tabId: 697799946, url: "https://example.com" })).toBeNull();
    // 別の宛先へ移って読めたら、また使える
    const back = pageGuard({ hook_event_name: "PostToolUse", tool_name: "mcp__claude-in-chrome__navigate", tool_response: chromeRes("Navigated to https://example.com") }, BL, landed.pages);
    expect(back.hit).toBeNull();
    expect(pageGuard({ hook_event_name: "PreToolUse", tool_name: "mcp__claude-in-chrome__read_page", tool_input: { tabId: 697799946 } }, BL, back.pages).hit).toBeNull();
  });
  it("CHT-37-007 専用のブラウザ（Playwright MCP）も同じ。押した直後の Page URL で止め、閉じれば忘れる。一覧が空・ブラウザでない道具は何もしない", () => {
    const landed = pageGuard({ hook_event_name: "PostToolUse", tool_name: "mcp__playwright__browser_click", tool_response: pwRes("https://www.iana.org/help/example-domains") }, BL, EMPTY);
    expect(landed.hit).toMatchObject({ domain: "iana.org" });
    expect(pageGuard({ hook_event_name: "PreToolUse", tool_name: "mcp__playwright__browser_snapshot", tool_input: {} }, BL, landed.pages).hit).toMatchObject({ domain: "iana.org" });
    expect(pageGuard({ hook_event_name: "PreToolUse", tool_name: "mcp__playwright__browser_close", tool_input: {} }, BL, landed.pages).hit).toBeNull();
    const closed = pageGuard({ hook_event_name: "PostToolUse", tool_name: "mcp__playwright__browser_close", tool_response: [{ type: "text", text: "### Result\nNo open tabs." }] }, BL, landed.pages);
    expect(closed.pages).toEqual({ tabs: {}, active: null });
    expect(pageGuard({ hook_event_name: "PostToolUse", tool_name: "mcp__playwright__browser_click", tool_response: pwRes("https://www.iana.org/") }, [], EMPTY).hit).toBeNull();
    expect(pageGuard({ hook_event_name: "PostToolUse", tool_name: "Bash", tool_response: "https://iana.org" }, BL, EMPTY).hit).toBeNull();
    expect(pageGuard({ hook_event_name: "PostToolUse", tool_name: "mcp__playwright__browser_click", tool_response: pwRes("https://notiana.org/") }, BL, EMPTY).hit, "似た名前は止めない").toBeNull();
  });
  it("CHT-37-007 フックを本物の node で動かす：着いた直後にページの中身を隠して「このタブを閉じて」で止め、次の操作も止め、1 行ずつ書き残す", () => {
    const dir = mkdtempSync(join(tmpdir(), "kaname-guard-pages-"));
    const hook = writeHook(dir);
    const log = join(dir, "job.log");
    const run = (ev: unknown) =>
      spawnSync(process.execPath, [hook], { input: JSON.stringify(ev), env: { ...process.env, KANAME_BLOCKED: JSON.stringify(BL), KANAME_GUARD_LOG: log }, encoding: "utf8" });
    const ok = run({ hook_event_name: "PostToolUse", tool_name: "mcp__claude-in-chrome__navigate", tool_input: { url: "https://example.com", tabId: 697799946 }, tool_response: chromeRes("Navigated to https://example.com") });
    expect(ok.status).toBe(0);
    const click = run({ hook_event_name: "PreToolUse", tool_name: "mcp__claude-in-chrome__computer", tool_input: { action: "left_click", tabId: 697799946, ref: "ref_21" } });
    expect(click.status, "禁止の宛先へのリンクを押すこと自体は、押す前には分からない").toBe(0);
    const landed = run({ hook_event_name: "PostToolUse", tool_name: "mcp__claude-in-chrome__tabs_context_mcp", tool_input: {}, tool_response: chromeRes("{}", 697799946, "https://www.iana.org/help/example-domains") });
    // 開いた後は JSON で止め、返り値（ページの中身）を置き換える（Claude Code 2.1.283 で実物を確かめた形）
    expect(landed.status).toBe(0);
    const out = JSON.parse(landed.stdout) as { decision: string; reason: string; hookSpecificOutput: { hookEventName: string; updatedMCPToolOutput: { type: string; text: string }[] } };
    expect(out.decision).toBe("block");
    expect(out.reason).toContain("（試験）IANA（iana.org）は規約で自動操作が禁止のため、Kaname が止めました。いま開いているページがその宛先です。このページでは操作せず、このタブを閉じてください。");
    expect(out.hookSpecificOutput).toEqual({ hookEventName: "PostToolUse", updatedMCPToolOutput: [{ type: "text", text: "（（試験）IANA のページのため、中身は Kaname が隠しました）" }] });
    expect(landed.stdout, "隠した返り値に元のページの URL・題を残さない").not.toContain("Example Domain");
    const next = run({ hook_event_name: "PreToolUse", tool_name: "mcp__claude-in-chrome__get_page_text", tool_input: { tabId: 697799946 } });
    expect(next.status).toBe(2);
    expect(run({ hook_event_name: "PreToolUse", tool_name: "mcp__claude-in-chrome__tabs_close_mcp", tool_input: { tabId: 697799946 } }).status).toBe(0);
    expect(readGuardLog(log, 0).hits.map((h) => h.tool)).toEqual(["mcp__claude-in-chrome__tabs_context_mcp", "mcp__claude-in-chrome__get_page_text"]);
  });
  it("CHT-37-007 見張りが壊れたら、外へ出る道具は止める（落ちたまま素通りさせない）。外へ出ない道具は通す", () => {
    const dir = mkdtempSync(join(tmpdir(), "kaname-guard-broken-"));
    const broken = join(dir, "broken.cjs");
    writeFileSync(broken, HOOK_SOURCE.replace("const pageGuard = ", "const pageGuard = () => { throw new Error(\"壊れた\"); }; const _unused = "));
    const run = (ev: unknown) => spawnSync(process.execPath, [broken], { input: JSON.stringify(ev), env: { ...process.env, KANAME_BLOCKED: JSON.stringify(BL) }, encoding: "utf8" });
    const out = run({ hook_event_name: "PreToolUse", tool_name: "mcp__claude-in-chrome__navigate", tool_input: { url: "https://example.com" } });
    expect(out.status).toBe(2);
    expect(out.stderr).toContain("Kaname の見張りが動かなかったので、外へ出る操作を止めました（壊れた）");
    expect(run({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path: "/w/a.md" } }).status).toBe(0);
  });
  it("CHT-37-007 変換器が関数に __name(…) を入れても見張りは落ちない（2026-09-30 tsx で見張りが落ちて素通りした実例）", () => {
    const dir = mkdtempSync(join(tmpdir(), "kaname-guard-name-"));
    const hook = join(dir, "named.cjs");
    // esbuild の keepNames が入れる形をまねる（関数の定義の中で __name を呼ぶ）
    writeFileSync(hook, HOOK_SOURCE.replace("const blockedHit = ", "__name(function probe() {}, \"probe\");\nconst blockedHit = "));
    const out = spawnSync(process.execPath, [hook], {
      input: JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "mcp__playwright__browser_navigate", tool_input: { url: "https://www.iana.org/" } }),
      env: { ...process.env, KANAME_BLOCKED: JSON.stringify(BL) },
      encoding: "utf8",
    });
    expect(out.status).toBe(2);
    expect(out.stderr).toContain("（試験）IANA（iana.org）は規約で自動操作が禁止のため");
  });
});
