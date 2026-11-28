// 道具が空の仕事は道具を使わない（K-1302・D-128.101・D-155.11）。
//   K-910（依頼を書く間に分身が聞く）・K-929（案の仕事）は tools を空の配列で積む。Bridge はそれを読み、
//   組み込みの道具（--tools ""）・本人の設定の MCP（--strict-mcp-config）・スキル（--disable-slash-commands）・
//   本人の CLAUDE.md・記憶・フック（--safe-mode）を外し、
//   ブラウザ・Kaname の道具・資料の置き場・聞かずに使える決まりを渡さずに起こす。tools が無い・中身がある仕事は今のまま。
//   道具なしの仕事は、毎回新しく作る中身の無い一時の場所（git の外）を作業の場所にして起こし、終わったら消す
//   （本人の作業の場所の道・git の名前を AI の前に置かない）。消してから答えを返す・閉じない CLI は 5 秒で止める。
//   001〜007 は buildArgs の返す引数を見る。008〜013 は作業の場所を書き出す小さな偽の CLI を runClaude で起こす
//   （本物の CLI の確かめは K-922 の PS2）
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { DedicatedBrowser } from "../src/browser";
import type { KanameTools } from "../src/kaname-tools";
import { buildArgs, forgetClaude, runClaude, type Guard, type Job } from "../src/runner";

const base: Job = {
  job_id: "j-1302",
  prompt: "p",
  agent_session_id: null,
  conversation_id: null,
  permission_mode: "manual",
};
const TOOLS: KanameTools = {
  serverPath: "/tmp/kaname-tools-mcp.cjs",
  nodeBin: "/usr/bin/node",
  apiBase: "http://127.0.0.1:3011",
};
const DEDICATED: DedicatedBrowser = {
  cliPath: "/tmp/playwright-mcp/cli.js",
  nodeBin: "/usr/bin/node",
  profileDir: "/tmp/kaname-bridge/profile",
  outputDir: "/tmp/kaname-bridge/out",
};
const GUARD: Guard = { hookPath: "/tmp/kaname-guard.cjs", log: "/tmp/kaname-guard.log", nodeBin: "/usr/bin/node" };
const NO_TOOL_FLAGS = ["--tools", "--strict-mcp-config", "--disable-slash-commands", "--safe-mode"];
const GIVING = ["--chrome", "--mcp-config", "--add-dir", "--allowedTools"];

const count = (args: string[], v: string): number => args.filter((a) => a === v).length;
const after = (args: string[], flag: string, n = 1): string[] => {
  const i = args.indexOf(flag);
  return i < 0 ? [] : args.slice(i + 1, i + 1 + n);
};
const expectNoTools = (args: string[]): void => {
  expect(count(args, "--tools")).toBe(1);
  expect(after(args, "--tools")).toEqual([""]);
  expect(count(args, "--strict-mcp-config")).toBe(1);
  expect(count(args, "--disable-slash-commands")).toBe(1);
  expect(count(args, "--safe-mode")).toBe(1);
  expect(args, "--bare はログインを止めるので使わない").not.toContain("--bare");
  for (const f of GIVING) expect(args, `${f} を渡さない`).not.toContain(f);
};

describe("道具が空の仕事の起こし方（K-1302）", () => {
  it('K1302-BRG-001 tools が空の配列なら --tools ""・--strict-mcp-config・--disable-slash-commands・--safe-mode を付け、許可のモードは今のまま', () => {
    const args = buildArgs({ ...base, tools: [] });
    expectNoTools(args);
    expect(after(args, "--permission-mode")).toEqual(["manual"]);
  });

  it("K1302-BRG-002 ブラウザ・聞かずに使える決まり・Kaname の道具・専用のブラウザ・資料の置き場を付けても、道具なしの仕事には何も渡さない", () => {
    const chrome: Job = { ...base, browser: "chrome", allowed_tools: ["Read", "Bash(ls)"], tool_token: "tt" };
    const dedicated: Job = { ...base, browser: "dedicated", allowed_tools: ["Read", "Bash(ls)"], tool_token: "tt" };
    // 同じ形で tools が無ければ渡している（試験の組み立てが効いていることを先に見る）
    const chromeNow = buildArgs(chrome, ["/tmp/att"], null, TOOLS, null);
    expect(chromeNow).toContain("--chrome");
    expect(chromeNow).toContain("--mcp-config");
    expect(chromeNow).toContain("--add-dir");
    expect(chromeNow).toContain("--allowedTools");
    expect(buildArgs(dedicated, [], null, TOOLS, DEDICATED).join(" ")).toContain("mcp__playwright");

    for (const job of [chrome, dedicated]) {
      const args = buildArgs({ ...job, tools: [] }, ["/tmp/att"], null, TOOLS, DEDICATED);
      expectNoTools(args);
      const all = args.join("\n");
      for (const s of ["Read", "Bash(ls)", "mcp__kaname", "mcp__claude-in-chrome", "mcp__playwright", "/tmp/att"])
        expect(all, `${s} が引数に出ない`).not.toContain(s);
    }
  });

  it("K1302-BRG-003 可変長の --tools は後ろを飲み込まない：空の値のすぐ後ろは -- で始まる。モデル・考える強さ・続きは並びのまま", () => {
    const args = buildArgs({ ...base, tools: [], model: "sonnet", effort: "high", agent_session_id: "s-1" });
    expectNoTools(args);
    const next = args[args.indexOf("--tools") + 2];
    if (next !== undefined) expect(next.startsWith("--")).toBe(true);
    expect(after(args, "--model")).toEqual(["sonnet"]);
    expect(after(args, "--effort")).toEqual(["high"]);
    expect(after(args, "--resume")).toEqual(["s-1"]);
  });

  it("K1302-BRG-004 会話の仕事の形でも tools が空なら道具なし。会話の決まりは今のまま渡す", () => {
    const args = buildArgs({ ...base, conversation_id: "c-1", tools: [], tool_token: "tt" }, [], null, TOOLS, null);
    expectNoTools(args);
    expect(args).toContain("--append-system-prompt");
  });

  it("K1302-BRG-005 tools が null・欄なしの仕事は今のまま（道具なしの旗を付けず、Chrome と聞かずに使える決まりを渡す）", () => {
    const withNull = buildArgs({
      ...base,
      conversation_id: "c-1",
      browser: "chrome",
      allowed_tools: ["Read"],
      tools: null,
    });
    const noField: Job = { ...base, conversation_id: "c-1", browser: "chrome", allowed_tools: ["Read"] };
    expect("tools" in noField).toBe(false);
    const withoutField = buildArgs(noField);
    for (const args of [withNull, withoutField]) {
      for (const f of NO_TOOL_FLAGS) expect(args).not.toContain(f);
      expect(args).toContain("--chrome");
      expect(args.slice(args.indexOf("--allowedTools") + 1)).toEqual(["Read", "mcp__claude-in-chrome"]);
    }
    expect(withNull).toEqual(withoutField);
  });

  it("K1302-BRG-006 tools に中身がある仕事は今のまま（tools が null のときと引数がまったく同じ）", () => {
    const job: Job = { ...base, conversation_id: "c-1", allowed_tools: ["Edit"] };
    const filled = buildArgs({ ...job, tools: ["Read"] });
    for (const f of NO_TOOL_FLAGS) expect(filled).not.toContain(f);
    expect(filled.slice(filled.indexOf("--allowedTools") + 1)).toEqual(["Edit"]);
    expect(filled).toEqual(buildArgs({ ...job, tools: null }));
  });

  it("K1302-BRG-007 道具なしでも許可のモードと禁止の宛先の見張りは今のまま（道具は増えない）", () => {
    const blocked = [{ domain: "mizuhobank.co.jp", service: "みずほ銀行" }];
    const args = buildArgs({ ...base, tools: [], permission_mode: "bypassPermissions", blocked }, [], GUARD);
    expectNoTools(args);
    expect(after(args, "--permission-mode")).toEqual(["bypassPermissions"]);
    expect(args).toContain("--disallowedTools");
    expect(args).toContain("--settings");
    const now = buildArgs({ ...base, tools: null, permission_mode: "bypassPermissions", blocked }, [], GUARD);
    expect(after(args, "--disallowedTools", 2)).toEqual(after(now, "--disallowedTools", 2));
  });
});

// ── 試験の中で作る・消すのは、ここを通す 1 つの関数だけ ──
//   場所が一時の置き場（realpath(tmpdir())）の直下で、名前が kaname-none- で始まるときだけ通す。それ以外の道なら投げる。
//   （2026-11-24 実例：実装の無い今は CLI が Bridge の作業の場所で起き、試験の後片付けが作業の場所の根を消した）
//   ROOT は読み込んだときに 1 回だけ決める（BRG-011 が TMPDIR を書き換えても動かない）
const ROOT = realpathSync(tmpdir());
const PREFIX = "kaname-none-";
type ScratchOp =
  | { op: "mkdtemp"; prefix: string }
  | { op: "write"; path: string; text: string; mode: number }
  | { op: "chmod"; path: string; mode: number }
  | { op: "rm"; path: string };
/** 道を一時の置き場の直下の kaname-none- の場所（か、その中）に限る。在る物は実の道で見る（別名で外へ出さない） */
const guardPath = (p: string, mustExist: boolean): string => {
  const real = existsSync(p) ? realpathSync(p) : mustExist ? "" : join(realpathSync(dirname(p)), basename(p));
  if (!real) throw new Error(`試験の守り：在らない道は触らない（${p}）`);
  const rel = relative(ROOT, real);
  const top = rel.split(sep)[0] ?? "";
  if (!rel || isAbsolute(rel) || rel.startsWith("..") || !top.startsWith(PREFIX))
    throw new Error(`試験の守り：一時の置き場の直下の ${PREFIX} の場所の外は触らない（${p}）`);
  return real;
};
const scratch = (a: ScratchOp): string => {
  if (a.op === "mkdtemp") {
    if (dirname(a.prefix) !== ROOT || !basename(a.prefix).startsWith(PREFIX))
      throw new Error(`試験の守り：一時の置き場の直下の ${PREFIX} の場所しか作らない（${a.prefix}）`);
    return mkdtempSync(a.prefix);
  }
  if (a.op === "write") {
    const real = guardPath(a.path, false);
    writeFileSync(real, a.text);
    chmodSync(real, a.mode);
    return real;
  }
  const real = guardPath(a.path, true);
  if (a.op === "chmod") chmodSync(real, a.mode);
  else rmSync(real, { recursive: true, force: true });
  return real;
};
/** 残っていれば消す（守りを通る）。消えていれば何もしない */
const tidy = (p: string | undefined): void => {
  if (p && existsSync(p)) scratch({ op: "rm", path: p });
};

// 作業の場所を書き出す偽の CLI：起きた場所を自分の隣の cwd.log に 1 行足し、init と、result の本文に { cwd, entries, pid } を返す。
//   CWDFAIL：result を出さずに 1 で終わる／CWDLOCK：自分の場所に書けない子の場所を作ってから返す／CWDHANG：result の後も閉じない。
//   偽の CLI の中の作る（cwd.log・子の場所）も、同じ守り（ROOT の直下の kaname-none- だけ）を通す。守りの外なら result を出さずに 3 で終わる
const FAKE_DIR = scratch({ op: "mkdtemp", prefix: join(ROOT, `${PREFIX}k1302-fake-`) });
const FAKE = join(FAKE_DIR, "fake-cwd-claude.mjs");
const CWD_LOG = join(FAKE_DIR, "cwd.log");
const FAKE_SRC = `#!/usr/bin/env node
import { appendFileSync, chmodSync, mkdirSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
const ROOT = ${JSON.stringify(ROOT)};
const PREFIX = ${JSON.stringify(PREFIX)};
const guarded = (p) => {
  const rel = relative(ROOT, join(realpathSync(dirname(p)), basename(p)));
  return !!rel && !rel.startsWith("..") && (rel.split(sep)[0] ?? "").startsWith(PREFIX);
};
if (process.argv.includes("--version")) { console.log("2.1.331 (fake)"); process.exit(0); }
const log = ${JSON.stringify(CWD_LOG)};
if (!guarded(log)) process.exit(3);
appendFileSync(log, process.cwd() + "\\n");
const out = (o) => process.stdout.write(JSON.stringify(o) + "\\n");
out({ type: "system", subtype: "init", session_id: "sess-k1302", args: process.argv.slice(2), mcp_servers: [] });
let rest = "";
let answered = false;
process.stdin.on("data", (c) => {
  rest += c.toString();
  if (answered || !rest.includes("\\n")) return;
  answered = true;
  if (rest.includes("CWDFAIL")) process.exit(1);
  const here = realpathSync(process.cwd());
  const entries = readdirSync(here);
  if (rest.includes("CWDLOCK")) {
    // 子の場所づくりは、起きた場所が ROOT の直下の kaname-none- のときだけ
    if (dirname(here) !== ROOT || !basename(here).startsWith(PREFIX)) process.exit(3);
    const locked = join(here, "locked");
    mkdirSync(locked);
    writeFileSync(join(locked, "f"), "x");
    chmodSync(locked, 0o500);
  }
  const text = JSON.stringify({ cwd: here, entries, pid: process.pid });
  out({ type: "result", subtype: "success", is_error: false, result: text, session_id: "sess-k1302", num_turns: 1, usage: { input_tokens: 1, output_tokens: 1 } });
  if (rest.includes("CWDHANG")) { setInterval(() => {}, 1000); return; }
  process.exit(0);
});
`;
interface Seen {
  cwd: string;
  entries: string[];
  pid: number;
}
const parse = (f: Awaited<ReturnType<typeof runClaude>>): Seen | undefined =>
  f.state === "done" ? (JSON.parse(f.result) as Seen) : undefined;
const seenOf = async (job: Job): Promise<Seen> => {
  const f = await runClaude(job, {}, 20_000);
  expect(f.state).toBe("done");
  const s = parse(f);
  if (!s) throw new Error("結果が無い");
  return s;
};
const logLines = (): string[] => {
  const t = existsSync(CWD_LOG) ? readFileSync(CWD_LOG, "utf8").trim() : "";
  return t ? t.split("\n") : [];
};
const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
/** その道か、その上のどこかに .git が在るか（git の作業の場所の中か） */
const inGit = (p: string): boolean => {
  for (let d = p; ; d = dirname(d)) {
    if (existsSync(join(d, ".git"))) return true;
    if (dirname(d) === d) return false;
  }
};

describe("道具が空の仕事の作業の場所（K-1302）", () => {
  beforeAll(() => {
    scratch({ op: "write", path: FAKE, text: FAKE_SRC, mode: 0o755 });
    process.env["KANAME_CLAUDE_BIN"] = FAKE;
    forgetClaude();
  });
  afterAll(() => {
    delete process.env["KANAME_CLAUDE_BIN"];
    forgetClaude();
    tidy(FAKE_DIR);
  });

  it("K1302-BRG-008 道具なしの仕事は、一時の置き場に毎回新しく作った中身の無い場所（git の外）で起き、返った時点で消えている", async () => {
    const seen: Seen[] = [];
    try {
      seen.push(await seenOf({ ...base, job_id: "j-a", tools: [] }));
      seen.push(await seenOf({ ...base, job_id: "j-b", tools: [] }));
      for (const s of seen) {
        expect(realpathSync(dirname(s.cwd))).toBe(ROOT);
        expect(basename(s.cwd).startsWith(PREFIX)).toBe(true);
        expect(s.entries).toEqual([]);
        expect(inGit(s.cwd)).toBe(false);
        expect(existsSync(s.cwd), "返った時点で消えている").toBe(false);
      }
      expect(seen[0]?.cwd).not.toBe(seen[1]?.cwd);
    } finally {
      for (const s of seen) tidy(s.cwd);
    }
  });

  it("K1302-BRG-009 tools が null・中身がある仕事は今のまま Bridge の作業の場所で起き、一時の場所を作らない", async () => {
    const before = readdirSync(ROOT).filter((n) => n.startsWith(PREFIX)).length;
    for (const tools of [null, ["Read"]]) {
      const s = await seenOf({ ...base, job_id: "j-now", conversation_id: "c-1", tools });
      expect(realpathSync(s.cwd)).toBe(realpathSync(process.cwd()));
    }
    expect(readdirSync(ROOT).filter((n) => n.startsWith(PREFIX)).length).toBe(before);
  });

  it("K1302-BRG-010 CLI が結果を出さずに落ちても、返った時点で道具なしの仕事の一時の場所は無い", async () => {
    let last: string | undefined;
    try {
      const f = await runClaude({ ...base, job_id: "j-fail", prompt: "CWDFAIL", tools: [] }, {}, 20_000);
      expect(f.state).toBe("stopped");
      const runs = logLines();
      last = runs[runs.length - 1];
      expect(basename(last ?? "").startsWith(PREFIX), "落ちた回も一時の場所で起きた").toBe(true);
      expect(existsSync(last ?? ""), "落ちても消えている").toBe(false);
    } finally {
      if (last && basename(last).startsWith(PREFIX)) tidy(last);
    }
  });

  it("K1302-BRG-011 一時の作業の場所を作れなければ、CLI を起こさず止まる（決めた字・道を出さない）", async () => {
    const was = process.env["TMPDIR"];
    const runs = logLines().length;
    try {
      process.env["TMPDIR"] = join(ROOT, `${PREFIX}k1302-absent-${process.pid}`, "nowhere");
      const f = await runClaude({ ...base, job_id: "j-nomk", tools: [] }, {}, 20_000);
      expect(f.state).toBe("stopped");
      expect(f.state === "stopped" ? f.reason : "").toBe("一時の作業の場所を作れなかったので、AI を起こしませんでした");
      expect(logLines().length, "CLI は起きない").toBe(runs);
    } finally {
      if (was === undefined) delete process.env["TMPDIR"];
      else process.env["TMPDIR"] = was;
    }
  });

  it("K1302-BRG-012 一時の場所を消せなくても結末は done のまま、場所の名前だけを 1 回ログに出す", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let s: Seen | undefined;
    try {
      s = await seenOf({ ...base, job_id: "j-lock", prompt: "CWDLOCK", tools: [] });
      const calls = spy.mock.calls.filter((c) => c[0] === "[bridge] 一時の作業の場所を消せませんでした");
      expect(calls).toEqual([["[bridge] 一時の作業の場所を消せませんでした", basename(s.cwd)]]);
      expect(basename(s.cwd).startsWith(PREFIX)).toBe(true);
      expect(existsSync(s.cwd), "消せなかった場所は残る").toBe(true);
    } finally {
      spy.mockRestore();
      if (s && existsSync(join(s.cwd, "locked"))) scratch({ op: "chmod", path: join(s.cwd, "locked"), mode: 0o700 });
      tidy(s?.cwd);
    }
  });

  it(
    "K1302-BRG-013 result の後に CLI が閉じなくても、5 秒で止めて場所を消してから done を返す",
    async () => {
      let s: Seen | undefined;
      try {
        const t0 = Date.now();
        s = await seenOf({ ...base, job_id: "j-hang", prompt: "CWDHANG", tools: [] });
        const ms = Date.now() - t0;
        expect(ms).toBeGreaterThanOrEqual(5_000);
        expect(ms).toBeLessThan(20_000);
        expect(existsSync(s.cwd), "返った時点で消えている").toBe(false);
        expect(alive(s.pid), "偽の CLI は止まっている").toBe(false);
      } finally {
        if (s && alive(s.pid)) process.kill(s.pid, "SIGTERM");
        tidy(s?.cwd);
      }
    },
    { timeout: 30_000 },
  );
});
