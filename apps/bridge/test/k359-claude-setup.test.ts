// K-359「Bridge の側で Claude Code の自己診断と直し方を整える」の単体の試験。名前の頭の行 ID（K359-BR-…）は 11_tickets/K-359.md の表に 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
//   偽の claude：試験の中で一時の置き場に書く node の台本（KANAME_CLAUDE_BIN で差す）。auth status・auth login の振る舞いは置き場の cfg.json で変える
//   偽の npm：installClaude に渡す run（本物の npm は動かさない）
//   この PC の口：本物の startLocalServer を番号 0 で開く。輪：本物の startLoop を偽の Kaname（HTTP）に向ける
import { createServer, type Server } from "node:http";
import { appendFileSync, chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { claudeChecks, installClaude, installProgress, type Step } from "../src/install-claude";
import { authStatus, cancelLogin, startLogin, submitCode } from "../src/login";
import { startLocalServer } from "../src/local";
import { startLoop } from "../src/loop";
import { forgetClaude } from "../src/runner";
// 作り物の秘密の値は apps/bridge/test/_fake/secrets.ts に置いて import する（.gitleaks.toml が置き場だけを外す・K-328）
import { K359_FAKE_API_KEY } from "./_fake/secrets";

const ORIGIN = "http://127.0.0.1:3124";
const GOOD = "K359-GOOD-CODE";
const STATE = "K359STATE";
const NAME_CC = "本人のサブスクの Claude Code がある";
const NAME_LOGIN = "Claude Code にログインできている";

let dir = "";
let fake = "";
interface Cfg {
  /** auth status の答え：json（logged-in のファイルで決める）・bad（JSON でない）・fail（終了コード 1） */
  status: "json" | "bad" | "fail";
  /** auth login の振る舞い：url（入口を出して待つ）・nourl（何も出さずに待つ）・exitsoon（入口を出して 100ms で終わる） */
  login: "url" | "nourl" | "exitsoon";
}
const setCfg = (c: Partial<Cfg>) =>
  writeFileSync(join(dir, "cfg.json"), JSON.stringify({ status: "json", login: "url", ...c }));
const lines = (name: string) =>
  existsSync(join(dir, name))
    ? readFileSync(join(dir, name), "utf8")
        .split("\n")
        .filter((x) => x !== "")
    : [];
const calls = () => lines("calls.jsonl").map((l) => JSON.parse(l) as { args: string[]; env: string[] });
const pids = () => lines("pids").map(Number);
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** 偽の claude（本物の claude 2.x の auth の形に寄せる）。置き場の道は台本に書き込む（Bridge は環境を許可リストでしか渡さない） */
const fakeScript = (d: string) => `#!${process.execPath}
const { readFileSync, writeFileSync, appendFileSync, existsSync } = require("node:fs");
const DIR = ${JSON.stringify(d)};
const cfg = JSON.parse(readFileSync(DIR + "/cfg.json", "utf8"));
const args = process.argv.slice(2);
appendFileSync(DIR + "/calls.jsonl", JSON.stringify({ args, env: Object.keys(process.env) }) + "\\n");
if (args[0] === "--version") { process.stdout.write("2.1.300 (Claude Code)\\n"); process.exit(0); }
if (args[0] === "auth" && args[1] === "status") {
  if (cfg.status === "bad") { process.stdout.write("Not logged in\\n"); process.exit(0); }
  if (cfg.status === "fail") process.exit(1);
  process.stdout.write(JSON.stringify({ loggedIn: existsSync(DIR + "/logged-in"), authMethod: "claude.ai" }) + "\\n");
  process.exit(0);
}
if (args[0] === "auth" && args[1] === "login") {
  appendFileSync(DIR + "/pids", process.pid + "\\n");
  if (cfg.login !== "nourl")
    process.stdout.write("Opening browser to sign in... https://claude.ai/oauth/authorize?code=true&state=${STATE}\\nPaste code here if prompted > ");
  if (cfg.login === "exitsoon") setTimeout(() => process.exit(0), 100);
  let buf = "";
  process.stdin.on("data", (c) => {
    buf += c;
    let i;
    while ((i = buf.indexOf("\\n")) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      appendFileSync(DIR + "/stdin", line + "\\n");
      if (line === ${JSON.stringify(GOOD)}) setTimeout(() => { writeFileSync(DIR + "/logged-in", ""); process.exit(0); }, 500);
      else process.stderr.write("OAuth error: Invalid code\\n");
    }
  });
  setInterval(() => {}, 1000);
}
`;

/** console.* に出た字を全部ためる（ログにコード・URL の問い合わせ部分を出さないかを見る） */
let logged: string[] = [];
const spies: { mockRestore: () => void }[] = [];

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "k359-"));
  fake = join(dir, "claude");
  writeFileSync(fake, fakeScript(dir));
  chmodSync(fake, 0o755);
});
beforeEach(() => {
  writeFileSync(join(dir, "calls.jsonl"), "");
  writeFileSync(join(dir, "stdin"), "");
  writeFileSync(join(dir, "pids"), "");
  rmSync(join(dir, "logged-in"), { force: true }); // 既定はログインしていない
  setCfg({});
  process.env["KANAME_CLAUDE_BIN"] = fake;
  forgetClaude();
  logged = [];
  for (const k of ["log", "info", "warn", "error"] as const)
    spies.push(
      vi.spyOn(console, k).mockImplementation((...a: unknown[]) => {
        logged.push(a.map(String).join(" "));
      }),
    );
});
afterEach(() => {
  cancelLogin();
  for (const s of spies.splice(0)) s.mockRestore();
  for (const p of pids()) if (alive(p)) process.kill(p, "SIGKILL");
  delete process.env["KANAME_CLAUDE_BIN"];
  delete process.env["ANTHROPIC_API_KEY"];
  delete process.env["ANTHROPIC_BASE_URL"];
  forgetClaude();
});
afterAll(() => {
  forgetClaude();
});

/** 「logged-in」のファイルを消すと auth status は loggedIn false */
const loggedOut = () => rmSync(join(dir, "logged-in"), { force: true });

describe("K-359 自己診断の 2 行（claudeChecks）", { timeout: 30_000 }, () => {
  it("K359-BR-001 claude が無く、壊れた置き場も無い：2 行とも install。1 行目にエラーの ID は無く、auth は呼ばない", async () => {
    const auth = vi.fn(async () => ({ loggedIn: true }));
    const c = await claudeChecks({ find: async () => null, broken: async () => null, auth });
    expect(c).toHaveLength(2);
    expect(c[0]).toMatchObject({ name: NAME_CC, ok: false, fix: "install" });
    expect(Object.keys(c[0]!)).not.toContain("code");
    expect(c[1]).toMatchObject({
      name: NAME_LOGIN,
      ok: false,
      fix: "install",
      detail: "先に Claude Code を入れてください",
    });
    expect(auth).not.toHaveBeenCalled();
  });

  it("K359-BR-002 claude は無いが壊れた置き場がある：repair・E-CONN-011・説明に置き場", async () => {
    const at = "/opt/k359/lib/node_modules/@anthropic-ai/claude-code/install.cjs";
    const c = await claudeChecks({
      find: async () => null,
      broken: async () => at,
      auth: async () => ({ loggedIn: false }),
    });
    expect(c[0]).toMatchObject({ ok: false, fix: "repair", code: "E-CONN-011" });
    expect(c[0]!.detail).toContain("/opt/k359/lib/node_modules/@anthropic-ai/claude-code");
    expect(c[0]!.detail).not.toContain("install.cjs");
  });

  it("K359-BR-003 claude はあるがログインしていない：1 行目は ok、2 行目は login・E-CONN-010", async () => {
    const c = await claudeChecks({
      find: async () => "/usr/local/bin/claude",
      broken: async () => null,
      auth: async () => ({ loggedIn: false }),
    });
    expect(c[0]).toMatchObject({ ok: true, fix: null });
    expect(c[1]).toMatchObject({ name: NAME_LOGIN, ok: false, fix: "login", code: "E-CONN-010" });
  });

  it("K359-BR-004 claude があり、ログイン済み：2 行とも ok・直し方なし・エラーの ID なし", async () => {
    const c = await claudeChecks({
      find: async () => "/usr/local/bin/claude",
      broken: async () => null,
      auth: async () => ({ loggedIn: true }),
    });
    expect(c).toHaveLength(2);
    for (const row of c) {
      expect(row).toMatchObject({ ok: true, fix: null });
      expect(Object.keys(row)).not.toContain("code");
    }
  });

  it("K359-BR-005 失敗：auth status が JSON でない・終了コード 1 で何も出さない：どちらもログインしていない扱い（できたことにしない）", async () => {
    for (const status of ["bad", "fail"] as const) {
      setCfg({ status });
      forgetClaude();
      expect((await authStatus()).loggedIn).toBe(false);
      const c = await claudeChecks();
      expect(c[0], status).toMatchObject({ ok: true });
      expect(c[1], status).toMatchObject({ ok: false, fix: "login" });
    }
  });
});

/** 偽の npm と取り直し（run）。呼ばれた引数を数え、答えは手で決める */
type RunOut = { ok: boolean; out: string };
function fakeRun(answer: (args: string[], onStep: (s: Step) => void) => Promise<RunOut> | RunOut) {
  const seen: { bin: string; args: string[] }[] = [];
  const stops: number[] = [];
  const run = (bin: string, args: string[], onStep: (s: Step) => void) => {
    seen.push({ bin, args });
    return { done: Promise.resolve(answer(args, onStep)), stop: () => void stops.push(1) };
  };
  return { run, seen, stops };
}
const NPM_ARGS = ["install", "-g", "--include=optional", "@anthropic-ai/claude-code"];

describe("K-359 入れる（installClaude）", { timeout: 30_000 }, () => {
  it("K359-BR-006 もう動く claude がある：何もしない（run 0 回）", async () => {
    const r = fakeRun(() => ({ ok: true, out: "" }));
    const out = await installClaude(() => undefined, {
      find: async () => "/usr/local/bin/claude",
      forget: () => undefined,
      broken: async () => null,
      npm: () => "/usr/local/bin/npm",
      run: r.run,
    });
    expect(out).toEqual({ ok: true, message: "もう入っています（この PC で動かせます）" });
    expect(r.seen).toHaveLength(0);
  });

  it("K359-BR-007 壊れた置き場：取り直しだけで直れば npm を呼ばない。取り直しても動かなければ npm へ進む", async () => {
    const cjs = join(dir, "lib", "node_modules", "@anthropic-ai", "claude-code", "install.cjs");
    // 直る
    let fixed = false;
    const a = fakeRun(() => {
      fixed = true;
      return { ok: true, out: "done" };
    });
    const ok = await installClaude(() => undefined, {
      find: async () => (fixed ? "/usr/local/bin/claude" : null),
      forget: () => undefined,
      broken: async () => cjs,
      npm: () => "/usr/local/bin/npm",
      run: a.run,
    });
    expect(ok).toEqual({ ok: true, message: "入りました。次に「ログインする」を押してください" });
    expect(a.seen).toHaveLength(1);
    expect(a.seen[0]!.args).toEqual([cjs]);
    // 取り直しても動かない → npm で入れ直す
    const b = fakeRun(() => ({ ok: false, out: "postinstall failed" }));
    await installClaude(() => undefined, {
      find: async () => null,
      forget: () => undefined,
      broken: async () => cjs,
      npm: () => "/usr/local/bin/npm",
      run: b.run,
    });
    expect(b.seen.map((x) => x.args)).toEqual([[cjs], NPM_ARGS]);
  });

  it("K359-BR-008 claude も壊れた置き場も npm も無い：理由で止め、何も走らせない", async () => {
    const r = fakeRun(() => ({ ok: true, out: "" }));
    const out = await installClaude(() => undefined, {
      find: async () => null,
      forget: () => undefined,
      broken: async () => null,
      npm: () => null,
      run: r.run,
    });
    expect(out).toEqual({
      ok: false,
      message: "この PC に Node.js（npm）がありません。入れ方をお知らせしますので、お問い合わせください",
    });
    expect(r.seen).toHaveLength(0);
  });

  it("K359-BR-009 npm で入れて動くようになる：入りました。途中の行は「入れています」で始まり「入りました」で終わる", async () => {
    let done = false;
    const steps: Step[] = [];
    const r = fakeRun(() => {
      done = true;
      return { ok: true, out: "added 3 packages" };
    });
    const out = await installClaude((s) => steps.push(s), {
      find: async () => (done ? "/usr/local/bin/claude" : null),
      forget: () => undefined,
      broken: async () => null,
      npm: () => "/usr/local/bin/npm",
      run: r.run,
    });
    expect(out).toEqual({ ok: true, message: "入りました。次に「ログインする」を押してください" });
    expect(r.seen.map((x) => x.args)).toEqual([NPM_ARGS]);
    expect(steps[0]).toEqual({ text: "Claude Code を入れています（1〜2 分）", state: "doing" });
    expect(steps.at(-1)).toEqual({ text: "入りました", state: "done" });
  });

  it("K359-BR-010 手順 1 の失敗：npm が落ちる：最後の 1 行を添えて「入れられませんでした」。最後の途中の行は failed", async () => {
    const steps: Step[] = [];
    const r = fakeRun(() => ({ ok: false, out: "npm WARN x\nnpm ERR! code EACCES\n" }));
    const out = await installClaude((s) => steps.push(s), {
      find: async () => null,
      forget: () => undefined,
      broken: async () => null,
      npm: () => "/usr/local/bin/npm",
      run: r.run,
    });
    expect(out).toEqual({ ok: false, message: "入れられませんでした（npm ERR! code EACCES）" });
    expect(steps.at(-1)).toEqual({ text: "入れられませんでした", state: "failed" });
  });

  it("K359-BR-011 npm は成功と言うが claude が動かない：入ったと言わない", async () => {
    const r = fakeRun(() => ({ ok: true, out: "added 1 package" }));
    const out = await installClaude(() => undefined, {
      find: async () => null,
      forget: () => undefined,
      broken: async () => null,
      npm: () => "/usr/local/bin/npm",
      run: r.run,
    });
    expect(out.ok).toBe(false);
    expect(out.message.startsWith("入れられませんでした")).toBe(true);
  });

  it("K359-BR-012 操作の揺れ：同時に 2 回押す：npm は 1 回で、2 回とも同じ結末。終わった後はまた新しく走る", async () => {
    let release: () => void = () => undefined;
    let done = false;
    const seen: string[][] = [];
    const run = (_bin: string, args: string[]) => {
      seen.push(args);
      return {
        done: new Promise<RunOut>((res) => {
          release = () => {
            done = true;
            res({ ok: true, out: "" });
          };
        }),
        stop: () => undefined,
      };
    };
    const deps = {
      find: async () => (done ? "/usr/local/bin/claude" : null),
      forget: () => undefined,
      broken: async () => null,
      npm: () => "/usr/local/bin/npm",
      run,
    };
    const a = installClaude(() => undefined, deps);
    const b = installClaude(() => undefined, deps);
    await vi.waitFor(() => expect(seen).toHaveLength(1), { timeout: 5_000 });
    release();
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra).toEqual(rb);
    expect(ra.ok).toBe(true);
    expect(seen).toHaveLength(1);
    done = false;
    const c = installClaude(() => undefined, deps);
    await vi.waitFor(() => expect(seen).toHaveLength(2), { timeout: 5_000 });
    release();
    await c;
  });

  it("K359-BR-013 手順 1 の時間切れ：npm が返らない：止めて「時間がかかりすぎたので止めました」。走っている印は下りる", async () => {
    const stops: number[] = [];
    const t0 = Date.now();
    const out = await installClaude(() => undefined, {
      find: async () => null,
      forget: () => undefined,
      broken: async () => null,
      npm: () => "/usr/local/bin/npm",
      run: () => ({ done: new Promise<RunOut>(() => undefined), stop: () => void stops.push(1) }),
      timeoutMs: 200,
    });
    expect(Date.now() - t0).toBeLessThan(5_000);
    expect(out).toEqual({ ok: false, message: "時間がかかりすぎたので止めました。もう一度押してください" });
    expect(stops).toHaveLength(1);
    expect(installProgress().running).toBe(false);
  });

  it("K359-BR-014 手順 1 の後片付けの失敗：止めるのが投げる：同じ文で返し、ログに「止められませんでした」。次の押しは新しく走る", async () => {
    let n = 0;
    const deps = {
      find: async () => null,
      forget: () => undefined,
      broken: async () => null,
      npm: () => "/usr/local/bin/npm",
      run: () => {
        n += 1;
        return {
          done: new Promise<RunOut>(() => undefined),
          stop: () => {
            throw new Error("kill EPERM");
          },
        };
      },
      timeoutMs: 200,
    };
    const out = await installClaude(() => undefined, deps);
    expect(out).toEqual({ ok: false, message: "時間がかかりすぎたので止めました。もう一度押してください" });
    expect(installProgress().running).toBe(false);
    expect(logged.some((l) => l.includes("入れる作業を止められませんでした"))).toBe(true);
    expect(logged.some((l) => l.includes("npm ERR"))).toBe(false);
    await installClaude(() => undefined, deps);
    expect(n).toBe(2);
  });
});

/** 作り物の npm（node の台本）。置き場の npm.json の mode で振る舞いを変え、受けた引数と環境の名前を npm-calls.jsonl に、pid を pids に書く */
const fakeNpmScript = (d: string) => `#!${process.execPath}
const { readFileSync, appendFileSync } = require("node:fs");
const DIR = ${JSON.stringify(d)};
const mode = JSON.parse(readFileSync(DIR + "/npm.json", "utf8")).mode;
appendFileSync(DIR + "/npm-calls.jsonl", JSON.stringify({ args: process.argv.slice(2), env: Object.keys(process.env) }) + "\\n");
appendFileSync(DIR + "/pids", process.pid + "\\n");
if (mode === "ok") { process.stdout.write("added 3 packages in 2s\\n"); process.exit(0); }
if (mode === "fail") { process.stderr.write("npm WARN x\\nnpm ERR! code EACCES\\n"); process.exit(1); }
process.stdout.write("idealTree: timing\\n");
setInterval(() => {}, 1000);
`;

describe("K-359 入れる（本物の走らせ方と探し方：run・broken を差し込まない）", { timeout: 30_000 }, () => {
  let npm = "";
  const setNpm = (mode: "ok" | "fail" | "hang") => writeFileSync(join(dir, "npm.json"), JSON.stringify({ mode }));
  const npmCalls = () => lines("npm-calls.jsonl").map((l) => JSON.parse(l) as { args: string[]; env: string[] });
  beforeAll(() => {
    npm = join(dir, "npm");
    writeFileSync(npm, fakeNpmScript(dir));
    chmodSync(npm, 0o755);
  });
  beforeEach(() => {
    writeFileSync(join(dir, "npm-calls.jsonl"), "");
  });

  it("K359-BR-028 手順 1 を本物の走らせ方で：作り物の npm が成功・終了コード 1・返らない・置き場に無い。返らないときは起こした子が本当に止まる", async () => {
    process.env["ANTHROPIC_API_KEY"] = K359_FAKE_API_KEY;
    const base = { forget: () => undefined, broken: async () => null, npm: () => npm };
    // 成功：台本が呼ばれた後は claude が見つかる
    setNpm("ok");
    const steps: Step[] = [];
    const ok = await installClaude((s) => steps.push(s), {
      ...base,
      find: async () => (npmCalls().length > 0 ? "/usr/local/bin/claude" : null),
    });
    expect(ok).toEqual({ ok: true, message: "入りました。次に「ログインする」を押してください" });
    expect(npmCalls()).toHaveLength(1);
    expect(npmCalls()[0]!.args).toEqual(NPM_ARGS);
    expect(npmCalls()[0]!.env).not.toContain("ANTHROPIC_API_KEY");
    expect(steps).toContainEqual({ text: "added 3 packages in 2s", state: "doing" });
    // 終了コード 1：最後の 1 行を添える
    setNpm("fail");
    const ng = await installClaude(() => undefined, { ...base, find: async () => null });
    expect(ng).toEqual({ ok: false, message: "入れられませんでした（npm ERR! code EACCES）" });
    // 返らない：時間切れの文で返り、起こした子はもう生きていない（止める関数は本物）
    setNpm("hang");
    writeFileSync(join(dir, "pids"), "");
    const late = await installClaude(() => undefined, { ...base, find: async () => null, timeoutMs: 1_500 });
    expect(late).toEqual({ ok: false, message: "時間がかかりすぎたので止めました。もう一度押してください" });
    expect(pids()).toHaveLength(1);
    await vi.waitFor(() => expect(alive(pids()[0]!)).toBe(false), { timeout: 5_000 });
    expect(installProgress().running).toBe(false);
    // 置き場に無い npm：起こせなくても投げず、入ったと言わない
    const none = await installClaude(() => undefined, {
      ...base,
      npm: () => join(dir, "no-such-npm"),
      find: async () => null,
    });
    expect(none.ok).toBe(false);
    expect(none.message.startsWith("入れられませんでした")).toBe(true);
  });

  it("K359-BR-029 本物の探し方（壊れた置き場をこの台の npm の全体の置き場と決まった置き場から探す）：投げずにちょうど 2 行", async () => {
    const auth = vi.fn(async () => ({ loggedIn: true }));
    const c = await claudeChecks({ find: async () => null, auth });
    expect(c).toHaveLength(2);
    expect(c[0]!.name).toBe(NAME_CC);
    expect(c[0]!.ok).toBe(false);
    // この台に壊れた置き場が在るかどうかで、直し方は install か repair（在れば E-CONN-011・無ければエラーの ID なし）
    expect(["install", "repair"]).toContain(c[0]!.fix);
    expect(c[0]!.code).toBe(c[0]!.fix === "repair" ? "E-CONN-011" : undefined);
    expect(c[1]).toMatchObject({
      name: NAME_LOGIN,
      ok: false,
      fix: "install",
      detail: "先に Claude Code を入れてください",
    });
    expect(auth).not.toHaveBeenCalled();
  });
});

/** 本物のこの PC の口を番号 0 で開く */
async function local(over: Partial<Parameters<typeof startLocalServer>[0]> = {}) {
  const calls = { install: 0, login: 0, code: [] as string[], check: 0, claim: 0 };
  const srv = startLocalServer(
    {
      version: "1.4.0",
      deviceLabel: () => "高本の MacBook",
      connected: () => true,
      claim: async () => {
        calls.claim += 1;
        return { ok: true };
      },
      check: async () => {
        calls.check += 1;
        return [];
      },
      installClaude: async () => {
        calls.install += 1;
        return { ok: true, message: "" };
      },
      loginStart: async () => {
        calls.login += 1;
        return { ok: true, message: "" };
      },
      loginCode: async (c: string) => {
        calls.code.push(c);
        return submitCode(c);
      },
      loginCancel: () => undefined,
      ...over,
    },
    0,
  );
  await new Promise<void>((r) => (srv.listening ? r() : srv.once("listening", () => r())));
  const a = srv.address();
  const base = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
  return { srv, base, calls };
}
const from = (origin = ORIGIN, extra: Record<string, string> = {}) => ({ origin, ...extra });

describe("K-359 この PC の口", { timeout: 30_000 }, () => {
  it("K359-BR-015 GET /install-progress：入れている途中は running と途中の行、終わると running false と最後の行。渡さない口は空", async () => {
    let release: () => void = () => undefined;
    let done = false;
    const work = installClaude(() => undefined, {
      find: async () => (done ? "/usr/local/bin/claude" : null),
      forget: () => undefined,
      broken: async () => null,
      npm: () => "/usr/local/bin/npm",
      run: (_b: string, _a: string[], onStep: (s: Step) => void) => {
        onStep({ text: "added 3 packages", state: "doing" });
        return {
          done: new Promise<RunOut>((res) => {
            release = () => {
              done = true;
              res({ ok: true, out: "added 3 packages" });
            };
          }),
          stop: () => undefined,
        };
      },
    });
    const { srv, base } = await local({ installProgress });
    const bare = await local();
    try {
      await vi.waitFor(
        async () => {
          const r = await fetch(`${base}/install-progress`, { headers: from() });
          expect(r.status).toBe(200);
          const j = (await r.json()) as { running: boolean; steps: Step[] };
          expect(j.running).toBe(true);
          expect(j.steps.at(-1)).toEqual({ text: "added 3 packages", state: "doing" });
        },
        { timeout: 5_000 },
      );
      release();
      await work;
      const after = (await (await fetch(`${base}/install-progress`, { headers: from() })).json()) as {
        running: boolean;
        steps: Step[];
      };
      expect(after.running).toBe(false);
      expect(after.steps.at(-1)).toEqual({ text: "入りました", state: "done" });
      const none = await fetch(`${bare.base}/install-progress`, { headers: from() });
      expect(await none.json()).toEqual({ running: false, steps: [] });
    } finally {
      srv.close();
      bare.srv.close();
    }
  });

  it("K359-BR-016 入力：/login-code と /pair の本文が JSON でない：422・400 で答え、口は落ちない", async () => {
    const { srv, base, calls } = await local();
    try {
      const r = await fetch(`${base}/login-code`, {
        method: "POST",
        headers: from(ORIGIN, { "content-type": "application/json" }),
        body: "{壊れた",
      });
      expect(r.status).toBe(422);
      expect(await r.json()).toEqual({ ok: false, message: "コードを読めませんでした。貼り直してください" });
      expect(calls.code).toHaveLength(0);
      expect((await fetch(`${base}/ping`, { headers: from() })).status).toBe(200);
      const p = await fetch(`${base}/pair`, {
        method: "POST",
        headers: from(ORIGIN, { "content-type": "application/json" }),
        body: "{壊れた",
      });
      expect(p.status).toBe(400);
      expect(calls.claim).toBe(0);
      expect((await fetch(`${base}/ping`, { headers: from() })).status).toBe(200);
    } finally {
      srv.close();
    }
  });

  it("K359-BR-017 入力：コードが空・空白だけ：409「コードを貼ってください」。claude には何も渡らない", async () => {
    await startLogin();
    const { srv, base } = await local();
    try {
      for (const code of ["", "   \n"]) {
        const r = await fetch(`${base}/login-code`, {
          method: "POST",
          headers: from(ORIGIN, { "content-type": "application/json" }),
          body: JSON.stringify({ code }),
        });
        expect(r.status).toBe(409);
        expect(await r.json()).toMatchObject({ ok: false, message: "コードを貼ってください" });
      }
      expect(lines("stdin")).toEqual([]);
    } finally {
      srv.close();
    }
  });

  it("K359-BR-025 守り：知らない出どころから入れる・ログイン・コード・自己診断：403 で何も始めない", async () => {
    const { srv, base, calls } = await local();
    try {
      for (const [m, p] of [
        ["POST", "/install-claude"],
        ["POST", "/login-claude"],
        ["POST", "/login-code"],
        ["GET", "/check"],
      ] as const) {
        const r = await fetch(`${base}${p}`, {
          method: m,
          headers: from("https://evil.example", { "content-type": "application/json" }),
          ...(m === "POST" ? { body: JSON.stringify({ code: GOOD }) } : {}),
        });
        expect(r.status, p).toBe(403);
        expect(await r.json()).toEqual({ error: "forbidden" });
        expect(r.headers.get("access-control-allow-origin")).toBeNull();
      }
      expect(calls).toMatchObject({ install: 0, login: 0, check: 0 });
      expect(calls.code).toHaveLength(0);
    } finally {
      srv.close();
    }
  });
});

describe("K-359 ログイン（auth status に聞いてから「できた」）", { timeout: 30_000 }, () => {
  it("K359-BR-018 入口の URL を返す。子は auth login --claudeai。ログに入口の問い合わせ部分が出ない", async () => {
    const r = await startLogin();
    expect(r.ok).toBe(true);
    expect(r.url).toBe(`https://claude.ai/oauth/authorize?code=true&state=${STATE}`);
    expect(calls().some((c) => c.args.join(" ") === "auth login --claudeai")).toBe(true);
    expect(logged.join("\n")).not.toContain(STATE);
  });

  it("K359-BR-019 手順 3 の失敗：入口の URL が出ない：「ログインの入口を開けませんでした」。起こした子は止まっている", async () => {
    setCfg({ login: "nourl" });
    const r = await startLogin({ waitUrlMs: 300 });
    expect(r).toEqual({ ok: false, message: "ログインの入口を開けませんでした。もう一度お試しください" });
    expect(pids()).toHaveLength(1);
    await vi.waitFor(() => expect(alive(pids()[0]!)).toBe(false), { timeout: 5_000 });
  });

  it("K359-BR-020 正しいコード（前後に空白）：切って 1 回だけ渡し、auth status が入れていると言ってから「ログインできました」", async () => {
    loggedOut();
    expect((await startLogin()).ok).toBe(true);
    const t0 = Date.now();
    const r = await submitCode(`  ${GOOD} \n`, { everyMs: 100 });
    expect(r).toEqual({ ok: true, message: "ログインできました。これで仕事を渡せます" });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(400); // 偽の claude は受けてから 500ms 後に入れている状態になる
    expect(lines("stdin")).toEqual([GOOD]);
    expect(existsSync(join(dir, "logged-in"))).toBe(true);
    expect(logged.join("\n")).not.toContain(GOOD);
  });

  it("K359-BR-021 手順 4 の失敗：違うコード：「ログインできませんでした…コードを貼り直してください」", async () => {
    loggedOut();
    await startLogin();
    const r = await submitCode("K359-WRONG", { waitLoginMs: 600, everyMs: 100 });
    expect(r.ok).toBe(false);
    expect(r.message.startsWith("ログインできませんでした")).toBe(true);
    expect(r.message.endsWith("コードを貼り直してください")).toBe(true);
  });

  it("K359-BR-022 時間の流れ：ログインを始めてから時間が空いた：「時間が空きました…」。コードは渡さない", async () => {
    loggedOut();
    await startLogin({ giveUpMs: 200 });
    await vi.waitFor(() => expect(alive(pids()[0]!)).toBe(false), { timeout: 5_000 });
    const r = await submitCode(GOOD, { everyMs: 100 });
    expect(r).toEqual({ ok: false, message: "時間が空きました。もう一度「ログインする」から始めてください" });
    expect(lines("stdin")).toEqual([]);
  });

  it("K359-BR-023 操作の揺れ：「ログインする」を 2 回：前の子を止め、生きている子は 1 つ", async () => {
    loggedOut();
    await startLogin();
    await startLogin();
    const [first, second] = pids();
    await vi.waitFor(() => expect(alive(first!)).toBe(false), { timeout: 5_000 });
    expect(alive(second!)).toBe(true);
  });

  it("K359-BR-024 手順 3 の後片付けの失敗：子が自分で落ちた後に止める：投げず、次のログインが始められる", async () => {
    loggedOut();
    setCfg({ login: "exitsoon" });
    expect((await startLogin()).ok).toBe(true);
    await vi.waitFor(() => expect(alive(pids()[0]!)).toBe(false), { timeout: 5_000 });
    expect(() => cancelLogin()).not.toThrow();
    setCfg({ login: "url" });
    const again = await startLogin();
    expect(again.ok).toBe(true);
    expect(again.url).toContain("https://claude.ai/");
    expect(pids()).toHaveLength(2);
  });

  it("K359-BR-026 守り：請求先を変える値（ANTHROPIC_API_KEY・ANTHROPIC_BASE_URL）を claude に渡さない", async () => {
    loggedOut();
    process.env["ANTHROPIC_API_KEY"] = K359_FAKE_API_KEY;
    process.env["ANTHROPIC_BASE_URL"] = "https://k359.example";
    await authStatus();
    await startLogin();
    const seen = calls().filter((c) => c.args[0] === "auth");
    expect(seen.map((c) => c.args.slice(0, 2).join(" "))).toEqual(
      expect.arrayContaining(["auth status", "auth login"]),
    );
    for (const c of seen) {
      expect(c.env).not.toContain("ANTHROPIC_API_KEY");
      expect(c.env).not.toContain("ANTHROPIC_BASE_URL");
    }
  });
});

describe("K-359 この PC の印（device_id）", { timeout: 30_000 }, () => {
  let api: Server;
  let base = "";
  let withId = true;
  beforeAll(async () => {
    api = createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        appendFileSync(join(dir, "api.log"), `${req.url}\n`);
        const url = req.url ?? "";
        const send = (data: unknown, status = 200) => {
          res.writeHead(status, { "content-type": "application/json" });
          res.end(JSON.stringify({ data }));
        };
        if (url.endsWith("/bridge/heartbeat"))
          return send({ ok: true, browser: null, outdated: false, ...(withId ? { device_id: "dev-k359" } : {}) }, 201);
        if (url.endsWith("/bridge/jobs/take"))
          return send({ job: null, forbidden_domains: [], next_ms: 50, outdated: false }, 201);
        return send({ ok: true });
      });
    });
    await new Promise<void>((r) => api.listen(0, "127.0.0.1", r));
    const a = api.address();
    base = `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
  });
  afterAll(() => {
    api.close();
  });

  it("K359-BR-027 生きている知らせの答えの device_id を覚え、/ping で返す。答えに無ければ呼ばない・渡さなければ null", async () => {
    const run = async (id: boolean) => {
      withId = id;
      const ids: string[] = [];
      let beats = 0;
      const stop = startLoop({
        apiBase: base,
        sessionId: () => `kpc_${"k".repeat(43)}`,
        health: async () => {
          beats += 1;
          return [];
        },
        onChange: () => undefined,
        onGone: () => undefined,
        onDeviceId: (x: string) => ids.push(x),
      });
      try {
        await vi.waitFor(() => expect(beats).toBeGreaterThanOrEqual(1), { timeout: 8_000 });
        await vi.waitFor(() => expect(readFileSync(join(dir, "api.log"), "utf8")).toContain("/bridge/jobs/take"), {
          timeout: 8_000,
        });
      } finally {
        stop();
      }
      return ids;
    };
    writeFileSync(join(dir, "api.log"), "");
    expect(await run(true)).toEqual(["dev-k359"]);
    writeFileSync(join(dir, "api.log"), "");
    expect(await run(false)).toEqual([]);

    const a = await local({ deviceId: () => "dev-k359" });
    const b = await local();
    try {
      expect(await (await fetch(`${a.base}/ping`, { headers: from() })).json()).toMatchObject({
        device_id: "dev-k359",
      });
      expect(await (await fetch(`${b.base}/ping`, { headers: from() })).json()).toMatchObject({ device_id: null });
    } finally {
      a.srv.close();
      b.srv.close();
    }
  });
});
