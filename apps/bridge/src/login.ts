// Claude Code のログイン（D-091.3）。ターミナルを出さずに、Bridge の窓の中で終わらせる。
//   1 「ログインする」→ claude auth login がブラウザを開く（開かない人のために URL も渡す）
//   2 本人がブラウザで承認 → 画面にコードが出る
//   3 そのコードを窓に貼る → Bridge が claude に渡す → claude auth status で本当に入れたか確かめる
// 承認するのは必ず本人。Bridge は資格情報を持たないし、見ない。
import { spawn, type ChildProcess } from "node:child_process";
import { childEnv } from "./env";
import { ask } from "./proc";
import { findClaude, shellPath } from "./runner";

const URL_RE = /https?:\/\/[^\s"']+/;
const WAIT_URL_MS = 25_000;
const WAIT_LOGIN_MS = 120_000;
const GIVE_UP_MS = 10 * 60_000;

interface Attempt {
  p: ChildProcess;
  out: string;
  closed: boolean;
  timer: NodeJS.Timeout;
}
let cur: Attempt | null = null;

// 親の環境をそのまま渡さない（ANTHROPIC_API_KEY 等でサブスク以外の請求先に切り替わるのを防ぐ・env.ts）
const env = (): NodeJS.ProcessEnv => childEnv(shellPath());

/** いまログインできているか。claude 自身に聞く（本物を叩かないので速い・無料）。待つのは非同期（窓を固めない） */
export async function authStatus(): Promise<{ loggedIn: boolean; method: string }> {
  const bin = await findClaude();
  if (!bin) return { loggedIn: false, method: "none" };
  const r = await ask(bin, ["auth", "status"], { timeoutMs: 20_000, env: env() });
  try {
    const j = JSON.parse(r.stdout.trim()) as { loggedIn?: boolean; authMethod?: string };
    return { loggedIn: !!j.loggedIn, method: j.authMethod ?? "none" };
  } catch {
    return { loggedIn: false, method: "none" };
  }
}

/** 条件が満たされるまで待つ（待ち続けない） */
async function until<T>(f: () => Promise<T | null>, ms: number, every = 400): Promise<T | null> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await f();
    if (v !== null) return v;
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, every));
  }
}

export function cancelLogin(): void {
  if (!cur) return;
  clearTimeout(cur.timer);
  try {
    cur.p.kill("SIGTERM");
  } catch {
    /* もう終わっている */
  }
  cur = null;
}

/** ログインを始める。ブラウザは claude 自身が開く */
export async function startLogin(): Promise<{ ok: boolean; url?: string; message: string }> {
  const bin = await findClaude();
  if (!bin) return { ok: false, message: "先に「Claude Code を入れる」を押してください" };
  if ((await authStatus()).loggedIn) return { ok: true, message: "もうログインできています" };
  cancelLogin();
  const p = spawn(bin, ["auth", "login", "--claudeai"], { stdio: ["pipe", "pipe", "pipe"], env: env() });
  const a: Attempt = { p, out: "", closed: false, timer: setTimeout(cancelLogin, GIVE_UP_MS) };
  cur = a;
  const add = (c: Buffer): string => (a.out += c.toString());
  p.stdout.on("data", add);
  p.stderr.on("data", add);
  p.on("close", () => (a.closed = true));
  p.on("error", () => (a.closed = true));
  const url = await until(async () => URL_RE.exec(a.out)?.[0] ?? null, WAIT_URL_MS);
  if (!url) {
    cancelLogin();
    return { ok: false, message: "ログインの入口を開けませんでした。もう一度お試しください" };
  }
  return { ok: true, url, message: "ブラウザで承認してください。コードが出たら、下に貼って「決定」を押します" };
}

/** ブラウザに出たコードを渡す。入れたかどうかは claude に聞いて確かめる（渡しただけで合格にしない） */
export async function submitCode(code: string): Promise<{ ok: boolean; message: string }> {
  const c = (code ?? "").trim();
  if (!c) return { ok: false, message: "コードを貼ってください" };
  if (!cur || cur.closed) {
    if ((await authStatus()).loggedIn) return { ok: true, message: "ログインできています" };
    return { ok: false, message: "時間が空きました。もう一度「ログインする」から始めてください" };
  }
  try {
    cur.p.stdin?.write(`${c}\n`);
  } catch {
    return { ok: false, message: "コードを渡せませんでした。もう一度「ログインする」から始めてください" };
  }
  const ok = await until(async () => ((await authStatus()).loggedIn ? true : null), WAIT_LOGIN_MS, 2500);
  cancelLogin();
  if (ok) return { ok: true, message: "ログインできました。これで仕事を渡せます" };
  const tail = cur?.out.trim().split("\n").at(-1)?.slice(0, 120) ?? "";
  return { ok: false, message: `ログインできませんでした${tail ? `（${tail}）` : ""}。コードを貼り直してください` };
}
