// 知らせを読んだことにする口（K-462）：readNotification（PATCH /api/v1/notifications/:id・体は { read } だけ）と
// readAllNotifications（POST /api/v1/notifications/read-all・体は空）。Cache-Control: private, no-store は入口（app.ts）が全部の答えに付ける。書くのは read_at だけ（メールの印 sent_at・failed_at・証跡 audit_events には触らない）。
//   上限（1 分 60 回）・認証・同意し直しの止め・社内の外枠だけ（取引先・運営は 403）・:id の形（uuid）・体の形（strict・知らない欄は 422）は契約の入口（op.ts）が先に確かめる。
//   入口の行の確かめは外している（scripts/ci/row_rules.mjs の ROW_EXEMPT_FIELDS・欄 readNotification.id を名指し。口ごと・道ごとには外さない）：別の人の行・行の守りを緩めたときの行が、入口では 404 の NOT_FOUND・403 になり、口の 404 とずれるため。
//   対象は一覧に出る行と同じ（VISIBLE_SQL・K-461 の list.ts）：自分宛て・inapp・消していない・種類が表にある・チケットの種類は今そのチケットが見える・読んで 30 日以内か未読。
//   それ以外（別の人・別の会社・無い・メールの印・消した・知らない種類・見えないチケット）は同じ 404・E-NTF-010（有ることも漏らさない）。
//   守りは 2 層：行の守り（notifications_self_read・notifications_self_only_write_*）と、口の文の条件（VISIBLE_SQL の member_id = app.user_id()）。
//   取引は 1 つ（withTenant）・文は 1 つ。DB の失敗は 503・E-PAGE-003（行は変わらない）。ログに payload・題名を出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { KanameError, kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { KNOWN_PARAMS, VISIBLE_SQL } from "./list.js";
import { toNotification, type NotificationRow } from "./shape.js";

const gone = (): HookReply => ({ status: 404, body: new KanameError("E-NTF-010").toJSON() });

// $1・$2＝VISIBLE_SQL の知っている種類とチケットの種類・$3＝知らせの id・$4＝読んだ印を付けるか（true）・未読に戻すか（false）。
// 1 文で更新して、同じ文の中で起こした人の名前を引く（行ごとに引かない）。
const READ_ONE_SQL = `
with u as (
  update notifications n
     set read_at = case when $4::boolean then coalesce(n.read_at, now()) else null end,
         updated_by = app.user_id()
   where n.id = $3::uuid and ${VISIBLE_SQL}
  returning n.id, n.event_kind_id, n.payload, n.read_at, n.created_at, n.created_by
)
select u.id, u.event_kind_id, u.payload, u.read_at, u.created_at, u.created_by as actor_id, m.display_name as actor_name
  from u
  left join members m on m.id = u.created_by and m.tenant_id = app.tenant_id() and m.deleted_at is null`;

// 同じ行の集まりを 2 本の更新が別々の順で鍵取りして deadlock（40P01）にならないよう、id の順で鍵を取る（1 文・1 取引は変わらない）
const READ_ALL_SQL = `
with c as (
  select n.id from notifications n
   where ${VISIBLE_SQL} and n.read_at is null
   order by n.id
     for update
)
update notifications n
   set read_at = now(), updated_by = app.user_id()
  from c
 where n.id = c.id`;

const KNOWN = KNOWN_PARAMS;
const down = (): HookReply => {
  console.error("[notifications] 読んだ印を書けなかった");
  return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
};

/** 既読にする・未読に戻す（体の read は入口が真偽と確かめ済み。無い・null は REQUIRED_INPUTS の決まりで口が 422） */
export function createReadNotification(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const read = a.input["read"];
    if (typeof read !== "boolean")
      return {
        status: 422,
        body: {
          error: "validation_failed",
          code: "VALIDATION_ERROR",
          details: [{ field: "read", message: "true か false" }],
        },
      };
    try {
      const rows = await withTenant(
        appPool,
        a.ctx,
        async (cl) => (await cl.query<NotificationRow>(READ_ONE_SQL, [...KNOWN, a.id, read])).rows,
      );
      const row = rows[0];
      if (!row) return gone();
      return { status: 200, body: { data: toNotification(row) } };
    } catch {
      return down();
    }
  };
}

/** 全部既読：一覧に出る未読を 1 つの取引・1 文で読んだことにする。答えの read は、この呼び出しで動かした行の数 */
export function createReadAllNotifications(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    try {
      const count = await withTenant(
        appPool,
        a.ctx,
        async (cl) => (await cl.query(READ_ALL_SQL, [...KNOWN])).rowCount ?? 0,
      );
      // POST の成功は契約で 201（作り手 build_api.py が POST を 201 に固定・K144-SHAPE-010）
      return { status: 201, body: { data: { read: count } } };
    } catch {
      return down();
    }
  };
}
