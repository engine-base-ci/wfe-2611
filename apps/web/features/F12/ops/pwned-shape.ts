// 照合が使えなかった登録の小窓（K-1019）の、口の答え → 部品の値。画面の外の純粋な関数（@/ を読まない）。
//   答えの形は listOpsPwned（K-995）と確定前の 1 行（K-1110：workspace・member が null）。字は下絵（ops-sample.ts の PWNED_ROWS）が正。
//   count は読まない（下絵は件数を見せない・D-156.79）
import type { PwnedRow } from "./ops-sample";

// ---------------------------------------------------------------- 口の答えの形（使う欄だけ）
export interface OpsPwnedRowAnswer {
  workspace: { id: string; name: string } | null;
  member: { id: string; name: string } | null;
  last_at: string;
  count: number;
}
export interface OpsPwnedAckAnswer {
  acknowledged_at: string;
  remaining: number;
}

/** 確定前の 1 行の鍵（「確かめた」はまとめて確かめる口 /ops/pwned/pending/ack を呼ぶ） */
export const PENDING_ID = "pending";
const PENDING_WS = "（登録はまだ確定していません）";
const DASH = "—";

// ---------------------------------------------------------------- 形の確かめ（違えば読めなかったとして扱う・G-15）
const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
/** 日時として読める字（読めなければ一覧ごと読めなかった扱い・「NaN」をふつうの行に見せない・G-15） */
const isAt = (v: unknown): v is string => isStr(v) && Number.isFinite(Date.parse(v));
const isRef = (v: unknown): boolean => v === null || (isObj(v) && isStr(v["id"]) && isStr(v["name"]));

function isRow(v: unknown): v is OpsPwnedRowAnswer {
  return isObj(v) && isRef(v["workspace"]) && isRef(v["member"]) && isAt(v["last_at"]) && isNum(v["count"]);
}

/** 一覧の答えの data（行の並び）。形が違えば null */
export function pwnedRowsOf(data: unknown): OpsPwnedRowAnswer[] | null {
  return Array.isArray(data) && data.every(isRow) ? (data as OpsPwnedRowAnswer[]) : null;
}

/** 確かめたの答えの data。形が違えば null */
export function ackOf(data: unknown): OpsPwnedAckAnswer | null {
  if (!isObj(data) || !isStr(data["acknowledged_at"]) || !isNum(data["remaining"])) return null;
  return { acknowledged_at: data["acknowledged_at"], remaining: data["remaining"] };
}

/** 外枠の答えの data の pwned.unchecked（無い・形が違えば 0＝帯を出さない） */
export function pwnedCountOf(shellData: unknown): number {
  const p = isObj(shellData) ? shellData["pwned"] : undefined;
  const n = isObj(p) ? p["unchecked"] : undefined;
  return isNum(n) && n > 0 ? n : 0;
}

/** 外枠の答え（{ data } を持つ物）の pwned.unchecked を n に置き換えた新しい答え（元は変えない） */
export function withPwnedCount<T extends { data?: unknown }>(shell: T, n: number): T {
  const data = isObj(shell.data) ? shell.data : {};
  const pwned = isObj(data["pwned"]) ? data["pwned"] : {};
  return { ...shell, data: { ...data, pwned: { ...pwned, unchecked: n } } };
}

// ---------------------------------------------------------------- 字
const JST_MS = 9 * 3_600_000;
const pad2 = (n: number): string => String(n).padStart(2, "0");

/** 日本時間の MM/DD HH:mm */
function jstAt(iso: string): string {
  const d = new Date(Date.parse(iso) + JST_MS);
  return `${pad2(d.getUTCMonth() + 1)}/${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/** 小窓の 1 行（id はワークスペースの id・確定前の行は pending） */
export function pwnedRowView(row: OpsPwnedRowAnswer): PwnedRow & { id: string } {
  return {
    id: row.workspace?.id ?? PENDING_ID,
    at: jstAt(row.last_at),
    ws: row.workspace?.name ?? PENDING_WS,
    person: row.member?.name ?? DASH,
  };
}
