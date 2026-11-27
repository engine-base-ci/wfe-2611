// 記録を探す口（K-823・listAuditEvents）の入力の確かめ。同じ値が契約（05_flow/screen_api.d/K-823.py・scripts/ci/contract_shape.d/K-823.py）に
//   1 字も違わず書かれる（K823-API-030）。形の誤りは 422・E-AUD-001（欄ごと）、続きの印をほどけない・中身の形の誤りは 422・E-AUD-002（欄 cursor）。
//   uuid でない member_id・ticket_id、limit の 0・数でない値・201 以上、base64url でない印、NUL は入口（op.ts）が先に 422・VALIDATION_ERROR で断る（K-823 の決め 案 a）
//   ことば（q・K-850）：空・空白だけ・101 字以上は 422・E-AUD-010（欄 q）。字数は送られたままの字のコードポイントで数える（契約の maxLength と同じ数え方）
import { isUuid } from "@kaname/contracts";

/** 画面の絞りの札（DB の関数 app.audit_kind が決める。ops は会社の記録に行が無いので常に 0 件） */
export const AUDIT_KINDS = ["perm", "out", "device", "ai", "deleted", "ops"] as const;
export type AuditKind = (typeof AUDIT_KINDS)[number];
export const AUDIT_LIMIT_DEFAULT = 50;
export const AUDIT_LIMIT_MAX = 100;
/** ことばで探す（K-850）：ことばの長さの上限・1 回の問い合わせで読む行の上限・1 回に読む行の数 */
export const AUDIT_Q_MAX = 100;
export const AUDIT_SCAN_MAX = 5000;
export const AUDIT_SCAN_BATCH = 500;

/** ISO 8601 の日時（時差つき）。暦に無い日時は別に弾く */
export const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})$/;
/** 続きの印の中身：<occurred_at の UTC・マイクロ秒の ISO>_<id>。印そのものはこれを base64url（パディングなし）にした字 */
export const CURSOR_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z)_([0-9a-f-]{36})$/;
/** 印の形（入口 op.ts の KEY_CURSOR_OPS と同じ base64url の 1〜200 字） */
export const CURSOR_FORM = /^[A-Za-z0-9_-]{1,200}$/;

export interface Issue {
  field: string;
  message: string;
}
export interface AuditQuery {
  kind: AuditKind | null;
  memberId: string | null;
  ticketId: string | null;
  from: string | null;
  to: string | null;
  limit: number;
  after: { at: string; id: string } | null;
  /** ことば（そろえた後・空白で分けた語）。q が無ければ null */
  words: string[] | null;
}
export type Parsed =
  { ok: true; value: AuditQuery } | { ok: false; code: "E-AUD-001" | "E-AUD-002" | "E-AUD-010"; details: Issue[] };

/** ことばをそろえる：NFKC（全角の英数・記号を半角に）→ 小文字 → 空白（半角・全角・改行）を 1 つに → 前後を落とす */
export const normalizeWord = (s: string): string => s.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
/** そろえたことばを空白で分ける（空なら []） */
export const splitWords = (q: string): string[] => {
  const n = normalizeWord(q);
  return n === "" ? [] : n.split(" ");
};

/** q を確かめる（無ければ null の語。空・空白だけ・101 字以上・NUL は E-AUD-010） */
function parseWords(raw: string | undefined): { ok: true; words: string[] | null } | { ok: false; issue: Issue } {
  if (raw === undefined) return { ok: true, words: null };
  const n = normalizeWord(raw);
  if (n === "" || raw.includes("\u0000") || [...raw].length > AUDIT_Q_MAX)
    return { ok: false, issue: { field: "q", message: `1〜${AUDIT_Q_MAX} 字` } };
  return { ok: true, words: n.split(" ") };
}

/** 暦に在る日時か（2026-02-30・13 月などは V8 が丸めて通すので、丸めが起きていないかを見る） */
function realDate(v: string): boolean {
  if (Number.isNaN(Date.parse(v))) return false;
  const head = v.slice(0, 10);
  return new Date(`${head}T00:00:00Z`).toISOString().startsWith(head) && Number(v.slice(11, 13)) < 24;
}
const isDateTime = (v: string): boolean => ISO_DATETIME.test(v) && realDate(v);

/** 続きの印を読む（base64url をほどき、中身が 時刻（マイクロ秒）_uuid か）。読めなければ null */
export function decodeAuditCursor(s: string): { at: string; id: string } | null {
  if (!CURSOR_FORM.test(s)) return null;
  const m = CURSOR_RE.exec(Buffer.from(s, "base64url").toString("utf8"));
  if (!m || !isUuid(m[2]!) || !realDate(m[1]!)) return null;
  return { at: m[1]!, id: m[2]! };
}
/** 続きの印を作る（occurred_at は DB で UTC・マイクロ秒の ISO にした字。base64url・パディングなし） */
export const encodeAuditCursor = (at: string, id: string): string =>
  Buffer.from(`${at}_${id}`, "utf8").toString("base64url");

/** 問い合わせを確かめる。空の値（?x=）は指定なし */
export function parseAuditQuery(raw: Record<string, string>): Parsed {
  const get = (k: string): string | null => (raw[k] === undefined || raw[k] === "" ? null : raw[k]!);
  const details: Issue[] = [];
  const kind = get("kind");
  if (kind !== null && !(AUDIT_KINDS as readonly string[]).includes(kind))
    details.push({ field: "kind", message: AUDIT_KINDS.join("・") });
  for (const f of ["member_id", "ticket_id"] as const) {
    const v = get(f);
    if (v !== null && !isUuid(v)) details.push({ field: f, message: "uuid" });
  }
  for (const f of ["from", "to"] as const) {
    const v = get(f);
    if (v !== null && !isDateTime(v)) details.push({ field: f, message: "ISO 8601 の日時（時差つき）" });
  }
  const limitRaw = get("limit");
  const limit = limitRaw === null ? AUDIT_LIMIT_DEFAULT : /^[0-9]{1,3}$/.test(limitRaw) ? Number(limitRaw) : NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > AUDIT_LIMIT_MAX)
    details.push({ field: "limit", message: `1〜${AUDIT_LIMIT_MAX}` });
  if (details.length) return { ok: false, code: "E-AUD-001", details };
  const w = parseWords(raw["q"]);
  if (!w.ok) return { ok: false, code: "E-AUD-010", details: [w.issue] };
  const cursorRaw = get("cursor");
  const after = cursorRaw === null ? null : decodeAuditCursor(cursorRaw);
  if (cursorRaw !== null && !after)
    return { ok: false, code: "E-AUD-002", details: [{ field: "cursor", message: "続きの印の形" }] };
  return {
    ok: true,
    value: {
      kind: kind as AuditKind | null,
      memberId: get("member_id"),
      ticketId: get("ticket_id"),
      from: get("from"),
      to: get("to"),
      limit,
      after,
      words: w.words,
    },
  };
}
