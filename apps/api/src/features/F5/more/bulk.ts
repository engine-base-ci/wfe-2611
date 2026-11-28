// まとめて承認の口（K-768・契約の口 previewBulkApproval・bulkApprove・D-153.11・D-153.5・関門 C2）。
//   確かめ（POST /api/v1/approvals/bulk/preview）：DB の読むだけの関数 app.approval_bulk_scan の 1 取引。何も書かない。
//     体の approval_ids が無ければ「自分が承認する承認待ちの成果物の全部」（50 件を超えたら 409・E-APR-030）。
//   承認（POST /api/v1/approvals/bulk）：まず同じ関数で分け（読むだけ・1 取引）、承認できる物を古い順に 1 件ずつ、
//     1 件承認する口と同じ app.approval_decide(承認, 'approve', null) で 1 件 1 取引に承認する（守りは関数のまま・直さない）。
//     1 件ごとに取引が分かれるので、一部が決まっていても通った物は承認される。守りの判定・知らない言葉・関数の例外は
//     その 1 件で止めて 503・E-PAGE-003（それまでに承認した物は承認のまま）。最後に 1 回だけ件数の証跡 approvals.bulk を別の取引で書く
//     （書けなくても承認は残るので 201）。接続は 1 要求につき同時に 1 本（並列にしない）。
//   ログに題名・番号・id を出さない（場所と例外の種類だけ）。Cache-Control: private, no-store は入口（app.ts）が付ける
import type pg from "pg";
import { isUuid } from "@kaname/contracts";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { fromCatalog, invalid } from "../approve-complete/errors.js";

/** 1 回の呼び出しで扱う承認の上限（取引の数と待ち時間の見積もりのため・G-16） */
const MAX_IDS = 50;
const WHERE = "[approval-bulk]";

type Item = {
  approval_id: string;
  ticket_id: string;
  number: string;
  title: string;
  irreversible: boolean;
  unchecked: number;
};
type Excluded = { approval_id: string; reason: string; number: string | null; title: string | null };
type Scan = { error?: string; items?: Item[]; excluded?: Excluded[] };
type Decided = { error?: string; run_id?: unknown; pc?: unknown };

/** 体の approval_ids を確かめる（uuid の並び・1〜50 個・重複は 1 つに・小文字に直す）。required でなければ無くてよい（null も無いと同じ）。
 *  知らない欄は入口の strict な形（schemas）が先に 422 にする */
export function parseBulkInput(
  input: Record<string, unknown>,
  o: { required: boolean },
): { ids: string[] | null } | { reply: HookReply } {
  const v = input["approval_ids"];
  if (v === undefined || v === null) {
    return o.required ? { reply: invalid("approval_ids", "承認する物を選んでください") } : { ids: null };
  }
  const bad = { reply: invalid("approval_ids", `承認する物は 1〜${MAX_IDS} 件の id で選んでください`) };
  if (!Array.isArray(v) || v.length < 1 || v.length > MAX_IDS) return bad;
  if (!v.every((x): x is string => typeof x === "string" && isUuid(x))) return bad;
  return { ids: [...new Set(v.map((x) => x.toLowerCase()))] };
}

/** 確かめの関数を 1 取引で呼ぶ。null は文脈が無い・例外は投げる */
async function scan(pool: pg.Pool, a: HookArgs, ids: string[] | null): Promise<Scan | null> {
  return withTenant(pool, a.ctx, async (cl) => {
    const r = await cl.query<{ v: Scan | null }>("select app.approval_bulk_scan($1::uuid[], $2) as v", [
      ids ?? [],
      ids === null,
    ]);
    return r.rows[0]?.v ?? null;
  });
}

/** 確かめの答えの言葉 → 止める答え（無ければ undefined） */
function scanStop(r: Scan | null): HookReply | undefined {
  if (r === null || r.error === "not_member") return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
  if (r.error === "too_many") return fromCatalog("E-APR-030", 409);
  if (r.error !== undefined || !Array.isArray(r.items) || !Array.isArray(r.excluded)) {
    console.error(`${WHERE} 確かめ：知らない答えなので止める側に倒した`);
    return fromCatalog("E-PAGE-003", 503);
  }
  return undefined;
}

/** 確かめと承認の両方が使う：分ける。止める答えか、分けた結果 */
async function scanOrStop(
  pool: pg.Pool,
  a: HookArgs,
  ids: string[] | null,
  where: string,
): Promise<{ reply: HookReply } | { items: Item[]; excluded: Excluded[] }> {
  let r: Scan | null;
  try {
    r = await scan(pool, a, ids);
  } catch (e) {
    console.error(`${WHERE} ${where}：確かめで失敗した（${(e as Error)?.name ?? "Error"}）`);
    return { reply: fromCatalog("E-PAGE-003", 503) };
  }
  const stop = scanStop(r);
  if (stop) return { reply: stop };
  return { items: r!.items!, excluded: r!.excluded! };
}

export function createBulkPreview(pool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const p = parseBulkInput(a.input ?? {}, { required: false });
    if ("reply" in p) return p.reply;
    const s = await scanOrStop(pool, a, p.ids, "確かめ");
    if ("reply" in s) return s.reply;
    const eligible = s.items;
    return {
      status: 201,
      body: {
        data: {
          eligible,
          excluded: s.excluded.map((x) => ({ approval_id: x.approval_id, reason: x.reason })),
          count: eligible.length,
          irreversible_count: eligible.filter((x) => x.irreversible).length,
          unchecked_count: eligible.reduce((n, x) => n + (Number.isInteger(x.unchecked) ? x.unchecked : 0), 0),
        },
      },
    };
  };
}

/** 1 件承認する関数の答えの言葉 → skipped の理由。知らない言葉（guard_failed を含む）は null＝止める */
const SKIP_REASONS: Readonly<Record<string, string>> = {
  decided: "decided",
  not_approver: "not_approver",
  not_writable: "not_writable",
  not_found: "unavailable",
  not_member: "unavailable",
};

/** 1 件を 1 取引で承認する。例外は投げる */
async function approveOne(pool: pg.Pool, a: HookArgs, id: string): Promise<Decided | undefined> {
  return withTenant(
    pool,
    a.ctx,
    async (cl) =>
      (await cl.query<{ v: Decided }>("select app.approval_decide($1, 'approve', null) as v", [id])).rows[0]?.v,
  );
}

/** まとめての証跡（件数だけ・別の取引）。書けなくても承認は残るので投げない */
async function audit(pool: pg.Pool, a: HookArgs, counts: Record<string, number>): Promise<void> {
  try {
    await withTenant(pool, a.ctx, async (cl) => {
      await cl.query("select app.record_audit('approvals.bulk', 'approvals', 'bulk', 'C2', $1::jsonb)", [
        JSON.stringify(counts),
      ]);
    });
  } catch (e) {
    console.error(`${WHERE} 承認：まとめての証跡が書けなかった（${(e as Error)?.name ?? "Error"}）`);
  }
}

type Updated = { approval_id: string; ticket_id: string; number: string; run_id: unknown; pc: unknown };
type Skipped = { approval_id: string; number: string | null; title: string | null; reason: string };

/** 承認できる物を古い順に 1 件ずつ。止まったら null（それまでの分は承認のまま） */
async function approveAll(
  pool: pg.Pool,
  a: HookArgs,
  items: Item[],
): Promise<{ updated: Updated[]; skipped: Skipped[] } | null> {
  const updated: Updated[] = [];
  const skipped: Skipped[] = [];
  for (const it of items) {
    let r: Decided | undefined;
    try {
      r = await approveOne(pool, a, it.approval_id);
    } catch (e) {
      console.error(`${WHERE} 承認：1 件の承認で失敗した（${(e as Error)?.name ?? "Error"}）`);
      return null;
    }
    if (!r) return null;
    if (r.error === undefined) {
      updated.push({
        approval_id: it.approval_id,
        ticket_id: it.ticket_id,
        number: it.number,
        run_id: r.run_id,
        pc: r.pc,
      });
      continue;
    }
    const reason = SKIP_REASONS[String(r.error)];
    if (reason === undefined) {
      console.error(`${WHERE} 承認：知らない答え（${String(r.error)}）なので止める側に倒した`);
      return null;
    }
    const known = reason !== "unavailable";
    skipped.push({
      approval_id: it.approval_id,
      number: known ? it.number : null,
      title: known ? it.title : null,
      reason,
    });
  }
  return { updated, skipped };
}

export function createBulkApprove(pool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const p = parseBulkInput(a.input ?? {}, { required: true });
    if ("reply" in p) return p.reply;
    const ids = p.ids ?? [];
    const s = await scanOrStop(pool, a, ids, "承認");
    if ("reply" in s) return s.reply;
    const done = await approveAll(pool, a, s.items);
    if (done === null) return fromCatalog("E-PAGE-003", 503);
    const skipped: Skipped[] = [
      ...s.excluded.map((x) => ({ approval_id: x.approval_id, number: x.number, title: x.title, reason: x.reason })),
      ...done.skipped,
    ];
    await audit(pool, a, { requested: ids.length, updated: done.updated.length, skipped: skipped.length });
    return { status: 201, body: { data: { updated: done.updated, skipped } } };
  };
}
