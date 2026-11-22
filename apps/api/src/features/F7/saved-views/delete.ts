// 保存した検索条件を消す口（K-476・契約の口 deleteSavedView・DELETE /api/v1/saved_views/:id・D-128.119・D-151.9・関門 C2）。
//   消すのは「消した印」（deleted_at）を付けるだけ（行は残す・証跡を残す）。消した条件の名前は同じ人がまた使える（一意の索引は消していない物の中）。
//   消せる人：作った人と、グループの全員向けの物は見せているグループのマネージャー（入口の行の確かめと、行の守りの update の 2 層）。
//   1 つの取引の中で、1 文の update（where deleted_at is null・returning は付けない：行の守りの select は消した印を外さないので、戻りでなく rowCount で数える）。
//   0 行なら見える（消していない）か読み直して、見えれば 403（edit の無いマネージャー）・見えなければ 404（無い・見えない・先に消えた：同時の 2 回目も）。
//   1 行なら証跡 saved_views.delete（C2・中身は空）。知らせは出さない。書く所で DB が落ちたら 503 E-PAGE-003（down.ts・1 つの取引なので何も残らない・11-22 18:30 の決め）。引き金 saved_views_guard の 42501 は 403
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { writeDown } from "./down.js";
import { fail } from "./input.js";

const DELETE_SQL =
  "update saved_views set deleted_at = now(), updated_by = app.user_id() where id = $1 and deleted_at is null";
const LIVE_SQL = "select exists (select 1 from saved_views where id = $1 and deleted_at is null) as seen";
const AUDIT_SQL = "select app.record_audit('saved_views.delete', 'saved_views', $1, 'C2', '{}'::jsonb)";
const FORBIDDEN: HookReply = { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };

export function createDeleteSavedView(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    if (a.id === null) return fail("E-PAGE-001");
    const id = a.id;
    try {
      return await withTenant(appPool, a.ctx, async (cl): Promise<HookReply> => {
        const done = await cl.query(DELETE_SQL, [id]);
        if (done.rowCount === 0) {
          const seen = (await cl.query<{ seen: boolean }>(LIVE_SQL, [id])).rows[0]?.seen === true;
          return seen ? FORBIDDEN : fail("E-PAGE-001");
        }
        await cl.query(AUDIT_SQL, [id]);
        return { status: 200, body: { data: { id } } };
      });
    } catch (e) {
      if ((e as { code?: unknown } | null)?.code === "42501") return FORBIDDEN;
      return writeDown("保存した条件を消す", e);
    }
  };
}
