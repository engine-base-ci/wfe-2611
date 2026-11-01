// 規約で自動操作が禁止のサービスと銀行を、全部許可でも本人の PC の上で止める（D-107・T-B-24）。
//   ブラウザ（D-119.5）は開く前（開く宛先）と開いた後（開いているページ）の両方で調べる。リンクを押して禁止の宛先に着いたら、その先の操作をさせない
//   1 段目：Claude Code に「使わない道具」（--disallowedTools の WebFetch(domain:…)）として渡す。許可のモードより強い（D-107.2）
//   2 段目：道具を使う直前のフック（PreToolUse）で、コマンド・取り込み・ブラウザ操作の宛先を調べて止める（D-107.3）
//   止めたらフックが 1 行書き残し、Bridge がそれを読んで途中経過 blocked を送る（D-107.4・D-107.5）
//   渡すのはドメインの一覧だけ。資格情報は渡さない（D-107.7）
//   見抜けない形（変数や文字の連結で宛先を組み立てる・IP を直接書く・別のプログラムの中からの通信）は止められない（D-107.6）
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface Blocked {
  domain: string;
  service: string;
  verdict?: string;
}
export interface Hit {
  domain: string;
  service: string;
  target: string;
}

/** 文の中の宛先らしいもの（ホスト名）を小文字で抜き出す。URL・user@host・素のドメインのどれでも */
export function hostsIn(text: string): string[] {
  const out: string[] = [];
  const re = /(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^\s/@'"`]+@)?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})(?![a-z0-9-])/gi;
  for (const m of String(text ?? "").matchAll(re)) out.push(m[1]!.toLowerCase());
  return out;
}

/**
 * その道具の呼び出しが禁止の宛先に触るか。触るならどのドメインか。
 * 見るのは外へ出る道具だけ（Bash のコマンド・WebFetch の url・ブラウザ等の MCP の url 系の欄）。
 * 文書を書く道具（Write・Edit）の中身にドメイン名が出てきても止めない（書くだけでは外に出ない）
 */
export function blockedHit(toolName: string, input: unknown, list: Blocked[]): Hit | null {
  if (!Array.isArray(list) || !list.length) return null;
  const inp = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const name = String(toolName ?? "");
  const texts: string[] = [];
  if (name === "Bash") texts.push(String(inp["command"] ?? ""));
  else if (name === "WebFetch") texts.push(String(inp["url"] ?? ""));
  else if (name.startsWith("mcp__")) {
    const walk = (v: unknown, depth: number) => {
      if (depth > 3 || v === null || v === undefined) return;
      if (typeof v === "string") {
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) texts.push(v);
        return;
      }
      if (typeof v !== "object") return;
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (typeof x === "string" && /^(url|uri|href|link|target|domain|host|site)$/i.test(k)) texts.push(x);
        else walk(x, depth + 1);
      }
    };
    walk(inp, 0);
  } else return null;
  for (const t of texts) {
    const re = /(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^\s/@'"`]+@)?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})(?![a-z0-9-])/gi;
    for (const m of t.matchAll(re)) {
      const host = m[1]!.toLowerCase();
      const b = list.find((x) => host === x.domain || host.endsWith(`.${x.domain}`));
      if (b) return { domain: b.domain, service: b.service || b.domain, target: t.slice(0, 300) };
    }
  }
  return null;
}

/** 開いているページ（ブラウザの道具・D-119.5）。タブの id → URL。active はその道具が動いたタブ */
export interface Pages {
  tabs: Record<string, string>;
  active: string | null;
}

/**
 * ブラウザの道具の返り値から、いま開いているページの URL を読む（2026-09-30 に実物で確かめた形）。
 *   Claude in Chrome：返り値の末尾の「Tab Context」に全部のタブが `• tabId N: "題" ("URL")` で並び、「Executed on tabId: N」が動いたタブ
 *   Bridge 専用のブラウザ（Playwright MCP）：「- Page URL: …」がいまのページ（タブは 1 つとして扱う・id は "pw"）
 * 読めなければ null（前に分かったページのまま）
 */
export function pagesIn(toolName: string, response: unknown): Pages | null {
  const text = (Array.isArray(response) ? response : [response])
    .map((x) => (typeof x === "string" ? x : x && typeof x === "object" && typeof (x as Record<string, unknown>)["text"] === "string" ? String((x as Record<string, unknown>)["text"]) : ""))
    .join("\n");
  const name = String(toolName ?? "");
  if (name.startsWith("mcp__claude-in-chrome__")) {
    const at = text.lastIndexOf("Tab Context:");
    if (at < 0) return null;
    const block = text.slice(at);
    const tabs: Record<string, string> = {};
    for (const m of block.matchAll(/tabId (\d+): ".*?" \("([^"]*)"\)/g)) tabs[m[1]!] = m[2]!;
    const ex = /Executed on tabId: (\d+)/.exec(block);
    return { tabs, active: ex ? ex[1]! : null };
  }
  if (name.startsWith("mcp__playwright__")) {
    if (/No open tabs/.test(text)) return { tabs: {}, active: null };
    const m = /- Page URL: (\S+)/.exec(text);
    return m ? { tabs: { pw: m[1]! }, active: "pw" } : null;
  }
  return null;
}

/** 禁止の宛先のページに居ても使ってよい道具（閉じる・タブを見る・別の宛先へ移る。移る先は開く前の見張りが調べる） */
const ESCAPE = /__(tabs_close_mcp|tabs_context_mcp|tabs_create_mcp|navigate|list_connected_browsers|select_browser|switch_browser|browser_close|browser_tabs|browser_navigate|browser_navigate_back)$/;

/**
 * 開いた後の見張り（D-119.5）。
 *   PreToolUse：その道具が動くタブ（入力の tabId。無ければ前に動いたタブ）が禁止の宛先を開いていたら、閉じる・移る以外をさせない
 *   PostToolUse：道具の後に開いているページが禁止の宛先なら止める（AI に「このページで操作しない」と返す）
 * 返すのは止める理由と、次に覚えておくページ
 */
export function pageGuard(
  ev: { hook_event_name?: string; tool_name?: string; tool_input?: unknown; tool_response?: unknown },
  list: Blocked[],
  prev: Pages,
): { hit: Hit | null; pages: Pages } {
  const name = String(ev.tool_name ?? "");
  const browser = name.startsWith("mcp__claude-in-chrome__") || name.startsWith("mcp__playwright__");
  if (!browser || !Array.isArray(list) || !list.length) return { hit: null, pages: prev };
  const blockedOf = (url: string): Hit | null => {
    let host = "";
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      return null;
    }
    const b = list.find((x) => host === x.domain || host.endsWith(`.${x.domain}`));
    return b ? { domain: b.domain, service: b.service || b.domain, target: url.slice(0, 300) } : null;
  };
  const chrome = name.startsWith("mcp__claude-in-chrome__");
  if (ev.hook_event_name === "PostToolUse") {
    const seen = pagesIn(name, ev.tool_response);
    if (!seen) return { hit: null, pages: prev };
    // Chrome は全部のタブが並ぶので置き換える。専用のブラウザは 1 枚
    const pages: Pages = chrome ? { tabs: seen.tabs, active: seen.active ?? prev.active } : seen;
    const now = pages.active ? pages.tabs[pages.active] : undefined;
    return { hit: now ? blockedOf(now) : null, pages };
  }
  if (ESCAPE.test(name)) return { hit: null, pages: prev };
  const ids: string[] = [];
  const walk = (v: unknown, depth: number): void => {
    if (depth > 4 || v === null || typeof v !== "object") return;
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (k === "tabId" && (typeof x === "number" || typeof x === "string")) ids.push(String(x));
      else walk(x, depth + 1);
    }
  };
  if (chrome) walk(ev.tool_input, 0);
  const targets = chrome ? (ids.length ? ids : prev.active ? [prev.active] : []) : ["pw"];
  for (const id of targets) {
    const url = prev.tabs[id];
    const hit = url ? blockedOf(url) : null;
    if (hit) return { hit, pages: prev };
  }
  return { hit: null, pages: prev };
}

/** フックの本体（ファイルに書き出して、Claude Code が道具を使う直前と直後に動かす）。上の関数そのものを埋め込む（判定を 2 か所に書かない） */
export const HOOK_SOURCE = `// Kaname Bridge が書いたフック（D-107.3・D-119.5）。手で直さない
// 変換器によっては関数の中に __name(…) が入る（2026-09-30 tsx で実例：無いと見張りが落ちて素通りした）
const __name = (f) => f;
const blockedHit = ${blockedHit.toString()};
const pagesIn = ${pagesIn.toString()};
const ESCAPE = ${ESCAPE.toString()};
const pageGuard = ${pageGuard.toString()};
const fs = require("node:fs");
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let list = [];
  let ev = {};
  try { list = JSON.parse(process.env.KANAME_BLOCKED || "[]"); } catch { list = []; }
  try { ev = JSON.parse(raw || "{}"); } catch { ev = {}; }
  try {
    main(list, ev);
  } catch (e) {
    // 見張りが壊れたら、外へ出る道具は止める（落ちたまま素通りさせない）。外へ出ない道具は通す
    const name = String(ev.tool_name || "");
    if (Array.isArray(list) && list.length && (name === "Bash" || name === "WebFetch" || name.startsWith("mcp__"))) {
      process.stderr.write("Kaname の見張りが動かなかったので、外へ出る操作を止めました（" + String(e && e.message || e).slice(0, 120) + "）。本人に知らせてください。");
      process.exit(2);
    }
    process.exit(0);
  }
});
function main(list, ev) {
  const after = ev.hook_event_name === "PostToolUse";
  // 開いているページはこの仕事の間だけ覚える（止めた記録の隣）
  const stateFile = process.env.KANAME_GUARD_LOG ? process.env.KANAME_GUARD_LOG + ".pages" : "";
  let prev = { tabs: {}, active: null };
  try { if (stateFile) prev = JSON.parse(fs.readFileSync(stateFile, "utf8")); } catch {}
  const pg = pageGuard(ev, list, prev);
  if (stateFile && pg.pages !== prev) { try { fs.writeFileSync(stateFile, JSON.stringify(pg.pages)); } catch {} }
  const hit = (after ? null : blockedHit(ev.tool_name, ev.tool_input, list)) || pg.hit;
  if (!hit) process.exit(0);
  const log = process.env.KANAME_GUARD_LOG;
  if (log) {
    try { fs.appendFileSync(log, JSON.stringify({ tool: String(ev.tool_name || ""), ...hit }) + "\\n"); } catch {}
  }
  const why =
    hit.service + "（" + hit.domain + "）は規約で自動操作が禁止のため、Kaname が止めました。" +
    (pg.hit ? "いま開いているページがその宛先です。このページでは操作せず、このタブを閉じてください。" : "この操作はしないでください。") +
    "本人には正規の連携（口座連携・API）か、手で操作する手順を案内してください。";
  if (after) {
    // 開いた後は、道具の返り値（そのページの中身・画面の写し）を AI に渡さない。止めた理由に置き換える（2026-09-30 実物で確かめた）
    process.stdout.write(JSON.stringify({
      decision: "block",
      reason: why,
      hookSpecificOutput: { hookEventName: "PostToolUse", updatedMCPToolOutput: [{ type: "text", text: "（" + hit.service + " のページのため、中身は Kaname が隠しました）" }] },
    }));
    process.exit(0);
  }
  process.stderr.write(why);
  process.exit(2);
}
`;

/** フックのファイルを置く（中身が同じなら書き直さない）。置いた場所を返す */
export function writeHook(dir: string): string {
  const path = join(dir, "kaname-guard-hook.cjs");
  try {
    if (existsSync(path) && readFileSync(path, "utf8") === HOOK_SOURCE) return path;
  } catch {
    /* 読めなければ書き直す */
  }
  writeFileSync(path, HOOK_SOURCE, { mode: 0o644 });
  return path;
}

/** Claude Code に渡す引数（使わない道具＋直前のフック）。一覧が空なら何も足さない */
export function guardArgs(list: Blocked[], hookPath: string, nodeBin: string): string[] {
  if (!list.length) return [];
  const hook = { type: "command", command: `"${nodeBin}" "${hookPath}"`, timeout: 10 };
  // 開く前は全部の道具、開いた後はブラウザの道具（MCP）だけ（D-119.5）
  const settings = { hooks: { PreToolUse: [{ matcher: "*", hooks: [hook] }], PostToolUse: [{ matcher: "mcp__.*", hooks: [hook] }] } };
  return ["--disallowedTools", ...list.map((b) => `WebFetch(domain:${b.domain})`), "--settings", JSON.stringify(settings)];
}

/** フックに渡す環境（一覧・書き残す場所。Electron の中の node で動かすときは node として動かす） */
export function guardEnv(list: Blocked[], log: string): Record<string, string> {
  return {
    KANAME_BLOCKED: JSON.stringify(list.map((b) => ({ domain: b.domain, service: b.service }))),
    KANAME_GUARD_LOG: log,
    ...(process.versions["electron"] ? { ELECTRON_RUN_AS_NODE: "1" } : {}),
  };
}

/** 書き残された止めた記録を、前に読んだところから読む */
export function readGuardLog(log: string, from: number): { hits: (Hit & { tool: string })[]; next: number } {
  try {
    const s = readFileSync(log, "utf8");
    if (s.length <= from) return { hits: [], next: from };
    const hits = s
      .slice(from)
      .split("\n")
      .filter(Boolean)
      .flatMap((l) => {
        try {
          return [JSON.parse(l) as Hit & { tool: string }];
        } catch {
          return [];
        }
      });
    return { hits, next: s.length };
  } catch {
    return { hits: [], next: from };
  }
}
