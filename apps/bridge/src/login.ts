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
const ASK_LOGIN_EVERY_MS = 2_500;
/** 待つ長さの差し込み口（どれも省ける。省くと上の既定）。中身の順は変えない */
export interface StartLoginOpts {
  /** 入口の URL が出るのを待つ上限 */
  waitUrlMs?: number;
  /** ログインを始めてから、コードを待つのをやめるまで */
  giveUpMs?: number;
}
export interface SubmitCodeOpts {
  /** コードを渡してから、claude が「入れている」と言うのを待つ上限 */
  waitLoginMs?: number;
  /** claude に聞き直す間 */
  everyMs?: number;
}

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
    return { loggedIn: j.loggedIn === true, method: j.authMethod ?? "none" }; // はっきり true のときだけ（ほかの形は、できたことにしない）
  } catch {
    return { loggedIn: false, method: "none" };
  }
}

/** 条件が満たされるまで待つ（待ち続けない）。gone が真になったら、もう満たされないので待つのをやめる */
async function until<T>(f: () => Promise<T | null>, ms: number, every = 400, gone?: () => boolean): Promise<T | null> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await f();
    if (v !== null) return v;
    if (gone?.() || Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, every));
  }
}

/** 1 回分のログインを止める。子がもう自分で終わっていても投げない。止めるのは渡された回だけ（後から始めた回を巻き込まない） */
function stop(a: Attempt): void {
  clearTimeout(a.timer);
  try {
    a.p.kill("SIGTERM");
  } catch {
    /* もう終わっている */
  }
  if (cur === a) cur = null;
}
export function cancelLogin(): void {
  if (cur) stop(cur);
}

/** ログインを始める。ブラウザは claude 自身が開く */
export async function startLogin(o: StartLoginOpts = {}): Promise<{ ok: boolean; url?: string; message: string }> {
  const bin = await findClaude();
  if (!bin) return { ok: false, message: "先に「Claude Code を入れる」を押してください" };
  if ((await authStatus()).loggedIn) return { ok: true, message: "もうログインできています" };
  cancelLogin();
  const p = spawn(bin, ["auth", "login", "--claudeai"], { stdio: ["pipe", "pipe", "pipe"], env: env() });
  const a: Attempt = { p, out: "", closed: false, timer: setTimeout(() => stop(a), o.giveUpMs ?? GIVE_UP_MS) };
  cur = a;
  const add = (c: Buffer): string => (a.out += c.toString());
  p.stdout.on("data", add);
  p.stderr.on("data", add);
  p.on("close", () => (a.closed = true));
  p.on("error", () => (a.closed = true));
  p.stdin.on("error", () => undefined); // 子が先に終わった後に書いても、Bridge ごと落ちない（結末は auth status に聞いて決める）
  // 入口の URL が出たら返す。出る前に子が終わった・止められたなら、上限まで待たずに「開けませんでした」
  const url = await until(
    async () => URL_RE.exec(a.out)?.[0] ?? null,
    o.waitUrlMs ?? WAIT_URL_MS,
    400,
    () => a.closed || cur !== a,
  );
  if (!url) {
    stop(a);
    return { ok: false, message: "ログインの入口を開けませんでした。もう一度お試しください" };
  }
  return { ok: true, url, message: "ブラウザで承認してください。コードが出たら、下に貼って「決定」を押します" };
}

/** ブラウザに出たコードを渡す。入れたかどうかは claude に聞いて確かめる（渡しただけで合格にしない） */
export async function submitCode(code: string, o: SubmitCodeOpts = {}): Promise<{ ok: boolean; message: string }> {
  const c = (code ?? "").trim();
  if (!c) return { ok: false, message: "コードを貼ってください" };
  const a = cur;
  if (!a || a.closed) {
    if ((await authStatus()).loggedIn) return { ok: true, message: "ログインできています" };
    return { ok: false, message: "時間が空きました。もう一度「ログインする」から始めてください" };
  }
  try {
    a.p.stdin?.write(`${c}\n`);
  } catch {
    return { ok: false, message: "コードを渡せませんでした。もう一度「ログインする」から始めてください" };
  }
  // ログインが確定するのは、claude 自身が「入れている」と答えたときだけ（子が黙って終わっても、できたことにしない）
  const ok = await until(
    async () => ((await authStatus()).loggedIn ? true : null),
    o.waitLoginMs ?? WAIT_LOGIN_MS,
    o.everyMs ?? ASK_LOGIN_EVERY_MS,
  );
  stop(a);
  if (ok) return { ok: true, message: "ログインできました。これで仕事を渡せます" };
  return { ok: false, message: "ログインできませんでした。コードを貼り直してください" };
}
