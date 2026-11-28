// Claude Code を本人の PC に入れる（D-091）。人にターミナルを触らせない。
// 順番（D-091.2）：①もう実行できるなら何もしない ②入っているのに本体が落ちてきていないなら取り直しだけ
//                  ③どちらも無ければ npm で入れる ④npm も無ければ理由を出して止める（勝手に別のものを入れない）
// ログイン（本人のサブスクに紐づける）は自動にしない。本人がブラウザで 1 回承認する（D-091.3・関門 C8 と同じ線）。
import { spawn, type ChildProcess } from "node:child_process";
import { childEnv, bridgeEnv } from "./env";
import { authStatus } from "./login";
import { ask } from "./proc";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { binDirs, findClaude, forgetClaude, shellPath } from "./runner";

const PKG = "@anthropic-ai/claude-code";

export interface Step {
  /** 人に見せる 1 行。何をしているか・何が起きたか */
  text: string;
  state: "doing" | "done" | "failed";
}
export type OnStep = (s: Step) => void;

/** 実行できるものを探す。GUI から起動したアプリの PATH は最小限なので、本人のシェルに聞いた PATH も見る */
function which(cmd: string): string | null {
  const names = process.platform === "win32" ? [`${cmd}.cmd`, `${cmd}.exe`] : [cmd];
  for (const dir of binDirs()) {
    for (const n of names) {
      const p = join(dir, n);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

/** 版が並ぶ置き場を展開する（nvm・volta・fnm…）。版の名前を決め打たない */
function versioned(root: string, sub: string): string[] {
  try {
    return readdirSync(root).map((v) => join(root, v, sub));
  } catch {
    return [];
  }
}
/** npm 自身に「全体の置き場」を聞く。prefix を自分で変えている人もここで拾える */
async function npmRoot(): Promise<string | null> {
  const npm = which("npm");
  if (!npm) return null;
  const r = await ask(npm, ["root", "-g"], { timeoutMs: 20_000, env: childEnv(shellPath()) });
  const v = r.stdout.trim();
  return v && existsSync(v) ? v : null;
}

/** 使える node のうち、いちばん新しいものを選ぶ。
 *  PATH の先頭に古い node がある人は珍しくない。古い node で npm を動かすと
 *  「npm はこの Node に対応していません」で必ず落ちる。版を実際に聞いて選ぶ */
async function bestNode(): Promise<string | null> {
  let best: { bin: string; major: number } | null = null;
  for (const dir of new Set(binDirs())) {
    const bin = join(dir, process.platform === "win32" ? "node.exe" : "node");
    if (!existsSync(bin)) continue;
    const r = await ask(bin, ["--version"], { timeoutMs: 10_000, env: childEnv(shellPath()) }); // 動かない node は選ばない
    const m = /v(\d+)\./.exec(r.stdout);
    const major = m ? Number(m[1]) : 0;
    if (major && (!best || major > best.major)) best = { bin, major };
  }
  return best?.bin ?? null;
}
/** この Bridge 自身の node で動かす（Electron は自分を node として動かせる）。
 *  PC 側に使える node が無い人でも、取り直しだけはここで完結する */
function ownNode(): { bin: string; env: NodeJS.ProcessEnv } {
  // 取り直しの途中でも外の道具（node・npm・git）を呼ぶので、PATH は本人のシェルのものを渡す
  return { bin: process.execPath, env: childEnv(shellPath(), { ELECTRON_RUN_AS_NODE: "1" }) };
}
/** 失敗した入れ方が残した残骸を片付ける。
 *  これが残っていると npm が ENOTEMPTY で入れ直せない（postinstall が落ちた人は全員ここで詰まる） */
function sweep(root: string, onStep: OnStep): void {
  const scope = join(root, PKG.split("/")[0]!);
  const targets = [
    join(root, PKG),
    ...(() => {
      try {
        return readdirSync(scope)
          .filter((n) => n.startsWith(".claude-code-"))
          .map((n) => join(scope, n));
      } catch {
        return [];
      }
    })(),
  ];
  for (const t of targets) {
    if (!existsSync(t)) continue;
    try {
      rmSync(t, { recursive: true, force: true });
      onStep({ text: "前の入れかけを片付けました", state: "doing" });
    } catch {
      /* 消せなくても、この後の入れ直しで上書きできることがある */
    }
  }
}

/** 入ってはいるが本体（native binary）が落ちてきていない置き場を探す。取り直しだけで直る。
 *  postinstall が動かない入れ方（--ignore-scripts・一部の pnpm・--omit=optional）で誰にでも起きる */
export async function brokenInstall(): Promise<string | null> {
  const h = homedir();
  const roots = [
    await npmRoot(),
    "/opt/homebrew/lib/node_modules",
    "/usr/local/lib/node_modules",
    join(bridgeEnv("APPDATA") ?? "", "npm", "node_modules"),
    join(h, ".npm-global", "lib", "node_modules"),
    join(h, "Library", "pnpm", "global", "5", "node_modules"),
    join(h, ".bun", "install", "global", "node_modules"),
    ...versioned(join(h, ".nvm", "versions", "node"), join("lib", "node_modules")),
    ...versioned(join(h, ".volta", "tools", "image", "node"), join("lib", "node_modules")),
    ...versioned(join(h, ".fnm", "node-versions"), join("installation", "lib", "node_modules")),
  ].filter((x): x is string => !!x);
  for (const r of roots) {
    const cjs = join(r, PKG, "install.cjs");
    if (existsSync(cjs)) return cjs;
  }
  return null;
}

/** 自己診断の 1 行（Bridge の窓・この PC の口・生きている知らせが同じ形で運ぶ） */
export interface Check {
  name: string;
  ok: boolean;
  detail: string;
  /** 直し方（人に見せるボタンの言葉が変わる）。install＝入れる／repair＝取り直す／login＝ログインする */
  fix?: "install" | "repair" | "login" | null;
  /** エラーの ID（repair は E-CONN-011・login は E-CONN-010）。install はエラーではなく状態なので付けない */
  code?: string;
}
export interface ClaudeCheckDeps {
  find?: () => Promise<string | null>;
  broken?: () => Promise<string | null>;
  auth?: () => Promise<{ loggedIn: boolean }>;
}

/** 「無い」と「入っているが壊れている」は直し方が違う。人に同じ文言を見せない。
 *  実例：npm の claude が 500 バイトのエラー用の紙だけ残り、本体が落ちてきていない（取り直しで直る） */
function hasClaude(claude: string | null, broken: string | null): Check {
  const name = "本人のサブスクの Claude Code がある";
  if (claude) return { name, ok: true, detail: claude, fix: null };
  if (broken)
    return {
      name,
      ok: false,
      detail: `入ってはいますが、本体が落ちてきていません（${dirname(broken)}）。下の「Claude Code を取り直す」で直ります`,
      fix: "repair",
      code: "E-CONN-011",
    };
  return {
    name,
    ok: false,
    detail:
      "この PC にありません。下の「Claude Code を入れる」で入れられます（置き場が違うなら KANAME_CLAUDE_BIN で指せます）",
    fix: "install",
  };
}
/** ログインできているか。claude 自身に聞くので速く、本人のサブスクを消費しない。
 *  聞いた答えが「入れている」のときだけ合格（JSON でない・落ちた・何も返さないは、できたことにしない） */
async function loggedIn(claude: string | null, auth: () => Promise<{ loggedIn: boolean }>): Promise<Check> {
  const name = "Claude Code にログインできている";
  if (!claude) return { name, ok: false, detail: "先に Claude Code を入れてください", fix: "install" };
  if ((await auth()).loggedIn) return { name, ok: true, detail: "できています", fix: null };
  return {
    name,
    ok: false,
    detail: "まだログインしていません。下の「ログインする」を押してください（ターミナルは開きません）",
    fix: "login",
    code: "E-CONN-010",
  };
}
/** 自己診断の Claude Code の 2 行（ある・ログインできている）。electron を読まないので、窓の外（試験）からも呼べる */
export async function claudeChecks(d: ClaudeCheckDeps = {}): Promise<Check[]> {
  const claude = await (d.find ?? findClaude)();
  const broken = claude ? null : await (d.broken ?? brokenInstall)();
  return [hasClaude(claude, broken), await loggedIn(claude, d.auth ?? authStatus)];
}

export interface RunOut {
  ok: boolean;
  out: string;
}
/** 走らせた物。done は結末、stop は途中で止める（時間切れのとき） */
export interface Running {
  done: Promise<RunOut>;
  stop: () => void;
}
function run(bin: string, args: string[], onStep: OnStep, env?: NodeJS.ProcessEnv): Running {
  const held: { child?: ChildProcess } = {};
  const done = new Promise<RunOut>((resolve) => {
    let out = "";
    const push = (c: Buffer) => {
      out += c.toString();
      const last = out.trim().split("\n").at(-1) ?? "";
      if (last) onStep({ text: last.slice(0, 120), state: "doing" });
    };
    try {
      const p = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], env: env ?? childEnv(shellPath()) });
      held.child = p;
      p.stdout.on("data", push);
      p.stderr.on("data", push);
      p.on("error", (e) => resolve({ ok: false, out: `${out}\n${e.message}` }));
      p.on("close", (code) => resolve({ ok: code === 0, out }));
    } catch (e) {
      resolve({ ok: false, out: e instanceof Error ? e.message : "起動できませんでした" });
    }
  });
  return { done, stop: () => void held.child?.kill("SIGTERM") };
}

export interface InstallResult {
  ok: boolean;
  message: string;
}
/** 入れる作業の差し込み口（どれも省ける。省くと本物）。timeoutMs は取り直しと npm のそれぞれを待つ上限 */
export interface InstallDeps {
  find?: () => Promise<string | null>;
  forget?: () => void;
  broken?: () => Promise<string | null>;
  npm?: () => string | null;
  run?: (bin: string, args: string[], onStep: OnStep, env?: NodeJS.ProcessEnv) => Running;
  timeoutMs?: number;
}
/** 入れる作業を待つ上限（取り直し・npm のそれぞれ）。返らない npm を待ち続けない */
const INSTALL_TIMEOUT_MS = 10 * 60_000;
/** この PC の口で画面に流す途中の行の上限（新しい方を残す） */
const PROGRESS_MAX = 50;
const INSTALLED: InstallResult = { ok: true, message: "入りました。次に「ログインする」を押してください" };
const TIMED_OUT: InstallResult = { ok: false, message: "時間がかかりすぎたので止めました。もう一度押してください" };

let progress: { running: boolean; steps: Step[] } = { running: false, steps: [] };
/** いまの（終わっていれば最後の）入れる作業の途中の行。この PC の口 GET /install-progress が画面に流す */
export function installProgress(): { running: boolean; steps: Step[] } {
  return { running: progress.running, steps: [...progress.steps] };
}

/** 走っている入れる作業（2 つ重ねない。押し重ねたら走っている方の結末を返す） */
let current: Promise<InstallResult> | null = null;

/** 入れる。押すのはこれ 1 回（D-091.1）。結末はそのまま人に見せる文で返す。
 *  窓とこの PC の画面の両方から押されても、入れる作業は 1 つ（走っている方の結末を両方に返す） */
export function installClaude(onStep: OnStep = () => {}, d: InstallDeps = {}): Promise<InstallResult> {
  current ??= (async () => {
    progress = { running: true, steps: [] };
    let live = true;
    const step: OnStep = (s) => {
      if (!live) return; // 止めきれなかった前の作業が後から出した行を、次の作業の行に混ぜない
      progress = { running: true, steps: [...progress.steps, s].slice(-PROGRESS_MAX) };
      onStep(s);
    };
    try {
      return await install(step, d);
    } finally {
      live = false;
      progress = { running: false, steps: progress.steps };
      current = null;
    }
  })();
  return current;
}

/** 走らせた物を上限まで待つ。上限を過ぎたら止めて null（止められなくても待ち続けない） */
async function within(r: Running, ms: number): Promise<RunOut | null> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    const out = await Promise.race([r.done, late]);
    if (out) return out;
  } finally {
    clearTimeout(timer);
  }
  try {
    r.stop();
  } catch (e) {
    // 止められなくても同じ答えを返す（次に押せば新しく走る）。npm の出力は出さない
    console.error("[bridge] 入れる作業を止められませんでした", e instanceof Error ? e.message : "");
  }
  return null;
}

async function install(onStep: OnStep, d: InstallDeps): Promise<InstallResult> {
  const find = d.find ?? findClaude;
  const forget = d.forget ?? forgetClaude;
  const start = d.run ?? run;
  const timeoutMs = d.timeoutMs ?? INSTALL_TIMEOUT_MS;
  const timedOut = (): InstallResult => {
    onStep({ text: "時間がかかりすぎたので止めました", state: "failed" });
    return TIMED_OUT;
  };
  const installed = (): InstallResult => {
    onStep({ text: "入りました", state: "done" });
    return INSTALLED;
  };
  if (await find()) return { ok: true, message: "もう入っています（この PC で動かせます）" };

  const cjs = await (d.broken ?? brokenInstall)();
  if (cjs) {
    onStep({ text: "入ってはいますが、本体が落ちてきていません。取り直します", state: "doing" });
    const own = ownNode();
    const r = await within(start(own.bin, [cjs], onStep, own.env), timeoutMs); // 版の分かっている node で動かす
    if (!r) return timedOut();
    forget();
    if (await find()) return installed();
    // 取り直しが失敗した・取り直しても動かない：npm で入れ直す（下へ進む）
  }

  const npm = (d.npm ?? (() => which("npm")))();
  if (!npm)
    return {
      ok: false,
      message: "この PC に Node.js（npm）がありません。入れ方をお知らせしますので、お問い合わせください",
    };
  if (cjs) sweep(dirname(dirname(dirname(cjs))), onStep); // node_modules まで上がる。残骸があると ENOTEMPTY で入れ直せない
  const node = await bestNode();
  onStep({ text: "Claude Code を入れています（1〜2 分）", state: "doing" });
  // npm は自分を動かしている node の版を見る。古い node に当たらないよう、選んだ node を先頭に置く
  const env = childEnv(
    node ? `${dirname(node)}${process.platform === "win32" ? ";" : ":"}${shellPath()}` : shellPath(),
  );
  // --include=optional：本体は optional dependency。省く設定を持っている人はここで落ちる（今回の故障の原因）
  const r = await within(start(npm, ["install", "-g", "--include=optional", PKG], onStep, env), timeoutMs);
  if (!r) return timedOut();
  forget();
  // npm が成功と言っても、動く claude が見つかるまで「入った」と言わない（在るだけで合格にしない）
  if (await find()) return installed();
  const tail = r.out.trim().split("\n").at(-1)?.slice(0, 160) ?? "";
  onStep({ text: "入れられませんでした", state: "failed" });
  return { ok: false, message: `入れられませんでした（${tail}）` };
}
