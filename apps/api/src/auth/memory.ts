// 記憶（D-105）：「覚えて」の印を読む／前の道で始まったまとめの答え（JSON）を読む。
// 判定は DB の関数（agent_digest_apply ほか）。ここは文を作る・読むだけで、DB には触らない（単体で試せる）
import { idOf } from "./ids.js";
export interface DigestResult {
  remembered: { title?: string; body: string; kind?: string; source?: string }[];
  merged: { memory_ids: string[]; title?: string; body: string; kind?: string }[];
  propose: { title?: string; body: string; kind?: string; target_scope_id?: string; why?: string; source?: string }[];
  discarded: { text: string; why?: string }[];
}

/** 「覚えて」の印（[[覚える: …]]）を抜き出し、返事からは消す（D-105.1） */
export function takeRemember(text: string): { text: string; items: string[] } {
  const items: string[] = [];
  const out = text.replace(/\[\[\s*覚える\s*[:：]\s*([\s\S]*?)\]\]/g, (_, v: string) => {
    const t = v.trim();
    if (t) items.push(t.slice(0, 2000));
    return "";
  });
  return { text: out.replace(/\n{3,}/g, "\n\n").trim(), items: items.slice(0, 10) };
}

const arr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : [];
const str = (v: unknown, n: number): string => (typeof v === "string" ? v.trim().slice(0, n) : "");
/** まとめの答えから JSON を読む。形が違えば null（まとめは「うまくいかなかった」にする。黙って空にしない） */
export function parseDigest(text: string): DigestResult | null {
  const fenced = /```json\s*([\s\S]*?)```/i.exec(text)?.[1];
  const raw = fenced ?? /\{[\s\S]*\}/.exec(text)?.[0] ?? "";
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!j || typeof j !== "object" || !["remembered", "merged", "propose", "discarded"].some((k) => k in j)) return null;
  return {
    remembered: arr(j["remembered"])
      .map((x) => ({
        title: str(x["title"], 80),
        body: str(x["body"], 2000),
        kind: str(x["kind"], 20),
        source: str(x["source"], 120),
      }))
      .filter((x) => x.body),
    merged: arr(j["merged"])
      .map((x) => ({
        // AI の答えの id は正式な uuid だけを残す（合わないものは捨てる・DB に届けない・K-145）
        memory_ids: (Array.isArray(x["memory_ids"]) ? x["memory_ids"] : [])
          .map(idOf)
          .filter((i): i is string => i !== null),
        title: str(x["title"], 80),
        body: str(x["body"], 2000),
        kind: str(x["kind"], 20),
      }))
      .filter((x) => x.body && x.memory_ids.length),
    propose: arr(j["propose"])
      .map((x) => ({
        title: str(x["title"], 80),
        body: str(x["body"], 2000),
        kind: str(x["kind"], 20),
        target_scope_id: idOf(x["target_scope_id"]) ?? "",
        why: str(x["why"], 500),
        source: str(x["source"], 120),
      }))
      .filter((x) => x.body),
    discarded: arr(j["discarded"])
      .map((x) => ({ text: str(x["text"], 500), why: str(x["why"], 300) }))
      .filter((x) => x.text),
  };
}
