// Claude Code を本人の PC に入れる（D-091）。人にターミナルを触らせない。
// 順番（D-091.2）：①もう実行できるなら何もしない ②入っているのに本体が落ちてきていないなら取り直しだけ
//                  ③どちらも無ければ npm で入れる ④npm も無ければ理由を出して止める（勝手に別のものを入れない）
// ログイン（本人のサブスクに紐づける）は自動にしない。本人がブラウザで 1 回承認する（D-091.3・関門 C8 と同じ線）。
import { spawn } from "node:child_process";
import { childEnv } from "./env";
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
    join(process.env["APPDATA"] ?? "", "npm", "node_modules"),
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

function run(
  bin: string,
  args: string[],
  onStep: OnStep,
  env?: NodeJS.ProcessEnv,
): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    const p = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], env: env ?? childEnv(shellPath()) });
    let out = "";
    const push = (c: Buffer) => {
      out += c.toString();
      const last = out.trim().split("\n").at(-1) ?? "";
      if (last) onStep({ text: last.slice(0, 120), state: "doing" });
    };
    p.stdout.on("data", push);
    p.stderr.on("data", push);
    p.on("error", (e) => resolve({ ok: false, out: `${out}\n${e.message}` }));
    p.on("close", (code) => resolve({ ok: code === 0, out }));
  });
}

/** 入れる。押すのはこれ 1 回（D-091.1）。結末はそのまま人に見せる文で返す */
export async function installClaude(onStep: OnStep = () => {}): Promise<{ ok: boolean; message: string }> {
  if (await findClaude()) return { ok: true, message: "もう入っています（この PC で動かせます）" };

  const cjs = await brokenInstall();
  if (cjs) {
    onStep({ text: "入ってはいますが、本体が落ちてきていません。取り直します", state: "doing" });
    const own = ownNode();
    const r = await run(own.bin, [cjs], onStep, own.env); // 版の分かっている node で動かす
    forgetClaude();
    if (await findClaude()) {
      onStep({ text: "入りました", state: "done" });
      return { ok: true, message: "入りました。次に「ログインする」を押してください" };
    }
    if (!r.ok)
      return { ok: false, message: `取り直せませんでした（${r.out.trim().split("\n").at(-1)?.slice(0, 160) ?? ""}）` };
  }

  const npm = which("npm");
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
  const r = await run(npm, ["install", "-g", "--include=optional", PKG], onStep, env);
  forgetClaude();
  if (await findClaude()) {
    onStep({ text: "入りました", state: "done" });
    return { ok: true, message: "入りました。次に「ログインする」を押してください" };
  }
  const tail = r.out.trim().split("\n").at(-1)?.slice(0, 160) ?? "";
  onStep({ text: "入れられませんでした", state: "failed" });
  return { ok: false, message: `入れられませんでした（${tail}）` };
}

/** ログインの窓を開く（D-091.3）。承認するのは本人。Bridge は窓を開くだけで、資格情報は見ない */
export async function openClaudeLogin(): Promise<{ ok: boolean; message: string }> {
  const bin = await findClaude();
  if (!bin) return { ok: false, message: "先に「Claude Code を入れる」を押してください" };
  try {
    if (process.platform === "darwin") {
      // ターミナルで開く。ログインはブラウザが開いて、本人が 1 回承認する
      spawn("open", ["-a", "Terminal", bin], { detached: true, stdio: "ignore" }).unref();
    } else if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", bin], { detached: true, stdio: "ignore", env: childEnv(shellPath()) }).unref();
    } else {
      spawn(bin, [], { detached: true, stdio: "ignore", env: childEnv(shellPath()) }).unref();
    }
    return { ok: true, message: "窓が開きます。出てきた案内どおりに 1 回だけ承認してください" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "窓を開けませんでした" };
  }
}
