// 外枠の数と帯を 1 本で返す口（K-465）：getShell（GET /api/v1/shell）。読むだけ（DB に書かない・知らせない・既読にしない）。
//   外枠（左のメニュー・上の帯・PC の表示）が別々に読んでいた me・listScopes・listApprovalQueue・listMyDevices をまとめる（D-151.7・D-128.111）。
//   上限（1 分 120 回）・認証・同意し直しの止め・社内の外枠だけ（取引先・運営は 403）は契約の入口（op.ts）が先に確かめる。
//   取引は 1 つ（withTenant）・文は 4 つ：①本人・会社・承認待ち・PC・帯・はじめにやること ②グループと件数 ③未読の数 ④保存した条件。
//   グループごと・行ごとに引かない。どれかが失敗したら全体が 503・E-PAGE-003（部分の答えは返さない）。
//   ログイン後の稼働状況と帯（K-957 の帯と画面いっぱいの形が読む）は getServiceStatusForMember と同じ app.member_service_status() を①に入れる
//   （画面ごとの口の本数を増やさない・PM の決め 2026-11-28・文の数は 4 のまま）。
//   承認待ちは app.approval_queue_count()・未読は K-461 の UNREAD_COUNT_SQL（一覧と数がずれない）・保存した条件は K-475 の readSavedViews（一覧と同じ文・同じ 13 個の鍵）をそのまま使う。
//   本人の行が無い（今の会社のメンバーでない）ときは 403。ログに名前・題名を出さない
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { setupLeft, STATE_COLS, type StateRow } from "../../F4/setup-tasks/hooks.js";
import { KNOWN_PARAMS, UNREAD_COUNT_SQL } from "../notifications/list.js";
import { readSavedViews } from "../saved-views/list.js";

// ① 自分と今の会社・承認待ち・PC・帯・はじめにやること（STATE_COLS は K-250 の数え方の列）。
//   PC は app.bridge_devices（アカウント全体・外した PC は出ない）：state が live の物があれば connected・count は外していない台数（waiting も 1 台）
const HEAD_SQL = `
select m.id, m.display_name, m.role_id, t.id as tenant_id, nullif(btrim(t.name), '') as tenant_name,
       app.approval_queue_count() as approvals_waiting,
       (select count(*)::int from jsonb_array_elements(app.bridge_devices(m.id)) d) as pc_count,
       exists (select 1 from jsonb_array_elements(app.bridge_devices(m.id)) d where d->>'state' = 'live') as pc_live,
       app.public_service_status() as banner,
       app.member_service_status() as service_status,
       ${STATE_COLS}
  from members m
  join tenants t on t.id = m.tenant_id
 where m.id = app.user_id() and m.tenant_id = app.tenant_id() and m.deleted_at is null`;

// ② 自分に見えるグループと件数。グループの表の行の守り（scopes_tenant_read）は会社の全員に全グループを見せるので、見える範囲は
//   visible_scopes（席の層の木・所属の木・view/edit の権限の木）で口の文が絞る。件数はそのグループとその下のグループの、完了でない・消していない・自分に見えるチケット
//   （一覧でそのグループを選んだときの件数と同じ数え方・K-92）。writable は tickets の edit を持つか（listScopes の meta.writable と同じ判定）
const GROUPS_SQL = `
with recursive tree(root_id, id) as (
  select s.id, s.id from scopes s
   where s.tenant_id = app.tenant_id() and s.deleted_at is null and s.id = any(visible_scopes(app.user_id()))
  union all
  select tr.root_id, c.id from tree tr join scopes c on c.parent_id = tr.id and c.tenant_id = app.tenant_id()
)
select s.id, s.name, s.ticket_prefix,
       has_permission(app.user_id(), 'tickets', s.id, 'edit') as writable,
       (select count(*)::int
          from tree tr
          join tickets t on t.scope_id = tr.id
          join ticket_stages st on st.id = t.stage_id
         where tr.root_id = s.id and t.tenant_id = app.tenant_id() and t.deleted_at is null
           and st.key is distinct from 'done'
           and app.ticket_draft_ok(t.draft_import_id, app.user_id())) as open_count
  from scopes s
 where s.tenant_id = app.tenant_id() and s.deleted_at is null and s.id = any(visible_scopes(app.user_id()))
 order by s.created_at, s.id`;

interface HeadRow extends StateRow {
  id: string;
  display_name: string;
  role_id: string | null;
  tenant_id: string;
  tenant_name: string | null;
  approvals_waiting: number;
  pc_count: number;
  pc_live: boolean;
  banner: unknown;
  service_status: unknown;
}

interface GroupRow {
  id: string;
  name: string;
  ticket_prefix: string | null;
  writable: boolean;
  open_count: number;
}

const FORBIDDEN: HookReply = { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };

export function createGetShell(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    try {
      return await withTenant(appPool, a.ctx, async (cl): Promise<HookReply> => {
        const head = (await cl.query<HeadRow>(HEAD_SQL)).rows[0];
        if (!head) return FORBIDDEN;
        const groups = (await cl.query<GroupRow>(GROUPS_SQL)).rows;
        const unread = (await cl.query<{ n: number }>(UNREAD_COUNT_SQL, [...KNOWN_PARAMS])).rows[0]?.n ?? 0;
        const savedViews = await readSavedViews(cl, null, null);
        return {
          status: 200,
          body: {
            data: {
              member: { id: head.id, name: head.display_name, role_id: head.role_id },
              workspace: { id: head.tenant_id, name: head.tenant_name },
              approvals_waiting: head.approvals_waiting,
              notifications_unread: unread,
              groups: groups.map((g) => ({
                id: g.id,
                name: g.name,
                ticket_prefix: g.ticket_prefix,
                writable: g.writable,
                open_count: g.open_count,
              })),
              pc: { connected: head.pc_live, count: head.pc_count },
              setup_left: setupLeft(head),
              banner: head.banner,
              service_status: head.service_status,
              saved_views: savedViews,
            },
          },
        };
      });
    } catch {
      console.error("[shell] 外枠の数を読めなかった");
      return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
    }
  };
}
