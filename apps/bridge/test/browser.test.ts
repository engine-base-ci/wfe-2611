// AI が使うブラウザ（D-119・T-B-37）。起動の引数・どの仕事に何を渡すか・つながらないときの知らせ・自己診断に出すつながり。
//   行の形は 2026-09-30 に本物の Claude Code 2.1.283（--chrome と Playwright MCP 0.0.83）で取ったものに合わせる
import { chmodSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  browserCheck,
  DEDICATED_TOOL_RULE,
  dedicatedBrowser,
  dedicatedServer,
  findPlaywrightMcp,
} from "../src/browser";
import { browserFor, BROWSER_OFF_NOTICE } from "../src/loop";
import {
  buildArgs,
  chromeState,
  CHROME_TOOL_RULE,
  forgetChromeState,
  forgetClaude,
  runClaude,
  type Job,
} from "../src/runner";
import { brief, label, parseLine } from "../src/stream";

const FAKE = join(__dirname, "fake-claude.mjs");
const base: Job = {
  job_id: "j-1",
  prompt: "p",
  agent_session_id: null,
  conversation_id: "c-1",
  permission_mode: "manual",
};
const allowedOf = (args: string[]): string[] => args.slice(args.indexOf("--allowedTools") + 1);
const mcpOf = (args: string[]): Record<string, { args: string[] }> =>
  (JSON.parse(args[args.indexOf("--mcp-config") + 1]!) as { mcpServers: Record<string, { args: string[] }> })
    .mcpServers;
const dataDir = mkdtempSync(join(tmpdir(), "kaname-browser-test-"));

beforeAll(() => {
  chmodSync(FAKE, 0o755);
  process.env["KANAME_CLAUDE_BIN"] = FAKE;
  forgetClaude();
});
afterAll(() => {
  delete process.env["KANAME_CLAUDE_BIN"];
  forgetClaude();
});

describe("起動の引数（D-119.1）", () => {
  it("CHT-37-003 本人の Chrome を選んだ仕事には --chrome を可変長の引数より前に置き、Claude in Chrome の道具を聞かずに使えるようにする", () => {
    const args = buildArgs({ ...base, browser: "chrome", allowed_tools: ["Read"] });
    expect(args).toContain("--chrome");
    expect(args.indexOf("--chrome")).toBeLessThan(args.indexOf("--allowedTools"));
    expect(allowedOf(args)).toEqual(["Read", CHROME_TOOL_RULE]);
    expect(args).not.toContain("--mcp-config");
  });
  it("CHT-37-004 Bridge 専用のブラウザは Kaname の道具と 1 本の --mcp-config にまとめ、インストール済みの Chrome と Bridge の置き場のログインの状態で開く", () => {
    const b = dedicatedBrowser(dataDir, "/usr/bin/node");
    expect(b, "同梱の @playwright/mcp が見つかる").not.toBeNull();
    const args = buildArgs(
      { ...base, browser: "dedicated", tool_token: "t" },
      [],
      null,
      { serverPath: "/k.cjs", nodeBin: "/usr/bin/node", apiBase: "http://a" },
      b,
    );
    expect(args.filter((a) => a === "--mcp-config")).toHaveLength(1);
    const s = mcpOf(args);
    expect(Object.keys(s).sort()).toEqual(["kaname", "playwright"]);
    expect(s["playwright"]!.args).toEqual([
      b!.cliPath,
      "--browser",
      "chrome",
      "--user-data-dir",
      join(dataDir, "browser-profile"),
      "--output-dir",
      join(dataDir, "browser-output"),
    ]);
    expect(existsSync(join(dataDir, "browser-profile")), "ログインの状態の置き場は消えない場所に作る").toBe(true);
    expect(allowedOf(args)).toEqual(["mcp__kaname", DEDICATED_TOOL_RULE]);
    expect(args).not.toContain("--chrome");
  });
  it("CHT-37-005 使わない・会話の無い仕事・古い Kaname（browser が無い）は何も足さない", () => {
    for (const j of [{ ...base, browser: "off" as const }, { ...base }]) {
      const args = buildArgs(j);
      expect(args).not.toContain("--chrome");
      expect(args).not.toContain("--mcp-config");
    }
    // 専用のブラウザを選んでも、この PC に用意できなければ渡さない（知らせは runClaude が出す）
    expect(buildArgs({ ...base, browser: "dedicated" }, [], null, null, null)).not.toContain("--mcp-config");
  });
});

describe("どの仕事に何を渡すか（D-119.2）", () => {
  it("CHT-37-005 会話の仕事は Bridge の窓で選んだもの、会話の無い仕事（記憶のまとめ）は使わない、Kaname が決めていればそれ", () => {
    expect(browserFor({ conversation_id: "c", browser: null }, "chrome")).toBe("chrome");
    expect(browserFor({ conversation_id: "c", browser: null }, "dedicated")).toBe("dedicated");
    expect(browserFor({ conversation_id: null, browser: null }, "chrome")).toBe("off");
    expect(browserFor({ conversation_id: "c", browser: null }, undefined)).toBe("off");
    expect(browserFor({ conversation_id: "c", browser: "off" }, "chrome")).toBe("off");
  });
});

describe("本物の行の読み方（D-119.4）", () => {
  it("CHT-37-006 起動の知らせの mcp_servers から Claude in Chrome と専用のブラウザのつながりを読む", () => {
    const init = (servers: unknown[]) =>
      parseLine(JSON.stringify({ type: "system", subtype: "init", session_id: "s", mcp_servers: servers }));
    expect(
      init([
        { name: "plugin:x", status: "needs-auth" },
        { name: "claude-in-chrome", status: "connected", source: "dynamic" },
      ]),
    ).toEqual({ type: "init", session: "s", chrome: "connected", dedicated: null, model: null });
    expect(init([{ name: "playwright", status: "failed", source: "dynamic" }])).toEqual({
      type: "init",
      session: "s",
      chrome: null,
      dedicated: "failed",
      model: null,
    });
    expect(init([])).toEqual({ type: "init", session: "s", chrome: null, dedicated: null, model: null });
  });
  it("CHT-37-006 道具の返り値が「拡張機能とつながっていない」なら印を付ける。ほかの失敗・成功には付けない。中身は送らない", () => {
    const end = (text: string, is_error: boolean) =>
      parseLine(
        JSON.stringify({
          type: "user",
          message: {
            content: [{ type: "tool_result", tool_use_id: "t1", is_error, content: [{ type: "text", text }] }],
          },
        }),
      );
    expect(
      end(
        "Browser extension is not connected. Please ensure the Claude browser extension is installed and running.",
        true,
      ),
    ).toEqual({ type: "tool_end", results: [{ id: "t1", ok: false }], browser: "disconnected" });
    expect(end("Navigated to https://example.com", false)).toEqual({
      type: "tool_end",
      results: [{ id: "t1", ok: true }],
    });
    expect(end("Timeout 5000ms exceeded", true)).toEqual({ type: "tool_end", results: [{ id: "t1", ok: false }] });
  });
  it("CHT-37-003 作業の行は日本語の動きと開く先のホスト名だけ（URL の後ろの鍵・検索の語は出さない）", () => {
    expect(label("mcp__claude-in-chrome__navigate")).toBe("ブラウザで開いています");
    expect(label("mcp__playwright__browser_click")).toBe("ブラウザで押しています");
    expect(brief("mcp__claude-in-chrome__navigate", { url: "https://www.example.com/login?token=abc", tabId: 1 })).toBe(
      "www.example.com",
    );
    expect(brief("mcp__playwright__browser_click", { element: "Learn more link", target: "e13" })).toBe("");
  });
});

describe("つながらないときは黙って終わらない（D-119.4）", () => {
  it("CHT-37-006 Chrome がつながっていなければ知らせを 1 回だけ出し、自己診断に最後のつながりを残す", async () => {
    forgetChromeState();
    const off: string[] = [];
    const f = await runClaude(
      { ...base, prompt: "CHROME_OFF 開いて", browser: "chrome", conventions: "FAKE_CHROME=failed" },
      { onBrowserOff: (w) => off.push(w) },
    );
    expect(f.state).toBe("done");
    expect(off, "起動時と道具の失敗の両方で分かっても 1 回だけ").toEqual(["chrome"]);
    expect(chromeState()?.status).toBe("disconnected");
    // 起動の時点で分かる（道具を使う前）
    forgetChromeState();
    const off2: string[] = [];
    await runClaude(
      { ...base, prompt: "開いて", browser: "chrome", conventions: "FAKE_CHROME=failed" },
      { onBrowserOff: (w) => off2.push(w) },
    );
    expect(off2).toEqual(["chrome"]);
    expect(chromeState()?.status).toBe("failed");
  });
  it("CHT-37-006 つながっていれば知らせない。つながりは自己診断に残る。Chrome を使わない仕事ではつながりを書き換えない", async () => {
    forgetChromeState();
    const off: string[] = [];
    await runClaude({ ...base, prompt: "開いて", browser: "chrome" }, { onBrowserOff: (w) => off.push(w) });
    expect(off).toEqual([]);
    expect(chromeState()?.status).toBe("connected");
    await runClaude({ ...base, prompt: "CHROME_OFF 開いて", browser: "off" }, { onBrowserOff: (w) => off.push(w) });
    expect(off).toEqual([]);
    expect(chromeState()?.status).toBe("connected");
  });
  it("CHT-37-006 専用のブラウザを選んだのに用意できない・つながらないときも知らせる。文は何をすれば直るかまで書く", async () => {
    const off: string[] = [];
    await runClaude(
      { ...base, prompt: "開いて", browser: "dedicated" },
      { onBrowserOff: (w) => off.push(w) },
      undefined,
      [],
      null,
      null,
      null,
    );
    expect(off).toEqual(["dedicated"]);
    const b = dedicatedBrowser(dataDir, process.execPath);
    const off2: string[] = [];
    await runClaude(
      { ...base, prompt: "開いて", browser: "dedicated", conventions: "FAKE_PW=failed" },
      { onBrowserOff: (w) => off2.push(w) },
      undefined,
      [],
      null,
      null,
      b,
    );
    expect(off2).toEqual(["dedicated"]);
    const off3: string[] = [];
    await runClaude(
      { ...base, prompt: "開いて", browser: "dedicated" },
      { onBrowserOff: (w) => off3.push(w) },
      undefined,
      [],
      null,
      null,
      b,
    );
    expect(off3, "つながっていれば知らせない").toEqual([]);
    expect(BROWSER_OFF_NOTICE.chrome).toContain("拡張機能「Claude in Chrome」");
    expect(BROWSER_OFF_NOTICE.dedicated).toContain("Chrome が入っているか");
  });
});

describe("Stagehand をやめる（D-119.3）", () => {
  it("CHT-37-008 Bridge の依存にあるブラウザの道具は Playwright MCP だけ（AI の API を自分で呼ぶ部品は無い）", async () => {
    const pkg = (await import("../package.json")) as { dependencies: Record<string, string> };
    expect(Object.keys(pkg.dependencies)).toContain("@playwright/mcp");
    expect(Object.keys(pkg.dependencies).join(" ")).not.toMatch(/stagehand|anthropic|openai/i);
    expect(findPlaywrightMcp()).toMatch(/@playwright[/\\]mcp[/\\]cli\.js$/);
    expect(dedicatedServer({ cliPath: "/c.js", nodeBin: "/n", profileDir: "/p", outputDir: "/o" }).env).toEqual({});
  });
});

describe("自己診断の 1 行（D-119.4・D-120）", () => {
  it("CHT-37-006 Chrome の行は、まだ使っていない・つながっている・つながっていない（直し方つき）を分け、Chrome が無ければそう言う", () => {
    expect(browserCheck("chrome", true, null, true)).toMatchObject({
      name: "AI が Chrome を使える（Claude in Chrome）",
      ok: true,
      detail: expect.stringContaining("まだ使っていません"),
    });
    expect(browserCheck("chrome", true, { status: "connected", at: 0 }, true)).toMatchObject({
      ok: true,
      detail: expect.stringContaining("つながっています"),
    });
    const ng = browserCheck("chrome", true, { status: "disconnected", at: 0 }, true);
    expect(ng).toMatchObject({
      ok: false,
      detail: expect.stringContaining("拡張機能「Claude in Chrome」がこの Claude と同じアカウントでログインしているか"),
    });
    expect(browserCheck("chrome", false, null, true)).toMatchObject({
      ok: false,
      detail: expect.stringContaining("Chrome が見つかりません"),
    });
  });
  it("CHT-37-005 使わない設定・専用のブラウザ（用意できる／部品が無い）を分ける", () => {
    expect(browserCheck("off", true, null, true)).toMatchObject({ name: "AI はブラウザを使わない設定です", ok: true });
    expect(browserCheck("dedicated", true, null, true)).toMatchObject({
      name: "AI が Bridge 専用のブラウザを使える",
      ok: true,
    });
    expect(browserCheck("dedicated", true, null, false)).toMatchObject({
      ok: false,
      detail: expect.stringContaining("入れ直して"),
    });
  });
});
