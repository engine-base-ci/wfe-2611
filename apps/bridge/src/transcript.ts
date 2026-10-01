// 本人の PC の Claude Code の会話記録を読む（D-112）。記録が正本で、Kaname は写しを出す。
//   場所は ~/.claude/projects/<作業フォルダを - に置き換えた名前>/<session id>.jsonl。作業フォルダに依存しないよう、
//   projects の下を <session id>.jsonl で探す。置き場は KANAME_CLAUDE_PROJECTS で差し替えられる（テストで本人の記録に触らない）
//   写すのは自分のAI の文だけ。道具の返り値・考えている中身・本人の文は写さない（D-100.3）
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Entry } from "./stream";

export const projectsDir = (): string =>
  process.env["KANAME_CLAUDE_PROJECTS"] || join(homedir(), ".claude", "projects");
const ID = /^[0-9a-f-]{8,64}$/i;

/** その session の記録のファイル。無ければ null（別の PC の記録・消された記録） */
export function sessionFile(sessionId: string, root = projectsDir()): string | null {
  if (!ID.test(sessionId)) return null;
  let dirs: string[] = [];
  try {
    dirs = readdirSync(root);
  } catch {
    return null;
  }
  for (const d of dirs) {
    const p = join(root, d, `${sessionId}.jsonl`);
    if (existsSync(p)) return p;
  }
  return null;
}

/** 記録から自分のAI の文を並びどおりに取り出す（壊れた行は飛ばす） */
export function aiEntries(file: string): Entry[] {
  let raw = "";
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const out: Entry[] = [];
  const seen = new Map<string, Entry>();
  const index = new Map<string, number>();
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let j: Record<string, unknown>;
    try {
      j = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (j["type"] !== "assistant" || j["isSidechain"] === true || typeof j["uuid"] !== "string") continue;
    // Claude Code が自分で足した文（途中で止まったときの「No response requested.」等・model が <synthetic>）は写さない
    const msg = (j["message"] ?? {}) as { content?: unknown; model?: unknown };
    if (msg.model === "<synthetic>" || j["isApiErrorMessage"] === true) continue;
    const content = msg.content;
    const text = (Array.isArray(content) ? (content as { type?: string; text?: string }[]) : [])
      .filter((c) => c.type === "text" && typeof c.text === "string")
      .map((c) => c.text!)
      .join("\n\n")
      .trim();
    if (!text) continue;
    const id = (j["message"] as { id?: unknown } | undefined)?.id;
    const e: Entry = {
      uuid: j["uuid"],
      text,
      ...(typeof j["timestamp"] === "string" ? { at: j["timestamp"] } : {}),
      ...(typeof id === "string" && id ? { group: id } : {}),
    };
    const joined = joinResponse(seen, e);
    const at = e.group ? index.get(e.group) : undefined;
    if (at !== undefined) out[at] = joined;
    else {
      if (e.group) index.set(e.group, out.length);
      out.push(joined);
    }
  }
  return out;
}

/** 同じ返答（Claude の返答の id）の文は 1 つの吹き出しにまとめる（D-115）。
 *  返答の途中に「考える」が挟まって文が 2 行に分かれても、最初の文の id のまま文をつなぐ。返答が変わる（道具を使って結果を受け取った）所でだけ分かれる */
export function joinResponse(seen: Map<string, Entry>, e: Entry): Entry {
  if (!e.group) return e;
  const prev = seen.get(e.group);
  const next: Entry = prev ? { ...prev, text: `${prev.text}\n\n${e.text}` } : e;
  seen.set(e.group, next);
  return next;
}

/** ファイルの大きさ（前と同じなら読み直さない） */
export const sizeOf = (file: string): number => {
  try {
    return statSync(file).size;
  } catch {
    return -1;
  }
};
