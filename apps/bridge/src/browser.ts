// AI が使うブラウザ（D-119）。本人のサブスクの Claude Code に渡す道具は 2 つだけ:
//   chrome     ── Claude in Chrome（本人の Chrome とそのログインの状態。`--chrome` で Claude Code が自分でつなぐ）
//   dedicated  ── Bridge 専用のブラウザ（Playwright MCP。本人の PC に別のログインの状態を持つ）
// どちらも本人の画面で動く（隠れて動かさない・D-119.6）。禁止の宛先は bridge-guard が開く前と開いた後で止める（D-119.5）
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

/** Bridge 専用のブラウザの道具の名前（聞かずに使える。開く先は見張りが止める） */
export const DEDICATED_TOOL_RULE = "mcp__playwright";
/** --mcp-config での名前（道具の名前は mcp__playwright__browser_navigate 等になる） */
export const DEDICATED_SERVER = "playwright";

export interface DedicatedBrowser {
  /** @playwright/mcp の起動台本 */
  cliPath: string;
  /** 台本を動かす node（Electron のときは ELECTRON_RUN_AS_NODE で動かす） */
  nodeBin: string;
  /** ログインの状態を持つ場所（Bridge の置き場の中・本人の Chrome とは別） */
  profileDir: string;
  /** 画面の写しなどを置く場所 */
  outputDir: string;
}

/** 配布物では台本が app.asar の中にある。子のプロセスから読めるよう、展開した側を指す */
function unpacked(p: string): string {
  return p.replace(/app\.asar([\\/])/, "app.asar.unpacked$1");
}

/** @playwright/mcp の起動台本の場所。入っていなければ null（その PC では専用のブラウザは使えない） */
export function findPlaywrightMcp(): string | null {
  try {
    const pkg = require.resolve("@playwright/mcp/package.json");
    const cli = unpacked(join(dirname(pkg), "cli.js"));
    return existsSync(cli) ? cli : null;
  } catch {
    return null;
  }
}

/** Bridge 専用のブラウザの準備。置き場を作る。台本が無ければ null */
export function dedicatedBrowser(baseDir: string, nodeBin: string): DedicatedBrowser | null {
  const cliPath = findPlaywrightMcp();
  if (!cliPath) return null;
  const profileDir = join(baseDir, "browser-profile");
  const outputDir = join(baseDir, "browser-output");
  mkdirSync(profileDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });
  return { cliPath, nodeBin, profileDir, outputDir };
}

/** --mcp-config に入れる 1 台分。インストール済みの Chrome を、Bridge の置き場のログインの状態で開く（画面に出す） */
export function dedicatedServer(b: DedicatedBrowser): Record<string, unknown> {
  return {
    command: b.nodeBin,
    args: [b.cliPath, "--browser", "chrome", "--user-data-dir", b.profileDir, "--output-dir", b.outputDir],
    env: process.versions["electron"] ? { ELECTRON_RUN_AS_NODE: "1" } : {},
  };
}

/** 自己診断の 1 行（名前・できるか・どうすれば直るか） */
export interface BrowserCheck {
  name: string;
  ok: boolean;
  detail: string;
}

/**
 * AI がブラウザを使えるか（D-119.4）。自己診断に出し、Kaname の「Bridge が自分で確かめた結果」にも返る。
 * 本人の Chrome は、最後に Chrome を使った仕事で分かったつながりを出す（まだ使っていなければそう書く）
 */
export function browserCheck(
  choice: "chrome" | "dedicated" | "off",
  hasChrome: boolean,
  seen: { status: string; at: number } | null,
  hasPlaywright: boolean,
): BrowserCheck {
  if (choice === "off")
    return {
      name: "AI はブラウザを使わない設定です",
      ok: true,
      detail: "Bridge の窓の「AI が使うブラウザ」で変えられます",
    };
  if (choice === "dedicated") {
    const ready = hasChrome && hasPlaywright;
    return {
      name: "AI が Bridge 専用のブラウザを使える",
      ok: ready,
      detail: ready
        ? "使えます（いつもの Chrome とは別のログインの状態で動きます）"
        : !hasChrome
          ? "Chrome が見つかりません。専用のブラウザも Chrome の本体を使います"
          : "専用のブラウザの部品が見つかりません。Bridge を入れ直してください",
    };
  }
  const name = "AI が Chrome を使える（Claude in Chrome）";
  if (!hasChrome)
    return {
      name,
      ok: false,
      detail: "Chrome が見つかりません。Chrome を入れるか、Bridge の窓で「Bridge 専用のブラウザ」に変えてください",
    };
  if (!seen) return { name, ok: true, detail: "まだ使っていません（AI が初めてブラウザを使うときに確かめます）" };
  const when = new Date(seen.at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  return seen.status === "connected"
    ? { name, ok: true, detail: `つながっています（${when}）` }
    : {
        name,
        ok: false,
        detail: `つながっていません（${when}）。Chrome を開き、拡張機能「Claude in Chrome」がこの Claude と同じアカウントでログインしているか確かめてください`,
      };
}
