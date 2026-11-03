// Claude Code に渡す環境（段階 1 は本人のサブスクだけ・D-092）と、Claude Code の確認を窓を固めずに待つこと。
//   ANTHROPIC_API_KEY 等が Bridge を起こした環境にあっても、子には渡らない（渡るとサブスクではなく API の料金で動きうる）
//   USER は渡る（無いと Claude Code がログインしていない扱いになる・Atelier で実測）
import { describe, expect, it } from "vitest";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { childEnv } from "../src/env";
import { ask } from "../src/proc";
import { forgetClaude, findClaude, works } from "../src/runner";

const PARENT: NodeJS.ProcessEnv = {
  HOME: "/Users/q",
  USER: "q",
  LOGNAME: "q",
  LANG: "ja_JP.UTF-8",
  LC_ALL: "ja_JP.UTF-8",
  HTTPS_PROXY: "http://proxy:8080",
  ANTHROPIC_API_KEY: "sk-ant-xxx",
  ANTHROPIC_AUTH_TOKEN: "t",
  ANTHROPIC_BASE_URL: "https://example.invalid",
  CLAUDE_CODE_USE_BEDROCK: "1",
  AWS_ACCESS_KEY_ID: "a",
  OPENAI_API_KEY: "o",
  GITHUB_TOKEN: "g",
  DATABASE_URL: "postgres://secret",
  PATH: "/usr/bin",
};

describe("子に渡す環境（許可リスト）", () => {
  it("家・利用者・言語・プロキシは渡り、PATH は渡した値になる", () => {
    const e = childEnv("/opt/homebrew/bin:/usr/bin", {}, PARENT);
    expect(e).toMatchObject({
      HOME: "/Users/q",
      USER: "q",
      LOGNAME: "q",
      LANG: "ja_JP.UTF-8",
      LC_ALL: "ja_JP.UTF-8",
      HTTPS_PROXY: "http://proxy:8080",
      PATH: "/opt/homebrew/bin:/usr/bin",
    });
  });
  it("モデルの鍵・別の請求先への切り替え・その他の秘密は渡らない", () => {
    const e = childEnv("/usr/bin", {}, PARENT);
    for (const k of [
      "ANTHROPIC_API_KEY",
      "ANTHROPIC_AUTH_TOKEN",
      "ANTHROPIC_BASE_URL",
      "CLAUDE_CODE_USE_BEDROCK",
      "AWS_ACCESS_KEY_ID",
      "OPENAI_API_KEY",
      "GITHUB_TOKEN",
      "DATABASE_URL",
    ])
      expect(e[k], k).toBeUndefined();
  });
  it("Bridge が足す値は渡るが、足す値に鍵が紛れても落とす", () => {
    const e = childEnv(
      "/usr/bin",
      { KANAME_BLOCKED: "[]", ELECTRON_RUN_AS_NODE: "1", ANTHROPIC_API_KEY: "sk" },
      PARENT,
    );
    expect(e["KANAME_BLOCKED"]).toBe("[]");
    expect(e["ELECTRON_RUN_AS_NODE"]).toBe("1");
    expect(e["ANTHROPIC_API_KEY"]).toBeUndefined();
  });
  it("実際に子プロセスから見えない（本物の node で確かめる）", async () => {
    const r = await ask(
      process.execPath,
      ["-e", "console.log(JSON.stringify({k: process.env.ANTHROPIC_API_KEY ?? null, u: process.env.USER ?? null}))"],
      {
        timeoutMs: 10_000,
        env: childEnv(process.env["PATH"] ?? "", {}, { ...PARENT, PATH: process.env["PATH"] }),
      },
    );
    expect(JSON.parse(r.stdout)).toEqual({ k: null, u: "q" });
  });
});

describe("Claude Code の確認は待っても窓を固めない", () => {
  const dir = mkdtempSync(join(tmpdir(), "kaname-claude-"));
  const slow = join(dir, "claude-slow");
  writeFileSync(slow, `#!${process.execPath}\nsetTimeout(() => { console.log("2.1.0 (Claude Code)"); }, 1500);\n`);
  chmodSync(slow, 0o755);
  const hang = join(dir, "claude-hang");
  writeFileSync(hang, `#!${process.execPath}\nsetInterval(() => {}, 1000);\n`);
  chmodSync(hang, 0o755);

  it("返事を待つ間も、ほかの処理（タイマー）が進む", async () => {
    let ticks = 0;
    const t = setInterval(() => ticks++, 50);
    const ok = await works(slow);
    clearInterval(t);
    expect(ok).toBe(true);
    expect(ticks, "同期で止まっていたら 0 回").toBeGreaterThan(10);
  });
  it("返事をしない候補は時間切れで落とし、固まらない", async () => {
    const r = await ask(hang, ["--version"], { timeoutMs: 800, env: childEnv(process.env["PATH"] ?? "") });
    expect(r.code).toBeNull();
  });
  it("見つけた場所は覚え、同時に聞いても 1 回しか調べない", async () => {
    const before = process.env["KANAME_CLAUDE_BIN"];
    process.env["KANAME_CLAUDE_BIN"] = slow;
    forgetClaude();
    try {
      const [a, b] = await Promise.all([findClaude(), findClaude()]);
      expect(a).toBe(slow);
      expect(b).toBe(slow);
      const t0 = Date.now();
      expect(await findClaude()).toBe(slow);
      expect(Date.now() - t0, "2 回目は覚えた値").toBeLessThan(100);
    } finally {
      if (before === undefined) delete process.env["KANAME_CLAUDE_BIN"];
      else process.env["KANAME_CLAUDE_BIN"] = before;
      forgetClaude();
    }
  });
});
