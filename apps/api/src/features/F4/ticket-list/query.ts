// チケットの一覧の口（K-92）の問い合わせの確かめと、次の分の鍵（keyset のカーソル）。DB に触らない純粋な関数だけ。
//   問い合わせ：view（mine／all・既定 mine）・q（100 文字まで）・scope_id（uuid）・limit（1〜100・既定 50）・cursor（この口が出した鍵）。
//   ほかの絞り込みは「まだ使えない」で 422・E-VAL-018（黙って無視しない・D-128.152）。sort の列名の形は入口（op.ts）が先に確かめる
import { isUuid } from "@kaname/contracts";

export const LIST_LIMIT_DEFAULT = 50;
export const LIST_LIMIT_MAX = 100;
export const Q_MAX = 100;
const CURSOR_MAX = 200; // 入口の鍵の形（op.ts の KEY_CURSOR_OPS・base64url の 1〜200 字）と同じ

export type View = "mine" | "all";
/** 次の分の鍵：mine は [期限（無ければ infinity）, 更新, id]、all は [更新, id] */
export type Cursor =
  { view: "mine"; due: string; updated: string; id: string } | { view: "all"; updated: string; id: string };
export interface ListQuery {
  view: View;
  /** 題名の部分一致の LIKE の形（全角半角・大文字小文字をそろえ、% _ \ を逃がした物）。絞らないときは null */
  titleLike: string | null;
  /** 番号の照合の形（題名の形に加え、ハイフンの種類を - にそろえた物）。絞らないときは null */
  number: string | null;
  scopeId: string | null;
  limit: number;
  cursor: Cursor | null;
}
export interface Issue {
  field: string;
  message: string;
}
export type Parsed =
  | { ok: true; value: ListQuery }
  | { ok: false; code: "VALIDATION_ERROR" | "E-VAL-017" | "E-VAL-018"; details: Issue[] };

/** まだ使えない絞り込み（K-67 が作る）。付けて呼ばれたら 422・E-VAL-018 */
export const NOT_YET = new Set([
  "kind_id",
  "stage_id",
  "assignee_id",
  "client_id",
  "due_from",
  "due_to",
  "start_from",
  "start_to",
  "overdue",
  "fire",
  "parent",
  "fields",
  "sort",
]);
const KNOWN = new Set(["view", "q", "scope_id", "limit", "cursor"]);
const DATE = /^(\d{4}-\d{2}-\d{2}|infinity)$/;
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:\d{2})?)$/;
const HYPHENS = /[‐‑‒–—―ー−－]/g;

/** 表記ゆらぎ：全角半角（NFKC）・前後の空白・大文字小文字をそろえる（題名の側も SQL で同じ形にして比べる） */
export function normalizeQ(s: string): string {
  return s.normalize("NFKC").trim().toLowerCase();
}
/** LIKE の特別な文字（% _ \）を文字として探すように逃がす（escape '\'） */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
/** 番号の照合の形：ハイフンの種類（‐ ー − など）を - にそろえる。題名には当てない（「サーバー」の ー を変えない） */
export function normalizeNumber(s: string): string {
  return s.replace(HYPHENS, "-");
}

export function encodeCursor(c: Cursor): string {
  const arr = c.view === "mine" ? [c.view, c.due, c.updated, c.id] : [c.view, c.updated, c.id];
  return Buffer.from(JSON.stringify(arr), "utf8").toString("base64url");
}
/** 壊れた物・形の違う物・別の view の鍵は null（422・欄 cursor） */
export function decodeCursor(s: string, view: View): Cursor | null {
  if (s.length > CURSOR_MAX || !/^[A-Za-z0-9_-]+$/.test(s)) return null;
  let arr: unknown;
  try {
    arr = JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!Array.isArray(arr) || arr[0] !== view || !arr.every((x) => typeof x === "string")) return null;
  const v = arr as string[];
  if (view === "mine") {
    if (v.length !== 4 || !DATE.test(v[1]!) || !isStamp(v[2]!) || !isUuid(v[3]!)) return null;
    return { view, due: v[1]!, updated: v[2]!, id: v[3]! };
  }
  if (v.length !== 3 || !isStamp(v[1]!) || !isUuid(v[2]!)) return null;
  return { view, updated: v[1]!, id: v[2]! };
}
const isStamp = (s: string) => STAMP.test(s) && !Number.isNaN(Date.parse(s));

/** 問い合わせを確かめる。raw は届いたままの問い合わせ（空の値も含む） */
export function parseListQuery(raw: Record<string, string>): Parsed {
  const notYet = Object.keys(raw).filter((k) => NOT_YET.has(k));
  if (notYet.length)
    return { ok: false, code: "E-VAL-018", details: notYet.map((field) => ({ field, message: "まだ使えない" })) };
  const details: Issue[] = Object.keys(raw)
    .filter((k) => !KNOWN.has(k))
    .map((field) => ({ field, message: "受け付けない問い合わせ" }));
  const viewRaw = raw["view"] ?? "";
  const view: View | null = viewRaw === "" || viewRaw === "mine" ? "mine" : viewRaw === "all" ? "all" : null;
  if (!view) details.push({ field: "view", message: "mine か all" });
  const limitRaw = raw["limit"] ?? "";
  const limit = limitRaw === "" ? LIST_LIMIT_DEFAULT : /^[0-9]{1,4}$/.test(limitRaw) ? Number(limitRaw) : NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > LIST_LIMIT_MAX)
    details.push({ field: "limit", message: `1〜${LIST_LIMIT_MAX}` });
  const scopeRaw = raw["scope_id"] ?? "";
  if (scopeRaw !== "" && !isUuid(scopeRaw)) details.push({ field: "scope_id", message: "uuid" });
  const cursorRaw = raw["cursor"] ?? "";
  const cursor = cursorRaw === "" || !view ? null : decodeCursor(cursorRaw, view);
  if (cursorRaw !== "" && !cursor) details.push({ field: "cursor", message: "不正" });
  if (details.length) return { ok: false, code: "VALIDATION_ERROR", details };
  const q = normalizeQ(raw["q"] ?? "");
  if ([...q].length > Q_MAX)
    return { ok: false, code: "E-VAL-017", details: [{ field: "q", message: `${Q_MAX} 文字まで` }] };
  return {
    ok: true,
    value: {
      view: view!,
      titleLike: q ? `%${escapeLike(q)}%` : null,
      number: q ? normalizeNumber(q) : null,
      scopeId: scopeRaw || null,
      limit,
      cursor,
    },
  };
}
