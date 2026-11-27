// 段 11 の口の成功の答えの形（K-800）。鍵を決めた順に並べ直し、知らない鍵は落とす。認証の要る答えなので private, no-store。
//   答えの鍵の一覧（SCOPE_KEYS・LAYER_KEYS・MEMBER_KEYS…）は、口を本物にする後ろの葉が自分のファイルで持つ
import type { HookReply } from "../../../contract/deps.js";

const pick = (v: unknown, keys: readonly string[]): unknown => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return v;
  const src = v as Record<string, unknown>;
  return Object.fromEntries(keys.filter((k) => Object.hasOwn(src, k)).map((k) => [k, src[k]]));
};

/** { status, body: { data }, headers: Cache-Control } に直す。配列なら 1 件ずつ並べ直す */
export function dataReply(
  status: number,
  data: unknown,
  keys: readonly string[],
): HookReply & {
  headers: Record<string, string>;
} {
  const shaped = Array.isArray(data) ? data.map((x) => pick(x, keys)) : pick(data, keys);
  return { status, body: { data: shaped }, headers: { "Cache-Control": "private, no-store" } };
}
