// 記憶（D-105）：「覚えて」の印を読む／毎朝のまとめに渡す文を組む／まとめの答え（JSON）を読む。
// 判定は DB の関数（agent_digest_apply ほか）。ここは文を作る・読むだけで、DB には触らない（単体で試せる）
import { idOf } from "./ids.js";
export interface DigestSource {
  conversations: { id: string; title: string | null; messages: { who: "me" | "ai"; text: string }[] | null }[];
  approvals: { status: string | null; note: string | null; at: string }[];
  memories: { id: string; kind: string | null; title: string | null; body: string | null }[];
  scopes: { id: string; name: string }[];
  solo: boolean;
}
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

const MAX_PROMPT = 60_000;
/** 毎朝のまとめに渡す文（D-105.3・D-105.4）。会話と承認・差し戻し、いまの個人の記憶、上げ先の層。答えは JSON 1 つ */
export function digestPrompt(src: DigestSource, from: string, to: string): string {
  const conv = src.conversations
    .map(
      (c) =>
        `## 会話「${c.title ?? "名前なし"}」\n${(c.messages ?? []).map((m) => `${m.who === "me" ? "本人" : "あなた"}：${m.text.replace(/\s+/g, " ")}`).join("\n")}`,
    )
    .join("\n\n");
  const appr = src.approvals.length
    ? src.approvals
        .map(
          (a) =>
            `- ${a.status === "approved" ? "OK にした" : a.status === "rejected" || a.status === "returned" ? "差し戻した" : (a.status ?? "")}${a.note ? `：${a.note}` : ""}`,
        )
        .join("\n")
    : "（なし）";
  const mem = src.memories.length
    ? src.memories
        .map((m) => `- [${m.id}] (${m.kind ?? "preference"}) ${m.title ?? ""}：${(m.body ?? "").replace(/\s+/g, " ")}`)
        .join("\n")
    : "（まだありません）";
  const scopes = src.scopes.map((s) => `- [${s.id}] ${s.name}`).join("\n");
  const head = `あなたは本人の自分のAI です。${from} から ${to} までの本人との会話と、本人が承認・差し戻ししたものを読んで、本人の記憶を整理してください。
道具は使わず、最後に次の形の JSON を 1 つだけ、\`\`\`json で囲んで返してください（前後に説明を書いてもよい）。

{"remembered":[{"title":"短い名前","body":"覚えること","kind":"rule|preference|example","source":"どの会話から"}],
 "merged":[{"memory_ids":["いまの記憶の id"],"title":"","body":"まとめた後の文","kind":""}],
 "propose":[{"title":"","body":"","kind":"rule|preference|example","target_scope_id":"上げ先の層の id","why":"上げる理由","source":"どの会話から"}],
 "discarded":[{"text":"覚えなかったこと","why":"今回だけの話・予定 など"}]}

決まり：
- 覚えるのは、次からも効く本人のやり方・好み・決まり・OK をもらった実例だけ。今回だけの話・予定・一時的なことは discarded に入れる
- いまの記憶と重なる・古くなったものは merged で 1 つにまとめる（memory_ids は下の一覧の id だけ）
- 本人だけでなく層の全員に効きそうなもの（会社の決まり・部署のやり方）は propose に入れ、上げ先は下の層の一覧から選ぶ${src.solo ? "\n- この会社は一人なので propose は空にする" : ""}
- rule＝守らないといけないこと、preference＝好み・やり方、example＝OK をもらった実例`;
  const body = `# いまの個人の記憶\n${mem}\n\n# 上げ先の層（近い順）\n${scopes}\n\n# 承認・差し戻し\n${appr}\n\n# 会話\n${conv || "（なし）"}`;
  return `${head}\n\n${body}`.slice(0, MAX_PROMPT);
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
