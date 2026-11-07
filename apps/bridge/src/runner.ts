// 受け取って返す（T-B-03・D-090）。Bridge の中核。
//   1 Kaname から仕事を 1 件もらう → 2 本人の Claude Code を --resume で呼ぶ → 3 結末を返す
// 文脈（会話の続き）は Claude Code が持つ。Kaname は session の id を覚えているだけ（二重に持たない）。
// 止まったら自動で再開しない。「止まりました」と理由を返し、人が 続きから／やり直す／やめる を選ぶまでそのまま。
import { spawn } from "node:child_process";
import { childEnv, bridgeEnv } from "./env";
import { ask } from "./proc";
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CONVENTIONS, memoryPrompt, type JobMemory } from "./conventions";
import { guardArgs, guardEnv, type Blocked } from "./guard";
import { KANAME_TOOL_RULE, kanameServer, mcpArgs, type KanameTools } from "./kaname-tools";
import { DEDICATED_SERVER, DEDICATED_TOOL_RULE, dedicatedServer, type DedicatedBrowser } from "./browser";
import { modeArgs, optionArgs } from "./modes";
import { controlResponse, label, parseLine, splitLines, userMessage, type Entry, type Ev, type Usage } from "./stream";

const WIN = process.platform === "win32";
const SEP = WIN ? ";" : ":";
const EXE = WIN ? "claude.cmd" : "claude";

let pathCache: string | null = null;
/** 本人のシェルに PATH を聞く。
 *  GUI（Finder・Dock・ログイン時の自動起動）から立ち上がったアプリの PATH は /usr/bin:/bin… だけなので、
 *  nvm・volta・fnm・asdf・mise・独自の prefix に入れた人の claude が **全員** 見えなくなる。
 *  置き場を列挙して追いかけるのではなく、本人の環境そのものに聞く（列挙は必ず漏れる）。
 *  ★聞くのは必ず非同期。同期で聞くと、返事が来ない環境で **起動そのものが止まる**
 *    （実際、Finder から起動したときだけ 38617 が開かなくなった）。 */
export function shellPath(): string {
  return pathCache ?? bridgeEnv("PATH") ?? "";
}
/** 起動直後に 1 回だけ、本人のシェルに PATH を聞いておく。待たない・止まらない */
export function warmShellPath(): Promise<void> {
  if (WIN || pathCache !== null) {
    pathCache ??= bridgeEnv("PATH") ?? "";
    return Promise.resolve();
  }
  return new Promise((done) => {
    const finish = (v: string | null): void => {
      pathCache = v ? `${v}${SEP}${bridgeEnv("PATH") ?? ""}` : (bridgeEnv("PATH") ?? "");
      done();
    };
    try {
      const sh = bridgeEnv("SHELL") || "/bin/zsh";
      // -l（ログイン）だけにする。-i（対話）を付けると、端末が無いときに返事をせず居座ることがある
      const p = spawn(sh, ["-lc", 'printf "\n<<%s>>" "$PATH"'], { stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      p.stdout.on("data", (c: Buffer) => (out += c.toString()));
      const t = setTimeout(() => p.kill("SIGKILL"), 5000); // 返事が無くても必ず終わらせる
      p.on("close", () => {
        clearTimeout(t);
        const m = /<<(.+)>>/.exec(out);
        finish(m?.[1]?.includes("/") ? m[1] : null);
      });
      p.on("error", () => {
        clearTimeout(t);
        finish(null);
      });
    } catch {
      finish(null);
    }
  });
}

/** 版が並ぶ置き場（nvm・volta・fnm・mise…）を展開する。版の名前を決め打たない */
function versioned(root: string, sub: string): string[] {
  try {
    return readdirSync(root).map((v) => join(root, v, sub));
  } catch {
    return [];
  }
}
/** claude が居そうな入れ物（bin フォルダ）。PATH で足りない人のための保険 */
export function binDirs(): string[] {
  const h = homedir();
  return [
    ...shellPath().split(SEP).filter(Boolean),
    join(h, ".claude", "local"),
    join(h, ".local", "bin"),
    join(h, ".bun", "bin"),
    join(h, ".volta", "bin"),
    join(h, ".npm-global", "bin"),
    join(h, "Library", "pnpm"),
    join(h, "AppData", "Roaming", "npm"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    ...versioned(join(h, ".nvm", "versions", "node"), "bin"),
    ...versioned(join(h, ".fnm", "node-versions"), join("installation", "bin")),
    ...versioned(join(h, ".local", "share", "mise", "installs", "node"), "bin"),
    ...versioned(join(h, ".asdf", "installs", "nodejs"), "bin"),
  ];
}

let claudeCache: string | null | undefined;
/** 入れ直した後に呼ぶ。次の問い合わせで確かめ直す */
export function forgetClaude(): void {
  claudeCache = undefined;
  pathCache = null;
}
/** 本人の Claude Code の場所。**在るかではなく、動くかで決める**。
 *  在るだけで合格にすると、本体が落ちてきていない雛形（"native binary not installed" と出すだけの数百バイトの紙）を
 *  掴んで、仕事を渡した時に初めて落ちる。ここで 1 回動かして確かめる（L-003 描画は動作ではない） */
export async function findClaude(): Promise<string | null> {
  if (claudeCache !== undefined) return claudeCache;
  finding ??= (async () => {
    const fixed = bridgeEnv("KANAME_CLAUDE_BIN"); // 置き場が違う人・配布時に差すため
    const cands = fixed ? [fixed] : [...new Set(binDirs().map((d) => join(d, EXE)))];
    let hit: string | null = null;
    for (const c of cands) {
      if (await works(c)) {
        hit = c;
        break;
      }
    }
    claudeCache = hit;
    finding = null;
    return hit;
  })();
  return finding;
}
let finding: Promise<string | null> | null = null;
/** 実際に動かして確かめる。--version が返れば本物。待つのは非同期（窓を固めない） */
export async function works(p: string): Promise<boolean> {
  try {
    if (!existsSync(p) || !statSync(p).isFile()) return false;
  } catch {
    return false;
  }
  const r = await ask(p, ["--version"], { timeoutMs: 20_000, env: childEnv(shellPath()) });
  return r.code === 0 && /\d+\.\d+/.test(r.stdout);
}

export interface Job {
  job_id: string;
  prompt: string;
  agent_session_id: string | null;
  conversation_id: string | null;
  /** 許可のモード・モデル・考える強さ・使うもの・いつも許可のルール（D-104.10・D-104.13・D-104.14） */
  permission_mode?: string | null;
  model?: string | null;
  effort?: string | null;
  tools?: string[] | null;
  allowed_tools?: string[] | null;
  /** 付けた資料（D-104.11）。中身は Bridge が署名 URL で取りに行く */
  attachments?: { id: string; name: string; mime: string; size: number }[] | null;
  /** 効かせる記憶（D-105.8）。強い順に並んでいる */
  memories?: JobMemory[] | null;
  /** 台帳で禁止・銀行のドメイン（D-107.1）。全部許可でも PC の上で止める */
  blocked?: Blocked[] | null;
  /** Kaname の道具の鍵（D-110.3）。会話の仕事にだけ付く。その仕事の間だけ効く */
  tool_token?: string | null;
  /** 会話の決まり（Kaname が仕事ごとに渡す正本）。無ければ Bridge の控え（CONVENTIONS） */
  conventions?: string | null;
  /** AI が使うブラウザ（D-119）：chrome＝本人の Chrome（Claude in Chrome）／off＝使わない。無ければ使わない（古い Kaname） */
  browser?: "chrome" | "dedicated" | "off" | null;
  /** 仕事の種類（D-117.1）：login_check＝預けたログイン情報で 1 回だけ入ってみる（AI は起こさない）。無ければ会話 */
  kind?: "chat" | "login_check" | "ticket" | null;
  /** チケットの仕事（K-62）：任されたチケットと段（make＝成果物を作る・execute＝承認の後の実行） */
  ticket_id?: string | null;
  phase?: "make" | "execute" | null;
  credential_id?: string | null;
}

/** Claude in Chrome の道具（聞かずに使える。開く先は禁止の宛先の見張りが止める・D-107・D-119） */
export const CHROME_TOOL_RULE = "mcp__claude-in-chrome";
/** 最後に分かった Chrome とのつながり（D-119）。自己診断に出す。まだ Chrome を使う仕事が無ければ null */
let chromeSeen: { status: string; at: number } | null = null;
export const chromeState = (): { status: string; at: number } | null => chromeSeen;
/** 試験用：分かったつながりを忘れる */
export const forgetChromeState = (): void => {
  chromeSeen = null;
};
/** 禁止の宛先を止めるフックの置き場と、止めた記録を書き残す場所（D-107.3） */
export interface Guard {
  hookPath: string;
  log: string;
  nodeBin: string;
}
export type Finish = (
  | { state: "done"; result: string; agent_session_id: string | null }
  | { state: "stopped"; reason: string; agent_session_id: string | null }
) & { usage?: Usage | null };
/** 道具の呼び出し 1 回の記録（D-100.2）。中身は持たない */
export interface ToolRecord {
  name: string;
  target: string;
  ok: boolean;
  ms: number | null;
}
/** 確認への本人の答え（D-104.14）：許すか・一言（許さない理由として Claude に渡す）・問い合わせの答え */
export interface Answer {
  allow: boolean;
  note?: string | null;
  answers?: Record<string, string> | null;
}

/** 動かしている間に Kaname へ返すもの（D-093.3・D-093.7・D-104.8）。無ければ黙って動く */
export interface RunHooks {
  /** init（会話の id が取れた）／progress（何をしているか・手順）／limit（使用量）を届ける。届かなくても動かし続ける */
  onEvent?: (e: Ev) => void;
  /** 書きながら出る返事の、いまの全文（D-104.8）。間引くのは受け取る側 */
  onPartial?: (text: string) => void;
  /** 止めずに直した（steer）ときの、区切りごとの答え（D-104.9）。最後の答えは結末で返す */
  onReply?: (text: string) => void;
  /** 自分のAI の文が 1 つ出た（記録と同じ id・D-112）。写す */
  onEntry?: (e: Entry) => void;
  /** いま何をしているかが切り替わった（考えている・道具を準備している・返事を書き始めた） */
  onPhase?: (phase: "thinking" | "tool" | "writing", tool?: string) => void;
  /** 道具が 1 回終わった（名前・対象・成否・時間。D-100.2） */
  onTool?: (t: ToolRecord) => void;
  /** ブラウザとつながっていない（起動時に分かった・道具が失敗した）。どちらのブラウザか。1 つの仕事で 1 回だけ（D-119） */
  onBrowserOff?: (which: "chrome" | "dedicated") => void;
  /** 区切り（1 回の答え）ごとに、順番待ちの一言を取りに行く（D-104.9）。あれば続けて渡し、仕事は終わらない。
   *  その区切りの答え（reply）も一緒に渡す：一言があるときは Kaname が答え→一言の順に吹き出しにする */
  takeSteers?: (reply: string) => Promise<string[]>;
  /** CLI が「これを実行していいか」「どれにするか」と聞いた。本人の答えが返るまで待つ。無ければ許可しない */
  ask?: (q: { requestId: string; tool: string; input: unknown; summary: string }) => Promise<Answer>;
  /** 会話に 1 行残す知らせ（記録が無く新しいセッションで続けた・D-124.3）。仕事は続く */
  onNotice?: (text: string) => void;
}

/** 記録が無いときに、新しいセッションで続けたことの知らせ（D-124.3） */ // E-NF-003
export const RESUME_LOST_NOTICE =
  "前の会話の記録がこの PC に無かったので、新しい会話として続けます。これまでの内容は Kaname の写しに残っています";

/** 記録が無い --resume（本物の claude 2.1.283 で 2026-10-20 に実測）：stderr に「No conversation found with session ID」、
 *  または API を 1 度も呼ばずに（duration_api_ms 0・num_turns 0）本文なしで error_during_execution。上限（rate limit）は API を呼んでいるので当たらない */
export function isResumeLost(raw: Record<string, unknown>, err: string, text: string): boolean {
  if (/No conversation found with session ID/i.test(err)) return true;
  return (
    raw["subtype"] === "error_during_execution" &&
    raw["num_turns"] === 0 &&
    raw["duration_api_ms"] === 0 &&
    !text.trim()
  );
}

/** 止めたとき道具が動いている最中なら、その結末は分からないと添える（D-124.2）。文を書いている最中なら添えない */ // E-SIG-003
export function inflightNote(started: Map<string, { name: string; target: string; at: number }>): string {
  const s = [...started.values()].sort((a, b) => a.at - b.at).at(-1);
  if (!s) return "";
  return `。「${s.target || label(s.name)}」は途中だったので、その結末は分かりません。先方の画面で確かめてください`;
}

/** 1 回の起動の結末。resumeLost は「記録が無かった」の内部の印（外には出さない） */
type Outcome = Finish & { resumeLost?: boolean };

/** いま動いている 1 件。人が「止める」を押したら殺す／「止めずに直す」なら次の区切りで伝える（D-104.9） */
let current: { kill: (reason?: string) => void; steer: (text: string) => boolean } | null = null;
/** 完了の合図（result）を出さずに・中身なしで終わったときの理由（E-SIG-002） */
export const NO_SIGNAL_REASON = "Claude Code が何も返さずに終わりました";
export const stopCurrent = (reason?: string): void => current?.kill(reason);
/** 動いている仕事に、止めずに方向を直す一言を渡す。渡せなかった（もう終わっていた）ら false */
export const steerCurrent = (text: string): boolean => current?.steer(text) ?? false;
export const isRunning = (): boolean => current !== null;

/** 使った量を足し合わせる（止めずに直すと result が複数回来る） */
function addUsage(a: Usage | null, b: Usage | null): Usage | null {
  if (!a) return b;
  if (!b) return a;
  const s = (x: number | null, y: number | null): number | null =>
    x === null && y === null ? null : (x ?? 0) + (y ?? 0);
  return {
    turns: s(a.turns, b.turns),
    duration_ms: s(a.duration_ms, b.duration_ms),
    api_ms: s(a.api_ms, b.api_ms),
    input_tokens: s(a.input_tokens, b.input_tokens),
    output_tokens: s(a.output_tokens, b.output_tokens),
    cache_read_tokens: s(a.cache_read_tokens, b.cache_read_tokens),
    cache_write_tokens: s(a.cache_write_tokens, b.cache_write_tokens),
    cost_usd: s(a.cost_usd, b.cost_usd),
  };
}

/** 起動の引数。未改変の公式 CLI に、本人が選んだものだけを渡す（D-092.2・D-104） */
export function buildArgs(
  job: Job,
  extraDirs: string[] = [],
  guard?: Guard | null,
  tools?: KanameTools | null,
  dedicated?: DedicatedBrowser | null,
): string[] {
  const args = [
    "-p",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--permission-prompt-tool",
    "stdio",
  ];
  if (job.agent_session_id) args.push("--resume", job.agent_session_id);
  args.push(...modeArgs(job.permission_mode));
  // 本人の Chrome を使う（Claude in Chrome・D-119）。可変長の引数より前に置く
  const chrome = job.browser === "chrome";
  if (chrome) args.push("--chrome");
  // Kaname の道具（D-110）と Bridge 専用のブラウザ（D-119）を 1 本の設定で渡す。
  // --mcp-config は可変長なので、すぐ後ろに別の引数（--append-system-prompt 等）が来る位置に置く
  const kaname = kanameServer(tools, job.tool_token, job.kind ?? "chat");
  const own = job.browser === "dedicated" && dedicated ? dedicatedServer(dedicated) : null;
  args.push(...mcpArgs({ kaname, [DEDICATED_SERVER]: own }));
  // 会話の仕事にだけ Kaname の書き方を渡す（記憶のまとめなど会話の無い仕事は、渡した文の指示だけで動く）
  if (job.conversation_id) {
    const mem = memoryPrompt(job.memories ?? []);
    const rules = job.conventions?.trim() ? job.conventions : CONVENTIONS;
    args.push("--append-system-prompt", mem ? `${rules}\n\n${mem}` : rules);
  }
  for (const d of extraDirs) args.push("--add-dir", d);
  // 禁止の宛先（D-107.2・D-107.3）：使わない道具（可変長）の後ろには必ず --settings を置く
  if (guard && job.blocked?.length) args.push(...guardArgs(job.blocked, guard.hookPath, guard.nodeBin));
  // 可変長の引数（--allowedTools）は最後に置く（後ろの引数を飲み込ませない）
  // Kaname の道具は聞かずに使える（本人の会社のたたき台に書くだけ・外に出ない・D-110.4）
  const extra = [
    ...(kaname ? [KANAME_TOOL_RULE] : []),
    ...(chrome ? [CHROME_TOOL_RULE] : []),
    ...(own ? [DEDICATED_TOOL_RULE] : []),
  ];
  const allowed = extra.length ? [...(job.allowed_tools ?? []), ...extra] : (job.allowed_tools ?? null);
  args.push(...optionArgs({ model: job.model ?? null, effort: job.effort ?? null, allowed_tools: allowed }));
  return args;
}

/**
 * 本人の Claude Code を 1 回呼ぶ。常駐させない（落ちても次の 1 件から続く）。
 * 1 行 1 イベント（stream-json）で受ける（D-093）：
 *   init で会話の id を先に取る（途中で落ちても「続きから」が押せる）／assistant を途中経過として流す／
 *   書きながらの返事（stream_event）を全文で流す／control_request（確認・問い合わせ）は本人に聞いて答えを返す／
 *   result の is_error で成否を決める（終了コード 0 を成功にしない）。
 * 止めずに直した一言は入力にそのまま書き足す。CLI は次の区切りでそれを読み、もう 1 回 result を返す（2026-09-27 実測）。
 * 端末（tty）は使わない。入力は開いたまま（確認の答え・追加の指示を渡すため）。
 */
/** timeoutMs は「CLI から何も出てこない時間」の上限（本人の答えを待つ間は数えない） */
export async function runClaude(
  job: Job,
  hooks: RunHooks = {},
  timeoutMs = 10 * 60_000,
  extraDirs: string[] = [],
  guard?: Guard | null,
  tools?: KanameTools | null,
  dedicated?: DedicatedBrowser | null,
): Promise<Finish> {
  const bin = await findClaude();
  if (!bin) {
    current = null;
    return {
      state: "stopped",
      reason: "このPCに Claude Code が見つかりません。入れてログインしてください",
      agent_session_id: job.agent_session_id,
    };
  }
  const strip = (o: Outcome): Finish => {
    const f: Outcome = { ...o };
    delete f.resumeLost; // 内部の印は外に出さない
    return f;
  };
  const first = await runOnce(bin, job, hooks, timeoutMs, extraDirs, guard, tools, dedicated);
  if (!first.resumeLost) return strip(first);
  // 記録が無い（D-124.3）：同じ仕事を --resume 無しで 1 回だけやり直し、会話に 1 行知らせる。新しい id は init で Kaname に入る。
  // やり直しても失敗なら、いままでどおり理由を出して止める（やり直しは 1 回だけ）
  hooks.onNotice?.(RESUME_LOST_NOTICE);
  return strip(
    await runOnce(bin, { ...job, agent_session_id: null }, hooks, timeoutMs, extraDirs, guard, tools, dedicated),
  );
}

function runOnce(
  bin: string,
  job: Job,
  hooks: RunHooks,
  timeoutMs: number,
  extraDirs: string[],
  guard?: Guard | null,
  tools?: KanameTools | null,
  dedicated?: DedicatedBrowser | null,
): Promise<Outcome> {
  return new Promise((resolve) => {
    // 承認の仕組みを弱める引数は、本人が選んだモードの対応表（modes.ts）からしか来ない（claude-terms.mjs が検査）
    const args = buildArgs(job, extraDirs, guard, tools, dedicated);
    // 本人のシェルの PATH で動かす。GUI（ログイン時の自動起動・Dock）から立ち上がった
    // アプリの PATH は /usr/bin:/bin… だけなので、claude が動かすもの（フック・MCP・git・node・python）が
    // 軒並み「見つかりません」で落ちる。実例：SessionEnd hook で `/bin/sh: node: command not found`
    // 環境は許可リストだけ（ANTHROPIC_API_KEY 等を渡すとサブスクではなく API の料金で動きうる）
    const env = childEnv(shellPath(), guard && job.blocked?.length ? guardEnv(job.blocked, guard.log) : {});
    const p = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"], env });
    let session: string | null = job.agent_session_id;
    const started = new Map<string, { name: string; target: string; at: number }>(); // 道具の呼び出し中（id → 始めた時刻）
    let err = "";
    let rest = "";
    let settled = false;
    let asking: Promise<void> = Promise.resolve();
    let expected = 1; // 返ってくるはずの result の数（止めずに直すたびに 1 つ増える）
    let received = 0;
    let usage: Usage | null = null;
    let partial = "";
    let limits: { window: string; utilization: number; resets_at: number }[] = [];
    const done = (f: Outcome): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      current = null;
      try {
        p.stdin.end();
      } catch {
        /* もう閉じている */
      }
      resolve({ ...f, usage: addUsage(usage, f.usage ?? null) });
    };
    // 止める目安は「何も進まない時間」。本人の答えを待っている間は数えない（待っている間に止めると、
    // 答えようとした問い合わせごと消える・2026-09-28 実例）。答えを待つ長さは loop が別に持つ（ANSWER_WAIT_MS）
    let timer: ReturnType<typeof setTimeout> | undefined;
    let waitingHuman = 0;
    const arm = (): void => {
      clearTimeout(timer);
      if (settled || waitingHuman > 0) return;
      timer = setTimeout(() => {
        p.kill("SIGTERM");
        done({
          state: "stopped",
          reason: `${Math.round(timeoutMs / 60_000)} 分のあいだ何も進まなかったので止めました${inflightNote(started)}`,
          agent_session_id: session,
        });
      }, timeoutMs);
    };
    arm();
    current = {
      kill: (reason) => {
        p.kill("SIGTERM");
        done({
          state: "stopped",
          reason: `${reason ?? "あなたが止めました"}${inflightNote(started)}`,
          agent_session_id: session,
        });
      },
      steer: (text) => {
        if (settled || !text.trim()) return false;
        expected += 1;
        p.stdin.write(userMessage(text));
        return true;
      },
    };
    let offSaid = false;
    const browserOff = (which: "chrome" | "dedicated"): void => {
      if (offSaid) return;
      offSaid = true;
      hooks.onBrowserOff?.(which);
    };
    // 専用のブラウザを選んだのに、この PC に用意できなかった（台本が無い）。起動する前に分かる
    if (job.browser === "dedicated" && !dedicated) browserOff("dedicated");
    const handle = (e: Ev): void => {
      if (e.type === "init") {
        session = e.session;
        // Chrome を使う仕事なら、つながりを覚える（自己診断に出す）。つながっていなければ知らせる（黙って終わらない・D-119）
        if (job.browser === "chrome") {
          chromeSeen = { status: e.chrome ?? "absent", at: Date.now() };
          if (e.chrome !== "connected") browserOff("chrome");
        }
        if (job.browser === "dedicated" && dedicated && e.dedicated !== "connected") browserOff("dedicated");
        hooks.onEvent?.(e);
      } else if (e.type === "message_start") {
        partial = ""; // 返事の 1 通ごとに書き直す（道具を使った後の返事は別の 1 通）
      } else if (e.type === "phase") {
        hooks.onPhase?.(e.phase, e.tool);
      } else if (e.type === "delta") {
        partial += e.text;
        hooks.onPartial?.(partial);
      } else if (e.type === "progress" || e.type === "limit") {
        if (e.type === "limit") limits = e.windows;
        if (e.type === "progress")
          for (const t of e.tools) started.set(t.id, { name: t.name, target: t.target, at: Date.now() });
        if (e.type === "progress" && e.entry) hooks.onEntry?.(e.entry);
        hooks.onEvent?.(e);
      } else if (e.type === "tool_end") {
        if (e.browser === "disconnected" && job.browser === "chrome") {
          chromeSeen = { status: "disconnected", at: Date.now() };
          browserOff("chrome");
        }
        for (const r of e.results) {
          const s0 = started.get(r.id);
          if (!s0) continue;
          started.delete(r.id);
          hooks.onTool?.({ name: s0.name, target: s0.target, ok: r.ok, ms: Date.now() - s0.at });
        }
      } else if (e.type === "ask") {
        // 確認は 1 つずつ。本人の答えが返るまで次の行の処理を待たせない（読み続けるが、答えは順に返す）
        waitingHuman += 1;
        clearTimeout(timer);
        asking = asking.then(async () => {
          let a: Answer;
          try {
            a = hooks.ask
              ? await hooks.ask({ requestId: e.requestId, tool: e.tool, input: e.input, summary: e.summary })
              : { allow: false };
          } catch {
            a = { allow: false };
          }
          waitingHuman -= 1;
          arm();
          if (!settled)
            p.stdin.write(controlResponse(e.requestId, a.allow, e.input, a.note ?? null, a.answers ?? null));
        });
      } else if (e.type === "result") {
        if (e.session) session = e.session;
        received += 1;
        partial = "";
        if (received < expected) {
          // 止めずに直した分の前の答え。仕事は続く（D-104.9）
          usage = addUsage(usage, e.usage);
          if (e.ok) hooks.onReply?.(e.text);
          return;
        }
        if (e.ok && hooks.takeSteers) {
          // 区切り：順番待ちの一言があれば渡して続ける。無ければ終わり
          const ev = e;
          void hooks
            .takeSteers(ev.text)
            .catch(() => [] as string[])
            .then((texts) => {
              if (settled) return;
              const ts = texts.filter((x) => x.trim());
              if (!ts.length)
                return done({ state: "done", result: ev.text, agent_session_id: session, usage: ev.usage });
              // この区切りの答えは Kaname が一言の前に吹き出しにした（onReply は呼ばない）
              usage = addUsage(usage, ev.usage);
              for (const x of ts) {
                expected += 1;
                p.stdin.write(userMessage(x));
              }
            });
          return;
        }
        if (e.ok) return done({ state: "done", result: e.text, agent_session_id: session, usage: e.usage });
        // 記録が無い（D-124.3）：外の runClaude が --resume 無しでやり直す。会話の id はまだ書き換えない
        if (job.agent_session_id && isResumeLost(e.raw, err, e.text))
          return done({
            state: "stopped",
            reason: "前の会話の記録がこの PC に無かったので止まりました",
            agent_session_id: job.agent_session_id,
            usage: e.usage,
            resumeLost: true,
          });
        done({
          state: "stopped",
          reason: e.reason === "empty" ? NO_SIGNAL_REASON : whyStopped(JSON.stringify(e.raw), err, null, limits),
          agent_session_id: session,
          usage: e.usage,
        });
      }
    };
    p.stdout.on("data", (c: Buffer) => {
      arm(); // 何か出てきた＝進んでいる
      const { lines, rest: r } = splitLines(rest + c.toString());
      rest = r;
      for (const ln of lines) {
        const e = parseLine(ln);
        if (e) handle(e);
      }
    });
    p.stderr.on("data", (c: Buffer) => (err += c.toString()));
    p.on("error", (e: NodeJS.ErrnoException) =>
      done({
        state: "stopped",
        reason:
          e.code === "ENOENT"
            ? "このPCに Claude Code が見つかりません。入れてログインしてください"
            : `Claude Code を起動できませんでした（${e.message}）`,
        agent_session_id: session,
      }),
    );
    p.on("close", (code) => {
      if (rest.trim()) {
        const e = parseLine(rest);
        if (e) handle(e);
      }
      // result（完了信号）が来ないまま終わったものを成功にしない（G-15）
      // 終了コード 0 で何も言わずに終わった（stderr も空）＝合図なし。何も返さずに終わったと出す（E-SIG-002・K-62）
      if (!settled)
        done({
          state: "stopped",
          reason: code === 0 && !err.trim() ? NO_SIGNAL_REASON : whyStopped("", err, code),
          agent_session_id: session,
        });
    });
    // 人が言ったことを渡す。入力はこの後も開けたままにする（確認の答え・止めずに直す一言を渡すため）
    p.stdin.on("error", () => undefined);
    p.stdin.write(userMessage(job.prompt));
  });
}

/** `--output-format json` の出力から 本文 と session の id を取る。形が変わっても落ちないように緩く読む */

/** 出力から「ログインが要る／上限に当たった」を読み取る。
 *  Claude Code は終了コードだけでは理由を語らない（終了コード 1・stderr 空 で終わることがある）。
 *  人に「終了コード 1」と見せても次の一手が分からないので、出力の中身から言い換える */
/** 枠に達したときの理由（E-LIM-010）：どの枠が・いつ戻るか。戻る時刻は PC の時計で */
export function limitReason(limits: { window: string; utilization: number; resets_at: number }[]): string {
  const hit = limits.find((w) => w.utilization >= 1) ?? [...limits].sort((a, b) => b.utilization - a.utilization)[0];
  if (!hit) return "本人のサブスクの上限に当たりました。しばらく待つか、上限を上げてからもう一度お試しください";
  const d = new Date(hit.resets_at * 1000);
  const at = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `サブスクの${hit.window === "week" ? "週" : " 5 時間"}の枠に達しました。${at} に戻ります。それまで自分のAI は動けません。ここで書いたことは送れます（戻ったら順に）`;
}

export function whyStopped(
  out: string,
  err: string,
  code: number | null,
  limits: { window: string; utilization: number; resets_at: number }[] = [],
): string {
  const j = (() => {
    try {
      return JSON.parse(out.trim()) as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  })();
  const t = `${j["terminal_reason"] ?? ""} ${j["subtype"] ?? ""} ${j["error"] ?? ""} ${err}`.toLowerCase();
  if (/api_error|unauthor|authentication|not logged|invalid api key|oauth/.test(t))
    return "Claude Code にログインできていません。Bridge の「ログインする」を押して、ブラウザで 1 回許可してください";
  if (/rate|quota|limit|usage/.test(t)) return limitReason(limits);
  return `Claude Code が途中で終わりました（${err.trim().slice(0, 200) || `終了コード ${code}`}）`;
}

export function parse(out: string): { text: string; session: string | null } {
  const t = out.trim();
  if (!t) return { text: "", session: null };
  try {
    const j = JSON.parse(t) as Record<string, unknown>;
    const text = [j["result"], j["text"], j["content"]].find((x) => typeof x === "string" && x.trim()) as
      string | undefined;
    const session = [j["session_id"], j["sessionId"]].find((x) => typeof x === "string") as string | undefined;
    return { text: (text ?? "").trim(), session: session ?? null };
  } catch {
    return { text: t, session: null }; // JSON でなければそのまま本文として扱う
  }
}
