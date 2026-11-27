// 段 11 の書く DB の関数の答えの言葉 → 状態と番号（K-800）。文言はコードに書かず正本（errors.json）から引く。
//   後ろの葉（K-802〜K-815・K-848）の関数の答え { error: <言葉>, … } は全部 replyOf で返す（後ろの葉はこのファイルを直さない）。
//   外す口（K-815・K-848）の関数は番号つきの答え { error, code: "E-MEM-0nn", status, detail? } を返してよい（replyOf はそのまま通す・detail も通す）。
//   404 には欄・details・detail を付けない（在るかを漏らさない）。409 には details を付けない。知らない言葉は止める側（503・E-PAGE-003）。
//   ログには場所と言葉（か例外の種類）だけを出す（理由・人の名前・メールを出さない）
import { isKnown, kanameError } from "@kaname/errors";
import type { HookReply } from "../../../contract/deps.js";

/** 正本のエラー。404 は detail も外す */
export const fromCatalog = (code: string, status: number, detail: Record<string, unknown> = {}): HookReply => {
  const body: Record<string, unknown> = { ...kanameError(code, detail).toJSON() };
  if (status === 404) delete body["detail"];
  return { status, body };
};

/** 権限が無い（入口の 403 と同じ番号・E-GRP-018 は作らない） */
export const forbidden = (): HookReply => ({ status: 403, body: { error: "forbidden", code: "FORBIDDEN" } });

/** 止める側に倒す（fail-closed・503・E-PAGE-003）。ログには場所と言葉（か例外の種類）だけ */
export const down = (where: string, word: string): HookReply => {
  console.error(`[f10-admin] ${where}：${word} なので止める側に倒した`);
  return fromCatalog("E-PAGE-003", 503);
};

/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
export const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

/** 言葉 → [状態, 番号]（detail の無い物） */
const PLAIN: Record<string, readonly [number, string]> = {
  member_gone: [404, "E-MEM-002"],
  self_role: [409, "E-MEM-003"],
  self_group: [409, "E-MEM-003"],
  last_admin: [409, "E-MEM-004"],
  self_stop: [409, "E-MEM-005"],
  scope_gone: [404, "E-MEM-006"],
  not_in_group: [409, "E-MEM-007"],
  primary_remove: [409, "E-MEM-008"],
  already_suspended: [409, "E-MEM-009"],
  not_suspended: [409, "E-MEM-010"],
  group_gone: [404, "E-GRP-002"],
  group_prefix: [409, "E-GRP-010"],
  group_name: [409, "E-GRP-011"],
  limit_groups: [409, "E-GRP-012"],
  limit_layers: [409, "E-GRP-013"],
  parent_gone: [404, "E-GRP-014"],
  person_missing: [404, "E-GRP-015"],
  layer_name: [409, "E-GRP-019"],
  layer_missing: [404, "E-GRP-020"],
  layer_gone: [404, "E-GRP-007"],
  inv_gone: [404, "E-INV-016"],
  inv_used: [409, "E-INV-017"],
  inv_revoked: [409, "E-INV-018"],
};

const PERSON_STATE: Record<string, string> = { suspended: "止まっています", invited: "招待中です" };
const asText = (v: unknown): string => (typeof v === "string" ? v : "");

/** DB の関数の答え { error: <言葉>, … } → 答え */
export function replyOf(v: { error: string; [k: string]: unknown }, where = "答え"): HookReply {
  const word = v.error;
  const code = v["code"];
  if (typeof code === "string") {
    const status = typeof v["status"] === "number" ? v["status"] : 409;
    // 番号つきの答えの detail（E-MEM-022 の { 名前, 訳 }・E-MEM-023 の { 名前 }）は通す。404 は fromCatalog が外す
    const d = v["detail"];
    const detail = d && typeof d === "object" && !Array.isArray(d) ? (d as Record<string, unknown>) : {};
    return isKnown(code) ? fromCatalog(code, status, detail) : down(where, `知らない番号（${code}）`);
  }
  if (word === "forbidden") return forbidden();
  const plain = Object.hasOwn(PLAIN, word) ? PLAIN[word] : undefined;
  if (plain) return fromCatalog(plain[1], plain[0]);
  // K-802・K-804 の関数は { name, reason }（K-802 の表）で返す。{ 名前, 訳／state } の形も受ける
  const who = asText(v["名前"]) || asText(v["name"]);
  if (word === "person_state") {
    const why = asText(v["訳"]) || PERSON_STATE[asText(v["state"]) || asText(v["reason"])] || "";
    return fromCatalog("E-GRP-016", 409, { 名前: who, 訳: why });
  }
  if (word === "person_viewer") return fromCatalog("E-GRP-017", 409, { 名前: who });
  if (word === "inv_today")
    return fromCatalog("E-INV-019", 409, { 次に送れる時刻: asText(v["次に送れる時刻"]) || asText(v["next_at"]) });
  return down(where, `知らない答え（${word}）`);
}
