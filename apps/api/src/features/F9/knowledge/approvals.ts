// 承認待ちを読む口（K-688・契約の口 listKnowledgeApprovals・GET /api/v1/knowledge/approvals）。読むだけ（DB に書かない・証跡なし）。
//   1 つの取引の中で：今の人が承認できる人（app.kn_can_approve）でなければ 403 → 自分が承認する承認待ち（app.kn_approval_rows・新しい順に 50 行・
//   承認する人が読めない棚のページでも本文を渡す）に、似たページ（app.kn_similar・security invoker）を口の接続で 1 件ずつ重ねる（文は 2 つ）。
//   似たページは承認する人に見える棚だけが相手になる。フォルダの共有・本文が無い行は null。DB の失敗は 503。ログに題名・本文を出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { forbidden, unavailable } from "./reply.js";
import { placeText } from "./shape.js";
import { BODY_HEAD, SIMILAR_MIN } from "./similar.js";

const CAN_SQL = "select app.kn_can_approve() as ok";
// 行ごとに似たページの上位 1 件（頼まれたページ自身は除く）。本文は頭 BODY_HEAD 字だけを比べるために渡す
const ROWS_SQL = `select r.id, r.kind, r.from_name, r.from_shelf_name, r.to_shelf_name, r.title, r.summary, r.message,
       r.requested_at, r.body, s.id as similar_id, s.title as similar_title, s.shelf_name as similar_shelf, s.folders as similar_folders
  from app.kn_approval_rows() r
  left join lateral (
    select x.id, x.title, x.shelf_name, x.folders
      from app.kn_similar(r.title || ' ' || r.summary, left(coalesce(r.body ->> 'text', ''), $1), r.page_id, $2::real) x
     where r.page_id is not null and r.body is not null
     limit 1) s on true
 order by r.requested_at desc, r.id desc`;

interface Row {
  id: string;
  kind: string;
  from_name: string;
  from_shelf_name: string;
  to_shelf_name: string;
  title: string;
  summary: string | null;
  message: string | null;
  requested_at: Date | string;
  body: unknown;
  similar_id: string | null;
  similar_title: string | null;
  similar_shelf: string | null;
  similar_folders: string[] | null;
}

const iso = (v: Date | string): string => (v instanceof Date ? v : new Date(v)).toISOString();

const shapeOf = (r: Row) => ({
  id: r.id,
  kind: r.kind,
  from_name: r.from_name,
  from_shelf_name: r.from_shelf_name,
  to_shelf_name: r.to_shelf_name,
  title: r.title,
  desc: r.summary ?? "",
  message: r.message,
  requested_at: iso(r.requested_at),
  similar:
    r.similar_id === null
      ? null
      : {
          page_id: r.similar_id,
          title: r.similar_title ?? "",
          place: placeText(r.similar_shelf ?? "", r.similar_folders ?? []),
        },
  body: r.body ?? null,
});

async function run(cl: pg.PoolClient): Promise<HookReply> {
  const can = (await cl.query<{ ok: boolean }>(CAN_SQL)).rows[0];
  if (can?.ok !== true) return forbidden();
  const rows = (await cl.query<Row>(ROWS_SQL, [BODY_HEAD, SIMILAR_MIN])).rows;
  const data = rows.map(shapeOf);
  return { status: 200, body: { data, meta: { count: data.length } } };
}

export function createListKnowledgeApprovals(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    try {
      return await withTenant(appPool, a.ctx, (cl) => run(cl));
    } catch (e) {
      console.error(`[knowledge] 承認待ちを読めなかった（${e instanceof Error ? e.name : typeof e}）`);
      return unavailable();
    }
  };
}
