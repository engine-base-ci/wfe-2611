// 運営のお知らせの答えの形（K-977・K-1004 の OpsNoticeRow 11 欄・OpsNoticeDetail 16 欄）。
//   読み替え（状態 4 つ・出す場所・誰に・届く数）は DB の関数 app.notice_ops_row・app.ops_notice_detail の 1 か所で済んでいる。
//   ここは関数の jsonb を受け、鍵をちょうど 11／16 にそろえるだけ（足りない鍵・形の違う答えは投げて 503 にする・G-15）。
//   作る・直す（K-1014）・出す（K-978）・続報（K-979）の口も、最後に app.ops_notice_detail を呼んでここを通す
type Json = Record<string, unknown>;

export const OPS_NOTICE_ROW_KEYS = [
  "id",
  "kind",
  "title",
  "audience",
  "state",
  "placements",
  "publish_at",
  "published_at",
  "author_name",
  "incident_state",
  "admins_only",
] as const;
export const OPS_NOTICE_DETAIL_KEYS = [
  ...OPS_NOTICE_ROW_KEYS,
  "body",
  "maintenance",
  "impact",
  "updates",
  "reach",
] as const;

const pick = (v: unknown, keys: readonly string[], what: string): Json => {
  if (v === null || typeof v !== "object" || Array.isArray(v)) throw new Error(`${what} の答えが形でない`);
  const src = v as Json;
  const missing = keys.filter((k) => !(k in src));
  if (missing.length) throw new Error(`${what} の答えに欄が無い（${missing.length} 個）`);
  return Object.fromEntries(keys.map((k) => [k, src[k]]));
};

/** 一覧の 1 行（11 欄） */
export const toOpsNoticeRow = (v: unknown): Json => pick(v, OPS_NOTICE_ROW_KEYS, "お知らせの一覧");

/** 1 件（16 欄） */
export const toOpsNoticeDetail = (v: unknown): Json => pick(v, OPS_NOTICE_DETAIL_KEYS, "お知らせの 1 件");
