// 決めた履歴を読む口（K-750・契約の口 listApprovalHistory・GET /api/v1/approvals/history・読むだけ・D-125.105・D-153.31）。
//   呼んだ人が決めた AI の成果物の承認（承認・差し戻し・止める）を、決めた新しい順に読む。絞るのも切るのも数えるのも DB の関数
//   app.approval_history の 1 本（G-16）。読む前の片付け（K-164）は呼ばない（決めた物を読むだけで、待っている仕事を止めない）。
//   問い合わせの値は口が自分で断る（入口の list の枝は limit・cursor・scope_id・sort しか読まない）：
//   decision は approve・return・stop だけ／from・to は暦に在る日（YYYY-MM-DD）／許す欄は decision・from・to・limit・cursor だけ。どれも 422（欄名つき）。
//   from が to より後はエラーにせず空（DB の関数がそのまま空を返す）。
//   続きの鍵は「決めた時刻の字|id」を base64url にした物（時刻は DB の答えの字のまま）。読めない鍵は 422（欄 cursor・K-161 と同じ形）
import type pg from "pg";
import { isUuid } from "@kaname/contracts";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { kanameError } from "@kaname/errors";
import { invalid } from "../approve-complete/errors.js";

export const LIMIT_DEFAULT = 20;
const DECISIONS: ReadonlySet<string> = new Set(["approve", "return", "stop"]);
const ALLOWED: ReadonlySet<string> = new Set(["decision", "from", "to", "limit", "cursor"]);
const DATE_RE = /^(?!0000-)\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)$/;

/** 続きの鍵 */
export interface HistoryKey {
  at: string;
  id: string;
}

/** 暦に在る日か（2026-02-30 は不可。DB の ::date に渡すと 22008 になる前に断る） */
const realDate = (s: string): boolean =>
  DATE_RE.test(s) &&
  !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) &&
  new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);

/** 鍵の文字列を読む。読めない（復号して戻らない・2 つに分かれない・時刻や uuid でない）なら null */
export function decodeHistoryKey(cursor: string): HistoryKey | null {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(cursor)) return null;
  const text = Buffer.from(cursor, "base64url").toString("utf8");
  if (Buffer.from(text, "utf8").toString("base64url") !== cursor) return null;
  const parts = text.split("|");
  if (parts.length !== 2) return null;
  const [at, id] = parts as [string, string];
  if (!TIME_RE.test(at) || Number.isNaN(Date.parse(at))) return null;
  if (!isUuid(id)) return null;
  return { at, id };
}
export const encodeHistoryKey = (k: HistoryKey): string => Buffer.from(`${k.at}|${k.id}`, "utf8").toString("base64url");

interface Query {
  decision: string | null;
  from: string | null;
  to: string | null;
  limit: number;
  key: HistoryKey | null;
}

/** 問い合わせを確かめる。誤りは 422（欄名つき）を返す */
function readQuery(q: Record<string, string>): Query | HookReply {
  const unknown = Object.keys(q).find((k) => !ALLOWED.has(k));
  if (unknown !== undefined) return invalid(unknown, "使えない問い合わせの欄");
  const decision = q["decision"];
  if (decision !== undefined && !DECISIONS.has(decision)) return invalid("decision", "approve・return・stop のどれか");
  for (const field of ["from", "to"] as const) {
    const v = q[field];
    if (v !== undefined && !realDate(v)) return invalid(field, "日付（YYYY-MM-DD）");
  }
  // limit は入口（op.ts）が 1〜200 の整数と確かめ済み（空は指定なし）
  const limit = q["limit"] ? Number(q["limit"]) : LIMIT_DEFAULT;
  const cursor = q["cursor"];
  const key = cursor ? decodeHistoryKey(cursor) : null;
  if (cursor && !key) return invalid("cursor", "続きの印が不正です");
  return { decision: decision ?? null, from: q["from"] ?? null, to: q["to"] ?? null, limit, key };
}

interface HistoryItem {
  id: string;
  decided_at: string;
  [k: string]: unknown;
}
interface HistoryAnswer {
  error?: string;
  rows?: HistoryItem[];
  counts?: Record<string, number>;
}

const isReply = (x: Query | HookReply): x is HookReply => "status" in x;

/** 止める側に倒す（fail-closed・503・E-PAGE-003）。ログには場所と言葉の種類だけ（問い合わせの値・行の中身を出さない） */
const unavailable = (why: string): HookReply => {
  console.error(`[approval-history] 決めた履歴：止める側に倒した（${why}）`);
  return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
};

export function createApprovalHistory(pool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const read = readQuery(a.c.req.query());
    if (isReply(read)) return read;
    const { decision, from, to, limit, key } = read;
    let v: HistoryAnswer | undefined;
    try {
      v = await withTenant(
        pool,
        a.ctx,
        async (cl) =>
          (
            await cl.query<{ v: HistoryAnswer }>("select app.approval_history($1, $2, $3, $4, $5, $6) as v", [
              decision,
              from,
              to,
              limit + 1,
              key?.at ?? null,
              key?.id ?? null,
            ])
          ).rows[0]?.v,
      );
    } catch (e) {
      return unavailable((e as Error)?.name ?? "Error");
    }
    if (!v) return unavailable("答えが無い");
    if (v.error !== undefined) return unavailable(`知らない答え ${String(v.error)}`);
    const rows = v.rows ?? [];
    // DB から limit+1 件取った行を、続きの有無を見た後に limit 件に戻す（入力でない・DB 側で絞った後の行）
    const data = rows.filter((_, i) => i < limit);
    const last = data.at(-1);
    const more = rows.length > limit && last;
    return {
      status: 200,
      body: {
        data,
        meta: {
          limit,
          ...(more ? { cursor: encodeHistoryKey({ at: last.decided_at, id: last.id }) } : {}),
          counts: v.counts ?? { total: 0, approve: 0, return: 0, stop: 0 },
        },
      },
    };
  };
}
